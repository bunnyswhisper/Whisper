import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../supabase/supabase.module';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';

@Module({
  imports: [SupabaseModule],
  controllers: [CustomerController],
  providers: [CustomerService],
})
export class CustomerModule {}
