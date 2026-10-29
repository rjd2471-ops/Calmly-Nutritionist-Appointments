/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppointmentStatus = 'Booked' | 'Done' | 'No-show' | 'Cancelled';
export type AppointmentSource = 'client' | 'nutritionist' | 'seed';
export type VisitType = 'In clinic' | 'Video call';

export interface Appointment {
  id: string;
  client_name: string;
  phone: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24h)
  status: AppointmentStatus;
  source: AppointmentSource;
  notes?: string | null;
  confirmed_at?: string | null;
  reason?: string | null;
  visit_type?: VisitType;
  seed_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaitlistEntry {
  id: string;
  client_name: string;
  phone: string;
  date: string; // YYYY-MM-DD
  notified: boolean;
  created_at: string;
}

export interface AuditLogEntry {
  id: number | string;
  appointment_id: string;
  action: 'created' | 'status_changed' | 'rescheduled' | string;
  old_status?: string | null;
  new_status?: string | null;
  details?: Record<string, unknown> | null;
  changed_at: string;
}

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface RiskAssessment {
  level: RiskLevel;
  reasons: string[];
}

export interface SlotInfo {
  time: string; // HH:mm
  label: string; // e.g. "10:00 AM"
  period: 'Morning' | 'Afternoon' | 'Evening';
  isPast: boolean;
  isTaken: boolean;
  appointment?: Appointment;
}

export interface NewAppointmentPayload {
  client_name: string;
  phone: string | null;
  date: string;
  time: string;
  status?: AppointmentStatus;
  source: AppointmentSource;
  notes?: string | null;
  reason?: string | null;
  visit_type?: VisitType;
  seed_key?: string | null;
}

export interface UpdateAppointmentPayload {
  client_name?: string;
  phone?: string | null;
  date?: string;
  time?: string;
  status?: AppointmentStatus;
  notes?: string | null;
  reason?: string | null;
  visit_type?: VisitType;
  confirmed_at?: string | null;
  expected_updated_at?: string; // for optimistic concurrency
}

export interface Repository {
  name: 'supabase' | 'localstorage';
  isLive: boolean;
  getAppointments(): Promise<Appointment[]>;
  getAppointmentById(id: string): Promise<Appointment | null>;
  createAppointment(payload: NewAppointmentPayload): Promise<Appointment>;
  updateAppointment(id: string, payload: UpdateAppointmentPayload): Promise<Appointment>;
  getWaitlist(): Promise<WaitlistEntry[]>;
  addToWaitlist(entry: { client_name: string; phone: string; date: string }): Promise<WaitlistEntry>;
  markWaitlistNotified(id: string): Promise<void>;
  getAuditLog(): Promise<AuditLogEntry[]>;
  subscribeToChanges(onChange: () => void): () => void;
  shiftSeedData(): Promise<void>;
  resetSeedData(): Promise<void>;
  getConnectionInfo(): Promise<{
    configured: boolean;
    host: string;
    maskedKey: string;
    appointmentCount: number;
    error?: string;
  }>;
}

export interface AssistantProposal {
  client_name: string;
  phone: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  visit_type: VisitType;
  goal?: string;
}
