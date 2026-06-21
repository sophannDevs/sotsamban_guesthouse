import { AxiosError } from "axios"

import { apiClient } from "@/lib/api"

export const financeRevenueSources = ["STORE_SALE", "MINI_BAR", "ALL"] as const
export type FinanceRevenueSource = (typeof financeRevenueSources)[number]

export type FinanceSummary = {
  period: string
  startDate: string | null
  endDate: string | null
  totalRevenue: number
  totalExpense: number
  netProfit: number
  /** Only present for STORE businesses. */
  storeSaleRevenue?: number
  miniBarRevenue?: number
}

export type BusinessFinanceSummary = {
  businessId: string
  businessName: string
  businessType: string
  revenue: number
  expense: number
  netProfit: number
  /** Only present for STORE businesses. */
  storeSaleRevenue?: number
  miniBarRevenue?: number
}

export type AllBusinessesFinanceSummary = {
  period: string
  startDate: string | null
  endDate: string | null
  totalRevenue: number
  totalExpense: number
  netProfit: number
  businesses: BusinessFinanceSummary[]
}

type FinanceParams = {
  rangePreset?: string
  startDate?: string
  endDate?: string
  source?: FinanceRevenueSource
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

function buildQuery(params: FinanceParams): string {
  const sp = new URLSearchParams()
  if (params.rangePreset) sp.set("rangePreset", params.rangePreset)
  if (params.startDate) sp.set("startDate", params.startDate)
  if (params.endDate) sp.set("endDate", params.endDate)
  if (params.source) sp.set("source", params.source)
  const q = sp.toString()
  return q ? `?${q}` : ""
}

export const financeService = {
  async getSummary(params: FinanceParams = {}): Promise<FinanceSummary> {
    const response = await apiClient.get<ApiResponse<FinanceSummary>>(
      `/finance/summary${buildQuery(params)}`
    )
    return response.data.data
  },

  async getAllBusinessesSummary(
    params: FinanceParams = {}
  ): Promise<AllBusinessesFinanceSummary> {
    const response =
      await apiClient.get<ApiResponse<AllBusinessesFinanceSummary>>(
        `/finance/summary/all-businesses${buildQuery(params)}`
      )
    return response.data.data
  },
}

export function getFinanceErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data as
      | { message?: string | string[] }
      | undefined
    const message = responseData?.message

    if (Array.isArray(message)) {
      return message.join(" ")
    }

    if (message) {
      return message
    }
  }

  return "Unable to load financial summary. Check the backend server and try again."
}
