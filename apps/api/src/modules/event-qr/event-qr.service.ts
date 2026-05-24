import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { maskEmailForLog, shortIdForLog } from '../../common/safe-log';
import { SupabaseService } from '../../supabase/supabase.service';

const CODE_SYMBOLS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const MAX_CODE_ATTEMPTS = 12;

export type EventCampaignRow = {
  id: string;
  name: string;
  code: string;
  discount_percent: number;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  active: boolean;
  created_at?: string;
};

/** Public preview API — single source of truth for /event/[code] landing. */
export type EventQrPreviewStatus =
  | 'valid'
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'maxed'
  | 'already_saved';

export type EventQrPreviewResponse = {
  status: EventQrPreviewStatus;
  /** Legacy: true when UI should show booth content (claim or already claimed). */
  ok: boolean;
  /** Legacy codes; `ended` still used for expired windows. */
  reason?: string;
  campaign?: {
    id: string;
    name: string;
    code: string;
    discountPercent: number;
  };
};

function generateEventCampaignCode(): string {
  const seg = (n: number) => {
    const b = randomBytes(n * 2);
    let s = '';
    for (let i = 0; i < n; i++) {
      s += CODE_SYMBOLS[b[i]! % CODE_SYMBOLS.length];
    }
    return s;
  };
  return `BW-EVENT-${seg(4)}-${seg(4)}`;
}

function isUniqueViolation(err: {
  code?: string;
  message?: string;
  details?: string;
}): boolean {
  const code = String(err.code ?? '');
  const m = String(err.message ?? '').toLowerCase();
  const d = String(err.details ?? '').toLowerCase();
  // Postgres 23505 = unique_violation; PostgREST passes it through.
  if (code === '23505') return true;
  if (m.includes('duplicate key') || m.includes('duplicate key value')) return true;
  if (m.includes('unique constraint') && m.includes('violat')) return true;
  if (d.includes('already exists')) return true;
  return false;
}

@Injectable()
export class EventQrService {
  private readonly logger = new Logger(EventQrService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async listCampaignsWithStats(): Promise<
    (EventCampaignRow & {
      redemption_count: number;
      used_count: number;
      revenue_egp: number;
      discount_given_egp: number;
    })[]
  > {
    const supabase = this.supabaseService.getClient();

    const { data: campaigns, error } = await supabase
      .from('event_qr_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(error.message);
      throw new BadRequestException('Could not load event campaigns.');
    }

    const rows = (campaigns || []).map((r) =>
      this.campaignRowFromDb(r as Record<string, unknown>),
    );
    const out: (EventCampaignRow & {
      redemption_count: number;
      used_count: number;
      revenue_egp: number;
      discount_given_egp: number;
    })[] = [];

    for (const c of rows) {
      const { count: redCount } = await supabase
        .from('event_qr_redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', c.id);

      const { count: usedCount } = await supabase
        .from('event_qr_redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', c.id)
        .not('used_order_id', 'is', null);

      const { data: revRows } = await supabase
        .from('orders')
        .select('total, discount_amount')
        .eq('event_campaign_id', c.id)
        .eq('discount_source', 'event')
        .neq('status', 'cancelled');

      const revenue_egp = (revRows || []).reduce(
        (s, r: { total?: number }) => s + Number(r.total || 0),
        0,
      );
      const discount_given_egp = (revRows || []).reduce(
        (s, r: { discount_amount?: number | null }) =>
          s + Number(r.discount_amount ?? 0),
        0,
      );

      out.push({
        ...c,
        redemption_count: redCount ?? 0,
        used_count: usedCount ?? 0,
        revenue_egp,
        discount_given_egp,
      });
    }

    return out;
  }

  /** Normalize Supabase row quirks (string booleans, empty strings vs null). */
  private campaignRowFromDb(raw: Record<string, unknown>): EventCampaignRow {
    return {
      id: String(raw.id ?? ''),
      name: String(raw.name ?? ''),
      code: String(raw.code ?? ''),
      discount_percent: Number(raw.discount_percent ?? 0),
      starts_at: this.coerceNullableIso(raw.starts_at),
      ends_at: this.coerceNullableIso(raw.ends_at),
      max_redemptions:
        raw.max_redemptions == null || raw.max_redemptions === ''
          ? null
          : Number(raw.max_redemptions),
      active: this.coerceActiveFlag(raw.active),
      created_at:
        raw.created_at != null ? String(raw.created_at) : undefined,
    };
  }

  private coerceNullableIso(v: unknown): string | null {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') {
      return null;
    }
    return s;
  }

