import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class InventoryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getLowStock() {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('product_variants')
      .select(`
        id,
        size,
        color,
        sku,
        stock_quantity,
        reserved_quantity,
        products (
          id,
          name,
          slug
        )
      `)
      .lte('stock_quantity', 5)
      .eq('is_active', true)
      .order('stock_quantity', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }
}