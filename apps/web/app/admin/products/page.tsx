'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { PremiumEmptyState } from '@/components/empty-state';
import { SkeletonAdminProductsList } from '@/components/skeleton';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabaseClient';
import { apiUrl } from '@/lib/api';
import AdminOnly from '@/components/AdminOnly';
import { AdminImageColorLinkCard } from '@/components/admin/AdminImageColorLinkCard';
import {
  AdminProductBasicFields,
  type ProductBasicDraft,
} from '@/components/admin/AdminProductBasicFields';
import { CollapsiblePanel } from '@/components/admin/CollapsiblePanel';
import { ProductSummaryCard } from '@/components/admin/ProductSummaryCard';
import ConfirmModal from '@/components/ConfirmModal';
import { OptimizedImage } from '@/components/images';
import {
  ProductColorGroupsEditor,
  type AdminVariantRow,
} from '@/components/admin/ProductColorGroupsEditor';
import {
  colorsMatch,
  inferColorHexFromName,
  normalizeHexColor,
  getVariantColorHexForName,
  isOrphanImageColorLink,
  uniqueVariantColorNames,
} from '@/lib/productColor';

type Variant = {
  id: string;
  size: string;
  color: string;
  color_hex?: string | null;
  sku: string | null;
  stock_quantity: number;
  reserved_quantity: number;
  is_active: boolean;
};

type ProductImage = {
  id: string;
  image_url: string;
  alt_text: string | null;
  color_name?: string | null;
  sort_order: number;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  base_price: number;
  sale_price: number | null;
  status: string;
  is_featured: boolean;
  product_images: ProductImage[];
  product_variants: Variant[];
};

const inputClass =
  'min-h-12 rounded-xl border border-purple-950 bg-[#05070d] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-purple-300 focus:shadow-[0_0_25px_rgba(168,85,247,0.22)]';

const buttonPurple =
  'min-h-12 rounded-full border border-purple-300 bg-purple-300 px-5 py-3 font-bold text-black transition hover:bg-white hover:shadow-[0_0_35px_rgba(168,85,247,0.45)]';

const buttonRed =
  'min-h-12 rounded-full border border-red-300/40 bg-red-500/10 px-5 py-3 font-bold text-red-100 transition hover:bg-red-300 hover:text-black';

const buttonColorLink =
  'rounded-full border border-purple-300/40 bg-purple-500/10 font-bold text-purple-100 transition hover:bg-purple-300 hover:text-black';

function sortedProductImages(images: ProductImage[]): ProductImage[] {
  return [...images].sort((a, b) => a.sort_order - b.sort_order);
}

function sortedThumbUrl(product: Product): string | null {
  return sortedProductImages(product.product_images || [])[0]?.image_url ?? null;
}

function productCardImageId(images: ProductImage[]): string | null {
  const sorted = sortedProductImages(images);
  return sorted[0]?.id ?? null;
}

function priceLabel(product: Product): string {
  const sale = product.sale_price;
  if (sale != null && Number(sale) > 0) {
    return `EGP ${Number(sale).toFixed(0)} sale`;
  }
  return `EGP ${Number(product.base_price || 0).toFixed(0)}`;
}

function stockSummaryLine(product: Product): string {
  const variants = product.product_variants || [];
  const total = variants.reduce(
    (s, v) => s + Number(v.stock_quantity || 0),
    0,
  );
  return `${variants.length} variants · ${total} units`;
}

function AdminProductsPageContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);
  /** Prevents deep-link scroll from re-running after background product refetch (e.g. Save row). */
  const deepLinkHandledRef = useRef<string | null>(null);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmRemoveImageId, setConfirmRemoveImageId] = useState<string | null>(
    null,
  );
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<Product | null>(
    null,
  );
  const [confirmActionBusy, setConfirmActionBusy] = useState(false);
  const [imageColorDraft, setImageColorDraft] = useState<Record<string, string>>(
    {},
  );
  const [savingImageColorId, setSavingImageColorId] = useState<string | null>(null);
  const [settingCardImageId, setSettingCardImageId] = useState<string | null>(null);
  const [productBasicDrafts, setProductBasicDrafts] = useState<
    Record<string, ProductBasicDraft>
  >({});
  const productsRef = useRef(products);
  productsRef.current = products;

  function basicDraftFromProduct(product: Product): ProductBasicDraft {
    return {
      name: product.name,
      description: product.description,
      base_price: String(product.base_price ?? ''),
      sale_price:
        product.sale_price != null ? String(product.sale_price) : '',
    };
  }

  function getBasicDraft(product: Product): ProductBasicDraft {
    return productBasicDrafts[product.id] ?? basicDraftFromProduct(product);
  }

  async function getToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token;
  }

  async function loadProducts(options?: { background?: boolean }) {
    const background = options?.background ?? false;
    const showBlockingLoader = !background && !hasLoadedOnceRef.current;

    if (showBlockingLoader) {
      setInitialLoading(true);
    }

    setErrorMessage('');

    const token = await getToken();

    if (!token) {
      window.location.href = '/auth?redirect=/admin/products';
      return;
    }

    const res = await fetch(apiUrl('/products/admin/all'), {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (!res.ok) {
      setErrorMessage(data.message || 'Failed to load products.');
      if (!background) setProducts([]);
      hasLoadedOnceRef.current = true;
      setInitialLoading(false);
      return;
    }

    setProducts(Array.isArray(data) ? data : []);
    hasLoadedOnceRef.current = true;
    setInitialLoading(false);
  }

  function updateProductLocal(productId: string, field: string, value: any) {
    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId ? { ...product, [field]: value } : product,
      ),
    );
  }

  function updateImageLocal(
    productId: string,
    imageId: string,
    colorName: string | null,
  ) {
    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId
          ? {
              ...product,
              product_images: product.product_images.map((image) =>
                image.id === imageId
                  ? { ...image, color_name: colorName }
                  : image,
              ),
            }
          : product,
      ),
    );
  }

  function updateVariantLocal(
    productId: string,
    variantId: string,
    field: string,
    value: any,
  ) {
    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId
          ? {
              ...product,
              product_variants: product.product_variants.map((variant) =>
                variant.id === variantId
                  ? { ...variant, [field]: value }
                  : variant,
              ),
            }
          : product,
      ),
    );
  }

  function updateColorGroupMetaLocal(
    productId: string,
    variantIds: string[],
    patch: { color: string; color_hex: string; previousColorName?: string },
  ) {
    const idSet = new Set(variantIds);

    setProducts((prev) =>
      prev.map((product) => {
        if (product.id !== productId) return product;

        const oldColorKeys = new Set<string>();
        if (patch.previousColorName?.trim()) {
          oldColorKeys.add(patch.previousColorName.trim().toLowerCase());
        }
        product.product_variants
          .filter((v) => idSet.has(v.id))
          .forEach((v) => {
            const key = v.color.trim().toLowerCase();
            if (key) oldColorKeys.add(key);
          });

        return {
          ...product,
          product_variants: product.product_variants.map((variant) =>
            idSet.has(variant.id)
              ? {
                  ...variant,
                  color: patch.color,
                  color_hex: patch.color_hex,
                }
              : variant,
          ),
          product_images: product.product_images.map((image) => {
            const linked = image.color_name?.trim().toLowerCase();
            if (!linked || !oldColorKeys.has(linked)) return image;
            return { ...image, color_name: patch.color };
          }),
        };
      }),
    );
  }

  async function renameImageColorLinksForProduct(
    productId: string,
    oldColorName: string,
    newColorName: string,
  ) {
    const token = await getToken();
    const res = await fetch(
      apiUrl(`/products/admin/${productId}/rename-color-images`),
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          old_color_name: oldColorName,
          new_color_name: newColorName,
        }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update image color links.');
    }
    return data as { updated?: number; color_name?: string };
  }

  async function saveColorGroup(
    productId: string,
    variants: AdminVariantRow[],
    previousColorName?: string,
  ) {
    const newColor = variants[0]?.color?.trim() ?? '';
    const priorColor = previousColorName?.trim() ?? '';

    try {
      if (
        priorColor &&
        newColor &&
        !colorsMatch(priorColor, newColor)
      ) {
        await renameImageColorLinksForProduct(productId, priorColor, newColor);
        setProducts((prev) =>
          prev.map((product) => {
            if (product.id !== productId) return product;
            return {
              ...product,
              product_images: product.product_images.map((image) =>
                colorsMatch(image.color_name || '', priorColor)
                  ? { ...image, color_name: newColor }
                  : image,
              ),
            };
          }),
        );
      }

      for (const variant of variants) {
        const ok = await saveVariant(variant, { silent: true });
        if (!ok) return;
      }
      setMessage('Color group saved.');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to save color group.',
      );
    }
  }

  async function addSizeToColorGroup(
    product: Product,
    color: string,
    color_hex: string,
  ) {
    const token = await getToken();
    const res = await fetch(apiUrl(`/products/admin/${product.id}/variants`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        size: '',
        color: color.trim(),
        color_hex:
          normalizeHexColor(color_hex) || inferColorHexFromName(color),
        stock_quantity: 0,
        is_active: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMessage(data.message || 'Failed to add size.');
      return;
    }
    setMessage('Size row added — set size and stock, then save.');
    await loadProducts({ background: true });
  }

  async function addColorGroup(product: Product) {
    const token = await getToken();
    const color = 'New Color';
    const color_hex = inferColorHexFromName(color);
    const res = await fetch(apiUrl(`/products/admin/${product.id}/variants`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        size: 'M',
        color,
        color_hex,
        stock_quantity: 0,
        is_active: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMessage(data.message || 'Failed to add color.');
      return;
    }
    setMessage('New color group added.');
    await loadProducts({ background: true });
  }

  async function removeVariantById(variantId: string) {
    if (!window.confirm('Remove this size row?')) return;
    const token = await getToken();
    const res = await fetch(apiUrl(`/products/admin/variants/${variantId}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMessage(data.message || 'Failed to remove variant.');
      return;
    }
    setMessage('Size row removed.');
    await loadProducts({ background: true });
  }

  async function removeColorGroup(variantIds: string[]) {
    if (
      !window.confirm(
        'Remove this entire color and all its sizes? Linked images will become unlinked.',
      )
    ) {
      return;
    }
    const token = await getToken();
    for (const variantId of variantIds) {
      await fetch(apiUrl(`/products/admin/variants/${variantId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    setMessage('Color group removed.');
    await loadProducts({ background: true });
  }

  async function saveImageColorLink(productId: string, imageId: string) {
    const product = products.find((p) => p.id === productId);
    const image = product?.product_images.find((img) => img.id === imageId);
    if (!product || !image) return;

    const draft = imageColorDraft[imageId];
    const color_name =
      draft !== undefined
        ? draft.trim() || null
        : image.color_name?.trim() || null;

    setSavingImageColorId(imageId);
    setErrorMessage('');

    const token = await getToken();
    const res = await fetch(apiUrl(`/products/admin/images/${imageId}`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ color_name }),
    });

    const data = await res.json();
    setSavingImageColorId(null);

    if (!res.ok) {
      setErrorMessage(data.message || 'Failed to save image color link.');
      return;
    }

    const persistedName =
      typeof data?.color_name === 'string' || data?.color_name === null
        ? data.color_name
        : color_name;

    updateImageLocal(productId, imageId, persistedName);
    setImageColorDraft((prev) => {
      const next = { ...prev };
      delete next[imageId];
      return next;
    });
    setMessage(
      persistedName
        ? `Image color link saved — linked to ${persistedName}.`
        : 'Image color link cleared — now unlinked.',
    );
  }

  async function setAsProductCardImage(productId: string, imageId: string) {
    setSettingCardImageId(imageId);
    setErrorMessage('');

    const token = await getToken();
    const res = await fetch(apiUrl(`/products/admin/images/${imageId}`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ set_as_card_image: true }),
    });

    const data = await res.json();
    setSettingCardImageId(null);

    if (!res.ok) {
      setErrorMessage(data.message || 'Failed to set product card image.');
      return;
    }

    setProducts((prev) =>
      prev.map((product) => {
        if (product.id !== productId) return product;
        const featured = product.product_images.find((img) => img.id === imageId);
        if (!featured) return product;
        const others = product.product_images.filter((img) => img.id !== imageId);
        const reordered = [
          { ...featured, sort_order: 1 },
          ...sortedProductImages(others).map((img, index) => ({
            ...img,
            sort_order: index + 2,
          })),
        ];
        return { ...product, product_images: reordered };
      }),
    );
    setMessage('Product card image updated.');
  }

  function selectImage(productId: string, file: File | null) {
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];

    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Only JPG, JPEG, and PNG images are allowed.');
      return;
    }

    setErrorMessage('');
    setSelectedFiles((prev) => ({ ...prev, [productId]: file }));
    setPreviews((prev) => ({
      ...prev,
      [productId]: URL.createObjectURL(file),
    }));
  }

  async function uploadProductImage(product: Product) {
    const file = selectedFiles[product.id];

    if (!file) {
      setErrorMessage('Please choose an image first.');
      return;
    }

    const token = await getToken();

    const fileExt = file.name.split('.').pop();
    const fileName = `${product.slug}-${Date.now()}.${fileExt}`;
    const filePath = `${product.slug}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file);

    if (uploadError) {
      setErrorMessage(uploadError.message);
      return;
    }

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    const res = await fetch(apiUrl(`/products/admin/${product.id}/images`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        image_url: data.publicUrl,
        alt_text: product.name,
        sort_order: product.product_images.length + 1,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      setErrorMessage(result.message || 'Failed to save image.');
      return;
    }

    setMessage('Image uploaded successfully.');
    setSelectedFiles((prev) => ({ ...prev, [product.id]: null }));
    setPreviews((prev) => ({ ...prev, [product.id]: '' }));
    await loadProducts({ background: true });
  }

  async function performRemoveProductImage(imageId: string) {
    const token = await getToken();

    const res = await fetch(apiUrl(`/products/admin/images/${imageId}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (!res.ok) {
      setErrorMessage(data.message || 'Failed to remove image.');
      return;
    }

    setMessage('Image removed successfully.');
    await loadProducts({ background: true });
  }

  async function performDeleteProduct(product: Product) {
    const token = await getToken();

    const res = await fetch(apiUrl(`/products/admin/${product.id}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (!res.ok) {
      setErrorMessage(data.message || 'Failed to remove product.');
      return;
    }

    setMessage(`${product.name} removed successfully.`);
    setExpandedId((id) => (id === product.id ? null : id));
    await loadProducts({ background: true });
  }

  async function saveProduct(product: Product) {
    const token = await getToken();
    const draft = getBasicDraft(product);
    const payload = {
      name: draft.name,
      description: draft.description,
      base_price: Number(draft.base_price),
      sale_price:
        draft.sale_price.trim() === '' ? null : Number(draft.sale_price),
      status: product.status,
      is_featured: product.is_featured,
    };

    const res = await fetch(apiUrl(`/products/admin/${product.id}`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      setErrorMessage(data.message || 'Failed to save product.');
      return;
    }

    setMessage(`${product.name} saved successfully.`);
    await loadProducts({ background: true });
  }

  async function saveVariant(
    variant: AdminVariantRow,
    options?: { silent?: boolean },
  ) {
    const token = await getToken();

    let color_hex = normalizeHexColor(variant.color_hex || '');
    if (!color_hex && variant.color.trim().toLowerCase() === 'new color') {
      color_hex = inferColorHexFromName(variant.color);
    }

    const res = await fetch(apiUrl(`/products/admin/variants/${variant.id}`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        size: variant.size,
        color: variant.color,
        sku: variant.sku ?? null,
        stock_quantity: Number(variant.stock_quantity),
        reserved_quantity: Number(variant.reserved_quantity || 0),
        is_active: variant.is_active,
        color_hex: color_hex || null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setErrorMessage(data.message || 'Failed to save stock.');
      return false;
    }

    if (data && typeof data === 'object' && data.id) {
      mergeVariantFromServer(data as Variant);
    }

    if (!options?.silent) {
      setMessage('Stock saved successfully.');
    }
    return true;
  }

  function mergeVariantFromServer(serverVariant: Variant) {
    setProducts((prev) =>
      prev.map((product) => {
        const index = product.product_variants.findIndex(
          (v) => v.id === serverVariant.id,
        );
        if (index < 0) return product;
        const nextVariants = [...product.product_variants];
        const previous = nextVariants[index];
        nextVariants[index] = {
          ...previous,
          ...serverVariant,
          color_hex:
            serverVariant.color_hex ?? previous.color_hex ?? null,
          stock_quantity: Number(serverVariant.stock_quantity ?? 0),
          reserved_quantity: Number(
            serverVariant.reserved_quantity ??
              previous.reserved_quantity ??
              0,
          ),
          is_active: Boolean(serverVariant.is_active),
        };
        return { ...product, product_variants: nextVariants };
      }),
    );
  }

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!expandedId) return;
    const product = productsRef.current.find((p) => p.id === expandedId);
    if (!product) return;
    setProductBasicDrafts((prev) => {
      if (prev[expandedId]) return prev;
      return { ...prev, [expandedId]: basicDraftFromProduct(product) };
    });
  }, [expandedId]);

  const deepLinkKey = searchParams.toString();

  useEffect(() => {
    if (initialLoading) return;

    const catalog = productsRef.current;
    if (catalog.length === 0) return;

    const pid = searchParams.get('productId');
    const slug = searchParams.get('slug');
    let target: string | null = null;

    if (pid && catalog.some((p) => p.id === pid)) {
      target = pid;
    } else if (slug) {
      const found = catalog.find((p) => p.slug === slug);
      target = found?.id ?? null;
    }

    if (!target) return;

    const handleKey = `${target}:${deepLinkKey}`;
    if (deepLinkHandledRef.current === handleKey) {
      return;
    }
    deepLinkHandledRef.current = handleKey;

    setExpandedId(target);
    const el = document.getElementById(`admin-product-${target}`);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [initialLoading, deepLinkKey]);

  return (
    <AdminOnly>
      <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] py-5 text-white sm:px-6 sm:py-8 lg:py-10">
        <Navbar />

        <section className="mx-auto max-w-6xl">
          <div className="mb-6 sm:mb-8">
            <p className="text-xs uppercase tracking-[0.25em] text-red-300 sm:text-sm sm:tracking-[0.35em]">
              Admin Control
            </p>

            <h1 className="mt-3 bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
              Add/Edit Products
            </h1>

            <p className="mt-3 text-sm text-gray-400 sm:text-base">
              Edit product prices, descriptions, visibility, images, and stock.
            </p>
          </div>

          <Link href="/admin/products/new-product" className={buttonPurple}>
            Add New Product
          </Link>

          {message && (
            <div className="mt-6 rounded-2xl border border-purple-300/40 bg-purple-500/10 p-4 text-sm text-purple-100 sm:text-base">
              {message}
            </div>
          )}

          {errorMessage && (
            <div className="mt-6 rounded-2xl border border-red-300/40 bg-red-500/10 p-4 text-sm text-red-100 sm:text-base">
              {errorMessage}
            </div>
          )}

          {initialLoading && products.length === 0 ? (
            <SkeletonAdminProductsList count={4} />
          ) : products.length === 0 ? (
            <PremiumEmptyState
              className="mt-8"
              variant="muted"
              eyebrow="Admin catalog"
              title="No products in the catalog yet."
              description="Create your first piece or check that /products/admin/all is reachable."
              primaryAction={{
                label: 'Add New Product',
                href: '/admin/products/new-product',
              }}
              secondaryAction={{
                label: 'Retry load',
                onClick: () => {
                  void loadProducts();
                },
              }}
            />
          ) : (
            <div className="mt-8 space-y-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  id={`admin-product-${product.id}`}
                  className="scroll-mt-24 rounded-3xl border border-purple-950 bg-[#0d0716] p-4 shadow-[0_18px_60px_rgba(168,85,247,0.18)] sm:p-6"
                >
                  <ProductSummaryCard
                    name={product.name}
                    status={product.status}
                    slug={product.slug}
                    thumbnailUrl={sortedThumbUrl(product)}
                    priceLabel={priceLabel(product)}
                    stockSummary={stockSummaryLine(product)}
                    expanded={expandedId === product.id}
                    onToggle={() =>
                      setExpandedId((cur) =>
                        cur === product.id ? null : product.id,
                      )
                    }
                  />

                  {expandedId === product.id ? (
                    <div className="mt-6 space-y-4 border-t border-purple-950 pt-6">
                      <CollapsiblePanel title="Basic Info" defaultOpen>
                        <AdminProductBasicFields
                          productId={product.id}
                          seed={getBasicDraft(product)}
                          inputClass={inputClass}
                          onDraftChange={(id, draft) =>
                            setProductBasicDrafts((prev) => ({
                              ...prev,
                              [id]: draft,
                            }))
                          }
                        />
                      </CollapsiblePanel>

                      <CollapsiblePanel title="Images">
                        <p className="mb-3 text-xs text-gray-400 sm:text-sm">
                          Upload once, then assign any image to a variant color below.
                          Use <span className="text-purple-200">Save Color Link</span>{' '}
                          on each card — separate from upload.
                        </p>
                        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {product.product_images?.map((image) => {
                            const savedColor = image.color_name?.trim() || null;
                            const colorOptions = uniqueVariantColorNames(
                              product.product_variants,
                            );
                            const selectedColor =
                              imageColorDraft[image.id] ??
                              savedColor ??
                              '';
                            const linkedHex = savedColor
                              ? getVariantColorHexForName(
                                  product.product_variants,
                                  savedColor,
                                )
                              : '#6B7280';
                            const cardImageId = productCardImageId(
                              product.product_images,
                            );
                            const orphanColorLink = isOrphanImageColorLink(
                              savedColor,
                              colorOptions,
                            );

                            return (
                              <AdminImageColorLinkCard
                                key={image.id}
                                imageUrl={image.image_url}
                                altText={image.alt_text || product.name}
                                colorName={savedColor}
                                colorHex={linkedHex}
                                orphanColorLink={orphanColorLink}
                                colorOptions={colorOptions}
                                inputClass={inputClass}
                                saveButtonClass={buttonColorLink}
                                selectedColor={selectedColor}
                                isCardImage={cardImageId === image.id}
                                settingCardImage={settingCardImageId === image.id}
                                onSelectedColorChange={(value) =>
                                  setImageColorDraft((prev) => ({
                                    ...prev,
                                    [image.id]: value,
                                  }))
                                }
                                onSaveColorLink={() =>
                                  void saveImageColorLink(product.id, image.id)
                                }
                                onSetAsCardImage={() =>
                                  void setAsProductCardImage(product.id, image.id)
                                }
                                onRemove={() => setConfirmRemoveImageId(image.id)}
                                saving={savingImageColorId === image.id}
                              />
                            );
                          })}
                        </div>

                        <div className="mt-5 rounded-2xl border border-purple-950 bg-[#0d0716] p-4">
                          <label className="block text-sm font-bold text-purple-200">
                            Add New Image
                          </label>

                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                            onChange={(e) =>
                              selectImage(product.id, e.target.files?.[0] || null)
                            }
                            className="mt-3 w-full rounded-xl border border-purple-950 bg-[#05070d] px-4 py-3 text-sm text-white"
                          />

                          {previews[product.id] && (
                            <div className="mt-4">
                              <p className="mb-2 text-sm text-gray-400">Preview</p>
                              <div className="relative h-56 w-full max-w-md overflow-hidden rounded-2xl border border-purple-950">
                                <OptimizedImage
                                  src={previews[product.id]}
                                  alt="Upload preview"
                                  fill
                                  sizes="448px"
                                  className="object-cover"
                                  noPlaceholder
                                />
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => uploadProductImage(product)}
                            className={`${buttonPurple} mt-4`}
                          >
                            Upload / Save Image
                          </button>
                        </div>
                      </CollapsiblePanel>

                      <CollapsiblePanel title="Stock Variants">
                        <ProductColorGroupsEditor
                          variants={product.product_variants}
                          images={product.product_images}
                          inputClass={inputClass}
                          saveRowButtonClass={buttonPurple}
                          addButtonClass="rounded-full border border-purple-300/40 bg-purple-500/10 px-5 py-2 text-sm font-bold text-purple-100 transition hover:bg-purple-300 hover:text-black"
                          dangerButtonClass={buttonRed}
                          onVariantFieldChange={(variantId, field, value) =>
                            updateVariantLocal(product.id, variantId, field, value)
                          }
                          onColorGroupMetaChange={(variantIds, patch) =>
                            updateColorGroupMetaLocal(
                              product.id,
                              variantIds,
                              patch,
                            )
                          }
                          onSaveVariant={(variant) => void saveVariant(variant)}
                          onSaveColorGroup={(rows, previousColorName) =>
                            void saveColorGroup(
                              product.id,
                              rows,
                              previousColorName,
                            )
                          }
                          onAddSize={(color, color_hex) =>
                            void addSizeToColorGroup(product, color, color_hex)
                          }
                          onAddColor={() => void addColorGroup(product)}
                          onRemoveVariant={(variantId) =>
                            void removeVariantById(variantId)
                          }
                          onRemoveColorGroup={(variantIds) =>
                            void removeColorGroup(variantIds)
                          }
                        />
                      </CollapsiblePanel>

                      <CollapsiblePanel title="Advanced / Status">
                        <select
                          value={product.status}
                          onChange={(e) =>
                            updateProductLocal(product.id, 'status', e.target.value)
                          }
                          className={`${inputClass} w-full md:max-w-md`}
                        >
                          <option value="active">active</option>
                          <option value="inactive">inactive</option>
                          <option value="draft">draft</option>
                        </select>

                        <label className="mt-4 flex items-center gap-3 text-sm text-purple-100 sm:text-base">
                          <input
                            type="checkbox"
                            checked={product.is_featured}
                            onChange={(e) =>
                              updateProductLocal(
                                product.id,
                                'is_featured',
                                e.target.checked,
                              )
                            }
                            className="h-4 w-4 accent-purple-400"
                          />
                          Featured / Show on homepage
                        </label>

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                          <button
                            onClick={() => saveProduct(product)}
                            className={buttonPurple}
                          >
                            Save Product
                          </button>

                          <button
                            onClick={() => setConfirmDeleteProduct(product)}
                            className={buttonRed}
                          >
                            Remove Product
                          </button>
                        </div>
                      </CollapsiblePanel>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <ConfirmModal
        open={confirmRemoveImageId !== null}
        title="Remove this image?"
        description="This removes the image from the product. You can upload a replacement later."
        confirmLabel="Remove image"
        danger
        busy={confirmActionBusy}
        onCancel={() => !confirmActionBusy && setConfirmRemoveImageId(null)}
        onConfirm={async () => {
          if (!confirmRemoveImageId) return;
          setConfirmActionBusy(true);
          try {
            await performRemoveProductImage(confirmRemoveImageId);
            setConfirmRemoveImageId(null);
          } finally {
            setConfirmActionBusy(false);
          }
        }}
      />

      <ConfirmModal
        open={confirmDeleteProduct !== null}
        title={
          confirmDeleteProduct
            ? `Remove “${confirmDeleteProduct.name}”?`
            : 'Remove product?'
        }
        description="This cannot be undone. The product will be removed from the catalog."
        confirmLabel="Remove product"
        danger
        busy={confirmActionBusy}
        onCancel={() => !confirmActionBusy && setConfirmDeleteProduct(null)}
        onConfirm={async () => {
          if (!confirmDeleteProduct) return;
          setConfirmActionBusy(true);
          try {
            await performDeleteProduct(confirmDeleteProduct);
            setConfirmDeleteProduct(null);
          } finally {
            setConfirmActionBusy(false);
          }
        }}
      />
    </AdminOnly>
  );
}

function AdminProductsSuspenseFallback() {
  return (
    <AdminOnly>
      <main className="min-h-screen bg-[#07030d] px-4 py-6 text-white sm:px-6">
        <Navbar />
        <section className="mx-auto max-w-6xl">
          <SkeletonAdminProductsList count={4} />
        </section>
      </main>
    </AdminOnly>
  );
}

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<AdminProductsSuspenseFallback />}>
      <AdminProductsPageContent />
    </Suspense>
  );
}
