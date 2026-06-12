const ACTIVE_BUSINESS_KEY = "guesthouse_active_business"

export type StoredActiveBusiness = {
  businessId: string
  businessName: string
  businessType: "GUESTHOUSE" | "STORE"
}

export function getStoredActiveBusiness(): StoredActiveBusiness | null {
  if (typeof window === "undefined") return null

  try {
    const stored = window.localStorage.getItem(ACTIVE_BUSINESS_KEY)
    return stored ? (JSON.parse(stored) as StoredActiveBusiness) : null
  } catch {
    return null
  }
}

export function setStoredActiveBusiness(business: StoredActiveBusiness): void {
  window.localStorage.setItem(ACTIVE_BUSINESS_KEY, JSON.stringify(business))
}

export function removeStoredActiveBusiness(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(ACTIVE_BUSINESS_KEY)
}
