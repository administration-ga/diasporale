"use client"

/**
 * L'équipe d'une page (DG-008) : ses signataires, invitations comprises.
 * PROPRIÉTAIRE : chantier « gestion des pages ».
 *
 *  · une habilitation est une INVITATION : elle ne vaut qu'acceptée ;
 *  · un administrateur invite, change un rôle, retire ; chacun peut se retirer ;
 *  · la page garde toujours au moins un administrateur vivant — l'écran le dit
 *    et le serveur le refuse (`page_last_admin`) ;
 *  · la liste est une lecture RÉACTIVE : un rôle retiré ferme l'accès aussitôt.
 */
import { Avatar, Button, Card, Field, Input, Skeleton, formatDate, handleRefusal, normalizeHandle } from "@diasporale/features"
import {
  MANAGED_PAGE_ROLES,
  type ActionErrorCode,
  type ManagedPageDetailView,
  type ManagedPageRole,
  type PageManagement,
  type PageSignatoryView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { LogOutIcon, UserMinusIcon, UserPlusIcon } from "lucide-react"
import { useId, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { ConfirmSheet, ErrorNotice, RoleChip, usePersonLabel } from "./page-admin-parts"

const inviteSchema = z.object({
  handle: z.string().superRefine((raw, context) => {
    const handle = normalizeHandle(raw)
    const refusal = handle.length === 0 ? "page_member_handle_required" : handleRefusal(handle)
    if (refusal) context.addIssue({ code: z.ZodIssueCode.custom, message: refusal })
  }),
  role: z.enum(["admin", "signatory"]),
})

type InviteValues = z.infer<typeof inviteSchema>

const selectClass = "h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus"

export function PageTeamPanel(props: { readonly management: PageManagement; readonly page: ManagedPageDetailView }) {
  const { t } = useDiasporaleT()
  const team = props.management.useSignatories(props.page.id)
  const isAdmin = props.page.myRole === "admin"
  if (team.status === "loading") {
    return (
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">{t("common.pleaseWait")}</span>
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    )
  }
  if (team.status === "error") return <ErrorNotice code={team.code} />
  const acceptedAdmins = team.data.filter((row) => row.role === "admin" && row.accepted).length
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl font-bold">{t("pageAdmin.team.title")}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("pageAdmin.team.lead")}</p>
      </div>
      {team.data.length === 0 ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("pageAdmin.team.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {team.data.map((row) => (
            <SignatoryRow
              key={row.personId}
              management={props.management}
              pageId={props.page.id}
              row={row}
              canManage={isAdmin}
              lastAdmin={row.role === "admin" && row.accepted && acceptedAdmins <= 1}
            />
          ))}
        </ul>
      )}
      {isAdmin ? <InviteForm management={props.management} pageId={props.page.id} /> : <p className="text-sm text-muted-foreground">{t("pageAdmin.team.readOnly")}</p>}
    </div>
  )
}

