/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

export const FaqAccordion: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FaqItem[] = [
    {
      question: 'What is the 2-hour cancellation and rescheduling rule?',
      answer:
        'To respect everyone’s time and allow clients on our waitlist to be accommodated, cancellations and reschedulings must be completed at least 2 hours before your scheduled appointment start time. Inside 2 hours, modifications are locked.',
    },
    {
      question: 'What should I prepare or bring to my first consultation?',
      answer:
        'Please have any blood panel results or lab reports from the past 6-12 months (e.g. CBC, lipid profile, HbA1c, thyroid panel). A quick 3-day log of what you typically eat and your primary daily medications or supplements is also very helpful.',
    },
    {
      question: 'How do video consultations work compared to in-clinic visits?',
      answer:
        'Both formats are 30 minutes of dedicated one-on-one time with Dr. Ananya. For video appointments, you will receive a secure Google Meet link. In-clinic consultations take place at our peaceful clinic in Indiranagar, Bengaluru.',
    },
    {
      question: 'How many appointments can I have booked at once?',
      answer:
        'To ensure fair scheduling across all active clients, our system permits up to 3 upcoming confirmed appointments per phone number at any given time. Bookings can be scheduled up to 60 days in advance.',
    },
    {
      question: 'What happens if a desired day is completely full?',
      answer:
        'If all slots on your preferred date are booked, simply tap "Join the waitlist" on the booking page. If an appointment is rescheduled or cancelled, our clinic reaches out directly to offer the freed slot.',
    },
  ];

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="py-12 border-t border-stone-200/80 mb-12">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            Clear Guidelines
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1">
            Frequently asked questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-stone-200/90 shadow-xs overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm sm:text-base font-semibold text-stone-900">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-stone-500 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-emerald-700' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs sm:text-sm text-stone-600 leading-relaxed border-t border-stone-100 pt-3">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
