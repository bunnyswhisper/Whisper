import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateEventCampaignDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  discount_percent: number;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === undefined ? null : value,
  )
  @IsISO8601({ strict: false })
  starts_at?: string | null;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === undefined ? null : value,
  )
  @IsISO8601({ strict: false })
  ends_at?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : value;
  })
  @IsInt()
  @Min(1)
  max_redemptions?: number | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return true;
    return Boolean(value);
  })
  @IsBoolean()
  active?: boolean;
}
