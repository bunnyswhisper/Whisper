'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { interactivePressable } from '@/lib/interactivePressable';
import { shouldRefetchCustomerDataOnAuthEvent } from '@/lib/authSession';
import { supabase } from '@/lib/supabaseClient';
import {
  CustomerWishlistFetchError,
  customerWishlistIdsQueryKey,
  customerWishlistQueryKey,
  customerWishlistStaleTimeMs,
  fetchCustomerWishlistIds,
  toggleCustomerWishlist,
  type WishlistToggleResult,
} from '@/lib/customerWishlist';
import { customerPointsQueryKey } from '@/lib/customerPoints';
import { useWishlistGuestPrompt } from '@/components/wishlist/WishlistGuestPromptModal';
import { useWishlistFirstReward } from '@/components/wishlist/WishlistFirstRewardModal';

type HeartWishlistButtonProps = {
  productId: string;
  redirectPath?: string;
  className?: string;
  /** card = homepage catalog image; detail = product info panel; inline = compact lists */
  variant?: 'card' | 'detail' | 'inline';
};

const variantStyles = {
  card: {
    tap: 'min-h-11 min-w-11 p-1',
    icon: 'h-8 w-8 sm:h-9 sm:w-9',
  },
  detail: {
    tap: 'min-h-11 min-w-11 p-0.5',
    icon: 'h-10 w-10 sm:h-11 sm:w-11',
  },
  inline: {
    tap: 'min-h-10 min-w-10 p-1',
    icon: 'h-7 w-7 sm:h-8 sm:w-8',
  },
} as const;

function HeartIcon({ filled, loading }: { filled: boolean; loading?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`h-full w-full transition duration-200 ${
        loading ? 'animate-pulse opacity-60' : ''
      } ${
        filled
          ? 'fill-purple-300 text-purple-300 drop-shadow-[0_0_16px_rgba(216,180,254,0.8)]'
          : 'fill-transparent text-fuchsia-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]'
      }`}
    >
      <path
        stroke="currentColor"
        strokeWidth={filled ? 0 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 20.5s-7.2-4.6-9.2-8.8C1.2 8.4 3.4 5 6.8 5c1.9 0 3.2 1 3.2 1s1.3-1 3.2-1c3.4 0 5.6 3.4 4 6.7-2 4.2-9.2 8.8-9.2 8.8z"
      />
    </svg>
  );
}

function shouldShowFirstWishlistReward(result: WishlistToggleResult): boolean {
  return (
    result.wishlisted === true &&
    result.firstWishlistRewardGranted === true &&
    Number(result.pointsAwarded) > 0
  );
}

export function HeartWishlistButton({
  productId,
  redirectPath: redirectPathProp,
  className = '',
  variant = 'card',
}: HeartWishlistButtonProps) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { openGuestPrompt } = useWishlistGuestPrompt();
  const { openFirstWishlistReward } = useWishlistFirstReward();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const styles = variantStyles[variant];

  useEffect(() => {
    let mounted = true;

    async function syncSession() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setIsLoggedIn(Boolean(data.session?.access_token));
    }

    void syncSession();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!shouldRefetchCustomerDataOnAuthEvent(event)) return;
      void syncSession();
      if (event === 'SIGNED_IN') {
        void queryClient.invalidateQueries({ queryKey: customerWishlistIdsQueryKey });
      }
      if (event === 'SIGNED_OUT') {
        queryClient.setQueryData(customerWishlistIdsQueryKey, []);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const { data: wishlistIds = [] } = useQuery({
    queryKey: customerWishlistIdsQueryKey,
    queryFn: fetchCustomerWishlistIds,
    staleTime: customerWishlistStaleTimeMs,
    enabled: isLoggedIn === true,
    retry: false,
  });

  const isWishlisted = isLoggedIn === true && wishlistIds.includes(productId);

  const toggleMutation = useMutation({
    mutationFn: () => toggleCustomerWishlist(productId),
    onMutate: async () => {
      setErrorMessage('');
      await queryClient.cancelQueries({ queryKey: customerWishlistIdsQueryKey });
      const previous = queryClient.getQueryData<string[]>(
        customerWishlistIdsQueryKey,
      );
      const next = isWishlisted
        ? (previous || []).filter((id) => id !== productId)
        : [...(previous || []), productId];
      queryClient.setQueryData(customerWishlistIdsQueryKey, next);
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          customerWishlistIdsQueryKey,
          context.previous,
        );
      }
      setErrorMessage(
        error instanceof CustomerWishlistFetchError
          ? error.message
          : 'Could not update wishlist. Please try again.',
      );
      window.setTimeout(() => setErrorMessage(''), 3500);
    },
    onSuccess: (result) => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console -- dev wishlist reward diagnostics
        console.debug('[wishlist] toggle response', {
          productId,
          wishlisted: result.wishlisted,
          firstWishlistRewardGranted: result.firstWishlistRewardGranted,
          pointsAwarded: result.pointsAwarded,
          pointsBalance: result.pointsBalance,
        });
      }

      queryClient.setQueryData(
        customerWishlistIdsQueryKey,
        (current: string[] | undefined) => {
          const ids = current || [];
          if (result.wishlisted) {
            return ids.includes(productId) ? ids : [...ids, productId];
          }
          return ids.filter((id) => id !== productId);
        },
      );
      void queryClient.invalidateQueries({ queryKey: customerWishlistQueryKey });
      void queryClient.invalidateQueries({ queryKey: customerPointsQueryKey });

      if (shouldShowFirstWishlistReward(result)) {
        openFirstWishlistReward();
      }
    },
  });

  const redirectPath = redirectPathProp || pathname || '/';

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (isLoggedIn !== true) {
      openGuestPrompt(redirectPath);
      return;
    }

    toggleMutation.mutate();
  }

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        aria-pressed={isWishlisted}
        disabled={toggleMutation.isPending}
        onClick={handleClick}
        className={`inline-flex items-center justify-center bg-transparent transition duration-200 ${styles.tap} ${interactivePressable} ${
          isWishlisted ? 'scale-105 hover:scale-110' : 'hover:scale-110'
        } ${toggleMutation.isPending ? 'cursor-wait opacity-70' : 'active:scale-95'}`}
      >
        <span className={styles.icon}>
          <HeartIcon filled={isWishlisted} loading={toggleMutation.isPending} />
        </span>
      </button>

      {errorMessage ? (
        <div
          role="alert"
          className="pointer-events-none absolute bottom-[calc(100%+0.35rem)] right-0 z-40 w-max max-w-52 rounded-xl border border-red-400/30 bg-[#1a0a10]/95 px-3 py-2 text-right text-[11px] font-medium text-red-100 shadow-lg"
        >
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
