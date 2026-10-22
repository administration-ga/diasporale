"use client"

/**
 * Briques communes du guichet de modération (PD6 · G9) : libellés fermés, pays
 * de la cible, filtres, aperçu borné du moteur, champ de motif, étape de
 * confirmation des mesures lourdes, refus traduits.
 * PROPRIÉTAIRE : chantier « modération par pays ».
 */
import type { CountryCode } from "@diasporale/domain"
import { Button, CountryTag, Field, PostMediaGrid, Skeleton, Textarea, formatDate, residenceCountryOptions } from "@diasporale/features"
import {
  DESK_REASON_MAX,
  DESK_REASON_MIN,
  DESK_SURFACES,
  DESK_TEAM_NAME_MAX,
  DESK_TEAM_NAME_MIN,
  useOpenCountries,
  type DeskCaseLevel,
  type DeskGround,
  type DeskParty,
  type DeskPreviewView,
  type DeskSanctionKind,
  type DeskSurface,
  type Loadable,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react"
import type { UseFormRegisterReturn } from "react-hook-form"

export const deskSelectClass = "h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus aria-invalid:border-destructive"

/** Les bornes que citent les phrases d'erreur du guichet (motif, nom d'équipe). */
export const DESK_ERROR_VALUES = { min: DESK_REASON_MIN, max: DESK_REASON_MAX, nameMin: DESK_TEAM_NAME_MIN, nameMax: DESK_TEAM_NAME_MAX } as const

/** Les refus d'accès : le guichet se dit alors indisponible, sans rien révéler de plus. */
export const DESK_ACCESS_ERRORS: ReadonlySet<string> = new Set(["not_signed_in", "not_member", "not_found", "status_insufficient", "suspended", "network_unavailable"])

/** Date et heure d'un dossier, dans la langue de l'écran. */
export function deskDateTime(timestamp: number, locale: string): string {
  return formatDate(timestamp, locale, { dateStyle: "medium", timeStyle: "short" })
}

/** Une énumération lisible (« retrait du contenu et suspension »). */
export function deskList(items: readonly string[], locale: string): string {
  try {
    return new Intl.ListFormat(locale, { type: "conjunction" }).format(items)
  } catch {
    return items.join(", ")
  }
}

/** Les libellés des valeurs fermées du guichet. */
export function useDeskLabels() {
  const { t } = useDiasporaleT()
  return {
    surface: (surface: DeskSurface) => t(`moderationDesk.surface.${surface}`),
    ground: (ground: DeskGround) => t(`moderationDesk.ground.${ground}`),
    party: (party: DeskParty) => t(`moderationDesk.party.${party}`),
    sanction: (kind: DeskSanctionKind) => t(`moderationDesk.sanction.${kind}`),
    level: (level: DeskCaseLevel, teamName: string | null) =>
      level === "team" && teamName !== null ? t("moderationDesk.level.teamNamed", { name: teamName }) : t(`moderationDesk.level.${level}`),
  }
}

/** Vrai tant que le composant est monté : une réponse arrivée après lui ne change plus rien. */
export function useMounted(): RefObject<boolean> {
  const mounted = useRef(false)
  useLayoutEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  return mounted
}

/** Rend le focus à la liste quand l'élément la quitte alors qu'il l'avait (dossier tranché entre-temps). */
export function useFocusFallback(onGone: () => void): RefObject<HTMLLIElement | null> {
  const item = useRef<HTMLLIElement>(null)
  useLayoutEffect(() => {
    const node = item.current
    return () => {
      if (node !== null && node.contains(document.activeElement)) onGone()
    }
  }, [onGone])
  return item
}

/** Le pays que porte la cible, ou « sans pays ». */
export function DeskCountry(props: { readonly country: CountryCode | null }) {
  const { t } = useDiasporaleT()
  if (props.country === null) {
    return <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{t("moderationDesk.zone.none")}</span>
  }
  return <CountryTag country={props.country} />
}

/** Un refus traduit, avec les bornes que sa phrase cite. */
export function DeskErrorLine(props: { readonly code: string | null; readonly line?: RefObject<HTMLParagraphElement | null> }) {
  const { t } = useDiasporaleT()
  if (props.code === null) return null
  return (
    <p ref={props.line} tabIndex={-1} role="alert" className="rounded-md text-sm text-destructive focus-visible:shadow-focus">
      {t(`errors.${props.code}`, DESK_ERROR_VALUES)}
    </p>
  )
}

/** Pourquoi la personne ne tranche pas ce dossier ; aucun formulaire de décision n'est offert. */
export function DeskPartyNotice(props: { readonly party: DeskParty }) {
  const { t } = useDiasporaleT()
  const labels = useDeskLabels()
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-muted p-4 text-sm">
      <p className="font-semibold">{t("moderationDesk.party.title")}</p>
      <p>{labels.party(props.party)}</p>
      <p className="text-muted-foreground">{t("moderationDesk.party.handOver")}</p>
    </div>
  )
}

