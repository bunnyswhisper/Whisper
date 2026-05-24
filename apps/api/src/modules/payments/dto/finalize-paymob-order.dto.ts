import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class FinalizePaymobOrderDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  orderId!: string;

  /** Paymob redirect query params (excluding internal orderId). */
  @IsOptional()
  @IsObject()
  redirectCallback?: Record<string, string>;
}
