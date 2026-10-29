/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, MessageCircle, Clock, CheckCircle2, User, Phone } from 'lucide-react';
import { Appointment } from '../../types.ts';
import { addDaysIST, formatDateDisplay, formatTimeDisplay, getNowInIST } from '../../lib/ist.ts';
import { formatPhoneDisplay } from '../../lib/normalize.ts';

interface RemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: Appointment[];
}

export const RemindersModal: React.FC<RemindersModalProps> = ({
  isOpen,
  onClose,
  appointments,
}) => {
  if (!isOpen) return null;

  const now = getNowInIST();
  const tomorrowDate = addDaysIST(now.date, 1);

  // Appointments for tomorrow that are Booked
  const tomorrowBookings = appointments.filter(
    (a) => a.date === tomorrowDate && a.status === 'Booked'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-stone-200">
        <div className="p-5 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Tomorrow's Reminders ({formatDateDisplay(tomorrowDate)})
              </h3>
              <span className="text-xs text-stone-500">
                {tomorrowBookings.length} consultations scheduled
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {tomorrowBookings.length === 0 ? (
            <p className="text-xs text-stone-500 text-center py-8">
              No appointments scheduled for tomorrow ({formatDateDisplay(tomorrowDate)}).
            </p>
          ) : (
            tomorrowBookings.map((appt) => {
              const hasPhone = !!appt.phone;
              const cleanPhone = appt.phone?.replace(/\D/g, '');
              const confirmUrl = `${window.location.origin}/?confirm=${appt.id}`;
              const text = encodeURIComponent(
                `Hello ${appt.client_name}, this is your reminder from Calmly Clinic for your consultation tomorrow, ${formatDateDisplay(
                  appt.date
                )} at ${formatTimeDisplay(appt.time)} IST (${appt.visit_type || 'In clinic'}).\n\nPlease confirm attendance: ${confirmUrl}`
              );
              const waLink = hasPhone ? `https://wa.me/91${cleanPhone}?text=${text}` : null;
              const isConfirmed = !!appt.confirmed_at;

              return (
                <div
                  key={appt.id}
                  className="p-3.5 rounded-2xl border border-stone-200/90 bg-stone-50/50 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-stone-900">{appt.client_name}</span>
                      {isConfirmed ? (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">
                          ✓ Confirmed
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                          Pending
                        </span>
                      )}
                    </div>
                    <div className="text-stone-500 text-[11px] mt-0.5">
                      {formatTimeDisplay(appt.time)} IST · {appt.visit_type} ·{' '}
                      {hasPhone ? formatPhoneDisplay(appt.phone) : 'No phone'}
                    </div>
                  </div>

                  {waLink ? (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shrink-0 cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Send WhatsApp</span>
                    </a>
                  ) : (
                    <span className="text-xs text-stone-400">No phone</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded-xl hover:bg-stone-100 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
