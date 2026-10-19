"use client"

/**
 * Mon profil de talent (DG-025) : un opt-in EXPLICITE et révocable. La personne
 * choisit ce qui y figure (titre, compétences DÉCLARÉES, disponibilité, langues,
 * pays), s'il apparaît dans la recherche du réseau ou seulement dans les
 * candidatures qu'elle choisit, puis le masque ou le supprime quand elle veut.
 * PROPRIÉTAIRE : chantier « talents et emploi ».
 *
 * Ni âge, ni sexe, ni origine, ni situation familiale, ni photo : ces champs
 * n'existent pas. Une attestation consulaire ne dit rien d'une compétence.
 * La personne y lit l'état de modération de son profil (G9), elle seule.
 */
import {
  JOB_LANGUAGE_CODES,
  JOB_LANGUAGES_MAX,
  parseTalentProfile,
  TALENT_AVAILABILITIES,
  TALENT_SKILL_MAX_LENGTH,
  TALENT_SKILLS_MAX,
  TALENT_TITLE_MAX_LENGTH,
  TALENT_TITLE_MIN_LENGTH,
  TALENT_VISIBILITIES,
  type CountryCode,
  type JobLanguageCode,
} from "@diasporale/domain"
import { Button, Card, Checkbox, Field, Input, Label, Skeleton, Textarea, countryName, residenceCountryOptions } from "@diasporale/features"
import type { ActionErrorCode, JobsCapability, OwnTalentProfileView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { UserRoundIcon } from "lucide-react"
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Controller, useForm, type FieldPath } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { JobChip, JobModerationNote, jobSelectClass, useJobGesture } from "./job-parts"
import { languageList, languageName } from "./service-format"
import { ConfirmSheet } from "./service-request-sheets"

/** Les compétences saisies : une par ligne (ou séparées par des virgules). */
export function skillsOf(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 0)
}

function schemaFor(creating: boolean) {
  return z
    .object({
      title: z.string().trim().min(TALENT_TITLE_MIN_LENGTH, "talent_title_too_short").max(TALENT_TITLE_MAX_LENGTH, "talent_title_too_long"),
      skills: z.string(),
      availability: z.enum(TALENT_AVAILABILITIES, { message: "talent_availability_invalid" }),
      languages: z.array(z.enum(JOB_LANGUAGE_CODES)).min(1, "job_languages_required").max(JOB_LANGUAGES_MAX, "job_languages_too_many"),
      country: z.string().min(1, "job_country_required"),
      visibility: z.enum(TALENT_VISIBILITIES, { message: "talent_visibility_invalid" }),
      optIn: z.boolean(),
    })
    .superRefine((values, ctx) => {
      const profile = parseTalentProfile({
        title: values.title,
        skills: skillsOf(values.skills),
        availability: values.availability,
        languages: values.languages,
        country: values.country,
        visibility: values.visibility,
      })
      if (!profile.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [fieldOf(profile.code)], message: profile.code })
      // Créer un profil est un geste explicite : la case n'est jamais cochée d'avance.
      if (creating && !values.optIn) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["optIn"], message: "talent_opt_in_required" })
    })
}

type Values = z.infer<ReturnType<typeof schemaFor>>

const FIELD_OF: Partial<Record<string, FieldPath<Values>>> = {
  talent_title_too_short: "title",
  talent_title_too_long: "title",
  job_contact_details_forbidden: "skills",
  talent_skills_required: "skills",
  talent_skills_too_many: "skills",
  talent_skill_invalid: "skills",
  talent_availability_invalid: "availability",
  job_languages_required: "languages",
  job_languages_too_many: "languages",
  job_language_invalid: "languages",
  job_country_required: "country",
  job_country_unknown: "country",
  job_country_is_home: "country",
  talent_visibility_invalid: "visibility",
}

function fieldOf(code: string): FieldPath<Values> {
  return FIELD_OF[code] ?? "title"
}

