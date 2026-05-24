'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import BrandLoader from '@/components/BrandLoader';
import { PremiumEmptyState } from '@/components/empty-state';
import Navbar from '@/components/Navbar';
import { AsyncView, SkeletonProfile } from '@/components/skeleton';
import { supabase } from '@/lib/supabaseClient';
import { getFreshSessionToken, shouldRefetchCustomerDataOnAuthEvent } from '@/lib/authSession';
import {
  CustomerProfileAuthRequiredError,
  CustomerProfileFetchError,
  customerProfileQueryKey,
  customerProfileStaleTimeMs,
  fetchCustomerProfile,
} from '@/lib/customerProfile';

type FormErrors = {
  email?: string;
  general?: string;
};

/** `code` is stored on the profile; `listLabel` is dropdown copy; `buttonLabel` is closed control. */
const countryDialOptions = [
  { code: '+20', listLabel: 'Egypt (+20)', buttonLabel: '🇪🇬 +20' },
  { code: '+1', listLabel: 'USA / Canada (+1)', buttonLabel: '🇺🇸 +1' },
  { code: '+44', listLabel: 'UK (+44)', buttonLabel: '🇬🇧 +44' },
  { code: '+49', listLabel: 'Germany (+49)', buttonLabel: '🇩🇪 +49' },
  { code: '+33', listLabel: 'France (+33)', buttonLabel: '🇫🇷 +33' },
  { code: '+39', listLabel: 'Italy (+39)', buttonLabel: '🇮🇹 +39' },
  { code: '+34', listLabel: 'Spain (+34)', buttonLabel: '🇪🇸 +34' },
  { code: '+31', listLabel: 'Netherlands (+31)', buttonLabel: '🇳🇱 +31' },
  { code: '+90', listLabel: 'Turkey (+90)', buttonLabel: '🇹🇷 +90' },
  { code: '+966', listLabel: 'Saudi Arabia (+966)', buttonLabel: '🇸🇦 +966' },
  { code: '+971', listLabel: 'UAE (+971)', buttonLabel: '🇦🇪 +971' },
  { code: '+965', listLabel: 'Kuwait (+965)', buttonLabel: '🇰🇼 +965' },
  { code: '+974', listLabel: 'Qatar (+974)', buttonLabel: '🇶🇦 +974' },
  { code: '+973', listLabel: 'Bahrain (+973)', buttonLabel: '🇧🇭 +973' },
  { code: '+968', listLabel: 'Oman (+968)', buttonLabel: '🇴🇲 +968' },
  { code: '+962', listLabel: 'Jordan (+962)', buttonLabel: '🇯🇴 +962' },
  { code: '+961', listLabel: 'Lebanon (+961)', buttonLabel: '🇱🇧 +961' },
  { code: '+212', listLabel: 'Morocco (+212)', buttonLabel: '🇲🇦 +212' },
  { code: '+213', listLabel: 'Algeria (+213)', buttonLabel: '🇩🇿 +213' },
  { code: '+216', listLabel: 'Tunisia (+216)', buttonLabel: '🇹🇳 +216' },
  { code: '+249', listLabel: 'Sudan (+249)', buttonLabel: '🇸🇩 +249' },
  { code: '+91', listLabel: 'India (+91)', buttonLabel: '🇮🇳 +91' },
  { code: '+92', listLabel: 'Pakistan (+92)', buttonLabel: '🇵🇰 +92' },
  { code: '+880', listLabel: 'Bangladesh (+880)', buttonLabel: '🇧🇩 +880' },
  { code: '+86', listLabel: 'China (+86)', buttonLabel: '🇨🇳 +86' },
  { code: '+81', listLabel: 'Japan (+81)', buttonLabel: '🇯🇵 +81' },
  { code: '+82', listLabel: 'South Korea (+82)', buttonLabel: '🇰🇷 +82' },
  { code: '+61', listLabel: 'Australia (+61)', buttonLabel: '🇦🇺 +61' },
  { code: '+55', listLabel: 'Brazil (+55)', buttonLabel: '🇧🇷 +55' },
];

