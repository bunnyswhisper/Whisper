'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import BrandLoader from '@/components/BrandLoader';
import Navbar from '@/components/Navbar';
import { InfoPopover } from '@/components/InfoPopover';
import { PremiumEmptyState } from '@/components/empty-state';
import { VisuallyHidden } from '@/components/a11y/VisuallyHidden';
import { AsyncView, SkeletonPointsPage } from '@/components/skeleton';
import { HELP } from '@/lib/helpTips';
import { supabase } from '@/lib/supabaseClient';
import { apiUrl } from '@/lib/api';
import { friendlyCustomerMessage } from '@/lib/customerMessages';
import { shouldRefetchCustomerDataOnAuthEvent } from '@/lib/authSession';
import { formatIsoDateYmd } from '@/lib/formatIsoDate';
import {
  CustomerPointsAuthRequiredError,
  CustomerPointsFetchError,
  customerCouponsQueryKey,
  customerPointsQueryKey,
  customerPointsStaleTimeMs,
  fetchCustomerPointsMe,
  type PointsTier,
  type SavedCoupon,
} from '@/lib/customerPoints';

type CouponResult = {
  couponCode: string;
  discountPercent: number;
  pointsSpent: number;
  remainingPoints: number;
};

const milestones = [1000, 2000, 3000, 4000, 5000];

type LoyaltyTier = 'none' | 'bronze' | 'silver' | 'gold';

function loyaltyTierFromLifetime(lifetimePoints: number): LoyaltyTier {
  if (lifetimePoints >= 5000) return 'gold';
  if (lifetimePoints >= 3000) return 'silver';
  if (lifetimePoints >= 1000) return 'bronze';
  return 'none';
}

