"use client"

/**
 * « Candidater » depuis la fiche d'une offre : une feuille (React Hook Form +
 * Zod) avec le message de motivation, le consentement EXPLICITE à transmettre
 * son nom publié à l'équipe de la page, et le choix — jamais coché d'avance —
 * de joindre son profil de talent s'il existe et reste actif. PROPRIÉTAIRE :
 * chantier « talents et emploi ».
 *
 * Idempotence : une clé STABLE pendant la vie de la feuille ; un double clic ou
 * un renvoi après une coupure rend la même candidature. Aucune coordonnée dans
 * le message ; aucun âge, sexe, origine, situation familiale ni photo demandés.
 */
import { JOB_APPLICATION_MESSAGE_MAX_LENGTH, JOB_APPLICATION_MESSAGE_MIN_LENGTH, jobTextHasContact } from "@diasporale/domain"
import { Button, Card, Checkbox, Field, Label, Sheet, SheetContent, Textarea } from "@diasporale/features"
import { useJobs, useSession, type ActionErrorCode, type JobOfferDetailView, type JobsCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2Icon, SendIcon } from "lucide-react"
import NextLink from "next/link"
import { useId, useRef, useState, type FormEvent } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { routes } from "@/lib/routes"

import { newJobIdempotencyKey } from "./job-parts"

const applySchema = z.object({
  message: z
    .string()
    .trim()
    .min(JOB_APPLICATION_MESSAGE_MIN_LENGTH, "job_application_message_too_short")
    .max(JOB_APPLICATION_MESSAGE_MAX_LENGTH, "job_application_message_too_long"),
  shareTalentProfile: z.boolean(),
  consent: z.boolean().refine((value) => value, { message: "job_application_consent_required" }),
})

type ApplyValues = z.infer<typeof applySchema>

/** Les refus qui disent que l'offre a bougé : la fiche (réactive) montre déjà son nouvel état. */
const OFFER_MOVED: ReadonlySet<ActionErrorCode> = new Set(["not_found", "job_offer_changed"])

export function JobApplyEntry(props: { readonly offer: JobOfferDetailView }) {
  const { t } = useDiasporaleT()
  const jobs = useJobs()
  const session = useSession()
  const [open, setOpen] = useState(false)
  // Une clé par ouverture de la feuille : stable pour ses renvois, neuve à la suivante.
  const [sheetKey, setSheetKey] = useState(0)
  const member = session.status === "ready" && session.data.status === "signed_in" ? session.data.membership : null
  if (jobs === null) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button disabled>{t("jobs.apply.cta")}</Button>
        <p className="text-sm text-muted-foreground">{t("jobs.unavailable.body")}</p>
      </div>
    )
  }
  // Déjà candidat : l'état de la candidature, jamais un second envoi. La feuille ouverte reste
  // montée (la fiche réactive reçoit la candidature pendant que la confirmation s'affiche).
  if (props.offer.myApplication !== null && !open) {
    return (
      <Card className="flex flex-col items-start gap-2 p-4">
        <p className="text-sm">{t("jobs.offer.applied", { status: t(`jobs.applicationStatus.${props.offer.myApplication.status}`) })}</p>
        <Button asChild variant="outline" size="sm"><NextLink href={routes.myApplications()}>{t("jobs.offer.myApplications")}</NextLink></Button>
      </Card>
    )
  }
  if (props.offer.status !== "open" && !open) return null
  const canPublish = member !== null && member.status !== "partie" && member.canPublish
  return (
    <div className="flex flex-col items-start gap-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <Button
          disabled={!canPublish}
          aria-haspopup="dialog"
          onClick={() => {
            setSheetKey((value) => value + 1)
            setOpen(true)
          }}
        >
          <SendIcon aria-hidden />
          {t("jobs.apply.cta")}
        </Button>
        {open ? (
          <SheetContent
            title={t("jobs.apply.title", { offer: props.offer.title })}
            description={t("jobs.apply.description", { page: props.offer.employer.name })}
            closeLabel={t("common.close")}
          >
            <ApplyForm key={sheetKey} jobs={jobs} offer={props.offer} onClose={() => setOpen(false)} />
          </SheetContent>
        ) : null}
      </Sheet>
      {member !== null && !canPublish ? <p className="text-sm text-muted-foreground">{t("jobs.apply.statusInsufficient")}</p> : null}
    </div>
  )
}

