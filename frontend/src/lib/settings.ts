import { AxiosError } from "axios"

import { apiClient, type PaginatedResponse, unwrapList } from "@/lib/api"
import type { PreferredLanguage } from "@/lib/users"

export type ProfileSettings = {
  id: string
  name: string
  email: string
  phone: string | null
  preferredLanguage: PreferredLanguage
  role: "ADMIN" | "RECEPTIONIST"
  createdAt: string
  updatedAt: string
}

export type ProfileSettingsPayload = {
  name: string
  phone?: string
  preferredLanguage: PreferredLanguage
}

export type SystemSetting = {
  id: string
  key: string
  value: string
  type: string
  createdAt: string
  updatedAt: string
}

export type BusinessSettingsPayload = {
  guesthouseName: string
  guesthouseAddress: string
  guesthousePhone: string
  guesthouseEmail: string
  logoUrl: string
}

export type SystemPreferencesPayload = {
  currency: "USD" | "KHR"
  timezone: "Asia/Phnom_Penh"
  dateFormat: "DD/MM/YYYY" | "YYYY-MM-DD"
  language: "en" | "km"
}

export type NotificationSettings = {
  id: string
  userId: string
  bookingAlerts: boolean
  paymentAlerts: boolean
  maintenanceAlerts: boolean
  systemAlerts: boolean
  createdAt: string
  updatedAt: string
}

export type NotificationSettingsPayload = {
  bookingAlerts?: boolean
  paymentAlerts?: boolean
  maintenanceAlerts?: boolean
  systemAlerts?: boolean
}

export type ChangePasswordPayload = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export const settingsService = {
  async list() {
    const response =
      await apiClient.get<
        ApiResponse<SystemSetting[]> | PaginatedResponse<SystemSetting>
      >("/settings")

    return unwrapList("success" in response.data ? response.data.data : response.data)
  },

  async updateSetting(key: string, value: string) {
    const response = await apiClient.patch<ApiResponse<SystemSetting>>(
      `/settings/${key}`,
      { value }
    )

    return response.data.data
  },

  async getProfile() {
    const response =
      await apiClient.get<ApiResponse<ProfileSettings>>("/settings/profile")

    return response.data.data
  },

  async updateProfile(payload: ProfileSettingsPayload) {
    const response = await apiClient.patch<ApiResponse<ProfileSettings>>(
      "/settings/profile",
      payload
    )

    return response.data.data
  },

  async changePassword(payload: ChangePasswordPayload) {
    const response = await apiClient.patch<ApiResponse<null>>(
      "/settings/security/change-password",
      payload
    )

    return response.data
  },

  async getNotificationSettings() {
    const response = await apiClient.get<ApiResponse<NotificationSettings>>(
      "/settings/notifications"
    )

    return response.data.data
  },

  async updateNotificationSettings(payload: NotificationSettingsPayload) {
    const response = await apiClient.patch<ApiResponse<NotificationSettings>>(
      "/settings/notifications",
      payload
    )

    return response.data.data
  },
}

export function getSettingsErrorMessage(error: unknown) {
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

  return "Unable to reach the settings API. Check the backend server and try again."
}
