"use client"

import { useEffect, useState } from "react"
import { AlertCircleIcon, BellIcon, SaveIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import {
  getSettingsErrorMessage,
  settingsService,
  type NotificationSettingsPayload,
} from "@/lib/settings"

const defaultFormValues: Required<NotificationSettingsPayload> = {
  bookingAlerts: true,
  paymentAlerts: true,
  maintenanceAlerts: true,
  systemAlerts: true,
}

type NotificationSettingKey = keyof typeof defaultFormValues

const notificationSettingFields: Array<{
  key: NotificationSettingKey
  titleKey:
    | "bookingAlerts"
    | "paymentAlerts"
    | "maintenanceAlerts"
    | "systemAlerts"
  descriptionKey:
    | "bookingAlertsDescription"
    | "paymentAlertsDescription"
    | "maintenanceAlertsDescription"
    | "systemAlertsDescription"
}> = [
  {
    key: "bookingAlerts",
    titleKey: "bookingAlerts",
    descriptionKey: "bookingAlertsDescription",
  },
  {
    key: "paymentAlerts",
    titleKey: "paymentAlerts",
    descriptionKey: "paymentAlertsDescription",
  },
  {
    key: "maintenanceAlerts",
    titleKey: "maintenanceAlerts",
    descriptionKey: "maintenanceAlertsDescription",
  },
  {
    key: "systemAlerts",
    titleKey: "systemAlerts",
    descriptionKey: "systemAlertsDescription",
  },
]

export default function NotificationSettingsPage() {
  const t = useTranslations("notificationSettingsPage")
  const [values, setValues] = useState(defaultFormValues)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadSettings() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const settings = await settingsService.getNotificationSettings()

        if (isMounted) {
          setValues({
            bookingAlerts: settings.bookingAlerts,
            paymentAlerts: settings.paymentAlerts,
            maintenanceAlerts: settings.maintenanceAlerts,
            systemAlerts: settings.systemAlerts,
          })
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getSettingsErrorMessage(error))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadSettings()

    return () => {
      isMounted = false
    }
  }, [])

  async function saveSettings() {
    setIsSaving(true)
    setErrorMessage(null)

    try {
      const settings = await settingsService.updateNotificationSettings(values)
      setValues({
        bookingAlerts: settings.bookingAlerts,
        paymentAlerts: settings.paymentAlerts,
        maintenanceAlerts: settings.maintenanceAlerts,
        systemAlerts: settings.systemAlerts,
      })
      toast.success(t("savedSuccessfully"))
    } catch (error) {
      const message = getSettingsErrorMessage(error)
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  function updateValue(key: NotificationSettingKey, checked: boolean) {
    setValues((currentValues) => ({
      ...currentValues,
      [key]: checked,
    }))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex size-11 items-center justify-center rounded-lg border bg-muted/40">
          <BellIcon />
        </div>
        <div className="min-w-0">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {errorMessage ? (
          <Alert className="mb-4" variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>{t("failedToLoad")}</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup className="max-w-2xl">
          {notificationSettingFields.map((field) => (
            <Field
              className="rounded-lg border bg-card p-4 transition-colors has-[[data-slot=switch][data-checked]]:border-primary/40 has-[[data-slot=switch][data-checked]]:bg-primary/5"
              key={field.key}
              orientation="horizontal"
            >
              <FieldContent>
                <FieldLabel htmlFor={field.key}>{t(field.titleKey)}</FieldLabel>
                <FieldDescription>
                  {t(field.descriptionKey)}
                </FieldDescription>
              </FieldContent>
              <Switch
                aria-label={t(field.titleKey)}
                className="w-11"
                checked={values[field.key]}
                disabled={isLoading || isSaving}
                id={field.key}
                onCheckedChange={(checked) => updateValue(field.key, checked)}
              />
            </Field>
          ))}

          <div className="flex justify-end">
            <Button
              disabled={isLoading || isSaving}
              onClick={() => void saveSettings()}
              type="button"
            >
              <SaveIcon data-icon="inline-start" />
              {isSaving ? t("saving") : t("save")}
            </Button>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
