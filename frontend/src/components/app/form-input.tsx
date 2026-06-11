"use client"

import type * as React from "react"
import type {
  FieldError,
  FieldValues,
  Path,
  UseFormRegister,
} from "react-hook-form"

import {
  Field,
  FieldDescription,
  FieldError as ShadcnFieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type FormInputProps<T extends FieldValues> = {
  id?: string
  label: string
  name: Path<T>
  register: UseFormRegister<T>
  error?: FieldError
  description?: string
  type?: React.HTMLInputTypeAttribute
  placeholder?: string
  autoComplete?: string
}

export function FormInput<T extends FieldValues>({
  id,
  label,
  name,
  register,
  error,
  description,
  type = "text",
  placeholder,
  autoComplete,
}: FormInputProps<T>) {
  const inputId = id ?? name

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Input
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        id={inputId}
        placeholder={placeholder}
        type={type}
        {...register(name)}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <ShadcnFieldError>{error?.message}</ShadcnFieldError>
    </Field>
  )
}