/** Le sélecteur de pays de la cible : toute la file, sans pays, pays ouverts puis tous les pays. */
export function DeskZoneSelect(props: { readonly id: string; readonly value: string; readonly onChange: (key: string) => void }) {
  const { t, locale } = useDiasporaleT()
  const openCountries = useOpenCountries()
  const open = openCountries.status === "ready" ? openCountries.data.map((item) => item.country) : []
  const options = residenceCountryOptions(locale)
  const openOptions = options.filter((option) => open.includes(option.code))
  const otherOptions = options.filter((option) => !open.includes(option.code))
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={props.id} className="text-sm font-medium">{t("moderationDesk.filters.zone")}</label>
      <select id={props.id} className={deskSelectClass} value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        <option value="all">{t("moderationDesk.filters.zoneAll")}</option>
        <option value="none">{t("moderationDesk.filters.zoneNone")}</option>
        {openOptions.length > 0 ? (
          <optgroup label={t("moderationDesk.filters.zoneOpen")}>
            {openOptions.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
          </optgroup>
        ) : null}
        <optgroup label={t("moderationDesk.filters.zoneOther")}>
          {otherOptions.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
        </optgroup>
      </select>
    </div>
  )
}

/** Le sélecteur de nature de la cible (toutes les natures modérées par le moteur). */
export function DeskSurfaceSelect(props: { readonly id: string; readonly value: DeskSurface | null; readonly onChange: (surface: DeskSurface | null) => void }) {
  const { t } = useDiasporaleT()
  const labels = useDeskLabels()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={props.id} className="text-sm font-medium">{t("moderationDesk.filters.surface")}</label>
      <select
        id={props.id}
        className={deskSelectClass}
        value={props.value ?? ""}
        onChange={(event) => props.onChange(DESK_SURFACES.find((surface) => surface === event.target.value) ?? null)}
      >
        <option value="">{t("moderationDesk.filters.surfaceAll")}</option>
        {DESK_SURFACES.map((surface) => <option key={surface} value={surface}>{labels.surface(surface)}</option>)}
      </select>
    </div>
  )
}

/**
 * L'aperçu : la projection BORNÉE du moteur (le contenu visé seul, jamais son
 * auteur, ses contacts, ses pièces privées ni le contexte d'une demande).
 */
export function DeskPreview(props: { readonly preview: Loadable<DeskPreviewView> }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const { preview } = props
  let content: ReactNode
  if (preview.status === "loading") {
    content = (
      <div role="status">
        <span className="sr-only">{t("moderationDesk.preview.loading")}</span>
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    )
  } else if (preview.status === "error") {
    content = <p className="text-sm">{t(preview.code === "not_found" ? "moderationDesk.preview.gone" : "moderationDesk.preview.error")}</p>
  } else if (!preview.data.available) {
    content = <p className="text-sm">{t("moderationDesk.preview.unavailable")}</p>
  } else {
    const { title, body, media } = preview.data
    content = (
      <>
        {title ? <p className="break-words font-semibold">{title}</p> : null}
        {body ? <p className="whitespace-pre-line break-words text-sm leading-relaxed">{body}</p> : null}
        {media.length > 0 ? <PostMediaGrid media={media} interactive={false} /> : null}
        {!title && !body && media.length === 0 ? <p className="text-sm text-muted-foreground">{t("moderationDesk.preview.empty")}</p> : null}
      </>
    )
  }
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-2 rounded-xl bg-muted p-4">
      <h3 id={id} className="text-sm font-semibold">{t("moderationDesk.preview.title")}</h3>
      <p className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.preview.bounded")}</p>
      {content}
    </section>
  )
}

/** Le motif d'une décision : obligatoire, borné comme le guichet le demande. */
export function DeskReasonField(props: {
  readonly id: string
  readonly label: string
  readonly hint: string
  readonly error: string | undefined
  readonly disabled: boolean
  readonly registration: UseFormRegisterReturn
  readonly inputRef?: (element: HTMLTextAreaElement | null) => void
}) {
  const { t } = useDiasporaleT()
  return (
    <Field id={props.id} label={props.label} hint={props.hint} error={props.error ? t(`errors.${props.error}`, DESK_ERROR_VALUES) : undefined}>
      {(field) => (
        <Textarea
          id={field.id}
          aria-describedby={field.describedBy}
          aria-invalid={field.invalid || undefined}
          aria-required
          maxLength={DESK_REASON_MAX}
          rows={3}
          disabled={props.disabled}
          {...props.registration}
          ref={(element) => {
            props.registration.ref(element)
            props.inputRef?.(element)
          }}
        />
      )}
    </Field>
  )
}

/**
 * L'étape de confirmation d'une mesure lourde : le résumé de ce qui va se
 * produire, puis le geste explicite. Le focus s'y pose à l'ouverture.
 */
export function DeskConfirmStep(props: {
  readonly title: string
  readonly confirmLabel: string
  readonly busy: boolean
  readonly onConfirm: () => void
  readonly onBack: () => void
  readonly children: ReactNode
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => { heading.current?.focus() }, [])
  return (
    <div role="group" aria-labelledby={id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-destructive p-4">
      <h4 id={id} ref={heading} tabIndex={-1} className="rounded-md font-semibold focus-visible:shadow-focus">{props.title}</h4>
      <div className="flex flex-col gap-2 text-sm leading-relaxed">{props.children}</div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" disabled={props.busy} onClick={props.onConfirm}>
          {props.busy ? t("common.pleaseWait") : props.confirmLabel}
        </Button>
        <Button type="button" variant="ghost" disabled={props.busy} onClick={props.onBack}>{t("moderationDesk.confirm.back")}</Button>
      </div>
    </div>
  )
}
