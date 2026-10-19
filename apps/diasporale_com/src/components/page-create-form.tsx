"use client"

/**
 * Créer une page (DG-008) : association, entreprise, média ou communauté.
 * PROPRIÉTAIRE : chantier « gestion des pages ».
 *
 * Réservé aux membres VÉRIFIÉS (règle du moteur, `createPage` en `verifiee`) :
 * l'écran l'explique avant tout formulaire, et le refus du serveur reste
 * traduit si l'état change entre-temps. Une page créée par un membre porte
 * « Communauté » : aucune autorité officielle ne se revendique ici.
 */
import { Button, Card, Field, Input, RadioCard, RadioGroup, Textarea, residenceCountryOptions } from "@diasporale/features"
import {
  MEMBER_PAGE_KINDS,
  PAGE_DESCRIPTION_MAX_LENGTH,
  PAGE_HANDLE_MAX_LENGTH,
  PAGE_NAME_MAX_LENGTH,
  PAGE_SHORT_NAME_MAX_LENGTH,
  pageAssociationTypeRefusal,
  pageCityRefusal,
  pageDescriptionRefusal,
  pageHandleFor,
  pageHandleRefusal,
  pageNameRefusal,
  pageSectorRefusal,
  pageShortNameRefusal,
  type ActionErrorCode,
  type AssociationType,
  type CompanySector,
  type MemberPageKind,
  type MembershipView,
  type PageManagement,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { isCountryCode, type CountryCode } from "@diasporale/domain"
import { zodResolver } from "@hookform/resolvers/zod"
import { BadgeCheckIcon, HandshakeIcon } from "lucide-react"
import NextLink from "next/link"
import { useRouter } from "next/navigation"
import { useId, useMemo, useRef, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { routes } from "@/lib/routes"

import { ErrorNotice } from "./page-admin-parts"
import { PagePresentationFields } from "./page-presentation-fields"

const createSchema = (supportsPresentation: boolean) => z
  .object({
    ownerKind: z.enum(MEMBER_PAGE_KINDS),
    name: z.string(),
    shortName: z.string(),
    handle: z.string(),
    description: z.string(),
    country: z.string().refine((value) => value.length > 0, "page_country_required"),
    city: z.string(),
    associationType: z.string(),
    sector: z.string(),
  })
  .superRefine((values, context) => {
    // Les règles du moteur, dites en codes fermés : l'écran refuse ce que le serveur refuserait.
    const name = pageNameRefusal(values.name)
    if (name) context.addIssue({ code: z.ZodIssueCode.custom, path: ["name"], message: name })
    const shortName = values.shortName.trim() ? pageShortNameRefusal(values.shortName) : null
    if (shortName) context.addIssue({ code: z.ZodIssueCode.custom, path: ["shortName"], message: shortName })
    const description = values.description.trim() ? pageDescriptionRefusal(values.description) : null
    if (description) context.addIssue({ code: z.ZodIssueCode.custom, path: ["description"], message: description })
    // Sans adresse saisie, elle dérive du nom : un nom déjà refusé n'a pas à refuser l'adresse en double.
    if (values.handle.trim() || !name) {
      const handle = pageHandleRefusal(values)
      if (handle) context.addIssue({ code: z.ZodIssueCode.custom, path: ["handle"], message: handle })
    }
    if (values.country && !isCountryCode(values.country)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["country"], message: "page_country_invalid" })
    if (supportsPresentation) {
      const city = pageCityRefusal(values.city)
      if (city) context.addIssue({ code: z.ZodIssueCode.custom, path: ["city"], message: city })
      if (values.ownerKind === "association") {
        const associationType = pageAssociationTypeRefusal(values.ownerKind, values.associationType.trim() || null)
        if (associationType) context.addIssue({ code: z.ZodIssueCode.custom, path: ["associationType"], message: associationType })
      }
      if (values.ownerKind === "company") {
        const sector = pageSectorRefusal(values.ownerKind, values.sector.trim() || null)
        if (sector) context.addIssue({ code: z.ZodIssueCode.custom, path: ["sector"], message: sector })
      }
    }
  })

type CreateValues = z.infer<ReturnType<typeof createSchema>>

/** Le formulaire de création ; la redirection mène à la fiche créée. */
export function PageCreateForm(props: { readonly management: PageManagement; readonly membership: MembershipView; readonly kind: MemberPageKind | null }) {
  const { t, locale } = useDiasporaleT()
  const router = useRouter()
  const id = useId()
  const countries = useMemo(() => residenceCountryOptions(locale), [locale])
  const supportsPresentation = props.management.supportsPresentation === true
  const schema = useMemo(() => createSchema(supportsPresentation), [supportsPresentation])
  const [refusal, setRefusal] = useState<ActionErrorCode | null>(null)
  const running = useRef(false)
  const form = useForm<CreateValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ownerKind: props.kind ?? "association",
      name: "",
      shortName: "",
      handle: "",
      description: "",
      country: props.membership.facet.countryOfResidence,
      city: "",
      associationType: "",
      sector: "",
    },
  })
  const errors = form.formState.errors
  const message = (code: string | undefined) => (code ? t(`errors.${code}`) : undefined)
  const name = useWatch({ control: form.control, name: "name" })
  const handle = useWatch({ control: form.control, name: "handle" })
  const ownerKind = useWatch({ control: form.control, name: "ownerKind" })
  const preview = pageHandleFor({ name, handle })
  const busy = form.formState.isSubmitting

  // La soumission se valide au geste, jamais pendant le rendu.
  const onValid = async (values: CreateValues) => {
    if (running.current) return
    running.current = true
    setRefusal(null)
    try {
      const result = await props.management.createPage({
        ownerKind: values.ownerKind,
        name: values.name,
        country: values.country as CountryCode,
        ...(values.handle.trim() ? { handle: values.handle.trim() } : {}),
        ...(values.shortName.trim() ? { shortName: values.shortName.trim() } : {}),
        ...(values.description.trim() ? { description: values.description.trim() } : {}),
        ...(supportsPresentation && values.city.trim() ? { city: values.city.trim() } : {}),
        ...(supportsPresentation && values.ownerKind === "association" && values.associationType.trim() ? { associationType: values.associationType.trim() as AssociationType } : {}),
        ...(supportsPresentation && values.ownerKind === "company" && values.sector.trim() ? { sector: values.sector.trim() as CompanySector } : {}),
      })
      if (!result.ok) {
        setRefusal(result.code)
        return
      }
      toast.success(t("pageAdmin.create.created"))
      router.push(routes.page(result.value.handle))
    } catch {
      setRefusal("unknown")
    } finally {
      running.current = false
    }
  }

  return (
    <form noValidate onSubmit={(event) => void form.handleSubmit(onValid)(event)} className="flex flex-col gap-5" aria-busy={busy}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("pageAdmin.create.kindLegend")}</legend>
        <Controller
          control={form.control}
          name="ownerKind"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value)
                form.setValue("associationType", "")
                form.setValue("sector", "")
                form.clearErrors(["associationType", "sector"])
              }}
              aria-label={t("pageAdmin.create.kindLegend")}
            >
              {MEMBER_PAGE_KINDS.map((kind) => (
                <RadioCard key={kind} value={kind} disabled={busy}>
                  <span className="block font-medium">{t(`pageAdmin.kind.${kind}`)}</span>
                  <span className="block text-[13px] text-muted-foreground">{t(`pageAdmin.create.kindHint.${kind}`)}</span>
                </RadioCard>
              ))}
            </RadioGroup>
          )}
        />
      </fieldset>

      <Field id={`${id}-nom`} label={t("pageAdmin.create.name")} hint={t("pageAdmin.create.nameHint", { max: PAGE_NAME_MAX_LENGTH })} error={message(errors.name?.message)}>
        {(control) => (
          <Input id={control.id} aria-describedby={control.describedBy} aria-invalid={control.invalid || undefined} maxLength={PAGE_NAME_MAX_LENGTH} autoComplete="organization" disabled={busy} {...form.register("name")} />
        )}
      </Field>

      <Field id={`${id}-sigle`} label={t("pageAdmin.create.shortName")} hint={t("pageAdmin.create.shortNameHint", { max: PAGE_SHORT_NAME_MAX_LENGTH })} error={message(errors.shortName?.message)}>
        {(control) => (
          <Input id={control.id} aria-describedby={control.describedBy} aria-invalid={control.invalid || undefined} maxLength={PAGE_SHORT_NAME_MAX_LENGTH} disabled={busy} {...form.register("shortName")} />
        )}
      </Field>

      <Field
        id={`${id}-adresse`}
        label={t("pageAdmin.create.handle")}
        hint={preview ? t("pageAdmin.create.handlePreview", { handle: preview }) : t("pageAdmin.create.handleHint")}
        error={message(errors.handle?.message)}
      >
        {(control) => (
          <Input
            id={control.id}
            aria-describedby={control.describedBy}
            aria-invalid={control.invalid || undefined}
            maxLength={PAGE_HANDLE_MAX_LENGTH}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
            {...form.register("handle")}
          />
        )}
      </Field>

      <Field id={`${id}-presentation`} label={t("pageAdmin.create.description")} hint={t("pageAdmin.create.descriptionHint", { max: PAGE_DESCRIPTION_MAX_LENGTH })} error={message(errors.description?.message)}>
        {(control) => (
          <Textarea id={control.id} aria-describedby={control.describedBy} aria-invalid={control.invalid || undefined} maxLength={PAGE_DESCRIPTION_MAX_LENGTH} rows={4} disabled={busy} {...form.register("description")} />
        )}
      </Field>

      <Field id={`${id}-pays`} label={t("pageAdmin.create.country")} hint={t("pageAdmin.create.countryHint")} error={message(errors.country?.message)}>
        {(control) => (
          <select
            id={control.id}
            aria-describedby={control.describedBy}
            aria-invalid={control.invalid || undefined}
            disabled={busy}
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus"
            {...form.register("country")}
          >
            <option value="">{t("pageAdmin.create.countryPlaceholder")}</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      {supportsPresentation ? (
        <PagePresentationFields
          id={id}
          ownerKind={ownerKind}
          disabled={busy}
          city={form.register("city")}
          associationType={form.register("associationType")}
          sector={form.register("sector")}
          errors={{ city: errors.city?.message, associationType: errors.associationType?.message, sector: errors.sector?.message }}
        />
      ) : null}

      <p className="rounded-xl bg-muted p-4 text-sm leading-relaxed text-muted-foreground">{t("pageAdmin.create.trustNote")}</p>

      {refusal ? <ErrorNotice code={refusal} /> : null}
      {refusal === "page_verified_required" ? <VerifiedMembershipLinks /> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? t("common.pleaseWait") : t("pageAdmin.create.submit")}
        </Button>
        <Button asChild variant="ghost">
          <NextLink href={routes.myActivity("pages")}>{t("common.cancel")}</NextLink>
        </Button>
      </div>
    </form>
  )
}

/** Ce qui rend une adhésion vérifiée : l'attestation consulaire, ou IDN niveau 2 avec un parrainage. */
export function VerifiedMembershipLinks() {
  const { t } = useDiasporaleT()
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <NextLink href={routes.attestation()}>
          <BadgeCheckIcon aria-hidden />
          {t("pageAdmin.create.verifiedOnly.attestation")}
        </NextLink>
      </Button>
      <Button asChild variant="ghost">
        <NextLink href={routes.sponsorHelp()}>
          <HandshakeIcon aria-hidden />
          {t("pageAdmin.create.verifiedOnly.sponsor")}
        </NextLink>
      </Button>
    </div>
  )
}

/** Avant le formulaire : un membre non vérifié lit pourquoi, et comment le devenir. */
export function VerifiedMembershipRequired(props: { readonly membership: MembershipView }) {
  const { t } = useDiasporaleT()
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="font-display text-xl font-bold">{t("pageAdmin.create.verifiedOnly.title")}</h2>
      <p className="text-[15px] leading-relaxed">
        {t("pageAdmin.create.verifiedOnly.body", { status: t(`membership.status.${props.membership.status}`) })}
      </p>
      <VerifiedMembershipLinks />
    </Card>
  )
}
