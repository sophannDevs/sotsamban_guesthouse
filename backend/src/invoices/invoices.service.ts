import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';

import {
  CoolingOption,
  MiniBarConsumptionStatus,
  PaymentStatus,
  Prisma,
} from '../../generated/prisma/client';
import {
  computeBalanceDue,
  computeTotalPrice,
  getMiniBarTotalForBooking,
  getPaidAmountForBooking,
} from '../common/booking-totals';
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

type InvoiceMiniBarConsumption = Prisma.MiniBarConsumptionGetPayload<{
  include: {
    items: {
      include: {
        product: { select: { name: true } };
      };
    };
  };
}>;

type InvoiceTotals = {
  miniBarTotal: number;
  totalPrice: number;
  paidAmount: number;
  balanceDue: number;
};

type InvoiceLine = {
  label: string;
  value: string;
};

type InvoiceLabels = {
  title: string;
  invoiceNumber: string;
  generatedDate: string;
  guestSection: string;
  guestName: string;
  roomNumber: string;
  roomType: string;
  staySection: string;
  checkInDate: string;
  checkOutDate: string;
  nights: string;
  pricePerNight: string;
  roomPriceTotal: string;
  coolingOption: string;
  coolingFan: string;
  coolingAC: string;
  coolingPrice: string;
  totalPrice: string;
  miniBarSection: string;
  miniBarTotal: string;
  paymentSection: string;
  paymentStatus: string;
  paymentMethod: string;
  noPayment: string;
  paidAmount: string;
  balanceDue: string;
  footer: string;
};

