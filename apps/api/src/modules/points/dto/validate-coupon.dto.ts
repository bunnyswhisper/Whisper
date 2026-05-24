import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ValidateCouponDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  subtotal: number;

  /** Delivery fee (EGP). Coupon % applies to subtotal + delivery_fee only (no VAT). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deliveryFee?: number;
}