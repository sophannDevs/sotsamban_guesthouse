"use client"

import {
  Building2Icon,
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
} from "lucide-react"

import { useActiveBusiness } from "@/components/app/business-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function BusinessSwitcher() {
  const { activeBusiness, businesses, isLoading, isSwitching, switchBusiness } =
    useActiveBusiness()

  const isDisabled = isLoading || isSwitching

  if (isLoading && !activeBusiness) {
    return (
      <Button disabled variant="outline">
        <Loader2Icon className="animate-spin" />
        <span className="hidden sm:inline">Loading…</span>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isDisabled}
        render={
          <Button
            className="max-w-[200px] gap-1.5 overflow-hidden"
            variant="outline"
          />
        }
      >
        {isSwitching ? (
          <Loader2Icon className="shrink-0 animate-spin" />
        ) : (
          <Building2Icon className="shrink-0" />
        )}
        <span className="hidden truncate text-sm sm:inline">
          {activeBusiness?.businessName ?? "Select Business"}
        </span>
        <ChevronDownIcon className="ml-auto hidden shrink-0 opacity-50 sm:block" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Your Businesses</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {businesses.length === 0 ? (
            <DropdownMenuItem disabled>No businesses found</DropdownMenuItem>
          ) : (
            businesses.map((biz) => {
              const isActive = activeBusiness?.businessId === biz.id

              return (
                <DropdownMenuItem
                  disabled={isDisabled}
                  key={biz.id}
                  onClick={() => {
                    if (!isActive) void switchBusiness(biz.id)
                  }}
                >
                  <CheckIcon
                    className={cn("shrink-0", !isActive && "invisible")}
                  />
                  <span className="truncate">{biz.name}</span>
                  <Badge className="ml-auto shrink-0 capitalize" variant="outline">
                    {biz.type.toLowerCase()}
                  </Badge>
                </DropdownMenuItem>
              )
            })
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
