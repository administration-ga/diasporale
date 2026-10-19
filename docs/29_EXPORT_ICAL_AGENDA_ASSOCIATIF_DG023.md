---
title: "DIASPORALE — Export iCal et agenda associatif personnel"
date: "2026-10-18"
statut: "Sources raccordées ; vérifications différées sur instruction du propriétaire"
reference: "DG-023, tranche calendrier"
---

# Export iCal et agenda personnel

> Suite en sources : [pagination native de l’agenda](30_PAGINATION_AGENDA_PERSONNEL_DG023.md). Les limites200 décrites ici restent celles de l’ancien lecteur et de l’aperçu du rail ; le panneau complet utilise désormais un nouveau parcours paginé. Vérifications toujours différées.

Suite de la galerie après événement, sur demande du propriétaire. Sources réelles partagées avec ANTSIA ; aucun contrôle de tests, codegen, typage, lint, build, HTTP, navigateur ou serveur dans cette tranche. Aucun commit applicatif avant les contrôles obligatoires.

## Contrats et découpage

- Conserver `events.myAgenda.items` et son DTO personnel. Ajouter `associationItems` explicites, sans organisateur personnel fictif : identité de page, état confirmé/en attente, annulation, dates et fuseau. Les deux types se réunissent à l'affichage dans l'agenda existant.
- Inclure seulement ses inscriptions actuelles confirmées ou en attente FIFO, pas les événements de toutes ses pages ni les inscriptions retirées. L'attente n'est jamais une invitation à accepter avec l'API personnelle. L'annulation reste signalée si les droits actuels permettent encore la lecture.
- Relire réseau, personne, page native publiée, événement publié et audience actuelle avant toute restitution. Une participation passée ne conserve aucun accès. Lecteur attendu facultatif sur l'ancien agenda, obligatoire pour l'export.
- Garder les scans indexés existants : deux budgets de deux cents lignes pour organisés et participations, historique compris, sans troisième scan associatif. `truncated` dit la lacune ; ne pas annoncer d'agenda exhaustif au-delà du budget.
- Exporter une copie `.ics` à la demande par lecture authentifiée fraîche, sans écriture ni inscription. Les lecteurs autorisés, y compris les membres en attente, peuvent exporter ; une place en attente ou absente donne un fichier tentative/transparent, une place confirmée un fichier confirmé, l'annulation un fichier annulé.
- UID opaque stable pour événement/réseau, version, instants UTC, texte échappé et lignes UTF-8 pliées. Aucune identité ou coordonnée extraite d'un compte, liste de participants, billet QR, URL de stockage, alarme, invitation envoyée ou lien d'abonnement ajouté au fichier.
- Démonstration dans l'état d'activités v1 existant ; aucune table ou copie supplémentaire d'agenda. Nouvelle route `/agenda` réutilisant le panneau moteur en mode moteur, liste fictive explicite en démonstration ; lien depuis Communautés et le détail de l'événement.

Le coordinateur porte les contrats, le sérialiseur pur, le raccord de l'agenda partagé et la documentation. Un exécutant porte les lectures du moteur, un les fournisseurs, un les surfaces DIASPORALE. Les génériques P12/configuration restent à ANTSIA et les rubriques des pages au chat voisin.

## Raccords livrés dans les sources

| Couche | Sources réelles et responsabilités |
|---|---|
| Format partagé | ANTSIA `packages/social-domain/src/icalendar.ts` et scénarios : un événement privé, UID/SEQUENCE/dates validés, CRLF, TEXT échappé et pliage UTF-8 ; aucun transport |
| Moteur | `convex/modules/events/pageEventCalendar.ts` lit le lecteur attendu, la garde publiée commune et sa propre participation ; `events.ts` ajoute `associationItems` sans modifier les objets personnels |
| Contrat DIASPORALE | `data/association-event-calendar-port.ts`, export du port et `AssociationEventsCapability.calendar` facultatif ; anciens fournisseurs compatibles |
| Fournisseurs | `engine-association-activities.ts` projette les champs du port, relit l'identité après l'export ; `demo/association-activities.ts` conserve le stockage v1 et ses données fictives |
| Agenda partagé | ANTSIA `association-agenda.ts`, `AssociationAgendaCard.tsx`, `EvenementsPanel.tsx` et `EvenementsRail.tsx` : sections chronologiques réunies, attente distincte des invitations, aucune action personnelle sur une association |
| Navigation | `EngineRoutes.agenda` et `associationEvent` facultatifs ; injection depuis `engine-routes.ts`. Route DIASPORALE `/agenda`, entrée depuis Communautés via un slot facultatif de hub et depuis le détail d'événement |
| Téléchargement | `association-event-calendar.tsx` sous contexte lecteur/événement/version/audience/place ; nom et type fixes, Blob éphémère, nettoyage au démontage, résultat tardif ignoré |
| Textes | Fragments `event-calendar` français/anglais raccordés et ajouts ciblés `associationAgenda` dans l'i18n partagée du moteur |

