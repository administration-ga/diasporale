import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { JobOfferScreen } from "@/screens/jobs-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("jobs.meta.offer") }
}

/** `/emploi/<id>` — la fiche d'une offre d'emploi ; indisponible, un état neutre. */
export default async function JobOfferPage(props: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await props.params
  return <JobOfferScreen jobId={jobId} />
}
