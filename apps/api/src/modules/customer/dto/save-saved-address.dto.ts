import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveSavedAddressDto {
  @IsString()
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @MaxLength(8)
  countryCode!: string;

  @IsString()
  @MaxLength(24)
  phone!: string;

  @IsString()
  @MaxLength(80)
  city!: string;

  @IsString()
  @MaxLength(120)
  area!: string;

  @IsString()
  @MaxLength(240)
  street!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  saveAddress?: boolean;
}
