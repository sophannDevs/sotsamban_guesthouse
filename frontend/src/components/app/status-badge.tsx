import type * as React from "react"

import { Badge } from "@/components/ui/badge"
import { type StatusTone } from "@/lib/mock-data"

type StatusBadgeProps = {
  tone?: StatusTone
  children: React.ReactNode
}

export function StatusBadge({ tone = "neutral", children }: StatusBadgeProps) {
  const variant = {
    success: "default",
    warning: "secondary",
    info: "outline",
    neutral: "secondary",
    danger: "destructive",
  }[tone] as React.ComponentProps<typeof Badge>["variant"]

  return <Badge variant={variant}>{children}</Badge>
}
