import { AxiosError } from "axios"

import { apiClient, type PaginatedResponse, type PaginationParams } from "@/lib/api"

export const expenseCategories = [
  "RENT",
  "ELECTRICITY",
  "WATER",
  "INTERNET",
  "SALARY",
  "MAINTENANCE",
  "SUPPLIES",
  "FOOD",
  "OTHER",
] as const
export type ExpenseCategory = (typeof expenseCategories)[number]

export const expensePaymentMethods = [
  "CASH",
  "CARD",
  "QR",
  "BANK_TRANSFER",
] as const
export type ExpensePaymentMethod = (typeof expensePaymentMethods)[number]

export type Expense = {
  id: string
  businessId: string
  title: string
  category: ExpenseCategory
  amount: number
  expenseDate: string
  paymentMethod: ExpensePaymentMethod
  note: string | null
  createdBy: { id: string; name: string; email: string }
  createdAt: string
  updatedAt: string
}

export type ExpensePayload = {
  title: string
  category: ExpenseCategory
  amount: number
  expenseDate: string
  paymentMethod: ExpensePaymentMethod
  note?: string
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

type ExpenseListParams = Pick<PaginationParams, "page" | "limit" | "search"> & {
  startDate?: string
  endDate?: string
  category?: ExpenseCategory
  paymentMethod?: ExpensePaymentMethod
}

export const expenseService = {
  async listPaginated(params: ExpenseListParams): Promise<PaginatedResponse<Expense>> {
    const response = await apiClient.get<PaginatedResponse<Expense>>("/expenses", {
      params: {
        page: params.page,
        limit: params.limit,
        sortBy: "expenseDate",
        sortOrder: "desc",
        ...(params.search ? { search: params.search } : {}),
        ...(params.startDate ? { startDate: params.startDate } : {}),
        ...(params.endDate ? { endDate: params.endDate } : {}),
        ...(params.category ? { category: params.category } : {}),
        ...(params.paymentMethod ? { paymentMethod: params.paymentMethod } : {}),
      },
    })
    return response.data
  },

  async create(payload: ExpensePayload): Promise<Expense> {
    const response = await apiClient.post<ApiResponse<Expense>>("/expenses", payload)
    return response.data.data
  },

  async update(id: string, payload: Partial<ExpensePayload>): Promise<Expense> {
    const response = await apiClient.patch<ApiResponse<Expense>>(
      `/expenses/${id}`,
      payload,
    )
    return response.data.data
  },

  async remove(id: string): Promise<Expense> {
    const response = await apiClient.delete<ApiResponse<Expense>>(`/expenses/${id}`)
    return response.data.data
  },
}

export function getExpenseErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
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