L'agenda interne du moteur conserve les sections et la pagination visuelle existantes. Les lignes associatives utilisent leur identité de page et conduisent au détail injecté ; à défaut de cette destination, l'hôte renvoie vers la fiche de la page. Le rail suit les mêmes règles et omet les annulations des prochaines dates. La route DIASPORALE réutilise ce panneau sous le fournisseur de réseau existant ; le membre en attente le lit avec `canWrite=false`.

Une erreur ou une nouvelle lecture ferme les données collectives précédemment affichées dans l'agenda. Le téléchargement refuse le décalage entre compte et adhésion ; son contexte est démonté si identité, version, audience, statut ou inscription changent. Le reçu dit seulement que le fichier est préparé. Les URL Blob sont révoquées après une courte fenêtre de prise en charge, ou dès la sortie ; gestion de référence conforme au cycle de vie décrit par [MDN](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static), sans preuve de téléchargement disque dans cette tranche.

La démonstration n'invente pas d'événements personnels : elle affiche uniquement les inscriptions associatives fictives. Ses anciens événements reçoivent `updatedAt=createdAt` en mémoire ; les nouveaux champs optionnels `updatedAt/cancelledAt` suivent les modifications et annulations. Le calcul asynchrone de l'UID relit ensuite personne, adhésion, événement et audience. Aucune écriture n'est provoquée par l'export.

## Scénarios écrits, exécution différée

- Agenda personnel préservé, inscription associative courante, attente séparée des invitations, tri/fuseau, fenêtre de dates, dédoublonnage et borne annoncée.
- Membre en attente, retrait, perte d'adhésion, page/événement masqué ou retiré, mauvaise personne attendue ou mauvais réseau ; aucun droit du seul fait du mandat.
- Annulation encore accessible, lignes retirées absentes et fichiers confirmés/provisoires/annulés, UID stable entre révisions et états.
- Export sans effet d'inscription, politique privée, absence d'identités/QR/participants ajoutés ; caractères de contrôle, injection de propriétés, textes longs accentués et emoji, dates UTC au changement d'heure.
- Fournisseur moteur et démo v1, changement de compte pendant la lecture, nom/type autorisés, refus, double clic, ressources Blob et retours tardifs après changement de contexte.
- Écran `/agenda`, lecture seule, liens vers l'association, états vides/erreurs/lacune et préservation des événements personnels.

Seule une relecture statique a été faite. Les scénarios restent non exécutés ; aucun résultat antérieur ne valide ces ajouts. Codegen, tests, typages, lint, build, recette utilisateur et imports réels dans les calendriers tiers sont différés. Aucun serveur, environnement ou déploiement n'est manipulé ; aucun commit applicatif.

## Référence de format

Le fichier suit le modèle iCalendar : séparateurs CRLF, échappement TEXT, pliage à 75 octets sans couper un caractère UTF-8, UID stable et heures UTC. Les règles de format proviennent de la [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545), sections 3.1, 3.3.5, 3.3.11 et 3.6.1. Le fichier est privé et n'adresse aucun destinataire.

## Limites à conserver dans l'interface

L'export est une copie ponctuelle. Une modification, une annulation ou un retrait de droits dans DIASPORALE ne peut pas reprendre un fichier déjà téléchargé ni garantir sa mise à jour dans un calendrier tiers. Réexporter conserve le même UID et la version actuelle ; l'import effectif et son comportement dans chaque application restent à recetter. Exporter ne confirme pas une place et n'active pas de rappel supplémentaire.
