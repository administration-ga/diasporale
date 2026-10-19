import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { ArrivalKitResourceScreen } from "@/screens/arrival-kit-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("arrivalKit.meta.resource") }
}

/** `/kit-arrivee/<id>` — la fiche d'une ressource du kit d'arrivée ; indisponible, un état neutre (DG-024 b). */
export default async function ArrivalKitResourcePage(props: { params: Promise<{ resourceId: string }> }) {
  const { resourceId } = await props.params
  return <ArrivalKitResourceScreen resourceId={resourceId} />
}
