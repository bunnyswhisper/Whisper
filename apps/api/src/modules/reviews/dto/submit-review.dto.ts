import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { REVIEW_PHONE_COUNTRY_CODES } from '../review-phone.util';

function readString(obj: object, camel: string, snake: string): string {
  const o = obj as Record<string, unknown>;
  const raw = o[camel] ?? o[snake];
  return typeof raw === 'string' ? raw.trim() : '';
}

export class SubmitReviewDto {
  @Transform(({ obj }) => readString(obj, 'token', 'token'))
  @IsString()
  @MaxLength(256)
  token!: string;

  @Type(() => Number)
  @Transform(({ value, obj }) => {
    const o = obj as Record<string, unknown>;
    const n = Number(value ?? o.rating);
    return Number.isFinite(n) ? n : NaN;
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @Transform(({ obj }) => readString(obj, 'reviewerName', 'reviewer_name'))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  reviewerName!: string;

  @Transform(({ obj }) => readString(obj, 'reviewerEmail', 'reviewer_email'))
  @IsEmail()
  @MaxLength(254)
  reviewerEmail!: string;

  @Transform(({ obj }) =>
    readString(obj, 'reviewerPhoneCountryCode', 'reviewer_phone_country_code'),
  )
  @IsIn([...REVIEW_PHONE_COUNTRY_CODES])
  reviewerPhoneCountryCode!: string;

  @Transform(({ obj }) => readString(obj, 'reviewerPhone', 'reviewer_phone'))
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  reviewerPhone!: string;

  @Transform(({ obj }) => readString(obj, 'reviewText', 'review_text'))
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reviewText!: string;

  @IsOptional()
  @Transform(({ obj }) => {
    const v = readString(obj, 'publicProductName', 'public_product_name');
    return v || undefined;
  })
  @IsString()
  @MaxLength(120)
  publicProductName?: string;
}
