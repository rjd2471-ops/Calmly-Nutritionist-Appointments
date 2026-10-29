/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Normalizes and validates dates into YYYY-MM-DD.
 * Supports:
 * - DD/MM/YYYY, D/M/YYYY
 * - DD-MM-YYYY, D-M-YYYY
 * - YYYY-MM-DD
 * Rejects impossible dates (e.g. 31/02/2026, 29/02/2025, 31/04/2026).
 */
export function parseDate(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let year: number;
  let month: number;
  let day: number;

  // Format 1: YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    year = parseInt(ymdMatch[1], 10);
    month = parseInt(ymdMatch[2], 10);
    day = parseInt(ymdMatch[3], 10);
  } else {
    // Format 2: DD/MM/YYYY or DD-MM-YYYY (day-first)
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!dmyMatch) {
      return null;
    }
    day = parseInt(dmyMatch[1], 10);
    month = parseInt(dmyMatch[2], 10);
    year = parseInt(dmyMatch[3], 10);
  }

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > 2100) return null;

  // Validate days in month (including leap years)
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  if (day > daysInMonth[month - 1]) {
    return null; // Invalid day for that month
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Normalizes time strings into 24-hour HH:mm format.
 * Supports:
 * - "10:00", "14:00"
 * - "11:30am", "11:30 am", "4 pm", "4PM", "4:30 pm"
 * - "12 am" -> "00:00", "12 pm" -> "12:00"
 * Rejects garbage.
 */
export function parseTime(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Check 12-hour AM/PM formats: e.g. "4 pm", "4pm", "11:30am", "12 am", "12:00 pm"
  const ampmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const minute = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const meridian = ampmMatch[3].toLowerCase();

    if (hour < 1 || hour > 12) return null;
    if (minute < 0 || minute > 59) return null;

    if (meridian === 'am') {
      if (hour === 12) hour = 0;
    } else {
      if (hour !== 12) hour += 12;
    }

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  // Check 24-hour HH:mm format
  const h24Match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const hour = parseInt(h24Match[1], 10);
    const minute = parseInt(h24Match[2], 10);

    if (hour < 0 || hour > 23) return null;
    if (minute < 0 || minute > 59) return null;

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  return null;
}

/**
 * Normalizes an Indian phone number:
 * - Strips spaces, dashes, parentheses, plus signs
 * - Strips leading +91 or 91 country code if 12 digits
 * - Strips leading 0 if 11 digits
 * - Validates exactly 10 digits starting with 6-9
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw) return null;

  // Remove common phone characters
  let digits = raw.replace(/[\s\-()+. ]/g, '');

  // Strip leading 0091 or +91
  if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  // Must be 10 digits starting with 6, 7, 8, or 9
  if (/^[6-9]\d{9}$/.test(digits)) {
    return digits;
  }

  return null;
}

/**
 * Formats a phone number for display:
 * 9820011111 -> "98200 11111"
 * null/invalid -> "No phone on file"
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  const normalized = normalizePhone(phone);
  if (!normalized) return 'No phone on file';
  return `${normalized.slice(0, 5)} ${normalized.slice(5)}`;
}

/**
 * Generates a unique client key:
 * Uses normalized phone if present, otherwise trimmed lower-cased name.
 */
export function getClientKey(client: { client_name: string; phone?: string | null }): string {
  const normPhone = normalizePhone(client.phone);
  if (normPhone) return `phone:${normPhone}`;
  return `name:${client.client_name.trim().toLowerCase()}`;
}

/**
 * Checks whether a given time is on the clinic's 30-minute grid
 * (09:00 to 17:30, minutes in 0 or 30).
 */
export function isSlotOnGrid(time: string): boolean {
  const parsed = parseTime(time);
  if (!parsed) return false;
  const [hStr, mStr] = parsed.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  if (m !== 0 && m !== 30) return false;

  const totalMin = h * 60 + m;
  const startMin = 9 * 60; // 09:00
  const endMin = 17 * 60 + 30; // 17:30

  return totalMin >= startMin && totalMin <= endMin;
}

/**
 * Neutralizes CSV formula injection vulnerabilities:
 * Prefixes any cell starting with '=', '+', '-', or '@' with an apostrophe.
 */
export function neutralizeCsvFormula(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Calculates the clinic's No-show rate:
 * No-show / (Done + No-show) across ALL non-cancelled rows.
 * Returns percentage (0-100), rounded to 1 decimal place.
 */
export function calculateNoShowRate(appointments: { status: string }[]): number {
  let doneCount = 0;
  let noShowCount = 0;

  for (const a of appointments) {
    if (a.status === 'Done') doneCount++;
    else if (a.status === 'No-show') noShowCount++;
  }

  const denominator = doneCount + noShowCount;
  if (denominator === 0) return 0;
  return Math.round((noShowCount / denominator) * 1000) / 10;
}
