import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { MyServiceRequestsScreen } from "@/screens/service-request-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("serviceRequests.meta.mine") }
}

/** `/mes-demandes` — mes demandes de service, de la plus récemment mise à jour. */
export default function MyServiceRequestsPage() {
  return <MyServiceRequestsScreen />
}
