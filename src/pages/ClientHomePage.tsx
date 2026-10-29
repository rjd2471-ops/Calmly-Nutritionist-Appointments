/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../components/common/Header.tsx';
import { BottomNav } from '../components/common/BottomNav.tsx';
import { DemoBanner } from '../components/common/DemoBanner.tsx';
import { Hero } from '../components/client/Hero.tsx';
import { NextAppointmentCard } from '../components/client/NextAppointmentCard.tsx';
import { MeetNutritionist } from '../components/client/MeetNutritionist.tsx';
import { WhatToExpect } from '../components/client/WhatToExpect.tsx';
import { ClinicGallery } from '../components/client/ClinicGallery.tsx';
import { Testimonials } from '../components/client/Testimonials.tsx';
import { FaqAccordion } from '../components/client/FaqAccordion.tsx';
import { AssistantChat } from '../components/client/AssistantChat.tsx';

export const ClientHomePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const confirmId = searchParams.get('confirm');

  return (
    <div className="min-h-[100dvh] flex flex-col bg-stone-50 text-stone-800">
      <DemoBanner />
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 space-y-4 pb-24 md:pb-16">
        {/* Next appointment card pinned at top of content */}
        <div className="pt-6">
          <NextAppointmentCard confirmIdFromUrl={confirmId} />
        </div>

        <Hero />
        <MeetNutritionist />
        <WhatToExpect />
        <ClinicGallery />
        <Testimonials />
        <FaqAccordion />
      </main>

      <footer className="bg-stone-100 border-t border-stone-200/80 py-8 px-4 text-center text-xs text-stone-500 mb-16 md:mb-0">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Calmly Wellness &amp; Nutrition. All rights reserved.</p>
          <p className="text-[11px] text-stone-400">
            Registered Dietitian practice · Indiranagar, Bengaluru
          </p>
        </div>
      </footer>

      <BottomNav />
      <AssistantChat />
    </div>
  );
};
