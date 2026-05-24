import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListPublicReviewsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  product?: string;

  @IsOptional()
  @IsIn(['newest', 'oldest'])
  sort?: 'newest' | 'oldest';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5000)
  offset?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}

export class ListAdminReviewsQueryDto extends ListPublicReviewsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  declare limit?: number;

  @IsOptional()
  @IsIn(['active', 'pending', 'hidden', 'deleted', 'all'])
  state?: 'active' | 'pending' | 'hidden' | 'deleted' | 'all';
}
