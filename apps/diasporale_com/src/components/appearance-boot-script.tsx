// Dupliqué de ANTSIA apps/antsia_ga/src/components/appearance-boot-script.tsx (ADR-0026 du moteur, 19/10/2026) — adaptations : configuration de diasporale.com (`@/lib/appearance`) ; aucun nonce tant que l'application ne pose pas de CSP à jeton.
import { appearanceBootScript } from "@antsia/social-features/shell/appearance/boot-script"

import { APPEARANCE } from "@/lib/appearance"

/** Texte figé au chargement du module : il ne dépend d'aucune requête. */
export const APPEARANCE_BOOT_SCRIPT = appearanceBootScript(APPEARANCE)

/**
 * L'amorçage de l'apparence, en tête de `<head>` : thème (`data-charte`) et mode sombre
 * (`.dark`, `color-scheme`) posés sur `<html>` avant le premier affichage, comme les
 * relira le fournisseur d'apparence. Composant serveur, sans état. Le navigateur
 * masque l'attribut `nonce` une fois le script lu, d'où `suppressHydrationWarning`.
 */
export function AppearanceBootScript({ nonce }: { nonce?: string }) {
  return <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }} />
}
