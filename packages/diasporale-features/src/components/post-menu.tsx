"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { BookmarkCheckIcon, BookmarkIcon, EyeOffIcon, FlagIcon, MoreHorizontalIcon, Trash2Icon, VolumeXIcon, type LucideIcon } from "lucide-react"
import { DropdownMenu } from "radix-ui"
import { useId, useState, type ReactNode } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { useActions } from "../data/context"
import { REPORT_NOTE_MAX, REPORT_REASONS, type PostView } from "../data/types"
import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"
import { Button } from "../primitives/button"
import { Field, Textarea } from "../primitives/field"
import { RadioCard, RadioGroup } from "../primitives/radio-group"
import { Sheet, SheetContent } from "../primitives/sheet"

/**
 * Le menu « … » d'une publication (EXF-DG-12) : l'enregistrer, la masquer pour
 * soi, mettre son auteur en sourdine, la signaler — ou retirer la sienne. Tout
 * est privé : l'auteur n'apprend ni le signet, ni le masquage, ni la sourdine.
 */
export function PostMenu(props: { post: PostView }) {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const [reporting, setReporting] = useState(false)
  const [removing, setRemoving] = useState(false)
  const { post } = props
  const person = post.author.kind === "person" && !post.isMine ? post.author : null

  const bookmark = async () => {
    const result = await actions.toggleBookmark(post.id)
    if (!result.ok) toast.error(t(`errors.${result.code}`))
    else toast.success(result.value.bookmarked ? t("postMenu.bookmarked") : t("postMenu.unbookmarked"))
  }
  const hide = async () => {
    const result = await actions.hidePost(post.id)
    if (result.ok) toast.success(t("postMenu.hidden"))
    else toast.error(t(`errors.${result.code}`))
  }
  const mute = async (personId: string, name: string) => {
    const result = await actions.muteAuthor(personId)
    if (result.ok) toast.success(t("postMenu.muted", { name }))
    else toast.error(t(`errors.${result.code}`))
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label={t("postMenu.open")}
          className="-mr-1 -mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:shadow-focus"
        >
          <MoreHorizontalIcon className="size-5" aria-hidden />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-60 rounded-xl bg-popover p-1.5 text-popover-foreground shadow-float">
            <MenuItem icon={post.bookmarked ? BookmarkCheckIcon : BookmarkIcon} onSelect={bookmark}>
              {post.bookmarked ? t("postMenu.unbookmark") : t("postMenu.bookmark")}
            </MenuItem>
            {post.isMine ? (
              <MenuItem icon={Trash2Icon} tone="danger" onSelect={() => setRemoving(true)}>
                {t("postMenu.remove")}
              </MenuItem>
            ) : (
              <>
                <MenuItem icon={EyeOffIcon} onSelect={hide}>
                  {t("postMenu.hide")}
                </MenuItem>
                {person ? (
                  <MenuItem icon={VolumeXIcon} onSelect={() => mute(person.id, person.displayName)}>
                    {t("postMenu.mute", { name: person.displayName })}
                  </MenuItem>
                ) : null}
                <MenuItem icon={FlagIcon} tone="danger" onSelect={() => setReporting(true)}>
                  {t("postMenu.report")}
                </MenuItem>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {post.isMine ? <RemovePostSheet postId={post.id} open={removing} onOpenChange={setRemoving} /> : <ReportPostSheet postId={post.id} open={reporting} onOpenChange={setReporting} />}
    </>
  )
}

function MenuItem(props: { icon: LucideIcon; tone?: "danger"; onSelect: () => void; children: ReactNode }) {
  const Icon = props.icon
  return (
    <DropdownMenu.Item
      onSelect={props.onSelect}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none data-[highlighted]:bg-muted",
        props.tone === "danger" && "text-destructive",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {props.children}
    </DropdownMenu.Item>
  )
}

const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS, { message: "report_reason_required" }),
  note: z.string().trim().max(REPORT_NOTE_MAX, "report_note_too_long"),
})
type ReportValues = z.infer<typeof reportSchema>

/** Signaler : un motif parmi six, une précision facultative ; la publication se masque aussitôt pour soi. */
function ReportPostSheet(props: { postId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const ids = useId()
  const form = useForm<ReportValues>({ resolver: zodResolver(reportSchema), defaultValues: { note: "" } })
  const reasonError = form.formState.errors.reason?.message
  const noteError = form.formState.errors.note?.message

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await actions.reportPost({ postId: props.postId, reason: values.reason, ...(values.note ? { note: values.note } : {}) })
    if (!result.ok) {
      toast.error(t(`errors.${result.code}`))
      return
    }
    toast.success(t("report.sent"))
    form.reset({ note: "" })
    props.onOpenChange(false)
  })

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent title={t("report.title")} description={t("report.description")} closeLabel={t("report.close")}>
        <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("report.reasonLegend")}</legend>
            <Controller
              control={form.control}
              name="reason"
              render={({ field }) => (
                <RadioGroup
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  aria-label={t("report.reasonLegend")}
                  aria-invalid={reasonError ? true : undefined}
                  aria-describedby={reasonError ? `${ids}-motif` : undefined}
                >
                  {REPORT_REASONS.map((reason) => (
                    <RadioCard key={reason} value={reason}>
                      <span className="text-sm">{t(`report.reason.${reason}`)}</span>
                    </RadioCard>
                  ))}
                </RadioGroup>
              )}
            />
            {reasonError ? (
              <p id={`${ids}-motif`} role="alert" className="text-[13px] font-medium text-destructive">
                {t(`errors.${reasonError}`)}
              </p>
            ) : null}
          </fieldset>
          <Field id={`${ids}-note`} label={t("report.noteLabel")} hint={t("report.noteHint")} error={noteError ? t(`errors.${noteError}`) : undefined}>
            {(control) => (
              <Textarea
                id={control.id}
                rows={3}
                maxLength={REPORT_NOTE_MAX}
                aria-describedby={control.describedBy}
                aria-invalid={control.invalid || undefined}
                {...form.register("note")}
              />
            )}
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>
              {t("report.cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={form.formState.isSubmitting}>
              <FlagIcon aria-hidden />
              {t("report.send")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/** Retirer SA publication : un second geste, explicite. */
function RemovePostSheet(props: { postId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setBusy(true)
    const result = await actions.removePost(props.postId)
    setBusy(false)
    if (!result.ok) {
      toast.error(t(`errors.${result.code}`))
      return
    }
    toast.success(t("removePost.done"))
    props.onOpenChange(false)
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent title={t("removePost.title")} description={t("removePost.description")} closeLabel={t("removePost.close")}>
        <div className="flex flex-wrap justify-end gap-2 px-5 py-4">
          <Button variant="ghost" disabled={busy} onClick={() => props.onOpenChange(false)}>
            {t("removePost.cancel")}
          </Button>
          <Button variant="destructive" disabled={busy} onClick={confirm}>
            <Trash2Icon aria-hidden />
            {t("removePost.confirm")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
