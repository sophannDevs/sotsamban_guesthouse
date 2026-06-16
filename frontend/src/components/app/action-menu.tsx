"use client"

import { MoreHorizontalIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type ActionMenuEntry = {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: "default" | "destructive"
  disabled?: boolean
}

interface ActionMenuProps {
  items: Array<ActionMenuEntry | false | null | undefined>
  triggerLabel?: string
}

export function ActionMenu({ items, triggerLabel }: ActionMenuProps) {
  const t = useTranslations()
  const validItems = items.filter((item): item is ActionMenuEntry => Boolean(item))
  if (!validItems.length) return null

  const regular = validItems.filter((item) => item.variant !== "destructive")
  const destructive = validItems.filter((item) => item.variant === "destructive")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={triggerLabel ?? t("actions")}
            size="icon-sm"
            type="button"
            variant="outline"
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {regular.length > 0 ? (
          <DropdownMenuGroup>
            {regular.map((item, i) => (
              <DropdownMenuItem
                disabled={item.disabled}
                key={i}
                onClick={item.onClick}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ) : null}
        {regular.length > 0 && destructive.length > 0 ? (
          <DropdownMenuSeparator />
        ) : null}
        {destructive.length > 0 ? (
          <DropdownMenuGroup>
            {destructive.map((item, i) => (
              <DropdownMenuItem
                disabled={item.disabled}
                key={i}
                onClick={item.onClick}
                variant="destructive"
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
