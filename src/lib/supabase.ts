/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getValidatedConfig } from './config.ts';

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const config = getValidatedConfig();
  if (!config.isValid || config.isDemoMode) {
    return null;
  }

  if (cachedClient && lastUrl === config.supabaseUrl && lastKey === config.supabaseAnonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    lastUrl = config.supabaseUrl;
    lastKey = config.supabaseAnonKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * Translates PostgreSQL/Supabase errors into human-friendly, polite messages.
 */
export function mapDbErrorToUserMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  const errObj = error as { code?: string; message?: string; details?: string };
  const code = errObj.code || '';
  const msg = errObj.message || String(error);

  console.error('[Database error]:', error);

  // 23505: Unique violation (e.g. double booking partial index on date, time)
  if (code === '23505' || msg.includes('duplicate key') || msg.includes('uq_appointments_seed_key')) {
    return 'That slot was just taken, please pick another.';
  }

  // 23514: Check constraint violation
  if (code === '23514' || msg.includes('chk_phone_format') || msg.includes('chk_wl_phone')) {
    return 'Please enter a valid 10-digit Indian phone number starting with 6, 7, 8, or 9.';
  }
  if (msg.includes('chk_name_length')) {
    return 'Name must be between 2 and 80 characters.';
  }
  if (msg.includes('chk_slot_grid')) {
    return 'Appointments can only be booked between 09:00 and 17:30 on the hour or half-hour.';
  }

  // Custom trigger raised exceptions
  if (msg.toLowerCase().includes('past')) {
    return 'Cannot book a slot in the past. Please select an upcoming slot.';
  }
  if (msg.toLowerCase().includes('60 days')) {
    return 'Bookings open only up to 60 days ahead.';
  }
  if (msg.toLowerCase().includes('maximum 3')) {
    return 'You have reached the maximum limit of 3 upcoming appointments for this phone number.';
  }

  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network')) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return 'Something went wrong, please try again.';
}
