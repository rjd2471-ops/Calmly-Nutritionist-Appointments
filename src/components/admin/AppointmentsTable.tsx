/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Search,
  Filter,
  Download,
  Plus,
  MessageCircle,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  AlertTriangle,
  RotateCcw,
  Edit2,
  Phone,
  User,
  ExternalLink,
} from 'lucide-react';
import { Appointment, AppointmentStatus, RiskAssessment } from '../../types.ts';
import {
  assessAppointmentRisk,
  formatDateDisplay,
  formatTimeDisplay,
  getNowInIST,
  isSlotInPast,
  isWithin24Hours,
} from '../../lib/ist.ts';
import {
  formatPhoneDisplay,
  getClientKey,
  neutralizeCsvFormula,
  normalizePhone,
} from '../../lib/normalize.ts';
import { getRepository } from '../../lib/repository/index.ts';
import { useToast } from '../common/Toast.tsx';

interface AppointmentsTableProps {
  appointments: Appointment[];
  onRefresh: () => void;
  onOpenManualAdd: () => void;
  onOpenTomorrowReminders: () => void;
  onOpenWaitlistForCancelled: (appt: Appointment) => void;
}

export const AppointmentsTable: React.FC<AppointmentsTableProps> = ({
  appointments,
  onRefresh,
  onOpenManualAdd,
  onOpenTomorrowReminders,
  onOpenWaitlistForCancelled,
}) => {
  const { showToast } = useToast();
  const repo = getRepository();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'upcoming' | 'past'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCancelled, setShowCancelled] = useState(false);

  // Active Modals
  const [notesAppt, setNotesAppt] = useState<Appointment | null>(null);
  const [notesText, setNotesText] = useState('');
  const [editingPhoneAppt, setEditingPhoneAppt] = useState<Appointment | null>(null);
  const [newPhoneValue, setNewPhoneValue] = useState('');

  // Status Change Confirmation Dialogs
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    appt: Appointment | null;
    targetStatus: AppointmentStatus;
    title: string;
    description: string;
  }>({
    isOpen: false,
    appt: null,
    targetStatus: 'Booked',
    title: '',
    description: '',
  });

  const now = getNowInIST();

  // Pre-calculate repeat no-shows counts
  const noShowCountsByClient = new Map<string, number>();
  appointments.forEach((a) => {
    if (a.status === 'No-show') {
      const key = getClientKey(a);
      noShowCountsByClient.set(key, (noShowCountsByClient.get(key) || 0) + 1);
    }
  });

  // Filter appointments
  const filteredAppointments = appointments.filter((a) => {
    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = a.client_name.toLowerCase().includes(term);
      const matchPhone = a.phone ? a.phone.includes(term) : false;
      if (!matchName && !matchPhone) return false;
    }

    // Cancelled toggle
    if (!showCancelled && a.status === 'Cancelled') {
      return false;
    }

    // Status filter
    if (statusFilter !== 'all' && a.status !== statusFilter) {
      return false;
    }

    // Time filter
    if (timeFilter === 'today') {
      return a.date === now.date;
    } else if (timeFilter === 'upcoming') {
      return a.date > now.date || (a.date === now.date && a.time >= now.time);
    } else if (timeFilter === 'past') {
      return a.date < now.date || (a.date === now.date && a.time < now.time);
    }

    return true;
  });

  // CSV Export with formula injection defense
  const handleExportCsv = () => {
    const headers = [
      'Client Name',
      'Phone',
      'Date (YYYY-MM-DD)',
      'Time (HH:mm)',
      'Status',
      'Confirmed At',
      'Visit Type',
      'Reason / Goal',
      'Source',
      'Notes',
    ];

    const rows = filteredAppointments.map((a) => [
      neutralizeCsvFormula(a.client_name),
      neutralizeCsvFormula(a.phone ? `'${a.phone}` : ''),
      neutralizeCsvFormula(a.date),
      neutralizeCsvFormula(a.time),
      neutralizeCsvFormula(a.status),
      neutralizeCsvFormula(a.confirmed_at || ''),
      neutralizeCsvFormula(a.visit_type || 'In clinic'),
      neutralizeCsvFormula(a.reason || ''),
      neutralizeCsvFormula(a.source),
      neutralizeCsvFormula(a.notes || ''),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `calmly_appointments_${now.date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status Change Logic with Safety Dialogs & 5-Second Undo Toast
  const initiateStatusChange = (appt: Appointment, newStatus: AppointmentStatus) => {
    if (appt.status === newStatus) return;

    // Safety 1: Confirm dialog before Cancel
    if (newStatus === 'Cancelled') {
      setConfirmDialog({
        isOpen: true,
        appt,
        targetStatus: newStatus,
        title: 'Cancel this appointment?',
        description: `This will mark ${appt.client_name}'s appointment on ${formatDateDisplay(appt.date)} as Cancelled and free up the slot for waitlisted clients.`,
      });
      return;
    }

    // Safety 2: Confirm dialog before reverting Done or No-show back to Booked
    if ((appt.status === 'Done' || appt.status === 'No-show') && newStatus === 'Booked') {
      setConfirmDialog({
        isOpen: true,
        appt,
        targetStatus: newStatus,
        title: `Revert status back to Booked?`,
        description: `Are you sure you want to change this ${appt.status} session back to Booked?`,
      });
      return;
    }

    // Direct change with 5-second undo toast
    executeStatusChange(appt, newStatus);
  };

  const executeStatusChange = async (appt: Appointment, newStatus: AppointmentStatus) => {
    const previousStatus = appt.status;
    try {
      await repo.updateAppointment(appt.id, {
        status: newStatus,
        expected_updated_at: appt.updated_at,
      });

      // Show Undo Toast
      showToast({
        type: 'success',
        message: `${appt.client_name}'s status changed to ${newStatus}.`,
        undoLabel: 'Undo',
        undoAction: async () => {
          try {
            await repo.updateAppointment(appt.id, {
              status: previousStatus,
            });
            onRefresh();
            showToast({
              type: 'info',
              message: `Reverted ${appt.client_name}'s status to ${previousStatus}.`,
            });
          } catch (err) {
            console.error('Failed to undo status change:', err);
          }
        },
      });

      // If appointment was cancelled, check if waitlist clients can be offered the freed slot
      if (newStatus === 'Cancelled') {
        onOpenWaitlistForCancelled(appt);
      }

      onRefresh();
    } catch (err: unknown) {
      showToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update status.',
      });
    }
  };

  // WhatsApp reminder message builder
  const getWhatsAppLink = (appt: Appointment) => {
    if (!appt.phone) return null;
    const cleanPhone = appt.phone.replace(/\D/g, '');
    const confirmUrl = `${window.location.origin}/?confirm=${appt.id}`;
    const text = encodeURIComponent(
      `Hello ${appt.client_name}, this is a gentle reminder from Calmly Clinic for your consultation scheduled on ${formatDateDisplay(
        appt.date
      )} at ${formatTimeDisplay(appt.time)} IST (${appt.visit_type || 'In clinic'}).\n\nPlease confirm your attendance by clicking here: ${confirmUrl}\n\nWe look forward to seeing you!`
    );
    return `https://wa.me/91${cleanPhone}?text=${text}`;
  };

  const handleSaveNotes = async () => {
    if (!notesAppt) return;
    try {
      await repo.updateAppointment(notesAppt.id, {
        notes: notesText.trim() || null,
        expected_updated_at: notesAppt.updated_at,
      });
      showToast({ type: 'success', message: 'Private notes saved.' });
      setNotesAppt(null);
      onRefresh();
    } catch (err) {
      showToast({ type: 'error', message: 'Failed to save notes.' });
    }
  };

  const handleSavePhone = async () => {
    if (!editingPhoneAppt) return;
    const norm = normalizePhone(newPhoneValue);
    if (!norm) {
      showToast({ type: 'error', message: 'Invalid 10-digit Indian phone number.' });
      return;
    }
    try {
      await repo.updateAppointment(editingPhoneAppt.id, {
        phone: norm,
        expected_updated_at: editingPhoneAppt.updated_at,
      });
      showToast({ type: 'success', message: 'Phone number updated.' });
      setEditingPhoneAppt(null);
      onRefresh();
    } catch (err) {
      showToast({ type: 'error', message: 'Failed to update phone.' });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs overflow-hidden">
      {/* Controls Bar */}
      <div className="p-4 sm:p-5 border-b border-stone-200/80 flex flex-wrap items-center justify-between gap-3 bg-stone-50/50">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-700 min-h-[36px]"
            />
          </div>

          {/* Time Filter */}
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            className="text-xs bg-white border border-stone-300 rounded-xl px-3 py-1.5 min-h-[36px] focus:outline-hidden"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-white border border-stone-300 rounded-xl px-3 py-1.5 min-h-[36px] focus:outline-hidden"
          >
            <option value="all">All Statuses</option>
            <option value="Booked">Booked</option>
            <option value="Done">Done</option>
            <option value="No-show">No-show</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Show Cancelled Toggle */}
          <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer select-none ml-1">
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={(e) => setShowCancelled(e.target.checked)}
              className="rounded text-emerald-700 focus:ring-emerald-600"
            />
            <span>Show cancelled</span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenTomorrowReminders}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
            <span>Tomorrow's Reminders</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl transition-colors cursor-pointer"
            title="Export filtered view as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={onOpenManualAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Appointment</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200/80 text-stone-500 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4">Schedule</th>
              <th className="py-3 px-4">Status &amp; Undo</th>
              <th className="py-3 px-4">Risk &amp; Flags</th>
              <th className="py-3 px-4">Format / Reason</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredAppointments.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-stone-400">
                  No appointments found matching your search and filter criteria.
                </td>
              </tr>
            ) : (
              filteredAppointments.map((appt) => {
                const isPast = isSlotInPast(appt.date, appt.time);
                const isUnconfirmed = !appt.confirmed_at;
                const in24h = isWithin24Hours(appt.date, appt.time);
                const risk = assessAppointmentRisk(appt, appointments);
                const clientKey = getClientKey(appt);
                const isRepeatNoShow = (noShowCountsByClient.get(clientKey) || 0) >= 2;
                const needsUpdate = appt.status === 'Booked' && isPast;
                const waLink = getWhatsAppLink(appt);

                return (
                  <tr
                    key={appt.id}
                    className={`hover:bg-stone-50/80 transition-colors ${
                      appt.status === 'Cancelled' ? 'opacity-50 bg-stone-50/30' : ''
                    }`}
                  >
                    {/* Client Column */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-stone-900">{appt.client_name}</div>
                      {appt.phone ? (
                        <span className="font-mono text-stone-500 text-[11px] block">
                          {formatPhoneDisplay(appt.phone)}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-amber-700 text-[11px] font-medium">No phone on file</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPhoneAppt(appt);
                              setNewPhoneValue('');
                            }}
                            className="text-[10px] text-emerald-700 underline font-semibold cursor-pointer"
                          >
                            + Add phone
                          </button>
                        </div>
                      )}
                      {appt.seed_key && (
                        <span className="text-[9px] font-mono text-stone-400 block mt-0.5">
                          seed: {appt.seed_key}
                        </span>
                      )}
                    </td>

                    {/* Schedule Column */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-stone-900">{formatDateDisplay(appt.date)}</div>
                      <div className="text-stone-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-stone-400" />
                        <span>{formatTimeDisplay(appt.time)} IST</span>
                      </div>
                    </td>

                    {/* Status Inline Selector */}
                    <td className="py-3 px-4">
                      <select
                        value={appt.status}
                        onChange={(e) =>
                          initiateStatusChange(appt, e.target.value as AppointmentStatus)
                        }
                        className={`text-xs font-semibold rounded-lg px-2.5 py-1 border cursor-pointer focus:outline-hidden ${
                          appt.status === 'Booked'
                            ? 'bg-sky-50 text-sky-800 border-sky-300'
                            : appt.status === 'Done'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : appt.status === 'No-show'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-stone-100 text-stone-600 border-stone-300'
                        }`}
                      >
                        <option value="Booked">🔵 Booked</option>
                        <option value="Done">🟢 Done</option>
                        <option value="No-show">🔴 No-show</option>
                        <option value="Cancelled">⚪ Cancelled</option>
                      </select>
                    </td>

                    {/* Risk & Badges Column */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Confirmed Badge */}
                        {appt.confirmed_at && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded"
                            title={`Confirmed attendance at ${appt.confirmed_at}`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Confirmed
                          </span>
                        )}

                        {/* At-Risk Flag */}
                        {appt.status === 'Booked' && isUnconfirmed && in24h && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded animate-pulse"
                            title="Unconfirmed booking within 24 hours"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            At Risk
                          </span>
                        )}

                        {/* Repeat No-show Badge */}
                        {isRepeatNoShow && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-800 bg-rose-50 border border-rose-300 px-1.5 py-0.5 rounded"
                            title="Client has 2 or more historical no-shows"
                          >
                            <RotateCcw className="w-3 h-3 text-rose-600" />
                            Repeat No-show
                          </span>
                        )}

                        {/* Needs Update Badge */}
                        {needsUpdate && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-800 bg-purple-50 border border-purple-300 px-1.5 py-0.5 rounded"
                            title="Time has passed; update status to Done or No-show"
                          >
                            <AlertCircle className="w-3 h-3 text-purple-600" />
                            Needs update
                          </span>
                        )}

                        {/* Rule-based Risk Chip */}
                        {appt.status === 'Booked' && (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border cursor-help ${
                              risk.level === 'High'
                                ? 'bg-rose-100 text-rose-900 border-rose-300'
                                : risk.level === 'Medium'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-stone-100 text-stone-700 border-stone-200'
                            }`}
                            title={risk.reasons.join('\n')}
                          >
                            {risk.level} Risk
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Format / Reason */}
                    <td className="py-3 px-4">
                      <div className="text-stone-800 font-medium">{appt.visit_type || 'In clinic'}</div>
                      <div className="text-stone-500 text-[11px] truncate max-w-[160px]">
                        {appt.reason || 'General wellness'}
                      </div>
                    </td>

                    {/* Actions Column */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* WhatsApp Message */}
                        {waLink ? (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Send WhatsApp confirmation reminder"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        ) : (
                          <span
                            className="p-1.5 text-stone-300 cursor-not-allowed"
                            title="No phone number on file"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </span>
                        )}

                        {/* Private Notes */}
                        <button
                          type="button"
                          onClick={() => {
                            setNotesAppt(appt);
                            setNotesText(appt.notes || '');
                          }}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            appt.notes
                              ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                              : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                          }`}
                          title={appt.notes ? 'View/edit private notes' : 'Add private notes'}
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Safety Confirm Dialog (Cancel or Done/No-show -> Booked) */}
      {confirmDialog.isOpen && confirmDialog.appt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-stone-200">
            <h4 className="text-lg font-bold text-stone-900 mb-2">{confirmDialog.title}</h4>
            <p className="text-xs text-stone-600 leading-relaxed mb-6">
              {confirmDialog.description}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Keep current
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = confirmDialog.appt;
                  const newSt = confirmDialog.targetStatus;
                  setConfirmDialog({ ...confirmDialog, isOpen: false });
                  if (target) executeStatusChange(target, newSt);
                }}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl cursor-pointer ${
                  confirmDialog.targetStatus === 'Cancelled'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {notesAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-stone-200">
            <h4 className="text-base font-bold text-stone-900 mb-1">
              Private Notes: {notesAppt.client_name}
            </h4>
            <p className="text-xs text-stone-500 mb-4">
              These notes are strictly private to the nutritionist and never exposed to the client.
            </p>
            <textarea
              rows={4}
              placeholder="Record clinical observations, dietary intolerances, lab highlights, or follow-up tasks..."
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              className="w-full p-3 text-xs border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-700 mb-4"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setNotesAppt(null)}
                className="px-4 py-2 text-xs text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNotes}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Phone Modal */}
      {editingPhoneAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-stone-200">
            <h4 className="text-base font-bold text-stone-900 mb-1">
              Add Phone: {editingPhoneAppt.client_name}
            </h4>
            <p className="text-xs text-stone-500 mb-3">
              Enter a valid 10-digit Indian phone number starting 6-9.
            </p>
            <input
              type="tel"
              placeholder="e.g. 98200 44444"
              value={newPhoneValue}
              onChange={(e) => setNewPhoneValue(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingPhoneAppt(null)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePhone}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                Save Phone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
