import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { PageManageScreen, type PageManageTab } from "@/screens/page-admin-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("pageAdmin.manage.metaTitle") }
}

const TABS: readonly PageManageTab[] = ["identite", "equipe", "revendications", "publications", "services", "demandes", "avis", "emplois", "decisions"]

/** L'onglet porté par l'adresse (`?onglet=`), ou l'identité. */
function tabOf(raw: string | string[] | undefined): PageManageTab {
  const value = Array.isArray(raw) ? raw[0] : raw
  return TABS.find((tab) => tab === value) ?? "identite"
}

export default async function PageManagePage(props: {
  params: Promise<{ handle: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ handle }, search] = await Promise.all([props.params, props.searchParams])
  return (
    <Suspense fallback={<GateSkeleton />}>
      <PageManageScreen handle={handle} tab={tabOf(search.onglet)} />
    </Suspense>
  )
}
