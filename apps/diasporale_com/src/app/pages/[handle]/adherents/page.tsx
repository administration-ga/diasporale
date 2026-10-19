import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { AssociationMembersScreen } from "@/screens/association-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("associations.members.metaTitle") }
}

/** `/pages/[handle]/adherents` — les demandes et adhérents d'une association, pour ses responsables (DG-010). */
export default async function AssociationMembersPage(props: { params: Promise<{ handle: string }> }) {
  const { handle } = await props.params
  return <AssociationMembersScreen handle={handle} />
}
