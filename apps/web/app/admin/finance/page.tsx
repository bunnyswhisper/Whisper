'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import AdminOnly from '@/components/AdminOnly';
import { MetricCard } from '@/components/admin/MetricCard';
import { FinanceEntryCard } from '@/components/admin/finance/FinanceEntryCard';
import {
  deleteAdminFinanceEntry,
  fetchAdminFinance,
  FINANCE_EXPENSE_CATEGORIES,
  type FinanceEntry,
} from '@/lib/adminFinance';
import {
  filterEntriesByDateRange,
  formatFinanceMoney,
  getCurrentMonthStats,
  getPeriodRange,
  summarizeFinanceEntries,
  type FinancePeriodPreset,
} from '@/lib/financeHelpers';
import { supabase } from '@/lib/supabaseClient';

const PERIOD_OPTIONS: { value: FinancePeriodPreset; label: string }[] = [
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom', label: 'Custom range' },
];

export default function AdminFinanceDashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [allEntries, setAllEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<FinancePeriodPreset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeRange = useMemo(
    () => getPeriodRange(period, customFrom || undefined, customTo || undefined),
    [period, customFrom, customTo],
  );

  const filteredEntries = useMemo(() => {
    let rows = filterEntriesByDateRange(allEntries, activeRange.from, activeRange.to);
    if (categoryFilter) {
      rows = rows.filter((e) => e.category === categoryFilter);
    }
    return rows;
  }, [allEntries, activeRange, categoryFilter]);

  const periodSummary = useMemo(
    () => summarizeFinanceEntries(filteredEntries),
    [filteredEntries],
  );

  const monthStats = useMemo(
    () => getCurrentMonthStats(allEntries),
    [allEntries],
  );

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token ?? null;
      setToken(accessToken);
      if (!accessToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetchAdminFinance(accessToken);
        setAllEntries(res.entries);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load finance data');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function handleDelete(id: string) {
    if (!token) return;
    if (!window.confirm('Delete this finance entry?')) return;
    try {
      await deleteAdminFinanceEntry(token, id);
      const res = await fetchAdminFinance(token);
      setAllEntries(res.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    }
  }

  return (
    <AdminOnly>
      <main className="min-h-screen bg-[#07030d] px-4 py-8 text-white sm:px-6">
        <Navbar />

        <section className="mx-auto max-w-5xl space-y-8">
          <header>
            <p className="text-xs font-medium uppercase tracking-[0.32em] text-purple-300/80">
              Admin
            </p>
            <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">
              Finance Tracker
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">
              Track Bunny&apos;s Whisper capital, expenses, and monthly performance.
            </p>
          </header>

          {error ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/admin/finance/new?type=income"
              className="flex min-h-16 items-center justify-center rounded-2xl border border-green-400/30 bg-green-500/10 px-6 py-4 text-center text-base font-black text-green-100 shadow-[0_0_30px_rgba(74,222,128,0.12)] transition hover:bg-green-500/20"
            >
              + Add Money
            </Link>
            <Link
              href="/admin/finance/new?type=expense"
              className="flex min-h-16 items-center justify-center rounded-2xl border border-red-400/30 bg-red-500/10 px-6 py-4 text-center text-base font-black text-red-100 shadow-[0_0_30px_rgba(248,113,113,0.12)] transition hover:bg-red-500/20"
            >
              − Subtract Money
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Total added"
              value={formatFinanceMoney(periodSummary.totalAdded)}
              glow
            />
            <MetricCard
              title="Total spent"
              value={formatFinanceMoney(periodSummary.totalSpent)}
            />
            <MetricCard
              title="Net balance"
              value={formatFinanceMoney(periodSummary.netBalance)}
            />
            <MetricCard
              title="Current month spent"
              value={formatFinanceMoney(monthStats.currentMonthSpent)}
            />
            <MetricCard
              title="Current month net"
              value={formatFinanceMoney(monthStats.currentMonthNet)}
            />
          </div>

          <div className="rounded-2xl border border-purple-950 bg-[#0b0f1a] p-4 sm:p-5">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[10rem] flex-1 text-xs uppercase tracking-[0.16em] text-purple-300/70">
                Period
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as FinancePeriodPreset)}
                  className="mt-1 w-full rounded-xl border border-purple-900/60 bg-[#05070d] px-3 py-2.5 text-sm text-white"
                >
                  {PERIOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {period === 'custom' ? (
                <>
                  <label className="min-w-[9rem] flex-1 text-xs uppercase tracking-[0.16em] text-purple-300/70">
                    From
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-purple-900/60 bg-[#05070d] px-3 py-2.5 text-sm text-white"
                    />
                  </label>
                  <label className="min-w-[9rem] flex-1 text-xs uppercase tracking-[0.16em] text-purple-300/70">
                    To
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-purple-900/60 bg-[#05070d] px-3 py-2.5 text-sm text-white"
                    />
                  </label>
                </>
              ) : null}

              <Link
                href="/admin/finance/reports"
                className="min-h-11 shrink-0 rounded-xl border border-purple-300/40 bg-purple-500/10 px-4 py-2.5 text-sm font-bold text-purple-100 transition hover:bg-purple-500/20"
              >
                View reports
              </Link>
            </div>

            <div className="mt-4 border-t border-purple-950/60 pt-3">
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-300/90 transition hover:text-purple-200"
              >
                View filters
                <span
                  aria-hidden
                  className={`inline-block text-[10px] transition-transform duration-200 ${
                    filtersOpen ? 'rotate-180' : ''
                  }`}
                >
                  ▼
                </span>
              </button>

              {filtersOpen ? (
                <div className="mt-3 rounded-xl border border-purple-950/80 bg-[#05070d]/50 p-3 sm:p-4">
                  <label className="block text-xs uppercase tracking-[0.16em] text-purple-300/70">
                    Category
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-purple-900/60 bg-[#05070d] px-3 py-2.5 text-sm text-white"
                    >
                      <option value="">All categories</option>
                      {FINANCE_EXPENSE_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="mt-2 text-xs text-gray-500">
                    {activeRange.from} → {activeRange.to}
                    {categoryFilter ? ` · ${categoryFilter}` : ''}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-purple-950 bg-[#0b0f1a] p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-purple-100">Recent entries</h2>
              <p className="text-xs text-gray-500">{filteredEntries.length} in period</p>
            </div>

            {loading ? (
              <p className="text-sm text-gray-400">Loading finance entries…</p>
            ) : filteredEntries.length === 0 ? (
              <p className="text-sm text-gray-400">
                No entries in this period. Add money or subtract an expense to get started.
              </p>
            ) : (
              <ul className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
                {filteredEntries.slice(0, 50).map((entry) => (
                  <FinanceEntryCard
                    key={entry.id}
                    entry={entry}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </AdminOnly>
  );
}
