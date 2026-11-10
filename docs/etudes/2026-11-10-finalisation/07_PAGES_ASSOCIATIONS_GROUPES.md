# Plan 07 — Pages, associations et groupes

> Constaté par lecture du code d'`origin/main` (DIASPORALE `bead76d`, ANTSIA `fd58d73b`), le 10 novembre 2026. Rien n'a été exécuté : ni test, ni recette, ni publication.
> Applications de référence : Pages et Groupes Facebook, Pages LinkedIn, HelloAsso, AssoConnect, Communautés WhatsApp, Discord. Comparaison faite de mémoire, sans revérification en ligne ; un « ? » marque ce qui n'est pas sûr.
> Ce plan détaille, pour les pages d'association et d'entreprise, l'adhésion associative et les groupes, le plan 15 du dossier de finalisation d'ANTSIA. Les lots qu'il en reprend gardent leur identifiant (DS-…, DG-…) ; les lots nouveaux portent le préfixe `AS-`.

Légende des chemins : `D:` = dépôt DIASPORALE, `A:` = dépôt ANTSIA. « Écran » = atteignable depuis l'interface de diasporale.com ; « Moteur » = la fonction existe côté serveur. Les évènements sont au plan 08, les pages officielles et l'import au plan 15, le bureau de modération au plan 14.

## 1. L'intention du propriétaire

- **Pour qui** : le responsable d'association (P3) et l'entrepreneur de la diaspora (P4). « Faire vivre une association » est le deuxième des trois résultats prioritaires : revendiquer sa page, désigner une équipe, accueillir des membres consentants (cahier § 6.1 ; docs/14 de DIASPORALE § 1.1).
- **Quoi** : des pages d'association revendicables sur preuves, instruites par le modérateur du pays, « Vérifié » à la revendication validée (EXF-DG-21) ; des pages d'entreprise créées par un membre vérifié (EXF-DG-22) ; l'abonnement et le fil des pages suivies (EXF-DG-23) ; des groupes thématiques découvrables par pays, prévus dès la V1 (EXF-DG-24).
- **Les associations sont le moteur du contenu** : « ne pas les freiner », gratuit pour l'essentiel (dossier produit, fiche F04). Les groupes du type « Gabonais de Lyon » ou « Parents de la diaspora » sont attendus, d'abord créés par des associations et des modérateurs, puis par des membres vérifiés (fiche F08).
- **Déjà décidé** : suivre n'est pas adhérer ; aucun adhérent n'est ajouté d'office ni importé ; un seul groupe par association, créé par un geste du responsable, où l'on entre volontairement. Cette règle remplace le groupe « créé d'office » d'EXF-DG-26 (docs/14 G3 ; docs/21 de DIASPORALE ; décision du vault du 18/10 sur les groupes privés).
- **Trois notions jamais confondues** : le statut d'une personne, la page vérifiée, l'autorité officielle. Une page créée par un membre naît « Communauté » ; aucun geste d'ici ne la rend « Officiel » (docs/14 G2).
- **Des droits vivants** : un rôle retiré coupe tout de suite la publication et la gestion ; le dernier administrateur ne part pas (docs/17 § 4, R-G11).
- **Refusé** : scrutin officiel et registre légal d'adhérents ; cotisation comme droit d'accès au réseau ; paiement (D-G03) ; badge payant ; coordonnée de contact sur une page (invariant 6) ; groupes cachés (plan 07 du moteur, décision 3).
- **Convergence** : les adhésions et le groupe d'adhérents remonteront dans le moteur pour servir ANTSIA, après le pilote (plan 15, décision 6 ; lot PG-09 du moteur).

## 2. Ce qui existe

