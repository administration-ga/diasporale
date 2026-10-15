"use client"

import { FloatingNotice } from "@diasporale/features"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ScaleIcon } from "lucide-react"

import { PublicShell } from "@/components/site-chrome"

/**
 * Textes légaux (mentions légales, politique de confidentialité) — CHARPENTE
 * seulement. Le responsable de traitement, les finalités et les durées sont à
 * valider par un juriste : le marqueur « TODO JURISTE » est VISIBLE en recette
 * et BLOQUANT pour la mise en ligne (PD6). Aucune affirmation d'audit,
 * d'hébergement ou de chiffre (doctrine de communication publique).
 */
export function LegalScreen(props: { kind: "notice" | "privacy" }) {
  const { t } = useDiasporaleT()
  const base = props.kind === "notice" ? "legal.notice" : "legal.privacy"
  return (
    <PublicShell>
      <article className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-10 pt-6 md:pt-10">
        <h1 className="font-display text-4xl font-bold">{t(`${base}.title`)}</h1>
        {/* Marqueur BLOQUANT pour la mise en ligne : il ne se ferme pas (aucune croix). */}
        <FloatingNotice role="note" tone="pending" icon={<ScaleIcon />} heading={t("legal.todoLawyer")} />
        {[1, 2, 3, 4].map((index) => (
          <section key={index} className="flex flex-col gap-2">
            <h2 className="font-display text-xl font-bold">{t(`${base}.section${index}.title`)}</h2>
            <p className="text-[15px] leading-relaxed">{t(`${base}.section${index}.body`)}</p>
          </section>
        ))}
      </article>
    </PublicShell>
  )
}
