"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircleIcon,
  CalendarIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
  WalletIcon,
} from "lucide-react"

import { ActionMenu } from "@/components/app/action-menu"
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
import { MobileFilterDrawer } from "@/components/app/mobile-filter-drawer"
import {
  expenseCategories,
  expensePaymentMethods,
  expenseService,
  getExpenseErrorMessage,
  type Expense,
  type ExpenseCategory,
  type ExpensePayload,
  type ExpensePaymentMethod,
} from "@/lib/expense"

type CategoryFilter = "ALL" | ExpenseCategory
type MethodFilter = "ALL" | ExpensePaymentMethod

type ExpenseForm = {
  title: string
  category: ExpenseCategory | ""
  amount: string
  expenseDate: string
  paymentMethod: ExpensePaymentMethod | ""
  note: string
}

const emptyForm: ExpenseForm = {
  title: "",
  category: "",
  amount: "",
  expenseDate: new Date().toISOString().slice(0, 10),
  paymentMethod: "",
  note: "",
}

export default function ExpensesPage() {
  const t = useTranslations()
  const router = useRouter()

  // ─── List state ───
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [paginationMeta, setPaginationMeta] =
    useState<PaginatedResponse<Expense>["meta"]>(defaultPaginationMeta)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState("")
  const [activeSearch, setActiveSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL")
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("ALL")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [activeDateFrom, setActiveDateFrom] = useState("")
  const [activeDateTo, setActiveDateTo] = useState("")

  // ─── Dialog state ───
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [form, setForm] = useState<ExpenseForm>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ─── Filter options ───
  const categoryOptions = useMemo(
    () => [
      { value: "ALL" as const, label: t("expenses.allCategories") },
      ...expenseCategories.map((c) => ({
        value: c,
        label: t(`expenses.category.${c}`),
      })),
    ],
    [t],
  )

  const methodOptions = useMemo(
    () => [
      { value: "ALL" as const, label: t("expenses.allPaymentMethods") },
      ...expensePaymentMethods.map((m) => ({
        value: m,
        label: t(`expenses.paymentMethod.${m}`),
      })),
    ],
    [t],
  )

  // ─── Load list ───
  useEffect(() => {
    let ignore = false

    async function fetchExpenses() {
      setIsLoading(true)
      setErrorMessage(null)
      try {
        const response = await expenseService.listPaginated({
          page,
          limit,
          ...(activeSearch ? { search: activeSearch } : {}),
          ...(categoryFilter !== "ALL" ? { category: categoryFilter } : {}),
          ...(methodFilter !== "ALL" ? { paymentMethod: methodFilter } : {}),
          ...(activeDateFrom ? { startDate: activeDateFrom } : {}),
          ...(activeDateTo ? { endDate: activeDateTo } : {}),
        })
        if (!ignore) {
          setExpenses(response.data)
          setPaginationMeta(response.meta)
        }
      } catch (error) {
        if (!ignore) setErrorMessage(getExpenseErrorMessage(error))
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    void fetchExpenses()
    return () => {
      ignore = true
    }
  }, [page, limit, activeSearch, categoryFilter, methodFilter, activeDateFrom, activeDateTo])

  function handleSearch() {
    setActiveSearch(searchInput.trim())
    setActiveDateFrom(dateFrom)
    setActiveDateTo(dateTo)
    setPage(1)
  }

  // ─── Dialog helpers ───
  function openCreateDialog() {
    setDialogMode("create")
    setEditingExpense(null)
    setForm(emptyForm)
    setFormError(null)
    setIsDialogOpen(true)
  }

  // Opens the create dialog when navigated here from the mobile FAB.
  useEffect(() => {
    function run() {
      if (new URLSearchParams(window.location.search).get("action") === "new") {
        openCreateDialog()
        router.replace("/expenses", { scroll: false })
      }
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openEditDialog(expense: Expense) {
    setDialogMode("edit")
    setEditingExpense(expense)
    setForm({
      title: expense.title,
      category: expense.category,
      amount: String(expense.amount),
      expenseDate: expense.expenseDate.slice(0, 10),
      paymentMethod: expense.paymentMethod,
      note: expense.note ?? "",
    })
    setFormError(null)
    setIsDialogOpen(true)
  }

  function setField<K extends keyof ExpenseForm>(key: K, value: ExpenseForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function validateForm(): string | null {
    if (!form.title.trim()) return t("expenses.titleRequired")
    if (!form.category) return t("expenses.categoryRequired")
    const amt = Number(form.amount)
    if (!form.amount || isNaN(amt) || amt <= 0) return t("expenses.amountRequired")
    if (!form.expenseDate) return t("expenses.dateRequired")
    if (!form.paymentMethod) return t("expenses.paymentMethodRequired")
    return null
  }

  async function handleSave() {
    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }
    setFormError(null)
    setIsSubmitting(true)

    const payload: ExpensePayload = {
      title: form.title.trim(),
      category: form.category as ExpenseCategory,
      amount: Number(form.amount),
      expenseDate: form.expenseDate,
      paymentMethod: form.paymentMethod as ExpensePaymentMethod,
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
    }

    try {
      if (dialogMode === "create") {
        const created = await expenseService.create(payload)
        setExpenses((prev) => [created, ...prev])
      } else if (editingExpense) {
        const updated = await expenseService.update(editingExpense.id, payload)
        setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
      }
      setIsDialogOpen(false)
    } catch (error) {
      setFormError(getExpenseErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteError(null)
    setIsDeleting(true)

    try {
      await expenseService.remove(deleteTarget.id)
      setExpenses((prev) => prev.filter((e) => e.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (error) {
      setDeleteError(getExpenseErrorMessage(error))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{t("expenses.expensesTitle")}</CardTitle>
            <CardDescription>{t("expenses.expensesDescription")}</CardDescription>
          </div>
          <CardAction>
            <MobileFilterDrawer
              activeCount={
                (activeSearch ? 1 : 0) +
                (categoryFilter !== "ALL" ? 1 : 0) +
                (methodFilter !== "ALL" ? 1 : 0) +
                (activeDateFrom || activeDateTo ? 1 : 0)
              }
              onApply={handleSearch}
              onClear={() => {
                setSearchInput("")
                setActiveSearch("")
                setCategoryFilter("ALL")
                setMethodFilter("ALL")
                setDateFrom("")
                setDateTo("")
                setActiveDateFrom("")
                setActiveDateTo("")
                setPage(1)
              }}
              triggerClassName="md:hidden"
            >
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-none">{t("expenses.searchExpenses")}</p>
                <Input
                  placeholder={t("expenses.searchExpenses")}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-none">{t("expenses.expenseCategory")}</p>
                <Select
                  items={categoryOptions}
                  value={categoryFilter}
                  onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}
                >
                  <SelectTrigger>
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
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-none">{t("expenses.expensePaymentMethod")}</p>
                <Select
                  items={methodOptions}
                  value={methodFilter}
                  onValueChange={(v) => setMethodFilter(v as MethodFilter)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {methodOptions.map((opt) => (
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
            <Button className="hidden md:inline-flex" onClick={openCreateDialog}>
              <PlusIcon data-icon="inline-start" />
              {t("expenses.newExpense")}
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {/* ── Filters (desktop only) ── */}
          <div className="hidden flex-wrap items-end gap-2 md:flex">
            <div className="flex gap-1">
              <Input
                className="h-9 w-44"
                placeholder={t("expenses.searchExpenses")}
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

            <Select
              items={categoryOptions}
              value={categoryFilter}
              onValueChange={(v) => {
                setCategoryFilter(v as CategoryFilter)
                setPage(1)
              }}
            >
              <SelectTrigger size="sm" className="w-40">
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

            <Select
              items={methodOptions}
              value={methodFilter}
              onValueChange={(v) => {
                setMethodFilter(v as MethodFilter)
                setPage(1)
              }}
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {methodOptions.map((opt) => (
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

          {/* ── Error Banner ── */}
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("expenses.couldNotLoadExpenses")}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
              <Button
                className="mt-3 w-fit"
                onClick={() => setPage((p) => p)}
                size="sm"
                variant="outline"
              >
                <RefreshCwIcon data-icon="inline-start" />
                {t("retry")}
              </Button>
            </Alert>
          ) : null}

          {/* ── Desktop Table ── */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("expenses.expenseTitle")}</TableHead>
                  <TableHead>{t("expenses.expenseCategory")}</TableHead>
                  <TableHead>{t("expenses.expenseAmount")}</TableHead>
                  <TableHead>{t("expenses.expenseDate")}</TableHead>
                  <TableHead>{t("expenses.expensePaymentMethod")}</TableHead>
                  <TableHead>{t("expenses.expenseNote")}</TableHead>
                  <TableHead>{t("store.createdBy")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <ExpenseTableStateRow colSpan={8} message={t("expenses.loadingExpenses")} />
                ) : expenses.length ? (
                  expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.title}</TableCell>
                      <TableCell>
                        <ExpenseCategoryBadge category={expense.category} t={t} />
                      </TableCell>
                      <TableCell className="font-mono font-semibold">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(expense.expenseDate)}
                      </TableCell>
                      <TableCell>
                        {t(`expenses.paymentMethod.${expense.paymentMethod}`)}
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-muted-foreground">
                        {expense.note ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {expense.createdBy.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            aria-label={t("expenses.editExpenseAria")}
                            onClick={() => openEditDialog(expense)}
                            size="icon-sm"
                            type="button"
                            variant="outline"
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            aria-label={t("expenses.deleteExpenseAria")}
                            onClick={() => {
                              setDeleteError(null)
                              setDeleteTarget(expense)
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
                  <ExpenseTableStateRow colSpan={8} message={t("expenses.noExpensesFound")} />
                )}
              </TableBody>
            </Table>
          </div>

          {/* ── Mobile Cards ── */}
          <div className="flex flex-col gap-3 md:hidden">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("expenses.loadingExpenses")}
              </p>
            ) : expenses.length ? (
              expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex flex-col gap-3 rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="font-medium">{expense.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(expense.expenseDate)} · {expense.createdBy.name}
                      </span>
                    </div>
                    <ExpenseCategoryBadge category={expense.category} t={t} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-mono font-semibold">
                      {formatCurrency(expense.amount)}
                    </span>
                    <span className="text-muted-foreground">
                      {t(`expenses.paymentMethod.${expense.paymentMethod}`)}
                    </span>
                  </div>
                  {expense.note ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {expense.note}
                    </p>
                  ) : null}
                  <div className="flex justify-end">
                    <ActionMenu
                      items={[
                        { label: t("expenses.editExpense"), icon: <PencilIcon />, onClick: () => openEditDialog(expense) },
                        { label: t("expenses.deleteExpense"), icon: <Trash2Icon />, onClick: () => { setDeleteError(null); setDeleteTarget(expense) }, variant: "destructive" },
                      ]}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("expenses.noExpensesFound")}
              </p>
            )}
          </div>

          <Pagination
            limit={paginationMeta.limit}
            page={paginationMeta.page}
            total={paginationMeta.total}
            totalPages={paginationMeta.totalPages}
            onLimitChange={(next) => {
              setLimit(next)
              setPage(1)
            }}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* ── Create / Edit Expense Dialog ── */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) setIsDialogOpen(false)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WalletIcon className="size-5" />
              {dialogMode === "create"
                ? t("expenses.newExpense")
                : t("expenses.editExpense")}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create"
                ? t("expenses.createExpenseDescription")
                : t("expenses.updateExpenseDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {formError ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>{t("expenses.expenseCouldNotBeSaved")}</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expTitle">
                {t("expenses.expenseTitle")} *
              </Label>
              <Input
                id="expTitle"
                placeholder={t("expenses.expenseTitlePlaceholder")}
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expCategory">
                {t("expenses.expenseCategory")} *
              </Label>
              <Select
                items={expenseCategories.map((c) => ({
                  value: c,
                  label: t(`expenses.category.${c}`),
                }))}
                value={form.category}
                onValueChange={(v) => setField("category", v as ExpenseCategory)}
              >
                <SelectTrigger id="expCategory">
                  <SelectValue placeholder={t("expenses.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {expenseCategories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`expenses.category.${c}`)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Amount + Date side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="expAmount">
                  {t("expenses.expenseAmount")} *
                </Label>
                <Input
                  id="expAmount"
                  min="0.01"
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={form.amount}
                  onChange={(e) => setField("amount", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="expDate">
                  {t("expenses.expenseDate")} *
                </Label>
                <Input
                  id="expDate"
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setField("expenseDate", e.target.value)}
                />
              </div>
            </div>

            {/* Payment Method */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expMethod">
                {t("expenses.expensePaymentMethod")} *
              </Label>
              <Select
                items={expensePaymentMethods.map((m) => ({
                  value: m,
                  label: t(`expenses.paymentMethod.${m}`),
                }))}
                value={form.paymentMethod}
                onValueChange={(v) => setField("paymentMethod", v as ExpensePaymentMethod)}
              >
                <SelectTrigger id="expMethod">
                  <SelectValue placeholder={t("expenses.selectPaymentMethod")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {expensePaymentMethods.map((m) => (
                      <SelectItem key={m} value={m}>
                        {t(`expenses.paymentMethod.${m}`)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Note */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expNote">
                {t("expenses.expenseNote")}
              </Label>
              <Textarea
                id="expNote"
                placeholder={t("expenses.expenseNotePlaceholder")}
                rows={3}
                value={form.note}
                onChange={(e) => setField("note", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button
              disabled={isSubmitting}
              onClick={() => void handleSave()}
              type="button"
            >
              {isSubmitting
                ? t("expenses.saving")
                : dialogMode === "create"
                  ? t("expenses.createExpense")
                  : t("expenses.saveExpense")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("expenses.confirmDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? t("expenses.confirmDeleteDescription", {
                    title: deleteTarget.title,
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>

          {deleteError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("expenses.expenseCouldNotBeDeleted")}</AlertTitle>
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
              <Trash2Icon data-icon="inline-start" />
              {isDeleting ? t("expenses.deleting") : t("expenses.deleteExpense")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Helpers ──

function ExpenseTableStateRow({
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

const categoryVariantMap: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  RENT: "secondary",
  ELECTRICITY: "secondary",
  WATER: "secondary",
  INTERNET: "secondary",
  SALARY: "default",
  MAINTENANCE: "outline",
  SUPPLIES: "outline",
  FOOD: "outline",
  OTHER: "secondary",
}

function ExpenseCategoryBadge({
  category,
  t,
}: {
  category: string
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <Badge variant={categoryVariantMap[category] ?? "secondary"}>
      {t(`expenses.category.${category}`)}
    </Badge>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso))
}
