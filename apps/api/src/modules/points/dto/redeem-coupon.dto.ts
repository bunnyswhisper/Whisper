import { IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class RedeemCouponDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  pointsCost: number;
}