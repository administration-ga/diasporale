import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { MyDataScreen } from "@/screens/my-data-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("settings.data") }
}

/** `/mes-donnees` — les droits personnels hors de la coque de membre, adhésion facultative (NP-02, EA-05). */
export default function MyDataPage() {
  return <MyDataScreen />
}
