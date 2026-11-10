"use client"

import { Button } from "@diasporale/features"
import { type ActionErrorCode, type EntryDoorsErrorCode, useActions, useDataSource, useEntryDoors } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { IdCardIcon, LockKeyholeIcon } from "lucide-react"
import NextLink from "next/link"
import { useEffect, useId, useRef, useState } from "react"

import { DemoAccountsButton } from "@/components/demo-accounts-panel"
import { DoorVision } from "@/components/door-vision"
import { EntryDoor } from "@/components/entry-door"
import { forgetIdnReturnError } from "@/lib/idn-return"
import { routes } from "@/lib/routes"

import { CodeForm, useLeaveEntryWhenSignedIn } from "./enter-screens"

export type EntryIntent = "sign-in" | "sign-up"

/**
 * L'accueil ET /entrer : une même porte (principe de l'accueil d'ANTSIA). La
 * carte porte l'intention — se connecter, ou créer son compte
 * (`/entrer?inscription=1`) — et l'avertissement d'une déconnexion incomplète.
 * Une session ouverte part à son fil ou à l'accueil du nouveau membre, sauf
 * après une déconnexion incomplète : l'avertissement reste alors lisible.
 * Sous la porte, la vision de DIASPORALE (`DoorVision`).
 *
 * `idnRefusal` : l'échec d'un passage par IDN, lu par la page `/entrer` dans l'adresse de retour
 * (`lib/idn-return.ts`) ; la porte le dit, puis retire le code de l'adresse.
 */
export function LandingScreen(props: { intent?: EntryIntent; signOutIncomplete?: boolean; idnRefusal?: EntryDoorsErrorCode | null } = {}) {
  return (
    <EntryDoor after={<DoorVision showJoin={props.intent !== "sign-up"} />}>
      <AccessCard signUp={props.intent === "sign-up"} signOutIncomplete={props.signOutIncomplete === true} idnRefusal={props.idnRefusal ?? null} />
    </EntryDoor>
  )
}

/** Même accès par code sur l'accueil et sur sa page dédiée : aucune seconde authentification. */
function AccessCard(props: { signUp: boolean; signOutIncomplete: boolean; idnRefusal: EntryDoorsErrorCode | null }) {
  const { t } = useDiasporaleT()
  const source = useDataSource()
  useLeaveEntryWhenSignedIn(!props.signOutIncomplete)
  return (
    <section aria-labelledby="acces-titre" className="rounded-xl bg-card p-4 shadow-float sm:p-6">
      {props.signUp ? (
        <div className="mb-4">
          <h2 id="acces-titre" className="text-xl font-semibold">
            {t("entry.signUpTitle")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("entry.signUpLead")}</p>
        </div>
      ) : (
        <h2
          id="acces-titre"
          className="sr-only min-[960px]:not-sr-only min-[960px]:mb-4 min-[960px]:text-center min-[960px]:text-xl min-[960px]:font-semibold"
        >
          {t("landing.signInTitle")}
        </h2>
      )}
      {props.signOutIncomplete ? (
        <p role="alert" className="mb-4 rounded-lg bg-muted p-4 text-sm">
          {t("entry.signOutIncomplete")}
        </p>
      ) : null}
      <IdnEntry refusal={props.idnRefusal} />
      <div className="my-4 flex items-center gap-3 text-[13px] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>{t("landing.or")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <CodeForm compact signUp={props.signUp} />
      {/* Le SMS n'existe qu'en démonstration, sur la page dédiée au code. */}
      {source.kind === "demo" ? (
        <p className="mt-2 text-center">
          <NextLink
            href={routes.enterCode()}
            className="inline-flex min-h-11 items-center rounded-md px-2 text-[13px] text-primary underline-offset-2 hover:underline focus-visible:shadow-focus"
          >
            {t("entry.smsInstead")}
          </NextLink>
        </p>
      ) : null}
      <p className="mt-4 hidden items-start justify-center gap-1.5 text-[13px] leading-snug text-muted-foreground min-[960px]:flex">
        <LockKeyholeIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{t(props.signUp ? "entry.noPassword" : "landing.privacy")}</span>
      </p>
      <div className="mt-4 border-t border-border pt-4 text-center min-[960px]:mt-5 min-[960px]:pt-5">
        {props.signUp ? (
          <Button asChild size="lg" variant="outline" className="w-full text-primary sm:w-auto">
            <NextLink href={routes.enter()}>{t("entry.existingAccount")}</NextLink>
          </Button>
        ) : (
          <>
            <p className="mb-3 hidden text-sm text-muted-foreground min-[960px]:block">{t("landing.newHere")}</p>
            <Button asChild size="lg" className="w-full bg-[var(--success-fill)] text-[var(--on-fill)] hover:bg-[var(--success-fill-hover)] sm:w-auto">
              <NextLink href={routes.register()}>{t("landing.createAccount")}</NextLink>
            </Button>
          </>
        )}
      </div>
      {/* Comptes de démonstration par acteur : développement local du moteur, ou comptes fictifs de la démonstration. */}
      <DemoAccountsButton />
    </section>
  )
}

