/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Video,
  Download,
  Users,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { Appointment, SlotInfo, VisitType } from '../../types.ts';
import {
  addDaysIST,
  exportToIcs,
  formatDateDisplay,
  formatTimeDisplay,
  generateSlotsForDay,
  getNowInIST,
  isWithin2Hours,
} from '../../lib/ist.ts';
import { normalizePhone } from '../../lib/normalize.ts';
import { getRepository } from '../../lib/repository/index.ts';
import { useToast } from '../common/Toast.tsx';

const GOAL_OPTIONS = [
  'Weight management',
  'General wellness',
  'Sports nutrition',
  'Gut health',
  'PCOS & Hormones',
  'Other',
];

export const BookingWizard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const rescheduleId = searchParams.get('reschedule');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const repo = getRepository();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form selections
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [visitType, setVisitType] = useState<VisitType>('In clinic');
  const [selectedGoal, setSelectedGoal] = useState('General wellness');
  const [customGoal, setCustomGoal] = useState('');
  const [notes, setNotes] = useState('');

  // Honeypot field for bot protection
  const [honeypot, setHoneypot] = useState('');

  // Validation errors
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [bookingError, setBookingError] = useState('');

  // Created appointment for success screen
  const [createdAppointment, setCreatedAppointment] = useState<Appointment | null>(null);

  // Waitlist modal state
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false);

  // Reschedule existing appointment info
  const [existingAppointment, setExistingAppointment] = useState<Appointment | null>(null);

  // Generate 60 days starting today
  const [dateList, setDateList] = useState<string[]>([]);

  useEffect(() => {
    const now = getNowInIST();
    const days: string[] = [];
    for (let i = 0; i < 60; i++) {
      days.push(addDaysIST(now.date, i));
    }
    setDateList(days);
    if (!selectedDate) {
      setSelectedDate(days[0]);
    }

    // Prefill phone from device
    const savedPhone = localStorage.getItem('calmly_client_phone');
    if (savedPhone) {
      setClientPhone(savedPhone);
    }
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const list = await repo.getAppointments();
      setAppointments(list);

      if (rescheduleId) {
        const found = list.find((a) => a.id === rescheduleId);
        if (found) {
          setExistingAppointment(found);
          setClientName(found.client_name);
          if (found.phone) setClientPhone(found.phone);
          if (found.visit_type) setVisitType(found.visit_type);
          if (found.reason) setSelectedGoal(found.reason);
          setSelectedDate(found.date);
        }
      }
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
    const unsub = repo.subscribeToChanges(() => {
      fetchAppointments();
    });
    return unsub;
  }, [rescheduleId]);

  // Generate slots for selected date
  const slotsForDay: SlotInfo[] = selectedDate
    ? generateSlotsForDay(selectedDate, appointments, rescheduleId || undefined)
    : [];

  const availableSlots = slotsForDay.filter((s) => !s.isPast && !s.isTaken);
  const isDayFullyBooked = slotsForDay.length > 0 && availableSlots.length === 0;

  const morningSlots = slotsForDay.filter((s) => s.period === 'Morning');
  const afternoonSlots = slotsForDay.filter((s) => s.period === 'Afternoon');
  const eveningSlots = slotsForDay.filter((s) => s.period === 'Evening');

  const handleDateSelect = (d: string) => {
    setSelectedDate(d);
    setSelectedTime('');
    setBookingError('');
  };

  const handleTimeSelect = (t: string) => {
    setSelectedTime(t);
    setBookingError('');
    setStep(3); // proceed to details
  };

  const validateDetails = (): boolean => {
    let valid = true;
    setNameError('');
    setPhoneError('');

    const trimmedName = clientName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setNameError('Please enter your full name (between 2 and 80 characters).');
      valid = false;
    }

    const norm = normalizePhone(clientPhone);
    if (!norm) {
      setPhoneError('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError('');

    // Honeypot bot protection: silently ignore submission
    if (honeypot.trim()) {
      console.warn('Honeypot triggered, submission silently ignored.');
      setStep(4);
      return;
    }

    if (!validateDetails()) return;
    if (!selectedDate || !selectedTime) {
      setBookingError('Please select both a date and time slot.');
      setStep(1);
      return;
    }

    setIsSubmitting(true);
    const finalGoal = selectedGoal === 'Other' && customGoal.trim() ? customGoal.trim() : selectedGoal;
    const normPhone = normalizePhone(clientPhone);

    try {
      if (rescheduleId && existingAppointment) {
        if (isWithin2Hours(existingAppointment.date, existingAppointment.time)) {
          throw new Error('Cancellations and rescheduling are not permitted within 2 hours of scheduled time.');
        }

        const updated = await repo.updateAppointment(rescheduleId, {
          client_name: clientName.trim(),
          phone: normPhone,
          date: selectedDate,
          time: selectedTime,
          visit_type: visitType,
          reason: finalGoal,
          notes: notes.trim() || null,
          expected_updated_at: existingAppointment.updated_at,
        });

        if (normPhone) {
          localStorage.setItem('calmly_client_phone', normPhone);
        }

        setCreatedAppointment(updated);
        setStep(4);
        showToast({
          type: 'success',
          message: 'Appointment rescheduled successfully!',
        });
      } else {
        const created = await repo.createAppointment({
          client_name: clientName.trim(),
          phone: normPhone,
          date: selectedDate,
          time: selectedTime,
          source: 'client',
          status: 'Booked',
          visit_type: visitType,
          reason: finalGoal,
          notes: notes.trim() || null,
        });

        if (normPhone) {
          localStorage.setItem('calmly_client_phone', normPhone);
        }

        setCreatedAppointment(created);
        setStep(4);
        showToast({
          type: 'success',
          message: 'Consultation booked successfully!',
        });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : (err as any)?.message || 'Failed to complete booking.';
      setBookingError(errorMsg);
      showToast({
        type: 'error',
        message: errorMsg,
      });

      // If slot taken (code 23505), refresh appointments so user picks another
      if (errorMsg.includes('taken') || (err as any)?.code === '23505') {
        setSelectedTime('');
        setStep(2);
        fetchAppointments();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDetails()) return;

    setIsSubmittingWaitlist(true);
    try {
      await repo.addToWaitlist({
        client_name: clientName.trim(),
        phone: normalizePhone(clientPhone)!,
        date: selectedDate,
      });
      setWaitlistSuccess(true);
      showToast({
        type: 'success',
        message: "You've been added to the waitlist for this day!",
      });
    } catch (err) {
      showToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to join waitlist.',
      });
    } finally {
      setIsSubmittingWaitlist(false);
    }
  };

  const handleDownloadIcs = () => {
    if (!createdAppointment) return;
    const icsContent = exportToIcs(createdAppointment);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `calmly-${createdAppointment.date}-${createdAppointment.time}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // STEP 4: Success Screen
  if (step === 4 && createdAppointment) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-emerald-100 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9 stroke-[2.2px]" />
          </div>

          <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
            {rescheduleId ? 'Appointment Rescheduled!' : 'Consultation Confirmed!'}
          </h2>
          <p className="text-stone-600 text-sm leading-relaxed mb-6">
            We have reserved your 30-minute private consultation with Dr. Ananya Sharma. A reminder message will be sent to your mobile.
          </p>

          <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200/80 text-left mb-6 space-y-3">
            <div className="flex items-center justify-between text-xs text-stone-500 pb-2 border-b border-stone-200/60">
              <span>Client Name</span>
              <span className="font-semibold text-stone-900">{createdAppointment.client_name}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-stone-500 pb-2 border-b border-stone-200/60">
              <span>Date &amp; Time</span>
              <span className="font-semibold text-stone-900">
                {formatDateDisplay(createdAppointment.date)} · {formatTimeDisplay(createdAppointment.time)} IST
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-stone-500 pb-2 border-b border-stone-200/60">
              <span>Visit Format</span>
              <span className="font-semibold text-stone-900">{createdAppointment.visit_type}</span>
            </div>
            {createdAppointment.reason && (
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span>Focus Goal</span>
                <span className="font-semibold text-stone-900">{createdAppointment.reason}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleDownloadIcs}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Add to calendar (.ics)</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer"
            >
              <span>Return Home</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-4 sm:py-8">
      {/* Reschedule Notification Banner */}
      {rescheduleId && existingAppointment && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Rescheduling appointment currently set for{' '}
              <strong>{formatDateDisplay(existingAppointment.date)}</strong> at{' '}
              <strong>{formatTimeDisplay(existingAppointment.time)}</strong>.
            </span>
          </div>
          <Link to="/" className="font-semibold underline shrink-0">
            Cancel
          </Link>
        </div>
      )}

      {/* Progress Bar (3 Steps) */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-medium text-stone-500 mb-2">
          <span className={step >= 1 ? 'text-emerald-800 font-semibold' : ''}>1. Select Date</span>
          <span className={step >= 2 ? 'text-emerald-800 font-semibold' : ''}>2. Choose Time</span>
          <span className={step >= 3 ? 'text-emerald-800 font-semibold' : ''}>3. Your Details</span>
        </div>
        <div className="h-1.5 w-full bg-stone-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-700 transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {bookingError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{bookingError}</span>
        </div>
      )}

      <div className="bg-white rounded-3xl p-5 sm:p-8 border border-stone-200/90 shadow-xs">
        {/* STEP 1: Select Date */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900">
                Choose an appointment date
              </h2>
              <p className="text-stone-500 text-xs sm:text-sm mt-1">
                Consultations are open 7 days a week, up to 60 days ahead.
              </p>
            </div>

            {/* Horizontal Scrollable Date Strip */}
            <div className="overflow-x-auto pb-3 pt-1 -mx-2 px-2 scrollbar-none flex gap-2.5">
              {dateList.map((d) => {
                const isSelected = selectedDate === d;
                const [y, m, dayNum] = d.split('-').map(Number);
                const dateObj = new Date(Date.UTC(y, m - 1, dayNum, 12, 0, 0));
                const weekday = dateObj.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' });
                const month = dateObj.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' });

                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDateSelect(d)}
                    className={`flex flex-col items-center justify-center w-16 sm:w-20 py-3 px-2 rounded-2xl border transition-all shrink-0 cursor-pointer min-h-[56px] ${
                      isSelected
                        ? 'bg-emerald-800 text-white border-emerald-800 shadow-sm scale-102'
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-800 border-stone-200/90'
                    }`}
                  >
                    <span className="text-[11px] font-medium opacity-80 uppercase tracking-tight">
                      {weekday}
                    </span>
                    <span className="text-lg sm:text-xl font-bold my-0.5">
                      {dayNum}
                    </span>
                    <span className="text-[10px] font-medium opacity-75">
                      {month}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
              <span className="text-xs text-stone-600">
                Selected: <strong className="text-stone-900">{formatDateDisplay(selectedDate)}</strong>
              </span>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer"
              >
                <span>Select Time</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Choose Time Slot */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900">
                  Select a consultation time
                </h2>
                <p className="text-stone-500 text-xs sm:text-sm mt-1">
                  {formatDateDisplay(selectedDate)} · 30-minute slots in Indian Standard Time (IST)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-emerald-800 hover:underline font-medium cursor-pointer"
              >
                Change date
              </button>
            </div>

            {isDayFullyBooked ? (
              <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200 text-center">
                <Users className="w-8 h-8 text-amber-700 mx-auto mb-2" />
                <h3 className="text-base font-semibold text-stone-900">
                  All slots are booked for this day
                </h3>
                <p className="text-xs text-stone-600 max-w-md mx-auto mt-1 mb-4">
                  Join our instant waitlist. If any client reschedules or cancels, we will immediately notify you.
                </p>
                <button
                  type="button"
                  onClick={() => setShowWaitlistModal(true)}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
                >
                  Join the waitlist for {formatDateDisplay(selectedDate)}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Morning Slots */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">
                    Morning (09:00 - 11:30)
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                    {morningSlots.map((s) => {
                      const isDisabled = s.isPast || s.isTaken;
                      const isSelected = selectedTime === s.time;
                      return (
                        <button
                          key={s.time}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => handleTimeSelect(s.time)}
                          className={`py-2.5 px-2 rounded-xl text-xs font-medium border transition-all min-h-[44px] flex flex-col items-center justify-center cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                              : isDisabled
                              ? 'bg-stone-100 text-stone-400 border-stone-200/60 cursor-not-allowed line-through opacity-60'
                              : 'bg-white hover:bg-emerald-50 text-stone-800 border-stone-300/80 hover:border-emerald-300'
                          }`}
                        >
                          <span>{s.label}</span>
                          {s.isTaken && <span className="text-[9px] uppercase tracking-tighter opacity-80">Taken</span>}
                          {s.isPast && <span className="text-[9px] uppercase tracking-tighter opacity-80">Past</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Afternoon Slots */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">
                    Afternoon (12:00 - 15:30)
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                    {afternoonSlots.map((s) => {
                      const isDisabled = s.isPast || s.isTaken;
                      const isSelected = selectedTime === s.time;
                      return (
                        <button
                          key={s.time}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => handleTimeSelect(s.time)}
                          className={`py-2.5 px-2 rounded-xl text-xs font-medium border transition-all min-h-[44px] flex flex-col items-center justify-center cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                              : isDisabled
                              ? 'bg-stone-100 text-stone-400 border-stone-200/60 cursor-not-allowed line-through opacity-60'
                              : 'bg-white hover:bg-emerald-50 text-stone-800 border-stone-300/80 hover:border-emerald-300'
                          }`}
                        >
                          <span>{s.label}</span>
                          {s.isTaken && <span className="text-[9px] uppercase tracking-tighter opacity-80">Taken</span>}
                          {s.isPast && <span className="text-[9px] uppercase tracking-tighter opacity-80">Past</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Evening Slots */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">
                    Evening (16:00 - 17:30)
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                    {eveningSlots.map((s) => {
                      const isDisabled = s.isPast || s.isTaken;
                      const isSelected = selectedTime === s.time;
                      return (
                        <button
                          key={s.time}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => handleTimeSelect(s.time)}
                          className={`py-2.5 px-2 rounded-xl text-xs font-medium border transition-all min-h-[44px] flex flex-col items-center justify-center cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                              : isDisabled
                              ? 'bg-stone-100 text-stone-400 border-stone-200/60 cursor-not-allowed line-through opacity-60'
                              : 'bg-white hover:bg-emerald-50 text-stone-800 border-stone-300/80 hover:border-emerald-300'
                          }`}
                        >
                          <span>{s.label}</span>
                          {s.isTaken && <span className="text-[9px] uppercase tracking-tighter opacity-80">Taken</span>}
                          {s.isPast && <span className="text-[9px] uppercase tracking-tighter opacity-80">Past</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              {selectedTime && (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer"
                >
                  <span>Continue to Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Details & Confirmation Form */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900">
                  Your Consultation Details
                </h2>
                <p className="text-stone-500 text-xs sm:text-sm mt-1">
                  {formatDateDisplay(selectedDate)} at {formatTimeDisplay(selectedTime)} IST
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs text-emerald-800 hover:underline font-medium cursor-pointer"
              >
                Change slot
              </button>
            </div>

            {/* Hidden Honeypot Field for Spambots */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website_url">Leave this empty</label>
              <input
                id="website_url"
                name="website_url"
                type="text"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Sharma"
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      setNameError('');
                    }}
                    className="w-full pl-9 pr-3 py-2.5 text-base sm:text-sm bg-white border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-700 min-h-[44px]"
                  />
                </div>
                {nameError && <p className="text-xs text-rose-600 mt-1">{nameError}</p>}
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                  Mobile Number (India) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 98200 11111"
                    value={clientPhone}
                    onChange={(e) => {
                      setClientPhone(e.target.value);
                      setPhoneError('');
                    }}
                    className="w-full pl-9 pr-3 py-2.5 text-base sm:text-sm bg-white border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-700 min-h-[44px]"
                  />
                </div>
                {phoneError && <p className="text-xs text-rose-600 mt-1">{phoneError}</p>}
                <p className="text-[11px] text-stone-500 mt-1">
                  Used to manage your booking without passwords.
                </p>
              </div>
            </div>

            {/* Visit Format */}
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-2">
                Consultation Format
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setVisitType('In clinic')}
                  className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-colors cursor-pointer min-h-[44px] ${
                    visitType === 'In clinic'
                      ? 'border-emerald-700 bg-emerald-50/60 ring-1 ring-emerald-700'
                      : 'border-stone-200/90 bg-white hover:bg-stone-50'
                  }`}
                >
                  <MapPin className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-stone-900 block text-xs sm:text-sm">In Clinic</span>
                    <span className="text-[11px] text-stone-500 block">Indiranagar, Bengaluru</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setVisitType('Video call')}
                  className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-colors cursor-pointer min-h-[44px] ${
                    visitType === 'Video call'
                      ? 'border-emerald-700 bg-emerald-50/60 ring-1 ring-emerald-700'
                      : 'border-stone-200/90 bg-white hover:bg-stone-50'
                  }`}
                >
                  <Video className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-stone-900 block text-xs sm:text-sm">Video Call</span>
                    <span className="text-[11px] text-stone-500 block">Google Meet link</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Goal Chips */}
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-2">
                Primary Goal or Health Focus
              </label>
              <div className="flex flex-wrap gap-2">
                {GOAL_OPTIONS.map((goal) => {
                  const isSelected = selectedGoal === goal;
                  return (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => setSelectedGoal(goal)}
                      className={`px-3 py-2 text-xs font-medium rounded-xl border transition-colors cursor-pointer min-h-[40px] ${
                        isSelected
                          ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                          : 'bg-stone-50 text-stone-700 border-stone-200/80 hover:bg-stone-100'
                      }`}
                    >
                      {goal}
                    </button>
                  );
                })}
              </div>
              {selectedGoal === 'Other' && (
                <input
                  type="text"
                  placeholder="Specify your goal (e.g. Thyroid management, Pre-pregnancy nutrition)"
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  className="w-full mt-2.5 px-3 py-2 text-base sm:text-sm bg-white border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
                />
              )}
            </div>

            {/* Additional Notes */}
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                Additional Notes or Lab Results (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Mention any existing conditions, recent blood work highlights, or specific concerns."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 text-base sm:text-sm bg-white border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t border-stone-100 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-3 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <span>{isSubmitting ? 'Reserving Slot...' : rescheduleId ? 'Confirm Reschedule' : 'Confirm Consultation'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Waitlist Modal */}
      {showWaitlistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-stone-200">
            {waitlistSuccess ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-700 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-stone-900 mb-2">You're on the waitlist!</h3>
                <p className="text-xs text-stone-600 mb-6">
                  We have noted your interest for {formatDateDisplay(selectedDate)}. If a client reschedules, our team will message you directly on WhatsApp.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowWaitlistModal(false);
                    setWaitlistSuccess(false);
                  }}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleJoinWaitlist} className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-stone-900">
                    Join Waitlist for {formatDateDisplay(selectedDate)}
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Enter your details to be notified immediately when a slot opens up.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-800 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Your name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-2 text-base sm:text-sm border border-stone-300 rounded-xl"
                  />
                  {nameError && <p className="text-xs text-rose-600 mt-1">{nameError}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-800 mb-1">
                    WhatsApp Mobile Number
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit number"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-3 py-2 text-base sm:text-sm border border-stone-300 rounded-xl"
                  />
                  {phoneError && <p className="text-xs text-rose-600 mt-1">{phoneError}</p>}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowWaitlistModal(false)}
                    className="px-4 py-2 text-xs text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingWaitlist}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl cursor-pointer"
                  >
                    {isSubmittingWaitlist ? 'Adding...' : 'Join Waitlist'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
