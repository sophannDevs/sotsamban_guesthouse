"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  BanIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClipboardListIcon,
  PackageCheckIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
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
import {
  getStoreErrorMessage,
  purchaseStatuses,
  storePurchaseService,
  storeProductService,
  storeSupplierService,
  type CreatePurchasePayload,
  type Product,
  type PurchaseStatus,
  type StorePurchase,
  type Supplier,
  type UpdatePurchasePayload,
} from "@/lib/store"

type StatusFilter = "ALL" | PurchaseStatus

type PurchaseCartItem = {
  productId: string
  productName: string
  productSku: string
  quantity: number
  costPrice: number
}

export default function PurchasesPage() {
  const t = useTranslations()

  // --- List state ---
  const [purchases, setPurchases] = useState<StorePurchase[]>([])
  const [paginationMeta, setPaginationMeta] =
    useState<PaginatedResponse<StorePurchase>["meta"]>(defaultPaginationMeta)
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

  // --- Detail / action state ---
  const [viewingPurchase, setViewingPurchase] = useState<StorePurchase | null>(null)
  const [confirmAction, setConfirmAction] = useState<
    { type: "complete" | "cancel"; purchase: StorePurchase } | null
  >(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // --- Sheet state ---
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create")
  const [editingPurchase, setEditingPurchase] = useState<StorePurchase | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState("")
  const [cart, setCart] = useState<PurchaseCartItem[]>([])
  const [selectedProductId, setSelectedProductId] = useState("")
  const [addQty, setAddQty] = useState(1)
  const [addCostPrice, setAddCostPrice] = useState("")
  const [sheetError, setSheetError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingSheetData, setLoadingSheetData] = useState(false)

  const statusOptions = useMemo(
    () => [
      { value: "ALL" as const, label: t("allStatuses") },
      { value: "DRAFT" as const, label: t("store.draft") },
      { value: "COMPLETED" as const, label: t("store.purchaseCompleted") },
      { value: "CANCELLED" as const, label: t("store.purchaseCancelled") },
    ],
    [t],
  )

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.costPrice, 0),
    [cart],
  )

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId],
  )

  // --- Load purchases list ---
  useEffect(() => {
    let ignore = false

    async function fetchPurchases() {
      setIsLoading(true)
      setErrorMessage(null)
      try {
        const response = await storePurchaseService.listPaginated({
          page,
          limit,
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
          ...(activeSearch ? { search: activeSearch } : {}),
          ...(activeDateFrom ? { from: activeDateFrom } : {}),
          ...(activeDateTo ? { to: activeDateTo } : {}),
        })
        if (!ignore) {
          setPurchases(response.data)
          setPaginationMeta(response.meta)
        }
      } catch (error) {
        if (!ignore) setErrorMessage(getStoreErrorMessage(error))
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    void fetchPurchases()
    return () => { ignore = true }
  }, [page, limit, statusFilter, activeSearch, activeDateFrom, activeDateTo])

  function handleSearch() {
    setActiveSearch(searchInput.trim())
    setActiveDateFrom(dateFrom)
    setActiveDateTo(dateTo)
    setPage(1)
  }

  // --- Sheet helpers ---
  async function openCreateSheet() {
    setSheetMode("create")
    setEditingPurchase(null)
    setSelectedSupplierId("")
    setCart([])
    setSelectedProductId("")
    setAddQty(1)
    setAddCostPrice("")
    setSheetError(null)
    setIsSheetOpen(true)
    setLoadingSheetData(true)

    try {
      const [suppliersData, productsData] = await Promise.all([
        storeSupplierService.list(),
        storeProductService.listPaginated({ page: 1, limit: 200 }),
      ])
      setSuppliers(suppliersData)
      setProducts(productsData.data)
    } catch (error) {
      setSheetError(getStoreErrorMessage(error))
    } finally {
      setLoadingSheetData(false)
    }
  }

  async function openEditSheet(purchase: StorePurchase) {
    setSheetMode("edit")
    setEditingPurchase(purchase)
    setSelectedSupplierId(purchase.supplier.id)
    setCart(
      purchase.items.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        productSku: item.product.sku,
        quantity: item.quantity,
        costPrice: item.costPrice,
      })),
    )
    setSelectedProductId("")
    setAddQty(1)
    setAddCostPrice("")
    setSheetError(null)
    setIsSheetOpen(true)
    setLoadingSheetData(true)

    try {
      const [suppliersData, productsData] = await Promise.all([
        storeSupplierService.list(),
        storeProductService.listPaginated({ page: 1, limit: 200 }),
      ])
      setSuppliers(suppliersData)
      setProducts(productsData.data)
    } catch (error) {
      setSheetError(getStoreErrorMessage(error))
    } finally {
      setLoadingSheetData(false)
    }
  }

  function handleAddToCart() {
    if (!selectedProduct || addQty < 1 || !addCostPrice || Number(addCostPrice) <= 0) return

    setCart((prev) => {
      const existing = prev.find((c) => c.productId === selectedProductId)
      if (existing) {
        return prev.map((c) =>
          c.productId === selectedProductId
            ? { ...c, quantity: c.quantity + addQty, costPrice: Number(addCostPrice) }
            : c,
        )
      }
      return [
        ...prev,
        {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          productSku: selectedProduct.sku,
          quantity: addQty,
          costPrice: Number(addCostPrice),
        },
      ]
    })

    setSelectedProductId("")
    setAddQty(1)
    setAddCostPrice("")
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((c) => c.productId !== productId))
  }

  function updateCartItem(productId: string, field: "quantity" | "costPrice", value: number) {
    setCart((prev) =>
      prev.map((c) =>
        c.productId === productId ? { ...c, [field]: value } : c,
      ),
    )
  }

  async function handleSaveDraft() {
    if (!selectedSupplierId || cart.length === 0) return
    setSheetError(null)
    setIsSubmitting(true)

    try {
      const items = cart.map((c) => ({
        productId: c.productId,
        quantity: c.quantity,
        costPrice: c.costPrice,
      }))

      if (sheetMode === "create") {
        const payload: CreatePurchasePayload = { supplierId: selectedSupplierId, items }
        const created = await storePurchaseService.create(payload)
        setPurchases((prev) => [created, ...prev])
      } else if (editingPurchase) {
        const payload: UpdatePurchasePayload = { supplierId: selectedSupplierId, items }
        const updated = await storePurchaseService.update(editingPurchase.id, payload)
        setPurchases((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        if (viewingPurchase?.id === updated.id) setViewingPurchase(updated)
      }

      setIsSheetOpen(false)
    } catch (error) {
      setSheetError(getStoreErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- Complete / Cancel actions ---
  async function handleConfirmAction() {
    if (!confirmAction) return
    setActionError(null)
    setActionLoading(true)

    try {
      let updated: StorePurchase
      if (confirmAction.type === "complete") {
        updated = await storePurchaseService.complete(confirmAction.purchase.id)
      } else {
        updated = await storePurchaseService.cancel(confirmAction.purchase.id)
      }
      setPurchases((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      if (viewingPurchase?.id === updated.id) setViewingPurchase(updated)
      setConfirmAction(null)
    } catch (error) {
      setActionError(getStoreErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{t("store.purchasesTitle")}</CardTitle>
            <CardDescription>{t("store.purchasesDescription")}</CardDescription>
          </div>
          <CardAction>
            <Button onClick={() => void openCreateSheet()}>
              <PlusIcon data-icon="inline-start" />
              {t("store.newPurchase")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex gap-1">
              <Input
                className="h-9 w-44"
                placeholder={t("store.searchPurchases")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch() }}
              />
              <Button onClick={handleSearch} size="sm" type="button" variant="outline">
                <SearchIcon />
              </Button>
            </div>
            <Select
              items={statusOptions}
              value={statusFilter}
              onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1) }}
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
              <AlertTitle>{t("store.couldNotLoadPurchases")}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
              <Button
                className="mt-3 w-fit"
                onClick={() => { setPage((p) => p) }}
                size="sm"
                variant="outline"
              >
                <RefreshCwIcon data-icon="inline-start" />
                {t("retry")}
              </Button>
            </Alert>
          ) : null}

          {/* Desktop Table */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("store.purchaseNumber")}</TableHead>
                  <TableHead>{t("store.supplier")}</TableHead>
                  <TableHead>{t("store.items")}</TableHead>
                  <TableHead>{t("store.total")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("store.createdBy")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <PurchaseTableStateRow colSpan={7} message={t("store.loadingPurchases")} />
                ) : purchases.length ? (
                  purchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex min-w-0 flex-col">
                          <span className="font-mono font-medium">{p.purchaseNumber}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(p.createdAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{p.supplier.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{p.items.length}</Badge>
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        {formatCurrency(p.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <PurchaseStatusBadge status={p.status} t={t} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.createdBy.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            aria-label={t("store.viewPurchaseAria", { purchaseNumber: p.purchaseNumber })}
                            onClick={() => { setActionError(null); setViewingPurchase(p) }}
                            size="icon-sm"
                            type="button"
                            variant="outline"
                          >
                            <ClipboardListIcon />
                          </Button>
                          {p.status === "DRAFT" ? (
                            <>
                              <Button
                                aria-label={t("store.editPurchaseAria", { purchaseNumber: p.purchaseNumber })}
                                onClick={() => void openEditSheet(p)}
                                size="icon-sm"
                                type="button"
                                variant="outline"
                              >
                                <PencilIcon />
                              </Button>
                              <Button
                                aria-label={t("store.completePurchase")}
                                onClick={() => { setActionError(null); setConfirmAction({ type: "complete", purchase: p }) }}
                                size="icon-sm"
                                type="button"
                                variant="outline"
                              >
                                <PackageCheckIcon />
                              </Button>
                              <Button
                                aria-label={t("store.cancelPurchase")}
                                onClick={() => { setActionError(null); setConfirmAction({ type: "cancel", purchase: p }) }}
                                size="icon-sm"
                                type="button"
                                variant="destructive"
                              >
                                <BanIcon />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <PurchaseTableStateRow colSpan={7} message={t("store.noPurchasesFound")} />
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("store.loadingPurchases")}
              </p>
            ) : purchases.length ? (
              purchases.map((p) => (
                <div key={p.id} className="flex flex-col gap-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="font-mono font-medium">{p.purchaseNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.supplier.name} · {formatDateTime(p.createdAt)}
                      </span>
                    </div>
                    <PurchaseStatusBadge status={p.status} t={t} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>
                      {t("store.items")}:{" "}
                      <Badge variant="secondary">{p.items.length}</Badge>
                    </span>
                    <span>·</span>
                    <span className="font-mono font-semibold">
                      {formatCurrency(p.totalAmount)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => { setActionError(null); setViewingPurchase(p) }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <ClipboardListIcon data-icon="inline-start" />
                      {t("store.viewDetail")}
                    </Button>
                    {p.status === "DRAFT" ? (
                      <>
                        <Button
                          onClick={() => void openEditSheet(p)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <PencilIcon data-icon="inline-start" />
                          {t("store.editPurchase")}
                        </Button>
                        <Button
                          onClick={() => { setActionError(null); setConfirmAction({ type: "complete", purchase: p }) }}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <PackageCheckIcon data-icon="inline-start" />
                          {t("store.completePurchase")}
                        </Button>
                        <Button
                          onClick={() => { setActionError(null); setConfirmAction({ type: "cancel", purchase: p }) }}
                          size="sm"
                          type="button"
                          variant="destructive"
                        >
                          <BanIcon data-icon="inline-start" />
                          {t("store.cancelPurchase")}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("store.noPurchasesFound")}
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

      {/* ── Create / Edit Purchase Sheet ── */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
          side="right"
        >
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="flex items-center gap-2">
              <ClipboardListIcon className="size-5" />
              {sheetMode === "create"
                ? t("store.newPurchase")
                : t("store.editPurchase")}
            </SheetTitle>
            <SheetDescription>
              {sheetMode === "create"
                ? t("store.newPurchaseDescription")
                : t("store.editPurchaseDescription")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Supplier + Add Item section */}
            <div className="border-b p-4">
              {sheetError ? (
                <Alert variant="destructive" className="mb-3">
                  <AlertCircleIcon />
                  <AlertTitle>{t("store.purchaseCouldNotBeSaved")}</AlertTitle>
                  <AlertDescription>{sheetError}</AlertDescription>
                </Alert>
              ) : null}

              {loadingSheetData ? (
                <p className="text-sm text-muted-foreground">{t("store.loadingSuppliersForPurchase")}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Supplier selector */}
                  <div>
                    <Label htmlFor="supplierSelect" className="mb-1.5 block text-sm font-medium">
                      {t("store.supplier")}
                    </Label>
                    {suppliers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("store.noSuppliersYet")}</p>
                    ) : (
                      <Select
                        items={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                        value={selectedSupplierId}
                        onValueChange={(v) => setSelectedSupplierId(v ?? "")}
                      >
                        <SelectTrigger id="supplierSelect">
                          <SelectValue placeholder={t("store.selectSupplier")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                                {s.phone ? (
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    · {s.phone}
                                  </span>
                                ) : null}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <Separator />

                  {/* Add item row */}
                  <p className="text-sm font-medium">{t("store.addItemsToCart")}</p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select
                        items={products
                          .filter((p) => p.status === "ACTIVE")
                          .map((p) => ({
                            value: p.id,
                            label: `${p.name} (${p.sku})`,
                          }))}
                        value={selectedProductId}
                        onValueChange={(v) => {
                          setSelectedProductId(v ?? "")
                          const product = products.find((p) => p.id === v)
                          if (product) setAddCostPrice(String(product.purchasePrice))
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("store.selectProduct")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {products
                              .filter((p) => p.status === "ACTIVE")
                              .map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  <span className="font-medium">{p.name}</span>
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    {p.sku}
                                  </span>
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      className="w-16"
                      min={1}
                      placeholder="Qty"
                      type="number"
                      value={addQty}
                      onChange={(e) => setAddQty(Math.max(1, Number(e.target.value)))}
                    />
                    <Input
                      className="w-24"
                      min={0.01}
                      placeholder="Cost $"
                      step="0.01"
                      type="number"
                      value={addCostPrice}
                      onChange={(e) => setAddCostPrice(e.target.value)}
                    />
                    <Button
                      disabled={
                        !selectedProduct ||
                        addQty < 1 ||
                        !addCostPrice ||
                        Number(addCostPrice) <= 0
                      }
                      onClick={handleAddToCart}
                      type="button"
                    >
                      {t("store.addToCart")}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Cart */}
            <div className="flex flex-1 flex-col overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                  <ClipboardListIcon className="size-10 opacity-30" />
                  <p className="text-sm">{t("store.cartEmpty")}</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {cart.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center gap-3 border-b px-4 py-3"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{item.productName}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {item.productSku}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          className="size-7"
                          onClick={() =>
                            updateCartItem(item.productId, "quantity", Math.max(1, item.quantity - 1))
                          }
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
                          onClick={() =>
                            updateCartItem(item.productId, "quantity", item.quantity + 1)
                          }
                          size="icon-sm"
                          type="button"
                          variant="outline"
                        >
                          +
                        </Button>
                      </div>
                      <div className="flex w-24 items-center gap-1">
                        <span className="text-xs text-muted-foreground">$</span>
                        <Input
                          className="h-7 w-full px-1 py-0 font-mono text-sm"
                          min={0.01}
                          step="0.01"
                          type="number"
                          value={item.costPrice}
                          onChange={(e) =>
                            updateCartItem(
                              item.productId,
                              "costPrice",
                              Math.max(0.01, Number(e.target.value)),
                            )
                          }
                        />
                      </div>
                      <span className="w-20 text-right font-mono text-sm">
                        {formatCurrency(item.quantity * item.costPrice)}
                      </span>
                      <Button
                        onClick={() => removeFromCart(item.productId)}
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

            {/* Footer */}
            <div className="border-t bg-muted/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">{t("store.total")}</span>
                <span className="font-mono text-xl font-semibold">
                  {formatCurrency(cartTotal)}
                </span>
              </div>
              <Button
                className="w-full"
                disabled={
                  !selectedSupplierId ||
                  cart.length === 0 ||
                  isSubmitting ||
                  loadingSheetData
                }
                onClick={() => void handleSaveDraft()}
                type="button"
              >
                <CheckCircleIcon data-icon="inline-start" />
                {isSubmitting
                  ? t("store.processing")
                  : t("store.saveDraft")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Purchase Detail Dialog ── */}
      <Dialog
        open={Boolean(viewingPurchase)}
        onOpenChange={(open) => { if (!open) setViewingPurchase(null) }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {viewingPurchase?.purchaseNumber ?? t("store.purchaseDetail")}
            </DialogTitle>
            <DialogDescription>
              {viewingPurchase
                ? `${viewingPurchase.supplier.name} · ${formatDateTime(viewingPurchase.createdAt)} · ${viewingPurchase.createdBy.name}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {viewingPurchase ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <PurchaseStatusBadge status={viewingPurchase.status} t={t} />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("store.product")}</TableHead>
                    <TableHead className="text-right">{t("store.qty")}</TableHead>
                    <TableHead className="text-right">{t("store.costPrice")}</TableHead>
                    <TableHead className="text-right">{t("store.subtotal")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewingPurchase.items.map((item) => (
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
                        {formatCurrency(item.costPrice)}
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
                  {formatCurrency(viewingPurchase.totalAmount)}
                </span>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            {viewingPurchase?.status === "DRAFT" ? (
              <>
                <Button
                  onClick={() => {
                    setActionError(null)
                    setConfirmAction({ type: "complete", purchase: viewingPurchase })
                    setViewingPurchase(null)
                  }}
                  type="button"
                  variant="outline"
                >
                  <PackageCheckIcon data-icon="inline-start" />
                  {t("store.completePurchase")}
                </Button>
                <Button
                  onClick={() => {
                    setActionError(null)
                    setConfirmAction({ type: "cancel", purchase: viewingPurchase })
                    setViewingPurchase(null)
                  }}
                  type="button"
                  variant="destructive"
                >
                  <BanIcon data-icon="inline-start" />
                  {t("store.cancelPurchase")}
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Complete / Cancel Confirm Dialog ── */}
      <Dialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open) { setConfirmAction(null); setActionError(null) }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === "complete"
                ? t("store.confirmCompletePurchaseTitle")
                : t("store.confirmCancelPurchaseTitle")}
            </DialogTitle>
            <DialogDescription>
              {confirmAction
                ? confirmAction.type === "complete"
                  ? t("store.confirmCompletePurchaseDescription", {
                      purchaseNumber: confirmAction.purchase.purchaseNumber,
                    })
                  : t("store.confirmCancelPurchaseDescription", {
                      purchaseNumber: confirmAction.purchase.purchaseNumber,
                    })
                : ""}
            </DialogDescription>
          </DialogHeader>

          {actionError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("store.purchaseActionFailed")}</AlertTitle>
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
              variant={
                confirmAction?.type === "cancel" ? "destructive" : "default"
              }
            >
              {confirmAction?.type === "complete" ? (
                <>
                  <PackageCheckIcon data-icon="inline-start" />
                  {actionLoading ? t("store.processing") : t("store.completePurchase")}
                </>
              ) : (
                <>
                  <BanIcon data-icon="inline-start" />
                  {actionLoading ? t("store.processing") : t("store.cancelPurchase")}
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

function PurchaseTableStateRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell className="h-28 text-center text-sm text-muted-foreground" colSpan={colSpan}>
        {message}
      </TableCell>
    </TableRow>
  )
}

function PurchaseStatusBadge({
  status,
  t,
}: {
  status: PurchaseStatus
  t: ReturnType<typeof useTranslations>
}) {
  const variant =
    status === "COMPLETED" ? "default" : status === "DRAFT" ? "secondary" : "destructive"
  const label =
    status === "COMPLETED"
      ? t("store.purchaseCompleted")
      : status === "DRAFT"
        ? t("store.draft")
        : t("store.purchaseCancelled")

  return <Badge variant={variant}>{label}</Badge>
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
