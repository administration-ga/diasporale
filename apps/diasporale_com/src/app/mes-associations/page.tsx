import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { MyAssociationsScreen } from "@/screens/association-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("associations.mine.metaTitle") }
}

/** `/mes-associations` — mes adhésions et mes demandes (DG-010). */
export default function MyAssociationsPage() {
  return <MyAssociationsScreen />
}
