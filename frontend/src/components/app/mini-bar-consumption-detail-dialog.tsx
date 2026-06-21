"use client"

import { useState } from "react"
import { BanIcon, CreditCardIcon, RotateCcwIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import {
  MiniBarActionConfirmDialog,
  type MiniBarConfirmAction,
} from "@/components/app/mini-bar-action-confirm-dialog"
import { MiniBarStatusBadge } from "@/components/app/mini-bar-status-badge"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MiniBarConsumption } from "@/lib/mini-bar-consumption"

type MiniBarConsumptionDetailDialogProps = {
  consumption: MiniBarConsumption | null
  onOpenChange: (open: boolean) => void
  onUpdated: (updated: MiniBarConsumption) => void
}

export function MiniBarConsumptionDetailDialog({
  consumption,
  onOpenChange,
  onUpdated,
}: MiniBarConsumptionDetailDialogProps) {
  const t = useTranslations()
  const [confirmAction, setConfirmAction] = useState<MiniBarConfirmAction | null>(null)

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
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

  return (
    <>
      <Dialog open={Boolean(consumption)} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("miniBar.consumptionDetail")}</DialogTitle>
            <DialogDescription>
              {consumption
                ? `${consumption.guest.fullName} · ${t("miniBar.roomLabel", { roomNumber: consumption.room.roomNumber })} · ${formatDateTime(consumption.createdAt)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {consumption ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <MiniBarStatusBadge status={consumption.status} />
                <span className="text-sm text-muted-foreground">
                  {t("miniBar.createdByLabel", { name: consumption.createdBy.name })}
                </span>
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
                  {consumption.items.map((item) => (
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
                  {formatCurrency(consumption.totalAmount)}
                </span>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            {consumption?.status === "DRAFT" ? (
              <>
                <Button
                  onClick={() => setConfirmAction({ type: "cancel", consumption })}
                  type="button"
                  variant="outline"
                >
                  <BanIcon data-icon="inline-start" />
                  {t("miniBar.cancelConsumption")}
                </Button>
                <Button onClick={() => setConfirmAction({ type: "charge", consumption })} type="button">
                  <CreditCardIcon data-icon="inline-start" />
                  {t("miniBar.chargeConsumption")}
                </Button>
              </>
            ) : null}
            {consumption?.status === "CHARGED" ? (
              <Button
                onClick={() => setConfirmAction({ type: "refund", consumption })}
                type="button"
                variant="destructive"
              >
                <RotateCcwIcon data-icon="inline-start" />
                {t("miniBar.refundConsumption")}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MiniBarActionConfirmDialog
        action={confirmAction}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null)
        }}
        onConfirmed={onUpdated}
      />
    </>
  )
}
