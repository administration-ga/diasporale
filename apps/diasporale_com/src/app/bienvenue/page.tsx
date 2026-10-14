import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { WelcomeScreen } from "@/screens/welcome-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("welcome.metaTitle") }
}

export default function WelcomePage() {
  return <WelcomeScreen />
}
