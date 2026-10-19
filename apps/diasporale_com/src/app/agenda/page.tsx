import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { AgendaScreen } from "@/screens/agenda-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("eventCalendar.agendaTitle") }
}

export default function AgendaPage() {
  return <Suspense fallback={<GateSkeleton />}><AgendaScreen /></Suspense>
}
