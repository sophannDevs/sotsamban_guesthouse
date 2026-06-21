"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertCircleIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  ShoppingBagIcon,
  Trash2Icon,
} from "lucide-react"

import { ActionMenu } from "@/components/app/action-menu"
import { useTranslations } from "next-intl"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
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
import { defaultPaginationMeta, type PaginatedResponse } from "@/lib/api"
import { MobileFilterDrawer } from "@/components/app/mobile-filter-drawer"
import {
  getStoreErrorMessage,
  productStatuses,
  storeCategoryService,
  storeProductService,
  type Product,
  type ProductCategory,
  type ProductPayload,
  type ProductStatus,
} from "@/lib/store"

type StatusFilter = "ALL" | ProductStatus

type ProductForm = {
  name: string
  sku: string
  barcode: string
  categoryId: string
  purchasePrice: number
  sellingPrice: number
  stockQuantity: number
  lowStockAlert: number
  status: ProductStatus
}

type ProductFormInput = Omit<
  ProductForm,
  "purchasePrice" | "sellingPrice" | "stockQuantity" | "lowStockAlert"
> & {
  purchasePrice: unknown
  sellingPrice: unknown
  stockQuantity: unknown
  lowStockAlert: unknown
}

const defaultFormValues: ProductForm = {
  name: "",
  sku: "",
  barcode: "",
  categoryId: "",
  purchasePrice: 0,
  sellingPrice: 0,
  stockQuantity: 0,
  lowStockAlert: 10,
  status: "ACTIVE",
}

