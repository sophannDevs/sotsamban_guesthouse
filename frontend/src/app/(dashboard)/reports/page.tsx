"use client"

import { useCallback, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  CalendarIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PlayIcon,
  RefreshCwIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  formatPreferenceCurrency,
  formatPreferenceDate,
  formatPreferenceDateTime,
  formatPreferenceNumber,
  type SystemPreferences,
  useSystemPreferences,
} from "@/components/app/system-preferences-provider"
import { Pagination } from "@/components/Pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BookingStatus } from "@/lib/bookings"
import type { PaymentMethod, PaymentStatus } from "@/lib/payments"
import {
  getReportErrorMessage,
  getReportExportErrorMessage,
  reportService,
  type CombinedProfitLossReport,
  type RangePreset,
  type ReportExportFormat,
  type OccupancyReport,
  type ProfitLossReport,
  type ReportFilters,
  type ReportResultMap,
  type ReportTableRow,
  type ReportType,
  type RevenueReport,
} from "@/lib/reports"
import { defaultPaginationMeta, type PaginatedResponse } from "@/lib/api"
import { MobileFilterDrawer } from "@/components/app/mobile-filter-drawer"

type StatusFilter =
  | "ALL"
  | BookingStatus
  | PaymentStatus
  | PaymentMethod

type ReportColumn = {
  key: string
  header: string
}

type ReportDefinition = {
  label: string
  description: string
  columns: ReportColumn[]
  statusLabel: string
  statuses: Array<{
    value: StatusFilter
    label: string
  }>
}

type TranslationFn = ReturnType<typeof useTranslations>

// ---------------------------------------------------------------------------
// Date range helpers (pure, no backend call)
// ---------------------------------------------------------------------------

function getLocalDateString(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function calcPresetRange(preset: RangePreset): { startDate: string; endDate: string } | null {
  if (preset === "custom") return null

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (preset) {
    case "today": {
      const s = getLocalDateString(today)
      return { startDate: s, endDate: s }
    }
    case "yesterday": {
      const y = new Date(today)
      y.setDate(today.getDate() - 1)
      const s = getLocalDateString(y)
      return { startDate: s, endDate: s }
    }
    case "this_week": {
      const day = today.getDay() // 0=Sun
      const mon = new Date(today)
      mon.setDate(today.getDate() - ((day + 6) % 7))
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      return { startDate: getLocalDateString(mon), endDate: getLocalDateString(sun) }
    }
    case "last_week": {
      const day = today.getDay()
      const thisMon = new Date(today)
      thisMon.setDate(today.getDate() - ((day + 6) % 7))
      const lastMon = new Date(thisMon)
      lastMon.setDate(thisMon.getDate() - 7)
      const lastSun = new Date(lastMon)
      lastSun.setDate(lastMon.getDate() + 6)
      return { startDate: getLocalDateString(lastMon), endDate: getLocalDateString(lastSun) }
    }
    case "this_month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      return { startDate: getLocalDateString(start), endDate: getLocalDateString(end) }
    }
    case "last_month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0)
      return { startDate: getLocalDateString(start), endDate: getLocalDateString(end) }
    }
    case "last_3_months": {
      const start = new Date(today.getFullYear(), today.getMonth() - 2, 1)
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      return { startDate: getLocalDateString(start), endDate: getLocalDateString(end) }
    }
    case "last_6_months": {
      const start = new Date(today.getFullYear(), today.getMonth() - 5, 1)
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      return { startDate: getLocalDateString(start), endDate: getLocalDateString(end) }
    }
    case "this_year": {
      const start = new Date(today.getFullYear(), 0, 1)
      const end = new Date(today.getFullYear(), 11, 31)
      return { startDate: getLocalDateString(start), endDate: getLocalDateString(end) }
    }
  }
}

