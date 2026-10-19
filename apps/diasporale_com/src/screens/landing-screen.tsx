"use client"

import { Button } from "@diasporale/features"
import { useDataSource } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { IdCardIcon, LockKeyholeIcon } from "lucide-react"
import NextLink from "next/link"

import { DoorVision } from "@/components/door-vision"
import { EntryDoor } from "@/components/entry-door"
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
 */
export function LandingScreen(props: { intent?: EntryIntent; signOutIncomplete?: boolean } = {}) {
  return (
    <EntryDoor after={<DoorVision showJoin={props.intent !== "sign-up"} />}>
      <AccessCard signUp={props.intent === "sign-up"} signOutIncomplete={props.signOutIncomplete === true} />
    </EntryDoor>
  )
}

/** Même accès par code sur l'accueil et sur sa page dédiée : aucune seconde authentification. */
function AccessCard(props: { signUp: boolean; signOutIncomplete: boolean }) {
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
      <IdnEntry />
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
    </section>
  )
}

/** IDN en démonstration ; avec le moteur, la porte est annoncée indisponible et ne navigue pas. */
function IdnEntry() {
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
  return (
    <>
      <Button size="lg" variant="outline" className="w-full" disabled aria-describedby="idn-disponibilite">
        <IdCardIcon aria-hidden />
        {t("landing.idnContinue")}
      </Button>
      <p id="idn-disponibilite" className="mt-2 text-center text-[13px] text-muted-foreground">
        {t("landing.idnUnavailable")}
      </p>
    </>
  )
}
