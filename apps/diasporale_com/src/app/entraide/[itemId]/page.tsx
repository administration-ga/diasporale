import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { MutualAidItemScreen } from "@/screens/mutual-aid-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("mutualAid.meta.item") }
}

/** `/entraide/<id>` — une question (réponses, réponse retenue) ou une mission bénévole ; indisponible, un état neutre. */
export default async function MutualAidItemPage(props: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await props.params
  return <MutualAidItemScreen itemId={itemId} />
}
