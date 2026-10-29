/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getValidatedConfig, sanitizeEnvValue, sanitizeSupabaseAnonKey, sanitizeSupabaseUrl } from '../config.ts';
import { CLINIC_SLOTS, getNowInIST, isWithin2Hours, generateSlotsForDay } from '../ist.ts';
import {
  calculateNoShowRate,
  formatPhoneDisplay,
  getClientKey,
  isSlotOnGrid,
  neutralizeCsvFormula,
  normalizePhone,
  parseDate,
  parseTime,
} from '../normalize.ts';
import { LocalStorageRepo } from '../repository/localStorageRepo.ts';
import { getNormalizedSeedData, seedInitialData } from '../seed.ts';
import { Appointment } from '../../types.ts';
import { mergeAppointments, sortAppointmentsAsc, findNextUpcomingAppointment } from '../clientStore.ts';

export interface TestResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  message?: string;
  error?: string;
  durationMs: number;
}

export async function runAllPureTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  async function test(id: string, name: string, category: string, fn: () => void | Promise<void>) {
    const start = performance.now();
    try {
      await fn();
      results.push({
        id,
        name,
        category,
        passed: true,
        message: 'Assertion passed',
        durationMs: Math.round((performance.now() - start) * 10) / 10,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({
        id,
        name,
        category,
        passed: false,
        error: errorMsg,
        durationMs: Math.round((performance.now() - start) * 10) / 10,
      });
    }
  }

  // 1. Date normalization
  await test('date-formats', 'parseDate handles all valid date formats (DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, YYYY-MM-DD)', 'Normalizers', () => {
    if (parseDate('24/10/2026') !== '2026-10-24') throw new Error('Failed on 24/10/2026');
    if (parseDate('4/5/2026') !== '2026-05-04') throw new Error('Failed on 4/5/2026');
    if (parseDate('25-10-2026') !== '2026-10-25') throw new Error('Failed on 25-10-2026');
    if (parseDate('2026-10-24') !== '2026-10-24') throw new Error('Failed on 2026-10-24');
  });

  // 2. Impossible dates rejection
  await test('date-impossible', 'parseDate rejects impossible calendar dates (31/02/2026, 29/02/2025)', 'Normalizers', () => {
    if (parseDate('31/02/2026') !== null) throw new Error('Accepted 31/02/2026');
    if (parseDate('29/02/2025') !== null) throw new Error('Accepted 29/02/2025 (not leap year)');
    if (parseDate('31/04/2026') !== null) throw new Error('Accepted 31/04/2026 (April has 30 days)');
    if (parseDate('29/02/2024') !== '2024-02-29') throw new Error('Failed leap year 29/02/2024');
    if (parseDate('garbage-date') !== null) throw new Error('Accepted invalid string');
  });

  // 3. Time formats
  await test('time-formats', 'parseTime handles 24h, 12h AM/PM, and uppercase variants', 'Normalizers', () => {
    if (parseTime('10:00') !== '10:00') throw new Error('Failed 10:00');
    if (parseTime('14:00') !== '14:00') throw new Error('Failed 14:00');
    if (parseTime('11:30am') !== '11:30') throw new Error('Failed 11:30am');
    if (parseTime('4 pm') !== '16:00') throw new Error('Failed 4 pm');
    if (parseTime('4PM') !== '16:00') throw new Error('Failed 4PM');
    if (parseTime('4:30 pm') !== '16:30') throw new Error('Failed 4:30 pm');
  });

  // 4. Midnight and Noon
  await test('time-12am-12pm', 'parseTime correctly handles 12 am (00:00) and 12 pm (12:00)', 'Normalizers', () => {
    if (parseTime('12 am') !== '00:00') throw new Error('Failed 12 am');
    if (parseTime('12:00 am') !== '00:00') throw new Error('Failed 12:00 am');
    if (parseTime('12 pm') !== '12:00') throw new Error('Failed 12 pm');
    if (parseTime('12:00 pm') !== '12:00') throw new Error('Failed 12:00 pm');
  });

  // 5. Phone normalization
  await test('phone-normalization', 'normalizePhone cleans +91, spaces, leading 0, and rejects invalid lengths', 'Normalizers', () => {
    if (normalizePhone('98200 11111') !== '9820011111') throw new Error('Failed spaced phone');
    if (normalizePhone('+91 98200 11111') !== '9820011111') throw new Error('Failed +91 phone');
    if (normalizePhone('919820011111') !== '9820011111') throw new Error('Failed 91 prefixed phone');
    if (normalizePhone('09820011111') !== '9820011111') throw new Error('Failed leading 0 phone');
    if (normalizePhone('98200-11111') !== '9820011111') throw new Error('Failed dashed phone');
    if (normalizePhone('1234567890') !== null) throw new Error('Accepted phone not starting 6-9');
    if (normalizePhone('982001111') !== null) throw new Error('Accepted 9 digits');
    if (normalizePhone('98200111111') !== null) throw new Error('Accepted 11 digits');
  });

  // 6. Client identity
  await test('client-key', 'getClientKey resolves Riya Shah phone variants to one identical client key', 'Normalizers', () => {
    const key1 = getClientKey({ client_name: 'Riya Shah', phone: '98200 11111' });
    const key2 = getClientKey({ client_name: 'Riya Shah', phone: '9820011111' });
    const key3 = getClientKey({ client_name: 'Riya Shah', phone: '+91 98200-11111' });
    if (key1 !== 'phone:9820011111') throw new Error(`Unexpected key1: ${key1}`);
    if (key1 !== key2 || key2 !== key3) throw new Error(`Keys do not match: ${key1} vs ${key2} vs ${key3}`);

    const noPhoneKey = getClientKey({ client_name: 'Meera Iyer', phone: null });
    if (noPhoneKey !== 'name:meera iyer') throw new Error(`Unexpected name key: ${noPhoneKey}`);
  });

  // 7. Slot grid generation
  await test('slot-grid', 'generateSlotsForDay produces exactly 18 slots from 09:00 to 17:30', 'Slots & IST', () => {
    if (CLINIC_SLOTS.length !== 18) throw new Error(`Expected 18 slots, got ${CLINIC_SLOTS.length}`);
    if (CLINIC_SLOTS[0] !== '09:00') throw new Error(`First slot should be 09:00, got ${CLINIC_SLOTS[0]}`);
    if (CLINIC_SLOTS[17] !== '17:30') throw new Error(`Last slot should be 17:30, got ${CLINIC_SLOTS[17]}`);

    const slots = generateSlotsForDay('2030-01-01', []);
    if (slots.length !== 18) throw new Error(`Expected 18 slot items, got ${slots.length}`);
    if (!isSlotOnGrid('09:00') || !isSlotOnGrid('17:30') || !isSlotOnGrid('14:30')) {
      throw new Error('Valid grid times failed isSlotOnGrid');
    }
    if (isSlotOnGrid('08:30') || isSlotOnGrid('18:00') || isSlotOnGrid('10:15')) {
      throw new Error('Invalid grid times passed isSlotOnGrid');
    }
  });

  // 8. Past slot check
  await test('past-slot-disabling', 'Slots in the past are disabled, upcoming slots are enabled', 'Slots & IST', () => {
    const slots = generateSlotsForDay('2020-01-01', []);
    if (!slots.every((s) => s.isPast)) {
      throw new Error('All slots on 2020-01-01 must be past');
    }

    const futureSlots = generateSlotsForDay('2030-01-01', []);
    if (futureSlots.some((s) => s.isPast)) {
      throw new Error('Future slots on 2030-01-01 must not be past');
    }
  });

  // 9. 2-hour cancellation rule
  await test('two-hour-cancel-rule', 'isWithin2Hours returns true when slot is <= 2 hours away', 'Rules', () => {
    const now = getNowInIST();
    // A slot 10 minutes in future:
    const [h, m] = now.time.split(':').map(Number);
    const nearSlot = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const isNearBlocked = isWithin2Hours(now.date, nearSlot);
    if (!isNearBlocked) {
      throw new Error('A slot 1 hour from now was not blocked under 2-hour rule');
    }

    const futureDate = '2030-01-01';
    if (isWithin2Hours(futureDate, '10:00')) {
      throw new Error('A slot in 2030 was marked as within 2 hours');
    }
  });

  // 10. Env sanitizing & secret key refusal
  await test('env-sanitizing-secret-refusal', 'Env sanitizer trims quotes/prefixes and refuses sb_secret/service_role keys', 'Security & Config', () => {
    const cleanUrl = sanitizeSupabaseUrl(' "VITE_SUPABASE_URL=https://mytest.supabase.co/rest/v1" ');
    if (cleanUrl.url !== 'https://mytest.supabase.co') {
      throw new Error(`Url sanitize failed, got: ${cleanUrl.url}`);
    }

    const secretKeyCheck = sanitizeSupabaseAnonKey('sb_secret_1234567890');
    if (!secretKeyCheck.error || !secretKeyCheck.error.includes('Secret key detected')) {
      throw new Error('Did not refuse sb_secret key');
    }

    const serviceRoleCheck = sanitizeSupabaseAnonKey('service_role_key_value');
    if (!serviceRoleCheck.error || !serviceRoleCheck.error.includes('Secret key detected')) {
      throw new Error('Did not refuse service_role key');
    }

    const validKeyCheck = sanitizeSupabaseAnonKey('  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" ');
    if (validKeyCheck.key !== 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9') {
      throw new Error('Failed to sanitize valid publishable key');
    }
  });

  // 11. CSV formula injection defense
  await test('csv-formula-neutralization', 'neutralizeCsvFormula prefixes =, +, -, and @ with an apostrophe', 'Security & Config', () => {
    if (neutralizeCsvFormula('=SUM(A1:A10)') !== "'=SUM(A1:A10)") throw new Error('Failed = formula');
    if (neutralizeCsvFormula('+12345') !== "'+12345") throw new Error('Failed + prefix');
    if (neutralizeCsvFormula('-100') !== "'-100") throw new Error('Failed - prefix');
    if (neutralizeCsvFormula('@IMPORT') !== "'@IMPORT") throw new Error('Failed @ prefix');
    if (neutralizeCsvFormula('Normal Client') !== 'Normal Client') throw new Error('Altered normal string');
  });

  // 12. No-show rate formula
  await test('noshow-rate-formula', 'calculateNoShowRate uses No-show / (Done + No-show) across non-cancelled rows', 'Metrics', () => {
    const data = [
      { status: 'Done' },
      { status: 'Done' },
      { status: 'Done' },
      { status: 'No-show' },
      { status: 'Booked' },
      { status: 'Cancelled' },
    ];
    // Done = 3, No-show = 1 -> 1 / 4 = 25%
    const rate = calculateNoShowRate(data);
    if (rate !== 25) {
      throw new Error(`Expected 25%, got ${rate}%`);
    }

    if (calculateNoShowRate([]) !== 0) {
      throw new Error('Empty array should produce 0%');
    }
  });

  // 13. Double booking and repo logic test
  await test('repo-double-booking-prevention', 'Repository rejects double booking on same slot (23505 error)', 'Data Access', async () => {
    const testRepo = new LocalStorageRepo();
    // Use future date
    const testDate = '2029-06-15';
    const testTime = '10:00';

    const first = await testRepo.createAppointment({
      client_name: 'Test Client 1',
      phone: '9820011111',
      date: testDate,
      time: testTime,
      source: 'nutritionist',
    });

    let duplicateFailed = false;
    try {
      await testRepo.createAppointment({
        client_name: 'Test Client 2',
        phone: '9820022222',
        date: testDate,
        time: testTime,
        source: 'nutritionist',
      });
    } catch (err: unknown) {
      const errObj = err as { code?: string };
      if (errObj.code === '23505' || String(err).includes('unique')) {
        duplicateFailed = true;
      }
    }

    // Cancel first so slot is freed
    await testRepo.updateAppointment(first.id, { status: 'Cancelled' });

    // Now slot should be free again
    const second = await testRepo.createAppointment({
      client_name: 'Test Client 2',
      phone: '9820022222',
      date: testDate,
      time: testTime,
      source: 'nutritionist',
    });

    await testRepo.updateAppointment(second.id, { status: 'Cancelled' });

    if (!duplicateFailed) {
      throw new Error('Double booking was not blocked');
    }
  });

  // 14. Same-slot reschedule blocked
  await test('same-slot-reschedule-blocked', 'Rescheduling to the exact same slot is blocked', 'Rules', async () => {
    const testRepo = new LocalStorageRepo();
    const testDate = '2029-06-16';
    const appt = await testRepo.createAppointment({
      client_name: 'Reschedule Tester',
      phone: '9820011111',
      date: testDate,
      time: '11:00',
      source: 'nutritionist',
    });

    let blocked = false;
    try {
      await testRepo.updateAppointment(appt.id, {
        date: testDate,
        time: '11:00',
      });
    } catch (err) {
      if (String(err).includes('already scheduled')) {
        blocked = true;
      }
    }

    await testRepo.updateAppointment(appt.id, { status: 'Cancelled' });

    if (!blocked) {
      throw new Error('Same-slot reschedule was not blocked');
    }
  });

  // 15. Max 3 upcoming bookings per phone
  await test('max-3-upcoming-bookings', 'Client is prevented from creating more than 3 upcoming bookings per phone', 'Rules', async () => {
    const testRepo = new LocalStorageRepo();
    const testPhone = '9820099999';
    const futureDates = ['2029-07-01', '2029-07-02', '2029-07-03', '2029-07-04'];
    const createdIds: string[] = [];

    try {
      // Create 3 valid upcoming
      for (let i = 0; i < 3; i++) {
        const a = await testRepo.createAppointment({
          client_name: 'Multi Booker',
          phone: testPhone,
          date: futureDates[i],
          time: '10:00',
          source: 'client',
        });
        createdIds.push(a.id);
      }

      // 4th must fail
      let fourthFailed = false;
      try {
        await testRepo.createAppointment({
          client_name: 'Multi Booker',
          phone: testPhone,
          date: futureDates[3],
          time: '10:00',
          source: 'client',
        });
      } catch (err) {
        if (String(err).includes('Maximum 3')) {
          fourthFailed = true;
        }
      }

      if (!fourthFailed) {
        throw new Error('4th upcoming appointment was not blocked');
      }
    } finally {
      // Clean up test rows by setting to Cancelled
      for (const id of createdIds) {
        await testRepo.updateAppointment(id, { status: 'Cancelled' });
      }
    }
  });

  // 16. Seed normalization and preservation test
  await test('seed-normalization-and-survival', 'All 5 sample seed items normalize properly; Meera has no phone, Kabir is No-show', 'Sample Data & Seeding', () => {
    const seeds = getNormalizedSeedData();
    if (seeds.length !== 5) throw new Error(`Expected 5 seed items, got ${seeds.length}`);

    const meera = seeds.find((s) => s.seed_key === 'seed-4');
    if (!meera) throw new Error('Missing seed-4 (Meera)');
    if (meera.phone !== null) throw new Error(`Meera should have null phone, got ${meera.phone}`);
    if (meera.status !== 'Done') throw new Error(`Meera status should be Done, got ${meera.status}`);

    const kabir = seeds.find((s) => s.seed_key === 'seed-5');
    if (!kabir) throw new Error('Missing seed-5 (Kabir)');
    if (kabir.status !== 'No-show') throw new Error(`Kabir status should be No-show, got ${kabir.status}`);

    const riya1 = seeds.find((s) => s.seed_key === 'seed-1');
    const riya2 = seeds.find((s) => s.seed_key === 'seed-3');
    if (!riya1 || !riya2) throw new Error('Missing Riya seeds');
    if (riya1.phone !== '9820011111' || riya2.phone !== '9820011111') {
      throw new Error(`Riya phones do not match: ${riya1.phone} vs ${riya2.phone}`);
    }
  });

  // 17. Seed shift and reset status survival
  await test('seed-shift-and-reset-survival', 'Seed statuses (Done for Meera, No-show for Kabir) survive shift and reset', 'Sample Data & Seeding', async () => {
    const testRepo = new LocalStorageRepo();
    await seedInitialData(testRepo);

    // Initial check
    let current = await testRepo.getAppointments();
    let meera = current.find((a) => a.seed_key === 'seed-4');
    let kabir = current.find((a) => a.seed_key === 'seed-5');
    if (!meera || meera.status !== 'Done') throw new Error('Meera not Done initially');
    if (!kabir || kabir.status !== 'No-show') throw new Error('Kabir not No-show initially');

    // Shift
    await testRepo.shiftSeedData();
    current = await testRepo.getAppointments();
    meera = current.find((a) => a.seed_key === 'seed-4');
    kabir = current.find((a) => a.seed_key === 'seed-5');
    if (!meera || meera.status !== 'Done') throw new Error('Meera lost Done status after shift');
    if (!kabir || kabir.status !== 'No-show') throw new Error('Kabir lost No-show status after shift');

    // Reset
    await testRepo.resetSeedData();
    current = await testRepo.getAppointments();
    meera = current.find((a) => a.seed_key === 'seed-4');
    kabir = current.find((a) => a.seed_key === 'seed-5');
    if (!meera || meera.status !== 'Done') throw new Error('Meera lost Done status after reset');
    if (!kabir || kabir.status !== 'No-show') throw new Error('Kabir lost No-show status after reset');
    if (meera.date !== '2026-10-23') throw new Error('Meera date was not restored to 2026-10-23');
  });

  // 18. applying an older-updated_at row does not overwrite a newer one
  await test('stale-update-protection', 'Applying an older-updated_at row does not overwrite a newer one', 'Client Store & Reschedule', () => {
    const newerAppt: Appointment = {
      id: 'appt-123',
      client_name: 'Test Client',
      phone: '9820011111',
      date: '2026-11-10',
      time: '14:00',
      status: 'Booked',
      source: 'client',
      notes: null,
      reason: 'Checkup',
      visit_type: 'In clinic',
      confirmed_at: null,
      seed_key: null,
      created_at: '2026-10-29T10:00:00.000Z',
      updated_at: '2026-10-29T10:30:00.000Z',
    };

    const staleIncoming: Appointment = {
      ...newerAppt,
      date: '2026-11-05',
      time: '10:00',
      updated_at: '2026-10-29T10:15:00.000Z', // older updated_at
    };

    const merged = mergeAppointments([newerAppt], [staleIncoming]);
    if (merged.length !== 1) {
      throw new Error(`Expected exactly 1 appointment, got ${merged.length}`);
    }
    if (merged[0].date !== '2026-11-10' || merged[0].time !== '14:00') {
      throw new Error(`Stale incoming row overwrote newer state: date=${merged[0].date}, time=${merged[0].time}`);
    }
  });

  // 19. a reschedule result replaces the row by id with no duplicate
  await test('reschedule-replaces-by-id', 'A reschedule result replaces the row by id with no duplicate', 'Client Store & Reschedule', () => {
    const originalAppt: Appointment = {
      id: 'appt-abc',
      client_name: 'Riya Shah',
      phone: '9820011111',
      date: '2026-11-01',
      time: '10:00',
      status: 'Booked',
      source: 'client',
      notes: null,
      reason: 'Nutrition',
      visit_type: 'In clinic',
      confirmed_at: null,
      seed_key: null,
      created_at: '2026-10-29T08:00:00.000Z',
      updated_at: '2026-10-29T08:00:00.000Z',
    };

    const otherAppt: Appointment = {
      ...originalAppt,
      id: 'appt-xyz',
      client_name: 'Arjun Mehta',
      phone: '9820022222',
      date: '2026-11-03',
      time: '11:00',
    };

    const currentStore = [originalAppt, otherAppt];

    const rescheduledResult: Appointment = {
      ...originalAppt,
      date: '2026-11-15',
      time: '16:00',
      updated_at: '2026-10-29T09:00:00.000Z',
    };

    const merged = mergeAppointments(currentStore, [rescheduledResult]);
    if (merged.length !== 2) {
      throw new Error(`Expected 2 appointments with no duplicates, got ${merged.length}`);
    }

    const found = merged.find((a) => a.id === 'appt-abc');
    if (!found) {
      throw new Error('Rescheduled appointment appt-abc not found in store');
    }
    if (found.date !== '2026-11-15' || found.time !== '16:00') {
      throw new Error(`Rescheduled date/time mismatch: got ${found.date} ${found.time}`);
    }
    // Verify old date/time does not exist anywhere in store
    const oldInstances = merged.filter((a) => a.date === '2026-11-01' && a.time === '10:00');
    if (oldInstances.length > 0) {
      throw new Error('Old appointment date/time is still present in store');
    }
  });

  // 20. the list is sorted by date and time
  await test('appointments-sorted-chronologically', 'The list is sorted by date and time', 'Client Store & Reschedule', () => {
    const base: Omit<Appointment, 'id' | 'date' | 'time'> = {
      client_name: 'Client',
      phone: '9820011111',
      status: 'Booked',
      source: 'client',
      notes: null,
      reason: null,
      visit_type: 'In clinic',
      confirmed_at: null,
      seed_key: null,
      created_at: '2026-10-29T00:00:00.000Z',
      updated_at: '2026-10-29T00:00:00.000Z',
    };

    const unsorted: Appointment[] = [
      { ...base, id: '1', date: '2026-11-15', time: '11:00' },
      { ...base, id: '2', date: '2026-11-02', time: '16:30' },
      { ...base, id: '3', date: '2026-11-02', time: '09:30' },
      { ...base, id: '4', date: '2026-11-10', time: '14:00' },
    ];

    const sorted = mergeAppointments([], unsorted);
    const order = sorted.map((a) => `${a.date} ${a.time}`);
    const expected = [
      '2026-11-02 09:30',
      '2026-11-02 16:30',
      '2026-11-10 14:00',
      '2026-11-15 11:00',
    ];

    if (JSON.stringify(order) !== JSON.stringify(expected)) {
      throw new Error(`Expected chronological order ${expected.join(', ')}, got ${order.join(', ')}`);
    }
  });

  // 21. the next-appointment is the earliest upcoming Booked row
  await test('next-appointment-earliest-upcoming', 'The next-appointment is the earliest upcoming Booked row', 'Client Store & Reschedule', () => {
    const now = getNowInIST();
    const [y, m, d] = now.date.split('-').map(Number);
    const makeDate = (plusDays: number) => {
      const dt = new Date(Date.UTC(y, m - 1, d + plusDays));
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    };

    const base: Omit<Appointment, 'id' | 'date' | 'time' | 'status'> = {
      client_name: 'Client',
      phone: '9820011111',
      source: 'client',
      notes: null,
      reason: null,
      visit_type: 'In clinic',
      confirmed_at: null,
      seed_key: null,
      created_at: '2026-10-29T00:00:00.000Z',
      updated_at: '2026-10-29T00:00:00.000Z',
    };

    const list: Appointment[] = [
      { ...base, id: 'done', date: makeDate(1), time: '09:00', status: 'Done' },
      { ...base, id: 'cancelled', date: makeDate(1), time: '10:00', status: 'Cancelled' },
      { ...base, id: 'later-booked', date: makeDate(5), time: '10:00', status: 'Booked' },
      { ...base, id: 'earliest-booked', date: makeDate(2), time: '14:30', status: 'Booked' },
    ];

    const next = findNextUpcomingAppointment(list, '9820011111');
    if (!next) {
      throw new Error('Failed to find upcoming booked appointment');
    }
    if (next.id !== 'earliest-booked') {
      throw new Error(`Expected earliest-booked appointment, got ${next.id} (${next.date} ${next.time})`);
    }
  });

  return results;
}
