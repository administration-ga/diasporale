import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { MyApplicationsScreen } from "@/screens/jobs-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("jobs.meta.applications") }
}

/** `/mes-candidatures` — mes candidatures, privées, de la plus récemment mise à jour. */
export default function MyApplicationsPage() {
  return <MyApplicationsScreen />
}
