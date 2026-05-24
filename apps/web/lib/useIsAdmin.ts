'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { apiUrl } from '@/lib/api';
import { getSafeSession } from '@/lib/authSession';

/**
 * True only when the current Supabase session belongs to an admin (API /auth/me).
 * Re-checks when auth state changes (login/logout).
 */
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAdmin() {
      const session = await getSafeSession();
      if (cancelled) return;

      if (!session?.access_token) {
        setIsAdmin(false);
        setReady(true);
        return;
      }

      try {
        const res = await fetch(apiUrl('/auth/me'), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setIsAdmin(Boolean(res.ok && data?.isAdmin));
        }
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void checkAdmin();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setReady(false);
      void checkAdmin();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { isAdmin, ready };
}
