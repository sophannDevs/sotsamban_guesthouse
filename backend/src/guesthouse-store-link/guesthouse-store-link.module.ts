import { Module } from '@nestjs/common';

import { GuesthouseStoreLinkController } from './guesthouse-store-link.controller';
import { GuesthouseStoreLinkService } from './guesthouse-store-link.service';

@Module({
  controllers: [GuesthouseStoreLinkController],
  providers: [GuesthouseStoreLinkService],
  exports: [GuesthouseStoreLinkService],
})
export class GuesthouseStoreLinkModule {}
