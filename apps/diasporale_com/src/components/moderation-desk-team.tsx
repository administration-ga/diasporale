"use client"

/**
 * L'onglet « Équipe » du guichet de modération (PD6 · G9).
 *
 *  · chacun voit ses équipes (nom, nature de contenu traitée). Le moteur ne
 *    rattache pas encore une équipe à un pays : le nom peut le dire, il ne
 *    délimite rien, et l'écran l'annonce ;
 *  · l'administration du réseau compose les équipes : responsables identifiés
 *    par leur profil PUBLIÉ, ajout par identifiant public, retrait motivé et
 *    confirmé, création motivée. Chaque geste passe par les mutations du moteur
 *    (`cases.createTeam`, `cases.setTeamMember`), qui le journalisent ;
 *  · pour tout autre rôle, la composition reste en lecture seule : aucun
 *    coéquipier n'est révélé.
 * PROPRIÉTAIRE : chantier « modération par pays ».
 */
import { Avatar, Button, Card, Field, Input, Sheet, SheetContent, Skeleton, HANDLE_MAX_LENGTH, handleRefusal, normalizeHandle } from "@diasporale/features"
import {
  DESK_SURFACES,
  DESK_TEAM_NAME_MAX,
  type ActionErrorCode,
  type DeskCandidateView,
  type DeskTeamMemberView,
  type DeskTeamView,
  type ModerationDeskCapability,
  type ModerationDeskView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { UserMinusIcon, UserPlusIcon, UsersIcon } from "lucide-react"
import { useId, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { DESK_ERROR_VALUES, DeskErrorLine, DeskReasonField, deskSelectClass, useDeskLabels, useMounted } from "./moderation-desk-parts"

const reasonSchema = z.string().trim().min(DESK_ERROR_VALUES.min, "moderation_desk_reason_length").max(DESK_ERROR_VALUES.max, "moderation_desk_reason_length")

const lookupSchema = z.object({
  handle: z.string().superRefine((raw, context) => {
    const handle = normalizeHandle(raw)
    const refusal = handle.length === 0 ? "moderation_desk_handle_required" : handleRefusal(handle)
    if (refusal) context.addIssue({ code: z.ZodIssueCode.custom, message: refusal })
  }),
})
type LookupValues = z.infer<typeof lookupSchema>

const reasonOnlySchema = z.object({ reason: reasonSchema })
type ReasonValues = z.infer<typeof reasonOnlySchema>

const createSchema = z.object({
  name: z.string().trim().min(DESK_ERROR_VALUES.nameMin, "moderation_desk_team_name_length").max(DESK_ERROR_VALUES.nameMax, "moderation_desk_team_name_length"),
  scope: z.string(),
  reason: reasonSchema,
})
type CreateValues = z.infer<typeof createSchema>

export function ModerationDeskTeam(props: { readonly desk: ModerationDeskCapability; readonly view: ModerationDeskView; readonly personId: string }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const { view } = props
  const mine = view.teams.filter((team) => team.isMember)
  const [selected, setSelected] = useState<string | null>(null)
  const managed = view.teams.find((team) => team.teamId === selected) ?? view.teams[0] ?? null
  return (
    <section aria-labelledby={`${id}-titre`} className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-titre`} className="font-display text-xl font-bold">{t("moderationDesk.team.title")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("moderationDesk.team.lead")}</p>
        <p className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.team.countryNote")}</p>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <h3 className="font-semibold">{t("moderationDesk.team.mine")}</h3>
        {mine.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t(view.networkWide ? "moderationDesk.team.noTeamNetworkWide" : "moderationDesk.team.noTeam")}</p>
        ) : (
          <ul className="flex min-w-0 flex-col gap-2">
            {mine.map((team) => <TeamLine key={team.teamId} team={team} />)}
          </ul>
        )}
      </div>

      {!view.canManageTeams ? (
        <p className="text-sm text-muted-foreground">{t("moderationDesk.team.readOnly")}</p>
      ) : (
        <>
          {managed !== null ? (
            <Card className="flex min-w-0 flex-col gap-4 p-4">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor={`${id}-equipe`} className="text-sm font-medium">{t("moderationDesk.team.picker")}</label>
                <select id={`${id}-equipe`} className={deskSelectClass} value={managed.teamId} onChange={(event) => setSelected(event.target.value)}>
                  {view.teams.map((team) => <option key={team.teamId} value={team.teamId}>{team.name}</option>)}
                </select>
              </div>
              <TeamRoster key={managed.teamId} desk={props.desk} personId={props.personId} team={managed} />
              <AddMember key={`ajout-${managed.teamId}`} desk={props.desk} personId={props.personId} team={managed} />
            </Card>
          ) : (
            <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("moderationDesk.team.noneYet")}</p>
          )}
          <CreateTeam desk={props.desk} personId={props.personId} onCreated={setSelected} />
        </>
      )}
    </section>
  )
}

function TeamLine(props: { readonly team: DeskTeamView }) {
  const { t } = useDiasporaleT()
  const labels = useDeskLabels()
  const { team } = props
  return (
    <li className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-border p-3">
      <p className="break-words font-medium">{team.name}</p>
      <p className="break-words text-[13px] text-muted-foreground">
        {team.scope === null ? t("moderationDesk.team.scopeAll") : t("moderationDesk.team.scopeOne", { surface: labels.surface(team.scope) })}
      </p>
    </li>
  )
}

function TeamRoster(props: { readonly desk: ModerationDeskCapability; readonly personId: string; readonly team: DeskTeamView }) {
  const { t } = useDiasporaleT()
  const roster = props.desk.useRoster({ personId: props.personId, teamId: props.team.teamId })
  const [removing, setRemoving] = useState<DeskTeamMemberView | null>(null)
  if (roster.status === "loading") {
    return (
      <div role="status">
        <span className="sr-only">{t("moderationDesk.loading")}</span>
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    )
  }
  if (roster.status === "error") return <DeskErrorLine code={roster.code} />
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="font-semibold">{t("moderationDesk.team.roster", { name: props.team.name })}</h3>
      {roster.data.members.length === 0 ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("moderationDesk.team.rosterEmpty")}</p>
      ) : (
        <ul className="flex min-w-0 flex-col gap-2">
          {roster.data.members.map((member) => <MemberLine key={member.personId} member={member} onRemove={() => setRemoving(member)} />)}
        </ul>
      )}
      {roster.data.more ? <p className="text-[13px] text-muted-foreground">{t("moderationDesk.team.rosterMore")}</p> : null}
      <RemoveMemberSheet desk={props.desk} personId={props.personId} team={props.team} member={removing} onClose={() => setRemoving(null)} />
    </div>
  )
}

function MemberLine(props: { readonly member: DeskTeamMemberView; readonly onRemove: () => void }) {
  const { t } = useDiasporaleT()
  const nameId = useId()
  const { member } = props
  const name = member.displayName ?? t("moderationDesk.team.neutralName")
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-border p-3">
      <Avatar id={member.personId} name={name} size="md" />
      <div className="min-w-0 flex-1">
        <p id={nameId} className="flex min-w-0 flex-wrap items-center gap-2 font-medium">
          <span className="min-w-0 break-words">{name}</span>
          {member.isMe ? <span className="text-[13px] font-normal text-muted-foreground">{t("moderationDesk.team.me")}</span> : null}
        </p>
        {member.handle ? <p className="break-words text-sm text-muted-foreground">{`@${member.handle}`}</p> : null}
        {!member.inNetwork ? <p className="text-[13px] text-destructive">{t("moderationDesk.team.outsideNetwork")}</p> : null}
      </div>
      <Button variant="outline" size="sm" aria-describedby={nameId} aria-haspopup="dialog" onClick={props.onRemove}>
        <UserMinusIcon aria-hidden />
        {t("moderationDesk.team.remove")}
      </Button>
    </li>
  )
}

function RemoveMemberSheet(props: {
  readonly desk: ModerationDeskCapability
  readonly personId: string
  readonly team: DeskTeamView
  readonly member: DeskTeamMemberView | null
  readonly onClose: () => void
}) {
  const { t } = useDiasporaleT()
  const busy = useRef(false)
  const { member } = props
  const name = member ? (member.displayName ?? t("moderationDesk.team.neutralName")) : ""
  return (
    <Sheet open={member !== null} onOpenChange={(open) => { if (!open && !busy.current) props.onClose() }}>
      {member ? (
        <SheetContent
          title={t("moderationDesk.team.removeTitle", { name })}
          description={t("moderationDesk.team.removeBody", { team: props.team.name })}
          closeLabel={t("common.close")}
        >
          <ReasonForm
            key={member.personId}
            submitLabel={t("moderationDesk.team.removeConfirm")}
            destructive
            onBusyChange={(value) => { busy.current = value }}
            onSubmit={async (reason) => {
              const result = await props.desk.setTeamMember({ personId: props.personId, teamId: props.team.teamId, memberPersonId: member.personId, active: false, reason })
              if (result.ok) {
                toast.success(t("moderationDesk.team.removed", { name }))
                props.onClose()
                return null
              }
              return result.code
            }}
            onCancel={props.onClose}
          />
        </SheetContent>
      ) : null}
    </Sheet>
  )
}

/** Un motif seul, puis le geste : la confirmation d'un retrait ou d'un ajout. */
function ReasonForm(props: {
  readonly submitLabel: string
  readonly destructive?: boolean
  readonly onBusyChange?: (busy: boolean) => void
  readonly onSubmit: (reason: string) => Promise<ActionErrorCode | null>
  readonly onCancel: () => void
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const mounted = useMounted()
  const locked = useRef(false)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const form = useForm<ReasonValues>({ resolver: zodResolver(reasonOnlySchema), defaultValues: { reason: "" } })
  const busy = form.formState.isSubmitting

  const send = async (values: ReasonValues) => {
    if (locked.current) return
    locked.current = true
    props.onBusyChange?.(true)
    setError(null)
    try {
      const code = await props.onSubmit(values.reason)
      if (mounted.current && code !== null) setError(code)
    } catch {
      if (mounted.current) setError("unknown")
    } finally {
      locked.current = false
      props.onBusyChange?.(false)
    }
  }

  return (
    <form noValidate onSubmit={(event) => void form.handleSubmit(send)(event)} className="flex min-w-0 flex-col gap-3">
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
        <Button type="submit" variant={props.destructive ? "destructive" : "primary"} disabled={busy}>
          {busy ? t("common.pleaseWait") : props.submitLabel}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={props.onCancel}>{t("common.cancel")}</Button>
      </div>
    </form>
  )
}

function AddMember(props: { readonly desk: ModerationDeskCapability; readonly personId: string; readonly team: DeskTeamView }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const mounted = useMounted()
  const [candidate, setCandidate] = useState<DeskCandidateView | null>(null)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const form = useForm<LookupValues>({ resolver: zodResolver(lookupSchema), defaultValues: { handle: "" } })
  const busy = form.formState.isSubmitting
  const invalid = form.formState.errors.handle?.message

  const lookup = async (values: LookupValues) => {
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
      <h3 className="flex items-center gap-2 font-semibold">
        <UserPlusIcon aria-hidden className="size-4" />
        {t("moderationDesk.team.addTitle", { name: props.team.name })}
      </h3>
      {candidate === null ? (
        <form noValidate onSubmit={(event) => void form.handleSubmit(lookup)(event)} className="flex min-w-0 flex-col gap-3">
          <Field
            id={`${id}-identifiant`}
            label={t("moderationDesk.team.handle")}
            hint={t("moderationDesk.team.handleHint")}
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
            {busy ? t("common.pleaseWait") : t("moderationDesk.team.search")}
          </Button>
        </form>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-center gap-3 rounded-xl bg-muted p-3">
            <Avatar id={candidate.personId} name={candidate.displayName} size="md" />
            <div className="min-w-0">
              <p className="break-words font-medium">{candidate.displayName}</p>
              <p className="break-words text-sm text-muted-foreground">{`@${candidate.handle}`}</p>
            </div>
          </div>
          <ReasonForm
            key={candidate.personId}
            submitLabel={t("moderationDesk.team.addConfirm")}
            onSubmit={async (reason) => {
              const result = await props.desk.setTeamMember({ personId: props.personId, teamId: props.team.teamId, memberPersonId: candidate.personId, active: true, reason })
              if (!result.ok) return result.code
              toast.success(t("moderationDesk.team.added", { name: candidate.displayName }))
              if (mounted.current) {
                setCandidate(null)
                form.reset()
              }
              return null
            }}
            onCancel={() => setCandidate(null)}
          />
        </div>
      )}
    </div>
  )
}

function CreateTeam(props: { readonly desk: ModerationDeskCapability; readonly personId: string; readonly onCreated: (teamId: string) => void }) {
  const { t } = useDiasporaleT()
  const labels = useDeskLabels()
  const id = useId()
  const mounted = useMounted()
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const form = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: { name: "", scope: "", reason: "" } })
  const busy = form.formState.isSubmitting
  const errors = form.formState.errors

  const create = async (values: CreateValues) => {
    setError(null)
    const scope = DESK_SURFACES.find((surface) => surface === values.scope) ?? null
    const result = await props.desk.createTeam({ personId: props.personId, name: values.name, scope, reason: values.reason })
    if (!mounted.current) return
    if (!result.ok) {
      setError(result.code)
      return
    }
    toast.success(t("moderationDesk.team.created", { name: values.name.trim() }))
    form.reset()
    props.onCreated(result.value.teamId)
  }

  return (
    <Card className="flex min-w-0 flex-col gap-3 p-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <UsersIcon aria-hidden className="size-4" />
        {t("moderationDesk.team.createTitle")}
      </h3>
      <p className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.team.createLead")}</p>
      <form noValidate onSubmit={(event) => void form.handleSubmit(create)(event)} className="flex min-w-0 flex-col gap-3">
        <Field
          id={`${id}-nom`}
          label={t("moderationDesk.team.name")}
          hint={t("moderationDesk.team.nameHint", DESK_ERROR_VALUES)}
          error={errors.name?.message ? t(`errors.${errors.name.message}`, DESK_ERROR_VALUES) : undefined}
        >
          {(field) => (
            <Input
              id={field.id}
              aria-describedby={field.describedBy}
              aria-invalid={field.invalid || undefined}
              maxLength={DESK_TEAM_NAME_MAX}
              disabled={busy}
              {...form.register("name")}
            />
          )}
        </Field>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={`${id}-nature`} className="text-sm font-medium">{t("moderationDesk.team.scope")}</label>
          <select id={`${id}-nature`} className={deskSelectClass} disabled={busy} {...form.register("scope")}>
            <option value="">{t("moderationDesk.team.scopeAll")}</option>
            {DESK_SURFACES.map((surface) => <option key={surface} value={surface}>{labels.surface(surface)}</option>)}
          </select>
        </div>
        <DeskReasonField
          id={`${id}-motif`}
          label={t("moderationDesk.decision.reason")}
          hint={t("moderationDesk.decision.reasonHint", DESK_ERROR_VALUES)}
          error={errors.reason?.message}
          disabled={busy}
          registration={form.register("reason")}
        />
        <DeskErrorLine code={error} />
        <Button type="submit" className="self-start" disabled={busy}>{busy ? t("common.pleaseWait") : t("moderationDesk.team.create")}</Button>
      </form>
    </Card>
  )
}
