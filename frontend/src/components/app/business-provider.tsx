"use client"

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

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

  // Cache: avoid re-fetching the business list more than once per CACHE_TTL
  const cacheRef = useRef<{ data: BusinessListItem[]; fetchedAt: number } | null>(null)

  const resolveActiveBusiness = useCallback((list: BusinessListItem[]) => {
    const stored = getStoredActiveBusiness()
    const isStoredValid = stored !== null && list.some((b) => b.id === stored.businessId)

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
  }, [])

  const refreshBusinesses = useCallback(
    async (forceRefresh = false) => {
      const now = Date.now()
      const cache = cacheRef.current

      // Serve from cache if still fresh
      if (!forceRefresh && cache && now - cache.fetchedAt < CACHE_TTL) {
        setBusinesses(cache.data)
        resolveActiveBusiness(cache.data)
        return
      }

      setIsLoading(true)

      try {
        const list = await businessService.getMyBusinesses()
        cacheRef.current = { data: list, fetchedAt: Date.now() }
        setBusinesses(list)
        resolveActiveBusiness(list)
      } catch (error) {
        toast.error(
          getBusinessErrorMessage(error, "Failed to load your businesses.")
        )
      } finally {
        setIsLoading(false)
      }
    },
    [resolveActiveBusiness]
  )

  const switchBusiness = useCallback(async (businessId: string) => {
    setIsSwitching(true)

    try {
      const result = await businessService.switchTo(businessId)
      setStoredActiveBusiness(result)
      setActiveBusiness(result)
      // The business list did not change — no need to invalidate cache
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
      // Clear cache on sign-out so the next sign-in starts fresh
      cacheRef.current = null
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
      refreshBusinesses: () => refreshBusinesses(true), // external callers always force-refresh
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
