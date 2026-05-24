export const REVIEW_PHONE_COUNTRY_OPTIONS = [
  { code: '+20', label: 'Egypt (+20)' },
  { code: '+966', label: 'Saudi Arabia (+966)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+965', label: 'Kuwait (+965)' },
  { code: '+974', label: 'Qatar (+974)' },
  { code: '+973', label: 'Bahrain (+973)' },
  { code: '+968', label: 'Oman (+968)' },
  { code: '+1', label: 'USA / Canada (+1)' },
  { code: '+44', label: 'UK (+44)' },
] as const;

export type ReviewPhoneCountryCode =
  (typeof REVIEW_PHONE_COUNTRY_OPTIONS)[number]['code'];

export const DEFAULT_REVIEW_PHONE_COUNTRY: ReviewPhoneCountryCode = '+20';

function stripPhoneFormatting(raw: string): string {
  return raw.replace(/[\s\-().]/g, '');
}

function stripLeadingZeroLocal(countryCode: string, local: string): string {
  if (!local.startsWith('0')) return local;
  if (countryCode === '+20') {
    return local.replace(/^0+/, '');
  }
  return local.replace(/^0/, '');
}

/** Client-side mirror of API normalization for optional preview/validation. */
export function normalizeReviewPhone(
  countryCode: string,
  rawPhone: string,
): string {
  const code = countryCode.trim().startsWith('+')
    ? countryCode.trim()
    : `+${countryCode.trim()}`;
  const codeDigits = code.slice(1);
  let input = stripPhoneFormatting(rawPhone.trim());
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