const INVOICE_LABELS: Record<'en' | 'km', InvoiceLabels> = {
  en: {
    title: 'Guesthouse Invoice',
    invoiceNumber: 'Invoice number',
    generatedDate: 'Generated date',
    guestSection: 'Guest',
    guestName: 'Guest name',
    roomNumber: 'Room number',
    roomType: 'Room type',
    staySection: 'Stay Details',
    checkInDate: 'Check-in date',
    checkOutDate: 'Check-out date',
    nights: 'Nights',
    pricePerNight: 'Price per night',
    roomPriceTotal: 'Room price total',
    coolingOption: 'Cooling option',
    coolingFan: 'Fan',
    coolingAC: 'Air Conditioner',
    coolingPrice: 'Cooling price',
    totalPrice: 'Total price',
    miniBarSection: 'Mini Bar Consumption',
    miniBarTotal: 'Mini bar total',
    paymentSection: 'Payment',
    paymentStatus: 'Payment status',
    paymentMethod: 'Payment method',
    noPayment: 'No payment',
    paidAmount: 'Paid amount',
    balanceDue: 'Balance due',
    footer: 'Thank you for choosing Sot Samban GuestHouse.',
  },
  // Khmer labels are defined here but require a Khmer-capable font registered
  // with PDFKit before they can render. Until then, the service falls back to English.
  km: {
    title: 'Guesthouse Invoice',
    invoiceNumber: 'Invoice number',
    generatedDate: 'Generated date',
    guestSection: 'Guest',
    guestName: 'Guest name',
    roomNumber: 'Room number',
    roomType: 'Room type',
    staySection: 'Stay Details',
    checkInDate: 'Check-in date',
    checkOutDate: 'Check-out date',
    nights: 'Nights',
    pricePerNight: 'Price per night',
    roomPriceTotal: 'Room price total',
    coolingOption: 'Cooling option',
    coolingFan: 'Fan',
    coolingAC: 'Air Conditioner',
    coolingPrice: 'Cooling price',
    totalPrice: 'Total price',
    miniBarSection: 'Mini Bar Consumption',
    miniBarTotal: 'Mini bar total',
    paymentSection: 'Payment',
    paymentStatus: 'Payment status',
    paymentMethod: 'Payment method',
    noPayment: 'No payment',
    paidAmount: 'Paid amount',
    balanceDue: 'Balance due',
    footer: 'Thank you for choosing Sot Samban GuestHouse.',
  },
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

    const [miniBarConsumptions, miniBarTotal, paidAmount, preferences] =
      await Promise.all([
        this.prisma.miniBarConsumption.findMany({
          where: { bookingId, status: MiniBarConsumptionStatus.CHARGED },
          include: {
            items: { include: { product: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'asc' },
        }),
        getMiniBarTotalForBooking(this.prisma, bookingId),
        getPaidAmountForBooking(this.prisma, bookingId),
        this.getPreferences(),
      ]);

    const totalPrice = computeTotalPrice(
      booking.roomPriceTotal,
      booking.coolingPrice,
      miniBarTotal,
    );
    const totals: InvoiceTotals = {
      miniBarTotal: Number(miniBarTotal),
      totalPrice: Number(totalPrice),
      paidAmount: Number(paidAmount),
      balanceDue: Number(computeBalanceDue(totalPrice, paidAmount)),
    };

    return this.generatePdf(booking, preferences, miniBarConsumptions, totals);
  }

  private generatePdf(
    booking: InvoiceBooking,
    preferences: InvoicePreferences,
    miniBarConsumptions: InvoiceMiniBarConsumption[],
    totals: InvoiceTotals,
  ) {
    const labels = INVOICE_LABELS[preferences.language] ?? INVOICE_LABELS.en;

    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({
        margin: 48,
        size: 'A4',
      });
      const chunks: Buffer[] = [];

      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);

      this.renderHeader(document, booking, preferences, labels);
      this.renderInvoiceDetails(document, booking, labels);
      this.renderStayDetails(document, booking, preferences, labels, totals);
      this.renderMiniBarDetails(
        document,
        miniBarConsumptions,
        preferences,
        labels,
        totals,
      );
      this.renderPaymentDetails(document, booking, preferences, labels, totals);
      this.renderFooter(document, labels);

      document.end();
    });
  }

  private renderHeader(
    document: PDFKit.PDFDocument,
    booking: InvoiceBooking,
    preferences: InvoicePreferences,
    labels: InvoiceLabels,
  ) {
    document
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor('#111827')
      .text(labels.title);

    document
      .moveDown(0.35)
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#4b5563')
      .text(`${labels.invoiceNumber}: ${this.getInvoiceNumber(booking.id)}`)
      .text(
        `${labels.generatedDate}: ${this.formatDateTime(new Date(), preferences)}`,
      );

    document.moveDown(1.2);
  }

  private renderInvoiceDetails(
    document: PDFKit.PDFDocument,
    booking: InvoiceBooking,
    labels: InvoiceLabels,
  ) {
    this.renderSection(document, labels.guestSection, [
      { label: labels.guestName, value: booking.guest.fullName },
      { label: labels.roomNumber, value: booking.room.roomNumber },
      { label: labels.roomType, value: this.formatEnum(booking.room.type) },
    ]);
  }

  private renderStayDetails(
    document: PDFKit.PDFDocument,
    booking: InvoiceBooking,
    preferences: InvoicePreferences,
    labels: InvoiceLabels,
    totals: InvoiceTotals,
  ) {
    const nights = this.calculateNights(
      booking.checkInDate,
      booking.checkOutDate,
    );
    const pricePerNight = Number(booking.room.pricePerNight);
    const roomPriceTotal = Number(booking.roomPriceTotal);
    const coolingPrice = Number(booking.coolingPrice);
    const isAC = booking.coolingOption === CoolingOption.AIR_CONDITIONER;

    this.renderSection(document, labels.staySection, [
      {
        label: labels.checkInDate,
        value: this.formatDate(booking.checkInDate, preferences),
      },
      {
        label: labels.checkOutDate,
        value: this.formatDate(booking.checkOutDate, preferences),
      },
      { label: labels.nights, value: String(nights) },
      {
        label: labels.pricePerNight,
        value: this.formatCurrency(pricePerNight, preferences),
      },
      {
        label: labels.roomPriceTotal,
        value: this.formatCurrency(roomPriceTotal, preferences),
      },
      {
        label: labels.coolingOption,
        value: isAC ? labels.coolingAC : labels.coolingFan,
      },
      ...(isAC
        ? [
            {
              label: labels.coolingPrice,
              value: this.formatCurrency(coolingPrice, preferences),
            },
          ]
        : []),
      ...(totals.miniBarTotal > 0
        ? [
            {
              label: labels.miniBarTotal,
              value: this.formatCurrency(totals.miniBarTotal, preferences),
            },
          ]
        : []),
      {
        label: labels.totalPrice,
        value: this.formatCurrency(totals.totalPrice, preferences),
      },
    ]);
  }

  private renderMiniBarDetails(
    document: PDFKit.PDFDocument,
    consumptions: InvoiceMiniBarConsumption[],
    preferences: InvoicePreferences,
    labels: InvoiceLabels,
    totals: InvoiceTotals,
  ) {
    if (consumptions.length === 0) {
      return;
    }

    const lines: InvoiceLine[] = consumptions.flatMap((consumption) =>
      consumption.items.map((item) => ({
        label: item.product.name,
        value: `${item.quantity} × ${this.formatCurrency(Number(item.unitPrice), preferences)} = ${this.formatCurrency(Number(item.subtotal), preferences)}`,
      })),
    );

    lines.push({
      label: labels.miniBarTotal,
      value: this.formatCurrency(totals.miniBarTotal, preferences),
    });

    this.renderSection(document, labels.miniBarSection, lines);
  }

  private renderPaymentDetails(
    document: PDFKit.PDFDocument,
    booking: InvoiceBooking,
    preferences: InvoicePreferences,
    labels: InvoiceLabels,
    totals: InvoiceTotals,
  ) {
    const payment = this.getPrimaryPayment(booking);

    this.renderSection(document, labels.paymentSection, [
      {
        label: labels.paymentStatus,
        value: payment ? this.formatEnum(payment.status) : labels.noPayment,
      },
      {
        label: labels.paymentMethod,
        value: payment ? this.formatEnum(payment.method) : labels.noPayment,
      },
      {
        label: labels.paidAmount,
        value: this.formatCurrency(totals.paidAmount, preferences),
      },
      {
        label: labels.balanceDue,
        value: this.formatCurrency(totals.balanceDue, preferences),
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

  private renderFooter(document: PDFKit.PDFDocument, labels: InvoiceLabels) {
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
      .text(labels.footer, document.page.margins.left, bottomY + 12);
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
