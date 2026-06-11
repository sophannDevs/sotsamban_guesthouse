import { BadRequestException } from '@nestjs/common';

export type SortOrder = 'asc' | 'desc';

export type PaginationQuery = {
  page?: string;
  limit?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
};

export type PaginationOptions<TSortBy extends string> = {
  page: number;
  limit: number;
  skip: number;
  search?: string;
  sortBy: TSortBy;
  sortOrder: SortOrder;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type PaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};

type PaginationConfig<TSortBy extends string> = {
  allowedSortBy: readonly TSortBy[];
  defaultSortBy: TSortBy;
  maxLimit?: number;
};

export function getPaginationOptions<TSortBy extends string>(
  query: PaginationQuery,
  config: PaginationConfig<TSortBy>,
): PaginationOptions<TSortBy> {
  const page = parsePositiveInteger(query.page, 'page', 1);
  const limit = parsePositiveInteger(
    query.limit,
    'limit',
    10,
    config.maxLimit ?? 100,
  );
  const sortOrder = normalizeSortOrder(query.sortOrder);
  const sortBy = normalizeSortBy(
    query.sortBy,
    config.allowedSortBy,
    config.defaultSortBy,
  );
  const search = query.search?.trim() || undefined;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    search,
    sortBy,
    sortOrder,
  };
}

export function createPaginatedResult<T>(
  data: T[],
  total: number,
  options: Pick<PaginationOptions<string>, 'page' | 'limit'>,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / options.limit);

  return {
    data,
    meta: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages,
      hasNextPage: options.page < totalPages,
      hasPreviousPage: options.page > 1,
    },
  };
}

function parsePositiveInteger(
  value: string | undefined,
  fieldName: string,
  fallback: number,
  max?: number,
) {
  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new BadRequestException(`${fieldName} must be a positive integer.`);
  }

  if (max && parsedValue > max) {
    throw new BadRequestException(`${fieldName} must be less than ${max}.`);
  }

  return parsedValue;
}

function normalizeSortOrder(value: string | undefined): SortOrder {
  return value === 'asc' ? 'asc' : 'desc';
}

function normalizeSortBy<TSortBy extends string>(
  value: string | undefined,
  allowedSortBy: readonly TSortBy[],
  defaultSortBy: TSortBy,
) {
  if (!value) {
    return defaultSortBy;
  }

  if (!allowedSortBy.includes(value as TSortBy)) {
    throw new BadRequestException(
      `sortBy must be one of: ${allowedSortBy.join(', ')}.`,
    );
  }

  return value as TSortBy;
}
