import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminReviewReplyDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  adminReply?: string;
}
