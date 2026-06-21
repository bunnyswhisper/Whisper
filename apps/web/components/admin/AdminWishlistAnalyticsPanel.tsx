'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  fetchAdminWishlistAnalytics,
  type WishlistAnalytics,
} from '@/lib/adminWishlistAnalytics';
import { MetricCard } from '@/components/admin/MetricCard';
import { AnalyticsChartFrame } from '@/components/admin/AnalyticsChartFrame';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CHART_AXIS = { fill: '#c4b5fd', fontSize: 11 };
const CHART_GRID = { stroke: '#312e81', strokeDasharray: '3 3' };

export function AdminWishlistAnalyticsPanel() {
  const [data, setData] = useState<WishlistAnalytics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Admin session required');
        const analytics = await fetchAdminWishlistAnalytics(token);
        if (mounted) setData(analytics);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to load wishlist analytics',
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-purple-950 bg-[#0b0f1a]"
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
        {error || 'Wishlist analytics unavailable'}
      </div>
    );
  }

  const chartData = data.topWishlistedProducts.slice(0, 8).map((entry) => ({
    name:
      entry.product?.name?.slice(0, 18) ||
      entry.productId.slice(0, 8),
    count: entry.wishlistCount,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total wishlists" value={String(data.totalWishlists)} />
        <MetricCard title="Unique products" value={String(data.uniqueProducts)} />
        <MetricCard title="Unique customers" value={String(data.uniqueCustomers)} />
        <MetricCard
          title="Top product saves"
          value={String(data.topWishlistedProducts[0]?.wishlistCount ?? 0)}
        />
      </div>

      <AnalyticsChartFrame>
        <BarChart data={chartData}>
          <CartesianGrid {...CHART_GRID} />
          <XAxis dataKey="name" tick={CHART_AXIS} />
          <YAxis tick={CHART_AXIS} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#c084fc" radius={[6, 6, 0, 0]} />
        </BarChart>
      </AnalyticsChartFrame>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-purple-950 bg-[#0b0f1a] p-4">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-purple-300/80">
            Recent wishlist activity
          </h3>
          <ul className="space-y-2 text-sm text-gray-300">
            {data.recentActivity.slice(0, 10).map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 border-b border-purple-950/80 py-2 last:border-0"
              >
                <span className="truncate">
                  {row.product?.name || row.productId.slice(0, 8)}
                </span>
                <span className="shrink-0 text-xs text-purple-300/70">
                  {new Date(row.createdAt).toLocaleDateString('en-GB')}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-purple-950 bg-[#0b0f1a] p-4">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-purple-300/80">
            Wishlist vs units sold
          </h3>
          <ul className="space-y-2 text-sm text-gray-300">
            {data.conversionInsights.map((row) => (
              <li
                key={row.productId}
                className="flex items-center justify-between gap-3 border-b border-purple-950/80 py-2 last:border-0"
              >
                <span className="truncate">{row.productName}</span>
                <span className="shrink-0 text-xs text-purple-200">
                  {row.wishlistCount} saves · {row.unitsSold} sold
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
