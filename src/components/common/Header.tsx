/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, User, Phone, Check, RefreshCw } from 'lucide-react';
import { formatPhoneDisplay, normalizePhone } from '../../lib/normalize.ts';

interface HeaderProps {
  onIdentityChange?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onIdentityChange }) => {
  const location = useLocation();
  const [savedPhone, setSavedPhone] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    const p = localStorage.getItem('calmly_client_phone');
    setSavedPhone(p);
  }, []);

  const handleSavePhone = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizePhone(phoneInput);
    if (!normalized) {
      setPhoneError('Enter a valid 10-digit number starting 6-9');
      return;
    }
    localStorage.setItem('calmly_client_phone', normalized);
    setSavedPhone(normalized);
    setIsSwitching(false);
    setPhoneInput('');
    setPhoneError('');
    onIdentityChange?.();
  };

  const handleClearPhone = () => {
    localStorage.removeItem('calmly_client_phone');
    setSavedPhone(null);
    setIsSwitching(false);
    onIdentityChange?.();
  };

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/book', label: 'Book Consultation' },
    { to: '/appointments', label: 'My Appointments' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-stone-50/90 backdrop-blur-md border-b border-stone-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark */}
        <Link
          to="/"
          className="text-xl font-bold tracking-tight text-emerald-900 hover:text-emerald-800 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <span className="w-8 h-8 rounded-lg bg-emerald-700 text-stone-50 flex items-center justify-center font-serif text-lg font-bold shadow-xs">
            C
          </span>
          <span className="font-semibold text-stone-900 tracking-tight">Calmly</span>
        </Link>

        {/* Zone 2: Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`transition-colors py-1 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'text-emerald-800 font-semibold border-b-2 border-emerald-700'
                    : 'hover:text-stone-900'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Client Identity & Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {savedPhone ? (
            <div className="relative flex items-center text-xs text-stone-600">
              <span className="hidden sm:inline font-mono mr-1.5 text-stone-700">
                {formatPhoneDisplay(savedPhone)}
              </span>
              <button
                type="button"
                onClick={() => setIsSwitching(!isSwitching)}
                className="text-emerald-700 hover:text-emerald-900 underline font-medium cursor-pointer"
              >
                Switch
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSwitching(!isSwitching)}
              className="text-xs text-stone-600 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Set phone</span>
            </button>
          )}

          <Link
            to="/book"
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Book Consultation</span>
          </Link>
        </div>
      </div>

      {/* Switch Phone Popover */}
      {isSwitching && (
        <div className="border-t border-stone-200 bg-white p-4 shadow-md text-sm">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-stone-900">Remember your appointments</span>
              {savedPhone && (
                <button
                  type="button"
                  onClick={handleClearPhone}
                  className="text-xs text-rose-600 hover:underline cursor-pointer"
                >
                  Clear saved device
                </button>
              )}
            </div>
            <p className="text-xs text-stone-500 mb-3">
              Enter your Indian mobile number to easily manage and view your consultations. No password required.
            </p>
            <form onSubmit={handleSavePhone} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="tel"
                  placeholder="e.g. 98200 11111"
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    setPhoneError('');
                  }}
                  className="w-full px-3 py-2 text-base border border-stone-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsSwitching(false)}
                className="px-3 py-2 text-xs text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
            </form>
            {phoneError && <p className="text-xs text-rose-600 mt-1">{phoneError}</p>}
          </div>
        </div>
      )}
    </header>
  );
};
