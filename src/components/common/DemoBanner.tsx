/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AlertTriangle, Database, Info, X } from 'lucide-react';
import { getValidatedConfig } from '../../lib/config.ts';

export const DemoBanner: React.FC = () => {
  const config = getValidatedConfig();
  const [minimized, setMinimized] = useState(false);

  // If Supabase is cleanly configured with no errors, don't show demo banner
  if (config.isValid && !config.isDemoMode) {
    return null;
  }

  const isConfigError = !!config.error && config.host !== 'local-demo';

  if (minimized) {
    return (
      <div className="fixed top-2 right-2 z-50">
        <button
          onClick={() => setMinimized(false)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-md transition-all cursor-pointer ${
            isConfigError
              ? 'bg-rose-100 text-rose-900 border border-rose-300'
              : 'bg-amber-100 text-amber-900 border border-amber-300'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Demo mode active</span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Demo mode warning"
      className={`w-full py-2.5 px-4 text-xs font-medium border-b transition-colors ${
        isConfigError
          ? 'bg-rose-50 text-rose-950 border-rose-200'
          : 'bg-amber-50 text-amber-950 border-amber-200'
      }`}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {isConfigError ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span className="truncate">
            <strong className="font-semibold">Demo mode: data stays on this device.</strong>{' '}
            {config.error ? (
              <span className="opacity-90">
                {config.badVariable ? `[${config.badVariable}]: ` : ''}
                {config.error}
              </span>
            ) : (
              <span className="opacity-90">
                Add VITE_SUPABASE_URL &amp; VITE_SUPABASE_ANON_KEY to connect live Supabase.
              </span>
            )}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="text-stone-500 hover:text-stone-800 p-1 rounded transition-colors shrink-0 cursor-pointer"
          aria-label="Minimize demo banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
