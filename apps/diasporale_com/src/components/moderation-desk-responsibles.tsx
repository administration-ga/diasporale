"use client"

/**
 * MD-01 et LX-03 — le bloc « Responsables du réseau » de l'onglet « Équipe » du
 * guichet, pour l'administration du réseau seule (le parent ne le monte que pour
 * elle ; la capacité refuse aussi tout autre rôle).
 *
 *  · la liste : l'administration puis la modération du réseau, chacun par son
 *    profil PUBLIÉ, jamais par une coordonnée ni un nom civil ; un rôle qui ne
 *    s'exerce pas (adhésion en attente ou suspendue) est dit ;
 *  · nommer par identifiant public (la recherche du guichet, `findMember`), puis
 *    le rôle et le motif ;
 *  · changer le rôle ou le retirer : une feuille de confirmation, motif
 *    obligatoire ; son propre rôle est annoncé comme tel ;
 *  · chaque geste passe par `setResponsibleRole` (tranche du moteur et aide
 *    EX-08, ou démonstration) ; les refus sont traduits, dont la règle du
 *    dernier administrateur. Le rôle vaut au geste suivant de la personne : file
 *    du réseau, recours, tableau du pilote.
 * Un seul bouton plein par zone. PROPRIÉTAIRE : chantier « modération par pays ».
 */
