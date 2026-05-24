import { IsOptional, IsString } from 'class-validator';

export class BootstrapCustomerDto {
  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  countryCode?: string;
}
