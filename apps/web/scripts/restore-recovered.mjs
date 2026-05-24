import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const webDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const recoveredDir = path.join(webDir, 'recovered');
const transcriptPath =
  'C:/Users/ASUS/.cursor/projects/d-Whisper/agent-transcripts/e0ea3a2f-3bbe-46fc-b5ec-c3e8fbad6297/e0ea3a2f-3bbe-46fc-b5ec-c3e8fbad6297.jsonl';

const extraTargets = [
  'components/skeleton/SkeletonCheckout.tsx',
  'components/skeleton/SkeletonCartItems.tsx',
  'components/skeleton/SkeletonOrderCard.tsx',
  'components/skeleton/SkeletonAnalyticsCard.tsx',
  'components/skeleton/SkeletonAccountForm.tsx',
  'components/skeleton/SkeletonAdminTable.tsx',
  'components/skeleton/SkeletonText.tsx',
  'lib/helpTips.ts',
  'components/a11y/LiveRegion.tsx',
  'components/product/ProductDetailView.tsx',
];

function fixMotionSafe(content) {
  return content
    .replace(/<motionSafe(\s|>)/g, '<motion.div$1')
    .replace(/<\/motionSafe>/g, '</motion.div>')
    .replace(/<motion\.motion\.motion\.div/g, '<motion.div')
    .replace(/<motion\.motion\.motion\.div/g, '<motion.div')
    .replace(/<motion\.motion\.div/g, '<motion.div')
    .replace(/<motion\.div(\s|>)/g, '<div$1')
    .replace(/<\/motion\.div>/g, '</div>');
}

function copyRecovered() {
  if (!fs.existsSync(recoveredDir)) return;
  for (const rel of walk(recoveredDir)) {
    const src = path.join(recoveredDir, rel);
    if (!fs.statSync(src).isFile()) continue;
    const dest = path.join(webDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const content = fixMotionSafe(fs.readFileSync(src, 'utf8'));
    fs.writeFileSync(dest, content);
    console.log('copied', rel);
  }
}

function walk(dir, base = '') {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const rel = base ? `${base}/${name}` : name;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...walk(full, rel));
    else out.push(rel.replace(/\\/g, '/'));
  }
  return out;
}

function extractFromTranscript() {
  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
  const found = {};
  for (const line of lines) {
    if (!line.includes('"Write"')) continue;
    try {
      const obj = JSON.parse(line);
      const tool = obj.message?.content?.find?.((c) => c.name === 'Write');
      if (!tool?.input?.path || !tool?.input?.contents) continue;
      const norm = tool.input.path.replace(/\\/g, '/').split('apps/web/').pop();
      if (!norm) continue;
      if (extraTargets.includes(norm) || norm.startsWith('components/skeleton/')) {
        found[norm] = tool.input.contents;
      }
    } catch {
      /* skip */
    }
  }
  for (const [file, content] of Object.entries(found)) {
    const dest = path.join(webDir, file.replace(/\//g, path.sep));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, fixMotionSafe(content));
    console.log('transcript', file, content.length);
  }
}

copyRecovered();
extractFromTranscript();
console.log('done');
