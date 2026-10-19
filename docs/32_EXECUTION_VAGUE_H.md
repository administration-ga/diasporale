---
title: "DIASPORALE — Vague H du plan global : vie communautaire, emploi, modération par pays, mesure du pilote"
date: "2026-10-18"
version: "1.0"
statut: "Sources raccordées, lot de confiance compris ; tests écrits, AUCUN contrôle exécuté (consigne du propriétaire en vigueur)"
reference: "DG-015 · DG-024 · DG-025 · DG-027 · PD6 · G8 · G9 · G11"
---

# Vague H du plan global

Reprise par Claude le 18 octobre 2026 au soir, après le relais Codex (voir [docs/18](18_EXECUTION_VAGUE_G.md)). La consigne du propriétaire en vigueur, relayée aussi par la session ANTSIA, est d'**implémenter dans les sources servies sans relancer aucune vérification**. Aucun test, typage, lint, codegen, build, serveur, navigateur ni commit n'a donc été lancé pour cette vague : les scénarios de test sont écrits, pas exécutés, et aucun module n'est déclaré validé.

## 1. Ce qui est livré dans les sources

| Ticket | Résultat | Surfaces | Moteur (tranche `convex/modules/diaspora/`) |
|---|---|---|---|
| DG-024 a — entraide | Questions et réponse retenue par l'auteur ; missions bénévoles des pages d'association, inscription consentie et bornée, liste des bénévoles réservée à l'équipe vivante | `/entraide`, `/entraide/<id>` | `mutualAid.ts`, tables `aidQuestions`, `aidAnswers`, `aidMissions`, `aidMissionSignups` |
| DG-024 b — kit d'arrivée | Ressources datées par pays et ville, source https sans traceurs, relecture par une autre personne, « à revoir » après 12 mois ou 3 signalements « périmée », badge officiel seulement s'il est calculé | `/kit-arrivee`, `/kit-arrivee/<id>`, file de relecture | `arrivalKit.ts`, tables `kitResources`, `kitResourceReviews`, `kitOutdatedFlags` |
| DG-024 c — mentorat | Profil de mentor opt-in (plafond 1 à 10 mentorés), recherche par pays et domaine, demande consentie avec créneaux, acceptation sous plafond relu en transaction, expiration à 14 jours | `/mentorat`, `/mentorat/<id>`, `/mes-mentorats` | `mentoring.ts`, tables `mentorProfiles`, `mentorListings`, `mentoringRequests` |
| DG-025 — talents et emploi | Offres des pages entreprise ou association, candidature privée et consentie, décisions de l'équipe vivante, profil de talent opt-in sans export de masse, onglet « Emploi » du hub et de « Mon activité » | `/emploi`, `/emploi/<id>`, `/mes-candidatures`, `/talents`, `/mon-activite?onglet=emplois` | `jobs.ts`, tables `jobOffers`, `jobApplications`, `talentProfiles` |
| PD6 · G9 — modération par pays | Guichet des équipes habilitées : file filtrée par pays et nature, dossier avec l'aperçu borné du moteur, décision motivée par les seules mutations du moteur, recours et équipe | `/moderation` (entrée de menu réservée) | `moderationDesk.ts` (lectures seulement) |
| G11 · DG-027 — mesure du pilote | 13 indicateurs agrégés chaque nuit, seuil « moins de 5 », base de chaque taux visible, accès réservé aux responsables du réseau ; grille de coûts hypothétique | `/pilote` (entrée de menu réservée), [docs/31](31_COUTS_ALERTES_MESURE_DG027.md) | `pilotMetrics.ts`, table `pilotMetricsDaily` |
| DG-015 et suites — notifications | 13 genres NEUTRES (demande reçue, proposition, refus, accord, annulation, échéance, réalisation ou absence, adhésion demandée, acceptée, refusée ou exclusion, réponse à un avis), destinataires relus à l'écriture, déduplication par état et version | cloche (liens profonds vers la demande, la demande reçue, les adhérents) | `serviceNotifications.ts` et ajouts délégués dans `notifications/` |

Points d'entrée posés par le coordinateur : bloc « vie communautaire » en tête de Communautés (agenda, entraide, kit d'arrivée, mentorat, emploi), quatre raccourcis dans Explorer, « Mes candidatures » et « Mes mentorats » dans l'espace personnel, « Modération » et « Mesure du pilote » visibles des seules personnes que le serveur reconnaît.

## 2. Raccords dans les fichiers partagés du moteur

Toutes ces écritures sont des ajouts délégués par la session ANTSIA le 18 octobre, à ancre unique, en coexistence avec ses lots P14 et P15.

