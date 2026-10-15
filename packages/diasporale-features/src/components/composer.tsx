"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { canAlsoPublishOnRoot, isCountryOpen, type CountryCode } from "@diasporale/domain"
import { GlobeIcon, SendIcon } from "lucide-react"
import { useEffect, useId } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { useActions } from "../data/context"
import { useDiasporaleT } from "../i18n/client"
import { countryName } from "../lib/countries"
import { Button } from "../primitives/button"
import { Checkbox } from "../primitives/checkbox"
import { Field, Label, Textarea } from "../primitives/field"
import { RadioCard, RadioGroup } from "../primitives/radio-group"
import { Sheet, SheetContent } from "../primitives/sheet"
import { CountryTag, ScopeTag } from "./country-tag"

export const POST_BODY_MAX = 2000

const composerSchema = z.object({
  body: z.string().trim().min(1, "post_empty").max(POST_BODY_MAX, "post_too_long"),
  reach: z.enum(["local", "diaspora"]),
  audience: z.enum(["public", "connections"]),
  alsoOnRoot: z.boolean(),
})
type ComposerValues = z.infer<typeof composerSchema>

const DEFAULTS: ComposerValues = { body: "", reach: "local", audience: "public", alsoOnRoot: false }

/**
 * Composeur en feuille (charte §8, EXF-DG-10/11). La portée est visible avant
 * l'envoi (le pays de l'auteur, ou toute la diaspora). La visibilité reste
 * `network` par défaut : « Publier aussi sur ANTIA » est un GESTE, désactivé
 * hors audience publique, expliqué en une ligne. La case naît décochée.
 */
export function PostComposerSheet(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberCountry: CountryCode
  openCountries: readonly CountryCode[]
}) {
  const { t, locale } = useDiasporaleT()
  const actions = useActions()
  const ids = useId()
  const form = useForm<ComposerValues>({ resolver: zodResolver(composerSchema), defaultValues: DEFAULTS })
  const audience = useWatch({ control: form.control, name: "audience" })
  const reach = useWatch({ control: form.control, name: "reach" })
  const body = useWatch({ control: form.control, name: "body" })
  const rootAllowed = canAlsoPublishOnRoot(audience)

  // Une audience restreinte ferme la case ANTIA : la valeur suit, jamais l'inverse.
  useEffect(() => {
    if (!rootAllowed) form.setValue("alsoOnRoot", false)
  }, [rootAllowed, form])

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await actions.publish({
      body: values.body,
      reach: values.reach,
      audience: values.audience,
      alsoOnRoot: values.alsoOnRoot,
      // Local : le pays du hub. Diaspora : le pays d'ORIGINE, en pastille dans les autres hubs (EXF-DG-16).
      country: props.memberCountry,
    })
    if (!result.ok) {
      toast.error(t(`errors.${result.code}`))
      return
    }
    toast.success(result.value.moderation === "published" ? t("composer.published") : t("composer.sentForReview"))
    form.reset(DEFAULTS)
    props.onOpenChange(false)
  })

  const countryLabel = countryName(props.memberCountry, locale)
  const reviewNotice = reach === "local" && !isCountryOpen(props.memberCountry, props.openCountries)
  const bodyError = form.formState.errors.body?.message

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent title={t("composer.title")} description={t("composer.description")} hideDescription closeLabel={t("common.close")}>
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <Field
            id={`${ids}-corps`}
            label={t("composer.bodyLabel")}
            error={bodyError ? t(`errors.${bodyError}`) : undefined}
            hint={t("composer.counter", { count: body.length, max: POST_BODY_MAX })}
          >
            {(control) => (
              <Textarea
                id={control.id}
                aria-describedby={control.describedBy}
                aria-invalid={control.invalid || undefined}
                rows={5}
                maxLength={POST_BODY_MAX + 200}
                placeholder={t("composer.placeholder", { country: countryLabel })}
                {...form.register("body")}
              />
            )}
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("composer.reachLegend")}</legend>
            <Controller
              control={form.control}
              name="reach"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} aria-label={t("composer.reachLegend")}>
                  <RadioCard value="local">
                    <span className="flex flex-wrap items-center gap-2">
                      <CountryTag country={props.memberCountry} />
                      <span className="text-sm">{t("composer.reachLocal", { country: countryLabel })}</span>
                    </span>
                  </RadioCard>
                  <RadioCard value="diaspora">
                    <span className="flex flex-wrap items-center gap-2">
                      <ScopeTag />
                      <span className="text-sm">{t("composer.reachDiaspora")}</span>
                    </span>
                  </RadioCard>
                </RadioGroup>
              )}
            />
            {reviewNotice ? <p className="text-[13px] text-pending-foreground">{t("composer.reviewNotice")}</p> : null}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("composer.audienceLegend")}</legend>
            <Controller
              control={form.control}
              name="audience"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} aria-label={t("composer.audienceLegend")}>
                  <RadioCard value="public">
                    <span className="text-sm">{t("composer.audiencePublic")}</span>
                  </RadioCard>
                  <RadioCard value="connections">
                    <span className="text-sm">{t("composer.audienceConnections")}</span>
                  </RadioCard>
                </RadioGroup>
              )}
            />
          </fieldset>

          <div className="flex items-start gap-3 rounded-lg bg-muted p-3">
            <Controller
              control={form.control}
              name="alsoOnRoot"
              render={({ field }) => (
                <Checkbox
                  id={`${ids}-antia`}
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  disabled={!rootAllowed}
                  aria-describedby={`${ids}-antia-aide`}
                  className="mt-0.5"
                />
              )}
            />
            <div className="min-w-0">
              <Label htmlFor={`${ids}-antia`} className="inline-flex items-center gap-1.5">
                <GlobeIcon className="size-4" aria-hidden />
                {t("composer.alsoOnRoot")}
              </Label>
              <p id={`${ids}-antia-aide`} className="mt-0.5 text-[13px] text-muted-foreground">
                {rootAllowed ? t("composer.alsoOnRootHint") : t("composer.alsoOnRootDisabled")}
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 -mx-5 -mb-4 flex justify-end gap-2 border-t border-border bg-card px-5 py-3">
            <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              <SendIcon aria-hidden />
              {form.formState.isSubmitting ? t("composer.publishing") : t("composer.publish")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
