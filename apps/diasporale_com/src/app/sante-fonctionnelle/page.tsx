import { getAppT } from "@/i18n/server"

/** Page de santé fonctionnelle (PD0) : répond 200 sans dépendre du moteur. */
export default async function HealthPage() {
  const { t } = await getAppT()
  return (
    <main id="contenu" className="mx-auto max-w-[640px] px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{t("health.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("health.ok")}</p>
    </main>
  )
}
