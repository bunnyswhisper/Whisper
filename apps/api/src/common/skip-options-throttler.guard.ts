import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** Preflight must not be rate-limited or blocked by guards. */
@Injectable()
export class SkipOptionsThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ method?: string }>();
    if (req.method === 'OPTIONS') {
      return true;
    }
    return super.shouldSkip(context);
  }
}
