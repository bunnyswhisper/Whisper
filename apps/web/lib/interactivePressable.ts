/**
 * Shared press/hover/focus affordance for Bunny’s Whisper buttons and link-buttons.
 * Merge with element-specific padding, border, and background classes.
 * For <button disabled>, motion is neutralized via disabled: utilities.
 */
export const interactivePressable =
  'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(216,180,254,0.18)] active:translate-y-px active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/70 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:active:scale-100 disabled:active:translate-y-0';
