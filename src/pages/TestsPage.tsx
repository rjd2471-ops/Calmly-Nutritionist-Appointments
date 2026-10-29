/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, RefreshCw, Shield, ArrowLeft } from 'lucide-react';
import { runAllPureTests, TestResult } from '../lib/tests/pureTests.ts';

export const TestsPage: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    let metaRobots = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    if (!metaRobots) {
      metaRobots = document.createElement('meta');
      metaRobots.name = 'robots';
      document.head.appendChild(metaRobots);
    }
    metaRobots.content = 'noindex, nofollow';

    executeTests();

    return () => {
      metaRobots.content = 'index, follow';
    };
  }, []);

  const executeTests = async () => {
    setIsRunning(true);
    try {
      const data = await runAllPureTests();
      setResults(data);
    } finally {
      setIsRunning(false);
    }
  };

  const categories = ['all', ...Array.from(new Set(results.map((r) => r.category)))];

  const filteredResults = filterCategory === 'all'
    ? results
    : results.filter((r) => r.category === filterCategory);

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return (
    <div className="min-h-[100dvh] bg-stone-100 text-stone-900 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-stone-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-serif font-bold text-xl text-stone-900">
                Calmly Verification Suite
              </span>
              <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-semibold">
                Pure Test Runner (/tests)
              </span>
            </div>
            <p className="text-xs text-stone-500">
              In-browser execution of domain normalizers, slot generation, IST timezone rules, and database invariants.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isRunning}
              onClick={executeTests}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'Running tests...' : 'Re-run all tests'}</span>
            </button>
          </div>
        </div>

        {/* Results Banner */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-stone-200 text-center">
            <span className="text-[11px] font-medium text-stone-500 block uppercase">Total Tests</span>
            <span className="text-2xl font-bold font-mono text-stone-900 mt-1 block">
              {results.length}
            </span>
          </div>

          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 text-center">
            <span className="text-[11px] font-medium text-emerald-800 block uppercase">Passed</span>
            <span className="text-2xl font-bold font-mono text-emerald-700 mt-1 block">
              {passedCount}
            </span>
          </div>

          <div
            className={`p-4 rounded-2xl border text-center ${
              failedCount > 0 ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-stone-50 border-stone-200 text-stone-400'
            }`}
          >
            <span className="text-[11px] font-medium block uppercase">Failed</span>
            <span className={`text-2xl font-bold font-mono mt-1 block ${failedCount > 0 ? 'text-rose-700' : 'text-stone-400'}`}>
              {failedCount}
            </span>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                filterCategory === cat
                  ? 'bg-stone-900 text-white border-stone-900 font-semibold'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              {cat === 'all' ? 'All Categories' : cat}
            </button>
          ))}
        </div>

        {/* Test Cards Feed */}
        <div className="space-y-3">
          {filteredResults.map((t) => (
            <div
              key={t.id}
              className={`p-4 rounded-2xl border transition-all ${
                t.passed
                  ? 'bg-white border-stone-200/90 shadow-xs'
                  : 'bg-rose-50 border-rose-300 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {t.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-stone-900">{t.name}</span>
                      <span className="text-[10px] text-stone-400 font-mono">({t.category})</span>
                    </div>
                    {t.error ? (
                      <p className="text-xs font-mono text-rose-700 mt-2 bg-rose-100/70 p-2 rounded-lg">
                        Error: {t.error}
                      </p>
                    ) : (
                      <p className="text-[11px] text-stone-500 mt-0.5">{t.message}</p>
                    )}
                  </div>
                </div>

                <span className="text-[10px] font-mono text-stone-400 shrink-0">
                  {t.durationMs}ms
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
