/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Download,
  CalendarCheck,
} from 'lucide-react';
import { Appointment } from '../../types.ts';
import {
  exportToIcs,
  formatDateDisplay,
  formatTimeDisplay,
  getNowInIST,
  isWithin2Hours,
} from '../../lib/ist.ts';
import { getRepository } from '../../lib/repository/index.ts';
import { useToast } from '../common/Toast.tsx';
import { useClientAppointments } from '../../lib/clientStore.ts';

export const MyAppointments: React.FC = () => {
  const { showToast } = useToast();
  const repo = getRepository();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);

  const { appointments: allAppointments, loading, applyUpdatedAppointment } = useClientAppointments();
  const savedPhone = typeof localStorage !== 'undefined' ? localStorage.getItem('calmly_client_phone') : null;
  const appointments = savedPhone ? allAppointments.filter((a) => a.phone === savedPhone) : allAppointments;

  const now = getNowInIST();

  const upcomingList = appointments
    .filter((a) => {
      if (a.status === 'Cancelled' || a.status === 'Done') return false;
      return a.date > now.date || (a.date === now.date && a.time >= now.time);
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const pastList = appointments
    .filter((a) => {
      if (a.status === 'Cancelled' || a.status === 'Done' || a.status === 'No-show') return true;
      return a.date < now.date || (a.date === now.date && a.time < now.time);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  const currentList = activeTab === 'upcoming' ? upcomingList : pastList;

  const handleConfirmAttendance = async (appt: Appointment) => {
    try {
      const nowIso = new Date().toISOString();
      const updated = await repo.updateAppointment(appt.id, {
        confirmed_at: nowIso,
        expected_updated_at: appt.updated_at,
      });
      applyUpdatedAppointment(updated);
      showToast({
        type: 'success',
        message: 'Attendance confirmed. Thank you!',
      });
    } catch (err) {
      showToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to confirm attendance.',
      });
    }
  };

  const handleExecuteCancel = async () => {
    if (!appointmentToCancel) return;
    setCancellingId(appointmentToCancel.id);

    try {
      if (isWithin2Hours(appointmentToCancel.date, appointmentToCancel.time)) {
        showToast({
          type: 'error',
          message: 'Cancellations cannot be made within 2 hours of the appointment.',
        });
        setAppointmentToCancel(null);
        return;
      }

      const updated = await repo.updateAppointment(appointmentToCancel.id, {
        status: 'Cancelled',
        expected_updated_at: appointmentToCancel.updated_at,
      });

      applyUpdatedAppointment(updated);
      showToast({
        type: 'info',
        message: 'Appointment cancelled.',
      });
      setAppointmentToCancel(null);
    } catch (err) {
      showToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to cancel appointment.',
      });
    } finally {
      setCancellingId(null);
    }
  };

  const handleDownloadIcs = (appt: Appointment) => {
    const icsContent = exportToIcs(appt);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `calmly-${appt.date}-${appt.time}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: Appointment['status']) => {
    switch (status) {
      case 'Booked':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-sky-50 text-sky-800 border border-sky-200/80">
            <Clock className="w-3.5 h-3.5 text-sky-700" />
            Booked
          </span>
        );
      case 'Done':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            Completed
          </span>
        );
      case 'No-show':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-rose-50 text-rose-800 border border-rose-200/80">
            <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
            Missed
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
            <XCircle className="w-3.5 h-3.5 text-stone-500" />
            Cancelled
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900">
            My Appointments
          </h1>
          <p className="text-stone-500 text-xs sm:text-sm mt-1">
            View your scheduled nutrition consultations and past session history.
          </p>
        </div>

        <Link
          to="/book"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Book New Slot</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
          className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'upcoming'
              ? 'border-emerald-700 text-emerald-800 font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Upcoming ({upcomingList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('past')}
          className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'past'
              ? 'border-emerald-700 text-emerald-800 font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Past Sessions ({pastList.length})
        </button>
      </div>

      {loading && appointments.length === 0 ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-stone-200 p-6 animate-pulse" />
          ))}
        </div>
      ) : currentList.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-stone-200/90 text-center shadow-xs">
          <CalendarCheck className="w-10 h-10 text-stone-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-stone-800">
            {activeTab === 'upcoming' ? 'No upcoming consultations' : 'No past consultations'}
          </h3>
          <p className="text-xs text-stone-500 mt-1 mb-6">
            {activeTab === 'upcoming'
              ? 'Ready to make progress on your nutrition goals?'
              : 'Completed sessions will appear here.'}
          </p>
          {activeTab === 'upcoming' && (
            <Link
              to="/book"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl"
            >
              <span>Schedule Consultation</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {currentList.map((appt) => {
            const isBlockedBy2Hours = isWithin2Hours(appt.date, appt.time);
            const isConfirmed = !!appt.confirmed_at;

            return (
              <div
                key={appt.id}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200/90 shadow-xs transition-all hover:shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    {getStatusBadge(appt.status)}
                    <span className="text-xs font-semibold text-stone-900">
                      {formatDateDisplay(appt.date)}
                    </span>
                    <span className="text-xs text-stone-500">
                      at {formatTimeDisplay(appt.time)} IST
                    </span>
                  </div>

                  {appt.status === 'Booked' && (
                    <div>
                      {isConfirmed ? (
                        <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                          ✓ Confirmed
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConfirmAttendance(appt)}
                          className="text-[11px] text-emerald-800 hover:text-emerald-950 font-semibold underline cursor-pointer"
                        >
                          Confirm I'm coming
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-2 text-xs text-stone-600 mb-4">
                  <div className="flex items-center gap-2">
                    {appt.visit_type === 'Video call' ? (
                      <>
                        <Video className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Video Consultation</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                        <span>In Clinic · Indiranagar</span>
                      </>
                    )}
                  </div>
                  {appt.reason && (
                    <div>
                      <span className="text-stone-400">Focus: </span>
                      <span className="text-stone-800 font-medium">{appt.reason}</span>
                    </div>
                  )}
                </div>

                {/* Actions for upcoming Booked appointments */}
                {appt.status === 'Booked' && (
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => handleDownloadIcs(appt)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Calendar (.ics)</span>
                    </button>

                    <Link
                      to={`/book?reschedule=${appt.id}`}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer ${
                        isBlockedBy2Hours ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      <span>Reschedule</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => setAppointmentToCancel(appt)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50 rounded-lg ml-auto cursor-pointer ${
                        isBlockedBy2Hours ? 'opacity-50' : ''
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {appointmentToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200">
            <h4 className="text-lg font-semibold text-stone-900 mb-2">Cancel consultation?</h4>
            <p className="text-sm text-stone-600 mb-6 leading-relaxed">
              Are you sure you want to cancel your appointment on{' '}
              <strong>{formatDateDisplay(appointmentToCancel.date)}</strong> at{' '}
              <strong>{formatTimeDisplay(appointmentToCancel.time)}</strong>?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAppointmentToCancel(null)}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Keep
              </button>
              <button
                type="button"
                disabled={cancellingId === appointmentToCancel.id}
                onClick={handleExecuteCancel}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl cursor-pointer"
              >
                {cancellingId === appointmentToCancel.id ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
