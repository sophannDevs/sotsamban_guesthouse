"use client"

import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from "@/components/app/bottom-sheet"
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
    <BottomSheet open={open} onOpenChange={handleOpen}>
      <BottomSheetTrigger
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
      </BottomSheetTrigger>

      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle>{t("dateRange")}</BottomSheetTitle>
        </BottomSheetHeader>

        <BottomSheetBody>
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
        </BottomSheetBody>

        <BottomSheetFooter>
          <Button className="flex-1" onClick={handleApply} type="button">
            {t("applyFilters")}
          </Button>
          <BottomSheetClose
            render={
              <Button
                className="flex-1"
                onClick={handleClear}
                type="button"
                variant="outline"
              />
            }
          >
            {t("clearFilters")}
          </BottomSheetClose>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  )
}
