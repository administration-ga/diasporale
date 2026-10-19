// Dupliqué de ANTSIA apps/antsia_ga/src/components/toast-region.tsx (lot P18b, A07, arbre partagé du 19/10/2026, non commité) — adaptations : hôte créé dans un effet de mise en page (les cartes flottantes, posées un tour après le montage, trouvent la pile déjà abonnée) ; commentaires ramenés aux surfaces de DIASPORALE.
"use client"

/**
 * La région des toasts, EXEMPTÉE de l'inertage des modales (écart P18b relevé par ANTSIA).
 *
 * La visionneuse de médias (`ImmersiveOverlay`, `@antsia/ui`, hook `useModalA11y`) rend
 * inertes tous les enfants de `<body>` qui ne contiennent pas le dialogue ouvert. La pile de
 * sonner, rendue sur place dans l'application, l'était avec eux : une erreur émise pendant la
 * visionneuse (réaction, commentaire, signalement) n'était ni annoncée ni atteignable.
 *
 * La région vit donc dans SON hôte, enfant direct de `<body>`, que l'application exempte : un
 * `inert` posé sur cet hôte par une modale est aussitôt levé. Rien d'autre n'est exempté : le
 * contenu de la page reste inerte derrière le dialogue, et la modale garde son piège de Tab.
 * Hors de l'application, la zone vivante des toasts ne garde plus non plus la page exposée
 * derrière une feuille Radix (`hideOthers` épargne les ancêtres d'une zone vivante).
 *
 * Rendu au client seulement (hôte créé au montage) : aucun désaccord d'hydratation. L'hôte naît
 * dans un effet de mise en page : la pile s'abonne dans le même passage que l'écran, avant les
 * cartes flottantes posées un tour plus tard (`floating-cards.tsx`), que sonner ne rejoue pas.
 * La charte (`data-charte` sur `<html>`) et le thème s'héritent ; les toasts gardent leur
 * position fixe.
 */
import { useLayoutEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Toaster, type ToasterProps } from "sonner"

/** Attribut de l'hôte de la région des toasts : le même que dans ANTSIA, lu par la modale partagée. */
export const TOAST_REGION_ATTRIBUTE = "data-toast-region"

export function ToastRegion(props: ToasterProps) {
  const [host, setHost] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const element = document.createElement("div")
    element.setAttribute(TOAST_REGION_ATTRIBUTE, "")
    document.body.appendChild(element)
    // L'exemption : une modale qui pose `inert` sur l'hôte le voit levé. La modale lève
    // elle-même ce qu'elle a posé à sa fermeture ; retirer plus tôt ne gêne pas ce retrait.
    const observer = new MutationObserver(() => {
      if (element.hasAttribute("inert")) element.removeAttribute("inert")
    })
    observer.observe(element, { attributes: true, attributeFilter: ["inert"] })
    setHost(element)
    return () => {
      observer.disconnect()
      element.remove()
    }
  }, [])

  return host === null ? null : createPortal(<Toaster {...props} />, host)
}
