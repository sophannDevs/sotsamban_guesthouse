import type * as React from "react"

import { AppSidebar } from "@/components/app/app-sidebar"
import { BusinessProvider } from "@/components/app/business-provider"
import { Header } from "@/components/app/header"
import { MobileBottomNav } from "@/components/app/mobile-bottom-nav"
import { MobileFab } from "@/components/app/mobile-fab"
import { ProtectedRoute } from "@/components/app/protected-route"

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ProtectedRoute>
      <BusinessProvider>
        <div className="flex min-h-dvh bg-background">
          <AppSidebar className="hidden md:flex" />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main className="flex flex-1 flex-col gap-5 p-4 pb-24 md:p-8">
              {children}
            </main>
          </div>
        </div>
        <MobileBottomNav />
        <MobileFab />
      </BusinessProvider>
    </ProtectedRoute>
  )
}
