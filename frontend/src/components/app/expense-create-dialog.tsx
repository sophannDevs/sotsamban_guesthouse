"use client"

import { useEffect, useState } from "react"
import { AlertCircleIcon, WalletIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
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

type ExpenseForm = {
  title: string
  category: ExpenseCategory | ""
  amount: string
  expenseDate: string
  paymentMethod: ExpensePaymentMethod | ""
  note: string
}

function emptyForm(): ExpenseForm {
  return {
    title: "",
    category: "",
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "",
    note: "",
  }
}

export function ExpenseCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (expense: Expense) => void
}) {
  const t = useTranslations()
  const [form, setForm] = useState<ExpenseForm>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return

    function run() {
      setForm(emptyForm())
      setFormError(null)
    }
    void run()
  }, [open])

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
      const created = await expenseService.create(payload)
      onCreated?.(created)
      onOpenChange(false)
    } catch (error) {
      setFormError(getExpenseErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onOpenChange(false)
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WalletIcon className="size-5" />
            {t("expenses.newExpense")}
          </DialogTitle>
          <DialogDescription>
            {t("expenses.createExpenseDescription")}
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-expense-title">{t("expenses.expenseTitle")} *</Label>
            <Input
              id="qa-expense-title"
              placeholder={t("expenses.expenseTitlePlaceholder")}
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-expense-category">
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
              <SelectTrigger id="qa-expense-category">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qa-expense-amount">
                {t("expenses.expenseAmount")} *
              </Label>
              <Input
                id="qa-expense-amount"
                min="0.01"
                placeholder="0.00"
                step="0.01"
                type="number"
                value={form.amount}
                onChange={(e) => setField("amount", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qa-expense-date">{t("expenses.expenseDate")} *</Label>
              <Input
                id="qa-expense-date"
                type="date"
                value={form.expenseDate}
                onChange={(e) => setField("expenseDate", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-expense-method">
              {t("expenses.expensePaymentMethod")} *
            </Label>
            <Select
              items={expensePaymentMethods.map((m) => ({
                value: m,
                label: t(`expenses.paymentMethod.${m}`),
              }))}
              value={form.paymentMethod}
              onValueChange={(v) =>
                setField("paymentMethod", v as ExpensePaymentMethod)
              }
            >
              <SelectTrigger id="qa-expense-method">
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-expense-note">{t("expenses.expenseNote")}</Label>
            <Textarea
              id="qa-expense-note"
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
          <Button disabled={isSubmitting} onClick={() => void handleSave()} type="button">
            {isSubmitting ? t("expenses.saving") : t("expenses.createExpense")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
