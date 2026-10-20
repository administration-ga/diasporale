"use client"

/**
 * Instruire les revendications de pages (DG-008) — la modération du réseau
 * DIASPORALE seule (administrateurs et modérateurs du réseau : le moteur rend
 * le refus indistinct à tout autre lecteur, et l'adaptateur n'interroge même
 * pas la file pour un simple membre). PROPRIÉTAIRE : chantier « gestion des pages ».
 *
 * Trancher est une DÉCISION : motivée (motif de 3 à 500 caractères), tracée par
 * le moteur. Validée, elle fait du demandeur un administrateur et de la page
 * une page « Vérifié » — jamais « Officiel ».
 */
import { Button, Card, Field, RadioCard, RadioGroup, Sheet, SheetContent, Skeleton, Textarea, TrustBadge, formatDate } from "@diasporale/features"
import {
  DECISION_REASON_MAX,
  PAGE_CLAIM_OUTCOMES,
  PAGE_DECISION_REASON_MIN,
  useDataSource,
  type ActionErrorCode,
  type PageClaimView,
  type PageManagement,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { ExternalLinkIcon, GavelIcon } from "lucide-react"
import NextLink from "next/link"
import { useId, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { routes } from "@/lib/routes"

import { ErrorNotice, usePersonLabel } from "./page-admin-parts"

const decisionSchema = z.object({
  decision: z.enum(PAGE_CLAIM_OUTCOMES, { errorMap: () => ({ message: "page_decision_required" }) }),
  reason: z.string().trim().min(PAGE_DECISION_REASON_MIN, "page_decision_reason_length").max(DECISION_REASON_MAX, "page_decision_reason_length"),
})

type DecisionValues = z.infer<typeof decisionSchema>

/** La file des revendications en attente ; rien du tout pour qui ne modère pas le réseau. */
export function ClaimReviewSection(props: { readonly management: PageManagement }) {
  const { t } = useDiasporaleT()
  const source = useDataSource()
  const [cursors, setCursors] = useState<readonly (string | null)[]>([null])
  const cursor = cursors[cursors.length - 1] ?? null
  const queue = props.management.useClaimQueue({ status: "pending", cursor })
  const [open, setOpen] = useState<PageClaimView | null>(null)
  // Tant que le rôle du lecteur n'est pas connu, la section ne s'annonce pas : un membre ordinaire ne la verra jamais.
  if ((queue.status === "loading" && cursors.length === 1) || (queue.status === "ready" && queue.data === null)) return null
  return (
    <section aria-labelledby="revendications-a-instruire" className="flex flex-col gap-3">
      <div>
        <h2 id="revendications-a-instruire" className="font-display text-xl font-bold">{t("pageAdmin.review.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("pageAdmin.review.lead")}</p>
        {source.kind === "demo" ? <p className="mt-1 text-[13px] text-muted-foreground">{t("pageAdmin.review.demoNote")}</p> : null}
      </div>
      {queue.status === "loading" ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : queue.status === "error" ? (
        <ErrorNotice code={queue.code} />
      ) : queue.data === null ? null : queue.data.items.length === 0 ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("pageAdmin.review.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {queue.data.items.map((claim) => (
            <ClaimQueueItem key={claim.id} claim={claim} onOpen={() => setOpen(claim)} />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {queue.status === "ready" && queue.data?.continueCursor ? (
          <Button variant="outline" size="sm" onClick={() => setCursors([...cursors, queue.data?.continueCursor ?? null])}>
            {t("pageAdmin.review.more")}
          </Button>
        ) : null}
        {cursors.length > 1 ? (
          <Button variant="ghost" size="sm" onClick={() => setCursors([null])}>
            {t("pageAdmin.review.first")}
          </Button>
        ) : null}
      </div>
      <Sheet open={open !== null} onOpenChange={(next) => { if (!next) setOpen(null) }}>
        {open ? (
          <SheetContent title={t("pageAdmin.review.sheetTitle", { page: open.page.name })} description={t("pageAdmin.review.sheetDescription")} closeLabel={t("common.close")}>
            <ClaimDecision management={props.management} claim={open} onDecided={() => setOpen(null)} />
          </SheetContent>
        ) : null}
      </Sheet>
    </section>
  )
}

function ClaimQueueItem(props: { readonly claim: PageClaimView; readonly onOpen: () => void }) {
  const { t, locale } = useDiasporaleT()
  const label = usePersonLabel()
  const { claim } = props
  return (
    <li>
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <span className="min-w-0 break-words">{claim.page.name}</span>
            <TrustBadge badge={claim.page.badge} />
          </p>
          <p className="text-sm text-muted-foreground">
            {t("pageAdmin.review.claimant", { name: label(claim.claimant) })}
            {" · "}
            {t("pageAdmin.review.receivedOn", { date: formatDate(claim.createdAt, locale) })}
            {" · "}
            {t("pageAdmin.review.evidenceCount", { count: claim.evidenceCount })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={props.onOpen}>
          <GavelIcon aria-hidden />
          {t("pageAdmin.review.open")}
        </Button>
      </Card>
    </li>
  )
}

/** Le détail d'une revendication (note, pièces servies par la garde) et la décision motivée. */
function ClaimDecision(props: { readonly management: PageManagement; readonly claim: PageClaimView; readonly onDecided: () => void }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const label = usePersonLabel()
  const detail = props.management.useClaim(props.claim.id)
  const [refusal, setRefusal] = useState<ActionErrorCode | null>(null)
  const running = useRef(false)
  const form = useForm<DecisionValues>({ resolver: zodResolver(decisionSchema), defaultValues: { reason: "" } })
  const errors = form.formState.errors
  const busy = form.formState.isSubmitting

  // La soumission se valide au geste, jamais pendant le rendu.
  const onValid = async (values: DecisionValues) => {
    if (running.current) return
    running.current = true
    setRefusal(null)
    try {
      const result = await props.management.decideClaim(props.claim.id, values.decision, values.reason)
      if (!result.ok) {
        setRefusal(result.code)
        return
      }
      toast.success(t("pageAdmin.review.decided"))
      props.onDecided()
    } catch {
      setRefusal("unknown")
    } finally {
      running.current = false
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <dl className="flex flex-col gap-3 text-sm">
        <div>
          <dt className="font-medium">{t("pageAdmin.review.claimantLabel")}</dt>
          <dd className="text-muted-foreground">
            {label(props.claim.claimant)}
            {props.claim.claimant.handle ? ` (@${props.claim.claimant.handle})` : null}
          </dd>
        </div>
        <div>
          <dt className="font-medium">{t("pageAdmin.review.page")}</dt>
          <dd>
            <NextLink href={routes.page(props.claim.page.handle)} className="text-primary underline-offset-4 hover:underline">
              {props.claim.page.name}
            </NextLink>
          </dd>
        </div>
        <div>
          <dt className="font-medium">{t("pageAdmin.review.note")}</dt>
          <dd className="whitespace-pre-line break-words">{props.claim.note ?? t("pageAdmin.review.noNote")}</dd>
        </div>
        <div>
          <dt className="font-medium">{t("pageAdmin.review.evidence")}</dt>
          <dd>
            {detail.status === "loading" ? (
              <Skeleton className="h-10 w-full" />
            ) : detail.status === "error" ? (
              <ErrorNotice code={detail.code} />
            ) : detail.data === null ? null : (
              <ul className="flex flex-col gap-1.5">
                {detail.data.evidence.map((item, index) => (
                  <li key={index}>
                    {item.withheld === null && item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline">
                        <ExternalLinkIcon aria-hidden className="size-4" />
                        {t("pageAdmin.review.evidenceOpen", { index: index + 1 })}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">
                        {t(item.withheld === "fileScanPending" ? "pageAdmin.review.evidencePending" : item.withheld === "fileScanUnavailable" ? "errors:fileScanUnavailable" : item.withheld === "fileQuarantined" ? "pageAdmin.review.evidenceBlocked" : "pageAdmin.review.evidenceKept", { index: index + 1 })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>

      <form noValidate onSubmit={(event) => void form.handleSubmit(onValid)(event)} className="flex flex-col gap-4" aria-busy={busy}>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t("pageAdmin.review.decisionLegend")}</legend>
          <Controller
            control={form.control}
            name="decision"
            render={({ field }) => (
              <RadioGroup value={field.value ?? ""} onValueChange={(value) => field.onChange(value)} aria-label={t("pageAdmin.review.decisionLegend")}>
                {PAGE_CLAIM_OUTCOMES.map((decision) => (
                  <RadioCard key={decision} value={decision} disabled={busy}>
                    {t(`pageAdmin.review.decision.${decision}`)}
                  </RadioCard>
                ))}
              </RadioGroup>
            )}
          />
          {errors.decision?.message ? (
            <p role="alert" className="text-[13px] font-medium text-destructive">
              {t(`errors.${errors.decision.message}`)}
            </p>
          ) : null}
        </fieldset>
        <Field
          id={`${id}-motif`}
          label={t("pageAdmin.review.reason")}
          hint={t("pageAdmin.review.reasonHint", { min: PAGE_DECISION_REASON_MIN, max: DECISION_REASON_MAX })}
          error={errors.reason?.message ? t(`errors.${errors.reason.message}`) : undefined}
        >
          {(control) => (
            <Textarea id={control.id} aria-describedby={control.describedBy} aria-invalid={control.invalid || undefined} maxLength={DECISION_REASON_MAX} rows={3} disabled={busy} {...form.register("reason")} />
          )}
        </Field>
        {refusal ? <ErrorNotice code={refusal} /> : null}
        <Button type="submit" className="self-start" disabled={busy}>
          {busy ? t("common.pleaseWait") : t("pageAdmin.review.submit")}
        </Button>
      </form>
    </div>
  )
}
