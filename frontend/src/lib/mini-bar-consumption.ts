import { AxiosError } from "axios"

import {
  apiClient,
  type PaginatedResponse,
  type PaginationParams,
  unwrapPaginated,
} from "@/lib/api"

export const miniBarConsumptionStatuses = [
  "DRAFT",
  "CHARGED",
  "CANCELLED",
  "REFUNDED",
] as const
export type MiniBarConsumptionStatus =
  (typeof miniBarConsumptionStatuses)[number]

export type MiniBarProduct = {
  id: string
  name: string
  sku: string
  sellingPrice: number
  stockQuantity: number
}

export type MiniBarConsumptionItem = {
  id: string
  productId: string
  product: { id: string; name: string; sku: string }
  quantity: number
  unitPrice: number
  subtotal: number
}

export type MiniBarConsumption = {
  id: string
  businessId: string
  bookingId: string
  booking: { id: string; status: string }
  roomId: string
  room: { id: string; roomNumber: string }
  guestId: string
  guest: { id: string; fullName: string }
  totalAmount: number
  status: MiniBarConsumptionStatus
  createdBy: { id: string; name: string }
  items: MiniBarConsumptionItem[]
  createdAt: string
  updatedAt: string
}

export type CreateMiniBarConsumptionPayload = {
  bookingId: string
  items: Array<{ productId: string; quantity: number }>
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export const miniBarConsumptionService = {
  async listPaginated(
    params: Pick<PaginationParams, "page" | "limit"> & {
      status?: MiniBarConsumptionStatus | "ALL"
      bookingId?: string
      from?: string
      to?: string
    },
  ) {
    const response = await apiClient.get<PaginatedResponse<MiniBarConsumption>>(
      "/mini-bar/consumptions",
      {
        params: {
          page: params.page,
          limit: params.limit,
          ...(params.status && params.status !== "ALL"
            ? { status: params.status }
            : {}),
          ...(params.bookingId ? { bookingId: params.bookingId } : {}),
          ...(params.from ? { from: params.from } : {}),
          ...(params.to ? { to: params.to } : {}),
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      },
    )
    return unwrapPaginated(response.data, params)
  },

  async findOne(id: string) {
    const response = await apiClient.get<ApiResponse<MiniBarConsumption>>(
      `/mini-bar/consumptions/${id}`,
    )
    return response.data.data
  },

  async create(payload: CreateMiniBarConsumptionPayload) {
    const response = await apiClient.post<ApiResponse<MiniBarConsumption>>(
      "/mini-bar/consumptions",
      payload,
    )
    return response.data.data
  },

  async charge(id: string) {
    const response = await apiClient.patch<ApiResponse<MiniBarConsumption>>(
      `/mini-bar/consumptions/${id}/charge`,
    )
    return response.data.data
  },

  async cancel(id: string) {
    const response = await apiClient.patch<ApiResponse<MiniBarConsumption>>(
      `/mini-bar/consumptions/${id}/cancel`,
    )
    return response.data.data
  },

  async refund(id: string) {
    const response = await apiClient.patch<ApiResponse<MiniBarConsumption>>(
      `/mini-bar/consumptions/${id}/refund`,
    )
    return response.data.data
  },

  async listEligibleProducts() {
    const response = await apiClient.get<ApiResponse<MiniBarProduct[]>>(
      "/mini-bar/consumptions/products",
    )
    return response.data.data
  },
}

export function getMiniBarErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data as
      | { message?: string | string[] }
      | undefined
    const message = responseData?.message

    if (Array.isArray(message)) return message.join(" ")
    if (message) return message
  }

  return "Unable to reach the mini bar API. Check the backend server and try again."
}
