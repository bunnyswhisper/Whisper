import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreatePaymobIntentionDto {
  @IsUUID()
  @IsNotEmpty()
  orderId: string;
}
