"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircleIcon,
  BuildingIcon,
  LandmarkIcon,
  StoreIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import {
  formatPreferenceCurrency,
  useSystemPreferences,
} from "@/components/app/system-preferences-provider"
import { useActiveBusiness } from "@/components/app/business-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  financeService,
  getFinanceErrorMessage,
  type AllBusinessesFinanceSummary,
  type BusinessFinanceSummary,
  type FinanceSummary,
} from "@/lib/finance"
import { cn } from "@/lib/utils"

type View = "current" | "all"

type FinanceData = (FinanceSummary | AllBusinessesFinanceSummary) & {
  businesses?: BusinessFinanceSummary[]
}

export default function FinancePage() {
  const t = useTranslations("financePage")
  const { preferences } = useSystemPreferences()
  const { activeBusiness } = useActiveBusiness()

  const [view, setView] = useState<View>("current")
  const [selectedPreset, setSelectedPreset] = useState("this_month")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [activeCustomStart, setActiveCustomStart] = useState("")
  const [activeCustomEnd, setActiveCustomEnd] = useState("")

  const [data, setData] = useState<FinanceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const buildParams = useCallback(() => {
    if (selectedPreset === "custom") {
      return {
        rangePreset: "custom",
        startDate: activeCustomStart,
        endDate: activeCustomEnd,
      }
    }
    return { rangePreset: selectedPreset }
  }, [selectedPreset, activeCustomStart, activeCustomEnd])

  useEffect(() => {
    let ignore = false

    async function fetchData() {
      if (selectedPreset === "custom" && (!activeCustomStart || !activeCustomEnd)) {
        setIsLoading(false)
        return
      }

      if (view === "current" && !activeBusiness) {
        setIsLoading(false)
        setData(null)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const params = buildParams()
        const result =
          view === "all"
            ? await financeService.getAllBusinessesSummary(params)
            : await financeService.getSummary(params)

        if (!ignore) setData(result as FinanceData)
      } catch (err) {
        if (!ignore) setError(getFinanceErrorMessage(err))
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    void fetchData()

    return () => {
      ignore = true
    }
  }, [
    view,
    selectedPreset,
    activeCustomStart,
    activeCustomEnd,
    activeBusiness?.businessId,
    buildParams,
  ])

  const isLoss = (data?.netProfit ?? 0) < 0
  const allData = view === "all" ? (data as AllBusinessesFinanceSummary | null) : null

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Page header */}
      <div>
        <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {/* Controls: period selector + view toggle */}
      <div className="flex flex-wrap items-start gap-3 sm:items-center sm:justify-between">
        <Select
          value={selectedPreset}
          onValueChange={(v) => {
            if (v) setSelectedPreset(v)
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="today">{t("periodToday")}</SelectItem>
              <SelectItem value="this_week">{t("periodThisWeek")}</SelectItem>
              <SelectItem value="this_month">{t("periodThisMonth")}</SelectItem>
              <SelectItem value="last_month">{t("periodLastMonth")}</SelectItem>
              <SelectItem value="last_3_months">
                {t("periodLast3Months")}
              </SelectItem>
              <SelectItem value="this_year">{t("periodThisYear")}</SelectItem>
              <SelectItem value="custom">{t("periodCustom")}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Tabs
          value={view}
          onValueChange={(v) => {
            if (v) setView(v as View)
          }}
        >
          <TabsList>
            <TabsTrigger value="current">{t("currentBusiness")}</TabsTrigger>
            <TabsTrigger value="all">{t("allBusinesses")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Custom date range inputs */}
      {selectedPreset === "custom" && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="finance-start">{t("startDate")}</Label>
            <Input
              className="w-40"
              id="finance-start"
              onChange={(e) => setCustomStartDate(e.target.value)}
              type="date"
              value={customStartDate}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="finance-end">{t("endDate")}</Label>
            <Input
              className="w-40"
              id="finance-end"
              onChange={(e) => setCustomEndDate(e.target.value)}
              type="date"
              value={customEndDate}
            />
          </div>
          <Button
            disabled={!customStartDate || !customEndDate}
            onClick={() => {
              setActiveCustomStart(customStartDate)
              setActiveCustomEnd(customEndDate)
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("applyRange")}
          </Button>
        </div>
      )}

      {/* No business selected — current view only */}
      {view === "current" && !activeBusiness && !isLoading && (
        <Alert>
          <LandmarkIcon />
          <AlertTitle>{t("noBusiness")}</AlertTitle>
          <AlertDescription>{t("noBusinessDescription")}</AlertDescription>
        </Alert>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("loadError")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary cards */}
      {(view === "all" || activeBusiness) && !error && (
        <div className="grid gap-4 sm:grid-cols-3">
          <FinanceMetricCard
            detail={t("forSelectedPeriod")}
            icon={TrendingUpIcon}
            isLoading={isLoading}
            label={t("totalRevenue")}
            value={formatPreferenceCurrency(data?.totalRevenue ?? 0, preferences)}
          />
          <FinanceMetricCard
            detail={t("forSelectedPeriod")}
            icon={WalletIcon}
            isLoading={isLoading}
            label={t("totalExpense")}
            value={formatPreferenceCurrency(data?.totalExpense ?? 0, preferences)}
          />
          <FinanceMetricCard
            detail={t("revenueMinusExpenses")}
            icon={isLoss ? TrendingDownIcon : TrendingUpIcon}
            isDestructive={isLoss}
            isLoading={isLoading}
            label={isLoss ? t("netLoss") : t("netProfit")}
            value={formatPreferenceCurrency(
              Math.abs(data?.netProfit ?? 0),
              preferences
            )}
          />
        </div>
      )}

      {/* All-businesses breakdown */}
      {view === "all" && !error && (
        <Card>
          <CardHeader>
            <CardTitle>{t("businessBreakdown")}</CardTitle>
            <CardDescription>{t("businessBreakdownDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <LoadingRows />
            ) : !allData?.businesses?.length ? (
              <EmptyBusinesses
                description={t("noBusinessesDescription")}
                label={t("noBusinesses")}
              />
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("businessName")}</TableHead>
                        <TableHead>{t("businessType")}</TableHead>
                        <TableHead className="text-right">{t("revenue")}</TableHead>
                        <TableHead className="text-right">{t("expense")}</TableHead>
                        <TableHead className="text-right">
                          {t("netProfitLoss")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allData.businesses.map((b) => (
                        <BusinessTableRow
                          business={b}
                          key={b.businessId}
                          preferences={preferences}
                          t={t}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile business cards */}
                <div className="flex flex-col divide-y sm:hidden">
                  {allData.businesses.map((b) => (
                    <BusinessMobileCard
                      business={b}
                      key={b.businessId}
                      preferences={preferences}
                      t={t}
                    />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// --- Sub-components ---

function FinanceMetricCard({
  detail,
  icon: Icon,
  isDestructive = false,
  isLoading,
  label,
  value,
}: {
  detail: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  isDestructive?: boolean
  isLoading: boolean
  label: string
  value: string
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <CardDescription>{detail}</CardDescription>
        <CardAction>
          <Icon className={cn(isDestructive && "text-destructive")} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "font-mono text-3xl font-semibold",
            isDestructive && "text-destructive"
          )}
        >
          {isLoading ? "..." : value}
        </div>
      </CardContent>
    </Card>
  )
}

function BusinessTypeIcon({ type }: { type: string }) {
  if (type === "STORE") return <StoreIcon className="size-4 shrink-0 text-muted-foreground" />
  return <BuildingIcon className="size-4 shrink-0 text-muted-foreground" />
}

type TFn = ReturnType<typeof useTranslations<"financePage">>

function BusinessTableRow({
  business: b,
  preferences,
  t,
}: {
  business: BusinessFinanceSummary
  preferences: Parameters<typeof formatPreferenceCurrency>[1]
  t: TFn
}) {
  const isLoss = b.netProfit < 0
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2 font-medium">
          <BusinessTypeIcon type={b.businessType} />
          {b.businessName}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {b.businessType === "STORE" ? t("store") : t("guesthouse")}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatPreferenceCurrency(b.revenue, preferences)}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatPreferenceCurrency(b.expense, preferences)}
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-mono font-medium",
          isLoss ? "text-destructive" : "text-foreground"
        )}
      >
        {isLoss ? "−" : ""}
        {formatPreferenceCurrency(Math.abs(b.netProfit), preferences)}
      </TableCell>
    </TableRow>
  )
}

function BusinessMobileCard({
  business: b,
  preferences,
  t,
}: {
  business: BusinessFinanceSummary
  preferences: Parameters<typeof formatPreferenceCurrency>[1]
  t: TFn
}) {
  const isLoss = b.netProfit < 0
  return (
    <div className="flex flex-col gap-3 px-6 py-4">
      <div className="flex items-center gap-2">
        <BusinessTypeIcon type={b.businessType} />
        <span className="font-medium">{b.businessName}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {b.businessType === "STORE" ? t("store") : t("guesthouse")}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{t("revenue")}</p>
          <p className="font-mono font-medium">
            {formatPreferenceCurrency(b.revenue, preferences)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("expense")}</p>
          <p className="font-mono font-medium">
            {formatPreferenceCurrency(b.expense, preferences)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("netProfitLoss")}</p>
          <p
            className={cn(
              "font-mono font-medium",
              isLoss ? "text-destructive" : "text-foreground"
            )}
          >
            {isLoss ? "−" : ""}
            {formatPreferenceCurrency(Math.abs(b.netProfit), preferences)}
          </p>
        </div>
      </div>
    </div>
  )
}

function LoadingRows() {
  return (
    <div className="flex flex-col divide-y">
      {[1, 2].map((i) => (
        <div className="flex items-center gap-4 px-6 py-4" key={i}>
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-4 w-20 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

function EmptyBusinesses({
  label,
  description,
}: {
  label: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <LandmarkIcon className="size-8 text-muted-foreground" />
      <p className="font-medium">{label}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
