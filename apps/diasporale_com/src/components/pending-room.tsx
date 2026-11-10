"use client"

import { OpaqueQrCode } from "@antsia/social-features/qr"
import { Button, Field, Input } from "@diasporale/features"
import type { MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { BadgeCheckIcon, CopyIcon, HandshakeIcon, QrCodeIcon, Share2Icon } from "lucide-react"
import NextLink from "next/link"
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"

import { routes } from "@/lib/routes"

/**
 * La salle d'attente d'un compte en attente (EA-10) : ce qu'il lit déjà, et les chemins qui
 * l'ouvrent AUJOURD'HUI — un parrainage, la vérification de son inscription consulaire.
 *
 *  · Le lien de demande de parrainage (`/parrainer?pour=<identifiant>`) se copie, se partage par
 *    la feuille du système quand le navigateur l'offre, ou se montre en code QR (composant local
 *    du moteur, aucune image distante). Il ne porte que l'identifiant PUBLIC : ni jeton, ni
 *    adresse, ni nom.
 *  · IDN n'est pas proposée : rattacher IDN à un compte déjà ouvert attend EA-09. On ne promet
 *    pas un chemin fermé.
 *  · Un seul bouton plein : copier le lien, de la famille sociale (se relier).
 */
function isAbort(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
}

export function PendingRoom(props: { membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const { handle } = props.membership
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const mounted = useRef(false)
  // L'adresse complète se compose dans le navigateur, avec son origine : jamais écrite en dur.
  const [link, setLink] = useState("")
  const [canShare, setCanShare] = useState(false)
  const [busy, setBusy] = useState<"copy" | "share" | null>(null)
  const [failure, setFailure] = useState<"copy" | "share" | null>(null)

  useEffect(() => {
    mounted.current = true
    setLink(new URL(routes.sponsorFor(handle), window.location.origin).href)
    setCanShare(typeof navigator.share === "function")
    return () => {
      mounted.current = false
    }
  }, [handle])

  const perform = async (kind: "copy" | "share") => {
    if (busy !== null || link.length === 0) return
    setBusy(kind)
    setFailure(null)
    try {
      if (kind === "copy") {
        await navigator.clipboard.writeText(link)
        toast.success(t("pendingRoom.copied"))
      } else {
        await navigator.share({ title: t("pendingRoom.shareTitle"), url: link })
      }
    } catch (error) {
      // Une feuille de partage refermée n'est pas un échec (une `DOMException`, qui n'hérite pas
      // toujours d'`Error` : on lit son nom).
      if (!mounted.current || (kind === "share" && isAbort(error))) return
      setFailure(kind)
      if (kind === "copy") {
        input.current?.focus()
        input.current?.select()
      }
    } finally {
      if (mounted.current) setBusy(null)
    }
  }

  return (
    <section aria-labelledby={`${id}-chemins`} className="flex flex-col gap-4">
      <h3 id={`${id}-chemins`} className="text-sm font-semibold">
        {t("pendingRoom.pathsTitle")}
      </h3>
      <ol className="flex flex-col gap-4">
        <li className="flex flex-col gap-3 rounded-xl bg-muted p-4">
          <div className="flex gap-3">
            <HandshakeIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">{t("pendingRoom.sponsorTitle")}</p>
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{t("settings.sponsorHelpPending")}</p>
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{t("pendingRoom.sponsorLink")}</p>
            </div>
          </div>
          <Field
            id={`${id}-lien`}
            label={t("pendingRoom.linkLabel")}
            hint={t("pendingRoom.linkPrivacy", { handle })}
            error={failure === "copy" ? t("pendingRoom.copyFailed") : undefined}
          >
            {(control) => (
              <Input
                ref={input}
                id={control.id}
                value={link}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
                aria-describedby={control.describedBy}
                aria-invalid={control.invalid || undefined}
                className="font-mono text-[13px]"
              />
            )}
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button variant="social" onClick={() => void perform("copy")} disabled={busy !== null || link.length === 0} aria-busy={busy === "copy" || undefined}>
              <CopyIcon aria-hidden />
              {t("pendingRoom.copy")}
            </Button>
            {canShare ? (
              <Button variant="secondary" onClick={() => void perform("share")} disabled={busy !== null || link.length === 0} aria-busy={busy === "share" || undefined}>
                <Share2Icon aria-hidden />
                {t("pendingRoom.share")}
              </Button>
            ) : null}
          </div>
          {failure === "share" ? (
            <p role="alert" className="text-[13px] font-medium text-destructive">
              {t("pendingRoom.shareFailed")}
            </p>
          ) : null}
          {link ? (
            <details className="min-w-0">
              <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md text-sm font-medium text-primary focus-visible:shadow-focus">
                <QrCodeIcon className="size-4" aria-hidden />
                {t("pendingRoom.showQr")}
              </summary>
              <div className="mt-3 flex flex-col items-start gap-2">
                <OpaqueQrCode value={link} title={t("pendingRoom.qrTitle")} size={176} />
                <p className="text-[13px] text-muted-foreground">{t("pendingRoom.qrHint")}</p>
              </div>
            </details>
          ) : null}
        </li>
        <li className="flex gap-3 rounded-xl bg-muted p-4">
          <BadgeCheckIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">{t("pendingRoom.attestationTitle")}</p>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{t("pendingRoom.attestationBody")}</p>
            <NextLink
              href={routes.attestation()}
              className="mt-2 inline-flex min-h-11 items-center rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:shadow-focus"
            >
              {t("status.verifyConsular")}
            </NextLink>
          </div>
        </li>
      </ol>
    </section>
  )
}
