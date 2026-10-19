"use client"

/** Gestion des offres d'une page, commune à Mon activité et à la gestion de la page. */
import { SERVICE_OFFER_STATUSES, type ServiceOfferStatus, type ServiceOfferStatusTarget } from "@diasporale/domain"
import { Button, Card, EmptyState, Field, Skeleton, formatDate } from "@diasporale/features"
import { useDataSource, useSession, type ManagedPageView, type MembershipView, type ServiceOfferDetailView, type ServicesCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { StoreIcon } from "lucide-react"
import NextLink from "next/link"
import { useId, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { formatServicePrice } from "@/components/service-format"
import { ServiceOfferForm } from "@/components/service-offer-form"
import { ServicePager } from "@/components/service-pager"
import { routes } from "@/lib/routes"

type Editor = { readonly mode: "create" } | { readonly mode: "edit"; readonly offerId: string; readonly generation: number } | null

interface PageServicesManagerProps {
  readonly services: ServicesCapability
  readonly page: ManagedPageView
  readonly membership: MembershipView
}

export function PageServicesManager(props: PageServicesManagerProps) {
  const { t } = useDiasporaleT()
  const source = useDataSource()
  const session = useSession()
  if (session.status === "loading") return <Skeleton className="h-32 w-full rounded-xl" />
  if (session.status === "error") return <Card role="alert" className="p-4">{t(`errors.${session.code}`)}</Card>
  if (session.data.status !== "signed_in") return <Card role="alert" className="p-4">{t("errors.not_signed_in")}</Card>
  if (session.data.membership?.personId !== props.membership.personId) return <Card role="alert" className="p-4">{t("errors.not_member")}</Card>
  const key = JSON.stringify([source.kind, props.membership.personId, props.page.id, props.services.supportsManagedOfferStatusFilter === true])
  return <PageServicesEditor key={key} {...props} />
}

function PageServicesEditor(props: PageServicesManagerProps) {
  const { t } = useDiasporaleT()
  const id = useId()
  const { services, page, membership } = props
  const [editor, setEditor] = useState<Editor>(null)
  const [status, setStatus] = useState<ServiceOfferStatus | null>(null)
  const supportsFilter = services.supportsManagedOfferStatusFilter === true
  const filtered = supportsFilter && status !== null
  const reset = () => setStatus(null)
  const heading = useRef<HTMLHeadingElement | null>(null)
  const wasEditing = useRef(false)
  // Le formulaire fermé (enregistré ou annulé), le focus revient au titre de la section, jamais au vide.
  useLayoutEffect(() => {
    if (editor === null && wasEditing.current) heading.current?.focus()
    wasEditing.current = editor !== null
  }, [editor])
  const canManage = membership.canPublish
  const fallbackCountry = page.country ?? membership.facet.countryOfResidence
  const fallbackZone = {
    country: fallbackCountry,
    city: fallbackCountry === membership.facet.countryOfResidence ? membership.facet.city ?? "" : "",
  }
  return (
    <section aria-labelledby={`${id}-title`} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 ref={heading} id={`${id}-title`} tabIndex={-1} className="min-w-0 break-words rounded-sm text-lg font-semibold focus-visible:shadow-focus">{t("services.manage.title", { page: page.name })}</h2>
        <div className="flex flex-wrap gap-2">
          {editor?.mode === "edit" ? <Button variant="ghost" className="h-auto min-h-11 whitespace-normal" onClick={() => setEditor(null)}>{t("pageManagedServices.closeEditor")}</Button> : null}
          <Button className="h-auto min-h-11 whitespace-normal" disabled={!canManage || editor?.mode === "create"} onClick={() => setEditor({ mode: "create" })}>{t("services.manage.newOffer")}</Button>
        </div>
      </div>
      {!canManage ? <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("services.manage.cannotPublish")}</p> : null}
      {supportsFilter ? (
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t("pageManagedServices.lead")}</p>
          <div className="flex min-w-0 flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 sm:max-w-xs">
              <Field id={`${id}-status`} label={t("pageManagedServices.filterLabel")}>
                {(field) => <select
                  id={field.id}
                  aria-describedby={field.describedBy}
                  disabled={editor !== null}
                  value={status ?? ""}
                  onChange={(event) => setStatus(SERVICE_OFFER_STATUSES.find((value) => value === event.target.value) ?? null)}
                  className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus disabled:opacity-50"
                >
                  <option value="">{t("pageManagedServices.all")}</option>
                  {SERVICE_OFFER_STATUSES.map((value) => <option key={value} value={value}>{t(`services.status.${value}`)}</option>)}
                </select>}
              </Field>
            </div>
            <Button variant="ghost" className="h-auto min-h-11 whitespace-normal" disabled={!filtered || editor !== null} onClick={reset}>{t("pageManagedServices.reset")}</Button>
          </div>
          {editor !== null ? <p className="text-sm text-muted-foreground">{t("pageManagedServices.finishEditing")}</p> : null}
        </div>
      ) : null}
      {editor?.mode === "create" ? (
        <ServiceOfferForm services={services} pageId={page.id} fallbackZone={fallbackZone} onClose={() => setEditor(null)} />
      ) : null}
      <ServicePager
        key={supportsFilter ? status ?? "all" : "all"}
        read={(cursor) => services.useMyPageOffers(supportsFilter ? {
          pageId: page.id,
          personId: membership.personId,
          cursor,
          ...(status !== null ? { status } : {}),
        } : { pageId: page.id, cursor })}
        keyOf={(offer) => offer.id}
        empty={filtered ? <EmptyState icon={<StoreIcon />} title={t("pageManagedServices.emptyTitle")} description={t("pageManagedServices.emptyBody")}
          action={<Button variant="outline" className="h-auto min-h-11 whitespace-normal" disabled={editor !== null} onClick={reset}>{t("pageManagedServices.reset")}</Button>} />
          : <EmptyState icon={<StoreIcon />} title={t("services.manage.emptyTitle")} description={t("services.manage.emptyBody")} />}
      >
        {(offers) => (
          <>
            {editor?.mode === "edit"
              ? (() => {
                  const latest = offers.find((offer) => offer.id === editor.offerId)
                  return latest ? (
                    <ServiceOfferForm
                      key={`${latest.id}:${editor.generation}`}
                      services={services}
                      pageId={page.id}
                      offer={latest}
                      fallbackZone={fallbackZone}
                      onClose={() => setEditor(null)}
                      onReload={() => setEditor({ ...editor, generation: editor.generation + 1 })}
                    />
                  ) : null
                })()
              : null}
            <ul className="flex flex-col gap-2" aria-label={t("services.manage.listLabel")}>
              {offers.map((offer) => (
                <ManagedOfferRow key={offer.id} offer={offer} services={services} canManage={canManage} onEdit={() => setEditor({ mode: "edit", offerId: offer.id, generation: 0 })} />
              ))}
            </ul>
          </>
        )}
      </ServicePager>
    </section>
  )
}

