"use client"

/**
 * L'entraide LÀ OÙ L'ON PASSE (ET-09) : trois blocs, chacun branché sur la capacité
 * « entraide » du port, chacun silencieux tant qu'il n'a rien de vrai à montrer — aucune
 * section vide affichée comme active, aucun chiffre inventé.
 *
 *   · sur la fiche d'une association : ses prochaines missions OUVERTES (cinq au plus) ;
 *   · dans l'agenda : mes inscriptions bénévoles à venir (ou annulées, dites telles) ;
 *   · sur le hub d'un pays : ses trois dernières questions ouvertes.
 *
 * L'autorité reste au fournisseur (moteur ou démonstration) : ces blocs disent ce qu'il a
 * jugé (modération, blocages). PROPRIÉTAIRE : chantier « entraide » (ET-09).
 */
import type { CountryCode } from "@diasporale/domain"
import { Card } from "@diasporale/features"
import { useOptionalDataSource, type AidMissionCardView, type MutualAidCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowRightIcon, HandHeartIcon } from "lucide-react"
import NextLink from "next/link"
import { useId, useMemo } from "react"

import { AidMissionStatusChip, AidMissionWhen, AidPlace, AidThemeChip, aidLinkClass } from "@/components/mutual-aid-parts"
import { useNow } from "@/components/service-request-ui"
import { routes } from "@/lib/routes"

/** Les dernières questions ouvertes offertes au hub : trois, jamais une liste. */
export const HUB_AID_QUESTIONS = 3

/** La capacité « entraide », si un fournisseur est monté ET la sert ; ces blocs se taisent sinon (écrans hôtes sans fournisseur compris). */
function useOptionalMutualAid(): MutualAidCapability | null {
  return useOptionalDataSource()?.mutualAid ?? null
}

const moreLinkClass = "inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium text-primary hover:underline focus-visible:shadow-focus"

