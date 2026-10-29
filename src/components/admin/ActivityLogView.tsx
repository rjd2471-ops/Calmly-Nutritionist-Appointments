/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { History, Shield, ArrowRight, RefreshCw, Clock } from 'lucide-react';
import { AuditLogEntry } from '../../types.ts';
import { getRepository } from '../../lib/repository/index.ts';

export const ActivityLogView: React.FC = () => {
  const repo = getRepository();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await repo.getAuditLog();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs overflow-hidden">
      <div className="p-5 border-b border-stone-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900">Audit Trail (Read-Only)</h3>
            <span className="text-xs text-stone-500">
              Database-level trigger logs all inserts, status changes, and reschedules
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="p-1.5 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
          title="Refresh audit logs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200/80 text-stone-500 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Timestamp (IST)</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Status Transition</th>
              <th className="py-3 px-4">Details</th>
              <th className="py-3 px-4">Appointment ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-stone-400">
                  {loading ? 'Loading audit records...' : 'No activity logs found.'}
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const dateObj = new Date(log.changed_at);
                const timeStr = dateObj.toLocaleTimeString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
                const dateStr = dateObj.toLocaleDateString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <tr key={log.id} className="hover:bg-stone-50/80 font-mono text-[11px]">
                    <td className="py-2.5 px-4 text-stone-600 whitespace-nowrap">
                      {dateStr} {timeStr}
                    </td>

                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-semibold uppercase text-[10px] ${
                          log.action === 'created'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.action === 'status_changed'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="py-2.5 px-4 text-stone-800 whitespace-nowrap">
                      {log.old_status && log.new_status ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-stone-500">{log.old_status}</span>
                          <ArrowRight className="w-3 h-3 text-stone-400" />
                          <span className="font-semibold text-emerald-800">{log.new_status}</span>
                        </span>
                      ) : (
                        <span className="font-semibold text-emerald-800">{log.new_status || 'Initial'}</span>
                      )}
                    </td>

                    <td className="py-2.5 px-4 text-stone-600">
                      {log.details ? (
                        <span className="truncate max-w-xs block" title={JSON.stringify(log.details)}>
                          {JSON.stringify(log.details)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>

                    <td className="py-2.5 px-4 text-stone-400 font-mono text-[10px] truncate max-w-[120px]">
                      {log.appointment_id || '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
