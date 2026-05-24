import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { SkipOptionsThrottlerGuard } from './common/skip-options-throttler.guard';

import { AppController } from './app.controller';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomerModule } from './modules/customer/customer.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PointsModule } from './modules/points/points.module';
import { AbandonedCartsModule } from './modules/abandoned-carts/abandoned-carts.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DebugModule } from './modules/debug/debug.module';
import { EventQrModule } from './modules/event-qr/event-qr.module';
import { ReviewsModule } from './modules/reviews/reviews.module';

const optionalDebugModule =
  process.env.NODE_ENV === 'production' ? [] : [DebugModule];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['D:/Whisper/clothing-brand/apps/api/.env', '.env'],
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    ScheduleModule.forRoot(),
    SupabaseModule,
    AuthModule,
    CustomerModule,
    ProductsModule,
    InventoryModule,
    OrdersModule,
    PointsModule,
    AbandonedCartsModule,
    PaymentsModule,
    NotificationsModule,
    ...optionalDebugModule,
    EventQrModule,
    ReviewsModule,
  ],

  controllers: [AppController],

  providers: [
    {
      provide: APP_GUARD,
      useClass: SkipOptionsThrottlerGuard,
    },
  ],
})
export class AppModule {}