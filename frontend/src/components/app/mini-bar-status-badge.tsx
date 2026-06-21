"use client"

import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import type { MiniBarConsumptionStatus } from "@/lib/mini-bar-consumption"

export function MiniBarStatusBadge({ status }: { status: MiniBarConsumptionStatus }) {
  const t = useTranslations()

  const variant =
    status === "CHARGED"
      ? "default"
      : status === "DRAFT"
        ? "secondary"
        : status === "REFUNDED"
          ? "destructive"
          : "outline"

  const label =
    status === "CHARGED"
      ? t("miniBar.statusCharged")
      : status === "DRAFT"
        ? t("miniBar.statusDraft")
        : status === "REFUNDED"
          ? t("miniBar.statusRefunded")
          : t("miniBar.statusCancelled")

  return <Badge variant={variant}>{label}</Badge>
}
