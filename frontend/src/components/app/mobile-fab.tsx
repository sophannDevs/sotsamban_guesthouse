"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  CalendarPlusIcon,
  PlusIcon,
  ReceiptIcon,
  UserPlusIcon,
  WalletIcon,
  ZapIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { useActiveBusiness } from "@/components/app/business-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const guesthouseFabActions = [
  {
    href: "/dashboard",
    labelKey: "dashboardPage.quickWalkIn",
    icon: UserPlusIcon,
    action: "walkIn",
  },
  {
    href: "/dashboard",
    labelKey: "dashboardPage.quickExpressCheckIn",
    icon: ZapIcon,
    action: "expressCheckIn",
  },
  { href: "/bookings", labelKey: "fab.newBooking", icon: CalendarPlusIcon },
  { href: "/expenses", labelKey: "fab.addExpense", icon: WalletIcon },
] as const

const storeFabActions = [
  { href: "/store/sales", labelKey: "fab.addSale", icon: ReceiptIcon },
  { href: "/expenses", labelKey: "fab.addExpense", icon: WalletIcon },
] as const

export function MobileFab() {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()
  const { activeBusiness } = useActiveBusiness()

  if (!activeBusiness) {
    return null
  }

  const actions =
    activeBusiness.businessType === "STORE" ? storeFabActions : guesthouseFabActions

  function handleAction(action: (typeof actions)[number]) {
    const searchAction = "action" in action ? action.action : "new"

    if (action.href === "/dashboard" && pathname === "/dashboard") {
      window.dispatchEvent(
        new CustomEvent("dashboard:quick-action", { detail: searchAction })
      )
      return
    }

    router.push(`${action.href}?action=${searchAction}`)
  }

  return (
    <div className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] z-50 md:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("quickActions")}
              className="size-14 rounded-full shadow-lg"
              size="icon-lg"
            />
          }
        >
          <PlusIcon className="size-6" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" side="top">
          <DropdownMenuGroup>
            {actions.map((action) => (
              <DropdownMenuItem
                key={`${action.href}-${action.labelKey}`}
                onClick={() => handleAction(action)}
              >
                <action.icon data-icon="inline-start" />
                {t(action.labelKey)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
