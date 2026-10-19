"use client"

import { Field, Input } from "@diasporale/features"
import type { PageOwnerKind } from "@diasporale/domain"
import { ASSOCIATION_TYPES, COMPANY_SECTORS, PAGE_CITY_MAX_LENGTH } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import type { UseFormRegisterReturn } from "react-hook-form"

/** Les mêmes précisions publiques à la création et dans l'identité de la page. */
export function PagePresentationFields(props: {
  readonly id: string
  readonly ownerKind: PageOwnerKind
  readonly disabled: boolean
  readonly city: UseFormRegisterReturn<"city">
  readonly associationType: UseFormRegisterReturn<"associationType">
  readonly sector: UseFormRegisterReturn<"sector">
  readonly errors: {
    readonly city: string | undefined
    readonly associationType: string | undefined
    readonly sector: string | undefined
  }
}) {
  const { t } = useDiasporaleT()
  const message = (code: string | undefined) => (code ? t(`errors.${code}`) : undefined)
  const category = props.ownerKind === "association"
    ? { field: props.associationType, label: "pagePresentation.fields.associationType", options: ASSOCIATION_TYPES, prefix: "association.type", error: props.errors.associationType }
    : props.ownerKind === "company"
      ? { field: props.sector, label: "pagePresentation.fields.sector", options: COMPANY_SECTORS, prefix: "company.sector", error: props.errors.sector }
      : null

  return (
    <>
      <Field id={`${props.id}-ville`} label={t("pagePresentation.fields.city")} hint={t("pagePresentation.fields.cityHint", { max: PAGE_CITY_MAX_LENGTH })} error={message(props.errors.city)}>
        {(control) => (
          <Input
            id={control.id}
            aria-describedby={control.describedBy}
            aria-invalid={control.invalid || undefined}
            maxLength={PAGE_CITY_MAX_LENGTH}
            disabled={props.disabled}
            {...props.city}
          />
        )}
      </Field>
      {category ? (
        <Field id={`${props.id}-categorie`} label={t(category.label)} hint={t("pagePresentation.fields.categoryHint")} error={message(category.error)}>
          {(control) => (
            <select
              id={control.id}
              aria-describedby={control.describedBy}
              aria-invalid={control.invalid || undefined}
              disabled={props.disabled}
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus"
              {...category.field}
            >
              <option value="">{t("pagePresentation.fields.categoryPlaceholder")}</option>
              {category.options.map((value) => (
                <option key={value} value={value}>{t(`${category.prefix}.${value}`)}</option>
              ))}
            </select>
          )}
        </Field>
      ) : null}
    </>
  )
}
