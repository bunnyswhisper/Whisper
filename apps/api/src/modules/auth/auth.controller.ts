import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { BootstrapCustomerDto } from './dto/bootstrap-customer.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getToken(authorization?: string) {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing token');
    }

    return authorization.replace('Bearer ', '');
  }

  @Get('me')
  @Throttle({ default: { ttl: 60_000, limit: 90 } })
  getMe(@Headers('authorization') authorization?: string) {
    const token = this.getToken(authorization);
    return this.authService.getMe(token);
  }

  @Post('bootstrap-customer')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  bootstrapCustomer(
    @Headers('authorization') authorization?: string,
    @Body() body?: BootstrapCustomerDto,
  ) {
    const token = this.getToken(authorization);
    return this.authService.bootstrapCustomer(token, body);
  }
}
