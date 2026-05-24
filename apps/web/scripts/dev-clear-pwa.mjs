/**
 * Removes production PWA artifacts from public/ before `next dev`.
 * Prevents the browser from loading a stale sw.js left over from `next build`.
 */
import { readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const publicDir = join(process.cwd(), 'public');
const generated = /^(sw|workbox-|swe-worker-|worker-).*\.js(\.map)?$/;

for (const name of readdirSync(publicDir)) {
  if (!generated.test(name)) continue;
  try {
    unlinkSync(join(publicDir, name));
    console.log(`[dev-clear-pwa] removed public/${name}`);
  } catch {
    // ignore
  }
}
