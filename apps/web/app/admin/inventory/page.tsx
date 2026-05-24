'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PremiumEmptyState } from '@/components/empty-state';
import { SkeletonAdminInventoryPage } from '@/components/skeleton';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabaseClient';
import { apiUrl } from '@/lib/api';
import { interactivePressable } from '@/lib/interactivePressable';
import { resolveVariantColorHex } from '@/lib/productColor';
import AdminOnly from '@/components/AdminOnly';

type Variant = {
  id: string;
  size: string;
  color: string;
  color_hex?: string | null;
  stock_quantity: number;
  reserved_quantity?: number;
};

type Product = {
  id: string;
  name: string;
  status?: string;
  product_variants: Variant[];
};

type StockMetrics = {
  sizes: Variant[];
  totalStock: number;
  hasOutOfStockSize: boolean;
  fullyOutOfStock: boolean;
  lowStock: boolean;
};

type InventoryColorGroup = StockMetrics & {
  colorKey: string;
  color: string;
  color_hex: string;
};

type InventoryProductGroup = StockMetrics & {
  productId: string;
  productName: string;
  colors: InventoryColorGroup[];
  colorCount: number;
};

const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

function sizeRank(size: string) {
  const index = sizeOrder.indexOf(size.toUpperCase());
  return index === -1 ? 999 : index;
}

function computeStockMetrics(variants: Variant[]): StockMetrics {
  const sizes = [...variants].sort((a, b) => sizeRank(a.size) - sizeRank(b.size));
  const totalStock = sizes.reduce(
    (sum, item) => sum + Number(item.stock_quantity || 0),
    0,
  );
  const hasOutOfStockSize = sizes.some(
    (item) => Number(item.stock_quantity || 0) <= 0,
  );
  const fullyOutOfStock =
    sizes.length > 0 &&
    sizes.every((item) => Number(item.stock_quantity || 0) <= 0);
  const lowStock = sizes.some((item) => {
    const stock = Number(item.stock_quantity || 0);
    return stock > 0 && stock <= 5;
  });

  return {
    sizes,
    totalStock,
    hasOutOfStockSize,
    fullyOutOfStock,
    lowStock,
  };
}

function stockSeverity(metrics: StockMetrics) {
  if (metrics.fullyOutOfStock) return 0;
  if (metrics.hasOutOfStockSize) return 1;
  if (metrics.lowStock) return 2;
  return 3;
}

function compareByStockUrgency<T extends StockMetrics>(a: T, b: T) {
  const diff = stockSeverity(a) - stockSeverity(b);
  if (diff !== 0) return diff;
  return 0;
}

function getStatusBadge(metrics: StockMetrics) {
  if (metrics.fullyOutOfStock) {
    return {
      label: 'Out of Stock',
      className: 'border-red-300 bg-red-500/25 text-red-100',
    };
  }

  if (metrics.hasOutOfStockSize) {
    return {
      label: 'Size Out',
      className: 'border-red-300 bg-red-500/20 text-red-100',
    };
  }

  if (metrics.lowStock) {
    return {
      label: 'Low Stock',
      className: 'border-yellow-300 bg-yellow-500/20 text-yellow-100',
    };
  }

  return {
    label: 'Good',
    className: 'border-green-300 bg-green-500/15 text-green-100',
  };
}

const inventoryCardShell =
  'border-purple-950/90 bg-[#0d0716]';

const inventoryPanelShell =
  'rounded-2xl border border-purple-950/80 bg-[#0b0612]/90 p-4';

function getStockPillClass(stock: number) {
  if (stock <= 0) {
    return 'border-red-300 bg-red-500/25 text-red-100';
  }

  if (stock <= 5) {
    return 'border-yellow-300 bg-yellow-500/20 text-yellow-100';
  }

  return 'border-purple-300/30 bg-purple-500/10 text-purple-100';
}