| # | Capacité | État | Écran | Moteur | Preuve |
|---|---|---|---|---|---|
| | **Pages : créer et exister** | | | | |
| 1 | Créer une page d'association ou d'entreprise, adresse dérivée du nom ; le créateur en est le premier administrateur | Présent, mais réservé au statut « vérifiée » | oui | oui | `D:apps/diasporale_com/src/components/page-create-form.tsx` ; `A:convex/modules/pages/pages.ts` (`createPage`) |
| 2 | Créer une page « média » ou « communauté » | Partiel : le formulaire les offre, ni le hub, ni les filtres de l'annuaire, ni aucune rubrique ne les servent | oui | oui | `D:packages/diasporale-features/src/data/page-admin-port.ts` (`MEMBER_PAGE_KINDS`) ; `A:convex/modules/diaspora/hubPages.ts` (`hubKindOf`) |
| 3 | Pays obligatoire, ville, type d'association (10), secteur d'entreprise (8) | Présent | oui | oui | `D:apps/diasporale_com/src/components/page-presentation-fields.tsx` ; `A:packages/social-domain/src/pagePresentation.ts` |
| 4 | Modifier nom, sigle, description, pays, ville, catégorie ; logo et bannière sous la garde des fichiers | Présent | oui | oui | `D:apps/diasporale_com/src/components/page-identity-form.tsx` ; `A:convex/modules/pages/identity.ts` |
| 5 | Recadrer le logo ou la bannière avant l'envoi | Absent | non | non | motifs : `crop`, `recadr`, `canvas` dans le formulaire d'identité |
| 6 | Historique d'identité (anciens noms) | Partiel : écrit à chaque changement, lu par aucune fonction, montré nulle part ; la confiance ne bouge pas quand une page vérifiée se renomme | non | écriture seule | `A:convex/modules/pages/identity.ts` (`updatePageIdentity`) ; motifs : `pageIdentityHistory` hors écriture et effacement |
| 7 | Changer l'adresse d'une page | Absent ici ; le moteur l'a, en console, sans écran | non | oui | `A:convex/modules/pages/admin.ts` (`setPageHandle`) |
| 8 | Rubrique « À propos », lien vers les pages du même type ou secteur | Présent | oui | oui | `D:apps/diasporale_com/src/components/page-about.tsx` |
| 9 | Horaires, site, bouton d'action configurable | Absent | non | non | motifs : `openingHours`, `website`, `callToAction` ; `A:convex/modules/pages/tables.ts` (« sans adresse ni coordonnée de contact ») |
| 10 | Mettre en sommeil ou fermer sa page | Absent ici ; le moteur l'a pour l'opérateur seul | non | oui | `A:convex/modules/pages/admin.ts` (`setPageStatus`) |
| 11 | Prévenir les pages en double, les fusionner | Absent | non | non | motifs : `duplicate`, `doublon`, `merge`, `similarPages` |
| 12 | Pages liées : fédération, antennes par ville | Absent | non | non | motifs : `parentPageId`, `linkedPage`, `relatedPage`, `antenne` |
| | **Confiance et revendication** | | | | |
| 13 | Badge calculé (Officiel, Vérifié, Communauté) sur la fiche et les cartes | Présent | oui | oui | `D:packages/diasporale-features/src/components/trust-badge.tsx` |
| 14 | Demander la vérification de sa page : une à cinq pièces privées, mandat déclaré, consentement | Présent | oui | oui | `D:apps/diasporale_com/src/components/page-claim-form.tsx` ; `A:convex/modules/pages/claims.ts` (`requestPageClaim`) |
| 15 | Revendiquer une page sans administrateur vivant | Fermé : aucune page importée n'existe (DG-009b) ; reste le cas d'une page abandonnée | oui | oui | `A:convex/modules/diaspora/hubPages.ts` (`isPageClaimableBy`) |
| 16 | Suivre sa demande, la retirer (pièces purgées) | Présent | oui | oui | `D:apps/diasporale_com/src/components/my-pages-panel.tsx` ; `A:convex/modules/pages/claims.ts` (`withdrawPageClaim`) |
| 17 | Instruire : file, pièces servies par la garde, décision motivée | Fermé hors démonstration : seul le rôle `network_admin` ou `network_moderator` tranche, et aucune fonction ne pose ce rôle hors des comptes de démonstration | oui, dans « Mon activité » | oui | `D:apps/diasporale_com/src/components/page-claim-review.tsx` ; `A:convex/modules/pages/claims.ts` (`decidePageClaim`) ; `A:convex/modules/platform/audit.ts` (`networkRoleCapacity`) ; `A:convex/modules/diaspora/demoAccounts.ts` |
| 18 | Instruction par le modérateur du pays, au bureau `/moderation` | Absent | non | non | motifs : `claim`, `revendic` dans `A:convex/modules/diaspora/moderationDesk.ts` |
| 19 | Avis de décision au demandeur | Absent | non | non | motifs : `page_claim` dans `A:packages/social-domain/src/notifications.ts` |
| 20 | Purge des pièces d'une demande tranchée | Absent : gardées sans échéance, la purge n'existe qu'au retrait | — | non | `A:convex/modules/pages/claims.ts` (`purgeClaimEvidence`) |
| 21 | Reprendre une page vérifiée restée sans administrateur | Absent ici ; le moteur l'a, sans écran | non | oui | `A:convex/modules/pages/admin.ts` (`grantPageAdmin`) |
| | **Équipe** | | | | |
| 22 | Rôles administrateur et signataire, cinquante personnes au plus | Présent | oui | oui | `D:apps/diasporale_com/src/components/page-team-panel.tsx` ; `A:packages/social-domain/src/pages.ts` |
| 23 | Inviter par identifiant ; l'invitation ne vaut qu'acceptée ; accepter ou décliner | Présent | oui | oui | `A:convex/modules/pages/signatories.ts` (`grantPageRole`, `respondToPageInvitation`) |
| 24 | Avis d'une invitation à signer | Absent : la personne ne la voit qu'en ouvrant « Mon activité » | non | non | motifs : `page_signatory`, `page_invite` dans les genres de la cloche |
| 25 | Changer un rôle, retirer, se retirer ; dernier administrateur protégé | Présent | oui | oui | `A:convex/modules/pages/signatories.ts` (`revokePageRole`) |
| 26 | Transfert guidé de la page | Partiel : possible en deux gestes (nommer, puis partir) | partiel | oui | `D:apps/diasporale_com/src/components/page-team-panel.tsx` |
| 27 | Rôles éditeur et modérateur | Absent | non | non | motifs : `editor`, `moderator` dans `PAGE_ROLES` |
| 28 | Retirer un commentaire sous une publication de sa page | Partiel : seul le signataire qui a écrit la publication le peut, pas un autre responsable | partiel | partiel | `A:convex/modules/engagement/engagement.ts` (`removeComment`) |
| | **Suivre et découvrir** | | | | |
| 29 | Suivre, ne plus suivre ; compteur réel ; mes pages suivies paginées | Présent | oui | oui | `D:apps/diasporale_com/src/screens/page-screen.tsx` ; `A:convex/modules/pages/pages.ts` (`follow`, `paginateMyPageFollows`) |
| 30 | Annuaire : recherche, pays, nature, type, secteur ; filtres gardés dans l'adresse | Présent | oui | oui | `D:apps/diasporale_com/src/components/page-directory.tsx` ; `D:apps/diasporale_com/src/lib/routes.ts` |
| 31 | Filtre par ville, tri de l'annuaire | Absent : ordre fixe, confiance puis récence | non | non | motifs : `city`, `sort` dans `D:packages/diasporale-features/src/data/pages-port.ts` |
| 32 | Partager une page ou une rubrique (lien, copie, partage du système) | Présent | oui | — | `D:apps/diasporale_com/src/components/page-share-button.tsx` ; `D:apps/diasporale_com/src/lib/page-content.ts` |
| 33 | Code QR de la page, envoi dans iCom | Absent | non | non | motifs : `qr`, `icom` dans le bouton de partage |
| 34 | Avis d'une publication d'une page suivie | Partiel : le moteur diffuse `page_post`, la cloche de DIASPORALE le dit « nouvelle activité » | partiel | oui | `A:convex/modules/pages/pages.ts` (`publishAsPage`) ; `D:packages/diasporale-features/src/components/notification-bell.tsx` |
| 35 | Sourdine d'une page suivie | Absent | non | non | motifs : `mutePage`, `pageMute` |
| 36 | Signaler une page | Absent ici ; le moteur admet la cible `page` | non | oui | `A:convex/modules/moderation/tables.ts` ; `D:packages/diasporale-features/src/data/content-reports-port.ts` (neuf natures, pas la page) |
| 37 | Lire une page sans compte | Fermé par décision (réseau fermé ; ADR-0034, décision 7) | non | non | plan 07 du moteur, § 2 |
| | **Parole de la page** | | | | |
| 38 | Publier au nom de la page : texte, photos, vidéo, brouillon par personne et par page | Présent | oui | oui | `D:apps/diasporale_com/src/components/page-publications.tsx` ; `D:apps/diasporale_com/src/data/engine-page-publications.ts` |
| 39 | Audience « tous les membres » ou « abonnés » ; portée locale ou diaspora | Présent | oui | oui | `A:packages/social-domain/src/pages.ts` (`PAGE_POST_AUDIENCES`) |
| 40 | Audience « adhérents » pour une publication de page | Absent | non | non | motifs : audience `association` hors évènements |
| 41 | Communiqué lu aussi depuis ANTSIA (règle `root` de la page) | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/pages/pages.ts` (`createPage`, argument `visibility`) ; l'adaptateur ne le passe pas |
| 42 | Modifier le texte (version figée), retirer, épingler une annonce | Présent | oui | oui | `D:apps/diasporale_com/src/components/page-post-editor.tsx` ; `D:apps/diasporale_com/src/components/page-post-pin.tsx` |
| 43 | Onglets Publications, Photos, Vidéos, Avis ; lien de rubrique | Présent | oui | oui | `D:apps/diasporale_com/src/components/page-content-views.tsx` |
| 44 | Publications programmées, statuts (stories) de la page | Absent | non | non | lots PG-13 et SD-20 du moteur, à faire |
| 45 | Statistiques d'audience | Absent au-delà de deux compteurs réels (abonnés, publications) | non | non | lot PG-11 du moteur, à faire |
| 46 | Décisions de modération visant la page, recours | Présent | oui | oui | `D:apps/diasporale_com/src/components/page-decisions-panel.tsx` |
| 47 | « Écrire » à une page | Absent : bouton montré désactivé (« bientôt ») sur une page non prestataire ; rien sur une association sans offre | non | non | `D:apps/diasporale_com/src/screens/page-screen.tsx` ; `D:packages/diasporale-features/src/components/community-controls.tsx` (`ContactButton`) |
| | **Adhésion associative** | | | | |
| 48 | Demander avec un mot, annuler, quitter ; « Mes associations » | Présent | oui | oui | `D:apps/diasporale_com/src/components/association-membership-entry.tsx` ; `A:convex/modules/diaspora/associations.ts` |
| 49 | Accepter, refuser (nouvelle demande après sept jours), exclure avec motif, autoriser à redemander | Présent | oui | oui | `D:apps/diasporale_com/src/screens/association-screens.tsx` ; `D:packages/diasporale-domain/src/associations.ts` |
| 50 | Rôle d'animateur | Présent | oui | oui | `A:convex/modules/diaspora/associations.ts` (`setAssociationMemberRole`) |
| 51 | Listes des demandes, des adhérents et des exclusions, réservées aux responsables, paginées | Présent | oui | oui | `A:convex/modules/diaspora/associations.ts` (`associationMembers`) |
| 52 | Avis neutres : demande reçue, acceptée, refusée, exclusion | Présent | oui | oui | `A:convex/modules/diaspora/serviceNotifications.ts` |
| 53 | Chercher un adhérent, afficher l'effectif | Absent | non | non | motifs : `query`, `memberCount` dans `D:packages/diasporale-features/src/data/associations-port.ts` |
| 54 | Questions à l'adhésion | Absent | non | non | motifs : `joinQuestion`, `membershipQuestion` |
| 55 | Bureau affiché (présidence, trésorerie, secrétariat) | Absent | non | non | motifs : `president`, `treasurer`, `officer`, `bureau` |
| 56 | Message à tous les adhérents | Absent | non | non | ni audience « adhérents », ni avis d'une publication de groupe (ligne 62) |
| 57 | Documents partagés (statuts, comptes rendus) | Absent | non | non | motifs : `document`, `sharedFile`, `pageFile` |
| 58 | Cotisation, assemblée générale, vote, registre légal | Absent, écarté (§ 4.6) | non | non | `D:packages/diasporale-domain/src/associations.ts` (en-tête) |
| 59 | Inviter une personne à adhérer | Absent : une adhésion naît toujours d'une demande | non | non | motifs : `inviteToAssociation` |
| | **Groupe privé d'association** | | | | |
| 60 | Créer (administrateur, un seul par page), entrer volontairement, quitter | Présent | oui | oui | `D:apps/diasporale_com/src/components/association-group.tsx` ; `A:convex/modules/diaspora/associationGroups.ts` |
| 61 | Mur de texte ; retrait par l'auteur ou un responsable | Présent | oui | oui | `A:convex/modules/diaspora/associationGroups.ts` (`posts`) |
| 62 | Avis d'une nouvelle publication aux membres du groupe | Absent | non | non | `A:convex/modules/notifications/fanout.ts` : aucune source « membres d'un groupe » |
| 63 | Médias, réactions, commentaires, épingle | Absent ici ; le moteur les a pour tout groupe | non | oui | `A:convex/modules/thematicGroups/thematicGroups.ts` (`groupWall`, `pinGroupPost`) |
| 64 | Signaler une publication du groupe | Absent ici ; le moteur admet la cible `post` | non | oui | le mur minimal n'emploie pas le menu des publications |
| 65 | Fermer le groupe | Présent | oui | oui | `A:convex/modules/thematicGroups/thematicGroups.ts` (`closeGroup`) |
| 66 | Rouvrir un groupe fermé | Absent : la fermeture est sans retour, la suppression est refusée, et la page n'a droit qu'à un groupe | non | non | `A:convex/modules/thematicGroups/thematicGroups.ts` (`deleteGroup`) ; motifs : `reopen`, `closedAt: undefined` |
| 67 | Liste des membres du groupe | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/thematicGroups/thematicGroups.ts` (`paginateMembers`) |
| 68 | Discussion instantanée ou appel du groupe | Absent | non | non | les conversations de groupe sont un autre module : `A:convex/modules/groups/threads.ts` |
| | **Groupes thématiques ouverts (DS-09)** | | | | |
| 69 | Annuaire par pays, recherche, « Mes groupes » | Absent ici ; le moteur l'a (vitrine bornée à trente groupes) | non | oui | `A:convex/modules/thematicGroups/thematicGroups.ts` (`discover`, `myGroups`) ; aucune route de groupe dans `D:apps/diasporale_com/src/lib/routes.ts` hors celle de l'association |
| 70 | Créer un groupe sans page, rejoindre librement, quitter, inviter une relation | Absent ici ; le moteur l'a et l'accepte sur ce réseau | non | oui | `A:convex/modules/thematicGroups/thematicGroups.ts` (`create`, `join`, `invite`) |
| 71 | Rôles propriétaire, modérateur, membre ; mur ; épingle ; retrait | Absent ici ; le moteur l'a | non | oui | `A:packages/social-domain/src/thematicGroups.ts` |
| 72 | Fermer, archiver, supprimer un groupe | Absent ici ; le moteur l'a, sans écran même dans ANTSIA | non | oui | `A:convex/modules/thematicGroups/thematicGroups.ts` (`archiveGroup`, `deleteGroup`) |
| 73 | Règles, adhésion sur demande, questions, validation des publications, transfert de propriété | Absent | non | non | lots PG-02 et PG-07 du moteur, à faire |
| 74 | Signaler un groupe | Absent | non | non | aucune cible `thematicGroup` : `A:packages/social-domain/src/moderationPolicy.ts` (lot MC-01 du moteur) |
| | **Transverse** | | | | |
| 75 | Fournisseur de démonstration à parité : pages, gestion, publications, décisions, adhésions, groupe | Présent | oui | — | `D:packages/diasporale-features/src/demo/page-admin.ts` ; `D:packages/diasporale-features/src/demo/associations.ts` ; `D:packages/diasporale-features/src/demo/association-activities.ts` |
| 76 | Export et effacement des pages, rôles, revendications, adhésions, groupes | Présent | plan 13 | oui | `A:convex/modules/people/dataPolicies.ts` |
| 77 | Application mobile | Absent | non | — | plan 16 |