import { Avatar, Button, Card, Field, Input, Sheet, SheetContent, Skeleton, HANDLE_MAX_LENGTH, normalizeHandle } from "@diasporale/features"
import {
  DESK_RESPONSIBLE_ROLES,
  otherResponsibleRole,
  type ActionErrorCode,
  type DeskCandidateView,
  type DeskResponsibleRole,
  type DeskResponsibleRoleResult,
  type DeskResponsibleView,
  type DeskRoleChoice,
  type ModerationDeskCapability,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { ShieldCheckIcon, UserCogIcon, UserMinusIcon } from "lucide-react"
import { useId, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import {
  DESK_ACCESS_ERRORS,
  DESK_ERROR_VALUES,
  DeskErrorLine,
  DeskReasonField,
  DeskReasonForm,
  deskHandleLookupSchema,
  deskReasonSchema,
  deskSelectClass,
  useMounted,
  type DeskHandleLookupValues,
} from "./moderation-desk-parts"

/** Le libellé de chaque rôle de responsable (clés citées en toutes lettres). */
const ROLE_LABELS: Readonly<Record<DeskResponsibleRole, string>> = {
  network_admin: "moderationDesk.responsibles.role.network_admin",
  network_moderator: "moderationDesk.responsibles.role.network_moderator",
}

const appointSchema = z.object({ role: z.enum(DESK_RESPONSIBLE_ROLES), reason: deskReasonSchema })
type AppointValues = z.infer<typeof appointSchema>

/** Le geste demandé sur une ligne de la liste : changer de rôle, ou retirer le rôle. */
type Pending = { readonly kind: "change" | "remove"; readonly member: DeskResponsibleView }

function useNames() {
  const { t } = useDiasporaleT()
  return {
    role: (role: DeskResponsibleRole) => t(ROLE_LABELS[role]),
    person: (displayName: string | null) => displayName ?? t("moderationDesk.team.neutralName"),
  }
}

/** Le message d'un geste abouti : rien n'a changé, le rôle est retiré, ou ce qu'il est devenu. */
function useSuccessMessage() {
  const { t } = useDiasporaleT()
  const names = useNames()
  return (name: string, result: DeskResponsibleRoleResult, kind: "appoint" | "change" | "remove"): string => {
    if (!result.changed) return t("moderationDesk.responsibles.unchanged", { name })
    if (result.role === "member") return t("moderationDesk.responsibles.removed", { name })
    const role = names.role(result.role)
    return kind === "appoint" ? t("moderationDesk.responsibles.appointed", { name, role }) : t("moderationDesk.responsibles.changed", { name, role })
  }
}

export function NetworkResponsibles(props: { readonly desk: ModerationDeskCapability; readonly personId: string }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const list = props.desk.useResponsibles(props.personId)
  const [pending, setPending] = useState<Pending | null>(null)
  // Le rôle vient d'être perdu (refus d'accès) : le bloc s'efface, le guichet se relit.
  if (list.status === "error" && DESK_ACCESS_ERRORS.has(list.code)) return null
  return (
    <Card className="flex min-w-0 flex-col gap-4 p-4">
      <section aria-labelledby={`${id}-titre`} className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 id={`${id}-titre`} className="flex items-center gap-2 font-semibold">
            <ShieldCheckIcon aria-hidden className="size-4" />
            {t("moderationDesk.responsibles.title")}
          </h3>
          <p className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.responsibles.lead")}</p>
        </div>
        {list.status === "loading" ? (
          <div role="status">
            <span className="sr-only">{t("moderationDesk.loading")}</span>
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : list.status === "error" ? (
          <DeskErrorLine code={list.code} />
        ) : (
          <>
            <ul className="flex min-w-0 flex-col gap-2">
              {list.data.members.map((member) => (
                <ResponsibleLine
                  key={member.personId}
                  member={member}
                  onChange={() => setPending({ kind: "change", member })}
                  onRemove={() => setPending({ kind: "remove", member })}
                />
              ))}
            </ul>
            {list.data.more ? <p className="text-[13px] text-muted-foreground">{t("moderationDesk.responsibles.more")}</p> : null}
          </>
        )}
        <AppointResponsible desk={props.desk} personId={props.personId} />
      </section>
      <ResponsibleSheet desk={props.desk} personId={props.personId} pending={pending} onClose={() => setPending(null)} />
    </Card>
  )
}

function ResponsibleLine(props: { readonly member: DeskResponsibleView; readonly onChange: () => void; readonly onRemove: () => void }) {
  const { t } = useDiasporaleT()
  const names = useNames()
  const nameId = useId()
  const { member } = props
  const name = names.person(member.displayName)
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-border p-3">
      <Avatar id={member.personId} name={name} size="md" />
      <div className="min-w-0 flex-1">
        <p id={nameId} className="flex min-w-0 flex-wrap items-center gap-2 font-medium">
          <span className="min-w-0 break-words">{name}</span>
          {member.isMe ? <span className="text-[13px] font-normal text-muted-foreground">{t("moderationDesk.team.me")}</span> : null}
        </p>
        {member.handle ? <p className="break-words text-sm text-muted-foreground">{`@${member.handle}`}</p> : null}
        <p className="text-[13px] text-muted-foreground">{names.role(member.role)}</p>
        {!member.active ? <p className="text-[13px] text-destructive">{t("moderationDesk.responsibles.inactive")}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {/* Un rôle en sommeil ne se change pas (le moteur refuse de nommer une adhésion qui ne l'exerce pas) ; il se retire toujours. */}
        {member.active ? (
          <Button variant="outline" size="sm" aria-describedby={nameId} aria-haspopup="dialog" onClick={props.onChange}>
            <UserCogIcon aria-hidden />
            {t("moderationDesk.responsibles.change")}
          </Button>
        ) : null}
        <Button variant="outline" size="sm" aria-describedby={nameId} aria-haspopup="dialog" onClick={props.onRemove}>
          <UserMinusIcon aria-hidden />
          {t("moderationDesk.responsibles.remove")}
        </Button>
      </div>
    </li>
  )
}

/** La confirmation d'un changement de rôle ou d'un retrait, motif obligatoire. */
function ResponsibleSheet(props: {
  readonly desk: ModerationDeskCapability
  readonly personId: string
  readonly pending: Pending | null
  readonly onClose: () => void
}) {
  const { t } = useDiasporaleT()
  const names = useNames()
  const success = useSuccessMessage()
  const busy = useRef(false)
  const { pending } = props
  const member = pending?.member ?? null
  const name = member ? names.person(member.displayName) : ""
  const target: DeskRoleChoice | null = pending === null ? null : pending.kind === "remove" ? "member" : otherResponsibleRole(pending.member.role)
  const removing = pending?.kind === "remove"
  return (
    <Sheet open={pending !== null} onOpenChange={(open) => { if (!open && !busy.current) props.onClose() }}>
      {member && target ? (
        <SheetContent
          title={t(removing ? "moderationDesk.responsibles.removeTitle" : "moderationDesk.responsibles.changeTitle", { name })}
          description={removing
            ? t("moderationDesk.responsibles.removeBody", { name, role: names.role(member.role) })
            : t("moderationDesk.responsibles.changeBody", { name, from: names.role(member.role), to: target === "member" ? "" : names.role(target) })}
          closeLabel={t("common.close")}
        >
          <div className="flex min-w-0 flex-col gap-3">
            {member.isMe ? <p className="rounded-xl bg-muted p-3 text-sm">{t("moderationDesk.responsibles.selfWarning")}</p> : null}
            <DeskReasonForm
              key={`${member.personId}-${target}`}
              submitLabel={t(removing ? "moderationDesk.responsibles.removeConfirm" : "moderationDesk.responsibles.changeConfirm")}
              destructive={removing}
              onBusyChange={(value) => { busy.current = value }}
              onSubmit={async (reason) => {
                const result = await props.desk.setResponsibleRole({ personId: props.personId, memberPersonId: member.personId, role: target, reason })
                if (!result.ok) return result.code
                toast.success(success(name, result.value, removing ? "remove" : "change"))
                props.onClose()
                return null
              }}
              onCancel={props.onClose}
            />
          </div>
        </SheetContent>
      ) : null}
    </Sheet>
  )
}

/** Nommer : l'identifiant public d'un membre actif, puis le rôle et le motif. */
function AppointResponsible(props: { readonly desk: ModerationDeskCapability; readonly personId: string }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const mounted = useMounted()
  const [candidate, setCandidate] = useState<DeskCandidateView | null>(null)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const form = useForm<DeskHandleLookupValues>({ resolver: zodResolver(deskHandleLookupSchema), defaultValues: { handle: "" } })
  const busy = form.formState.isSubmitting
  const invalid = form.formState.errors.handle?.message

  const lookup = async (values: DeskHandleLookupValues) => {
    setError(null)
    const result = await props.desk.findMember({ personId: props.personId, handle: normalizeHandle(values.handle) })
    if (!mounted.current) return
    if (!result.ok) {
      setError(result.code)
      return
    }
    if (result.value === null) {
      setError("moderation_desk_member_unknown")
      return
    }
    setCandidate(result.value)
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-col gap-1">
        <h4 className="font-semibold">{t("moderationDesk.responsibles.appointTitle")}</h4>
        <p className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.responsibles.appointLead")}</p>
      </div>
      {candidate === null ? (
        <form noValidate onSubmit={(event) => void form.handleSubmit(lookup)(event)} className="flex min-w-0 flex-col gap-3">
          <Field
            id={`${id}-identifiant`}
            label={t("moderationDesk.responsibles.handle")}
            hint={t("moderationDesk.responsibles.handleHint")}
            error={invalid ? t(`errors.${invalid}`, DESK_ERROR_VALUES) : undefined}
          >
            {(field) => (
              <Input
                id={field.id}
                aria-describedby={field.describedBy}
                aria-invalid={field.invalid || undefined}
                autoComplete="off"
                maxLength={HANDLE_MAX_LENGTH + 1}
                disabled={busy}
                {...form.register("handle")}
              />
            )}
          </Field>
          <DeskErrorLine code={error} />
          <Button type="submit" variant="outline" className="self-start" disabled={busy}>
            {busy ? t("common.pleaseWait") : t("moderationDesk.responsibles.search")}
          </Button>
        </form>
      ) : (
        <AppointForm
          key={candidate.personId}
          desk={props.desk}
          personId={props.personId}
          candidate={candidate}
          onDone={() => {
            if (!mounted.current) return
            setCandidate(null)
            form.reset()
          }}
          onCancel={() => setCandidate(null)}
        />
      )}
    </div>
  )
}

function AppointForm(props: {
  readonly desk: ModerationDeskCapability
  readonly personId: string
  readonly candidate: DeskCandidateView
  readonly onDone: () => void
  readonly onCancel: () => void
}) {
  const { t } = useDiasporaleT()
  const names = useNames()
  const success = useSuccessMessage()
  const id = useId()
  const mounted = useMounted()
  const locked = useRef(false)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const form = useForm<AppointValues>({ resolver: zodResolver(appointSchema), defaultValues: { role: "network_moderator", reason: "" } })
  const busy = form.formState.isSubmitting
  const { candidate } = props

  const appoint = async (values: AppointValues) => {
    if (locked.current) return
    locked.current = true
    setError(null)
    try {
      const result = await props.desk.setResponsibleRole({ personId: props.personId, memberPersonId: candidate.personId, role: values.role, reason: values.reason })
      if (!result.ok) {
        if (mounted.current) setError(result.code)
        return
      }
      toast.success(success(candidate.displayName, result.value, "appoint"))
      props.onDone()
    } catch {
      if (mounted.current) setError("unknown")
    } finally {
      locked.current = false
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-center gap-3 rounded-xl bg-muted p-3">
        <Avatar id={candidate.personId} name={candidate.displayName} size="md" />
        <div className="min-w-0">
          <p className="break-words font-medium">{candidate.displayName}</p>
          <p className="break-words text-sm text-muted-foreground">{`@${candidate.handle}`}</p>
        </div>
      </div>
      <form noValidate onSubmit={(event) => void form.handleSubmit(appoint)(event)} className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={`${id}-role`} className="text-sm font-medium">{t("moderationDesk.responsibles.roleField")}</label>
          <select id={`${id}-role`} className={deskSelectClass} disabled={busy} {...form.register("role")}>
            {DESK_RESPONSIBLE_ROLES.map((role) => <option key={role} value={role}>{names.role(role)}</option>)}
          </select>
        </div>
        <DeskReasonField
          id={`${id}-motif`}
          label={t("moderationDesk.decision.reason")}
          hint={t("moderationDesk.decision.reasonHint", DESK_ERROR_VALUES)}
          error={form.formState.errors.reason?.message}
          disabled={busy}
          registration={form.register("reason")}
        />
        <DeskErrorLine code={error} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>{busy ? t("common.pleaseWait") : t("moderationDesk.responsibles.appointConfirm")}</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={props.onCancel}>{t("common.cancel")}</Button>
        </div>
      </form>
    </div>
  )
}
