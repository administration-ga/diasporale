"use client"

/**
 * L'identité d'une page (DG-008) : nom, sigle, présentation, pays, ville,
 * catégorie, logo et bannière — tenue par ses ADMINISTRATEURS vivants. PROPRIÉTAIRE : chantier
 * « gestion des pages ». L'adresse ne change pas ici (un lien partagé doit
 * toujours aboutir) ; la confiance non plus (elle se décide, tracée).
 */
import { Button, Field, Input, Textarea, residenceCountryOptions } from "@diasporale/features"
import {
  PAGE_DESCRIPTION_MAX_LENGTH,
  PAGE_IMAGE_ACCEPT,
  PAGE_NAME_MAX_LENGTH,
  PAGE_SHORT_NAME_MAX_LENGTH,
  pageAssociationTypeRefusal,
  pageCityRefusal,
  pageDescriptionRefusal,
  pageImageRefusal,
  pageNameRefusal,
  pageSectorRefusal,
  pageShortNameRefusal,
  type ActionErrorCode,
  type AssociationType,
  type CompanySector,
  type ManagedPageDetailView,
  type PageImageSlot,
  type PageImageView,
  type PageManagement,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { isCountryCode, type CountryCode } from "@diasporale/domain"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { ConfirmSheet, ErrorNotice } from "./page-admin-parts"
import { PagePresentationFields } from "./page-presentation-fields"

const identitySchema = (ownerKind: ManagedPageDetailView["ownerKind"], supportsPresentation: boolean) => z
  .object({
    name: z.string(),
    shortName: z.string(),
    description: z.string(),
    country: z.string().refine((value) => value.length > 0, "page_country_required"),
    city: z.string(),
    associationType: z.string(),
    sector: z.string(),
  })
  .superRefine((values, context) => {
    const name = pageNameRefusal(values.name)
    if (name) context.addIssue({ code: z.ZodIssueCode.custom, path: ["name"], message: name })
    const shortName = values.shortName.trim() ? pageShortNameRefusal(values.shortName) : null
    if (shortName) context.addIssue({ code: z.ZodIssueCode.custom, path: ["shortName"], message: shortName })
    const description = values.description.trim() ? pageDescriptionRefusal(values.description) : null
    if (description) context.addIssue({ code: z.ZodIssueCode.custom, path: ["description"], message: description })
    if (values.country && !isCountryCode(values.country)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["country"], message: "page_country_invalid" })
    if (supportsPresentation) {
      const city = pageCityRefusal(values.city)
      if (city) context.addIssue({ code: z.ZodIssueCode.custom, path: ["city"], message: city })
      if (ownerKind === "association") {
        const associationType = pageAssociationTypeRefusal(ownerKind, values.associationType.trim() || null)
        if (associationType) context.addIssue({ code: z.ZodIssueCode.custom, path: ["associationType"], message: associationType })
      }
      if (ownerKind === "company") {
        const sector = pageSectorRefusal(ownerKind, values.sector.trim() || null)
        if (sector) context.addIssue({ code: z.ZodIssueCode.custom, path: ["sector"], message: sector })
      }
    }
  })

type IdentityValues = z.infer<ReturnType<typeof identitySchema>>

export function PageIdentityForm(props: { readonly management: PageManagement; readonly page: ManagedPageDetailView }) {
  const { t, locale } = useDiasporaleT()
  const { page } = props
  const id = useId()
  const countries = useMemo(() => residenceCountryOptions(locale), [locale])
  const supportsPresentation = props.management.supportsPresentation === true
  const schema = useMemo(() => identitySchema(page.ownerKind, supportsPresentation), [page.ownerKind, supportsPresentation])
  const [refusal, setRefusal] = useState<ActionErrorCode | null>(null)
  const running = useRef(false)
  const form = useForm<IdentityValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: page.name,
      shortName: page.shortName ?? "",
      description: page.description ?? "",
      country: page.country ?? "",
      city: page.city ?? "",
      associationType: page.associationType ?? "",
      sector: page.sector ?? "",
    },
  })
  const errors = form.formState.errors
  const message = (code: string | undefined) => (code ? t(`errors.${code}`) : undefined)
  const busy = form.formState.isSubmitting

  // La soumission se valide au geste, jamais pendant le rendu.
  const onValid = async (values: IdentityValues) => {
    if (running.current) return
    running.current = true
    setRefusal(null)
    try {
      const result = await props.management.updateIdentity(page.id, {
        name: values.name,
        shortName: values.shortName.trim() || null,
        description: values.description.trim() || null,
        country: values.country as CountryCode,
        ...(supportsPresentation ? {
          city: values.city.trim() || null,
          ...(page.ownerKind === "association" ? { associationType: values.associationType.trim() ? values.associationType.trim() as AssociationType : null } : {}),
          ...(page.ownerKind === "company" ? { sector: values.sector.trim() ? values.sector.trim() as CompanySector : null } : {}),
        } : {}),
      })
      if (!result.ok) {
        setRefusal(result.code)
        return
      }
      toast.success(t(result.value.changed ? "pageAdmin.identity.saved" : "pageAdmin.identity.unchanged"))
    } catch {
      setRefusal("unknown")
    } finally {
      running.current = false
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form noValidate onSubmit={(event) => void form.handleSubmit(onValid)(event)} className="flex flex-col gap-5" aria-busy={busy}>
        <p className="text-sm text-muted-foreground">{t("pageAdmin.identity.address", { handle: page.handle })}</p>
        <Field id={`${id}-nom`} label={t("pageAdmin.create.name")} hint={t("pageAdmin.create.nameHint", { max: PAGE_NAME_MAX_LENGTH })} error={message(errors.name?.message)}>
          {(control) => (
            <Input id={control.id} aria-describedby={control.describedBy} aria-invalid={control.invalid || undefined} maxLength={PAGE_NAME_MAX_LENGTH} disabled={busy} {...form.register("name")} />
          )}
        </Field>
        <Field id={`${id}-sigle`} label={t("pageAdmin.create.shortName")} hint={t("pageAdmin.create.shortNameHint", { max: PAGE_SHORT_NAME_MAX_LENGTH })} error={message(errors.shortName?.message)}>
          {(control) => (
            <Input id={control.id} aria-describedby={control.describedBy} aria-invalid={control.invalid || undefined} maxLength={PAGE_SHORT_NAME_MAX_LENGTH} disabled={busy} {...form.register("shortName")} />
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
            ownerKind={page.ownerKind}
            disabled={busy}
            city={form.register("city")}
            associationType={form.register("associationType")}
            sector={form.register("sector")}
            errors={{ city: errors.city?.message, associationType: errors.associationType?.message, sector: errors.sector?.message }}
          />
        ) : null}
        <p className="text-[13px] text-muted-foreground">{t("pageAdmin.identity.history")}</p>
        {refusal ? <ErrorNotice code={refusal} /> : null}
        <Button type="submit" className="self-start" disabled={busy}>
          {busy ? t("common.pleaseWait") : t("pageAdmin.identity.save")}
        </Button>
      </form>
      {props.management.setImage ? <PageImages page={page} setImage={props.management.setImage} /> : null}
    </div>
  )
}

