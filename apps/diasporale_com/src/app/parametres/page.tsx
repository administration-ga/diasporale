import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { SettingsScreen } from "@/screens/settings-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("settings.title") }
}

export default function SettingsPage() {
  return <SettingsScreen />
}
