/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppointmentStatus, Repository } from '../types.ts';
import { normalizePhone, parseDate, parseTime } from './normalize.ts';

export interface RawSeedItem {
  client_name: string;
  rawPhone: string | null;
  rawDate: string;
  rawTime: string;
  status: AppointmentStatus;
  seed_key: string;
  reason?: string;
  visit_type?: 'In clinic' | 'Video call';
}

export const RAW_SEED_DATA: RawSeedItem[] = [
  {
    client_name: 'Riya Shah',
    rawPhone: '98200 11111',
    rawDate: '24/10/2026',
    rawTime: '10:00',
    status: 'Booked',
    seed_key: 'seed-1',
    reason: 'Weight management & metabolic health',
    visit_type: 'In clinic',
  },
  {
    client_name: 'Arjun Mehta',
    rawPhone: '98200 22222',
    rawDate: '2026-10-24',
    rawTime: '11:30am',
    status: 'Booked',
    seed_key: 'seed-2',
    reason: 'Sports nutrition & endurance marathon training',
    visit_type: 'Video call',
  },
  {
    client_name: 'Riya Shah',
    rawPhone: '9820011111',
    rawDate: '25-10-2026',
    rawTime: '4 pm',
    status: 'Booked',
    seed_key: 'seed-3',
    reason: 'Follow-up on gut microbiome diet plan',
    visit_type: 'In clinic',
  },
  {
    client_name: 'Meera Iyer',
    rawPhone: null, // (no phone)
    rawDate: '23/10/2026',
    rawTime: '09:00',
    status: 'Done',
    seed_key: 'seed-4',
    reason: 'PCOS hormonal balance & dietary adjustment',
    visit_type: 'In clinic',
  },
  {
    client_name: 'Kabir Rao',
    rawPhone: '98200 33333',
    rawDate: '22/10/2026',
    rawTime: '14:00',
    status: 'No-show',
    seed_key: 'seed-5',
    reason: 'General wellness & lipid profile optimization',
    visit_type: 'Video call',
  },
];

let isSeeding = false;
let hasSeeded = false;

/**
 * Normalizes raw seed data items without hardcoding cleaned values.
 */
export function getNormalizedSeedData() {
  return RAW_SEED_DATA.map((item) => {
    const date = parseDate(item.rawDate);
    const time = parseTime(item.rawTime);
    const phone = item.rawPhone ? normalizePhone(item.rawPhone) : null;

    if (!date || !time) {
      throw new Error(`Invalid date/time in seed item: ${item.client_name}`);
    }

    return {
      client_name: item.client_name,
      phone,
      date,
      time,
      status: item.status,
      source: 'seed' as const,
      seed_key: item.seed_key,
      reason: item.reason,
      visit_type: item.visit_type,
    };
  });
}

/**
 * Idempotent seeder that runs from one guarded function.
 * Uses module-level guard so React StrictMode or parallel calls cannot run it twice.
 * Upserts by seed_key with 'ignore duplicates', never overwrites existing rows,
 * and never changes an existing status.
 */
export async function seedInitialData(repo: Repository): Promise<void> {
  if (hasSeeded || isSeeding) {
    return;
  }
  isSeeding = true;

  try {
    const existing = await repo.getAppointments();
    const existingSeedKeys = new Set(existing.map((a) => a.seed_key).filter(Boolean));

    const normalizedSeeds = getNormalizedSeedData();

    for (const seedItem of normalizedSeeds) {
      if (existingSeedKeys.has(seedItem.seed_key)) {
        // Skip existing seed rows to ensure idempotency and preserve status
        continue;
      }

      try {
        await repo.createAppointment({
          client_name: seedItem.client_name,
          phone: seedItem.phone,
          date: seedItem.date,
          time: seedItem.time,
          status: seedItem.status,
          source: 'seed',
          seed_key: seedItem.seed_key,
          reason: seedItem.reason,
          visit_type: seedItem.visit_type,
        });
      } catch (err) {
        console.warn(`Seed item ${seedItem.seed_key} skipped or duplicate:`, err);
      }
    }

    hasSeeded = true;
  } catch (err) {
    console.error('Failed during seedInitialData:', err);
  } finally {
    isSeeding = false;
  }
}
