"use client"

import { isCommunityRule, LEGAL_TEXTS, type CommunityRule, type LegalTextEdition, type LegalTextKind } from "@diasporale/domain"
import { FloatingNotice } from "@diasporale/features"
import { reportReasonsOfRule } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { FilePenLineIcon, ScaleIcon } from "lucide-react"
import NextLink from "next/link"

import { PublicShell } from "@/components/site-chrome"
import { formatLegalTextDate } from "@/lib/legal-texts"
import { COMMUNITY_RULE_ANCHORS, routes } from "@/lib/routes"

interface SectionLink {
  readonly href: () => string
  readonly label: string
}

/**
 * Le geste réel qu'une rubrique peut offrir : la page de contact renvoie à ce qui
 * existe aujourd'hui (« Mes données », ouverte même sans adhésion), jamais à une
 * adresse que personne n'a fournie.
 */
const SECTION_LINKS: Partial<Record<LegalTextKind, Readonly<Record<string, SectionLink>>>> = {
  contact: { data: { href: routes.myData, label: "footer.myData" } },
}

/**
 * Textes du site (mentions légales, confidentialité, conditions d'utilisation,
 * règles de la communauté, contact). Chaque texte lit sa version, sa date, son état et
 * ses rubriques dans le domaine (`LEGAL_TEXTS`, LX-05) ; le fond est au juriste et au
 * propriétaire. Un marqueur VISIBLE dit l'état d'un texte qui n'est pas définitif, et ne
 * se ferme pas (aucune croix) :
 *   · à fournir : « TODO JURISTE », BLOQUANT pour la mise en ligne (PD6) ;
 *   · provisoire (MD-05) : « Texte provisoire, en attente de relecture » ; chaque passage
 *     qui attend une règle de droit dit « À fournir » et nomme la question posée au juriste.
 * Les règles de la communauté portent en plus l'ancre de chaque règle et les motifs de
 * signalement qui y renvoient. Aucune affirmation d'audit, d'hébergement ou de chiffre
 * (doctrine de communication publique).
 */
export function LegalScreen(props: { kind: LegalTextKind }) {
  const { t, locale } = useDiasporaleT()
  const edition = LEGAL_TEXTS[props.kind]
  const base = `legal.${props.kind}`
  return (
    <PublicShell>
      <article className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-10 pt-6 md:pt-10">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-4xl font-bold">{t(`${base}.title`)}</h1>
          <p className="font-mono text-xs text-muted-foreground">
            {t("legal.edition", { version: edition.version, date: formatLegalTextDate(edition.date, locale) })}
          </p>
        </header>
        <EditionMarker edition={edition} />
        {edition.sections.map((section) => {
          const link = SECTION_LINKS[props.kind]?.[section]
          const rule = props.kind === "community" && isCommunityRule(section) ? section : null
          return (
            <section key={section} id={rule === null ? undefined : COMMUNITY_RULE_ANCHORS[rule]} className="flex scroll-mt-6 flex-col gap-2">
              <h2 className="font-display text-xl font-bold">{t(`${base}.${section}.title`)}</h2>
              <p className="text-[15px] leading-relaxed">{t(`${base}.${section}.body`)}</p>
              {edition.awaiting[section] ? <p className="rounded-lg bg-muted px-3 py-2 text-[13px] leading-snug">{t(`${base}.${section}.pending`)}</p> : null}
              {rule === null ? null : <RuleReasons rule={rule} />}
              {link ? (
                <NextLink
                  href={link.href()}
                  className="inline-flex min-h-11 items-center self-start rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:shadow-focus"
                >
                  {t(link.label)}
                </NextLink>
              ) : null}
            </section>
          )
        })}
      </article>
    </PublicShell>
  )
}

/** L'état d'un texte qui n'est pas définitif, dit par un marqueur qui ne se ferme pas. */
function EditionMarker(props: { readonly edition: LegalTextEdition }) {
  const { t } = useDiasporaleT()
  if (props.edition.status === "missing") return <FloatingNotice role="note" tone="pending" icon={<ScaleIcon />} heading={t("legal.todoLawyer")} />
  if (props.edition.status === "provisional") {
    return (
      <FloatingNotice role="note" tone="pending" icon={<FilePenLineIcon />} heading={t("legal.provisional.heading")}>
        {t("legal.provisional.body")}
      </FloatingNotice>
    )
  }
  return null
}

/** Les motifs de signalement qui renvoient à une règle (MD-05) : chaque motif est nommé sous une règle, et une seule. */
function RuleReasons(props: { readonly rule: CommunityRule }) {
  const { t } = useDiasporaleT()
  const reasons = reportReasonsOfRule(props.rule)
  if (reasons.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[13px] font-medium text-muted-foreground">{t("communityRules.reasonsLabel")}</p>
      <ul className="flex flex-wrap gap-1.5" aria-label={t("communityRules.reasonsLabel")}>
        {reasons.map((reason) => (
          <li key={reason} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
            {t(`report.reason.${reason}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}
