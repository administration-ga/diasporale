import { MEMBER_CREATABLE_PAGE_KINDS } from "@diasporale/domain"
import type { MemberPageKind } from "@diasporale/features/data"
import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { NewPageScreen } from "@/screens/page-admin-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("pageAdmin.create.metaTitle") }
}

/** `?type=association|company` (ou `media`, `community`) présélectionne la nature ; toute autre valeur est ignorée. */
function kindOf(raw: string | string[] | undefined): MemberPageKind | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  return value !== undefined && (MEMBER_CREATABLE_PAGE_KINDS as readonly string[]).includes(value) ? (value as MemberPageKind) : null
}

export default async function NewPagePage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await props.searchParams
  return (
    <Suspense fallback={<GateSkeleton />}>
      <NewPageScreen kind={kindOf(params.type)} />
    </Suspense>
  )
}
