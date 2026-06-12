import type * as React from "react"

import { AppSidebar } from "@/components/app/app-sidebar"
import { BusinessProvider } from "@/components/app/business-provider"
import { Header } from "@/components/app/header"
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
          <AppSidebar className="hidden lg:flex" />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main className="flex flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </BusinessProvider>
    </ProtectedRoute>
  )
}
