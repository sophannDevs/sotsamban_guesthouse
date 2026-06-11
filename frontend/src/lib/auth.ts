import { AxiosError } from "axios"

import { apiClient } from "@/lib/api"
import {
  removeAccessToken,
  setAccessToken,
} from "@/lib/auth-token"

export type AuthUser = {
  id: string
  name: string
  email: string
  phone: string | null
  role: "ADMIN" | "RECEPTIONIST"
  preferredLanguage: "EN" | "KM"
  createdAt: string
  updatedAt: string
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

type LoginResponse = {
  accessToken: string
  user: AuthUser
}

export type LoginPayload = {
  email: string
  password: string
}

export const authService = {
  async login(payload: LoginPayload) {
    const response = await apiClient.post<ApiResponse<LoginResponse>>(
      "/auth/login",
      payload
    )

    setAccessToken(response.data.data.accessToken)

    return response.data.data.user
  },

  async getMe() {
    const response = await apiClient.get<ApiResponse<AuthUser>>("/auth/me")

    return response.data.data
  },

  logout() {
    removeAccessToken()
  },
}

export function getAuthErrorMessage(
  error: unknown,
  fallback = "Unable to sign in. Check the backend server and try again."
) {
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

  return fallback
}
