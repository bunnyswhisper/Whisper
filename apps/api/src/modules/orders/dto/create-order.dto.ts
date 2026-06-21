import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsEmail,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    ValidateNested,
  } from 'class-validator';
  import { Type } from 'class-transformer';
  
  class OrderItemDto {
    @IsUUID()
    productId: string;
  
    @IsUUID()
    variantId: string;
  
    @IsString()
    @IsNotEmpty()
    name: string;
  
    @IsString()
    @IsNotEmpty()
    slug: string;
  
    @IsOptional()
    @IsString()
    image?: string;
  
    @IsString()
    @IsNotEmpty()
    size: string;
  
    @IsString()
    @IsNotEmpty()
    color: string;
  
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(20)
    quantity: number;

    /** Display-only — create_order_with_inventory prices from DB, not this field. */
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    price?: number;
  }
  
  export class CreateOrderDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    customerName: string;
  
    @IsOptional()
    @IsString()
    @MaxLength(6)
    countryCode?: string;
  
    @IsString()
    @IsNotEmpty()
    @MaxLength(30)
    customerPhone: string;
  
    @IsOptional()
    @IsEmail()
    @MaxLength(254)
    customerEmail?: string;
  
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    city: string;
  
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    area: string;
  
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    street: string;
  
    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;
  
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    items: OrderItemDto[];
  
    @IsOptional()
    @IsString()
    couponCode?: string | null;

    @IsOptional()
    @IsIn(['cash_on_delivery', 'paymob'])
    paymentMethod?: 'cash_on_delivery' | 'paymob';

    @IsOptional()
    @IsIn(['none', 'coupon', 'event'])
    discountSource?: 'none' | 'coupon' | 'event';

    @IsOptional()
    @IsUUID()
    eventCampaignId?: string | null;

    @IsOptional()
    @IsString()
    eventCampaignCode?: string | null;

    @IsOptional()
    @IsString()
    eventDeviceKey?: string | null;

    /** Client hint only — server uses campaign + redemption row for authoritative %. */
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(100)
    eventDiscountPercent?: number | null;
  }