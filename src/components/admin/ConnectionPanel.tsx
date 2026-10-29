/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, RefreshCw, FastForward, RotateCcw } from 'lucide-react';
import { getRepository } from '../../lib/repository/index.ts';
import { useToast } from '../common/Toast.tsx';

interface ConnectionPanelProps {
  onDataChanged: () => void;
}

export const ConnectionPanel: React.FC<ConnectionPanelProps> = ({ onDataChanged }) => {
  const { showToast } = useToast();
  const repo = getRepository();

  const [connectionInfo, setConnectionInfo] = useState<{
    configured: boolean;
    host: string;
    maskedKey: string;
    appointmentCount: number;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isShifting, setIsShifting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const checkConnection = async () => {
    try {
      setLoading(true);
      const info = await repo.getConnectionInfo();
      setConnectionInfo(info);
    } catch (err) {
      console.error('Failed to get connection info:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only loads initially once, NO periodic probing
    checkConnection();
  }, []);

  const handleShiftDemoData = async () => {
    setIsShifting(true);
    try {
      await repo.shiftSeedData();
      showToast({
        type: 'success',
        message: 'Shifted sample appointments to upcoming dates for this week. Statuses preserved.',
      });
      onDataChanged();
      checkConnection();
    } catch (err) {
      showToast({
        type: 'error',
        message: 'Failed to shift demo data.',
      });
    } finally {
      setIsShifting(false);
    }
  };

  const handleResetDemoData = async () => {
    setIsResetting(true);
    try {
      await repo.resetSeedData();
      showToast({
        type: 'info',
        message: 'Reset complete: Original seed dates/times/statuses restored; other appointments cancelled.',
      });
      onDataChanged();
      checkConnection();
    } catch (err) {
      showToast({
        type: 'error',
        message: 'Failed to reset demo data.',
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="bg-stone-900 text-stone-200 rounded-2xl p-5 border border-stone-800 shadow-sm mb-8 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-stone-800">
        <div className="flex items-center gap-2.5">
          <Database className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-white text-sm">
            Database &amp; Connection Status (Read-Only)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isShifting}
            onClick={handleShiftDemoData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900/90 border border-emerald-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Moves seed rows to upcoming dates this week, preserving original statuses"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>{isShifting ? 'Shifting...' : 'Shift demo data to this week'}</span>
          </button>

          <button
            type="button"
            disabled={isResetting}
            onClick={handleResetDemoData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-300 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Restores 5 seed rows to original date/time/status and sets others to Cancelled"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isResetting ? 'Resetting...' : 'Reset demo data'}</span>
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-4 font-mono text-[11px]">
        <div>
          <span className="text-stone-500 block text-[10px] uppercase">Storage Mode</span>
          <span className="font-semibold text-emerald-400">
            {repo.name === 'supabase' ? 'Supabase Postgres (Cloud)' : 'Browser LocalStorage (Demo Mode)'}
          </span>
        </div>

        <div>
          <span className="text-stone-500 block text-[10px] uppercase">Host</span>
          <span className="text-stone-300 truncate block">
            {connectionInfo ? connectionInfo.host : 'Detecting...'}
          </span>
        </div>

        <div>
          <span className="text-stone-500 block text-[10px] uppercase">Key Masked</span>
          <span className="text-stone-300 font-mono">
            {connectionInfo ? connectionInfo.maskedKey : '******'}
          </span>
        </div>

        <div>
          <span className="text-stone-500 block text-[10px] uppercase">Total Rows (SELECT count)</span>
          <span className="text-stone-200 font-bold">
            {connectionInfo ? `${connectionInfo.appointmentCount} records` : 'Reading...'}
          </span>
        </div>
      </div>

      {connectionInfo?.error && (
        <div className="mt-3 p-2 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px]">
          {connectionInfo.error}
        </div>
      )}
    </div>
  );
};
