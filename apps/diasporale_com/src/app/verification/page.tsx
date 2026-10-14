import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { AttestationScreen } from "@/screens/sponsor-attestation-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("attestation.title") }
}

export default function AttestationPage() {
  return <AttestationScreen />
}
