"use client"

import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { useEffect, useSyncExternalStore, type ComponentProps, type ReactNode } from "react"

import { cn } from "../lib/cn"

/**
 * Feuille — le geste de création et de choix de la charte (§8) : collée en bas
 * d'écran au téléphone, centrée au bureau. Modale (piège de focus, Échap,
 * voile) par Radix Dialog. Titre et description sont OBLIGATOIRES : un
 * lecteur d'écran annonce toujours ce que la feuille contient.
 */
export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close

/* Feuilles ouvertes. Les cartes flottantes persistantes (statut, démonstration)
   s'écartent tant qu'une feuille est ouverte : sinon elles passent devant elle,
   et un clic sur leur croix compterait comme un clic hors de la feuille. */
let openSheets = 0
const sheetListeners = new Set<() => void>()

function subscribeToSheets(listener: () => void): () => void {
  sheetListeners.add(listener)
  return () => {
    sheetListeners.delete(listener)
  }
}

function notifySheets(): void {
  for (const listener of sheetListeners) listener()
}

/** Vrai tant qu'une feuille est ouverte (son contenu n'est monté qu'ouvert). */
export function useSheetOpen(): boolean {
  return useSyncExternalStore(
    subscribeToSheets,
    () => openSheets > 0,
    () => false,
  )
}

function SheetPresence() {
  useEffect(() => {
    openSheets += 1
    notifySheets()
    return () => {
      openSheets -= 1
      notifySheets()
    }
  }, [])
  return null
}

/** La pile des avis (sonner) vit hors de la feuille : un geste dans la pile ne la ferme pas. */
function keepOpenOnNotice(event: Event): void {
  if (event.target instanceof Element && event.target.closest("[data-sonner-toaster]")) event.preventDefault()
}

export function SheetContent(props: {
  title: ReactNode
  description: ReactNode
  /** Masquer visuellement la description (elle reste annoncée). */
  hideDescription?: boolean
  closeLabel: string
  /** Identifiant du panneau, pour un déclencheur qui le référence (aria-controls). */
  id?: string
  className?: string
  children: ReactNode
  onOpenAutoFocus?: ComponentProps<typeof DialogPrimitive.Content>["onOpenAutoFocus"]
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-fade"
      />
      <DialogPrimitive.Content
        id={props.id}
        data-slot="sheet-content"
        onOpenAutoFocus={props.onOpenAutoFocus}
        onInteractOutside={keepOpenOnNotice}
        className={cn(
          "fixed z-50 flex max-h-[min(88dvh,780px)] flex-col overflow-hidden bg-card text-card-foreground shadow-sheet focus:outline-none data-[state=open]:animate-rise",
          // Téléphone : feuille basse, coins hauts de 12 px, réserve de la zone sûre.
          "inset-x-0 bottom-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)]",
          // Bureau : panneau centré.
          "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[min(560px,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:pb-0",
          props.className,
        )}
      >
        <SheetPresence />
        <div className="flex items-start gap-3 border-b border-border px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="font-display text-xl font-bold leading-tight">
              {props.title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description
              className={cn("mt-1 text-sm text-muted-foreground", props.hideDescription && "sr-only")}
            >
              {props.description}
            </DialogPrimitive.Description>
          </div>
          <DialogPrimitive.Close
            className="-mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:shadow-focus"
            aria-label={props.closeLabel}
          >
            <XIcon className="size-5" aria-hidden />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{props.children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
