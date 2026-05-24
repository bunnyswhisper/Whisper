import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/** POST /events/qr/redeem — must match Event QR landing JSON body. */
export class RedeemEventQrDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : String(value ?? '').trim(),
  )
  @IsString()
  @IsNotEmpty()
  code!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : String(value ?? '').trim(),
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  deviceKey!: string;
}
