/** Path prefixes blocked from crawling (with and without trailing slash). */
const DISALLOW_PREFIXES = [
  '/admin',
  '/account',
  '/auth',
  '/event',
  '/api',
  '/debug',
] as const;

/** Exact paths (no trailing slash required for match in most crawlers). */
const DISALLOW_EXACT = [
  '/cart',
  '/checkout',
  '/payment',
  '/logout',
  '/reset-password',
  '/points',
] as const;

/**
 * Builds disallow entries for robots.txt.
 * Prefix routes include both `/path` and `/path/` so crawlers match consistently.
 */
export function buildRobotsDisallowPaths(): string[] {
  const paths: string[] = [];

  for (const prefix of DISALLOW_PREFIXES) {
    paths.push(prefix);
    paths.push(`${prefix}/`);
  }

  paths.push(...DISALLOW_EXACT);

  return paths;
}