function buildColorGroups(variants: Variant[]): InventoryColorGroup[] {
  const byColor = new Map<string, Variant[]>();
  const colorOrder: string[] = [];

  for (const variant of variants) {
    const color = variant.color?.trim() || 'Default';
    const colorKey = color.toLowerCase();

    if (!byColor.has(colorKey)) {
      byColor.set(colorKey, []);
      colorOrder.push(colorKey);
    }
    byColor.get(colorKey)!.push(variant);
  }

  return colorOrder
    .map((colorKey) => {
      const colorVariants = byColor.get(colorKey)!;
      const color = colorVariants[0]?.color?.trim() || 'Default';
      const lead = colorVariants[0];
      const metrics = computeStockMetrics(colorVariants);

      return {
        colorKey,
        color,
        color_hex: resolveVariantColorHex(color, lead?.color_hex),
        ...metrics,
      };
    })
    .sort((a, b) => {
      const urgency = compareByStockUrgency(a, b);
      if (urgency !== 0) return urgency;
      return a.color.localeCompare(b.color);
    });
}

function buildProductGroups(products: Product[]): InventoryProductGroup[] {
  const groups: InventoryProductGroup[] = [];

  for (const product of products) {
    const variants = product.product_variants ?? [];
    if (!variants.length) continue;

    const colors = buildColorGroups(variants);
    const allSizes = colors.flatMap((color) => color.sizes);
    const productMetrics = computeStockMetrics(allSizes);

    groups.push({
      productId: product.id,
      productName: product.name,
      colors,
      colorCount: colors.length,
      ...productMetrics,
    });
  }

  return groups.sort((a, b) => {
    const urgency = compareByStockUrgency(a, b);
    if (urgency !== 0) return urgency;
    return a.productName.localeCompare(b.productName);
  });
}

function pickDefaultColorKey(colors: InventoryColorGroup[]) {
  return colors[0]?.colorKey ?? '';
}

function StatusBadge({ metrics }: { metrics: StockMetrics }) {
  const status = getStatusBadge(metrics);

  return (
    <span
      className={`flex h-8 min-w-[6.5rem] shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-2 text-center text-[10px] font-black uppercase tracking-[0.12em] sm:h-[32px] sm:min-w-[7.5rem] sm:text-[10px] ${status.className}`}
    >
      {status.label}
    </span>
  );
}