/** IDN en démonstration : la simulation de `/entrer/idn`, inchangée. Avec le moteur : la vraie porte. */
function IdnEntry(props: { refusal: EntryDoorsErrorCode | null }) {
  const { t } = useDiasporaleT()
  const source = useDataSource()
  if (source.kind === "demo") {
    return (
      <Button asChild size="lg" variant="outline" className="w-full">
        <NextLink href={routes.enterIdn()}>
          <IdCardIcon aria-hidden />
          {t("landing.idnContinue")}
        </NextLink>
      </Button>
    )
  }
  return <EngineIdnEntry refusal={props.refusal} />
}

/**
 * « Continuer avec IDN » avec le moteur (EA-02). Le bouton n'est actif que si le déploiement
 * sert IDN ; il dit avant le départ que l'écran d'IDN nommera ANTSIA (client IDN central du
 * moteur). « Disponible prochainement » ne se dit que d'une porte fermée. Un départ refusé, ou
 * l'échec rapporté au retour d'IDN, se dit sous le bouton, traduit.
 */
function EngineIdnEntry(props: { refusal: EntryDoorsErrorCode | null }) {
  const { t } = useDiasporaleT()
  const doors = useEntryDoors()
  const actions = useActions()
  const helpId = useId()
  const [pending, setPending] = useState(false)
  const starting = useRef(false)
  const [refusal, setRefusal] = useState<ActionErrorCode | null>(props.refusal)

  // L'échec rapporté au retour d'IDN est dit une fois : son code quitte l'adresse, sans recharger.
  useEffect(() => {
    if (props.refusal !== null) forgetIdnReturnError()
  }, [props.refusal])

  // Retour arrière depuis IDN (page restaurée du cache du navigateur) : le bouton se rouvre.
  useEffect(() => {
    const reopen = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      starting.current = false
      setPending(false)
    }
    window.addEventListener("pageshow", reopen)
    return () => window.removeEventListener("pageshow", reopen)
  }, [])

  const open = doors.status === "ready" && doors.data.idn
  const help =
    doors.status === "loading" ? t("entryDoors.checking")
      : doors.status === "error" ? t("entryDoors.idnUnknown")
        : open ? t("entryDoors.idnAntsia") : t("landing.idnUnavailable")

  async function start() {
    if (!open || starting.current) return
    starting.current = true
    setPending(true)
    setRefusal(null)
    let code: ActionErrorCode
    try {
      const result = await actions.signInWithIdn()
      // Départ accepté : le navigateur part chez IDN, le bouton reste « ouverture ».
      if (result.ok) return
      code = result.code
    } catch {
      code = "network_unavailable"
    }
    starting.current = false
    setPending(false)
    setRefusal(code)
  }

  return (
    <>
      <Button
        size="lg"
        variant="outline"
        className="w-full"
        disabled={!open || pending}
        aria-busy={pending || undefined}
        aria-describedby={helpId}
        onClick={() => void start()}
      >
        <IdCardIcon aria-hidden />
        {pending ? t("entryDoors.idnStarting") : t("landing.idnContinue")}
      </Button>
      <p id={helpId} className="mt-2 text-center text-[13px] text-muted-foreground">
        {help}
      </p>
      {refusal ? (
        <p role="alert" className="mt-2 text-center text-[13px] font-medium text-destructive">
          {t(`errors.${refusal}`)}
        </p>
      ) : null}
    </>
  )
}
