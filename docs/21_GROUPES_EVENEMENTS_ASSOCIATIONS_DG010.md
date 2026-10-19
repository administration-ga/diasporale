---
title: "DIASPORALE — Groupes privés et événements des associations"
date: "2026-10-18"
version: "1.0"
statut: "Sources raccordées ; scénarios écrits, contrôles différés sur instruction du propriétaire"
reference: "DG-010 · G3 · PD5/PD7"
---

# Groupes et événements des associations

Cette tranche poursuit le [plan global](14_PLAN_GLOBAL_IMPLEMENTATION_DIASPORALE.md) après les [avis de services DG-016](19_REPRISE_CLAUDE_AVIS_SERVICES_DG016.md). Le propriétaire demande les groupes et les événements d'associations et maintient explicitement les vérifications différées.

## Périmètre et décisions

- Réutiliser les groupes **thématiques** du moteur (`thematicGroups`, mur `posts` sous audience `group`) : groupe privé lié à la page, entrée volontaire, publications textuelles et retrait. Les conversations de groupe, pièces jointes/vocaux et appels restent les modules iCom distincts ; ils ne sont pas recréés ici.
- Un responsable crée explicitement au plus un groupe par association. Cette création ne remplit aucune liste d'adhérents ; le responsable qui agit peut rejoindre lors de ce geste explicite. Le groupe n'est jamais créé depuis un import de personnes.
- L'accès privé exige une ligne de groupe vivante ET une situation associative encore admissible. Une exclusion ou un départ associatif ferme immédiatement les échanges, y compris les anciennes publications de leur auteur et les accès par invitation ou URL.
- Les pouvoirs du groupe suivent les rôles vivants de la page et de l'association. Un rôle personnel historique `owner` ne conserve aucune autorité après révocation. La fermeture est non destructive ; la suppression générique est fermée pour préserver le groupe lié unique.
- Événements organisés sous l'identité de la page associative, sans propriétaire personnel technique : `organizerPageId`, créateur comme référence d'audit seulement. L'agenda personnel et son DTO restent inchangés et séparés de la section événementielle associative.
- Audience choisie : adhérents par défaut, ou membres du réseau DIASPORALE. Aucune diffusion racine et aucune inscription automatique. La participation à un événement ne donne aucun droit au groupe, à une liste d'adhérents ou à un appel.
- Création, modification et annulation par signataires vivants ; versions attendues sur les changements. Les instants sont stockés en UTC, les heures saisies dans le fuseau IANA choisi. Dès qu'une participation existe, un changement de dates/fuseau exige annulation puis nouvel événement : aucun calendrier n'est déplacé silencieusement.
- Inscription personnelle idempotente, retrait personnel possible en attente. La [suite DG-023](22_CAPACITES_LISTES_ATTENTE_EVENEMENTS_DG023.md) raccorde ensuite capacité et liste d'attente, sans vérifications ; QR de présence, galerie et iCal associatif restent ouverts.

## Contrats et surfaces

| Zone | Raccord |
|---|---|
| Port DIASPORALE | `association-activities-port.ts` : capacités facultatives `associationGroups` et `associationEvents` |
| Groupe moteur | Tranche `diaspora/associationGroups` et gardes thématiques existantes ; mur sur les publications existantes, projection minimale |
| Événements moteur | `events/pageEvents`, garde `pageEventAccess`, champs/index de page ajoutés aux tables existantes |
| Fournisseurs | Adaptateur moteur et stockage de démonstration, mêmes équipes/adhésions vivantes que les autres modules |
| Fiche association | Entrée du groupe, liste paginée des événements et création sous identité de page |
| Groupe | `/pages/[handle]/groupe`, avec retour à la fiche, entrée/départ, texte privé et retrait |
| Événement | `/pages/[handle]/evenements/[eventId]`, avec retour, audience, fuseau, participation et gestion versionnée |

Les identifiants de personnes, coordonnées, décisions privées et listes de participants ne font pas partie des cartes d'activité. Les noms sociaux sont relus depuis les profils vivants ou remplacés par une identité indisponible. Le mur propre à cette tranche affiche des textes ; les médias et interactions complètes de groupe restent une extension des surfaces communes.

La démonstration partage le registre vivant des équipes et des adhésions avec la gestion de page. Une invitation non acceptée ne confère aucun rôle et une révocation ferme les lectures privées et les décisions ; aucune liste statique de responsables ne sert d'autorité. Les anciens historiques fictifs restent conservés.

## Gardes à préserver dans tous les chemins

1. Page active, native, de type association, dans le réseau DIASPORALE ; aucune page d'entreprise, fédérée ou interréseau ne donne les mêmes droits.
2. Groupe : création unique transactionnelle ; admission générique et acceptation d'invitation respectent la même admissibilité ; la garde d'audience referme aussi l'exception auteur.
3. Événement privé : une ancienne participation ne contourne jamais le départ/l'exclusion ; les cartes, annonces, réponses génériques et la disponibilité téléphonique relisent les droits pertinents.
4. Contenus collectifs modérés au niveau de la page ; politique explicite avant publication d'un événement. Un signataire ne peut approuver le contenu de sa page dans son rôle de modérateur.
5. L'effacement du compte d'un ancien signataire anonymise sa référence d'audit ; il ne détruit pas les événements ou le groupe de l'association.

## Coordination et niveau de preuve

ANTSIA a délégué les extensions limitées de `thematicGroups`, `events` et de la tranche `diaspora`. Ses chantiers fédération/personnes/consentements restent réservés. Aucun schéma racine, fichier d'environnement ou fichier généré n'est modifié à la main. Les nouveaux champs sont agrégés par les tables existantes.

**Aucun test, typage, lint, codegen, build ou navigateur n'est lancé dans cette tranche.** Les scénarios sont écrits puis relus statiquement : droits réels du moteur, contournements génériques, unicité/concurrence, versions, modération, fournisseurs, changement de compte et formulaires. Aucun commit applicatif n'est créé avant la réouverture du contrôle obligatoire ; aucune publication distante n'est incluse.

Les nouvelles références d'API attendent le codegen coordonné. Les événements associatifs restent dans leur section de page, en dehors de `myAgenda` personnel et de l'iCal différé. Leurs participations partagent encore l'index de scan de l'agenda : elles peuvent occuper sa fenêtre bornée de 200 lignes ; `truncated` conserve le signalement de cette lacune. Une dénormalisation/indexation séparée sera à traiter avec la convergence des agendas, sans prétendre ici les avoir unifiés.

## Recette différée

- Deux responsables concurrents créent le même groupe : un seul groupe et aucun adhérent ajouté.
- Adhérent accepté → choix d'entrée → publication privée ; non-adhérent/en attente/invité ne contournent pas l'admission.
- Départ, exclusion et révocation de rôle : mur, publication propre, modération et liens directs se ferment immédiatement.
- Inscription à un événement sans adhésion/groupe implicite ; double clic et réessai sans doublon ; retrait en attente.
- Audience adhérents/réseau, modération en attente/approbation/retrait, annulation et contrôle d'un ancien participant.
- Modification concurrente conservant le brouillon ; dates/fuseau verrouillés après participation ; changement d'heure et lecture depuis un autre fuseau.
- Pagination des groupes/événements, fenêtre filtrée vide avec suite, changement de compte en cours de requête, ordinateur/téléphone et clavier.
- Effacement du créateur et du participant, sans effacement indu du contenu collectif ni export des données voisines.
