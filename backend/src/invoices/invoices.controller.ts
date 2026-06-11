import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';

import { UserRole } from '../../generated/prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { InvoicesService } from './invoices.service';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('booking/:bookingId/pdf')
  async downloadBookingInvoicePdf(
    @Param('bookingId') bookingId: string,
    @Res() response: Response,
  ) {
    const buffer =
      await this.invoicesService.generateBookingInvoicePdf(bookingId);

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${bookingId}.pdf"`,
    );

    return response.send(buffer);
  }
}
