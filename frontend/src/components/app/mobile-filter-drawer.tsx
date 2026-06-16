"use client"

import { useState } from "react"
import { SlidersHorizontalIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface MobileFilterDrawerProps {
  activeCount?: number
  onApply?: () => void
  onClear: () => void
  children: React.ReactNode
  triggerClassName?: string
}

export function MobileFilterDrawer({
  activeCount = 0,
  onApply,
  onClear,
  children,
  triggerClassName,
}: MobileFilterDrawerProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            className={cn("gap-1.5", triggerClassName)}
            size="sm"
            type="button"
            variant="outline"
          />
        }
      >
        <SlidersHorizontalIcon className="size-4" />
        {t("filters")}
        {activeCount > 0 ? (
          <Badge
            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px]"
            variant="default"
          >
            {activeCount}
          </Badge>
        ) : null}
      </SheetTrigger>
      <SheetContent
        className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-xl"
        showCloseButton={false}
        side="bottom"
      >
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-left">{t("filters")}</SheetTitle>
        </SheetHeader>
        <div className="px-4 py-4">
          <div className="flex flex-col gap-4">{children}</div>
        </div>
        <div className="sticky bottom-0 border-t bg-popover px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                onApply?.()
                setOpen(false)
              }}
              type="button"
            >
              {t("applyFilters")}
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                onClear()
                setOpen(false)
              }}
              type="button"
              variant="outline"
            >
              {t("clearFilters")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