  /** Treat truthy DB/driver variants as active. */
  private coerceActiveFlag(v: unknown): boolean {
    return (
      v === true ||
      v === 'true' ||
      v === 't' ||
      v === 'T' ||
      v === 1 ||
      v === '1'
    );
  }

  /**
   * Instant in ms for comparisons, or null if bound absent / unparseable.
   * Unparseable values are treated as absent (dev warning) so bad rows don’t block open-ended campaigns.
   */
  private parseInstantMs(iso: string | null): number | null {
    if (iso == null) return null;
    const ms = new Date(iso).getTime();
    if (!Number.isFinite(ms)) {
      if (process.env.NODE_ENV === 'development') {
        this.logger.warn(
          `[event_qr] Unparseable timestamp ignored for window: ${JSON.stringify(iso)}`,
        );
      }
      return null;
    }
    return ms;
  }

  private logValidationDev(
    c: EventCampaignRow,
    decision: { ok: boolean; reason?: string },
    nowMs: number,
    startMs: number | null,
    endMs: number | null,
  ): void {
    if (process.env.NODE_ENV !== 'development') return;
    const noWindow =
      this.coerceNullableIso(c.starts_at) == null &&
      this.coerceNullableIso(c.ends_at) == null;
    this.logger.log(
      `[event_qr.validate] ${JSON.stringify({
        code: c.code,
        active: c.active,
        starts_at: c.starts_at,
        ends_at: c.ends_at,
        parsed_start_ms: startMs,
        parsed_end_ms: endMs,
        open_ended_schedule: noWindow,
        server_now_iso: new Date(nowMs).toISOString(),
        server_now_ms: nowMs,
        ok: decision.ok,
        reason: decision.reason ?? null,
      })}`,
    );
  }

  async createCampaign(input: {
    name: string;
    discount_percent: number;
    starts_at?: string | null;
    ends_at?: string | null;
    max_redemptions?: number | null;
    active?: boolean;
  }): Promise<EventCampaignRow> {
    const supabase = this.supabaseService.getClient();

    let lastErr: { message?: string } | null = null;

    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
      const code = generateEventCampaignCode();
      const { data, error } = await supabase
        .from('event_qr_campaigns')
        .insert({
          name: input.name.trim(),
          code,
          discount_percent: input.discount_percent,
          starts_at: input.starts_at || null,
          ends_at: input.ends_at || null,
          max_redemptions:
            input.max_redemptions != null ? input.max_redemptions : null,
          active: input.active !== false,
        })
        .select('*')
        .maybeSingle();

      if (!error && data) {
        return this.campaignRowFromDb(data as Record<string, unknown>);
      }

      lastErr = error;
      if (error && !isUniqueViolation(error)) {
        throw new BadRequestException(error.message);
      }
    }

