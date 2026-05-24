/**
 * Accessible alt text for product images with sensible fallbacks.
 */
export function productImageAlt(
  altText: string | null | undefined,
  productName: string,
  options?: { index?: number; view?: 'thumbnail' | 'main' },
): string {
  const name = productName?.trim() || 'Product';
  const custom = altText?.trim();
  const base = custom || name;

  if (options?.view === 'thumbnail' && options.index !== undefined) {
    return `${base}, thumbnail ${options.index + 1}`;
  }

  if (options?.index !== undefined) {
    return `${base}, image ${options.index + 1}`;
  }

  return base;
}
