"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarCheckIcon,
  CircleDollarSignIcon,
  GaugeIcon,
  MoreHorizontalIcon,
  TrendingUpIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { AppSidebar } from "@/components/app/app-sidebar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const bottomNavItems = [
  { href: "/dashboard", icon: GaugeIcon, labelKey: "dashboard", exact: true },
  { href: "/bookings", icon: CalendarCheckIcon, labelKey: "bookings", exact: false },
  { href: "/finance", icon: TrendingUpIcon, labelKey: "finance", exact: false },
  { href: "/payments", icon: CircleDollarSignIcon, labelKey: "payments", exact: false },
] as const

export function MobileBottomNav() {
  const pathname = usePathname()
  const t = useTranslations()
  const [moreOpen, setMoreOpen] = useState(false)

  // Close the "More" sheet on navigation
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  const isInBottomNav = bottomNavItems.some(({ href, exact }) =>
    exact ? pathname === href : pathname.startsWith(href),
  )

  return (
    <>
      <nav
        aria-label={t("navigation")}
        className="fixed bottom-0 left-0 right-0 z-40 flex h-16 shrink-0 border-t bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur supports-backdrop-filter:bg-background/80 lg:hidden"
      >
        {bottomNavItems.map(({ href, icon: Icon, labelKey, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              href={href}
              key={href}
            >
              <Icon className="size-5" />
              <span>{t(labelKey)}</span>
            </Link>
          )
        })}
        <button
          aria-expanded={moreOpen}
          aria-label={t("more")}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
            !isInBottomNav
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setMoreOpen(true)}
          type="button"
        >
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