function defaultsOf(profile: OwnTalentProfileView | null, fallbackCountry: CountryCode): Values {
  if (profile === null) {
    return { title: "", skills: "", availability: "open_to_offers", languages: ["fr"], country: fallbackCountry, visibility: "network", optIn: false }
  }
  return {
    title: profile.title,
    skills: profile.skills.join("\n"),
    availability: profile.availability,
    languages: profile.languages.filter((code): code is JobLanguageCode => (JOB_LANGUAGE_CODES as readonly string[]).includes(code)),
    country: profile.country,
    visibility: profile.visibility,
    optIn: true,
  }
}

/** La section « Mon profil de talent » de `/talents`. */
export function MyTalentProfileSection(props: { readonly jobs: JobsCapability; readonly fallbackCountry: CountryCode }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const loaded = props.jobs.useMyTalentProfile()
  const [editing, setEditing] = useState(false)
  const heading = useRef<HTMLHeadingElement | null>(null)
  const wasEditing = useRef(false)
  useLayoutEffect(() => {
    if (!editing && wasEditing.current) heading.current?.focus()
    wasEditing.current = editing
  }, [editing])
  return (
    <section aria-labelledby={`${id}-titre`} className="flex min-w-0 flex-col gap-3">
      <h2 ref={heading} id={`${id}-titre`} tabIndex={-1} className="rounded-sm text-lg font-semibold focus-visible:shadow-focus">{t("jobs.profile.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("jobs.profile.lead")}</p>
      {loaded.status === "loading" ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : loaded.status === "error" ? (
        <Card role="alert" className="p-4"><p>{t(`errors.${loaded.code}`)}</p></Card>
      ) : editing ? (
        <TalentProfileForm jobs={props.jobs} profile={loaded.data} fallbackCountry={props.fallbackCountry} onClose={() => setEditing(false)} />
      ) : loaded.data === null ? (
        <Card className="flex flex-col items-start gap-3 p-4">
          <UserRoundIcon aria-hidden className="size-6 text-muted-foreground" />
          <p className="font-semibold">{t("jobs.profile.emptyTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("jobs.profile.emptyBody")}</p>
          <Button onClick={() => setEditing(true)}>{t("jobs.profile.create")}</Button>
        </Card>
      ) : (
        <TalentProfileSummary jobs={props.jobs} profile={loaded.data} onEdit={() => setEditing(true)} />
      )}
    </section>
  )
}

function TalentProfileSummary(props: { readonly jobs: JobsCapability; readonly profile: OwnTalentProfileView; readonly onEdit: () => void }) {
  const { t, locale } = useDiasporaleT()
  const { profile } = props
  const gesture = useJobGesture()
  const [removing, setRemoving] = useState(false)
  const toggle = async () => {
    const next = profile.status === "active" ? "hidden" : "active"
    const outcome = await gesture.run(async () => {
      const result = await props.jobs.setTalentProfileStatus({ status: next, expectedVersion: profile.version })
      return result.ok ? null : result.code
    })
    if (outcome === "busy" || !gesture.isActive()) return
    if (outcome === null) toast.success(t(next === "hidden" ? "jobs.profile.hidden" : "jobs.profile.shown"))
    else toast.error(t(`errors.${outcome}`))
  }
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-4">
      <p className="flex flex-wrap items-center gap-1.5">
        <JobChip>{t(profile.status === "active" ? "jobs.profile.statusActive" : "jobs.profile.statusHidden")}</JobChip>
        <JobChip>{t(`jobs.visibility.${profile.visibility}.label`)}</JobChip>
      </p>
      <h3 className="min-w-0 break-words font-semibold">{profile.title}</h3>
      {/* G9 : l'état de modération du profil, servi à sa seule personne propriétaire. */}
      <JobModerationNote subject="talent" state={profile.moderation} />
      <ul className="flex flex-wrap gap-1.5" aria-label={t("jobs.talentCard.skills")}>
        {profile.skills.map((skill) => (
          <li key={skill}><JobChip>{skill}</JobChip></li>
        ))}
      </ul>
      <p className="text-[13px]">{t(`jobs.availability.${profile.availability}`)}</p>
      <p className="text-[13px] text-muted-foreground">
        {t("jobs.talentCard.languages", { languages: languageList(profile.languages, locale) })}
        {" · "}
        {countryName(profile.country, locale)}
      </p>
      <p className="text-[13px] text-muted-foreground">{t(profile.status === "active" ? `jobs.visibility.${profile.visibility}.hint` : "jobs.profile.hiddenNote")}</p>
      <div className="flex flex-wrap gap-2">
        {/* G9 : un profil retiré par la modération ne se modifie plus (refus du moteur) ; il se masque ou se supprime encore. */}
        {profile.moderation !== "removed" ? (
          <Button variant="outline" size="sm" disabled={gesture.busy} onClick={props.onEdit}>{t("jobs.profile.edit")}</Button>
        ) : null}
        <Button variant="outline" size="sm" disabled={gesture.busy} aria-busy={gesture.busy} onClick={() => void toggle()}>
          {t(profile.status === "active" ? "jobs.profile.hide" : "jobs.profile.show")}
        </Button>
        <Button variant="ghost" size="sm" disabled={gesture.busy} onClick={() => setRemoving(true)}>{t("jobs.profile.remove")}</Button>
      </div>
      <ConfirmSheet
        open={removing}
        onOpenChange={setRemoving}
        title={t("jobs.profile.confirmRemoveTitle")}
        description={t("jobs.profile.confirmRemoveBody")}
        confirmLabel={t("jobs.profile.confirmRemove")}
        destructive
        onConfirm={async () => {
          const result = await props.jobs.removeTalentProfile()
          if (result.ok) toast.success(t("jobs.profile.removed"))
          return result.ok ? null : result.code
        }}
      />
    </Card>
  )
}

function TalentProfileForm(props: {
  readonly jobs: JobsCapability
  readonly profile: OwnTalentProfileView | null
  readonly fallbackCountry: CountryCode
  readonly onClose: () => void
}) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const { profile } = props
  const creating = profile === null
  const schema = useMemo(() => schemaFor(creating), [creating])
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaultsOf(profile, props.fallbackCountry) })
  const [formError, setFormError] = useState<ActionErrorCode | null>(null)
  const locked = useRef(false)
  const countries = useMemo(() => residenceCountryOptions(locale), [locale])
  const titleInput = useRef<HTMLInputElement | null>(null)
  const titleField = form.register("title")
  useLayoutEffect(() => {
    titleInput.current?.focus()
  }, [])
  const error = (field: FieldPath<Values>) => {
    const message = form.formState.errors[field as keyof Values]?.message
    return typeof message === "string" ? t(`errors.${message}`) : undefined
  }

  const submit = form.handleSubmit(async (values) => {
    if (locked.current) return
    locked.current = true
    setFormError(null)
    try {
      const result = await props.jobs.saveTalentProfile({
        title: values.title,
        skills: skillsOf(values.skills),
        availability: values.availability,
        languages: values.languages,
        country: values.country as CountryCode,
        visibility: values.visibility,
        expectedVersion: profile === null ? null : profile.version,
      })
      if (result.ok) {
        toast.success(t(creating ? "jobs.profile.created" : "jobs.profile.saved"))
        props.onClose()
        return
      }
      const field = FIELD_OF[result.code]
      if (field) form.setError(field, { message: result.code })
      else setFormError(result.code)
    } catch {
      setFormError("unknown")
    } finally {
      locked.current = false
    }
  })

  const busy = form.formState.isSubmitting
  return (
    <Card className="p-4">
      <form noValidate className="flex min-w-0 flex-col gap-4" onSubmit={(event) => void submit(event)} aria-labelledby={`${id}-titre`}>
        <h3 id={`${id}-titre`} className="text-lg font-semibold">{t(creating ? "jobs.profile.createTitle" : "jobs.profile.editTitle")}</h3>
        <Field id={`${id}-title`} label={t("jobs.profile.fieldTitle")} hint={t("jobs.profile.fieldTitleHint")} error={error("title")}>
          {(field) => (
            <Input
              id={field.id}
              aria-describedby={field.describedBy}
              aria-invalid={field.invalid || undefined}
              maxLength={TALENT_TITLE_MAX_LENGTH}
              disabled={busy}
              {...titleField}
              ref={(element) => {
                titleField.ref(element)
                titleInput.current = element
              }}
            />
          )}
        </Field>
        <Field id={`${id}-skills`} label={t("jobs.profile.fieldSkills")} hint={t("jobs.profile.fieldSkillsHint", { max: TALENT_SKILLS_MAX, length: TALENT_SKILL_MAX_LENGTH })} error={error("skills")}>
          {(field) => <Textarea id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} rows={4} disabled={busy} {...form.register("skills")} />}
        </Field>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id={`${id}-availability`} label={t("jobs.profile.fieldAvailability")} error={error("availability")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={jobSelectClass} disabled={busy} {...form.register("availability")}>
                {TALENT_AVAILABILITIES.map((availability) => (
                  <option key={availability} value={availability}>{t(`jobs.availability.${availability}`)}</option>
                ))}
              </select>
            )}
          </Field>
          <Field id={`${id}-country`} label={t("jobs.profile.fieldCountry")} error={error("country")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={jobSelectClass} disabled={busy} {...form.register("country")}>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>{country.name}</option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={error("languages") ? `${id}-languages-erreur` : undefined}>
          <legend className="mb-1 text-sm font-medium">{t("jobs.profile.fieldLanguages")}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {JOB_LANGUAGE_CODES.map((code) => (
              <label key={code} className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" value={code} className="size-5 accent-primary" disabled={busy} {...form.register("languages")} />
                {languageName(code, locale)}
              </label>
            ))}
          </div>
          {error("languages") ? <p id={`${id}-languages-erreur`} role="alert" className="text-[13px] font-medium text-destructive">{error("languages")}</p> : null}
        </fieldset>
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t("jobs.profile.fieldVisibility")}</legend>
          {TALENT_VISIBILITIES.map((visibility) => (
            <label key={visibility} className="flex min-h-11 items-start gap-3 text-sm">
              <input type="radio" value={visibility} className="mt-0.5 size-5 shrink-0 accent-primary" disabled={busy} {...form.register("visibility")} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{t(`jobs.visibility.${visibility}.label`)}</span>
                <span className="text-[13px] text-muted-foreground">{t(`jobs.visibility.${visibility}.hint`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("jobs.profile.fairness")}</p>
        {creating ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start gap-3">
              <Controller
                control={form.control}
                name="optIn"
                render={({ field }) => (
                  <Checkbox
                    id={`${id}-optin`}
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    onBlur={field.onBlur}
                    aria-invalid={form.formState.errors.optIn ? true : undefined}
                    aria-describedby={form.formState.errors.optIn ? `${id}-optin-erreur` : undefined}
                    disabled={busy}
                  />
                )}
              />
              <Label htmlFor={`${id}-optin`} className="font-normal leading-snug">{t("jobs.profile.optIn")}</Label>
            </div>
            {error("optIn") ? <p id={`${id}-optin-erreur`} role="alert" className="text-[13px] font-medium text-destructive">{error("optIn")}</p> : null}
          </div>
        ) : null}
        {formError !== null ? (
          <div role="alert" className="rounded-lg border border-destructive px-3 py-2 text-sm">
            <p>{t(`errors.${formError}`)}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>{t(busy ? "common.pleaseWait" : creating ? "jobs.profile.submitCreate" : "jobs.profile.submitSave")}</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={props.onClose}>{t("common.cancel")}</Button>
        </div>
      </form>
    </Card>
  )
}
