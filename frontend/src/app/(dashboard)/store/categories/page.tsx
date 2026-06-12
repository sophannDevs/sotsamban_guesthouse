"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertCircleIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
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
  storeCategoryService,
  type CategoryPayload,
  type ProductCategory,
} from "@/lib/store"

type CategoryForm = CategoryPayload & { name: string }

const defaultFormValues: CategoryForm = { name: "", description: "" }

export default function CategoriesPage() {
  const t = useTranslations()
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [paginationMeta, setPaginationMeta] =
    useState<PaginatedResponse<ProductCategory>["meta"]>(defaultPaginationMeta)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] =
    useState<ProductCategory | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [categoryToDelete, setCategoryToDelete] =
    useState<ProductCategory | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const categorySchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("store.categoryNameRequired"))
          .max(200),
        description: z.string().max(1000).optional(),
      }) satisfies z.ZodType<CategoryForm>,
    [t],
  )

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: defaultFormValues,
  })

  useEffect(() => {
    let ignore = false

    async function fetchCategories() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await storeCategoryService.listPaginated({
          page,
          limit,
        })

        if (!ignore) {
          setCategories(response.data)
          setPaginationMeta(response.meta)
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

    void fetchCategories()

    return () => {
      ignore = true
    }
  }, [limit, page])

  async function loadCategories() {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await storeCategoryService.listPaginated({ page, limit })
      setCategories(response.data)
      setPaginationMeta(response.meta)
    } catch (error) {
      setErrorMessage(getStoreErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  function openCreateDialog() {
    setEditingCategory(null)
    setFormError(null)
    reset(defaultFormValues)
    setIsDialogOpen(true)
  }

  function openEditDialog(category: ProductCategory) {
    setEditingCategory(category)
    setFormError(null)
    reset({ name: category.name, description: category.description ?? "" })
    setIsDialogOpen(true)
  }

  async function onSubmit(values: CategoryForm) {
    setFormError(null)

    try {
      const payload: CategoryPayload = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
      }

      if (editingCategory) {
        const updated = await storeCategoryService.update(
          editingCategory.id,
          payload,
        )
        setCategories((current) =>
          current.map((c) => (c.id === updated.id ? updated : c)),
        )
      } else {
        const created = await storeCategoryService.create(payload)
        setCategories((current) => [created, ...current])
      }

      setIsDialogOpen(false)
      setEditingCategory(null)
      reset(defaultFormValues)
    } catch (error) {
      setFormError(getStoreErrorMessage(error))
    }
  }

  async function deleteCategory() {
    if (!categoryToDelete) return

    setDeleteError(null)
    setDeletingId(categoryToDelete.id)

    try {
      await storeCategoryService.remove(categoryToDelete.id)
      setCategories((current) =>
        current.filter((c) => c.id !== categoryToDelete.id),
      )
      setCategoryToDelete(null)
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
            <CardTitle>{t("store.categoriesTitle")}</CardTitle>
            <CardDescription>{t("store.categoriesDescription")}</CardDescription>
          </div>
          <CardAction>
            <Button onClick={openCreateDialog}>
              <PlusIcon data-icon="inline-start" />
              {t("store.addCategory")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("store.couldNotLoadCategories")}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
              <Button
                className="mt-3 w-fit"
                onClick={() => void loadCategories()}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCwIcon data-icon="inline-start" />
                {t("retry")}
              </Button>
            </Alert>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("store.categoryName")}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t("store.description")}
                </TableHead>
                <TableHead>{t("store.products")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <CategoryTableStateRow
                  message={t("store.loadingCategories")}
                />
              ) : categories.length ? (
                categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                          <PackageIcon className="size-4 text-muted-foreground" />
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <span className="font-medium">{category.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {category.id}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-60 truncate text-muted-foreground sm:table-cell">
                      {category.description ?? (
                        <span className="italic">{t("notProvided")}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{category.productCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          aria-label={t("store.editCategoryAria", {
                            name: category.name,
                          })}
                          onClick={() => openEditDialog(category)}
                          size="icon-sm"
                          type="button"
                          variant="outline"
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          aria-label={t("store.deleteCategoryAria", {
                            name: category.name,
                          })}
                          onClick={() => {
                            setDeleteError(null)
                            setCategoryToDelete(category)
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
                <CategoryTableStateRow
                  message={t("store.noCategoriesFound")}
                />
              )}
            </TableBody>
          </Table>

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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCategory
                ? t("store.editCategory")
                : t("store.createCategory")}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? t("store.updateCategoryDescription")
                : t("store.createCategoryDescription")}
            </DialogDescription>
          </DialogHeader>
          <form className="contents" onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              {formError ? (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>{t("store.categoryCouldNotBeSaved")}</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}

              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="categoryName">
                  {t("store.categoryName")}
                </FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.name)}
                  id="categoryName"
                  placeholder={t("store.categoryNamePlaceholder")}
                  {...register("name")}
                />
                <FieldError>{errors.name?.message}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.description)}>
                <FieldLabel htmlFor="categoryDescription">
                  {t("store.description")}
                </FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.description)}
                  id="categoryDescription"
                  placeholder={t("store.descriptionPlaceholder")}
                  {...register("description")}
                />
                <FieldError>{errors.description?.message}</FieldError>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("cancel")}
              </DialogClose>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? t("saving") : t("store.saveCategory")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog
        open={Boolean(categoryToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setCategoryToDelete(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("store.deleteCategory")}</DialogTitle>
            <DialogDescription>
              {categoryToDelete
                ? t("store.deleteCategoryDescription", {
                    name: categoryToDelete.name,
                  })
                : t("store.deleteCategoryFallback")}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t("store.categoryCouldNotBeDeleted")}</AlertTitle>
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button
              disabled={Boolean(deletingId)}
              onClick={() => void deleteCategory()}
              type="button"
              variant="destructive"
            >
              <Trash2Icon data-icon="inline-start" />
              {deletingId ? t("deleting") : t("store.deleteCategory")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CategoryTableStateRow({ message }: { message: string }) {
  return (
    <TableRow>
      <TableCell
        className="h-28 text-center text-sm text-muted-foreground"
        colSpan={4}
      >
        {message}
      </TableCell>
    </TableRow>
  )
}