const egyptianCities = [
  'Cairo',
  'Giza',
  'Alexandria',
  'Dakahlia',
  'Sharqia',
  'Gharbia',
  'Monufia',
  'Qalyubia',
  'Port Said',
  'Suez',
  'Ismailia',
  'Fayoum',
  'Beni Suef',
  'Minya',
  'Assiut',
  'Sohag',
  'Qena',
  'Luxor',
  'Aswan',
  'Red Sea',
  'Matrouh',
  'North Sinai',
  'South Sinai',
];

export default function AccountPage() {
  const queryClient = useQueryClient();
  const [authLoading, setAuthLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [authRequired, setAuthRequired] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const countryPickerRef = useRef<HTMLDivElement>(null);
  /** Auth user id for internal use only (not shown in the UI). */
  const accountUserIdRef = useRef<string>('');

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    countryCode: '+20',
    phone: '',
    city: '',
    area: '',
    street: '',
    notes: '',
  });

  const profileEnabled = !authLoading && !authRequired;

  const profileQuery = useQuery({
    queryKey: customerProfileQueryKey,
    queryFn: fetchCustomerProfile,
    staleTime: customerProfileStaleTimeMs,
    enabled: profileEnabled,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { token, userId } = await getFreshSessionToken();
      if (cancelled) return;
      setAuthRequired(!token || !userId);
      setAuthLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!shouldRefetchCustomerDataOnAuthEvent(event)) return;

      void (async () => {
        const { token, userId } = await getFreshSessionToken();
        setAuthRequired(!token || !userId);

        if (token && userId) {
          await queryClient.invalidateQueries({ queryKey: customerProfileQueryKey });
        }
      })();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    if (profileQuery.error instanceof CustomerProfileAuthRequiredError) {
      setAuthRequired(true);
    }
  }, [profileQuery.error]);

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;

    if (accountUserIdRef.current && accountUserIdRef.current !== profile.userId) {
      setForm({
        fullName: '',
        email: '',
        countryCode: '+20',
        phone: '',
        city: '',
        area: '',
        street: '',
        notes: '',
      });
    }

    accountUserIdRef.current = profile.userId;
    setForm(profile.form);
  }, [profileQuery.data]);

  const dataLoading =
    profileEnabled && profileQuery.isPending && profileQuery.data === undefined;

  const fetchError =
    profileQuery.error instanceof CustomerProfileFetchError
      ? profileQuery.error.message
      : profileQuery.isError &&
          !(profileQuery.error instanceof CustomerProfileAuthRequiredError)
        ? 'Could not load account details. Please try again.'
        : '';

  useEffect(() => {
    if (!countryPickerOpen) return;
    function handlePointerDown(event: MouseEvent) {
      const el = countryPickerRef.current;
      if (el && !el.contains(event.target as Node)) {
        setCountryPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [countryPickerOpen]);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setMessage('');
    setErrors({});
  }

  function lockedFieldError() {
    setErrors({
      email: 'Email is linked to your login and cannot be changed here.',
    });
  }

  async function saveProfile() {
    setSaving(true);
    setMessage('');
    setErrors({});

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setSaving(false);
      setAuthRequired(true);
      return;
    }

    const cleanPhone = form.phone.replace(/\D/g, '');
    const fullPhone = cleanPhone ? `${form.countryCode}${cleanPhone}` : null;

    const { error } = await supabase.from('customer_profiles').upsert(
      {
        user_id: session.user.id,
        full_name: form.fullName,
        email: form.email,
        country_code: form.countryCode,
        phone: fullPhone,
        city: form.city,
        area: form.area,
        street: form.street,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    setSaving(false);

    if (error) {
      setErrors({ general: error.message });
      return;
    }

    setMessage('Account details saved successfully.');
    await queryClient.invalidateQueries({ queryKey: customerProfileQueryKey });
  }

  const inputClass =
    'w-full min-h-12 rounded-xl border border-purple-950 bg-[#07030d] px-4 py-3 text-white outline-none placeholder:text-gray-500 transition focus:border-purple-300 focus:shadow-[0_0_25px_rgba(168,85,247,0.25)]';

  if (authLoading) {
    return <BrandLoader variant="overlay" message="Checking sign-in…" />;
  }

  if (authRequired) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 text-white sm:px-6 sm:py-8 lg:py-10">
        <Navbar />
        <div className="mx-auto mt-8 max-w-2xl rounded-3xl border border-purple-900/70 bg-[#0d0716] p-6 text-center sm:p-10">
          <p className="text-sm text-gray-300">Please sign in to view your account.</p>
          <Link
            href="/auth?redirect=/account"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-purple-300/60 bg-purple-500/15 px-5 py-2.5 text-sm font-bold text-purple-100 hover:border-purple-300 hover:bg-purple-500/25"
          >
            Go to Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 text-white sm:px-6 sm:py-8 lg:py-10">
      <Navbar />

      <section className="mx-auto max-w-4xl">
        <div className="mb-6 sm:mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-purple-300 sm:text-sm sm:tracking-[0.35em]">
            Customer Profile
          </p>

          <h1 className="mt-3 bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
            Manage Account
          </h1>

          <p className="mt-3 text-sm text-gray-400 sm:text-base">
            Update your delivery details. Your email stays linked to your login.
          </p>
        </div>

        <AsyncView loading={dataLoading} skeleton={<SkeletonProfile />}>
        <div className="rounded-3xl border border-purple-950 bg-[#0d0716] p-4 shadow-[0_18px_60px_rgba(168,85,247,0.18)] sm:p-6">
          <div className="grid gap-5">
            <div>
              <label htmlFor="account-email" className="mb-2 block text-sm text-purple-200">
                Email locked
              </label>

              <input
                id="account-email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                readOnly
                onClick={() => lockedFieldError()}
                className="w-full cursor-not-allowed rounded-xl border border-purple-950 bg-[#07030d] px-4 py-3 text-gray-500 outline-none"
              />

              {errors.email && (
                <p className="mt-1 text-sm text-red-300">{errors.email}</p>
              )}
            </div>


            <div>
              <label htmlFor="account-full-name" className="mb-2 block text-sm text-purple-200">
                Full name
              </label>

              <input
                id="account-full-name"
                name="fullName"
                autoComplete="name"
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                className={inputClass}
                placeholder="Your full name"
              />
            </div>

            <fieldset className="min-w-0 border-0 p-0">
              <legend className="mb-2 block text-sm font-semibold text-purple-200">
                Phone number
              </legend>

              <div className="flex min-w-0 flex-row items-stretch gap-2 sm:gap-3">
                <div
                  ref={countryPickerRef}
                  className="relative w-[5.25rem] shrink-0 sm:w-[6.25rem]"
                >
                  <label
                    htmlFor="country-code-trigger"
                    className="sr-only"
                  >
                    Country calling code
                  </label>
                  <button
                    id="country-code-trigger"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={countryPickerOpen}
                    onClick={() => setCountryPickerOpen((o) => !o)}
                    className="flex h-12 w-full items-center justify-between gap-0.5 rounded-xl border border-purple-950 bg-[#07030d] px-2 text-left text-sm font-semibold tabular-nums text-white outline-none transition hover:border-purple-400/50 focus:border-purple-300 focus:shadow-[0_0_20px_rgba(168,85,247,0.2)] sm:px-3"
                  >
                    <span className="min-w-0 truncate">
                      {countryDialOptions.find((c) => c.code === form.countryCode)
                        ?.buttonLabel ?? form.countryCode}
                    </span>
                    <span className="shrink-0 text-xs text-purple-300" aria-hidden>
                      {countryPickerOpen ? '▲' : '▼'}
                    </span>
                  </button>
                  {countryPickerOpen && (
                    <ul
                      role="listbox"
                      className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 w-[min(100vw-2rem,18rem)] overflow-auto rounded-xl border border-purple-900 bg-[#0a0514] py-1 shadow-[0_12px_40px_rgba(0,0,0,0.55)] sm:w-auto sm:min-w-[12rem]"
                    >
                      {countryDialOptions.map((country) => (
                        <li key={country.code} role="none">
                          <button
                            type="button"
                            role="option"
                            aria-selected={form.countryCode === country.code}
                            className={`w-full px-3 py-2.5 text-left text-sm transition hover:bg-purple-500/15 ${
                              form.countryCode === country.code
                                ? 'bg-purple-500/20 text-white'
                                : 'text-gray-200'
                            }`}
                            onClick={() => {
                              updateField('countryCode', country.code);
                              setCountryPickerOpen(false);
                            }}
                          >
                            {country.listLabel}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <label htmlFor="account-phone" className="sr-only">
                    Phone number (without country code)
                  </label>
                  <input
                    id="account-phone"
                    name="phone"
                    value={form.phone}
                    onChange={(e) =>
                      updateField('phone', e.target.value.replace(/\D/g, ''))
                    }
                    className={`${inputClass} w-full min-w-0`}
                    placeholder="e.g. 1012345678"
                    inputMode="numeric"
                    autoComplete="tel-national"
                  />
                  <p className="mt-1.5 text-xs text-gray-500">
                    Enter digits only (no spaces). Example:{' '}
                    <span className="tabular-nums text-purple-200/90">
                      {form.countryCode} 1012345678
                    </span>
                  </p>
                </div>
              </div>
            </fieldset>

            <div>
              <label htmlFor="account-city" className="mb-2 block text-sm text-purple-200">City</label>

              <select
                id="account-city"
                name="city"
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
                className="w-full min-h-12 rounded-xl border border-purple-950 bg-[#07030d] px-4 py-3 text-purple-100 outline-none focus:border-purple-300"
              >
                <option value="" className="bg-[#07030d] text-gray-400">
                  Choose city
                </option>

                {egyptianCities.map((city) => (
                  <option key={city} value={city} className="bg-[#07030d] text-white">
                    {city}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="account-area" className="mb-2 block text-sm text-purple-200">Area</label>

              <input
                id="account-area"
                name="area"
                autoComplete="address-level2"
                value={form.area}
                onChange={(e) => updateField('area', e.target.value)}
                className={inputClass}
                placeholder="Area"
              />
            </div>

            <div>
              <label htmlFor="account-street" className="mb-2 block text-sm text-purple-200">
                Street / Building / Apartment
              </label>

              <input
                id="account-street"
                name="street"
                autoComplete="street-address"
                value={form.street}
                onChange={(e) => updateField('street', e.target.value)}
                className={inputClass}
                placeholder="Street, building, apartment"
              />
            </div>

            <div>
              <label htmlFor="account-notes" className="mb-2 block text-sm text-purple-200">
                Delivery notes
              </label>

              <textarea
                id="account-notes"
                name="notes"
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                className="min-h-28 w-full rounded-xl border border-purple-950 bg-[#07030d] px-4 py-3 text-white outline-none placeholder:text-gray-500 transition focus:border-purple-300 focus:shadow-[0_0_25px_rgba(168,85,247,0.25)]"
                placeholder="Any notes for delivery"
              />
            </div>

            {errors.general && (
              <div className="rounded-xl border border-red-400/60 bg-red-500/10 p-4 text-sm text-red-200 sm:text-base">
                {errors.general}
              </div>
            )}
            {fetchError ? (
              <PremiumEmptyState
                compact
                className="!min-h-0"
                variant="error"
                showMark={false}
                eyebrow="Could not load"
                title="Profile unavailable"
                description={fetchError}
                primaryAction={{
                  label: 'Retry',
                  onClick: () => {
                    void profileQuery.refetch();
                  },
                }}
              />
            ) : null}

            {message && (
              <div className="rounded-xl border border-purple-300/60 bg-purple-500/10 p-4 text-sm text-purple-100 sm:text-base">
                {message}
              </div>
            )}

            <button
              onClick={saveProfile}
              disabled={saving}
              className="min-h-14 w-full rounded-full border border-purple-300 bg-purple-300 px-6 py-4 font-bold text-black transition hover:bg-white hover:shadow-[0_0_45px_rgba(168,85,247,0.7)] disabled:opacity-60 sm:w-auto sm:hover:-translate-y-1"
            >
              {saving ? 'Saving...' : 'Save Account Details'}
            </button>
          </div>
        </div>
        </AsyncView>
      </section>
    </main>
  );
}
