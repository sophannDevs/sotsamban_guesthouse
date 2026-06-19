import { AxiosError } from "axios"

import { apiClient } from "@/lib/api"
import type { Booking } from "@/lib/bookings"
import type { Payment } from "@/lib/payments"

export type HousekeepingDashboardTask = {
  id: string
  status: string
  priority: string
  note: string | null
  startedAt: string | null
  createdAt: string
  room: { roomNumber: string; type: string }
  assignedTo: { name: string } | null
}

export type HousekeepingDashboardSummary = {
  needsCleaning: number
  cleaningInProgress: number
  cleanedWaitingInspection: number
  completedToday: number
  todaysTasks: HousekeepingDashboardTask[]
  urgentTasks: HousekeepingDashboardTask[]
}

export type DashboardSummary = {
  totalRooms: number
  availableRooms: number
  bookedRooms: number
  occupiedRooms: number
  maintenanceRooms: number
  totalGuests: number
  todayCheckIns: number
  todayCheckOuts: number
  totalRevenue: number
  monthlyRevenue: number
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export const dashboardService = {
  async getSummary() {
    const response =
      await apiClient.get<ApiResponse<DashboardSummary>>("/dashboard/summary")

    return response.data.data
  },

  async getRecentBookings() {
    const response = await apiClient.get<ApiResponse<Booking[]>>(
      "/dashboard/recent-bookings"
    )

    return response.data.data
  },

  async getRecentPayments() {
    const response = await apiClient.get<ApiResponse<Payment[]>>(
      "/dashboard/recent-payments"
    )

    return response.data.data
  },

  async getHousekeepingSummary() {
    const response = await apiClient.get<ApiResponse<HousekeepingDashboardSummary>>(
      "/dashboard/housekeeping-summary"
    )

    return response.data.data
  },
}

export function getDashboardErrorMessage(error: unknown) {
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

  return "Unable to reach the dashboard API. Check the backend server and try again."
}
