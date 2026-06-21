import { apiUrl } from '@/lib/api';
import { formatCsvCell } from '@/lib/csvExport';

export const FINANCE_EXPENSE_CATEGORIES = [
  'Products / Manufacturing',
  'Packaging',
  'QR Cards',
  'Boxes',
  'Cards',
  'Software Subscriptions',
  'Marketing',
  'Shipping / Delivery',
  'Refunds / Returns',
  'Other',
] as const;

export const FINANCE_INCOME_CATEGORIES = [
  'Capital injection',
  'Sales income',
  'Investor/partner contribution',
  'Other',
] as const;

/** @deprecated use FINANCE_EXPENSE_CATEGORIES */
export const FINANCE_CATEGORIES = FINANCE_EXPENSE_CATEGORIES;

export const EXPENSE_SUBCATEGORIES: Record<string, readonly string[]> = {
  Marketing: [
    'Social Media',
    'Ads',
    'Influencer',
    'Content shoot',
    'Other',
  ],
  'Software Subscriptions': [
    'Vercel',
    'Render',
    'Supabase',
    'Resend',
    'Domain',
    'Other',
  ],
  Packaging: ['Bags', 'Boxes', 'Cards', 'Stickers', 'Other'],
};

export type FinanceEntryType = 'income' | 'expense';

export type FinanceEntry = {
  id: string;
  type: FinanceEntryType;
  amount: number;
  currency: string;
  category: string;
  subcategory: string | null;
  note: string | null;
  entryDate: string;
  productId: string | null;
  variantId: string | null;
  customItemName: string | null;
  supplierNote: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  product: { id: string; name: string; slug: string } | null;
  variant: { id: string; size: string; color: string } | null;
};

export type FinanceSummary = {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  expensesByCategory: { category: string; amount: number }[];
  monthlyTrend: {
    month: string;
    income: number;
    expense: number;
    net: number;
  }[];
};

export type FinanceListResponse = {
  entries: FinanceEntry[];
  summary: FinanceSummary;
};

export type FinanceFilters = {
  from?: string;
  to?: string;
  type?: FinanceEntryType;
  category?: string;
  productId?: string;
};

export type CreateFinanceEntryPayload = {
  type: FinanceEntryType;
  amount: number;
  currency?: string;
  category: string;
  subcategory?: string;
  note?: string;
  entryDate: string;
  productId?: string;
  variantId?: string;
  customItemName?: string;
  supplierNote?: string;
};

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function buildQuery(filters?: FinanceFilters) {
  const params = new URLSearchParams();
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.productId) params.set('productId', filters.productId);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchAdminFinance(
  token: string,
  filters?: FinanceFilters,
): Promise<FinanceListResponse> {
  const res = await fetch(apiUrl(`/admin/finance${buildQuery(filters)}`), {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to load finance entries');
  return res.json();
}

export async function createAdminFinanceEntry(
  token: string,
  payload: CreateFinanceEntryPayload,
): Promise<FinanceEntry> {
  const res = await fetch(apiUrl('/admin/finance'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      typeof body?.message === 'string'
        ? body.message
        : 'Failed to create finance entry',
    );
  }
  return res.json();
}

export async function deleteAdminFinanceEntry(
  token: string,
  id: string,
): Promise<void> {
  const res = await fetch(apiUrl(`/admin/finance/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete finance entry');
}

export function exportFinanceCsv(
  entries: FinanceEntry[],
  filenameSuffix = new Date().toISOString().slice(0, 10),
) {
  const header = [
    'Date',
    'Type',
    'Category',
    'Subcategory',
    'Amount',
    'Currency',
    'Product',
    'Variant',
    'Custom Item',
    'Supplier Note',
    'Note',
    'Created By',
  ];

  const rows = entries.map((entry) => [
    entry.entryDate,
    entry.type,
    entry.category,
    entry.subcategory || '',
    String(entry.amount),
    entry.currency,
    entry.product?.name || entry.customItemName || '',
    entry.variant ? `${entry.variant.color} / ${entry.variant.size}` : '',
    entry.customItemName || '',
    entry.supplierNote || '',
    entry.note || '',
    entry.createdBy || '',
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(formatCsvCell).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bunnys-whisper-finance-${filenameSuffix}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export const financeInputClass =
  'mt-1 w-full rounded-xl border border-purple-900/60 bg-[#05070d] px-3 py-2.5 text-sm text-white outline-none focus:border-purple-300/60';
