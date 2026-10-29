/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Sparkles, ShieldCheck, HeartHandshake } from 'lucide-react';

export const Hero: React.FC = () => {
  const [imgError, setImgError] = useState(false);

  return (
    <section className="relative overflow-hidden py-12 md:py-18">
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Copy & Actions */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Private Nutrition &amp; Metabolic Care</span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span>Bengaluru &amp; Virtual</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-stone-900 tracking-tight leading-[1.15] text-balance">
            Nourish your body. Cultivate calm.
          </h1>

          <p className="text-base sm:text-lg text-stone-600 leading-relaxed max-w-2xl">
            Evidence-based nutritional science paired with empathetic, sustainable habit coaching. Transparent schedules, zero wait rooms, and direct care tailored to your biomarkers and life.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/book"
              className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>Book Consultation</span>
            </Link>

            <a
              href="#about"
              className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-medium text-stone-700 bg-white hover:bg-stone-100 border border-stone-200/90 rounded-xl transition-colors cursor-pointer"
            >
              <span>Meet Dr. Ananya</span>
            </a>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-stone-200/80 text-xs text-stone-600">
            <div className="space-y-1">
              <span className="font-semibold text-stone-900 block text-sm">30-min</span>
              <span>1-on-1 focused session</span>
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-stone-900 block text-sm">Real-time</span>
              <span>Direct slot confirmation</span>
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-stone-900 block text-sm">2-Way Care</span>
              <span>In clinic &amp; Video calls</span>
            </div>
          </div>
        </div>

        {/* Right Column: Hero Visual */}
        <div className="lg:col-span-5">
          <div className="relative rounded-2xl overflow-hidden shadow-md border border-stone-200/90 aspect-16/10 lg:aspect-4/3 bg-stone-100">
            {!imgError ? (
              <img
                src="/images/hero_clinic_exterior.jpg"
                alt="Modern wellness clinic exterior at golden hour"
                width={800}
                height={600}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full bg-linear-to-br from-emerald-100 via-stone-100 to-amber-50 flex flex-col items-center justify-center p-6 text-center text-stone-700">
                <HeartHandshake className="w-12 h-12 text-emerald-700 mb-2" />
                <span className="font-serif font-semibold text-lg text-stone-900">Calmly Wellness Clinic</span>
                <span className="text-xs text-stone-500 mt-1">A quiet haven for mindful clinical nutrition</span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 p-4 bg-linear-to-t from-stone-900/80 via-stone-900/40 to-transparent text-white text-xs">
              <span className="font-medium">Calmly Clinic · Indiranagar</span>
              <span className="block text-[11px] text-stone-300">Modern, daylight-filled consultation sanctuary</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
