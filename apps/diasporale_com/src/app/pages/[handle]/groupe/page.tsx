import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { AssociationActivitiesScreen } from "@/screens/association-activities-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("associationActivities.group.metaTitle") }
}

export default async function AssociationGroupPage(props: { params: Promise<{ handle: string }> }) {
  const { handle } = await props.params
  return <AssociationActivitiesScreen handle={handle} />
}
