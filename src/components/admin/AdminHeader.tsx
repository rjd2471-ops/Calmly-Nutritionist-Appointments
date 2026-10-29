/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Radio, Shield, RefreshCw } from 'lucide-react';

interface AdminHeaderProps {
  isLive: boolean;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ isLive, onRefresh, isRefreshing }) => {
  return (
    <header className="sticky top-0 z-40 bg-stone-900 text-stone-100 border-b border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-serif text-lg font-bold shadow-xs">
            C
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base tracking-tight text-white">Calmly Clinic</span>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded">
                Admin
              </span>
            </div>
            <span className="text-[11px] text-stone-400 block -mt-0.5">
              Nutritionist Practice Management
            </span>
          </div>
        </div>

        {/* Live Indicator & Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-stone-300 font-mono text-[11px]">
              {isLive ? 'Live Sync' : 'Polling (5s)'}
            </span>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 text-stone-300 hover:text-white rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
            title="Refresh database"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <Link
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-200 bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors cursor-pointer"
          >
            <span>Open client app</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
};
