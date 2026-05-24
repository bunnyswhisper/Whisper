import fs from 'fs';
import path from 'path';

const transcriptPath =
  'C:/Users/ASUS/.cursor/projects/d-Whisper/agent-transcripts/e0ea3a2f-3bbe-46fc-b5ec-c3e8fbad6297/e0ea3a2f-3bbe-46fc-b5ec-c3e8fbad6297.jsonl';

const targetDirs = [
  'components/skeleton/',
  'components/images/',
  'components/a11y/',
  'components/product/',
  'lib/',
];

const targets = [
  'components/home/ProductCatalog.tsx',
  'components/product/ProductDetailView.tsx',
  'components/empty-state/PremiumEmptyState.tsx',
  'components/empty-state/index.ts',
  'components/skeleton/SkeletonReveal.tsx',
  'components/skeleton/index.ts',
  'components/skeleton/SkeletonBase.tsx',
  'components/skeleton/SkeletonProductGrid.tsx',
  'components/skeleton/SkeletonCartItems.tsx',
  'components/skeleton/SkeletonCheckout.tsx',
  'components/skeleton/SkeletonOrderCard.tsx',
  'components/skeleton/SkeletonPointsCard.tsx',
  'components/skeleton/SkeletonAccountForm.tsx',
  'components/skeleton/SkeletonProductDetail.tsx',
  'components/images/OptimizedImage.tsx',
  'components/images/ProductImage.tsx',
  'components/images/index.ts',
  'components/a11y/VisuallyHidden.tsx',
  'components/a11y/LiveRegion.tsx',
  'lib/csp.ts',
  'lib/a11y/useDialog.ts',
  'lib/a11y/productImageAlt.ts',
  'lib/images/imageConstants.ts',
  'lib/images/isOptimizableImageSrc.ts',
  'lib/images/canOptimizeWithNextImage.ts',
  'lib/devLog.ts',
  'middleware.ts',
  'lib/homeProducts.ts',
  'lib/helpTips.ts',
  'lib/productDetail.ts',
  'lib/customerPoints.ts',
  'app/providers.tsx',
  'components/InfoPopover.tsx',
  'components/admin/AdminImageColorLinkCard.tsx',
  'components/admin/ProductColorGroupsEditor.tsx',
];

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
    const matchTarget = targets.some((x) => norm === x || norm.endsWith('/' + x));
    const matchDir = targetDirs.some((d) => norm.startsWith(d));
    if (matchTarget || matchDir) {
      found[norm] = tool.input.contents;
    }
  } catch {
    /* skip */
  }
}

const outDir = path.resolve('recovered');
fs.mkdirSync(outDir, { recursive: true });
for (const [file, content] of Object.entries(found)) {
  const dest = path.join(outDir, file.replace(/\//g, path.sep));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  console.log('recovered', file, content.length);
}
console.log('total', Object.keys(found).length);