    throw new BadRequestException(
      lastErr?.message || 'Could not generate a unique campaign code.',
    );
  }

  async setCampaignActive(id: string, active: boolean): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('event_qr_campaigns')
      .update({ active })
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);
  }

  async getCampaignByCode(codeRaw: string): Promise<EventCampaignRow | null> {
    const supabase = this.supabaseService.getClient();
    const code = String(codeRaw || '').trim().toUpperCase();

    const { data, error } = await supabase
      .from('event_qr_campaigns')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (error) {
      this.logger.warn(error.message);
      return null;
    }

    if (!data) return null;
    return this.campaignRowFromDb(data as Record<string, unknown>);
  }

  /**
   * Server-side window check (source of truth). Uses UTC instants from ISO strings.
   * Rules: inactive → fail; optional start → fail if now &lt; start; optional end → fail if now &gt; end;
   * both bounds absent + active → valid (until manually deactivated).
   */
  validateCampaignWindow(c: EventCampaignRow): {
    ok: boolean;
    reason?: string;
  } {
    const now = Date.now();

    if (!c.active) {
      const out = { ok: false as const, reason: 'inactive' as const };
      this.logValidationDev(c, out, now, null, null);
      return out;
    }

    const startMs = this.parseInstantMs(c.starts_at);
    const endMs = this.parseInstantMs(c.ends_at);

    if (startMs !== null && now < startMs) {
      const out = { ok: false as const, reason: 'not_started' as const };
      this.logValidationDev(c, out, now, startMs, endMs);
      return out;
    }

    if (endMs !== null && now > endMs) {
      const out = { ok: false as const, reason: 'ended' as const };
      this.logValidationDev(c, out, now, startMs, endMs);
      return out;
    }

    const out = { ok: true as const };
    this.logValidationDev(c, out, now, startMs, endMs);
    return out;
  }

  private previewDevLog(payload: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== 'development') return;
    this.logger.log(`[event_qr.preview.debug] ${JSON.stringify(payload)}`);
  }

  /** True if this visitor already has a redemption row for the campaign. */
  private async visitorHasRedemption(
    campaignId: string,
    visitor: {
      userId: string | null;
      email: string | null;
      deviceKey: string | null;
    },
  ): Promise<boolean> {
    const supabase = this.supabaseService.getClient();
    const emailNorm = visitor.email?.trim().toLowerCase() || null;

    if (visitor.userId) {
      const { data } = await supabase
        .from('event_qr_redemptions')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('customer_id', visitor.userId)
        .maybeSingle();
      if (data) return true;
    }

    if (emailNorm) {
      const { data } = await supabase
        .from('event_qr_redemptions')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('customer_email', emailNorm)
        .maybeSingle();
      if (data) return true;
    }

    if (visitor.deviceKey) {
      const { data } = await supabase
        .from('event_qr_redemptions')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('device_key', visitor.deviceKey)
        .maybeSingle();
      if (data) return true;
    }

    return false;
  }

  async assertMaxRedemptionsNotExceeded(campaignId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { data: camp } = await supabase
      .from('event_qr_campaigns')
      .select('max_redemptions')
      .eq('id', campaignId)
      .maybeSingle();

    const max = camp?.max_redemptions;
    if (max == null || max <= 0) return;

    const { count } = await supabase
      .from('event_qr_redemptions')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    if ((count ?? 0) >= max) {
      throw new BadRequestException('This booth reward has reached its limit.');
    }
  }

  async previewCampaign(
    codeRaw: string,
    visitor?: {
      userId: string | null;
      email: string | null;
      deviceKey: string | null;
    },
  ): Promise<EventQrPreviewResponse> {
    const requested = String(codeRaw ?? '').trim();
    const nowMs = Date.now();
    const serverNowIso = new Date(nowMs).toISOString();

    const baseLog = {
      requested_code_raw: requested,
      normalized_code_for_query: requested.toUpperCase(),
      server_now_ms: nowMs,
      server_now_iso: serverNowIso,
      visitor_user: Boolean(visitor?.userId),
      visitor_device_key: Boolean(visitor?.deviceKey?.trim()),
    };

    const c = await this.getCampaignByCode(codeRaw);
    if (!c) {
      this.previewDevLog({
        ...baseLog,
        campaign_found: false,
        status: 'not_found',
        validation_result: 'skip_no_row',
      });
      return { status: 'not_found', ok: false, reason: 'not_found' };
    }

    this.previewDevLog({
      ...baseLog,
      campaign_found: true,
      campaign_id: c.id,
      campaign_active: c.active,
      campaign_starts_at: c.starts_at,
      campaign_ends_at: c.ends_at,
      step: 'before_window_validation',
    });

    const win = this.validateCampaignWindow(c);
    if (!win.ok) {
      const status: EventQrPreviewStatus =
        win.reason === 'inactive'
          ? 'inactive'
          : win.reason === 'not_started'
            ? 'not_started'
            : 'expired';

      this.previewDevLog({
        ...baseLog,
        campaign_found: true,
        campaign_id: c.id,
        campaign_active: c.active,
        campaign_starts_at: c.starts_at,
        campaign_ends_at: c.ends_at,
        validation_ok: false,
        validation_reason: win.reason,
        status,
      });

      return {
        status,
        ok: false,
        reason: win.reason,
      };
    }

    try {
      await this.assertMaxRedemptionsNotExceeded(c.id);
    } catch {
      this.previewDevLog({
        ...baseLog,
        campaign_found: true,
        campaign_id: c.id,
        campaign_active: c.active,
        campaign_starts_at: c.starts_at,
        campaign_ends_at: c.ends_at,
        validation_ok: true,
        global_cap: 'exceeded',
        status: 'maxed',
      });
      return { status: 'maxed', ok: false, reason: 'maxed' };
    }

    const campPayload = {
      id: c.id,
      name: c.name,
      code: c.code,
      discountPercent: Number(c.discount_percent),
    };

    if (
      visitor &&
      (visitor.userId || visitor.email || visitor.deviceKey?.trim())
    ) {
      const vis = {
        userId: visitor.userId,
        email: visitor.email,
        deviceKey: visitor.deviceKey?.trim() || null,
      };
      const already = await this.visitorHasRedemption(c.id, vis);
      if (already) {
        this.previewDevLog({
          ...baseLog,
          campaign_found: true,
          campaign_id: c.id,
          campaign_active: c.active,
          campaign_starts_at: c.starts_at,
          campaign_ends_at: c.ends_at,
          validation_ok: true,
          global_cap: 'ok',
          visitor_redemption: 'existing_row',
          status: 'already_saved',
        });
        return {
          status: 'already_saved',
          ok: true,
          reason: 'already_saved',
          campaign: campPayload,
        };
      }
    }

    this.previewDevLog({
      ...baseLog,
      campaign_found: true,
      campaign_id: c.id,
      campaign_active: c.active,
      campaign_starts_at: c.starts_at,
      campaign_ends_at: c.ends_at,
      validation_ok: true,
      global_cap: 'ok',
      visitor_redemption: 'none_or_not_checked',
      status: 'valid',
    });

    return {
      status: 'valid',
      ok: true,
      campaign: campPayload,
    };
  }

  /**
   * Debug snapshot for GET /debug/event-qr-preview/:code (caller must gate production).
   * No secrets — campaign metadata + counts only.
   */
  async getDebugEventQrPreviewSnapshot(
    codeRaw: string,
  ): Promise<Record<string, unknown>> {
    const requested = String(codeRaw ?? '').trim();
    const nowMs = Date.now();
    const serverNowIso = new Date(nowMs).toISOString();

    const c = await this.getCampaignByCode(codeRaw);
    if (!c) {
      return {
        requested_code: requested,
        campaign_found: false,
        status: 'not_found',
        reason: 'not_found',
        max_redemptions: null,
        redemption_count: 0,
        active: null,
        starts_at: null,
        ends_at: null,
        server_now_ms: nowMs,
        server_now_iso: serverNowIso,
        public_preview_route: 'GET /events/qr/preview/:code',
      };
    }

    const supabase = this.supabaseService.getClient();
    const { count } = await supabase
      .from('event_qr_redemptions')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', c.id);

    const redemptionCount = count ?? 0;
    const win = this.validateCampaignWindow(c);

    const max = c.max_redemptions;
    const maxExceeded =
      max != null && max > 0 && redemptionCount >= max;

    let status: EventQrPreviewStatus;
    let reason: string | undefined;

    if (!win.ok) {
      status =
        win.reason === 'inactive'
          ? 'inactive'
          : win.reason === 'not_started'
            ? 'not_started'
            : 'expired';
      reason = win.reason;
    } else if (maxExceeded) {
      status = 'maxed';
      reason = 'maxed';
    } else {
      status = 'valid';
      reason = undefined;
    }

    return {
      requested_code: requested,
      campaign_found: true,
      campaign: {
        id: c.id,
        name: c.name,
        code: c.code,
        discount_percent: c.discount_percent,
        active: c.active,
        starts_at: c.starts_at,
        ends_at: c.ends_at,
        max_redemptions: c.max_redemptions,
      },
      status,
      reason: reason ?? null,
      max_redemptions: c.max_redemptions,
      redemption_count: redemptionCount,
      active: c.active,
      starts_at: c.starts_at,
      ends_at: c.ends_at,
      server_now_ms: nowMs,
      server_now_iso: serverNowIso,
      public_preview_route: 'GET /events/qr/preview/:code',
    };
  }

  async redeemCampaign(params: {
    codeRaw: string;
    userId: string | null;
    email: string | null;
    deviceKey: string | null;
  }): Promise<{
    alreadyRedeemed: boolean;
    campaign: {
      id: string;
      name: string;
      code: string;
      discountPercent: number;
    };
  }> {
    const supabase = this.supabaseService.getClient();
    const c = await this.getCampaignByCode(params.codeRaw);

    if (!c) {
      throw new NotFoundException('Campaign not found');
    }

    const win = this.validateCampaignWindow(c);
    if (!win.ok) {
      const msg =
        win.reason === 'not_started'
          ? 'This booth reward starts soon.'
          : 'This booth reward is no longer available.';
      throw new HttpException(
        {
          statusCode: 400,
          reason: win.reason ?? 'unavailable',
          message: msg,
        },
        400,
      );
    }

    await this.assertMaxRedemptionsNotExceeded(c.id);

    const emailNorm = params.email?.trim().toLowerCase() || null;

    const dk = params.deviceKey?.trim() || null;
    if (!dk) {
      throw new BadRequestException('deviceKey is required');
    }

    if (params.userId) {
      const { data: byUser } = await supabase
        .from('event_qr_redemptions')
        .select('id')
        .eq('campaign_id', c.id)
        .eq('customer_id', params.userId)
        .maybeSingle();
      if (byUser) {
        return {
          alreadyRedeemed: true,
          campaign: {
            id: c.id,
            name: c.name,
            code: c.code,
            discountPercent: Number(c.discount_percent),
          },
        };
      }
    }

    if (emailNorm) {
      const { data: byEmail } = await supabase
        .from('event_qr_redemptions')
        .select('id')
        .eq('campaign_id', c.id)
        .eq('customer_email', emailNorm)
        .maybeSingle();
      if (byEmail) {
        return {
          alreadyRedeemed: true,
          campaign: {
            id: c.id,
            name: c.name,
            code: c.code,
            discountPercent: Number(c.discount_percent),
          },
        };
      }
    }

    const { data: byDev } = await supabase
      .from('event_qr_redemptions')
      .select('id')
      .eq('campaign_id', c.id)
      .eq('device_key', dk)
      .maybeSingle();
    if (byDev) {
      return {
        alreadyRedeemed: true,
        campaign: {
          id: c.id,
          name: c.name,
          code: c.code,
          discountPercent: Number(c.discount_percent),
        },
      };
    }

    const redeemedAt = new Date().toISOString();
    const { data: inserted, error: insErr } = await supabase
      .from('event_qr_redemptions')
      .insert({
        campaign_id: c.id,
        customer_id: params.userId,
        customer_email: emailNorm,
        device_key: dk,
        redeemed_at: redeemedAt,
      })
      .select('id')
      .maybeSingle();

    if (insErr) {
      if (isUniqueViolation(insErr)) {
        return {
          alreadyRedeemed: true,
          campaign: {
            id: c.id,
            name: c.name,
            code: c.code,
            discountPercent: Number(c.discount_percent),
          },
        };
      }
      this.logger.error(
        `[redeemCampaign] insert failed campaign_id=${c.id} ${insErr.message}`,
      );
      throw new BadRequestException(insErr.message);
    }

    if (inserted?.id) {
      this.logger.log(
        `[redeemCampaign] redemption row created id=${inserted.id} campaign_id=${c.id}`,
      );
      if (process.env.NODE_ENV === 'development') {
        this.logger.log(
          `[redeemCampaign][dev] inserted redemption (masked): ${JSON.stringify({
            id: inserted.id,
            campaign_id: c.id,
            customer_id: params.userId ?? null,
            customer_email_set: Boolean(emailNorm),
            device_key_preview: dk ? `${dk.slice(0, 6)}…` : null,
            redeemed_at: redeemedAt,
          })}`,
        );
      }
    }

    return {
      alreadyRedeemed: false,
      campaign: {
        id: c.id,
        name: c.name,
        code: c.code,
        discountPercent: Number(c.discount_percent),
      },
    };
  }

  async validateEventDiscountForOrder(params: {
    campaignId: string;
    userId: string;
    email: string | null;
    deviceKey: string | null;
    campaignCode?: string | null;
  }): Promise<{ discountPercent: number; redemptionId: string }> {
    const supabase = this.supabaseService.getClient();

    const emailNorm = params.email?.trim().toLowerCase() || null;
    const deviceKeyTrim = params.deviceKey?.trim() || null;

    this.logger.log(
      `[validateEventDiscountForOrder] campaign=${shortIdForLog(params.campaignId)} code_hint=${params.campaignCode ? 'yes' : 'no'} device_key=${deviceKeyTrim ? 'yes' : 'no'} user=${shortIdForLog(params.userId)} email=${maskEmailForLog(emailNorm)}`,
    );

    const { data: camp, error: ce } = await supabase
      .from('event_qr_campaigns')
      .select('*')
      .eq('id', params.campaignId)
      .maybeSingle();

    if (ce || !camp) {
      this.logger.warn(`[validateEventDiscountForOrder] invalid campaign id`);
      throw new BadRequestException('Invalid booth campaign.');
    }

    const row = this.campaignRowFromDb(camp as Record<string, unknown>);
    const win = this.validateCampaignWindow(row);
    if (!win.ok) {
      throw new BadRequestException(
        'This booth discount is no longer valid for checkout.',
      );
    }

    await this.assertMaxRedemptionsNotExceeded(row.id);

    type RedemptionRow = {
      id: string;
      used_order_id: string | null;
      customer_id: string | null;
      customer_email: string | null;
    };

    let redemption: RedemptionRow | undefined;
    let matchReason: 'customer_id' | 'email' | 'device_key' | null = null;

    const { data: rUser } = await supabase
      .from('event_qr_redemptions')
      .select('id, used_order_id, customer_id, customer_email')
      .eq('campaign_id', params.campaignId)
      .eq('customer_id', params.userId)
      .maybeSingle();

    if (rUser) {
      redemption = rUser as RedemptionRow;
      matchReason = 'customer_id';
    }

    if (!redemption && emailNorm) {
      const { data: rEmail } = await supabase
        .from('event_qr_redemptions')
        .select('id, used_order_id, customer_id, customer_email')
        .eq('campaign_id', params.campaignId)
        .eq('customer_email', emailNorm)
        .maybeSingle();
      if (rEmail) {
        redemption = rEmail as RedemptionRow;
        matchReason = 'email';
      }
    }

    if (!redemption && deviceKeyTrim) {
      const { data: rDev } = await supabase
        .from('event_qr_redemptions')
        .select('id, used_order_id, customer_id, customer_email')
        .eq('campaign_id', params.campaignId)
        .eq('device_key', deviceKeyTrim)
        .maybeSingle();
      if (rDev) {
        redemption = rDev as RedemptionRow;
        matchReason = 'device_key';
      }
    }

    this.logger.log(
      `[validateEventDiscountForOrder] redemption_found=${Boolean(redemption)} match=${matchReason ?? 'none'} redemption=${shortIdForLog(redemption?.id)}`,
    );

    if (!redemption) {
      this.logger.warn(
        `[validateEventDiscountForOrder] validation FAIL — no row for user/email/device`,
      );
      throw new BadRequestException(
        'No booth redemption found for this account or device. Scan the booth QR again before checkout.',
      );
    }

    if (redemption.used_order_id) {
      throw new BadRequestException(
        'This booth discount was already used on an order.',
      );
    }

    if (
      params.userId &&
      matchReason === 'device_key' &&
      redemption.customer_id == null &&
      deviceKeyTrim
    ) {
      const { data: userConflict } = await supabase
        .from('event_qr_redemptions')
        .select('id')
        .eq('campaign_id', params.campaignId)
        .eq('customer_id', params.userId)
        .maybeSingle();

      if (!userConflict) {
        const { error: linkErr } = await supabase
          .from('event_qr_redemptions')
          .update({
            customer_id: params.userId,
            customer_email: emailNorm,
          })
          .eq('id', redemption.id)
          .is('customer_id', null);

        if (linkErr) {
          this.logger.warn(
            `[validateEventDiscountForOrder] link redemption to user skipped: ${linkErr.message}`,
          );
        } else {
          this.logger.log(
            `[validateEventDiscountForOrder] linked redemption ${shortIdForLog(redemption.id)} to user ${shortIdForLog(params.userId)}`,
          );
        }
      }
    }

    this.logger.log(
      `[validateEventDiscountForOrder] validation OK redemption=${shortIdForLog(redemption.id)} discountPercent=${Number(row.discount_percent)}`,
    );

    return {
      discountPercent: Number(row.discount_percent),
      redemptionId: redemption.id,
    };
  }

  /**
   * Atomically assigns used_order_id if still unused. Call BEFORE applying discount on the order
   * so two concurrent checkouts cannot consume the same redemption.
   */
  async tryConsumeRedemptionForOrder(
    redemptionId: string,
    orderId: string,
  ): Promise<boolean> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('event_qr_redemptions')
      .update({ used_order_id: orderId })
      .eq('id', redemptionId)
      .is('used_order_id', null)
      .select('id');

    if (error) {
      this.logger.warn(`tryConsumeRedemptionForOrder: ${error.message}`);
      return false;
    }

    return Array.isArray(data) && data.length > 0;
  }

  async reconcileEventOrderTotals(params: {
    orderId: string;
    campaignId: string;
    discountPercent: number;
    redemptionId: string;
  }): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const consumed = await this.tryConsumeRedemptionForOrder(
      params.redemptionId,
      params.orderId,
    );

    if (!consumed) {
      throw new ConflictException(
        'Booth redemption is no longer available for this checkout.',
      );
    }

    const { data: orderRow, error: orderErr } = await supabase
      .from('orders')
      .select('subtotal, delivery_fee')
      .eq('id', params.orderId)
      .maybeSingle();

    if (orderErr || !orderRow) {
      this.logger.warn(
        `Event reconcile: could not load order ${shortIdForLog(params.orderId)}`,
      );
      throw new BadRequestException('Could not apply booth discount to order.');
    }

    const subtotal = Number(orderRow.subtotal || 0);
    const delivery = Number(orderRow.delivery_fee ?? subtotal * 0.12);
    const discountBase = Number((subtotal + delivery).toFixed(2));
    const pct = Number(params.discountPercent || 0);
    const discountAmount = Number(((discountBase * pct) / 100).toFixed(2));
    const total = Math.max(
      0,
      Number((discountBase - discountAmount).toFixed(2)),
    );

    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        discount_amount: discountAmount,
        total,
        coupon_code: null,
        discount_source: 'event',
        event_campaign_id: params.campaignId,
        event_discount_percent: pct,
      })
      .eq('id', params.orderId);

    if (updateErr) {
      this.logger.warn(`Event reconcile failed: ${updateErr.message}`);
      await supabase
        .from('event_qr_redemptions')
        .update({ used_order_id: null })
        .eq('id', params.redemptionId)
        .eq('used_order_id', params.orderId);
      throw new BadRequestException('Could not apply booth discount to order.');
    }
  }
}
