import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class WishlistService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private async getUser(token: string) {
    const supabase = this.supabaseService.getClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('Invalid customer token');
    }

    return user;
  }

  async getProductIds(token: string) {
    const user = await this.getUser(token);
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('customer_wishlists')
      .select('product_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    return {
      productIds: (data || []).map((row) => row.product_id as string),
    };
  }

  async getWishlist(token: string) {
    const user = await this.getUser(token);
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('customer_wishlists')
      .select(
        `
        id,
        product_id,
        created_at,
        products (
          id,
          name,
          slug,
          description,
          base_price,
          sale_price,
          status,
          product_images (*),
          product_variants (*)
        )
      `,
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    const items = (data || [])
      .map((row) => {
        const product = Array.isArray(row.products)
          ? row.products[0]
          : row.products;
        if (!product || product.status !== 'active') return null;
        return {
          wishlistId: row.id,
          addedAt: row.created_at,
          product,
        };
      })
      .filter(Boolean);

    return { items };
  }

  async toggleWishlist(token: string, productId: string) {
    const user = await this.getUser(token);
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase.rpc('toggle_wishlist_atomic', {
      p_user_id: user.id,
      p_product_id: productId,
    });

    if (error) {
      const message = String(error.message || '');
      if (message.toLowerCase().includes('product not found')) {
        throw new BadRequestException('Product not found');
      }
      throw new BadRequestException(error.message);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new BadRequestException('Wishlist update failed');
    }

    return {
      wishlisted: Boolean(row.wishlisted),
      firstWishlistRewardGranted: Boolean(row.first_wishlist_reward_granted),
      pointsAwarded: Number(row.points_awarded || 0),
      pointsBalance: Number(row.points_balance || 0),
    };
  }

  async getAdminAnalytics() {
    const supabase = this.supabaseService.getClient();

    const { data: wishlists, error: wishlistError } = await supabase
      .from('customer_wishlists')
      .select('id, user_id, product_id, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (wishlistError) throw new BadRequestException(wishlistError.message);

    const rows = wishlists || [];
    const productCounts = new Map<
      string,
      { productId: string; count: number }
    >();

    for (const row of rows) {
      const productId = String(row.product_id);
      const current = productCounts.get(productId) || {
        productId,
        count: 0,
      };
      current.count += 1;
      productCounts.set(productId, current);
    }

    const topProductIds = [...productCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map((entry) => entry.productId);

    let productsById = new Map<string, Record<string, unknown>>();

    if (topProductIds.length > 0) {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, slug, base_price, sale_price')
        .in('id', topProductIds);

      if (productsError) throw new BadRequestException(productsError.message);

      productsById = new Map(
        (products || []).map((product) => [String(product.id), product]),
      );
    }

    const topWishlistedProducts = [...productCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map((entry) => ({
        productId: entry.productId,
        wishlistCount: entry.count,
        product: productsById.get(entry.productId) || null,
      }));

    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('product_name, quantity, orders!inner(status)')
      .neq('orders.status', 'cancelled')
      .limit(5000);

    if (orderItemsError) throw new BadRequestException(orderItemsError.message);

    const soldByName = new Map<string, number>();
    for (const item of orderItems || []) {
      const name = String(item.product_name || '').trim().toLowerCase();
      if (!name) continue;
      soldByName.set(
        name,
        (soldByName.get(name) || 0) + Number(item.quantity || 0),
      );
    }

    const conversionInsights = topWishlistedProducts.slice(0, 10).map((entry) => {
      const productName = String(
        (entry.product as { name?: string } | null)?.name || '',
      )
        .trim()
        .toLowerCase();
      const unitsSold = productName ? soldByName.get(productName) || 0 : 0;
      return {
        productId: entry.productId,
        productName:
          (entry.product as { name?: string } | null)?.name || 'Unknown',
        wishlistCount: entry.wishlistCount,
        unitsSold,
      };
    });

    const recentActivity = rows.slice(0, 25).map((row) => ({
      id: row.id,
      userId: row.user_id,
      productId: row.product_id,
      createdAt: row.created_at,
      product: productsById.get(String(row.product_id)) || null,
    }));

    return {
      totalWishlists: rows.length,
      uniqueProducts: productCounts.size,
      uniqueCustomers: new Set(rows.map((row) => row.user_id)).size,
      topWishlistedProducts,
      recentActivity,
      conversionInsights,
    };
  }
}
