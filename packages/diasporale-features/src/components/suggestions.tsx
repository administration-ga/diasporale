"use client"

import { UserPlusIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { useActions, useSuggestions } from "../data/context"
import type { SuggestionView } from "../data/types"
import { useDiasporaleT } from "../i18n/client"
import { countryName } from "../lib/countries"
import { Button } from "../primitives/button"
import { Avatar } from "../primitives/surface"
import { useRouting } from "../routing"
import { TrustBadges } from "./trust-badge"

/**
 * Des membres à rencontrer (EXF-DG-18) : six au plus, tirés de l'annuaire
 * opt-in, chacun avec ce qui rapproche — lu sur ce que le lecteur a le droit de
 * voir. « Se connecter » passe par la demande de relation ; la croix ne propose
 * plus la personne, sans qu'elle l'apprenne. Rien ne s'affiche quand il n'y a
 * personne à proposer, ou quand le statut ne permet pas encore l'annuaire.
 */
export function MemberSuggestions(props: { headingId: string; className?: string }) {
  const { t } = useDiasporaleT()
  const suggestions = useSuggestions()
  if (suggestions.status !== "ready" || suggestions.data.length === 0) return null
  return (
    <section aria-labelledby={props.headingId} className={props.className}>
      <h2 id={props.headingId} className="font-display text-lg font-bold">
        {t("suggestions.title")}
      </h2>
      <ul className="mt-3 flex flex-col gap-1">
        {suggestions.data.map((suggestion) => (
          <SuggestionRow key={suggestion.personId} suggestion={suggestion} />
        ))}
      </ul>
    </section>
  )
}

function SuggestionRow(props: { suggestion: SuggestionView }) {
  const { t, locale } = useDiasporaleT()
  const actions = useActions()
  const { routes, Link } = useRouting()
  const [busy, setBusy] = useState(false)
  const { suggestion } = props
  const { reasons, facet } = suggestion

  const why = [
    reasons.sameCity && facet.city ? t("suggestions.sameCity", { city: facet.city }) : null,
    !reasons.sameCity && reasons.sameCountry && facet.countryOfResidence
      ? t("suggestions.sameCountry", { country: countryName(facet.countryOfResidence, locale) })
      : null,
    reasons.sharedAssociations > 0 ? t("suggestions.sharedAssociations", { count: reasons.sharedAssociations }) : null,
    reasons.mutualConnections > 0 ? t("suggestions.mutualConnections", { count: reasons.mutualConnections }) : null,
  ].filter((part): part is string => part !== null)

  const run = async (action: () => ReturnType<typeof actions.connect>, done: string) => {
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (result.ok) toast.success(done)
    else toast.error(t(`errors.${result.code}`))
  }

  return (
    <li className="flex items-start gap-3 rounded-xl px-2 py-2">
      <Avatar id={suggestion.personId} name={suggestion.displayName} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={routes.profile(suggestion.handle)} className="truncate font-semibold text-foreground hover:underline focus-visible:shadow-focus">
            {suggestion.displayName}
          </Link>
          <TrustBadges badges={suggestion.badges} size="sm" />
        </p>
        {why.length > 0 ? <p className="mt-0.5 text-[13px] text-muted-foreground">{why.join(" · ")}</p> : null}
        <Button size="sm" variant="outline" className="mt-2" disabled={busy} onClick={() => run(() => actions.connect(suggestion.personId), t("suggestions.requested"))}>
          <UserPlusIcon aria-hidden />
          {t("relation.connect")}
        </Button>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={busy}
        aria-label={t("suggestions.dismiss", { name: suggestion.displayName })}
        onClick={() => run(() => actions.dismissSuggestion(suggestion.handle), t("suggestions.dismissed"))}
      >
        <XIcon aria-hidden />
      </Button>
    </li>
  )
}
