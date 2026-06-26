import { Module } from '@nestjs/common';
import { AutoCheckoutService } from './auto-checkout.service';

@Module({
  providers: [AutoCheckoutService],
})
export class AutoCheckoutModule {}
