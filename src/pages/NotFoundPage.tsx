/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Compass } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[100dvh] bg-stone-50 text-stone-800 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-stone-200 text-center shadow-xs">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto mb-4">
          <Compass className="w-8 h-8" />
        </div>

        <span className="text-xs font-mono font-semibold text-emerald-800 uppercase tracking-widest block mb-1">
          404 Not Found
        </span>
        <h1 className="text-2xl font-serif font-bold text-stone-900 mb-2">
          Page does not exist
        </h1>
        <p className="text-stone-600 text-xs sm:text-sm leading-relaxed mb-6">
          The page you are looking for has been moved or was typed incorrectly.
        </p>

        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer"
        >
          <Home className="w-4 h-4" />
          <span>Return to Calmly Home</span>
        </Link>
      </div>
    </div>
  );
};