Décompte : **Présent 28 · Partiel 5 · Absent 41 · Fermé 3**.

### Ce que le moteur sait déjà faire et que DIASPORALE ne montre pas

- **Les groupes thématiques entiers** : créer, découvrir par pays, rejoindre, inviter, rôles, mur avec médias, réactions et commentaires, épingle, fermer, archiver, supprimer. DIASPORALE n'en emploie qu'un sous-ensemble, pour le groupe d'association.
- **Signaler une page** (cible `page`) et **une publication de groupe** (cible `post`) : le moteur les accepte, le port de DIASPORALE ne connaît que neuf natures `diaspora…`.
- **Deux avis** : `page_post` (une page suivie a publié) et `thematic_group_invite` existent ; la cloche de DIASPORALE ne les nomme pas.
- **La règle `root` d'une page** (communiqués lus aussi depuis ANTSIA) et **la liste des membres d'un groupe**.
- **Quatre gestes d'opérateur** sur une page : statut, confiance, adresse, administrateur de secours. La console n'a d'écran que pour le premier (`A:apps/admin_antsia_ga/src/components/console-pages.tsx`).

### Ce qui est écrit mais jamais recetté en réel

| Parcours | État | Source |
|---|---|---|
| Créer une page d'entreprise et une page d'association | Joué une fois, backend local, le 19/10 (compte fictif Brice OBIANG) | `D:docs/recette/deux-comptes-2026-10-19/README.md` |
| Revendication : dépôt des pièces, file, décision, badge qui change | Jamais joué | `D:docs/18_EXECUTION_VAGUE_G.md` |
| Équipe : invitation, acceptation, rôle retiré pendant la session (R-G11) | Jamais joué | idem |
| Adhésion : demande, décision, exclusion, départ (R-G10, R-G14) | Jamais joué | idem |
| Groupe : création concurrente, entrée volontaire, fermeture | Jamais joué ; écran jamais vu avec les couleurs | `D:docs/21_GROUPES_EVENEMENTS_ASSOCIATIONS_DG010.md` ; `D:docs/recette/couleurs-par-famille-2026-11-03/RAPPORT.md` |
| Publications de page : modifier, épingler, onglets, lien de rubrique ; annuaire par type et secteur | Écrits « sans test ni recette » le 18/10 ; tests présents depuis, aucune recette | `D:docs/20_GESTION_PUBLICATIONS_PAGES.md` ; `D:docs/25_ANNUAIRE_PAR_TYPE_ET_SECTEUR.md` |
| Effacement du seul administrateur d'une page | Jamais joué | docs/14 de DIASPORALE, R-G19 |

## 3. Comparaison avec les applications de référence

Légende : oui ; non ; « — » sans objet ; « ? » incertain.

| Capacité | Pages Facebook | Groupes Facebook | Pages LinkedIn | HelloAsso | AssoConnect | Communautés WhatsApp | Discord | DIASPORALE | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Créer la page d'une organisation | oui | — | oui | oui | oui | — | — | oui, membre vérifié seulement | Déjà fait, plus strict |
| Vérification gratuite sur pièces | non (abonnement) | — | oui ? | oui | ? | — | ? | oui, mais non décidable en production | À adapter (AS-01) |
| Rôles différenciés | oui | administrateur, modérateur | oui | oui ? | oui | administrateurs | oui, fins | administrateur, signataire | À faire (AS-10) |
| Invitation d'un co-gestionnaire avec avis | oui | oui | oui | ? | oui ? | oui | oui | oui, sans avis | À faire (AS-06) |
| Transfert de propriété guidé | ? | oui ? | oui | ? | ? | oui ? | oui | deux gestes | À adapter (AS-10) |
| Fermer ou désactiver sa présence | oui | oui (pause, archive) | oui | ? | ? | oui | oui | non | À faire (AS-11) |
| Messagerie de l'organisation | oui | — | oui | non | courriels | — | — | non | À faire (AS-07) |
| Publications programmées | oui | oui | oui | — | — | non | non ? | non | À faire (AS-13) |
| Statistiques | oui | oui | oui | collectes | oui | non | oui | deux compteurs | À faire (AS-13) |
| Horaires, adresse, site | oui | — | site | oui ? | site | — | — | ville seule | À adapter (AS-16) ; coordonnées écartées (invariant 6) |
| Annuaire par lieu et catégorie | oui | oui | oui | oui | non ? | non | oui | pays, nature, type, secteur | À adapter (AS-16) |
| Anciens noms visibles | oui | oui | ? | — | — | — | — | écrits, jamais montrés | À faire (AS-04) |
| Fusion des doublons | oui | — | ? | — | — | — | — | non | À adapter (AS-05) ; fusion écartée |
| Présences liées (antennes, vitrines) | ? | groupe lié à une page | oui | — | — | groupes d'une communauté | — | non | À faire (AS-15) |
| Signaler la présence | oui | oui | oui | ? | — | oui | oui | non | À faire (AS-02) |
| Badge payant | oui | — | non ? | — | — | — | — | non | Écarté (badge jamais payant) |
| Suivre sans adhérer | oui | — | oui | — | — | — | — | oui, deux gestes distincts | Déjà fait |
| Adhésion avec formulaire | — | questions | — | oui | oui | approbation | filtrage | demande et mot libre | À adapter (AS-14) |
| Cotisation encaissée | — | — | — | oui | oui | — | abonnements | non | Écarté (D-G03) ; suivi déclaratif AS-19 |
| Fichier des adhérents : recherche, export | — | liste | — | oui | oui | liste | liste | liste paginée, responsables seuls | À adapter (AS-14) |
| Bureau et rôles associatifs | — | — | — | ? | oui ? | — | rôles | non | À faire (AS-14) |
| Message à tous les adhérents | — | oui | — | ? | oui | oui (annonces) | oui | non | À faire (AS-09) |
| Documents partagés | — | oui | — | non ? | oui ? | oui | oui | non | Reporté (AS-17) |
| Assemblée générale, vote | — | sondages | — | non ? | ? | sondages | sondages | non | Écarté (docs/14 G3) ; sondages du moteur (FP-15) |
| Dons, reçus fiscaux, comptabilité | — | — | — | oui | oui | — | — | non | Écarté (paiement fermé) |
| Exclusion motivée, départ libre | — | oui, sans motif exigé | — | — | oui ? | oui | oui | oui, motif obligatoire | Déjà fait, plus protecteur |
| Groupe ouvert à l'adhésion libre | — | oui | — | — | — | sur lien | oui | non | À faire (DS-09) |
| Groupe privé ; groupe masqué | — | oui ; oui | — | — | — | privé | oui ; oui | privé d'association ; masqué non | Déjà fait ; masqué écarté |
| Questions d'adhésion, approbation | — | oui | — | — | — | oui | oui | non | À faire (AS-12) |
| Règles affichées | — | oui | — | — | — | description | oui | non | À faire (AS-12) |
| Validation des publications | — | oui | — | — | — | administrateurs seuls | ? | non | À faire (AS-12) |
| Médias, réactions, commentaires dans le groupe | — | oui | — | — | — | oui | oui | texte seul | À faire (AS-08) |
| Annonce épinglée du groupe | — | oui | — | — | — | oui | oui | non ici | À faire (AS-08) |
| Avis d'une nouvelle publication | — | oui | — | — | — | oui | oui | non | À faire (AS-09) |
| Rouvrir un groupe mis en pause | — | oui | — | — | — | ? | — | non, fermeture sans retour | À faire (AS-03) |
| Sous-groupes | — | non ? | — | — | — | oui | salons | non | Écarté au pilote |
| Discussion instantanée, appel | — | oui | — | — | — | oui | oui | non | Reporté (AS-18, plan 04) |
| Plafond de membres | — | très élevé | — | — | — | ? | très élevé | aucun pour un groupe thématique ; 256 pour une conversation | À adapter (décision 4) |

