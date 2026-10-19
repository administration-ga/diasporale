"use client"

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"

import { LIQUID_DEFAULTS, LiquidWordmarkEngine, type LiquidPointer } from "@/lib/liquid-wordmark/engine"
import { wordmarkLayout, type WordmarkLayout } from "@/lib/liquid-wordmark/particles"

/** L'assemblage d'entrée se joue une fois par session de navigation, pas à chaque page de la porte. */
const INTRO_STORAGE_KEY = "diasporale:porte:assemblage"
/** Délai au-delà duquel le texte réel revient si l'assemblage n'a pas commencé (police lente, GPU absent). */
const INTRO_GRACE_MS = 2500

function claimIntro(): boolean {
  try {
    if (window.sessionStorage.getItem(INTRO_STORAGE_KEY) !== null) return false
    window.sessionStorage.setItem(INTRO_STORAGE_KEY, "1")
    return true
  } catch {
    return true
  }
}

/**
 * Le mouvement n'est permis qu'avec WebGL2, sans mouvement réduit (charte §9 :
 * il coupe tout) ni contraste forcé (le texte réel prend alors les couleurs du système).
 */
function motionAllowed(): boolean {
  if (typeof window.matchMedia !== "function" || typeof WebGL2RenderingContext === "undefined") return false
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !window.matchMedia("(forced-colors: active)").matches
}

function lowPowerDevice(): boolean {
  const withMemory = navigator as Navigator & { deviceMemory?: number }
  return (navigator.hardwareConcurrency || 8) <= 4 || (withMemory.deviceMemory ?? 8) <= 4 || window.matchMedia("(pointer: coarse)").matches
}

/** Le mot-symbole tramé comme le navigateur l'affiche : même police, même couleur, même interlettrage. */
function rasterize(content: string, style: CSSStyleDeclaration, layout: WordmarkLayout, box: DOMRect, scale: number) {
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(layout.frame.w * scale))
  canvas.height = Math.max(1, Math.round(layout.frame.h * scale))
  const context = canvas.getContext("2d")
  if (!context) throw new Error("2d")
  context.scale(scale, scale)
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  context.fillStyle = style.color
  context.textBaseline = "alphabetic"
  const spacing = Number.parseFloat(style.letterSpacing)
  const tracked = Number.isFinite(spacing) && spacing !== 0
  const canTrack = "letterSpacing" in context
  if (tracked && canTrack) context.letterSpacing = `${spacing}px`
  const text = style.textTransform === "uppercase" ? content.toLocaleUpperCase() : content
  const metrics = context.measureText(text)
  const ascent = Number.isFinite(metrics.fontBoundingBoxAscent) ? metrics.fontBoundingBoxAscent : metrics.actualBoundingBoxAscent
  const descent = Number.isFinite(metrics.fontBoundingBoxDescent) ? metrics.fontBoundingBoxDescent : metrics.actualBoundingBoxDescent
  // La ligne de base de la boîte en ligne : sa zone de contenu, centrée dans la boîte.
  const baseline = layout.pad.y + (box.height - (ascent + descent)) / 2 + ascent
  // Sans interlettrage sur le canevas (navigateur ancien), le mot est ramené à sa largeur mesurée.
  const stretch = tracked && !canTrack && metrics.width > 0 ? box.width / metrics.width : 1
  context.translate(layout.pad.x, 0)
  context.scale(stretch, 1)
  context.fillText(text, 0, baseline)
  return canvas
}

interface MountOptions {
  readonly wrapper: HTMLElement
  readonly stage: HTMLElement
  readonly label: HTMLElement
  readonly area: HTMLElement
  readonly content: string
  readonly intro: boolean
  readonly onIntroShown: () => void
}

