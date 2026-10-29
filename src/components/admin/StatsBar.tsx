/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Users, Calendar, AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';
import { Appointment } from '../../types.ts';
import { getNowInIST, isWithin24Hours } from '../../lib/ist.ts';
import { calculateNoShowRate } from '../../lib/normalize.ts';

interface StatsBarProps {
  appointments: Appointment[];
}

export const StatsBar: React.FC<StatsBarProps> = ({ appointments }) => {
  const now = getNowInIST();

  // 1. No-show rate: No-show / (Done + No-show) across ALL non-cancelled rows
  const noShowRate = calculateNoShowRate(appointments);

  // 2. Today's sessions (non-cancelled for today)
  const todaySessions = appointments.filter(
    (a) => a.date === now.date && a.status !== 'Cancelled'
  ).length;

  // 3. At-risk count: Booked, unconfirmed, within 24 hours of start
  const atRiskCount = appointments.filter(
    (a) =>
      a.status === 'Booked' &&
      !a.confirmed_at &&
      isWithin24Hours(a.date, a.time)
  ).length;

  // 4. Completed count
  const completedCount = appointments.filter((a) => a.status === 'Done').length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Metric 1: No-show Rate */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-stone-500 font-medium mb-1">
          <span>No-Show Rate</span>
          <TrendingDown className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-stone-900 tabular-nums">
            {noShowRate}%
          </span>
          <span className="text-[11px] text-stone-500">
            (No-show / [Done + No-show])
          </span>
        </div>
      </div>

      {/* Metric 2: Today's Sessions */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-stone-500 font-medium mb-1">
          <span>Today's Sessions</span>
          <Calendar className="w-4 h-4 text-sky-600" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-stone-900 tabular-nums">
            {todaySessions}
          </span>
          <span className="text-[11px] text-stone-500">scheduled for today</span>
        </div>
      </div>

      {/* Metric 3: At-Risk Appointments */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-stone-500 font-medium mb-1">
          <span>At-Risk Bookings</span>
          <AlertTriangle className={`w-4 h-4 ${atRiskCount > 0 ? 'text-amber-600' : 'text-stone-400'}`} />
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
              atRiskCount > 0 ? 'text-amber-700' : 'text-stone-900'
            }`}
          >
            {atRiskCount}
          </span>
          <span className="text-[11px] text-stone-500">unconfirmed in &lt;24h</span>
        </div>
      </div>

      {/* Metric 4: Completed Count */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-stone-500 font-medium mb-1">
          <span>Completed Consultations</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-stone-900 tabular-nums">
            {completedCount}
          </span>
          <span className="text-[11px] text-stone-500">total sessions done</span>
        </div>
      </div>
    </div>
  );
};
