"use client"

/**
 * Mon profil de mentor (DG-024, troisième tranche) : devenir mentor par un
 * opt-in explicite, puis lire son plafond (mentorés actifs sur le plafond
 * choisi), ses demandes en attente, modifier son profil, le mettre en pause, le
 * reprendre ou le retirer (révocation de l'opt-in : les demandes en attente sont
 * déclinées, les mentorats en cours clos). Son état de modération (G9 : en
 * relecture, retiré par la modération) n'est montré qu'ici, au mentor seul.
 * PROPRIÉTAIRE : chantier « mentorat ».
 */
import { Button, Card, Sheet, SheetContent, Skeleton, countryName } from "@diasporale/features"
import type { MembershipView, MentoringCapability, MyMentorProfileView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { HandHeartIcon } from "lucide-react"
import NextLink from "next/link"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import { MentorProfileForm } from "@/components/mentoring-profile-form"
import { MentoringConfirmSheet } from "@/components/mentoring-sheets"
import { MentoringModerationNotice } from "@/components/mentoring-ui"
import { languageList } from "@/components/service-format"
import { routes } from "@/lib/routes"

function canPublishOf(membership: MembershipView): boolean {
  return membership.status !== "partie" && membership.canPublish
}

/** « Devenir mentor » depuis la recherche : la feuille du formulaire ; rien si mon profil est déjà vivant (actif ou en pause). */
export function BecomeMentorEntry(props: { readonly capability: MentoringCapability; readonly membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const query = props.capability.useMyProfile()
  const [open, setOpen] = useState(false)
  // Une ouverture, un formulaire neuf.
  const [sheetKey, setSheetKey] = useState(0)
  if (query.status !== "ready") return null
  const profile = query.data
  if (profile && profile.state !== "retired") return null
  const canPublish = canPublishOf(props.membership)
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
          <HandHeartIcon aria-hidden />
          {t("mentoring.become.cta")}
        </Button>
        {open ? (
          <SheetContent title={t("mentoring.become.title")} description={t("mentoring.become.description")} closeLabel={t("mentoring.sheet.close")}>
            <MentorProfileForm
              key={sheetKey}
              capability={props.capability}
              mode="create"
              current={profile}
              defaultCountry={props.membership.facet.countryOfResidence}
              onDone={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          </SheetContent>
        ) : null}
      </Sheet>
      {!canPublish ? <p className="text-sm text-muted-foreground">{t("mentoring.become.statusInsufficient")}</p> : null}
    </div>
  )
}

/** L'onglet « Mon profil de mentor » : devenir mentor, ou gérer son profil. */
export function MentorProfilePanel(props: { readonly capability: MentoringCapability; readonly membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const query = props.capability.useMyProfile()
  if (query.status === "loading") return <Skeleton className="h-48 w-full rounded-xl" />
  if (query.status === "error") {
    return (
      <Card role="alert" className="p-4">
        <p>{t(`errors.${query.code}`)}</p>
      </Card>
    )
  }
  const profile = query.data
  if (!profile || profile.state === "retired") return <BecomeMentorPanel capability={props.capability} membership={props.membership} previous={profile} />
  // Une version nouvelle remonte le résumé : l'édition se referme sur les valeurs enregistrées.
  return <MentorProfileSummary key={profile.version} capability={props.capability} membership={props.membership} profile={profile} />
}

function BecomeMentorPanel(props: { readonly capability: MentoringCapability; readonly membership: MembershipView; readonly previous: MyMentorProfileView | null }) {
  const { t } = useDiasporaleT()
  const canPublish = canPublishOf(props.membership)
  return (
    <section aria-labelledby="devenir-mentor" className="flex min-w-0 flex-col gap-3">
      <h2 id="devenir-mentor" className="text-lg font-semibold">{t("mentoring.become.title")}</h2>
      {/* Un profil retiré par la modération ne revit pas par un nouvel opt-in : son mentor le lit avant d'essayer. */}
      <MentoringModerationNotice state={props.previous?.moderation} removed={t("mentoring.moderation.profileRemoved")} />
      <p className="text-[15px] leading-relaxed text-muted-foreground">{t(props.previous ? "mentoring.become.again" : "mentoring.become.description")}</p>
      {canPublish ? (
        <Card className="p-4">
          <MentorProfileForm
            capability={props.capability}
            mode="create"
            current={props.previous}
            defaultCountry={props.membership.facet.countryOfResidence}
            onDone={() => undefined}
          />
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">{t("mentoring.become.statusInsufficient")}</p>
      )}
    </section>
  )
}

function Item(props: { readonly label: string; readonly wide?: boolean; readonly children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted px-3 py-2${props.wide ? " sm:col-span-2" : ""}`}>
      <dt className="text-[13px] text-muted-foreground">{props.label}</dt>
      <dd className="break-words font-medium">{props.children}</dd>
    </div>
  )
}

function MentorProfileSummary(props: { readonly capability: MentoringCapability; readonly membership: MembershipView; readonly profile: MyMentorProfileView }) {
  const { t, locale } = useDiasporaleT()
  const { capability, profile } = props
  const [editing, setEditing] = useState(false)
  const [retiring, setRetiring] = useState(false)
  const [busy, setBusy] = useState(false)
  const paused = profile.state === "paused"
  const canPublish = canPublishOf(props.membership)
  const domains = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(profile.domains.map((domain) => t(`mentor.domain.${domain}`)))
  const country = countryName(profile.country, locale)

  /** Pause ou reprise, à la version lue ; un refus se dit, rien ne change en silence. */
  const toggle = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await capability.setState({ expectedVersion: profile.version, state: paused ? "active" : "paused" })
      if (result.ok) toast.success(t(paused ? "mentoring.panel.resumed" : "mentoring.panel.paused"))
      else toast.error(t(`errors.${result.code}`))
    } catch {
      toast.error(t("errors.unknown"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="mon-profil-mentor" className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2 id="mon-profil-mentor" className="text-lg font-semibold">{t("mentoring.panel.title")}</h2>
        <span data-state={profile.state} className="inline-flex shrink-0 items-center rounded-full bg-muted px-2.5 py-0.5 text-[13px] font-medium text-foreground">
          {t(`mentoring.state.${profile.state}`)}
        </span>
      </div>
      <MentoringModerationNotice state={profile.moderation} removed={t("mentoring.moderation.profileRemoved")} />
      <Card className="flex min-w-0 flex-col gap-3 p-4">
        <p className="font-semibold">{t("mentoring.panel.capacity", { count: profile.activeMentees, max: profile.maxActiveMentees })}</p>
        <p className="text-sm text-muted-foreground">{t("mentoring.panel.pending", { count: profile.pendingRequests })}</p>
        {paused ? <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("mentoring.panel.pausedNote")}</p> : null}
        <dl className="grid min-w-0 gap-2 sm:grid-cols-2">
          <Item label={t("mentoring.panel.domains")}>{domains}</Item>
          <Item label={t("mentoring.panel.languages")}>{languageList(profile.languages, locale)}</Item>
          <Item label={t("mentoring.panel.place")}>{profile.city ? t("mentoring.panel.cityCountry", { city: profile.city, country }) : country}</Item>
          <Item label={t("mentoring.panel.availability")}>{profile.availability}</Item>
          <Item label={t("mentoring.panel.presentation")} wide>
            <span className="whitespace-pre-line">{profile.presentation}</span>
          </Item>
        </dl>
        <p className="text-[13px] text-muted-foreground">{t("mentoring.panel.cityVisibility")}</p>
        <div className="flex flex-wrap gap-2">
          {/* G9 : un profil retiré par la modération ne se modifie ni ne se rouvre plus (refus du moteur) ; il se met encore en pause. */}
          {profile.moderation !== "removed" ? (
            <Button variant="outline" disabled={!canPublish} aria-expanded={editing} onClick={() => setEditing((value) => !value)}>
              {t(editing ? "mentoring.panel.closeEdit" : "mentoring.panel.edit")}
            </Button>
          ) : null}
          {!(paused && profile.moderation === "removed") ? (
            <Button variant="outline" disabled={busy || (paused && !canPublish)} aria-busy={busy} onClick={() => void toggle()}>
              {t(paused ? "mentoring.panel.resume" : "mentoring.panel.pause")}
            </Button>
          ) : null}
          <Button variant="destructive" onClick={() => setRetiring(true)}>{t("mentoring.panel.retire")}</Button>
          {profile.state === "active" ? (
            <Button asChild variant="link">
              <NextLink href={routes.mentorProfile(profile.mentorId)}>{t("mentoring.panel.viewPublic")}</NextLink>
            </Button>
          ) : null}
        </div>
      </Card>
      {editing ? (
        <Card className="p-4">
          <MentorProfileForm
            capability={capability}
            mode="update"
            current={profile}
            defaultCountry={profile.country}
            onDone={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        </Card>
      ) : null}
      <MentoringConfirmSheet
        open={retiring}
        onOpenChange={setRetiring}
        title={t("mentoring.retire.title")}
        description={t("mentoring.retire.description")}
        confirmLabel={t("mentoring.retire.confirm")}
        destructive
        onConfirm={async () => {
          const result = await capability.setState({ expectedVersion: profile.version, state: "retired" })
          if (!result.ok) return result.code
          toast.success(t("mentoring.retire.done"))
          return null
        }}
      />
    </section>
  )
}
