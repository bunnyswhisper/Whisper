import { getFreshSessionToken } from '@/lib/authSession';
import { supabase } from '@/lib/supabaseClient';

export type CustomerProfileForm = {
  fullName: string;
  email: string;
  countryCode: string;
  phone: string;
  city: string;
  area: string;
  street: string;
  notes: string;
};

export type CustomerProfileData = {
  userId: string;
  form: CustomerProfileForm;
};

export const customerProfileQueryKey = ['customer-profile'] as const;
export const customerProfileStaleTimeMs = 2 * 60 * 1000;

export class CustomerProfileAuthRequiredError extends Error {
  readonly name = 'CustomerProfileAuthRequiredError';
}

export class CustomerProfileFetchError extends Error {
  readonly name = 'CustomerProfileFetchError';
}

export async function fetchCustomerProfile(): Promise<CustomerProfileData> {
  const { token, userId } = await getFreshSessionToken();

  if (!token || !userId) {
    throw new CustomerProfileAuthRequiredError();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user) {
    throw new CustomerProfileAuthRequiredError();
  }

  const { data: profile, error } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw new CustomerProfileFetchError(
      'Could not load account details. Please try again.',
    );
  }

  const countryCode = profile?.country_code || '+20';

  return {
    userId: user.id,
    form: {
      fullName:
        profile?.full_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        '',
      email: profile?.email || user.email || '',
      countryCode,
      phone: profile?.phone
        ? profile.phone.replace(profile?.country_code || '+20', '')
        : '',
      city: profile?.city || '',
      area: profile?.area || '',
      street: profile?.street || '',
      notes: profile?.notes || '',
    },
  };
}
