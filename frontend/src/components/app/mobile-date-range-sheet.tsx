"use client"

import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface MobileDateRangeSheetProps {
  startDate: string
  endDate: string
  onApply: (startDate: string, endDate: string) => void
  onClear: () => void
  triggerClassName?: string
}

export function MobileDateRangeSheet({
  startDate,
  endDate,
  onApply,
  onClear,
  triggerClassName,
}: MobileDateRangeSheetProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [localStart, setLocalStart] = useState(startDate)
  const [localEnd, setLocalEnd] = useState(endDate)

  const hasActiveDates = Boolean(startDate || endDate)

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      setLocalStart(startDate)
      setLocalEnd(endDate)
    }
    setOpen(isOpen)
  }

  function handleApply() {
    onApply(localStart, localEnd)
    setOpen(false)
  }

  function handleClear() {
    setLocalStart("")
    setLocalEnd("")
    onClear()
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger
        render={
          <Button
            className={cn("relative gap-1.5", triggerClassName)}
            size="sm"
            type="button"
            variant="outline"
          />
        }
      >
        <CalendarIcon className="size-4" />
        {hasActiveDates ? (
          <Badge
            className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px]"
            variant="default"
          >
            {(startDate ? 1 : 0) + (endDate ? 1 : 0)}
          </Badge>
        ) : null}
      </SheetTrigger>
      <SheetContent
        className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-xl"
        showCloseButton={false}
        side="bottom"
      >
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-left">{t("dateRange")}</SheetTitle>
        </SheetHeader>
        <div className="px-4 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium leading-none">{t("startDate")}</p>
              <Input
                type="date"
                value={localStart}
                onChange={(e) => setLocalStart(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium leading-none">{t("endDate")}</p>
              <Input
                type="date"
                value={localEnd}
                onChange={(e) => setLocalEnd(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 border-t bg-popover px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleApply}
              type="button"
            >
              {t("applyFilters")}
            </Button>
            <Button
              className="flex-1"
              onClick={handleClear}
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
