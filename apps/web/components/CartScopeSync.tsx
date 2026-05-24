'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getSafeSession } from '@/lib/authSession';
import {
  setSessionCartUserId,
  syncCartScopeFromSession,
} from '@/lib/cartStorage';

/**
 * Keeps active cart aligned with the current auth user (guest vs per-user snapshot).
 */
export default function CartScopeSync() {
  useEffect(() => {
    let cancelled = false;

    async function applySession() {
      const session = await getSafeSession();
      if (cancelled) return;
      const userId = session?.user?.id ?? null;
      setSessionCartUserId(userId);
      syncCartScopeFromSession(userId);
    }

    void applySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id ?? null;
      setSessionCartUserId(userId);
      syncCartScopeFromSession(userId);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
