/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Users, MessageCircle, Check, BellRing } from 'lucide-react';
import { Appointment, WaitlistEntry } from '../../types.ts';
import { formatDateDisplay, formatTimeDisplay } from '../../lib/ist.ts';
import { formatPhoneDisplay } from '../../lib/normalize.ts';
import { getRepository } from '../../lib/repository/index.ts';
import { useToast } from '../common/Toast.tsx';

interface WaitlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  freedAppointment: Appointment | null;
}

export const WaitlistDrawer: React.FC<WaitlistDrawerProps> = ({
  isOpen,
  onClose,
  freedAppointment,
}) => {
  const { showToast } = useToast();
  const repo = getRepository();

  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWaitlist = async () => {
    try {
      setLoading(true);
      const list = await repo.getWaitlist();
      setWaitlist(list);
    } catch (err) {
      console.error('Failed to load waitlist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWaitlist();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // If triggered by a cancelled slot, filter for matches on that date
  const targetDate = freedAppointment?.date;
  const matchingEntries = targetDate
    ? waitlist.filter((w) => w.date === targetDate)
    : waitlist;

  const handleMarkNotified = async (id: string) => {
    try {
      await repo.markWaitlistNotified(id);
      showToast({ type: 'success', message: 'Client marked as notified.' });
      fetchWaitlist();
    } catch (err) {
      showToast({ type: 'error', message: 'Failed to update waitlist entry.' });
    }
  };

  const getOfferWhatsAppLink = (entry: WaitlistEntry) => {
    const cleanPhone = entry.phone.replace(/\D/g, '');
    const timeText = freedAppointment ? ` at ${formatTimeDisplay(freedAppointment.time)} IST` : '';
    const text = encodeURIComponent(
      `Hello ${entry.client_name}, great news from Calmly Clinic! A consultation slot just opened up on ${formatDateDisplay(
        entry.date
      )}${timeText}.\n\nIf you would like to book this slot, please reply directly or book at: ${window.location.origin}/book`
    );
    return `https://wa.me/91${cleanPhone}?text=${text}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-stone-200">
        <div className="p-5 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                {freedAppointment ? 'Slot Freed: Offer to Waiting Clients' : 'Clinic Waitlist'}
              </h3>
              <span className="text-xs text-stone-500">
                {freedAppointment
                  ? `${formatDateDisplay(freedAppointment.date)} at ${formatTimeDisplay(freedAppointment.time)}`
                  : `${waitlist.length} total waiting clients`}
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
          {matchingEntries.length === 0 ? (
            <div className="text-center py-10">
              <Users className="w-8 h-8 text-stone-300 mx-auto mb-2" />
              <p className="text-xs text-stone-500">
                {targetDate
                  ? `No clients currently waitlisted for ${formatDateDisplay(targetDate)}.`
                  : 'Waitlist is currently empty.'}
              </p>
            </div>
          ) : (
            matchingEntries.map((w) => {
              const waLink = getOfferWhatsAppLink(w);
              return (
                <div
                  key={w.id}
                  className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                    w.notified
                      ? 'bg-stone-50 border-stone-200 opacity-60'
                      : 'bg-emerald-50/50 border-emerald-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-stone-900">{w.client_name}</span>
                      {w.notified && (
                        <span className="text-[10px] text-stone-500 bg-stone-200 px-1.5 py-0.2 rounded font-medium">
                          Notified
                        </span>
                      )}
                    </div>
                    <div className="text-stone-500 text-[11px] mt-0.5">
                      Requested: {formatDateDisplay(w.date)} · {formatPhoneDisplay(w.phone)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Offer Slot</span>
                    </a>

                    {!w.notified && (
                      <button
                        type="button"
                        onClick={() => handleMarkNotified(w.id)}
                        className="px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl border border-stone-300 transition-colors cursor-pointer"
                        title="Mark as notified"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
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
