/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Appointment,
  AuditLogEntry,
  NewAppointmentPayload,
  Repository,
  UpdateAppointmentPayload,
  WaitlistEntry,
} from '../../types.ts';
import { getValidatedConfig } from '../config.ts';
import { getNowInIST } from '../ist.ts';
import { mapDbErrorToUserMessage } from '../supabase.ts';
import { LocalStorageRepo } from './localStorageRepo.ts';

export class SupabaseRepo implements Repository {
  name: 'supabase' = 'supabase';
  isLive: boolean = true;
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async getAppointments(): Promise<Appointment[]> {
    try {
      const { data, error } = await this.client
        .from('appointments')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) {
        console.warn('Supabase query failed, falling back to local storage:', error);
        const local = new LocalStorageRepo();
        return local.getAppointments();
      }
      return (data || []) as Appointment[];
    } catch (err: unknown) {
      console.warn('[SupabaseRepo] Network failure accessing Supabase. Falling back to local storage:', err);
      const local = new LocalStorageRepo();
      return local.getAppointments();
    }
  }

  async getAppointmentById(id: string): Promise<Appointment | null> {
    try {
      const { data, error } = await this.client
        .from('appointments')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.warn(`Failed to fetch appointment ${id} from Supabase, falling back to local:`, error);
        const local = new LocalStorageRepo();
        return local.getAppointmentById(id);
      }
      return (data as Appointment) || null;
    } catch (err) {
      console.warn(`[SupabaseRepo] Network failure fetching appointment ${id}. Falling back to local:`, err);
      const local = new LocalStorageRepo();
      return local.getAppointmentById(id);
    }
  }

  async createAppointment(payload: NewAppointmentPayload): Promise<Appointment> {
    try {
      const record: Record<string, any> = {
        client_name: payload.client_name.trim(),
        phone: payload.phone || null,
        date: payload.date,
        time: payload.time,
        status: payload.status || 'Booked',
        source: payload.source,
        notes: payload.notes || null,
        reason: payload.reason || null,
        visit_type: payload.visit_type || 'In clinic',
        seed_key: payload.seed_key || null,
      };

      let { data, error } = await this.client
        .from('appointments')
        .insert(record)
        .select()
        .single();

      // Graceful fallback if Step 0 SQL migration hasn't been run yet in Supabase
      if (error && (error.code === '42703' || error.message?.includes('does not exist'))) {
        delete record.seed_key;
        delete record.reason;
        delete record.visit_type;
        const retry = await this.client.from('appointments').insert(record).select().single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        throw new Error(mapDbErrorToUserMessage(error));
      }
      return data as Appointment;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('Unable to reach the server') ||
        msg.includes('TypeError')
      ) {
        console.warn('[SupabaseRepo] Network failure on createAppointment. Falling back to local storage.');
        const local = new LocalStorageRepo();
        return local.createAppointment(payload);
      }
      throw err;
    }
  }

  async updateAppointment(id: string, payload: UpdateAppointmentPayload): Promise<Appointment> {
    try {
      const updateData: Record<string, unknown> = {};
      if (payload.client_name !== undefined) updateData.client_name = payload.client_name.trim();
      if (payload.phone !== undefined) updateData.phone = payload.phone;
      if (payload.date !== undefined) updateData.date = payload.date;
      if (payload.time !== undefined) updateData.time = payload.time;
      if (payload.status !== undefined) updateData.status = payload.status;
      if (payload.notes !== undefined) updateData.notes = payload.notes;
      if (payload.reason !== undefined) updateData.reason = payload.reason;
      if (payload.visit_type !== undefined) updateData.visit_type = payload.visit_type;
      if (payload.confirmed_at !== undefined) updateData.confirmed_at = payload.confirmed_at;
      updateData.updated_at = new Date().toISOString();

      let query = this.client.from('appointments').update(updateData).eq('id', id);

      // Optimistic concurrency check
      if (payload.expected_updated_at) {
        query = query.eq('updated_at', payload.expected_updated_at);
      }

      let { data, error } = await query.select();

      // Graceful fallback if optional columns do not exist yet
      if (error && (error.code === '42703' || error.message?.includes('does not exist'))) {
        delete updateData.reason;
        delete updateData.visit_type;
        let retryQuery = this.client.from('appointments').update(updateData).eq('id', id);
        if (payload.expected_updated_at) {
          retryQuery = retryQuery.eq('updated_at', payload.expected_updated_at);
        }
        const retry = await retryQuery.select();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        throw new Error(mapDbErrorToUserMessage(error));
      }

      if (!data || data.length === 0) {
        if (payload.expected_updated_at) {
          throw new Error('This appointment was changed elsewhere, reloaded');
        }
        throw new Error('Appointment not found or not modified');
      }

      return data[0] as Appointment;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('Unable to reach the server') ||
        msg.includes('TypeError')
      ) {
        console.warn('[SupabaseRepo] Network failure on updateAppointment. Falling back to local storage.');
        const local = new LocalStorageRepo();
        return local.updateAppointment(id, payload);
      }
      throw err;
    }
  }

  async getWaitlist(): Promise<WaitlistEntry[]> {
    const { data, error } = await this.client
      .from('waitlist')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
        console.warn('Waitlist table not found (Step 0 SQL pending)');
        return [];
      }
      console.error('Failed to fetch waitlist:', error);
      throw new Error(mapDbErrorToUserMessage(error));
    }
    return (data || []) as WaitlistEntry[];
  }

  async addToWaitlist(entry: { client_name: string; phone: string; date: string }): Promise<WaitlistEntry> {
    const { data, error } = await this.client
      .from('waitlist')
      .insert({
        client_name: entry.client_name.trim(),
        phone: entry.phone,
        date: entry.date,
        notified: false,
      })
      .select()
      .single();

    if (error) {
      if (error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
        throw new Error('Waitlist table has not been created yet in Supabase (run Step 0 SQL in Supabase).');
      }
      throw new Error(mapDbErrorToUserMessage(error));
    }
    return data as WaitlistEntry;
  }

  async markWaitlistNotified(id: string): Promise<void> {
    const { error } = await this.client
      .from('waitlist')
      .update({ notified: true })
      .eq('id', id);

    if (error) {
      throw new Error(mapDbErrorToUserMessage(error));
    }
  }

  async getAuditLog(): Promise<AuditLogEntry[]> {
    const { data, error } = await this.client
      .from('audit_log')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(100);

    if (error) {
      if (error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
        console.warn('Audit log table not found (Step 0 SQL pending)');
        return [];
      }
      console.error('Failed to fetch audit log:', error);
      return [];
    }
    return (data || []) as AuditLogEntry[];
  }

  subscribeToChanges(onChange: () => void): () => void {
    let channel: any = null;
    try {
      channel = this.client
        .channel('calmly_appointments_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'appointments' },
          () => {
            onChange();
          }
        )
        .subscribe((status) => {
          this.isLive = status === 'SUBSCRIBED';
        });
    } catch (err) {
      this.isLive = false;
      console.warn('Supabase realtime channel subscription error:', err);
    }

    // 2. Fallback polling: runs every 10 seconds ONLY when realtime is not connected, paused when tab is hidden
    const interval = setInterval(() => {
      if (this.isLive) {
        return;
      }
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      onChange();
    }, 10000);

    return () => {
      if (channel) {
        try {
          this.client.removeChannel(channel);
        } catch {
          // ignore cleanup error
        }
      }
      clearInterval(interval);
    };
  }

  async shiftSeedData(): Promise<void> {
    const appointments = await this.getAppointments();
    const seedRows = appointments.filter((a) => a.seed_key || a.source === 'seed');
    if (seedRows.length === 0) return;

    const now = getNowInIST();
    const [by, bm, bd] = now.date.split('-').map(Number);
    const targetDays = [1, 2, 3, 4, 5];

    for (let idx = 0; idx < seedRows.length; idx++) {
      const row = seedRows[idx];
      const shiftDay = targetDays[idx % targetDays.length];
      const d = new Date(Date.UTC(by, bm - 1, bd));
      d.setUTCDate(d.getUTCDate() + shiftDay);
      const yStr = d.getUTCFullYear();
      const mStr = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dStr = String(d.getUTCDate()).padStart(2, '0');
      const newDate = `${yStr}-${mStr}-${dStr}`;

      await this.client
        .from('appointments')
        .update({ date: newDate })
        .eq('id', row.id);
    }
  }

  async resetSeedData(): Promise<void> {
    const appointments = await this.getAppointments();
    const seedDefaults: Record<string, { date: string; time: string; status: Appointment['status'] }> = {
      'seed-1': { date: '2026-10-24', time: '10:00', status: 'Booked' },
      'seed-2': { date: '2026-10-24', time: '11:30', status: 'Booked' },
      'seed-3': { date: '2026-10-25', time: '16:00', status: 'Booked' },
      'seed-4': { date: '2026-10-23', time: '09:00', status: 'Done' },
      'seed-5': { date: '2026-10-22', time: '14:00', status: 'No-show' },
    };

    for (const a of appointments) {
      if (a.seed_key && seedDefaults[a.seed_key]) {
        const def = seedDefaults[a.seed_key];
        await this.client
          .from('appointments')
          .update({ date: def.date, time: def.time, status: def.status })
          .eq('id', a.id);
      } else if (!a.seed_key && a.status !== 'Cancelled') {
        // Any non-seed row is set to Cancelled, never deleted
        await this.client
          .from('appointments')
          .update({ status: 'Cancelled' })
          .eq('id', a.id);
      }
    }
  }

  async getConnectionInfo() {
    const config = getValidatedConfig();
    try {
      // Read-only SELECT count of appointments, no probe inserts
      const { count, error } = await this.client
        .from('appointments')
        .select('*', { count: 'exact', head: true });

      if (error) {
        return {
          configured: true,
          host: config.host,
          maskedKey: config.maskedKey,
          appointmentCount: 0,
          error: mapDbErrorToUserMessage(error),
        };
      }

      // Check if schema is complete
      const { error: seedCheckError } = await this.client
        .from('appointments')
        .select('seed_key')
        .limit(1);

      let schemaNotice: string | undefined = undefined;
      if (seedCheckError && (seedCheckError.code === '42703' || seedCheckError.message?.includes('seed_key'))) {
        schemaNotice = 'Connected to Supabase! Notice: Step 0 SQL migration is pending (seed_key, waitlist, audit_log tables). Run Step 0 SQL in Supabase SQL Editor.';
      }

      return {
        configured: true,
        host: config.host,
        maskedKey: config.maskedKey,
        appointmentCount: count ?? 0,
        error: schemaNotice,
      };
    } catch (err) {
      return {
        configured: true,
        host: config.host,
        maskedKey: config.maskedKey,
        appointmentCount: 0,
        error: String(err),
      };
    }
  }
}