function LoyaltyTierBadge({ tier }: { tier: LoyaltyTier }) {
  if (tier === 'none') {
    return (
      <p className="relative mt-2 inline-flex items-center rounded-full border border-purple-800/60 bg-[#0d0716] px-4 py-2 text-sm font-bold text-purple-200/90">
        Member
      </p>
    );
  }

  if (tier === 'bronze') {
    return (
      <p className="relative mt-2 inline-flex items-center rounded-full border border-amber-700/50 bg-linear-to-r from-amber-950/80 to-[#1a1208] px-4 py-2 text-sm font-black tracking-wide text-amber-100 shadow-[0_0_20px_rgba(180,83,9,0.25)]">
        Bronze
      </p>
    );
  }

  if (tier === 'silver') {
    return (
      <p className="relative mt-2 inline-flex items-center rounded-full border border-slate-400/45 bg-linear-to-r from-slate-800/90 to-slate-900/90 px-4 py-2 text-sm font-black tracking-wide text-slate-100 shadow-[0_0_22px_rgba(148,163,184,0.35)]">
        Silver
      </p>
    );
  }

  return (
    <p className="relative mt-2 inline-flex items-center gap-2 overflow-visible rounded-full border border-amber-300/60 bg-linear-to-r from-amber-200 via-yellow-400 to-amber-500 px-5 py-2.5 text-sm font-black tracking-wide text-amber-950 shadow-[0_0_32px_rgba(250,204,21,0.45),0_0_60px_rgba(251,191,36,0.2)]">
      <span
        className="pointer-events-none absolute -left-0.5 -top-1 h-2 w-2 animate-ping rounded-full bg-yellow-200 opacity-70"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute right-2 top-0 h-1.5 w-1.5 rounded-full bg-white opacity-90 shadow-[0_0_8px_#fff]"
        aria-hidden
      />
      <span className="relative z-10">✦</span>
      <span className="relative z-10">Gold</span>
      <span className="relative z-10">✦</span>
    </p>
  );
}

function PointsPageContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [authLoading, setAuthLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimCode, setClaimCode] = useState('');
  const [claimMessage, setClaimMessage] = useState('');
  const [message, setMessage] = useState('');
  const [coupon, setCoupon] = useState<CouponResult | null>(null);
  const [redeemingTierPoints, setRedeemingTierPoints] = useState<number | null>(null);

  /** Blocks double-submit on Claim (rapid taps). */
  const claimInFlightRef = useRef(false);
  /** Blocks double-submit on Redeem Coupon (rapid taps). */
  const redeemInFlightRef = useRef(false);

  const pointsEnabled = !authLoading && !authRequired;

  const pointsQuery = useQuery({
    queryKey: customerPointsQueryKey,
    queryFn: fetchCustomerPointsMe,
    staleTime: customerPointsStaleTimeMs,
    enabled: pointsEnabled,
  });

  const couponsQuery = useQuery({
    queryKey: customerCouponsQueryKey,
    queryFn: async () => {
      const data = await queryClient.fetchQuery({
        queryKey: customerPointsQueryKey,
        queryFn: fetchCustomerPointsMe,
        staleTime: customerPointsStaleTimeMs,
      });
      return data.coupons;
    },
    staleTime: customerPointsStaleTimeMs,
    enabled: pointsEnabled,
  });

  async function getToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token;
  }

  async function invalidatePointsData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: customerPointsQueryKey }),
      queryClient.invalidateQueries({ queryKey: customerCouponsQueryKey }),
    ]);
  }

  async function claimPoints() {
    if (claimInFlightRef.current || claiming) return;

    setClaimMessage('');
    setMessage('');
    setCoupon(null);

    if (!claimCode.trim()) {
      setClaimMessage('Please enter a claim code.');
      return;
    }

    claimInFlightRef.current = true;
    setClaiming(true);

    try {
      const token = await getToken();

      if (!token) {
        window.location.href = `/auth?redirect=/points?code=${claimCode.trim()}`;
        return;
      }

      const res = await fetch(apiUrl('/points/claim-order'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: claimCode.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setClaimMessage(friendlyCustomerMessage(data.message));
        return;
      }

      const basePoints = Number(data.pointsEarned || 0);
      const bonusPoints = Number(data.bonusPoints || 0);
      const totalAdded = Number(data.totalPointsAdded || basePoints + bonusPoints);

      setClaimMessage(
        bonusPoints > 0
          ? `Congrats! You got ${basePoints} Bunny Points + ${bonusPoints} first order bonus points. Total added: ${totalAdded} points.`
          : `Congrats! You got ${basePoints} Bunny Points.`,
      );

      setClaimCode('');
      await invalidatePointsData();
    } finally {
      claimInFlightRef.current = false;
      setClaiming(false);
    }
  }

  async function redeemCoupon(pointsCost: number) {
    if (redeemInFlightRef.current || redeemingTierPoints !== null) return;
    redeemInFlightRef.current = true;
    setRedeemingTierPoints(pointsCost);

    setMessage('');
    setClaimMessage('');
    setCoupon(null);

    try {
      const token = await getToken();

      if (!token) {
        window.location.href = '/auth?redirect=/points';
        return;
      }

      const res = await fetch(apiUrl('/points/redeem'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pointsCost }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(friendlyCustomerMessage(data.message));
        return;
      }

      setCoupon(data);
      setMessage('Coupon created successfully. You can use it at checkout.');
      await invalidatePointsData();
    } finally {
      redeemInFlightRef.current = false;
      setRedeemingTierPoints(null);
    }
  }

  useEffect(() => {
    const codeFromQr = searchParams.get('code');

    if (codeFromQr) {
      setClaimCode(codeFromQr.trim().toUpperCase());
      setClaimMessage('QR code detected. Click Claim to receive your points.');
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      setAuthRequired(!session);
      setAuthLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!shouldRefetchCustomerDataOnAuthEvent(event)) return;

      void (async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        setAuthRequired(!session);

        if (session) {
          await invalidatePointsData();
        }
      })();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    if (pointsQuery.error instanceof CustomerPointsAuthRequiredError) {
      setAuthRequired(true);
    }
  }, [pointsQuery.error]);

  const pointsData = pointsQuery.data;
  const points = pointsData?.points ?? 0;
  const lifetimePoints = pointsData?.lifetimePoints ?? 0;
  const tiers = pointsData?.tiers ?? [];
  const savedCoupons = couponsQuery.data ?? pointsData?.coupons ?? [];

  const dataLoading = pointsEnabled && pointsQuery.isPending && pointsData === undefined;

  const fetchError =
    pointsQuery.error instanceof CustomerPointsFetchError
      ? pointsQuery.error.message
      : pointsQuery.isError && !(pointsQuery.error instanceof CustomerPointsAuthRequiredError)
        ? "Couldn't load your Bunny Points. Check your connection and try again."
        : '';

  const progressPercent = Math.min((points / 5000) * 100, 100);
  const availableTiers = tiers.filter((tier: PointsTier) => points >= tier.points);
  const nextMilestone = milestones.find((milestone) => points < milestone);
  const pointsUntilNext = nextMilestone ? nextMilestone - points : 0;
  const loyaltyTier = loyaltyTierFromLifetime(lifetimePoints);

  if (authLoading) {
    return <BrandLoader variant="overlay" message="Checking sign-in…" />;
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 text-white sm:px-6 sm:py-8 lg:py-10">
      <Navbar />

      <section className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.25em] text-purple-300 sm:text-sm sm:tracking-[0.35em]">
          Loyalty Rewards
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
            Bunny Points
          </h1>
          <InfoPopover label="Bunny Points help">{HELP.bunnyPoints}</InfoPopover>
        </div>

        {authRequired ? (
          <PremiumEmptyState
            className="mt-8"
            variant="muted"
            eyebrow="Sign in required"
            title="Unlock Bunny Points"
            description="Sign in to view your balance, claim package rewards, and redeem coupons."
            primaryAction={{ label: 'Go to Login', href: '/auth?redirect=/points' }}
          />
        ) : (
          <AsyncView loading={dataLoading} skeleton={<SkeletonPointsPage />}>
            {fetchError ? (
              <PremiumEmptyState
                variant="error"
                showMark={false}
                eyebrow="Could not load"
                title="Loyalty data unavailable"
                description={fetchError}
                primaryAction={{
                  label: 'Retry',
                  onClick: () => {
                    void pointsQuery.refetch();
                    void couponsQuery.refetch();
                  },
                }}
              />
            ) : (
          <>
            <div className="mt-8 rounded-3xl border border-purple-950 bg-[#0d0716] p-4 shadow-[0_18px_60px_rgba(168,85,247,0.18)] sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-purple-300 sm:text-sm">
                    Current Balance
                  </p>

                  <h2 className="mt-2 text-4xl font-black text-purple-300 sm:text-5xl">
                    {points} pts
                  </h2>

                  <p className="mt-2 text-sm text-gray-400 sm:text-base">
                    Lifetime earned: {lifetimePoints} pts
                  </p>
                  <LoyaltyTierBadge tier={loyaltyTier} />

                  {nextMilestone ? (
                    <p className="mt-2 text-sm text-purple-200">
                      {pointsUntilNext} pts until your next milestone.
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-green-300">
                      You reached the highest milestone.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-purple-950 bg-[#05070d] px-4 py-4 text-sm text-gray-300 sm:px-5 sm:text-base">
                  Every 100 EGP spent = 10 Bunny Points
                </div>
              </div>

              <div className="mt-8 sm:mt-10">
                <div className="relative h-4 rounded-full border border-purple-950 bg-[#05070d] sm:h-5">
                  <div
                    className="h-full rounded-full bg-purple-300 shadow-[0_0_35px_rgba(168,85,247,0.65)]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="mt-5 grid grid-cols-5 gap-2 overflow-x-auto pb-2 sm:mt-6 sm:overflow-visible sm:pb-0">
                  {milestones.map((milestone) => {
                    const unlocked = points >= milestone;

                    return (
                      <div key={milestone} className="min-w-16 text-center">
                        <div
                          className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full border text-xs font-black sm:h-14 sm:w-14 sm:text-sm ${
                            unlocked
                              ? 'border-green-300 bg-green-500/20 text-green-200 shadow-[0_0_30px_rgba(74,222,128,0.35)]'
                              : 'border-purple-950 bg-[#05070d] text-gray-500'
                          }`}
                        >
                          ✓
                        </div>

                        <p className="mt-2 text-xs font-bold text-purple-100 sm:text-sm">
                          {milestone}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-purple-950 bg-[#0d0716] p-4 sm:p-6">
              <h2 className="text-2xl font-black text-white">Claim Points</h2>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-400 sm:text-base">
                <span>Scan the QR code in your package to claim your Bunny Points.</span>
                <InfoPopover label="QR reward claim help">{HELP.qrRewardAfterDelivery}</InfoPopover>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <VisuallyHidden as="label" htmlFor="points-claim-code">
                  Package claim code
                </VisuallyHidden>
                <input
                  id="points-claim-code"
                  name="claimCode"
                  autoComplete="off"
                  value={claimCode}
                  onChange={(e) => {
                    setClaimCode(e.target.value.toUpperCase());
                    setClaimMessage('');
                  }}
                  placeholder="Enter package claim code"
                  className="min-h-14 flex-1 rounded-xl border border-purple-950 bg-[#05070d] px-4 py-4 text-white outline-none focus:border-purple-300"
                />

                <button
                  type="button"
                  onClick={() => claimPoints()}
                  disabled={claiming}
                  className="min-h-14 rounded-full border border-purple-300 bg-purple-300 px-8 py-4 font-black text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:hover:-translate-y-1"
                >
                  {claiming ? 'Claiming...' : 'Claim'}
                </button>
              </div>

              {claimMessage && (
                <div className="mt-4 rounded-2xl border border-purple-300/40 bg-purple-500/10 p-4 text-sm text-purple-100 sm:text-base">
                  {claimMessage}
                </div>
              )}
            </div>

            <div className="mt-8 rounded-3xl border border-purple-950 bg-[#0d0716] p-4 sm:p-6">
              <h2 className="text-2xl font-black text-white">Available Rewards</h2>

              <p className="mt-2 text-sm text-gray-400 sm:text-base">
                Redeem your points for discount coupons.
              </p>

              {availableTiers.length === 0 ? (
                <PremiumEmptyState
                  compact
                  className="mt-5"
                  variant="muted"
                  showMark={false}
                  eyebrow="No rewards yet"
                  title={
                    points === 0
                      ? 'No loyalty points yet.'
                      : 'Keep earning to unlock rewards.'
                  }
                  description={
                    points === 0
                      ? 'Scan the package QR after delivery or shop to start collecting Bunny Points.'
                      : 'You need at least 1000 points to redeem your first coupon.'
                  }
                  primaryAction={
                    points === 0
                      ? undefined
                      : { label: 'Shop to earn', href: '/' }
                  }
                />
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {availableTiers.map((tier) => (
                    <div key={tier.points} className="rounded-2xl border border-purple-950 bg-[#05070d] p-5">
                      <p className="text-3xl font-black text-purple-300">
                        {tier.discount}% OFF
                      </p>

                      <p className="mt-2 text-sm text-gray-400 sm:text-base">
                        Costs {tier.points} points
                      </p>

                      <button
                        type="button"
                        onClick={() => redeemCoupon(tier.points)}
                        disabled={redeemingTierPoints !== null}
                        className="mt-5 min-h-12 w-full rounded-full border border-purple-300 bg-purple-300 px-5 py-3 font-bold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {redeemingTierPoints === tier.points ? 'Creating coupon…' : 'Redeem Coupon'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 rounded-3xl border border-purple-950 bg-[#0d0716] p-4 sm:p-6">
              <h2 className="text-2xl font-black text-white">Saved Coupons</h2>

              <p className="mt-2 text-sm text-gray-400 sm:text-base">
                These are your unused coupons. Used or expired coupons will disappear automatically.
              </p>

              {savedCoupons.length === 0 ? (
                <PremiumEmptyState
                  compact
                  className="mt-5"
                  variant="muted"
                  showMark={false}
                  eyebrow="No coupons"
                  title="No saved coupons right now."
                  description="Redeem points above — your active codes will appear here until used or expired."
                />
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {savedCoupons.map((savedCoupon) => (
                    <div key={savedCoupon.id} className="rounded-2xl border border-purple-950 bg-[#05070d] p-5">
                      <p className="text-xs uppercase tracking-[0.25em] text-purple-300 sm:text-sm">
                        {savedCoupon.discount_percent}% OFF
                      </p>

                      <h3 className="mt-3 break-all text-xl font-black text-white sm:text-2xl">
                        {savedCoupon.code}
                      </h3>

                      <p className="mt-2 text-sm text-gray-400">
                        Cost: {savedCoupon.points_cost} points
                      </p>

                      {savedCoupon.expires_at && (
                        <p className="mt-1 text-xs text-yellow-200">
                          Expires: {formatIsoDateYmd(savedCoupon.expires_at)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {coupon && (
              <div className="mt-8 rounded-3xl border border-green-300/40 bg-green-500/10 p-4 sm:p-6">
                <p className="text-xs uppercase tracking-[0.25em] text-green-300 sm:text-sm">
                  New Coupon
                </p>

                <h2 className="mt-3 break-all text-2xl font-black text-white sm:text-3xl">
                  {coupon.couponCode}
                </h2>

                <p className="mt-2 text-sm text-green-100 sm:text-base">
                  Use this code at checkout for {coupon.discountPercent}% off.
                </p>

                <p className="mt-1 text-sm text-gray-400">
                  Remaining points: {coupon.remainingPoints}
                </p>
              </div>
            )}

            {message && (
              <div className="mt-8 rounded-2xl border border-purple-300/40 bg-purple-500/10 p-4 text-sm text-purple-100 sm:text-base">
                {message}
              </div>
            )}
          </>
            )}
          </AsyncView>
        )}
      </section>
    </main>
  );
}

function PointsPageSuspenseFallback() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 text-white sm:px-6 sm:py-8 lg:py-10">
      <Navbar />
      <section className="mx-auto max-w-6xl">
        <SkeletonPointsPage />
      </section>
    </main>
  );
}

export default function PointsPage() {
  return (
    <Suspense fallback={<PointsPageSuspenseFallback />}>
      <PointsPageContent />
    </Suspense>
  );
}