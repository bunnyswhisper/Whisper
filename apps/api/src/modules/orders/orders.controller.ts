import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import AdminGuard from './orders-admin.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { ReturnClaimedOrderDto } from './dto/return-claimed-order.dto';
import { UncancelOrderDto } from './dto/uncancel-order.dto';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('orders')
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  createOrder(
    @Body() body: CreateOrderDto,
    @Headers('authorization') authorization?: string,
  ) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.replace('Bearer ', '')
      : undefined;

    return this.ordersService.createOrder(body, token);
  }

  @Get('customer/orders/:id')
  findMyOrderById(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing customer token');
    }

    const token = authorization.replace('Bearer ', '');
    return this.ordersService.findMyOrderById(token, id);
  }

  @Get('customer/orders')
  findMyOrders(@Headers('authorization') authorization?: string) {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing customer token');
    }

    const token = authorization.replace('Bearer ', '');
    return this.ordersService.findMyOrders(token);
  }

  @Get('admin/orders')
  @UseGuards(AdminGuard)
  findAllOrders() {
    return this.ordersService.findAllOrders();
  }

  @Patch('admin/orders/:id/status')
  @UseGuards(AdminGuard)
  updateOrderStatus(
    @Param('id') id: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateOrderStatus(
      id,
      body.status,
      body.cancellationReason,
    );
  }

  @Patch('admin/orders/:id/return-claimed')
  @UseGuards(AdminGuard)
  returnClaimedOrder(
    @Param('id') id: string,
    @Body() body: ReturnClaimedOrderDto,
  ) {
    return this.ordersService.returnClaimedOrder(id, body.reason);
  }

  @Patch('admin/orders/:id/uncancel')
  @UseGuards(AdminGuard)
  uncancelOrder(
    @Param('id') id: string,
    @Body() body: UncancelOrderDto,
    @Headers('authorization') authorization?: string,
  ) {
    const token =
      authorization?.startsWith('Bearer ') && authorization.length > 7
        ? authorization.slice(7)
        : '';
    return this.ordersService.uncancelOrder(id, body?.reason, token);
  }

  @Get('admin/analytics-extra')
  @UseGuards(AdminGuard)
  getAnalyticsExtra() {
    return this.ordersService.getAnalyticsExtra();
  }
}