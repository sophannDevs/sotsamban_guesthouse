import { AxiosError } from "axios"

import {
  apiClient,
  type PaginatedResponse,
  type PaginationParams,
  unwrapList,
  unwrapPaginated,
} from "@/lib/api"

export const productStatuses = ["ACTIVE", "INACTIVE"] as const
export type ProductStatus = (typeof productStatuses)[number]

export type ProductCategory = {
  id: string
  businessId: string
  name: string
  description: string | null
  productCount: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type CategoryPayload = {
  name: string
  description?: string
}

export type Product = {
  id: string
  businessId: string
  categoryId: string | null
  category: { id: string; name: string } | null
  name: string
  sku: string
  barcode: string | null
  purchasePrice: number
  sellingPrice: number
  stockQuantity: number
  lowStockAlert: number
  status: ProductStatus
  miniBarUsageCount: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type ProductPayload = {
  name: string
  sku: string
  barcode?: string
  categoryId?: string
  purchasePrice: number
  sellingPrice: number
  stockQuantity?: number
  lowStockAlert?: number
  status?: ProductStatus
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export const storeCategoryService = {
  async listPaginated(
    params: Pick<PaginationParams, "page" | "limit"> & { search?: string },
  ) {
    const response = await apiClient.get<
      ApiResponse<ProductCategory[]> | PaginatedResponse<ProductCategory>
    >("/store/categories", {
      params: {
        page: params.page,
        limit: params.limit,
        ...(params.search ? { search: params.search } : {}),
        sortBy: "name",
        sortOrder: "asc",
      },
    })

    return unwrapPaginated(
      "success" in response.data ? response.data.data : response.data,
      params,
    )
  },

  async list() {
    const response = await apiClient.get<PaginatedResponse<ProductCategory>>(
      "/store/categories",
      { params: { limit: 200, sortBy: "name", sortOrder: "asc" } },
    )
    return unwrapList(response.data)
  },

  async create(payload: CategoryPayload) {
    const response = await apiClient.post<ApiResponse<ProductCategory>>(
      "/store/categories",
      payload,
    )
    return response.data.data
  },

  async update(id: string, payload: CategoryPayload) {
    const response = await apiClient.patch<ApiResponse<ProductCategory>>(
      `/store/categories/${id}`,
      payload,
    )
    return response.data.data
  },

  async remove(id: string) {
    await apiClient.delete(`/store/categories/${id}`)
  },
}

export const storeProductService = {
  async listPaginated(
    params: Pick<PaginationParams, "page" | "limit"> & {
      search?: string
      status?: ProductStatus | "ALL"
      categoryId?: string
    },
  ) {
    const response = await apiClient.get<
      ApiResponse<Product[]> | PaginatedResponse<Product>
    >("/store/products", {
      params: {
        page: params.page,
        limit: params.limit,
        ...(params.search ? { search: params.search } : {}),
        ...(params.status && params.status !== "ALL"
          ? { status: params.status }
          : {}),
        ...(params.categoryId ? { categoryId: params.categoryId } : {}),
        sortBy: "createdAt",
        sortOrder: "desc",
      },
    })

    return unwrapPaginated(
      "success" in response.data ? response.data.data : response.data,
      params,
    )
  },

  async create(payload: ProductPayload) {
    const response = await apiClient.post<ApiResponse<Product>>(
      "/store/products",
      payload,
    )
    return response.data.data
  },

  async update(id: string, payload: ProductPayload) {
    const response = await apiClient.patch<ApiResponse<Product>>(
      `/store/products/${id}`,
      payload,
    )
    return response.data.data
  },

  async remove(id: string) {
    await apiClient.delete(`/store/products/${id}`)
  },
}

// ── Supplier ────────────────────────────────────────────────────────────────

export type Supplier = {
  id: string
  businessId: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  createdAt: string
  updatedAt: string
}

export type SupplierPayload = {
  name: string
  phone?: string
  email?: string
  address?: string
}

export const storeSupplierService = {
  async listPaginated(
    params: Pick<PaginationParams, "page" | "limit"> & { search?: string },
  ) {
    const response = await apiClient.get<PaginatedResponse<Supplier>>(
      "/store/suppliers",
      {
        params: {
          page: params.page,
          limit: params.limit,
          ...(params.search ? { search: params.search } : {}),
          sortBy: "name",
          sortOrder: "asc",
        },
      },
    )
    return unwrapPaginated(response.data, params)
  },

  async list() {
    const response = await apiClient.get<PaginatedResponse<Supplier>>(
      "/store/suppliers",
      { params: { limit: 200, sortBy: "name", sortOrder: "asc" } },
    )
    return unwrapList(response.data)
  },

  async create(payload: SupplierPayload) {
    const response = await apiClient.post<ApiResponse<Supplier>>(
      "/store/suppliers",
      payload,
    )
    return response.data.data
  },

  async update(id: string, payload: SupplierPayload) {
    const response = await apiClient.patch<ApiResponse<Supplier>>(
      `/store/suppliers/${id}`,
      payload,
    )
    return response.data.data
  },

  async remove(id: string) {
    await apiClient.delete(`/store/suppliers/${id}`)
  },
}

// ── Purchase ─────────────────────────────────────────────────────────────────

export const purchaseStatuses = ["DRAFT", "COMPLETED", "CANCELLED"] as const
export type PurchaseStatus = (typeof purchaseStatuses)[number]

export type StorePurchaseItem = {
  id: string
  productId: string
  product: { id: string; name: string; sku: string }
  quantity: number
  costPrice: number
  subtotal: number
}

export type StorePurchase = {
  id: string
  businessId: string
  purchaseNumber: string
  supplier: { id: string; name: string }
  totalAmount: number
  status: PurchaseStatus
  createdBy: { id: string; name: string }
  items: StorePurchaseItem[]
  createdAt: string
  updatedAt: string
}

export type CreatePurchasePayload = {
  supplierId: string
  items: Array<{ productId: string; quantity: number; costPrice: number }>
}

export type UpdatePurchasePayload = {
  supplierId?: string
  items?: Array<{ productId: string; quantity: number; costPrice: number }>
}

export const storePurchaseService = {
  async listPaginated(
    params: Pick<PaginationParams, "page" | "limit"> & {
      search?: string
      status?: PurchaseStatus | "ALL"
      from?: string
      to?: string
    },
  ) {
    const response = await apiClient.get<PaginatedResponse<StorePurchase>>(
      "/store/purchases",
      {
        params: {
          page: params.page,
          limit: params.limit,
          ...(params.search ? { search: params.search } : {}),
          ...(params.status && params.status !== "ALL"
            ? { status: params.status }
            : {}),
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
    const response = await apiClient.get<ApiResponse<StorePurchase>>(
      `/store/purchases/${id}`,
    )
    return response.data.data
  },

  async create(payload: CreatePurchasePayload) {
    const response = await apiClient.post<ApiResponse<StorePurchase>>(
      "/store/purchases",
      payload,
    )
    return response.data.data
  },

  async update(id: string, payload: UpdatePurchasePayload) {
    const response = await apiClient.patch<ApiResponse<StorePurchase>>(
      `/store/purchases/${id}`,
      payload,
    )
    return response.data.data
  },

  async complete(id: string) {
    const response = await apiClient.patch<ApiResponse<StorePurchase>>(
      `/store/purchases/${id}/complete`,
    )
    return response.data.data
  },

  async cancel(id: string) {
    const response = await apiClient.patch<ApiResponse<StorePurchase>>(
      `/store/purchases/${id}/cancel`,
    )
    return response.data.data
  },
}

// ── Sale ──────────────────────────────────────────────────────────────────────

export const saleStatuses = ["COMPLETED", "CANCELLED", "REFUNDED"] as const
export type SaleStatus = (typeof saleStatuses)[number]

export const storePaymentMethods = [
  "CASH",
  "CARD",
  "QR",
  "BANK_TRANSFER",
] as const
export type StorePaymentMethod = (typeof storePaymentMethods)[number]

export type SaleItem = {
  id: string
  productId: string
  product: { id: string; name: string; sku: string }
  quantity: number
  unitPrice: number
  subtotal: number
}

export type Sale = {
  id: string
  businessId: string
  saleNumber: string
  totalAmount: number
  paymentMethod: StorePaymentMethod
  status: SaleStatus
  soldBy: { id: string; name: string }
  items: SaleItem[]
  createdAt: string
  updatedAt: string
}

export type CreateSalePayload = {
  paymentMethod: StorePaymentMethod
  items: Array<{ productId: string; quantity: number }>
}

export const storeSaleService = {
  async listPaginated(
    params: Pick<PaginationParams, "page" | "limit"> & {
      search?: string
      status?: SaleStatus | "ALL"
      from?: string
      to?: string
    },
  ) {
    const response = await apiClient.get<PaginatedResponse<Sale>>(
      "/store/sales",
      {
        params: {
          page: params.page,
          limit: params.limit,
          ...(params.search ? { search: params.search } : {}),
          ...(params.status && params.status !== "ALL"
            ? { status: params.status }
            : {}),
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
    const response = await apiClient.get<ApiResponse<Sale>>(
      `/store/sales/${id}`,
    )
    return response.data.data
  },

  async create(payload: CreateSalePayload) {
    const response = await apiClient.post<ApiResponse<Sale>>(
      "/store/sales",
      payload,
    )
    return response.data.data
  },

  async cancel(id: string) {
    const response = await apiClient.patch<ApiResponse<Sale>>(
      `/store/sales/${id}/cancel`,
    )
    return response.data.data
  },

  async refund(id: string) {
    const response = await apiClient.patch<ApiResponse<Sale>>(
      `/store/sales/${id}/refund`,
    )
    return response.data.data
  },
}

export function getStoreErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data as
      | { message?: string | string[] }
      | undefined
    const message = responseData?.message

    if (Array.isArray(message)) return message.join(" ")
    if (message) return message
  }

  return "Unable to reach the store API. Check the backend server and try again."
}
