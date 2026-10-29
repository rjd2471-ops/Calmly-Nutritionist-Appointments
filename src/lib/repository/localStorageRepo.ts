/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Appointment,
  AuditLogEntry,
  NewAppointmentPayload,
  Repository,
  UpdateAppointmentPayload,
  WaitlistEntry,
} from '../../types.ts';
import { getNowInIST, isDateInPast, isSlotInPast, isWithin2Hours } from '../ist.ts';
import { isSlotOnGrid, normalizePhone } from '../normalize.ts';

const APPOINTMENTS_KEY = 'calmly_appointments_v1';
const WAITLIST_KEY = 'calmly_waitlist_v1';
const AUDIT_KEY = 'calmly_audit_log_v1';

// Custom event to sync within the same tab
const CHANGE_EVENT = 'calmly_local_db_change';

function emitChange() {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${key} from localStorage:`, err);
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    emitChange();
  } catch (err) {
    console.error(`Error writing ${key} to localStorage:`, err);
  }
}

export class LocalStorageRepo implements Repository {
  name: 'localstorage' = 'localstorage';
  isLive: boolean = true;

  async getAppointments(): Promise<Appointment[]> {
    return loadFromStorage<Appointment[]>(APPOINTMENTS_KEY, []);
  }

  async getAppointmentById(id: string): Promise<Appointment | null> {
    const list = await this.getAppointments();
    return list.find((a) => a.id === id) || null;
  }

  async createAppointment(payload: NewAppointmentPayload): Promise<Appointment> {
    const appointments = await this.getAppointments();

    // 1. Validate name
    const trimmedName = (payload.client_name || '').trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      throw { code: '23514', message: 'chk_name_length: Client name must be between 2 and 80 characters.' };
    }

    // 2. Validate phone if provided
    let normPhone: string | null = null;
    if (payload.phone) {
      normPhone = normalizePhone(payload.phone);
      if (!normPhone) {
        throw { code: '23514', message: 'chk_phone_format: Invalid phone number.' };
      }
    }

    // 3. Validate slot grid
    if (!isSlotOnGrid(payload.time)) {
      throw { code: '23514', message: 'chk_slot_grid: Slot must be between 09:00 and 17:30 on the 30-minute grid.' };
    }

    const now = getNowInIST();

    // 4. Client business rules
    if (payload.source === 'client' && (payload.status || 'Booked') === 'Booked') {
      if (isSlotInPast(payload.date, payload.time)) {
        throw new Error('Cannot book a slot in the past');
      }

      // Check max 60 days ahead
      const [y, m, d] = payload.date.split('-').map(Number);
      const [ny, nm, nd] = now.date.split('-').map(Number);
      const slotEpoch = Date.UTC(y, m - 1, d);
      const nowEpoch = Date.UTC(ny, nm - 1, nd);
      const diffDays = Math.round((slotEpoch - nowEpoch) / (1000 * 60 * 60 * 24));
      if (diffDays > 60) {
        throw new Error('Bookings open only 60 days ahead');
      }

      // Max 3 upcoming Booked for this phone
      if (normPhone) {
        const upcomingCount = appointments.filter((a) => {
          if (a.phone !== normPhone || a.status !== 'Booked') return false;
          return a.date > now.date || (a.date === now.date && a.time > now.time);
        }).length;

        if (upcomingCount >= 3) {
          throw new Error('Maximum 3 upcoming appointments per phone number');
        }
      }
    }

    // 5. Unique slot check (partial unique index: date, time WHERE status <> 'Cancelled')
    const status = payload.status || 'Booked';
    if (status !== 'Cancelled') {
      const isTaken = appointments.some(
        (a) => a.date === payload.date && a.time === payload.time && a.status !== 'Cancelled'
      );
      if (isTaken) {
        throw { code: '23505', message: 'duplicate key value violates unique constraint on (date, time)' };
      }
    }

    const nowIso = new Date().toISOString();
    const newAppointment: Appointment = {
      id: crypto.randomUUID(),
      client_name: trimmedName,
      phone: normPhone,
      date: payload.date,
      time: payload.time,
      status: status,
      source: payload.source,
      notes: payload.notes || null,
      confirmed_at: null,
      reason: payload.reason || null,
      visit_type: payload.visit_type || 'In clinic',
      seed_key: payload.seed_key || null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    appointments.push(newAppointment);
    saveToStorage(APPOINTMENTS_KEY, appointments);

    // Audit log
    await this.logAudit({
      appointment_id: newAppointment.id,
      action: 'created',
      new_status: newAppointment.status,
      details: { source: newAppointment.source, date: newAppointment.date, time: newAppointment.time },
    });

    return newAppointment;
  }

  async updateAppointment(id: string, payload: UpdateAppointmentPayload): Promise<Appointment> {
    const appointments = await this.getAppointments();
    const index = appointments.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error('Appointment not found');
    }

    const current = appointments[index];

    // Optimistic concurrency check
    if (payload.expected_updated_at && current.updated_at !== payload.expected_updated_at) {
      throw new Error('This appointment was changed elsewhere, reloaded');
    }

    // Cancel / Reschedule 2-hour rule for client
    const targetStatus = payload.status || current.status;
    const isClientCancelOrResched =
      (targetStatus === 'Cancelled' && current.status !== 'Cancelled') ||
      (payload.date && (payload.date !== current.date || payload.time !== current.time));

    if (isClientCancelOrResched && isWithin2Hours(current.date, current.time)) {
      throw new Error('Cancellations and rescheduling must be made at least 2 hours before your appointment.');
    }

    // Same slot reschedule blocked
    if (payload.date && payload.time) {
      if (payload.date === current.date && payload.time === current.time && payload.status === current.status) {
        throw new Error('You are already scheduled for this slot.');
      }
      // Check if target slot is taken by another appointment
      if (targetStatus !== 'Cancelled') {
        const slotTaken = appointments.some(
          (a) => a.id !== id && a.date === payload.date && a.time === payload.time && a.status !== 'Cancelled'
        );
        if (slotTaken) {
          throw { code: '23505', message: 'duplicate key value violates unique constraint' };
        }
      }
    }

    const oldStatus = current.status;
    const oldDate = current.date;
    const oldTime = current.time;
    const nowIso = new Date().toISOString();

    const updated: Appointment = {
      ...current,
      client_name: payload.client_name ? payload.client_name.trim() : current.client_name,
      phone: payload.phone !== undefined ? (payload.phone ? normalizePhone(payload.phone) : null) : current.phone,
      date: payload.date || current.date,
      time: payload.time || current.time,
      status: targetStatus,
      notes: payload.notes !== undefined ? payload.notes : current.notes,
      reason: payload.reason !== undefined ? payload.reason : current.reason,
      visit_type: payload.visit_type || current.visit_type,
      confirmed_at: payload.confirmed_at !== undefined ? payload.confirmed_at : current.confirmed_at,
      updated_at: nowIso,
    };

    appointments[index] = updated;
    saveToStorage(APPOINTMENTS_KEY, appointments);

    // Audit logs
    if (oldStatus !== updated.status) {
      await this.logAudit({
        appointment_id: updated.id,
        action: 'status_changed',
        old_status: oldStatus,
        new_status: updated.status,
        details: { date: updated.date, time: updated.time },
      });
    } else if (oldDate !== updated.date || oldTime !== updated.time) {
      await this.logAudit({
        appointment_id: updated.id,
        action: 'rescheduled',
        old_status: oldStatus,
        new_status: updated.status,
        details: { from: `${oldDate} ${oldTime}`, to: `${updated.date} ${updated.time}` },
      });
    }

    return updated;
  }

  async getWaitlist(): Promise<WaitlistEntry[]> {
    return loadFromStorage<WaitlistEntry[]>(WAITLIST_KEY, []);
  }

  async addToWaitlist(entry: { client_name: string; phone: string; date: string }): Promise<WaitlistEntry> {
    const normPhone = normalizePhone(entry.phone);
    if (!normPhone) {
      throw { code: '23514', message: 'chk_wl_phone: Invalid phone number.' };
    }

    const waitlist = await this.getWaitlist();
    const newEntry: WaitlistEntry = {
      id: crypto.randomUUID(),
      client_name: entry.client_name.trim(),
      phone: normPhone,
      date: entry.date,
      notified: false,
      created_at: new Date().toISOString(),
    };

    waitlist.push(newEntry);
    saveToStorage(WAITLIST_KEY, waitlist);
    return newEntry;
  }

  async markWaitlistNotified(id: string): Promise<void> {
    const waitlist = await this.getWaitlist();
    const item = waitlist.find((w) => w.id === id);
    if (item) {
      item.notified = true;
      saveToStorage(WAITLIST_KEY, waitlist);
    }
  }

  async getAuditLog(): Promise<AuditLogEntry[]> {
    const list = loadFromStorage<AuditLogEntry[]>(AUDIT_KEY, []);
    return list.sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
  }

  private async logAudit(entry: Omit<AuditLogEntry, 'id' | 'changed_at'>): Promise<void> {
    const logs = loadFromStorage<AuditLogEntry[]>(AUDIT_KEY, []);
    logs.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      ...entry,
      changed_at: new Date().toISOString(),
    });
    saveToStorage(AUDIT_KEY, logs);
  }

  subscribeToChanges(onChange: () => void): () => void {
    const handler = () => onChange();
    window.addEventListener(CHANGE_EVENT, handler);
    window.addEventListener('storage', handler);
    const interval = setInterval(onChange, 5000);

    return () => {
      window.removeEventListener(CHANGE_EVENT, handler);
      window.removeEventListener('storage', handler);
      clearInterval(interval);
    };
  }

  async shiftSeedData(): Promise<void> {
    const appointments = await this.getAppointments();
    const seedRows = appointments.filter((a) => a.seed_key);
    if (seedRows.length === 0) return;

    // Shift to this week: tomorrow + next days in sequence
    const now = getNowInIST();
    const baseDate = now.date;

    const [by, bm, bd] = baseDate.split('-').map(Number);
    const targetDays = [1, 2, 3, 4, 5]; // +1 day, +2 days, etc.

    seedRows.forEach((row, idx) => {
      const shiftDay = targetDays[idx % targetDays.length];
      const d = new Date(Date.UTC(by, bm - 1, bd));
      d.setUTCDate(d.getUTCDate() + shiftDay);
      const yStr = d.getUTCFullYear();
      const mStr = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dStr = String(d.getUTCDate()).padStart(2, '0');
      row.date = `${yStr}-${mStr}-${dStr}`;
      row.updated_at = new Date().toISOString();
    });

    saveToStorage(APPOINTMENTS_KEY, appointments);
  }

  async resetSeedData(): Promise<void> {
    const appointments = await this.getAppointments();

    // Original seed definitions
    const seedDefaults: Record<string, { date: string; time: string; status: Appointment['status'] }> = {
      'seed-1': { date: '2026-10-24', time: '10:00', status: 'Booked' },
      'seed-2': { date: '2026-10-24', time: '11:30', status: 'Booked' },
      'seed-3': { date: '2026-10-25', time: '16:00', status: 'Booked' },
      'seed-4': { date: '2026-10-23', time: '09:00', status: 'Done' },
      'seed-5': { date: '2026-10-22', time: '14:00', status: 'No-show' },
    };

    const nowIso = new Date().toISOString();

    // 1. Restore seed rows
    appointments.forEach((a) => {
      if (a.seed_key && seedDefaults[a.seed_key]) {
        const def = seedDefaults[a.seed_key];
        a.date = def.date;
        a.time = def.time;
        a.status = def.status;
        a.updated_at = nowIso;
      } else if (!a.seed_key) {
        // Any non-seed row is set to Cancelled, never deleted
        a.status = 'Cancelled';
        a.updated_at = nowIso;
      }
    });

    saveToStorage(APPOINTMENTS_KEY, appointments);
  }

  async getConnectionInfo() {
    const appointments = await this.getAppointments();
    return {
      configured: false,
      host: 'Browser LocalStorage (Demo Mode)',
      maskedKey: '(demo-mode)',
      appointmentCount: appointments.length,
    };
  }
}
