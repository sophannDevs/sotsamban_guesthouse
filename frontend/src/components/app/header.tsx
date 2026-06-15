"use client"

import { useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import {
  BellIcon,
  Building2Icon,
  LockKeyholeIcon,
  LogOutIcon,
  MenuIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  UserRoundIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { AppSidebar } from "@/components/app/app-sidebar"
import { useAuth } from "@/components/app/auth-provider"
import { BusinessSwitcher } from "@/components/app/business-switcher"
import { LanguageSwitcher } from "@/components/app/language-switcher"
import { NotificationBell } from "@/components/app/notification-bell"
import BusinessSettingsPage from "@/app/(dashboard)/settings/business/page"
import NotificationSettingsPage from "@/app/(dashboard)/settings/notifications/page"
import PreferencesSettingsPage from "@/app/(dashboard)/settings/preferences/page"
import ProfileSettingsPage from "@/app/(dashboard)/settings/profile/page"
import SecuritySettingsPage from "@/app/(dashboard)/settings/security/page"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type PageTitleKey =
  | "dashboard"
  | "finance"
  | "rooms"
  | "availability.nav"
  | "guests"
  | "bookings"
  | "payments"
  | "reports"
  | "maintenance"
  | "notifications"
  | "auditLogs"
  | "users"
  | "settings"
  | "profileSettings"
  | "businessSettings"
  | "notificationSettings"
  | "preferencesSettings"
  | "securitySettings"
  | "store.categories"
  | "store.productsNav"
  | "store.salesNav"
  | "store.suppliersNav"
  | "store.purchasesNav"
  | "expenses.expensesNav"

const pageTitleKeys: Record<string, PageTitleKey> = {
  "/dashboard": "dashboard",
  "/finance": "finance",
  "/rooms": "rooms",
  "/availability": "availability.nav",
  "/guests": "guests",
  "/bookings": "bookings",
  "/payments": "payments",
  "/reports": "reports",
  "/notifications": "notifications",
  "/users": "users",
  "/settings": "settings",
  "/settings/profile": "profileSettings",
  "/settings/business": "businessSettings",
  "/settings/notifications": "notificationSettings",
  "/settings/preferences": "preferencesSettings",
  "/settings/security": "securitySettings",
  "/store/categories": "store.categories",
  "/store/products": "store.productsNav",
  "/store/sales": "store.salesNav",
  "/store/suppliers": "store.suppliersNav",
  "/store/purchases": "store.purchasesNav",
  "/expenses": "expenses.expensesNav",
}

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations()
  const { logout, user } = useAuth()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeSettingsPanel, setActiveSettingsPanel] =
    useState<SettingsPanel>("profile")
  const title = t(pageTitleKeys[pathname] ?? "dashboard")
  const displayName = user?.name ?? t("staff")
  const displayRole = user?.role
    ? user.role.toLowerCase().replace("_", " ")
    : t("signedIn")
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    []
  )

  function handleLogout() {
    logout()
    router.replace("/login")
  }

  return (
    <>
    <header className="sticky top-0 flex h-16 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Sheet>
          <SheetTrigger
            render={<Button className="lg:hidden" size="icon" variant="outline" />}
          >
            <MenuIcon />
            <span className="sr-only">{t("openNavigation")}</span>
          </SheetTrigger>
          <SheetContent className="w-72 p-0" side="left" showCloseButton={false}>
            <SheetHeader className="sr-only">
              <SheetTitle>{t("navigation")}</SheetTitle>
            </SheetHeader>
            <AppSidebar className="h-full w-full border-r-0" />
          </SheetContent>
        </Sheet>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            {t("frontDeskOverview", { date: today })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button aria-label={t("searchRecords")} className="hidden sm:flex" size="icon" variant="ghost">
          <SearchIcon />
        </Button>
        <LanguageSwitcher />
        <BusinessSwitcher />
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="lg" variant="ghost" />}>
            <Avatar size="sm">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">
              {displayName}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <span className="block truncate">{displayName}</span>
                <Badge className="mt-1 capitalize" variant="secondary">
                  {displayRole}
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                {t("settings")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleLogout} variant="destructive">
                <LogOutIcon />
                {t("logout")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <DialogContent className="max-h-[min(860px,calc(100dvh-2rem))] overflow-hidden p-0 sm:max-w-[min(1120px,calc(100vw-2rem))]">
        <DialogHeader>
          <div className="px-5 pt-5">
            <DialogTitle>{t("settings")}</DialogTitle>
            <DialogDescription>
              {t("settingsPopupDescription")}
            </DialogDescription>
          </div>
        </DialogHeader>
        <Separator />
        <div className="grid min-h-0 flex-1 md:grid-cols-[260px_minmax(0,1fr)]">
          <nav
            aria-label={t("settingsNavigation")}
            className="flex gap-2 overflow-x-auto border-b p-3 md:flex-col md:overflow-x-visible md:border-r md:border-b-0"
          >
            {settingsLinks.map((item) => {
              const Icon = item.icon
              const isActive = activeSettingsPanel === item.value

              return (
                <Button
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "h-auto min-w-0 justify-start gap-2 py-2 text-left md:gap-3 md:py-3",
                    isActive && "bg-muted text-foreground"
                  )}
                  key={item.value}
                  onClick={() => setActiveSettingsPanel(item.value)}
                  type="button"
                  variant="ghost"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40 md:size-9">
                    <Icon />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="whitespace-nowrap font-medium">{t(item.labelKey)}</span>
                    <span className="hidden line-clamp-2 text-xs font-normal text-muted-foreground md:block">
                      {t(item.descriptionKey)}
                    </span>
                  </span>
                </Button>
              )
            })}
          </nav>
          <div className="max-h-[calc(min(860px,100dvh-2rem)-122px)] min-w-0 overflow-y-auto p-4 sm:p-5">
            {renderSettingsPanel(activeSettingsPanel)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}

