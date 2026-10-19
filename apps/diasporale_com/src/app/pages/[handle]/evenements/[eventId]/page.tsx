import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { AssociationActivitiesScreen } from "@/screens/association-activities-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("associationActivities.event.metaTitle") }
}

export default async function AssociationEventPage(props: { params: Promise<{ handle: string; eventId: string }> }) {
  const { handle, eventId } = await props.params
  return <AssociationActivitiesScreen handle={handle} eventId={eventId} />
}
