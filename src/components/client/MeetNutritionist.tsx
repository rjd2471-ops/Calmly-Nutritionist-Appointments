/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Award, BookOpen, Clock, GraduationCap } from 'lucide-react';

export const MeetNutritionist: React.FC = () => {
  return (
    <section id="about" className="py-12 border-t border-stone-200/80">
      <div className="bg-white rounded-2xl p-6 sm:p-10 border border-stone-200/90 shadow-xs">
        <div className="flex items-center justify-between mb-6">
          <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            Clinical Practitioner
          </div>
          <span className="text-[11px] font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded">
            Sample profile
          </span>
        </div>

        <div className="grid md:grid-cols-12 gap-8 items-center">
          {/* Avatar / Portrait Column */}
          <div className="md:col-span-4 flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden border-2 border-emerald-100 shadow-sm bg-stone-100">
              <img
                src="/images/clinic_consultation.jpg"
                alt="Dr. Ananya Sharma consulting with a client in a warm clinic setting"
                width={300}
                height={300}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <h3 className="text-xl font-bold text-stone-900 mt-4">
              Dr. Ananya Sharma
            </h3>
            <span className="text-xs font-medium text-emerald-800">
              M.Sc. Clinical Nutrition, RD, CDE
            </span>
          </div>

          {/* Bio & Details Column */}
          <div className="md:col-span-8 space-y-4">
            <p className="text-stone-700 text-sm sm:text-base leading-relaxed">
              Dr. Ananya specializes in functional metabolic health, PCOS management, and gut microbiome restoration. With over 12 years of clinical hospital and private practice experience across Mumbai and Bengaluru, her care blends biochemical lab scrutiny with compassionate lifestyle changes.
            </p>
            <p className="text-stone-600 text-sm leading-relaxed">
              "Nutrition should never feel like punitive restriction. My goal is to build sustainable, culturally resonant meal frameworks that honor your heritage foods while stabilizing your metabolic markers."
            </p>

            {/* Credential chips */}
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 bg-stone-100 px-3 py-1.5 rounded-lg">
                <GraduationCap className="w-3.5 h-3.5 text-emerald-700" />
                M.Sc. Clinical Nutrition (SNDT)
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 bg-stone-100 px-3 py-1.5 rounded-lg">
                <Award className="w-3.5 h-3.5 text-emerald-700" />
                Registered Dietitian (IDA No. 4108)
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 bg-stone-100 px-3 py-1.5 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
                12+ Years Clinical Practice
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 bg-stone-100 px-3 py-1.5 rounded-lg">
                <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                Certified Diabetes Educator (CDE)
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
