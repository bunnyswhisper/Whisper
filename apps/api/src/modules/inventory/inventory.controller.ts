import { Controller, Get, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import AdminGuard from '../orders/orders-admin.guard';

@Controller('admin/inventory')
@UseGuards(AdminGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('low-stock')
  getLowStock() {
    return this.inventoryService.getLowStock();
  }
}