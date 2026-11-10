import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { NotificationsScreen } from "@/screens/notifications-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("notificationsCenter.title") }
}

export default function NotificationsPage() {
  return <NotificationsScreen />
}
