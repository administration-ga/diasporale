"use client"

import { Button, Card, Skeleton } from "@diasporale/features"
import { useDataSource, type DemoControls } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { CheckIcon, RotateCcwIcon, UserRoundIcon } from "lucide-react"
import NextLink from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { PublicShell } from "@/components/site-chrome"
import { routes } from "@/lib/routes"

const SCENARIOS = ["r1", "r2", "r3"] as const

/**
 * `/demo` — commandes du mode démonstration : comptes FICTIFS, remise à zéro,
 * et les parcours de recette jouables « à blanc » (R1, R2, R3). Cette page
 * n'existe qu'avec le fournisseur de démonstration.
 */
export function DemoScreen() {
  const { t } = useDiasporaleT()
  const source = useDataSource()
  const router = useRouter()
  if (source.demo === null) return null
  const demo = source.demo
  return (
    <PublicShell>
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8 px-4 pb-10 pt-6 md:pt-10">
        <div>
          <h1 className="font-display text-4xl font-bold">{t("demo.title")}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t("demo.lead")}</p>
        </div>

        <section aria-labelledby="demo-parcours" className="flex flex-col gap-3">
          <h2 id="demo-parcours" className="font-display text-2xl font-bold">
            {t("demo.scenariosTitle")}
          </h2>
          {SCENARIOS.map((scenario) => (
            <Card key={scenario} className="p-4">
              <h3 className="font-semibold">{t(`demo.scenario.${scenario}.title`)}</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-[15px] leading-snug">
                {[1, 2, 3, 4].map((step) => (
                  <li key={step}>{t(`demo.scenario.${scenario}.step${step}`)}</li>
                ))}
              </ol>
            </Card>
          ))}
        </section>

        <DemoAccounts demo={demo} onSwitched={() => router.push(routes.feed())} />

        <section aria-labelledby="demo-reset" className="flex flex-col gap-3">
          <h2 id="demo-reset" className="font-display text-2xl font-bold">
            {t("demo.resetTitle")}
          </h2>
          <p className="text-[15px] text-muted-foreground">{t("demo.resetBody")}</p>
          <Button
            variant="outline"
            className="self-start"
            onClick={async () => {
              await demo.reset()
              toast.success(t("demo.resetDone"))
            }}
          >
            <RotateCcwIcon aria-hidden />
            {t("demo.reset")}
          </Button>
        </section>

        <p className="text-[13px] text-muted-foreground">
          <NextLink href={routes.charte()} className="font-semibold underline underline-offset-2 focus-visible:shadow-focus">
            {t("demo.charteLink")}
          </NextLink>
        </p>
      </div>
    </PublicShell>
  )
}

function DemoAccounts(props: { demo: DemoControls; onSwitched: () => void }) {
  const { t } = useDiasporaleT()
  const accounts = props.demo.useAccounts()
  return (
    <section aria-labelledby="demo-comptes" className="flex flex-col gap-3">
      <h2 id="demo-comptes" className="font-display text-2xl font-bold">
        {t("demo.accountsTitle")}
      </h2>
      <p className="text-[15px] text-muted-foreground">{t("demo.accountsBody")}</p>
      {accounts.status !== "ready" ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {accounts.data.map((account) => (
            <li key={account.personId}>
              <Card className="flex h-full flex-col gap-2 p-4">
                <p className="flex items-center gap-2 font-semibold">
                  <UserRoundIcon className="size-4 text-muted-foreground" aria-hidden />
                  {account.displayName}
                </p>
                {account.handle ? <p className="font-mono text-[13px] text-muted-foreground">@{account.handle}</p> : null}
                <p className="text-[13px] leading-snug">{t(account.descriptionKey)}</p>
                <div className="mt-auto pt-2">
                  {account.current ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--success)]">
                      <CheckIcon className="size-4" aria-hidden />
                      {t("demo.current")}
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await props.demo.switchTo(account.personId)
                        props.onSwitched()
                      }}
                    >
                      {t("demo.switch")}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
