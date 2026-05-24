import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export default class AdminGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase());

    if (!adminEmails.includes(user.email.toLowerCase())) {
      throw new ForbiddenException('You are not allowed to access admin pages');
    }

    return true;
  }
}