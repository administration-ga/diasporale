import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { LegalScreen } from "@/screens/legal-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("legal.privacy.title") }
}

export default function PrivacyPage() {
  return <LegalScreen kind="privacy" />
}
