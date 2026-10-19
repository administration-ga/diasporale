"use client"

/**
 * Revendiquer une page, ou en demander la vérification (EXF-AN-17, DG-008).
 * PROPRIÉTAIRE : chantier « gestion des pages ».
 *
 * Les pièces sont PRIVÉES : déposées neuves au moment de l'envoi par la garde
 * des fichiers du moteur, lues par la modération du réseau et le demandeur
 * seuls, effacées si la demande est retirée. Le mandat est DÉCLARÉ (les pièces
 * le prouvent) ; le consentement est explicite, jamais précoché. Une
 * revendication validée rend la page « Vérifié » — jamais « Officiel ».
 */
import { Button, Card, Checkbox, Field, Label, RadioCard, RadioGroup, Skeleton, Textarea, formatDate } from "@diasporale/features"
import {
  PAGE_CLAIM_DETAILS_MAX_LENGTH,
  PAGE_CLAIM_EVIDENCE_ACCEPT,
  PAGE_CLAIM_EVIDENCE_MAX,
  PAGE_CLAIM_EVIDENCE_MAX_BYTES,
  PAGE_CLAIM_MANDATES,
  pageClaimNoteRefusal,
  pageEvidenceRefusal,
  pageEvidenceSetRefusal,
  type ActionErrorCode,
  type ManagedPageDetailView,
  type PageClaimView,
  type PageManagement,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { FileTextIcon, LockIcon, PaperclipIcon, ScaleIcon, ShieldCheckIcon, UndoIcon, XIcon } from "lucide-react"
import { useId, useRef, useState, type ChangeEvent } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { ClaimStatusChip, ConfirmSheet, ErrorNotice } from "./page-admin-parts"

const MEGABYTE = 1024 * 1024

const claimSchema = z.object({
  mandate: z.enum(PAGE_CLAIM_MANDATES, { errorMap: () => ({ message: "page_claim_mandate_required" }) }),
  details: z.string().max(PAGE_CLAIM_DETAILS_MAX_LENGTH, "page_claim_note_too_long"),
  consent: z.boolean().refine((value) => value, "page_claim_consent_required"),
})

type ClaimValues = z.infer<typeof claimSchema>

/** La page de revendication : ce que c'est, ce qui est privé, la demande en cours, le formulaire. */
export function PageClaimPanel(props: { readonly management: PageManagement; readonly page: ManagedPageDetailView }) {
  const { t } = useDiasporaleT()
  const { page } = props
  const claims = props.management.useMyClaims()
  const mine = claims.status === "ready" ? claims.data.filter((claim) => claim.page.id === page.id) : []
  const pending = mine.find((claim) => claim.status === "pending") ?? null
  const history = mine.filter((claim) => claim.status !== "pending")
  const verification = page.myRole === "admin"

  return (
    <div className="flex flex-col gap-5">
      <ClaimExplainer />
      {page.badge === "official" ? (
        <Notice>{t("pageAdmin.claim.officialPage")}</Notice>
      ) : page.badge === "verified" ? (
        <Notice>{t("pageAdmin.claim.verifiedPage")}</Notice>
      ) : page.myRole === "signatory" ? (
        <Notice>{t("pageAdmin.claim.signatoryOnly")}</Notice>
      ) : claims.status === "loading" ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : claims.status === "error" ? (
        <ErrorNotice code={claims.code} />
      ) : pending ? (
        <PendingClaim management={props.management} claim={pending} />
      ) : (
        <Card className="p-5">
          <h2 className="font-display text-xl font-bold">{t(verification ? "pageAdmin.claim.verifyFormTitle" : "pageAdmin.claim.formTitle")}</h2>
          <ClaimForm management={props.management} page={page} verification={verification} />
        </Card>
      )}
      {history.length > 0 ? <ClaimHistory claims={history} /> : null}
    </div>
  )
}

function Notice(props: { readonly children: string }) {
  return <p role="status" className="rounded-xl bg-muted p-4 text-[15px] leading-relaxed">{props.children}</p>
}

function ClaimExplainer() {
  const { t } = useDiasporaleT()
  const items = [
    { icon: FileTextIcon, key: "pageAdmin.claim.how.evidence" },
    { icon: LockIcon, key: "pageAdmin.claim.how.private" },
    { icon: ScaleIcon, key: "pageAdmin.claim.how.decision" },
    { icon: ShieldCheckIcon, key: "pageAdmin.claim.how.notOfficial" },
    { icon: UndoIcon, key: "pageAdmin.claim.how.withdraw" },
  ] as const
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="font-display text-xl font-bold">{t("pageAdmin.claim.how.title")}</h2>
      <ul className="flex flex-col gap-3">
        {items.map(({ icon: Icon, key }) => (
          <li key={key} className="flex items-start gap-3 text-[15px] leading-relaxed">
            <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function PendingClaim(props: { readonly management: PageManagement; readonly claim: PageClaimView }) {
  const { t, locale } = useDiasporaleT()
  const [confirming, setConfirming] = useState(false)
  const [refusal, setRefusal] = useState<ActionErrorCode | null>(null)
  const withdraw = async () => {
    setRefusal(null)
    const result = await props.management.withdrawClaim(props.claim.id)
    if (!result.ok) {
      setRefusal(result.code)
      return true
    }
    if (result.value.withdrawn) toast.success(t("pageAdmin.claim.withdrawn"))
    else setRefusal("page_claim_closed")
    return true
  }
  return (
    <Card className="flex flex-col items-start gap-3 p-5">
      <ClaimStatusChip status="pending" />
      <h2 className="font-display text-xl font-bold">{t("pageAdmin.claim.pendingTitle")}</h2>
      <p className="text-[15px] leading-relaxed">
        {t("pageAdmin.claim.pendingBody", { count: props.claim.evidenceCount, date: formatDate(props.claim.createdAt, locale) })}
      </p>
      {refusal ? <ErrorNotice code={refusal} /> : null}
      <Button variant="outline" onClick={() => setConfirming(true)}>
        <UndoIcon aria-hidden />
        {t("pageAdmin.claim.withdraw")}
      </Button>
      <ConfirmSheet
        open={confirming}
        onOpenChange={setConfirming}
        title={t("pageAdmin.claim.withdrawConfirmTitle")}
        body={t("pageAdmin.claim.withdrawConfirmBody")}
        confirm={t("pageAdmin.claim.withdraw")}
        onConfirm={withdraw}
      />
    </Card>
  )
}

function ClaimHistory(props: { readonly claims: readonly PageClaimView[] }) {
  const { t, locale } = useDiasporaleT()
  return (
    <section aria-labelledby="revendications-precedentes" className="flex flex-col gap-3">
      <h2 id="revendications-precedentes" className="font-display text-lg font-bold">{t("pageAdmin.claim.history")}</h2>
      <ul className="flex flex-col gap-2">
        {props.claims.map((claim) => (
          <li key={claim.id} className="flex flex-col gap-1 rounded-xl bg-muted p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <ClaimStatusChip status={claim.status} />
              <span className="text-muted-foreground">{formatDate(claim.decidedAt ?? claim.createdAt, locale)}</span>
            </div>
            {claim.decisionReason ? <p>{t("pageAdmin.claim.decisionReason", { reason: claim.decisionReason })}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

function fileSize(bytes: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.max(bytes, 1) / MEGABYTE)
}

/** Le formulaire : pièces (jugées avant tout dépôt), mandat déclaré, précisions, consentement explicite. */
export function ClaimForm(props: { readonly management: PageManagement; readonly page: ManagedPageDetailView; readonly verification: boolean }) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const [files, setFiles] = useState<readonly File[]>([])
  const [filesError, setFilesError] = useState<ActionErrorCode | null>(null)
  const [refusal, setRefusal] = useState<ActionErrorCode | null>(null)
  const running = useRef(false)
  const picker = useRef<HTMLInputElement>(null)
  const form = useForm<ClaimValues>({ resolver: zodResolver(claimSchema), defaultValues: { details: "", consent: false } })
  const errors = form.formState.errors
  const busy = form.formState.isSubmitting

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (chosen.length === 0) return
    // Une pièce refusée ne rejoint pas la liste : elle ne quittera jamais le navigateur.
    const refused = chosen.map((file) => pageEvidenceRefusal(file)).find((code) => code !== null) ?? null
    const next = [...files, ...chosen.filter((file) => pageEvidenceRefusal(file) === null)].slice(0, PAGE_CLAIM_EVIDENCE_MAX)
    setFiles(next)
    setFilesError(refused ?? (files.length + chosen.length > PAGE_CLAIM_EVIDENCE_MAX ? "page_claim_evidence_count" : null))
  }

  // La soumission se valide au geste, jamais pendant le rendu.
  const onValid = async (values: ClaimValues) => {
    if (running.current) return
    const evidenceRefusal = pageEvidenceSetRefusal(files)
    if (evidenceRefusal) {
      setFilesError(evidenceRefusal)
      return
    }
    const mandate = t(`pageAdmin.claim.mandate.${values.mandate}`)
    const details = values.details.trim()
    const note = details ? t("pageAdmin.claim.noteWithDetails", { mandate, details }) : t("pageAdmin.claim.noteMandate", { mandate })
    const noteRefusal = pageClaimNoteRefusal(note)
    if (noteRefusal) {
      setRefusal(noteRefusal)
      return
    }
    running.current = true
    setRefusal(null)
    try {
      const result = await props.management.requestClaim({ pageId: props.page.id, note, evidence: files })
      if (!result.ok) {
        setRefusal(result.code)
        return
      }
      toast.success(t("pageAdmin.claim.sent"))
      setFiles([])
      form.reset({ details: "", consent: false })
    } catch {
      setRefusal("unknown")
    } finally {
      running.current = false
    }
  }

  const evidenceHintId = `${id}-pieces-aide`
  const evidenceErrorId = `${id}-pieces-erreur`
  return (
    <form noValidate onSubmit={(event) => void form.handleSubmit(onValid)(event)} className="mt-4 flex flex-col gap-5" aria-busy={busy}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("pageAdmin.claim.evidence")}</legend>
        <p id={evidenceHintId} className="text-[13px] leading-snug text-muted-foreground">
          {t("pageAdmin.claim.evidenceHint", { max: PAGE_CLAIM_EVIDENCE_MAX, size: PAGE_CLAIM_EVIDENCE_MAX_BYTES / MEGABYTE })}
        </p>
        {files.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-md bg-muted px-3 py-2 text-sm">
                <PaperclipIcon aria-hidden className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="shrink-0 text-muted-foreground">{t("pageAdmin.claim.fileSize", { size: fileSize(file.size, locale) })}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy}
                  aria-label={t("pageAdmin.claim.removeEvidence", { name: file.name })}
                  onClick={() => {
                    setFiles(files.filter((_, position) => position !== index))
                    setFilesError(null)
                  }}
                >
                  <XIcon aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          ref={picker}
          id={`${id}-pieces`}
          type="file"
          multiple
          accept={PAGE_CLAIM_EVIDENCE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-describedby={[evidenceHintId, filesError ? evidenceErrorId : null].filter(Boolean).join(" ")}
          onChange={pick}
          disabled={busy || files.length >= PAGE_CLAIM_EVIDENCE_MAX}
        />
        <Label htmlFor={`${id}-pieces`} className="sr-only">
          {t("pageAdmin.claim.addEvidence")}
        </Label>
        <Button type="button" variant="outline" className="self-start" disabled={busy || files.length >= PAGE_CLAIM_EVIDENCE_MAX} aria-describedby={evidenceHintId} onClick={() => picker.current?.click()}>
          <PaperclipIcon aria-hidden />
          {t("pageAdmin.claim.addEvidence")}
        </Button>
        {filesError ? (
          <p id={evidenceErrorId} role="alert" className="text-[13px] font-medium text-destructive">
            {t(`errors.${filesError}`)}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("pageAdmin.claim.mandateLegend")}</legend>
        <p className="text-[13px] leading-snug text-muted-foreground">{t("pageAdmin.claim.mandateHint")}</p>
        <Controller
          control={form.control}
          name="mandate"
          render={({ field }) => (
            <RadioGroup value={field.value ?? ""} onValueChange={(value) => field.onChange(value)} aria-label={t("pageAdmin.claim.mandateLegend")} aria-invalid={errors.mandate ? true : undefined}>
              {PAGE_CLAIM_MANDATES.map((mandate) => (
                <RadioCard key={mandate} value={mandate} disabled={busy}>
                  {t(`pageAdmin.claim.mandate.${mandate}`)}
                </RadioCard>
              ))}
            </RadioGroup>
          )}
        />
        {errors.mandate?.message ? (
          <p role="alert" className="text-[13px] font-medium text-destructive">
            {t(`errors.${errors.mandate.message}`)}
          </p>
        ) : null}
      </fieldset>

      <Field
        id={`${id}-precisions`}
        label={t("pageAdmin.claim.details")}
        hint={t("pageAdmin.claim.detailsHint", { max: PAGE_CLAIM_DETAILS_MAX_LENGTH })}
        error={errors.details?.message ? t(`errors.${errors.details.message}`) : undefined}
      >
        {(control) => (
          <Textarea id={control.id} aria-describedby={control.describedBy} aria-invalid={control.invalid || undefined} maxLength={PAGE_CLAIM_DETAILS_MAX_LENGTH} rows={3} disabled={busy} {...form.register("details")} />
        )}
      </Field>

      <Controller
        control={form.control}
        name="consent"
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start gap-3 rounded-xl bg-muted p-4">
              <Checkbox
                id={`${id}-consentement`}
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={errors.consent ? `${id}-consentement-erreur` : undefined}
                disabled={busy}
                className="mt-0.5"
              />
              <Label htmlFor={`${id}-consentement`} className="leading-snug">
                {t("pageAdmin.claim.consent")}
              </Label>
            </div>
            {errors.consent?.message ? (
              <p id={`${id}-consentement-erreur`} role="alert" className="text-[13px] font-medium text-destructive">
                {t(`errors.${errors.consent.message}`)}
              </p>
            ) : null}
          </div>
        )}
      />

      {refusal ? <ErrorNotice code={refusal} /> : null}
      <Button type="submit" className="self-start" disabled={busy}>
        {busy ? t("pageAdmin.claim.sending") : t(props.verification ? "pageAdmin.claim.submitVerify" : "pageAdmin.claim.submit")}
      </Button>
    </form>
  )
}
