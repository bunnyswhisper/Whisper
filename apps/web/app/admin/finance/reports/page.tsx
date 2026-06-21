'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import AdminOnly from '@/components/AdminOnly';
import { MetricCard } from '@/components/admin/MetricCard';
import { AnalyticsChartFrame } from '@/components/admin/AnalyticsChartFrame';
import { FinanceCategoryBreakdown } from '@/components/admin/finance/FinanceCategoryBreakdown';
import {
  exportFinanceCsv,
  fetchAdminFinance,
  type FinanceEntry,
} from '@/lib/adminFinance';
import {
  computeDailyTrendForMonth,
  computeWeeklyBreakdown,
  filterEntriesByDateRange,
  formatFinanceMoney,
  getBiggestExpenseCategory,
  getExpensesByCategory,
  groupCategoryBreakdown,
  parseMonthInput,
  summarizeFinanceEntries,
} from '@/lib/financeHelpers';
import { supabase } from '@/lib/supabaseClient';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function monthInputDefault() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function AdminFinanceReportsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [monthInput, setMonthInput] = useState(monthInputDefault);
  const [categoryFilter, setCategoryFilter] = useState('');

  const { year, monthIndex } = useMemo(
    () => parseMonthInput(monthInput),
    [monthInput],
  );

  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  const monthStart = `${monthKey}-01`;
  const monthEnd = `${monthKey}-${String(new Date(year, monthIndex + 1, 0).getDate()).padStart(2, '0')}`;

  const monthEntries = useMemo(() => {
    let rows = filterEntriesByDateRange(entries, monthStart, monthEnd);
    if (categoryFilter) {
      rows = rows.filter((e) => e.category === categoryFilter);
    }
    return rows;
  }, [entries, monthStart, monthEnd, categoryFilter]);

  const summary = useMemo(
    () => summarizeFinanceEntries(monthEntries),
    [monthEntries],
  );

  const weeklyBreakdown = useMemo(
    () => computeWeeklyBreakdown(monthEntries, year, monthIndex),
    [monthEntries, year, monthIndex],
  );

  const dailyTrend = useMemo(
    () => computeDailyTrendForMonth(monthEntries, year, monthIndex),
    [monthEntries, year, monthIndex],
  );

  const categoryBreakdown = useMemo(
    () => groupCategoryBreakdown(monthEntries),
    [monthEntries],
  );

  const expenseCategories = useMemo(
    () => getExpensesByCategory(monthEntries),
    [monthEntries],
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
        const res = await fetchAdminFinance(accessToken, {
          from: monthStart,
          to: monthEnd,
        });
        setEntries(res.entries);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [monthStart, monthEnd]);

  function handleExportCsv() {
    exportFinanceCsv(monthEntries, `${monthKey}`);
  }

  return (
    <AdminOnly>
      <main className="min-h-screen bg-[#07030d] px-4 py-8 text-white sm:px-6">
        <Navbar />

        <section className="mx-auto max-w-6xl space-y-8">
          <header>
            <Link
              href="/admin/finance"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-300/70 hover:text-purple-200"
            >
              ← Back to Finance Tracker
            </Link>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">Finance Reports</h1>
            <p className="mt-2 text-sm text-gray-400">
              Monthly overview, weekly breakdown, and category performance.
            </p>
          </header>

          {error ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <div className="rounded-2xl border border-purple-950 bg-[#0b0f1a] p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="min-w-[10rem] text-xs uppercase tracking-[0.16em] text-purple-300/70">
                  Month
                  <input
                    type="month"
                    value={monthInput}
                    onChange={(e) => setMonthInput(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-purple-900/60 bg-[#05070d] px-3 py-2.5 text-sm text-white"
                  />
                </label>
                <label className="min-w-[10rem] flex-1 text-xs uppercase tracking-[0.16em] text-purple-300/70 sm:max-w-xs">
                  Category (optional)
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-purple-900/60 bg-[#05070d] px-3 py-2.5 text-sm text-white"
                  >
                    <option value="">All</option>
                    {expenseCategories.map((row) => (
                      <option key={row.category} value={row.category}>
                        {row.category}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="min-h-11 flex-1 rounded-xl border border-purple-300/40 bg-purple-500/10 px-4 py-2.5 text-sm font-bold text-purple-100 transition hover:bg-purple-500/20 sm:flex-none"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  disabled
                  title="PDF export coming soon"
                  className="min-h-11 flex-1 cursor-not-allowed rounded-xl border border-purple-900/60 bg-[#05070d] px-4 py-2.5 text-sm font-semibold text-gray-500 opacity-70 sm:flex-none"
                >
                  PDF soon
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400">Loading report data…</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="Total added"
                  value={formatFinanceMoney(summary.totalAdded)}
                  glow
                />
                <MetricCard
                  title="Total spent"
                  value={formatFinanceMoney(summary.totalSpent)}
                />
                <MetricCard title="Net" value={formatFinanceMoney(summary.netBalance)} />
                <MetricCard
                  title="Biggest expense"
                  value={getBiggestExpenseCategory(monthEntries)}
                  detail={formatFinanceMoney(
                    getExpensesByCategory(monthEntries)[0]?.amount || 0,
                  )}
                />
              </div>

              <div className="rounded-2xl border border-purple-950 bg-[#0b0f1a] p-4">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-purple-300/80">
                  Income vs expense — {monthInput}
                </h2>
                <AnalyticsChartFrame>
                  <LineChart data={dailyTrend}>
                    <CartesianGrid stroke="#312e81" strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fill: '#c4b5fd', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#c4b5fd', fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="income"
                      name="Added"
                      stroke="#86efac"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="expense"
                      name="Spent"
                      stroke="#f87171"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </AnalyticsChartFrame>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-purple-300/80">
                  Weekly breakdown
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {weeklyBreakdown.map((week) => (
                    <div
                      key={week.label}
                      className="rounded-2xl border border-purple-950 bg-[#0b0f1a] p-4"
                    >
                      <p className="text-sm font-bold text-white">{week.label}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-gray-500">Added</p>
                          <p className="font-bold text-green-300">
                            {formatFinanceMoney(week.added)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Spent</p>
                          <p className="font-bold text-red-300">
                            {formatFinanceMoney(week.spent)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Net</p>
                          <p className="font-bold text-purple-200">
                            {formatFinanceMoney(week.net)}
                          </p>
                        </div>
                      </div>
                      {week.topCategories.length > 0 ? (
                        <p className="mt-3 text-[11px] text-gray-400">
                          Top:{' '}
                          {week.topCategories
                            .map((c) => `${c.category} (${formatFinanceMoney(c.amount)})`)
                            .join(' · ')}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-purple-950 bg-[#0b0f1a] p-4 sm:p-5">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-purple-300/80">
                  Category breakdown
                </h2>
                <FinanceCategoryBreakdown
                  items={categoryBreakdown}
                  totalSpent={summary.totalSpent}
                />
              </div>

              <div className="rounded-2xl border border-purple-950 bg-[#0b0f1a] p-4">
                <h2 className="mb-3 text-sm font-bold text-purple-100">
                  Entries ({monthEntries.length})
                </h2>
                {monthEntries.length === 0 ? (
                  <p className="text-sm text-gray-400">No entries for this month.</p>
                ) : (
                  <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
                    {monthEntries.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-purple-950 bg-[#05070d] px-3 py-2"
                      >
                        <span className="truncate text-gray-300">
                          {entry.entryDate} · {entry.category}
                          {entry.subcategory ? ` · ${entry.subcategory}` : ''}
                        </span>
                        <span
                          className={`shrink-0 font-bold ${
                            entry.type === 'income' ? 'text-green-300' : 'text-red-300'
                          }`}
                        >
                          {entry.type === 'income' ? '+' : '-'}
                          {formatFinanceMoney(entry.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </AdminOnly>
  );
}