export default function ProductsPage() {
  const t = useTranslations()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [paginationMeta, setPaginationMeta] =
    useState<PaginatedResponse<Product>["meta"]>(defaultPaginationMeta)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [searchInput, setSearchInput] = useState("")
  const [activeSearch, setActiveSearch] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const productSchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("store.productNameRequired"))
          .max(200),
        sku: z.string().trim().min(1, t("store.skuRequired")).max(100),
        barcode: z.string().max(100),
        categoryId: z.string(),
        purchasePrice: z.coerce
          .number({ message: t("store.enterPurchasePrice") })
          .min(0, t("store.priceMustBeNonNegative")),
        sellingPrice: z.coerce
          .number({ message: t("store.enterSellingPrice") })
          .min(0, t("store.priceMustBeNonNegative")),
        stockQuantity: z.coerce
          .number()
          .int()
          .min(0, t("store.stockMustBeNonNegative")),
        lowStockAlert: z.coerce
          .number()
          .int()
          .min(0, t("store.lowStockMustBeNonNegative")),
        status: z.enum(productStatuses, {
          message: t("store.selectStatus"),
        }),
      }) satisfies z.ZodType<ProductForm>,
    [t],
  )

  const statusOptions = useMemo(
    () => [
      { value: "ALL" as const, label: t("allStatuses") },
      { value: "ACTIVE" as const, label: t("store.active") },
      { value: "INACTIVE" as const, label: t("store.inactive") },
    ],
    [t],
  )

  const categoryOptions = useMemo(
    () => [
      { value: "", label: t("store.allCategories") },
      ...categories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories, t],
  )

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<ProductFormInput, unknown, ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultFormValues,
  })

  const statusValue = useWatch({ control, name: "status" })
  const categoryValue = useWatch({ control, name: "categoryId" })

  useEffect(() => {
    let ignore = false

    async function fetchAll() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const [productsRes, categoriesList] = await Promise.all([
          storeProductService.listPaginated({
            page,
            limit,
            ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
            ...(activeSearch ? { search: activeSearch } : {}),
          }),
          storeCategoryService.list(),
        ])

        if (!ignore) {
          setProducts(productsRes.data)
          setPaginationMeta(productsRes.meta)
          setCategories(categoriesList)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(getStoreErrorMessage(error))
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void fetchAll()

    return () => {
      ignore = true
    }
  }, [limit, page, statusFilter, activeSearch])

  async function loadProducts() {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await storeProductService.listPaginated({
        page,
        limit,
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        ...(activeSearch ? { search: activeSearch } : {}),
      })
      setProducts(response.data)
      setPaginationMeta(response.meta)
    } catch (error) {
      setErrorMessage(getStoreErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  function handleSearch() {
    setActiveSearch(searchInput.trim())
    setPage(1)
  }

  function openCreateDialog() {
    setEditingProduct(null)
    setFormError(null)
    reset(defaultFormValues)
    setIsDialogOpen(true)
  }

  function openEditDialog(product: Product) {
    setEditingProduct(product)
    setFormError(null)
    reset({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode ?? "",
      categoryId: product.categoryId ?? "",
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      stockQuantity: product.stockQuantity,
      lowStockAlert: product.lowStockAlert,
      status: product.status,
    })
    setIsDialogOpen(true)
  }

  async function onSubmit(values: ProductForm) {
    setFormError(null)

    try {
      const payload: ProductPayload = {
        name: values.name.trim(),
        sku: values.sku.trim(),
        barcode: values.barcode?.trim() || undefined,
        categoryId: values.categoryId || undefined,
        purchasePrice: values.purchasePrice,
        sellingPrice: values.sellingPrice,
        stockQuantity: values.stockQuantity,
        lowStockAlert: values.lowStockAlert,
        status: values.status,
      }

      if (editingProduct) {
        const updated = await storeProductService.update(
          editingProduct.id,
          payload,
        )
        setProducts((current) =>
          current.map((p) => (p.id === updated.id ? updated : p)),
        )
      } else {
        const created = await storeProductService.create(payload)
        setProducts((current) => [created, ...current])
      }

      setIsDialogOpen(false)
      setEditingProduct(null)
      reset(defaultFormValues)
    } catch (error) {
      setFormError(getStoreErrorMessage(error))
    }
  }

  async function deleteProduct() {
    if (!productToDelete) return

    setDeleteError(null)
    setDeletingId(productToDelete.id)

    try {
      await storeProductService.remove(productToDelete.id)
      setProducts((current) =>
        current.filter((p) => p.id !== productToDelete.id),
      )
      setProductToDelete(null)
    } catch (error) {
      setDeleteError(getStoreErrorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{t("store.productsTitle")}</CardTitle>
            <CardDescription>{t("store.productsDescription")}</CardDescription>
          </div>
          <CardAction className="flex flex-wrap justify-end gap-2">
            <MobileFilterDrawer
              activeCount={
                (activeSearch ? 1 : 0) +
                (statusFilter !== "ALL" ? 1 : 0)
              }
              onApply={handleSearch}
              onClear={() => {
                setSearchInput("")
                setActiveSearch("")
                setStatusFilter("ALL")
                setPage(1)
              }}
              triggerClassName="sm:hidden"
            >
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-none">{t("store.searchProducts")}</p>
                <Input
                  placeholder={t("store.searchProducts")}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-none">{t("status")}</p>
                <Select
                  items={statusOptions}
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as StatusFilter)}
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
            </MobileFilterDrawer>
            <div className="hidden items-center gap-1 sm:flex">
              <Input
                className="h-9 w-44"
                placeholder={t("store.searchProducts")}
                ref={searchRef}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch()
                }}
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
            <div className="hidden sm:block">
              <Select
                items={statusOptions}
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as StatusFilter)
                  setPage(1)
                }}
              >
                <SelectTrigger
                  aria-label={t("store.filterByStatus")}
                  size="sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
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
            <Button onClick={openCreateDialog}>
              <PlusIcon data-icon="inline-start" />
              {t("store.addProduct")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("store.couldNotLoadProducts")}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
              <Button
                className="mt-3 w-fit"
                onClick={() => void loadProducts()}
                size="sm"
                type="button"
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
                  <TableHead>{t("store.product")}</TableHead>
                  <TableHead>{t("store.sku")}</TableHead>
                  <TableHead>{t("store.category")}</TableHead>
                  <TableHead>{t("store.sellingPrice")}</TableHead>
                  <TableHead>{t("store.stock")}</TableHead>
                  <TableHead>{t("store.miniBarUsage")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <ProductTableStateRow
                    colSpan={8}
                    message={t("store.loadingProducts")}
                  />
                ) : products.length ? (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                            <ShoppingBagIcon className="size-4 text-muted-foreground" />
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <span className="font-medium">{product.name}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {product.barcode ?? product.id}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {product.sku}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.category?.name ?? (
                          <span className="italic">{t("notProvided")}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatCurrency(product.sellingPrice)}
                      </TableCell>
                      <TableCell>
                        <StockBadge product={product} />
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {product.miniBarUsageCount}
                      </TableCell>
                      <TableCell>
                        <ProductStatusBadge status={product.status} t={t} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            aria-label={t("store.editProductAria", {
                              name: product.name,
                            })}
                            onClick={() => openEditDialog(product)}
                            size="icon-sm"
                            type="button"
                            variant="outline"
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            aria-label={t("store.deleteProductAria", {
                              name: product.name,
                            })}
                            onClick={() => {
                              setDeleteError(null)
                              setProductToDelete(product)
                            }}
                            size="icon-sm"
                            type="button"
                            variant="destructive"
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <ProductTableStateRow
                    colSpan={8}
                    message={t("store.noProductsFound")}
                  />
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("store.loadingProducts")}
              </p>
            ) : products.length ? (
              products.map((product) => (
                <div
                  key={product.id}
                  className="flex flex-col gap-2 rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium">{product.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {product.sku}
                      </span>
                    </div>
                    <ProductStatusBadge status={product.status} t={t} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {t("store.category")}:{" "}
                      <span className="font-medium text-foreground">
                        {product.category?.name ?? "—"}
                      </span>
                    </span>
                    <span>·</span>
                    <span>
                      {t("store.sellingPrice")}:{" "}
                      <span className="font-mono font-medium text-foreground">
                        {formatCurrency(product.sellingPrice)}
                      </span>
                    </span>
                    <span>·</span>
                    <StockBadge product={product} />
                    <span>·</span>
                    <span>
                      {t("store.miniBarUsage")}:{" "}
                      <span className="font-mono font-medium text-foreground">
                        {product.miniBarUsageCount}
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <ActionMenu
                      items={[
                        { label: t("store.editProduct"), icon: <PencilIcon />, onClick: () => openEditDialog(product) },
                        { label: t("store.deleteProduct"), icon: <Trash2Icon />, onClick: () => { setDeleteError(null); setProductToDelete(product) }, variant: "destructive" },
                      ]}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("store.noProductsFound")}
              </p>
            )}
          </div>

          <Pagination
            limit={paginationMeta.limit}
            page={paginationMeta.page}
            total={paginationMeta.total}
            totalPages={paginationMeta.totalPages}
            onLimitChange={(nextLimit) => {
              setLimit(nextLimit)
              setPage(1)
            }}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) setFormError(null)
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProduct
                ? t("store.editProduct")
                : t("store.createProduct")}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? t("store.updateProductDescription")
                : t("store.createProductDescription")}
            </DialogDescription>
          </DialogHeader>
          <form className="contents" onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              {formError ? (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>{t("store.productCouldNotBeSaved")}</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}

              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="productName">
                  {t("store.productName")}
                </FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.name)}
                  id="productName"
                  placeholder={t("store.productNamePlaceholder")}
                  {...register("name")}
                />
                <FieldError>{errors.name?.message}</FieldError>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field data-invalid={Boolean(errors.sku)}>
                  <FieldLabel htmlFor="productSku">{t("store.sku")}</FieldLabel>
                  <Input
                    aria-invalid={Boolean(errors.sku)}
                    id="productSku"
                    placeholder="SKU-001"
                    {...register("sku")}
                  />
                  <FieldError>{errors.sku?.message}</FieldError>
                </Field>

                <Field data-invalid={Boolean(errors.barcode)}>
                  <FieldLabel htmlFor="productBarcode">
                    {t("store.barcode")}
                  </FieldLabel>
                  <Input
                    aria-invalid={Boolean(errors.barcode)}
                    id="productBarcode"
                    placeholder={t("store.optional")}
                    {...register("barcode")}
                  />
                  <FieldError>{errors.barcode?.message}</FieldError>
                </Field>
              </div>

              <Field data-invalid={Boolean(errors.categoryId)}>
                <FieldLabel htmlFor="productCategory">
                  {t("store.category")}
                </FieldLabel>
                <Select
                  items={categoryOptions}
                  value={categoryValue ?? ""}
                  onValueChange={(value) =>
                    setValue("categoryId", value ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger
                    aria-invalid={Boolean(errors.categoryId)}
                    id="productCategory"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {categoryOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError>{errors.categoryId?.message}</FieldError>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field data-invalid={Boolean(errors.purchasePrice)}>
                  <FieldLabel htmlFor="purchasePrice">
                    {t("store.purchasePrice")}
                  </FieldLabel>
                  <Input
                    aria-invalid={Boolean(errors.purchasePrice)}
                    id="purchasePrice"
                    min="0"
                    placeholder="0.00"
                    step="0.01"
                    type="number"
                    {...register("purchasePrice")}
                  />
                  <FieldError>{errors.purchasePrice?.message}</FieldError>
                </Field>

                <Field data-invalid={Boolean(errors.sellingPrice)}>
                  <FieldLabel htmlFor="sellingPrice">
                    {t("store.sellingPrice")}
                  </FieldLabel>
                  <Input
                    aria-invalid={Boolean(errors.sellingPrice)}
                    id="sellingPrice"
                    min="0"
                    placeholder="0.00"
                    step="0.01"
                    type="number"
                    {...register("sellingPrice")}
                  />
                  <FieldError>{errors.sellingPrice?.message}</FieldError>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field data-invalid={Boolean(errors.stockQuantity)}>
                  <FieldLabel htmlFor="stockQuantity">
                    {t("store.stockQuantity")}
                  </FieldLabel>
                  <Input
                    aria-invalid={Boolean(errors.stockQuantity)}
                    id="stockQuantity"
                    min="0"
                    type="number"
                    {...register("stockQuantity")}
                  />
                  <FieldError>{errors.stockQuantity?.message}</FieldError>
                </Field>

                <Field data-invalid={Boolean(errors.lowStockAlert)}>
                  <FieldLabel htmlFor="lowStockAlert">
                    {t("store.lowStockAlert")}
                  </FieldLabel>
                  <Input
                    aria-invalid={Boolean(errors.lowStockAlert)}
                    id="lowStockAlert"
                    min="0"
                    type="number"
                    {...register("lowStockAlert")}
                  />
                  <FieldError>{errors.lowStockAlert?.message}</FieldError>
                </Field>
              </div>

              <Field data-invalid={Boolean(errors.status)}>
                <FieldLabel htmlFor="productStatus">{t("status")}</FieldLabel>
                <Select
                  items={[
                    { value: "ACTIVE", label: t("store.active") },
                    { value: "INACTIVE", label: t("store.inactive") },
                  ]}
                  value={statusValue ?? "ACTIVE"}
                  onValueChange={(value) =>
                    setValue("status", value as ProductStatus, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger
                    aria-invalid={Boolean(errors.status)}
                    id="productStatus"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="ACTIVE">{t("store.active")}</SelectItem>
                      <SelectItem value="INACTIVE">
                        {t("store.inactive")}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError>{errors.status?.message}</FieldError>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? t("saving") : t("store.saveProduct")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog
        open={Boolean(productToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setProductToDelete(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("store.deleteProduct")}</DialogTitle>
            <DialogDescription>
              {productToDelete
                ? t("store.deleteProductDescription", {
                    name: productToDelete.name,
                  })
                : t("store.deleteProductFallback")}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("store.productCouldNotBeDeleted")}</AlertTitle>
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button
              disabled={Boolean(deletingId)}
              onClick={() => void deleteProduct()}
              type="button"
              variant="destructive"
            >
              <Trash2Icon data-icon="inline-start" />
              {deletingId ? t("deleting") : t("store.deleteProduct")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ProductTableStateRow({
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

function StockBadge({ product }: { product: Product }) {
  const isLow = product.stockQuantity <= product.lowStockAlert
  const isEmpty = product.stockQuantity === 0

  return (
    <Badge variant={isEmpty ? "destructive" : isLow ? "secondary" : "outline"}>
      {product.stockQuantity}
    </Badge>
  )
}

function ProductStatusBadge({
  status,
  t,
}: {
  status: ProductStatus
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <Badge variant={status === "ACTIVE" ? "default" : "secondary"}>
      {status === "ACTIVE" ? t("store.active") : t("store.inactive")}
    </Badge>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}
