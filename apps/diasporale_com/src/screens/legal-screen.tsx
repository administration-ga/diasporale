"use client"

import { LEGAL_TEXTS, type LegalTextKind } from "@diasporale/domain"
import { FloatingNotice } from "@diasporale/features"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ScaleIcon } from "lucide-react"
import NextLink from "next/link"

import { PublicShell } from "@/components/site-chrome"
import { formatLegalTextDate } from "@/lib/legal-texts"
import { routes } from "@/lib/routes"

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
 * règles de la communauté, contact) — CHARPENTE seulement. Chaque texte lit sa
 * version, sa date et ses rubriques dans le domaine (`LEGAL_TEXTS`, LX-05) ; le fond
 * est au juriste et au propriétaire. Tant qu'un texte n'est pas fourni, le
 * marqueur « TODO JURISTE » est VISIBLE en recette et BLOQUANT pour la mise en
 * ligne (PD6). Aucune affirmation d'audit, d'hébergement ou de chiffre (doctrine de
 * communication publique).
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
        {/* Marqueur BLOQUANT pour la mise en ligne : il ne se ferme pas (aucune croix). */}
        {edition.provided ? null : <FloatingNotice role="note" tone="pending" icon={<ScaleIcon />} heading={t("legal.todoLawyer")} />}
        {edition.sections.map((section) => {
          const link = SECTION_LINKS[props.kind]?.[section]
          return (
            <section key={section} className="flex flex-col gap-2">
              <h2 className="font-display text-xl font-bold">{t(`${base}.${section}.title`)}</h2>
              <p className="text-[15px] leading-relaxed">{t(`${base}.${section}.body`)}</p>
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
