import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { SaveSavedAddressDto } from './dto/save-saved-address.dto';

type SavedAddressRow = {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  country_code: string;
  phone: string;
  city: string;
  area: string;
  street: string;
  notes: string | null;
  is_default: boolean;
  created_at?: string;
};

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private async resolveUser(token: string) {
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

  private digitsOnly(value: string): string {
    return value.replace(/\D/g, '');
  }

  /** Match primary email and Gmail-style +alias variants (e.g. user+manual2@domain). */
  private orderEmailOrFilter(email: string): string {
    const normalized = email.trim().toLowerCase();
    const at = normalized.indexOf('@');
    if (at < 0) {
      return `customer_email.eq.${normalized}`;
    }
    const local = normalized.slice(0, at);
    const domain = normalized.slice(at + 1);
    const baseLocal = local.split('+')[0];
    return `customer_email.eq.${normalized},customer_email.ilike.${baseLocal}+%@${domain}`;
  }

  private inferCountryCode(phone: string): string {
    const trimmed = phone.trim();
    if (trimmed.startsWith('+20')) return '+20';
    const match = trimmed.match(/^\+\d{1,3}/);
    return match?.[0] || '+20';
  }

  private stripCountryCodeFromPhone(phone: string, countryCode: string): string {
    const trimmed = phone.trim();
    if (countryCode && trimmed.startsWith(countryCode)) {
      return trimmed.slice(countryCode.length).trim();
    }
    return trimmed.replace(/^\+\d{1,3}/, '').trim();
  }

  private async fetchSavedAddressesForUser(
    userId: string,
  ): Promise<SavedAddressRow[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('saved_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data ?? []) as SavedAddressRow[];
  }

  /**
   * When the same person signs in with a different auth provider, saved_addresses
   * may still reference a legacy user_id from an earlier account.
   */
  private async rehomeLegacySavedAddresses(
    userId: string,
    email: string,
  ): Promise<SavedAddressRow[]> {
    const supabase = this.supabaseService.getClient();
    const normalizedEmail = email.trim().toLowerCase();

    const { data: orderRows, error: orderErr } = await supabase
      .from('orders')
      .select('user_id')
      .or(this.orderEmailOrFilter(normalizedEmail))
      .not('user_id', 'is', null);

    if (orderErr) {
      this.logger.warn(
        `rehomeLegacySavedAddresses orders lookup: ${orderErr.message}`,
      );
      return [];
    }

    const legacyUserIds = [
      ...new Set(
        (orderRows || [])
          .map((row) => String(row.user_id))
          .filter((id) => id && id !== userId),
      ),
    ];

    if (!legacyUserIds.length) {
      return [];
    }

    const { data: legacyAddresses, error: addrErr } = await supabase
      .from('saved_addresses')
      .select('*')
      .in('user_id', legacyUserIds)
      .order('is_default', { ascending: false });

    if (addrErr || !legacyAddresses?.length) {
      if (addrErr) {
        this.logger.warn(
          `rehomeLegacySavedAddresses fetch: ${addrErr.message}`,
        );
      }
      return [];
    }

    const ids = legacyAddresses.map((row) => row.id);
    const { error: updateErr } = await supabase
      .from('saved_addresses')
      .update({ user_id: userId })
      .in('id', ids);

    if (updateErr) {
      this.logger.warn(
        `rehomeLegacySavedAddresses update: ${updateErr.message}`,
      );
      return legacyAddresses.map((row) => ({
        ...(row as SavedAddressRow),
        user_id: userId,
      }));
    }

    this.logger.log(
      `Re-homed ${legacyAddresses.length} saved address(es) to user ${userId}`,
    );

    return legacyAddresses.map((row) => ({
      ...(row as SavedAddressRow),
      user_id: userId,
    }));
  }

  private async fallbackAddressFromLatestOrder(
    userId: string,
    email: string | undefined,
  ): Promise<SavedAddressRow[]> {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('orders')
      .select(
        'id, customer_name, customer_phone, city, area, street, notes, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(1);

    if (email?.trim()) {
      query = query.or(
        `user_id.eq.${userId},${this.orderEmailOrFilter(email.trim().toLowerCase())}`,
      );
    } else {
      query = query.eq('user_id', userId);
    }

    const { data: order, error } = await query.maybeSingle();

    if (error || !order) {
      if (error) {
        this.logger.warn(
          `fallbackAddressFromLatestOrder: ${error.message}`,
        );
      }
      return [];
    }

    const phoneRaw = String(order.customer_phone ?? '').trim();
    if (!phoneRaw) {
      return [];
    }

    const countryCode = this.inferCountryCode(phoneRaw);
    const localPhone = this.stripCountryCodeFromPhone(phoneRaw, countryCode);
    const fullPhone = phoneRaw.startsWith('+')
      ? phoneRaw
      : `${countryCode}${localPhone}`;

    return [
      {
        id: `order-fallback-${order.id}`,
        user_id: userId,
        label: 'Last order',
        full_name: String(order.customer_name ?? '').trim() || 'Customer',
        country_code: countryCode,
        phone: fullPhone,
        city: String(order.city ?? '').trim(),
        area: String(order.area ?? '').trim(),
        street: String(order.street ?? '').trim(),
        notes: order.notes ? String(order.notes).trim() : null,
        is_default: true,
      },
    ];
  }

  private isDuplicateAddress(
    existing: Pick<SavedAddressRow, 'street' | 'area' | 'city' | 'phone'>[],
    body: SaveSavedAddressDto,
  ): boolean {
    const street = body.street.trim();
    const area = body.area.trim();
    const city = body.city.trim();
    const phoneDigits = this.digitsOnly(body.phone);

    return existing.some(
      (row) =>
        row.street.trim() === street &&
        row.area.trim() === area &&
        row.city.trim() === city &&
        this.digitsOnly(row.phone) === phoneDigits,
    );
  }

  async listSavedAddresses(token: string) {
    const user = await this.resolveUser(token);

    let addresses = await this.fetchSavedAddressesForUser(user.id);

    if (!addresses.length && user.email) {
      addresses = await this.rehomeLegacySavedAddresses(
        user.id,
        user.email,
      );
    }

    if (!addresses.length) {
      addresses = await this.fallbackAddressFromLatestOrder(
        user.id,
        user.email,
      );
    }

    return addresses;
  }

  async saveSavedAddress(token: string, body: SaveSavedAddressDto) {
    if (body.saveAddress === false) {
      return { saved: false, skipped: true };
    }

    const user = await this.resolveUser(token);
    const supabase = this.supabaseService.getClient();

    const { data: existingRows, error: existingErr } = await supabase
      .from('saved_addresses')
      .select('id, street, area, city, phone')
      .eq('user_id', user.id);

    if (existingErr) {
      throw new BadRequestException(existingErr.message);
    }

    if (this.isDuplicateAddress(existingRows ?? [], body)) {
      return { saved: false, skipped: true, reason: 'duplicate' };
    }

    const { data: defaults } = await supabase
      .from('saved_addresses')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_default', true);

    const isFirst = !defaults?.length;

    const { data, error } = await supabase
      .from('saved_addresses')
      .insert({
        user_id: user.id,
        label: isFirst ? 'Home' : `Address ${Date.now()}`,
        full_name: body.fullName.trim(),
        country_code: body.countryCode.trim(),
        phone: body.phone.trim(),
        city: body.city.trim(),
        area: body.area.trim(),
        street: body.street.trim(),
        notes: body.notes?.trim() || null,
        is_default: isFirst,
      })
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { saved: true, address: data };
  }
}
