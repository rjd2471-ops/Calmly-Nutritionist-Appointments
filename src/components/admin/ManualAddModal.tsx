/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Calendar, Clock, User, Phone, MapPin, Video } from 'lucide-react';
import { AppointmentStatus, VisitType } from '../../types.ts';
import { CLINIC_SLOTS, getNowInIST } from '../../lib/ist.ts';
import { normalizePhone } from '../../lib/normalize.ts';
import { getRepository } from '../../lib/repository/index.ts';
import { useToast } from '../common/Toast.tsx';

interface ManualAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
  initialTime?: string;
}

export const ManualAddModal: React.FC<ManualAddModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
  initialTime,
}) => {
  const { showToast } = useToast();
  const repo = getRepository();
  const now = getNowInIST();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(initialDate || now.date);
  const [time, setTime] = useState(initialTime || '10:00');
  const [status, setStatus] = useState<AppointmentStatus>('Booked');
  const [visitType, setVisitType] = useState<VisitType>('In clinic');
  const [reason, setReason] = useState('General wellness');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setError('Client name must be between 2 and 80 characters.');
      return;
    }

    // Phone is optional for manual nutritionist entries!
    let normPhone: string | null = null;
    if (phone.trim()) {
      normPhone = normalizePhone(phone);
      if (!normPhone) {
        setError('Please enter a valid 10-digit phone number or leave blank.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await repo.createAppointment({
        client_name: trimmedName,
        phone: normPhone,
        date,
        time,
        status,
        source: 'nutritionist', // Exempt from client-only booking rules
        visit_type: visitType,
        reason: reason.trim() || null,
        notes: notes.trim() || null,
      });

      showToast({
        type: 'success',
        message: `Appointment created for ${trimmedName}.`,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as any)?.message || 'Failed to create appointment.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-200">
        <div className="p-5 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-stone-900">Add Appointment (Admin)</h3>
            <span className="text-xs text-stone-500">
              Manual nutritionist entry (past dates and unlisted phones permitted)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-stone-800 mb-1">
              Client Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Meera Iyer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-800 mb-1">
              Mobile Number (Optional)
            </label>
            <input
              type="tel"
              placeholder="e.g. 98200 11111 (or leave blank if no phone)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
            />
            <span className="text-[10px] text-stone-400 mt-0.5 block">
              Nutritionists may log walk-ins without a mobile number on file.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-800 mb-1">
                Date (YYYY-MM-DD) <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">
                Time Slot <span className="text-rose-500">*</span>
              </label>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
              >
                {CLINIC_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {t} ({t < '12:00' ? `${t} AM` : `${t} PM`})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-800 mb-1">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl"
              >
                <option value="Booked">🔵 Booked</option>
                <option value="Done">🟢 Done (Completed session)</option>
                <option value="No-show">🔴 No-show</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">
                Visit Format
              </label>
              <select
                value={visitType}
                onChange={(e) => setVisitType(e.target.value as VisitType)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl"
              >
                <option value="In clinic">In clinic</option>
                <option value="Video call">Video call</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-800 mb-1">
              Focus Goal / Consultation Reason
            </label>
            <input
              type="text"
              placeholder="e.g. Gut microbiome protocol follow-up"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-800 mb-1">
              Private Clinical Notes
            </label>
            <textarea
              rows={2}
              placeholder="Private practitioner observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 text-xs border border-stone-300 rounded-xl"
            />
          </div>

          <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Create Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