## 4. Ce qui manque

### 4.1 Bloquant avant l'ouverture du pilote

1. **Aucune revendication ne peut être tranchée en production.** La décision exige un rôle de réseau que seuls les comptes de démonstration reçoivent ; le lot EX-08 du moteur prévoit de refuser les réseaux gouvernés par une tranche. Le badge « Vérifié » d'une page est donc hors d'atteinte, et les associations importées ne pourront pas être reprises (AS-01 ; nomination des responsables au plan 14).
2. **Une page ne se signale pas**, une publication du groupe d'association non plus, alors que le cahier veut tout contenu signalable (EXF-DG-40) et que le moteur accepte déjà ces deux cibles (AS-02).
3. **Créer une page exige le statut « vérifiée »**, que donnent seulement l'attestation consulaire (fermée) ou IDN de niveau 2 avec un parrain lui-même vérifié depuis trente jours. Au premier jour, personne ne peut créer de page. Ce verrou appartient au plan 01 (DG-009a) ; il conditionne tout ce plan.
4. **L'annuaire est vide** tant que l'import public n'a pas eu lieu (plan 15, DG-009b).
5. **Rien n'a été recetté en mode moteur** au-delà de la création d'une page (volet DS-05 au § 6).

### 4.2 Fonctions attendues qui manquent

- Les groupes thématiques ouverts, prévus en V1 par le cahier (DS-09).
- « Écrire » à une page : une association sans offre de service est injoignable (AS-07).
- Prévenir ses adhérents : ni audience, ni avis (AS-09).
- Un groupe d'association qui porte des photos, des réactions et des commentaires (AS-08).
- Les rôles éditeur et modérateur, le retrait d'un commentaire par tout responsable (AS-10).
- Fermer sa page quand l'association se dissout (AS-11).
- Les avis d'invitation à signer et de décision de revendication (AS-06).

### 4.3 Options qui manquent sur ce qui existe

| Écran | Option absente | Lot |
|---|---|---|
| Créer une page | Pages au nom proche avant de créer ; recadrage du logo ; natures cohérentes avec l'annuaire | AS-05 |
| Équipe | Transfert guidé ; avis à la personne invitée | AS-10, AS-06 |
| Revendication | Avis de décision ; file par pays ; échéance de conservation des pièces | AS-01 |
| Fiche | Anciens noms ; signaler ; horaires ; bouton d'action | AS-04, AS-02, AS-16 |
| Annuaire | Ville, tri, sourdine d'une page suivie | AS-16 |
| Publications de page | Audience « adhérents » ; règle « aussi sur ANTSIA » ; programmation | AS-09, décision 2 du plan 03, AS-13 |
| Adhérents | Recherche, effectif, questions à l'adhésion | AS-14 |
| Groupe d'association | Rouvrir, épingler, signaler, liste des membres | AS-03, AS-08, AS-02 |

### 4.4 Améliorations de l'existant

- **Un bouton « Écrire » désactivé, marqué « bientôt »**, sur les pages non prestataires : la règle du propriétaire interdit le bouton qui mène à une fonction vide. Le retirer tant que le plan 04 n'a pas livré la conversation de page.
- **La fermeture du groupe est un piège** : sans retour, sans suppression, sans second groupe possible.
- **L'historique d'identité est écrit pour personne** : la promesse « une page vérifiée qui se renomme le fait au grand jour » n'est tenue par aucun écran.
- **La file d'instruction est rangée dans « Mon activité → Pages »**, loin du bureau de modération où le modérateur travaille.
- **Deux natures sans suite** : une page « média » ou « communauté » se crée, puis n'apparaît dans aucune liste du hub ni aucun filtre.

### 4.5 Ce qui distingue DIASPORALE

- **Suivre n'est pas adhérer**, et personne n'est inscrit d'office : aucune référence ne sépare aussi nettement les deux gestes.
- **Des droits vivants** : un rôle retiré ferme l'écran et le serveur dans la même seconde.
- **Une vérification gratuite, sur pièces privées**, lue par la modération seule ; jamais de badge payant.
- **Une exclusion motivée**, un refus suivi de sept jours d'attente, une réadmission décidée : l'adhésion est tenue comme un acte, pas comme un clic.
- **Aucune coordonnée, aucune liste d'adhérents publique** ; des avis sans contenu.
- **Le pays comme contexte** : annuaire, hub et portée des publications suivent le pays de la page.

### 4.6 Écarté ou reporté, et pourquoi

| Sujet | Décision | Raison |
|---|---|---|
| Cotisation encaissée, dons, billetterie, reçus fiscaux | Écarté | Paiement fermé (D-G03) ; lot D4 au plan 17 |
| Assemblée générale, vote, registre légal d'adhérents | Écarté | docs/14 G3 : pas sans spécification dédiée |
| Coordonnées publiques d'une page (téléphone, adresse, courriel) | Écarté | Invariant 6 : le contact passe par la messagerie |
| Badge de vérification payant, classement payé | Écarté | Règle du programme |
| Groupes cachés | Écarté | Un groupe invisible échappe à la modération (plan 07 du moteur, décision 3) |
| Sous-groupes, communauté de groupes | Écarté au pilote | Aucune demande exprimée ; complexité de modération |
| Fusion de pages | Écarté | Prévenir le doublon suffit ; un retrait passe par la modération |
| Lecture d'une page sans compte | Reporté | Réseau fermé ; ADR-0034, décision 7 |
| Page premium d'association ou d'entreprise | Reporté | Lot PG-16 du moteur et plan 17 |
| Statuts d'une page, sondages | Reporté | Lots SD-20 et FP-15 du moteur |

## 5. Lots d'implémentation

Rappel de zone : S2 écrit dans le dépôt DIASPORALE et, dans ANTSIA, dans `convex/modules/diaspora/` seulement. Les modules `pages`, `thematicGroups`, `moderation`, `notifications`, `engagement`, les seaux de débit et l'inventaire des données appartiennent à S1 : chaque besoin y devient une issue `[S1]`.

