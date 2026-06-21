import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export class CreateProductVariantDto {
  @IsString()
  @MaxLength(64)
  color!: string;

  @IsString()
  @MaxLength(32)
  size!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999_999)
  stock_quantity?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsString()
  @MaxLength(7)
  @Matches(HEX_COLOR_PATTERN, { message: 'color_hex must be a valid hex color' })
  color_hex?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateProductVariantDto {
  @IsString()
  @MaxLength(32)
  size!: string;

  @IsString()
  @MaxLength(64)
  color!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999_999)
  stock_quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999_999)
  reserved_quantity?: number;

  @IsBoolean()
  is_active!: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsString()
  @MaxLength(7)
  @Matches(HEX_COLOR_PATTERN, { message: 'color_hex must be a valid hex color' })
  color_hex?: string | null;
}

export class CreateProductImageDto {
  @IsString()
  @MaxLength(2048)
  image_url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt_text?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sort_order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  color_name?: string | null;
}

export class AddProductImageDto {
  @IsString()
  @MaxLength(2048)
  image_url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt_text?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sort_order?: number;
}

export class UpdateProductImageDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(64)
  color_name?: string | null;

  @IsOptional()
  @IsBoolean()
  set_as_card_image?: boolean;
}

export class CreateProductDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(SLUG_PATTERN, { message: 'slug format is invalid' })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  base_price!: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sale_price?: number | null;

  @IsOptional()
  @IsIn(['active', 'draft', 'inactive'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUUID()
  category_id?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants!: CreateProductVariantDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductImageDto)
  images?: CreateProductImageDto[];
}

export class UpdateProductDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  base_price!: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sale_price?: number | null;

  @IsIn(['active', 'draft', 'inactive'])
  status!: string;

  @IsBoolean()
  is_featured!: boolean;
}

export class RenameProductImageColorsDto {
  @IsString()
  @MaxLength(64)
  old_color_name!: string;

  @IsString()
  @MaxLength(64)
  new_color_name!: string;
}
