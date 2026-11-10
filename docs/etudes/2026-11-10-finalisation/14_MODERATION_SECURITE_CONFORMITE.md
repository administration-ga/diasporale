# Plan 14 — Modération, sécurité et conformité

> Constaté par lecture du code d'`origin/main` (DIASPORALE `bead76d`, ANTSIA `fd58d73b`), le 10 novembre 2026. Rien n'a été exécuté : ni test, ni recette, ni publication.
> Applications de référence : outils d'administration des Groupes Facebook, Nextdoor, Discord, Reddit, LinkedIn. Comparaison faite de mémoire, sans revérification en ligne ; un « ? » marque ce qui n'est pas sûr.
> Ce plan détaille, pour la modération, la sécurité des personnes et la conformité, le plan 15 du dossier de finalisation d'ANTSIA. Les lots qu'il en reprend gardent leur identifiant (DS-…, DG-…) ; les lots nouveaux portent le préfixe `MD-`.
> Ce plan n'est pas un avis juridique : il décrit, il pose les questions au juriste (§ 7), il n'affirme jamais « conforme ». Le dépôt est public : chaque faiblesse y est dite par ce qu'il faut construire.

Légende des chemins : `D:` = dépôt DIASPORALE, `A:` = dépôt ANTSIA. « Écran » = atteignable depuis l'interface de diasporale.com ; « Moteur » = la fonction existe côté serveur.

## 1. L'intention du propriétaire

