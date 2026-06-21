'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import AdminOnly from '@/components/AdminOnly';
import {
  createAdminFinanceEntry,
  EXPENSE_SUBCATEGORIES,
  FINANCE_EXPENSE_CATEGORIES,
  FINANCE_INCOME_CATEGORIES,
  financeInputClass,
  type FinanceEntryType,
} from '@/lib/adminFinance';
import { apiUrl } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';

type AdminProduct = {
  id: string;
  name: string;
  product_variants?: { id: string; size: string; color: string }[];
};

function FinanceNewForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entryType: FinanceEntryType =
    searchParams.get('type') === 'income' ? 'income' : 'expense';

  const [token, setToken] = useState<string | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [category, setCategory] = useState<string>(
    entryType === 'income'
      ? FINANCE_INCOME_CATEGORIES[0]
      : FINANCE_EXPENSE_CATEGORIES[0],
  );
  const [customCategory, setCustomCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [customSubcategory, setCustomSubcategory] = useState('');
  const [productId, setProductId] = useState('');
  const [variantScope, setVariantScope] = useState<'all' | 'specific'>('all');
  const [variantId, setVariantId] = useState('');
  const [supplierNote, setSupplierNote] = useState('');
  const [note, setNote] = useState('');

  const isIncome = entryType === 'income';
  const subcategoryOptions = EXPENSE_SUBCATEGORIES[category] || [];
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) || null,
    [products, productId],
  );

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token ?? null;
      setToken(accessToken);
      if (!accessToken) return;

      try {
        const res = await fetch(apiUrl('/products/admin/all'), {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        if (res.ok) {
          const productData = await res.json();
          setProducts(Array.isArray(productData) ? productData : []);
        }
      } catch {
        // Products optional for non-manufacturing expenses
      }
    }

    void init();
  }, []);

  useEffect(() => {
    setCategory(
      isIncome ? FINANCE_INCOME_CATEGORIES[0] : FINANCE_EXPENSE_CATEGORIES[0],
    );
    setSubcategory('');
    setCustomSubcategory('');
    setProductId('');
    setVariantId('');
    setVariantScope('all');
  }, [isIncome]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }

    const resolvedCategory =
      category === 'Other' && customCategory.trim()
        ? customCategory.trim().slice(0, 120)
        : category;

    const resolvedSubcategory =
      subcategory === 'Other' && customSubcategory.trim()
        ? customSubcategory.trim().slice(0, 120)
        : subcategory || undefined;

    setSaving(true);
    setError('');

    try {
      await createAdminFinanceEntry(token, {
        type: entryType,
        amount: parsedAmount,
        currency: 'EGP',
        category: resolvedCategory,
        subcategory: resolvedSubcategory,
        note: note.trim().slice(0, 2000) || undefined,
        entryDate,
        productId:
          !isIncome && category === 'Products / Manufacturing' && productId
            ? productId
            : undefined,
        variantId:
          !isIncome &&
          category === 'Products / Manufacturing' &&
          variantScope === 'specific' &&
          variantId
            ? variantId
            : undefined,
        supplierNote: supplierNote.trim().slice(0, 500) || undefined,
      });

      router.push('/admin/finance');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminOnly>
      <main className="min-h-screen bg-[#07030d] px-4 py-8 text-white sm:px-6">
        <Navbar />

        <section className="mx-auto max-w-xl space-y-6">
          <header>
            <Link
              href="/admin/finance"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-300/70 hover:text-purple-200"
            >
              ← Back to Finance Tracker
            </Link>
            <h1 className="mt-3 text-2xl font-black sm:text-3xl">
              {isIncome ? 'Add Money' : 'Subtract Money'}
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              {isIncome
                ? 'Record capital or income added to the business.'
                : 'Record what capital was spent on — guided step by step.'}
            </p>
          </header>

          {error ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-2xl border border-purple-950 bg-[#0b0f1a] p-4 sm:p-6"
          >
            {!isIncome ? (
              <div className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-purple-300/80">
                  Step 1 · What did we spend on?
                </h2>
                <label className="block text-xs uppercase tracking-[0.16em] text-purple-300/70">
                  Category
                  <select
                    required
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setSubcategory('');
                      setCustomSubcategory('');
                      setProductId('');
                      setVariantId('');
                    }}
                    className={financeInputClass}
                  >
                    {FINANCE_EXPENSE_CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                {category === 'Other' ? (
                  <label className="block text-xs uppercase tracking-[0.16em] text-purple-300/70">
                    Custom category
                    <input
                      required
                      maxLength={120}
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className={financeInputClass}
                    />
                  </label>
                ) : null}

                {subcategoryOptions.length > 0 ? (
                  <label className="block text-xs uppercase tracking-[0.16em] text-purple-300/70">
                    Subcategory
                    <select
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      className={financeInputClass}
                    >
                      <option value="">Select subcategory (optional)</option>
                      {subcategoryOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {subcategory === 'Other' ? (
                  <label className="block text-xs uppercase tracking-[0.16em] text-purple-300/70">
                    Custom subcategory
                    <input
                      maxLength={120}
                      value={customSubcategory}
                      onChange={(e) => setCustomSubcategory(e.target.value)}
                      className={financeInputClass}
                    />
                  </label>
                ) : null}
              </div>
            ) : (
              <>
                <label className="block text-xs uppercase tracking-[0.16em] text-purple-300/70">
                  Source / category
                  <select
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={financeInputClass}
                  >
                    {FINANCE_INCOME_CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                {category === 'Other' ? (
                  <label className="block text-xs uppercase tracking-[0.16em] text-purple-300/70">
                    Custom category
                    <input
                      required
                      maxLength={120}
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className={financeInputClass}
                    />
                  </label>
                ) : null}
              </>
            )}

            {!isIncome && category === 'Products / Manufacturing' ? (
              <div className="space-y-4 border-t border-purple-950 pt-5">
                <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-purple-300/80">
                  Step 2 · Product details
                </h2>
                <label className="block text-xs uppercase tracking-[0.16em] text-purple-300/70">
                  Product
                  <select
                    value={productId}
                    onChange={(e) => {
                      setProductId(e.target.value);
                      setVariantId('');
                      setVariantScope('all');
                    }}
                    className={financeInputClass}
                  >
                    <option value="">All products</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedProduct?.product_variants?.length ? (
                  <>
                    <fieldset className="space-y-2">
                      <legend className="text-xs uppercase tracking-[0.16em] text-purple-300/70">
                        Size / variant scope
                      </legend>
                      <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="radio"
                          name="variantScope"
                          checked={variantScope === 'all'}
                          onChange={() => {
                            setVariantScope('all');
                            setVariantId('');
                          }}
                        />
                        All sizes / variants
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="radio"
                          name="variantScope"
                          checked={variantScope === 'specific'}
                          onChange={() => setVariantScope('specific')}
                        />
                        Specific size / variant
                      </label>
                    </fieldset>

                    {variantScope === 'specific' ? (
                      <label className="block text-xs uppercase tracking-[0.16em] text-purple-300/70">
                        Variant
                        <select
                          required
                          value={variantId}
                          onChange={(e) => setVariantId(e.target.value)}
                          className={financeInputClass}
                        >
                          <option value="">Select variant</option>
                          {selectedProduct.product_variants.map((variant) => (
                            <option key={variant.id} value={variant.id}>
                              {variant.color} / {variant.size}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-4 border-t border-purple-950 pt-5">
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-purple-300/80">
                {isIncome ? 'Amount & date' : 'Step 3 · Amount & details'}
              </h2>

              <label className="block text-xs uppercase tracking-[0.16em] text-purple-300/70">
                Amount (EGP)
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={financeInputClass}
                />
              </label>

              <label className="block text-xs uppercase tracking-[0.16em] text-purple-300/70">
                Date
                <input
                  required
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className={financeInputClass}
                />
              </label>

              {!isIncome ? (
                <label className="block text-xs uppercase tracking-[0.16em] text-purple-300/70">
                  Supplier / manufacturer note (optional)
                  <input
                    maxLength={500}
                    value={supplierNote}
                    onChange={(e) => setSupplierNote(e.target.value)}
                    className={financeInputClass}
                  />
                </label>
              ) : null}

              <label className="block text-xs uppercase tracking-[0.16em] text-purple-300/70">
                Note (optional)
                <textarea
                  maxLength={2000}
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={financeInputClass}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className={`min-h-12 w-full rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-60 ${
                isIncome
                  ? 'border-green-400/40 bg-green-500/15 text-green-100'
                  : 'border-red-400/40 bg-red-500/15 text-red-100'
              }`}
            >
              {saving ? 'Saving…' : isIncome ? 'Save income' : 'Save expense'}
            </button>
          </form>
        </section>
      </main>
    </AdminOnly>
  );
}

export default function FinanceNewPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#07030d] px-6 py-10 text-purple-200">
          Loading…
        </main>
      }
    >
      <FinanceNewForm />
    </Suspense>
  );
}
