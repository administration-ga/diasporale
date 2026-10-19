"use client"

/**
 * CC-6 — les conversations de mise en relation dans DIASPORALE (contrat
 * CONVERSATION-CONTEXTUELLE-V1, ADR-0025 du moteur).
 * PROPRIÉTAIRE : chantier « conversations contextuelles ».
 *
 *  · `useDiasporaleContextualMessages` : l'injection dans la messagerie du moteur
 *    (`MessagesRoute`, prop `contextual`), à monter sous l'îlot iCom : filtre
 *    « Mises en relation », conversation en page, nos refus traduits, l'objet
 *    rouvert par sa route ;
 *  · `ObjectConversationEntry` : depuis l'écran d'un objet (demande de service,
 *    mentorat, candidature), revoir ou ouvrir sa conversation. La phase vient de
 *    la règle pure du domaine ; le moteur relit tout à la lecture et à l'ouverture.
 */
import { useContextualMessages } from "@antsia/social-features/messagerie"
import type { ContextualObjectRefView, ContextualThreadView } from "@antsia/social-features/features/messagerie/contextual-entry"
import { Button } from "@diasporale/features"
import { CONVERSATION_TEXT_REFUSALS, type ConversationPhase, type ConversationSide, type ConversationTextRefusal } from "@diasporale/domain"
import { useConversations, type ConversationObjectRef, type ConversationsCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { MessageCircleIcon } from "lucide-react"
import NextLink from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { routes } from "@/lib/routes"

/** Nos codes fermés de la règle de texte (tranche `diaspora`), en clés citées en entier. */
const RULE_SENTENCES = {
  context_address_forbidden: "contextualRules.context_address_forbidden",
} as const satisfies Record<ConversationTextRefusal, string>

function isDiasporaleRule(code: string): code is ConversationTextRefusal {
  return (CONVERSATION_TEXT_REFUSALS as readonly string[]).includes(code)
}

/**
 * L'écran d'un objet, de mon côté : une demande se relit à la même adresse des deux
 * côtés (la fiche sait qui la lit) ; une candidature s'ouvre chez la personne qui
 * candidate ou dans les emplois de l'équipe.
 */
export function contextualObjectHref(object: ContextualObjectRefView, side: ConversationSide | null): string {
  switch (object.kind) {
    case "diasporaServiceRequest":
      return routes.serviceRequest(object.id)
    case "diasporaMentoring":
      return routes.myMentoring()
    case "diasporaJobApplication":
      return side === "responder" ? routes.myActivity("emplois") : routes.myApplications()
  }
}

/** L'injection DIASPORALE dans la messagerie du moteur ; à appeler sous l'îlot iCom (routeur et réseau). */
export function useDiasporaleContextualMessages() {
  const { t } = useDiasporaleT()
  const router = useRouter()
  // Mon côté, par objet, relu de la projection du fil : l'objet se rouvre de mon côté.
  const sides = useRef(new Map<string, ConversationSide>())
  const options = useMemo(() => ({
    // Un code fermé de la tranche se dit ici ; tout autre code garde la phrase neutre du moteur.
    describeAppRule: (code: string) => (isDiasporaleRule(code) ? t(RULE_SENTENCES[code]) : null),
    describeObject: (thread: ContextualThreadView) => {
      if (thread.object !== null) sides.current.set(thread.object.id, thread.viewer.side)
      // L'état de l'objet se lit sur son écran : la conversation n'en dit rien de plus.
      return null
    },
    onOpenObject: (object: ContextualObjectRefView) => {
      router.push(contextualObjectHref(object, sides.current.get(object.id) ?? null))
    },
  }), [t, router])
  return useContextualMessages(options)
}

/** Depuis l'écran d'un objet : revoir ou ouvrir sa conversation de mise en relation. Rien sans fournisseur, ni avant la phase ouverte. */
export function ObjectConversationEntry(props: { readonly object: ConversationObjectRef; readonly phase: ConversationPhase }) {
  const capability = useConversations()
  if (capability === null || props.phase === "not_open") return null
  return <ObjectConversationLoaded capability={capability} object={props.object} phase={props.phase} />
}

function ObjectConversationLoaded(props: { readonly capability: ConversationsCapability; readonly object: ConversationObjectRef; readonly phase: ConversationPhase }) {
  const { t } = useDiasporaleT()
  const router = useRouter()
  const query = props.capability.useThreadFor(props.object)
  const [busy, setBusy] = useState(false)
  // L'entrée est secondaire : en chargement ou en panne, l'écran de l'objet reste entier, sans elle.
  if (query.status !== "ready") return null
  const thread = query.data
  if (thread !== null) {
    return (
      <Button asChild variant="outline" size="sm" className="min-h-11">
        <NextLink href={routes.contextualConversation(thread.threadId)}>
          <MessageCircleIcon aria-hidden />
          {t(thread.writable ? "conversationEntry.open" : "conversationEntry.review")}
          {thread.unread ? <span className="rounded-full bg-primary px-2 py-0.5 text-[12px] font-semibold text-primary-foreground">{t("conversationEntry.unread")}</span> : null}
        </NextLink>
      </Button>
    )
  }
  // Pas encore de fil : l'ouvrir n'a de sens qu'en phase ouverte ; le moteur relit la partie et la phase.
  if (props.phase !== "open") return null
  const open = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await props.capability.open(props.object)
      if (result.ok) router.push(routes.contextualConversation(result.value.threadId))
      else toast.error(t(`errors.${result.code}`))
    } catch {
      toast.error(t("errors.unknown"))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="outline" size="sm" className="min-h-11" disabled={busy} aria-busy={busy} onClick={() => void open()}>
      <MessageCircleIcon aria-hidden />
      {t(busy ? "conversationEntry.opening" : "conversationEntry.write")}
    </Button>
  )
}
