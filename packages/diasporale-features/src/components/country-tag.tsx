"use client"

import type { ContentScope, CountryCode } from "@diasporale/domain"
import { GlobeIcon } from "lucide-react"

import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"
import { countryName } from "../lib/countries"

/**
 * L'étiquette pays — signature de la charte (§5) : bord gauche taillé en
 * pointe, œillet percé, code ISO en mono. Le pays est le contexte permanent
 * (invariant 7) : toute carte de contenu porte une étiquette.
 *
 * Accessibilité : le code ISO est décoratif (`aria-hidden`), le nom complet du
 * pays est annoncé ; la couleur ne porte aucune information.
 */
const TAG_SHAPE =
  "[clip-path:polygon(9px_0,100%_0,100%_100%,9px_100%,0_50%)] rounded-r-[var(--radius-sm)]"

const SIZES = {
  sm: "h-6 gap-1.5 pl-[13px] pr-2 text-xs",
  md: "h-7 gap-2 pl-[15px] pr-2.5 text-[13px]",
} as const

function Eyelet() {
  return <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-tag-eyelet ring-1 ring-tag-eyelet-ring" />
}

export function CountryTag(props: {
  country: CountryCode
  city?: string | undefined
  size?: keyof typeof SIZES
  className?: string
}) {
  const { locale } = useDiasporaleT()
  const name = countryName(props.country, locale)
  return (
    <span
      data-slot="country-tag"
      className={cn(
        "inline-flex max-w-full shrink-0 items-center bg-tag font-medium text-tag-foreground",
        TAG_SHAPE,
        SIZES[props.size ?? "sm"],
        props.className,
      )}
    >
      <Eyelet />
      <span aria-hidden className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-tag-code">
        {props.country}
      </span>
      <span className="sr-only">{name}</span>
      <span className="truncate" aria-hidden={props.city === undefined}>
        {props.city ?? name}
      </span>
    </span>
  )
}

/** Portée `diaspora` : tout le réseau. Un globe, jamais un drapeau. */
export function ScopeTag(props: { size?: keyof typeof SIZES; className?: string }) {
  const { t } = useDiasporaleT()
  return (
    <span
      data-slot="scope-tag"
      className={cn(
        "inline-flex shrink-0 items-center bg-tag-diaspora font-medium text-tag-diaspora-foreground",
        TAG_SHAPE,
        SIZES[props.size ?? "sm"],
        props.className,
      )}
    >
      <Eyelet />
      <GlobeIcon className="size-3.5" aria-hidden />
      <span>{t("scope.diaspora")}</span>
    </span>
  )
}

/** L'étiquette d'un contenu, selon sa portée — et, dans un hub, la pastille d'origine. */
export function ContentScopeTag(props: { scope: ContentScope; hubCountry?: CountryCode; className?: string }) {
  const { t, locale } = useDiasporaleT()
  if (props.scope.reach === "local") {
    return <CountryTag country={props.scope.country} className={props.className} />
  }
  const origin = props.scope.country
  const showOrigin = origin !== undefined && props.hubCountry !== undefined && origin !== props.hubCountry
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", props.className)}>
      <ScopeTag />
      {showOrigin ? (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          {t("scope.origin", { country: countryName(origin, locale) })}
        </span>
      ) : null}
    </span>
  )
}

/** Le code monumental de l'en-tête du hub (charte §5, le risque assumé). Décoratif : le titre porte le nom. */
export function CountryMonument(props: { country: CountryCode; className?: string }) {
  return (
    <span
      aria-hidden
      data-slot="country-monument"
      className={cn(
        "block font-mono text-[64px] font-semibold leading-[0.85] tracking-[-0.04em] text-monument md:text-[96px]",
        props.className,
      )}
    >
      {props.country}
    </span>
  )
}
