import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';

type ExcelCellValue = string | number | boolean | Date | null;

export type ExcelReportColumn = {
  header: string;
  key: string;
};

export type ExcelReportSection = {
  title?: string;
  columns: ExcelReportColumn[];
  rows: Record<string, ExcelCellValue>[];
};

export type ExcelReportPayload = {
  title: string;
  generatedAt: Date;
  filters: Record<string, string>;
  sections: ExcelReportSection[];
};

@Injectable()
export class ReportExcelService {
  async generate(payload: ExcelReportPayload) {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Report');
    let rowIndex = 1;

    worksheet.getCell(rowIndex, 1).value = payload.title;
    worksheet.getCell(rowIndex, 1).font = { bold: true, size: 16 };
    rowIndex += 1;

    worksheet.getCell(rowIndex, 1).value = 'Generated date';
    worksheet.getCell(rowIndex, 2).value = payload.generatedAt;
    worksheet.getCell(rowIndex, 1).font = { bold: true };
    worksheet.getCell(rowIndex, 2).numFmt = 'yyyy-mm-dd hh:mm:ss';
    rowIndex += 2;

    worksheet.getCell(rowIndex, 1).value = 'Filters';
    worksheet.getCell(rowIndex, 1).font = { bold: true };
    rowIndex += 1;

    const filterEntries = Object.entries(payload.filters);
    if (filterEntries.length === 0) {
      worksheet.getCell(rowIndex, 1).value = 'None';
      rowIndex += 1;
    } else {
      for (const [key, value] of filterEntries) {
        worksheet.getCell(rowIndex, 1).value = key;
        worksheet.getCell(rowIndex, 2).value = value;
        worksheet.getCell(rowIndex, 1).font = { bold: true };
        rowIndex += 1;
      }
    }

    rowIndex += 1;

    for (const section of payload.sections) {
      if (section.title) {
        worksheet.getCell(rowIndex, 1).value = section.title;
        worksheet.getCell(rowIndex, 1).font = { bold: true, size: 13 };
        rowIndex += 1;
      }

      const headerRow = worksheet.getRow(rowIndex);
      section.columns.forEach((column, columnIndex) => {
        const cell = headerRow.getCell(columnIndex + 1);
        cell.value = column.header;
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE8EEF7' },
        };
      });
      rowIndex += 1;

      if (section.rows.length === 0) {
        worksheet.getCell(rowIndex, 1).value = 'No data';
        rowIndex += 1;
      } else {
        for (const row of section.rows) {
          section.columns.forEach((column, columnIndex) => {
            worksheet.getCell(rowIndex, columnIndex + 1).value =
              row[column.key] ?? null;
          });
          rowIndex += 1;
        }
      }

      rowIndex += 2;
    }

    worksheet.columns.forEach((column) => {
      let maxLength = 12;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const value = cell.value;
        const length = this.getCellDisplayLength(value);
        maxLength = Math.max(maxLength, length + 2);
      });
      column.width = Math.min(maxLength, 42);
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return Buffer.from(buffer);
  }

  private getCellDisplayLength(value: unknown) {
    if (value === null || value === undefined) {
      return 0;
    }

    if (value instanceof Date) {
      return 19;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value).length;
    }

    return 12;
  }
}
