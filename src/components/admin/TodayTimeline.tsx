/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Clock, Plus, CheckCircle2, User, Phone } from 'lucide-react';
import { Appointment } from '../../types.ts';
import { CLINIC_SLOTS, formatTimeDisplay, getNowInIST, isSlotInPast } from '../../lib/ist.ts';
import { formatPhoneDisplay } from '../../lib/normalize.ts';

interface TodayTimelineProps {
  appointments: Appointment[];
  onSelectSlotToBook: (date: string, time: string) => void;
  onSelectAppointment: (appointment: Appointment) => void;
}

export const TodayTimeline: React.FC<TodayTimelineProps> = ({
  appointments,
  onSelectSlotToBook,
  onSelectAppointment,
}) => {
  const now = getNowInIST();
  const todayAppointments = appointments.filter(
    (a) => a.date === now.date && a.status !== 'Cancelled'
  );
  const apptMap = new Map<string, Appointment>();
  todayAppointments.forEach((a) => apptMap.set(a.time, a));

  return (
    <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-xs mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-700" />
          <h3 className="text-sm font-semibold text-stone-900">Today's Timeline ({now.date})</h3>
        </div>
        <span className="text-xs text-stone-500">
          {todayAppointments.length} Booked · {CLINIC_SLOTS.length - todayAppointments.length} Free
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-2">
        {CLINIC_SLOTS.map((time) => {
          const appt = apptMap.get(time);
          const isPast = isSlotInPast(now.date, time);

          if (appt) {
            let statusColor = 'border-sky-300 bg-sky-50 text-sky-950';
            if (appt.status === 'Done') statusColor = 'border-emerald-300 bg-emerald-50 text-emerald-950';
            if (appt.status === 'No-show') statusColor = 'border-rose-300 bg-rose-50 text-rose-950';

            return (
              <button
                key={time}
                type="button"
                onClick={() => onSelectAppointment(appt)}
                className={`p-2 rounded-xl border text-left flex flex-col justify-between h-20 transition-all hover:shadow-xs cursor-pointer ${statusColor}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-mono text-[11px] font-bold">{time}</span>
                  <span className="text-[9px] font-semibold uppercase">{appt.status}</span>
                </div>
                <div>
                  <span className="font-semibold text-xs truncate block">{appt.client_name}</span>
                  <span className="text-[10px] opacity-75 truncate block">
                    {appt.phone ? formatPhoneDisplay(appt.phone) : 'No phone'}
                  </span>
                </div>
              </button>
            );
          }

          return (
            <button
              key={time}
              type="button"
              onClick={() => onSelectSlotToBook(now.date, time)}
              className={`p-2 rounded-xl border border-dashed border-stone-200 hover:border-emerald-400 bg-stone-50/60 hover:bg-emerald-50/50 text-left flex flex-col justify-between h-20 transition-all group cursor-pointer ${
                isPast ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-[11px] text-stone-500">{time}</span>
                <Plus className="w-3.5 h-3.5 text-stone-400 group-hover:text-emerald-700" />
              </div>
              <span className="text-[11px] font-medium text-stone-400 group-hover:text-emerald-800">
                + Free Slot
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
