'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabaseClient';
import { apiUrl } from '@/lib/api';
import AdminOnly from '@/components/AdminOnly';
import { OptimizedImage } from '@/components/images';
import {
  ProductColorGroupsEditor,
  type AdminVariantRow,
} from '@/components/admin/ProductColorGroupsEditor';
import {
  inferColorHexFromName,
  normalizeHexColor,
  uniqueVariantColorNames,
} from '@/lib/productColor';

function newRowId() {
  return crypto.randomUUID();
}

type VariantInput = AdminVariantRow;

type UploadedImage = {
  id: string;
  file: File | null;
  preview: string;
  image_url: string;
  alt_text: string;
  color_name: string;
};

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '');
}

function ProductFormSection({
  title,
  subtitle,
  mobileDefaultOpen,
  desktopDefaultOpen,
  children,
}: {
  title: string;
  subtitle?: string;
  mobileDefaultOpen: boolean;
  desktopDefaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(mobileDefaultOpen);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const sync = () => setOpen(mq.matches ? desktopDefaultOpen : mobileDefaultOpen);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [mobileDefaultOpen, desktopDefaultOpen]);

  return (
    <div className="overflow-hidden rounded-2xl border border-purple-950 bg-[#05070d]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left sm:items-center sm:px-5 sm:py-4"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-purple-200">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-xs text-gray-400">{subtitle}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-purple-300 tabular-nums" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open ? (
        <div className="border-t border-purple-950 px-4 pb-5 pt-3 sm:px-5">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default function NewProductPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    base_price: '',
    sale_price: '',
    status: 'active',
    is_featured: true,
  });

  const [variants, setVariants] = useState<VariantInput[]>([
    {
      id: newRowId(),
      size: 'S',
      color: 'White',
      color_hex: '#FFFFFF',
      stock_quantity: 0,
      reserved_quantity: 0,
      is_active: true,
    },
    {
      id: newRowId(),
      size: 'M',
      color: 'White',
      color_hex: '#FFFFFF',
      stock_quantity: 0,
      reserved_quantity: 0,
      is_active: true,
    },
  ]);

  const [images, setImages] = useState<UploadedImage[]>([
    {
      id: newRowId(),
      file: null,
      preview: '',
      image_url: '',
      alt_text: '',
      color_name: '',
    },
  ]);

  function updateForm(field: string, value: any) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'name' && !prev.slug ? { slug: generateSlug(value) } : {}),
    }));
  }

  function updateVariantField(
    variantId: string,
    field: keyof VariantInput,
    value: string | number | boolean,
  ) {
    setVariants((prev) =>
      prev.map((variant) => {
        if (variant.id !== variantId) return variant;
        if (field === 'stock_quantity') {
          return {
            ...variant,
            stock_quantity: Math.max(0, Number(value) || 0),
          };
        }
        return { ...variant, [field]: value };
      }),
    );
  }

  function updateColorGroupMeta(
    variantIds: string[],
    patch: { color: string; color_hex: string },
  ) {
    const idSet = new Set(variantIds);
    const oldColors = new Set(
      variants
        .filter((v) => idSet.has(v.id))
        .map((v) => v.color.trim().toLowerCase()),
    );

    setVariants((prev) =>
      prev.map((variant) =>
        idSet.has(variant.id)
          ? {
              ...variant,
              color: patch.color,
              color_hex: patch.color_hex,
            }
          : variant,
      ),
    );

    setImages((prev) =>
      prev.map((image) => {
        const linked = image.color_name?.trim().toLowerCase();
        if (!linked || !oldColors.has(linked)) return image;
        return { ...image, color_name: patch.color };
      }),
    );
  }

  function addSizeToColorGroup(color: string, color_hex: string) {
    setVariants((prev) => [
      ...prev,
      {
        id: newRowId(),
        size: '',
        color: color.trim(),
        color_hex:
          normalizeHexColor(color_hex) || inferColorHexFromName(color),
        stock_quantity: 0,
        reserved_quantity: 0,
        is_active: true,
      },
    ]);
  }

  function addColorGroup() {
    const color = 'New Color';
    setVariants((prev) => [
      ...prev,
      {
        id: newRowId(),
        size: 'M',
        color,
        color_hex: inferColorHexFromName(color),
        stock_quantity: 0,
        reserved_quantity: 0,
        is_active: true,
      },
    ]);
  }

  function removeVariantById(variantId: string) {
    setVariants((prev) => prev.filter((variant) => variant.id !== variantId));
  }

  function removeColorGroup(variantIds: string[]) {
    const idSet = new Set(variantIds);
    setVariants((prev) => prev.filter((variant) => !idSet.has(variant.id)));
  }

  function linkImageToColor(imageId: string, colorName: string) {
    setImages((prev) =>
      prev.map((image) =>
        image.id === imageId
          ? { ...image, color_name: colorName.trim() }
          : image,
      ),
    );
  }

  function addImage() {
    setImages((prev) => [
      ...prev,
      {
        id: newRowId(),
        file: null,
        preview: '',
        image_url: '',
        alt_text: '',
        color_name: '',
      },
    ]);
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function updateImageAlt(index: number, value: string) {
    setImages((prev) =>
      prev.map((image, i) =>
        i === index ? { ...image, alt_text: value } : image,
      ),
    );
  }

  function selectImage(index: number, file: File | null) {
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      setMessage('Only JPG, PNG, and WEBP images are allowed.');
      return;
    }

    setImages((prev) =>
      prev.map((image, i) =>
        i === index
          ? {
              ...image,
              file,
              preview: URL.createObjectURL(file),
            }
          : image,
      ),
    );

    setMessage('');
  }

  async function uploadImages(productSlug: string) {
    const uploadedImages = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];

      if (!image.file) continue;

      const fileExt = image.file.name.split('.').pop();
      const safeSlug = productSlug || generateSlug(form.name);
      const fileName = `${safeSlug}-${Date.now()}-${i}.${fileExt}`;
      const filePath = `${safeSlug}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, image.file);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      uploadedImages.push({
        image_url: data.publicUrl,
        alt_text: image.alt_text || form.name,
        color_name: image.color_name.trim() || null,
        sort_order: i + 1,
      });
    }

    return uploadedImages;
  }

  async function submitProduct() {
    if (!form.name.trim()) {
      setMessage('Product name is required.');
      return;
    }

    if (!form.base_price || Number(form.base_price) <= 0) {
      setMessage('Base price must be greater than 0.');
      return;
    }

    if (variants.length === 0) {
      setMessage('Add at least one variant.');
      return;
    }

    const missingImageColor = images.some(
      (image) => image.file && !image.color_name?.trim(),
    );
    if (missingImageColor) {
      setMessage(
        'Link each uploaded image to a color (Images → Link to color).',
      );
      return;
    }

    // Variants/colors are synced from draft color panels via onColorGroupMetaChange.
    const validVariants = variants
      .filter((variant) => variant.size.trim() && variant.color.trim())
      .map((variant) => {
        const color = variant.color.trim().replace(/\s+/g, ' ');
        const compactSize = variant.size.trim().replace(/\s+/g, '');
        const size =
          compactSize.length > 0 &&
          /^[a-z0-9]+$/i.test(compactSize)
            ? compactSize.toUpperCase()
            : variant.size.trim();
        return {
          size,
          color,
          color_hex:
            normalizeHexColor(variant.color_hex || '') ||
            inferColorHexFromName(color),
          stock_quantity: Math.max(0, Number(variant.stock_quantity) || 0),
          is_active: variant.is_active !== false,
        };
      });

    if (validVariants.length === 0) {
      setMessage('Add at least one valid size/color variant.');
      return;
    }

    const hasAtLeastOneImage = images.some((image) => image.file);

    if (!hasAtLeastOneImage) {
      setMessage('Please upload at least one product image.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = '/auth?redirect=/admin/products/new-product';
        return;
      }

      const baseSlug = form.slug.trim() || generateSlug(form.name);
      const finalSlug = `${baseSlug}-${Date.now()}`;
      const uploadedImages = await uploadImages(finalSlug);
      const payload = {
        ...form,
        slug: finalSlug,
        base_price: Number(form.base_price),
        sale_price: form.sale_price ? Number(form.sale_price) : null,
        variants: validVariants,
        images: uploadedImages,
      };

      const res = await fetch(apiUrl('/products/admin'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || 'Failed to create product.');
        return;
      }

      setMessage(`Product created successfully: ${data.slug || finalSlug}`);

      setTimeout(() => {
        window.location.href = '/admin/products';
      }, 1200);
    } catch (err: any) {
      setMessage(err.message || 'Something went wrong while creating product.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-purple-950 bg-[#05070d] px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-purple-300';

  const variantColorOptions = uniqueVariantColorNames(
    variants.map((v) => ({ color: v.color, color_hex: v.color_hex })),
  );

  return (
    <AdminOnly>
     <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] py-5 text-white sm:px-6 sm:py-8 lg:py-10">
      <Navbar />

      <section className="mx-auto max-w-5xl">
        <p className="text-xs uppercase tracking-[0.25em] text-red-300 sm:text-sm">
          Admin Control
        </p>

        <h1 className="mt-3 bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
          Add New Product
        </h1>

        {message && (
          <div className="mt-6 rounded-2xl border border-purple-300/40 bg-purple-500/10 p-4 text-sm text-purple-100 sm:text-base">
            {message}
          </div>
        )}

        <div className="mt-8 space-y-4 rounded-3xl border border-purple-950 bg-[#0d0716] p-4 shadow-[0_18px_60px_rgba(168,85,247,0.18)] sm:p-6">
          <ProductFormSection
            title="Basic Product Info"
            mobileDefaultOpen
            desktopDefaultOpen
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                placeholder="Product name"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                className={inputClass}
              />

              <input
                placeholder="Slug"
                value={form.slug}
                onChange={(e) => updateForm('slug', generateSlug(e.target.value))}
                className={inputClass}
              />

              <input
                type="number"
                placeholder="Base price"
                value={form.base_price}
                onChange={(e) => updateForm('base_price', e.target.value)}
                className={inputClass}
              />

              <input
                type="number"
                placeholder="Sale price optional"
                value={form.sale_price}
                onChange={(e) => updateForm('sale_price', e.target.value)}
                className={inputClass}
              />

              <select
                value={form.status}
                onChange={(e) => updateForm('status', e.target.value)}
                className={inputClass}
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="draft">draft</option>
              </select>

              <label className="flex min-h-12 items-center gap-3 rounded-xl border border-purple-950 bg-[#05070d] px-4 py-3 text-purple-100">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) => updateForm('is_featured', e.target.checked)}
                  className="h-4 w-4 accent-purple-400"
                />
                Show on homepage
              </label>
            </div>

            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => updateForm('description', e.target.value)}
              className="mt-4 min-h-28 w-full rounded-xl border border-purple-950 bg-[#05070d] px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-purple-300"
            />
          </ProductFormSection>

          <ProductFormSection
            title="Images"
            subtitle="Upload files from your device. First image becomes the main photo."
            mobileDefaultOpen={false}
            desktopDefaultOpen
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-400">
                JPG, PNG, or WEBP. Add multiple rows for a gallery.
              </p>
              <button
                type="button"
                onClick={addImage}
                className="shrink-0 rounded-full border border-purple-300/40 bg-purple-500/10 px-5 py-2 font-bold text-purple-100 transition hover:bg-purple-300 hover:text-black"
              >
                Add Image
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  className="rounded-2xl border border-purple-950 bg-[#0d0716] p-4"
                >
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      onChange={(e) =>
                        selectImage(index, e.target.files?.[0] || null)
                      }
                      className="w-full rounded-xl border border-purple-950 bg-[#05070d] px-4 py-3 text-white file:mr-4 file:rounded-full file:border-0 file:bg-purple-300 file:px-4 file:py-2 file:font-bold file:text-black"
                    />

                    <input
                      placeholder="Alt text optional"
                      value={image.alt_text}
                      onChange={(e) => updateImageAlt(index, e.target.value)}
                      className={inputClass}
                    />

                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="rounded-full border border-red-300/40 bg-red-500/10 px-5 py-3 font-bold text-red-100 transition hover:bg-red-300 hover:text-black"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-3">
                    <label className="mb-1.5 block text-xs font-semibold text-purple-200">
                      Link to color
                    </label>
                    <select
                      value={image.color_name || ''}
                      onChange={(e) =>
                        linkImageToColor(image.id, e.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="">— Unlinked —</option>
                      {variantColorOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    {image.color_name ? (
                      <p className="mt-2 text-xs text-emerald-200/90">
                        Linked to{' '}
                        <span className="font-semibold">{image.color_name}</span>
                      </p>
                    ) : (
                      <p className="mt-2 text-[10px] text-gray-500">
                        Choose a variant color above (set color in Variants
                        first).
                      </p>
                    )}
                  </div>

                  {image.preview && (
                    <div className="mt-4">
                      <p className="mb-2 text-sm text-gray-400">Preview</p>
                      <div className="relative h-56 w-full max-w-sm overflow-hidden rounded-2xl border border-purple-950">
                        <OptimizedImage
                          src={image.preview}
                          alt="Upload preview"
                          fill
                          sizes="384px"
                          className="object-cover"
                          noPlaceholder
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ProductFormSection>

          <ProductFormSection
            title="Variants / Stock"
            subtitle="Grouped by color — one swatch per color, sizes underneath"
            mobileDefaultOpen={false}
            desktopDefaultOpen
          >
            <ProductColorGroupsEditor
              draft
              variants={variants}
              images={images
                .filter((image) => image.preview || image.image_url)
                .map((image) => ({
                  id: image.id,
                  image_url: image.preview || image.image_url,
                  alt_text: image.alt_text || null,
                  color_name: image.color_name || null,
                }))}
              inputClass={inputClass}
              saveRowButtonClass="rounded-full border border-purple-300/40 bg-purple-500/10 px-5 py-2 text-sm font-bold text-purple-100"
              addButtonClass="rounded-full border border-purple-300/40 bg-purple-500/10 px-5 py-2 text-sm font-bold text-purple-100 transition hover:bg-purple-300 hover:text-black"
              dangerButtonClass="rounded-full border border-red-300/40 bg-red-500/10 px-5 py-2 text-sm font-bold text-red-100 transition hover:bg-red-300 hover:text-black"
              onVariantFieldChange={updateVariantField}
              onColorGroupMetaChange={updateColorGroupMeta}
              onSaveVariant={() => {}}
              onSaveColorGroup={() => {}}
              onAddSize={addSizeToColorGroup}
              onAddColor={addColorGroup}
              onRemoveVariant={removeVariantById}
              onRemoveColorGroup={removeColorGroup}
              onLinkImageToColor={linkImageToColor}
              unlinkedImages={images
                .filter(
                  (image) =>
                    (image.preview || image.image_url) &&
                    !image.color_name?.trim(),
                )
                .map((image) => ({
                  id: image.id,
                  image_url: image.preview || image.image_url,
                  alt_text: image.alt_text || null,
                  color_name: null,
                }))}
            />
          </ProductFormSection>

          <ProductFormSection
            title="Save"
            subtitle="Publish this product to the catalog."
            mobileDefaultOpen
            desktopDefaultOpen
          >
            <button
              type="button"
              onClick={submitProduct}
              disabled={loading}
              className="min-h-14 w-full rounded-full border border-purple-300 bg-purple-300 px-7 py-4 font-black text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 sm:hover:-translate-y-1"
            >
              {loading ? 'Creating Product...' : 'Create Product'}
            </button>
          </ProductFormSection>
        </div>
      </section>
      </main>
  </AdminOnly>
  );
}