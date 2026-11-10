# Plan 15 — Vie publique consulaire

> Constaté par lecture du code d'`origin/main` (DIASPORALE `bead76d`, ANTSIA `fd58d73b`), le 10 novembre 2026. Rien n'a été exécuté : ni test, ni recette, ni publication.
> Applications de référence : Fil d'Ariane (France), STEP (États-Unis), pages et chaînes des ambassades (Facebook, X, WhatsApp), service-public.fr, portails de diaspora d'autres États (Global Irish, MADAD en Inde, portail des Marocains du monde). Comparaison faite de mémoire, sans revérification en ligne ; un « ? » marque ce qui n'est pas sûr.
> Ce plan détaille, pour la vie publique consulaire, le plan 15 du dossier de finalisation d'ANTSIA. Les lots qu'il en reprend gardent leur identifiant (DG-009b) ; les lots nouveaux portent le préfixe `VC-`.

Légende des chemins : `D:` = dépôt DIASPORALE, `A:` = dépôt ANTSIA. « Écran » = atteignable depuis l'interface de diasporale.com ; « Moteur » = la fonction existe côté serveur.

**Côté consulat.ga, ce plan lit une copie qui peut être périmée.** La copie locale de gabon-diplomatie est sur une autre branche : elle ne contient ni les contrats ni les routes partenaires. Les deux contrats ont été lus dans la copie de travail de la branche `feat/diaspora-communaute-v1` (fichiers `docs/contrats/DIASPORA-COMMUNAUTE-V1.md` et `docs/contrats/DIASPORA-ATTESTATION-V1.md`, état du 15/10). Ces branches sont en retard sur la branche principale de leur dépôt. Tout ce qui décrit le producteur se revérifie à leur remise à niveau. Le parcours du membre pour l'attestation (DG-009a) est au plan 01 ; ce plan ne traite que le producteur et les objets publics.

## 1. L'intention du propriétaire

