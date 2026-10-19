import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { MentorProfileScreen } from "@/screens/mentoring-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("mentoring.meta.profile") }
}

/** `/mentorat/<id>` — la fiche d'un mentor bénévole et « Demander un mentorat ». */
export default async function MentorProfilePage(props: { params: Promise<{ mentorId: string }> }) {
  const { mentorId } = await props.params
  return <MentorProfileScreen mentorId={mentorId} />
}
