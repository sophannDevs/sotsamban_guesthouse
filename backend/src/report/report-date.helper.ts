import { BadRequestException } from '@nestjs/common';
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export type RangePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'this_year'
  | 'custom';

export function getDateRangeFromPreset(
  rangePreset: RangePreset | string | undefined,
  startDateInput: string | undefined,
  endDateInput: string | undefined,
  timezone: string,
): { startDate: Date | undefined; endDate: Date | undefined; label: string } {
  const preset = (rangePreset || 'this_month') as RangePreset;

  if (preset === 'custom') {
    const start = startDateInput
      ? parseInputDate(startDateInput, 'startDate')
      : undefined;
    const end = endDateInput
      ? parseInputDate(endDateInput, 'endDate')
      : undefined;

    if (start && end && start > end) {
      throw new BadRequestException('startDate must be before endDate.');
    }

    return { startDate: start, endDate: end, label: 'Custom' };
  }

  // Current date in the configured timezone
  const now = toZonedTime(new Date(), timezone);

  let startDate: Date;
  let endDate: Date;
  let label: string;

  switch (preset) {
    case 'today':
      startDate = fromZonedTime(startOfDay(now), timezone);
      endDate = fromZonedTime(endOfDay(now), timezone);
      label = 'Today';
      break;
    case 'yesterday': {
      const yesterday = subDays(now, 1);
      startDate = fromZonedTime(startOfDay(yesterday), timezone);
      endDate = fromZonedTime(endOfDay(yesterday), timezone);
      label = 'Yesterday';
      break;
    }
    case 'this_week':
      startDate = fromZonedTime(
        startOfWeek(now, { weekStartsOn: 1 }),
        timezone,
      ); // Monday start
      endDate = fromZonedTime(endOfWeek(now, { weekStartsOn: 1 }), timezone);
      label = 'This Week';
      break;
    case 'last_week': {
      const lastWeek = subWeeks(now, 1);
      startDate = fromZonedTime(
        startOfWeek(lastWeek, { weekStartsOn: 1 }),
        timezone,
      );
      endDate = fromZonedTime(
        endOfWeek(lastWeek, { weekStartsOn: 1 }),
        timezone,
      );
      label = 'Last Week';
      break;
    }
    case 'this_month':
      startDate = fromZonedTime(startOfMonth(now), timezone);
      endDate = fromZonedTime(endOfMonth(now), timezone);
      label = 'This Month';
      break;
    case 'last_month': {
      const lastMonth = subMonths(now, 1);
      startDate = fromZonedTime(startOfMonth(lastMonth), timezone);
      endDate = fromZonedTime(endOfMonth(lastMonth), timezone);
      label = 'Last Month';
      break;
    }
    case 'last_3_months': {
      const startOfLast3 = startOfMonth(subMonths(now, 2));
      startDate = fromZonedTime(startOfLast3, timezone);
      endDate = fromZonedTime(endOfMonth(now), timezone);
      label = 'Last 3 Months';
      break;
    }
    case 'last_6_months': {
      const startOfLast6 = startOfMonth(subMonths(now, 5));
      startDate = fromZonedTime(startOfLast6, timezone);
      endDate = fromZonedTime(endOfMonth(now), timezone);
      label = 'Last 6 Months';
      break;
    }
    case 'this_year':
      startDate = fromZonedTime(startOfYear(now), timezone);
      endDate = fromZonedTime(endOfYear(now), timezone);
      label = 'This Year';
      break;
    default:
      throw new BadRequestException(`Unsupported rangePreset: ${preset}`);
  }

  return { startDate, endDate, label };
}

function parseInputDate(value: string, fieldName: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${fieldName} must be a valid date.`);
  }

  return date;
}
