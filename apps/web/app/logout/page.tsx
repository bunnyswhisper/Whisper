'use client';

import { useEffect } from 'react';
import { prepareCartForLogout } from '@/lib/cartStorage';
import { supabase } from '@/lib/supabaseClient';

export default function LogoutPage() {
  useEffect(() => {
    async function logout() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      prepareCartForLogout(session?.user?.id ?? null);
      await supabase.auth.signOut();
      window.location.href = '/';
    }

    logout();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070d] text-white">
      Signing out...
    </main>
  );
}