type StatusAction = "publish" | "pause" | "resume" | "withdraw"

const ACTION_TARGET: Readonly<Record<StatusAction, ServiceOfferStatusTarget>> = { publish: "active", pause: "paused", resume: "active", withdraw: "withdrawn" }

const ACTIONS_BY_STATUS: Readonly<Record<ServiceOfferDetailView["status"], readonly StatusAction[]>> = {
  draft: ["publish"],
  active: ["pause"],
  paused: ["resume"],
  withdrawn: [],
}

function ManagedOfferRow(props: { readonly offer: ServiceOfferDetailView; readonly services: ServicesCapability; readonly canManage: boolean; readonly onEdit: () => void }) {
  const { t, locale } = useDiasporaleT()
  const { offer } = props
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const locked = useRef(false)
  const active = useRef(false)
  const confirmButton = useRef<HTMLButtonElement | null>(null)
  useLayoutEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  useLayoutEffect(() => {
    if (confirming) confirmButton.current?.focus()
  }, [confirming])

  const run = async (action: StatusAction) => {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    try {
      const result = await props.services.setOfferStatus({ offerId: offer.id, expectedVersion: offer.version, status: ACTION_TARGET[action] })
      if (!active.current) return
      if (result.ok) toast.success(t(`services.manage.done.${action}`))
      else toast.error(t(`errors.${result.code}`))
    } catch {
      if (active.current) toast.error(t("errors.unknown"))
    } finally {
      locked.current = false
      if (active.current) {
        setBusy(false)
        setConfirming(false)
      }
    }
  }

  const disabled = busy || !props.canManage
  return (
    <li>
      <Card className="flex min-w-0 flex-col gap-2 p-4">
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          <span className="rounded-[var(--radius-xs)] bg-[var(--esp-neutral-chip)] px-2 py-0.5 font-medium text-foreground">{t(`services.status.${offer.status}`)}</span>
          <span>{t(`services.category.${offer.category}`)}</span>
          <span>{t("services.manage.updated", { date: formatDate(offer.updatedAt, locale) })}</span>
        </p>
        <p className="break-words font-semibold">
          <NextLink href={routes.serviceOffer(offer.id)} className="hover:underline">{offer.title}</NextLink>
        </p>
        <p className="text-sm">{formatServicePrice(offer.pricing, locale, t)}</p>
        {offer.status !== "withdrawn" ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={disabled} onClick={props.onEdit}>{t("services.manage.edit")}</Button>
            {ACTIONS_BY_STATUS[offer.status].map((action) => (
              <Button key={action} variant="outline" size="sm" disabled={disabled} aria-busy={busy} onClick={() => void run(action)}>{t(`services.manage.action.${action}`)}</Button>
            ))}
            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setConfirming(true)}>{t("services.manage.action.withdraw")}</Button>
          </div>
        ) : null}
        {confirming ? (
          <div role="group" aria-labelledby={`retrait-${offer.id}`} className="flex flex-col items-start gap-2 rounded-lg border border-destructive px-3 py-2">
            <p id={`retrait-${offer.id}`} className="font-semibold">{t("services.manage.confirmWithdrawTitle", { title: offer.title })}</p>
            <p className="text-sm">{t("services.manage.confirmWithdrawBody")}</p>
            <div className="flex flex-wrap gap-2">
              <Button ref={confirmButton} variant="destructive" size="sm" disabled={busy} onClick={() => void run("withdraw")}>{t("services.manage.confirmWithdraw")}</Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}>{t("common.cancel")}</Button>
            </div>
          </div>
        ) : null}
      </Card>
    </li>
  )
}
