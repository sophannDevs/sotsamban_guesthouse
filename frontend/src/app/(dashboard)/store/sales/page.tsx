"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircleIcon,
  BanIcon,
  CalendarIcon,
  PlusIcon,
  ReceiptIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  ShoppingCartIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { Pagination } from "@/components/Pagination"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { defaultPaginationMeta, type PaginatedResponse } from "@/lib/api"
import { ActionMenu } from "@/components/app/action-menu"
import { MobileFilterDrawer } from "@/components/app/mobile-filter-drawer"
import {
  getStoreErrorMessage,
  saleStatuses,
  storeCategoryService,
  storeProductService,
  storeSaleService,
  storePaymentMethods,
  type CreateSalePayload,
  type Product,
  type Sale,
  type SaleStatus,
  type StorePaymentMethod,
} from "@/lib/store"

type StatusFilter = "ALL" | SaleStatus

type CartItem = {
  product: Product
  quantity: number
}

export default function SalesPage() {
  const t = useTranslations()
  const router = useRouter()

  // --- List state ---
  const [sales, setSales] = useState<Sale[]>([])
  const [paginationMeta, setPaginationMeta] =
    useState<PaginatedResponse<Sale>["meta"]>(defaultPaginationMeta)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [searchInput, setSearchInput] = useState("")
  const [activeSearch, setActiveSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [activeDateFrom, setActiveDateFrom] = useState("")
  const [activeDateTo, setActiveDateTo] = useState("")

  // --- Detail / cancel / refund state ---
  const [viewingSale, setViewingSale] = useState<Sale | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<
    { type: "cancel" | "refund"; sale: Sale } | null
  >(null)

  // --- New sale sheet state ---
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedProductId, setSelectedProductId] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [paymentMethod, setPaymentMethod] =
    useState<StorePaymentMethod>("CASH")
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)

  const statusOptions = useMemo(
    () => [
      { value: "ALL" as const, label: t("allStatuses") },
      { value: "COMPLETED" as const, label: t("store.saleCompleted") },
      { value: "CANCELLED" as const, label: t("store.saleCancelled") },
      { value: "REFUNDED" as const, label: t("store.saleRefunded") },
    ],
    [t],
  )

  const paymentMethodOptions = useMemo(
    () =>
      storePaymentMethods.map((m) => ({
        value: m,
        label: t(`store.paymentMethod.${m.toLowerCase()}`),
      })),
    [t],
  )

  const activeProducts = useMemo(
    () => products.filter((p) => p.status === "ACTIVE" && p.stockQuantity > 0),
    [products],
  )

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0),
    [cart],
  )

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId],
  )

  // Quantity warning: exceeds stock
  const quantityWarning = useMemo(() => {
    if (!selectedProduct) return null
    if (quantity > selectedProduct.stockQuantity) {
      return t("store.notEnoughStock", { stock: selectedProduct.stockQuantity })
    }
    const inCart = cart.find((c) => c.product.id === selectedProductId)
    const alreadyInCart = inCart ? inCart.quantity : 0
    if (alreadyInCart + quantity > selectedProduct.stockQuantity) {
      return t("store.notEnoughStock", {
        stock: selectedProduct.stockQuantity - alreadyInCart,
      })
    }
    return null
  }, [selectedProduct, quantity, cart, selectedProductId, t])

  // --- Load sales list ---
  useEffect(() => {
    let ignore = false

    async function fetchSales() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await storeSaleService.listPaginated({
          page,
          limit,
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
          ...(activeSearch ? { search: activeSearch } : {}),
          ...(activeDateFrom ? { from: activeDateFrom } : {}),
          ...(activeDateTo ? { to: activeDateTo } : {}),
        })

        if (!ignore) {
          setSales(response.data)
          setPaginationMeta(response.meta)
        }
      } catch (error) {
        if (!ignore) setErrorMessage(getStoreErrorMessage(error))
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    void fetchSales()
    return () => { ignore = true }
  }, [limit, page, statusFilter, activeSearch, activeDateFrom, activeDateTo])

  async function loadSales() {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await storeSaleService.listPaginated({
        page,
        limit,
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        ...(activeSearch ? { search: activeSearch } : {}),
        ...(activeDateFrom ? { from: activeDateFrom } : {}),
        ...(activeDateTo ? { to: activeDateTo } : {}),
      })
      setSales(response.data)
      setPaginationMeta(response.meta)
    } catch (error) {
      setErrorMessage(getStoreErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  // --- Load products when sheet opens ---
  async function openCreateSheet() {
    setCart([])
    setSelectedProductId("")
    setQuantity(1)
    setPaymentMethod("CASH")
    setCreateError(null)
    setIsCreateOpen(true)
    setLoadingProducts(true)

    try {
      const [productRes] = await Promise.all([
        storeProductService.listPaginated({ page: 1, limit: 200 }),
        storeCategoryService.list(),
      ])
      setProducts(productRes.data)
    } catch (error) {
      setCreateError(getStoreErrorMessage(error))
    } finally {
      setLoadingProducts(false)
    }
  }

  // Opens the create sheet when navigated here from the mobile FAB.
  useEffect(() => {
    async function run() {
      if (new URLSearchParams(window.location.search).get("action") === "new") {
        await openCreateSheet()
        router.replace("/store/sales", { scroll: false })
      }
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleAddToCart() {
    if (!selectedProduct || quantity < 1) return
    if (quantityWarning) return

    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === selectedProductId)
      if (existing) {
        return prev.map((c) =>
          c.product.id === selectedProductId
            ? { ...c, quantity: c.quantity + quantity }
            : c,
        )
      }
      return [...prev, { product: selectedProduct, quantity }]
    })

    setSelectedProductId("")
    setQuantity(1)
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((c) => c.product.id !== productId))
  }

  function updateCartQty(productId: string, newQty: number) {
    if (newQty < 1) return
    setCart((prev) =>
      prev.map((c) =>
        c.product.id === productId ? { ...c, quantity: newQty } : c,
      ),
    )
  }

  async function handleCompleteSale() {
    if (cart.length === 0) return
    setCreateError(null)
    setIsCreating(true)

    try {
      const payload: CreateSalePayload = {
        paymentMethod,
        items: cart.map((c) => ({
          productId: c.product.id,
          quantity: c.quantity,
        })),
      }
      const sale = await storeSaleService.create(payload)
      setSales((prev) => [sale, ...prev])
      setIsCreateOpen(false)
      setCart([])
    } catch (error) {
      setCreateError(getStoreErrorMessage(error))
    } finally {
      setIsCreating(false)
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction) return
    setActionError(null)
    setActionLoading(true)

    try {
      let updated: Sale
      if (confirmAction.type === "cancel") {
        updated = await storeSaleService.cancel(confirmAction.sale.id)
      } else {
        updated = await storeSaleService.refund(confirmAction.sale.id)
      }
      setSales((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      )
      if (viewingSale?.id === updated.id) setViewingSale(updated)
      setConfirmAction(null)
    } catch (error) {
      setActionError(getStoreErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  function handleSearch() {
    setActiveSearch(searchInput.trim())
    setActiveDateFrom(dateFrom)
    setActiveDateTo(dateTo)
    setPage(1)
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{t("store.salesTitle")}</CardTitle>
            <CardDescription>{t("store.salesDescription")}</CardDescription>
          </div>
          <CardAction className="flex items-center gap-2">
            <MobileFilterDrawer
              activeCount={
                (activeSearch ? 1 : 0) +
                (statusFilter !== "ALL" ? 1 : 0) +
                (activeDateFrom || activeDateTo ? 1 : 0)
              }
              onApply={handleSearch}
              onClear={() => {
                setSearchInput("")
                setActiveSearch("")
                setStatusFilter("ALL")
                setDateFrom("")
                setDateTo("")
                setActiveDateFrom("")
                setActiveDateTo("")
                setPage(1)
              }}
              triggerClassName="md:hidden"
            >
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-none">{t("store.searchSales")}</p>
                <Input
                  placeholder={t("store.searchSales")}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-none">{t("status")}</p>
                <Select
                  items={statusOptions}
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-none">{t("expenses.expenseDate")}</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                  <span className="text-muted-foreground">—</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            </MobileFilterDrawer>
            <Button
              className="hidden md:inline-flex"
              onClick={() => void openCreateSheet()}
            >
              <PlusIcon data-icon="inline-start" />
              {t("store.newSale")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Filters (desktop only) */}
          <div className="hidden flex-wrap items-end gap-2 md:flex">
            <div className="flex gap-1">
              <Input
                className="h-9 w-44"
                placeholder={t("store.searchSales")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch() }}
              />
              <Button
                onClick={handleSearch}
                size="sm"
                type="button"
                variant="outline"
              >
                <SearchIcon />
              </Button>
            </div>
            <Select
              items={statusOptions}
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as StatusFilter)
                setPage(1)
              }}
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <CalendarIcon className="size-4 text-muted-foreground" />
              <Input
                className="h-9 w-36"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="text-muted-foreground">—</span>
              <Input
                className="h-9 w-36"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("store.couldNotLoadSales")}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
              <Button
                className="mt-3 w-fit"
                onClick={() => void loadSales()}
                size="sm"
                variant="outline"
              >
                <RefreshCwIcon data-icon="inline-start" />
                {t("retry")}
              </Button>
            </Alert>
          ) : null}

          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("store.saleNumber")}</TableHead>
                  <TableHead>{t("store.items")}</TableHead>
                  <TableHead>{t("store.total")}</TableHead>
                  <TableHead>{t("store.paymentMethod.label")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("store.soldBy")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <SaleTableStateRow colSpan={7} message={t("store.loadingSales")} />
                ) : sales.length ? (
                  sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        <div className="flex min-w-0 flex-col">
                          <span className="font-mono font-medium">
                            {sale.saleNumber}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(sale.createdAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{sale.items.length}</Badge>
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        {formatCurrency(sale.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <PaymentBadge method={sale.paymentMethod} t={t} />
                      </TableCell>
                      <TableCell>
                        <SaleStatusBadge status={sale.status} t={t} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.soldBy.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            aria-label={t("store.viewSaleAria", { saleNumber: sale.saleNumber })}
                            onClick={() => { setActionError(null); setViewingSale(sale) }}
                            size="icon-sm"
                            type="button"
                            variant="outline"
                          >
                            <ReceiptIcon />
                          </Button>
                          {sale.status === "COMPLETED" ? (
                            <>
                              <Button
                                aria-label={t("store.cancelSale")}
                                onClick={() => { setActionError(null); setConfirmAction({ type: "cancel", sale }) }}
                                size="icon-sm"
                                type="button"
                                variant="outline"
                              >
                                <BanIcon />
                              </Button>
                              <Button
                                aria-label={t("store.refundSale")}
                                onClick={() => { setActionError(null); setConfirmAction({ type: "refund", sale }) }}
                                size="icon-sm"
                                type="button"
                                variant="destructive"
                              >
                                <RotateCcwIcon />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <SaleTableStateRow colSpan={7} message={t("store.noSalesFound")} />
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("store.loadingSales")}
              </p>
            ) : sales.length ? (
              sales.map((sale) => (
                <div key={sale.id} className="flex flex-col gap-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="font-mono font-medium">{sale.saleNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(sale.createdAt)} · {sale.soldBy.name}
                      </span>
                    </div>
                    <SaleStatusBadge status={sale.status} t={t} />
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span>
                      {t("store.items")}:{" "}
                      <Badge variant="secondary">{sale.items.length}</Badge>
                    </span>
                    <span>·</span>
                    <span className="font-mono font-semibold">
                      {formatCurrency(sale.totalAmount)}
                    </span>
                    <span>·</span>
                    <PaymentBadge method={sale.paymentMethod} t={t} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => { setActionError(null); setViewingSale(sale) }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <ReceiptIcon data-icon="inline-start" />
                      {t("store.viewDetail")}
                    </Button>
                    {sale.status === "COMPLETED" ? (
                      <ActionMenu
                        items={[
                          { label: t("store.cancelSale"), icon: <BanIcon />, onClick: () => { setActionError(null); setConfirmAction({ type: "cancel", sale }) } },
                          { label: t("store.refundSale"), icon: <RotateCcwIcon />, onClick: () => { setActionError(null); setConfirmAction({ type: "refund", sale }) }, variant: "destructive" },
                        ]}
                      />
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("store.noSalesFound")}
              </p>
            )}
          </div>

          <Pagination
            limit={paginationMeta.limit}
            page={paginationMeta.page}
            total={paginationMeta.total}
            totalPages={paginationMeta.totalPages}
            onLimitChange={(next) => { setLimit(next); setPage(1) }}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* ── New Sale Sheet ── */}
      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
          side="right"
        >
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCartIcon className="size-5" />
              {t("store.newSale")}
            </SheetTitle>
            <SheetDescription>{t("store.newSaleDescription")}</SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-0 overflow-hidden">
            {/* Add item section */}
            <div className="border-b p-4">
              <p className="mb-3 text-sm font-medium">{t("store.addItemsToCart")}</p>

              {createError ? (
                <Alert variant="destructive" className="mb-3">
                  <AlertCircleIcon />
                  <AlertTitle>{t("store.saleCouldNotBeCreated")}</AlertTitle>
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              ) : null}

              {loadingProducts ? (
                <p className="text-sm text-muted-foreground">{t("store.loadingProducts")}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label htmlFor="productSelect" className="sr-only">
                        {t("store.product")}
                      </Label>
                      <Select
                        items={activeProducts.map((p) => ({
                          value: p.id,
                          label: `${p.name} — ${p.sku} (${t("store.stockLabel", { n: p.stockQuantity })})`,
                        }))}
                        value={selectedProductId}
                        onValueChange={(v) => { setSelectedProductId(v ?? ""); setQuantity(1) }}
                      >
                        <SelectTrigger id="productSelect">
                          <SelectValue placeholder={t("store.selectProduct")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {activeProducts.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                <span className="font-medium">{p.name}</span>
                                <span className="ml-1 text-xs text-muted-foreground">
                                  {p.sku} · {formatCurrency(p.sellingPrice)} · {t("store.stockLabel", { n: p.stockQuantity })}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      className="w-20"
                      min={1}
                      max={selectedProduct?.stockQuantity ?? 999}
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    />
                    <Button
                      disabled={!selectedProduct || Boolean(quantityWarning)}
                      onClick={handleAddToCart}
                      type="button"
                    >
                      {t("store.addToCart")}
                    </Button>
                  </div>
                  {quantityWarning ? (
                    <p className="text-sm text-destructive">{quantityWarning}</p>
                  ) : null}
                  {activeProducts.length === 0 && !loadingProducts ? (
                    <p className="text-sm text-muted-foreground">
                      {t("store.noActiveProducts")}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            {/* Cart */}
            <div className="flex flex-1 flex-col overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                  <ShoppingCartIcon className="size-10 opacity-30" />
                  <p className="text-sm">{t("store.cartEmpty")}</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center gap-3 border-b px-4 py-3"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{item.product.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(item.product.sellingPrice)} {t("store.each")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          className="size-7"
                          onClick={() => updateCartQty(item.product.id, item.quantity - 1)}
                          size="icon-sm"
                          type="button"
                          variant="outline"
                        >
                          −
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          className="size-7"
                          onClick={() => updateCartQty(item.product.id, item.quantity + 1)}
                          size="icon-sm"
                          type="button"
                          variant="outline"
                        >
                          +
                        </Button>
                      </div>
                      <span className="w-20 text-right font-mono text-sm">
                        {formatCurrency(item.product.sellingPrice * item.quantity)}
                      </span>
                      <Button
                        onClick={() => removeFromCart(item.product.id)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <XIcon />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer: total + payment + submit */}
            <div className="border-t bg-muted/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">{t("store.total")}</span>
                <span className="font-mono text-xl font-semibold">
                  {formatCurrency(cartTotal)}
                </span>
              </div>
              <Separator className="mb-3" />
              <div className="mb-3">
                <Label htmlFor="paymentMethodSelect" className="mb-1.5 block text-sm">
                  {t("store.paymentMethod.label")}
                </Label>
                <Select
                  items={paymentMethodOptions}
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod((v ?? "CASH") as StorePaymentMethod)}
                >
                  <SelectTrigger id="paymentMethodSelect">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {paymentMethodOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                disabled={cart.length === 0 || isCreating}
                onClick={() => void handleCompleteSale()}
                type="button"
              >
                <ReceiptIcon data-icon="inline-start" />
                {isCreating ? t("store.processing") : t("store.completeSale")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Sale Detail Dialog ── */}
      <Dialog
        open={Boolean(viewingSale)}
        onOpenChange={(open) => { if (!open) setViewingSale(null) }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {viewingSale?.saleNumber ?? t("store.saleDetail")}
            </DialogTitle>
            <DialogDescription>
              {viewingSale
                ? `${formatDateTime(viewingSale.createdAt)} · ${viewingSale.soldBy.name}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {viewingSale ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <SaleStatusBadge status={viewingSale.status} t={t} />
                <PaymentBadge method={viewingSale.paymentMethod} t={t} />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("store.product")}</TableHead>
                    <TableHead className="text-right">{t("store.qty")}</TableHead>
                    <TableHead className="text-right">{t("store.unitPrice")}</TableHead>
                    <TableHead className="text-right">{t("store.subtotal")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewingSale.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{item.product.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {item.product.sku}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(item.subtotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
                <span className="font-medium">{t("store.total")}</span>
                <span className="font-mono text-lg font-semibold">
                  {formatCurrency(viewingSale.totalAmount)}
                </span>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            {viewingSale?.status === "COMPLETED" ? (
              <>
                <Button
                  onClick={() => {
                    setActionError(null)
                    setConfirmAction({ type: "cancel", sale: viewingSale })
                    setViewingSale(null)
                  }}
                  type="button"
                  variant="outline"
                >
                  <BanIcon data-icon="inline-start" />
                  {t("store.cancelSale")}
                </Button>
                <Button
                  onClick={() => {
                    setActionError(null)
                    setConfirmAction({ type: "refund", sale: viewingSale })
                    setViewingSale(null)
                  }}
                  type="button"
                  variant="destructive"
                >
                  <RotateCcwIcon data-icon="inline-start" />
                  {t("store.refundSale")}
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel / Refund Confirm Dialog ── */}
      <Dialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open) { setConfirmAction(null); setActionError(null) }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === "cancel"
                ? t("store.confirmCancelTitle")
                : t("store.confirmRefundTitle")}
            </DialogTitle>
            <DialogDescription>
              {confirmAction
                ? confirmAction.type === "cancel"
                  ? t("store.confirmCancelDescription", {
                      saleNumber: confirmAction.sale.saleNumber,
                    })
                  : t("store.confirmRefundDescription", {
                      saleNumber: confirmAction.sale.saleNumber,
                    })
                : ""}
            </DialogDescription>
          </DialogHeader>

          {actionError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("store.actionFailed")}</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button
              disabled={actionLoading}
              onClick={() => void handleConfirmAction()}
              type="button"
              variant={confirmAction?.type === "refund" ? "destructive" : "outline"}
            >
              {confirmAction?.type === "cancel" ? (
                <>
                  <BanIcon data-icon="inline-start" />
                  {actionLoading ? t("store.processing") : t("store.cancelSale")}
                </>
              ) : (
                <>
                  <RotateCcwIcon data-icon="inline-start" />
                  {actionLoading ? t("store.processing") : t("store.refundSale")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Helpers ──

function SaleTableStateRow({
  colSpan,
  message,
}: {
  colSpan: number
  message: string
}) {
  return (
    <TableRow>
      <TableCell
        className="h-28 text-center text-sm text-muted-foreground"
        colSpan={colSpan}
      >
        {message}
      </TableCell>
    </TableRow>
  )
}

function SaleStatusBadge({
  status,
  t,
}: {
  status: SaleStatus
  t: ReturnType<typeof useTranslations>
}) {
  const variant =
    status === "COMPLETED"
      ? "default"
      : status === "CANCELLED"
        ? "secondary"
        : "destructive"

  const label =
    status === "COMPLETED"
      ? t("store.saleCompleted")
      : status === "CANCELLED"
        ? t("store.saleCancelled")
        : t("store.saleRefunded")

  return <Badge variant={variant}>{label}</Badge>
}

function PaymentBadge({
  method,
  t,
}: {
  method: StorePaymentMethod
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <Badge variant="outline">
      {t(`store.paymentMethod.${method.toLowerCase()}`)}
    </Badge>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}
