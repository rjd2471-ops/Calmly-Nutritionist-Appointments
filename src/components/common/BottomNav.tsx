/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, CalendarPlus, CalendarCheck } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const location = useLocation();

  const tabs = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/book', label: 'Book', icon: CalendarPlus },
    { to: '/appointments', label: 'Appointments', icon: CalendarCheck },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200/90 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-3 h-16 max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.to;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex flex-col items-center justify-center gap-1 transition-colors min-h-[44px] ${
                isActive
                  ? 'text-emerald-800 font-semibold'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.75px]'}`} />
              <span className="text-[11px] tracking-tight">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