### AS-01 — Trancher une revendication en production, par pays · P0 · M · S2
- **Pour l'utilisateur** : la présidente d'une association dépose ses pièces et reçoit une décision motivée du modérateur de son pays ; la page devient « Vérifié ».
- **Backend** : aujourd'hui `decidePageClaim` et `paginatePageClaims` n'admettent que le rôle de réseau, jamais posé hors démonstration. Issue `[S1]` : admettre le membre actif d'une équipe de modération du réseau (la règle de `teamCapacity`), jamais un signataire de la page jugée ; filtrer la file par pays de la page ; purger les pièces après l'échéance de la décision 10.
- **Web** : déplacer la file de « Mon activité » vers le bureau `/moderation`, onglet « Pages à vérifier » (plan 14) ; garder « Mes revendications » où elles sont ; fragment de textes fr et en du chantier ; fournisseur de démonstration aligné.
- **Mobile** : après le web (plan 16).
- **Données personnelles** : pièces lues par la modération et le demandeur seuls ; échéance de purge écrite dans l'inventaire.
- **Tests et cliquets** : décideur hors équipe refusé de façon indistincte ; signataire de la page refusé ; `network-scoped-functions` ; `notification-payload-content`.
- **Critères d'acceptation** : en mode moteur, comptes `entreprise` (demandeur) et `moderateur` : dépôt, file, décision motivée, badge changé pour un tiers, pièces illisibles après l'échéance.
- **Dépend de** : plan 14 (nommer responsables et équipes, onglet du bureau) ; PG-01 du moteur (cloche de décision).
- **Porte** : durée de conservation des pièces (juriste).

### AS-02 — Signaler une page, un groupe et ses publications · P0 · S · S2
- **Pour l'utilisateur** : « Signaler » sur la fiche d'une page et sur chaque publication d'un groupe.
- **Backend** : rien pour la page et la publication (cibles `page` et `post` admises). Le groupe lui-même attend la cible `thematicGroup` du lot MC-01 (S1).
- **Web** : étendre les natures du port des signalements (plan 14) ; geste dans un menu de la fiche, jamais en bouton plein ; même feuille, mêmes motifs fermés, même accusé que SU01d.
- **Mobile** : après le web.
- **Données personnelles** : le déclarant n'est jamais montré ; « Mes signalements » couvre ces cibles.
- **Tests et cliquets** : on ne signale pas sa propre page ; la cible disparaît pour le déclarant ; le dossier arrive dans la zone du pays de la page.
- **Critères d'acceptation** : à deux comptes, une page signalée entre au bureau avec son pays ; un responsable de la page ne voit pas qui a signalé.
- **Dépend de** : plan 14 ; MC-01 pour le groupe.
- **Porte** : aucune.

### AS-03 — Rouvrir le groupe d'une association · P1 · S · S2
- **Pour l'utilisateur** : un administrateur qui a fermé le groupe peut le rouvrir.
- **Backend** : ajouter dans `A:convex/modules/diaspora/associationGroups.ts` une réouverture réservée à l'administrateur vivant de la page (groupe non archivé, non en suppression), versionnée et journalisée.
- **Web** : bouton « Rouvrir » en `outline` ; la confirmation de fermeture dit ce qui se ferme et que c'est réversible ; démonstration alignée.
- **Mobile** : après le web.
- **Données personnelles** : aucune nouvelle.
- **Tests et cliquets** : fermer puis rouvrir rend le mur et les droits ; un signataire non administrateur ne rouvre pas ; un adhérent exclu entre-temps reste dehors.
- **Critères d'acceptation** : aucun chemin ne laisse une association sans groupe possible.
- **Dépend de** : rien.
- **Porte** : aucune.

### AS-04 — Renommage d'une page vérifiée au grand jour · P1 · S · S2
- **Pour l'utilisateur** : sous le nom d'une page renommée, « Anciennement … » ; la modération est prévenue.
- **Backend** : une lecture dans la tranche (derniers noms et dates, sans acteur) à partir de l'historique que le moteur écrit déjà ; issue `[S1]` : un avis au bureau quand une page `verified` change de nom.
- **Web** : mention sous le titre pendant la durée de la décision 9 ; historique complet dans « À propos ».
- **Mobile** : après le web.
- **Données personnelles** : aucun nom de personne ; l'historique appartient à la page.
- **Tests et cliquets** : une page jamais renommée ne montre rien ; la mention disparaît à l'échéance.
- **Critères d'acceptation** : un lecteur voit l'ancien nom d'une page vérifiée renommée la veille.
- **Dépend de** : plan 14 pour l'alerte.
- **Porte** : aucune.

