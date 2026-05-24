/**
 * TEMPORARY DEV ONLY — remove before production.
 */

import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { EventQrModule } from '../event-qr/event-qr.module';
import { DebugController } from './debug.controller';

@Module({
  imports: [EmailModule, EventQrModule],
  controllers: [DebugController],
})
export class DebugModule {}
