"use client"

/**
 * Les écrans « associations » (DG-010) :
 *
 * - `/pages/<handle>/adherents` — pour les RESPONSABLES vivants de l'association
 *   seulement (refus indistinct sinon) : demandes à accepter ou refuser,
 *   adhérents (rôle, exclusion motivée), exclusions (nouvelle demande autorisée) ;
 * - `/mes-associations` — mes adhésions et mes demandes, annuler ou quitter.
 *
 * L'autorité reste au serveur (moteur ou démonstration) : ces écrans ne
 * cachent pas un bouton pour protéger une donnée, ils disent ce que le
 * fournisseur a déjà jugé. PROPRIÉTAIRE : chantier « associations ».
 */
import {
  ASSOCIATION_DECISION_REASON_MAX,
  ASSOCIATION_LIST_STATUSES,
  ASSOCIATION_REJECTION_COOLDOWN_DAYS,
  ASSOCIATION_REMOVAL_REASON_MIN,
  type AssociationListStatus,
  type AssociationResponsibleRole,
} from "@diasporale/domain"
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Field,
  FolderTabs,
  FolderTabsContent,
  FolderTabsList,
  FolderTabsTrigger,
  Sheet,
  SheetClose,
  SheetContent,
  Skeleton,
  Textarea,
  formatDate,
} from "@diasporale/features"
import {
  useAssociations,
  type AssociationMemberView,
  type AssociationsCapability,
  type ManagedAssociationView,
  type MembershipView,
  type MyAssociationItemView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, LandmarkIcon, UsersRoundIcon } from "lucide-react"
import NextLink from "next/link"
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { AppShell } from "@/components/app-shell"
import {
  type AssociationFeedback,
  errorKey,
  FeedbackLine,
  LeaveAssociationButton,
  ListPager,
  useCursorPages,
  useGuardedAction,
} from "@/components/association-parts"
import { Gate } from "@/components/gate"
import { routes } from "@/lib/routes"

const linkClass = "break-words font-semibold text-primary hover:underline focus-visible:shadow-focus"

function ListSkeleton() {
  const { t } = useDiasporaleT()
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">{t("common.pleaseWait")}</span>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  )
}

function Unavailable() {
  const { t } = useDiasporaleT()
  return <EmptyState icon={<UsersRoundIcon />} title={t("associations.unavailable.title")} description={t("associations.unavailable.body")} />
}

// ═══════════════════════════════════════════════════════════════
// Les adhérents d'une association (responsables seulement)
// ═══════════════════════════════════════════════════════════════

/** `/pages/[handle]/adherents` — demandes, adhérents et exclusions d'une association. */
export function AssociationMembersScreen(props: { readonly handle: string }) {
  return (
    <Gate require="member">
      {(session) => session.membership ? (
        <AppShell membership={session.membership}>
          <AssociationMembers handle={props.handle} />
        </AppShell>
      ) : null}
    </Gate>
  )
}

function AssociationMembers(props: { readonly handle: string }) {
  const associations = useAssociations()
  if (!associations) return <Unavailable />
  return <ManagedAssociation associations={associations} handle={props.handle} />
}

function ManagedAssociation(props: { readonly associations: AssociationsCapability; readonly handle: string }) {
  const { t } = useDiasporaleT()
  const managed = props.associations.useManagedAssociation(props.handle)
  if (managed.status === "loading") return <ListSkeleton />
  if (managed.status === "error") {
    return managed.code === "not_found"
      ? <EmptyState icon={<LandmarkIcon />} title={t("associations.members.notFoundTitle")} description={t("associations.members.notFoundBody")} />
      : <p role="alert" className="text-sm text-destructive">{t(errorKey(managed.code))}</p>
  }
  return <MembersBoard associations={props.associations} association={managed.data} />
}

