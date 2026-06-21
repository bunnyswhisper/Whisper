import { IsBoolean } from 'class-validator';

export class SetEventCampaignActiveDto {
  @IsBoolean()
  active!: boolean;
}
