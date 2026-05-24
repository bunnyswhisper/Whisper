'use client';

import Link from 'next/link';
import { Fragment, useEffect, useId, useState } from 'react';
import { prepareCartForLogout } from '@/lib/cartStorage';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';

type UserInfo = {
  name: string;
  email: string;
};

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

export default function HomeActions() {
  const accountMenuId = useId();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  async function loadUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    setUser(getUserInfo(session));

    if (!session) {
      setIsAdmin(false);
      setAuthLoaded(true);
      return;
    }

    try {
      const res = await fetch(apiUrl('/auth/me'), {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();
      setIsAdmin(Boolean(res.ok && data.isAdmin));
    } catch {
      setIsAdmin(false);
    }

    setAuthLoaded(true);
  }

  useEffect(() => {
    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser();
      setOpen(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function logout() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    prepareCartForLogout(session?.user?.id ?? null);
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setOpen(false);
    window.location.href = '/';
  }

  const adminButton =
    'block rounded-full border border-red-300/30 bg-red-500/10 px-5 py-4 text-center text-sm font-bold text-red-100 transition hover:-translate-y-1 hover:bg-red-300 hover:text-black sm:text-base';

  const userButton =
    'block rounded-full border border-purple-300/30 bg-purple-500/10 px-5 py-4 text-center text-sm font-semibold text-purple-100 transition hover:-translate-y-1 hover:bg-purple-300 hover:text-black sm:text-base';

  return (
    <div className="relative mb-6 flex flex-wrap justify-end gap-3 sm:gap-4">
      {authLoaded && isAdmin && (
        <span className="flex h-11 items-center justify-center rounded-full border border-red-400/70 bg-red-500/15 px-4 text-xs font-black uppercase tracking-[0.18em] text-red-200 shadow-[0_0_30px_rgba(248,113,113,0.35)] sm:px-5 sm:text-sm">
          Admin
        </span>
      )}

      {authLoaded && !isAdmin && (
        <Link
          href="/cart"
          className="flex h-11 min-w-24 items-center justify-center rounded-full border border-purple-300/60 bg-[#12091f]/70 px-5 text-sm font-bold text-purple-200 transition hover:-translate-y-1 hover:bg-purple-300 hover:text-black sm:min-w-32 sm:px-6"
        >
          Cart
        </Link>
      )}

      {!user ? (
        <Link
          href="/auth"
          className="flex h-11 min-w-24 items-center justify-center rounded-full border border-purple-300/60 bg-[#12091f]/70 px-5 text-sm font-semibold text-purple-200 transition hover:-translate-y-1 hover:bg-purple-300 hover:text-black sm:px-6"
        >
          Login
        </Link>
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-controls={accountMenuId}
            aria-label={`Account menu for ${user.name}`}
            className={`flex h-11 w-11 items-center justify-center rounded-full border font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/70 ${
              open
                ? 'border-fuchsia-300 bg-purple-300 text-black shadow-[0_0_40px_rgba(168,85,247,0.8)]'
                : 'border-purple-300/60 bg-[#12091f]/70 text-purple-200 hover:-translate-y-1 hover:bg-purple-300 hover:text-black'
            }`}
          >
            <span aria-hidden>{user.name.charAt(0).toUpperCase()}</span>
          </button>

          {open && (
            <div
              id={accountMenuId}
              role="menu"
              aria-label="Account navigation"
              className="absolute right-0 z-[9999] mt-4 w-[calc(100vw-2rem)] max-w-[20rem] overflow-hidden rounded-3xl border border-purple-300/40 bg-[#090411] shadow-[0_18px_90px_rgba(0,0,0,0.95)] sm:w-80"
            >
              <div className="border-b border-purple-900/60 bg-[#090411] p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-purple-300 sm:text-sm sm:tracking-[0.25em]">
                    Signed in
                  </p>

                  {isAdmin && (
                    <span className="rounded-full border border-red-400/70 bg-red-500/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-200">
                      Admin
                    </span>
                  )}
                </div>

                <p className="mt-2 font-semibold text-white">{user.name}</p>
                <p className="truncate text-sm text-gray-400">{user.email}</p>
              </div>

              <div className="space-y-3 bg-[#090411] p-4">
                {isAdmin ? (
                  <Fragment>
                    <Link href="/admin/orders" onClick={() => setOpen(false)} className={adminButton}>
                      Admin Orders
                    </Link>

                    <Link href="/admin/inventory" onClick={() => setOpen(false)} className={adminButton}>
                      Inventory Checker
                    </Link>

                    <Link href="/admin/products" onClick={() => setOpen(false)} className={adminButton}>
                      Add/Edit Products
                    </Link>

                    <Link href="/admin/analytics" onClick={() => setOpen(false)} className={adminButton}>
                      Analytics
                    </Link>

                    <Link href="/admin/events-qr" onClick={() => setOpen(false)} className={adminButton}>
                      Events QR
                    </Link>
                  </Fragment>
                ) : (
                  <Fragment>
                    <Link href="/cart" onClick={() => setOpen(false)} className={userButton}>
                      Cart
                    </Link>

                    <Link href="/account/orders" onClick={() => setOpen(false)} className={userButton}>
                      My Orders
                    </Link>
                  </Fragment>
                )}

                <Link href="/account" onClick={() => setOpen(false)} className={userButton}>
                  Manage Account
                </Link>

                <Link href="/points" onClick={() => setOpen(false)} className={userButton}>
                  Points
                </Link>

                <button
                  onClick={logout}
                  className="block w-full rounded-full border border-red-300/30 bg-red-500/10 px-5 py-4 text-center text-sm font-semibold text-red-200 transition hover:-translate-y-1 hover:bg-red-300 hover:text-black sm:text-base"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}