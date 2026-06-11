import { AxiosError } from "axios"

import {
  apiClient,
  type PaginatedResponse,
  type PaginationParams,
  unwrapList,
  unwrapPaginated,
} from "@/lib/api"
import type { Booking } from "@/lib/bookings"

export const paymentMethods = ["CASH", "CARD", "QR"] as const

export const paymentStatuses = [
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
] as const

export type PaymentMethod = (typeof paymentMethods)[number]
export type PaymentStatus = (typeof paymentStatuses)[number]

export type Payment = {
  id: string
  bookingId: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  paidAt: string | null
  booking: Booking
  createdAt: string
  updatedAt: string
}

export type PaymentPayload = {
  bookingId: string
  amount: number
  method: PaymentMethod
  status?: PaymentStatus
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export const paymentService = {
  async listPaginated(
    params: Pick<PaginationParams, "page" | "limit"> & {
      status?: PaymentStatus
    }
  ) {
    const response =
      await apiClient.get<ApiResponse<Payment[]> | PaginatedResponse<Payment>>(
        "/payments",
        {
          params: {
            page: params.page,
            limit: params.limit,
            ...(params.status ? { status: params.status } : {}),
            sortBy: "paidAt",
            sortOrder: "desc",
          },
        }
      )

    return unwrapPaginated(
      "success" in response.data ? response.data.data : response.data,
      params
    )
  },

  async list(status?: PaymentStatus) {
    const response =
      await apiClient.get<ApiResponse<Payment[]> | PaginatedResponse<Payment>>(
        "/payments",
        {
          params: {
            limit: 100,
            sortBy: "paidAt",
            sortOrder: "desc",
            ...(status ? { status } : {}),
          },
        }
      )

    return unwrapList("success" in response.data ? response.data.data : response.data)
  },

  async create(payload: PaymentPayload) {
    const response = await apiClient.post<ApiResponse<Payment>>(
      "/payments",
      payload
    )

    return response.data.data
  },

  async updateStatus(id: string, status: PaymentStatus) {
    const response = await apiClient.patch<ApiResponse<Payment>>(
      `/payments/${id}`,
      { status }
    )

    return response.data.data
  },
}

export function getPaymentErrorMessage(error: unknown) {
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

  return "Unable to reach the payments API. Check the backend server and try again."
}
