"use client"

import { useSheetOpen } from "@diasporale/features"
import { useEffect, useEffectEvent, useSyncExternalStore, type ReactElement } from "react"
import { toast } from "sonner"

/**
 * Cartes flottantes de l'application (charte v2 §7). Les avis de page — la
 * démonstration, le statut d'adhésion — passent DEVANT la page, dans la pile de
 * notifications (sonner : en bas à droite au bureau, pleine largeur au-dessus de
 * la barre basse au téléphone), avec une croix.
 *
 * Une carte que la personne écarte (croix ou glissement) le reste : le choix est
 * mémorisé dans ce navigateur quand le stockage le permet (une session pour la
 * démonstration, durablement pour un statut), en mémoire sinon. Une carte
 * retirée parce que l'écran se démonte n'est PAS un choix de la personne : elle
 * reviendra. Le retrait est différé d'un tour : un écran qui remonte aussitôt
 * (double montage du mode strict, navigation entre deux écrans qui portent la
 * même carte) la garde en place, sans la rejouer.
 *
 * Tant qu'une feuille est ouverte (composeur, cloche, choix du pays), la carte
 * s'écarte, puis revient à la fermeture : posée devant la feuille, elle en
 * masquait les boutons. Ce retrait-là n'est pas non plus un choix de la personne.
 */

export type DismissalStore = "session" | "local"

const dismissedInMemory = new Set<string>()
const listeners = new Set<() => void>()

function storageOf(store: DismissalStore): Storage | null {
  try {
    return store === "session" ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function isDismissed(store: DismissalStore, key: string): boolean {
  if (dismissedInMemory.has(key)) return true
  try {
    return storageOf(store)?.getItem(key) === "1"
  } catch {
    return false
  }
}

function setDismissed(store: DismissalStore, key: string, dismissed: boolean): void {
  if (dismissed) dismissedInMemory.add(key)
  else dismissedInMemory.delete(key)
  try {
    const storage = storageOf(store)
    if (dismissed) storage?.setItem(key, "1")
    else storage?.removeItem(key)
  } catch {
    // Stockage refusé (navigation privée, données bloquées) : le choix vaut pour cet affichage.
  }
  for (const listener of listeners) listener()
}

/**
 * L'état « écartée » d'une carte. Au rendu serveur, une carte flottante n'existe
 * pas encore : elle apparaît une fois la page chargée.
 */
export function useDismissal(key: string, store: DismissalStore) {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => isDismissed(store, key),
    () => true,
  )
  return {
    dismissed,
    dismiss: () => setDismissed(store, key, true),
    restore: () => setDismissed(store, key, false),
  }
}

/**
 * Cartes posées ; poses et retraits programmés (un tour plus tard) ; retraits
 * en cours décidés par un écran (pas un geste de la personne).
 */
const placedCards = new Set<string>()
const pendingPlacements = new Map<string, ReturnType<typeof setTimeout>>()
const pendingRemovals = new Map<string, ReturnType<typeof setTimeout>>()
const removedByScreen = new Set<string>()

function cancel(timers: Map<string, ReturnType<typeof setTimeout>>, id: string): void {
  const timer = timers.get(id)
  if (timer === undefined) return
  clearTimeout(timer)
  timers.delete(id)
}

function removeSoon(id: string): void {
  cancel(pendingPlacements, id)
  if (pendingRemovals.has(id)) return
  pendingRemovals.set(
    id,
    setTimeout(() => {
      pendingRemovals.delete(id)
      if (!placedCards.has(id)) return
      removedByScreen.add(id)
      toast.dismiss(id)
    }, 0),
  )
}

/**
 * Pose une carte flottante (sonner) tant que `content` est fourni et que la
 * personne ne l'a pas écartée. `content` reçoit l'action de sa croix ;
 * `version` redessine la carte quand ce qu'elle dit change (statut, langue).
 */
export function useFloatingCard(props: {
  id: string
  dismissKey: string
  store: DismissalStore
  content: ((dismiss: () => void) => ReactElement) | null
  version: string
}) {
  const { dismissed, dismiss, restore } = useDismissal(props.dismissKey, props.store)
  const sheetOpen = useSheetOpen()
  const visible = props.content !== null && !dismissed && !sheetOpen

  const place = useEffectEvent(() => {
    const render = props.content
    if (render === null) return
    const id = props.id
    cancel(pendingRemovals, id)
    cancel(pendingPlacements, id)
    // Un tour plus tard : la pile (Toaster) ne rejoue pas une carte publiée avant
    // qu'elle s'abonne, et elle s'abonne dans le même passage d'effets que l'écran.
    pendingPlacements.set(
      id,
      setTimeout(() => {
        pendingPlacements.delete(id)
        placedCards.add(id)
        toast.custom(
          () =>
            render(() => {
              dismiss()
              toast.dismiss(id)
            }),
          {
            id,
            duration: Number.POSITIVE_INFINITY,
            onDismiss: () => {
              placedCards.delete(id)
              // Retrait par l'écran : pas un choix de la personne, rien à mémoriser.
              if (removedByScreen.delete(id)) return
              dismiss()
            },
          },
        )
      }, 0),
    )
  })

  useEffect(() => {
    if (visible) place()
    else removeSoon(props.id)
  }, [visible, props.id, props.version])

  useEffect(() => {
    const id = props.id
    return () => removeSoon(id)
  }, [props.id])

  return { dismissed, restore }
}

/** Montre une carte flottante une fois, à la demande (la charte « en situation »). */
export function showFloatingCard(id: string, content: (dismiss: () => void) => ReactElement): void {
  toast.custom(() => content(() => toast.dismiss(id)), { id, duration: Number.POSITIVE_INFINITY })
}
