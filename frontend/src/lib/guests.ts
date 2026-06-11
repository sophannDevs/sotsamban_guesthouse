import { AxiosError } from "axios"

import {
  apiClient,
  type PaginatedResponse,
  type PaginationParams,
  unwrapList,
  unwrapPaginated,
} from "@/lib/api"

export type Guest = {
  id: string
  fullName: string
  phone: string
  email: string | null
  idCardNumber: string | null
  address: string | null
  createdAt: string
  updatedAt: string
}

export type GuestPayload = {
  fullName: string
  phone: string
  email?: string
  idCardNumber?: string
  address?: string
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export const guestService = {
  async listPaginated(params: PaginationParams) {
    const trimmedSearch = params.search?.trim()
    const response =
      await apiClient.get<ApiResponse<Guest[]> | PaginatedResponse<Guest>>(
        "/guests",
        {
          params: {
            page: params.page,
            limit: params.limit,
            ...(trimmedSearch ? { search: trimmedSearch } : {}),
            sortBy: params.sortBy ?? "fullName",
            sortOrder: params.sortOrder ?? "asc",
          },
        }
      )

    return unwrapPaginated(
      "success" in response.data ? response.data.data : response.data,
      params
    )
  },

  async list(search?: string) {
    const trimmedSearch = search?.trim()
    const response =
      await apiClient.get<ApiResponse<Guest[]> | PaginatedResponse<Guest>>(
        "/guests",
        {
          params: {
            limit: 100,
            sortBy: "fullName",
            sortOrder: "asc",
            ...(trimmedSearch ? { search: trimmedSearch } : {}),
          },
        }
      )

    return unwrapList("success" in response.data ? response.data.data : response.data)
  },

  async create(payload: GuestPayload) {
    const response = await apiClient.post<ApiResponse<Guest>>(
      "/guests",
      payload
    )

    return response.data.data
  },

  async update(id: string, payload: GuestPayload) {
    const response = await apiClient.patch<ApiResponse<Guest>>(
      `/guests/${id}`,
      payload
    )

    return response.data.data
  },

  async remove(id: string) {
    await apiClient.delete<ApiResponse<Guest>>(`/guests/${id}`)
  },
}

export function getGuestErrorMessage(error: unknown) {
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

  return "Unable to reach the guests API. Check the backend server and try again."
}
