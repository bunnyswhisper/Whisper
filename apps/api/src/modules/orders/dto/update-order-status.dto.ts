import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'])
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

  /** Stored when admin cancels; included in order_cancelled customer email. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  cancellationReason?: string;
}
