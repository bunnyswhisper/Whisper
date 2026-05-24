import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CustomerService } from './customer.service';
import { SaveSavedAddressDto } from './dto/save-saved-address.dto';

@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  private getToken(authorization?: string) {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing customer token');
    }
    return authorization.replace('Bearer ', '');
  }

  @Get('saved-addresses')
  @Throttle({ default: { ttl: 60_000, limit: 90 } })
  listSavedAddresses(@Headers('authorization') authorization?: string) {
    const token = this.getToken(authorization);
    return this.customerService.listSavedAddresses(token);
  }

  @Post('saved-addresses')
  @Throttle({ default: { ttl: 60_000, limit: 45 } })
  saveSavedAddress(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: SaveSavedAddressDto,
  ) {
    const token = this.getToken(authorization);
    return this.customerService.saveSavedAddress(token, body);
  }
}
