import { Controller, Get, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InventoryService } from './inventory.service';
import AdminGuard from '../orders/orders-admin.guard';

@Controller('admin/inventory')
@UseGuards(AdminGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('low-stock')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  getLowStock() {
    return this.inventoryService.getLowStock();
  }
}