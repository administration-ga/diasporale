import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { MyServiceRequestScreen } from "@/screens/service-request-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("serviceRequests.meta.detail") }
}

/** `/mes-demandes/<id>` — ma demande : chronologie, proposition courante, accord, annulation. */
export default async function MyServiceRequestPage(props: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await props.params
  return <MyServiceRequestScreen requestId={requestId} />
}
