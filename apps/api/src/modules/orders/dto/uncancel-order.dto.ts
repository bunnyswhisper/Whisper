import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UncancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
