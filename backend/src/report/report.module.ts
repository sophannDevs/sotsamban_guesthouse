import { Module } from '@nestjs/common';

import { SettingsModule } from '../settings/settings.module';

import { ReportController } from './report.controller';
import { ReportExcelService } from './report-excel.service';
import { ReportPdfService } from './report-pdf.service';
import { ReportService } from './report.service';

@Module({
  imports: [SettingsModule],
  controllers: [ReportController],
  providers: [ReportService, ReportExcelService, ReportPdfService],
})
export class ReportModule {}
