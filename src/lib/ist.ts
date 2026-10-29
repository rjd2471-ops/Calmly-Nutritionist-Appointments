/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Appointment, RiskAssessment, SlotInfo } from '../types.ts';
import { getClientKey } from './normalize.ts';

export const CLINIC_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
] as const;

/**
 * Returns current date and time in Asia/Kolkata (IST).
 */
export function getNowInIST(): {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  isoString: string;
  timestamp: number;
} {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = getPart('hour');
  const minute = getPart('minute');

  const date = `${year}-${month}-${day}`;
  const time = `${hour}:${minute}`;

  return {
    date,
    time,
    isoString: `${date}T${time}:00+05:30`,
    timestamp: now.getTime(),
  };
}

/**
 * Checks if a slot (date + time) is in the past in Asia/Kolkata.
 */
export function isSlotInPast(date: string, time: string): boolean {
  const now = getNowInIST();
  if (date < now.date) return true;
  if (date > now.date) return false;
  return time <= now.time;
}

/**
 * Checks if a date is strictly in the past (before today in IST).
 */
export function isDateInPast(date: string): boolean {
  const now = getNowInIST();
  return date < now.date;
}

/**
 * Checks if slot is within 2 hours of the appointment start time in IST.
 * Returns true if less than 2 hours remaining (or already past).
 */
export function isWithin2Hours(date: string, time: string): boolean {
  const now = Date.now();
  // IST is UTC+5:30
  const slotDate = new Date(`${date}T${time}:00+05:30`).getTime();
  const diffMs = slotDate - now;
  const twoHoursMs = 2 * 60 * 60 * 1000;
  return diffMs <= twoHoursMs;
}

/**
 * Checks if slot is within 24 hours of start.
 */
export function isWithin24Hours(date: string, time: string): boolean {
  const now = Date.now();
  const slotDate = new Date(`${date}T${time}:00+05:30`).getTime();
  const diffMs = slotDate - now;
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  return diffMs > 0 && diffMs <= twentyFourHoursMs;
}

/**
 * Adds N days to a YYYY-MM-DD date.
 */
