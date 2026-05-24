export const BOOTH_DISCOUNT_STORAGE_KEY = 'bw_booth_discount_v1';
/** Shared across `/event/[code]` and checkout — must stay one key. */
export const BOOTH_DEVICE_KEY_STORAGE_KEY = 'bw_event_device_key_v1';

export type BoothDiscountStored = {
  campaignId: string;
  code: string;
  name: string;
  discountPercent: number;
  deviceKey: string;
};

export function getOrCreateDeviceKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = localStorage.getItem(BOOTH_DEVICE_KEY_STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `dk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(BOOTH_DEVICE_KEY_STORAGE_KEY, id);
    return id;
  } catch {
    return '';
  }
}

/**
 * Same device id used at QR redeem and at checkout — prefers key embedded in saved booth JSON,
 * falls back to the persisted anonymous device key so redeem/checkout never diverge.
 */
export function resolveEventDeviceKeyForCheckout(
  booth: BoothDiscountStored | null,
): string {
  const fromStored = booth?.deviceKey?.trim() ?? '';
  if (fromStored.length >= 8) return fromStored;
  return getOrCreateDeviceKey().trim();
}

export function loadBoothDiscount(): BoothDiscountStored | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BOOTH_DISCOUNT_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as BoothDiscountStored;
    if (
      !o?.campaignId ||
      !o?.code ||
      typeof o.discountPercent !== 'number'
    ) {
      return null;
    }
    const dk =
      typeof o.deviceKey === 'string' && o.deviceKey.trim().length >= 8
        ? o.deviceKey.trim()
        : getOrCreateDeviceKey().trim();
    return { ...o, deviceKey: dk };
  } catch {
    return null;
  }
}

export function saveBoothDiscount(data: BoothDiscountStored): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BOOTH_DISCOUNT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function clearBoothDiscount(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(BOOTH_DISCOUNT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Preview discount amount — matches API (subtotal + delivery) base. */
export function boothDiscountAmountEgyp(
  subtotal: number,
  delivery: number,
  percent: number,
): number {
  const base = Number((subtotal + delivery).toFixed(2));
  return Number(((base * percent) / 100).toFixed(2));
}
