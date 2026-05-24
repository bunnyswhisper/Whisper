'use client';

import Link from 'next/link';
import { InternalNavLink } from '@/components/navigation/InternalNavLink';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { apiUrl } from '@/lib/api';
import {
  getSafeSession,
  shouldRefetchCustomerDataOnAuthEvent,
} from '@/lib/authSession';
import { prepareCartForLogout, readCart } from '@/lib/cartStorage';
import { CART_CHANGED_EVENT } from '@/lib/cartSync';

type UserInfo = {
  name: string;
  email: string;
};

function NavRevealLink({
  href,
  label,
  isActive,
  icon,
  badge,
}: {
  href: string;
  label: string;
  isActive: boolean;
  icon: ReactNode;
  badge?: number;
}) {
  const base =
    'group relative inline-flex h-10 min-h-10 min-w-10 shrink-0 items-center justify-center overflow-visible rounded-full border border-purple-300/20 bg-[#12091f]/80 px-2 py-2 text-sm font-bold text-purple-200 backdrop-blur transition-all duration-200 ease-out hover:gap-2 hover:-translate-y-0.5 hover:bg-purple-300 hover:text-black hover:shadow-[0_0_24px_rgba(216,180,254,0.18)] active:translate-y-px active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/70 focus-visible:gap-2 sm:h-11 sm:min-h-11 sm:min-w-0 sm:px-3.5';

  const active = isActive
    ? ' border-purple-300 bg-purple-300 text-black shadow-[0_0_25px_rgba(168,85,247,0.4)]'
    : '';

  return (
    <InternalNavLink href={href} aria-label={label} className={`${base}${active}`}>
      <span className="flex size-5 shrink-0 items-center justify-center [&>svg]:size-5">
        {icon}
      </span>
      <span
        className="inline-block max-w-0 -translate-x-1 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover:max-w-20 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:max-w-20 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
        aria-hidden
      >
        {label}
      </span>
      {badge != null && badge > 0 ? (
        <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-purple-300 px-1 text-[10px] font-black leading-none text-black ring-2 ring-[#12091f]">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </InternalNavLink>
  );
}

function getUserInfo(session: any): UserInfo | null {
  if (!session?.user) return null;

  return {
    name:
      session.user.user_metadata?.full_name ||
      session.user.user_metadata?.name ||
      'Account',
    email: session.user.email?.trim().toLowerCase() || '',
  };
}

export default function Navbar() {
  const pathname = usePathname();
  const accountMenuId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const navPill =
    'relative inline-flex min-h-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-purple-300/20 bg-[#12091f]/80 px-3 text-xs font-bold text-purple-200 backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-purple-300 hover:text-black hover:shadow-[0_0_24px_rgba(216,180,254,0.18)] active:translate-y-px active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/70 sm:min-h-11 sm:px-4 sm:text-sm';

  const activeNavPill =
    'border-purple-300 bg-purple-300 text-black shadow-[0_0_25px_rgba(168,85,247,0.4)]';

  const menuLink =
    'flex min-h-12 w-full items-center justify-center rounded-2xl border border-purple-300/20 bg-purple-500/10 px-4 py-3.5 text-center font-bold text-purple-100 transition hover:bg-purple-300 hover:text-black';

  const adminMenuLink =
    'flex min-h-12 w-full items-center justify-center rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3.5 text-center font-bold text-red-100 transition hover:bg-red-300 hover:text-black';

  async function applyAuthSession(session: { user: unknown; access_token: string } | null) {
    setUser(getUserInfo(session));

    if (!session?.access_token) {
      setIsAdmin(false);
      return;
    }

    try {
      const res = await fetch(apiUrl('/auth/me'), {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      setIsAdmin(Boolean(res.ok && data?.isAdmin));
    } catch {
      setIsAdmin(false);
    }
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    void getSafeSession().then((session) => {
      void applyAuthSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || shouldRefetchCustomerDataOnAuthEvent(event)) {
        void applyAuthSession(session);
      }
      if (shouldRefetchCustomerDataOnAuthEvent(event)) {
        setOpen(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    function loadCart() {
      const cart = readCart();
      const count = cart.reduce(
        (sum: number, item: any) => sum + Number(item.quantity || 0),
        0,
      );
      setCartCount(count);
    }

    loadCart();
    window.addEventListener('storage', loadCart);
    window.addEventListener(CART_CHANGED_EVENT, loadCart);

    return () => {
      window.removeEventListener('storage', loadCart);
      window.removeEventListener(CART_CHANGED_EVENT, loadCart);
    };
  }, [mounted]);

  useEffect(() => {
    function handlePointerOutside(event: PointerEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  async function logout() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    prepareCartForLogout(session?.user?.id ?? null);
    await supabase.auth.signOut();
    setOpen(false);
    window.location.href = '/';
  }

  const navShellPad =
    'px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]';

  const dropTop =
    'top-[max(5.25rem,calc(env(safe-area-inset-top,0px)+4.85rem))]';

  return (
    <nav
      className={`relative z-[99999] mx-auto mb-6 max-w-6xl pt-[max(0.25rem,env(safe-area-inset-top))] ${navShellPad} sm:px-6`}
    >
      <div className="relative z-[99999] grid min-h-[3.25rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-0.5 rounded-full border border-purple-300/20 bg-[#12091f]/95 py-2 pl-1.5 pr-1.5 backdrop-blur-xl shadow-[0_18px_70px_rgba(168,85,247,0.18)] sm:min-h-[3.5rem] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-x-2 sm:px-3 sm:py-3">
        <div className="relative z-20 flex min-w-0 items-center justify-start">
          <NavRevealLink
            href="/"
            label="Home"
            isActive={pathname === '/'}
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5z" />
              </svg>
            }
          />
        </div>

        <div className="relative z-20 flex min-w-0 justify-center justify-self-center px-0.5 sm:max-w-none sm:px-0">
          <Link
            href="/"
            title="Bunny's Whisper"
            className="block max-w-[min(34vw,9.5rem)] truncate text-center text-[9px] font-black leading-tight tracking-[0.05em] text-transparent bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text sm:max-w-none sm:text-xl sm:leading-none sm:tracking-[0.2em]"
          >
            BUNNY&apos;S WHISPER
          </Link>
        </div>

        <div className="relative z-20 flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          {mounted && isAdmin && (
            <span
              className="hidden shrink-0 rounded-full border border-red-500/70 bg-red-600/30 px-2.5 py-1 text-[10px] font-black uppercase leading-none tracking-wide text-red-100 shadow-[0_0_12px_rgba(248,113,113,0.35)] ring-1 ring-red-400/50 md:inline-flex"
              title="Administrator"
            >
              Admin
            </span>
          )}

          {mounted && (
            <NavRevealLink
              href="/cart"
              label="Cart"
              isActive={pathname === '/cart'}
              badge={cartCount}
              icon={
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="9" cy="20" r="1.5" fill="currentColor" stroke="none" />
                  <circle cx="17" cy="20" r="1.5" fill="currentColor" stroke="none" />
                  <path d="M3 4h2l1.2 9.6a2 2 0 0 0 2 1.4h8.6a2 2 0 0 0 2-1.6L19 7H6" />
                </svg>
              }
            />
          )}

          {!mounted || !user ? (
            <Link
              href="/auth"
              className={`${navPill} shrink-0 ${pathname === '/auth' ? activeNavPill : ''}`}
            >
              Login
            </Link>
          ) : (
            <div ref={menuRef} className="relative shrink-0">
              {mounted && isAdmin && (
                <span
                  className="pointer-events-none absolute -right-0.5 -top-1 z-10 rounded-full border border-red-400/90 bg-red-600 px-1.5 py-0.5 text-[7px] font-black uppercase leading-none tracking-wide text-white shadow-[0_0_10px_rgba(248,113,113,0.45)] ring-1 ring-[#12091f] md:hidden"
                  title="Administrator"
                  aria-hidden
                >
                  ADMIN
                </span>
              )}
              <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                aria-expanded={open}
                aria-haspopup="menu"
                aria-controls={accountMenuId}
                aria-label={
                  isAdmin
                    ? `Account menu for ${user.name}, admin`
                    : `Account menu for ${user.name}`
                }
                className={`relative flex size-10 min-h-10 min-w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition sm:size-11 sm:min-h-11 sm:min-w-11 ${
                  open
                    ? 'border-purple-300 bg-purple-300 text-black shadow-[0_0_35px_rgba(168,85,247,0.65)]'
                    : 'border-purple-300/60 bg-[#12091f] text-purple-200 hover:bg-purple-300 hover:text-black'
                } ${isAdmin ? 'ring-2 ring-red-500/40 ring-offset-2 ring-offset-[#12091f]' : ''}`}
              >
                <span className="leading-none" aria-hidden>
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </button>

              {open && (
                <div
                  id={accountMenuId}
                  role="menu"
                  aria-label="Account navigation"
                  className={`fixed ${dropTop} z-[999999] flex max-h-[min(82dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2.5rem))] w-auto flex-col overflow-hidden overscroll-contain rounded-3xl border border-purple-300/40 bg-[#090411] shadow-[0_25px_120px_rgba(0,0,0,0.95)] left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:max-h-[min(80vh,32rem)] sm:w-80 sm:translate-x-0`}
                >
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <div className="mb-4 border-b border-purple-900/60 pb-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.25em] text-purple-300">
                          Signed in
                        </p>

                        {isAdmin && (
                          <span className="shrink-0 rounded-full border border-red-400/70 bg-red-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-red-200">
                            Admin
                          </span>
                        )}
                      </div>

                      <p className="mt-3 font-semibold text-white">{user.name}</p>
                      <p className="mt-1 break-all text-xs leading-relaxed text-gray-400">{user.email}</p>
                    </div>

                    <div className="flex flex-col gap-2.5 text-sm">
                      {isAdmin ? (
                        <>
                          <InternalNavLink onClick={() => setOpen(false)} href="/admin/orders" className={adminMenuLink}>
                            Admin Orders
                          </InternalNavLink>
                          <InternalNavLink onClick={() => setOpen(false)} href="/admin/inventory" className={adminMenuLink}>
                            Inventory Checker
                          </InternalNavLink>
                          <InternalNavLink onClick={() => setOpen(false)} href="/admin/products" className={adminMenuLink}>
                            Add/Edit Products
                          </InternalNavLink>
                          <InternalNavLink onClick={() => setOpen(false)} href="/admin/analytics" className={adminMenuLink}>
                            Analytics
                          </InternalNavLink>
                          <InternalNavLink onClick={() => setOpen(false)} href="/admin/reviews" className={adminMenuLink}>
                            Reviews
                          </InternalNavLink>
                          <InternalNavLink onClick={() => setOpen(false)} href="/admin/events-qr" className={adminMenuLink}>
                            Events QR
                          </InternalNavLink>
                        </>
                      ) : (
                        <>
                          <InternalNavLink onClick={() => setOpen(false)} href="/account/orders" className={menuLink}>
                            My Orders
                          </InternalNavLink>
                        </>
                      )}

                      <InternalNavLink onClick={() => setOpen(false)} href="/account" className={menuLink}>
                        Account
                      </InternalNavLink>

                      <InternalNavLink onClick={() => setOpen(false)} href="/points" className={menuLink}>
                        Points
                      </InternalNavLink>

                      <button
                        type="button"
                        onClick={logout}
                        className="block w-full min-h-12 rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3.5 text-center font-bold text-red-200 transition hover:bg-red-300 hover:text-black"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
