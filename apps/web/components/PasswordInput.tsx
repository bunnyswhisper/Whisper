'use client';

import type { InputHTMLAttributes } from 'react';

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}

const INPUT_CLASS =
  'box-border min-h-[44px] w-full max-w-full rounded-xl border border-solid border-purple-950 bg-[#07030d] py-3 text-white outline-none transition-[color,box-shadow,background-color] placeholder:text-gray-500 focus:border-purple-300 focus:shadow-[0_0_25px_rgba(168,85,247,0.25)] disabled:opacity-60';

const BTN_CLASS =
  'absolute z-20 flex h-[44px] w-[44px] cursor-pointer touch-manipulation items-center justify-center border-0 bg-transparent p-0 text-purple-300/90 outline-none transition-colors hover:bg-purple-500/15 hover:text-purple-100 focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50';

/** Right padding for eye toggle (auth spec: 56px) */
const INPUT_PAD_RIGHT_PX = 56;
const INPUT_PAD_LEFT_PX = 16;

export type PasswordInputProps = {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoComplete: 'current-password' | 'new-password';
  visible: boolean;
  onToggleVisible: () => void;
  toggleAriaLabelShow: string;
  toggleAriaLabelHide: string;
  /** Extra classes on the input (e.g. min-h-12 on account page) */
  inputClassName?: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'autoCapitalize' | 'autoCorrect' | 'spellCheck'>;

/**
 * Password field with show/hide toggle. Uses `dir="ltr"` + inline geometry so the toggle
 * stays on the physical right (avoids RTL / flex quirks overlapping the placeholder).
 */
export function PasswordInput({
  id,
  name,
  value,
  onChange,
  disabled,
  placeholder,
  autoComplete,
  visible,
  onToggleVisible,
  toggleAriaLabelShow,
  toggleAriaLabelHide,
  inputClassName = '',
  ...rest
}: PasswordInputProps) {
  return (
    <div className="relative w-full min-w-0" dir="ltr" style={{ position: 'relative' }}>
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${INPUT_CLASS} ${inputClassName}`.trim()}
        style={{
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: '100%',
          paddingLeft: INPUT_PAD_LEFT_PX,
          paddingRight: INPUT_PAD_RIGHT_PX,
          direction: 'ltr',
          textAlign: 'left',
        }}
        {...rest}
      />
      <button
        type="button"
        aria-label={visible ? toggleAriaLabelHide : toggleAriaLabelShow}
        onClick={onToggleVisible}
        disabled={disabled}
        className={BTN_CLASS}
        style={{
          position: 'absolute',
          right: 14,
          left: 'auto',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 44,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {visible ? (
          <EyeOffIcon className="pointer-events-none h-5 w-5 shrink-0" />
        ) : (
          <EyeIcon className="pointer-events-none h-5 w-5 shrink-0" />
        )}
      </button>
    </div>
  );
}
