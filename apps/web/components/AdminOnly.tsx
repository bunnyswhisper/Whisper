'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { apiUrl } from '@/lib/api';

export default function AdminOnly({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  async function checkAdmin(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setChecking(true);
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setAllowed(false);
      setChecking(false);
      return;
    }

    try {
      const res = await fetch(apiUrl('/auth/me'), {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();

      setAllowed(Boolean(res.ok && data.isAdmin));
    } catch {
      setAllowed(false);
    }

    setChecking(false);
  }

  useEffect(() => {
    void checkAdmin();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void checkAdmin({ silent: true });
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <main className="min-h-screen bg-[#07030d] px-6 py-10 text-white">
        <p className="text-purple-200">Checking admin access...</p>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#07030d] px-6 py-10 text-white">
        <div className="mx-auto mt-20 max-w-xl rounded-3xl border border-red-400/40 bg-red-500/10 p-8 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-red-300">
            Access Denied
          </p>

          <h1 className="mt-4 text-3xl font-black text-white">
            Admin access required
          </h1>

          <p className="mt-3 text-red-100">
            Please login with an admin account.
          </p>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/auth';
            }}
            className="mt-6 rounded-full bg-purple-300 px-6 py-3 font-bold text-black"
          >
            Switch Account
          </button>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}