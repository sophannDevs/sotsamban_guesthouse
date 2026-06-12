"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  BedDoubleIcon,
  CalendarDaysIcon,
  CalendarCheckIcon,
  CircleDollarSignIcon,
  ClipboardListIcon,
  GaugeIcon,
  HotelIcon,
  FileBarChartIcon,
  BellIcon,
  PackageIcon,
  ReceiptIcon,
  ShoppingBagIcon,
  ShieldCheckIcon,
  StoreIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react"

import { useActiveBusiness } from "@/components/app/business-provider"
import { useAuth } from "@/components/app/auth-provider"
import { Separator } from "@/components/ui/separator"
import type { UserRole } from "@/lib/users"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  icon: typeof GaugeIcon
  translationKey: string
  roles?: UserRole[]
}

const guesthouseNavItems: NavItem[] = [
  {
    href: "/dashboard",
    icon: GaugeIcon,
    translationKey: "dashboard",
  },
  {
    href: "/rooms",
    icon: BedDoubleIcon,
    translationKey: "rooms",
  },
  {
    href: "/availability",
    icon: CalendarDaysIcon,
    translationKey: "availability.nav",
  },
  {
    href: "/guests",
    icon: UsersIcon,
    translationKey: "guests",
  },
  {
    href: "/bookings",
    icon: CalendarCheckIcon,
    translationKey: "bookings",
  },
  {
    href: "/payments",
    icon: CircleDollarSignIcon,
    translationKey: "payments",
  },
  {
    href: "/reports",
    icon: FileBarChartIcon,
    translationKey: "reports",
  },
  {
    href: "/notifications",
    icon: BellIcon,
    translationKey: "notifications",
  },
  {
    href: "/users",
    icon: ShieldCheckIcon,
    translationKey: "users",
    roles: ["ADMIN"],
  },
]

const storeNavItems: NavItem[] = [
  {
    href: "/dashboard",
    icon: GaugeIcon,
    translationKey: "dashboard",
  },
  {
    href: "/store/categories",
    icon: PackageIcon,
    translationKey: "store.categories",
  },
  {
    href: "/store/products",
    icon: ShoppingBagIcon,
    translationKey: "store.productsNav",
  },
  {
    href: "/store/sales",
    icon: ReceiptIcon,
    translationKey: "store.salesNav",
  },
  {
    href: "/store/suppliers",
    icon: TruckIcon,
    translationKey: "store.suppliersNav",
  },
  {
    href: "/store/purchases",
    icon: ClipboardListIcon,
    translationKey: "store.purchasesNav",
  },
  {
    href: "/notifications",
    icon: BellIcon,
    translationKey: "notifications",
  },
  {
    href: "/users",
    icon: ShieldCheckIcon,
    translationKey: "users",
    roles: ["ADMIN"],
  },
]

type AppSidebarProps = {
  className?: string
}

export function AppSidebar({ className }: AppSidebarProps) {
  const pathname = usePathname()
  const t = useTranslations()
  const { user } = useAuth()
  const { activeBusiness } = useActiveBusiness()

  const isStore = activeBusiness?.businessType === "STORE"
  const navItems = isStore ? storeNavItems : guesthouseNavItems

  const visibleNavItems = navItems.filter(
    (item) => !item.roles || (user ? item.roles.includes(user.role) : false),
  )

  return (
    <aside
      className={cn(
        "flex w-72 shrink-0 flex-col border-r border-border bg-transparent text-foreground",
        className,
      )}
    >
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          {isStore ? <StoreIcon /> : <HotelIcon />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Sot Samban</p>
          <p className="truncate text-xs text-muted-foreground">
            {isStore ? t("store.storeConsole") : t("guestHouseConsole")}
          </p>
        </div>
      </div>
      <Separator />
      <nav
        aria-label={t("navigation")}
        className="flex flex-1 flex-col gap-1 p-3"
      >
        {visibleNavItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href)

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors [&_svg:not([class*='size-'])]:size-4",
                "text-muted-foreground hover:bg-muted hover:text-foreground",
                isActive && "bg-muted text-foreground",
              )}
              href={item.href}
              key={item.href}
            >
              <Icon />
              <span>{t(item.translationKey)}</span>
            </Link>
          )
        })}
      </nav>
      <div className="flex flex-col gap-3 p-4 text-xs text-muted-foreground">
        <Separator />
        <div className="rounded-lg border bg-muted/40 p-3 text-foreground">
          <p className="font-medium">{t("liveAccessMode")}</p>
          <p className="mt-1 text-muted-foreground">
            {t("roleBasedNavigation")}
          </p>
        </div>
      </div>
    </aside>
  )
}
