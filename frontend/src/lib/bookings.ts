import { AxiosError } from "axios"

import {
  apiClient,
  type PaginatedResponse,
  type PaginationParams,
  unwrapList,
  unwrapPaginated,
} from "@/lib/api"
import type { Guest } from "@/lib/guests"
import type { Room } from "@/lib/rooms"

export const bookingStatuses = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
] as const

export type BookingStatus = (typeof bookingStatuses)[number]

export type CoolingOption = "FAN" | "AIR_CONDITIONER"

export type BookingSource = "ONLINE" | "WALK_IN"

export type Booking = {
  id: string
  guestId: string
  roomId: string
  checkInDate: string
  checkOutDate: string
  checkInAt: string | null
  checkOutAt: string | null
  coolingOption: CoolingOption
  roomPriceTotal: number
  coolingPrice: number
  miniBarTotal: number
  totalPrice: number
  paidAmount: number
  balanceDue: number
  status: BookingStatus
  source: BookingSource
  guest: Guest
  room: Room
  createdAt: string
  updatedAt: string
}

export type BookingPayload = {
  guestId: string
  roomId: string
  checkInDate: string
  checkOutDate: string
  coolingOption?: CoolingOption
  status?: BookingStatus
}

export type WalkInCheckInPayload = {
  guest: {
    name: string
    phone?: string
  }
  roomId: string
  checkInDate: string
  checkOutDate?: string
  coolingOption?: CoolingOption
}

export type BookingConflict = {
  roomId: string
  roomNumber: string
  existingBookingId: string
  guestName?: string
  checkInDate: string
  checkOutDate: string
  status: BookingStatus
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export const bookingService = {
  async listPaginated(
    params: Pick<PaginationParams, "page" | "limit"> & {
      status?: BookingStatus
      source?: BookingSource
    }
  ) {
    const response =
      await apiClient.get<ApiResponse<Booking[]> | PaginatedResponse<Booking>>(
        "/bookings",
        {
          params: {
            page: params.page,
            limit: params.limit,
            ...(params.status ? { status: params.status } : {}),
            ...(params.source ? { source: params.source } : {}),
            sortBy: "checkInDate",
            sortOrder: "desc",
          },
        }
      )

    return unwrapPaginated(
      "success" in response.data ? response.data.data : response.data,
      params
    )
  },

  async list(status?: BookingStatus) {
    const response =
      await apiClient.get<ApiResponse<Booking[]> | PaginatedResponse<Booking>>(
        "/bookings",
        {
          params: {
            limit: 100,
            sortBy: "checkInDate",
            sortOrder: "desc",
            ...(status ? { status } : {}),
          },
        }
      )

    return unwrapList("success" in response.data ? response.data.data : response.data)
  },

  async get(id: string) {
    const response = await apiClient.get<ApiResponse<Booking>>(`/bookings/${id}`)

    return response.data.data
  },

  async create(payload: BookingPayload) {
    const response = await apiClient.post<ApiResponse<Booking>>(
      "/bookings",
      payload
    )

    return response.data.data
  },

  async checkIn(id: string) {
    const response = await apiClient.post<ApiResponse<Booking>>(
      `/bookings/${id}/check-in`
    )

    return response.data.data
  },

  async checkOut(id: string) {
    const response = await apiClient.post<ApiResponse<Booking>>(
      `/bookings/${id}/check-out`
    )

    return response.data.data
  },

  async cancel(id: string) {
    const response = await apiClient.patch<ApiResponse<Booking>>(
      `/bookings/${id}/cancel`
    )

    return response.data.data
  },

  async checkConflict(params: {
    roomId: string
    checkInDate: string
    checkOutDate: string
    excludeBookingId?: string
  }) {
    const response = await apiClient.get<ApiResponse<{ conflict: BookingConflict | null }>>(
      "/bookings/check-conflict",
      { params }
    )

    return response.data.data.conflict
  },

  async walkInCheckIn(payload: WalkInCheckInPayload) {
    const response = await apiClient.post<ApiResponse<Booking>>(
      "/bookings/walk-in-check-in",
      payload
    )

    return response.data.data
  },
}

export function getBookingErrorMessage(error: unknown) {
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

  return "Unable to reach the bookings API. Check the backend server and try again."
}

export function getBookingConflict(error: unknown) {
  if (!(error instanceof AxiosError)) {
    return null
  }

  const responseData = error.response?.data as
    | { code?: string; conflict?: Partial<BookingConflict> }
    | undefined
  const conflict = responseData?.conflict

  if (
    responseData?.code !== "BOOKING_CONFLICT" ||
    !conflict?.roomId ||
    !conflict.roomNumber ||
    !conflict.existingBookingId ||
    !conflict.checkInDate ||
    !conflict.checkOutDate ||
    !conflict.status
  ) {
    return null
  }

  return {
    roomId: conflict.roomId,
    roomNumber: conflict.roomNumber,
    existingBookingId: conflict.existingBookingId,
    guestName: conflict.guestName,
    checkInDate: conflict.checkInDate,
    checkOutDate: conflict.checkOutDate,
    status: conflict.status,
  } satisfies BookingConflict
}
