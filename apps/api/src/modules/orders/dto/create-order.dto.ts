import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Max,
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
    customerName: string;
  
    @IsString()
    @IsOptional()
    countryCode?: string;
  
    @IsString()
    @IsNotEmpty()
    customerPhone: string;
  
    @IsOptional()
    @IsString()
    customerEmail?: string;
  
    @IsString()
    @IsNotEmpty()
    city: string;
  
    @IsString()
    @IsNotEmpty()
    area: string;
  
    @IsString()
    @IsNotEmpty()
    street: string;
  
    @IsOptional()
    @IsString()
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