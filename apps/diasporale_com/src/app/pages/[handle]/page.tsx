import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { PageScreen } from "@/screens/page-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("page.metaTitle") }
}

export default async function OrganizationPage(props: { params: Promise<{ handle: string }> }) {
  const { handle } = await props.params
  return <PageScreen handle={handle} />
}
