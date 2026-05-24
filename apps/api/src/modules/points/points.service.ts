import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { shortIdForLog } from '../../common/safe-log';

const COUPON_TIERS = [
  { points: 1000, discount: 10, minOrderAmount: 500 },
  { points: 2000, discount: 15, minOrderAmount: 750 },
  { points: 3000, discount: 20, minOrderAmount: 1000 },
  { points: 4000, discount: 25, minOrderAmount: 1500 },
  { points: 5000, discount: 30, minOrderAmount: 2000 },
];

const GENERIC_CLAIM_CODE_ERROR = 'Invalid or already claimed code';

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private async getUser(token: string) {
    const supabase = this.supabaseService.getClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('Invalid token');
    }

    return user;
  }

  private async expireOldCoupons(userId?: string) {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('customer_coupons')
      .update({ status: 'expired' })
      .eq('is_used', false)
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString());

    if (userId) query = query.eq('user_id', userId);

    const { error } = await query;
    if (error) throw new BadRequestException(error.message);
  }

  private async ensurePointsRow(userId: string) {
    const supabase = this.supabaseService.getClient();

    let { data: pointsRow, error } = await supabase
      .from('customer_points')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);

    if (!pointsRow) {
      const { data: created, error: createError } = await supabase
        .from('customer_points')
        .insert({
          user_id: userId,
          points_balance: 0,
          lifetime_points: 0,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) throw new BadRequestException(createError.message);
      pointsRow = created;
    }

    return pointsRow;
  }

  private generateCouponCode(discount: number) {
    return `BW-${discount}OFF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }

  async getMyPoints(token: string) {
    const supabase = this.supabaseService.getClient();
    const user = await this.getUser(token);

    await this.expireOldCoupons(user.id);

    const pointsRow = await this.ensurePointsRow(user.id);

    const { data: coupons, error: couponError } = await supabase
      .from('customer_coupons')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_used', false)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('discount_percent', { ascending: false })
      .order('expires_at', { ascending: true });

    if (couponError) throw new BadRequestException(couponError.message);

    return {
      points: pointsRow.points_balance,
      lifetimePoints: pointsRow.lifetime_points,
      tiers: COUPON_TIERS,
      coupons: coupons || [],
    };
  }

  async claimPoints(token: string, code: string) {
    const supabase = this.supabaseService.getClient();
    const user = await this.getUser(token);

    if (!code?.trim()) {
      throw new BadRequestException('Claim code required');
    }

    const normalizedCode = code.trim().toUpperCase();

    const { data, error } = await supabase.rpc('claim_point_code_atomic', {
      p_user_id: user.id,
      p_code: normalizedCode,
    });

    if (error) {
      const rawMsg = error.message || '';
      if (
        /invalid or already claimed/i.test(rawMsg) ||
        /P0001/.test(rawMsg)
      ) {
        throw new BadRequestException(GENERIC_CLAIM_CODE_ERROR);
      }
      throw new BadRequestException(
        process.env.NODE_ENV === 'production'
          ? GENERIC_CLAIM_CODE_ERROR
          : rawMsg,
      );
    }

    const row = Array.isArray(data)
      ? (data[0] as Record<string, unknown> | undefined)
      : (data as Record<string, unknown> | null);

    const pointsAdded = Number(row?.points_added ?? 0);

    if (!row || !Number.isFinite(pointsAdded) || pointsAdded < 0) {
      this.logger.warn(
        `[claimPoints] empty RPC payload user=${shortIdForLog(user.id)}`,
      );
      throw new BadRequestException(GENERIC_CLAIM_CODE_ERROR);
    }

    return {
      message: 'Points claimed successfully',
      pointsAdded,
    };
  }

  async redeemCoupon(token: string, pointsCost: number) {
    const supabase = this.supabaseService.getClient();
    const user = await this.getUser(token);

    await this.expireOldCoupons(user.id);

    const tier = COUPON_TIERS.find((x) => x.points === Number(pointsCost));

    if (!tier) {
      throw new BadRequestException('Invalid coupon tier');
    }

    const pointsRowBefore = await this.ensurePointsRow(user.id);
    const balanceBefore = Number(pointsRowBefore.points_balance);

    this.logger.log(
      `[redeemCoupon] user=${shortIdForLog(user.id)} tierPoints=${tier.points} discountPercent=${tier.discount} balanceBefore=${balanceBefore}`,
    );

    const code = this.generateCouponCode(tier.discount);

    const expires = new Date();
    expires.setDate(expires.getDate() + 30);

    const { data: rpcRaw, error: rpcError } = await supabase.rpc(
      'redeem_points_coupon_atomic',
      {
        p_coupon_code: code,
        p_discount_percent: tier.discount,
        p_expires_at: expires.toISOString(),
        p_min_order_amount: tier.minOrderAmount,
        p_points_cost: tier.points,
        p_user_id: user.id,
      },
    );

    if (rpcError) {
      const rawMsg = rpcError.message || '';
      if (/not enough points/i.test(rawMsg)) {
        this.logger.warn(
          `[redeemCoupon] insufficient user=${shortIdForLog(user.id)} tier=${tier.points} balanceBefore=${balanceBefore}`,
        );
        throw new BadRequestException('Not enough points');
      }
      if (/duplicate|unique/i.test(rawMsg)) {
        this.logger.warn(
          `[redeemCoupon] concurrent/dup coupon user=${shortIdForLog(user.id)} tier=${tier.points}`,
        );
        throw new BadRequestException(
          'Coupon already being generated, please wait.',
        );
      }
      this.logger.warn(
        `[redeemCoupon] RPC failed user=${shortIdForLog(user.id)} tier=${tier.points}`,
      );
      throw new BadRequestException(
        process.env.NODE_ENV === 'production'
          ? 'Could not redeem coupon. Please try again.'
          : rawMsg,
      );
    }

    const couponRow =
      rpcRaw != null && typeof rpcRaw === 'object'
        ? Array.isArray(rpcRaw)
          ? (rpcRaw[0] as Record<string, unknown> | undefined)
          : (rpcRaw as Record<string, unknown>)
        : null;

    if (!couponRow || typeof couponRow.code !== 'string') {
      this.logger.warn(
        `[redeemCoupon] empty RPC payload user=${shortIdForLog(user.id)} tier=${tier.points}`,
      );
      throw new BadRequestException('Could not redeem coupon');
    }

    const pointsAfter = await this.ensurePointsRow(user.id);
    const remaining = Number(pointsAfter.points_balance);

    this.logger.log(
      `[redeemCoupon] success user=${shortIdForLog(user.id)} tier=${tier.points} balanceAfter=${remaining}`,
    );

    return {
      message: 'Coupon created successfully',
      couponCode: couponRow.code,
      discountPercent: tier.discount,
      pointsSpent: tier.points,
      minOrderAmount: tier.minOrderAmount,
      remainingPoints: remaining,
      expiresAt: expires.toISOString(),
    };
  }

  async validateCoupon(
    token: string,
    code: string,
    subtotal: number,
    deliveryFee = 0,
  ) {
    const supabase = this.supabaseService.getClient();
    const user = await this.getUser(token);

    await this.expireOldCoupons(user.id);

    if (!code?.trim()) {
      throw new BadRequestException('Coupon code required');
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanSubtotal = Number(subtotal || 0);
    const cleanDelivery = Number(deliveryFee || 0);
    /** Bunny's Whisper: no VAT; “tax/fee” in the coupon base is delivery only. */
    const discountBase = Number((cleanSubtotal + cleanDelivery).toFixed(2));

    if (cleanSubtotal <= 0) {
      throw new BadRequestException('Cart subtotal must be greater than zero');
    }

    const { data: coupon, error } = await supabase
      .from('customer_coupons')
      .select('*')
      .eq('user_id', user.id)
      .ilike('code', cleanCode)
      .eq('is_used', false)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);

    if (!coupon) {
      throw new BadRequestException('Invalid, expired, or used coupon');
    }

    const minOrderAmount = Number(coupon.min_order_amount || 0);

    if (cleanSubtotal < minOrderAmount) {
      throw new BadRequestException(
        `This coupon requires a minimum order of EGP ${minOrderAmount.toFixed(2)}`,
      );
    }

    const discountAmount = Number(
      ((discountBase * Number(coupon.discount_percent)) / 100).toFixed(2),
    );

    return {
      valid: true,
      code: coupon.code,
      discountPercent: coupon.discount_percent,
      discountAmount,
      discountBase,
      minOrderAmount,
      expiresAt: coupon.expires_at,
    };
  }

  private orderStatusKey(status: unknown): string {
    return String(status || '')
      .toLowerCase()
      .trim();
  }

  private hasUncancelledAt(uncancelledAt: unknown): boolean {
    if (uncancelledAt == null) return false;
    return String(uncancelledAt).trim().length > 0;
  }

  /**
   * Re-claim after admin uncancel when `claim_order_points_safe` still treats the row as
   * already claimed. Credits `points_awarded` on the order; rolls back balance if the order
   * row cannot be finalized.
   */
  private async reclaimOrderPointsAfterUncancel(
    userId: string,
    cleanCode: string,
    order: {
      id: string;
      claim_code: string | null;
      points_awarded: number | null;
    },
  ) {
    const supabase = this.supabaseService.getClient();
    const pointsRow = await this.ensurePointsRow(userId);

    const pointsEarned = Math.max(
      0,
      Math.floor(Number(order.points_awarded ?? 0)),
    );

    if (pointsEarned <= 0) {
      throw new BadRequestException(
        'This order has no points amount on file to re-claim.',
      );
    }

    const bonusPoints = 0;
    const totalPointsAdded = pointsEarned + bonusPoints;
    const prevBalance = Number(pointsRow.points_balance);
    const prevLifetime = Number(pointsRow.lifetime_points);

    const { error: cpErr } = await supabase.from('customer_points').update({
      points_balance: prevBalance + totalPointsAdded,
      lifetime_points: prevLifetime + totalPointsAdded,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);

    if (cpErr) {
      throw new BadRequestException(cpErr.message);
    }

    const { data: updatedRows, error: ordErr } = await supabase
      .from('orders')
      .update({
        points_claimed: true,
        points_reversed: false,
        points_reversed_at: null,
        points_awarded: pointsEarned,
      })
      .eq('id', order.id)
      .eq('claim_code', cleanCode)
      .eq('points_claimed', true)
      .eq('points_reversed', true)
      .select('id');

    if (ordErr) {
      await supabase.from('customer_points').update({
        points_balance: prevBalance,
        lifetime_points: prevLifetime,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
      throw new BadRequestException(ordErr.message);
    }

    if (!updatedRows?.length) {
      await supabase.from('customer_points').update({
        points_balance: prevBalance,
        lifetime_points: prevLifetime,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
      throw new BadRequestException('Points already claimed.');
    }

    return {
      pointsEarned,
      bonusPoints,
      totalPointsAdded,
      newPointsBalance: prevBalance + totalPointsAdded,
      newLifetimePoints: prevLifetime + totalPointsAdded,
    };
  }

  async claimOrderPoints(token: string, code: string) {
    const supabase = this.supabaseService.getClient();
    const user = await this.getUser(token);

    if (!code?.trim()) {
      throw new BadRequestException('Claim code required');
    }

    const cleanCode = code.trim().toUpperCase();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        'id, status, claim_code, points_claimed, points_reversed, uncancelled_at, points_awarded, customer_email',
      )
      .eq('claim_code', cleanCode)
      .maybeSingle();

    if (orderError) {
      throw new BadRequestException(
        process.env.NODE_ENV === 'production'
          ? 'Invalid claim code'
          : orderError.message,
      );
    }

    if (!order) {
      throw new BadRequestException('Invalid claim code');
    }

    const userEmail = user.email?.trim().toLowerCase() ?? '';
    const orderEmail = String(
      (order as { customer_email?: string | null }).customer_email ?? '',
    )
      .trim()
      .toLowerCase();
    if (!orderEmail || orderEmail !== userEmail) {
      throw new BadRequestException('Invalid claim code');
    }

    const st = this.orderStatusKey(order.status);

    if (st === 'cancelled') {
      throw new BadRequestException(
        'You cannot claim points from a cancelled order.',
      );
    }

    if (st !== 'delivered') {
      throw new BadRequestException(
        'Points can only be claimed after the order is delivered.',
      );
    }

    const claimed = Boolean(order.points_claimed);
    const reversed = Boolean(order.points_reversed);
    const uncancelled = this.hasUncancelledAt(order.uncancelled_at);

    if (claimed && !reversed) {
      throw new BadRequestException('Points already claimed.');
    }

    const reclaimAfterUncancel =
      claimed && reversed && uncancelled && st === 'delivered';

    if (claimed && reversed && !uncancelled) {
      throw new BadRequestException(
        'Points were reversed on this order. It can only be claimed again after an admin uncancels it and it is delivered.',
      );
    }

    if (reclaimAfterUncancel) {
      const out = await this.reclaimOrderPointsAfterUncancel(
        user.id,
        cleanCode,
        {
          id: order.id,
          claim_code: order.claim_code,
          points_awarded: order.points_awarded,
        },
      );

      return {
        message: 'Points claimed successfully',
        pointsEarned: out.pointsEarned,
        bonusPoints: out.bonusPoints,
        totalPointsAdded: out.totalPointsAdded,
        newPointsBalance: out.newPointsBalance,
        newLifetimePoints: out.newLifetimePoints,
      };
    }

    const { data, error } = await supabase.rpc('claim_order_points_safe', {
      p_user_id: user.id,
      p_claim_code: cleanCode,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const result = data?.[0];

    return {
      message: 'Points claimed successfully',
      pointsEarned: result?.points_earned || 0,
      bonusPoints: result?.bonus_points || 0,
      totalPointsAdded: result?.total_points_added || 0,
      newPointsBalance: result?.new_points_balance || 0,
      newLifetimePoints: result?.new_lifetime_points || 0,
    };
  }
}