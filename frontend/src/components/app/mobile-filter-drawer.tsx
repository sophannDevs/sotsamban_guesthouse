"use client"

import { useState } from "react"
import { SlidersHorizontalIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetTrigger
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
      </BottomSheetTrigger>

      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle>{t("filters")}</BottomSheetTitle>
        </BottomSheetHeader>

        <BottomSheetBody>{children}</BottomSheetBody>

        <BottomSheetFooter>
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
          <BottomSheetClose
            render={
              <Button
                className="flex-1"
                onClick={onClear}
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
