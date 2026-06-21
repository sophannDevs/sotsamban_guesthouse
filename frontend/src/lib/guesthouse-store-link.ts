import { AxiosError } from "axios"

import { apiClient } from "@/lib/api"

export type EligibleStore = {
  id: string
  name: string
  type: "STORE"
}

export type StoreLink = {
  id: string
  guesthouseBusinessId: string
  storeBusinessId: string
  store: EligibleStore
  createdAt: string
  updatedAt: string
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export const guesthouseStoreLinkService = {
  async getLink(): Promise<StoreLink | null> {
    const response =
      await apiClient.get<ApiResponse<StoreLink | null>>("/guesthouse/store-link")
    return response.data.data
  },

  async saveLink(storeBusinessId: string): Promise<StoreLink> {
    const response = await apiClient.post<ApiResponse<StoreLink>>(
      "/guesthouse/store-link",
      { storeBusinessId }
    )
    return response.data.data
  },

  async removeLink(): Promise<StoreLink> {
    const response = await apiClient.delete<ApiResponse<StoreLink>>(
      "/guesthouse/store-link"
    )
    return response.data.data
  },

  async listEligibleStores(): Promise<EligibleStore[]> {
    const response = await apiClient.get<ApiResponse<EligibleStore[]>>(
      "/guesthouse/store-link/stores"
    )
    return response.data.data
  },
}

export function getStoreLinkErrorMessage(
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