- **Le troisième pilier.** La vie publique « informe et rassure ». Pour DIASPORALE, ce sont les postes consulaires « Officiel » et l'attestation consulaire consentie (plan 15 d'ANTSIA, § 1 ; ADR-0035).
- **Pour qui.** L'institution (poste consulaire, ministère) veut animer sa communauté, donner l'information officielle et lire des agrégats. Le membre veut savoir qui parle (cahier § 6.1, persona P7 ; § 6.3).
- **Officiel, jamais déclaratif.** Une page « Officiel » n'existe que par l'import contractuel, par la fédération ou par une décision tracée d'opérateur. Un membre ne crée jamais une institution (cahier § 5, invariant 8 ; `D:packages/diasporale-domain/src/badges.ts`).
- **Un poste, une page, des agents habilités.** La page naît de l'import. Ses signataires sont des agents du poste, connectés par IDN, dont le rôle est confirmé par le poste selon une procédure tracée, sans lecture des rôles tenus dans consulat.ga (EXF-DG-20 ; docs/01 de DIASPORALE, PD5 point 3).
- **consulat.ga atteste et exporte, rien de plus.** Aucune donnée consulaire, aucune personne, aucune coordonnée ne circule. L'export ne sert que ce qu'un visiteur sans compte voit déjà (cahier § 5, invariant 4 ; § 13 ; les deux contrats).
- **Les démarches restent sur consulat.ga.** Ni dossier, ni rendez-vous, ni échange avec un agent au titre d'un dossier dans DIASPORALE ; une action consulaire ouvre consulat.ga (cahier § 8.15 ; docs/13 de DIASPORALE, § 6.3).
- **Depuis consulat.ga.** Boutons « Rejoindre DIASPORALE » et « Activer IDN », sans transfert de données (EXF-DG-06). L'Espace Communauté de consulat.ga est gelé puis redirigé après le lot D1 (arbitrage A5, pris par défaut).
- **Chaque dépôt garde sa gouvernance.** Contrats signés, versionnés, en liste blanche ; côté consulat.ga, on livre une PR, jamais une publication (ADR-0003 d'ANTSIA ; docs/01, PD3 ; décision du vault du 15/10).
- **Refusé.** consulat.ga fournisseur d'identité, lecture de base à base, export en masse des inscrits (ADR proposé côté consulat.ga) ; parole officielle partisane et publicité politique (ADR-0035, D07) ; badge payant.
- **Ce que l'institution reçoit en retour.** Des statistiques agrégées, protégées contre la réidentification des petits groupes (docs/13, § 6.3 ; EXF-DG-17).

## 2. Ce qui existe

**Le contrat des objets publics, tel qu'il est écrit.** `DIASPORA-COMMUNAUTE-V1` est une lecture tirée par le moteur : `GET /api/partner/diaspora/export?kind=…&cursor=…&limit=…`, signée comme l'attestation (trois en-têtes `X-Diaspora-…`, HMAC-SHA256 sur une chaîne qui contient la requête entière), 1 à 200 objets par page, 30 pages par minute, route éteinte sans clé. La réponse porte `contract`, `kind`, `items`, `nextCursor`, `exportedAt`. Cinq natures, chacune en liste blanche, chaque objet identifié par `importRef` = `<nature>:<slug>` :

| Nature | Champs exportés |
|---|---|
| `consular_posts` | `slug`, `name`, `type`, `country`, `jurisdictionCountries`, `logoUrl?` |
| `associations` | `slug`, `name`, `associationType`, `country`, `city?`, `tagline?`, `description?`, `logoUrl?` |
| `companies` | `slug`, `name`, `companyType`, `activitySector`, `country`, `city?`, `tagline?`, `description?`, `logoUrl?` |
| `events` | `slug`, `title`, `description?`, `category`, `startsAt`, `endsAt?`, `location`, `country?`, `scope?`, `organizerSlug?` |
| `communiques` | `slug`, `title`, `excerpt`, `content` (HTML publié), `publishedAt`, `issuerSlug?`, `country?`, `scope?` |

Ne circulent jamais : une personne, une coordonnée même publique, un identifiant légal, un compteur d'audience, un brouillon. Le contrat ne dit rien du retrait d'un objet, ne date pas ses mises à jour, n'exporte pas le ministère et sert du HTML : quatre points à régler avant sa mise en service (lot VC-02).

| # | Capacité | État | Écran | Moteur | Preuve |
|---|---|---|---|---|---|
| 1 | Badge « Officiel » d'une page, calculé, en tampon d'encre | Présent | oui | oui | `D:packages/diasporale-features/src/components/trust-badge.tsx` ; `A:packages/social-domain/src/badges.ts` (`computePageBadge`) |
| 2 | Seule une institution peut être « Officiel » ; un membre ne crée jamais d'institution | Présent | oui | oui | `A:packages/social-domain/src/badges.ts` (`isTrustAllowedForOwner`) ; `D:packages/diasporale-domain/src/badges.ts` (`canMemberCreatePageKind`) |
| 3 | Une page officielle ne se revendique pas | Présent | oui | oui | `A:convex/modules/diaspora/hubPages.ts` (`isPageClaimableBy`) ; `D:apps/diasporale_com/src/components/page-claim-form.tsx` |
| 4 | Fiche d'une page d'institution, avec la mention « seuls les agents habilités du poste y publient » | Présent | oui | oui | `D:apps/diasporale_com/src/screens/page-screen.tsx` (clé `page.officialNote`) |
| 5 | Rubrique « Pages officielles » du hub d'un pays | Présent, vide : aucune page de poste n'existe | oui | oui | `D:apps/diasporale_com/src/screens/hub-screen.tsx` ; `A:convex/modules/diaspora/hubPages.ts` (`listCountryPages`) |
| 6 | Carte d'une page d'institution dans les listes | Présent | oui | oui | `D:packages/diasporale-features/src/components/cards/page-cards.tsx` |
| 7 | Badge de la page sur chacune de ses publications | Présent | oui | oui | `D:packages/diasporale-features/src/components/cards/post-card.tsx` ; `D:packages/diasporale-domain/src/badges.ts` (`contentBadges`) |
| 8 | Poste et agent fictifs pour la démonstration (acteur `institution`) | Présent, démonstration et déploiement de démonstration déclaré | oui | oui | `D:packages/diasporale-domain/src/demo-accounts.ts` ; `A:convex/modules/diaspora/demoAccounts.ts` |
| 9 | Créer une page d'institution « Officiel » par décision tracée d'un opérateur, idempotente par référence d'import | Partiel : console d'ANTSIA seulement ; son formulaire n'envoie pas la référence d'import ; jamais jouée sur le réseau `diasporale` | console | oui | `A:convex/modules/pages/admin.ts` (`createInstitutionPage`) ; `A:apps/admin_antsia_ga/src/components/console-pages.tsx` |
| 10 | Import contractuel des postes consulaires | Absent | non | non | motifs : `diaspora/export`, `communityImport`, `importCommunity` dans la tranche ; aucun fichier d'import |
| 11 | Journal de l'import | Partiel : table déclarée (référence, nature, état), aucune fonction ne l'écrit ni ne la lit | non | partiel | `A:convex/modules/diaspora/tables.ts` ; `A:convex/modules/diaspora/manifest.ts` |
| 12 | Page officielle reflétée par la fédération dans le réseau DIASPORALE | Absent ici ; le moteur l'a pour le seul réseau `administration` | non | partiel | `A:convex/modules/federation/reseauPublicAccess.ts` (`reseauPublicNetwork`) |
| 13 | Pays de juridiction et type d'un poste (un poste, plusieurs pays) | Absent : une page n'a qu'un pays | non | non | motifs : `jurisdiction`, `juridiction`, `postType`, `ambassade` ; `A:convex/modules/pages/tables.ts` |
| 14 | Page du ministère pour les communiqués de portée diaspora | Absent | non | non | motifs : `ministry`, `ministère` (un seul texte : `badge.officialHint`) |
| 15 | Logo officiel importé sous la garde des fichiers | Absent ici ; le moteur l'a pour la fédération | non | partiel | `A:convex/modules/federation/mediaDownload.ts` |
| 16 | Nom et lien du poste de rattachement sur le profil d'un membre vérifié | Partiel : démonstration seulement ; en mode moteur le nom est toujours vide, la ligne ne s'affiche jamais | démonstration | non | `D:apps/diasporale_com/src/data/engine-views.ts` (`toProfileView`) ; `D:apps/diasporale_com/src/screens/profile-screens.tsx` |
| 17 | Habilitation tracée d'un agent du poste par un opérateur (invitation motivée) | Partiel : fonction sans écran, dans aucune application | non | oui | `A:convex/modules/pages/admin.ts` (`grantPageAdmin`) |
| 18 | Identité IDN de niveau 2 exigée pour signer une page officielle | Présent | oui | oui | `A:convex/modules/pages/signatories.ts` (`respondToPageInvitation`) ; `D:packages/diasporale-features/src/i18n/locales/fr/page-admin.json` |
| 19 | Accepter ou décliner une invitation à signer | Présent | oui | oui | `D:apps/diasporale_com/src/data/engine-page-admin.ts` |
| 20 | L'administrateur habilité invite d'autres signataires et retire un rôle | Présent | oui | oui | `D:apps/diasporale_com/src/components/page-team-panel.tsx` ; `A:convex/modules/pages/signatories.ts` (`grantPageRole`) |
| 21 | L'équipe d'une page n'est visible que de ses signataires | Présent | oui | oui | `A:convex/modules/pages/signatories.ts` (`listPageSignatories`) |
| 22 | Avis à la personne invitée à signer | Absent ; prévu par le lot PG-01 du moteur | non | non | motifs : `page_admin_invite`, `signatory_invite`, `page_invite` |
| 23 | Échéance et revue périodique des mandats | Absent | non | non | motifs : `mandate`, `mandat`, `expiresAt` dans `A:convex/modules/pages/signatories.ts` |
| 24 | Modèle de mandat du poste et procédure écrite | Absent | — | — | aucun document dans docs/ de DIASPORALE ni d'ANTSIA |
| 25 | Badge « Agent public » pour un agent consulaire | Absent : ce badge ne vient que de l'émetteur du socle administration.ga | non | non | `A:convex/modules/federation/reseauPublicAgents.ts` |
| 26 | Publier un communiqué au nom de la page (texte, quatre photos ou une vidéo, portée pays ou diaspora) | Présent | oui | oui | `D:apps/diasporale_com/src/components/page-publications-panel.tsx` ; `A:convex/modules/pages/pages.ts` (`publishAsPage`) |
| 27 | Modifier ou retirer un communiqué | Présent | oui | oui | `D:apps/diasporale_com/src/components/page-post-editor.tsx` |
| 28 | Épingler une annonce sur la page | Présent | oui | oui | `D:apps/diasporale_com/src/components/page-post-pin.tsx` ; `A:convex/modules/pages/pages.ts` (`setPagePinnedPost`) |
| 29 | Annonce officielle en tête du hub du pays | Absent | non | non | motifs : `pinned`, `announcement`, `épingl` dans `D:apps/diasporale_com/src/screens/hub-screen.tsx` et `A:convex/modules/diaspora/hubs.ts` |
| 30 | Suivre la page du poste ; fil des pages suivies | Présent | oui | oui | `D:apps/diasporale_com/src/screens/page-screen.tsx` ; `A:convex/modules/pages/pages.ts` (`follow`) |
| 31 | Avis aux abonnés à chaque communiqué | Partiel : le moteur émet `page_post` ; DIASPORALE ne nomme pas ce genre et l'affiche en « autre » | partiel | oui | `A:convex/modules/pages/pages.ts` ; `D:packages/diasporale-features/src/data/types.ts` (`NOTIFICATION_KINDS`) |
| 32 | Rappel « ce que vos pages ont publié » | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/pages/followedUpdates.ts` (`list`) |
| 33 | Reprise des communiqués publiés sur consulat.ga | Absent | non | non | motifs : `communiques` hors `A:convex/modules/diaspora/tables.ts` |
| 34 | Publication de page sans auteur personne, nécessaire à une reprise automatique | Fermé : admise pour un reflet `RESEAU-PUBLIC-V1` ou une galerie d'évènement seulement | non | partiel | `A:convex/modules/federation/mirrorAccess.ts` (`isFederatedContentAvailable`) ; `A:convex/modules/posts/tables.ts` |
| 35 | Mention d'origine et lien vers la source d'un contenu importé | Absent | non | non | motifs : `importedFrom`, `sourceUrl` hors kit d'arrivée |
| 36 | Alerte officielle (catégorie, échéance, zone, avis) et son plafond | Absent ; lot SU09 du moteur | non | non | motifs : `official_alert`, `officialAlert`, `alerte officielle` |
| 37 | Commenter et réagir sous un communiqué | Présent, hérité du fil | oui | oui | `D:packages/diasporale-features/src/components/cards/post-card.tsx` |
| 38 | Fermer ou restreindre les commentaires d'un communiqué | Absent ; lot FP-06 du moteur | non | non | motifs : `commentsClosed`, `restrictComments`, `closeComments` |
| 39 | Répondre au nom de la page (« réponse Officiel ») | Absent : un commentaire a toujours une personne pour auteur | non | non | `A:convex/modules/engagement/tables.ts` |
| 40 | Règle de visibilité d'une page (`root` : lisible aussi depuis ANTSIA) | Partiel : le moteur l'accepte, l'adaptateur de DIASPORALE ne l'envoie pas | non | oui | `A:convex/modules/pages/identity.ts` (`updatePageIdentity`) ; `D:apps/diasporale_com/src/data/engine-page-admin.ts` |
| 41 | Lecture sans compte d'une page officielle d'un réseau fermé | Fermé : exige la règle `root` ; jamais éprouvée pour DIASPORALE | non | oui | `A:convex/modules/public/access.ts` (`publicPageEligible`) |
| 42 | Signaler un communiqué | Présent | oui | oui | `D:packages/diasporale-features/src/data/port.ts` (`ReportInput`) |
| 43 | Signaler une page (un faux poste) | Absent ici ; le moteur a la surface `page` | non | oui | `A:packages/social-domain/src/moderationPolicy.ts` ; `D:packages/diasporale-features/src/data/content-reports-port.ts` |
| 44 | Motif de signalement « imitation d'une institution de l'État » | Présent | oui | oui | `A:packages/social-domain/src/moderation.ts` ; `D:packages/diasporale-features/src/data/moderation-desk-port.ts` |
| 45 | Nom d'institution protégé quand un membre crée une page | Absent : seule la nature « institution » est réservée, pas le nom | non | non | motifs : `reservedName`, `protectedName`, `consulat`, `ambassade` dans `A:convex/modules/pages/pages.ts` |
| 46 | Évènement d'une page d'institution (tournée, permanence) | Partiel : démonstration seulement ; le moteur réserve les évènements de page aux associations | démonstration | non | `A:convex/modules/events/pageEventAccess.ts` ; `D:packages/diasporale-features/src/demo/state.ts` |
| 47 | Import des évènements publics de consulat.ga | Absent | non | non | motifs : nature `events` hors `A:convex/modules/diaspora/tables.ts` |
| 48 | Information électorale et règle de neutralité en période électorale | Absent ; lot VP-05 du moteur | non | non | motifs : `électoral`, `electoral`, `neutralité` |
| 49 | Lien « M'inscrire au consulat » (bannière d'élévation) | Présent si l'adresse est configurée | oui | — | `D:apps/diasporale_com/src/lib/env.ts` ; `D:packages/diasporale-features/src/components/membership-status-banner.tsx` |
| 50 | Bouton « Faire la démarche » sur la page d'un poste | Absent | non | non | motifs : `Faire la démarche`, `serviceLink` (seul résultat : le lien d'un avis de service) |
| 51 | Écrire au poste | Partiel : bouton « Écrire » désactivé, avec l'infobulle « La messagerie arrive bientôt » | oui | non | `D:apps/diasporale_com/src/screens/page-screen.tsx` ; `D:packages/diasporale-features/src/components/community-controls.tsx` |
| 52 | Ressource officielle du kit d'arrivée, portée par une page « Officiel », avec source et lien sortant sûr | Présent | oui | oui | `D:packages/diasporale-domain/src/arrival-kit.ts` ; `D:apps/diasporale_com/src/screens/arrival-kit-screens.tsx` |
| 53 | Bouton « Rejoindre DIASPORALE » dans consulat.ga | Absent : l'ADR proposé côté consulat.ga le dit « reste proposé » | — | — | motifs dans la copie locale de gabon-diplomatie : `diasporale`, `Rejoindre DIASPORALE` |
| 54 | Gel puis redirection de l'Espace Communauté de consulat.ga | Absent, non daté | — | — | docs/01 de DIASPORALE, arbitrage A5 pris par défaut |
| 55 | Routes du producteur : attestation et export | Fermé : écrites sur deux branches en PR brouillon, non fusionnées, en retard sur la branche principale de leur dépôt | — | — | docs/01 de DIASPORALE, étape e |
| 56 | Demande d'attestation côté moteur | Fermé : sans les trois variables du déploiement, la demande finit en échec technique | oui | oui | `A:convex/modules/diaspora/attestation.ts` (`callAttestation`) |
| 57 | Journal du producteur et durée de conservation | Fermé (branche) ; durée « à fixer par le juriste » | — | — | contrat `DIASPORA-ATTESTATION-V1`, § 5 |
| 58 | Révocation d'une attestation par le producteur | Absent : la règle pure existe, aucune fonction ne l'applique | non | non | `D:packages/diasporale-domain/src/eligibility.ts` (cas `attestation_revoked`) ; motifs dans la tranche : `attestation_revoked`, `revokeAttestation` |
| 59 | Durée de validité d'une attestation | Absent | non | non | motifs : `VALIDITY`, `validUntil`, `expiresAt` dans `A:convex/modules/diaspora/attestation.ts` |
| 60 | Fournisseur d'attestation factice | Présent, démonstration | démonstration | — | `D:packages/diasporale-features/src/demo/attestation-provider.ts` |
| 61 | Associations et entreprises importées, non revendiquées | Absent ; la démonstration en montre | démonstration | non | motifs : natures `associations`, `companies` hors `A:convex/modules/diaspora/tables.ts` ; `D:packages/diasporale-features/src/demo/state.ts` |
| 62 | Retrait propagé d'un objet retiré à la source | Absent ; le contrat n'a ni tombe ni date de mise à jour | non | non | contrat `DIASPORA-COMMUNAUTE-V1`, § 3 et § 4 |
| 63 | Contrôle des textes libres importés (coordonnées, HTML) | Absent | non | non | motifs : `stripHtml`, `htmlToText`, `sanitize` (seul résultat : des nombres du pilote) |
| 64 | Propriété par champ entre l'import et l'équipe de la page | Absent | non | non | motifs : `fieldOwnership`, `importOwned`, `ownedByImport` |
| 65 | Tableau du poste : agrégats par pays, avec seuil | Absent ; le tableau du pilote est réservé aux responsables du réseau | non | non | `A:convex/modules/diaspora/pilotMetrics.ts` ; `D:apps/diasporale_com/src/screens/pilot-metrics-screen.tsx` |
| 66 | Compteur d'abonnés d'une page | Présent | oui | oui | `A:convex/modules/diaspora/hubPages.ts` (`hubPageOf`) |
| 67 | Trouver son poste (annuaire des postes par pays, filtre « Officiel ») | Absent ici ; l'annuaire du moteur filtre déjà par nature | non | oui | `D:apps/diasporale_com/src/components/page-directory.tsx` ; `A:convex/modules/pages/pages.ts` (`paginateDiscover`) |
| 68 | Écran de l'import (lancer, journal, rejets, retraits) | Absent | non | non | motifs : `communityImports` dans `D:apps/diasporale_com/src` |
| 69 | Console de la fédération (émetteurs, reçus, lettres mortes, rejeu) | Présent pour `RESEAU-PUBLIC-V1` seulement | console | oui | `A:apps/admin_antsia_ga/src/components/console-federation.tsx` |
| 70 | Textes qui annoncent l'import et les évènements des postes | Partiel : annoncés à l'écran, non servis | oui | non | `D:packages/diasporale-features/src/i18n/locales/fr/diasporale.json` (clés `hub.emptyAssociationsBody`, `hub.emptyEventsBody`) |

Décompte : **Présent 24 · Partiel 9 · Absent 32 · Fermé 5** (70 capacités).

### Ce que le moteur sait déjà faire et que DIASPORALE ne montre pas

- **Créer la page d'un poste sans attendre l'import** : `createInstitutionPage` accepte n'importe quel réseau et une référence d'import ; seule la console l'appelle (`A:apps/admin_antsia_ga/src/components/console-pages.tsx`).
- **Habiliter un agent** : `grantPageAdmin` est écrit et testé ; aucun écran ne l'appelle, ni dans la console ni dans DIASPORALE.
- **Prévenir les abonnés** : `page_post` part à chaque publication de page ; DIASPORALE le range dans « autre ».
- **Rappeler les communiqués des pages suivies** : `A:convex/modules/pages/followedUpdates.ts` n'a aucun appelant dans DIASPORALE.
- **Filtrer l'annuaire par nature** : `paginateDiscover` accepte `institution` ; l'écran n'offre qu'association et entreprise.
- **Ouvrir une page officielle à ANTSIA et aux visiteurs sans compte** : règle `root` et `publicPageEligible`.
- **Signaler une page** : surface `page` du moteur ; DIASPORALE ne signale que les publications et ses neuf natures propres.
- **Recevoir par contrat signé** : reçus, lettres mortes, rejeu, révisions et tombes existent pour `RESEAU-PUBLIC-V1` (`A:convex/modules/federation/inbox.ts`) ; ce sont les patrons à reprendre.

### Ce qui est écrit mais jamais recetté en réel

| Élément | Niveau atteint | Source |
|---|---|---|
| Recette R5 (un membre ordinaire ne publie pas sur une page officielle, un agent habilité publie) | Jamais jouée sur un moteur ; fournisseur de démonstration seulement | cahier § 9 ; docs/01 de DIASPORALE, PD5 « — » |
| Recette R6 (association importée puis revendiquée) | Revendication jouable sur une page créée par un membre ; jamais sur une page importée | plan 15 d'ANTSIA, § 2 |
| Page d'institution créée par la console dans le réseau `diasporale` | Jamais jouée ; aucune production n'a ce réseau | dossier de reprise, § 2.2 |
| Habilitation d'un agent | Tests du moteur seulement | `A:convex/modules/pages/admin.ts` |
| Routes du producteur | 42 et 17 tests côté gabon-diplomatie au 15/10 ; jamais appelées par le moteur | docs/01 de DIASPORALE, étape e |
| Recette R2 (attestation réelle) | Jamais jouée : ni clés ni adresse | docs/01, PD3 « partiel » |
| Lecture publique d'une page officielle d'un réseau fermé | Code présent, jamais éprouvé pour DIASPORALE | `A:convex/modules/public/access.ts` |

## 3. Comparaison avec les applications de référence

| Capacité | Fil d'Ariane | STEP | Pages et chaînes d'ambassades | service-public.fr | Portails de diaspora | DIASPORALE | Verdict |
|---|---|---|---|---|---|---|---|
| Voix officielle reconnaissable | oui, service de l'État | oui, service de l'État | oui (comptes gouvernementaux étiquetés) | oui | oui | badge calculé, aucune page de poste | À faire (VC-04, DG-009b) |
| Une page par poste, rattachée à un pays | non | non | oui | annuaire ? | oui ? | rubrique du hub prête, vide | À faire (DG-009b) |
| Trouver le poste compétent pour son pays | ? | oui | non | oui ? | oui ? | non | À faire (VC-07) |
| Communiqués suivis par abonnement | non | non | oui | oui ? | oui (lettre d'information) | suivre la page ; avis non nommé | À adapter (plan 13) |
| Alerte de sécurité ciblée par pays | oui | oui | non, publication ordinaire | non | ? | non | À faire (VC-12) |
| Alerte reçue par e-mail ou SMS | oui | oui, e-mail | non | non | ? | cloche seule | Reporté (plan 13) ; aucun contenu dans un avis |
| Déclarer un voyage ou un séjour court | oui | oui | non | non | ? | non | Écarté (donnée consulaire) |
| Proches à prévenir, contact d'urgence | oui | oui ? | non | non | non | non | Écarté (invariant 4) |
| Agenda du poste (tournées, permanences) | non | non | oui, évènements de page | non | ? | démonstration seulement | À faire (VC-13) |
| Prise de rendez-vous consulaire | non | non | non, renvoi | oui, renvoi vers la démarche | oui ? | non | Écarté : passerelle (VC-06) |
| Fiches pratiques et bouton « Faire la démarche » | non | non | non | oui | oui ? | ressources officielles du kit, sans bouton | À adapter (VC-06) |
| Suivi d'un dossier individuel | non | non | non | oui ? | oui (MADAD) | non | Écarté (cahier § 8.15) |
| Questions du public en commentaire | non | non | oui ; non sur une chaîne WhatsApp | non | ? | oui, non réglable | À adapter (VC-14) |
| Message privé à l'institution | non | non | oui | formulaire ? | ? | bouton désactivé | Écarté : passerelle (VC-06) |
| Réponse au nom de l'institution | — | — | oui | — | ? | non | À faire (VC-14) |
| Information sur le vote à l'étranger | non | non | oui | oui | oui ? | non | À faire, en information seule (VC-13, VC-14) |
| Lettre d'information par pays | non | non | non | oui ? | oui (Global Irish) | non | Reporté (DS-14, plan 13) |
| Appartenance vérifiée par l'État | inscription déclarée | inscription déclarée | non | compte ? | ? | attestation consentie, fermée | À recetter (DG-009a au plan 01 ; VC-03) |
| Reprise des contenus du site officiel | — | — | saisie à la main | — | — | non | À faire (VC-11), puis VC-20 |
| Retrait propagé depuis la source | — | — | non | — | — | non | À faire (DG-009b) |
| Statistiques pour l'institution | ? | ? | oui, statistiques de page | ? | ? | non | À faire, agrégats avec seuil (VC-17) |
| Lecture sans compte | oui | oui | oui | oui | oui | non, réseau fermé | Reporté (VC-21) |
| Protection contre les faux comptes d'institution | — | — | étiquette et signalement | — | — | motif de signalement ; aucun nom réservé ; page non signalable | À faire (plan 14) |
| Entrée depuis le service consulaire | — | — | — | — | — | non | À faire (VC-10) |
| Associations reconnues listées avec le poste | non | non | non | non | ? | non | À faire (DG-009b) |
| Parole officielle sponsorisée | non | non | possible | non | ? | non | Écarté (D07, D-G04) |

## 4. Ce qui manque

**Deux voies mènent à une page « Officiel ». Pour les postes consulaires, ce plan recommande l'import.**

| | Import contractuel `DIASPORA-COMMUNAUTE-V1` | Fédération `RESEAU-PUBLIC-V1` |
|---|---|---|
| Source | consulat.ga ; le moteur tire une lecture signée | administration.ga ; une file d'envoi pousse vers le moteur |
| Réseau d'arrivée | `diasporale` | `administration`, réseau miroir ; verrouillé dans le code (émetteur `administration-ga`) |
| Visible dans le hub de DIASPORALE | oui | non : autre réseau, et l'invariant 1 interdit de lire hors de `diasporale` |
| Qui publie ensuite | des agents habilités, dans DIASPORALE (EXF-DG-20) | la source seule ; la gestion locale est fermée |
| État du producteur | écrit sur une branche de gabon-diplomatie, à remettre à niveau | hors git côté socle (lot PA9D du plan 11 d'ANTSIA) |
| Retrait | par passe complète ; à préciser dans le contrat | par évènement, avec révision et tombe |

Les postes sont des organismes de consulat.ga, pas du socle. Les fédérer demanderait une seconde file d'envoi côté consulat.ga et l'ouverture, côté moteur, d'un chemin jamais éprouvé. L'import existe déjà en PR, sert le bon réseau et laisse les agents parler sur place. La fédération reste la voie des administrations du Gabon, lues depuis ANTSIA. Pour le pilote, la console crée la page d'un poste avec la même référence que l'import : il l'adoptera sans doublon.

### 4.1 Bloquant avant l'ouverture du pilote

1. **Des écrans promettent ce qui n'existe pas.** Le hub dit que les associations « arrivent avec l'import public » et que les évènements « des postes apparaîtront ici ». La fiche d'une institution montre un bouton « Écrire » désactivé qui annonce une messagerie ; pour un poste, elle ne viendra pas (lot VC-01).

Rien d'autre ne bloque l'ouverture : le pilote peut ouvrir sans page de poste. En revanche, **la vie publique ne se présente pas comme ouverte** tant qu'aucune page officielle n'existe (VC-04) et que la procédure d'habilitation n'est pas écrite.

### 4.2 Fonctions attendues qui manquent

- La page du poste, dans le hub de chaque pays de sa juridiction, et les associations publiques de consulat.ga, revendicables (VC-04, DG-009b, VC-07).
- Le nom du poste de rattachement sur le profil d'un membre vérifié : aujourd'hui, une attestation réussie ne montre rien (VC-05).
- Un lien clair vers consulat.ga pour contacter le poste ou faire une démarche, et l'entrée depuis consulat.ga (VC-06, VC-10).
- L'annonce du poste en tête du hub, et un avis qui dit « votre poste a publié » (VC-08, plan 13).
- Une alerte bornée dans le temps pour une fermeture, une consigne, une date limite ; l'agenda des tournées et des permanences (VC-12, VC-13).

### 4.3 Options qui manquent sur ce qui existe

- Annuaire des pages : pas de filtre « Officiel », pas d'entrée « Postes consulaires » (VC-07).
- Fiche du poste : ni type de poste, ni pays couverts, ni logo officiel, ni mention de la source (VC-07, VC-19).
- Communiqué : commentaires non réglables, pas de réponse au nom de la page, pas de mention « Source : consulat.ga » (VC-14, VC-11).
- Page suivie : pas de rappel « ce que vos pages ont publié », avis rangé dans « autre » (plan 13).
- Règle de visibilité de la page : acceptée par le moteur, absente du formulaire (VC-21).
- Signalement : la page d'un faux poste ne se signale pas, seulement ses publications (plan 14).
- Équipe : pas d'avis d'invitation, pas d'échéance de mandat (PG-01, VC-15).

### 4.4 Améliorations de l'existant

- **Journal de l'import** : la table ne garde que la référence, la nature et l'état. Il lui faut l'empreinte de l'objet, la date de l'export, la dernière passe où l'objet a été vu, l'objet local et le motif d'un rejet.
- **Console** : le formulaire de création n'envoie pas la référence d'import, que la fonction accepte. Sans elle, l'import créerait un doublon de la page du pilote.
- **Démonstration plus riche que le moteur** : elle montre le nom du poste sur le profil et un évènement de poste ; le moteur ne sert ni l'un ni l'autre. Aligner les deux.
- **Un administrateur habilité peut renommer la page officielle** et changer son pays (`A:convex/modules/pages/identity.ts`) : l'import doit faire foi pour ces deux champs.
- **Textes** : nommer le poste par son type (« Ambassade », « Consulat général »), jamais par son slug.

### 4.5 Ce qui distingue DIASPORALE

- **Une chaîne de confiance de bout en bout** : page née d'un contrat signé, signataire à l'identité IDN de niveau 2, mandat tracé, badge calculé. Une page d'ambassade sur un réseau grand public repose sur une étiquette posée par la plateforme.
- **Aucune donnée consulaire** : ni voyage, ni proche, ni dossier. L'alerte vise un pays choisi par le membre, pas une personne recensée.
- **Des ressources officielles datées** dans le kit d'arrivée, avec leur source et un signalement « périmée ».
- **Le retrait suit la source** : ce que consulat.ga dépublie quitte DIASPORALE.
- **Des agrégats avec seuil pour l'institution**, sans nom ni export.
- **Faible débit** : communiqués et alertes en texte, lisibles en 3G.

### 4.6 Écarté ou reporté, et pourquoi

| Sujet | Raison |
|---|---|
| Suivi d'un dossier, prise de rendez-vous, messagerie avec un agent du poste | Cahier § 8.15 : les démarches restent sur consulat.ga ; passerelle seulement |
| Déclarer un voyage, enregistrer un proche à prévenir | Donnée consulaire ; invariant 4 |
| Fédérer les postes par `RESEAU-PUBLIC-V1` | Mauvais réseau, producteur à écrire, chemin non éprouvé ; voir le tableau ci-dessus |
| consulat.ga fournisseur d'identité, export des inscrits | ADR-0003 ; ADR proposé côté consulat.ga |
| Alerte par SMS, lettre d'information qui porte du contenu | Un avis ne porte aucun contenu ; transports au plan 13 |
| Coordonnées du poste affichées sur sa page | Le contrat n'exporte aucune coordonnée ; à trancher (décision 5) |
| Hub ou lettre « présentés par » un annonceur (fiches F02 et F14 du dossier produit) | D-G04 : aucune publicité au pilote ; lot D4 |
| Badge « Agent public » pour les agents consulaires | Vient du socle par accord de l'agent ; la voix est celle de la page (décision 3) |
| Reprise automatique des communiqués | Le moteur n'admet pas de publication sans personne hors reflet fédéré ; lot VC-20 |

## 5. Lots d'implémentation

### VC-01 — Dire vrai sur l'officiel à l'ouverture du pilote · P0 · S · S2
- **Pour l'utilisateur** : aucun écran ne promet un import, un évènement de poste ou une messagerie avec le poste tant qu'ils n'existent pas.
- **Backend** : aucun.
- **Web** : réécrire `hub.emptyAssociationsBody` et `hub.emptyEventsBody` (fr et en) pour dire ce qui est possible aujourd'hui ; sur une fiche d'institution, ne plus monter le bouton « Écrire » désactivé, mais la phrase « Les questions sur un dossier se traitent sur consulat.ga » et, si l'adresse est configurée, le lien sortant déjà employé par la bannière. Démonstration : mêmes textes ; l'évènement de poste fictif est retiré ou marqué, avec le plan 08.
- **Mobile** : sans objet.
- **Données personnelles** : aucune.
- **Tests et cliquets** : `i18n-keys`, `public-communication` ; test de la fiche d'institution : aucun bouton « Écrire » désactivé.
- **Critères d'acceptation** : en mode moteur, sans aucune page officielle, le hub France ne contient aucune phrase au futur sur l'import ; captures à 390 et 1280 px.
- **Dépend de** : plan 02 pour la relecture d'ensemble des textes.
- **Porte** : aucune.

### VC-02 — Trancher la voie de l'Officiel et amender le contrat avant sa mise en service · P1 · S · S2 + propriétaire
- **Pour l'utilisateur** : rien de visible ; une seule règle écrite pour l'origine d'une page de poste.
- **Backend** : aucun code. Une décision d'architecture dans docs/ de DIASPORALE : import contractuel pour les postes, fédération pour les administrations du socle, console pour le pilote. Une liste d'amendements à `DIASPORA-COMMUNAUTE-V1`, tant qu'il n'est pas en service : (1) dire le retrait d'un objet ; (2) dater chaque objet ; (3) exporter le ministère ; (4) donner l'adresse publique de l'objet sur consulat.ga ; (5) servir les communiqués en texte, ou fixer la règle de conversion ; (6) réduire le lieu d'un évènement à la ville et au pays ; (7) corriger le nom du moteur (« ANTSIA »).
- **Web** : aucun.
- **Mobile** : sans objet.
- **Données personnelles** : questions au juriste : base de la reprise des objets publics des associations, information préalable, durée du journal.
- **Tests et cliquets** : aucun.
- **Critères d'acceptation** : décision acceptée ou refusée par écrit ; amendements transmis à l'équipe de consulat.ga ; décisions 1 et 2 du § 7 tranchées.
- **Dépend de** : rien.
- **Porte** : décision du propriétaire ; équipe de gabon-diplomatie.

### VC-03 — Remettre à niveau les deux contrats côté consulat.ga · P1 · M · gabon-diplomatie
- **Pour l'utilisateur** : rien de visible ; l'attestation et l'export deviennent livrables.
- **Backend** : dans le dépôt de gabon-diplomatie, reprendre les deux branches sur le `main` actuel ; renuméroter l'ADR proposé (le numéro 0006 est déjà pris dans `main`) ; appliquer les amendements de VC-02 ; rejouer les tests (42 et 17 au 15/10) ; ouvrir de nouvelles PR, car les numéros 184 et 185 cités par docs/01 sont ceux de l'ancienne adresse du dépôt.
- **Web** : aucun dans ce lot.
- **Mobile** : sans objet.
- **Données personnelles** : journal du producteur à l'empreinte du sujet ; durée fixée par le juriste (13 mois proposés) ; test de liste blanche de l'export.
- **Tests et cliquets** : suites du dépôt de gabon-diplomatie ; test de parité entre le contrat et la copie typée de `@diasporale/domain`.
- **Critères d'acceptation** : deux PR à jour et vertes ; routes éteintes sans clé ; aucune publication.
- **Dépend de** : VC-02.
- **Porte** : validation juridique (arbitrage A4) ; accord écrit du propriétaire ; gouvernance de publication de gabon-diplomatie.

### VC-04 — Page officielle du poste pilote par la console, et habilitation tracée · P1 · S · S2 (+ S1 : PG-01)
- **Pour l'utilisateur** : le hub France montre la page officielle d'un poste ; un agent mandaté y publie.
- **Backend** : aucune fonction neuve. La page naît par `createInstitutionPage` dans le réseau `diasporale`, l'agent par `grantPageAdmin`. Issue [S1] : (a) ajouter la référence d'import au formulaire de la console, pour poser `consular_posts:<slug>` ; (b) faire servir à PG-01 l'habilitation d'un agent, avec la référence du mandat pour motif, et pas seulement l'administrateur de secours.
- **Web** : une procédure dans docs/ : qui demande, quel mandat, quel motif, comment retirer ; un modèle de mandat. Aucun écran neuf dans DIASPORALE.
- **Mobile** : sans objet.
- **Données personnelles** : le mandat reste hors du moteur ; le journal d'audit ne garde que le motif et l'identifiant de la personne.
- **Tests et cliquets** : tests de la tranche sur le réseau `diasporale` : un membre ordinaire ne publie pas ; un signataire sans IDN de niveau 2 est refusé ; un rôle retiré coupe la publication aussitôt (R-G11).
- **Critères d'acceptation** : recette R5 sur le backend local avec les comptes `institution`, `verifie` et `administrateur` : page créée, agent habilité, communiqué publié et lu, refus d'un membre ordinaire.
- **Dépend de** : PG-01 et VP-02 (plans 07 et 11 d'ANTSIA) ; DS-06 pour la production.
- **Porte** : mandat écrit du poste ou du ministère ; accord pour toute action sur un déploiement en ligne.

### VC-05 — Nom et lien du poste de rattachement sur le profil · P1 · S · S2
- **Pour l'utilisateur** : sur le profil d'un membre vérifié par le consulat, « Poste de rattachement » nomme le poste et mène à sa page.
- **Backend** : dans la tranche, résoudre le slug du poste vers sa page par l'index des références d'import, sous la garde de lecture des pages ; rendre le nom et l'adresse, ou rien. Projection à part.
- **Web** : `toProfileView` cesse de rendre un nom vide ; lien vers la fiche ; sans page, la ligne ne s'affiche pas, jamais le slug brut.
- **Mobile** : une ligne du profil (plan 16).
- **Données personnelles** : le poste suit la visibilité par champ de la facette, déjà réglable.
- **Tests et cliquets** : profil avec et sans page ; visibilité « moi seul » ; démonstration et moteur rendent le même résultat.
- **Critères d'acceptation** : le nom apparaît en mode moteur dès que la page existe ; rien pour un lecteur que la visibilité exclut.
- **Dépend de** : VC-04 ou DG-009b, pour qu'une page existe.
- **Porte** : aucune.

### VC-06 — Passerelles « Contacter le poste » et « Faire la démarche » · P1 · S · S2
- **Pour l'utilisateur** : sur la page d'un poste, deux liens sortants clairs vers consulat.ga ; aucune donnée ne part.
- **Backend** : aucun. Une liste fermée de destinations dans `@diasporale/domain` : clés stables, chemins fournis par l'équipe de consulat.ga, origine lue dans l'environnement.
- **Web** : boutons `outline` sur la fiche d'institution et dans les ressources officielles du kit ; nouvel onglet, sans référent, étiquette « site externe » ; aucun paramètre qui identifie la personne ; lien absent si l'adresse n'est pas configurée.
- **Mobile** : mêmes liens.
- **Données personnelles** : aucune ; ni identifiant, ni pays de la personne dans l'adresse.
- **Tests et cliquets** : `no-hardcoded-urls` ; adresse sans paramètre ; aucun lien sans configuration.
- **Critères d'acceptation** : un clic ouvre la bonne page de consulat.ga ; rien n'est écrit dans le moteur.
- **Dépend de** : VC-01.
- **Porte** : liste des adresses publiques fournie par l'équipe de consulat.ga ; décision 5.

### DG-009b — Import public et pages « Officiel » des postes · P1 · L · S2 (+ S1 si le schéma change) · repris du plan 15
- **Pour l'utilisateur** : chaque hub montre son poste consulaire et ses associations publiques, revendicables.
- **Backend** : (1) domaine : copie typée du contrat, relecture en liste blanche par nature, refus de tout champ en plus, textes ramenés au texte brut, coordonnées retirées, correspondance des types. (2) Tranche : action d'import à requête signée, pagination jusqu'à la fin, plafond de pages par passe, reprise sur erreur. (3) Journal enrichi (§ 4.4). (4) Écritures : postes en pages d'institution officielles ; associations et entreprises en pages de communauté sans administrateur, donc revendicables ; idempotence par référence ; adoption tracée de la page créée par la console. (5) Retrait : après une passe complète d'une nature, tout objet non revu quitte la diffusion, sans suppression. (6) Propriété par champ : pour une page officielle, nom et pays font foi côté import ; après revendication, l'import n'écrit plus les champs de l'équipe ; conflit visible au journal. Postes d'abord, associations et entreprises ensuite. Issues [S1] : création interne d'une page importée dans le module des pages ; ligne de politique de données si une table s'ajoute ; passage planifié éventuel.
- **Web** : écran « Import public » pour les responsables du réseau : lancer une nature, lire le journal, les rejets, les retraits. Sur la fiche : « Importée de consulat.ga le … », « Page non revendiquée ». Fournisseur de démonstration, textes fr et en.
- **Mobile** : mention de la source sur la fiche.
- **Données personnelles** : aucune personne, aucune adhésion ; source, version et date gardées ; journal déjà classé comme partagé.
- **Tests et cliquets** : rejeu sans doublon ; retrait par absence (R-G22) ; champ en plus refusé ; coordonnée retirée d'une description ; signature fausse ; `no-unbounded-collect`, `network-scoped-functions`, `no-cross-product-imports`.
- **Critères d'acceptation** : import rejoué deux fois sans doublon ; retrait amont retire la copie publique ; badge « Officiel » calculé ; une page revendiquée garde ses champs ; aucune personne ni adhésion créée.
- **Dépend de** : VC-02, VC-03 ; plan 07 pour l'affichage et la revendication des pages importées ; VP-02, qui doit tenir l'import pour une source attestée.
- **Porte** : contrat signé par gabon-diplomatie ; clés du propriétaire ; avis du juriste (décision 13).

### VC-07 — Pays de juridiction, type de poste et « Trouver mon poste » · P1 · S · S2 (+ S1)
- **Pour l'utilisateur** : le hub d'un pays couvert par un poste installé ailleurs montre ce poste ; une liste donne les postes par pays.
- **Backend** : table de tranche des postes (page, slug, type, pays de juridiction), alimentée par l'import ; `listCountryPages` ajoute les postes compétents pour le pays ; lecture bornée des postes par pays. Issue [S1] : ligne de politique de données.
- **Web** : entrée « Postes consulaires » dans Communautés et Explorer, sans nouvelle destination ; libellé du type ; filtre « Officiel » de l'annuaire ; fournisseur de démonstration.
- **Mobile** : liste simple.
- **Données personnelles** : aucune.
- **Tests et cliquets** : pays sans poste : rien, pas de zéro ; poste de plusieurs pays visible dans chaque hub.
- **Critères d'acceptation** : le hub d'un pays de juridiction montre le poste avec la mention du pays où il siège.
- **Dépend de** : DG-009b ; plan 06 pour la place dans le hub.
- **Porte** : aucune.

### VC-08 — Annonce officielle en tête du hub · P1 · S · S2
- **Pour l'utilisateur** : l'annonce épinglée par le poste apparaît en tête du hub de son pays.
- **Backend** : lecture de tranche : pour un pays, l'annonce épinglée de chaque page officielle compétente, relue par les gardes de publication ; deux au plus.
- **Web** : bloc « Annonce officielle » dans le hub et dans Communautés, avec la carte de publication ordinaire et son badge ; rien si aucune épingle ; fournisseur de démonstration.
- **Mobile** : même bloc.
- **Données personnelles** : aucune.
- **Tests et cliquets** : épingle retirée ou publication modérée : le bloc disparaît ; une page non officielle n'y entre jamais.
- **Critères d'acceptation** : épingler sur la page suffit ; aucun réglage de hub, aucun compteur.
- **Dépend de** : VC-04 ; plan 06 (mise en page du hub) ; plan 13 (avis `page_post` nommé).
- **Porte** : aucune.

### VC-09 — Recette croisée R5 et R6 avec consulat.ga · P1 · M · S2 + gabon-diplomatie
- **Pour l'utilisateur** : la preuve que l'import et l'attestation marchent entre deux déploiements de développement.
- **Backend** : un déploiement de développement de gabon-diplomatie avec les deux routes ; variables posées par le propriétaire sur le backend de recette de DIASPORALE.
- **Web** : parcours : import des postes puis des associations, rejeu, retrait, revendication d'une association importée (R6), publication par un agent habilité (R5), attestation positive, négative, indisponible (avec le plan 01).
- **Mobile** : sans objet.
- **Données personnelles** : comptes fictifs seulement ; jamais un dossier consulaire réel.
- **Tests et cliquets** : rapport daté dans docs/recette/.
- **Critères d'acceptation** : chaque étape dite faite ou non faite ; aucune commande vers la production consulaire.
- **Dépend de** : DG-009b, VC-03, DG-009a (plan 01).
- **Porte** : clés et environnements du propriétaire ; équipe de consulat.ga.

### VC-10 — Bouton « Rejoindre DIASPORALE » dans consulat.ga · P1 · S · gabon-diplomatie
- **Pour l'utilisateur** : depuis son espace consulat.ga, la personne ouvre la porte de DIASPORALE.
- **Backend** : aucun.
- **Web** : dans l'espace citoyen de consulat.ga, un bouton vers l'adresse d'entrée de DIASPORALE, lue dans la configuration ; aucun identifiant ni donnée de profil dans l'adresse.
- **Mobile** : application citoyenne de consulat.ga, ensuite.
- **Données personnelles** : rien ne circule ; la personne s'authentifie et consent dans DIASPORALE.
- **Tests et cliquets** : adresse sans paramètre personnel.
- **Critères d'acceptation** : un clic mène à la porte d'entrée ; rien n'est pré-rempli.
- **Dépend de** : production de DIASPORALE (DS-06, plan 17).
- **Porte** : gouvernance de publication de gabon-diplomatie ; décision 12.

### VC-11 — Communiqués de consulat.ga proposés aux signataires · P2 · M · S2 (+ S1)
- **Pour l'utilisateur** : l'agent habilité voit les communiqués publiés sur consulat.ga et les reprend en un geste.
- **Backend** : import de la nature `communiques` en propositions (titre, chapeau en texte brut, date, poste émetteur, lien source), jamais en publications ; « Publier » passe par `publishAsPage`, l'agent pour signataire ; une proposition reprise ou écartée ne revient pas. Issue [S1] : ligne de politique de données.
- **Web** : onglet « À reprendre » dans la gestion de la page officielle ; mention « Source : consulat.ga » et lien sortant sur la publication ; fournisseur de démonstration.
- **Mobile** : lecture seule.
- **Données personnelles** : le texte libre est relu par un humain avant publication ; aucune personne.
- **Tests et cliquets** : HTML jamais rendu ; proposition retirée à la source ; double clic, une seule publication.
- **Critères d'acceptation** : aucun communiqué n'apparaît sans le geste d'un signataire.
- **Dépend de** : DG-009b, VC-04.
- **Porte** : décision 4.

### VC-12 — Alertes consulaires · P2 · M · S2 (+ S1 : SU09)
- **Pour l'utilisateur** : fermeture exceptionnelle, consigne de sécurité, date limite : l'alerte du poste apparaît en tête du fil et du hub des pays concernés, puis disparaît.
- **Backend** : se branche sur SU09. Issue [S1] : SU09 vise des reflets fédérés et des provinces ; il doit aussi admettre une page officielle native d'un réseau gouverné, avec une zone en pays. Dans la tranche : pays visés (ceux de la juridiction), plafond et durée.
- **Web** : option « Alerte » du composeur, réservée aux pages officielles ; bandeau repliable ; fournisseur de démonstration.
- **Mobile** : bandeau ; notification poussée avec le plan 16.
- **Données personnelles** : aucune ; avis sans contenu.
- **Tests et cliquets** : alerte échue absente ; plafond tenu ; page non officielle refusée ; `notification-payload-content`.
- **Critères d'acceptation** : jamais plus que le plafond par page et par jour ; jamais sponsorisée.
- **Dépend de** : SU09 ; plan 13 (genre d'avis) ; VC-07.
- **Porte** : décision 6.

### VC-13 — Agenda consulaire : tournées, permanences, information électorale · P2 · M · S2 (+ S1 : PG-03)
- **Pour l'utilisateur** : la date et le lieu d'une permanence apparaissent sur la page du poste et dans le hub.
- **Backend** : dépend de PG-03, qui ouvre les évènements de page à toutes les natures. Variante « information » : ni inscription, ni liste de présents, ni billet. Import de la nature `events` ensuite, lieu réduit à la ville.
- **Web** : section « Agenda » de la fiche d'institution ; export iCal ; lien « Prendre rendez-vous sur consulat.ga » (VC-06).
- **Mobile** : liste.
- **Données personnelles** : aucune inscription, donc aucune trace de qui se rend au consulat.
- **Tests et cliquets** : fuseau du pays (R-G21) ; évènement retiré.
- **Critères d'acceptation** : aucun geste d'inscription sur un évènement officiel.
- **Dépend de** : PG-03 ; plan 08.
- **Porte** : décision 7.

### VC-14 — Parole officielle : commentaires, réponse au nom de la page, neutralité · P2 · M · S2 (+ S1)
- **Pour l'utilisateur** : on sait quand le poste répond ; un communiqué sensible se ferme aux commentaires ; la page ne fait pas campagne.
- **Backend** : issues [S1] : FP-06 (fermer ou restreindre les commentaires) ; réponse au nom de la page ; VP-05 (règle politique et période électorale) appliquée aux pages officielles de DIASPORALE.
- **Web** : réglage par communiqué ; badge « Officiel » sur la réponse de la page ; charte du signataire montrée à l'acceptation du rôle.
- **Mobile** : affichage.
- **Données personnelles** : aucune.
- **Tests et cliquets** : commentaire refusé au serveur quand le fil est fermé ; réponse de page réservée aux signataires vivants.
- **Critères d'acceptation** : charte validée ; aucune réponse « Officiel » d'un ancien signataire.
- **Dépend de** : FP-06, VP-05 ; plan 14.
- **Porte** : décision 8 ; avis du juriste.

### VC-15 — Mandats des signataires : revue périodique et retrait · P2 · S · S2 (+ S1)
- **Pour l'utilisateur** : un agent qui a quitté le poste ne parle plus en son nom.
- **Backend** : issue [S1] : date de revue sur l'habilitation d'une page officielle, liste des habilitations à revoir dans la console.
- **Web** : rappel à l'administrateur de la page ; procédure de retrait à la demande du poste.
- **Mobile** : sans objet.
- **Données personnelles** : journal d'audit existant.
- **Tests et cliquets** : rôle retiré, publication refusée aussitôt.
- **Critères d'acceptation** : aucune habilitation officielle sans date de revue.
- **Dépend de** : VC-04 ; PG-01 et PG-08.
- **Porte** : décision 3.

### VC-16 — Fin de validité et révocation d'une attestation · P2 · M · S2 + gabon-diplomatie (+ S1)
- **Pour l'utilisateur** : le badge obtenu par le consulat cesse quand l'inscription n'est plus en vigueur.
- **Backend** : étape 1 (S2) : appliquer la règle pure `attestation_revoked` par un passage planifié qui, à l'échéance décidée, retire le lien, relit le statut et prévient d'un avis neutre ; la personne revérifie en un geste. Étape 2 : contrat de cycle de vie dont la clé est la référence de consentement, seule référence commune aux deux journaux, reçu par la passerelle signée du moteur. Issue [S1] : contrat nouveau dans la passerelle, ligne de passage planifié.
- **Web** : « Vérification à renouveler » dans les réglages (plan 01).
- **Mobile** : avis.
- **Données personnelles** : aucune raison consulaire ; rien que la référence de consentement.
- **Tests et cliquets** : le statut retombe selon les faits restants ; un membre vérifié par IDN ne perd rien.
- **Critères d'acceptation** : une attestation échue ne porte plus de badge ; le motif n'est jamais dit.
- **Dépend de** : DG-009a (plan 01) ; VC-03.
- **Porte** : juriste, pour la durée ; décision 10.

### VC-17 — Tableau du poste : agrégats par pays, avec seuil · P2 · M · S2
- **Pour l'utilisateur** : l'agent habilité voit l'audience de la page et la vie des pays de sa juridiction, sans aucun nom.
- **Backend** : lecture de tranche réservée aux signataires vivants d'une page officielle : abonnés de la page, compteurs matérialisés des hubs concernés, seuil du domaine. Option : nombre de membres attestés par ce poste, au-dessus du seuil seulement.
- **Web** : onglet « Audience » de la gestion de la page ; « Moins de 20 » sous le seuil ; aucun export ; fournisseur de démonstration.
- **Mobile** : sans objet.
- **Données personnelles** : agrégats seulement ; aucun retour vers consulat.ga.
- **Tests et cliquets** : sous le seuil, aucun nombre ; ancien signataire refusé.
- **Critères d'acceptation** : aucun identifiant de personne dans la réponse.
- **Dépend de** : VC-07 ; plan 06 (DS-15).
- **Porte** : décision 11.

### VC-18 — Gel puis redirection de l'Espace Communauté de consulat.ga · P3 · M · gabon-diplomatie
- **Pour l'utilisateur** : un seul lieu de vie communautaire.
- **Contenu** : lecture seule, puis bandeau et redirection ; aucun compte ni abonnement migré ; les objets publics passent par l'import.
- **Dépend de** : DG-009b, VC-10, pilote (DG-029).
- **Porte** : décision 12 ; gouvernance de gabon-diplomatie.

### VC-19 — Logos officiels importés sous garde · P3 · M · S1
- **Pour l'utilisateur** : la page du poste porte son logo officiel.
- **Contenu** : reprendre pour `logoUrl` la chaîne de médias de la fédération (origines HTTPS déclarées, empreinte, analyse) ; en attendant, un signataire dépose le logo.
- **Dépend de** : DG-009b.
- **Porte** : origines des médias déclarées par le propriétaire.

### VC-20 — Communiqués synchronisés sans personne, retrait automatique · P3 · L · S1
- **Pour l'utilisateur** : les communiqués de consulat.ga arrivent seuls et se retirent seuls.
- **Contenu** : admettre une publication de page sous autorité de l'import, avec révision et tombe, comme pour les reflets ; remplace VC-11 si le volume le justifie.
- **Dépend de** : VC-11 mesuré ; amendements de VC-02.
- **Porte** : décision 4.

### VC-21 — Pages des postes lisibles depuis ANTSIA et sans compte · P3 · S · S2 + propriétaire
- **Pour l'utilisateur** : la page d'un poste se lit sans être membre de DIASPORALE.
- **Contenu** : règle `root` posée à l'import ou exposée au formulaire ; recette de la lecture publique.
- **Dépend de** : ouverture de la vie publique d'ANTSIA (plan 11).
- **Porte** : décision 9.

## 6. Ordre recommandé et dépendances

| Vague | Lots | Pourquoi dans cet ordre |
|---|---|---|
| 1 | VC-01, VC-02 | Dire vrai d'abord ; décider avant de coder |
| 2 | VC-04, VC-05, VC-06, VC-08 | Une voix officielle au pilote, sans attendre consulat.ga |
| 3 | VC-03, DG-009b (postes, puis associations), VC-07, VC-09 | L'import, quand le producteur est à niveau |
| 4 | VC-10, VC-11, VC-12, VC-13 | Boucler avec consulat.ga ; mieux communiquer |
| 5 | VC-14 à VC-17 | Tenir la parole officielle ; rendre des agrégats à l'institution |
| 6 | VC-18 à VC-21 | Sous condition externe |

**Ce que ce plan attend des autres plans.**
- Moteur (S1) : PG-01 (console des pages), PG-03 (évènements pour toute page), PG-08 (rôles), FP-06 (commentaires), SU09 (alertes), VP-02 (Officiel manuel), VP-05 (règle politique), MC-01 et MC-06 (signaler une page, usurpation).
- Plan 01 : parcours du membre pour l'attestation, textes de consentement, écran « à renouveler ».
- Plan 06 : place du poste, de l'annonce et de l'alerte dans le hub ; comptage des pages importées.
- Plan 07 : fiche et revendication d'une page importée ; plan 08 : évènements ; plan 11 : kit d'arrivée officiel.
- Plan 13 : genres d'avis `page_post`, alerte, invitation à signer. Plan 14 : page signalable, noms protégés. Plan 17 : DS-06 inscrit la création de la page du poste à la mise en production.

**Volet de recette en mode moteur (campagne DS-05).** Backend local, comptes de démonstration par acteur (docs/34 de DIASPORALE).

| Étape | Comptes | Résultat attendu |
|---|---|---|
| Publier sur la page officielle | `verifie`, puis `institution` | Refus indistinct pour le premier ; communiqué publié avec le badge pour le second |
| Suivre, puis recevoir l'avis | `declare` | Avis reçu sans contenu ; il ouvre le communiqué |
| Épingler, puis retirer l'épingle | `institution` | L'annonce apparaît puis disparaît de la fiche (et du hub après VC-08) |
| Inviter un signataire sans IDN de niveau 2 | `institution`, `leger` | Refus explicite « identité IDN de niveau 2 » |
| Retirer un rôle pendant la session | `institution`, second signataire | Publication refusée aussitôt (R-G11) |
| Revendiquer la page officielle | `verifie` | Refus : une institution ne se revendique pas |
| Lire depuis ANTSIA | `exterieur` | Page et communiqués absents (R-G03) |
| Signaler un communiqué | `declare`, `moderateur` | Dossier au guichet ; issue notifiée |

## 7. Décisions à prendre par le propriétaire

1. **Voie de l'Officiel pour les postes.** Recommandation : import contractuel dans le réseau `diasporale` ; fédération réservée aux administrations du socle. Raison : tableau du § 4.
2. **Amender `DIASPORA-COMMUNAUTE-V1` avant sa mise en service**, ou créer une V2 plus tard. Recommandation : amender maintenant, la PR est encore brouillon et personne ne consomme le contrat.
3. **Poste du pilote, mandat et revue.** Quel poste parle au pilote France, qui signe le mandat, à quelle fréquence on revoit les habilitations. Recommandation : un seul poste, mandat écrit du chef de poste ou du ministère, revue tous les douze mois ; l'appartenance au poste ne s'affiche pas sur le profil de l'agent.
4. **Communiqués : repris par un signataire, ou synchronisés seuls.** Recommandation : reprise par un signataire au départ. Raison : un humain relit un texte libre, et le moteur n'a rien à changer.
5. **Questions au poste et coordonnées.** Recommandation : pas de messagerie avec le poste dans DIASPORALE, deux liens vers consulat.ga ; les coordonnées restent sur consulat.ga, source unique. À confirmer : l'invariant « aucune coordonnée exposée » vise-t-il aussi le numéro d'urgence d'une institution dans une alerte ?
6. **Alertes.** Recommandation : pages officielles seulement, trois par jour et 72 heures au plus (même repère que le plan 11 d'ANTSIA), zone égale aux pays de juridiction.
7. **Agenda consulaire.** Recommandation : information seule, sans inscription ; le rendez-vous se prend sur consulat.ga.
8. **Neutralité de la parole officielle.** Recommandation : reprendre la règle D07 pour les postes, l'écrire dans une charte du signataire, la faire relire par le juriste et le ministère ; commentaires ouverts par défaut, fermables par communiqué.
9. **Lecture depuis ANTSIA et sans compte.** Recommandation : non au pilote ; à rouvrir quand la vie publique d'ANTSIA ouvre.
10. **Validité d'une attestation.** Recommandation : une durée fixée par le juriste, puis une revérification en un geste ; le contrat de cycle de vie ensuite.
11. **Ce que le poste reçoit.** Recommandation : agrégats avec seuil, aucun nom, aucun export ; le nombre de membres attestés par le poste seulement si le juriste l'admet.
12. **Espace Communauté de consulat.ga et bouton d'entrée.** Recommandation : geler après le pilote, quand l'import et le bouton sont en service ; pour mesurer l'entrée depuis consulat.ga, un marqueur d'origine non personnel, compté en agrégat, ou rien.
13. **Associations importées.** Les informer avant l'import ? Les compter dans le hub avant leur revendication ? Recommandation : information préalable par consulat.ga ; pages marquées « non revendiquée » et comptées à part.
14. **Journal du producteur.** Durée de conservation : 13 mois proposés par le contrat ; au juriste.

## 8. Risques et points d'attention

- **Dépendance à un autre dépôt, lu dans une copie périmée.** Les deux routes vivent sur des branches en retard, dans un dépôt à la gouvernance propre. Les numéros de PR, les comptes de tests et l'état des branches datent du 15/10 et du 9/11 ; à relire avant VC-03. Rien de ce plan ne publie côté consulat.ga.
- **Texte libre et HTML.** Une liste blanche de champs ne garantit pas l'absence de donnée personnelle dans une description. Jamais de HTML rendu ; relecture humaine des communiqués.
- **Doublon et renommage de la page du pilote.** Sans référence d'import posée à la création, l'import créerait une seconde page : poser la référence, ou tester l'adoption. Un administrateur habilité peut renommer la page et changer son pays : l'import doit réaffirmer ces champs.
- **Un poste, plusieurs pays.** Le moteur donne un pays à une page ; sans table de juridiction, des hubs resteront sans poste.
- **Usurpation.** Aucun nom protégé ; une page ne se signale pas depuis DIASPORALE. Un faux « Consulat » peut naître avant toute page officielle (plan 14).
- **Neutralité.** Une page officielle qui ferait campagne ruinerait la confiance ; la charte précède l'habilitation.
- **Données sensibles.** Ne jamais employer un dossier consulaire réel en recette ; ne jamais lire les rôles tenus dans consulat.ga.
- **Variables.** Noms seulement : `DIASPORA_ATTESTATION_URL`, `DIASPORA_PARTNER_KEY_ID`, `DIASPORA_PARTNER_KEY` côté moteur ; `DIASPORA_PARTNER_KEYS` côté consulat.ga. Leur pose revient au propriétaire.
- **Droit.** Reprise d'objets publics, parole d'un poste sur une plateforme opérée par un tiers, durée des journaux : questions au juriste ; rien n'est dit « conforme ».

## 9. Prompts d'implémentation

### Prompt VC-01
```text
Tu es la session S2 (DIASPORALE). Écris en français. Opus seulement.
Lis : CLAUDE.md, docs/etudes/2026-11-10-finalisation/15_VIE_PUBLIQUE_CONSULAIRE.md (§ 2 lignes 51 et 70, § 4.1, lot VC-01).
Branche claude/officiel-dire-vrai depuis origin/main. Périmètre : apps/diasporale_com/src/screens/page-screen.tsx, les fragments fr et en de packages/diasporale-features/src/i18n/locales, leurs tests.
Vérifie d'abord que l'état décrit est toujours vrai. Puis : réécris hub.emptyAssociationsBody et hub.emptyEventsBody sans promesse d'import ni d'évènement de poste ; sur une page d'institution, retire le bouton « Écrire » désactivé et montre la phrase de renvoi vers consulat.ga, avec le lien existant si NEXT_PUBLIC_CONSULATE_URL est posée. Aucune adresse en dur.
Vérifie : bun run --cwd ../ANTSIA verify avec le verrou ; captures à 390 et 1280 px en démonstration et en mode moteur. Arrête-toi avant toute publication.
```

### Prompt VC-04
```text
Session S2. Lis le lot VC-04 du plan 15, ../ANTSIA/convex/modules/pages/admin.ts (createInstitutionPage, grantPageAdmin), ../ANTSIA/apps/admin_antsia_ga/src/components/console-pages.tsx, docs/34_COMPTES_DE_DEMONSTRATION.md.
Ne modifie aucun fichier du moteur hors de convex/modules/diaspora/. Dépose une issue [S1] dans administration-ga/antsia : champ « référence d'import » au formulaire de la console ; habilitation d'un agent servie par PG-01 avec la référence du mandat pour motif.
Dans DIASPORALE : écris un document numéroté à la suite dans docs/ (procédure, modèle de mandat, retrait) ; ajoute les tests de la tranche pour le réseau diasporale (membre ordinaire refusé, signataire sans IDN de niveau 2 refusé, rôle retiré coupé aussitôt).
Joue R5 sur le backend local seulement, avec les comptes institution, verifie et administrateur ; rapport daté dans docs/recette/. Verify vert. N'exécute aucune commande vers un déploiement en ligne.
```

### Prompt DG-009b
```text
Session S2. Lis le plan 15 (§ 2 « le contrat », § 4, lot DG-009b), la décision de VC-02 et le contrat à jour côté gabon-diplomatie. Si le contrat n'est pas amendé ni remis à niveau, arrête-toi et dis-le.
Branche claude/import-public. Périmètre : packages/diasporale-domain (copie typée et relecture en liste blanche), ../ANTSIA/convex/modules/diaspora/ (action d'import, journal, écrans de lecture), apps/diasporale_com et packages/diasporale-features (écran « Import public », mentions de source, démonstration, textes fr et en).
Commence par les postes seuls. Pour toute écriture dans les pages, demande par une issue [S1] une création interne de page importée ; n'insère pas toi-même dans la table des pages sans réponse écrite.
Tests avant le code : rejeu sans doublon, retrait par absence après une passe complète, champ en plus refusé, coordonnée retirée d'un texte, signature fausse, adoption de la page créée par la console.
Verify vert. Aucune variable d'environnement, aucun appel à un déploiement de consulat.ga sans mon accord écrit. Termine par ce qui est vrai, les preuves, ce qui n'est pas vérifié.
```

### Prompt VC-05
```text
Session S2. Lis le lot VC-05 du plan 15, ../ANTSIA/convex/modules/diaspora/profile.ts et hubPages.ts, apps/diasporale_com/src/data/engine-views.ts (toProfileView), apps/diasporale_com/src/screens/profile-screens.tsx, packages/diasporale-features/src/demo/selectors.ts.
Branche claude/poste-de-rattachement. Dans la tranche, ajoute une lecture à part : pour un profil lisible dont le poste est visible du lecteur, la page dont la référence d'import est consular_posts:<slug>, relue par la garde de lecture des pages ; elle rend le nom et l'adresse, ou rien. Côté application, toProfileView cesse de rendre un nom vide et la ligne « Poste de rattachement » devient un lien vers la fiche ; sans page, la ligne ne s'affiche pas. La démonstration rend le même résultat.
Tests : profil avec et sans page, visibilité « moi seul », lecteur d'un autre pays. Verify vert ; captures à 390 et 1280 px. Arrête-toi avant de publier la démonstration.
```

## 10. Sources lues

- Contexte commun : dossier de reprise, cahier de DIASPORALE (docs/00), plan global (docs/14), registre des décisions (docs/17), plan 15 et plan directeur d'ANTSIA, registre des 317 lots.
- Plans du moteur : `A:docs/etudes/2026-11-09-finalisation/11_VIE_PUBLIQUE_MEDIAS_ANNONCEURS.md` (§ 2, lots PA9, VP-01 à VP-03, SU09, § 6 à § 8) ; `A:docs/etudes/2026-11-09-finalisation/07_PAGES_GROUPES_EVENEMENTS.md` (lot PG-01).
- DIASPORALE : `D:docs/01_PLAN_IMPLEMENTATION_PROMPTS_DIASPORALE.md` (encart d'état, PD3, PD5) ; `D:docs/13_ETUDE_RESEAU_SOCIAL_DIASPORALE.md` (§ 6) ; `D:docs/34_COMPTES_DE_DEMONSTRATION.md`.
- ANTSIA : `A:docs/adr/0003-federation-entrante-par-contrats-signes.md`, `A:docs/adr/0013-pages-administratives-federees-et-revisions-source.md`, `A:docs/adr/0014-publications-federees-sans-personne-technique.md`, `A:docs/adr/0015-agents-volontaires-et-accord-local-renouvelable.md`, `A:docs/adr/0016-producteur-administratif-et-transfert-de-consentement.md` ; `A:docs/contrats/RESEAU-PUBLIC-V1.md`, `A:docs/contrats/FEDERATION-INBOX-V1.md` ; `A:docs/00_CAHIER_DES_CHARGES_ANTSIA.md` (EXF-AN-36 à 38, 48).
- Hors instantanés, en lecture seule : annexe C du plan du programme ; dossier produit de la communauté (fiches F02, F13, F14) ; les deux contrats et l'ADR proposé, dans la copie de travail de la branche `feat/diaspora-communaute-v1` de gabon-diplomatie ; dossier de reprise de gabon-diplomatie (état des branches) ; décision du vault du 15/10 sur les contrats partenaires.
- Code, tranche : `A:convex/modules/diaspora/attestation.ts`, `A:convex/modules/diaspora/hubPages.ts`, `A:convex/modules/diaspora/tables.ts`, `A:convex/modules/diaspora/manifest.ts`, `A:convex/modules/diaspora/demoAccounts.ts`, `A:convex/modules/diaspora/facts.ts`.
- Code, moteur : `A:convex/modules/pages/admin.ts`, `A:convex/modules/pages/signatories.ts`, `A:convex/modules/pages/identity.ts`, `A:convex/modules/pages/pages.ts`, `A:convex/modules/pages/tables.ts`, `A:convex/modules/federation/reseauPublicAccess.ts`, `A:convex/modules/federation/mirrorAccess.ts`, `A:convex/modules/federation/tables.ts`, `A:convex/modules/public/access.ts`, `A:convex/modules/posts/nativeAuthor.ts`, `A:convex/modules/people/dataPolicies.ts`, `A:packages/social-domain/src/federationProtocol.ts`, `A:convex/schema.ts`, `A:convex/http.ts`.
- Code, DIASPORALE : `D:packages/diasporale-domain/src/attestation.ts`, `D:packages/diasporale-domain/src/badges.ts`, `D:packages/diasporale-domain/src/eligibility.ts`, `D:apps/diasporale_com/src/lib/routes.ts`, `D:apps/diasporale_com/src/components/page-identity-form.tsx`, `D:packages/diasporale-features/src/demo/selectors.ts`, `D:packages/diasporale-features/src/i18n/locales/fr/door-vision.json`.
- Non lu : le code des routes du producteur sur leurs branches (seuls les contrats et l'ADR l'ont été) ; l'état distant des PR de gabon-diplomatie ; aucune application de référence n'a été rouverte en ligne.
