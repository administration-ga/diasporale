---
title: "DIASPORALE — Pagination de l’agenda personnel"
date: "2026-10-18"
statut: "Sources raccordées ; vérifications différées sur instruction du propriétaire"
reference: "DG-023, suite du calendrier"
---

# Pagination de l’agenda personnel

La demande prolonge [iCal et l’agenda associatif](29_EXPORT_ICAL_AGENDA_ASSOCIATIF_DG023.md). L’agenda complet doit pouvoir continuer au-delà de deux cents événements organisés ou participations. Les sources réelles DIASPORALE et ANTSIA sont modifiées en coordination ; les contrôles, recettes et commits applicatifs restent différés.

## Contrat retenu

- Ajouter `events.paginateMyAgenda` sans modifier le contrat historique de `myAgenda`. Chaque appel vise une seule source : `organized` ou `participations`, et une seule période : `upcoming` ou `history`.
- Fixer `anchor` à l’ouverture du panneau. Lire les débuts supérieurs ou égaux à cette frontière en ordre croissant ; les débuts strictement antérieurs en ordre décroissant. Le classement visuel continue d’utiliser l’heure et le fuseau actuels du lecteur. Les événements déjà commencés peuvent être encore en cours.
- Paginer les deux index existants, préfixés par réseau et personne authentifiée. Un seul appel natif de pagination par requête ; vingt lignes demandées par fenêtre, plafond serveur de quarante lignes et 256 Kio sur ce scan brut. Les lectures de projection et de droits restent distinctes. Aucune nouvelle table, aucun nouvel index, aucun offset.
- Exiger la personne attendue et relire l’adhésion à chaque appel. Filtrer les droits après la fenêtre brute : une page vide peut donc encore annoncer une suite. Conserver les curseurs et métadonnées natifs, sans déduire la fin du nombre de cartes visibles.
- Rendre une union explicite `{kind: personal, event: EventDto}` / `{kind: association, event: AssociationAgendaDto}`. Le personnel garde ses invitations et réponses habituelles ; l’association garde son identité collective et sa propre confirmation/attente volontaire. Aucune action personnelle ni identité d’organisateur fictive ajoutée.
- Pour chaque événement associatif, relire la page et l’événement publiés, l’audience, la participation et les droits actuels. Une annulation reste signalée si elle est encore lisible ; retrait, modération ou perte d’accès retirent la ligne. Le seul mandat de responsable n’ajoute aucun événement à son agenda.

## Raccordement

| Couche | Changement dans les sources |
|---|---|
| Moteur ANTSIA | `convex/modules/events/events.ts` : nouveau lecteur paginé, DTO d’union et réutilisation des projections existantes ; ancien `myAgenda` conservé |
| Panneau partagé | `AgendaPagination.tsx` et `agenda-pagination.ts` : quatre chaînes de fenêtres actives, curseurs opaques, dédoublonnage par événement, reprise et recalage des frontières via `cursor-pages` existant |
| Écran partagé | `EvenementsPanel.tsx` : pagination serveur et bouton de continuation ; sections et pages visuelles de huit événements conservées sur les seules lignes chargées, droits d’écriture inchangés |
| Port DIASPORALE | `AssociationEventCalendarCapability.useAgendaPage` facultatif ; anciens fournisseurs et export iCal conservés |
| Fournisseur moteur | `engine-association-activities.ts` : source participations, projection collective seulement, lecteur attendu et métadonnées de la page brute |
| Démonstration | `demo/association-activities.ts` : mêmes inscriptions fictives v1, clé stable de l’inscription logique, curseur lié à lecteur/seed/période/frontière ; aucun nouvel enregistrement |
| Route réelle | `/agenda` garde le panneau ANTSIA sous le réseau courant. La démonstration affiche deux listes paginées ; les anciens fournisseurs gardent la liste limitée et son avertissement |
| Textes | Ajouts ciblés français/anglais dans les fragments `event-calendar` DIASPORALE et `associationAgenda` ANTSIA |

Chaque fenêtre reste abonnée : un changement de curseur amont abandonne la suite devenue périmée. Les réponses tardives des fenêtres abandonnées sont ignorées. Le changement de réseau ou de personne remonte le panneau et ses formulaires ; l’horloge ne réinitialise pas les pages. Dans le panneau partagé, une erreur ferme les lignes en cache jusqu’à une reprise explicite, et les lignes restent masquées pendant une relecture non résolue. La démonstration réutilise la reprise et la fermeture sur erreur du pagineur existant, par liste. Le formulaire de création reste monté pendant le chargement des pages ; il est retiré au changement de lecteur.

Le bouton poursuit les flux non épuisés. Un état vide global exige que les quatre flux soient terminés ; une page filtrée vide garde la continuation. Les comptes et la pagination visuelle portent sur les événements chargés, sans prétendre donner un total serveur. Le tri est déterministe parmi les lignes chargées ; les prochaines pages peuvent compléter les sections déjà affichées.

L’aperçu du rail conserve volontairement `myAgenda`, ses scans bornés et la métadonnée historique `truncated`. Il montre au plus trois prochaines entrées ; son lien « Voir tout » conduit à l’agenda paginé. L’ancien lecteur reste disponible aux consommateurs existants ; augmenter sa limite ne constitue pas cette implémentation.

## Scénarios écrits, exécution différée

- Plus de deux cents événements, début identique, pages successives, absence de doublons et frontière égale à l’ancre ; historique et événements à venir parcourus indépendamment.
- Page brute entièrement filtrée mais non terminale, suite encore accessible, fin réelle et budgets serveur.
- Personnel conservé, confirmation et attente associative séparées, retrait et événement annulé, page/événement modéré, adhésion révoquée, membre réseau en attente, mauvais réseau ou mauvais lecteur.
- Réponses réactives, recalage d’un curseur amont, erreur suivie de reprise, changement d’identité/réseau, horloge qui avance sans perdre la progression.
- Fournisseurs moteur et démonstration, périmètre du curseur fictif, changement de seed et compatibilité du port historique ; écran démo avec page vide continuable et droits retirés.

Aucun test, codegen, typage, lint, build, HTTP, navigateur ou serveur lancé pour cette tranche. Les scénarios sont du code non exécuté. Aucun résultat antérieur ne valide la vague actuelle. Aucun commit applicatif, push, déploiement, changement d’environnement ou suppression de données/cache/session.

## Coordination et reprise

Périmètre annoncé au chat ANTSIA et au chat DIASPORALE des pages/services. Les fichiers génériques, schéma, index, configuration, P12 et gestion des services restent à leurs propriétaires. Réservations libérées à l’issue de l’intégration statique ; le contrôle commun sur sources gelées attend une demande ultérieure.

DG-023/PD7 restent ouverts : codegen et contrôles communs, recette longue de pagination avec deux comptes, QR, délivrance des médias/rappels et imports iCal réels. La pagination interne n’ajoute aucun abonnement ou synchronisation avec un calendrier extérieur.