function PageImages(props: {
  readonly page: ManagedPageDetailView
  readonly setImage: NonNullable<PageManagement["setImage"]>
}) {
  const { t } = useDiasporaleT()
  return (
    <section aria-labelledby="images-de-la-page" className="flex flex-col gap-4 border-t border-border pt-5">
      <div>
        <h3 id="images-de-la-page" className="font-display text-lg font-bold">{t("pageAdmin.images.title")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("pageAdmin.images.lead")}</p>
      </div>
      <PageImageForm slot="logo" url={props.page.logoUrl} pageId={props.page.id} setImage={props.setImage} />
      <PageImageForm slot="banner" url={props.page.bannerUrl} pageId={props.page.id} setImage={props.setImage} />
    </section>
  )
}

const IMAGE_KEYS = {
  logo: { title: "pageAdmin.images.logo", alt: "pageAdmin.images.logoAlt", choose: "pageAdmin.images.chooseLogo", remove: "pageAdmin.images.removeLogo" },
  banner: { title: "pageAdmin.images.banner", alt: "pageAdmin.images.bannerAlt", choose: "pageAdmin.images.chooseBanner", remove: "pageAdmin.images.removeBanner" },
} as const

function PageImageForm(props: {
  readonly slot: PageImageSlot
  readonly url: string | null
  readonly pageId: string
  readonly setImage: NonNullable<PageManagement["setImage"]>
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const keys = IMAGE_KEYS[props.slot]
  const input = useRef<HTMLInputElement>(null)
  const running = useRef(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [refusal, setRefusal] = useState<ActionErrorCode | null>(null)
  const [delivered, setDelivered] = useState<PageImageView | null>(null)

  const run = async (file: File | null) => {
    if (running.current) return false
    if (file) {
      const code = pageImageRefusal(props.slot, file)
      if (code) {
        setRefusal(code)
        return false
      }
    }
    running.current = true
    setBusy(true)
    setRefusal(null)
    try {
      const result = await props.setImage(props.pageId, props.slot, file)
      if (!result.ok) {
        setRefusal(result.code)
        return false
      }
      setDelivered(result.value)
      toast.success(t(file ? "pageAdmin.images.saved" : "pageAdmin.images.removed"))
      if (input.current) input.current.value = ""
      return true
    } catch {
      setRefusal("unknown")
      return false
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  // L'adresse servie par la garde : la plus récente des deux (réponse du dépôt, ou lecture de la page).
  const url = delivered?.withheld === null && delivered.url ? delivered.url : props.url
  const notice = delivered?.withheld === "fileScanPending" ? "pageAdmin.images.pending" : delivered?.withheld === "fileQuarantined" ? "pageAdmin.images.quarantined" : null
  return (
    <div className="flex flex-col gap-2" aria-busy={busy}>
      <h4 className="text-sm font-semibold">{t(keys.title)}</h4>
      {url ? (
        <img
          src={url}
          alt={t(keys.alt)}
          width={props.slot === "logo" ? 80 : 960}
          height={props.slot === "logo" ? 80 : 280}
          loading="lazy"
          className={props.slot === "logo" ? "size-20 rounded-lg object-cover" : "h-28 w-full rounded-xl object-cover"}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t("pageAdmin.images.none")}</p>
      )}
      {notice ? <p role="status" className="text-sm text-muted-foreground">{t(notice)}</p> : null}
      <Field id={`${id}-fichier`} label={t(keys.choose)}>
        {(control) => (
          <Input
            ref={input}
            id={control.id}
            type="file"
            accept={PAGE_IMAGE_ACCEPT}
            disabled={busy}
            aria-describedby={control.describedBy}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              if (file) void run(file)
            }}
          />
        )}
      </Field>
      {refusal ? <ErrorNotice code={refusal} /> : null}
      {url ? (
        <Button type="button" variant="ghost" className="self-start" disabled={busy} onClick={() => setConfirming(true)}>
          {t(keys.remove)}
        </Button>
      ) : null}
      <ConfirmSheet
        open={confirming}
        onOpenChange={setConfirming}
        title={t(keys.remove)}
        body={t("pageAdmin.images.removeBody")}
        confirm={t(keys.remove)}
        onConfirm={() => run(null)}
      />
    </div>
  )
}