### AS-05 — Créer une page sans faux pas : natures servies, pages au nom proche · P1 · S · S2
- **Pour l'utilisateur** : avant de créer, voir les pages au nom proche de son pays et, si c'est la sienne, la revendiquer ; ne plus créer une page qui n'apparaîtra nulle part.
- **Backend** : aucun (recherche de l'annuaire existante).
- **Web** : dans le formulaire, lecture de l'annuaire sur le nom saisi ; natures offertes selon la décision 2 ; recadrage simple du logo.
- **Mobile** : après le web.
- **Données personnelles** : aucune.
- **Tests et cliquets** : nom déjà pris montré avant l'envoi ; nature écartée refusée par l'écran comme par l'adaptateur.
- **Critères d'acceptation** : créer « Association des Gabonais de Lyon » quand elle existe propose d'abord de la revendiquer.
- **Dépend de** : décision 2.
- **Porte** : aucune.

### AS-06 — Cloches de la vie d'une page et d'un groupe · P1 · S · S2
- **Pour l'utilisateur** : être prévenu d'une invitation à signer, de la décision sur sa revendication, d'une publication d'une page suivie, d'une invitation à un groupe.
- **Backend** : les deux premiers genres viennent de PG-01 (S1) ; les deux autres existent.
- **Web** : nommer ces quatre genres dans la cloche (plan 13), chacun ouvrant son objet ; aucun nom de page ni texte dans l'avis.
- **Mobile** : push au plan 16.
- **Données personnelles** : avis neutres.
- **Tests et cliquets** : `notification-payload-content` ; un avis résolu ne reste pas « non lu ».
- **Critères d'acceptation** : une invitation à signer sonne et mène à « Mes invitations ».
- **Dépend de** : PG-01 ; plan 13.
- **Porte** : aucune.

### AS-07 — « Écrire » à une page · P1 · M · S2
- **Pour l'utilisateur** : écrire à une association ou à une entreprise depuis sa fiche, sans coordonnée ; la page répond en son nom.
- **Backend** : celui du plan 04 (conversation attachée à la page, voix de page).
- **Web** : étape 1, tout de suite : retirer le bouton désactivé. Étape 2 : brancher l'entrée de conversation sur la fiche et la boîte de réception de la page dans sa gestion.
- **Mobile** : après le web.
- **Données personnelles** : messages dans l'export et l'effacement du plan 04.
- **Tests et cliquets** : `contextual-hooks` ; un rôle retiré perd la boîte de réception.
- **Critères d'acceptation** : aucune fiche ne montre un bouton sans fonction ; un membre écrit, un signataire répond en voix de page.
- **Dépend de** : plan 04.
- **Porte** : ouverture de la politique de conversation (plan 04).

### DS-09 — Groupes thématiques ouverts par pays · P1 · M · S2 · repris du plan 15
- **Pour l'utilisateur** : créer ou rejoindre « Gabonais de Lyon » ou « Parents de la diaspora », sans association porteuse.
- **Backend** : le moteur a tout et accepte un groupe sans page sur ce réseau. Ajouter dans la tranche une porte de création : pays ouvert, statut de la décision 3, seau de débit, idempotence. Issues `[S1]` : que la création générique délègue à cette porte sur un réseau gouverné (elle le fait déjà pour le groupe d'association) ; une découverte paginée (trente groupes au plus aujourd'hui, sans dire la lacune).
- **Web** : capacité de port, adaptateur moteur et démonstration ; routes des groupes dans la table des routes ; annuaire par pays, « Mes groupes », fiche avec mur rendu par les cartes du fil, fermer, archiver, supprimer ; entrée depuis Communautés (plan 06), aucune nouvelle destination ; « Rejoindre » en `social`.
- **Mobile** : après le web.
- **Données personnelles** : appartenances et invitations déjà à l'inventaire ; effacement d'un propriétaire à éprouver.
- **Tests et cliquets** : `network-scoped-functions`, `member-screens-full-width`, `no-hardcoded-urls` ; pays fermé refusé ; refus hors réseau.
- **Critères d'acceptation** : création, adhésion libre, départ, invitation d'une relation, épingle, retrait ; aucun groupe vide présenté comme actif ; aucun effectif inventé. Le plafond de 256 du plan 15 ne s'applique pas ici : il vaut pour les conversations (D-G08).
- **Dépend de** : AS-02 (signaler) ; décisions 3 et 4.
- **Porte** : ouverture au pilote après MC-01 du moteur.

### AS-08 — Groupe d'association : médias, réactions, commentaires, épingle · P1 · M · S2
- **Pour l'utilisateur** : partager les photos de la dernière rencontre, réagir, commenter, épingler la prochaine date.
- **Backend** : lire le mur par la fonction du moteur qui rend le format du fil, en gardant la garde d'association ; épingle par les fonctions existantes.
- **Web** : mur rendu par les cartes du fil et le composeur à médias, menu « Signaler » compris ; démonstration alignée ; choix de la décision 5.
- **Mobile** : après le web.
- **Données personnelles** : publications ordinaires, déjà effacées avec leur auteur.
- **Tests et cliquets** : un adhérent parti perd la lecture, y compris par l'adresse d'une publication ; médias sous la garde des fichiers.
- **Critères d'acceptation** : deux comptes adhérents échangent une photo et un commentaire ; l'épingle tient en tête.
- **Dépend de** : AS-02.
- **Porte** : aucune.

### AS-09 — Annonce aux adhérents · P1 · M · S2
- **Pour l'utilisateur** : le bureau écrit une fois ; chaque adhérent entré dans le groupe est prévenu.
- **Backend** : porte de tranche : publication dans le groupe, puis avis neutre aux membres vivants, par lots bornés, plafonnée selon la décision 7. Issue `[S1]` : le genre d'avis et le seau de débit.
- **Web** : « Annoncer aux adhérents » pour les responsables, dans le groupe ; l'avis ouvre le groupe.
- **Mobile** : push au plan 16.
- **Données personnelles** : avis sans titre ni contenu ; préférence de sourdine par association (plan 13).
- **Tests et cliquets** : un adhérent hors groupe n'est pas prévenu ; plafond tenu ; `notification-payload-content`.
- **Critères d'acceptation** : une annonce sonne chez deux adhérents du groupe, pas chez un abonné de la page.
- **Dépend de** : AS-08 ; plan 13.
- **Porte** : aucune.

### AS-10 — Équipe : éditeur, modérateur, transfert guidé, commentaires · P1 · M · S2
- **Pour l'utilisateur** : confier la publication sans la gestion, ou la modération sans la publication ; passer la main en un geste ; retirer un commentaire déplacé sous une publication de sa page.
- **Backend** : rôles du lot PG-08 et droit de retrait du lot SU01f (S1).
- **Web** : choix du rôle dans l'équipe ; « Transmettre la page » (nommer un administrateur, puis se retirer) ; « Retirer » sur un commentaire pour tout responsable.
- **Mobile** : après le web.
- **Données personnelles** : inchangé.
- **Tests et cliquets** : un modérateur ne publie pas ; un éditeur ne gère pas ; dernier administrateur toujours protégé.
- **Critères d'acceptation** : trois rôles visibles et respectés ; transfert joué à deux comptes.
- **Dépend de** : PG-08, SU01f.
- **Porte** : aucune.

### AS-11 — Fermer sa page ; page sans responsable · P1 · M · S2
- **Pour l'utilisateur** : une association dissoute retire sa page ; une page abandonnée le dit et se laisse reprendre.
- **Backend** : issue `[S1]` : mise en sommeil par un administrateur vivant, réversible selon la décision 8 ; reprise d'une page vérifiée orpheline par la console (PG-01). Côté tranche : retirer offres, emplois et évènements à venir.
- **Web** : « Mettre la page en sommeil » dans l'identité, confirmation qui liste les effets ; bandeau « Cette page n'a plus de responsable ».
- **Mobile** : après le web.
- **Données personnelles** : adhésions gardées jusqu'au retrait définitif, puis effacées.
- **Tests et cliquets** : page en sommeil absente du fil, de l'annuaire et des liens ; réactivation qui rend tout.
- **Critères d'acceptation** : aucune offre d'une page en sommeil n'est encore contactable.
- **Dépend de** : PG-01 ; plans 08, 09 et 10 pour leurs objets.
- **Porte** : décision 8.

### AS-12 — Groupes : règles, adhésion sur demande, validation des publications · P2 · M · S2
- **Pour l'utilisateur** : des règles lues avant d'entrer ; un groupe « sur demande » ; des publications validées si le propriétaire le veut.
- **Backend** : lots PG-02 et PG-07 du moteur.
- **Web** : écrans de DS-09 étendus ; file des demandes et des publications en attente.
- **Mobile** : après le web.
- **Données personnelles** : demandes et réponses exportées, purgées après refus.
- **Tests et cliquets** : un non-membre ne lit jamais une publication en attente.
- **Critères d'acceptation** : un groupe sur demande n'admet personne sans décision.
- **Dépend de** : DS-09, PG-02, PG-07.
- **Porte** : aucune.

### AS-13 — Statistiques honnêtes et publications programmées · P2 · M · S2
- **Pour l'utilisateur** : voir ses nouveaux abonnés et ses réactions ; préparer un communiqué pour une date.
- **Backend** : lots PG-11 et PG-13 du moteur.
- **Web** : onglets « Statistiques » et « Programmées » dans la gestion ; « non mesuré » plutôt qu'un zéro.
- **Mobile** : après le web.
- **Données personnelles** : aucune donnée d'un abonné identifiable.
- **Tests et cliquets** : chaque chiffre a sa source ; un rôle retiré avant l'échéance : rien ne paraît.
- **Critères d'acceptation** : aucun chiffre sans compteur réel.
- **Dépend de** : PG-11, PG-13, AS-10.
- **Porte** : aucune.

### AS-14 — Adhésion mieux tenue : bureau affiché, recherche, questions, effectif · P2 · M · S2
- **Pour l'utilisateur** : savoir qui préside ; retrouver un adhérent ; poser deux ou trois questions à l'entrée.
- **Backend** : dans la tranche : titres du bureau acceptés par la personne nommée, questions bornées, recherche par nom publié, effectif agrégé. Issue `[S1]` : inventaire et seaux.
- **Web** : bloc « Bureau » dans « À propos » ; champ de recherche et effectif dans la liste des adhérents.
- **Mobile** : après le web.
- **Données personnelles** : un titre n'est affiché qu'accepté, retiré à la demande ; réponses visibles des responsables seuls.
- **Tests et cliquets** : un titre non accepté n'apparaît pas ; aucune liste d'adhérents hors responsables.
- **Critères d'acceptation** : un titre refusé par la personne ne s'affiche jamais.
- **Dépend de** : retours du pilote.
- **Porte** : décision 12.

### AS-15 — Pages liées : fédération et antennes · P2 · M · S2
- **Pour l'utilisateur** : voir les associations d'une fédération, ou les antennes d'une association par ville.
- **Backend** : lien entre deux pages, proposé par l'une, accepté par l'autre, dans la tranche ; issue `[S1]` pour l'inventaire.
- **Web** : bloc « Antennes » ou « Membre de » sur la fiche.
- **Mobile** : après le web.
- **Données personnelles** : aucune.
- **Tests et cliquets** : un lien non accepté n'apparaît pas ; une page retirée sort du bloc.
- **Critères d'acceptation** : aucun lien affiché sans l'accord des deux pages.
- **Dépend de** : retours du pilote.
- **Porte** : aucune.

### AS-16 — Annuaire et fiche : ville, tri, horaires, bouton d'action · P2 · S · S2
- **Pour l'utilisateur** : filtrer par ville, trier par récence ; voir des horaires et un bouton utile.
- **Backend** : issue `[S1]` pour la ville dans l'annuaire ; lot PG-15 du moteur, sans coordonnées.
- **Web** : filtres de l'annuaire ; horaires et bouton d'une liste fermée (« Demander une prestation », « Écrire », « Voir les évènements »).
- **Mobile** : après le web.
- **Données personnelles** : aucune coordonnée.
- **Tests et cliquets** : un bouton sans capacité est refusé.
- **Critères d'acceptation** : aucun bouton ne mène à une fonction vide.
- **Dépend de** : PG-15, AS-07.
- **Porte** : aucune.

### DS-16 (volet adhésions) — Remontée dans le moteur des adhésions et du groupe d'adhérents · P2 · L · S1 · repris du plan 15
- **Pour l'utilisateur** : rien ne change dans DIASPORALE ; ANTSIA gagne les adhésions sans double code.
- **Backend** : lot PG-09 du moteur : règles pures de `D:packages/diasporale-domain/src/associations.ts` copiées dans le moteur, que DIASPORALE réexporte ; politique par réseau à la place de la garde de tranche.
- **Web** : adaptateurs repointés si les chemins changent ; sinon rien.
- **Mobile** : sans objet.
- **Données personnelles** : un seul inventaire d'effacement.
- **Tests et cliquets** : tests de la tranche verts sans retouche ; `no-cross-product-imports`.
- **Critères d'acceptation** : mêmes chemins d'appel côté DIASPORALE, ou migration écrite ; aucune adhésion perdue.
- **Dépend de** : pilote ; PG-03.
- **Porte** : décision 11.

### AS-17 — Documents partagés de l'association · P3 · M · S2
- **Pour l'utilisateur** : statuts et comptes rendus lisibles des adhérents.
- **Contenu** : nouvel usage de fichier sous la garde (issue `[S1]`), réservé aux adhérents acceptés, sans pièce d'identité.
- **Dépend de** : garde antivirus fermée (EX-17 du moteur).
- **Porte** : décision 12.

### AS-18 — Discussion instantanée d'une association ou d'un groupe · P3 · M · S2
- **Pour l'utilisateur** : échanger en direct entre adhérents, appeler à plusieurs.
- **Contenu** : conversation iCom adossée au groupe, membres volontaires, sans exiger une relation entre eux ; aucun fork d'iCom.
- **Dépend de** : plan 04 ; D-G08 (256).
- **Porte** : décision du plan 04.

### AS-19 — Suivi déclaratif des cotisations · P3 · S · S2
- **Pour l'utilisateur** : le trésorier note « à jour » ou non ; rien n'est encaissé.
- **Contenu** : une marque privée par adhérent, visible de l'adhérent et des responsables, sans effet sur aucun droit dans le réseau.
- **Dépend de** : AS-14.
- **Porte** : décision 12 ; avis du juriste sur cette donnée.

## 6. Ordre recommandé et dépendances

| Vague | Lots | Pourquoi dans cet ordre |
|---|---|---|
| 1 | AS-01, AS-02, AS-03 | La confiance s'obtient, l'abus se signale, le piège du groupe est fermé |
| 2 | AS-04, AS-05, AS-06 | Petits, visibles ; ils protègent le badge et évitent les doublons avant l'import |
| 3 | DS-09, AS-08, AS-09 | La vie de groupe, cœur de la fiche F08 et de l'usage associatif |
| 4 | AS-07, AS-10, AS-11 | Relation avec le public et gouvernance, dès que le moteur et le plan 04 ont livré |
| 5 | AS-12 à AS-16, DS-16 | Enrichissements, après les retours du pilote |
| 6 | AS-17 à AS-19 | Sous condition |

**Ce que ce plan attend des autres plans** : plan 01 (un statut « vérifiée » atteignable, sans quoi aucune page ne se crée) ; plan 04 (conversation de page) ; plan 06 (entrée des groupes dans Communautés et le hub) ; plan 08 (évènements d'une page mise en sommeil) ; plan 13 (cloche, sourdines) ; plan 14 (bureau, équipes, nomination des responsables du réseau, natures signalables) ; plan 15 (import des associations, pages officielles) ; plan 17 (campagne DS-05). Du moteur : PG-01, PG-02, PG-07, PG-08, PG-09, PG-11, PG-13, PG-15, MC-01, SU01f ; et une réponse sur EX-08, qui laisse aujourd'hui DIASPORALE sans moyen de nommer un responsable de réseau.

### Volet de recette en mode moteur (campagne DS-05)

Backend local, comptes de démonstration par acteur (`D:packages/diasporale-domain/src/demo-accounts.ts`). Chaque ligne se dit « fait » ou « non fait ».

| # | Comptes | Étapes | Résultat attendu |
|---|---|---|---|
| 1 | `entreprise`, `moderateur`, `verifie` | Demande de vérification avec deux pièces fictives ; instruction ; approbation motivée | Badge « Vérifié » vu par `verifie` ; refus motivé sur une seconde demande ; retrait qui purge les pièces |
| 2 | `association`, `verifie` | Invitation comme signataire ; acceptation ; publication au nom de la page ; rôle retiré pendant la session | Publication suivante refusée sans rechargement ; gestion fermée ; « Quitter » inerte pour le dernier administrateur |
| 3 | `declare`, `association`, `leger`, `belgique` | Demande d'adhésion avec un mot ; acceptation ; exclusion motivée ; nouvelle demande | Avis neutres reçus ; `leger` ne peut pas demander ; `belgique` ne voit aucune liste ; nouvelle demande refusée jusqu'à l'autorisation |
| 4 | `association`, `administrateur`, `declare` | Deux créations simultanées du groupe ; entrée volontaire ; texte publié ; départ de l'association | Un seul groupe ; aucun adhérent inscrit d'office ; mur fermé aussitôt, y compris par l'adresse directe |
| 5 | `association` (deux onglets) | Publier aux abonnés ; modifier depuis un second onglet ; épingler puis remplacer ; onglets Photos et Vidéos | Conflit dit, brouillon gardé ; une seule épingle ; lien de rubrique qui ouvre le bon onglet |
| 6 | `verifie` | Annuaire : France, associations, type culturel ; valeur inconnue dans l'adresse | La page de démonstration de Lyon paraît ; la valeur inconnue est ignorée |
| 7 | compte jetable, administrateur unique d'une page | Effacement du compte | Page conservée, sans responsable, revendicable ; aucune donnée d'un tiers exportée |

## 7. Décisions à prendre par le propriétaire

1. **Qui instruit une revendication ?** Recommandation : l'équipe de modération du pays de la page, avec recours au réseau, jamais un signataire de la page. Raison : c'est ce que dit le cahier (EXF-DG-21), et c'est le seul chemin praticable en production.
2. **Quelles natures de page un membre crée-t-il ?** Recommandation : association et entreprise au pilote ; « communauté » devient un groupe thématique ; « média » attend le label Presse du moteur. Raison : deux natures sont créables aujourd'hui sans aucune surface pour les servir.
3. **Qui crée un groupe thématique ouvert ?** Recommandation : les membres vérifiés au pilote, tous les membres déclarés après mesure. Raison : fiche F08, et modération par pays avant toute ouverture (invariant 10).
4. **Plafond d'un groupe thématique ?** Recommandation : aucun ; corriger le critère « 256 » du plan 15. Raison : c'est un lieu de publication ; D-G08 vise les conversations, et le moteur ne plafonne pas.
5. **Mur du groupe d'association : cartes du fil, avec l'auteur ouvrant son profil ?** Recommandation : oui. Raison : le profil garde ses propres règles de visibilité ; un second rendu de publication coûterait à maintenir.
6. **Liste des membres d'un groupe.** Recommandation : visible des membres d'un groupe ouvert, comme le fait le moteur ; jamais pour le groupe d'association, dont la liste reste aux responsables.
7. **Annonce aux adhérents : qui la reçoit, à quel rythme ?** Recommandation : les adhérents entrés dans le groupe, deux annonces par semaine et par association au plus. Raison : l'entrée volontaire est respectée, la cloche reste crédible.
8. **Fermer sa page : quel effet ?** Recommandation : mise en sommeil réversible trente jours par un administrateur, puis retrait par la modération. Raison : une erreur se rattrape ; un retrait définitif reste une décision tracée.
9. **Renommage d'une page vérifiée.** Recommandation : ancien nom montré quatre-vingt-dix jours et alerte au bureau. Raison : le badge ne doit pas servir une usurpation.
10. **Pièces d'une revendication : combien de temps ?** Recommandation : purge trente jours après la décision, délai de recours compris ; à faire valider par le juriste.
11. **Remonter les adhésions dans le moteur (DS-16, PG-09) ?** Recommandation : oui, après le pilote, comme la décision 6 du plan 15.
12. **Bureau affiché, documents partagés, suivi des cotisations.** Recommandation : bureau affiché après les premiers retours ; documents et cotisations pas au pilote. Raison : ce sont des données de personnes ; le besoin doit d'abord être exprimé par des associations réelles.

## 8. Risques et points d'attention

- **Fichiers hors zone** : AS-01, DS-09, AS-06, AS-09, AS-10 et AS-11 demandent chacun un changement de S1. Sans réponse, ils restent à l'état d'écran.
- **Usurpation** : une page vérifiée garde son badge en se renommant ; une vérification ne certifie jamais une compétence (docs/14 G9). AS-04 passe avant toute communication sur le badge.
- **Pièces privées** : statuts et mandats portent des noms, parfois des pièces d'identité ; elles sont gardées sans échéance.
- **Contournement générique** : tant que la création générique d'un groupe ne délègue pas à la porte de la tranche, un appel direct ignore la règle du pays ouvert.
- **Double interface des groupes** : DIASPORALE dessine ses propres écrans alors que le moteur a `A:packages/social-features/src/features/reseau-personnel/GroupsPanel.tsx` ; la divergence est à surveiller jusqu'à DS-16.
- **Annuaire vide au pilote** : sans import et sans membres vérifiés, aucune page. Ne rien montrer plutôt qu'un compteur à zéro.
- **Comptes de démonstration partagés** : une revendication tranchée par un visiteur change le badge pour les suivants (ADR-0038).
- **Deux documents portent le numéro 18, 19, 21 et 22** dans le dossier `docs/` de DIASPORALE : citer le nom complet du fichier.

## 9. Prompts d'implémentation

### Prompt AS-01
```text
Tu es la session S2 (DIASPORALE). Écris-moi en français. Opus seulement, jamais de sous-agent Sonnet.
Lis : CLAUDE.md ; docs/etudes/2026-11-10-finalisation/07_PAGES_ASSOCIATIONS_GROUPES.md (§ 2 lignes 14 à 21, lot AS-01, décisions 1 et 10) ; docs/17 § 4 ;
apps/diasporale_com/src/components/page-claim-review.tsx et my-pages-panel.tsx ; ../ANTSIA/convex/modules/pages/claims.ts ;
../ANTSIA/convex/modules/moderation/cases.ts (teamCapacity) ; ../ANTSIA/convex/modules/diaspora/moderationDesk.ts.
Vérifie d'abord que l'état décrit est toujours vrai. Branche claude/revendications-au-bureau depuis origin/main.
Ouvre l'issue [S1] dans administration-ga/antsia : autorité de décision ouverte à l'équipe de modération, file filtrée par pays de la page, purge des pièces à l'échéance. N'écris pas dans convex/modules/pages.
Dans ce dépôt : monte la file dans le bureau /moderation (onglet « Pages à vérifier »), garde « Mes revendications » dans Mon activité, aligne le fournisseur de démonstration, textes fr et en dans un fragment du chantier.
Vérifie : bun run --cwd ../ANTSIA verify avec le verrou ; recette à deux comptes (entreprise, moderateur) à 390 et 1280 px.
Arrête-toi avant toute publication et tant que la durée de conservation des pièces n'est pas décidée.
```

### Prompt AS-03
```text
Session S2. Lis le lot AS-03 du plan 07 de DIASPORALE, docs/21_GROUPES_EVENEMENTS_ASSOCIATIONS_DG010.md,
../ANTSIA/convex/modules/diaspora/associationGroups.ts, ../ANTSIA/convex/modules/thematicGroups/thematicGroups.ts (closeGroup, deleteGroup),
apps/diasporale_com/src/components/association-group.tsx, packages/diasporale-features/src/data/association-activities-port.ts et demo/association-activities.ts.
Branche claude/rouvrir-groupe-association. Périmètre : ces fichiers, leurs tests, le fragment de textes des activités associatives.
Livre : une réouverture réservée à l'administrateur vivant de la page (groupe ni archivé ni en suppression), journalisée ; la capacité de port ; le fournisseur de démonstration ;
le bouton « Rouvrir » et une confirmation de fermeture qui dit que c'est réversible.
Tests : fermer puis rouvrir rend le mur ; un signataire non administrateur est refusé ; un adhérent exclu entre-temps reste dehors.
Vérifie : verify avec le verrou, recette à deux comptes. Arrête-toi avant toute publication.
```

### Prompt DS-09
```text
Session S2. Préalable : décisions 3 et 4 du plan 07 de DIASPORALE prises par écrit ; sinon arrête-toi.
Lis : le lot DS-09 du plan 07 ; ../ANTSIA/convex/modules/thematicGroups/ (thematicGroups.ts, access.ts, tables.ts) ;
../ANTSIA/packages/social-domain/src/thematicGroups.ts ; ../ANTSIA/convex/modules/diaspora/associationGroups.ts (le modèle de porte) ;
apps/diasporale_com/src/lib/routes.ts ; apps/diasporale_com/src/components/association-group.tsx ; components/feed-pages.tsx.
Branche claude/groupes-thematiques. Dans ANTSIA, écris seulement dans convex/modules/diaspora/ : une porte de création (pays ouvert, statut, débit, idempotence).
Ouvre deux issues [S1] : délégation de la création générique à cette porte sur un réseau gouverné ; découverte paginée.
Dans ce dépôt : capacité de port, adaptateur moteur, fournisseur de démonstration, routes, annuaire par pays, « Mes groupes », fiche et mur (cartes du fil),
fermer, archiver, supprimer, entrée depuis Communautés, textes fr et en dans un fragment neuf. Aucune nouvelle destination principale.
Vérifie : verify avec le verrou ; recette à deux comptes à 390, 834 et 1280 px, clair et sombre.
N'ouvre pas la surface au pilote avant que MC-01 du moteur permette de signaler un groupe. Arrête-toi avant toute publication.
```

### Prompt AS-08
```text
Session S2. Lis le lot AS-08 et la décision 5 du plan 07 de DIASPORALE ; ../ANTSIA/convex/modules/thematicGroups/thematicGroups.ts (groupWall, pinGroupPost) ;
../ANTSIA/convex/modules/thematicGroups/access.ts (canAccessAssociationGroupPost) ; ../ANTSIA/convex/modules/diaspora/associationGroups.ts (posts) ;
apps/diasporale_com/src/components/association-group.tsx ; apps/diasporale_com/src/components/feed-pages.tsx ; apps/diasporale_com/src/data/engine-association-activities.ts.
Branche claude/groupe-association-medias. Remplace la lecture textuelle du mur par celle du moteur qui rend le format du fil, sans relâcher la garde d'association.
Rends le mur par les cartes du fil : médias, réactions, commentaires, menu « Signaler », épingle pour un responsable. Aligne la démonstration.
Tests : un adhérent parti perd la lecture, y compris par l'adresse d'une publication ; une seule épingle ; médias sous la garde des fichiers.
Vérifie : verify avec le verrou ; recette à deux comptes adhérents. Arrête-toi avant toute publication.
```

## 10. Sources lues

- **Plans du moteur** : `A:docs/etudes/2026-11-09-finalisation/07_PAGES_GROUPES_EVENEMENTS.md` en entier ; lots MC-01 et SU01f du plan 12, EX-06 et EX-08 du plan 13 ; registre des lots.
- **DIASPORALE, documents** : docs/00, 14 et 17 (déjà lus par la session principale) ; `D:docs/18_EXECUTION_VAGUE_G.md`, `D:docs/18_PUBLICATIONS_ASSOCIATIONS_ENTREPRISES.md`, `D:docs/19_ANNUAIRE_ET_PARTAGE_PAGES.md`, `D:docs/20_GESTION_PUBLICATIONS_PAGES.md`, `D:docs/21_GROUPES_EVENEMENTS_ASSOCIATIONS_DG010.md`, `D:docs/22_ANNONCES_EPINGLEES_DES_PAGES.md`, `D:docs/23_PRESENTATION_ASSOCIATIONS_ENTREPRISES.md`, `D:docs/24_PHOTOS_VIDEOS_DES_PAGES.md`, `D:docs/25_ANNUAIRE_PAR_TYPE_ET_SECTEUR.md`, `D:docs/28_RUBRIQUES_DES_PAGES_PARTAGEABLES.md` ; recettes du 19/10 et du 3/11.
- **Dossier produit** : fiches F04, F05 et F08. **Vault** : décisions du 18/10 sur les groupes privés, les délégations d'ANTSIA et la modération a posteriori.
- **Code DIASPORALE** : écrans `page-screen`, `pages-screen`, `page-admin-screens`, `association-screens`, `communities-screen` ; composants `page-*`, `association-group`, `association-membership-entry`, `my-pages-panel`, `feed-pages` ; ports et fournisseurs des pages, de la gestion, des publications, des décisions, des adhésions et des activités ; `D:packages/diasporale-domain/src/associations.ts`, `D:packages/diasporale-domain/src/eligibility.ts`, `D:packages/diasporale-domain/src/demo-accounts.ts`.
- **Code ANTSIA** : `A:convex/modules/pages/` (tous les fichiers), `A:convex/modules/thematicGroups/`, tranche diaspora (`associations`, `associationGroups`, `associationsTables`, `hubPages`, `facts`, `demoAccounts`, `moderationDesk`), `A:convex/modules/moderation/cases.ts`, `A:convex/modules/engagement/engagement.ts`, `A:convex/modules/notifications/fanout.ts`, `A:convex/modules/people/erasure.ts`, règles pures des pages, de la présentation et des groupes thématiques.
- **Non lu** : le module `A:convex/modules/editorial/` au-delà de son en-tête (pages « média », plan 15) ; les tests, dont seule la présence a été relevée.
