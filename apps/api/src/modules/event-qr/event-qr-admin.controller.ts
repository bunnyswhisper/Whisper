import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import AdminGuard from '../orders/orders-admin.guard';
import { CreateEventCampaignDto } from './dto/create-event-campaign.dto';
import { EventQrService } from './event-qr.service';

@Controller('admin/event-qr')
@UseGuards(AdminGuard)
export class EventQrAdminController {
  constructor(private readonly eventQrService: EventQrService) {}

  @Get('campaigns')
  listCampaigns() {
    return this.eventQrService.listCampaignsWithStats();
  }

  @Post('campaigns')
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
    @Param('id') id: string,
    @Body() body: { active: boolean },
  ) {
    return this.eventQrService.setCampaignActive(id, Boolean(body?.active));
  }
}