/** Monte le moteur sur un canevas neuf (un contexte WebGL libéré ne se réutilise jamais) ; rend son démontage. */
function mountLiquid(options: MountOptions): () => void {
  const { wrapper, stage, label, area } = options
  const canvas = document.createElement("canvas")
  canvas.className = "absolute inset-0 block size-full"
  stage.append(canvas)
  let disposed = false
  let intro = options.intro
  let built = ""
  let generation = 0
  let timer = 0
  const fail = () => {
    wrapper.dataset.liquid = "off"
  }
  let engine: LiquidWordmarkEngine
  try {
    engine = new LiquidWordmarkEngine(canvas, LIQUID_DEFAULTS, fail, lowPowerDevice())
  } catch {
    // GPU refusé ou cibles flottantes absentes : le texte réel revient aussitôt.
    canvas.remove()
    fail()
    return () => undefined
  }
  engine.onFirstFrame = () => {
    if (disposed) return
    wrapper.dataset.liquid = "on"
    if (options.intro) options.onIntroShown()
  }

  const build = async () => {
    const current = ++generation
    const style = window.getComputedStyle(label)
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    try {
      await document.fonts.load(font, options.content)
    } catch {
      // La police de repli suffit : le texte réel reste de toute façon dessous.
    }
    if (disposed || current !== generation) return
    const box = label.getBoundingClientRect()
    if (box.width < 1 || box.height < 1) return
    const scale = Math.min(window.devicePixelRatio || 1, 2)
    // Rien à refaire si ni la taille, ni la couleur (thème, mode), ni la police n'ont changé.
    const signature = [box.width, box.height, style.color, font, style.letterSpacing, scale].join("|")
    if (signature === built) return
    built = signature
    const layout = wordmarkLayout(box, Number.parseFloat(style.fontSize) || 16)
    const origin = wrapper.getBoundingClientRect()
    stage.style.left = `${box.left - origin.left + layout.stage.left}px`
    stage.style.top = `${box.top - origin.top + layout.stage.top}px`
    stage.style.width = `${layout.stage.width}px`
    stage.style.height = `${layout.stage.height}px`
    try {
      engine.resize(layout.stage.width, layout.stage.height, layout.frame)
      engine.setSource(rasterize(options.content, style, layout, box, scale), intro)
      intro = false
    } catch {
      fail()
    }
  }
  const schedule = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => void build(), 120)
  }

  let inside = false
  const send = (kind: LiquidPointer) => (event: PointerEvent) => {
    const touch = event.pointerType === "touch"
    // Un doigt qui survole sans appuyer n'existe pas : seul un glissé appuyé trouble la matière.
    if (kind === "move" && touch && event.buttons === 0 && event.pressure === 0) return
    const bounds = canvas.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    const gesture = kind === "move" || kind === "down"
    // Hors de la scène, le geste n'atteint plus la matière : elle revient, et la boucle s'arrête.
    if (gesture && (x < 0 || y < 0 || x > bounds.width || y > bounds.height)) {
      if (inside) engine.pointer("leave", x, y, touch)
      inside = false
      return
    }
    inside = gesture
    engine.pointer(kind, x, y, touch)
  }
  const onMove = send("move")
  const onDown = send("down")
  const onUp = send("up")
  const onLeave = send("leave")
  area.addEventListener("pointermove", onMove, { passive: true })
  area.addEventListener("pointerdown", onDown, { passive: true })
  area.addEventListener("pointerup", onUp, { passive: true })
  area.addEventListener("pointercancel", onUp, { passive: true })
  area.addEventListener("pointerleave", onLeave, { passive: true })

  // La taille suit la police (960 px, chargement) ; la couleur suit le thème et le mode posés sur <html>.
  const resizeObserver = new ResizeObserver(schedule)
  resizeObserver.observe(label)
  const themeObserver = new MutationObserver(schedule)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-charte", "style"] })
  const viewport = new IntersectionObserver((entries) => {
    for (const entry of entries) engine.setVisible(entry.isIntersecting && !document.hidden)
  })
  viewport.observe(wrapper)
  const onVisibility = () => engine.setVisible(!document.hidden)
  document.addEventListener("visibilitychange", onVisibility)
  // Un écran d'une autre densité (fenêtre déplacée) : le tramage est refait à la bonne finesse.
  window.addEventListener("resize", schedule)
  void build()

  return () => {
    disposed = true
    window.clearTimeout(timer)
    resizeObserver.disconnect()
    themeObserver.disconnect()
    viewport.disconnect()
    document.removeEventListener("visibilitychange", onVisibility)
    window.removeEventListener("resize", schedule)
    area.removeEventListener("pointermove", onMove)
    area.removeEventListener("pointerdown", onDown)
    area.removeEventListener("pointerup", onUp)
    area.removeEventListener("pointercancel", onUp)
    area.removeEventListener("pointerleave", onLeave)
    engine.destroy()
    canvas.remove()
    wrapper.dataset.liquid = "off"
  }
}

