import NextLink from "next/link"

import { getAppT } from "@/i18n/server"
import { routes } from "@/lib/routes"

/** Page introuvable — un message, et le chemin du retour. */
export default async function NotFound() {
  const { t } = await getAppT()
  return (
    <main id="contenu" className="mx-auto flex min-h-[60dvh] max-w-[640px] flex-col items-start justify-center gap-4 px-4 py-10">
      <p aria-hidden className="font-mono text-6xl font-semibold text-tag-code">404</p>
      <h1 className="font-display text-3xl font-bold">{t("notFound.title")}</h1>
      <p className="text-muted-foreground">{t("notFound.body")}</p>
      <NextLink href={routes.home()} className="font-semibold text-primary underline underline-offset-4 focus-visible:shadow-focus">
        {t("notFound.back")}
      </NextLink>
    </main>
  )
}
