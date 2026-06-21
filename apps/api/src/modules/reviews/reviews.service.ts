import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseService } from '../../supabase/supabase.service';
import { OrderEmailService } from '../email/order-email.service';
import { shortIdForLog } from '../../common/safe-log';
import type { SubmitReviewDto } from './dto/submit-review.dto';
import type { PublicSubmitReviewDto } from './dto/public-submit-review.dto';
import type { AdminReviewReplyDto } from './dto/admin-review-reply.dto';
import {
  isValidNormalizedPhone,
  normalizeReviewPhone,
  splitReviewPhoneForPrefill,
} from './review-phone.util';
import type {
  AdminReviewDto,
  AdminReviewsListResponse,
  AdminReplyVisibility,
  ListAdminReviewsQuery,
  ListReviewsQuery,
  PublicReviewDto,
  PublicReviewsListResponse,
  PublicSubmitReviewResponse,
  ReviewInvitePrefill,
  ReviewInviteResponse,
  ReviewModerationState,
  ReviewSource,
} from './reviews.types';

type OrderItemRow = {
  product_name?: string | null;
  quantity?: number | null;
};

type OrderInviteRow = {
  id: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  order_items?: OrderItemRow[] | null;
};

type ReviewDbRow = {
  id: string;
  order_id: string | null;
  rating: number;
  reviewer_name: string | null;
  review_text: string | null;
  created_at: string;
  is_hidden?: boolean;
  hidden_at?: string | null;
  hidden_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  admin_reply?: string | null;
  admin_reply_visibility?: string | null;
  admin_reply_created_at?: string | null;
  admin_reply_updated_at?: string | null;
  admin_reply_by?: string | null;
  source?: string | null;
  is_approved?: boolean;
  approved_at?: string | null;
  approved_by?: string | null;
  public_product_name?: string | null;
  reviewer_email?: string | null;
  reviewer_phone_country_code?: string | null;
  reviewer_phone_raw?: string | null;
  reviewer_phone_normalized?: string | null;
};

