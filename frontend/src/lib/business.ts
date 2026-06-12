import { AxiosError } from "axios"

import { apiClient, type PaginatedResponse } from "@/lib/api"

export type BusinessType = "GUESTHOUSE" | "STORE"

export type BusinessListItem = {
  id: string
  name: string
  type: BusinessType
  ownerId: string
  owner: {
    id: string
    name: string
    email: string
  }
  memberCount: number
  createdAt: string
  updatedAt: string
}

export type ActiveBusiness = {
  businessId: string
  businessName: string
  businessType: BusinessType
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export const businessService = {
  async getMyBusinesses(): Promise<BusinessListItem[]> {
    const response =
      await apiClient.get<PaginatedResponse<BusinessListItem>>("/businesses")
    return response.data.data
  },

  async switchTo(businessId: string): Promise<ActiveBusiness> {
    const response = await apiClient.post<ApiResponse<ActiveBusiness>>(
      `/businesses/${businessId}/switch`
    )
    return response.data.data
  },
}

export function getBusinessErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as
      | { message?: string | string[] }
      | undefined
    const message = data?.message
    if (Array.isArray(message)) return message.join(" ")
    if (message) return message
  }

  return fallback
}
