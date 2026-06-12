import axios from "axios"

import { getAccessToken, removeAccessToken } from "@/lib/auth-token"
import { getStoredActiveBusiness } from "@/lib/business-token"

const localeStorageKey = "guesthouse.locale"

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  headers: {
    "Content-Type": "application/json",
  },
})

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  const locale =
    typeof window === "undefined"
      ? undefined
      : window.localStorage.getItem(localeStorageKey)

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (locale === "en" || locale === "km") {
    config.headers["Accept-Language"] = locale
  }

  const activeBusiness = getStoredActiveBusiness()
  if (activeBusiness?.businessId) {
    config.headers["x-business-id"] = activeBusiness.businessId
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      removeAccessToken()
    }

    return Promise.reject(error)
  }
)

export type PaginatedResponse<T> = {
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

export type PaginationParams = {
  page: number
  limit: number
  search?: string
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

export const defaultPaginationMeta: PaginatedResponse<never>["meta"] = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
}

export function unwrapList<T>(value: T[] | PaginatedResponse<T>) {
  return Array.isArray(value) ? value : value.data
}

export function unwrapPaginated<T>(
  value: T[] | PaginatedResponse<T>,
  fallback?: Pick<PaginationParams, "page" | "limit">
): PaginatedResponse<T> {
  if (!Array.isArray(value)) {
    return value
  }

  return {
    data: value,
    meta: {
      ...defaultPaginationMeta,
      page: fallback?.page ?? 1,
      limit: fallback?.limit ?? (value.length || 10),
      total: value.length,
      totalPages: 1,
    },
  }
}