const MIN_TOKEN_LENGTH = 16;
const MAX_TOKEN_LENGTH = 256;
const REVIEW_SELECT =
  'id, order_id, rating, reviewer_name, review_text, created_at, is_hidden, hidden_at, hidden_by, deleted_at, deleted_by, admin_reply, admin_reply_visibility, admin_reply_created_at, admin_reply_updated_at, admin_reply_by, source, is_approved, approved_at, approved_by, public_product_name, reviewer_email, reviewer_phone_country_code, reviewer_phone_raw, reviewer_phone_normalized';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly orderEmailService: OrderEmailService,
  ) {}

  async resolveAdminEmail(request: Request): Promise<string> {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing admin token');
    }
    const token = authHeader.replace('Bearer ', '');
    const supabase = this.supabaseService.getClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user?.email) {
      throw new UnauthorizedException('Invalid admin token');
    }
    return user.email;
  }

  private normalizeToken(raw: string): string {
    const token = String(raw || '').trim();
    if (
      token.length < MIN_TOKEN_LENGTH ||
      token.length > MAX_TOKEN_LENGTH ||
      !/^[A-Za-z0-9_-]+$/.test(token)
    ) {
      throw new NotFoundException('This review link is invalid or has expired.');
    }
    return token;
  }

  private buildInvitePrefill(order: OrderInviteRow): ReviewInvitePrefill {
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    const productNames = items
      .map((i) => String(i.product_name || '').trim())
      .filter(Boolean);
    const publicProductName =
      productNames.length > 0 ? productNames.slice(0, 3).join(' · ') : null;

    const phoneRaw = String(order.customer_phone || '').trim();
    const { countryCode, local } = splitReviewPhoneForPrefill(phoneRaw);

    return {
      reviewerName: String(order.customer_name || '').trim() || null,
      reviewerEmail:
        String(order.customer_email || '').trim().toLowerCase() || null,
      reviewerPhoneCountryCode: local ? countryCode : null,
      reviewerPhone: local || null,
      publicProductName,
    };
  }

  shortOrderRef(orderId: string): string {
    return String(orderId).replace(/-/g, '').slice(0, 8).toUpperCase();
  }

  private productNamesFromItems(items: OrderItemRow[] | null): string[] {
    if (!items?.length) return [];
    const seen = new Set<string>();
    const names: string[] = [];
    for (const item of items) {
      const name = String(item.product_name || '').trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      names.push(name);
    }
    return names;
  }

  private moderationState(row: ReviewDbRow): ReviewModerationState {
    if (row.deleted_at) return 'deleted';
    if (row.is_hidden) return 'hidden';
    if (row.is_approved === false) return 'pending';
    return 'active';
  }

  private productNamesForRow(
    row: ReviewDbRow,
    orderMap: Map<string, { status: string | null; order_items: OrderItemRow[] }>,
  ): string[] {
    const fromOrder = this.productNamesFromItems(
      orderMap.get(String(row.order_id || ''))?.order_items ?? null,
    );
    if (fromOrder.length) return fromOrder;
    const manual = String(row.public_product_name || '').trim();
    return manual ? [manual] : [];
  }

  private parseListQuery(
    query: ListReviewsQuery,
    paging: { defaultLimit: number; maxLimit: number; maxOffset: number },
  ): {
    rating?: number;
    product?: string;
    sort: 'newest' | 'oldest';
    limit: number;
    offset: number;
    search?: string;
  } {
    return {
      rating: query.rating,
      product: query.product?.trim() || undefined,
      sort: query.sort === 'oldest' ? 'oldest' : 'newest',
      limit: Math.min(Math.max(query.limit ?? paging.defaultLimit, 1), paging.maxLimit),
      offset: Math.min(Math.max(query.offset ?? 0, 0), paging.maxOffset),
      search: query.search?.trim() || undefined,
    };
  }

  private paginationMeta(
    total: number,
    limit: number,
    offset: number,
  ): { total: number; limit: number; offset: number; hasPrevious: boolean; hasNext: boolean } {
    return {
      total,
      limit,
      offset,
      hasPrevious: offset > 0,
      hasNext: offset + limit < total,
    };
  }

  private async reviewIdsForProductFilter(product: string): Promise<string[]> {
    const supabase = this.supabaseService.getClient();
    const safe = product.replace(/[%_]/g, '');
    const ids = new Set<string>();

    const { data: items, error: itemsErr } = await supabase
      .from('order_items')
      .select('order_id')
      .ilike('product_name', `%${safe}%`);

    if (itemsErr) {
      throw new BadRequestException(itemsErr.message);
    }

    if (items?.length) {
      const orderIds = [...new Set(items.map((r) => String(r.order_id)))];
      const { data: linked } = await supabase
        .from('customer_reviews')
        .select('id')
        .in('order_id', orderIds);
      (linked || []).forEach((r) => ids.add(String(r.id)));
    }

    const { data: publicRows, error: pubErr } = await supabase
      .from('customer_reviews')
      .select('id')
      .eq('source', 'public')
      .ilike('public_product_name', `%${safe}%`);

    if (pubErr) {
      throw new BadRequestException(pubErr.message);
    }

    (publicRows || []).forEach((r) => ids.add(String(r.id)));

    return [...ids];
  }

  private async fetchOrdersMap(orderIds: (string | null)[]) {
    const ids = orderIds.filter((id): id is string => Boolean(id));
    if (!ids.length) {
      return new Map<string, { status: string | null; order_items: OrderItemRow[] }>();
    }

    const supabase = this.supabaseService.getClient();
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, order_items(product_name, quantity)')
      .in('id', ids);

    return new Map(
      (orders || []).map((o) => [
        String(o.id),
        {
          status: (o as { status?: string | null }).status ?? null,
          order_items: ((o as { order_items?: OrderItemRow[] }).order_items ??
            []) as OrderItemRow[],
        },
      ]),
    );
  }

  private async loadReviewsFiltered(options: {
    publicOnly: boolean;
    state?: 'active' | 'pending' | 'hidden' | 'deleted' | 'all';
    query: ListReviewsQuery;
    paging: { defaultLimit: number; maxLimit: number; maxOffset: number };
  }): Promise<{ rows: ReviewDbRow[]; total: number; limit: number; offset: number }> {
    const supabase = this.supabaseService.getClient();
    const parsed = this.parseListQuery(options.query, options.paging);

    let reviewIdsFilter: string[] | undefined;
    if (parsed.product) {
      reviewIdsFilter = await this.reviewIdsForProductFilter(parsed.product);
      if (!reviewIdsFilter.length) {
        return { rows: [], total: 0, limit: parsed.limit, offset: parsed.offset };
      }
    }

    let dbQuery = supabase.from('customer_reviews').select(REVIEW_SELECT, {
      count: 'exact',
    });

    if (options.publicOnly) {
      dbQuery = dbQuery
        .eq('is_hidden', false)
        .is('deleted_at', null)
        .eq('is_approved', true);
    } else if (options.state === 'active') {
      dbQuery = dbQuery
        .eq('is_hidden', false)
        .is('deleted_at', null)
        .eq('is_approved', true);
    } else if (options.state === 'pending') {
      dbQuery = dbQuery.is('deleted_at', null).eq('is_approved', false);
    } else if (options.state === 'hidden') {
      dbQuery = dbQuery.eq('is_hidden', true).is('deleted_at', null);
    } else if (options.state === 'deleted') {
      dbQuery = dbQuery.not('deleted_at', 'is', null);
    }

    if (parsed.rating) {
      dbQuery = dbQuery.eq('rating', parsed.rating);
    }

    if (reviewIdsFilter?.length) {
      dbQuery = dbQuery.in('id', reviewIdsFilter);
    }

    if (parsed.search) {
      const q = parsed.search.replace(/[%_]/g, '');
      if (q) {
        dbQuery = dbQuery.or(
          `reviewer_name.ilike.%${q}%,review_text.ilike.%${q}%`,
        );
      }
    }

    dbQuery = dbQuery
      .order('created_at', { ascending: parsed.sort === 'oldest' })
      .range(parsed.offset, parsed.offset + parsed.limit - 1);

    const { data, error, count } = await dbQuery;

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      rows: (data || []) as ReviewDbRow[],
      total: count ?? 0,
      limit: parsed.limit,
      offset: parsed.offset,
    };
  }

  private toPublicReview(
    row: ReviewDbRow,
    orderMap: Map<string, { status: string | null; order_items: OrderItemRow[] }>,
  ): PublicReviewDto {
    const replyText = row.admin_reply?.trim() ?? '';

    return {
      id: String(row.id),
      rating: Number(row.rating),
      reviewerName: row.reviewer_name?.trim() || 'Customer',
      reviewText: row.review_text ?? null,
      createdAt: String(row.created_at),
      orderRef: row.order_id
        ? this.shortOrderRef(String(row.order_id))
        : null,
      productNames: this.productNamesForRow(row, orderMap),
      isVerified: row.source === 'order_token' || Boolean(row.order_id),
      adminPublicReply: replyText ? replyText : null,
      adminReplyCreatedAt: replyText && row.admin_reply_created_at
        ? String(row.admin_reply_created_at)
        : null,
    };
  }

  private toAdminReview(
    row: ReviewDbRow,
    orderMap: Map<string, { status: string | null; order_items: OrderItemRow[] }>,
  ): AdminReviewDto {
    const order = row.order_id
      ? orderMap.get(String(row.order_id))
      : undefined;
    const source = (row.source === 'public' ? 'public' : 'order_token') as ReviewSource;

    return {
      id: String(row.id),
      orderRef: row.order_id
        ? this.shortOrderRef(String(row.order_id))
        : null,
      rating: Number(row.rating),
      reviewerName: row.reviewer_name ?? null,
      reviewText: row.review_text ?? null,
      createdAt: String(row.created_at),
      state: this.moderationState(row),
      source,
      isApproved: row.is_approved !== false,
      productNames: this.productNamesForRow(row, orderMap),
      orderStatus: order?.status ?? null,
      isHidden: Boolean(row.is_hidden),
      hiddenAt: row.hidden_at ? String(row.hidden_at) : null,
      hiddenBy: row.hidden_by ?? null,
      deletedAt: row.deleted_at ? String(row.deleted_at) : null,
      deletedBy: row.deleted_by ?? null,
      adminReply: row.admin_reply ?? null,
      adminReplyVisibility: 'public',
      adminReplyCreatedAt: row.admin_reply_created_at
        ? String(row.admin_reply_created_at)
        : null,
      adminReplyUpdatedAt: row.admin_reply_updated_at
        ? String(row.admin_reply_updated_at)
        : null,
      adminReplyBy: row.admin_reply_by ?? null,
      reviewerEmail: row.reviewer_email ?? null,
      reviewerPhoneCountryCode: row.reviewer_phone_country_code ?? null,
      reviewerPhoneRaw: row.reviewer_phone_raw ?? null,
      reviewerPhoneNormalized: row.reviewer_phone_normalized ?? null,
    };
  }

  async listPublicReviews(
    query: ListReviewsQuery,
  ): Promise<PublicReviewsListResponse> {
    const paging = { defaultLimit: 5, maxLimit: 5, maxOffset: 500 };
    const { rows, total, limit, offset } = await this.loadReviewsFiltered({
      publicOnly: true,
      query,
      paging,
    });

    const orderMap = await this.fetchOrdersMap(rows.map((r) => r.order_id));

    return {
      reviews: rows.map((r) => this.toPublicReview(r, orderMap)),
      ...this.paginationMeta(total, limit, offset),
    };
  }

  async listAdminReviews(
    query: ListAdminReviewsQuery,
  ): Promise<AdminReviewsListResponse> {
    const paging = { defaultLimit: 10, maxLimit: 10, maxOffset: 2000 };
    const state = query.state ?? 'active';
    const { rows, total, limit, offset } = await this.loadReviewsFiltered({
      publicOnly: false,
      state,
      query,
      paging,
    });

    const orderMap = await this.fetchOrdersMap(rows.map((r) => r.order_id));

    return {
      reviews: rows.map((r) => this.toAdminReview(r, orderMap)),
      ...this.paginationMeta(total, limit, offset),
    };
  }

  async getInviteByToken(rawToken: string): Promise<ReviewInviteResponse> {
    const token = this.normalizeToken(rawToken);
    const hash = this.orderEmailService.hashReviewToken(token);
    const supabase = this.supabaseService.getClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select(
        'id, status, customer_name, customer_email, customer_phone, order_items(product_name, quantity)',
      )
      .eq('review_token_hash', hash)
      .maybeSingle();

    if (error) {
      this.logger.warn(`[reviewInvite] lookup error: ${error.message}`);
      throw new NotFoundException('This review link is invalid or has expired.');
    }

    if (!order?.id) {
      throw new NotFoundException('This review link is invalid or has expired.');
    }

    const { data: existing } = await supabase
      .from('customer_reviews')
      .select(REVIEW_SELECT)
      .eq('order_id', order.id)
      .maybeSingle();

    const alreadyReviewed = Boolean(existing?.id);
    const orderRef = this.shortOrderRef(String(order.id));
    const base: ReviewInviteResponse = {
      orderRef,
      canSubmit: !alreadyReviewed,
      alreadyReviewed,
    };

    if (!existing) {
      return {
        ...base,
        prefill: this.buildInvitePrefill(order as OrderInviteRow),
      };
    }

    const row = existing as ReviewDbRow;
    const replyText = row.admin_reply?.trim();
    const adminReply = replyText
      ? {
          text: replyText,
          visibility: 'public' as AdminReplyVisibility,
          createdAt: row.admin_reply_created_at
            ? String(row.admin_reply_created_at)
            : String(row.created_at),
          updatedAt: row.admin_reply_updated_at
            ? String(row.admin_reply_updated_at)
            : null,
        }
      : null;

    return {
      ...base,
      myReview: {
        rating: Number(row.rating),
        reviewerName: row.reviewer_name ?? null,
        reviewText: row.review_text ?? null,
        createdAt: String(row.created_at),
        adminReply,
      },
    };
  }

  async submitReview(body: SubmitReviewDto): Promise<{ ok: true }> {
    const token = this.normalizeToken(body.token);
    const hash = this.orderEmailService.hashReviewToken(token);
    const supabase = this.supabaseService.getClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select('id')
      .eq('review_token_hash', hash)
      .maybeSingle();

    if (error || !order?.id) {
      throw new NotFoundException('This review link is invalid or has expired.');
    }

    const reviewerName = this.sanitizeReviewField(body.reviewerName, 80);
    const reviewText = this.sanitizeReviewField(body.reviewText, 2000);
    const productName = body.publicProductName
      ? this.sanitizeReviewField(body.publicProductName, 120)
      : null;

    if (!reviewerName || reviewText.length < 5) {
      throw new BadRequestException('Invalid review content.');
    }

    const reviewerEmail = this.sanitizeReviewField(body.reviewerEmail, 254);
    const phoneCountryCode = this.sanitizeReviewField(
      body.reviewerPhoneCountryCode,
      8,
    );
    const phoneRaw = this.sanitizeReviewField(body.reviewerPhone, 32);
    const phoneNormalized = normalizeReviewPhone(phoneCountryCode, phoneRaw);

    if (!reviewerEmail || !phoneCountryCode || !phoneRaw) {
      throw new BadRequestException('Email and phone are required.');
    }

    if (!isValidNormalizedPhone(phoneNormalized)) {
      throw new BadRequestException('Please enter a valid phone number.');
    }

    const now = new Date().toISOString();
    const { error: insertErr } = await supabase.from('customer_reviews').insert({
      order_id: order.id,
      rating: body.rating,
      reviewer_name: reviewerName,
      review_text: reviewText,
      is_hidden: false,
      admin_reply_visibility: 'public',
      source: 'order_token',
      is_approved: true,
      approved_at: now,
      public_product_name: productName,
      reviewer_email: reviewerEmail,
      reviewer_phone_country_code: phoneCountryCode,
      reviewer_phone_raw: phoneRaw,
      reviewer_phone_normalized: phoneNormalized,
    });

    if (insertErr) {
      const code = String((insertErr as { code?: string }).code || '');
      const msg = String(insertErr.message || '').toLowerCase();
      if (code === '23505' || msg.includes('duplicate')) {
        throw new BadRequestException('A review has already been submitted for this order.');
      }
      this.logger.warn(
        `[reviewSubmit] insert failed order=${shortIdForLog(String(order.id))}: ${insertErr.message}`,
      );
      throw new BadRequestException('Could not save your review. Please try again.');
    }

    return { ok: true };
  }

  private sanitizeReviewField(value: string, maxLen: number): string {
    return value
      .replace(/\0/g, '')
      .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .trim()
      .slice(0, maxLen);
  }

  async submitPublicReview(
    body: PublicSubmitReviewDto,
  ): Promise<PublicSubmitReviewResponse> {
    const supabase = this.supabaseService.getClient();
    const reviewerName = this.sanitizeReviewField(body.reviewerName, 80);
    const reviewText = this.sanitizeReviewField(body.reviewText, 2000);
    const productName = body.publicProductName
      ? this.sanitizeReviewField(body.publicProductName, 120)
      : null;

    if (!reviewerName || reviewText.length < 5) {
      throw new BadRequestException('Invalid review content.');
    }

    const reviewerEmail = this.sanitizeReviewField(body.reviewerEmail, 254);
    const phoneCountryCode = this.sanitizeReviewField(
      body.reviewerPhoneCountryCode,
      8,
    );
    const phoneRaw = this.sanitizeReviewField(body.reviewerPhone, 32);
    const phoneNormalized = normalizeReviewPhone(phoneCountryCode, phoneRaw);

    if (!reviewerEmail || !phoneCountryCode || !phoneRaw) {
      throw new BadRequestException('Email and phone are required.');
    }

    if (!isValidNormalizedPhone(phoneNormalized)) {
      throw new BadRequestException('Please enter a valid phone number.');
    }

    const insertRow: Record<string, unknown> = {
      order_id: null,
      rating: body.rating,
      reviewer_name: reviewerName,
      review_text: reviewText,
      is_hidden: false,
      deleted_at: null,
      admin_reply_visibility: 'public',
      source: 'public',
      is_approved: false,
      approved_at: null,
      public_product_name: productName,
      reviewer_email: reviewerEmail,
      reviewer_phone_country_code: phoneCountryCode,
      reviewer_phone_raw: phoneRaw,
      reviewer_phone_normalized: phoneNormalized,
    };

    const { error: insertErr } = await supabase
      .from('customer_reviews')
      .insert(insertRow);

    if (insertErr) {
      this.logger.warn(
        `[publicReviewSubmit] insert failed: ${insertErr.message} (${insertErr.code ?? 'no-code'})`,
      );
      const isProd = process.env.NODE_ENV === 'production';
      throw new BadRequestException(
        isProd
          ? 'Could not save your review. Please try again.'
          : {
              message: 'Could not save your review.',
              detail: insertErr.message,
              code: insertErr.code ?? null,
            },
      );
    }

    return {
      success: true,
      message:
        'Thank you — your review has been received and will be reviewed.',
    };
  }

  private async getReviewById(id: string): Promise<ReviewDbRow> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('customer_reviews')
      .select(REVIEW_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Review not found');
    }
    return data as ReviewDbRow;
  }

  async updateAdminReply(
    id: string,
    body: AdminReviewReplyDto,
    adminEmail: string,
  ): Promise<AdminReviewDto> {
    const existing = await this.getReviewById(id);
    if (existing.deleted_at) {
      throw new BadRequestException('Cannot edit reply on a deleted review.');
    }

    const now = new Date().toISOString();
    const replyTrim = body.adminReply?.trim() ?? '';
    const patch: Record<string, unknown> = {
      admin_reply_visibility: 'public',
      admin_reply_updated_at: now,
      admin_reply_by: adminEmail,
    };

    if (replyTrim) {
      patch.admin_reply = replyTrim;
      if (!existing.admin_reply_created_at) {
        patch.admin_reply_created_at = now;
      }
    } else {
      patch.admin_reply = null;
      patch.admin_reply_created_at = null;
      patch.admin_reply_updated_at = null;
      patch.admin_reply_by = null;
    }

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('customer_reviews')
      .update(patch)
      .eq('id', id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    const row = await this.getReviewById(id);
    const orderMap = await this.fetchOrdersMap([row.order_id]);
    return this.toAdminReview(row, orderMap);
  }

  async approveReview(id: string, adminEmail: string): Promise<AdminReviewDto> {
    const existing = await this.getReviewById(id);
    if (existing.deleted_at) {
      throw new BadRequestException('Cannot approve a deleted review.');
    }

    const now = new Date().toISOString();
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('customer_reviews')
      .update({
        is_approved: true,
        approved_at: now,
        approved_by: adminEmail,
        is_hidden: false,
        hidden_at: null,
        hidden_by: null,
      })
      .eq('id', id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    const row = await this.getReviewById(id);
    const orderMap = await this.fetchOrdersMap([row.order_id]);
    return this.toAdminReview(row, orderMap);
  }

  async hideReview(id: string, adminEmail: string): Promise<AdminReviewDto> {
    const existing = await this.getReviewById(id);
    if (existing.deleted_at) {
      throw new BadRequestException('Cannot hide a deleted review. Restore it first.');
    }

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('customer_reviews')
      .update({
        is_hidden: true,
        hidden_at: new Date().toISOString(),
        hidden_by: adminEmail,
      })
      .eq('id', id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    const row = await this.getReviewById(id);
    const orderMap = await this.fetchOrdersMap([row.order_id]);
    return this.toAdminReview(row, orderMap);
  }

  async unhideReview(id: string): Promise<AdminReviewDto> {
    const existing = await this.getReviewById(id);
    if (existing.deleted_at) {
      throw new BadRequestException('Cannot unhide a deleted review. Restore it first.');
    }

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('customer_reviews')
      .update({
        is_hidden: false,
        hidden_at: null,
        hidden_by: null,
      })
      .eq('id', id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    const row = await this.getReviewById(id);
    const orderMap = await this.fetchOrdersMap([row.order_id]);
    return this.toAdminReview(row, orderMap);
  }

  async softDeleteReview(id: string, adminEmail: string): Promise<AdminReviewDto> {
    await this.getReviewById(id);

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('customer_reviews')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: adminEmail,
      })
      .eq('id', id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    const row = await this.getReviewById(id);
    const orderMap = await this.fetchOrdersMap([row.order_id]);
    return this.toAdminReview(row, orderMap);
  }

  async restoreReview(id: string): Promise<AdminReviewDto> {
    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('customer_reviews')
      .update({
        deleted_at: null,
        deleted_by: null,
        is_hidden: false,
        hidden_at: null,
        hidden_by: null,
        is_approved: true,
        approved_at: now,
      })
      .eq('id', id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    const row = await this.getReviewById(id);
    const orderMap = await this.fetchOrdersMap([row.order_id]);
    return this.toAdminReview(row, orderMap);
  }

  /** @deprecated Use listAdminReviews — kept for compatibility during transition. */
  async listAdminReviewsLegacy(limit = 50): Promise<AdminReviewDto[]> {
    const res = await this.listAdminReviews({
      state: 'all',
      limit,
      offset: 0,
      sort: 'newest',
    });
    return res.reviews;
  }
}
