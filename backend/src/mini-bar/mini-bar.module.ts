import { Module } from '@nestjs/common';

import { MiniBarConsumptionController } from './mini-bar-consumption.controller';
import { MiniBarConsumptionService } from './mini-bar-consumption.service';

@Module({
  controllers: [MiniBarConsumptionController],
  providers: [MiniBarConsumptionService],
  exports: [MiniBarConsumptionService],
})
export class MiniBarModule {}