function SignatoryRow(props: {
  readonly management: PageManagement
  readonly pageId: string
  readonly row: PageSignatoryView
  readonly canManage: boolean
  readonly lastAdmin: boolean
}) {
  const { t, locale } = useDiasporaleT()
  const label = usePersonLabel()
  const { row } = props
  const name = label(row)
  const id = useId()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<ActionErrorCode | null>(null)
  const running = useRef(false)

  const changeRole = async (role: ManagedPageRole) => {
    if (running.current || role === row.role || row.handle === null) return
    running.current = true
    setBusy(true)
    setRefusal(null)
    try {
      const result = await props.management.grantRole(props.pageId, row.handle, role)
      if (result.ok) toast.success(t("pageAdmin.team.roleChanged"))
      else setRefusal(result.code)
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  const revoke = async () => {
    setRefusal(null)
    const result = await props.management.revokeRole(props.pageId, row.personId)
    if (!result.ok) {
      setRefusal(result.code)
      return true
    }
    if (result.value.revoked) toast.success(t(row.isMe ? "pageAdmin.team.left" : "pageAdmin.team.removed"))
    return true
  }

  return (
    <li>
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <Avatar id={row.personId} name={name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              <span className="min-w-0 break-words">{name}</span>
              {row.isMe ? <span className="text-[13px] font-normal text-muted-foreground">{t("pageAdmin.team.me")}</span> : null}
            </p>
            {row.handle ? <p className="text-sm text-muted-foreground">{`@${row.handle}`}</p> : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <RoleChip role={row.role} />
              <span>{row.accepted ? t("pageAdmin.team.since", { date: formatDate(row.since, locale) }) : t("pageAdmin.team.invited", { date: formatDate(row.since, locale) })}</span>
            </div>
          </div>
        </div>
        {props.canManage && !row.isMe ? (
          <div className="flex flex-wrap items-end gap-2">
            {row.handle !== null ? (
              <div className="flex min-w-48 flex-col gap-1.5">
                <label htmlFor={`${id}-role`} className="text-sm font-medium">
                  {t("pageAdmin.team.changeRole", { name })}
                </label>
                <select id={`${id}-role`} className={selectClass} value={row.role} disabled={busy} onChange={(event) => void changeRole(event.target.value as ManagedPageRole)}>
                  {MANAGED_PAGE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {t(`pageAdmin.role.${role}`)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <Button variant="outline" disabled={busy} onClick={() => setConfirming(true)} aria-label={t("pageAdmin.team.removeLabel", { name })}>
              <UserMinusIcon aria-hidden />
              {t("pageAdmin.team.remove")}
            </Button>
          </div>
        ) : null}
        {row.isMe ? (
          <div className="flex flex-col items-start gap-2">
            <Button variant="outline" disabled={busy || props.lastAdmin} onClick={() => setConfirming(true)} aria-describedby={props.lastAdmin ? `${id}-dernier` : undefined}>
              <LogOutIcon aria-hidden />
              {t("pageAdmin.team.leave")}
            </Button>
            {props.lastAdmin ? <p id={`${id}-dernier`} className="text-[13px] text-muted-foreground">{t("pageAdmin.team.lastAdmin")}</p> : null}
          </div>
        ) : null}
        {refusal ? <ErrorNotice code={refusal} /> : null}
      </Card>
      <ConfirmSheet
        open={confirming}
        onOpenChange={setConfirming}
        title={row.isMe ? t("pageAdmin.team.leaveConfirmTitle") : t("pageAdmin.team.removeConfirmTitle", { name })}
        body={row.isMe ? t("pageAdmin.team.leaveConfirmBody") : t("pageAdmin.team.removeConfirmBody")}
        confirm={row.isMe ? t("pageAdmin.team.leave") : t("pageAdmin.team.remove")}
        onConfirm={revoke}
      />
    </li>
  )
}

function InviteForm(props: { readonly management: PageManagement; readonly pageId: string }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const [refusal, setRefusal] = useState<ActionErrorCode | null>(null)
  const running = useRef(false)
  const form = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { handle: "", role: "signatory" } })
  const errors = form.formState.errors
  const busy = form.formState.isSubmitting

  // La soumission se valide au geste, jamais pendant le rendu.
  const onValid = async (values: InviteValues) => {
    if (running.current) return
    running.current = true
    setRefusal(null)
    try {
      const result = await props.management.grantRole(props.pageId, normalizeHandle(values.handle), values.role)
      if (!result.ok) {
        setRefusal(result.code)
        return
      }
      toast.success(t(result.value.invited ? "pageAdmin.team.invitedToast" : "pageAdmin.team.roleChanged"))
      form.reset({ handle: "", role: values.role })
    } catch {
      setRefusal("unknown")
    } finally {
      running.current = false
    }
  }

  return (
    <Card className="p-5">
      <h3 className="font-display text-lg font-bold">{t("pageAdmin.team.inviteTitle")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t("pageAdmin.team.inviteLead")}</p>
      <form noValidate onSubmit={(event) => void form.handleSubmit(onValid)(event)} className="mt-4 flex flex-col gap-4" aria-busy={busy}>
        <Field id={`${id}-identifiant`} label={t("pageAdmin.team.handle")} hint={t("pageAdmin.team.handleHint")} error={errors.handle?.message ? t(`errors.${errors.handle.message}`) : undefined}>
          {(control) => (
            <Input
              id={control.id}
              aria-describedby={control.describedBy}
              aria-invalid={control.invalid || undefined}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={busy}
              {...form.register("handle")}
            />
          )}
        </Field>
        <Field id={`${id}-role`} label={t("pageAdmin.team.role")}>
          {(control) => (
            <select id={control.id} aria-describedby={control.describedBy} className={selectClass} disabled={busy} {...form.register("role")}>
              {MANAGED_PAGE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`pageAdmin.role.${role}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        {refusal ? <ErrorNotice code={refusal} /> : null}
        <Button type="submit" className="self-start" disabled={busy}>
          <UserPlusIcon aria-hidden />
          {busy ? t("common.pleaseWait") : t("pageAdmin.team.invite")}
        </Button>
      </form>
    </Card>
  )
}
