import { AxiosError } from "axios"

import {
  apiClient,
  type PaginatedResponse,
  type PaginationParams,
  unwrapList,
  unwrapPaginated,
} from "@/lib/api"
import type { BookingStatus } from "@/lib/bookings"
import type { PaymentMethod, PaymentStatus } from "@/lib/payments"

export const reportTypes = [
  "revenue",
  "bookings",
  "payments",
  "guests",
  "occupancy",
  "profit_loss",
  "combined_profit_loss",
] as const

export type ReportType = (typeof reportTypes)[number]

export const rangePresets = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "last_3_months",
  "last_6_months",
  "this_year",
  "custom",
] as const

export type RangePreset = (typeof rangePresets)[number]

export type ReportFilters = {
  rangePreset?: RangePreset
  startDate?: string
  endDate?: string
  status?: BookingStatus
  paymentStatus?: PaymentStatus
  method?: PaymentMethod
  roomId?: string
  guestId?: string
  search?: string
}

export type RevenueReport = {
  totalRevenue: number
  paidRevenue: number
  pendingRevenue: number
  miniBarRevenue: number
  revenueByDate: Array<{
    date: string
    revenue: number
  }>
  revenueByPaymentMethod: Array<{
    method: PaymentMethod
    revenue: number
  }>
}

export type BookingReportRow = {
  bookingId: string
  guestName: string
  roomNumber: string
  checkInDate: string
  checkOutDate: string
  totalPrice: number
  bookingStatus: BookingStatus
}

export type PaymentReportRow = {
  paymentId: string
  bookingId: string
  guestName: string
  roomNumber: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  paidAt: string | null
}

export type GuestReportRow = {
  guestId: string
  fullName: string
  phone: string
  email: string | null
  totalBookings: number
  totalSpent: number
}

export type OccupancyReport = {
  totalRooms: number
  availableRooms: number
  bookedRooms: number
  occupiedRooms: number
  maintenanceRooms: number
  occupancyRate: number
}

export type ProfitLossReport = {
  period: string
  totalRevenue: number
  totalExpense: number
  netProfit: number
  revenueByDate: Array<{ date: string; revenue: number }>
  expenseByDate: Array<{ date: string; expense: number }>
  expenseByCategory: Array<{ category: string; amount: number }>
}

export type CombinedProfitLossBusinessRow = {
  businessId: string
  businessName: string
  businessType: string
  revenue: number
  expense: number
  netProfit: number
}

export type CombinedProfitLossReport = {
  period: string
  startDate: string | null
  endDate: string | null
  totalRevenue: number
  totalExpense: number
  netProfit: number
  businessBreakdown: CombinedProfitLossBusinessRow[]
}

export type ReportResultMap = {
  revenue: RevenueReport
  bookings: BookingReportRow[]
  payments: PaymentReportRow[]
  guests: GuestReportRow[]
  occupancy: OccupancyReport
  profit_loss: ProfitLossReport
  combined_profit_loss: CombinedProfitLossReport
}

export type ReportTableRow = Record<string, string | number | null>
export type ReportExportFormat = "excel" | "pdf"

export const reportService = {
  async getPaginatedReport<TType extends "bookings" | "payments" | "guests">(
    type: TType,
    filters: ReportFilters & Pick<PaginationParams, "page" | "limit">
  ) {
    const response = await apiClient.get<
      PaginatedResponse<
        TType extends "bookings"
          ? BookingReportRow
          : TType extends "payments"
            ? PaymentReportRow
            : GuestReportRow
      >
    >(`/reports/${type}`, {
      params: cleanFilters(filters),
    })

    return unwrapPaginated(response.data, filters)
  },

  async getReport<TType extends ReportType>(
    type: TType,
    filters: ReportFilters
  ): Promise<ReportResultMap[TType]> {
    const path =
      type === "combined_profit_loss" ? "combined-profit-loss" : type
    const response = await apiClient.get<
      | ReportResultMap[TType]
      | PaginatedResponse<
          BookingReportRow | PaymentReportRow | GuestReportRow
        >
    >(`/reports/${path}`, {
      params: cleanFilters(filters),
    })

    if (type === "bookings" || type === "payments" || type === "guests") {
      return unwrapList(
        response.data as
          | Array<BookingReportRow | PaymentReportRow | GuestReportRow>
          | PaginatedResponse<
              BookingReportRow | PaymentReportRow | GuestReportRow
            >
      ) as ReportResultMap[TType]
    }

    return response.data as ReportResultMap[TType]
  },

  async downloadReport(
    type: ReportType,
    format: ReportExportFormat,
    filters: ReportFilters
  ) {
    const path =
      type === "combined_profit_loss" ? "combined-profit-loss" : type
    const response = await apiClient.get<Blob>(`/reports/${path}/export`, {
      params: {
        ...cleanFilters(filters),
        format,
      },
      responseType: "blob",
    })

    return response.data
  },
}

function cleanFilters(filters: ReportFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => Boolean(value))
  )
}

export function getReportErrorMessage(error: unknown) {
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

  return "Unable to reach the reports API. Check the backend server and try again."
}

export async function getReportExportErrorMessage(error: unknown) {
  if (error instanceof AxiosError && error.response?.data instanceof Blob) {
    try {
      const text = await error.response.data.text()
      const data = JSON.parse(text) as { message?: string | string[] }
      const message = data.message

      if (Array.isArray(message)) {
        return message.join(" ")
      }

      if (message) {
        return message
      }
    } catch {
      return "Unable to export the report. Try again."
    }
  }

  return getReportErrorMessage(error)
}
