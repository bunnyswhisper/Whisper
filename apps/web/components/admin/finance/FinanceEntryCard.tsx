'use client';

import { useState } from 'react';
import type { FinanceEntry } from '@/lib/adminFinance';
import { formatFinanceMoney } from '@/lib/financeHelpers';

type FinanceEntryCardProps = {
  entry: FinanceEntry;
  onDelete: (id: string) => void;
};

export function FinanceEntryCard({ entry, onDelete }: FinanceEntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isIncome = entry.type === 'income';

  return (
    <li className="rounded-xl border border-purple-950 bg-[#05070d] p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
                isIncome
                  ? 'bg-green-500/15 text-green-300'
                  : 'bg-red-500/15 text-red-300'
              }`}
            >
              {isIncome ? 'Added' : 'Spent'}
            </span>
            <p className="truncate text-sm font-bold text-white">{entry.category}</p>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {entry.entryDate}
            {entry.subcategory ? ` · ${entry.subcategory}` : ''}
          </p>
          {entry.note ? (
            <p className="mt-1 line-clamp-1 text-xs text-gray-300">{entry.note}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`text-sm font-black ${
              isIncome ? 'text-green-300' : 'text-red-300'
            }`}
          >
            {isIncome ? '+' : '-'}
            {formatFinanceMoney(entry.amount)}
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] font-semibold text-purple-300/90 hover:text-purple-200"
            >
              {expanded ? 'Hide' : 'Details'}
            </button>
            <button
              type="button"
              onClick={() => onDelete(entry.id)}
              className="text-[11px] font-semibold text-red-300/80 hover:text-red-200"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {expanded ? (
        <dl className="mt-3 grid gap-2 border-t border-purple-950/80 pt-3 text-xs text-gray-300 sm:grid-cols-2">
          {entry.product?.name ? (
            <div>
              <dt className="text-gray-500">Product</dt>
              <dd className="font-medium text-white">{entry.product.name}</dd>
            </div>
          ) : null}
          {entry.variant ? (
            <div>
              <dt className="text-gray-500">Variant</dt>
              <dd className="font-medium text-white">
                {entry.variant.color} / {entry.variant.size}
              </dd>
            </div>
          ) : null}
          {entry.customItemName ? (
            <div>
              <dt className="text-gray-500">Item</dt>
              <dd>{entry.customItemName}</dd>
            </div>
          ) : null}
          {entry.supplierNote ? (
            <div className="sm:col-span-2">
              <dt className="text-gray-500">Supplier / manufacturer</dt>
              <dd>{entry.supplierNote}</dd>
            </div>
          ) : null}
          {entry.note ? (
            <div className="sm:col-span-2">
              <dt className="text-gray-500">Note</dt>
              <dd>{entry.note}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </li>
  );
}
