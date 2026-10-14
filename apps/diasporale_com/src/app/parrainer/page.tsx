import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { SponsorScreen } from "@/screens/sponsor-attestation-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("sponsor.title") }
}

export default function SponsorPage() {
  return <SponsorScreen />
}
