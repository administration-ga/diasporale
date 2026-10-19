"use client"

import { Button, Field, Input, Sheet, SheetContent, SheetTrigger } from "@diasporale/features"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { CopyIcon, Share2Icon } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"

import { pageContentHref, pageContentLabelKey, type PageContentTab } from "@/lib/page-content"
import { routes } from "@/lib/routes"

interface PageShareButtonProps {
  readonly handle: string
  readonly name: string
  readonly content?: PageContentTab
}

/** Partager une adresse ne modifie ni la visibilité ni les droits d'accès à la page. */
export function PageShareButton(props: PageShareButtonProps) {
  return <PageShareSheet key={props.content === undefined ? props.handle : JSON.stringify([props.handle, props.content])} {...props} />
}

function PageShareSheet({ handle, name, content }: PageShareButtonProps) {
  const { t } = useDiasporaleT()
  const section = content === undefined ? null : t(pageContentLabelKey(content))
  const shareLabel = section === null ? t("pageSharing.openPage", { name }) : t("pageContentLinks.shareLabel", { section, name })
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const mounted = useRef(false)
  const pending = useRef(false)
  const generation = useRef(0)
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState("")
  const [nativeAvailable, setNativeAvailable] = useState(false)
  const [busy, setBusy] = useState<"copy" | "share" | null>(null)
  const [failure, setFailure] = useState<"copy" | "share" | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      generation.current += 1
    }
  }, [])

  const changeOpen = (next: boolean) => {
    generation.current += 1
    pending.current = false
    setBusy(null)
    setFailure(null)
    if (next) {
      const href = content === undefined ? routes.page(handle) : pageContentHref(handle, content)
      setLink(new URL(href, window.location.origin).href)
      setNativeAvailable(typeof navigator.share === "function")
    }
    setOpen(next)
  }

  const perform = async (kind: "copy" | "share") => {
    if (!mounted.current || pending.current || link.length === 0) return
    pending.current = true
    const current = ++generation.current
    const isCurrent = () => mounted.current && generation.current === current
    setBusy(kind)
    setFailure(null)
    try {
      if (kind === "copy") {
        await navigator.clipboard.writeText(link)
        if (isCurrent()) toast.success(t(content === undefined ? "pageSharing.copied" : "pageContentLinks.copied"))
      } else {
        await navigator.share({ title: content === undefined ? name : shareLabel, url: link })
      }
    } catch (error) {
      if (!isCurrent() || (kind === "share" && error instanceof Error && error.name === "AbortError")) return
      setFailure(kind)
      if (kind === "copy") {
        input.current?.focus()
        input.current?.select()
      }
    } finally {
      if (isCurrent()) {
        pending.current = false
        setBusy(null)
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-auto min-h-11 max-w-full whitespace-normal py-2 text-left" aria-label={shareLabel}>
          <Share2Icon aria-hidden />{t(content === undefined ? "pageSharing.open" : "pageContentLinks.share")}
        </Button>
      </SheetTrigger>
      <SheetContent
        title={t(content === undefined ? "pageSharing.title" : "pageContentLinks.title")}
        description={t(content === undefined ? "pageSharing.description" : "pageContentLinks.description")}
        closeLabel={t("common.close")}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          input.current?.focus()
          input.current?.select()
        }}
      >
        <div className="flex min-w-0 flex-col gap-4">
          {section === null ? <p className="break-words font-semibold text-foreground">{name}</p> : (
            <div className="min-w-0 space-y-1">
              <p className="break-words font-semibold text-foreground">{name}</p>
              <p className="break-words text-sm text-muted-foreground">{section}</p>
            </div>
          )}
          <p className="text-sm leading-relaxed text-muted-foreground">{t("pageSharing.accessNotice")}</p>
          <Field id={`${id}-link`} label={t(content === undefined ? "pageSharing.link" : "pageContentLinks.link")} error={failure === "copy" ? t("pageSharing.copyFailed") : undefined}>
            {(control) => (
              <Input
                ref={input}
                id={control.id}
                value={link}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
                aria-describedby={control.describedBy}
              />
            )}
          </Field>
          <Button onClick={() => void perform("copy")} disabled={busy !== null || link.length === 0} aria-busy={busy === "copy"}>
            <CopyIcon aria-hidden />{t("pageSharing.copyLink")}
          </Button>
          {nativeAvailable ? (
            <Button variant="secondary" className="h-auto min-h-11 whitespace-normal py-2" onClick={() => void perform("share")} disabled={busy !== null || link.length === 0} aria-busy={busy === "share"}>
              <Share2Icon aria-hidden />{t("pageSharing.nativeShare")}
            </Button>
          ) : null}
          {failure === "share" ? <p role="alert" className="text-sm text-destructive">{t(content === undefined ? "pageSharing.shareFailed" : "pageContentLinks.shareFailed")}</p> : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
