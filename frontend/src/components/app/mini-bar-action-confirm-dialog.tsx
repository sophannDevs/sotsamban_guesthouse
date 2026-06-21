"use client"

import { useState } from "react"
import { AlertCircleIcon, BanIcon, CreditCardIcon, RotateCcwIcon } from "lucide-react"
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
import {
  getMiniBarErrorMessage,
  miniBarConsumptionService,
  type MiniBarConsumption,
} from "@/lib/mini-bar-consumption"

export type MiniBarConfirmActionType = "charge" | "cancel" | "refund"

export type MiniBarConfirmAction = {
  type: MiniBarConfirmActionType
  consumption: MiniBarConsumption
}

type MiniBarActionConfirmDialogProps = {
  action: MiniBarConfirmAction | null
  onOpenChange: (open: boolean) => void
  onConfirmed: (updated: MiniBarConsumption) => void
}

export function MiniBarActionConfirmDialog({
  action,
  onOpenChange,
  onConfirmed,
}: MiniBarActionConfirmDialogProps) {
  const t = useTranslations()
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  async function handleConfirm() {
    if (!action) return
    setActionError(null)
    setActionLoading(true)

    try {
      let updated: MiniBarConsumption
      if (action.type === "charge") {
        updated = await miniBarConsumptionService.charge(action.consumption.id)
      } else if (action.type === "cancel") {
        updated = await miniBarConsumptionService.cancel(action.consumption.id)
      } else {
        updated = await miniBarConsumptionService.refund(action.consumption.id)
      }
      onConfirmed(updated)
      onOpenChange(false)
    } catch (error) {
      setActionError(getMiniBarErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <Dialog
      open={Boolean(action)}
      onOpenChange={(open) => {
        if (!open) setActionError(null)
        onOpenChange(open)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action?.type === "charge"
              ? t("miniBar.confirmChargeTitle")
              : action?.type === "cancel"
                ? t("miniBar.confirmCancelTitle")
                : t("miniBar.confirmRefundTitle")}
          </DialogTitle>
          <DialogDescription>
            {action?.type === "charge"
              ? t("miniBar.confirmChargeDescription")
              : action?.type === "cancel"
                ? t("miniBar.confirmCancelDescription")
                : t("miniBar.confirmRefundDescription")}
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
            onClick={() => void handleConfirm()}
            type="button"
            variant={action?.type === "refund" ? "destructive" : "default"}
          >
            {action?.type === "charge" ? (
              <>
                <CreditCardIcon data-icon="inline-start" />
                {actionLoading ? t("miniBar.charging") : t("miniBar.chargeConsumption")}
              </>
            ) : action?.type === "cancel" ? (
              <>
                <BanIcon data-icon="inline-start" />
                {actionLoading ? t("miniBar.cancelling") : t("miniBar.cancelConsumption")}
              </>
            ) : (
              <>
                <RotateCcwIcon data-icon="inline-start" />
                {actionLoading ? t("miniBar.refunding") : t("miniBar.refundConsumption")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
