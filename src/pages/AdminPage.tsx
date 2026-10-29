/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Appointment } from '../types.ts';
import { getRepository } from '../lib/repository/index.ts';
import { seedInitialData } from '../lib/seed.ts';
import { AdminHeader } from '../components/admin/AdminHeader.tsx';
import { ConnectionPanel } from '../components/admin/ConnectionPanel.tsx';
import { StatsBar } from '../components/admin/StatsBar.tsx';
import { TodayTimeline } from '../components/admin/TodayTimeline.tsx';
import { AppointmentsTable } from '../components/admin/AppointmentsTable.tsx';
import { RemindersModal } from '../components/admin/RemindersModal.tsx';
import { WaitlistDrawer } from '../components/admin/WaitlistDrawer.tsx';
import { ManualAddModal } from '../components/admin/ManualAddModal.tsx';
import { ActivityLogView } from '../components/admin/ActivityLogView.tsx';
import { ChartsView } from '../components/admin/ChartsView.tsx';
import { Calendar, BarChart3, History, Users } from 'lucide-react';

export const AdminPage: React.FC = () => {
  const repo = getRepository();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [activeTab, setActiveTab] = useState<'appointments' | 'charts' | 'activity' | 'waitlist'>('appointments');

  // Modals
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualAddDate, setManualAddDate] = useState<string | undefined>();
  const [manualAddTime, setManualAddTime] = useState<string | undefined>();
  const [showRemindersModal, setShowRemindersModal] = useState(false);
  const [showWaitlistDrawer, setShowWaitlistDrawer] = useState(false);
  const [freedAppointment, setFreedAppointment] = useState<Appointment | null>(null);

  // Set robots meta tag to prevent search engine indexing
  useEffect(() => {
    let metaRobots = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    if (!metaRobots) {
      metaRobots = document.createElement('meta');
      metaRobots.name = 'robots';
      document.head.appendChild(metaRobots);
    }
    metaRobots.content = 'noindex, nofollow';

    return () => {
      metaRobots.content = 'index, follow';
    };
  }, []);

  const fetchAppointments = async () => {
    try {
      setIsRefreshing(true);
      const data = await repo.getAppointments();
      setAppointments(data);
    } catch (err) {
      console.error('Failed to fetch admin appointments:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Initial seed run (idempotent, guarded)
    seedInitialData(repo).then(() => {
      fetchAppointments();
    });

    const unsub = repo.subscribeToChanges(() => {
      fetchAppointments();
    });

    return unsub;
  }, []);

  const handleSelectSlotToBook = (date: string, time: string) => {
    setManualAddDate(date);
    setManualAddTime(time);
    setShowManualAdd(true);
  };

  const handleSelectAppointment = (appt: Appointment) => {
    // Scroll to appointments table
    setActiveTab('appointments');
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-stone-100 text-stone-900">
      <AdminHeader
        isLive={isLive}
        onRefresh={fetchAppointments}
        isRefreshing={isRefreshing}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-16">
        <ConnectionPanel onDataChanged={fetchAppointments} />

        <StatsBar appointments={appointments} />

        <TodayTimeline
          appointments={appointments}
          onSelectSlotToBook={handleSelectSlotToBook}
          onSelectAppointment={handleSelectAppointment}
        />

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-stone-200 mb-6 bg-white rounded-t-2xl px-4 pt-2 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('appointments')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'appointments'
                ? 'border-emerald-700 text-emerald-800 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>All Appointments ({appointments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('charts')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'charts'
                ? 'border-emerald-700 text-emerald-800 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analytics &amp; Attendance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'activity'
                ? 'border-emerald-700 text-emerald-800 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Activity &amp; Audit Trail</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFreedAppointment(null);
              setShowWaitlistDrawer(true);
            }}
            className="flex items-center gap-1.5 py-3 px-4 text-xs font-medium text-stone-500 hover:text-stone-800 ml-auto cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>Waitlist</span>
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'appointments' && (
          <AppointmentsTable
            appointments={appointments}
            onRefresh={fetchAppointments}
            onOpenManualAdd={() => {
              setManualAddDate(undefined);
              setManualAddTime(undefined);
              setShowManualAdd(true);
            }}
            onOpenTomorrowReminders={() => setShowRemindersModal(true)}
            onOpenWaitlistForCancelled={(appt) => {
              setFreedAppointment(appt);
              setShowWaitlistDrawer(true);
            }}
          />
        )}

        {activeTab === 'charts' && <ChartsView appointments={appointments} />}

        {activeTab === 'activity' && <ActivityLogView />}
      </main>

      {/* Manual Add Modal */}
      <ManualAddModal
        isOpen={showManualAdd}
        onClose={() => setShowManualAdd(false)}
        onSuccess={fetchAppointments}
        initialDate={manualAddDate}
        initialTime={manualAddTime}
      />

      {/* Tomorrow Reminders Modal */}
      <RemindersModal
        isOpen={showRemindersModal}
        onClose={() => setShowRemindersModal(false)}
        appointments={appointments}
      />

      {/* Waitlist Drawer */}
      <WaitlistDrawer
        isOpen={showWaitlistDrawer}
        onClose={() => {
          setShowWaitlistDrawer(false);
          setFreedAppointment(null);
        }}
        freedAppointment={freedAppointment}
      />
    </div>
  );
};
