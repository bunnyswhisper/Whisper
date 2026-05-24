import { fetchJsonWithBootstrapRetry } from '@/lib/authBootstrap';
import type { SavedAddress } from '@/lib/savedAddressTypes';

export type { SavedAddress } from '@/lib/savedAddressTypes';
export type { SaveSavedAddressInput } from '@/lib/savedAddressTypes';

export type FetchSavedAddressesResult = {
  addresses: SavedAddress[];
  loadFailed: boolean;
  authRequired?: boolean;
};

/** Strip leading country code for checkout local phone field. */
export function stripCountryCodeFromPhone(
  phone: string,
  countryCode: string,
): string {
  const trimmed = phone.trim();
  if (countryCode && trimmed.startsWith(countryCode)) {
    return trimmed.slice(countryCode.length).trim();
  }
  return trimmed.replace(/^\+\d{1,3}/, '').trim();
}

export async function fetchSavedAddresses(
  accessToken: string,
): Promise<FetchSavedAddressesResult> {
  const result = await fetchJsonWithBootstrapRetry<SavedAddress[]>(
    '/customer/saved-addresses',
    undefined,
    accessToken,
  );

  if (!result.ok) {
    return {
      addresses: [],
      loadFailed: true,
      authRequired: result.authRequired,
    };
  }

  return {
    addresses: Array.isArray(result.data) ? result.data : [],
    loadFailed: false,
  };
}

export async function saveSavedAddressViaApi(
  input: import('@/lib/savedAddressTypes').SaveSavedAddressInput,
  accessToken?: string,
): Promise<{ ok: boolean; saved: boolean; message?: string }> {
  if (input.saveAddress === false) {
    return { ok: true, saved: false };
  }

  const result = await fetchJsonWithBootstrapRetry<{
    saved?: boolean;
    skipped?: boolean;
    reason?: string;
  }>(
    '/customer/saved-addresses',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    accessToken,
  );

  if (!result.ok) {
    return {
      ok: false,
      saved: false,
      message: result.message || 'Could not save address',
    };
  }

  return {
    ok: true,
    saved: Boolean(result.data?.saved),
  };
}