/** Une mission, en une carte courte : titre, quand, où, places, et mon inscription. */
function MissionLine(props: { readonly mission: AidMissionCardView; readonly now: number; readonly showPage: boolean }) {
  const { t } = useDiasporaleT()
  const { mission } = props
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <AidMissionStatusChip status={mission.status} startsAt={mission.startsAt} endsAt={mission.endsAt} now={props.now} />
        {mission.signedUp ? <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[13px] font-medium">{t("mutualAid.mission.signedUp")}</span> : null}
      </div>
      <NextLink href={routes.mutualAidItem(mission.id)} className={`${aidLinkClass} text-base`}>{mission.title}</NextLink>
      {props.showPage ? <p className="break-words text-sm">{t("mutualAid.mission.byPage", { page: mission.page.name })}</p> : null}
      <div className="flex min-w-0 flex-col gap-1 text-[13px] text-muted-foreground">
        <AidMissionWhen startsAt={mission.startsAt} endsAt={mission.endsAt} timeZone={mission.timeZone} />
        <AidPlace country={mission.country} city={mission.city} area={mission.area} />
        <span>{t("mutualAid.mission.places", { count: mission.places, taken: mission.signupCount })}</span>
      </div>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════
// La fiche d'une association
// ═══════════════════════════════════════════════════════════════

/** Les prochaines missions d'une association, sur sa fiche ; rien si le fournisseur ne sert pas l'entraide. */
export function PageMissionsSection(props: { readonly pageId: string }) {
  const capability = useOptionalMutualAid()
  return capability ? <PageMissions capability={capability} pageId={props.pageId} /> : null
}

function PageMissions(props: { readonly capability: MutualAidCapability; readonly pageId: string }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const now = useNow()
  const missions = props.capability.useUpcomingPageMissions({ pageId: props.pageId })
  // Aucune section vide affichée comme active : rien tant qu'aucune mission ouverte n'est servie.
  if (missions.status !== "ready" || missions.data.length === 0) return null
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <h2 id={id} className="font-display text-xl font-bold">{t("aidOnTheWay.page.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("aidOnTheWay.page.lead")}</p>
      <ul className="flex min-w-0 flex-col gap-3">
        {missions.data.map((mission) => <li key={mission.id} className="min-w-0"><MissionLine mission={mission} now={now} showPage={false} /></li>)}
      </ul>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════
// L'agenda
// ═══════════════════════════════════════════════════════════════

/** Mes inscriptions bénévoles à venir, dans l'agenda ; rien si le fournisseur ne sert pas l'entraide. */
export function AgendaMissionsSection() {
  const capability = useOptionalMutualAid()
  return capability ? <AgendaMissions capability={capability} /> : null
}

function AgendaMissions(props: { readonly capability: MutualAidCapability }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const now = useNow(60_000)
  // Les inscriptions les plus récentes (une fenêtre de la liste « Mes inscriptions ») ; toutes restent sur /entraide.
  const signups = props.capability.useMySignups({ cursor: null })
  const upcoming = useMemo(() => (signups.status === "ready"
    ? [...signups.data.items].filter((mission) => (mission.endsAt ?? mission.startsAt) >= now).sort((left, right) => left.startsAt - right.startsAt)
    : []), [signups, now])
  // Aucune section vide affichée comme active : rien sans inscription à venir.
  if (upcoming.length === 0) return null
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <h2 id={id} className="text-xl font-semibold">{t("aidOnTheWay.agenda.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("aidOnTheWay.agenda.lead")}</p>
      <ul className="flex min-w-0 flex-col gap-3">
        {upcoming.map((mission) => <li key={mission.id} className="min-w-0"><MissionLine mission={mission} now={now} showPage /></li>)}
      </ul>
      <NextLink href={routes.mutualAid(undefined, undefined, { tab: "missions", view: "mine" })} className={moreLinkClass}>
        {t("aidOnTheWay.agenda.all")}
        <ArrowRightIcon aria-hidden className="size-4" />
      </NextLink>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════
// Le hub d'un pays
// ═══════════════════════════════════════════════════════════════

/** Les dernières questions ouvertes d'un pays, offertes à son hub ; rien si le fournisseur ne sert pas l'entraide. */
export function HubMutualAidBlock(props: { readonly country: CountryCode; readonly countryLabel: string }) {
  const capability = useOptionalMutualAid()
  return capability ? <HubMutualAid capability={capability} country={props.country} countryLabel={props.countryLabel} /> : null
}

function HubMutualAid(props: { readonly capability: MutualAidCapability; readonly country: CountryCode; readonly countryLabel: string }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const questions = props.capability.useQuestions({ country: props.country, status: "open", limit: HUB_AID_QUESTIONS, cursor: null })
  // Aucune section vide affichée comme active : rien tant qu'aucune question ouverte n'est servie.
  if (questions.status !== "ready" || questions.data.items.length === 0) return null
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3 rounded-2xl bg-card p-5 shadow-card">
      <h2 id={id} className="flex items-center gap-2 font-display text-xl font-bold">
        <HandHeartIcon aria-hidden className="size-5" />
        {t("aidOnTheWay.hub.title", { country: props.countryLabel })}
      </h2>
      <p className="text-sm text-muted-foreground">{t("aidOnTheWay.hub.lead")}</p>
      <ul className="flex min-w-0 flex-col gap-3">
        {questions.data.items.slice(0, HUB_AID_QUESTIONS).map((question) => (
          <li key={question.id} className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <AidThemeChip theme={question.theme} />
              <span className="text-[13px] text-muted-foreground">{t("mutualAid.questions.answerCount", { count: question.answerCount })}</span>
            </div>
            <NextLink href={routes.mutualAidItem(question.id)} className={aidLinkClass}>{question.title}</NextLink>
          </li>
        ))}
      </ul>
      <NextLink href={routes.mutualAid(props.country)} className={moreLinkClass}>
        {t("aidOnTheWay.hub.all")}
        <ArrowRightIcon aria-hidden className="size-4" />
      </NextLink>
    </section>
  )
}
