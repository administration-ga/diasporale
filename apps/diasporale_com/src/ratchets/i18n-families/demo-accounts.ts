/**
 * Familles de clés DYNAMIQUES des comptes de démonstration (développement local),
 * énumérées depuis le catalogue du domaine : un titre et une description par acteur,
 * un intitulé par groupe du panneau. Le statut attendu passe par `membership.status.*`.
 */
import { DIASPORALE_DEMO_ACTORS, DIASPORALE_DEMO_GROUPS } from "@diasporale/domain"

export const FAMILIES: readonly string[] = [
  ...DIASPORALE_DEMO_GROUPS.map((group) => `demoAccounts.groups.${group}`),
  ...DIASPORALE_DEMO_ACTORS.flatMap((actor) => [`demoAccounts.actors.${actor}.title`, `demoAccounts.actors.${actor}.description`]),
]
