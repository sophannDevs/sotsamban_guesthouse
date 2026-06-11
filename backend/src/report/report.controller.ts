import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from '../../generated/prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import type { PaginationQuery } from '../common/pagination';
import { ReportExcelService } from './report-excel.service';
import { ReportPdfService } from './report-pdf.service';
import { ReportService } from './report.service';

type ExportFormat = 'excel' | 'pdf';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('reports')
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly reportExcelService: ReportExcelService,
    private readonly reportPdfService: ReportPdfService,
  ) {}

  @Get('health')
  health() {
    return this.reportService.health();
  }

  @Get('revenue')
  getRevenueReport(
    @Query('rangePreset') rangePreset?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportService.getRevenueReport({ rangePreset, startDate, endDate });
  }

  @Get('bookings')
  getBookingReport(
    @Query()
    query: PaginationQuery & {
      rangePreset?: string;
      startDate?: string;
      endDate?: string;
      status?: BookingStatus;
      roomId?: string;
      guestId?: string;
    },
  ) {
    return this.reportService.getBookingReport(query);
  }

  @Get('payments')
  getPaymentReport(
    @Query()
    query: PaginationQuery & {
      rangePreset?: string;
      startDate?: string;
      endDate?: string;
      paymentStatus?: PaymentStatus;
      method?: PaymentMethod;
    },
  ) {
    return this.reportService.getPaymentReport(query);
  }

  @Get('guests')
  getGuestReport(
    @Query()
    query: PaginationQuery & {
      rangePreset?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.reportService.getGuestReport(query);
  }

  @Get('occupancy')
  getOccupancyReport() {
    return this.reportService.getOccupancyReport();
  }

  @Get(':type/export')
  async exportReport(
    @Param('type') type: string,
    @Query('format') format: string | undefined,
    @Query('rangePreset') rangePreset: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Query('status') status: BookingStatus | undefined,
    @Query('roomId') roomId: string | undefined,
    @Query('guestId') guestId: string | undefined,
    @Query('paymentStatus') paymentStatus: PaymentStatus | undefined,
    @Query('method') method: PaymentMethod | undefined,
    @Query('search') search: string | undefined,
    @Res() response: Response,
  ) {
    if (!this.isExportFormat(format)) {
      throw new BadRequestException('format must be excel or pdf.');
    }

    if (!this.reportService.isReportType(type)) {
      throw new BadRequestException(
        'type must be one of the following values: revenue, bookings, payments, guests, occupancy.',
      );
    }

    const payload = await this.reportService.getExcelReportPayload(type, {
      rangePreset,
      startDate,
      endDate,
      status,
      roomId,
      guestId,
      paymentStatus,
      method,
      search,
    });
    const buffer =
      format === 'excel'
        ? await this.reportExcelService.generate(payload)
        : await this.reportPdfService.generate(payload);

    response.setHeader(
      'Content-Type',
      format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${type}-report.${format === 'excel' ? 'xlsx' : 'pdf'}"`,
    );

    return response.send(buffer);
  }

  private isExportFormat(format: string | undefined): format is ExportFormat {
    return format === 'excel' || format === 'pdf';
  }
}
