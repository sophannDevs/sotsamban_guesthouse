"use client"

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { toast } from "sonner"

import { useAuth } from "@/components/app/auth-provider"
import {
  businessService,
  getBusinessErrorMessage,
  type ActiveBusiness,
  type BusinessListItem,
} from "@/lib/business"
import {
  getStoredActiveBusiness,
  removeStoredActiveBusiness,
  setStoredActiveBusiness,
} from "@/lib/business-token"

type BusinessContextValue = {
  activeBusiness: ActiveBusiness | null
  businesses: BusinessListItem[]
  isLoading: boolean
  isSwitching: boolean
  switchBusiness: (businessId: string) => Promise<void>
  refreshBusinesses: () => Promise<void>
}

const BusinessContext = createContext<BusinessContextValue | null>(null)

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const [activeBusiness, setActiveBusiness] = useState<ActiveBusiness | null>(null)
  const [businesses, setBusinesses] = useState<BusinessListItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)

  const refreshBusinesses = useCallback(async () => {
    setIsLoading(true)

    try {
      const list = await businessService.getMyBusinesses()
      setBusinesses(list)

      const stored = getStoredActiveBusiness()
      const isStoredValid =
        stored !== null && list.some((b) => b.id === stored.businessId)

      if (isStoredValid && stored) {
        setActiveBusiness(stored)
      } else if (list.length > 0) {
        const first = list[0]
        const auto: ActiveBusiness = {
          businessId: first.id,
          businessName: first.name,
          businessType: first.type,
        }
        setStoredActiveBusiness(auto)
        setActiveBusiness(auto)
      } else {
        removeStoredActiveBusiness()
        setActiveBusiness(null)
      }
    } catch (error) {
      toast.error(
        getBusinessErrorMessage(error, "Failed to load your businesses.")
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  const switchBusiness = useCallback(async (businessId: string) => {
    setIsSwitching(true)

    try {
      const result = await businessService.switchTo(businessId)
      setStoredActiveBusiness(result)
      setActiveBusiness(result)
    } catch (error) {
      toast.error(
        getBusinessErrorMessage(error, "Failed to switch business.")
      )
    } finally {
      setIsSwitching(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthLoading) return

    if (isAuthenticated) {
      void refreshBusinesses()
    } else {
      removeStoredActiveBusiness()
      setActiveBusiness(null)
      setBusinesses([])
    }
  }, [isAuthenticated, isAuthLoading, refreshBusinesses])

  const value = useMemo(
    () => ({
      activeBusiness,
      businesses,
      isLoading,
      isSwitching,
      switchBusiness,
      refreshBusinesses,
    }),
    [activeBusiness, businesses, isLoading, isSwitching, refreshBusinesses, switchBusiness]
  )

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  )
}

export function useActiveBusiness() {
  const context = useContext(BusinessContext)

  if (!context) {
    throw new Error("useActiveBusiness must be used inside BusinessProvider")
  }

  return context
}
