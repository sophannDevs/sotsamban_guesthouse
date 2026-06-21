import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';

import { MiniBarConsumptionItemDto } from './create-mini-bar-consumption.dto';

export class UpdateMiniBarConsumptionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MiniBarConsumptionItemDto)
  @IsOptional()
  items?: MiniBarConsumptionItemDto[];
}