export default function InventoryPage() {
  const [products, setProducts] = useState<InventoryProductGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  const summary = useMemo(() => {
    const allVariants = products.flatMap((product) =>
      product.colors.flatMap((color) => color.sizes),
    );

    return {
      products: products.length,
      colorGroups: products.reduce((sum, product) => sum + product.colorCount, 0),
      variants: allVariants.length,
      outSizes: allVariants.filter(
        (variant) => Number(variant.stock_quantity || 0) <= 0,
      ).length,
      lowSizes: allVariants.filter((variant) => {
        const stock = Number(variant.stock_quantity || 0);
        return stock > 0 && stock <= 5;
      }).length,
      goodSizes: allVariants.filter(
        (variant) => Number(variant.stock_quantity || 0) > 5,
      ).length,
    };
  }, [products]);

  async function switchAccount() {
    await supabase.auth.signOut();
    window.location.href = '/auth?redirect=/admin/inventory';
  }

  async function checkAdmin(token: string) {
    try {
      const res = await fetch(apiUrl('/auth/me'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      return Boolean(res.ok && data.isAdmin);
    } catch {
      return false;
    }
  }

  async function loadInventory() {
    try {
      setLoading(true);
      setUnauthorized(false);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setUnauthorized(true);
        return;
      }

      const isAdmin = await checkAdmin(session.access_token);

      if (!isAdmin) {
        setUnauthorized(true);
        return;
      }

      const res = await fetch(apiUrl('/products/admin/all'), {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });

      if (!res.ok) {
        setProducts([]);
        return;
      }

      const catalog: Product[] = await res.json();
      const activeProducts = Array.isArray(catalog)
        ? catalog.filter((product) => String(product.status).toLowerCase() === 'active')
        : [];
      setProducts(buildProductGroups(activeProducts));
    } catch {
      setUnauthorized(true);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadInventory();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AdminOnly>
      <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] py-5 text-white sm:px-6 sm:py-8 lg:py-10">
        <Navbar />

        <section className="mx-auto max-w-6xl">
          <div className="mb-6 sm:mb-8">
            <p className="text-xs uppercase tracking-[0.25em] text-red-300 sm:text-sm sm:tracking-[0.35em]">
              Admin Control
            </p>

            <h1 className="mt-3 bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
              Inventory Checker
            </h1>

            <p className="mt-3 text-sm text-gray-400 sm:text-base">
              Each product appears once. Pick a color to inspect sizes. Red means a
              size is out. Yellow means low stock.
            </p>
          </div>

          {loading ? (
            <SkeletonAdminInventoryPage />
          ) : unauthorized ? (
            <div className="mx-auto mt-14 max-w-2xl rounded-3xl border border-red-400/40 bg-[#12050a]/90 p-6 text-center shadow-[0_0_70px_rgba(248,113,113,0.18)] sm:p-10">
              <p className="text-xs uppercase tracking-[0.25em] text-red-300 sm:text-sm sm:tracking-[0.35em]">
                Admin Access Required
              </p>

              <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">
                You are not an admin
              </h2>

              <p className="mt-4 text-base text-red-100 sm:text-lg">
                Please login with an admin account.
              </p>

              <button
                type="button"
                onClick={switchAccount}
                className={`mt-8 min-h-12 rounded-full border border-purple-300 bg-purple-300 px-8 py-3 font-bold text-black hover:bg-white ${interactivePressable}`}
              >
                Switch Account
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <SummaryCard label="Products" value={summary.products} />
                <SummaryCard
                  label="Color Groups"
                  value={summary.colorGroups}
                />
                <SummaryCard
                  label="Out Sizes"
                  value={summary.outSizes}
                  type="red"
                />
                <SummaryCard
                  label="Low Sizes"
                  value={summary.lowSizes}
                  type="yellow"
                />
                <SummaryCard
                  label="Good Sizes"
                  value={summary.goodSizes}
                  type="green"
                />
              </div>

              {products.length === 0 ? (
                <PremiumEmptyState
                  variant="muted"
                  eyebrow="Inventory"
                  title="No products to show."
                  description="Active products with variants will appear here once catalog data is available."
                  primaryAction={{
                    label: 'Manage Products',
                    href: '/admin/products',
                  }}
                />
              ) : (
                <div className="space-y-4">
                  {products.map((product) => (
                    <ProductInventoryCard
                      key={product.productId}
                      product={product}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </AdminOnly>
  );
}

function SummaryCard({
  label,
  value,
  type = 'purple',
}: {
  label: string;
  value: number;
  type?: 'purple' | 'red' | 'yellow' | 'green';
}) {
  const classes =
    type === 'red'
      ? 'border-red-300/40 bg-red-500/10 text-red-200'
      : type === 'yellow'
        ? 'border-yellow-300/40 bg-yellow-500/10 text-yellow-100'
        : type === 'green'
          ? 'border-green-300/40 bg-green-500/10 text-green-200'
          : 'border-purple-950 bg-[#0d0716] text-purple-300';

  return (
    <div className={`rounded-2xl border p-4 ${classes}`}>
      <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

const editStockClass = `inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-purple-300/50 bg-purple-500/15 px-3 text-xs font-bold text-purple-100 hover:border-purple-300 hover:bg-purple-500/25 sm:h-10 sm:px-4 sm:text-sm ${interactivePressable}`;

function ProductInventoryCard({ product }: { product: InventoryProductGroup }) {
  const [selectedColorKey, setSelectedColorKey] = useState(() =>
    pickDefaultColorKey(product.colors),
  );

  useEffect(() => {
    setSelectedColorKey(pickDefaultColorKey(product.colors));
  }, [product.productId]);

  const activeColor =
    product.colors.find((color) => color.colorKey === selectedColorKey) ??
    product.colors[0];

  const useColorDropdown = product.colors.length > 8;

  return (
    <article
      className={`overflow-hidden rounded-3xl border shadow-[0_18px_50px_rgba(168,85,247,0.12)] ${inventoryCardShell}`}
    >
      <header className="flex flex-col gap-4 border-b border-purple-950/80 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-5">
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-lg font-bold text-white sm:text-xl">
            {product.productName}
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Total stock: {product.totalStock} · {product.colorCount}{' '}
            {product.colorCount === 1 ? 'color' : 'colors'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <StatusBadge metrics={product} />
          <Link
            href={`/admin/products?productId=${encodeURIComponent(product.productId)}`}
            className={editStockClass}
          >
            Edit / Update Stock
          </Link>
        </div>
      </header>

      <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
        {useColorDropdown ? (
          <label className="block sm:hidden">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-purple-300">
              Color
            </span>
            <select
              value={selectedColorKey}
              onChange={(event) => setSelectedColorKey(event.target.value)}
              className="w-full rounded-xl border border-purple-950 bg-[#12091f] px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-purple-300"
            >
              {product.colors.map((color) => (
                <option key={color.colorKey} value={color.colorKey}>
                  {color.color} ({color.totalStock})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div
          className={`flex flex-wrap gap-2 ${useColorDropdown ? 'hidden sm:flex' : 'flex'} [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-nowrap sm:overflow-x-auto sm:pb-1 [&::-webkit-scrollbar]:hidden`}
          role="tablist"
          aria-label={`${product.productName} colors`}
        >
          {product.colors.map((color) => {
            const selected = color.colorKey === selectedColorKey;
            const colorStatus = getStatusBadge(color);

            return (
              <button
                key={color.colorKey}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setSelectedColorKey(color.colorKey)}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-left text-sm font-semibold transition ${interactivePressable} ${
                  selected
                    ? 'border-purple-300/80 bg-[#12091f] text-white shadow-[0_0_22px_rgba(168,85,247,0.4)] ring-1 ring-purple-300/40'
                    : 'border-purple-950/90 bg-[#0b0612] text-purple-100 hover:border-purple-400/50'
                }`}
              >
                <ColorSwatch hex={color.color_hex} label={color.color} />
                <span className="whitespace-nowrap">{color.color}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ${colorStatus.className}`}
                >
                  {colorStatus.label}
                </span>
              </button>
            );
          })}
        </div>

        {useColorDropdown ? (
          <label className="hidden sm:block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-purple-300">
              Jump to color
            </span>
            <select
              value={selectedColorKey}
              onChange={(event) => setSelectedColorKey(event.target.value)}
              className="max-w-xs rounded-xl border border-purple-950 bg-[#12091f] px-3 py-2 text-sm font-semibold text-white outline-none focus:border-purple-300"
            >
              {product.colors.map((color) => (
                <option key={color.colorKey} value={color.colorKey}>
                  {color.color}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {activeColor ? (
          <section
            role="tabpanel"
            className={inventoryPanelShell}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <ColorSwatch hex={activeColor.color_hex} label={activeColor.color} size="lg" />
                <div>
                  <p className="font-bold text-white">{activeColor.color}</p>
                  <p className="text-sm text-gray-400">
                    Color total: {activeColor.totalStock}
                  </p>
                </div>
              </div>
              <StatusBadge metrics={activeColor} />
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-purple-300">
                Stock by Size
              </p>
              <StockPills sizes={activeColor.sizes} />
            </div>
          </section>
        ) : null}
      </div>
    </article>
  );
}

function ColorSwatch({
  hex,
  label,
  size = 'md',
}: {
  hex: string;
  label: string;
  size?: 'md' | 'lg';
}) {
  const dim = size === 'lg' ? 'h-7 w-7' : 'h-5 w-5';

  return (
    <span
      className={`inline-block shrink-0 rounded-full border border-white/25 shadow-inner ${dim}`}
      style={{ backgroundColor: hex }}
      aria-hidden
      title={label}
    />
  );
}

function StockPills({ sizes }: { sizes: Variant[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {sizes.map((item) => {
        const stock = Number(item.stock_quantity || 0);
        const reserved = Number(item.reserved_quantity || 0);

        return (
          <span
            key={item.id}
            className={`inline-flex h-11 min-h-11 min-w-[4.75rem] shrink-0 items-center justify-center rounded-full border px-2 text-center text-xs font-bold leading-none tabular-nums sm:min-w-[5.25rem] sm:px-2.5 sm:text-sm ${getStockPillClass(
              stock,
            )}`}
          >
            {item.size}: {stock}
            {reserved > 0 ? ` · R:${reserved}` : ''}
          </span>
        );
      })}
    </div>
  );
}