| Fichier | Ajout |
|---|---|
| `convex/lib/rateLimit.ts` | 17 seaux `diaspora.aid/kit/mentor/job/talent/moderation.*`, 3 seaux renforcés |
| `convex/crons.ts` | expiration des demandes de service (15 min) et de mentorat (1 h), clôture des offres d'emploi échues (1 h), agrégats du pilote (02 h 50 UTC) |
| `people/dataPolicies.ts` | classement des 16 nouvelles tables (bloc DIASPORALE) |
| `people/dataInventory.ts` | projections d'export : demande de mentorat (le mentor n'exporte pas l'objectif ni le message du mentoré), candidature (au seul candidat ; motif de non-sélection hors export à trancher avec le juridique), relectures du kit (au relecteur, sans contenu) |
| `notifications/{tables,notify,bell,policy}.ts` | genres neutres DIASPORALE, sujets `serviceRequest`, `associationMembership`, `serviceReview`, garde de visibilité, projection de la cloche ; `deliveries.ts` corrigé par ANTSIA |
| `convex/modules/diaspora/manifest.ts` | tables, seaux et passages planifiés de la vague |

## 3. Lot de confiance (G9)

Neuf natures de modération préfixées `diaspora…` : `diasporaAidQuestion`, `diasporaAidAnswer`, `diasporaAidMission`, `diasporaMentorProfile`, `diasporaMentoringRequest`, `diasporaKitResource`, `diasporaJobOffer`, `diasporaTalentProfile`, `diasporaJobApplication`. Elles sont signalables par la porte unique du moteur (`moderation/cases.report`), modérables depuis le guichet par pays, filtrées à la lecture et dotées de crochets d'effacement. Détail en section 6.

## 4. Niveau de preuve

| Preuve | Verdict |
|---|---|
| Présence et raccordement des sources | Relus dans les fichiers réels (routes, imports, capacités servies par le moteur et la démonstration) |
| Tests | Écrits dans le domaine, le moteur, les fournisseurs et les écrans ; **non exécutés** |
| Codegen, typage, lint, build | **Non lancés** ; les adaptateurs moteur référencent `api.modules.diaspora.*` qui n'existera qu'après le prochain codegen |
| Navigateur, deux comptes, téléphone | **Non joués** |
| Commit, push, déploiement | **Aucun** |

