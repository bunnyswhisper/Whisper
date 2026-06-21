import { apiUrl } from '@/lib/api';

export type WishlistAnalytics = {
  totalWishlists: number;
  uniqueProducts: number;
  uniqueCustomers: number;
  topWishlistedProducts: {
    productId: string;
    wishlistCount: number;
    product: {
      id: string;
      name: string;
      slug: string;
      base_price?: number;
      sale_price?: number | null;
    } | null;
  }[];
  recentActivity: {
    id: string;
    userId: string;
    productId: string;
    createdAt: string;
    product: {
      id: string;
      name: string;
      slug: string;
    } | null;
  }[];
  conversionInsights: {
    productId: string;
    productName: string;
    wishlistCount: number;
    unitsSold: number;
  }[];
};

export async function fetchAdminWishlistAnalytics(
  token: string,
): Promise<WishlistAnalytics> {
  const res = await fetch(apiUrl('/admin/wishlist/analytics'), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to load wishlist analytics');
  }

  return res.json();
}
