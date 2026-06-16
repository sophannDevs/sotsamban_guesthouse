"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BellIcon,
  Building2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LockKeyholeIcon,
  SlidersHorizontalIcon,
  UserRoundIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type SettingsTab = {
  value: string
  href: string
  labelKey:
    | "profileSettings"
    | "businessSettings"
    | "securitySettings"
    | "preferencesSettings"
    | "notificationSettings"
  icon: typeof UserRoundIcon
}

const settingsTabs: SettingsTab[] = [
  {
    value: "profile",
    href: "/settings/profile",
    labelKey: "profileSettings",
    icon: UserRoundIcon,
  },
  {
    value: "business",
    href: "/settings/business",
    labelKey: "businessSettings",
    icon: Building2Icon,
  },
  {
    value: "security",
    href: "/settings/security",
    labelKey: "securitySettings",
    icon: LockKeyholeIcon,
  },
  {
    value: "preferences",
    href: "/settings/preferences",
    labelKey: "preferencesSettings",
    icon: SlidersHorizontalIcon,
  },
  {
    value: "notifications",
    href: "/settings/notifications",
    labelKey: "notificationSettings",
    icon: BellIcon,
  },
]

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations()
  const tSettings = useTranslations("settingsPage")
  const activeTab =
    settingsTabs.find((tab) => pathname === tab.href)?.value ?? "profile"
  const isAtSettingsRoot = pathname === "/settings"

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold leading-tight">
          {tSettings("title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {tSettings("description")}
        </p>
      </section>

      {/* Mobile: back button for sub-sections */}
      {!isAtSettingsRoot ? (
        <button
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground lg:hidden"
          onClick={() => router.push("/settings")}
          type="button"
        >
          <ChevronLeftIcon className="size-4" />
          {tSettings("title")}
        </button>
      ) : null}

      {/* Mobile: section navigation list — only at /settings root */}
      {isAtSettingsRoot ? (
        <div className="flex flex-col overflow-hidden rounded-xl border lg:hidden">
          {settingsTabs.map((tab, index) => {
            const Icon = tab.icon

            return (
              <Link
                className={cn(
                  "flex items-center gap-3 bg-card px-4 py-3.5 text-sm transition-colors hover:bg-muted/50 active:bg-muted/80",
                  index > 0 && "border-t",
                )}
                href={tab.href}
                key={tab.value}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                  <Icon className="size-4" />
                </div>
                <span className="flex-1 font-medium">{t(tab.labelKey)}</span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            )
          })}
        </div>
      ) : null}

      {/* Tabs layout — TabsList hidden on mobile, vertical sidebar on desktop */}
      <Tabs
        className="gap-5 lg:flex-row"
        orientation="vertical"
        value={activeTab}
        onValueChange={(value) => {
          const tab = settingsTabs.find((item) => item.value === value)

          if (tab) {
            router.push(tab.href)
          }
        }}
      >
        <TabsList
          aria-label={tSettings("navigation")}
          className="hidden justify-start lg:flex lg:w-64 lg:shrink-0"
          variant="line"
        >
          {settingsTabs.map((tab) => {
            const Icon = tab.icon

            return (
              <TabsTrigger
                className="min-h-10 px-3"
                key={tab.value}
                value={tab.value}
              >
                <Icon data-icon="inline-start" />
                {t(tab.labelKey)}
              </TabsTrigger>
            )
          })}
        </TabsList>
        <Separator className="hidden lg:block" orientation="vertical" />
        <TabsContent
          className={cn("min-w-0", isAtSettingsRoot && "hidden lg:block")}
          value={activeTab}
        >
          {children}
        </TabsContent>
      </Tabs>
    </div>
  )
}
