/** Allowed public-review country calling codes. */
export const REVIEW_PHONE_COUNTRY_CODES = [
  '+20',
  '+966',
  '+971',
  '+965',
  '+974',
  '+973',
  '+968',
  '+1',
  '+44',
] as const;

export type ReviewPhoneCountryCode = (typeof REVIEW_PHONE_COUNTRY_CODES)[number];

export function stripPhoneFormatting(raw: string): string {
  return raw.replace(/[\s\-().]/g, '');
}

function normalizeCountryCode(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

function stripLeadingZeroLocal(countryCode: string, local: string): string {
  if (!local.startsWith('0')) return local;
  if (countryCode === '+20') {
    return local.replace(/^0+/, '');
  }
  return local.replace(/^0/, '');
}

/**
 * Normalize a review phone to E.164-like form (+country + national number).
 */
export function normalizeReviewPhone(
  countryCode: string,
  rawPhone: string,
): string {
  const code = normalizeCountryCode(countryCode);
  if (!code || !REVIEW_PHONE_COUNTRY_CODES.includes(code as ReviewPhoneCountryCode)) {
    return '';
  }

  const codeDigits = code.slice(1);
  let input = stripPhoneFormatting(rawPhone);
  if (!input) return '';

  if (input.startsWith('+')) {
    const all = input.slice(1);
    if (all.startsWith(codeDigits)) {
      const local = stripLeadingZeroLocal(code, all.slice(codeDigits.length));
      return `+${codeDigits}${local}`;
    }
    return `+${all}`;
  }

  if (input.startsWith(codeDigits)) {
    const local = stripLeadingZeroLocal(code, input.slice(codeDigits.length));
    return `+${codeDigits}${local}`;
  }

  const local = stripLeadingZeroLocal(code, input);
  return `+${codeDigits}${local}`;
}

export function isValidNormalizedPhone(normalized: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(normalized);
}

export function inferReviewPhoneCountryCode(phone: string): ReviewPhoneCountryCode {
  const trimmed = phone.trim();
  for (const code of REVIEW_PHONE_COUNTRY_CODES) {
    if (trimmed.startsWith(code)) {
      return code;
    }
  }
  const match = trimmed.match(/^\+\d{1,3}/);
  const found = match?.[0];
  if (found && REVIEW_PHONE_COUNTRY_CODES.includes(found as ReviewPhoneCountryCode)) {
    return found as ReviewPhoneCountryCode;
  }
  return '+20';
}

export function splitReviewPhoneForPrefill(phone: string): {
  countryCode: ReviewPhoneCountryCode;
  local: string;
} {
  const trimmed = phone.trim();
  if (!trimmed) {
    return { countryCode: '+20', local: '' };
  }

  const countryCode = inferReviewPhoneCountryCode(trimmed);
  let local = trimmed;
  if (local.startsWith(countryCode)) {
    local = local.slice(countryCode.length).trim();
  } else {
    local = local.replace(/^\+\d{1,3}/, '').trim();
  }

  return { countryCode, local };
}