Certains tests existants ont été ajustés à la nouvelle réalité sans être relancés (avis neutres de mise en relation, liste de l'espace personnel, onglets de « Mon activité »).

## 5. Ce qui reste, dans l'ordre

1. **Campagne de vérification** sur instruction du propriétaire : gel coordonné avec ANTSIA, codegen, `bun run --cwd ../ANTSIA verify`, corrections, puis commits par périmètre.
2. **Conversations contextuelles** (DG-013, mentorat accepté, candidature présélectionnée) : contrat écrit par ANTSIA le 19/10 (`ANTSIA/docs/contrats/CONVERSATION-CONTEXTUELLE-V1.md`), décisions D1 à D16 validées par le propriétaire le même jour, avec les amendements D5 et D8. Sous-lots DIASPORALE : CC-3a (règles pures et chargeurs, après le type CC-2a), CC-3b (crochets d'ouverture, de synchronisation et de purge dans nos transitions), CC-6 (port, adaptateurs, entrées depuis nos écrans, filtre « Mises en relation » de Messages). Voir section 7.
3. **Moteur, côté ANTSIA** : affectation des équipes de modération par pays et routage des signalements ; durcissement des gardes (un déclarant ou un signataire ne tranche pas un dossier où il est partie) ; liens profonds depuis les notifications poussées (`open.ts`) ; carte de la page porteuse dans l'avis `moderation_decision` (agent P14B, section 7).
4. **Notifications** des nouveaux modules (entraide, mentorat, kit, emploi) sur le modèle des genres neutres déjà posés.
5. **Recettes** : parcours « coiffeur à Paris » de bout en bout, entraide et mission bénévole à deux comptes, relecture du kit, candidature et décision, guichet de modération, tableau du pilote ; reprise de DG-002.
6. **Hors code** : test de l'arborescence avec de vrais utilisateurs (G1.1), recrutement du pilote, décisions juridiques (motif de non-sélection, nom public du relecteur).

## 6. Résultat du lot de confiance

**Moteur** (ajouts délégués à ancre unique dans `social-domain/moderationPolicy.ts`, `moderation/{tables,targets,reviewProjection}.ts` et `people/erasure.ts` ; logique dans la tranche : `moderationContent.ts`, `moderationTargets.ts`, `contentCounters.ts`) :

| Règle | Choix |
|---|---|
| Propriétaire d'un dossier | La personne pour une question, une réponse, un profil de mentor ou de talent, une ressource personnelle, une candidature, une demande de mentorat (le mentoré) ; la PAGE pour une mission, une offre ou une ressource portée par une page |
| Qui peut signaler | Tout lecteur autorisé, jamais sur son propre contenu ; une demande de mentorat seulement par son mentor ; une candidature seulement par l'équipe vivante de la page ; un signataire ne signale ni ne tranche le contenu de sa page |
| Politique | Visible dès l'écriture ; relecture préalable seulement si le réseau pose une politique explicite pour la surface. Écart voulu avec les avis DG-016 (en attente sans politique), pour ne casser aucun parcours |
| Lectures | Publié pour tous, en relecture pour son seul auteur, retiré pour personne, masqué à qui l'a signalé ; vues privées (« Mes … », équipe) conservées |
| Retrait | Réponse retirée : compteur décrémenté et réponse retenue vidée, une seule fois ; demande de mentorat retirée : déclinée ou close par le système |
| Effacement d'une personne | `answerCount`, `signupCount` et `outdatedFlags` décrémentés ; une mission complète se rouvre |
| Aperçu du modérateur | Borné : 500 signes d'une candidature sans la personne ni le profil, 80 signes de l'objectif d'une demande de mentorat |
| Pays au guichet | Zone du contenu (question, mission, ressource, offre), pays déclaré par le profil, pays de l'offre pour une candidature ; jamais la résidence lue ailleurs |

**Écrans** : capacité générique `contentReports` (moteur et démonstration, masque immédiat pour la personne qui signale), feuille `ReportContentSheet` (React Hook Form + Zod, motifs `REPORT_REASONS`, focus rendu, envoi unique), geste « Signaler » sur les neuf surfaces, jamais sur son propre contenu ; libellés des 23 natures du moteur dans le guichet et dans « Mes données » (contrôle statique des fragments fr et en : aucun manque). Libellés de la console ajoutés par ANTSIA.

**Reste** : état « retiré » non montré à l'auteur dans les écrans de la vague (il l'apprend par la décision et par « Mes données ») ; contenus antérieurs à la vague sans état de modération (données de développement : pas de page porteuse retrouvée pour eux, trou accepté avec ANTSIA le 19/10). La décision et le recours d'un contenu de page sont livrés par P16 et consommés en section 7.

## 7. Suites du 19 octobre : décisions de page, cloche, contrat de conversation

**Décisions d'un contenu de page (P16 côté moteur).** `moderation/policy.owningPageOfReport` retrouve la page porteuse par `moderationContentStates.ownerPageId`. Nos trois natures portées par une page l'écrivent à chaque écriture, sans cas à ajouter : `diasporaAidMission` (`aidMissions.pageId`), `diasporaJobOffer` (`jobOffers.pageId`), `diasporaKitResource` quand `kitResources.pageId` est posé. Le résolveur de la tranche ne rend pas de propriétaire personnel pour elles, et refuse le signalement d'un signataire de la page. L'avis neutre aux signataires, le recours (`fileAppeal`, `ownsCase`), la lecture `pageDecisions` et le refus de trancher son propre contenu s'appliquent donc tels quels.

**Écrans DIASPORALE (sources servies, rien d'exécuté).**

| Élément | Fichiers |
|---|---|
| Capacité `pageDecisions` du port : lecture paginée (`null` pour qui ne signe plus), recours | `packages/diasporale-features/src/data/page-decisions-port.ts`, `port.ts`, `context.tsx` (`usePageDecisions`), `index.ts` |
| Adaptateur moteur (`moderation/cases.pageDecisions`, `fileAppeal`) et démonstration (aucune décision, liste vide pour un signataire vivant) | `apps/diasporale_com/src/data/engine-page-decisions.ts`, `packages/diasporale-features/src/demo/page-decisions.ts` |
| Onglet « Décisions » de la gestion de page (`/pages/<handle>/gerer?onglet=decisions`) | `components/page-decisions-panel.tsx`, `screens/page-admin-screens.tsx`, `app/pages/[handle]/gerer/page.tsx`, `lib/routes.ts` (`pageDecisions`) |
| Fiche de décision et recours partagés avec « Mes données » (extraits sans changement de rendu) | `components/moderation-decisions.tsx`, `components/data-rights-settings.tsx` |
| Avis `moderation_decision` dans la cloche : phrase neutre, lien vers « Mes données », ou vers les décisions de la page quand le moteur sert la carte de la page porteuse | `data/types.ts`, `components/notification-bell.tsx`, `routing.tsx`, `providers.tsx`, `data/engine-views.ts` |
| Textes FR/EN (fragment `page-decisions`) et tests écrits | `i18n/locales/{fr,en}/page-decisions.json`, `resources.ts` ; `engine-page-decisions.test.ts`, `demo/page-decisions.test.tsx`, `notification-bell-moderation-decisions.test.tsx`, `routes.test.ts` |

Dépendance : la carte de la page porteuse dans l'avis `moderation_decision` est confiée par ANTSIA à son agent P14B (`bell.ts`, et la même règle dans `open.ts`). Jusqu'à sa livraison, l'avis d'un dossier de page mène à « Mes données », qui ne liste que les dossiers personnels ; l'onglet « Décisions » de la page reste joignable depuis la gestion de page.

**Contrat de conversation contextuelle (avis DIASPORALE transmis le 19/10, intégré par ANTSIA).** Décision du propriétaire du 19/10/2026, transmise à ANTSIA : « Je valide les décisions D1 à D16 du contrat CONVERSATION-CONTEXTUELLE-V1, avec les amendements D5 et D8 ». Les recommandations du §14 du contrat valent décision, avec les deux amendements ci-dessous. Les mentions « à confirmer juridiquement » de D7 (conservation) et D13 (export d'un message en voix de page) restent telles que le contrat les écrit. ANTSIA fait passer le contrat de « proposé » à « accepté » et écrit l'ADR-0025.

| Décision | Position DIASPORALE | Suite retenue par ANTSIA |
|---|---|---|
| D2, D3, D4 | D'accord : tous les signataires vivants (comme nos demandes reçues et candidatures), voix de page, premier mot au répondant | Recommandations maintenues |
| D5 | D'accord sur les phases ; dans un mentorat, « hors de mes relations : silencieux » ferait sonner en silence malgré l'accord du fil | L'accord explicite du fil vaut admission pour ce fil seul (ne pas déranger, occupation et absence restent appliqués), et la projection dira au lecteur l'effet de ses réglages (CC-4) |
| D6 | D'accord : clore une offre ne touche aucune candidature, l'équipe décide et le candidat se retire après la clôture ; pas d'état « recrutement terminé » en V1 | Crochet de `closeExpiredJobOffers` retiré du contrat ; une offre retirée par la modération ferme ses candidatures dans nos sous-lots CC-3a et CC-3b |
| D8 | D'accord sur le principe ; adresse exacte refusée en voix de personne, admise en voix de page (les pages n'ont aucune adresse de voie dans le moteur : le salon ou le bureau n'aurait sinon aucun canal) | Le type CC-2a passe `{ text, kind, side, voice }` à la règle de texte, qui rend un code fermé de la tranche (`context_address_forbidden`) |

Hors contrat : aucune adresse exacte de domicile n'est stockée dans une demande de service (règle transverse du registre G0, [docs/17](17_REGISTRE_DECISIONS_DROITS_G0.md)). L'« adresse exacte séparée et restreinte » qu'envisageait le plan (docs/14) n'est donc pas à construire. Le domicile d'une prestation à domicile passe par le téléphone, permis dans la conversation.

**CC-3a livré le 19/10 (sources écrites, rien d'exécuté).** Après le signal CC-2a d'ANTSIA (type du résolveur dans `ANTSIA/convex/modules/contextualMessaging/contract.ts`) :

| Élément | Fichier |
|---|---|
| Règles pures : phase de chaque nature sur l'état effectif, appels engagés, premier mot, pièces, statut d'écriture (`declaree`, capacité « communicate »), règle de texte D8 | `packages/diasporale-domain/src/conversation-contexts.ts` et son test ; `containsExactAddress` extrait de `service-requests.ts` |
| Résolveurs de la tranche : `DIASPORA_CONVERSATION_CONTEXTS` (chargeur, visibilité propre, règle de texte, pays du guichet) | `ANTSIA/convex/modules/diaspora/conversationContexts.ts` et son test |

Règles retenues :
- Un objet retiré par la modération ferme sa conversation. C'est aussi le cas du profil du mentor (mentorat) et de l'offre (candidature) retirés.
- Clore une offre ne ferme rien (D6).
- Un objet en relecture préalable n'est visible que de sa personne propriétaire.
- Un objet retiré reste lisible en lecture seule.
- Le masque de la personne qui a signalé ne s'applique pas à la conversation d'un objet dont elle est partie.

Le branchement dans `registry.ts` revient à ANTSIA. CC-3b (crochets d'ouverture, de synchronisation et de purge) attend les aides de `contextualMessaging/hooks.ts`.

**CC-3b livré le 19/10 (sources écrites, rien d'exécuté).** Après le signal d'ANTSIA (aides `contextualMessaging/hooks.ts`, tranche branchée dans `registry.ts`) :

| Transition | Crochet |
|---|---|
| Demande de service créée | `openContextualConversation` |
| Proposition, refus, annulation, acceptation, réalisation, absence, expiration planifiée | `syncContextualConversation` |
| Mentorat accepté | `openContextualConversation` |
| Annulation, refus, clôture, expiration planifiée, profil retiré par son mentor (`closeEverythingOnRetire`) | `syncContextualConversation` |
| Candidature présélectionnée | `openContextualConversation` |
| Candidature vue, non retenue, retirée | `syncContextualConversation` |
| Statut d'une offre, d'un profil de talent | exemption nommée `contextual-hooks-exempt` (D6, pas l'objet de la conversation) |
| Demande de mentorat retirée par la modération | `syncContextualConversation` immédiat (son statut change) |
| Candidature, offre ou profil de mentor retirés ou rétablis | resynchronisation planifiée après la transaction (`diaspora/conversationSync.ts`), car le moteur écrit l'état de modération après nos crochets |

Aucune purge : la tranche ne supprime aucun objet hors effacement. Le libellé de la nouvelle surface `contextualMessage` est ajouté dans « Mes données » et au guichet (24 surfaces, FR et EN).

**Accessibilité (écarts P18b relevés par ANTSIA le 19/10).** Les toasts émis pendant la visionneuse de médias (`ImmersiveOverlay`, qui rend inertes les enfants de `<body>`) n'étaient plus annoncés. La pile sonner vit désormais dans sa propre région, exemptée (`apps/diasporale_com/src/components/toast-region.tsx`, copie avec provenance de celle d'ANTSIA). La palette de réactions n'est pas concernée : `PostCard` l'ouvre au clic ou au clavier seulement (menu Radix). Solution commune posée ensuite par ANTSIA (`packages/ui/src/hooks/use-modal-a11y.ts` n'inerte plus un enfant de `<body>` marqué `data-toast-region`) : l'observateur de notre région devient redondant, sans gêne ; il est gardé jusqu'à la vérification commune, puis retiré.

Réglé par ANTSIA le 19/10 : le cliquet `ANTSIA/tests/ratchets/contextual-hooks.test.ts` (écrit, non exécuté) admet notre resynchronisation planifiée après modération comme équivalent d'un crochet. Elle peut être planifiée directement ou par l'aide locale `scheduleConversationSync` (table `SCHEDULED_SYNCS`). Le cliquet vérifie aussi que `syncConversationsAfterModeration` appelle `syncContextualConversation`. Aucun appel nommé n'est exigé dans `restoreDiasporaTarget`. Un crochet rejoué après l'écriture de l'état de modération n'aurait couvert que les objets directs, ni « offre → candidatures présélectionnées », ni « profil de mentor → mentorats ».

## 8. Contestation d'une absence et avis de la vie communautaire (19/10)

**DG-015, contestation d'une absence (sources écrites, rien d'exécuté).** Une page pouvait déclarer « absent » pour retirer au client son droit d'avis : `no_show` n'était pas admissible. Désormais :
- la personne qui demande conteste l'absence une seule fois, dans les quatorze jours qui suivent le constat, avec un motif (ni coordonnée ni adresse exacte) ;
- l'état reste `no_show` et l'historique n'est pas réécrit : la contestation s'y ajoute, lisible des deux côtés ;
- une absence contestée redevient admissible pour l'avis, avec la preuve « rendez-vous confirmé » ;
- l'équipe de la page reçoit un avis neutre, `service_no_show_contested` (genre déclaré au moteur le 19/10, voir plus bas).

| Élément | Fichiers |
|---|---|
| Règle pure, délai, admissibilité de l'avis | `packages/diasporale-domain/src/{service-requests,service-reviews}.ts` et leurs tests |
| Champs `contestedAt` et `contestReason`, geste `contestServiceNoShow`, projection, admissibilité | `ANTSIA/convex/modules/diaspora/{serviceRequestsTables,serviceRequests,serviceReviews,serviceNotifications}.ts`, test dans `serviceRequests.test.ts` |
| Port (champs et geste facultatifs), adaptateur moteur, démonstration | `service-requests-port.ts`, `engine-service-requests.ts`, `demo/{service-requests,service-reviews}.ts` |
| Écran de la demande : contestation montrée aux deux côtés, geste pour la personne qui demande ; textes FR/EN et deux refus | `screens/service-request-screens.tsx`, `locales/{fr,en}/service-requests.json` |

**Avis de la vie communautaire (vague H).** Onze genres neutres :
- entraide : réponse publiée à la question ; réponse retenue ; inscription à une mission ;
- mentorat : demande reçue ; accord ; refus ; clôture ;
- emploi : candidature reçue ; présélection ; non-sélection ;
- kit d'arrivée : ressource relue.

Les règles sont celles des avis de mise en relation. Une version en relecture préalable n'annonce rien, et un motif de non-sélection n'est jamais transmis.

| Élément | Fichiers |
|---|---|
| Règles, gardes d'écriture et de lecture, projection, émetteurs | `ANTSIA/convex/modules/diaspora/communityNotifications.ts` (nouveau) |
| Appels juste après les gestes | `mutualAid.ts`, `mentoring.ts` (y compris le retrait du profil), `jobs.ts`, `arrivalKit.ts` ; tests du kit et du mentorat ajustés (avis attendus) |
| Cloche DIASPORALE : genres, icônes, phrases, liens vers la question ou la mission, mes mentorats, les candidatures reçues ou les miennes, la ressource | `data/types.ts`, `components/notification-bell.tsx`, `routing.tsx`, `providers.tsx`, `data/engine-views.ts`, `locales/{fr,en}/community-notifications.json` |

**Ajouts moteur posés le 19/10** par la session « Lancer l'app en local », à la demande du propriétaire, sans doublon avec les genres `contextual_*` d'ANTSIA (signal « notifications libres » reçu ensuite) :
- `notifications/tables.ts` : les onze genres, les six sujets nouveaux et leurs colonnes, et le genre `service_no_show_contested` ;
- l'écriture dans `notify.ts` (admission par `communityNoticeAdmission`) ;
- la garde dans `policy.ts` (`communityNoticeVisible`) ;
- la projection `communityNotice` dans `bell.ts` ;
- la cible `diasporaCommunityNotice` dans `targets.ts`, `notification-targets.ts` et `social-domain/notificationOpenTarget.ts`.

D'après le rapport de cette session : backend local publié, aucune erreur de type dans les fichiers touchés, tests des notifications au vert (57/57), ainsi que ceux de l'entraide, de l'emploi, du kit et des avis de service. Les émetteurs de la tranche citent donc des genres connus du moteur.

**Deux tests corrigés (sources écrites, non exécutées).** `mentoring.test.ts` (« expiration constatée… ») et `serviceRequests.test.ts` (« le délai est de quatorze jours… ») recevaient « unauthenticated » : leur saut d'horloge (quatorze et quinze jours) dépassait la session automatique du harnais, qui dure sept jours. Leur fixture `member()` ouvre désormais une session explicite de trente jours (`createTestSession`, comme `pilotMetrics.test.ts`). `serviceReviews.test.ts` garde son saut de huit jours : il éprouve justement l'expiration.

## 9. État de modération montré à qui gère, et classement explicable (19/10)

**G9, état de modération dans les vues de gestion.** Jusqu'ici, aucun écran de la vague H ne disait à l'auteur que son contenu était en relecture ou retiré. Désormais :
- il est lu par `managedModerationState` dans la tranche, et servi aux seuls gestionnaires : la personne propriétaire, ou l'équipe vivante de la page qui porte le contenu ;
- un autre lecteur ne reçoit que `null`, ou pas de champ du tout.

Côté DIASPORALE :
- le champ est facultatif dans les ports, et l'adaptateur l'omet quand le moteur ne le sert pas ;
- la démonstration ne modère jamais ;
- les fiches gérées portent `ModerationBanner` (`moderationBannerState`) ;
- les listes de gestion portent une mention.

Travail réparti entre quatre agents, un par module, puis relu et intégré :

| Module | Vues de gestion qui portent l'état | Gestes masqués quand le contenu est retiré |
|---|---|---|
| Entraide | Mes questions, fiche de sa question, ses réponses, missions de l'équipe | Répondre à sa question retirée ; modifier une mission ; participer à une mission en relecture ou retirée (sauf déjà inscrit) |
| Kit d'arrivée | Mes propositions, fiche gérée | Modifier, soumettre (retirer reste possible) |
| Mentorat | Mon profil de mentor, demandes du mentoré (jamais au mentor) | Modifier, rouvrir un profil en pause (la pause reste possible) |
| Emploi | Offres de l'équipe (`pageJobOffers`, fiche), Mes candidatures, mon profil de talent | Modifier une offre ou un profil (suspendre, clore, masquer restent possibles) |

Aides communes :
- `managedModerationState` et `managedModerationStateValidator` dans `diaspora/moderationContent.ts` ;
- `ManagedModerationState` et `moderationBannerState` dans `packages/diasporale-features/src/data/managed-moderation.ts`.

Tests écrits dans chaque module, moteur et écrans, non exécutés.

Limites relevées par les agents :
- l'avis générique dit « Refusée. » pour un contenu retiré après publication ;
- l'auteur d'une réponse retirée ne la voit plus du tout (règle G9 conservée) ;
- dans « Mes propositions », une ressource qu'on ne gère plus n'est listée que si le kit public la sert.

**DG-019, classement explicable.** Les portées du fil existent déjà, dont « Récents », du plus récent au plus ancien. Chaque publication d'autrui offre désormais « Pourquoi cette publication ? » dans son menu. Les raisons se déduisent de la seule publication :
- hub pays, ou toute la diaspora avec son pays d'origine ;
- audience ;
- lecture aussi dans ANTSIA ;
- règle du fil : par date, sans personnalisation tirée du comportement (D-G05).

Code : `packages/diasporale-features/src/components/post-explanation.tsx` et son test, `post-menu.tsx`, `locales/{fr,en}/post-explanation.json`. Restent hors DIASPORALE : la réinitialisation groupée des choix du fil et la diversité du classement, qui demandent le moteur.

## 10. Campagne de vérification avant livraison (19/10)

Demandée par le propriétaire (« commit, pousse et déploie »). La règle du dépôt exige `verify` avant tout commit. Le `verify` complet attend le gel coordonné avec ANTSIA (signal « GEL ANTSIA PRÊT ») ; avant lui, seuls des contrôles en lecture ont tourné : typage, tests par paquet et cliquets, sans codegen.

**Défauts réels trouvés et corrigés** :
- **Mesure du pilote** (`diaspora/pilotMetrics.ts`) : en fin d'étape, la dernière page des avis ne transmettait pas ses comptes (`cells` absent du retour). Un passage d'une seule page perdait donc les avis publiés ; en petits lots, ils étaient comptés. Les deux tests en échec le montraient (seuil et idempotence).
- **Kit de démonstration** (`demo/arrival-kit.ts`) : la proposition et la modification passaient le résultat d'analyse au lieu du brouillon (`contentOf(draft.value)`).
- **Lecture des pages de démonstration** (`demo/pages.ts`) : la surcouche de lecture recréait l'état à chaque `getState()`. Un refus sans effet changeait donc l'identité de l'état (25 tests). Elle est désormais mémorisée par état, abonnements et surcouche.
- **Formulaires du mentorat** : TypeScript déduit un prédicat de type de la fonction donnée à `refine`, et Zod rétrécissait la sortie ; les deux fonctions sont désormais booléennes explicites.
- **Adaptateurs moteur** (`engine-views.ts`) : l'auteur d'un compte effacé n'a plus d'identifiant de personne. La ville, le type d'association et le secteur d'une carte de page sont facultatifs dans l'annuaire et le hub.
- **Imports du moteur** : `events/pageEvent*.ts` (DG-010, DG-023, travail du relais DIASPORALE) importaient `@diasporale/domain` hors de la tranche. Ils passent désormais par `diaspora/associationEventRules.ts`, qui réexporte les règles pures ; les chemins d'API ne changent pas. Accord d'ANTSIA ; les fichiers `events/` sont commités par DIASPORALE.
- **Français** : 32 textes avaient une espace ordinaire avant « : ; ? ! », après « « » ou devant le tiret ; ils ont désormais une insécable.

**Tests remis à jour** : session explicite de 30 jours là où l'horloge saute (mentorat, contestation), objets attendus enrichis des champs servis par le moteur, médias de galerie déposés par la personne qui publie (ils appartiennent à la session), cliquet des couches pointé sur `ToastRegion`, résolveurs de conversation appelés au type du contrat, signature actuelle de `finishAllScheduledFunctions`. Clés d'agenda écrites en entier (le cliquet i18n ne lit que les clés citées) et setter de la caméra QR renommé (le cliquet le prenait pour un code de formulaire).

**Environnement** : Node 25 expose un `localStorage` expérimental sans méthodes, qui masque celui de jsdom. Les deux fichiers `vitest.setup.ts` posent alors un stockage en mémoire conforme ; rien ne change sous Node 22.

**Écart réglé avec ANTSIA** : `federation/mirrorAccess.ts` exigeait un auteur personnel pour toute publication native, alors qu'une publication de galerie DG-023 est déposée sous la page sans auteur. Sept tests de `events/pageEventGallery.test.ts` en dépendaient. ANTSIA, propriétaire du fichier, a posé la forme étroite : `authorPersonId` OU `pageEventGalleryId`. Les gardes de page et de galerie restent en aval.

**Tests de l'application remis à jour** (trois agents Opus, fichiers disjoints, tests seuls) :
- mocks complétés : `useDataSource` et `useSession`, `useConvexAuth`, `importOriginal` pour `@diasporale/features/data`, `next/navigation` ;
- liens suivis vers leurs cibles voulues : gestion des services dans la page, annuaire des pages depuis le hub, onglet Emplois de Mon activité ;
- équipe de démonstration lyonnaise : Steeve administre, et Mireille, invitée, accepte avant d'agir ;
- textes à insécable comparés après normalisation, comme ailleurs dans les tests.

**Textes corrigés** :
- `services.offer.manage` : « Gérer les services de la page » (le lien n'ouvre plus Mon activité) ;
- `hub.morePages` et `hub.pagesElsewhere` : renvoient à l'annuaire des pages, plus à Explorer ;
- clé morte `services.pageSection.title` retirée.

**Résultat des contrôles en lecture** :

| Contrôle | Résultat |
|---|---|
| Typage DIASPORALE (domaine, surfaces, application) | 0 erreur |
| Typage de la tranche `diaspora/` et de `events/` | 0 erreur |
| Tests du domaine | 690/690 |
| Tests des surfaces | 732/732 |
| Tests de l'application | 1295/1295 |
| Tests moteur `diaspora/` et `events/` | 535/535 |
| Cliquets du moteur | `no-cross-product-imports` vert ; les trois autres échecs sont dans les fichiers d'ANTSIA (transmis) |
| Lint DIASPORALE | 0 erreur, 44 avertissements |

Le typage du moteur garde 55 erreurs, toutes dans les fichiers d'ANTSIA (boutiques, fédération, commerce), en cours de correction de son côté.

**Suites repérées, hors de cette campagne** :
- ~~le lien « Gérer » d'une offre d'emploi mène à Mon activité, qui prend la première page du sélecteur~~ — **réglé le 19/10** : onglet « Emplois » dans la gestion de page (`pageManage(handle, "emplois")`, pages qui recrutent, fournisseur présent), lien « Gérer les emplois de la page » de l'offre, avis « candidature reçue » de l'équipe vers le recrutement de LA page quand elle se lit (route `pageJobs`), sinon Mon activité.
- chemins non testés : lectures identifiées des services, refus d'identité de `PageServicesManager` (l'écriture `contestNoShow` de l'adaptateur est testée depuis le 19/10).

## 11. CC-6 — conversations de mise en relation dans DIASPORALE (19/10)

Le moteur a livré CC-5 (source et vue contextuelles partagées, point d'injection). DIASPORALE monte ses conversations de mise en relation, sans fork de la messagerie :

| Élément | Fichiers |
|---|---|
| Messagerie : `useContextualMessages` injecté dans `MessagesRoute` (filtre « Mises en relation », conversation en page), sous l'îlot iCom | `screens/icom-screens.tsx`, `components/contextual-conversations.tsx` |
| Nos refus traduits (`describeAppRule` : `context_address_forbidden`) ; l'objet rouvert de mon côté (`onOpenObject`) | `components/contextual-conversations.tsx`, fragment `contextual-conversations.json` (FR/EN) |
| Adresse `/messages/mise-en-relation/<fil>` : la coquille accepte le segment ; la route se compose par `conversationHref(contextualConversationKey(fil))` | `lib/messages-route.ts` (et son test), `lib/routes.ts` (`contextualConversation`) |
| Port : capacité facultative `conversations` (le fil d'un objet, son ouverture idempotente) ; la démonstration ne la sert pas (iCom y est fermé) | `data/conversations-port.ts`, `port.ts`, `context.tsx` (`useConversations`) |
| Adaptateur moteur : `contextualMessaging/threads.findForObject` et `openForObject` | `data/engine-conversations.ts` et son test |
| Entrées depuis les objets — « Ouvrir la conversation », « Revoir la conversation », « Écrire » — selon la phase de la règle pure du domaine (`serviceRequestConversation`, `mentoringConversation`, `jobApplicationConversation`) | fiche d'une demande (deux côtés), cartes de « Mes mentorats », « Mes candidatures », candidatures reçues par l'équipe |
| Cloche : `contextual_message` et `contextual_closed`, phrases neutres et lien vers le fil relu pour moi | `data/types.ts`, `notification-bell.tsx`, `routing.tsx`, `providers.tsx`, `engine-views.ts` |

Tests : entrée (fournisseur absent, phase, fil ouvert ou clos, non-lu, double appui, refus traduit), injection (refus traduits, objet rouvert de mon côté), adaptateur, cloche, route, fiche de demande.

**Limites** :
- au bureau, en navigation par volets, le dock personnel n'a pas le filtre « Mises en relation » ; la conversation, elle, s'affiche en page (limite CC-5) ;
- `describeObject` ne dit rien de l'état de l'objet, qui se lit sur son propre écran ;
- la recette réelle (CC-V : deux comptes, voix de page, adresse refusée ou admise, appels) reste à faire sur le backend, après le codegen.
