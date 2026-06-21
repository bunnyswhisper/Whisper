'use client';

import { formatFinanceMoney } from '@/lib/financeHelpers';

type CategoryRow = {
  category: string;
  amount: number;
};

type FinanceCategoryBreakdownProps = {
  items: CategoryRow[];
  totalSpent: number;
};

export function FinanceCategoryBreakdown({
  items,
  totalSpent,
}: FinanceCategoryBreakdownProps) {
  if (items.length === 0 || totalSpent <= 0) {
    return (
      <p className="rounded-xl border border-purple-950/80 bg-[#05070d]/60 px-4 py-6 text-center text-sm text-gray-400">
        No category spending for this period.
      </p>
    );
  }

  const sorted = [...items].sort((a, b) => b.amount - a.amount);

  return (
    <ul className="space-y-4">
      {sorted.map((row) => {
        const pct = Math.round((row.amount / totalSpent) * 100);
        const width = Math.max(pct, 2);

        return (
          <li key={row.category}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="min-w-0 flex-1 text-sm font-medium text-white">
                {row.category}
              </span>
              <span className="shrink-0 text-sm font-bold text-purple-200">
                {formatFinanceMoney(row.amount)}
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-400">
                {pct}%
              </span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-purple-950/80"
              role="presentation"
            >
              <div
                className="h-full rounded-full bg-linear-to-r from-purple-500/90 via-fuchsia-400/75 to-purple-300/60 shadow-[0_0_12px_rgba(168,85,247,0.35)] transition-[width] duration-500 ease-out"
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
