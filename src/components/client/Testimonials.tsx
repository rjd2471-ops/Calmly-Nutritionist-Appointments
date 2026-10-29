/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Quote } from 'lucide-react';

export const Testimonials: React.FC = () => {
  const testimonials = [
    {
      name: 'Pooja Venkatesh',
      focus: 'PCOS & Insulin Resistance',
      quote:
        'Dr. Ananya helped me understand my insulin spikes without obsessing over calorie counts. In four months, my fasting glucose dropped from 104 to 88 mg/dL, and my chronic 3 PM brain fog completely disappeared.',
      duration: '4 months of care',
    },
    {
      name: 'Rohan Deshmukh',
      focus: 'Marathon Nutrition & Gut Health',
      quote:
        'Balancing a demanding software engineering schedule with marathon training left me constantly fatigued. Ananya redesigned my intra-run fueling and dinner recovery meals. I shaved 14 minutes off my half-marathon PR with zero cramping.',
      duration: '6 months of care',
    },
    {
      name: 'Sunita Rao',
      focus: 'Hypertension & Lipid Optimization',
      quote:
        'Instead of banning all South Indian food, Ananya showed me how small tweaks to our dal tempering and adding fiber transformed my blood work. My cardiologist was thrilled with my recent ApoB numbers.',
      duration: '3 months of care',
    },
  ];

  return (
    <section className="py-12 border-t border-stone-200/80">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            Client Experiences
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1">
            What clients say
          </h2>
        </div>
        <span className="text-xs text-stone-500 bg-stone-100 px-2.5 py-1 rounded-md font-medium">
          Sample testimonials
        </span>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {testimonials.map((t, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl p-6 border border-stone-200/90 shadow-xs flex flex-col justify-between"
          >
            <div>
              <Quote className="w-6 h-6 text-emerald-700/40 mb-3" />
              <p className="text-stone-700 text-xs sm:text-sm leading-relaxed mb-6">
                "{t.quote}"
              </p>
            </div>
            <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-stone-900 block">{t.name}</span>
                <span className="text-stone-500 text-[11px]">{t.focus}</span>
              </div>
              <span className="text-[11px] text-emerald-800 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                {t.duration}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