function ApplyForm(props: { readonly jobs: JobsCapability; readonly offer: JobOfferDetailView; readonly onClose: () => void }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const talent = props.jobs.useMyTalentProfile()
  const [idempotencyKey, setIdempotencyKey] = useState(newJobIdempotencyKey)
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<ActionErrorCode | null>(null)
  const form = useForm<ApplyValues>({ resolver: zodResolver(applySchema), defaultValues: { message: "", shareTalentProfile: false, consent: false } })
  const locked = useRef(false)
  const errors = form.formState.errors
  const message = (code: string | undefined) => (code ? t(`errors.${code}`) : undefined)
  const profile = talent.status === "ready" ? talent.data : null
  const attachable = profile !== null && profile.status === "active"

  const validatedSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    if (jobTextHasContact(values.message)) return form.setError("message", { message: "job_contact_details_forbidden" })
    try {
      const result = await props.jobs.apply({
        jobId: props.offer.id,
        offerVersion: props.offer.version,
        message: values.message,
        shareName: values.consent,
        shareTalentProfile: attachable && values.shareTalentProfile,
        idempotencyKey,
      })
      if (result.ok) {
        setSent(true)
        toast.success(t("jobs.apply.sent"))
        return
      }
      // Un autre corps sous la même clé : la feuille repart d'une clé neuve, sans rien deviner.
      if (result.code === "job_application_idempotency_conflict") setIdempotencyKey(newJobIdempotencyKey())
      setFormError(result.code)
    } catch {
      setFormError("unknown")
    }
  })

  /** Un envoi à la fois ; un renvoi rejoue la même clé, donc la même candidature. */
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (locked.current) return
    locked.current = true
    try {
      await validatedSubmit(event)
    } finally {
      locked.current = false
    }
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2Icon aria-hidden className="size-5 text-primary" />
          {t("jobs.apply.sent")}
        </p>
        <p className="text-sm">{t("jobs.apply.sentBody", { page: props.offer.employer.name })}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <NextLink href={routes.myApplications()}>{t("jobs.apply.myApplications")}</NextLink>
          </Button>
          <Button variant="ghost" onClick={props.onClose}>{t("common.close")}</Button>
        </div>
      </div>
    )
  }

  const busy = form.formState.isSubmitting
  return (
    <form noValidate className="flex min-w-0 flex-col gap-4" onSubmit={submit}>
      <Field
        id={`${id}-message`}
        label={t("jobs.apply.message")}
        hint={t("jobs.apply.messageHint", { min: JOB_APPLICATION_MESSAGE_MIN_LENGTH })}
        error={message(errors.message?.message)}
      >
        {(field) => (
          <Textarea id={field.id} rows={6} maxLength={JOB_APPLICATION_MESSAGE_MAX_LENGTH} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("message")} />
        )}
      </Field>

      <div className="flex flex-col gap-1.5">
        {attachable ? (
          <div className="flex items-start gap-3">
            <Controller
              control={form.control}
              name="shareTalentProfile"
              render={({ field }) => (
                <Checkbox id={`${id}-profil`} checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} onBlur={field.onBlur} disabled={busy} />
              )}
            />
            <Label htmlFor={`${id}-profil`} className="font-normal leading-snug">{t("jobs.apply.shareProfile", { title: profile.title })}</Label>
          </div>
        ) : profile !== null ? (
          <p className="text-[13px] text-muted-foreground">{t("jobs.apply.profileHidden")}</p>
        ) : talent.status === "ready" ? (
          <p className="text-[13px] text-muted-foreground">
            {t("jobs.apply.noProfile")}{" "}
            <NextLink href={routes.talents()} className="font-medium text-primary underline-offset-4 hover:underline">{t("jobs.apply.createProfile")}</NextLink>
          </p>
        ) : null}
      </div>

      <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("jobs.apply.reminder")}</p>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-3">
          <Controller
            control={form.control}
            name="consent"
            render={({ field }) => (
              <Checkbox
                id={`${id}-consentement`}
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                onBlur={field.onBlur}
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={errors.consent ? `${id}-consentement-erreur` : undefined}
                disabled={busy}
              />
            )}
          />
          <Label htmlFor={`${id}-consentement`} className="font-normal leading-snug">{t("jobs.apply.consent", { page: props.offer.employer.name })}</Label>
        </div>
        {errors.consent?.message ? <p id={`${id}-consentement-erreur`} role="alert" className="text-[13px] font-medium text-destructive">{message(errors.consent.message)}</p> : null}
      </div>

      {formError ? (
        <div role="alert" className="flex flex-col items-start gap-2 text-sm">
          <p className="font-medium text-destructive">{OFFER_MOVED.has(formError) ? t(formError === "not_found" ? "jobs.apply.closed" : "jobs.apply.changed") : t(`errors.${formError}`)}</p>
          {formError === "job_application_already_exists" ? (
            <Button asChild variant="outline" size="sm">
              <NextLink href={routes.myApplications()}>{t("jobs.apply.myApplications")}</NextLink>
            </Button>
          ) : null}
          {OFFER_MOVED.has(formError) ? <Button variant="outline" size="sm" onClick={props.onClose}>{t("jobs.apply.reread")}</Button> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy} aria-busy={busy}>{t(busy ? "jobs.apply.sending" : "jobs.apply.submit")}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={props.onClose}>{t("common.cancel")}</Button>
      </div>
    </form>
  )
}
