"use client"

import { Button, PostComposerSheet, Sheet, SheetContent } from "@diasporale/features"
import {
  useOpenCountries,
  useOptionalDataSource,
  type MembershipView,
  type PagePublicationsCapability,
  type PageView,
  type PageViewerRole,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { PenSquareIcon, Trash2Icon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

/** L'autorité est celle de la fiche réactive ; le moteur la relit à l'envoi. */
export function PagePublishButton(props: { page: PageView; membership: MembershipView; role: PageViewerRole | null }) {
  const capability = useOptionalDataSource()?.pagePublications
  if (!capability || !props.membership.canPublish || props.role === null) return null
  return <PagePublisher key={`${props.membership.personId}:${props.page.id}`} {...props} capability={capability} />
}

function PagePublisher(props: { page: PageView; membership: MembershipView; capability: PagePublicationsCapability }) {
  const { t } = useDiasporaleT()
  const countries = useOpenCountries()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" className="h-auto min-h-11 max-w-full whitespace-normal py-2 text-left" onClick={() => setOpen(true)}>
        <PenSquareIcon aria-hidden />
        <span className="min-w-0 break-words">{t("pagePublications.publishAs", { name: props.page.name })}</span>
      </Button>
      <PostComposerSheet
        open={open}
        onOpenChange={setOpen}
        memberCountry={props.page.country ?? props.membership.facet.countryOfResidence}
        openCountries={countries.status === "ready" ? countries.data.map((row) => row.country) : []}
        draftKey={`diasporale:brouillon:${props.membership.personId}:page:${props.page.id}`}
        page={{ id: props.page.id, name: props.page.name, country: props.page.country, publish: props.capability.publish }}
      />
    </>
  )
}

/** Un retrait collectif exige un second geste ; aucun rôle personnel n'est créé. */
export function PagePostRemoveButton(props: { pageId: string; postId: string; capability: PagePublicationsCapability }) {
  const { t } = useDiasporaleT()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const confirm = async () => {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    try {
      const result = await props.capability.remove({ pageId: props.pageId, postId: props.postId })
      if (!mounted.current) return
      if (!result.ok) toast.error(t(`errors.${result.code}`))
      else {
        toast.success(t("pagePublications.removed"))
        setOpen(false)
      }
    } catch {
      if (mounted.current) toast.error(t("errors.unknown"))
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <div className="flex justify-end">
      <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setOpen(true)}>
        <Trash2Icon aria-hidden />
        {t("pagePublications.remove")}
      </Button>
      <Sheet open={open} onOpenChange={(next) => { if (!locked.current) setOpen(next) }}>
        <SheetContent title={t("pagePublications.removeTitle")} description={t("pagePublications.removeDescription")} closeLabel={t("common.close")}>
          <div className="flex flex-wrap justify-end gap-2" aria-busy={busy}>
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="destructive" disabled={busy} onClick={() => void confirm()}>
              <Trash2Icon aria-hidden />
              {t("pagePublications.removeConfirm")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
