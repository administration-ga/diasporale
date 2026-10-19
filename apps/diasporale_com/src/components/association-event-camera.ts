"use client"

/** Caméra locale facultative : aucun cliché, aucun envoi et aucun pointage. */
import { parseAssociationEventAttendanceCode } from "@diasporale/domain"
import { useCallback, useLayoutEffect, useRef, useState } from "react"

interface QrDetector {
  detect(source: HTMLVideoElement): Promise<readonly { readonly rawValue?: string }[]>
}
interface QrDetectorConstructor {
  new(options: { readonly formats: readonly string[] }): QrDetector
  getSupportedFormats(): Promise<readonly string[]>
}
export type AttendanceCameraError = "unavailable" | "denied" | "failed" | "invalidCode"

export function useAttendanceCamera(onCode: (code: string) => void) {
  const video = useRef<HTMLVideoElement | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generation = useRef(0)
  const alive = useRef(false)
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode
  const [state, setState] = useState<"idle" | "starting" | "active">("idle")
  // L'échec de la caméra n'est pas un code d'erreur de formulaire : son setter ne s'appelle pas `set…Error`.
  const [error, setFailure] = useState<AttendanceCameraError | null>(null)

  const stop = useCallback(() => {
    generation.current += 1
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    if (video.current) video.current.srcObject = null
    if (alive.current) setState("idle")
  }, [])

  useLayoutEffect(() => {
    alive.current = true
    const hidden = () => { if (document.hidden) stop() }
    document.addEventListener("visibilitychange", hidden)
    window.addEventListener("pagehide", stop)
    return () => {
      alive.current = false
      stop()
      document.removeEventListener("visibilitychange", hidden)
      window.removeEventListener("pagehide", stop)
    }
  }, [stop])

  async function start() {
    stop()
    if (!alive.current || document.hidden) return
    const attempt = generation.current
    const current = () => alive.current && generation.current === attempt && !document.hidden
    setFailure(null)
    setState("starting")
    const Detector = (globalThis as typeof globalThis & { readonly BarcodeDetector?: QrDetectorConstructor }).BarcodeDetector
    if (!Detector || typeof Detector.getSupportedFormats !== "function" || typeof navigator.mediaDevices?.getUserMedia !== "function") {
      setFailure("unavailable"); stop(); return
    }
    try {
      const formats = await Detector.getSupportedFormats()
      if (!current()) return
      if (!formats.includes("qr_code")) { setFailure("unavailable"); stop(); return }
      const detector = new Detector({ formats: ["qr_code"] })
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } })
      if (!current()) { acquired.getTracks().forEach((track) => track.stop()); return }
      stream.current = acquired
      const element = video.current
      if (!element) { stop(); return }
      element.srcObject = acquired
      await element.play()
      if (!current()) return
      setState("active")
      const scan = async () => {
        if (!current()) return
        try {
          if (element.readyState >= 2) {
            const results = await detector.detect(element)
            if (!current()) return
            const raw = results.find((result) => typeof result.rawValue === "string")?.rawValue
            if (raw !== undefined) {
              const code = parseAssociationEventAttendanceCode(raw)
              stop()
              if (code) onCodeRef.current(code)
              else setFailure("invalidCode")
              return
            }
          }
          if (current()) timer.current = setTimeout(() => { void scan() }, 200)
        } catch {
          if (current()) { setFailure("failed"); stop() }
        }
      }
      void scan()
    } catch (cause) {
      if (!current()) return
      const denied = cause instanceof Error && (cause.name === "NotAllowedError" || cause.name === "SecurityError")
      setFailure(denied ? "denied" : "failed")
      stop()
    }
  }
  return { video, state, error, start, stop }
}