function MembersBoard(props: { readonly associations: AssociationsCapability; readonly association: ManagedAssociationView }) {
  const { t } = useDiasporaleT()
  const [tab, setTab] = useState<AssociationListStatus>("requested")
  const role: AssociationResponsibleRole = props.association.role
  return (
    <>
      <div className="flex min-w-0 flex-col gap-2">
        <NextLink href={routes.page(props.association.handle)} className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium text-primary hover:underline focus-visible:shadow-focus">
          <ArrowLeftIcon aria-hidden className="size-4" />{t("associations.members.backToPage")}
        </NextLink>
        <h1 className="font-display text-3xl font-bold leading-tight">{t("associations.members.title")}</h1>
        <p className="break-words text-lg font-semibold">{props.association.name}</p>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{t("associations.members.lead")}</p>
        <p className="text-sm text-muted-foreground">{t(`associations.members.roleNote.${role}`)}</p>
      </div>
      <Card className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
        <FolderTabs value={tab} onValueChange={(value) => setTab(value as AssociationListStatus)} className="min-w-0">
          <FolderTabsList aria-label={t("associations.members.tabsLabel")} className="flex-wrap overflow-visible">
            {ASSOCIATION_LIST_STATUSES.map((status) => (
              <FolderTabsTrigger key={status} value={status} className="min-h-11 flex-1 whitespace-normal px-3 text-center">
                {t(`associations.members.tab.${status}`)}
              </FolderTabsTrigger>
            ))}
          </FolderTabsList>
          {ASSOCIATION_LIST_STATUSES.map((status) => (
            <FolderTabsContent key={status} value={status}>
              <MembersList associations={props.associations} pageId={props.association.pageId} status={status} role={role} />
            </FolderTabsContent>
          ))}
        </FolderTabs>
      </Card>
    </>
  )
}

type Dialog = { readonly kind: "reject" | "remove"; readonly item: AssociationMemberView }

