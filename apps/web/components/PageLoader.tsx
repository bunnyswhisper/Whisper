import BrandLoader from '@/components/BrandLoader';

/** Full-screen route transition loader (Next.js `app/loading.tsx`). */
export default function PageLoader() {
  return <BrandLoader variant="overlay" message="LOADING..." />;
}
