"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircleIcon, LogInIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { useAuth } from "@/components/app/auth-provider"
import { FormInput } from "@/components/app/form-input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import { getAuthErrorMessage, type LoginPayload } from "@/lib/auth"

type LoginForm = LoginPayload

export default function LoginPage() {
  const router = useRouter()
  const t = useTranslations()
  const { isAuthenticated, isLoading, login } = useAuth()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const loginSchema = z.object({
    email: z.string().email(t("emailValidation")),
    password: z.string().min(6, t("passwordValidation")),
  }) satisfies z.ZodType<LoginPayload>
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard")
    }
  }, [isAuthenticated, isLoading, router])

  async function onSubmit(values: LoginForm) {
    setErrorMessage(null)

    try {
      await login(values)
      router.replace("/dashboard")
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error, t("loginErrorDescription")))
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4 text-foreground sm:p-6">
      <section className="grid w-full max-w-5xl items-stretch gap-5 lg:grid-cols-[1fr_420px]">
        <div className="hidden min-h-[540px] flex-col justify-between rounded-xl border bg-card p-8 text-card-foreground shadow-sm lg:flex">
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-muted-foreground">
              Sot Samban GuestHouse
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight">
              {t("loginHeroTitle")}
            </h1>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            {[
              ["24", t("rooms")],
              ["75%", t("occupancy")],
              ["7", t("arrivals")],
            ].map(([value, label]) => (
              <div className="rounded-lg border bg-muted/40 p-4" key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-2 font-mono text-2xl font-semibold">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("staffLogin")}</CardTitle>
            <CardDescription>
              {t("loginDescription")}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent>
              <FieldGroup>
                {errorMessage ? (
                  <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertTitle>{t("loginFailed")}</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                ) : null}
                <FormInput<LoginForm>
                  autoComplete="email"
                  error={errors.email}
                  label={t("email")}
                  name="email"
                  register={register}
                  type="email"
                />
                <FormInput<LoginForm>
                  autoComplete="current-password"
                  error={errors.password}
                  label={t("password")}
                  name="password"
                  register={register}
                  type="password"
                />
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {t("backendApiRequired")}
              </p>
              <Button disabled={isSubmitting} type="submit">
                <LogInIcon data-icon="inline-start" />
                {isSubmitting ? t("signingIn") : t("login")}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </section>
    </main>
  )
}
