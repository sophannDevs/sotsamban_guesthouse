import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

import { ExcelReportPayload, ExcelReportSection } from './report-excel.service';

@Injectable()
export class ReportPdfService {
  generate(payload: ExcelReportPayload) {
    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({
        margin: 42,
        size: 'A4',
      });
      const chunks: Buffer[] = [];

      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);

      this.renderTitle(document, payload);
      this.renderFilters(document, payload.filters);

      for (const section of payload.sections) {
        this.renderSection(document, section);
      }

      document.end();
    });
  }

  private renderTitle(
    document: PDFKit.PDFDocument,
    payload: ExcelReportPayload,
  ) {
    document
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#111827')
      .text(payload.title);
    document
      .moveDown(0.35)
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#4b5563')
      .text(`Generated date: ${this.formatValue(payload.generatedAt)}`);
    document.moveDown(1);
  }

  private renderFilters(
    document: PDFKit.PDFDocument,
    filters: Record<string, string>,
  ) {
    this.ensureSpace(document, 58);
    document.font('Helvetica-Bold').fontSize(11).fillColor('#111827');
    document.text('Filters');
    document.moveDown(0.3);

    const filterEntries = Object.entries(filters);

    if (filterEntries.length === 0) {
      document.font('Helvetica').fontSize(9).fillColor('#4b5563').text('None');
      document.moveDown(1);
      return;
    }

    document.font('Helvetica').fontSize(9).fillColor('#374151');
    for (const [key, value] of filterEntries) {
      document.text(`${key}: ${value}`);
    }
    document.moveDown(1);
  }

  private renderSection(
    document: PDFKit.PDFDocument,
    section: ExcelReportSection,
  ) {
    this.ensureSpace(document, 90);

    if (section.title) {
      document
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#111827')
        .text(section.title);
      document.moveDown(0.4);
    }

    if (section.rows.length === 0) {
      document
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#4b5563')
        .text('No data');
      document.moveDown(1);
      return;
    }

    this.renderTable(document, section);
    document.moveDown(1.2);
  }

  private renderTable(
    document: PDFKit.PDFDocument,
    section: ExcelReportSection,
  ) {
    const availableWidth =
      document.page.width -
      document.page.margins.left -
      document.page.margins.right;
    const columnWidth = availableWidth / section.columns.length;
    const rowHeight = 24;

    this.renderTableHeader(document, section, columnWidth, rowHeight);

    for (const row of section.rows) {
      this.ensureSpace(document, rowHeight + 12);
      const y = document.y;

      section.columns.forEach((column, index) => {
        const x = document.page.margins.left + index * columnWidth;
        document
          .rect(x, y, columnWidth, rowHeight)
          .strokeColor('#e5e7eb')
          .lineWidth(0.5)
          .stroke();
        document
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#111827')
          .text(this.formatValue(row[column.key]), x + 5, y + 7, {
            ellipsis: true,
            height: rowHeight - 8,
            width: columnWidth - 10,
          });
      });

      document.y = y + rowHeight;
    }
  }

  private renderTableHeader(
    document: PDFKit.PDFDocument,
    section: ExcelReportSection,
    columnWidth: number,
    rowHeight: number,
  ) {
    this.ensureSpace(document, rowHeight + 12);
    const y = document.y;

    section.columns.forEach((column, index) => {
      const x = document.page.margins.left + index * columnWidth;
      document
        .rect(x, y, columnWidth, rowHeight)
        .fillAndStroke('#f3f4f6', '#d1d5db');
      document
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#111827')
        .text(column.header, x + 5, y + 7, {
          ellipsis: true,
          height: rowHeight - 8,
          width: columnWidth - 10,
        });
    });

    document.y = y + rowHeight;
  }

  private ensureSpace(document: PDFKit.PDFDocument, height: number) {
    const bottom = document.page.height - document.page.margins.bottom;

    if (document.y + height > bottom) {
      document.addPage();
    }
  }

  private formatValue(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }

    return '-';
  }
}