- **Pour qui** : le membre qui subit ou voit un abus, l'auteur qui doit pouvoir se défendre, le modérateur d'un pays (persona P8) et l'administrateur du réseau (P9) (cahier § 6.1 et § 6.4).
- **La règle de fond** : aucune surface de contenu créé par la communauté n'ouvre dans un pays sans modération par pays (invariant 10, cahier § 5) ; un pays s'ouvre avec deux associations relais et un modérateur (cahier § 7, A8).
- **Ce qui est demandé** : tout contenu se signale, file par pays puis file du réseau, décision motivée, journal (EXF-DG-40) ; sanctions graduées, recours, rapport périodique (EXF-DG-41) ; relecture par défaut à l'ouverture, puis publication directe, mots bloqués, débit partout (EXF-DG-42) ; blocage silencieux (EXF-DG-43, plan 05).
- **Objectif chiffré du cahier** (§ 2.3), jamais mesuré : signalements traités sous 48 h dans plus de 95 % des cas.
- **Déjà décidé** : les contenus de l'entraide, du mentorat, du kit et de l'emploi sont visibles dès l'écriture et modérés après signalement, la relecture préalable ne vient que d'une politique explicite du réseau (décision du 18/10, vault) ; un avis de service attend toujours une politique (DG-016) ; délais de 24 h et 72 h posés à la transmission, le déclarant n'apprend que l'effet sur le contenu (SU01d) ; la voie « Délais légaux » passe en tête du bureau (diasporale#26) ; la file liste, elle ne compte rien.
- **Niveau de confidentialité** : le moteur peut lire les contenus pour modérer, exporter et effacer ; aucune promesse de chiffrement de bout en bout (D-G06, docs/17 de DIASPORALE) ; aucun corps de contenu n'est copié dans un dossier (ADR-0009 du moteur).
- **La confiance ne s'achète pas** : badges calculés, jamais vendus ; une attestation consulaire ne certifie jamais une compétence professionnelle (docs/14 de DIASPORALE, lot G9).
- **Droit** : loi gabonaise n° 001/2011 modifiée et règlement européen pour les résidents de France (EXT-DG-04) ; ordonnance n° 0011/PR/2026 lue par l'analyse SU01 du moteur ; « aucun statut conforme déduit d'un test technique » (docs/14, lot G9).
- **Refusé** : classement comportemental (D-G05), mineurs sans décision (D-G11), publicité au pilote (D-G04).

## 2. Ce qui existe

| # | Capacité | État | Écran | Moteur | Preuve |
|---|---|---|---|---|---|
| 1 | Signaler une publication (fil, profil, page), avec précision facultative | Présent | oui | oui | `D:packages/diasporale-features/src/components/post-menu.tsx`, `A:convex/modules/moderation/moderation.ts` (`reportPost`) |
| 2 | Signaler un commentaire | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/moderation/moderation.ts` (`reportComment`) ; motifs : `report`, `signal` dans `D:packages/diasporale-features/src/components/comments.tsx` |
| 3 | Signaler une publication du mur d'un groupe d'association | Absent ici ; le moteur l'a (c'est une publication) | non | oui | `D:apps/diasporale_com/src/components/association-group.tsx` (aucun geste), `A:convex/modules/diaspora/associationGroups.ts` (`posts`) |
| 4 | Signaler un ajout de la galerie d'un évènement | Absent ici ; le moteur l'a (publication de page) | non | oui | `D:apps/diasporale_com/src/components/association-event-gallery.tsx`, `A:convex/modules/posts/postWrite.ts` |
| 5 | Signaler un profil | Absent ici ; le moteur l'a, et verse le dossier au réseau racine | non | oui | cible `person` de `A:convex/modules/moderation/targets.ts` ; motifs : `report`, `signal` dans `D:apps/diasporale_com/src/screens/profile-screens.tsx` |
| 6 | Signaler une page d'association ou d'entreprise | Absent ici ; le moteur l'a | non | oui | cible `page` ; mêmes motifs dans `D:apps/diasporale_com/src/screens/page-screen.tsx` |
| 7 | Signaler un évènement d'association | Absent ici ; le moteur l'a | non | oui | cible `event` ; mêmes motifs dans `D:apps/diasporale_com/src/components/association-events.tsx` |
| 8 | Signaler une offre de service | Absent | non | non | aucune cible : motifs `serviceOffer`, `diasporaServiceOffer` dans `A:convex/modules/moderation/tables.ts` ; motifs `moderat`, `contentState` dans `A:convex/modules/diaspora/services.ts` |
| 9 | Signaler une demande de service, une proposition, une demande d'adhésion | Absent | non | non | motifs `moderat`, `contentState` dans `A:convex/modules/diaspora/serviceRequests.ts` et `A:convex/modules/diaspora/associations.ts` |
| 10 | Signaler un avis et la réponse d'une page (motifs propres : spam, harcèlement, fraude, autre) | Présent | oui | oui | `D:apps/diasporale_com/src/components/service-reviews-section.tsx`, `D:apps/diasporale_com/src/data/engine-service-reviews.ts` |
| 11 | Signaler une question et une réponse d'entraide | Présent | oui | oui | `D:apps/diasporale_com/src/components/mutual-aid-question-detail.tsx` |
| 12 | Signaler une mission bénévole | Présent | oui | oui | `D:apps/diasporale_com/src/components/mutual-aid-mission-detail.tsx` |
| 13 | Signaler un profil de mentor ; une demande de mentorat (le mentor seul) | Présent | oui | oui | `D:apps/diasporale_com/src/screens/mentoring-screens.tsx`, `D:apps/diasporale_com/src/components/mentoring-requests.tsx` |
| 14 | Signaler une ressource du kit ; la dire « périmée », à part | Présent | oui | oui | `D:apps/diasporale_com/src/components/arrival-kit-actions.tsx`, `A:convex/modules/diaspora/arrivalKit.ts` (`flagResourceOutdated`) |
| 15 | Signaler une offre d'emploi, un profil de talent, une candidature (l'équipe seule) | Présent | oui | oui | `D:apps/diasporale_com/src/screens/jobs-screens.tsx`, `D:apps/diasporale_com/src/components/job-parts.tsx`, `D:apps/diasporale_com/src/components/job-recruiter-panel.tsx` |
| 16 | Signaler un message de mise en relation | Fermé : la vue partagée du moteur porte le geste, la politique contextuelle reste fermée | non | oui | `A:packages/social-features/src/features/messagerie/ContextualConversationView.tsx`, `D:apps/diasporale_com/src/components/contextual-conversations.tsx` |
| 17 | Signaler un message personnel d'iCom | Absent | non | non | motifs : `personalMessage` dans `A:convex/modules/moderation/tables.ts` (lots IC-03 et MC-01 du moteur) |
| 18 | Signaler un message de groupe, un statut, un album | Absent ici ; le moteur a les cibles, aucun écran | non | oui | cibles `groupMessage`, `story`, `album` ; `D:apps/diasporale_com/src/components/icom.tsx`, `D:apps/diasporale_com/src/components/feed-stories.tsx` et `D:apps/diasporale_com/src/components/profile-albums.tsx` montent les composants du moteur |
| 19 | Signaler sans compte (personne représentée, tiers, autorité) | Absent | non | non | motifs : `contact`, `signalement` parmi les routes publiques de `D:apps/diasporale_com/src/lib/routes.ts` |
| 20 | Douze motifs du moteur, dont les six de l'ordonnance | Présent | oui | oui | `D:packages/diasporale-features/src/data/types.ts` (`REPORT_REASONS`), `A:packages/social-domain/src/moderation.ts` |
| 21 | Motifs « arnaque » et « spam » | Partiel : sur les avis seulement | partiel | partiel | `D:packages/diasporale-features/src/data/service-reviews-port.ts` (`SERVICE_REVIEW_REPORT_REASONS`) |
| 22 | Précision écrite du déclarant lue par le modérateur | Partiel : recueillie pour une publication, jamais servie au guichet | non | partiel | `A:convex/modules/diaspora/moderationDesk.ts` (`caseValidator` : « jamais la note du déclarant ») |
| 23 | Masque immédiat pour le déclarant, sur le lien aussi | Présent | oui | oui | `A:convex/modules/moderation/policy.ts` (`canReadModeratedContent`), `D:apps/diasporale_com/src/components/report-content-sheet.tsx` (`ReportedContent`) |
| 24 | Doublon rendu « déjà signalé », son propre contenu refusé, débit | Présent | oui | oui | `A:convex/modules/moderation/cases.ts` (`report`), seau `report.create` de `A:convex/lib/rateLimit.ts` |
| 25 | Signaler avec un compte en attente (lecture seule) | Présent | oui | oui | `cases.report` (`minStatus: "en_attente"`) |
| 26 | Accusé de réception et avis de décision au déclarant | Présent | oui | oui | `A:convex/modules/moderation/reporterNotices.ts`, `D:packages/diasporale-features/src/components/notification-bell.tsx` |
| 27 | « Mes signalements » : échéance légale, issue pour le contenu | Présent | oui | oui | `D:apps/diasporale_com/src/components/my-reports.tsx` |
| 28 | Signalement en démonstration : rien n'est transmis, masque local | Présent | oui | — | `D:packages/diasporale-features/src/demo/content-reports.ts` |
| 29 | Guichet réservé, refus indistinct, entrée de menu réservée | Présent | oui | oui | `D:apps/diasporale_com/src/screens/moderation-desk-screens.tsx`, `A:convex/modules/diaspora/moderationDesk.ts` (`myDesk`) |
| 30 | File des signalements ouverts, par fenêtres bornées | Présent | oui | oui | `D:apps/diasporale_com/src/components/moderation-desk-queue.tsx`, `moderationDesk.ts` (`queue`) |
| 31 | Filtre par pays de la cible, par nature, par équipe | Présent (filtre de lecture) | oui | oui | `moderationDesk.ts` (`targetFacts`, `inZone`) |
| 32 | Compétence scellée par pays (modérateur d'un pays) | Absent | non | non | `A:convex/modules/moderation/tables.ts` : `moderationTeams.scope` est une nature de contenu ; l'en-tête de `moderationDesk.ts` le dit |
| 33 | Routage d'un dossier vers l'équipe de son pays | Absent | non | non | `cases.report` choisit l'équipe par nature, sinon la première équipe sans nature |
| 34 | Dossiers « sans pays » (compte, messages, statut, album, portée diaspora) | Présent | oui | oui | zone `none` de `moderationDesk.ts` |
| 35 | Voie « Délais légaux » : fondement, chronomètre, échéance, accusé | Présent | oui | oui | `D:apps/diasporale_com/src/components/moderation-desk-deadlines.tsx`, `cases.deadlineQueue` |
| 36 | Aperçu borné du contenu, sans auteur ni déclarant | Présent | oui | oui | `A:convex/modules/moderation/reviewProjection.ts`, `A:convex/modules/diaspora/moderationTargets.ts` (`diasporaModerationExcerpt`) |
| 37 | Décisions antérieures sur la même cible | Présent | oui | oui | `moderationDesk.ts` (`caseDetail`) |
| 38 | Historique de la personne (récidive) | Absent | non | non | motifs : `personHistory`, `recidiv`, `strike` (lot MC-03 du moteur) |
| 39 | Décision motivée : classer, retirer, avertir, mettre en sourdine, suspendre, exclure, avec durée | Présent | oui | oui | `D:apps/diasporale_com/src/components/moderation-desk-case.tsx`, `D:packages/diasporale-features/src/data/moderation-desk-port.ts` (`deskSanctions`) |
| 40 | Confirmation explicite d'une mesure lourde | Présent | oui | — | `moderation-desk-port.ts` (`isHeavyDecision`) |
| 41 | Personne partie au dossier écartée (auteur, déclarant, signataire, ancien décideur) | Présent | oui | oui | `moderationDesk.ts` (`caseParty`), `cases.ts` (`assertNoPageDecisionConflict`) |
| 42 | Mettre un dossier « en examen » | Partiel : le filtre existe, aucun geste ne pose l'état | partiel | partiel | `moderation-desk-queue.tsx` ; `cases.decide` n'admet que classer ou agir |
| 43 | File de relecture préalable, approuver ou refuser | Partiel : un message de mise en relation mis en relecture n'y a pas de ligne | oui | oui | `moderationDesk.ts` (`pendingQueue`, `typedTarget`) |
| 44 | Recours du réseau : file, maintien, annulation, rétablissement | Fermé en production : réservé à l'administration du réseau, que rien ne nomme hors démonstration | oui | oui | `D:apps/diasporale_com/src/components/moderation-desk-appeals.tsx`, `cases.reviewNetworkAppeal` |
| 45 | Recours de plateforme | Présent (console) | console | oui | `A:apps/admin_antsia_ga/src/components/console-appeals.tsx` |
| 46 | Équipes : créer, ajouter et retirer un membre, avec motif | Présent ; en production, par la console seulement | oui | oui | `D:apps/diasporale_com/src/components/moderation-desk-team.tsx`, `A:convex/modules/platform/console.ts` (`createTeam`) |
| 47 | Désactiver ou renommer une équipe | Absent | non | non | motifs : `archiveTeam`, `renameTeam`, `deactivateTeam` |
| 48 | Nommer un administrateur ou un modérateur du réseau | Absent hors démonstration | non | non | seules écritures du rôle : `A:convex/modules/diaspora/demoAccounts.ts` et `A:convex/modules/platform/demoAccounts.ts` |
| 49 | Réglages : relecture préalable par surface, plafond de liens, cadence | Absent ici ; le moteur a l'écriture, sans lecture ni écran | non | partiel | `cases.setPolicy` ; aucun appelant dans les deux dépôts |
| 50 | Mots bloqués | Absent ici ; idem | non | partiel | `cases.setBlockedTerm` |
| 51 | Journal des décisions du réseau | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/platform/audit.ts` (`paginateNetworkAudit`) |
| 52 | Alerter l'équipe à l'arrivée d'un dossier, rappeler avant l'échéance | Absent | non | non | aucun avis vers une équipe dans `cases.ts` ; seule la console lit `legalDeadlineAlert` |
| 53 | Compteurs, charge, délais tenus | Absent | non | non | la file liste, elle ne compte rien (`moderation-desk-port.ts`) |
| 54 | Attribuer un dossier, note interne, traitement groupé, recherche | Absent | non | non | motifs : `assign`, `internalNote`, `bulk` |
| 55 | Guichet de démonstration (dossiers fictifs, sans effet) | Présent | oui | — | `D:packages/diasporale-features/src/demo/moderation-desk.ts` |
| 56 | Avis neutre à l'auteur, « Décisions de modération », recours motivé | Présent | oui | oui | `D:apps/diasporale_com/src/components/moderation-decisions.tsx`, `D:apps/diasporale_com/src/data/engine-data-rights.ts` |
| 57 | Décisions d'un contenu de page, recours d'un signataire | Présent | oui | oui | `D:apps/diasporale_com/src/components/page-decisions-panel.tsx`, `D:apps/diasporale_com/src/data/engine-page-decisions.ts` |
| 58 | Règle enfreinte, date limite de recours, « état du compte » | Absent | non | non | texte libre du modérateur seulement (lot MC-04 du moteur) |
| 59 | État de modération montré à qui gère le contenu | Partiel : entraide, kit, mentorat, emploi ; pas de la même façon pour publications, évènements, avis | partiel | oui | `D:packages/diasporale-features/src/components/moderation-banner.tsx`, `D:packages/diasporale-features/src/data/managed-moderation.ts` |
| 60 | Suspension et exclusion valables partout ; sourdine bornée au réseau | Présent | oui | oui | `A:convex/modules/moderation/sanctions.ts`, `policy.ts` (`assertSocialWriteAllowed`) |
| 61 | Mesure lourde réservée selon la qualité du décideur | Absent | non | non | `cases.ts` (`applyDecision`) ne distingue pas membre d'équipe et rôle de réseau |
| 62 | Fin automatique d'une mesure, rétablissement après recours | Présent | — | oui | `A:convex/modules/moderation/maintenance.ts` (`expireSanctions`) |
| 63 | Retrait d'un parrainage par la modération | Fermé en production : rôle de réseau exigé, et aucun écran | non | oui | `A:convex/modules/diaspora/membership.ts` (`revokeSponsorship`) |
| 64 | Retirer un commentaire sous sa publication ; une publication de son groupe | Présent | oui | oui | `comments.tsx`, `association-group.tsx`, `A:convex/modules/thematicGroups/thematicGroups.ts` (`removeGroupPost`) |
| 65 | Prévenir le responsable d'une page ou d'un groupe d'un signalement dans son espace | Absent | non | non | motifs : `space_report` (lot SU01f du moteur) |
| 66 | Relecture avant publication des évènements de page, avis, réponses de page, ajouts de galerie, tant qu'aucune politique n'est posée | Présent | oui | oui | `policy.ts` (`moderatePageContentWrite`), `A:convex/modules/events/pageEvents.ts`, `A:convex/modules/diaspora/serviceReviews.ts` |
| 67 | Publication directe des contenus personnels et de la vague H ; relecture sur politique explicite | Présent | oui | oui | `A:convex/modules/diaspora/moderationContent.ts` (`moderateDiasporaWrite`) |
| 68 | Relecture à l'ouverture d'un pays tant que son équipe n'a pas deux modérateurs | Partiel : règle pure, employée par la démonstration seule | démo | non | `D:packages/diasporale-domain/src/moderation.ts` (`publicationPolicy`), `D:packages/diasporale-features/src/demo/store.ts` |
| 69 | Offres de service et demandes soumises aux mots bloqués et à la relecture | Absent | non | non | voir ligne 8 |
| 70 | Débit de toutes les écritures, seaux renforcés des comptes sans badge | Présent | — | oui | `A:convex/lib/rateLimit.ts` |
| 71 | Limites selon l'ancienneté du compte | Absent | non | non | motifs : `accountAge`, `joinedAt` dans `rateLimit.ts` (lot MC-07 du moteur) |
| 72 | Création de page réservée aux membres vérifiés | Présent | oui | oui | `A:convex/modules/pages/pages.ts` (`createPage`) |
| 73 | Instruire une revendication de page | Fermé en production : rôle de réseau exigé | oui | oui | `A:convex/modules/pages/claims.ts` (`decidePageClaim`), `D:apps/diasporale_com/src/components/page-claim-review.tsx` |
| 74 | Contrôler un nom proche d'une institution ou d'une page existante | Absent | non | non | motifs : `similar`, `lookalike`, `reserved` (lot MC-06 du moteur) |
| 75 | Conseils contre les arnaques, avertissement avant un lien | Absent | non | non | motifs : `arnaque`, `scam` dans `D:packages/diasporale-features/src/i18n/locales/fr` (seuls des libellés de motif) |
| 76 | Adresse exacte refusée en voix de personne, aucune coordonnée exposée | Présent | oui | oui | `D:packages/diasporale-domain/src/conversation-contexts.ts` (`context_address_forbidden`) ; règle transverse de docs/17 |
| 77 | Blocage personnel | Présent | oui | oui | `D:apps/diasporale_com/src/screens/relations-screen.tsx` (plan 05) |
| 78 | Antivirus des fichiers | Présent | — | oui | `A:convex/modules/files/avProviders.ts` |
| 79 | Voile sur un contenu sensible, empreintes | Absent | non | non | lot MC-08 du moteur |
| 80 | Fermer une rubrique ou un pays en urgence | Absent | non | non | motifs : `killSwitch`, `surfaceClosed`, `featureFlag` dans `A:convex/modules/diaspora` |
| 81 | Règles de la communauté publiées | Absent | non | non | motifs : `regles`, `rules`, `terms` dans `D:apps/diasporale_com/src/lib/routes.ts` |
| 82 | Mentions légales et confidentialité | Partiel : charpente marquée « TODO JURISTE » (plan 17) | oui | — | `D:apps/diasporale_com/src/screens/legal-screen.tsx` |
| 83 | Chiffres de modération montrés aux membres | Absent ici ; le moteur les calcule par réseau | non | oui | `maintenance.ts` (`transparency`, `aggregateNetwork`) |
| 84 | Indicateur « dossiers tranchés dans le délai » | Absent | non | non | treize indicateurs sans modération : `D:packages/diasporale-domain/src/pilot-metrics.ts` |
| 85 | Charte, formation, déclaration d'intérêts des modérateurs | Absent | non | non | aucun document dans `D:docs` |
| 86 | Permanence, procédure d'incident, contact des autorités | Absent | non | non | aucun document dans `D:docs` |
| 87 | Âge et mineurs | Fermé : arbitrages A3 et A4 du moteur, D-G11 | non | non | motifs : `birthDate`, `ageRange` |
| 88 | Mesures sur ordre du juge, conservation des contenus signalés | Absent | non | non | lots SU01h et SU01g du moteur |

Décompte : **Présent 39 · Partiel 7 · Absent 37 · Fermé 5** (88 capacités).

### Ce que le moteur sait déjà faire et que DIASPORALE ne montre pas

- `cases.report` accepte déjà le commentaire, la page, l'évènement, le compte, le message de groupe, le statut et l'album : pour ces cibles, « Signaler » ne demande aucun changement de serveur.
- `paginateNetworkAudit` rend le journal des décisions du réseau à qui porte un rôle de réseau.
- `maintenance.transparency` rend, par réseau et par jour, le nombre de dossiers reçus, suivis d'effet et classés, masqué sous le seuil de cinq. Le passage nocturne le calcule aussi pour `diasporale`.
- `cases.setPolicy` et `cases.setBlockedTerm` écrivent les réglages ; les lectures arrivent avec le lot MC-02 du moteur.
- `cases.paginatePending` couvre toutes les surfaces en relecture ; la file de DIASPORALE en omet une.
- Console : `createTeam`, `setTeamMember`, alerte des délais légaux par réseau (`A:convex/modules/platform/console.ts`).

### Ce qui est écrit mais jamais recetté en réel

| Parcours | État | Source |
|---|---|---|
| Publication signalée, accusé, retrait par la modératrice, avis de décision | Joué le 22/10, backend local isolé, comptes fictifs | `D:docs/recette/su01d-avis-et-motifs-2026-10-22/README.md` |
| Voie « Délais légaux » (72 h puis 24 h), file ordinaire à part | Joué le 22/10 en local, puis vu en ligne sur la démonstration | `D:docs/recette/su01d-bureau-delais-2026-10-22/README.md`, `D:docs/recette/demo-en-ligne-2026-10-22/README.md` |
| Signalement des neuf natures de la vague H | Une seule jouée le 19/10 (question d'entraide : envoi et masque) ; les huit autres et le traitement, jamais | `D:docs/recette/deux-comptes-2026-10-19/README.md` |
| Recours du réseau, puis de plateforme, jusqu'au rétablissement | Jamais joué | — |
| Avertissement, sourdine, suspension, exclusion, et leur fin automatique | Jamais joué dans DIASPORALE | — |
| Relecture préalable : approuver un évènement d'association, un avis, une réponse de page | Jamais joué (l'avis du 19/10 est resté en attente) | docs/32 de DIASPORALE, § 12 |
| Décisions d'une page et recours d'un signataire | Jamais joué | docs/32, § 7 |
| Composition d'une équipe par l'administration ; équipe créée par la console pour `diasporale` | Jamais joué | — |
| Dossier en retard, alerte de la console | Jamais joué ; le dossier laissé ouvert sur la démonstration le 22/10 est en retard depuis le 25/10 à 12 h 17 s'il n'a pas été tranché (non vérifié) | rapport du 22/10 |

## 3. Comparaison avec les applications de référence

| Capacité | Groupes Facebook | Nextdoor | Discord | Reddit | LinkedIn | DIASPORALE | Verdict |
|---|---|---|---|---|---|---|---|
| Signaler tout objet (publication, commentaire, profil, message, espace, évènement, offre) | oui | oui | oui | oui | oui | publication et onze natures ; ni commentaire, ni profil, ni page, ni évènement, ni offre de service, ni message | À faire (MD-02, MD-03, MD-10 ; moteur IC-03, SD-01, PF-02) |
| Signaler aux responsables de l'espace et à la plateforme | oui | oui | oui | oui | oui ? | plateforme seule ; le responsable n'est pas prévenu | À adapter (MD-14) |
| Suivi du signalement par le déclarant | oui | ? | partiel | partiel | oui | accusé, échéance, issue | Déjà fait |
| Protéger le déclarant : l'auteur n'apprend rien avant la décision | oui | oui | oui | oui | oui | l'auteur lit le dossier dès son ouverture | À faire (MD-07) |
| Règles de l'espace publiées et rappelées | oui | oui | oui | oui | oui | aucune | À faire (MD-05) |
| Accord aux règles à l'entrée | oui (questions d'adhésion) | oui ? | oui | non | conditions générales | consentements, sans règles | À faire (MD-05) |
| Approbation préalable des publications | oui | non ? | non | oui | oui (groupes) | par surface au moteur, sans écran ; par défaut sur évènements et avis | À adapter (MD-04) |
| Filtre automatique par mots, liens, cadence | oui (assistant d'administration) | ? | oui | oui | oui | règles au moteur, aucun écran | À faire (MD-04) |
| Restrictions des comptes neufs | oui | ? | oui | oui | ? | lecture seule en attente, seaux renforcés sans badge | Déjà fait en partie ; ancienneté : moteur MC-07 |
| Calmer une discussion (mode lent, fermer les commentaires, pause) | oui | oui | oui | oui | oui | non | À faire (MD-15) |
| Sanctions graduées et temporaires | oui | oui | oui | oui | oui | cinq mesures, durée, fin automatique | Déjà fait ; à recetter (DS-04) |
| Historique d'un membre pour le modérateur | oui | ? | partiel | oui | — | par cible seulement | À faire (MD-12) |
| Journal des actions de modération | oui | ? | oui | oui | — | écrit, non montré | À faire (MD-17) |
| Motif donné à la personne : règle, mesure, délai de recours | oui | oui | partiel | partiel | oui | texte libre | À adapter (MD-12) |
| Recours | oui | oui | oui | oui | oui | deux niveaux en code ; premier niveau sans titulaire en production | À faire (MD-01) puis à recetter (DS-04) |
| Modérateurs locaux bénévoles, avec règles de conduite | oui (sans charte imposée) | oui | oui | oui | non | équipes sans charte, sans périmètre de pays | À faire (MD-05, MD-08) |
| Décision collégiale pour un retrait | non | oui | non | non | non | une personne décide, partie écartée | Écarté au pilote ; garde sur les mesures lourdes (MD-09) |
| Alerter les modérateurs à l'arrivée d'un signalement | oui | oui | selon réglages | oui | — | non | À faire (MD-11) |
| Identité vérifiée comme premier garde | non | oui (adresse) | téléphone | non | partiel | statut dérivé, parrainage tracé, attestation | Déjà fait (plan 01), à pousser |
| Avertissement contre les arnaques au moment du contact | oui | oui ? | partiel | non | oui ? | non | À faire (MD-13) |
| Protéger le nom d'une organisation contre l'imitation | oui | oui | oui | — | oui | badges calculés ; aucun contrôle des noms ; revendication sans décideur en production | À faire (MD-13, MD-01) |
| Fermer un espace en urgence | oui | ? | oui | oui | — | non | À faire (MD-15) |
| Signalement par un tiers sans compte | oui | ? | oui | oui | oui | non | Reporté (MD-18, juriste) |
| Rapport de transparence | oui | oui | oui | oui | oui | non | À faire (MD-16) |
| Rappel de bienveillance avant de publier | non | oui | non | non | non | non | Reporté : après les premiers retours |
| Classement ou tri des dossiers par intelligence artificielle | oui | ? | oui | partiel | oui | non | Écarté : aucune ligne d'IA, marquage SU01i d'abord |

## 4. Ce qui manque

### 4.1 Bloquant avant l'ouverture du pilote

1. **Aucun rôle de réseau ne s'attribue hors démonstration.** Sans administrateur ni modérateur du réseau : recours du premier niveau sans décideur, réglages et mots bloqués hors d'atteinte, revendications de page non instruites, retrait d'un parrainage impossible, tableau du pilote illisible. → MD-01.
2. **Des objets entiers ne se signalent pas** : commentaire, profil, page, évènement, publication de groupe, alors que le moteur les accepte. EXF-DG-40 les exige. → MD-02.
3. **L'offre de service échappe à toute modération** : ni signalement, ni mots bloqués, ni relecture, ni retrait. C'est pourtant le premier résultat visé (« trouver une compétence locale »). → MD-03.
4. **Aucun écran de réglages** : la relecture systématique des évènements d'association et des avis ne peut pas être levée, aucun mot ne peut être bloqué. → MD-04.
5. **Aucune règle écrite** de la communauté, aucune charte des modérateurs. → MD-05.
6. **Aucune permanence ni procédure d'incident**, alors que les délais de 24 h et 72 h courent en continu, week-end compris. → MD-06.
7. **Un dossier est montré à l'auteur dès son ouverture**, et un classement lui est notifié. Dans une conversation à deux ou un petit hub, cela peut désigner le déclarant. → MD-07.
8. **Le guichet n'a jamais été joué jusqu'au recours.** → DS-04 (volet guichet).
9. **Le cadre juridique n'est pas tranché** pour des résidents de France et d'Europe (§ 7, décision 1) ; les textes légaux sont une charpente (DS-07, plan 17).

### 4.2 Fonctions attendues qui manquent

- Équipes par pays, à compétence scellée, et routage des dossiers (MD-08).
- Garde sur les mesures qui valent dans tout ANTSIA (MD-09).
- Signaler une demande de service, une proposition, une demande d'adhésion (MD-10).
- Alerte de l'équipe et mesure des délais tenus (MD-11).
- Avis motivé par une règle, historique de la personne, état du compte (MD-12).
- Lutte contre les arnaques et l'usurpation propres à une diaspora (MD-13).
- Outils et avis des responsables de page et de groupe (MD-14).
- Fermeture d'urgence d'une rubrique ou d'un pays (MD-15).
- Chiffres de modération pour les membres (MD-16).
- Messages personnels et de groupe, statuts, albums : lots IC-03, SD-01, PF-02 et MC-01 du moteur ; DIASPORALE vérifie leurs montages.

### 4.3 Options qui manquent sur ce qui existe

- **Feuille de signalement** : précision écrite pour toutes les natures (aujourd'hui la publication seule) ; motifs « arnaque » et « spam » partout ; rappel de la règle concernée ; consigne d'urgence pour un danger immédiat ; « bloquer aussi cette personne ».
- **Guichet** : précision du déclarant visible ; mise en examen ; nombre de dossiers à échéance ; recherche par numéro de dossier ; lien vers les autres dossiers de la même personne ; modèles de motif par règle ; note interne.
- **Équipes** : désactiver, renommer, voir qui a traité quoi.
- **Côté membre** : la règle enfreinte, la date limite de recours, l'effet de la mesure dit en clair (« vous ne pouvez plus publier jusqu'au … »).
- **Zone du guichet** : un message de mise en relation hérite du pays de son objet au lieu de « sans pays ».

### 4.4 Améliorations de l'existant

- Le filtre par pays s'applique après la pagination : une fenêtre peut être vide. Un rattachement du dossier à son pays (MD-08) le règle.
- La démonstration applique une règle de relecture que le moteur n'a pas (ligne 68) : parité à rétablir (D-G13).
- Les messages de mise en relation manquent à la file de relecture (ligne 43) : défaut dormant, actif dès qu'un mot bloqué existe.
- Le signalement d'un profil part au réseau racine : le dire dans la feuille, ou décider autrement (§ 7).
- L'avis générique dit « Refusée. » pour un contenu retiré après publication (docs/32, § 9).
- Le dossier de recette laissé ouvert sur la démonstration en ligne est à trancher, avec accord écrit.

### 4.5 Ce qui distingue DIASPORALE

- **La confiance en amont** : statut dérivé, parrainage tracé et retirable, attestation consentie. Moins d'anonymes, donc une modération plus légère que dans un groupe ouvert.
- **Le déclarant est tenu au courant** : accusé, échéance légale visible, issue. Les délais sont montrés au modérateur à la minute.
- **Un modérateur lit le strict nécessaire** : aperçu borné, ni auteur ni déclarant, 500 signes d'une candidature, 80 d'une demande de mentorat.
- **Nul n'est juge et partie** : auteur, déclarant, signataire de la page et ancien décideur sont écartés par le serveur.
- **Une modération par des pairs, par pays**, dans la langue et le contexte des membres : à construire pour de bon (MD-08), c'est la promesse du cahier.
- **Aucune coordonnée exposée** : l'adresse exacte est refusée en voix de personne, le contact reste dans la conversation attachée à l'objet.

### 4.6 Écarté ou reporté, et pourquoi

| Sujet | Sort | Raison |
|---|---|---|
| Vote collégial sur chaque retrait | Écarté au pilote | Effectif trop faible ; la partie écartée et le recours suffisent ; garde réservée aux mesures lourdes (MD-09) |
| Tri des dossiers par intelligence artificielle | Écarté | Aucune ligne d'IA ; marquage SU01i du moteur d'abord |
| Notes de contexte par la communauté | Reporté | Masse critique absente ; risque de manipulation (plan 12 du moteur) |
| Copie du contenu signalé dans le dossier | Écarté | ADR-0009 ; la conservation attend l'arbitrage A2 |
| Rappel de bienveillance avant de publier | Reporté | Après les premiers retours du pilote |
| Signalement sans compte | Reporté (MD-18) | Dépend de la réponse du juriste sur le droit applicable |
| Âge et mineurs | Fermé (MD-19) | Arbitrages A3 et A4, D-G11 |

## 5. Lots d'implémentation

### DS-04 (volet guichet) — Recette CC-V et traitement au guichet · P0 · M · S2 · repris du plan 15
- **Pour l'utilisateur** : un signalement est tranché, l'auteur est prévenu, son recours aboutit, un évènement en relecture se publie.
- **Backend** : aucun code attendu au départ ; corriger dans la tranche ce que la recette révèle. Correctif déjà connu : donner une ligne de relecture aux messages de mise en relation (`pendingQueue`) et un test « chaque surface employée par DIASPORALE a sa ligne ».
- **Web** : corrections dans les composants du guichet, des décisions et des décisions de page.
- **Mobile** : sans objet. **Données personnelles** : vérifier qu'aucun aperçu ne montre auteur, déclarant ni coordonnée ; exporter un compte sanctionné.
- **Tests et cliquets** : un test par défaut trouvé ; `contextual-hooks` et `operator-audit` verts.
- **Critères d'acceptation** : rapport daté dans `docs/recette/` ; chacun des dix scénarios du § 6 dit fait ou non fait ; captures à 390 et 1280 px, sans donnée réelle.
- **Dépend de** : DS-01 ; comptes de démonstration par acteur (docs/34). Le volet CC-V est au plan 04.
- **Porte** : accord pour les variables du backend local ; rien sur la démonstration en ligne sans accord écrit.

### MD-01 — Responsables du réseau : nommer l'administration et les modérateurs · P0 · M · S2 + S1
- **Pour l'utilisateur** : DIASPORALE a ses responsables réels ; un recours trouve quelqu'un pour le juger.
- **Backend** : dans la tranche, un module des rôles : un administrateur du réseau nomme ou retire un modérateur ou un autre administrateur (membre actif, motif, journal, jamais le retrait du dernier administrateur), et une lecture des responsables par leur profil publié. Le premier administrateur est posé par un opérateur de plateforme : **issue [S1]** pour que le lot EX-08 du moteur admette un réseau gouverné par une tranche (il prévoit aujourd'hui de le refuser), et pour ajouter l'action au journal fermé. Seau `diaspora.moderation.decide`.
- **Web** : onglet « Équipe », bloc « Responsables du réseau » : liste, ajout par identifiant, changement de rôle, retrait confirmé.
- **Mobile** : après le web. **Données personnelles** : le rôle suit l'adhésion ; export et effacement existants.
- **Tests et cliquets** : refus d'un simple membre ; dernier administrateur protégé ; retrait effectif à l'acte suivant ; `operator-audit`, `network-scoped-functions` ; fournisseur de démonstration.
- **Critères d'acceptation** : sur backend local, **sans la porte de démonstration**, un opérateur nomme un administrateur ; celui-ci nomme une modératrice ; elle lit toute la file ; il tranche un recours, instruit une revendication et lit `/pilote` ; un rôle retiré ferme l'accès aussitôt.
- **Dépend de** : EX-08 et EX-06 (plan 13 du moteur).
- **Porte** : décision 2 du § 7 ; publication du moteur par S1.

### MD-02 — Signaler depuis chaque objet de DIASPORALE · P0 · L · S2
- **Pour l'utilisateur** : « Signaler » sur un commentaire, un profil, une page, un évènement, une publication de groupe, un ajout de galerie.
- **Backend** : aucun ; `cases.report` accepte ces cibles.
- **Web** : étendre la capacité `contentReports` du port et son adaptateur à ces natures ; monter la feuille existante dans les commentaires, le profil, la page, les évènements, le mur du groupe, la galerie ; jamais sur son propre contenu ni sur la page que l'on signe ; pour un profil, dire que le réseau racine traite le dossier ; masque immédiat.
- **Mobile** : après le web (plan 16). **Données personnelles** : aucune nouvelle ; « Mes signalements » couvre déjà toute nature.
- **Tests et cliquets** : test de montage par surface ; fournisseur de démonstration (masque local) ; fragments fr et en ; `i18n-keys`.
- **Critères d'acceptation** : chaque surface offre le geste à 390 et 1280 px ; le contenu disparaît pour le déclarant ; le dossier arrive au guichet avec la bonne nature et le bon pays.
- **Dépend de** : plans 05, 07, 08 pour l'emplacement des menus. Messages, statuts et albums viennent des lots IC-03, SD-01, PF-02 et MC-01 du moteur : vérifier leurs montages à leur livraison.
- **Porte** : aucune.

### MD-03 — Signaler et modérer une offre de service · P0 · M · S2 + S1
- **Pour l'utilisateur** : une offre trompeuse se signale, se retire, et ne reste contactable par aucun lien.
- **Backend** : nouvelle nature `diasporaServiceOffer`, sur le modèle des neuf natures de la vague H. **Issue [S1]** : ajout délégué à `MODERATION_SURFACES`, au validateur des cibles, aux aiguillages de `targets.ts` et de `reviewProjection.ts`, au crochet d'effacement. Dans la tranche : propriétaire = la page ; un signataire ne signale ni ne tranche son offre ; chaque écriture d'offre passe par `moderateDiasporaWrite` (mots bloqués, relecture si politique) ; lectures du catalogue filtrées par `isServedTo` ; aperçu borné (titre, description) ; pays = zone de l'offre, sinon pays de la page.
- **Web** : geste sur la fiche et la carte d'offre ; état de modération dans « Mon activité » ; libellés du guichet et de « Mes données ».
- **Mobile** : après le web. **Données personnelles** : état sans texte ; inventaire d'effacement mis à jour.
- **Tests et cliquets** : visibilité, auto-signalement refusé, offre retirée absente des résultats et du lien direct, demande nouvelle refusée sur une offre retirée ; `no-unbounded-collect`.
- **Critères d'acceptation** : à deux comptes, une offre signalée puis retirée quitte le catalogue ; la page lit la décision et fait recours ; le recours admis la rétablit.
- **Dépend de** : plan 09 (mêmes fichiers `services.ts`) ; MD-02 pour la feuille.
- **Porte** : publication du moteur par S1.

### MD-04 — Réglages de modération au guichet · P0 · M · S2
- **Pour l'utilisateur** : l'administration du réseau choisit, par rubrique, ce qui est relu avant publication, et tient la liste des mots bloqués.
- **Backend** : aucun dans la tranche ; lectures `policies` et `blockedTermsPage` du lot MC-02 du moteur.
- **Web** : quatrième onglet « Réglages », réservé à l'administration : par surface, relecture, plafond de liens, cadence ; mots bloqués ; motif obligatoire. L'écran dit en clair que, sans réglage, évènements d'association, avis, réponses et galerie sont tous relus.
- **Mobile** : sans objet. **Données personnelles** : aucune.
- **Tests et cliquets** : onglet invisible pour un modérateur ; réglage journalisé ; fournisseur de démonstration.
- **Critères d'acceptation** : un mot bloqué met en relecture la publication suivante qui le contient, et le nom d'une page qui le contient ; lever la relecture des évènements publie le suivant directement.
- **Dépend de** : MC-02 (moteur), MD-01.
- **Porte** : décision 4 du § 7 (valeurs de départ).

### MD-05 — Règles de la communauté et charte des modérateurs · P0 · S · S2 + propriétaire
- **Pour l'utilisateur** : savoir ce qui est permis, ce qui ne l'est pas, ce qui arrive et comment contester.
- **Backend** : aucun. **Mobile** : lien vers la page. **Données personnelles** : aucune.
- **Web** : page publique des règles (route dans `routes.ts`, pied de page, accueil, feuille de signalement, fiche de décision) ; fragment fr et en ; marqueur « provisoire » tant que le juriste n'a pas relu, comme les textes légaux.
- **Contenu** : respect et harcèlement ; arnaques et faux services ; usurpation d'un poste consulaire, d'une association, d'une personne ; débat politique ; vie privée et coordonnées d'autrui ; interdits de l'ordonnance (art. 32 lu par SU01) ; mesures et recours. Charte des modérateurs dans `docs/` : rôle, confidentialité, délais, conflits d'intérêts, escalade ; signée hors application au pilote.
- **Tests et cliquets** : `public-communication`, `i18n-keys`, `no-hardcoded-urls`.
- **Critères d'acceptation** : la page se lit sans compte ; chaque motif de signalement renvoie à une règle ; aucun « conforme » affirmé.
- **Dépend de** : SU01f du moteur pour l'alignement ; plan 02 pour le pied de page.
- **Porte** : relecture du juriste (décision 1) ; décisions 7 et 9.

### MD-06 — Permanence, escalade et procédure d'incident · P0 · S · S2 + propriétaire
- **Pour l'utilisateur** : un signalement grave est lu à temps, même un dimanche.
- **Backend** : aucun. **Mobile** : sans objet. **Données personnelles** : aucune. **Tests et cliquets** : sans objet.
- **Web** : dans la feuille de signalement, une consigne d'urgence pour un danger immédiat (textes seulement).
- **Contenu** : document `docs/` : qui modère, à quelles heures, comment tenir 24 h et 72 h ; qui lit l'alerte de la console ; quand saisir l'opérateur de plateforme ; quoi faire d'une menace, d'un contenu impliquant un mineur, d'une demande d'autorité ; modèle de compte rendu. Noms de rôles seulement, aucune coordonnée personnelle dans le dépôt.
- **Critères d'acceptation** : procédure jouée une fois à blanc avec un dossier fictif à délai de 24 h.
- **Dépend de** : MD-01 ; DS-06 (plan 17) qui cite ce document dans le dossier de mise en production.
- **Porte** : décision 2 du § 7 ; questions 6 et 7 au juriste.

### MD-07 — Protéger le déclarant : l'auteur ne lit qu'une décision · P0 · S · S2 + S1
- **Pour l'utilisateur** : signaler un harcèlement ne se retourne pas contre soi.
- **Backend** : **issue [S1]** : la lecture des décisions qui concernent une personne ne rend que les dossiers tranchés qui emportent un effet ; un classement n'émet plus d'avis à l'auteur. Dans l'intervalle, l'adaptateur de DIASPORALE n'affiche pas les dossiers ouverts.
- **Web** : « Décisions de modération » ne liste que des mesures ; texte d'introduction ajusté.
- **Mobile** : sans objet. **Données personnelles** : l'export garde la règle du moteur (ni déclarant, ni note).
- **Tests et cliquets** : test d'adaptateur ; test moteur après le correctif de S1.
- **Critères d'acceptation** : un contenu signalé puis classé ne laisse aucune trace chez son auteur ; une mesure prise s'affiche avec son recours.
- **Dépend de** : plan 13 (écran « Mes données »).
- **Porte** : décision 6 du § 7.

### MD-08 — Équipes par pays : compétence scellée et routage · P1 · L · S1 puis S2
- **Pour l'utilisateur** : un dossier de Belgique va à l'équipe de Belgique, et à elle seule.
- **Backend** : **issue [S1]** : pays facultatif sur une équipe ; routage d'un dossier et d'un contenu en relecture par le pays de la cible, que la tranche fournit (la règle `targetFacts` existe) ; dossiers sans pays et pays non ouverts à l'équipe du réseau (`moderationScopeFor` du domaine). Tranche : résolveur exporté ; file indexée par pays ; nombre de modérateurs actifs par pays pour la procédure d'ouverture (plan 06).
- **Web** : zone du guichet bornée aux pays de la personne ; pays d'une équipe à sa création.
- **Mobile** : sans objet. **Données personnelles** : jamais le pays de résidence d'une personne.
- **Tests et cliquets** : refus hors pays ; repli sur le réseau ; fenêtres sans trou.
- **Critères d'acceptation** : avec deux équipes de pays, chacune ne lit et ne tranche que les siens ; un rôle de réseau lit tout.
- **Dépend de** : MD-01 ; plan 06.
- **Porte** : obligatoire avant l'ouverture d'un deuxième pays.

### MD-09 — Mesures lourdes selon la qualité du décideur · P1 · S · S1 puis S2
- **Pour l'utilisateur** : une suspension ou une exclusion, qui valent dans tout ANTSIA, ne dépend pas d'un seul bénévole.
- **Backend** : **issue [S1]** : la décision refuse ces deux mesures à qui n'a qu'une compétence d'équipe, ou exige la confirmation d'un rôle de réseau.
- **Web** : le guichet n'offre à chacun que les mesures qu'il peut prendre ; une demande de suspension part au réseau.
- **Mobile** : sans objet. **Données personnelles** : aucune nouvelle.
- **Tests et cliquets** : refus serveur testé, pas seulement l'écran.
- **Critères d'acceptation** : un membre d'équipe retire, avertit, met en sourdine ; il ne suspend pas.
- **Dépend de** : MD-01.
- **Porte** : décision 3 du § 7.

### MD-10 — Signaler une demande, une proposition, une demande d'adhésion · P1 · M · S2 + S1
- **Pour l'utilisateur** : une page signale une demande abusive ; un demandeur, une proposition trompeuse ; une association, un message d'adhésion injurieux.
- **Backend** : natures `diasporaServiceRequest` et `diasporaAssociationMembership`, même patron que MD-03 (**issue [S1]** pour les ajouts délégués) ; aperçu borné du besoin ou du message, jamais les créneaux ni l'identité ; une proposition appartient à la page.
- **Web** : geste dans la demande reçue, la demande envoyée, la file des adhésions.
- **Mobile** : après le web. **Données personnelles** : états sans texte ; effacement dérivé.
- **Tests et cliquets** : seule une partie signale ; refus indistinct pour un tiers.
- **Critères d'acceptation** : dossier au guichet avec la zone de l'offre ou le pays de la page.
- **Dépend de** : MD-03 ; plans 07 et 09.
- **Porte** : aucune.

### MD-11 — Délais tenus : alerter l'équipe et mesurer · P1 · M · S2 + S1
- **Pour l'utilisateur** : l'équipe sait qu'un dossier à délai légal l'attend ; le pilote sait si les délais sont tenus.
- **Backend** : **issue [S1]** : avis neutre aux membres de l'équipe à l'arrivée d'un dossier à délai légal, rappel avant l'échéance (nouveau genre de notification). Tranche : deux indicateurs du pilote, « dossiers tranchés » et « part tranchée dans le délai », lus par index borné, seuil « moins de 5 », base visible.
- **Web** : phrase neutre dans la cloche, lien vers le guichet ; deux lignes dans `/pilote`.
- **Mobile** : push avec le plan 16. **Données personnelles** : aucun contenu ni nom dans l'avis.
- **Tests et cliquets** : `notification-payload-content` ; seuil et idempotence des agrégats.
- **Critères d'acceptation** : un harcèlement signalé fait sonner la cloche de l'équipe ; l'indicateur dit « moins de 5 » sous le seuil.
- **Dépend de** : plan 13 (cloche), plan 17 (`/pilote`), MD-01.
- **Porte** : aucune.

### MD-12 — Avis motivé, récidive et état du compte · P1 · M · S2
- **Pour l'utilisateur** : la personne lit la règle enfreinte, la mesure, sa durée et la date limite de recours ; le modérateur voit ce qui a déjà été décidé pour elle.
- **Backend** : aucun dans la tranche ; lots MC-03 et MC-04 du moteur (historique borné, code de règle, délai de recours).
- **Web** : choix de la règle dans la décision (catalogue de MD-05) ; encart d'historique sans contenu ni déclarant ; fiche de décision enrichie ; « État du compte » dans « Mes données » (plan 13).
- **Mobile** : après le web. **Données personnelles** : code de règle exporté.
- **Tests et cliquets** : `i18n-keys` ; fournisseur de démonstration.
- **Critères d'acceptation** : chaque décision porte une règle ; l'avis donne la date limite.
- **Dépend de** : MC-03, MC-04, MD-05.
- **Porte** : texte des règles relu.

### MD-13 — Arnaques et usurpation propres à la diaspora · P1 · M · S2
- **Pour l'utilisateur** : un faux consulat, un faux visa, un faux logement, un faux recruteur sont repérés tôt.
- **Backend** : motifs « arnaque » et « spam » du lot MC-06 du moteur ; liste de mots réservés aux institutions posée par MD-04 (une page dont le nom en contient un passe en relecture) ; contrôle de similarité de MC-06.
- **Web** : libellés des motifs ; conseils courts au moment du contact (fiche d'offre de service, offre d'emploi, première ligne d'une mise en relation) ; rappel qu'aucun service consulaire ne se paie dans DIASPORALE.
- **Mobile** : textes repris. **Données personnelles** : aucune.
- **Tests et cliquets** : `public-communication` (aucun chiffre, aucune promesse).
- **Critères d'acceptation** : une page nommée comme un poste consulaire attend une relecture ; les conseils s'affichent une fois, se referment, ne bloquent rien.
- **Dépend de** : MC-06, MD-04 ; plan 15 pour les pages « Officiel ».
- **Porte** : décision 9 pour les textes.

### MD-14 — Outils et avis des responsables d'espace · P1 · S · S2
- **Pour l'utilisateur** : le responsable d'une page ou d'un groupe apprend qu'un contenu de son espace est signalé, et peut y retirer un commentaire.
- **Backend** : lot SU01f du moteur (avis neutre `space_report`, droits de retrait).
- **Web** : phrase neutre dans la cloche ; retrait d'un commentaire par un signataire sous une publication de sa page ; bandeau d'état de modération étendu aux publications, évènements et avis que l'on gère.
- **Mobile** : après le web. **Données personnelles** : avis sans contenu ni déclarant.
- **Tests et cliquets** : `notification-payload-content`.
- **Critères d'acceptation** : le responsable est prévenu sans apprendre qui a signalé.
- **Dépend de** : SU01f ; plans 07 et 13.
- **Porte** : arbitrage A7 du moteur.

### MD-15 — Fermer une rubrique ou un pays en urgence · P1 · M · S2 + S1
- **Pour l'utilisateur** : en cas de vague d'arnaques ou de tension, une rubrique se met en lecture seule dans un pays, le temps de traiter.
- **Backend** : table d'interrupteurs par rubrique et par pays dans la tranche (**issue [S1]** pour l'inscription au schéma) ; les écritures de l'entraide, de l'emploi, des services, du kit et du mentorat la lisent ; motif, durée, journal ; levée automatique.
- **Web** : commande dans « Réglages » ; message à code fermé pour le membre, sans cause détaillée.
- **Mobile** : message repris. **Données personnelles** : aucune.
- **Tests et cliquets** : écriture refusée, lecture intacte, levée à l'échéance.
- **Critères d'acceptation** : fermer l'emploi en France n'affecte ni la Belgique ni les candidatures déjà envoyées.
- **Dépend de** : MD-01, MD-04 ; plan 06.
- **Porte** : aucune.

### MD-16 — Chiffres de modération pour les membres · P1 · S · S2
- **Pour l'utilisateur** : savoir combien de signalements sont reçus et traités, sans rien d'identifiant.
- **Backend** : lecture bornée des agrégats quotidiens du moteur pour `diasporale`, dans la tranche ; seuil de cinq, base jamais publiée.
- **Web** : section liée depuis les règles et les réglages ; « non mesuré » quand rien n'est publiable.
- **Mobile** : après le web. **Données personnelles** : aucune.
- **Tests et cliquets** : masques de petites cohortes ; `public-communication`.
- **Critères d'acceptation** : aucune catégorie sous cinq ; aucun « 100 % ».
- **Dépend de** : MC-05 du moteur pour le rapport périodique.
- **Porte** : décision 11 du § 7.

### MD-17 — Confort du guichet · P2 · S · S2
- **Pour l'utilisateur** : le modérateur lit la précision du déclarant, consulte le journal, voit ce qui presse.
- **Contenu** : précision du déclarant servie au guichet sans identité ; onglet « Journal » pour un rôle de réseau ; nombre borné de dossiers à échéance ; recherche par numéro ; désactiver et renommer une équipe, mise en examen (**issue [S1]**).
- **Dépend de** : DS-04, MD-01.
- **Porte** : aucune.

### MD-18 — Signalement par un tiers sans compte · P2 · M · S2 + S1
- **Pour l'utilisateur** : une personne représentée sans son accord, non membre, peut le signaler.
- **Contenu** : formulaire public borné et à débit strict, dossier sans déclarant membre (**issue [S1]**), accusé par le canal fourni ; aucune pièce d'identité conservée.
- **Dépend de** : MD-05.
- **Porte** : réponse du juriste (questions 3 et 6).

### MD-19 — Âge et mineurs · P3 · M · S2
- **Pour l'utilisateur** : une règle d'âge claire à l'entrée.
- **Contenu** : brancher le lot SU01c du moteur (déclaration d'âge, motif « compte d'un mineur ») dans l'accueil de DIASPORALE (plan 01).
- **Dépend de** : SU01c.
- **Porte** : arbitrages A3 et A4 ; question 5 au juriste ; D-G11.

### MD-20 — Mesures sur ordre, conservation, coopération · P3 · S · S2
- **Pour l'utilisateur** : un correctif ou une étiquette imposés s'affichent aussi dans DIASPORALE.
- **Contenu** : afficher les effets des lots SU01h et SU01g du moteur ; point de contact dans les textes légaux.
- **Dépend de** : SU01h, SU01g.
- **Porte** : arbitrages A2 et A12 ; question 7 au juriste.

### MD-21 — Contenus sensibles · P3 · S · S2
- **Pour l'utilisateur** : un média marqué sensible s'affiche voilé.
- **Contenu** : brancher le voile du lot MC-08 du moteur dans les cartes et la visionneuse de DIASPORALE (plan 03).
- **Dépend de** : MC-08.
- **Porte** : contrat d'empreintes (moteur) ; le voile n'en dépend pas.

## 6. Ordre recommandé et dépendances

| Vague | Lots | Pourquoi dans cet ordre |
|---|---|---|
| 1 | DS-04 (volet guichet), MD-07, MD-02 | Aucune dépendance : prouver le guichet, protéger le déclarant, rendre chaque objet signalable |
| 2 | MD-01, MD-04, MD-03 | Trois demandes [S1] à déposer tôt : rôles, réglages, nouvelle cible |
| 3 | MD-05, MD-06 | Textes et organisation, avec le propriétaire et le juriste |
| 4 | MD-08, MD-09, MD-11, MD-12 | Avant un deuxième pays et avant d'élargir le pilote |
| 5 | MD-10, MD-13, MD-14, MD-15, MD-16 | Après les premiers retours |
| 6 | MD-17, MD-18, puis MD-19 à MD-21 | Confort, puis ce qui attend le juriste ou le moteur |

**Ce que ce plan attend des autres plans.** Moteur : plan 12 (MC-01 à MC-07, SU01c, SU01f, SU01g, SU01h), plan 13 (EX-06, EX-08), plans 01, 03 et 05 (IC-03, SD-01, PF-02), plan 07 (PG-01). DIASPORALE : plan 04 (signalement d'un message, CC-V), plans 05, 07, 08 et 09 (emplacement des gestes ; MD-03 touche les fichiers des services), plan 13 (cloche, « Mes données »), plan 15 (noms réservés aux institutions), plan 06 (un modérateur par pays ouvert), plan 02 (lien « Règles »), plan 17 (textes légaux, dossier de mise en production, `/pilote`).

**Volet de recette en mode moteur (campagne DS-05).** Backend local, comptes de démonstration par acteur : Patrice MBOUMBA (vérifié), Sandrine ONDO (parrainée), Hervé MOUBAMBA (déclaré), Mireille ENGONE (association), Fabrice NDONG (entreprise), Ruth ALLOGHO (modératrice), Serge EYENE (administrateur), Aïcha NGUEMA (vérifiée, Belgique).

| # | Étapes | Résultat attendu |
|---|---|---|
| 1 | Patrice publie ; Sandrine signale « autre motif » ; Ruth classe | Le dossier quitte la file ; Sandrine lit « classé » |
| 2 | Hervé signale pour harcèlement ; Ruth retire et avertit | Voie « Délais légaux », accusé, avis de décision ; Patrice lit la mesure |
| 3 | Patrice fait recours ; Serge annule | Contenu rétabli ; mesure levée ; Patrice et Ruth le lisent |
| 4 | Ruth met Patrice en sourdine un jour | Écriture refusée dans DIASPORALE, lecture intacte ; fin automatique |
| 5 | Ruth demande une suspension ; confirmation | L'accès tombe partout ; « Mes données » reste ouvert ; recours possible |
| 6 | Mireille crée un évènement | En relecture ; Ruth l'approuve ; il paraît dans le hub |
| 7 | Avis de Sandrine sur un service de Fabrice, puis réponse | Chacun attend la relecture, puis paraît |
| 8 | Serge ajoute Fabrice à l'équipe existante ; Patrice signale une offre d'emploi de la page de Fabrice ; Fabrice ouvre ce dossier | Guichet ouvert à Fabrice ; aucun formulaire sur ce dossier : partie au dossier |
| 9 | Serge retire Fabrice, puis crée une seconde équipe | Guichet fermé à Fabrice à l'acte suivant ; la seconde équipe apparaît et, sans nature, ne reçoit aucun dossier tant que le routage ignore le pays (constat attendu, MD-08) |
| 10 | Aïcha pose une question d'entraide pour la Belgique ; Patrice la signale | Dossier visible sous « Belgique », absent sous « France » |

## 7. Décisions à prendre par le propriétaire

1. **Mandater le juriste sur le droit applicable à la modération.** Recommandation : avant toute rédaction des règles, car tout en dépend. Questions à lui poser, sans rien présumer :
   - Q1. Quels textes régissent un service édité au Gabon et destiné à des résidents de France et d'autres États : l'ordonnance n° 0011/PR/2026, le droit de l'État de résidence, les deux ?
   - Q2. Protection des données : la loi gabonaise n° 001/2011 modifiée et le règlement européen s'appliquent-ils ensemble ; faut-il un représentant dans l'Union, une analyse d'impact, un encadrement des transferts ?
   - Q3. Le règlement européen sur les services numériques s'applique-t-il, à quel titre, avec quelles obligations de signalement, de motivation, de réclamation, de point de contact et de rapport ?
   - Q4. Quelles mentions de l'éditeur pour un public résidant en France, en plus de l'article 25 de l'ordonnance ?
   - Q5. Quel âge d'entrée retenir, et quelle preuve, pour un résident de France ou d'un autre État ?
   - Q6. Quels délais de traitement s'imposent hors du Gabon ; les 24 h et 72 h de l'ordonnance couvrent-ils ces contenus ?
   - Q7. Quelle autorité peut requérir des données ou un retrait, et que conserver sans contredire l'effacement ?
   - Q8. Quel statut et quel engagement écrit pour des modérateurs bénévoles qui lisent des extraits de contenus privés ?
2. **Qui administre le réseau, qui modère la France.** Recommandation : deux administrateurs (nul ne juge le recours de sa propre décision) et trois modérateurs, pour tenir les week-ends.
3. **Qui peut suspendre ou exclure.** Recommandation : un rôle de réseau seulement ; l'équipe d'un pays retire, avertit, met en sourdine. Raison : ces mesures valent dans tout ANTSIA.
4. **Réglages de départ.** Recommandation : garder la relecture des évènements d'association, des avis et des réponses pendant les premières semaines ; l'ajouter aux offres d'emploi et aux ressources du kit, comme le cahier le prévoit au lancement ; mots réservés aux institutions en relecture. Valeurs soumises dans MD-04.
5. **Profil signalé depuis DIASPORALE.** Recommandation : accepter que le réseau racine le traite, et le dire, puisque le profil est commun et la suspension vaut partout.
6. **Ce que l'auteur apprend.** Recommandation : seulement une mesure prise, jamais un dossier ouvert ni un classement. Raison : protéger le déclarant dans une petite communauté.
7. **Charte des modérateurs.** Recommandation : engagement écrit hors application au pilote, dans l'application ensuite.
8. **Bénévoles et conflits d'intérêts.** Recommandation : un modérateur ne traite ni la page qu'il signe (déjà codé) ni l'association dont il est adhérent (règle de la charte, puis du code).
9. **Débat politique.** Recommandation : une règle courte : le débat d'idées est admis ; l'injure, l'appel à la haine, l'usurpation et la publicité politique payante ne le sont pas. À faire relire.
10. **Démonstration.** Recommandation : l'aligner sur le moteur plutôt que de coder la règle « deux modérateurs » avant MD-08.
11. **Chiffres aux membres.** Recommandation : après un mois de pilote, quand les seuils sont atteints.
12. **Dossier laissé ouvert sur la démonstration en ligne.** Recommandation : le trancher, avec accord écrit, et remettre la démonstration dans un état propre.

## 8. Risques et points d'attention

- **Un seul point de rupture** : sans MD-01, cinq fonctions restent sans titulaire en production. Le dossier de mise en production (DS-06) doit citer la création de l'équipe et des rôles.
- **Fichiers hors zone** : `convex/modules/moderation`, `packages/social-domain`, les notifications et `convex/schema.ts` appartiennent à S1 ; six lots déposent une issue `[S1]`. Les déposer tôt.
- **Mesures à portée globale** : une décision prise dans DIASPORALE suspend la personne dans ANTSIA ; tant que MD-09 n'est pas livré, la charte doit l'interdire aux équipes de pays.
- **Petite communauté** : seuil de cinq sur tout chiffre ; un dossier peut désigner son déclarant par déduction (MD-07).
- **Relecture par défaut** : au pilote, chaque évènement et chaque avis attend un modérateur ; sans permanence, ils ne paraissent pas.
- **Bénévoles** : fatigue, exposition à des contenus difficiles, pressions dans une communauté où tout le monde se connaît ; prévoir relève et anonymat du décideur (déjà tenu : l'auteur ne lit pas qui a décidé).
- **Tensions importées** : périodes électorales et crises au pays ; MD-15 et la règle politique doivent exister avant.
- **Véracité** : aucune page ne dit « conforme », « modéré 24 h sur 24 » ni un taux, sans preuve.
- **Dépôt public** : ce plan nomme des manques ; les lots de la vague 1 et MD-03 passent avant toute annonce d'ouverture.

## 9. Prompts d'implémentation

### Prompt DS-04 (volet guichet)
```text
Tu es la session S2 (DIASPORALE). Écris en français. Opus seulement.
Lis : CLAUDE.md, docs/etudes/2026-11-10-finalisation/14_MODERATION_SECURITE_CONFORMITE.md (§ 2, § 6), docs/32 (§ 6, § 7, § 12), docs/34, docs/recette/su01d-bureau-delais-2026-10-22.
Branche claude/recette-guichet depuis origin/main. Backend local 3320/3321 : demande l'accord pour les variables.
Joue, avec les comptes de démonstration par acteur, les dix scénarios du § 6. Pour chaque défaut : un test qui échoue, le correctif dans le dépôt DIASPORALE ou convex/modules/diaspora, le test vert. Tout défaut ailleurs devient une issue [S1].
Corrige d'emblée la file de relecture : un message de mise en relation en relecture doit y avoir sa ligne.
Livre : docs/recette/guichet-<date>/RAPPORT.md, fait ou non fait par scénario, captures à 390 et 1280 px sans donnée réelle. Verify vert avec le verrou.
Arrête-toi avant toute action sur la démonstration en ligne.
```

### Prompt MD-01
```text
Session S2. Lis le plan 14 (lot MD-01, § 7 décision 2), ANTSIA/convex/modules/moderation/cases.ts, ANTSIA/convex/modules/diaspora/moderationDesk.ts et demoAccounts.ts, le lot EX-08 du plan 13 du moteur.
Vérifie d'abord dans le code que seul le chemin de démonstration écrit un rôle de réseau. Si ce n'est plus vrai, dis-le-moi.
Dépose une issue [S1] dans administration-ga/antsia : EX-08 doit admettre le réseau diasporale, et le journal une action pour le changement de rôle. Aucune donnée sensible : le dépôt est public.
Dans convex/modules/diaspora : nommer et retirer un modérateur ou un administrateur (administrateur seul, membre actif, motif, journal, dernier administrateur protégé), lecture des responsables. Dans le guichet : bloc « Responsables du réseau » de l'onglet Équipe. Fournisseur de démonstration, fragments fr et en, tests.
Prouve sur backend local, sans la porte de démonstration : recours tranché, revendication instruite, /pilote lu, rôle retiré effectif aussitôt.
Arrête-toi avant toute publication et si un fichier partagé est requis.
```

### Prompt MD-02
```text
Session S2. Lis le plan 14 (lot MD-02, lignes 2 à 7 du § 2), apps/diasporale_com/src/components/report-content-sheet.tsx, packages/diasporale-features/src/data/content-reports-port.ts, apps/diasporale_com/src/data/engine-content-reports.ts.
Branche claude/signaler-partout. Aucun changement de serveur : le moteur accepte déjà ces cibles.
Étends la capacité de signalement au commentaire, au profil, à la page, à l'évènement, à la publication de groupe et à l'ajout de galerie ; monte la feuille dans chaque écran ; jamais sur son propre contenu ni sur la page que l'on signe ; pour un profil, dis que le réseau racine traite le dossier.
Tests de montage par surface, démonstration, fr et en. Recette à deux comptes à 390 et 1280 px : geste, masque, dossier au guichet avec la bonne nature.
Arrête-toi avant de publier la démonstration.
```

### Prompt MD-03
```text
Session S2. Lis le plan 14 (lot MD-03), ANTSIA/convex/modules/diaspora/moderationContent.ts, moderationTargets.ts, services.ts, et la façon dont les neuf natures de la vague H ont été ajoutées (docs/32, § 3 et § 6).
Dépose d'abord l'issue [S1] : nature diasporaServiceOffer à ajouter aux surfaces, au validateur des cibles, aux aiguillages et au crochet d'effacement. Attends sa livraison avant de brancher.
Dans la tranche : propriétaire page, écriture modérée, lectures filtrées, aperçu borné, pays de la zone. Côté écrans : geste sur la fiche et la carte, état dans Mon activité, libellés.
Prouve à deux comptes : offre signalée, retirée, absente du catalogue et du lien direct, recours de la page, rétablissement.
Coordonne-toi avec le plan 09 : mêmes fichiers. Arrête-toi avant toute publication.
```

## 10. Sources lues

- Brief commun ; dossier de reprise ; plan directeur et registre des lots d'ANTSIA ; plan 15 d'ANTSIA.
- Moteur : `A:docs/etudes/2026-11-09-finalisation/12_MODERATION_CONFORMITE_SECURITE.md` en entier ; lots EX-06 et EX-08 de `A:docs/etudes/2026-11-09-finalisation/13_CONSOLE_EXPLOITATION_LANCEMENT.md` ; lot PG-01 du plan 07 ; `A:docs/etudes/2026-10-21-sept-univers-et-vie-publique/SU01_CONFORMITE_ORDONNANCE_0011.md` en entier ; `A:docs/07_RAPPORT_GARDE_FOUS_PA5.md` (modération, débit, export).
- DIASPORALE : cahier (§ 2.3, § 5, § 6, EXF-DG-40 à 43, EXT-DG-04), docs/14 (G9, § 6, § 7.3), docs/17, `D:docs/32_EXECUTION_VAGUE_H.md` (§ 3, § 6, § 7, § 9, § 12), les trois recettes du 22/10 et celle du 19/10.
- Vault : décision du 18/10 « modération a posteriori des contenus communautaires ». Dossier produit d'origine : § 6.2 et § 7.
- Code DIASPORALE : écran et composants du guichet, feuille de signalement, « Mes signalements », décisions, décisions de page, bandeau de modération, ports et adaptateurs (guichet, signalements, décisions de page, droits personnels, avis), fournisseurs de démonstration, `D:packages/diasporale-domain/src/moderation.ts`, `D:packages/diasporale-domain/src/opening.ts`, `D:packages/diasporale-domain/src/demo-accounts.ts`, table des routes, textes légaux.
- Code ANTSIA : `A:convex/modules/moderation` en entier, `A:convex/modules/diaspora/moderationDesk.ts`, `A:convex/modules/diaspora/moderationTargets.ts`, `A:convex/modules/diaspora/moderationContent.ts`, gardes d'écriture de `A:convex/modules/diaspora/serviceReviews.ts`, `A:convex/modules/events/pageEvents.ts`, `A:convex/modules/posts/postWrite.ts`, `A:convex/modules/pages/claims.ts`, `A:convex/modules/platform/console.ts`, `A:convex/modules/platform/audit.ts`, `A:convex/lib/rateLimit.ts`, `A:packages/social-domain/src/moderation.ts`, `A:packages/social-domain/src/moderationPolicy.ts`, `A:packages/social-domain/src/membership.ts`.
- Non vérifié : l'état actuel de la démonstration en ligne (aucun accès réseau) ; le comportement réel à l'exécution (rien n'a été lancé) ; les fonctions des applications de référence (de mémoire).
