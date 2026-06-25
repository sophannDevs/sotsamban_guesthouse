"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BedDoubleIcon,
  CalendarCheckIcon,
  GaugeIcon,
  MoreHorizontalIcon,
  ReceiptIcon,
  ShoppingBagIcon,
  TrendingUpIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { AppSidebar } from "@/components/app/app-sidebar"
import { useActiveBusiness } from "@/components/app/business-provider"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const guesthouseBottomNavItems = [
  { href: "/dashboard", icon: GaugeIcon, labelKey: "dashboard", exact: true },
  { href: "/bookings", icon: CalendarCheckIcon, labelKey: "bookings", exact: false },
  { href: "/finance", icon: TrendingUpIcon, labelKey: "finance", exact: false },
  { href: "/rooms", icon: BedDoubleIcon, labelKey: "rooms", exact: false },
] as const

const storeBottomNavItems = [
  { href: "/dashboard", icon: GaugeIcon, labelKey: "dashboard", exact: true },
  { href: "/store/products", icon: ShoppingBagIcon, labelKey: "store.productsNav", exact: false },
  { href: "/store/sales", icon: ReceiptIcon, labelKey: "store.salesNav", exact: false },
  { href: "/finance", icon: TrendingUpIcon, labelKey: "finance", exact: false },
] as const

export function MobileBottomNav() {
  const pathname = usePathname()
  const t = useTranslations()
  const { activeBusiness } = useActiveBusiness()
  const [moreOpen, setMoreOpen] = useState(false)
  const bottomNavItems =
    activeBusiness?.businessType === "STORE"
      ? storeBottomNavItems
      : guesthouseBottomNavItems

  // Close the "More" sheet on navigation
  useEffect(() => {
    function run() {
      setMoreOpen(false)
    }
    void run()
  }, [pathname])

  const isInBottomNav = bottomNavItems.some(({ href, exact }) =>
    exact ? pathname === href : pathname.startsWith(href),
  )

  return (
    <>
      <nav
        aria-label={t("navigation")}
        className="fixed bottom-0 left-0 right-0 z-40 flex h-16 shrink-0 border-t bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden"
      >
        {bottomNavItems.map(({ href, icon: Icon, labelKey, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              href={href}
              key={href}
            >
              {isActive && (
                <span aria-hidden="true" className="absolute top-0 h-0.5 w-8 rounded-b-full bg-primary" />
              )}
              <Icon className="size-5" />
              <span>{t(labelKey)}</span>
            </Link>
          )
        })}
        <button
          aria-expanded={moreOpen}
          aria-label={t("more")}
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
            !isInBottomNav
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setMoreOpen(true)}
          type="button"
        >
          {!isInBottomNav && (
            <span aria-hidden="true" className="absolute top-0 h-0.5 w-8 rounded-b-full bg-primary" />
          )}
          <MoreHorizontalIcon className="size-5" />
          <span>{t("more")}</span>
        </button>
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent className="w-72 p-0" side="left" showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>{t("navigation")}</SheetTitle>
          </SheetHeader>
          <AppSidebar className="h-full w-full border-r-0" />
        </SheetContent>
      </Sheet>
    </>
  )
}
