import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { ServiceOfferScreen } from "@/screens/services-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("services.meta.offer") }
}

/** `/services/<id>` — la fiche d'une offre ; indisponible, un état neutre. */
export default async function ServiceOfferPage(props: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await props.params
  return <ServiceOfferScreen offerId={offerId} />
}
