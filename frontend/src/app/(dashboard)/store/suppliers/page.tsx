"use client"

import { useEffect, useState } from "react"
import { AlertCircleIcon, PencilIcon, PlusIcon, RefreshCwIcon, SearchIcon, Trash2Icon } from "lucide-react"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { defaultPaginationMeta, type PaginatedResponse } from "@/lib/api"
import {
  getStoreErrorMessage,
  storeSupplierService,
  type Supplier,
  type SupplierPayload,
} from "@/lib/store"

export default function SuppliersPage() {
  const t = useTranslations()

  // --- List state ---
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [paginationMeta, setPaginationMeta] =
    useState<PaginatedResponse<Supplier>["meta"]>(defaultPaginationMeta)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState("")
  const [activeSearch, setActiveSearch] = useState("")

  // --- Form dialog state ---
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [formValues, setFormValues] = useState<SupplierPayload>({ name: "" })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // --- Delete dialog state ---
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // --- Load suppliers ---
  useEffect(() => {
    let ignore = false

    async function fetchSuppliers() {
      setIsLoading(true)
      setErrorMessage(null)
      try {
        const response = await storeSupplierService.listPaginated({
          page,
          limit,
          ...(activeSearch ? { search: activeSearch } : {}),
        })
        if (!ignore) {
          setSuppliers(response.data)
          setPaginationMeta(response.meta)
        }
      } catch (error) {
        if (!ignore) setErrorMessage(getStoreErrorMessage(error))
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    void fetchSuppliers()
    return () => { ignore = true }
  }, [page, limit, activeSearch])

  function handleSearch() {
    setActiveSearch(searchInput.trim())
    setPage(1)
  }

  function openCreate() {
    setEditingSupplier(null)
    setFormValues({ name: "", phone: "", email: "", address: "" })
    setFormError(null)
    setIsFormOpen(true)
  }

  function openEdit(supplier: Supplier) {
    setEditingSupplier(supplier)
    setFormValues({
      name: supplier.name,
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
    })
    setFormError(null)
    setIsFormOpen(true)
  }

  async function handleSave() {
    if (!formValues.name.trim()) return
    setFormError(null)
    setIsSaving(true)

    try {
      const payload: SupplierPayload = {
        name: formValues.name.trim(),
        phone: formValues.phone?.trim() || undefined,
        email: formValues.email?.trim() || undefined,
        address: formValues.address?.trim() || undefined,
      }

      if (editingSupplier) {
        const updated = await storeSupplierService.update(editingSupplier.id, payload)
        setSuppliers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      } else {
        const created = await storeSupplierService.create(payload)
        setSuppliers((prev) => [created, ...prev])
        setPaginationMeta((m) => ({ ...m, total: m.total + 1 }))
      }

      setIsFormOpen(false)
    } catch (error) {
      setFormError(getStoreErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingSupplier) return
    setDeleteError(null)
    setIsDeleting(true)

    try {
      await storeSupplierService.remove(deletingSupplier.id)
      setSuppliers((prev) => prev.filter((s) => s.id !== deletingSupplier.id))
      setPaginationMeta((m) => ({ ...m, total: Math.max(0, m.total - 1) }))
      setDeletingSupplier(null)
    } catch (error) {
      setDeleteError(getStoreErrorMessage(error))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{t("store.suppliersTitle")}</CardTitle>
            <CardDescription>{t("store.suppliersDescription")}</CardDescription>
          </div>
          <CardAction>
            <Button onClick={openCreate}>
              <PlusIcon data-icon="inline-start" />
              {t("store.addSupplier")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Search */}
          <div className="flex gap-1">
            <Input
              className="h-9 w-52"
              placeholder={t("store.searchSuppliers")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch() }}
            />
            <Button onClick={handleSearch} size="sm" type="button" variant="outline">
              <SearchIcon />
            </Button>
          </div>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("store.couldNotLoadSuppliers")}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
              <Button
                className="mt-3 w-fit"
                onClick={() => { setPage(1) }}
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
                  <TableHead>{t("store.supplierName")}</TableHead>
                  <TableHead>{t("store.supplierPhone")}</TableHead>
                  <TableHead>{t("store.supplierEmail")}</TableHead>
                  <TableHead>{t("store.supplierAddress")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <SupplierTableStateRow colSpan={5} message={t("store.loadingSuppliers")} />
                ) : suppliers.length ? (
                  suppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.phone ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.email ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-muted-foreground">
                        {s.address ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            aria-label={t("store.editSupplierAria", { name: s.name })}
                            onClick={() => openEdit(s)}
                            size="icon-sm"
                            type="button"
                            variant="outline"
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            aria-label={t("store.deleteSupplierAria", { name: s.name })}
                            onClick={() => { setDeleteError(null); setDeletingSupplier(s) }}
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
                  <SupplierTableStateRow colSpan={5} message={t("store.noSuppliersFound")} />
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("store.loadingSuppliers")}
              </p>
            ) : suppliers.length ? (
              suppliers.map((s) => (
                <div key={s.id} className="flex flex-col gap-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium">{s.name}</span>
                      {s.phone ? (
                        <span className="text-xs text-muted-foreground">{s.phone}</span>
                      ) : null}
                      {s.email ? (
                        <span className="text-xs text-muted-foreground">{s.email}</span>
                      ) : null}
                      {s.address ? (
                        <span className="mt-1 text-xs text-muted-foreground">{s.address}</span>
                      ) : null}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        onClick={() => openEdit(s)}
                        size="icon-sm"
                        type="button"
                        variant="outline"
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        onClick={() => { setDeleteError(null); setDeletingSupplier(s) }}
                        size="icon-sm"
                        type="button"
                        variant="destructive"
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("store.noSuppliersFound")}
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

      {/* ── Create / Edit Supplier Dialog ── */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) setIsFormOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? t("store.editSupplier") : t("store.createSupplier")}
            </DialogTitle>
            <DialogDescription>
              {editingSupplier
                ? t("store.updateSupplierDescription")
                : t("store.createSupplierDescription")}
            </DialogDescription>
          </DialogHeader>

          {formError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("store.supplierCouldNotBeSaved")}</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          <FieldGroup>
            <Field>
              <FieldLabel>{t("store.supplierName")}</FieldLabel>
              <Input
                placeholder={t("store.supplierNamePlaceholder")}
                value={formValues.name}
                onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel>{t("store.supplierPhone")}</FieldLabel>
              <Input
                placeholder="e.g. +855 12 345 678"
                type="tel"
                value={formValues.phone ?? ""}
                onChange={(e) => setFormValues((v) => ({ ...v, phone: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel>{t("store.supplierEmail")}</FieldLabel>
              <Input
                placeholder="supplier@example.com"
                type="email"
                value={formValues.email ?? ""}
                onChange={(e) => setFormValues((v) => ({ ...v, email: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel>{t("store.supplierAddress")}</FieldLabel>
              <Textarea
                placeholder={t("store.descriptionPlaceholder")}
                rows={2}
                value={formValues.address ?? ""}
                onChange={(e) => setFormValues((v) => ({ ...v, address: e.target.value }))}
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button
              disabled={!formValues.name.trim() || isSaving}
              onClick={() => void handleSave()}
              type="button"
            >
              {isSaving ? t("saving") : t("store.saveSupplier")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog
        open={Boolean(deletingSupplier)}
        onOpenChange={(open) => { if (!open) { setDeletingSupplier(null); setDeleteError(null) } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("store.deleteSupplier")}</DialogTitle>
            <DialogDescription>
              {deletingSupplier
                ? t("store.deleteSupplierDescription", { name: deletingSupplier.name })
                : t("store.deleteSupplierFallback")}
            </DialogDescription>
          </DialogHeader>

          {deleteError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("store.supplierCouldNotBeDeleted")}</AlertTitle>
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button
              disabled={isDeleting}
              onClick={() => void handleDelete()}
              type="button"
              variant="destructive"
            >
              {isDeleting ? t("deleting") : t("store.deleteSupplier")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SupplierTableStateRow({
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
