# Annuaire, abonnements et partage des pages

18 octobre 2026 — **implémentation dans les sources réelles ; vérifications différées sur demande du propriétaire**.

## Parcours raccordés

- `/pages` : annuaire des pages, recherche, pays et filtre Associations / Entreprises.
  Les filtres sont conservés dans l’adresse après la pause de frappe ; une nouvelle
  recherche repart de la première fenêtre. Les commandes de création sont proposées
  aux membres vérifiés, suivant la règle déjà appliquée au formulaire.
- `/pages?vue=suivies` : abonnements du lecteur, paginés par vingt, les plus récents
  d’abord. Le bouton « Ne plus suivre » agit sur le vrai abonnement ; aucun mandat
  de gestion n’est ajouté. L’état vide renvoie à la découverte.
- Explorer propose des accès aux associations et aux entreprises du pays de résidence,
  ainsi qu’aux pages suivies. Les listes bornées du hub renvoient à l’annuaire de leur
  type et de leur pays. « Mon activité → Pages » propose un lien vers les abonnements,
  qui restent distincts des pages que la personne gère.
- Une fiche de page offre un retour à l’annuaire et « Partager ». La feuille fournit
  le lien canonique, « Copier le lien », un repli de copie manuelle et, si le navigateur
  le propose, les options de partage du système. L’envoi est toujours un geste du lecteur.
  Copier ou partager ne change ni la visibilité ni les droits d’accès à DIASPORALE.

## Contrats et sources

`PagesCapability.useFollowedPages` est facultatif : un fournisseur sans cette capacité
affiche l’indisponibilité au lieu de fabriquer des abonnements. L’adaptateur moteur
utilise `pages.paginateMyPageFollows`, les gardes de lecture existantes et une identité
de cache liée au lecteur ; la perte de session ferme cette lecture. La démonstration
réutilise ses abonnements et la projection des pages nouvellement créées, sans nouveau
jeu fictif. Ses curseurs restent distincts et liés au lecteur.

Le champ facultatif `PageDirectoryRequest.ownerKind` est transmis au moteur et inclus
dans l’identité des requêtes. Dans le périmètre générique cédé par le coordinateur
ANTSIA, `convex/modules/pages/pages.ts` accepte ce filtre fermé sur `discover` et
`paginateDiscover` et l’applique **avant** `take` / `paginate`, y compris dans la
recherche. Aucun schéma, index, droit, écriture ou contrat de fédération n’est modifié.
Le filtre s’appuie sur les index existants et un prédicat ; aucun nouvel index de
performance n’est revendiqué.

Les nouveaux textes français/anglais sont isolés dans les fragments `page-browsing`
et `page-sharing`. La feuille et les composants existants portent la présentation
ordinateur/téléphone ; aucune recette visuelle n’a été exécutée pour ces ajouts.

## État de preuve

Aucun test, typage, lint, codegen, build ni parcours navigateur lancé. Aucun commit
applicatif, push ou déploiement effectué. Les résultats des tranches précédentes
ne valident pas ces nouveaux fichiers. Les contrôles restent à reprendre sur
instruction du propriétaire et après coordination du créneau avec ANTSIA.