export function addDaysIST(startDate: string, daysToAdd: number): string {
  const [y, m, d] = startDate.split('-').map((v) => parseInt(v, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a 24-hour time to friendly 12-hour display.
 * "10:00" -> "10:00 AM"
 * "14:30" -> "2:30 PM"
 */
export function formatTimeDisplay(time: string): string {
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Formats a YYYY-MM-DD date to a human-friendly string in IST.
 * e.g. "Sat, 24 Oct 2026"
 */
export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10));
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Returns human countdown relative to slot (e.g. "in 2 hours", "tomorrow", "in 3 days").
 */
export function getRelativeSlotCountdown(date: string, time: string): string {
  const now = Date.now();
  const slotDate = new Date(`${date}T${time}:00+05:30`).getTime();
  const diffMs = slotDate - now;

  if (diffMs <= 0) return 'Passed';

  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `in ${diffMins} min${diffMins === 1 ? '' : 's'}`;
  if (diffHours < 24) return `in ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
  if (diffDays === 1) return 'tomorrow';
  return `in ${diffDays} days`;
}

/**
 * Generates slot status array for a specific date given existing appointments.
 */
export function generateSlotsForDay(
  date: string,
  appointments: Appointment[],
  excludeAppointmentId?: string
): SlotInfo[] {
  const activeBookings = appointments.filter(
    (a) => a.date === date && a.status !== 'Cancelled' && a.id !== excludeAppointmentId
  );
  const takenTimesMap = new Map<string, Appointment>();
  activeBookings.forEach((a) => takenTimesMap.set(a.time, a));

  return CLINIC_SLOTS.map((slotTime) => {
    const isPast = isSlotInPast(date, slotTime);
    const existingBooking = takenTimesMap.get(slotTime);
    const isTaken = !!existingBooking;

    const [h] = slotTime.split(':').map((v) => parseInt(v, 10));
    let period: 'Morning' | 'Afternoon' | 'Evening' = 'Morning';
    if (h >= 12 && h < 16) period = 'Afternoon';
    else if (h >= 16) period = 'Evening';

    return {
      time: slotTime,
      label: formatTimeDisplay(slotTime),
      period,
      isPast,
      isTaken,
      appointment: existingBooking,
    };
  });
}

/**
 * Calculates rule-based risk level and explanations for an appointment.
 */
export function assessAppointmentRisk(
  appointment: Appointment,
  allAppointments: Appointment[]
): RiskAssessment {
  const reasons: string[] = [];

  if (appointment.status !== 'Booked') {
    return { level: 'Low', reasons: ['Appointment is completed or cancelled.'] };
  }

  // Count past no-shows for this client
  const clientKey = getClientKey(appointment);
  const clientHistory = allAppointments.filter(
    (a) => a.id !== appointment.id && getClientKey(a) === clientKey
  );
  const noShowCount = clientHistory.filter((a) => a.status === 'No-show').length;

  if (noShowCount >= 2) {
    reasons.push(`Client has ${noShowCount} prior no-shows (repeat no-show risk).`);
  } else if (noShowCount === 1) {
    reasons.push('Client missed 1 previous appointment.');
  }

  // Unconfirmed within 24 hours
  const isUnconfirmed = !appointment.confirmed_at;
  const in24h = isWithin24Hours(appointment.date, appointment.time);
  if (isUnconfirmed && in24h) {
    reasons.push('Unconfirmed booking scheduled within the next 24 hours.');
  } else if (isUnconfirmed) {
    reasons.push('Awaiting client confirmation.');
  }

  // Booked on very short notice (< 24h from created_at to slot)
  if (appointment.created_at) {
    const createdAt = new Date(appointment.created_at).getTime();
    const slotTime = new Date(`${appointment.date}T${appointment.time}:00+05:30`).getTime();
    if (slotTime - createdAt < 24 * 60 * 60 * 1000 && isUnconfirmed) {
      reasons.push('Booked on short notice without confirmation.');
    }
  }

  let level: 'Low' | 'Medium' | 'High' = 'Low';
  if (noShowCount >= 2 || (isUnconfirmed && in24h && noShowCount >= 1)) {
    level = 'High';
  } else if (isUnconfirmed && in24h) {
    level = 'Medium';
  } else if (noShowCount >= 1 || isUnconfirmed) {
    level = 'Low';
  }

  return { level, reasons };
}

/**
 * Generates an .ics calendar file for an appointment in Asia/Kolkata timezone.
 */
export function exportToIcs(appointment: Appointment): string {
  const [y, m, d] = appointment.date.split('-');
  const [h, min] = appointment.time.split(':');
  const startHour = parseInt(h, 10);
  const startMin = parseInt(min, 10);

  // 30-minute slot duration
  let endHour = startHour;
  let endMin = startMin + 30;
  if (endMin >= 60) {
    endMin -= 60;
    endHour += 1;
  }

  const dtStart = `${y}${m}${d}T${String(startHour).padStart(2, '0')}${String(endMin).padStart(2, '0')}00`;
  const dtEnd = `${y}${m}${d}T${String(endHour).padStart(2, '0')}${String(endMin).padStart(2, '0')}00`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Calmly//Nutrition Consultation//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Kolkata',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0530',
    'TZOFFSETTO:+0530',
    'TZNAME:IST',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:calmly-${appointment.id}@calmly.clinic`,
    `DTSTAMP:${y}${m}${d}T000000Z`,
    `DTSTART;TZID=Asia/Kolkata:${dtStart}`,
    `DTEND;TZID=Asia/Kolkata:${dtEnd}`,
    `SUMMARY:Calmly Nutrition Consultation (${appointment.visit_type || 'In clinic'})`,
    `DESCRIPTION:Nutrition consultation with Dr. Ananya Sharma.\\nVisit Type: ${appointment.visit_type || 'In clinic'}\\nReason: ${appointment.reason || 'General wellness'}\\nClient: ${appointment.client_name}`,
    'LOCATION:Calmly Wellness Clinic, Indiranagar, Bengaluru / Google Meet',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
