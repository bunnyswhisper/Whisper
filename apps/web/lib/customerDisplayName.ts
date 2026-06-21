import { getFreshSessionToken } from '@/lib/authSession';
import { supabase } from '@/lib/supabaseClient';

export function deriveCustomerFirstName(input: {
  fullName?: string | null;
  email?: string | null;
}): string {
  const fullName = input.fullName?.trim();
  if (fullName) {
    const first = fullName.split(/\s+/)[0]?.trim();
    if (first) return first;
  }

  const email = input.email?.trim().toLowerCase();
  if (email) {
    const local = email.split('@')[0]?.trim();
    if (local) {
      const part = local.split(/[._-]/)[0]?.trim();
      if (part && part.length >= 2) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      }
    }
  }

  return 'there';
}

/** First name for wishlist reward modal — profile, auth metadata, email, or "there". */
export async function resolveWishlistRewardCustomerName(): Promise<string> {
  const { token, userId } = await getFreshSessionToken();
  if (!token || !userId) return 'there';

  try {
    const [{ data: profile }, { data: userResult }] = await Promise.all([
      supabase
        .from('customer_profiles')
        .select('full_name')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase.auth.getUser(token),
    ]);

    const user = userResult.user;
    const metadata = user?.user_metadata as Record<string, unknown> | undefined;

    return deriveCustomerFirstName({
      fullName:
        profile?.full_name ||
        (typeof metadata?.full_name === 'string' ? metadata.full_name : null) ||
        (typeof metadata?.name === 'string' ? metadata.name : null),
      email: user?.email,
    });
  } catch {
    return 'there';
  }
}
