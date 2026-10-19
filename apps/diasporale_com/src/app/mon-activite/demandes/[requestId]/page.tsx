import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { ActivityRequestScreen } from "@/screens/service-request-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("serviceRequests.meta.activity") }
}

/** `/mon-activite/demandes/<id>` — une demande reçue par une de mes pages : proposition, refus, constat. */
export default async function ActivityRequestPage(props: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await props.params
  return <ActivityRequestScreen requestId={requestId} />
}
