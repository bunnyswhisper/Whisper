import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';

export type BootstrapCustomerHints = {
  phone?: string | null;
  countryCode?: string;
};

function isUniqueViolation(err: { code?: string; message?: string }): boolean {
  const code = String(err.code ?? '');
  const msg = String(err.message ?? '').toLowerCase();
  return code === '23505' || msg.includes('duplicate') || msg.includes('unique');
}

function displayNameFromUser(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const full =
    (typeof meta?.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta?.name === 'string' && meta.name.trim()) ||
    '';
  if (full) return full;
  const email = user.email?.trim() || '';
  if (email.includes('@')) return email.split('@')[0] || 'Customer';
  return 'Customer';
}

function normalizeOptionalPhone(
  raw: string | null | undefined,
  countryCode: string,
): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  const cc = countryCode.trim() || '+20';
  return `${cc}${digits}`;
}

@Injectable()
export class AuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private async resolveUser(token: string): Promise<User> {
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

  async getMe(token: string) {
    const user = await this.resolveUser(token);

    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const email = (user.email ?? '').trim().toLowerCase();

    return {
      id: user.id,
      email,
      name:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        'Account',
      isAdmin: adminEmails.includes(email),
    };
  }

  /**
   * Ensures customer_profiles and customer_points exist (service role).
   * Uses upsert with ignoreDuplicates so existing rows are never overwritten.
   */
  async bootstrapCustomer(token: string, hints?: BootstrapCustomerHints) {
    const user = await this.resolveUser(token);
    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();

    const countryCode = (hints?.countryCode ?? '+20').trim() || '+20';
    const phone = normalizeOptionalPhone(hints?.phone ?? null, countryCode);

    const profileRow: Record<string, unknown> = {
      user_id: user.id,
      full_name: displayNameFromUser(user),
      email: user.email?.trim() || '',
      country_code: countryCode,
      city: '',
      area: '',
      street: '',
      updated_at: now,
    };
    if (phone) profileRow.phone = phone;

    const { error: profileUpsertErr } = await supabase
      .from('customer_profiles')
      .upsert(profileRow, { onConflict: 'user_id', ignoreDuplicates: true });

    if (profileUpsertErr && !isUniqueViolation(profileUpsertErr)) {
      throw new BadRequestException(profileUpsertErr.message);
    }

    const { error: pointsUpsertErr } = await supabase.from('customer_points').upsert(
      {
        user_id: user.id,
        points_balance: 0,
        lifetime_points: 0,
        updated_at: now,
      },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );

    if (pointsUpsertErr && !isUniqueViolation(pointsUpsertErr)) {
      throw new BadRequestException(pointsUpsertErr.message);
    }

    const { data: profile, error: profileSelErr } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileSelErr) {
      throw new BadRequestException(profileSelErr.message);
    }

    const { data: points, error: pointsSelErr } = await supabase
      .from('customer_points')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (pointsSelErr) {
      throw new BadRequestException(pointsSelErr.message);
    }

    return { ok: true as const, profile: profile ?? null, points: points ?? null };
  }
}
