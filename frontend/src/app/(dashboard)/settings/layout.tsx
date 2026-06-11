"use client"

import type { ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  BellIcon,
  Building2Icon,
  LockKeyholeIcon,
  SlidersHorizontalIcon,
  UserRoundIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

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
          className="w-full justify-start overflow-x-auto lg:w-64 lg:shrink-0"
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
        <TabsContent className="min-w-0" value={activeTab}>
          {children}
        </TabsContent>
      </Tabs>
    </div>
  )
}
