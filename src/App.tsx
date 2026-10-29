/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/common/Toast.tsx';
import { ClientHomePage } from './pages/ClientHomePage.tsx';
import { BookPage } from './pages/BookPage.tsx';
import { MyAppointmentsPage } from './pages/MyAppointmentsPage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { TestsPage } from './pages/TestsPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { getRepository } from './lib/repository/index.ts';
import { seedInitialData } from './lib/seed.ts';

export default function App() {
  useEffect(() => {
    // Run guarded initial seed on app mount
    const repo = getRepository();
    seedInitialData(repo).catch((err) => {
      console.warn('Initial seed failed:', err);
    });
  }, []);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Client Routes */}
          <Route path="/" element={<ClientHomePage />} />
          <Route path="/book" element={<BookPage />} />
          <Route path="/appointments" element={<MyAppointmentsPage />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/dashboard" element={<AdminPage />} />

          {/* Verification Suite */}
          <Route path="/tests" element={<TestsPage />} />

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
