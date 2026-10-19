import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { MyMentoringScreen } from "@/screens/mentoring-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("mentoring.meta.mine") }
}

/** `/mes-mentorats` — mes demandes de mentorat (envoyées, reçues) et mon profil de mentor. */
export default function MyMentoringPage() {
  return <MyMentoringScreen />
}
