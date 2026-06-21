import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import AdminGuard from '../orders/orders-admin.guard';
import { CreateEventCampaignDto } from './dto/create-event-campaign.dto';
import { SetEventCampaignActiveDto } from './dto/set-active.dto';
import { EventQrService } from './event-qr.service';

@Controller('admin/event-qr')
@UseGuards(AdminGuard)
export class EventQrAdminController {
  constructor(private readonly eventQrService: EventQrService) {}

  @Get('campaigns')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  listCampaigns() {
    return this.eventQrService.listCampaignsWithStats();
  }

  @Post('campaigns')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  createCampaign(@Body() body: CreateEventCampaignDto) {
    return this.eventQrService.createCampaign({
      name: body.name,
      discount_percent: body.discount_percent,
      starts_at: body.starts_at ?? null,
      ends_at: body.ends_at ?? null,
      max_redemptions: body.max_redemptions ?? null,
      active: body.active !== false,
    });
  }

  @Patch('campaigns/:id/active')
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetEventCampaignActiveDto,
  ) {
    return this.eventQrService.setCampaignActive(id, body.active);
  }
}
