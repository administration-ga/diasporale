# Blocage et pages — la matrice (RP-03)

> 10/11/2026. Lot RP-03 du plan `etudes/2026-11-10-finalisation/05_PROFIL_RELATIONS_ANNUAIRE.md`,
> décision 5 (recommandation acceptée par le propriétaire). Écrite AVANT le code ; chaque ligne a
> son test.

## La règle

Une page est **fermée** à une personne quand elle a au moins un signataire vivant et que **tous**
ses signataires vivants sont en blocage avec cette personne — dans un sens ou dans l'autre, dans
quelque réseau que ce soit (`isBlockedBetween` du moteur).

- Un seul signataire ne ferme pas une page collective : il suffit d'un signataire vivant hors
  blocage pour que la page reste ouverte.
- « Vivant » : habilitation acceptée, page active, adhésion active au réseau de la page
  (`liveSignatoryRole`). Une invitation en attente ou un signataire parti ne comptent pas.
- Une page sans signataire vivant n'est pas fermée par cette règle (d'autres gardes s'en chargent).
- La personne elle-même signataire vivante n'est jamais fermée.
- Refus **indistinct** : le même `notFound` qu'une page retirée, jamais « vous êtes bloqué » ;
  rien n'est écrit, aucun avis n'est émis.

Une garde, deux lectures : `isPageClosedByBlocks` dans la tranche
(`ANTSIA/convex/modules/diaspora/facts.ts`, bornée par le plafond des signataires, arrêt au premier
signataire vivant hors blocage) et son miroir de démonstration
(`packages/diasporale-features/src/demo/selectors.ts`).

## La matrice

Tests de la tranche : `ANTSIA/convex/modules/diaspora/pageBlocks.test.ts`.

| # | Surface | Geste (fonction de la tranche) | Règle | Test |
|---|---|---|---|---|
| 1 | Demande de service | `serviceRequests.createServiceRequest` | page fermée : refus indistinct | « demande de service » |
| 2 | Accord sur une proposition | `serviceRequests.acceptServiceProposal` | page fermée : refus indistinct, aucun rendez-vous | « accord sur une proposition » |
| 3 | Déplacer un rendez-vous, côté demandeur | `serviceRequests.proposeServiceReschedule`, `acceptServiceReschedule` | page fermée : refus indistinct | « déplacer un rendez-vous » |
| 4 | Adhésion à une association | `associations.requestAssociationMembership` | page fermée : refus indistinct | « demande d'adhésion » |
| 5 | Candidature à une offre d'emploi | `jobs.applyToJobOffer` | page fermée : refus indistinct | « candidature » |
| 6 | Inscription à une mission bénévole | `mutualAid.signUpForMission` | page fermée : refus indistinct | « inscription à une mission » |
| 7 | Sortir d'un échange | `cancelServiceRequest`, `declineServiceReschedule`, `cancelAssociationMembershipRequest`, `leaveAssociation`, `withdrawJobApplication`, `withdrawFromMission` | toujours ouvert : on ne retient personne dans un échange que l'équipe a fermé | « sortir d'un échange » |
| 8 | Recours : contester une absence déclarée | `serviceRequests.contestServiceNoShow` | toujours ouvert (R-G13 : le recours reste dans son espace) | « contester une absence » |
| 9 | Ressource du kit portée par la page | `arrivalKit.getResource`, `flagResourceOutdated` | lisible et signalable (décision 5) | « ressource du kit » |
| 10 | Règle : un signataire sur deux | toutes les lignes 1 à 6 | page ouverte | « un seul signataire » |
| 11 | Règle : sens, vie, page sans équipe | la garde | blocage posé par la personne : fermée ; signataire non vivant ignoré ; aucune équipe vivante : ouverte | « la règle » |

Démonstration : lignes 1, 2, 4, 5 et 6 (le déplacement de rendez-vous n'y existe pas).

## Hors de cette garde

- **Avis sur une prestation** (`serviceReviews.createReview`, `updateReview`) : la règle existante
  de personne à personne (blocage avec l'auteur de la proposition) reste. Un avis n'est pas une
  demande à l'équipe ; le fermer par un blocage collectif permettrait de faire taire un avis.
  Question ouverte au propriétaire : la règle existante laisse déjà un seul signataire écarter
  l'avis de la personne qu'il a bloquée.
- **Gestes de l'équipe vers la personne** (proposer, refuser, constater) : hors décision 5, qui
  vise la demande de la personne vers la page.
- **Conversation attachée à l'objet** : gardée par le moteur (`liveTeamMember` dans
  `contextualMessaging/access.ts`) ; le signataire en blocage n'y a plus accès.
- **De personne à personne** (fiche, annuaire, suggestions, entraide, mentorat, talents, cloche) :
  `isBlockedBetween`, déjà lu par la tranche.
- **Abonnements** : retirés dans les deux sens par le moteur au blocage (PF-01, antsia#113) ;
  débloquer ne rétablit ni la relation ni les abonnements.
- **Inscription à un évènement d'une page** (`convex/modules/events`) : hors de la tranche,
  demandée au moteur par une issue [S1].
