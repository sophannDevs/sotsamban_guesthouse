import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';

import { PaymentStatus, Prisma } from '../../generated/prisma/client';
import { translateError } from '../common/i18n';
import { PrismaService } from '../prisma/prisma.service';

type InvoiceBooking = Prisma.BookingGetPayload<{
  include: {
    guest: true;
    room: true;
    payments: {
      orderBy: {
        createdAt: 'desc';
      };
    };
  };
}>;

type InvoiceLine = {
  label: string;
  value: string;
};

type InvoicePreferences = {
  currency: 'USD' | 'KHR';
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD';
  language: 'en' | 'km';
  timezone: 'Asia/Phnom_Penh';
};

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async generateBookingInvoicePdf(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        guest: true,
        room: true,
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(translateError('bookingNotFound'));
    }

    const preferences = await this.getPreferences();

    return this.generatePdf(booking, preferences);
  }

  private generatePdf(
    booking: InvoiceBooking,
    preferences: InvoicePreferences,
  ) {
    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({
        margin: 48,
        size: 'A4',
      });
      const chunks: Buffer[] = [];

      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);

      this.renderHeader(document, booking, preferences);
      this.renderInvoiceDetails(document, booking);
      this.renderStayDetails(document, booking, preferences);
      this.renderPaymentDetails(document, booking);
      this.renderFooter(document);

      document.end();
    });
  }

  private renderHeader(
    document: PDFKit.PDFDocument,
    booking: InvoiceBooking,
    preferences: InvoicePreferences,
  ) {
    document
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor('#111827')
      .text('Guesthouse Invoice');

    document
      .moveDown(0.35)
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#4b5563')
      .text(`Invoice number: ${this.getInvoiceNumber(booking.id)}`)
      .text(`Generated date: ${this.formatDateTime(new Date(), preferences)}`);

    document.moveDown(1.2);
  }

  private renderInvoiceDetails(
    document: PDFKit.PDFDocument,
    booking: InvoiceBooking,
  ) {
    this.renderSection(document, 'Guest', [
      { label: 'Guest name', value: booking.guest.fullName },
      { label: 'Room number', value: booking.room.roomNumber },
      { label: 'Room type', value: this.formatEnum(booking.room.type) },
    ]);
  }

  private renderStayDetails(
    document: PDFKit.PDFDocument,
    booking: InvoiceBooking,
    preferences: InvoicePreferences,
  ) {
    const nights = this.calculateNights(
      booking.checkInDate,
      booking.checkOutDate,
    );
    const pricePerNight = Number(booking.room.pricePerNight);
    const totalPrice = Number(booking.totalPrice);

    this.renderSection(document, 'Stay Details', [
      {
        label: 'Check-in date',
        value: this.formatDate(booking.checkInDate, preferences),
      },
      {
        label: 'Check-out date',
        value: this.formatDate(booking.checkOutDate, preferences),
      },
      { label: 'Nights', value: String(nights) },
      {
        label: 'Price per night',
        value: this.formatCurrency(pricePerNight, preferences),
      },
      {
        label: 'Total price',
        value: this.formatCurrency(totalPrice, preferences),
      },
    ]);
  }

  private renderPaymentDetails(
    document: PDFKit.PDFDocument,
    booking: InvoiceBooking,
  ) {
    const payment = this.getPrimaryPayment(booking);

    this.renderSection(document, 'Payment', [
      {
        label: 'Payment status',
        value: payment ? this.formatEnum(payment.status) : 'No payment',
      },
      {
        label: 'Payment method',
        value: payment ? this.formatEnum(payment.method) : 'No payment',
      },
    ]);
  }

  private renderSection(
    document: PDFKit.PDFDocument,
    title: string,
    lines: InvoiceLine[],
  ) {
    document
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#111827')
      .text(title);
    document.moveDown(0.45);

    for (const line of lines) {
      this.renderLine(document, line);
    }

    document.moveDown(1);
  }

  private renderLine(document: PDFKit.PDFDocument, line: InvoiceLine) {
    const labelWidth = 150;
    const x = document.page.margins.left;
    const y = document.y;

    document
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#6b7280')
      .text(line.label, x, y, { width: labelWidth });
    document
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#111827')
      .text(line.value, x + labelWidth, y);
    document.moveDown(0.55);
  }

  private renderFooter(document: PDFKit.PDFDocument) {
    const bottomY = document.page.height - document.page.margins.bottom - 32;

    document
      .moveTo(document.page.margins.left, bottomY)
      .lineTo(document.page.width - document.page.margins.right, bottomY)
      .strokeColor('#e5e7eb')
      .lineWidth(1)
      .stroke();

    document
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#6b7280')
      .text(
        'Thank you for choosing Sot Samban GuestHouse.',
        document.page.margins.left,
        bottomY + 12,
      );
  }

  private getPrimaryPayment(booking: InvoiceBooking) {
    return (
      booking.payments.find(
        (payment) => payment.status === PaymentStatus.PAID,
      ) ??
      booking.payments[0] ??
      null
    );
  }

  private calculateNights(checkInDate: Date, checkOutDate: Date) {
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / millisecondsPerDay,
    );

    return Math.max(nights, 0);
  }

  private getInvoiceNumber(bookingId: string) {
    return `INV-${bookingId}`;
  }

  private async getPreferences(): Promise<InvoicePreferences> {
    const settings = await this.prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['currency', 'dateFormat', 'language', 'timezone'],
        },
      },
    });
    const values = Object.fromEntries(
      settings.map((setting) => [setting.key, setting.value]),
    );

    return {
      currency: values.currency === 'KHR' ? 'KHR' : 'USD',
      dateFormat:
        values.dateFormat === 'DD/MM/YYYY' ? 'DD/MM/YYYY' : 'YYYY-MM-DD',
      language: values.language === 'km' ? 'km' : 'en',
      timezone: 'Asia/Phnom_Penh',
    };
  }

  private formatCurrency(value: number, preferences: InvoicePreferences) {
    return new Intl.NumberFormat(this.getLocale(preferences), {
      style: 'currency',
      currency: preferences.currency,
      maximumFractionDigits: preferences.currency === 'KHR' ? 0 : 2,
    }).format(value);
  }

  private formatDate(date: Date, preferences: InvoicePreferences) {
    const parts = this.getDateParts(date, preferences);

    if (preferences.dateFormat === 'DD/MM/YYYY') {
      return `${parts.day}/${parts.month}/${parts.year}`;
    }

    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  private formatDateTime(date: Date, preferences: InvoicePreferences) {
    const time = new Intl.DateTimeFormat(this.getLocale(preferences), {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: preferences.timezone,
    }).format(date);

    return `${this.formatDate(date, preferences)} ${time}`;
  }

  private getDateParts(date: Date, preferences: InvoicePreferences) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone: preferences.timezone,
      year: 'numeric',
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );

    return {
      day: values.day ?? '01',
      month: values.month ?? '01',
      year: values.year ?? '1970',
    };
  }

  private getLocale(preferences: InvoicePreferences) {
    return preferences.language === 'km' ? 'km-KH' : 'en-US';
  }

  private formatEnum(value: string) {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
