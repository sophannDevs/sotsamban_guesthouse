import { AxiosError } from "axios"

import { apiClient } from "@/lib/api"

export const invoiceService = {
  async downloadBookingInvoice(bookingId: string) {
    const response = await apiClient.get<Blob>(
      `/invoices/booking/${bookingId}/pdf`,
      {
        responseType: "blob",
      }
    )

    return response.data
  },
}

export function downloadInvoiceFile(bookingId: string, blob: Blob) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = `invoice-${bookingId}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function getInvoiceErrorMessage(error: unknown) {
  if (error instanceof AxiosError && error.response?.data instanceof Blob) {
    try {
      const text = await error.response.data.text()
      const data = JSON.parse(text) as { message?: string | string[] }
      const message = data.message

      if (Array.isArray(message)) {
        return message.join(" ")
      }

      if (message) {
        return message
      }
    } catch {
      return "Unable to download the invoice. Try again."
    }
  }

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

  return "Unable to download the invoice. Check the backend server and try again."
}
