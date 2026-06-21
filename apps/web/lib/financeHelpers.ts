import type { FinanceEntry } from '@/lib/adminFinance';

export type FinancePeriodPreset =
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'custom';

export type WeekBreakdown = {
  label: string;
  from: string;
  to: string;
  added: number;
  spent: number;
  net: number;
  topCategories: { category: string; amount: number }[];
};

export function formatFinanceMoney(value: number) {
  return `EGP ${Number(value || 0).toFixed(2)}`;
}

export function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPeriodRange(
  preset: FinancePeriodPreset,
  customFrom?: string,
  customTo?: string,
): { from: string; to: string } {
  const today = new Date();
  const end = toIsoDate(today);

  if (preset === 'custom' && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }

  if (preset === 'this_week') {
    const start = new Date(today);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    return { from: toIsoDate(start), to: end };
  }

  if (preset === 'this_month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toIsoDate(start), to: end };
  }

  if (preset === 'last_month') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: toIsoDate(start), to: toIsoDate(lastDay) };
  }

  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: toIsoDate(start), to: end };
}

export function filterEntriesByDateRange(
  entries: FinanceEntry[],
  from?: string,
  to?: string,
) {
  return entries.filter((entry) => {
    if (from && entry.entryDate < from) return false;
    if (to && entry.entryDate > to) return false;
    return true;
  });
}

export function summarizeFinanceEntries(entries: FinanceEntry[]) {
  const totalAdded = entries
    .filter((e) => e.type === 'income')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalSpent = entries
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + e.amount, 0);

  return {
    totalAdded: Number(totalAdded.toFixed(2)),
    totalSpent: Number(totalSpent.toFixed(2)),
    netBalance: Number((totalAdded - totalSpent).toFixed(2)),
  };
}

export function getCurrentMonthStats(allEntries: FinanceEntry[]) {
  const { from, to } = getPeriodRange('this_month');
  const monthEntries = filterEntriesByDateRange(allEntries, from, to);
  const summary = summarizeFinanceEntries(monthEntries);
  return {
    currentMonthAdded: summary.totalAdded,
    currentMonthSpent: summary.totalSpent,
    currentMonthNet: summary.netBalance,
  };
}

export function getExpensesByCategory(entries: FinanceEntry[]) {
  const map = new Map<string, number>();
  for (const entry of entries) {
    if (entry.type !== 'expense') continue;
    map.set(entry.category, (map.get(entry.category) || 0) + entry.amount);
  }
  return [...map.entries()]
    .map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2)),
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function getBiggestExpenseCategory(entries: FinanceEntry[]) {
  const ranked = getExpensesByCategory(entries);
  return ranked[0]?.category || '—';
}

export function getMonthWeekRanges(year: number, monthIndex: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const monthName = new Date(year, monthIndex, 1).toLocaleString('en-US', {
    month: 'long',
  });

  const ranges = [
    { start: 1, end: 7 },
    { start: 8, end: 15 },
    { start: 16, end: 22 },
    { start: 23, end: lastDay },
  ];

  return ranges.map(({ start, end }, index) => {
    const from = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(start).padStart(2, '0')}`;
    const to = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(end).padStart(2, '0')}`;
    return {
      label: `Week ${index + 1}: ${monthName} ${start}–${end}`,
      from,
      to,
    };
  });
}

export function computeWeeklyBreakdown(
  entries: FinanceEntry[],
  year: number,
  monthIndex: number,
): WeekBreakdown[] {
  return getMonthWeekRanges(year, monthIndex).map(({ label, from, to }) => {
    const weekEntries = filterEntriesByDateRange(entries, from, to);
    const summary = summarizeFinanceEntries(weekEntries);
    return {
      label,
      from,
      to,
      added: summary.totalAdded,
      spent: summary.totalSpent,
      net: summary.netBalance,
      topCategories: getExpensesByCategory(weekEntries).slice(0, 3),
    };
  });
}

export function computeDailyTrendForMonth(
  entries: FinanceEntry[],
  year: number,
  monthIndex: number,
) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  const monthEntries = entries.filter((e) => e.entryDate.startsWith(monthKey));

  const days: { day: string; income: number; expense: number }[] = [];
  for (let d = 1; d <= lastDay; d += 1) {
    const dayKey = `${monthKey}-${String(d).padStart(2, '0')}`;
    const dayEntries = monthEntries.filter((e) => e.entryDate === dayKey);
    days.push({
      day: String(d),
      income: dayEntries
        .filter((e) => e.type === 'income')
        .reduce((s, e) => s + e.amount, 0),
      expense: dayEntries
        .filter((e) => e.type === 'expense')
        .reduce((s, e) => s + e.amount, 0),
    });
  }
  return days;
}

export function parseMonthInput(value: string): {
  year: number;
  monthIndex: number;
} {
  const [yearStr, monthStr] = value.split('-');
  return {
    year: Number(yearStr) || new Date().getFullYear(),
    monthIndex: Math.max(0, (Number(monthStr) || 1) - 1),
  };
}

export const REPORT_CATEGORY_GROUPS = [
  'Products / Manufacturing',
  'Packaging',
  'Marketing',
  'Software Subscriptions',
  'Other',
] as const;

export function groupCategoryBreakdown(entries: FinanceEntry[]) {
  const expenseEntries = entries.filter((e) => e.type === 'expense');
  const totals = new Map<string, number>();

  for (const group of REPORT_CATEGORY_GROUPS) {
    totals.set(group, 0);
  }

  for (const entry of expenseEntries) {
    let group: string = 'Other';
    const cat = entry.category;

    if (cat === 'Products / Manufacturing') {
      group = 'Products / Manufacturing';
    } else if (
      cat === 'Packaging' ||
      cat === 'QR Cards' ||
      cat === 'Boxes' ||
      cat === 'Cards'
    ) {
      group = 'Packaging';
    } else if (cat === 'Marketing') {
      group = 'Marketing';
    } else if (cat === 'Software Subscriptions') {
      group = 'Software Subscriptions';
    } else if (
      (REPORT_CATEGORY_GROUPS as readonly string[]).includes(cat)
    ) {
      group = cat;
    }

    totals.set(group, (totals.get(group) || 0) + entry.amount);
  }

  return [...totals.entries()]
    .map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2)),
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}
