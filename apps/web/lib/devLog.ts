/** Dev-only logging — stripped from production bundles when NODE_ENV is production. */
export function devLog(...args: unknown[]) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Bunny]', ...args);
  }
}