/**
 * Le mot-symbole de la porte, en matière liquide (WebGL2) : il s'assemble à
 * l'arrivée — la diaspora qui se rassemble —, devient liquide sous le curseur ou
 * sous un doigt qui glisse dans `areaRef`, puis reprend sa forme. Le texte réel
 * reste dans le DOM (lecteurs d'écran, traduction, recherche) et s'affiche seul
 * sans WebGL2, en contraste forcé, ou quand le mouvement réduit est demandé :
 * rien ne bouge alors. Le canevas est décoratif et passe sous le reste de la
 * vitrine (`-z-10` dans son contexte d'empilement).
 */
export function LiquidWordmark(props: { text: string; areaRef: RefObject<HTMLElement | null> }) {
  const { text, areaRef } = props
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const stageRef = useRef<HTMLSpanElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  // Décidé une fois par montage, consommé à la première image : le double montage du mode strict ne l'efface pas.
  const introRef = useRef<boolean | null>(null)

  // Avant la première peinture : si l'assemblage va se jouer, le texte se retire déjà. Sinon il
  // apparaîtrait net (le temps que la police arrive), se dissoudrait, puis se rassemblerait.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper || !motionAllowed()) return
    if (introRef.current === null) introRef.current = claimIntro()
    if (!introRef.current) return
    wrapper.dataset.liquid = "intro"
    // Filet de sécurité : sans première image à temps, le texte réel revient. Seul compte le
    // temps des images réellement affichées : un onglet ouvert en arrière-plan n'en calcule
    // aucune, et son assemblage doit encore partir du vide quand on y revient.
    let frame = 0
    let last = 0
    let waited = 0
    const watch = (now: number) => {
      if (wrapper.dataset.liquid !== "intro") return
      waited += last ? Math.min(now - last, 100) : 0
      last = now
      if (waited >= INTRO_GRACE_MS) {
        wrapper.dataset.liquid = "off"
        return
      }
      frame = requestAnimationFrame(watch)
    }
    frame = requestAnimationFrame(watch)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const wrapper = wrapperRef.current
    const stage = stageRef.current
    const label = labelRef.current
    if (!wrapper || !stage || !label) return
    const area = areaRef.current ?? wrapper
    const queries = typeof window.matchMedia === "function"
      ? [window.matchMedia("(prefers-reduced-motion: reduce)"), window.matchMedia("(forced-colors: active)")]
      : []
    let unmount: (() => void) | null = null
    const restart = () => {
      unmount?.()
      unmount = null
      if (!motionAllowed()) return
      unmount = mountLiquid({
        wrapper,
        stage,
        label,
        area,
        content: text,
        intro: introRef.current === true,
        onIntroShown: () => {
          introRef.current = false
        },
      })
    }
    restart()
    for (const query of queries) query.addEventListener("change", restart)
    return () => {
      for (const query of queries) query.removeEventListener("change", restart)
      unmount?.()
    }
  }, [areaRef, text])

  return (
    <span ref={wrapperRef} data-liquid="off" className="group/liquid relative inline-block">
      <span
        ref={stageRef}
        aria-hidden
        className="pointer-events-none absolute -z-10 opacity-0 transition-opacity duration-[var(--dg-duration-base)] group-data-[liquid=on]/liquid:opacity-100"
      />
      <span
        ref={labelRef}
        className="transition-opacity duration-[var(--dg-duration-base)] group-data-[liquid=intro]/liquid:opacity-0 group-data-[liquid=on]/liquid:opacity-0"
      >
        {text}
      </span>
    </span>
  )
}
