import { DIASPORALE_DEMO_ACTORS, type DiasporaleDemoActor } from "@diasporale/domain"

/**
 * L'acteur choisi dans le panneau des comptes de démonstration, relu par
 * l'amorçage après le rechargement de la connexion (cet onglet seulement).
 * Préfixe `antsia:` : la déconnexion de partout du moteur purge cette clé, comme
 * celle d'ANTSIA (`antsia:antsia:demo-account`).
 */
export const DEMO_ACCOUNT_KEY = "antsia:diasporale:demo-account"

function isDemoActor(value: string): value is DiasporaleDemoActor {
  return (DIASPORALE_DEMO_ACTORS as readonly string[]).includes(value)
}

/** Mémorise l'acteur avant la connexion ; un stockage refusé n'empêche pas d'entrer. */
export function rememberDemoActor(actor: DiasporaleDemoActor): void {
  try {
    window.sessionStorage.setItem(DEMO_ACCOUNT_KEY, actor)
  } catch {
    // Sans stockage, l'accueil reste à remplir à la main.
  }
}

/** L'acteur en attente de préparation, ou `null`. */
export function pendingDemoActor(): DiasporaleDemoActor | null {
  try {
    const raw = window.sessionStorage.getItem(DEMO_ACCOUNT_KEY)
    return raw !== null && isDemoActor(raw) ? raw : null
  } catch {
    return null
  }
}

/** Oublie l'acteur en attente (préparé, abandonné ou refusé). */
export function forgetDemoActor(): void {
  try {
    window.sessionStorage.removeItem(DEMO_ACCOUNT_KEY)
  } catch {
    // Rien à oublier.
  }
}
