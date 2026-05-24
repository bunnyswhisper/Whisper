import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/** Printable ASCII; service normalizes with trim + upper. */
const CLAIM_CODE_PATTERN = /^[\x20-\x7E]+$/;

export class ClaimPointsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(CLAIM_CODE_PATTERN, {
    message: 'Invalid claim code format',
  })
  code: string;
}