function formatRangeLabel(isoDate: string) {
  try {
    // Parse yyyy-mm-dd as local date to avoid UTC shift
    const [y, m, d] = isoDate.split("-").map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return isoDate
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const t = useTranslations()
  const { preferences } = useSystemPreferences()
  const [reportType, setReportType] = useState<ReportType>("revenue")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")

  // Preset state (defaults to "this_month")
  const [rangePreset, setRangePreset] = useState<RangePreset>("this_month")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const [roomId, setRoomId] = useState("")
  const [guestId, setGuestId] = useState("")
  const [search, setSearch] = useState("")
  const [reportData, setReportData] =
    useState<ReportResultMap[ReportType] | null>(null)
  const [paginationMeta, setPaginationMeta] =
    useState<PaginatedResponse<ReportTableRow>["meta"]>(defaultPaginationMeta)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [exportingFormat, setExportingFormat] =
    useState<ReportExportFormat | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [exportErrorMessage, setExportErrorMessage] = useState<string | null>(
    null
  )

  const isCustomPreset = rangePreset === "custom"

  // Calculated dates for non-custom presets
  const presetRange = useMemo(
    () => calcPresetRange(rangePreset),
    [rangePreset]
  )

  const reportDefinitions = useMemo(() => getReportDefinitions(t), [t])
  const activeReport = reportDefinitions[reportType]
  const reportOptions = useMemo(
    () =>
      Object.entries(reportDefinitions).map(([value, report]) => ({
        value: value as ReportType,
        label: report.label,
      })),
    [reportDefinitions]
  )
  const previewRows = useMemo(
    () =>
      reportData
        ? normalizeReportRows(reportType, reportData, t, preferences)
        : [],
    [preferences, reportData, reportType, t]
  )

  const filters = useMemo(
    () =>
      buildFilters({
        endDate: isCustomPreset ? endDate : (presetRange?.endDate ?? ""),
        guestId,
        reportType,
        roomId,
        search,
        startDate: isCustomPreset ? startDate : (presetRange?.startDate ?? ""),
        statusFilter,
        rangePreset,
      }),
    [endDate, guestId, isCustomPreset, presetRange, rangePreset, reportType, roomId, search, startDate, statusFilter]
  )

  const loadReport = useCallback(async (nextPage = page, nextLimit = limit) => {
    setIsLoading(true)
    setErrorMessage(null)
    setExportErrorMessage(null)

    try {
      if (
        reportType === "bookings" ||
        reportType === "payments" ||
        reportType === "guests"
      ) {
        const data = await reportService.getPaginatedReport(reportType, {
          ...filters,
          page: nextPage,
          limit: nextLimit,
        })

        setPaginationMeta(data.meta)
        setReportData(data.data as ReportResultMap[ReportType])
      } else {
        const data = await reportService.getReport(reportType, filters)

        setPaginationMeta(defaultPaginationMeta)
        setReportData(data)
      }
      setGeneratedAt(new Date())
    } catch (error) {
      setErrorMessage(getReportErrorMessage(error))
      setReportData(null)
    } finally {
      setIsLoading(false)
    }
  }, [filters, limit, page, reportType])

  const exportReport = useCallback(
    async (format: ReportExportFormat) => {
      setExportingFormat(format)
      setExportErrorMessage(null)

      try {
        const blob = await reportService.downloadReport(
          reportType,
          format,
          filters
        )
        downloadBlob(blob, `${reportType}-report.${format === "excel" ? "xlsx" : "pdf"}`)
      } catch (error) {
        setExportErrorMessage(await getReportExportErrorMessage(error))
      } finally {
        setExportingFormat(null)
      }
    },
    [filters, reportType]
  )

  function handleReportTypeChange(value: ReportType | null) {
    if (!value) {
      return
    }

    setReportType(value as ReportType)
    setStatusFilter("ALL")
    setPage(1)
    setReportData(null)
    setGeneratedAt(null)
    setErrorMessage(null)
    setExportErrorMessage(null)
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-semibold leading-tight">
            {t("reportsPageTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("reportsPageDescription")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MobileFilterDrawer
            activeCount={
              (rangePreset !== "this_month" ? 1 : 0) +
              (statusFilter !== "ALL" ? 1 : 0) +
              (roomId ? 1 : 0) +
              (guestId ? 1 : 0) +
              (search ? 1 : 0)
            }
            onApply={() => {
              setPage(1)
              void loadReport(1, limit)
            }}
            onClear={() => {
              setRangePreset("this_month")
              setStartDate("")
              setEndDate("")
              setStatusFilter("ALL")
              setRoomId("")
              setGuestId("")
              setSearch("")
              setPage(1)
              setReportData(null)
              setGeneratedAt(null)
            }}
            triggerClassName="sm:hidden"
          >
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium leading-none">{t("dateRangePreset")}</p>
              <Select
                items={getRangePresetOptions(t)}
                value={rangePreset}
                onValueChange={(value) => {
                  if (value) {
                    setRangePreset(value as RangePreset)
                    setPage(1)
                  }
                }}
              >
                <SelectTrigger>
                  <CalendarIcon className="mr-1 h-4 w-4 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {getRangePresetOptions(t).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {isCustomPreset ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium leading-none">{t("startDate")}</p>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium leading-none">{t("endDate")}</p>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                  />
                </div>
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium leading-none">{t("reportType")}</p>
              <Select
                items={reportOptions}
                value={reportType}
                onValueChange={handleReportTypeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {reportOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium leading-none">{activeReport.statusLabel}</p>
              <Select
                items={activeReport.statuses}
                value={statusFilter}
                onValueChange={(value) => {
                  if (value) {
                    setStatusFilter(value as StatusFilter)
                    setPage(1)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {activeReport.statuses.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {reportType === "bookings" ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium leading-none">{t("roomId")}</p>
                  <Input
                    placeholder={t("optionalRoomId")}
                    value={roomId}
                    onChange={(e) => { setRoomId(e.target.value); setPage(1) }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium leading-none">{t("guestId")}</p>
                  <Input
                    placeholder={t("optionalGuestId")}
                    value={guestId}
                    onChange={(e) => { setGuestId(e.target.value); setPage(1) }}
                  />
                </div>
              </>
            ) : null}
            {reportType === "guests" ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-none">{t("search")}</p>
                <Input
                  placeholder={t("searchGuestPlaceholder")}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                />
              </div>
            ) : null}
          </MobileFilterDrawer>
          <Badge className="sm:flex" variant="secondary">{t("liveApi")}</Badge>
        </div>
        <Button
          className="w-full sm:hidden"
          disabled={isLoading}
          onClick={() => { setPage(1); void loadReport(1, limit) }}
          type="button"
        >
          {isLoading ? (
            <RefreshCwIcon data-icon="inline-start" />
          ) : (
            <PlayIcon data-icon="inline-start" />
          )}
          {t("generateReport")}
        </Button>
      </section>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("couldNotLoadReport")}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {exportErrorMessage ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("couldNotExportReport")}</AlertTitle>
          <AlertDescription>{exportErrorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="hidden sm:block">
      <Card>
        <CardHeader>
          <CardTitle>{t("reportFilters")}</CardTitle>
          <CardDescription>
            {t("reportFiltersDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Date Range Preset – full-width row above the grid */}
          <div className="mb-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="rangePreset">{t("dateRangePreset")}</FieldLabel>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    items={getRangePresetOptions(t)}
                    onValueChange={(value) => {
                      if (value) {
                        setRangePreset(value as RangePreset)
                        setPage(1)
                      }
                    }}
                    value={rangePreset}
                  >
                    <SelectTrigger className="w-full sm:w-64" id="rangePreset">
                      <CalendarIcon className="mr-1 h-4 w-4 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {getRangePresetOptions(t).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  {/* Calculated date range label for non-custom presets */}
                  {!isCustomPreset && presetRange ? (
                    <span className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-3 py-1.5 text-sm font-medium text-foreground">
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {t("dateRangeLabel", {
                        start: formatRangeLabel(presetRange.startDate),
                        end: formatRangeLabel(presetRange.endDate),
                      })}
                    </span>
                  ) : null}
                </div>
              </Field>
            </FieldGroup>

            {/* Custom date inputs – only visible when "Custom Range" is selected */}
            {isCustomPreset ? (
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="startDate">{t("startDate")}</FieldLabel>
                  <Input
                    id="startDate"
                    onChange={(event) => {
                      setStartDate(event.target.value)
                      setPage(1)
                    }}
                    type="date"
                    value={startDate}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="endDate">{t("endDate")}</FieldLabel>
                  <Input
                    id="endDate"
                    onChange={(event) => {
                      setEndDate(event.target.value)
                      setPage(1)
                    }}
                    type="date"
                    value={endDate}
                  />
                </Field>
              </div>
            ) : null}
          </div>

          <FieldGroup className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field>
              <FieldLabel htmlFor="reportType">{t("reportType")}</FieldLabel>
              <Select
                items={reportOptions}
                onValueChange={handleReportTypeChange}
                value={reportType}
              >
                <SelectTrigger className="w-full" id="reportType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {reportOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="statusFilter">
                {activeReport.statusLabel}
              </FieldLabel>
              <Select
                items={activeReport.statuses}
                onValueChange={(value) => {
                  if (value) {
                    setStatusFilter(value as StatusFilter)
                    setPage(1)
                  }
                }}
                value={statusFilter}
              >
                <SelectTrigger className="w-full" id="statusFilter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {activeReport.statuses.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="roomId">{t("roomId")}</FieldLabel>
              <Input
                disabled={reportType !== "bookings"}
                id="roomId"
                onChange={(event) => {
                  setRoomId(event.target.value)
                  setPage(1)
                }}
                placeholder={t("optionalRoomId")}
                value={roomId}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="guestId">{t("guestId")}</FieldLabel>
              <Input
                disabled={reportType !== "bookings"}
                id="guestId"
                onChange={(event) => {
                  setGuestId(event.target.value)
                  setPage(1)
                }}
                placeholder={t("optionalGuestId")}
                value={guestId}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="search">{t("search")}</FieldLabel>
              <Input
                disabled={reportType !== "guests"}
                id="search"
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder={t("searchGuestPlaceholder")}
                value={search}
              />
            </Field>

            <Field className="justify-end">
              <FieldLabel className="sr-only">{t("actions")}</FieldLabel>
              <Button
                disabled={isLoading}
                onClick={() => {
                  setPage(1)
                  void loadReport(1, limit)
                }}
                type="button"
              >
                {isLoading ? (
                  <RefreshCwIcon data-icon="inline-start" />
                ) : (
                  <PlayIcon data-icon="inline-start" />
                )}
                {t("generateReport")}
              </Button>
            </Field>
          </FieldGroup>
        </CardContent>

      </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>
              {activeReport.label} {t("preview")}
            </CardTitle>
            <CardDescription>{activeReport.description}</CardDescription>
          </div>
          <CardAction className="flex flex-col gap-2 sm:flex-row">
            <Button
              disabled={Boolean(exportingFormat)}
              onClick={() => void exportReport("excel")}
              type="button"
              variant="outline"
            >
              {exportingFormat === "excel" ? (
                <RefreshCwIcon data-icon="inline-start" />
              ) : (
                <FileSpreadsheetIcon data-icon="inline-start" />
              )}
              {exportingFormat === "excel" ? t("exporting") : t("exportExcel")}
            </Button>
            <Button
              disabled={Boolean(exportingFormat)}
              onClick={() => void exportReport("pdf")}
              type="button"
              variant="outline"
            >
              {exportingFormat === "pdf" ? (
                <RefreshCwIcon data-icon="inline-start" />
              ) : (
                <FileTextIcon data-icon="inline-start" />
              )}
              {exportingFormat === "pdf" ? t("exporting") : t("exportPdf")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">{t("previewFilters")}</p>
              <p className="text-muted-foreground">
                {formatFilterSummary(filters, t)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{activeReport.label}</Badge>
              {generatedAt ? (
                <Badge variant="outline">
                  {t("generatedAt", {
                    time: formatPreferenceDateTime(generatedAt, preferences),
                  })}
                </Badge>
              ) : null}
            </div>
          </div>

          {/* Mobile card list */}
          <div className="flex flex-col divide-y rounded-lg border sm:hidden">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("loadingReportData")}
              </p>
            ) : previewRows.length > 0 ? (
              previewRows.map((row, rowIndex) => (
                <div className="flex flex-col gap-1.5 p-3 first:rounded-t-lg last:rounded-b-lg" key={`${reportType}-${rowIndex}`}>
                  {activeReport.columns.map((column, colIndex) => (
                    <div className={colIndex === 0 ? "font-medium" : "flex items-center justify-between gap-2 text-sm"} key={column.key}>
                      {colIndex === 0 ? (
                        <span>{formatCellValue(row[column.key])}</span>
                      ) : (
                        <>
                          <span className="text-muted-foreground">{column.header}</span>
                          <span className="text-right">{formatCellValue(row[column.key])}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {reportData ? t("noReportRows") : t("generateReportPreview")}
              </p>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border sm:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {activeReport.columns.map((column) => (
                      <TableHead key={column.key}>{column.header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        className="h-24 text-center text-muted-foreground"
                        colSpan={activeReport.columns.length}
                      >
                        {t("loadingReportData")}
                      </TableCell>
                    </TableRow>
                  ) : previewRows.length > 0 ? (
                    previewRows.map((row, rowIndex) => (
                      <TableRow key={`${reportType}-${rowIndex}`}>
                        {activeReport.columns.map((column) => (
                          <TableCell key={column.key}>
                            {formatCellValue(row[column.key])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        className="h-24 text-center text-muted-foreground"
                        colSpan={activeReport.columns.length}
                      >
                        {reportData
                          ? t("noReportRows")
                          : t("generateReportPreview")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          {reportType === "bookings" ||
          reportType === "payments" ||
          reportType === "guests" ? (
            <Pagination
              limit={paginationMeta.limit}
              page={paginationMeta.page}
              total={paginationMeta.total}
              totalPages={paginationMeta.totalPages}
              onLimitChange={(nextLimit) => {
                setLimit(nextLimit)
                setPage(1)
                if (reportData) {
                  void loadReport(1, nextLimit)
                }
              }}
              onPageChange={(nextPage) => {
                setPage(nextPage)
                void loadReport(nextPage, limit)
              }}
            />
          ) : null}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <DownloadIcon />
            <span>{t("exportsUseCurrentFilters")}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

function getReportDefinitions(t: TranslationFn): Record<ReportType, ReportDefinition> {
  return {
    revenue: {
      label: t("revenueReport"),
      description: t("revenueReportDescription"),
      statusLabel: t("paymentStatus"),
      statuses: [
        { value: "ALL", label: t("allStatuses") },
        { value: "PAID", label: t("paid") },
        { value: "PENDING", label: t("pending") },
      ],
      columns: [
        { key: "metric", header: t("metric") },
        { key: "value", header: t("value") },
      ],
    },
    bookings: {
      label: t("bookingReport"),
      description: t("bookingReportDescription"),
      statusLabel: t("bookingStatus"),
      statuses: [
        { value: "ALL", label: t("allStatuses") },
        { value: "PENDING", label: t("pending") },
        { value: "CONFIRMED", label: t("confirmed") },
        { value: "CHECKED_IN", label: t("checkedIn") },
        { value: "CHECKED_OUT", label: t("checkedOut") },
        { value: "CANCELLED", label: t("cancelled") },
      ],
      columns: [
        { key: "bookingId", header: t("bookingId") },
        { key: "guestName", header: t("guest") },
        { key: "roomNumber", header: t("room") },
        { key: "checkInDate", header: t("checkIn") },
        { key: "checkOutDate", header: t("checkOut") },
        { key: "totalPrice", header: t("total") },
        { key: "bookingStatus", header: t("status") },
      ],
    },
    payments: {
      label: t("paymentReport"),
      description: t("paymentReportDescription"),
      statusLabel: t("paymentStatus"),
      statuses: [
        { value: "ALL", label: t("allStatuses") },
        { value: "PENDING", label: t("pending") },
        { value: "PAID", label: t("paid") },
        { value: "FAILED", label: t("failed") },
        { value: "REFUNDED", label: t("refunded") },
        { value: "CASH", label: t("cash") },
        { value: "CARD", label: t("card") },
        { value: "QR", label: t("qr") },
      ],
      columns: [
        { key: "paymentId", header: t("paymentId") },
        { key: "bookingId", header: t("bookingId") },
        { key: "guestName", header: t("guest") },
        { key: "roomNumber", header: t("room") },
        { key: "amount", header: t("amount") },
        { key: "method", header: t("method") },
        { key: "status", header: t("status") },
        { key: "paidAt", header: t("paidAt") },
      ],
    },
    guests: {
      label: t("guestReport"),
      description: t("guestReportDescription"),
      statusLabel: t("status"),
      statuses: [{ value: "ALL", label: t("allGuests") }],
      columns: [
        { key: "guestId", header: t("guestId") },
        { key: "fullName", header: t("fullName") },
        { key: "phone", header: t("phone") },
        { key: "email", header: t("email") },
        { key: "totalBookings", header: t("totalBookings") },
        { key: "totalSpent", header: t("totalSpent") },
      ],
    },
    occupancy: {
      label: t("occupancyReport"),
      description: t("occupancyReportDescription"),
      statusLabel: t("status"),
      statuses: [{ value: "ALL", label: t("allRooms") }],
      columns: [
        { key: "totalRooms", header: t("totalRooms") },
        { key: "availableRooms", header: t("availableRooms") },
        { key: "bookedRooms", header: t("bookedRooms") },
        { key: "occupiedRooms", header: t("occupiedRooms") },
        { key: "maintenanceRooms", header: t("maintenanceRooms") },
        { key: "occupancyRate", header: t("occupancyRate") },
      ],
    },
    profit_loss: {
      label: t("profitLossReport"),
      description: t("profitLossReportDescription"),
      statusLabel: t("status"),
      statuses: [{ value: "ALL", label: t("allStatuses") }],
      columns: [
        { key: "metric", header: t("metric") },
        { key: "value", header: t("value") },
      ],
    },
    combined_profit_loss: {
      label: t("combinedProfitLossReport"),
      description: t("combinedProfitLossReportDescription"),
      statusLabel: t("status"),
      statuses: [{ value: "ALL", label: t("allStatuses") }],
      columns: [
        { key: "businessName", header: t("business") },
        { key: "businessType", header: t("businessTypeLabel") },
        { key: "revenue", header: t("revenue") },
        { key: "expense", header: t("expense") },
        { key: "netProfit", header: t("netProfitLoss") },
      ],
    },
  }
}

function buildFilters({
  endDate,
  guestId,
  rangePreset,
  reportType,
  roomId,
  search,
  startDate,
  statusFilter,
}: {
  endDate: string
  guestId: string
  rangePreset: RangePreset
  reportType: ReportType
  roomId: string
  search: string
  startDate: string
  statusFilter: StatusFilter
}) {
  const filters: ReportFilters = {}

  // Always send the preset so the backend can apply its own calculation
  filters.rangePreset = rangePreset

  if (reportType !== "occupancy") {
    filters.startDate = startDate || undefined
    filters.endDate = endDate || undefined
  }

  if (reportType === "bookings") {
    filters.roomId = roomId.trim() || undefined
    filters.guestId = guestId.trim() || undefined

    if (isBookingStatus(statusFilter)) {
      filters.status = statusFilter
    }
  }

  if (reportType === "payments") {
    if (isPaymentStatus(statusFilter)) {
      filters.paymentStatus = statusFilter
    }

    if (isPaymentMethod(statusFilter)) {
      filters.method = statusFilter
    }
  }

  if (reportType === "guests") {
    filters.search = search.trim() || undefined
  }

  return filters
}

function getRangePresetOptions(t: TranslationFn) {
  return [
    { value: "today" as RangePreset, label: t("presetToday") },
    { value: "yesterday" as RangePreset, label: t("presetYesterday") },
    { value: "this_week" as RangePreset, label: t("presetThisWeek") },
    { value: "last_week" as RangePreset, label: t("presetLastWeek") },
    { value: "this_month" as RangePreset, label: t("presetThisMonth") },
    { value: "last_month" as RangePreset, label: t("presetLastMonth") },
    { value: "last_3_months" as RangePreset, label: t("presetLast3Months") },
    { value: "last_6_months" as RangePreset, label: t("presetLast6Months") },
    { value: "this_year" as RangePreset, label: t("presetThisYear") },
    { value: "custom" as RangePreset, label: t("presetCustomRange") },
  ]
}


function normalizeReportRows(
  reportType: ReportType,
  reportData: ReportResultMap[ReportType],
  t: TranslationFn,
  preferences: SystemPreferences
): ReportTableRow[] {
  if (reportType === "revenue") {
    const report = reportData as RevenueReport

    return [
      {
        metric: t("totalRevenue"),
        value: formatCurrency(report.totalRevenue, preferences),
      },
      {
        metric: t("paidRevenue"),
        value: formatCurrency(report.paidRevenue, preferences),
      },
      {
        metric: t("pendingRevenue"),
        value: formatCurrency(report.pendingRevenue, preferences),
      },
      ...report.revenueByDate.map((row) => ({
        metric: t("revenueOnDate", {
          date: formatDate(row.date, preferences),
        }),
        value: formatCurrency(row.revenue, preferences),
      })),
      ...report.revenueByPaymentMethod.map((row) => ({
        metric: t("revenueByMethod", {
          method: getPaymentMethodLabel(row.method, t),
        }),
        value: formatCurrency(row.revenue, preferences),
      })),
    ]
  }

  if (reportType === "occupancy") {
    const report = reportData as OccupancyReport

    return [
      {
        ...report,
        occupancyRate: `${formatNumber(report.occupancyRate, preferences)}%`,
      },
    ]
  }

  if (reportType === "bookings") {
    return (reportData as ReportTableRow[]).map((row) => ({
      ...row,
      checkInDate: formatDate(row.checkInDate, preferences),
      checkOutDate: formatDate(row.checkOutDate, preferences),
      totalPrice: formatCurrency(Number(row.totalPrice), preferences),
      bookingStatus: isBookingStatusValue(row.bookingStatus)
        ? getBookingStatusLabel(row.bookingStatus, t)
        : row.bookingStatus,
    }))
  }

  if (reportType === "payments") {
    return (reportData as ReportTableRow[]).map((row) => ({
      ...row,
      amount: formatCurrency(Number(row.amount), preferences),
      method: isPaymentMethodValue(row.method)
        ? getPaymentMethodLabel(row.method, t)
        : row.method,
      status: isPaymentStatusValue(row.status)
        ? getPaymentStatusLabel(row.status, t)
        : row.status,
      paidAt: formatDateTime(row.paidAt, preferences),
    }))
  }

  if (reportType === "profit_loss") {
    const report = reportData as ProfitLossReport
    const isLoss = report.netProfit < 0

    return [
      {
        metric: t("totalRevenue"),
        value: formatCurrency(report.totalRevenue, preferences),
      },
      {
        metric: t("totalExpense"),
        value: formatCurrency(report.totalExpense, preferences),
      },
      {
        metric: isLoss ? t("netLoss") : t("netProfit"),
        value: formatCurrency(Math.abs(report.netProfit), preferences),
      },
      ...report.revenueByDate.map((row) => ({
        metric: t("revenueOnDate", { date: formatDate(row.date, preferences) }),
        value: formatCurrency(row.revenue, preferences),
      })),
      ...report.expenseByDate.map((row) => ({
        metric: t("expenseOnDate", {
          date: formatDate(row.date, preferences),
        }),
        value: formatCurrency(row.expense, preferences),
      })),
      ...report.expenseByCategory.map((row) => ({
        metric: t("expenseForCategory", { category: row.category }),
        value: formatCurrency(row.amount, preferences),
      })),
    ]
  }

  if (reportType === "combined_profit_loss") {
    const report = reportData as CombinedProfitLossReport
    const isLoss = report.netProfit < 0

    return [
      {
        businessName: t("allBusinessesTotal"),
        businessType: "—",
        revenue: formatCurrency(report.totalRevenue, preferences),
        expense: formatCurrency(report.totalExpense, preferences),
        netProfit: `${isLoss ? "−" : "+"}${formatCurrency(Math.abs(report.netProfit), preferences)}`,
      },
      ...report.businessBreakdown.map((b) => {
        const bLoss = b.netProfit < 0
        return {
          businessName: b.businessName,
          businessType: b.businessType === "STORE" ? "Store" : "Guesthouse",
          revenue: formatCurrency(b.revenue, preferences),
          expense: formatCurrency(b.expense, preferences),
          netProfit: `${bLoss ? "−" : "+"}${formatCurrency(Math.abs(b.netProfit), preferences)}`,
        }
      }),
    ]
  }

  return (reportData as ReportTableRow[]).map((row) => ({
    ...row,
    totalSpent: formatCurrency(Number(row.totalSpent), preferences),
  }))
}

function isBookingStatus(value: StatusFilter): value is BookingStatus {
  return [
    "PENDING",
    "CONFIRMED",
    "CHECKED_IN",
    "CHECKED_OUT",
    "CANCELLED",
  ].includes(value)
}

function isBookingStatusValue(value: unknown): value is BookingStatus {
  return typeof value === "string" && isBookingStatus(value as StatusFilter)
}

function isPaymentStatus(value: StatusFilter): value is PaymentStatus {
  return ["PENDING", "PAID", "FAILED", "REFUNDED"].includes(value)
}

function isPaymentStatusValue(value: unknown): value is PaymentStatus {
  return typeof value === "string" && isPaymentStatus(value as StatusFilter)
}

function isPaymentMethod(value: StatusFilter): value is PaymentMethod {
  return ["CASH", "CARD", "QR"].includes(value)
}

function isPaymentMethodValue(value: unknown): value is PaymentMethod {
  return typeof value === "string" && isPaymentMethod(value as StatusFilter)
}

function getBookingStatusLabel(status: BookingStatus, t: TranslationFn) {
  const labels: Record<BookingStatus, string> = {
    PENDING: t("pending"),
    CONFIRMED: t("confirmed"),
    CHECKED_IN: t("checkedIn"),
    CHECKED_OUT: t("checkedOut"),
    CANCELLED: t("cancelled"),
  }

  return labels[status]
}

function getPaymentStatusLabel(status: PaymentStatus, t: TranslationFn) {
  const labels: Record<PaymentStatus, string> = {
    PENDING: t("pending"),
    PAID: t("paid"),
    FAILED: t("failed"),
    REFUNDED: t("refunded"),
  }

  return labels[status]
}

function getPaymentMethodLabel(method: PaymentMethod, t: TranslationFn) {
  const labels: Record<PaymentMethod, string> = {
    CASH: t("cash"),
    CARD: t("card"),
    QR: t("qr"),
  }

  return labels[method]
}

function formatCellValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "-" : value
}

function formatFilterSummary(filters: ReportFilters, t: TranslationFn) {
  const entries = Object.entries(filters).filter(([, value]) => Boolean(value))

  if (entries.length === 0) {
    return t("noFiltersApplied")
  }

  return entries
    .map(([key, value]) => `${getFilterLabel(key, t)}: ${value}`)
    .join(" | ")
}

function getFilterLabel(key: string, t: TranslationFn) {
  const labels: Record<string, string> = {
    endDate: t("endDate"),
    guestId: t("guestId"),
    method: t("method"),
    paymentStatus: t("paymentStatus"),
    rangePreset: t("dateRangePreset"),
    roomId: t("roomId"),
    search: t("search"),
    startDate: t("startDate"),
    status: t("status"),
  }

  return labels[key] ?? key
}

function formatDate(value: unknown, preferences: SystemPreferences) {
  if (typeof value !== "string") {
    return "-"
  }

  return formatPreferenceDate(value, preferences)
}

function formatDateTime(value: unknown, preferences: SystemPreferences) {
  if (typeof value !== "string") {
    return "-"
  }

  return formatPreferenceDateTime(value, preferences)
}

function formatCurrency(value: number, preferences: SystemPreferences) {
  return formatPreferenceCurrency(value, preferences)
}

function formatNumber(value: number, preferences: SystemPreferences) {
  return formatPreferenceNumber(value, preferences)
}
