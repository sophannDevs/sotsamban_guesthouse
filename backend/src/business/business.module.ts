import { Module } from '@nestjs/common';

import { BusinessMemberController } from './business-member.controller';
import { BusinessMemberService } from './business-member.service';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';

@Module({
  controllers: [BusinessController, BusinessMemberController],
  providers: [BusinessService, BusinessMemberService],
  exports: [BusinessService, BusinessMemberService],
})
export class BusinessModule {}
