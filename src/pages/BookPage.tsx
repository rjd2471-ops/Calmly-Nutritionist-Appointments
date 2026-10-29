/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Header } from '../components/common/Header.tsx';
import { BottomNav } from '../components/common/BottomNav.tsx';
import { DemoBanner } from '../components/common/DemoBanner.tsx';
import { BookingWizard } from '../components/client/BookingWizard.tsx';
import { AssistantChat } from '../components/client/AssistantChat.tsx';

export const BookPage: React.FC = () => {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-stone-50 text-stone-800">
      <DemoBanner />
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pb-24 md:pb-16">
        <BookingWizard />
      </main>

      <BottomNav />
      <AssistantChat />
    </div>
  );
};