function MembersList(props: { readonly associations: AssociationsCapability; readonly pageId: string; readonly status: AssociationListStatus; readonly role: AssociationResponsibleRole }) {
  const { t } = useDiasporaleT()
  const pages = useCursorPages()
  const list = props.associations.useMembers({ pageId: props.pageId, status: props.status, cursor: pages.cursor })
  const { busy, run } = useGuardedAction()
  const [feedback, setFeedback] = useState<AssociationFeedback | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const results = useRef<HTMLDivElement>(null)

  const act = async (key: string, done: "accepted" | "roleChanged" | "readmissionAllowed", work: () => ReturnType<AssociationsCapability["decide"]>) => {
    setFeedback(null)
    const result = await run(key, work)
    if (!result) return
    setFeedback(result.ok ? { tone: "status", text: t(`associations.feedback.${done}`) } : { tone: "alert", text: t(errorKey(result.code)) })
    if (result.ok) results.current?.focus()
  }

  const isAdmin = props.role === "admin"
  const continueCursor = list.status === "ready" ? list.data.continueCursor : null

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div ref={results} tabIndex={-1} className="min-w-0 rounded-md focus-visible:shadow-focus" aria-busy={list.status === "loading"}>
        {list.status === "loading" ? <ListSkeleton /> : list.status === "error" ? (
          <p role="alert" className="text-sm text-destructive">{t(errorKey(list.code))}</p>
        ) : list.data.items.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            {t(pages.index > 0 ? "associations.list.emptyPage" : `associations.members.empty.${props.status}`)}
          </p>
        ) : (
          <ul className="flex min-w-0 flex-col gap-3">
            {list.data.items.map((item) => (
              <MemberRow key={item.membershipId} item={item}>
                {item.status === "requested" ? (
                  <>
                    <Button
                      disabled={busy !== null}
                      aria-busy={busy === `accept:${item.membershipId}`}
                      onClick={() => void act(`accept:${item.membershipId}`, "accepted", () => props.associations.decide({ membershipId: item.membershipId, decision: "accept", expectedVersion: item.version, reason: "" }))}
                    >
                      {t(busy === `accept:${item.membershipId}` ? "common.pleaseWait" : "associations.members.accept")}
                    </Button>
                    <Button variant="outline" disabled={busy !== null} onClick={() => setDialog({ kind: "reject", item })}>{t("associations.members.reject")}</Button>
                  </>
                ) : item.status === "accepted" && isAdmin ? (
                  <>
                    <Button
                      variant="outline"
                      disabled={busy !== null}
                      aria-busy={busy === `role:${item.membershipId}`}
                      onClick={() => void act(`role:${item.membershipId}`, "roleChanged", () => props.associations.setRole({ membershipId: item.membershipId, expectedVersion: item.version, role: item.role === "animator" ? "member" : "animator" }))}
                    >
                      {t(item.role === "animator" ? "associations.members.makeMember" : "associations.members.makeAnimator")}
                    </Button>
                    <Button variant="ghost" className="text-destructive" disabled={busy !== null} onClick={() => setDialog({ kind: "remove", item })}>{t("associations.members.remove")}</Button>
                  </>
                ) : item.status === "removed" && isAdmin && !item.readmissionAllowed ? (
                  <Button
                    variant="outline"
                    disabled={busy !== null}
                    aria-busy={busy === `readmit:${item.membershipId}`}
                    onClick={() => void act(`readmit:${item.membershipId}`, "readmissionAllowed", () => props.associations.allowReadmission({ membershipId: item.membershipId, expectedVersion: item.version }))}
                  >
                    {t("associations.members.allowReadmission")}
                  </Button>
                ) : null}
              </MemberRow>
            ))}
          </ul>
        )}
      </div>
      <FeedbackLine feedback={dialog ? null : feedback} />
      <ListPager
        index={pages.index}
        canPrevious={pages.index > 0 && busy === null}
        canNext={continueCursor !== null && busy === null}
        onPrevious={() => { setFeedback(null); pages.previous() }}
        onNext={() => { setFeedback(null); pages.next(continueCursor) }}
      />
      {dialog ? (
        <DecisionSheet
          key={`${dialog.kind}:${dialog.item.membershipId}`}
          associations={props.associations}
          dialog={dialog}
          onClose={() => setDialog(null)}
          onDone={(kind) => {
            setDialog(null)
            setFeedback({ tone: "status", text: t(`associations.feedback.${kind === "reject" ? "rejected" : "removed"}`) })
            results.current?.focus()
          }}
        />
      ) : null}
    </div>
  )
}

function MemberRow(props: { readonly item: AssociationMemberView; readonly children: ReactNode }) {
  const { t, locale } = useDiasporaleT()
  const { item } = props
  const name = item.person.displayName ?? t("associations.members.unknownPerson")
  const date = formatDate(item.statusChangedAt, locale)
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar id={item.membershipId} name={name} />
        <div className="min-w-0 flex-1">
          {item.person.handle && item.person.displayName ? <NextLink href={routes.profile(item.person.handle)} className={linkClass}>{name}</NextLink> : <p className="break-words font-semibold">{name}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {item.status === "requested"
              ? t("associations.members.requestedAt", { date })
              : item.status === "removed" ? t("associations.members.removedAt", { date }) : t("associations.members.memberSince", { date })}
          </p>
          {item.status === "accepted" ? <p className="mt-1 text-sm">{t("associations.members.role", { role: t(`associations.role.${item.role}`) })}</p> : null}
        </div>
      </div>
      {item.requestMessage ? <p className="whitespace-pre-line break-words text-sm">{t("associations.members.message", { message: item.requestMessage })}</p> : null}
      {item.decisionReason ? <p className="whitespace-pre-line break-words text-sm text-muted-foreground">{t("associations.reason", { reason: item.decisionReason })}</p> : null}
      {item.status === "removed" && item.readmissionAllowed ? <p className="text-sm">{t("associations.members.readmissionAllowed")}</p> : null}
      <div className="flex flex-wrap items-center gap-2">{props.children}</div>
    </li>
  )
}

