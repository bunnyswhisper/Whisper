import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import AdminGuard from '../orders/orders-admin.guard';
import {
  CreateFinanceEntryDto,
  FinanceQueryDto,
  UpdateFinanceEntryDto,
} from './dto/finance-entry.dto';
import { FinanceService } from './finance.service';

@Controller('admin/finance')
@UseGuards(AdminGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('categories')
  getCategories() {
    return this.financeService.getCategories();
  }

  @Get()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  listEntries(@Query() query: FinanceQueryDto) {
    return this.financeService.listEntries(query);
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  createEntry(@Body() body: CreateFinanceEntryDto, @Req() req: Request) {
    return this.financeService.createEntry(body, req);
  }

  @Patch(':id')
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  updateEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateFinanceEntryDto,
  ) {
    return this.financeService.updateEntry(id, body);
  }

  @Delete(':id')
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  deleteEntry(@Param('id', ParseUUIDPipe) id: string) {
    return this.financeService.deleteEntry(id);
  }
}
