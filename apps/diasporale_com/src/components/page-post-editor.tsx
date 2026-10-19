"use client"

import { Button, Field, POST_BODY_MAX, Sheet, SheetContent, SheetTrigger, Textarea } from "@diasporale/features"
import { ACTION_ERROR_CODES, type ActionErrorCode, type PagePublicationsCapability, type PostView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { PencilIcon } from "lucide-react"
import { type FormEvent, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

type EditPagePost = NonNullable<PagePublicationsCapability["edit"]>

interface PagePostEditProps {
  readonly pageId: string
  readonly post: PostView
  readonly edit: EditPagePost
}

interface ReadVersion {
  readonly body: string
  readonly editedAt: number | null
}

interface EditAttempt extends ReadVersion {
  readonly key: number
}

const editErrors: ReadonlySet<string> = new Set(ACTION_ERROR_CODES)

function closedError(code: unknown): ActionErrorCode {
  return typeof code === "string" && editErrors.has(code) ? (code as ActionErrorCode) : "unknown"
}

/** Le mandat est relu par le moteur ; cette feuille ne modifie que le texte. */
export function PagePostEditButton(props: PagePostEditProps) {
  if (props.post.eventGalleryId !== undefined) return null
  return <PagePostEditor key={`${props.pageId}:${props.post.id}`} {...props} />
}

function PagePostEditor(props: PagePostEditProps) {
  const { t } = useDiasporaleT()
  const sequence = useRef(0)
  const activeAttempt = useRef<number | null>(null)
  const [attempt, setAttempt] = useState<EditAttempt | null>(null)

  useLayoutEffect(() => () => { activeAttempt.current = null }, [])

  const changeOpen = (open: boolean) => {
    if (!open) {
      // Invalider aussi les retours reçus avant le démontage effectif de la feuille.
      activeAttempt.current = null
      setAttempt(null)
      return
    }
    if (activeAttempt.current !== null) return
    const key = ++sequence.current
    activeAttempt.current = key
    setAttempt({ key, body: props.post.body, editedAt: props.post.editedAt ?? null })
  }

  return (
    <Sheet open={attempt !== null} onOpenChange={changeOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="h-auto min-h-11 max-w-full whitespace-normal py-2 text-left">
          <PencilIcon aria-hidden />
          <span className="min-w-0 break-words">{t("pagePostEditing.open")}</span>
        </Button>
      </SheetTrigger>
      {attempt ? (
        <SheetContent
          key={attempt.key}
          title={<span className="break-words [overflow-wrap:anywhere]">{t("pagePostEditing.title", { name: props.post.author.displayName })}</span>}
          description={<span className="break-words [overflow-wrap:anywhere]">{t("pagePostEditing.description", { name: props.post.author.displayName })}</span>}
          closeLabel={t("common.close")}
        >
          <PagePostEditForm
            key={attempt.key}
            {...props}
            initial={attempt}
            isCurrent={() => activeAttempt.current === attempt.key}
            onClose={() => changeOpen(false)}
          />
        </SheetContent>
      ) : null}
    </Sheet>
  )
}

function PagePostEditForm(props: PagePostEditProps & {
  readonly initial: ReadVersion
  readonly isCurrent: () => boolean
  readonly onClose: () => void
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const locked = useRef(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<ActionErrorCode | null>(null)
  // Cette version ne change qu'à l'ouverture ou après le geste explicite de remplacement.
  const [version, setVersion] = useState<ReadVersion>(props.initial)
  const hasMedia = props.post.media.length > 0
  const schema = useMemo(() => z.object({
    body: z.string().trim().max(POST_BODY_MAX, "post_too_long").refine((body) => body.length > 0 || hasMedia, "post_empty"),
  }), [hasMedia])
  const form = useForm<{ body: string }>({ resolver: zodResolver(schema), defaultValues: { body: props.initial.body } })
  const busy = pending || form.formState.isSubmitting
  const conflict = failure === "page_post_changed"
  const currentEditedAt = props.post.editedAt ?? null
  const hasCurrentVersion = props.post.body !== version.body || currentEditedAt !== version.editedAt
  const bodyError = form.formState.errors.body?.message

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // Le verrou précède la validation asynchrone du resolver, pas seulement l'appel d'écriture.
    if (locked.current || !props.isCurrent() || conflict) return
    locked.current = true
    setPending(true)
    setFailure(null)
    try {
      await form.handleSubmit(async (values) => {
        if (!props.isCurrent()) return
        const result = await props.edit({
          pageId: props.pageId,
          postId: props.post.id,
          body: values.body,
          expectedBody: version.body,
          expectedEditedAt: version.editedAt,
        })
        if (!props.isCurrent()) return
        if (!result.ok) {
          setFailure(closedError(result.code))
          return
        }
        toast.success(t("pagePostEditing.sent"))
        props.onClose()
      })(event)
    } catch {
      if (props.isCurrent()) setFailure("unknown")
    } finally {
      locked.current = false
      if (props.isCurrent()) setPending(false)
    }
  }

  const replaceDraft = () => {
    if (locked.current || !props.isCurrent() || !conflict || !hasCurrentVersion) return
    const current = { body: props.post.body, editedAt: currentEditedAt }
    setVersion(current)
    form.reset({ body: current.body })
    setFailure(null)
    form.setFocus("body")
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex min-w-0 flex-col gap-4" aria-busy={busy}>
      <Field
        id={`${id}-body`}
        label={t("pagePostEditing.body")}
        hint={t(hasMedia ? "pagePostEditing.mediaHint" : "pagePostEditing.textHint", { max: POST_BODY_MAX })}
        error={bodyError ? t(`errors.${closedError(bodyError)}`) : undefined}
      >
        {(control) => (
          <Textarea
            id={control.id}
            rows={6}
            maxLength={POST_BODY_MAX}
            disabled={busy}
            aria-describedby={control.describedBy}
            aria-invalid={control.invalid || undefined}
            {...form.register("body")}
          />
        )}
      </Field>
      {failure ? (
        <div role="alert" className="flex min-w-0 flex-col gap-3 rounded-md border border-border p-3">
          <p className="text-sm text-destructive">{t(`errors.${failure}`)}</p>
          {conflict ? (
            <>
              <p className="text-sm text-muted-foreground">{t("pagePostEditing.draftKept")}</p>
              {hasCurrentVersion ? (
                <>
                  <p className="text-sm text-muted-foreground">{t("pagePostEditing.replaceWarning")}</p>
                  <Button variant="outline" className="h-auto min-h-11 max-w-full whitespace-normal py-2" disabled={busy} onClick={replaceDraft}>
                    {t("pagePostEditing.replaceDraft")}
                  </Button>
                </>
              ) : <p role="status" className="text-sm text-muted-foreground">{t("pagePostEditing.waitForUpdate")}</p>}
            </>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" className="min-h-11" onClick={props.onClose}>{t("common.cancel")}</Button>
        <Button type="submit" className="h-auto min-h-11 whitespace-normal py-2" disabled={busy || conflict} aria-busy={busy}>
          <PencilIcon aria-hidden />
          {t(busy ? "common.pleaseWait" : "pagePostEditing.save")}
        </Button>
      </div>
    </form>
  )
}