const rejectSchema = z.object({
  reason: z.string().trim().max(ASSOCIATION_DECISION_REASON_MAX, "association_reason_too_long"),
})
const removeSchema = z.object({
  reason: z.string().trim().min(ASSOCIATION_REMOVAL_REASON_MIN, "association_reason_required").max(ASSOCIATION_DECISION_REASON_MAX, "association_reason_too_long"),
})
type ReasonValues = z.infer<typeof rejectSchema>

/** Refuser (motif facultatif) ou exclure (motif obligatoire) : une feuille, la version lue, une issue dite. */
function DecisionSheet(props: { readonly associations: AssociationsCapability; readonly dialog: Dialog; readonly onClose: () => void; readonly onDone: (kind: Dialog["kind"]) => void }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const removal = props.dialog.kind === "remove"
  const form = useForm<ReasonValues>({ resolver: zodResolver(removal ? removeSchema : rejectSchema), defaultValues: { reason: "" } })
  const [error, setError] = useState<string | null>(null)
  const sending = useRef(false)
  const busy = form.formState.isSubmitting
  const name = props.dialog.item.person.displayName ?? t("associations.members.unknownPerson")
  const send = async ({ reason }: ReasonValues) => {
    setError(null)
    try {
      const { membershipId, version } = props.dialog.item
      const result = removal
        ? await props.associations.remove({ membershipId, expectedVersion: version, reason })
        : await props.associations.decide({ membershipId, decision: "reject", expectedVersion: version, reason })
      if (result.ok) props.onDone(props.dialog.kind)
      else setError(errorKey(result.code))
    } catch {
      setError(errorKey("unknown"))
    }
  }
  // Une seule décision à la fois, même sur deux validations rapprochées.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sending.current) return
    sending.current = true
    void form.handleSubmit(send)(event).finally(() => { sending.current = false })
  }
  const reasonError = form.formState.errors.reason?.message
  return (
    <Sheet open onOpenChange={(open) => { if (!open && !busy) props.onClose() }}>
      <SheetContent
        title={t(removal ? "associations.removeSheet.title" : "associations.rejectSheet.title", { name })}
        description={removal ? t("associations.removeSheet.description") : t("associations.rejectSheet.description", { days: ASSOCIATION_REJECTION_COOLDOWN_DAYS })}
        closeLabel={t("common.close")}
      >
        <form noValidate className="flex flex-col gap-4" onSubmit={submit}>
          <Field
            id={`${id}-motif`}
            label={t(removal ? "associations.removeSheet.reason" : "associations.rejectSheet.reason")}
            hint={removal
              ? t("associations.removeSheet.reasonHint", { min: ASSOCIATION_REMOVAL_REASON_MIN, max: ASSOCIATION_DECISION_REASON_MAX })
              : t("associations.rejectSheet.reasonHint", { max: ASSOCIATION_DECISION_REASON_MAX })}
            error={reasonError ? t(errorKey(reasonError)) : undefined}
          >
            {(field) => (
              <Textarea
                id={field.id}
                aria-describedby={field.describedBy}
                aria-invalid={field.invalid || undefined}
                rows={4}
                maxLength={ASSOCIATION_DECISION_REASON_MAX}
                disabled={busy}
                {...form.register("reason")}
              />
            )}
          </Field>
          {error ? <p role="alert" className="text-sm font-medium text-destructive">{t(error)}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <SheetClose asChild><Button variant="ghost" disabled={busy}>{t("common.cancel")}</Button></SheetClose>
            <Button type="submit" variant={removal ? "destructive" : "primary"} disabled={busy}>
              {t(busy ? "common.pleaseWait" : removal ? "associations.removeSheet.confirm" : "associations.rejectSheet.confirm")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ═══════════════════════════════════════════════════════════════
// Mes associations
// ═══════════════════════════════════════════════════════════════

/** `/mes-associations` — mes adhésions et mes demandes. */
export function MyAssociationsScreen() {
  return (
    <Gate require="member">
      {(session) => session.membership ? (
        <AppShell membership={session.membership}>
          <MyAssociations membership={session.membership} />
        </AppShell>
      ) : null}
    </Gate>
  )
}

function MyAssociations(props: { readonly membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const associations = useAssociations()
  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold">{t("associations.mine.title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t("associations.mine.lead")}</p>
      </div>
      {associations ? <MyAssociationsList associations={associations} membership={props.membership} /> : <Unavailable />}
    </>
  )
}

function MyAssociationsList(props: { readonly associations: AssociationsCapability; readonly membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const pages = useCursorPages()
  const list = props.associations.useMyAssociations({ cursor: pages.cursor })
  const { busy, run } = useGuardedAction()
  const [feedback, setFeedback] = useState<AssociationFeedback | null>(null)

  const gesture = async (key: "cancelled" | "left", work: () => ReturnType<AssociationsCapability["leave"]>) => {
    setFeedback(null)
    const result = await run(key, work)
    if (!result) return false
    setFeedback(result.ok ? { tone: "status", text: t(`associations.feedback.${key}`) } : { tone: "alert", text: t(errorKey(result.code)) })
    return result.ok
  }

  if (list.status === "loading") return <ListSkeleton />
  if (list.status === "error") return <p role="alert" className="text-sm text-destructive">{t(errorKey(list.code))}</p>
  if (list.data.items.length === 0 && pages.index === 0) {
    return (
      <EmptyState
        icon={<UsersRoundIcon />}
        title={t("associations.mine.emptyTitle")}
        description={t("associations.mine.emptyBody")}
        action={<Button asChild variant="outline"><NextLink href={routes.hub(props.membership.facet.countryOfResidence)}>{t("associations.mine.emptyAction")}</NextLink></Button>}
      />
    )
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {list.data.items.length === 0 ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("associations.list.emptyPage")}</p>
      ) : (
        <ul className="flex min-w-0 flex-col gap-3">
          {list.data.items.map((item) => (
            <MyAssociationRow key={item.membershipId} item={item}>
              {item.status === "requested" ? (
                <Button variant="outline" disabled={busy !== null} aria-busy={busy === `cancel:${item.membershipId}`} onClick={() => void gesture("cancelled", () => props.associations.cancelRequest(item.page.id))}>
                  {t("associations.cancelRequest")}
                </Button>
              ) : item.status === "accepted" ? (
                <LeaveAssociationButton busy={busy !== null} onConfirm={() => gesture("left", () => props.associations.leave(item.page.id))} />
              ) : null}
            </MyAssociationRow>
          ))}
        </ul>
      )}
      <FeedbackLine feedback={feedback} />
      <ListPager
        index={pages.index}
        canPrevious={pages.index > 0 && busy === null}
        canNext={list.data.continueCursor !== null && busy === null}
        onPrevious={() => { setFeedback(null); pages.previous() }}
        onNext={() => { setFeedback(null); pages.next(list.data.continueCursor) }}
      />
    </div>
  )
}

function MyAssociationRow(props: { readonly item: MyAssociationItemView; readonly children: ReactNode }) {
  const { t, locale } = useDiasporaleT()
  const { item } = props
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar id={item.page.id} name={item.page.name} />
        <div className="min-w-0 flex-1">
          <NextLink href={routes.page(item.page.handle)} className={linkClass}>{item.page.name}</NextLink>
          <p className="mt-1 text-sm">{t(`associations.status.${item.status}`)}</p>
          {item.status === "accepted" && item.role === "animator" ? <p className="text-sm text-muted-foreground">{t("associations.members.role", { role: t("associations.role.animator") })}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">{t("associations.mine.since", { date: formatDate(item.statusChangedAt, locale) })}</p>
        </div>
      </div>
      {item.decisionReason ? <p className="whitespace-pre-line break-words text-sm text-muted-foreground">{t("associations.reason", { reason: item.decisionReason })}</p> : null}
      <div className="flex flex-wrap items-center gap-2">{props.children}</div>
    </li>
  )
}
