/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  Clock,
  MapPin,
  Video,
  CheckCircle2,
  Calendar,
  XCircle,
  AlertCircle,
  Download,
} from 'lucide-react';
import { Appointment } from '../../types.ts';
import {
  exportToIcs,
  formatDateDisplay,
  formatTimeDisplay,
  getNowInIST,
  getRelativeSlotCountdown,
  isWithin2Hours,
} from '../../lib/ist.ts';
import { getRepository } from '../../lib/repository/index.ts';
import { useToast } from '../common/Toast.tsx';

interface NextAppointmentCardProps {
  onRefresh?: () => void;
  confirmIdFromUrl?: string | null;
}

export const NextAppointmentCard: React.FC<NextAppointmentCardProps> = ({
  onRefresh,
  confirmIdFromUrl,
}) => {
  const { showToast } = useToast();
  const repo = getRepository();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchNextAppointment = async () => {
    try {
      setLoading(true);
      const all = await repo.getAppointments();
      const now = getNowInIST();

      // If URL has ?confirm=<id>, prioritize finding that appointment
      if (confirmIdFromUrl) {
        const found = all.find((a) => a.id === confirmIdFromUrl);
        if (found && found.status === 'Booked') {
          setAppointment(found);
          setLoading(false);
          return;
        }
      }

      const clientPhone = localStorage.getItem('calmly_client_phone');

      // Filter upcoming Booked appointments
      const upcoming = all.filter((a) => {
        if (a.status !== 'Booked') return false;
        const isUpcoming = a.date > now.date || (a.date === now.date && a.time > now.time);
        if (!isUpcoming) return false;
        if (clientPhone) {
          return a.phone === clientPhone;
        }
        return true; // if no phone set on device, show the closest upcoming for demonstration
      });

      // Sort by date then time ascending
      upcoming.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });

      setAppointment(upcoming[0] || null);
    } catch (err) {
      console.error('Failed to load next appointment:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNextAppointment();
  }, [confirmIdFromUrl]);

  const handleConfirmAttendance = async () => {
    if (!appointment) return;
    setIsConfirming(true);
    try {
      const nowIso = new Date().toISOString();
      const updated = await repo.updateAppointment(appointment.id, {
        confirmed_at: nowIso,
        expected_updated_at: appointment.updated_at,
      });
      setAppointment(updated);
      showToast({
        type: 'success',
        message: "Thank you! Your attendance is confirmed. We look forward to seeing you.",
      });
      onRefresh?.();
    } catch (err) {
      showToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to confirm attendance.',
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!appointment) return;
    if (isWithin2Hours(appointment.date, appointment.time)) {
      showToast({
        type: 'error',
        message: 'Cancellations cannot be made within 2 hours of the scheduled time.',
      });
      setShowCancelDialog(false);
      return;
    }

    setIsCancelling(true);
    try {
      await repo.updateAppointment(appointment.id, {
        status: 'Cancelled',
        expected_updated_at: appointment.updated_at,
      });
      showToast({
        type: 'info',
        message: 'Your appointment has been cancelled.',
      });
      setShowCancelDialog(false);
      fetchNextAppointment();
      onRefresh?.();
    } catch (err) {
      showToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to cancel appointment.',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDownloadIcs = () => {
    if (!appointment) return;
    const icsContent = exportToIcs(appointment);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `calmly-${appointment.date}-${appointment.time}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="w-full bg-white rounded-2xl p-6 border border-stone-200/80 shadow-xs animate-pulse">
        <div className="h-4 bg-stone-200 rounded w-1/4 mb-4"></div>
        <div className="h-6 bg-stone-200 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-stone-100 rounded w-1/3 mb-6"></div>
        <div className="h-10 bg-stone-200 rounded-xl w-36"></div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="w-full bg-linear-to-br from-emerald-50/70 via-stone-50 to-amber-50/40 rounded-2xl p-6 sm:p-8 border border-emerald-100 shadow-xs">
        <div className="max-w-xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
            Welcome to Calmly
          </span>
          <h2 className="text-xl sm:text-2xl font-semibold text-stone-900 mt-1 mb-2">
            No upcoming consultations scheduled
          </h2>
          <p className="text-stone-600 text-sm leading-relaxed mb-6">
            Begin your personalized health journey with Dr. Ananya Sharma. Choose a 30-minute in-clinic or video consultation that fits your routine.
          </p>
          <Link
            to="/book"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>Book a consultation</span>
          </Link>
        </div>
      </div>
    );
  }

  const countdown = getRelativeSlotCountdown(appointment.date, appointment.time);
  const isConfirmed = !!appointment.confirmed_at;
  const isBlockedBy2Hours = isWithin2Hours(appointment.date, appointment.time);

  return (
    <>
      <div className="w-full bg-white rounded-2xl p-6 sm:p-8 border border-stone-200/90 shadow-sm transition-all">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-md">
              <CalendarCheck className="w-3.5 h-3.5 text-emerald-700" />
              Your Next Appointment
            </span>
            <span className="text-xs text-stone-500 font-medium">({countdown})</span>
          </div>

          {isConfirmed ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Confirmed by you
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
              <AlertCircle className="w-3.5 h-3.5" />
              Please confirm attendance
            </span>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 my-4">
          <div>
            <h3 className="text-2xl font-semibold text-stone-900">
              {formatDateDisplay(appointment.date)}
            </h3>
            <div className="flex items-center gap-2 text-stone-600 text-sm mt-1">
              <Clock className="w-4 h-4 text-emerald-700" />
              <span className="font-semibold text-stone-900">{formatTimeDisplay(appointment.time)} IST</span>
              <span>· 30 min session</span>
            </div>
          </div>

          <div className="flex flex-col justify-center text-sm text-stone-600 space-y-1">
            <div className="flex items-center gap-2">
              {appointment.visit_type === 'Video call' ? (
                <>
                  <Video className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Video Consultation (Google Meet link emailed)</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Calmly Clinic · Indiranagar, Bengaluru</span>
                </>
              )}
            </div>
            {appointment.reason && (
              <p className="text-xs text-stone-500 italic mt-0.5">
                Focus: {appointment.reason}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-stone-100">
          {!isConfirmed && (
            <button
              type="button"
              disabled={isConfirming}
              onClick={handleConfirmAttendance}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isConfirming ? 'Confirming...' : "Confirm I'm coming"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadIcs}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Add to calendar</span>
          </button>

          <Link
            to={`/book?reschedule=${appointment.id}`}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer ${
              isBlockedBy2Hours ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <span>Reschedule</span>
          </Link>

          <button
            type="button"
            onClick={() => setShowCancelDialog(true)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer ml-auto ${
              isBlockedBy2Hours ? 'opacity-50' : ''
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        </div>

        {isBlockedBy2Hours && (
          <p className="text-[11px] text-amber-700 mt-3">
            Note: Changes and cancellations are not permitted within 2 hours of the consultation start time.
          </p>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200">
            <h4 className="text-lg font-semibold text-stone-900 mb-2">Cancel consultation?</h4>
            <p className="text-sm text-stone-600 mb-6 leading-relaxed">
              Are you sure you want to cancel your appointment on{' '}
              <strong>{formatDateDisplay(appointment.date)}</strong> at{' '}
              <strong>{formatTimeDisplay(appointment.time)}</strong>? Your slot will be freed up for clients on the waitlist.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCancelDialog(false)}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                Keep Appointment
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleCancelAppointment}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
              >
                {isCancelling ? 'Cancelling...' : 'Yes, Cancel Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
