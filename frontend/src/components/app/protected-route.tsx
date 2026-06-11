"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import { useAuth } from "@/components/app/auth-provider"

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [isAuthenticated, isLoading, pathname, router])

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="size-8 rounded-full border-2 border-primary border-t-transparent motion-safe:animate-spin" />
          <p className="text-sm text-muted-foreground">Checking session</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return children
}
