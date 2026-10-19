"use client"

import { Button, CountryTag } from "@diasporale/features"
import { useDataSource, useOpenCountries } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { IdCardIcon, LockKeyholeIcon } from "lucide-react"
import NextLink from "next/link"

import { LanguageSwitch } from "@/components/preferences"
import { AppDemoChip, SiteFooter } from "@/components/site-chrome"
import { routes } from "@/lib/routes"

import { CodeForm } from "./enter-screens"

/**
 * L'accueil est une porte vers le réseau personnel : connexion et inscription
 * dans le premier écran. Le même formulaire sert ici et sur /entrer/code.
 */
export function LandingScreen() {
  const { t } = useDiasporaleT()
  const source = useDataSource()
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-[1060px] items-center justify-end gap-3 px-5 py-4">
        <AppDemoChip />
        <LanguageSwitch />
      </header>
      <main id="contenu" className="flex flex-1 items-center">
        <div className="mx-auto grid w-full max-w-[1060px] items-center gap-5 px-5 pb-8 pt-2 min-[960px]:grid-cols-[minmax(0,1fr)_420px] min-[960px]:gap-16 min-[960px]:pb-20 min-[960px]:pt-12">
          <section aria-labelledby="vitrine-titre" className="mx-auto w-full max-w-[480px] text-center min-[960px]:-mt-12 min-[960px]:text-left">
            <NextLink href={routes.home()} aria-label={t("nav.home")} translate="no" className="inline-block rounded-md font-display text-[38px] font-bold leading-none tracking-[-0.025em] text-primary focus-visible:shadow-focus min-[960px]:text-[76px]">
              {t("brand.name")}
            </NextLink>
            <h1 id="vitrine-titre" className="mt-3 whitespace-pre-line font-display text-[25px] font-semibold leading-[1.15] tracking-tight min-[960px]:mt-6 min-[960px]:text-[38px]">
              {t("landing.title")}
            </h1>
            <p className="mt-4 hidden max-w-[420px] text-lg leading-relaxed text-muted-foreground min-[960px]:block">{t("landing.lead")}</p>
            <OpenCommunities />
          </section>
          <div className="mx-auto w-full max-w-[420px]">
            <section aria-labelledby="connexion-titre" className="rounded-xl bg-card p-4 shadow-float sm:p-6">
              <h2 id="connexion-titre" className="sr-only min-[960px]:not-sr-only min-[960px]:mb-4 min-[960px]:text-center min-[960px]:text-xl min-[960px]:font-semibold">{t("landing.signInTitle")}</h2>
              {source.kind === "demo" ? (
                <Button asChild size="lg" variant="outline" className="w-full">
                  <NextLink href={routes.enterIdn()}>
                    <IdCardIcon aria-hidden />
                    {t("landing.idnContinue")}
                  </NextLink>
                </Button>
              ) : (
                <>
                  <Button size="lg" variant="outline" className="w-full" disabled aria-describedby="idn-disponibilite">
                    <IdCardIcon aria-hidden />
                    {t("landing.idnContinue")}
                  </Button>
                  <p id="idn-disponibilite" className="mt-2 text-center text-[13px] text-muted-foreground">{t("landing.idnUnavailable")}</p>
                </>
              )}
              <div className="my-4 flex items-center gap-3 text-[13px] text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>{t("landing.or")}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <CodeForm compact />
              <p className="mt-4 hidden items-start justify-center gap-1.5 text-[13px] leading-snug text-muted-foreground min-[960px]:flex">
                <LockKeyholeIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>{t("landing.privacy")}</span>
              </p>
              <div className="mt-4 border-t border-border pt-4 text-center min-[960px]:mt-5 min-[960px]:pt-5">
                <p className="mb-3 hidden text-sm text-muted-foreground min-[960px]:block">{t("landing.newHere")}</p>
                <Button asChild size="lg" className="w-full bg-[var(--success-fill)] text-[var(--on-fill)] hover:bg-[var(--success-fill-hover)] sm:w-auto">
                  <NextLink href={routes.register()}>{t("landing.createAccount")}</NextLink>
                </Button>
              </div>
            </section>
            <p className="mt-4 text-center text-[13px] text-muted-foreground">{t("landing.free")} {t("landing.eligibility")}</p>
          </div>
        </div>
      </main>
      <SiteFooter compact />
    </div>
  )
}

/** Pays réellement ouverts, sans chiffre promotionnel ni contenu du réseau fermé. */
function OpenCommunities() {
  const { t } = useDiasporaleT()
  const open = useOpenCountries()
  if (open.status !== "ready" || open.data.length === 0) return null
  return (
    <section aria-labelledby="pays-ouverts" className="mt-8 hidden min-[960px]:block">
      <h2 id="pays-ouverts" className="mb-3 text-sm text-muted-foreground">{t("landing.boardTitle")}</h2>
      <ul className="flex flex-wrap gap-2">
        {open.data.map((item) => (
          <li key={item.country} className="flex items-center gap-2">
            <CountryTag country={item.country} size="md" />
            {item.counters.dormant ? <span className="text-[13px] text-muted-foreground">{t("hub.soon")}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
