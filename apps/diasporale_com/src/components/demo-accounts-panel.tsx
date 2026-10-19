"use client"

import { DIASPORALE_DEMO_ACTOR_SPECS, DIASPORALE_DEMO_GROUPS, diasporaleDemoDisplayName } from "@diasporale/domain"
import { Avatar, CountryTag, Sheet, SheetContent, SheetTrigger } from "@diasporale/features"
import { useActions, useDataSource, useDemoAccounts, type DemoAccountEntry, type DemoAccountsCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ChevronRightIcon, FlaskConicalIcon, LoaderCircleIcon } from "lucide-react"
import NextLink from "next/link"
import { forwardRef, useId, useState, type ComponentPropsWithoutRef, type ReactNode } from "react"

import { forgetDemoActor, rememberDemoActor } from "@/lib/demo-account-pending"
import { routes } from "@/lib/routes"

const TRIGGER =
  "flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--esp-neutral-hover)] focus-visible:shadow-focus"

/** Le contenu du déclencheur : pastille de démonstration, libellé, mention du développement local. */
function TriggerBody() {
  const { t } = useDiasporaleT()
  return (
    <>
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--dg-demo-bg)] text-[var(--dg-demo-fg)] [&_svg]:size-4">
        <FlaskConicalIcon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{t("demoAccounts.open")}</span>
        <span className="block text-[13px] text-muted-foreground">{t("demoAccounts.openHint")}</span>
      </span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </>
  )
}

const TriggerButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<"button">>(function TriggerButton(props, ref) {
  return (
    <button ref={ref} type="button" {...props} className={TRIGGER}>
      <TriggerBody />
    </button>
  )
})

/**
 * Le bouton des comptes de démonstration, sous la carte d'accès de la porte.
 * - Moteur, développement local : il ouvre la feuille des acteurs ; chacun entre
 *   par le vrai code à usage unique, lu ici, puis l'amorçage (`DemoAccountBootstrap`)
 *   rejoue l'accueil et équipe le compte.
 * - Démonstration (données fictives de ce navigateur) : il mène aux comptes fictifs.
 * - Ailleurs (catalogue vide, production comprise) : rien ne s'affiche.
 */
export function DemoAccountsButton() {
  const source = useDataSource()
  const demoAccounts = useDemoAccounts()
  if (source.kind === "demo") {
    return (
      <DemoAccountsBlock>
        <NextLink href={routes.demo()} className={TRIGGER}>
          <TriggerBody />
        </NextLink>
      </DemoAccountsBlock>
    )
  }
  if (demoAccounts === null) return null
  return <EngineDemoAccounts capability={demoAccounts} />
}

function DemoAccountsBlock(props: { children: ReactNode }) {
  return <div className="mt-4 border-t border-border pt-3 min-[960px]:mt-5">{props.children}</div>
}

function EngineDemoAccounts(props: { capability: DemoAccountsCapability }) {
  const catalogue = props.capability.useCatalogue()
  if (catalogue.status !== "ready" || catalogue.data.length === 0) return null
  return <DemoAccountsSheet capability={props.capability} entries={catalogue.data} />
}

function DemoAccountsSheet(props: { capability: DemoAccountsCapability; entries: readonly DemoAccountEntry[] }) {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const ids = useId()
  const [pending, setPending] = useState<DemoAccountEntry["actor"] | null>(null)
  const [failed, setFailed] = useState(false)

  async function enter(entry: DemoAccountEntry) {
    setPending(entry.actor)
    setFailed(false)
    try {
      rememberDemoActor(entry.actor)
      const sent = await actions.requestCode({ kind: "email", value: entry.email })
      if (!sent.ok) throw new Error(sent.code)
      const code = sent.value.demoCode ?? (await props.capability.readLocalCode(entry.email))
      if (code === null) throw new Error("code")
      const verified = await actions.verifyCode(code)
      if (!verified.ok) throw new Error(verified.code)
      // Le moteur recharge la page vers l'accueil : l'amorçage reprend l'acteur mémorisé.
    } catch {
      forgetDemoActor()
      setPending(null)
      setFailed(true)
    }
  }

  return (
    <DemoAccountsBlock>
      <Sheet>
        <SheetTrigger asChild>
          <TriggerButton />
        </SheetTrigger>
        <SheetContent title={t("demoAccounts.title")} description={t("demoAccounts.lead")} closeLabel={t("demoAccounts.close")}>
          {failed ? (
            <p role="alert" className="mb-4 rounded-lg bg-muted p-3 text-sm text-destructive">
              {t("demoAccounts.failed")}
            </p>
          ) : null}
          {DIASPORALE_DEMO_GROUPS.map((group) => {
            const members = props.entries.filter((entry) => DIASPORALE_DEMO_ACTOR_SPECS[entry.actor].group === group)
            if (members.length === 0) return null
            return (
              <section key={group} aria-labelledby={`${ids}-${group}`} className="mt-5 first:mt-0">
                <h3 id={`${ids}-${group}`} className="mb-2 text-[13px] font-semibold text-muted-foreground">
                  {t(`demoAccounts.groups.${group}`)}
                </h3>
                <ul className="flex flex-col gap-2">
                  {members.map((entry) => (
                    <li key={entry.actor}>
                      <ActorChoice entry={entry} pending={pending === entry.actor} disabled={pending !== null} onEnter={() => void enter(entry)} />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </SheetContent>
      </Sheet>
    </DemoAccountsBlock>
  )
}

function ActorChoice(props: { entry: DemoAccountEntry; pending: boolean; disabled: boolean; onEnter: () => void }) {
  const { t } = useDiasporaleT()
  const { actor } = props.entry
  const spec = DIASPORALE_DEMO_ACTOR_SPECS[actor]
  const name = diasporaleDemoDisplayName(actor) ?? t("demoAccounts.newcomer")
  return (
    <button
      type="button"
      disabled={props.disabled}
      aria-busy={props.pending || undefined}
      onClick={props.onEnter}
      className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-[var(--esp-neutral-chip)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--esp-neutral-hover)] focus-visible:shadow-focus disabled:cursor-wait disabled:opacity-70"
    >
      <Avatar id={`demo-${actor}`} name={name} size="md" shape={spec.group === "pages" ? "square" : "round"} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{t(`demoAccounts.actors.${actor}.title`)}</span>
          <span className="text-[13px] text-muted-foreground">{name}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[13px] leading-snug text-muted-foreground">
          {props.pending ? <LoaderCircleIcon className="size-3.5 shrink-0 motion-safe:animate-spin" aria-hidden /> : null}
          {props.pending ? t("demoAccounts.signingIn") : t(`demoAccounts.actors.${actor}.description`)}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <CountryTag country={spec.country} />
        {spec.expectedStatus !== null ? (
          <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {t(`membership.status.${spec.expectedStatus}`)}
          </span>
        ) : null}
      </span>
    </button>
  )
}
