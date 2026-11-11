"use client"

/**
 * L'onglet « Réglages » du guichet de modération (MD-04, sur MC-02 du moteur),
 * réservé à l'administration du réseau : l'onglet n'est offert qu'avec
 * `canManagePolicy`, et le moteur refuse toute autre personne (refus indistinct).
 *
 *  · ce qui vaut sans réglage : les défauts du moteur, lus dans ses constantes
 *    (jamais un nombre écrit dans un texte), puis les contenus de DIASPORALE
 *    relus d'office ;
 *  · par rubrique : relecture avant publication, plafond de liens, cadence ; un
 *    réglage se pose ou se change dans une feuille, motif obligatoire ; il ne se
 *    retire pas ;
 *  · les mots bloqués : la liste, l'ajout et le retrait motivés.
 * Chaque geste passe par le moteur (`cases.setPolicy`, `cases.setBlockedTerm`),
 * qui le journalise. Aucune valeur n'est posée d'office.
 * PROPRIÉTAIRE : chantier « modération par pays ».
 */
import { Button, Card, Checkbox, EmptyState, Field, Input, Label, Sheet, SheetContent, Skeleton } from "@diasporale/features"
import {
  DESK_BLOCKED_TERM_LENGTH,
  DESK_POLICY_BOUNDS,
  DESK_POLICY_SURFACES,
  DESK_WINDOW_MINUTES,
  deskAdmissibleTerm,
  deskHeldContentOf,
  deskWindowMinutes,
  deskWindowMsOf,
  deskWindowUnit,
  type ActionErrorCode,
  type DeskBlockedTermView,
  type DeskHeldContent,
  type DeskPolicyValues,
  type DeskSettingsView,
  type DeskSurfacePolicyView,
  type DeskWithoutPolicy,
  type ModerationDeskCapability,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { BanIcon, SlidersHorizontalIcon } from "lucide-react"
import { useId, useRef, useState, type ReactNode } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { DESK_ACCESS_ERRORS, DESK_ERROR_VALUES, DeskErrorLine, DeskReasonField, DeskReasonForm, deskDateTime, deskReasonSchema, useDeskLabels, useMounted } from "./moderation-desk-parts"
import { ServicePager } from "./service-pager"

/** Les contenus relus d'office, dits en clair (règle vérifiée dans le moteur, `DESK_HELD_CONTENTS`). */
const HELD_LABELS: Readonly<Record<DeskHeldContent, string>> = {
  associationEvents: "moderationDesk.settings.held.associationEvents",
  reviews: "moderationDesk.settings.held.reviews",
  reviewReplies: "moderationDesk.settings.held.reviewReplies",
  eventGallery: "moderationDesk.settings.held.eventGallery",
}

/**
 * Sur la ligne d'une rubrique aux défauts du moteur qui porte pourtant un contenu
 * relu d'office (évènements d'association, galerie), ce contenu dit à part.
 */
const HELD_NOTES: Readonly<Partial<Record<DeskHeldContent, string>>> = {
  associationEvents: "moderationDesk.settings.heldNote.associationEvents",
  eventGallery: "moderationDesk.settings.heldNote.eventGallery",
}

/** Ce qu'un réglage posé sur la rubrique soumet à ce réglage, quand elle porte un contenu relu d'office. */
const LIFTS_HELD: Readonly<Record<DeskHeldContent, string>> = {
  associationEvents: "moderationDesk.settings.sheet.liftsHeld.associationEvents",
  reviews: "moderationDesk.settings.sheet.liftsHeld.reviews",
  reviewReplies: "moderationDesk.settings.sheet.liftsHeld.reviewReplies",
  eventGallery: "moderationDesk.settings.sheet.liftsHeld.eventGallery",
}

/** La règle d'une rubrique sans réglage, dite par la projection du moteur. */
const WITHOUT_LABELS: Readonly<Record<DeskWithoutPolicy, string>> = {
  defaults: "moderationDesk.settings.without.defaults",
  held: "moderationDesk.settings.without.held",
  unchecked: "moderationDesk.settings.without.unchecked",
}

const WINDOW_LABELS = {
  hours: "moderationDesk.settings.window.hours",
  minutes: "moderationDesk.settings.window.minutes",
  seconds: "moderationDesk.settings.window.seconds",
} as const

const LINKS = "moderation_desk_links_bounds"
const WRITES = "moderation_desk_writes_bounds"
const WINDOW = "moderation_desk_window_bounds"

const policySchema = z.object({
  preReview: z.boolean(),
  maxLinks: z.number({ invalid_type_error: LINKS }).int(LINKS).min(DESK_POLICY_BOUNDS.maxLinks.min, "moderation_desk_links_bounds").max(DESK_POLICY_BOUNDS.maxLinks.max, "moderation_desk_links_bounds"),
  maxWrites: z.number({ invalid_type_error: WRITES }).int(WRITES).min(DESK_POLICY_BOUNDS.maxWrites.min, "moderation_desk_writes_bounds").max(DESK_POLICY_BOUNDS.maxWrites.max, "moderation_desk_writes_bounds"),
  windowMinutes: z.number({ invalid_type_error: WINDOW }).int(WINDOW).min(DESK_WINDOW_MINUTES.min, "moderation_desk_window_bounds").max(DESK_WINDOW_MINUTES.max, "moderation_desk_window_bounds"),
  reason: deskReasonSchema,
})
type PolicyFormValues = z.infer<typeof policySchema>

const termSchema = z.object({
  term: z.string().superRefine((raw, context) => {
    if (deskAdmissibleTerm(raw) === null) context.addIssue({ code: z.ZodIssueCode.custom, message: "moderation_desk_term_length" })
  }),
  reason: deskReasonSchema,
})
type TermFormValues = z.infer<typeof termSchema>

/** Une fenêtre de cadence dite dans l'unité la plus ronde (« 1 minute », « 2 heures »). */
function useWindowLabel(): (windowMs: number) => string {
  const { t } = useDiasporaleT()
  return (windowMs) => {
    const { unit, count } = deskWindowUnit(windowMs)
    return t(WINDOW_LABELS[unit], { count })
  }
}

export function ModerationDeskSettings(props: { readonly desk: ModerationDeskCapability; readonly personId: string }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const settings = props.desk.useSettings(props.personId)
  const [editing, setEditing] = useState<DeskSurfacePolicyView | null>(null)

  let body: ReactNode
  if (settings.status === "loading") {
    body = (
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">{t("moderationDesk.settings.loading")}</span>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  } else if (settings.status === "error") {
    body = DESK_ACCESS_ERRORS.has(settings.code)
      ? <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("moderationDesk.settings.restricted")}</p>
      : <Card role="alert" className="p-4"><DeskErrorLine code={settings.code} /></Card>
  } else {
    body = (
      <>
        <WithoutSettings defaults={settings.data.defaults} />
        <SurfaceSettings settings={settings.data} onEdit={setEditing} />
        <BlockedTerms desk={props.desk} personId={props.personId} />
      </>
    )
  }

  return (
    <section aria-labelledby={`${id}-titre`} className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-titre`} className="font-display text-xl font-bold">{t("moderationDesk.settings.title")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("moderationDesk.settings.lead")}</p>
      </div>
      {body}
      {settings.status === "ready" ? (
        <PolicySheet desk={props.desk} personId={props.personId} defaults={settings.data.defaults} row={editing} onClose={() => setEditing(null)} />
      ) : null}
    </section>
  )
}

/** Ce qui vaut sans réglage : les défauts du moteur, puis les contenus relus d'office. */
function WithoutSettings(props: { readonly defaults: DeskPolicyValues }) {
  const { t } = useDiasporaleT()
  const windowLabel = useWindowLabel()
  const { defaults } = props
  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
      <Card className="flex min-w-0 flex-col gap-2 p-4">
        <h3 className="font-semibold">{t("moderationDesk.settings.defaults.title")}</h3>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed">
          <li>{t(defaults.preReview ? "moderationDesk.settings.defaults.preReviewOn" : "moderationDesk.settings.defaults.preReviewOff")}</li>
          <li>{t("moderationDesk.settings.defaults.links", { count: defaults.maxLinks })}</li>
          <li>{t("moderationDesk.settings.defaults.writes", { count: defaults.maxWrites, window: windowLabel(defaults.windowMs) })}</li>
          <li>{t("moderationDesk.settings.defaults.terms")}</li>
        </ul>
        <p className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.settings.defaults.source")}</p>
      </Card>
      <Card className="flex min-w-0 flex-col gap-2 p-4">
        <h3 className="font-semibold">{t("moderationDesk.settings.held.title")}</h3>
        <p className="text-sm leading-relaxed">{t("moderationDesk.settings.held.lead")}</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed">
          {(Object.keys(HELD_LABELS) as DeskHeldContent[]).map((content) => <li key={content}>{t(HELD_LABELS[content])}</li>)}
        </ul>
        <p className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.settings.held.note")}</p>
      </Card>
    </div>
  )
}

/** Les rubriques de DIASPORALE, une ligne chacune : le réglage posé, ou la règle sans réglage. */
function SurfaceSettings(props: { readonly settings: DeskSettingsView; readonly onEdit: (row: DeskSurfacePolicyView) => void }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const rows = DESK_POLICY_SURFACES.flatMap((surface) => props.settings.surfaces.find((row) => row.surface === surface) ?? [])
  return (
    <section aria-labelledby={`${id}-rubriques`} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 id={`${id}-rubriques`} className="font-display text-lg font-bold">{t("moderationDesk.settings.surfaces.title")}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("moderationDesk.settings.surfaces.lead")}</p>
      </div>
      <ul className="flex min-w-0 flex-col gap-2">
        {rows.map((row) => <SurfaceLine key={row.surface} row={row} onEdit={() => props.onEdit(row)} />)}
      </ul>
    </section>
  )
}

function SurfaceLine(props: { readonly row: DeskSurfacePolicyView; readonly onEdit: () => void }) {
  const { t, locale } = useDiasporaleT()
  const labels = useDeskLabels()
  const windowLabel = useWindowLabel()
  const titleId = useId()
  const { row } = props
  const held = deskHeldContentOf(row.surface)
  const heldNote = held === null ? undefined : HELD_NOTES[held]
  return (
    <li>
      <Card className="flex min-w-0 flex-col gap-2 p-4">
        <h4 id={titleId} className="min-w-0 break-words font-semibold">{labels.surface(row.surface)}</h4>
        {row.policy ? (
          <>
            <p className="text-xs text-muted-foreground">{t("moderationDesk.settings.policy.since", { date: deskDateTime(row.policy.updatedAt, locale) })}</p>
            <ul className="flex flex-col gap-0.5 text-sm">
              <li>{t(row.policy.preReview ? "moderationDesk.settings.policy.preReviewOn" : "moderationDesk.settings.policy.preReviewOff")}</li>
              <li>{t("moderationDesk.settings.policy.links", { count: row.policy.maxLinks })}</li>
              <li>{t("moderationDesk.settings.policy.writes", { count: row.policy.maxWrites, window: windowLabel(row.policy.windowMs) })}</li>
            </ul>
          </>
        ) : (
          <>
            <p className="text-sm">{t(WITHOUT_LABELS[row.withoutPolicy])}</p>
            {heldNote !== undefined && row.withoutPolicy === "defaults" ? <p className="text-[13px] leading-snug text-muted-foreground">{t(heldNote)}</p> : null}
          </>
        )}
        <Button variant="outline" size="sm" className="self-start" aria-describedby={titleId} aria-haspopup="dialog" onClick={props.onEdit}>
          <SlidersHorizontalIcon aria-hidden />
          {t(row.policy ? "moderationDesk.settings.policy.change" : "moderationDesk.settings.policy.set")}
        </Button>
      </Card>
    </li>
  )
}

/** Poser ou changer le réglage d'une rubrique : relecture, liens, cadence, motif. */
function PolicySheet(props: {
  readonly desk: ModerationDeskCapability
  readonly personId: string
  readonly defaults: DeskPolicyValues
  readonly row: DeskSurfacePolicyView | null
  readonly onClose: () => void
}) {
  const { t } = useDiasporaleT()
  const labels = useDeskLabels()
  const busy = useRef(false)
  const { row } = props
  return (
    <Sheet open={row !== null} onOpenChange={(open) => { if (!open && !busy.current) props.onClose() }}>
      {row ? (
        <SheetContent
          title={t("moderationDesk.settings.sheet.title", { surface: labels.surface(row.surface) })}
          description={t("moderationDesk.settings.sheet.description")}
          closeLabel={t("common.close")}
        >
          <PolicyForm
            key={row.surface}
            desk={props.desk}
            personId={props.personId}
            defaults={props.defaults}
            row={row}
            onBusyChange={(value) => { busy.current = value }}
            onDone={props.onClose}
          />
        </SheetContent>
      ) : null}
    </Sheet>
  )
}

function PolicyForm(props: {
  readonly desk: ModerationDeskCapability
  readonly personId: string
  readonly defaults: DeskPolicyValues
  readonly row: DeskSurfacePolicyView
  readonly onBusyChange: (busy: boolean) => void
  readonly onDone: () => void
}) {
  const { t } = useDiasporaleT()
  const labels = useDeskLabels()
  const id = useId()
  const mounted = useMounted()
  const locked = useRef(false)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const { row } = props
  // Le réglage posé, sinon la règle qui s'applique aujourd'hui : relecture de tout pour une rubrique relue d'office, défauts du moteur sinon.
  const start = row.policy ?? { ...props.defaults, preReview: row.withoutPolicy === "held" }
  const form = useForm<PolicyFormValues>({
    resolver: zodResolver(policySchema),
    defaultValues: { preReview: start.preReview, maxLinks: start.maxLinks, maxWrites: start.maxWrites, windowMinutes: deskWindowMinutes(start.windowMs), reason: "" },
  })
  const errors = form.formState.errors
  const busy = form.formState.isSubmitting
  const held = row.policy === null ? deskHeldContentOf(row.surface) : null
  const fieldError = (code: string | undefined) => (code ? t(`errors.${code}`, DESK_ERROR_VALUES) : undefined)

  const save = async (values: PolicyFormValues) => {
    if (locked.current) return
    locked.current = true
    props.onBusyChange(true)
    setError(null)
    try {
      const result = await props.desk.setPolicy({
        personId: props.personId,
        surface: row.surface,
        preReview: values.preReview,
        maxLinks: values.maxLinks,
        maxWrites: values.maxWrites,
        windowMs: deskWindowMsOf(values.windowMinutes),
        reason: values.reason,
      })
      if (!mounted.current) return
      if (!result.ok) {
        setError(result.code)
        return
      }
      toast.success(t("moderationDesk.settings.sheet.saved", { surface: labels.surface(row.surface) }))
      props.onBusyChange(false)
      props.onDone()
    } catch {
      if (mounted.current) setError("unknown")
    } finally {
      locked.current = false
      props.onBusyChange(false)
    }
  }

  return (
    <form noValidate onSubmit={(event) => void form.handleSubmit(save)(event)} className="flex min-w-0 flex-col gap-4">
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
        <div className="flex items-start gap-3">
          <Controller
            control={form.control}
            name="preReview"
            render={({ field }) => (
              <Checkbox id={`${id}-relecture`} checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} aria-describedby={`${id}-relecture-aide`} className="mt-0.5" />
            )}
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <Label htmlFor={`${id}-relecture`} className="leading-snug">{t("moderationDesk.settings.sheet.preReview")}</Label>
            <p id={`${id}-relecture-aide`} className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.settings.sheet.preReviewHint")}</p>
          </div>
        </div>
        <Field id={`${id}-liens`} label={t("moderationDesk.settings.sheet.maxLinks")} hint={t("moderationDesk.settings.sheet.maxLinksHint", DESK_ERROR_VALUES)} error={fieldError(errors.maxLinks?.message)}>
          {(field) => (
            <Input
              id={field.id}
              type="number"
              inputMode="numeric"
              min={DESK_POLICY_BOUNDS.maxLinks.min}
              max={DESK_POLICY_BOUNDS.maxLinks.max}
              step={1}
              aria-describedby={field.describedBy}
              aria-invalid={field.invalid || undefined}
              {...form.register("maxLinks", { valueAsNumber: true })}
            />
          )}
        </Field>
        <Field id={`${id}-ecritures`} label={t("moderationDesk.settings.sheet.maxWrites")} hint={t("moderationDesk.settings.sheet.maxWritesHint", DESK_ERROR_VALUES)} error={fieldError(errors.maxWrites?.message)}>
          {(field) => (
            <Input
              id={field.id}
              type="number"
              inputMode="numeric"
              min={DESK_POLICY_BOUNDS.maxWrites.min}
              max={DESK_POLICY_BOUNDS.maxWrites.max}
              step={1}
              aria-describedby={field.describedBy}
              aria-invalid={field.invalid || undefined}
              {...form.register("maxWrites", { valueAsNumber: true })}
            />
          )}
        </Field>
        <Field id={`${id}-fenetre`} label={t("moderationDesk.settings.sheet.window")} hint={t("moderationDesk.settings.sheet.windowHint", DESK_ERROR_VALUES)} error={fieldError(errors.windowMinutes?.message)}>
          {(field) => (
            <Input
              id={field.id}
              type="number"
              inputMode="numeric"
              min={DESK_WINDOW_MINUTES.min}
              max={DESK_WINDOW_MINUTES.max}
              step={1}
              aria-describedby={field.describedBy}
              aria-invalid={field.invalid || undefined}
              {...form.register("windowMinutes", { valueAsNumber: true })}
            />
          )}
        </Field>
        {held !== null ? <p className="rounded-xl bg-muted p-3 text-sm leading-relaxed">{t(LIFTS_HELD[held])}</p> : null}
        <p className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.settings.sheet.permanent")}</p>
        <DeskReasonField
          id={`${id}-motif`}
          label={t("moderationDesk.decision.reason")}
          hint={t("moderationDesk.settings.sheet.reasonHint", DESK_ERROR_VALUES)}
          error={errors.reason?.message}
          disabled={busy}
          registration={form.register("reason")}
        />
      </fieldset>
      <DeskErrorLine code={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>{busy ? t("common.pleaseWait") : t("moderationDesk.settings.sheet.submit")}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={props.onDone}>{t("common.cancel")}</Button>
      </div>
    </form>
  )
}

/** Les mots bloqués du réseau : la liste par fenêtres, l'ajout motivé, le retrait motivé. */
function BlockedTerms(props: { readonly desk: ModerationDeskCapability; readonly personId: string }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const [removing, setRemoving] = useState<DeskBlockedTermView | null>(null)
  const busy = useRef(false)
  return (
    <section aria-labelledby={`${id}-mots`} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 id={`${id}-mots`} className="font-display text-lg font-bold">{t("moderationDesk.settings.terms.title")}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("moderationDesk.settings.terms.lead", DESK_ERROR_VALUES)}</p>
        <p className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.settings.terms.waveNote")}</p>
      </div>
      <ServicePager<DeskBlockedTermView>
        read={(cursor) => props.desk.useBlockedTerms({ personId: props.personId, cursor })}
        keyOf={(row) => row.termId}
        empty={<EmptyState icon={<BanIcon />} title={t("moderationDesk.settings.terms.emptyTitle")} description={t("moderationDesk.settings.terms.emptyBody")} />}
      >
        {(rows) => (
          <ul className="flex min-w-0 flex-col gap-2">
            {rows.map((row) => <TermLine key={row.termId} row={row} onRemove={() => setRemoving(row)} />)}
          </ul>
        )}
      </ServicePager>
      <AddTerm desk={props.desk} personId={props.personId} />
      <Sheet open={removing !== null} onOpenChange={(open) => { if (!open && !busy.current) setRemoving(null) }}>
        {removing ? (
          <SheetContent
            title={t("moderationDesk.settings.terms.removeTitle", { term: removing.term })}
            description={t("moderationDesk.settings.terms.removeBody")}
            closeLabel={t("common.close")}
          >
            <DeskReasonForm
              submitLabel={t("moderationDesk.settings.terms.removeConfirm")}
              onBusyChange={(value) => { busy.current = value }}
              onCancel={() => setRemoving(null)}
              onSubmit={async (reason) => {
                const result = await props.desk.setBlockedTerm({ personId: props.personId, term: removing.term, active: false, reason })
                if (!result.ok) return result.code
                toast.success(t("moderationDesk.settings.terms.removed", { term: removing.term }))
                busy.current = false
                setRemoving(null)
                return null
              }}
            />
          </SheetContent>
        ) : null}
      </Sheet>
    </section>
  )
}

function TermLine(props: { readonly row: DeskBlockedTermView; readonly onRemove: () => void }) {
  const { t, locale } = useDiasporaleT()
  const termId = useId()
  return (
    <li className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
      <div className="min-w-0">
        <p id={termId} className="break-words font-medium">{props.row.term}</p>
        <p className="text-xs text-muted-foreground">{t("moderationDesk.settings.terms.since", { date: deskDateTime(props.row.updatedAt, locale) })}</p>
      </div>
      <Button variant="ghost" size="sm" aria-describedby={termId} aria-haspopup="dialog" onClick={props.onRemove}>{t("moderationDesk.settings.terms.remove")}</Button>
    </li>
  )
}

function AddTerm(props: { readonly desk: ModerationDeskCapability; readonly personId: string }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const mounted = useMounted()
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const form = useForm<TermFormValues>({ resolver: zodResolver(termSchema), defaultValues: { term: "", reason: "" } })
  const busy = form.formState.isSubmitting
  const errors = form.formState.errors

  const add = async (values: TermFormValues) => {
    setError(null)
    const result = await props.desk.setBlockedTerm({ personId: props.personId, term: values.term, active: true, reason: values.reason })
    if (!mounted.current) return
    if (!result.ok) {
      setError(result.code)
      return
    }
    toast.success(t("moderationDesk.settings.terms.added", { term: deskAdmissibleTerm(values.term) ?? values.term.trim() }))
    form.reset()
  }

  return (
    <Card className="flex min-w-0 flex-col gap-3 p-4">
      <h4 className="font-semibold">{t("moderationDesk.settings.terms.addTitle")}</h4>
      <form noValidate onSubmit={(event) => void form.handleSubmit(add)(event)} className="flex min-w-0 flex-col gap-3">
        <Field
          id={`${id}-mot`}
          label={t("moderationDesk.settings.terms.term")}
          hint={t("moderationDesk.settings.terms.termHint", DESK_ERROR_VALUES)}
          error={errors.term?.message ? t(`errors.${errors.term.message}`, DESK_ERROR_VALUES) : undefined}
        >
          {(field) => (
            <Input
              id={field.id}
              aria-describedby={field.describedBy}
              aria-invalid={field.invalid || undefined}
              autoComplete="off"
              maxLength={DESK_BLOCKED_TERM_LENGTH.max}
              disabled={busy}
              {...form.register("term")}
            />
          )}
        </Field>
        <DeskReasonField
          id={`${id}-motif`}
          label={t("moderationDesk.decision.reason")}
          hint={t("moderationDesk.settings.terms.reasonHint", DESK_ERROR_VALUES)}
          error={errors.reason?.message}
          disabled={busy}
          registration={form.register("reason")}
        />
        <DeskErrorLine code={error} />
        <Button type="submit" className="self-start" disabled={busy}>{busy ? t("common.pleaseWait") : t("moderationDesk.settings.terms.add")}</Button>
      </form>
    </Card>
  )
}