type SettingsPanel =
  | "profile"
  | "business"
  | "security"
  | "preferences"
  | "notifications"

const settingsLinks = [
  {
    value: "profile",
    icon: UserRoundIcon,
    labelKey: "profileSettings",
    descriptionKey: "profileSettingsShortDescription",
  },
  {
    value: "business",
    icon: Building2Icon,
    labelKey: "businessSettings",
    descriptionKey: "businessSettingsShortDescription",
  },
  {
    value: "security",
    icon: LockKeyholeIcon,
    labelKey: "securitySettings",
    descriptionKey: "securitySettingsShortDescription",
  },
  {
    value: "preferences",
    icon: SlidersHorizontalIcon,
    labelKey: "preferencesSettings",
    descriptionKey: "preferencesSettingsShortDescription",
  },
  {
    value: "notifications",
    icon: BellIcon,
    labelKey: "notificationSettings",
    descriptionKey: "notificationSettingsShortDescription",
  },
] as const satisfies Array<{
  value: SettingsPanel
  icon: typeof UserRoundIcon
  labelKey:
    | "profileSettings"
    | "businessSettings"
    | "securitySettings"
    | "preferencesSettings"
    | "notificationSettings"
  descriptionKey:
    | "profileSettingsShortDescription"
    | "businessSettingsShortDescription"
    | "securitySettingsShortDescription"
    | "preferencesSettingsShortDescription"
    | "notificationSettingsShortDescription"
}>

function renderSettingsPanel(panel: SettingsPanel) {
  switch (panel) {
    case "business":
      return <BusinessSettingsPage />
    case "security":
      return <SecuritySettingsPage />
    case "preferences":
      return <PreferencesSettingsPage />
    case "notifications":
      return <NotificationSettingsPage />
    case "profile":
    default:
      return <ProfileSettingsPage />
  }
}
