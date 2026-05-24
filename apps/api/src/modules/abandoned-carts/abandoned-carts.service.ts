import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import twilio from 'twilio';
import { SupabaseService } from '../../supabase/supabase.service';

type CartItem = {
  productId: string;
  variantId: string;
  name?: string;
  slug?: string;
  image?: string;
  price?: number;
  size?: string;
  color?: string;
  quantity: number;
};

@Injectable()
export class AbandonedCartsService {
  private resend: Resend;
  private twilioClient: ReturnType<typeof twilio> | null = null;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');

    if (!resendApiKey) throw new Error('Missing RESEND_API_KEY');

    this.resend = new Resend(resendApiKey);

    const twilioSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (twilioSid && twilioToken) {
      this.twilioClient = twilio(twilioSid, twilioToken);
    }
  }

  private async getUser(token: string) {
    const supabase = this.supabaseService.getClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user?.email) {
      throw new UnauthorizedException('Invalid customer token');
    }

    return user;
  }

  private normalizePhone(phone?: string | null, countryCode?: string | null) {
    if (!phone) return null;

    let cleaned = phone.replace(/\s/g, '').replace(/-/g, '');

    if (cleaned.startsWith('whatsapp:')) return cleaned;
    if (cleaned.startsWith('+')) return `whatsapp:${cleaned}`;

    if (cleaned.startsWith('0') && countryCode) {
      return `whatsapp:${countryCode}${cleaned.slice(1)}`;
    }

    if (countryCode) return `whatsapp:${countryCode}${cleaned}`;

    return null;
  }

  private async getCustomerPhone(userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data } = await supabase
      .from('customer_profiles')
      .select('phone, country_code')
      .eq('user_id', userId)
      .maybeSingle();

    return this.normalizePhone(data?.phone, data?.country_code);
  }

  async syncCart(token: string, items: CartItem[]) {
    const supabase = this.supabaseService.getClient();
    const user = await this.getUser(token);
    const phone = await this.getCustomerPhone(user.id);

    if (!items || items.length === 0) {
      await supabase
        .from('abandoned_carts')
        .update({
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'completed',
        })
        .eq('user_id', user.id)
        .is('completed_at', null);

      return { message: 'Cart cleared' };
    }

    const subtotal = items.reduce(
      (sum, item) =>
        sum + Number(item.price ?? 0) * Number(item.quantity ?? 0),
      0,
    );

    const now = new Date().toISOString();

    const { error } = await supabase.from('abandoned_carts').upsert(
      {
        user_id: user.id,
        email: user.email!.toLowerCase(),
        phone,
        items,
        subtotal,
        reminder_count: 0,
        first_reminder_sent_at: null,
        second_reminder_sent_at: null,
        whatsapp_first_sent_at: null,
        whatsapp_second_sent_at: null,
        last_seen_at: now,
        completed_at: null,
        expires_at: null,
        expired_at: null,
        status: 'active',
        updated_at: now,
      },
      { onConflict: 'user_id' },
    );

    if (error) throw new Error(error.message);

    return { message: 'Cart synced' };
  }

  private async getBestCoupon(userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data } = await supabase
      .from('customer_coupons')
      .select('id, discount_percent, expires_at')
      .eq('user_id', userId)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .order('discount_percent', { ascending: false })
      .order('expires_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    return data;
  }

  private async userPlacedOrderAfter(userId: string, date: string) {
    const supabase = this.supabaseService.getClient();

    const { data } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .gt('created_at', date)
      .limit(1);

    return !!data && data.length > 0;
  }

  private buildEmailHtml(params: {
    reminderNumber: 1 | 2;
    subtotal: number;
    coupon: any;
    items: CartItem[];
  }) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const itemCount = Array.isArray(params.items)
      ? params.items.reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0,
        )
      : 0;

    const previewItems = (params.items || []).slice(0, 3);

    const couponText = params.coupon
      ? `You still have a ${params.coupon.discount_percent}% OFF reward waiting for you. For your security, coupon codes are only shown after login.`
      : `Your cart is still waiting for you.`;

    const expiryText = params.coupon?.expires_at
      ? `Your reward expires on ${new Date(
          params.coupon.expires_at,
        ).toLocaleDateString()}.`
      : '';

    const headline =
      params.reminderNumber === 1
        ? `You left something behind`
        : `Still thinking it over?`;

    const itemPreviewHtml =
      previewItems.length > 0
        ? `
          <div style="margin:24px 0; padding:20px; border-radius:22px; background:#0b0f1a; border:1px solid #3b0764;">
            <p style="margin:0 0 12px; color:#d8b4fe; font-weight:700; letter-spacing:3px; text-transform:uppercase; font-size:12px;">
              Cart Preview
            </p>
            ${previewItems
              .map(
                (item) => `
                  <div style="padding:12px 0; border-top:1px solid #2e1247;">
                    <p style="margin:0; color:#ffffff; font-weight:800; font-size:15px;">
                      ${item.name}
                    </p>
                    <p style="margin:5px 0 0; color:#c4b5fd; font-size:13px;">
                      ${item.color} / ${item.size} × ${item.quantity}
                    </p>
                  </div>
                `,
              )
              .join('')}
          </div>
        `
        : '';

    const urgencyHtml =
      params.reminderNumber === 2
        ? `
          <div style="margin:24px 0; padding:22px; border-radius:24px; background:#2a0707; border:1px solid #ef4444;">
            <p style="margin:0 0 8px; color:#fecaca; font-size:17px; font-weight:900;">
              Final Cart Reminder
            </p>
            <p style="margin:0; color:#fee2e2; font-size:15px; line-height:1.6;">
              Items in your cart may be released back to stock in 12 hours. Complete your order soon before your selected pieces become available to other customers.
            </p>
          </div>
        `
        : '';

    return `
      <div style="margin:0; padding:0; background:#05070d;">
        <div style="font-family:Arial, sans-serif; background:linear-gradient(180deg,#12051f 0%,#05070d 45%,#05070d 100%); color:#ffffff; padding:34px 18px;">
          <div style="max-width:620px; margin:0 auto; background:#0b0f1a; border:1px solid #4c1d95; border-radius:28px; padding:30px;">
            <div style="text-align:center; padding:12px 0 26px;">
              <p style="margin:0; letter-spacing:9px; color:#e9d5ff; font-size:13px; font-weight:900;">
                BUNNY'S <span style="color:#e879f9;">WHISPER</span>
              </p>
            </div>

            <p style="margin:0 0 10px; color:#c084fc; font-size:12px; letter-spacing:5px; text-transform:uppercase; font-weight:800;">
              Cart Reminder
            </p>

            <h1 style="font-size:34px; line-height:1.15; margin:0 0 16px; color:#ffffff; font-weight:900;">
              ${headline}
            </h1>

            <p style="color:#cbd5e1; font-size:16px; line-height:1.7; margin:0 0 24px;">
              Your selected pieces are still waiting in your cart.
            </p>

            <div style="margin:24px 0; padding:22px; border-radius:24px; background:#07030d; border:1px solid #6b21a8;">
              <p style="margin:0; color:#d8b4fe; font-size:15px;">
                You have ${itemCount} item${itemCount === 1 ? '' : 's'} in your cart
              </p>
              <p style="font-size:28px; font-weight:900; margin:8px 0 0; color:#d8b4fe;">
                Subtotal: EGP ${Number(params.subtotal).toFixed(2)}
              </p>
            </div>

            ${itemPreviewHtml}
            ${urgencyHtml}

            <div style="margin:24px 0; padding:22px; border-radius:24px; background:#052e1b; border:1px solid #22c55e;">
              <p style="font-size:16px; font-weight:800; margin:0 0 8px; color:#86efac; line-height:1.6;">
                ${couponText}
              </p>
              <p style="margin:0; color:#bbf7d0; font-size:14px;">
                ${expiryText}
              </p>
            </div>

            <p style="color:#cbd5e1; font-size:15px; line-height:1.7; margin:0 0 26px;">
              Return to your account to safely view your reward and complete your order.
            </p>

            <div style="margin-top:26px; text-align:center;">
              <a href="${frontendUrl}/points"
                style="display:inline-block; background:#d8b4fe; color:#000000; text-decoration:none; padding:15px 24px; border-radius:999px; font-weight:900;">
                View My Rewards
              </a>

              <div style="height:14px;"></div>

              <a href="${frontendUrl}/cart"
                style="display:inline-block; color:#d8b4fe; text-decoration:none; font-weight:800;">
                Return To Cart
              </a>
            </div>

            <p style="margin-top:30px; color:#64748b; font-size:12px; line-height:1.5;">
              For your protection, coupon codes are only visible after login.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  private async sendReminder(cart: any, reminderNumber: 1 | 2): Promise<boolean> {
    try {
      const emailFrom =
        this.configService.get<string>('EMAIL_FROM') || 'onboarding@resend.dev';

      const coupon = await this.getBestCoupon(cart.user_id);

      const result = await this.resend.emails.send({
        from: emailFrom,
        to: cart.email,
        subject:
          reminderNumber === 1
            ? "You left something in your Bunny's Whisper cart"
            : "Final reminder: your Bunny's Whisper cart may expire soon",
        html: this.buildEmailHtml({
          reminderNumber,
          subtotal: Number(cart.subtotal || 0),
          coupon,
          items: cart.items || [],
        }),
      });

      void result;
      return true;
    } catch (error) {
      console.error('RESEND email send failed');
      return false;
    }
  }

  private async sendWhatsAppReminder(
    cart: any,
    reminderNumber: 1 | 2,
  ): Promise<boolean> {
    try {
      if (!this.twilioClient) {
        return false;
      }

      if (!cart.phone) {
        return false;
      }

      const from = this.configService.get<string>('TWILIO_WHATSAPP_FROM');
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

      if (!from) {
        return false;
      }

      const coupon = await this.getBestCoupon(cart.user_id);

      const itemCount = Array.isArray(cart.items)
        ? cart.items.reduce(
            (sum: number, item: CartItem) =>
              sum + Number(item.quantity || 0),
            0,
          )
        : 0;

      const rewardLine = coupon
        ? `You also have a ${coupon.discount_percent}% reward waiting. For security, the code is only visible after login.`
        : `Your cart is still waiting for you.`;

      const body =
        reminderNumber === 1
          ? `Bunny's Whisper reminder 🛒\n\nYou left ${itemCount} item${itemCount === 1 ? '' : 's'} in your cart.\nSubtotal: EGP ${Number(cart.subtotal || 0).toFixed(2)}\n\n${rewardLine}\n\nCart: ${frontendUrl}/cart\nRewards: ${frontendUrl}/points`
          : `Final Bunny's Whisper reminder ⚠️\n\nYou still have ${itemCount} item${itemCount === 1 ? '' : 's'} in your cart.\nSubtotal: EGP ${Number(cart.subtotal || 0).toFixed(2)}\n\nItems may be released back to stock in 12 hours.\n\n${rewardLine}\n\nCart: ${frontendUrl}/cart`;

      const result = await this.twilioClient.messages.create({
        from,
        to: cart.phone,
        body,
      });

      void result;
      return true;
    } catch (error) {
      console.error('Twilio WhatsApp send failed');
      return false;
    }
  }

  private async expireOldCarts() {
    const supabase = this.supabaseService.getClient();

    const { data: carts, error } = await supabase
      .from('abandoned_carts')
      .select('*')
      .is('completed_at', null)
      .eq('status', 'active')
      .not('expires_at', 'is', null)
      .lte('expires_at', new Date().toISOString());

    if (error || !carts || carts.length === 0) return;

    for (const cart of carts) {
      await supabase
        .from('abandoned_carts')
        .update({
          status: 'expired',
          expired_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          items: [],
          subtotal: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cart.id);
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async processAbandonedCarts() {
    const supabase = this.supabaseService.getClient();

    await this.expireOldCarts();

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: carts, error } = await supabase
      .from('abandoned_carts')
      .select('*')
      .is('completed_at', null)
      .eq('status', 'active')
      .lt('last_seen_at', twoHoursAgo.toISOString())
      .lt('reminder_count', 2);

    if (error || !carts) return;

    for (const cart of carts) {
      const placedOrder = await this.userPlacedOrderAfter(
        cart.user_id,
        cart.updated_at,
      );

      if (placedOrder) {
        await supabase
          .from('abandoned_carts')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', cart.id);

        continue;
      }

      if (cart.reminder_count === 0) {
        const emailSent = await this.sendReminder(cart, 1);
        const whatsappSent = await this.sendWhatsAppReminder(cart, 1);

        await supabase
          .from('abandoned_carts')
          .update({
            reminder_count: 1,
            first_reminder_sent_at: emailSent
              ? new Date().toISOString()
              : null,
            whatsapp_first_sent_at: whatsappSent
              ? new Date().toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', cart.id);

        continue;
      }

      if (
        cart.reminder_count === 1 &&
        cart.first_reminder_sent_at &&
        new Date(cart.first_reminder_sent_at) <= twentyFourHoursAgo
      ) {
        const emailSent = await this.sendReminder(cart, 2);
        const whatsappSent = await this.sendWhatsAppReminder(cart, 2);

        const expiresAt = new Date(
          Date.now() + 12 * 60 * 60 * 1000,
        ).toISOString();

        await supabase
          .from('abandoned_carts')
          .update({
            reminder_count: 2,
            second_reminder_sent_at: emailSent
              ? new Date().toISOString()
              : null,
            whatsapp_second_sent_at: whatsappSent
              ? new Date().toISOString()
              : null,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', cart.id);
      }
    }
  }
}