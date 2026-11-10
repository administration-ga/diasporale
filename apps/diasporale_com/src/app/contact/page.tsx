import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { LegalScreen } from "@/screens/legal-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("legal.contact.title") }
}

export default function ContactPage() {
  return <LegalScreen kind="contact" />
}
