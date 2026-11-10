"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Card, Label, RadioCard, RadioGroup, Skeleton, Switch, formatDate } from "@diasporale/features"
import {
  DND_DURATIONS,
  OUTSIDE_RELATIONS_CALLS,
  dndUntilFor,
  useCallSettings,
  useDataSource,
  type CallPreferencesPatch,
  type CallSettingsCapability,
  type CallSettingsView,
  type DndDuration,
  type MembershipView,
  type OutsideRelationsCalls,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { useId, useLayoutEffect, useMemo, useRef } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { callsAreOpen } from "@/lib/calls"

const preferencesSchema = z.object({
  outsideRelationsCalls: z.enum(OUTSIDE_RELATIONS_CALLS),
  voicemailEnabled: z.boolean(),
  sharePresence: z.boolean(),
  callWaiting: z.boolean(),
})
type PreferencesValues = z.infer<typeof preferencesSchema>

const dndSchema = z.object({ duration: z.enum(DND_DURATIONS) })
type DndValues = z.infer<typeof dndSchema>

/** Les deux choix de « qui peut m'appeler », chacun avec ce qu'il fait vraiment. */
const OUTSIDE_TEXTS: Readonly<Record<OutsideRelationsCalls, { readonly title: string; readonly hint: string }>> = {
  ring: { title: "settings.calls.outside.ring", hint: "settings.calls.outside.ringHint" },
  silent: { title: "settings.calls.outside.silent", hint: "settings.calls.outside.silentHint" },
}

/** Les interrupteurs, dans l'ordre d'affichage : chacun change ce que fait le serveur. */
const SWITCHES: readonly { readonly name: "voicemailEnabled" | "sharePresence" | "callWaiting"; readonly title: string; readonly hint: string }[] = [
  { name: "voicemailEnabled", title: "settings.calls.voicemail", hint: "settings.calls.voicemailHint" },
  { name: "sharePresence", title: "settings.calls.presence", hint: "settings.calls.presenceHint" },
  { name: "callWaiting", title: "settings.calls.callWaiting", hint: "settings.calls.callWaitingHint" },
]

const DND_LABELS: Readonly<Record<DndDuration, string>> = {
  oneHour: "settings.calls.dnd.oneHour",
  eightHours: "settings.calls.dnd.eightHours",
  oneDay: "settings.calls.dnd.oneDay",
  sevenDays: "settings.calls.dnd.sevenDays",
}

/** Les seuls réglages touchés par la personne partent au moteur : les autres restent tels quels. */
function changedPreferences(values: PreferencesValues, saved: PreferencesValues): CallPreferencesPatch {
  return {
    ...(values.outsideRelationsCalls !== saved.outsideRelationsCalls ? { outsideRelationsCalls: values.outsideRelationsCalls } : {}),
    ...(values.voicemailEnabled !== saved.voicemailEnabled ? { voicemailEnabled: values.voicemailEnabled } : {}),
    ...(values.sharePresence !== saved.sharePresence ? { sharePresence: values.sharePresence } : {}),
    ...(values.callWaiting !== saved.callWaiting ? { callWaiting: values.callWaiting } : {}),
  }
}

/** Un geste en attente ne parle plus si la section a disparu (changement de personne, navigation). */
function useMounted() {
  const mounted = useRef(false)
  useLayoutEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  return mounted
}

/**
 * « Messages et appels » (IM-02) : les réglages d'appel et de présence de la personne, ceux
 * de son compte commun — ils valent aussi dans ANTSIA. Seuls les réglages qui ont un effet
 * réel côté serveur sont montrés ; tant que DIASPORALE ne propose pas d'appel (IM-01), la
 * section le dit, sans rien promettre.
 */
export function CallSettings({ membership }: { membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const capability = useCallSettings()
  const demo = useDataSource().kind === "demo"
  const titleId = useId()
  if (!capability) return null
  return (
    <section id="messages-et-appels" aria-labelledby={titleId} className="scroll-mt-20">
      <Card className="flex min-w-0 flex-col gap-4 p-5">
        <div>
          <h2 id={titleId} className="font-display text-xl font-bold">{t("settings.calls.title")}</h2>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{t("settings.calls.lead")}</p>
        </div>
        {callsAreOpen() ? null : <p className="rounded-lg bg-muted px-3 py-2 text-[13px] leading-snug">{t("settings.calls.notOffered")}</p>}
        {demo ? <p className="rounded-lg bg-muted px-3 py-2 text-[13px] leading-snug">{t("settings.calls.demoNotice")}</p> : null}
        <CallSettingsBody key={membership.personId} personId={membership.personId} capability={capability} />
      </Card>
    </section>
  )
}

function CallSettingsBody(props: { personId: string; capability: CallSettingsCapability }) {
  const { t } = useDiasporaleT()
  const settings = props.capability.useMine(props.personId)
  if (settings.status === "loading") {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (settings.status === "error") return <p role="alert" className="text-sm">{t(`errors.${settings.code}`)}</p>
  return (
    <>
      <DoNotDisturb personId={props.personId} capability={props.capability} dndUntil={settings.data.dndUntil} />
      <PreferencesForm personId={props.personId} capability={props.capability} view={settings.data} />
    </>
  )
}

/** « Ne pas déranger » : un silence daté, posé ou levé d'un geste ; sept jours au plus (moteur : `setDnd`). */
function DoNotDisturb(props: { personId: string; capability: CallSettingsCapability; dndUntil: number | null }) {
  const { t, locale } = useDiasporaleT()
  const ids = useId()
  const mounted = useMounted()
  const form = useForm<DndValues>({ resolver: zodResolver(dndSchema), defaultValues: { duration: "oneHour" } })
  const apply = async (until: number | null) => {
    const result = await props.capability.setDoNotDisturb(props.personId, until)
    if (!mounted.current) return
    if (!result.ok) {
      toast.error(t(`errors.${result.code}`))
      return
    }
    toast.success(t(until === null ? "settings.calls.dnd.disabled" : "settings.calls.dnd.enabled"))
  }
  const onSubmit = form.handleSubmit(async (values) => {
    // L'échéance se calcule au geste, jamais à l'affichage : une page ouverte depuis longtemps ne pose pas un silence déjà entamé.
    await apply(dndUntilFor(values.duration, Date.now()))
  })
  return (
    <div role="group" aria-labelledby={`${ids}-titre`} aria-describedby={`${ids}-aide`} className="flex flex-col gap-3 border-t border-border pt-4">
      <div>
        <p id={`${ids}-titre`} className="text-[15px] font-semibold">{t("settings.calls.dnd.title")}</p>
        <p id={`${ids}-aide`} className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{t("settings.calls.dnd.hint")}</p>
      </div>
      {props.dndUntil !== null ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm font-medium" role="status">
            {t("settings.calls.dnd.active", { date: formatDate(props.dndUntil, locale, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) })}
          </p>
          <Button type="button" variant="outline" disabled={form.formState.isSubmitting} onClick={() => void form.handleSubmit(() => apply(null))()}>
            {t("settings.calls.dnd.disable")}
          </Button>
        </div>
      ) : (
        <form noValidate onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={`${ids}-duree`}>{t("settings.calls.dnd.duration")}</Label>
            <select
              id={`${ids}-duree`}
              className="h-11 rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus"
              {...form.register("duration")}
            >
              {DND_DURATIONS.map((duration) => (
                <option key={duration} value={duration}>
                  {t(DND_LABELS[duration])}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t("common.pleaseWait") : t("settings.calls.dnd.enable")}
          </Button>
        </form>
      )}
    </div>
  )
}

/** Qui peut m'appeler, la messagerie vocale, la présence et le double appel (moteur : `update`). */
function PreferencesForm(props: { personId: string; capability: CallSettingsCapability; view: CallSettingsView }) {
  const { t } = useDiasporaleT()
  const ids = useId()
  const mounted = useMounted()
  const { outsideRelationsCalls, voicemailEnabled, sharePresence, callWaiting } = props.view
  const saved = useMemo<PreferencesValues>(
    () => ({ outsideRelationsCalls, voicemailEnabled, sharePresence, callWaiting }),
    [outsideRelationsCalls, voicemailEnabled, sharePresence, callWaiting],
  )
  // Les valeurs du serveur suivent la lecture réactive ; un choix en cours n'est jamais écrasé.
  const form = useForm<PreferencesValues>({ resolver: zodResolver(preferencesSchema), values: saved, resetOptions: { keepDirtyValues: true } })
  const onSubmit = form.handleSubmit(async (values) => {
    const patch = changedPreferences(values, saved)
    if (Object.keys(patch).length === 0) return
    const result = await props.capability.update(props.personId, patch)
    if (!mounted.current) return
    if (!result.ok) {
      toast.error(t(`errors.${result.code}`))
      return
    }
    form.reset(values)
    toast.success(t("settings.saved"))
  })
  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4 border-t border-border pt-4">
      <div className="flex flex-col gap-2">
        <p id={`${ids}-qui`} className="text-[15px] font-semibold">{t("settings.calls.who")}</p>
        <Controller
          control={form.control}
          name="outsideRelationsCalls"
          render={({ field }) => (
            <RadioGroup aria-labelledby={`${ids}-qui`} value={field.value} onValueChange={field.onChange}>
              {OUTSIDE_RELATIONS_CALLS.map((option) => (
                <RadioCard key={option} value={option} aria-label={t(OUTSIDE_TEXTS[option].title)} aria-describedby={`${ids}-${option}`}>
                  <span className="block text-sm font-medium">{t(OUTSIDE_TEXTS[option].title)}</span>
                  <span id={`${ids}-${option}`} className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                    {t(OUTSIDE_TEXTS[option].hint)}
                  </span>
                </RadioCard>
              ))}
            </RadioGroup>
          )}
        />
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {SWITCHES.map((row) => (
          <li key={row.name} className="flex items-start gap-4 py-3">
            <div className="min-w-0 flex-1">
              <Label htmlFor={`${ids}-${row.name}`} className="text-[15px] font-semibold">{t(row.title)}</Label>
              <p id={`${ids}-${row.name}-aide`} className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{t(row.hint)}</p>
            </div>
            <Controller
              control={form.control}
              name={row.name}
              render={({ field }) => (
                <Switch id={`${ids}-${row.name}`} aria-describedby={`${ids}-${row.name}-aide`} checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </li>
        ))}
      </ul>
      <Button type="submit" className="self-start" disabled={!form.formState.isDirty || form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t("common.pleaseWait") : t("common.save")}
      </Button>
    </form>
  )
}
