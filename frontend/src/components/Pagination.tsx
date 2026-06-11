"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const pageSizeOptions = [10, 20, 50, 100] as const
const visiblePageCount = 5

type PaginationProps = {
  page: number
  limit: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  className?: string
}

export function Pagination({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  onLimitChange,
  className,
}: PaginationProps) {
  const t = useTranslations("pagination")
  const safeTotalPages = Math.max(totalPages, 1)
  const safePage = clamp(page, 1, safeTotalPages)
  const pages = getVisiblePages(safePage, safeTotalPages)
  const startItem = total === 0 ? 0 : (safePage - 1) * limit + 1
  const endItem = Math.min(safePage * limit, total)
  const canGoPrevious = safePage > 1
  const canGoNext = safePage < safeTotalPages

  function updatePage(nextPage: number) {
    const normalizedPage = clamp(nextPage, 1, safeTotalPages)

    if (normalizedPage !== safePage) {
      onPageChange(normalizedPage)
    }
  }

  function updateLimit(nextLimit: string | null) {
    if (!nextLimit) {
      return
    }

    const parsedLimit = Number(nextLimit)

    if (
      pageSizeOptions.includes(parsedLimit as (typeof pageSizeOptions)[number])
    ) {
      onLimitChange(parsedLimit)
    }
  }

  return (
    <nav
      aria-label={t("tablePagination")}
      className={cn(
        "flex flex-col gap-3 border-t pt-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <p className="tabular-nums" aria-live="polite">
        {t("showing")} {startItem}-{endItem} {t("of")} {total}{" "}
        {t("results")}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap">{t("rowsPerPage")}</span>
          <Select value={String(limit)} onValueChange={updateLimit}>
            <SelectTrigger
              aria-label={t("rowsPerPage")}
              className="w-20"
              size="sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {pageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            aria-label={t("previous")}
            disabled={!canGoPrevious}
            onClick={() => updatePage(safePage - 1)}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <ChevronLeftIcon />
          </Button>

          <div className="flex items-center gap-1">
            {pages.map((pageNumber) => (
              <Button
                aria-current={pageNumber === safePage ? "page" : undefined}
                aria-label={`${t("page")} ${pageNumber}`}
                className="tabular-nums aria-current:border-primary aria-current:bg-primary aria-current:text-primary-foreground"
                key={pageNumber}
                onClick={() => updatePage(pageNumber)}
                size="icon-sm"
                type="button"
                variant={pageNumber === safePage ? "default" : "outline"}
              >
                {pageNumber}
              </Button>
            ))}
          </div>

          <Button
            aria-label={t("next")}
            disabled={!canGoNext}
            onClick={() => updatePage(safePage + 1)}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </nav>
  )
}

export default Pagination

function getVisiblePages(currentPage: number, totalPages: number) {
  const pageCount = Math.min(visiblePageCount, totalPages)
  const halfWindow = Math.floor(pageCount / 2)
  let startPage = currentPage - halfWindow
  let endPage = startPage + pageCount - 1

  if (startPage < 1) {
    startPage = 1
    endPage = pageCount
  }

  if (endPage > totalPages) {
    endPage = totalPages
    startPage = Math.max(1, endPage - pageCount + 1)
  }

  return Array.from(
    { length: endPage - startPage + 1 },
    (_, index) => startPage + index
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
