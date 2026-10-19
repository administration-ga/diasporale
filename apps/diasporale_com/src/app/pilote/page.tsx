import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { PilotMetricsScreen } from "@/screens/pilot-metrics-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("pilotMetrics.meta.title") }
}

/** `/pilote` — la mesure du pilote (G11 · DG-027) : agrégats sans contenu privé, responsables du réseau seulement. */
export default function PilotMetricsPage() {
  return <PilotMetricsScreen />
}
