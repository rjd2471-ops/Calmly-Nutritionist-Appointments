/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Activity, Apple, RefreshCw } from 'lucide-react';

export const WhatToExpect: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Biomarker & Routine Audit',
      description:
        'In your initial 30-minute consultation, we analyze your current lipid profiles, fasting insulin, circadian rhythm, daily energy spikes, and stress triggers.',
      icon: Activity,
    },
    {
      num: '02',
      title: 'Culturally Aligned Protocols',
      description:
        'We design balanced meal compositions utilizing local, accessible whole foods. No foreign ingredients or extreme calorie deprivations.',
      icon: Apple,
    },
    {
      num: '03',
      title: 'Weekly Iterative Accountability',
      description:
        'Small, measured tweaks each week to help habits stick permanently. Clear follow-up notes, pantry guides, and direct progress assessments.',
      icon: RefreshCw,
    },
  ];

  return (
    <section className="py-12 border-t border-stone-200/80">
      <div className="text-center max-w-xl mx-auto mb-10">
        <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
          The Calmly Method
        </span>
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1">
          What to expect in your consultations
        </h2>
        <p className="text-stone-600 text-sm mt-2">
          Structured, calm, and grounded in clinical evidence from day one.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.num}
              className="bg-white rounded-2xl p-6 border border-stone-200/90 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="font-mono text-xs text-stone-400 font-semibold">
                    {step.num}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-stone-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
