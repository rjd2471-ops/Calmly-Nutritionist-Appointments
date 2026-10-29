/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Appointment } from '../types.ts';
import { getRepository } from './repository/index.ts';
import { getNowInIST } from './ist.ts';

// Sequence numbers to protect against stale in-flight responses
let fetchSeq = 0;
let latestAppliedSeq = 0;

// Singleton state
let appointmentsStore: Appointment[] = [];
let isInitialLoaded = false;
let isLoading = true;
let repoUnsub: (() => void) | null = null;
const listeners = new Set<() => void>();

/**
 * Comparator to sort appointments ascending by date (YYYY-MM-DD), then time (HH:mm).
 */
export function sortAppointmentsAsc(a: Appointment, b: Appointment): number {
  if (a.date !== b.date) {
    return a.date.localeCompare(b.date);
  }
  return a.time.localeCompare(b.time);
}

/**
 * Compares two appointment arrays for structural data equality to prevent unnecessary re-renders.
 */
export function areAppointmentsEqual(current: Appointment[], next: Appointment[]): boolean {
  if (current.length !== next.length) return false;
  for (let i = 0; i < current.length; i++) {
    const c = current[i];
    const n = next[i];
    if (
      c.id !== n.id ||
      c.updated_at !== n.updated_at ||
      c.status !== n.status ||
      c.date !== n.date ||
      c.time !== n.time ||
      c.confirmed_at !== n.confirmed_at ||
      c.client_name !== n.client_name ||
      c.phone !== n.phone
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Pure merger that:
 * 1. Merges incoming rows with current store rows by id (replacing the row, never duplicating).
 * 2. Protects against stale row updates: ignores any incoming row whose updated_at is older
 *    than the row already in current state.
 * 3. Sorts all rows by date then time ascending.
 */
export function mergeAppointments(current: Appointment[], incoming: Appointment[]): Appointment[] {
  const currentMap = new Map<string, Appointment>(current.map((a) => [a.id, a]));
  const resultMap = new Map<string, Appointment>();

  for (const row of incoming) {
    const existing = currentMap.get(row.id);
    if (existing) {
      const existingTime = new Date(existing.updated_at).getTime();
      const incomingTime = new Date(row.updated_at).getTime();
      // If incoming row is newer or equal, apply it; otherwise retain existing newer row
      if (isNaN(existingTime) || isNaN(incomingTime) || incomingTime >= existingTime) {
        resultMap.set(row.id, row);
      } else {
        resultMap.set(row.id, existing);
      }
    } else {
      resultMap.set(row.id, row);
    }
  }

  // Preserve any row already in store that might not have appeared in incoming (e.g. optimistic write)
  for (const [id, row] of currentMap.entries()) {
    if (!resultMap.has(id)) {
      resultMap.set(id, row);
    }
  }

  return Array.from(resultMap.values()).sort(sortAppointmentsAsc);
}

/**
 * Finds the earliest upcoming Booked appointment.
 */
export function findNextUpcomingAppointment(
  list: Appointment[],
  clientPhone?: string | null,
  confirmId?: string | null
): Appointment | null {
  const now = getNowInIST();

  if (confirmId) {
    const found = list.find((a) => a.id === confirmId && a.status === 'Booked');
    if (found) return found;
  }

  const upcoming = list.filter((a) => {
    if (a.status !== 'Booked') return false;
    const isUpcoming = a.date > now.date || (a.date === now.date && a.time > now.time);
    if (!isUpcoming) return false;
    if (clientPhone) {
      return a.phone === clientPhone;
    }
    return true;
  });

  upcoming.sort(sortAppointmentsAsc);
  return upcoming[0] || null;
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

/**
 * Fetches appointment data silently with sequence protection and source logging.
 */
export async function fetchClientAppointments(
  source: 'initial' | 'realtime' | 'poll' | 'after-write' = 'poll'
): Promise<void> {
  const thisSeq = ++fetchSeq;

  if (typeof window !== 'undefined' && (import.meta.env?.DEV || process.env.NODE_ENV !== 'production')) {
    console.debug(`[Calmly] Appointments fetched (${source}) at ${new Date().toLocaleTimeString()} [seq=${thisSeq}]`);
  }

  try {
    const repo = getRepository();
    const fetched = await repo.getAppointments();

    // Stale fetch protection: ignore response if an update or newer fetch already applied
    if (thisSeq < latestAppliedSeq) {
      return;
    }
    latestAppliedSeq = thisSeq;

    const merged = mergeAppointments(appointmentsStore, fetched);

    const changed = !areAppointmentsEqual(appointmentsStore, merged);
    if (changed || !isInitialLoaded) {
      appointmentsStore = merged;
      isInitialLoaded = true;
      isLoading = false;
      notifyListeners();
    } else {
      isLoading = false;
    }
  } catch (err) {
    console.warn(`Failed to fetch appointments (${source}):`, err);
    isLoading = false;
  }
}

/**
 * Immediately applies an updated or newly created appointment into the store,
 * replaces the row by id without duplication, bumps sequence, and notifies UI.
 */
export function applyUpdatedAppointment(updated: Appointment): void {
  // Bump sequence to invalidate any older in-flight fetches
  latestAppliedSeq = ++fetchSeq;

  appointmentsStore = mergeAppointments(appointmentsStore, [updated]);
  isInitialLoaded = true;
  isLoading = false;
  notifyListeners();

  // Single silent refetch to confirm with repository
  fetchClientAppointments('after-write').catch((err) => {
    console.warn('Post-write confirmation fetch error:', err);
  });
}

/**
 * React hook to consume the shared client appointments store.
 */
export function useClientAppointments() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    listeners.add(update);

    // Initialize singleton subscription on first subscriber
    if (listeners.size === 1) {
      const repo = getRepository();
      repoUnsub = repo.subscribeToChanges(() => {
        fetchClientAppointments('realtime');
      });
      fetchClientAppointments('initial');
    }

    return () => {
      listeners.delete(update);
      if (listeners.size === 0 && repoUnsub) {
        repoUnsub();
        repoUnsub = null;
      }
    };
  }, []);

  return {
    appointments: appointmentsStore,
    loading: isLoading && !isInitialLoaded,
    refetch: fetchClientAppointments,
    applyUpdatedAppointment,
  };
}
