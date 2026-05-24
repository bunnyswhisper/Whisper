import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ReturnClaimedOrderDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  reason: string;
}