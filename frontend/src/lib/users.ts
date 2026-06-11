import { AxiosError } from "axios"

import {
  apiClient,
  type PaginatedResponse,
  type PaginationParams,
  unwrapList,
  unwrapPaginated,
} from "@/lib/api"

export const userRoles = ["ADMIN", "RECEPTIONIST"] as const
export const preferredLanguages = ["EN", "KM"] as const

export type UserRole = (typeof userRoles)[number]
export type PreferredLanguage = (typeof preferredLanguages)[number]

export type UserRecord = {
  id: string
  name: string
  email: string
  phone: string | null
  role: UserRole
  preferredLanguage: PreferredLanguage
  createdAt: string
  updatedAt: string
}

export type UserPayload = {
  name: string
  email: string
  role: UserRole
  preferredLanguage?: PreferredLanguage
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export const userService = {
  async listPaginated(params: PaginationParams) {
    const response =
      await apiClient.get<
        ApiResponse<UserRecord[]> | PaginatedResponse<UserRecord>
      >("/users", {
        params: {
          page: params.page,
          limit: params.limit,
          ...(params.search ? { search: params.search } : {}),
          sortBy: params.sortBy ?? "createdAt",
          sortOrder: params.sortOrder ?? "desc",
        },
      })

    return unwrapPaginated(
      "success" in response.data ? response.data.data : response.data,
      params
    )
  },

  async list() {
    const response =
      await apiClient.get<
        ApiResponse<UserRecord[]> | PaginatedResponse<UserRecord>
      >("/users")

    return unwrapList("success" in response.data ? response.data.data : response.data)
  },

  async update(id: string, payload: UserPayload) {
    const response = await apiClient.patch<ApiResponse<UserRecord>>(
      `/users/${id}`,
      payload
    )

    return response.data.data
  },

  async remove(id: string) {
    await apiClient.delete<ApiResponse<UserRecord>>(`/users/${id}`)
  },

  async updatePreferences(payload: { preferredLanguage: PreferredLanguage }) {
    const response = await apiClient.patch<ApiResponse<UserRecord>>(
      "/users/me/preferences",
      payload
    )

    return response.data.data
  },
}

export function getUserErrorMessage(error: unknown) {
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

  return "Unable to reach the users API. Check the backend server and try again."
}
