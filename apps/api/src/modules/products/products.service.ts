import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

function normalizeAdminSize(raw: unknown): string {
  const trimmed = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (lower === 'one size' || lower === 'onesize') return 'One Size';

  const compact = trimmed.replace(/\s+/g, '');
  if (/^[a-z0-9]+$/i.test(compact)) {
    return compact.toUpperCase();
  }

  return trimmed;
}

function normalizeAdminColor(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeVariantColorHex(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  const withHash = value.startsWith('#') ? value : `#${value}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) {
    return null;
  }

  return withHash.toUpperCase();
}

function variantColorSizeKey(color: string, size: string): string {
  return `${color.trim().toLowerCase()}::${normalizeAdminSize(size).toLowerCase()}`;
}

function sanitizeImageColorName(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = normalizeAdminColor(raw).replace(/[<>"'`]/g, '').slice(0, 64);
  return cleaned || null;
}

@Injectable()
export class ProductsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    const supabase = this.supabaseService.getClient();
  
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        categories (*),
        product_images (*),
        product_variants (*)
      `)
      .eq('status', 'active')
      .eq('is_featured', true)
      .order('created_at', { ascending: false });
  
    if (error) throw new BadRequestException(error.message);
  
    return data;
  }
  async createProduct(body: any) {
    const supabase = this.supabaseService.getClient();
  
    const slug =
      body.slug ||
      body.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
  
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        category_id: body.category_id || null,
        name: body.name,
        slug,
        description: body.description,
        base_price: Number(body.base_price),
        sale_price:
          body.sale_price === '' || body.sale_price === null
            ? null
            : Number(body.sale_price),
        status: body.status || 'active',
        is_featured: Boolean(body.is_featured),
      })
      .select()
      .single();
  
    if (productError) throw new BadRequestException(productError.message);

    const variantRows: Record<string, unknown>[] = [];
    const seenVariantKeys = new Set<string>();

    for (const variant of body.variants ?? []) {
      const color = normalizeAdminColor(variant.color);
      const size = normalizeAdminSize(variant.size);
      if (!color || !size) continue;

      const key = variantColorSizeKey(color, size);
      if (seenVariantKeys.has(key)) continue;
      seenVariantKeys.add(key);

      const colorHex = normalizeVariantColorHex(variant.color_hex);
      const row: Record<string, unknown> = {
        product_id: product.id,
        size,
        color,
        sku: variant.sku ? String(variant.sku).trim() : null,
        stock_quantity: Math.max(
          0,
          Math.floor(Number(variant.stock_quantity ?? 0)),
        ),
        reserved_quantity: 0,
        is_active: variant.is_active === false ? false : true,
      };
      if (colorHex) {
        row.color_hex = colorHex;
      }
      variantRows.push(row);
    }

    if (variantRows.length === 0) {
      throw new BadRequestException('Add at least one valid size/color variant.');
    }

    const { error: variantError } = await supabase
      .from('product_variants')
      .insert(variantRows);

    if (variantError) throw new BadRequestException(variantError.message);

    const images = (body.images ?? [])
      .filter((image: any) => String(image?.image_url ?? '').trim())
      .map((image: any, index: number) => {
        const sortOrder = Number(image.sort_order);
        const colorName = sanitizeImageColorName(image.color_name);
        return {
          product_id: product.id,
          image_url: String(image.image_url).trim(),
          alt_text: image.alt_text || product.name,
          sort_order:
            Number.isFinite(sortOrder) && sortOrder > 0 ? sortOrder : index + 1,
          color_name: colorName,
        };
      });
  
    if (images.length > 0) {
      const { error: imageError } = await supabase
        .from('product_images')
        .insert(images);
  
      if (imageError) throw new BadRequestException(imageError.message);
    }
  
    return {
      message: 'Product created successfully',
      productId: product.id,
      slug,
    };
  }

  async deleteProduct(id: string) {
    const supabase = this.supabaseService.getClient();
  
    await supabase.from('product_images').delete().eq('product_id', id);
    await supabase.from('product_variants').delete().eq('product_id', id);
  
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
  
    if (error) throw new BadRequestException(error.message);
  
    return { message: 'Product removed successfully' };
  }


  async addProductImage(productId: string, body: any) {
    const supabase = this.supabaseService.getClient();
  
    const { data, error } = await supabase
      .from('product_images')
      .insert({
        product_id: productId,
        image_url: body.image_url,
        alt_text: body.alt_text || null,
        sort_order: body.sort_order || 99,
      })
      .select()
      .single();
  
    if (error) throw new BadRequestException(error.message);
  
    return data;
  }
  
  async renameProductImageColorLinks(
    productId: string,
    body: { old_color_name?: string; new_color_name?: string },
  ) {
    const supabase = this.supabaseService.getClient();

    const oldColor = normalizeAdminColor(body.old_color_name);
    const newColor = normalizeAdminColor(body.new_color_name);

    if (!oldColor || !newColor) {
      throw new BadRequestException(
        'old_color_name and new_color_name are required.',
      );
    }

    if (oldColor.toLowerCase() === newColor.toLowerCase()) {
      return { updated: 0, color_name: newColor };
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .maybeSingle();

    if (productError) throw new BadRequestException(productError.message);
    if (!product) throw new BadRequestException('Product not found.');

    const { data: images, error: imagesError } = await supabase
      .from('product_images')
      .select('id, color_name')
      .eq('product_id', productId);

    if (imagesError) throw new BadRequestException(imagesError.message);

    const oldKey = oldColor.toLowerCase();
    let updated = 0;

    for (const row of images ?? []) {
      const linked = String(row.color_name ?? '').trim().toLowerCase();
      if (!linked || linked !== oldKey) continue;

      const { error: updateError } = await supabase
        .from('product_images')
        .update({ color_name: newColor })
        .eq('id', row.id);

      if (updateError) throw new BadRequestException(updateError.message);
      updated += 1;
    }

    return { updated, color_name: newColor };
  }

  async updateProductImage(imageId: string, body: any) {
    const supabase = this.supabaseService.getClient();

    if (body?.set_as_card_image === true) {
      return this.promoteProductCardImage(imageId);
    }

    const updateData: Record<string, string | null> = {};

    if (Object.prototype.hasOwnProperty.call(body, 'color_name')) {
      const raw = body.color_name;
      if (raw === null || raw === undefined || String(raw).trim() === '') {
        updateData.color_name = null;
      } else {
        const cleaned = String(raw)
          .trim()
          .replace(/[<>"'`]/g, '')
          .slice(0, 64);
        updateData.color_name = cleaned || null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No image fields to update.');
    }

    const { data, error } = await supabase
      .from('product_images')
      .update(updateData)
      .eq('id', imageId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    return data;
  }

  /** Card/catalog image = sort_order 1; uses existing column (no is_featured). */
  private async promoteProductCardImage(imageId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: featured, error: featuredError } = await supabase
      .from('product_images')
      .select('id, product_id')
      .eq('id', imageId)
      .maybeSingle();

    if (featuredError) throw new BadRequestException(featuredError.message);
    if (!featured) throw new BadRequestException('Image not found.');

    const { data: siblings, error: siblingsError } = await supabase
      .from('product_images')
      .select('id, sort_order')
      .eq('product_id', featured.product_id)
      .order('sort_order', { ascending: true });

    if (siblingsError) throw new BadRequestException(siblingsError.message);

    const others = (siblings ?? []).filter((row) => row.id !== imageId);
    let order = 2;
    for (const row of others) {
      const { error } = await supabase
        .from('product_images')
        .update({ sort_order: order++ })
        .eq('id', row.id);
      if (error) throw new BadRequestException(error.message);
    }

    const { data, error } = await supabase
      .from('product_images')
      .update({ sort_order: 1 })
      .eq('id', imageId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    return data;
  }

  async deleteProductImage(imageId: string) {
    const supabase = this.supabaseService.getClient();
  
    const { error } = await supabase
      .from('product_images')
      .delete()
      .eq('id', imageId);
  
    if (error) throw new BadRequestException(error.message);
  
    return { message: 'Image removed successfully' };
  }

  async findAllForAdmin() {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        categories (*),
        product_images (*),
        product_variants (*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    return data;
  }

  async findBySlug(slug: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        categories (*),
        product_images (*),
        product_variants (*)
      `)
      .eq('slug', slug)
      .eq('status', 'active')
      .single();

    if (error) throw new BadRequestException(error.message);

    return data;
  }

  async updateProduct(id: string, body: any) {
    const supabase = this.supabaseService.getClient();

    const updateData = {
      name: body.name,
      description: body.description,
      base_price: Number(body.base_price),
      sale_price:
        body.sale_price === '' || body.sale_price === null
          ? null
          : Number(body.sale_price),
      status: body.status,
      is_featured: Boolean(body.is_featured),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    return data;
  }

  async createVariant(productId: string, body: any) {
    const supabase = this.supabaseService.getClient();

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .maybeSingle();

    if (productError) throw new BadRequestException(productError.message);
    if (!product) {
      throw new BadRequestException('Product not found.');
    }

    const color = normalizeAdminColor(body.color);
    if (!color) {
      throw new BadRequestException('Color is required.');
    }

    const size = normalizeAdminSize(body.size);
    const stockQuantity = Math.max(
      0,
      Math.floor(Number(body.stock_quantity ?? 0)),
    );
    const colorHex = normalizeVariantColorHex(body.color_hex);

    const { data: existingVariants, error: existingError } = await supabase
      .from('product_variants')
      .select('id, size, color')
      .eq('product_id', productId);

    if (existingError) throw new BadRequestException(existingError.message);

    const nextKey = variantColorSizeKey(color, size);
    const duplicate = (existingVariants ?? []).find(
      (row) => variantColorSizeKey(row.color, row.size) === nextKey,
    );

    if (duplicate) {
      throw new BadRequestException(
        `A variant for "${color}" / "${size || '(set size)'}" already exists.`,
      );
    }

    const insertRow: Record<string, unknown> = {
      product_id: productId,
      size,
      color,
      sku: body.sku ? String(body.sku).trim() : null,
      stock_quantity: stockQuantity,
      reserved_quantity: 0,
      is_active: body.is_active === false ? false : true,
    };

    if (colorHex) {
      insertRow.color_hex = colorHex;
    }

    const { data, error } = await supabase
      .from('product_variants')
      .insert(insertRow)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException(
          `A variant for "${color}" / "${size || '(set size)'}" already exists.`,
        );
      }
      throw new BadRequestException(error.message);
    }

    return data;
  }

  async updateVariant(id: string, body: any) {
    const supabase = this.supabaseService.getClient();

    const updateData: Record<string, unknown> = {
      size: normalizeAdminSize(body.size),
      color: normalizeAdminColor(body.color),
      sku: body.sku || null,
      stock_quantity: Number(body.stock_quantity),
      reserved_quantity: Number(body.reserved_quantity || 0),
      is_active: Boolean(body.is_active),
    };

    if (Object.prototype.hasOwnProperty.call(body, 'color_hex')) {
      const colorHex = normalizeVariantColorHex(body.color_hex);
      updateData.color_hex = colorHex;
    }

    const { data, error } = await supabase
      .from('product_variants')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    return data;
  }

  async deleteVariant(id: string) {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('product_variants')
      .delete()
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);

    return { message: 'Variant removed successfully' };
  }
}