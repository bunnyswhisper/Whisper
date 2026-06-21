import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseService } from '../../supabase/supabase.service';
import { FINANCE_CATEGORIES } from './finance.constants';
import {
  CreateFinanceEntryDto,
  FinanceQueryDto,
  UpdateFinanceEntryDto,
} from './dto/finance-entry.dto';

type FinanceEntryRow = {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  category: string;
  subcategory: string | null;
  note: string | null;
  entry_date: string;
  product_id: string | null;
  variant_id: string | null;
  custom_item_name: string | null;
  supplier_note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  products?: { id: string; name: string; slug: string } | null;
  product_variants?: {
    id: string;
    size: string;
    color: string;
  } | null;
};

@Injectable()
export class FinanceService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private selectQuery() {
    return `
      *,
      products ( id, name, slug ),
      product_variants ( id, size, color )
    `;
  }

  private mapEntry(row: FinanceEntryRow) {
    const product = Array.isArray(row.products)
      ? row.products[0]
      : row.products;
    const variant = Array.isArray(row.product_variants)
      ? row.product_variants[0]
      : row.product_variants;

    return {
      id: row.id,
      type: row.type,
      amount: Number(row.amount),
      currency: row.currency,
      category: row.category,
      subcategory: row.subcategory,
      note: row.note,
      entryDate: row.entry_date,
      productId: row.product_id,
      variantId: row.variant_id,
      customItemName: row.custom_item_name,
      supplierNote: row.supplier_note,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      product: product || null,
      variant: variant || null,
    };
  }

  private buildPayload(
    body: CreateFinanceEntryDto | UpdateFinanceEntryDto,
    createdBy?: string,
  ) {
    return {
      type: body.type,
      amount: body.amount,
      currency: (body.currency || 'EGP').trim().toUpperCase(),
      category: body.category.trim(),
      subcategory: body.subcategory?.trim() || null,
      note: body.note?.trim() || null,
      entry_date: body.entryDate,
      product_id: body.productId || null,
      variant_id: body.variantId || null,
      custom_item_name: body.customItemName?.trim() || null,
      supplier_note: body.supplierNote?.trim() || null,
      ...(createdBy ? { created_by: createdBy } : {}),
      updated_at: new Date().toISOString(),
    };
  }

  async resolveAdminEmail(req: Request): Promise<string> {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new BadRequestException('Missing admin token');
    }
    const token = auth.replace('Bearer ', '');
    const supabase = this.supabaseService.getClient();
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    return user?.email || 'admin';
  }

  getCategories() {
    return { categories: [...FINANCE_CATEGORIES] };
  }

  async listEntries(query: FinanceQueryDto) {
    const supabase = this.supabaseService.getClient();
    let request = supabase
      .from('finance_entries')
      .select(this.selectQuery())
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (query.from) request = request.gte('entry_date', query.from);
    if (query.to) request = request.lte('entry_date', query.to);
    if (query.type) request = request.eq('type', query.type);
    if (query.category) request = request.eq('category', query.category);
    if (query.productId) request = request.eq('product_id', query.productId);

    const limit = Math.min(Math.max(query.limit ?? 500, 1), 1000);
    const offset = Math.min(Math.max(query.offset ?? 0, 0), 10000);

    const { data, error } = await request.range(offset, offset + limit - 1);
    if (error) throw new BadRequestException(error.message);

    const entries = (data || []).map((row) =>
      this.mapEntry(row as unknown as FinanceEntryRow),
    );

    return {
      entries,
      summary: this.buildSummary(entries),
    };
  }

  private buildSummary(
    entries: ReturnType<FinanceService['mapEntry']>[],
  ) {
    const totalIncome = entries
      .filter((entry) => entry.type === 'income')
      .reduce((sum, entry) => sum + entry.amount, 0);
    const totalExpenses = entries
      .filter((entry) => entry.type === 'expense')
      .reduce((sum, entry) => sum + entry.amount, 0);

    const expensesByCategory = new Map<string, number>();
    const monthly = new Map<string, { income: number; expense: number }>();

    for (const entry of entries) {
      if (entry.type === 'expense') {
        expensesByCategory.set(
          entry.category,
          (expensesByCategory.get(entry.category) || 0) + entry.amount,
        );
      }

      const monthKey = String(entry.entryDate || '').slice(0, 7);
      if (!monthKey) continue;
      const bucket = monthly.get(monthKey) || { income: 0, expense: 0 };
      if (entry.type === 'income') bucket.income += entry.amount;
      else bucket.expense += entry.amount;
      monthly.set(monthKey, bucket);
    }

    const topCostCategories = [...expensesByCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    const monthlyTrend = [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month,
        income: Number(values.income.toFixed(2)),
        expense: Number(values.expense.toFixed(2)),
        net: Number((values.income - values.expense).toFixed(2)),
      }));

    return {
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      netBalance: Number((totalIncome - totalExpenses).toFixed(2)),
      expensesByCategory: topCostCategories,
      monthlyTrend,
    };
  }

  async createEntry(body: CreateFinanceEntryDto, req: Request) {
    const supabase = this.supabaseService.getClient();
    const createdBy = await this.resolveAdminEmail(req);

    const { data, error } = await supabase
      .from('finance_entries')
      .insert(this.buildPayload(body, createdBy))
      .select(this.selectQuery())
      .single();

    if (error) throw new BadRequestException(error.message);
    return this.mapEntry(data as unknown as FinanceEntryRow);
  }

  async updateEntry(id: string, body: UpdateFinanceEntryDto) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('finance_entries')
      .update(this.buildPayload(body))
      .eq('id', id)
      .select(this.selectQuery())
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Finance entry not found');
    return this.mapEntry(data as unknown as FinanceEntryRow);
  }

  async deleteEntry(id: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('finance_entries').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }
}
