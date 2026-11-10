# Plan 11 — Entraide, mentorat et kit d'arrivée

> Constaté par lecture du code d'`origin/main` (DIASPORALE `bead76d`, ANTSIA `fd58d73b`), le 10 novembre 2026. Rien n'a été exécuté : ni test, ni recette, ni publication.
> Applications de référence : Nextdoor, Reddit et Stack Overflow pour les questions ; JeVeuxAider.gouv.fr pour le bénévolat ; ADPList et MentorCruise pour le mentorat ; les guides d'InterNations pour l'installation. Comparaison faite de mémoire, sans revérification en ligne ; un « ? » marque ce qui n'est pas sûr.
> Ce plan détaille, pour l'entraide, le mentorat et le kit d'arrivée, le plan 15 du dossier de finalisation d'ANTSIA. Les lots qu'il en reprend gardent leur identifiant (DS-…, DG-…) ; les lots nouveaux portent le préfixe `ET-`.

Légende des chemins : `D:` = dépôt DIASPORALE, `A:` = dépôt ANTSIA. « Écran » = atteignable depuis l'interface de diasporale.com ; « Moteur » = la fonction existe côté serveur. Aucun plan du moteur ne couvre cette fonctionnalité : elle n'existe que dans la tranche `A:convex/modules/diaspora`.

## 1. L'intention du propriétaire

- **Pour qui** : le nouvel arrivant (étudiant, jeune actif, mutation) qui cherche un logement, ses démarches, un premier réseau, et le membre établi qui veut aider. Le dossier produit dit qu'il n'existe aujourd'hui « aucun outil d'entraide structuré » (dossier produit § 1.1, personas P1 et P2, fiche F12).
- **Quoi** : « disponible pour aider » sur la facette, appariement simple par pays, ville et domaine, kit d'arrivée par pays, badge « Mentor » (cahier, EXF-DG-37). Le plan global précise : question, réponse retenue, mission bénévole, mentorat avec créneaux, ressources datées, sourcées et relues (docs/14 de DIASPORALE, G8).
- **Gratuit et bénévole** : « Facturation : aucune. Feature réputationnelle et de mission » (fiche F12). Le mentorat ne porte ni tarif ni paiement (D-G03).
- **Déjà décidé** : aucune coordonnée dans un texte public, le contact passe par la messagerie (invariant 6) ; ville saisie, jamais de GPS ; le pays n'est jamais le Gabon ; être mentor est un choix explicite, jamais déduit de la facette ; aucune note publique ni classement des mentors (plan 15, DS-13) ; une ressource communautaire ne se dit jamais officielle ; la conversation d'un mentorat s'ouvre à l'acceptation (contrat de conversation contextuelle, décision D5 amendée du 19/10).
- **Ce qui prouve que c'est fini** : « Première aide aboutie » (docs/14, ticket DG-024). La fiche F12 ajoute : binômes actifs, satisfaction, délai du premier contact d'un nouvel arrivant.
- **Exigé avant d'ouvrir chaque tranche** : un parcours réel, des règles de retrait, un responsable, une mesure d'utilité ; chaque tranche « peut rester fermée indépendamment des autres » (docs/14, sortie de G8).
- **Écarté** : cagnottes, transport de colis, conseils réglementés, logements avec encaissement : « une analyse métier et réglementaire propre », jamais une simple catégorie (docs/14, G8). Elles relèvent du plan 12.
- **Compte en attente** : il lit, il n'écrit pas (cahier § 6.2, arbitrage A3).

## 2. Ce qui existe

| # | Capacité | État | Écran | Moteur | Preuve |
|---|---|---|---|---|---|
| | **Questions d'entraide** | | | | |
| 1 | Poser une question : titre, détail, thème, pays, ville facultative | Présent | oui | oui | `D:apps/diasporale_com/src/components/mutual-aid-question-form.tsx` ; `A:convex/modules/diaspora/mutualAid.ts` (`askQuestion`) |
| 2 | Sept thèmes fermés : logement, démarches, santé, emploi, scolarité, transports, vie quotidienne | Présent | oui | oui | `D:packages/diasporale-domain/src/mutual-aid.ts` (`AID_THEMES`) |
| 3 | Liste par pays et ville saisie, par état (ouvertes, résolues, closes), « Mes questions » | Présent | oui | oui | `D:apps/diasporale_com/src/screens/mutual-aid-screens.tsx` ; `listQuestions`, `myQuestions` |
| 4 | Filtrer la liste par thème | Absent | non | non | motifs : `theme` absent des arguments de `listQuestions` et des index de `A:convex/modules/diaspora/mutualAidTables.ts` |
| 5 | Chercher par mots ; voir d'abord les questions sans réponse | Absent | non | non | motifs : `searchIndex`, `withSearchIndex`, `unanswered` ; le modèle existe pour les services (`A:convex/modules/diaspora/servicesTables.ts`) |
| 6 | Répondre : 2 à 2 000 signes, 300 réponses au plus par question | Présent | oui | oui | `answerQuestion` ; `AID_ANSWERS_PER_QUESTION_MAX` |
| 7 | Réponse retenue par l'auteur : une seule, révocable ; la question devient « résolue » | Présent | oui | oui | `acceptAnswer`, `unacceptAnswer` ; `D:apps/diasporale_com/src/components/mutual-aid-question-detail.tsx` |
| 8 | Dire « merci » ou « utile » sur une réponse | Absent | non | non | motifs : `helpful`, `upvote`, `thank`, `useful`, `vote` |
| 9 | Suivre la question d'un autre | Absent | non | non | motifs : `follow`, `subscribe`, `watch` |
| 10 | Questions proches proposées à la saisie | Absent | non | non | motifs : `similar`, `duplicate`, `doublon` |
| 11 | Joindre une photo | Absent | non | non | motifs : `media`, `attachment`, `storageId` dans les tables de l'entraide |
| 12 | Modifier (mention « modifiée »), clore, retirer sa question ; modifier ou retirer sa réponse | Présent | oui | oui | `updateQuestion`, `closeQuestion`, `withdrawQuestion`, `updateAnswer`, `withdrawAnswer` |
| 13 | Rouvrir une question close ; changer son pays | Absent | non | non | `AID_QUESTION_TRANSITIONS` : rien ne sort de `closed` sauf le retrait ; `updateQuestion` garde le pays |
| 14 | Aucune coordonnée, aucun lien, aucune adresse exacte dans les textes | Présent | oui | oui | `aidTextRefusal` |
| 15 | Citer une ressource du kit dans une réponse | Absent | non | non | les liens sont refusés (ligne 14) ; motifs : `kitResourceId` dans `aidAnswers` |
| 16 | Poursuivre en privé avec qui a répondu | Partiel : renvoi au profil ; la messagerie n'ouvre un fil qu'entre relations | partiel | oui | texte `privateContact` de `D:packages/diasporale-features/src/i18n/locales/fr/mutual-aid.json` ; `A:convex/modules/messaging/inbox.ts` (`assertCanOpenPersonalThread`) |
| 17 | Signaler une question ou une réponse ; état de modération dit à l'auteur seul | Présent | oui | oui | `D:apps/diasporale_com/src/components/report-content-sheet.tsx` ; `A:convex/modules/diaspora/moderationTargets.ts` |
| 18 | Auteur bloqué écarté des listes et des réponses | Présent | oui | oui | `isSetAside` dans `mutualAid.ts` |
| 19 | Compte en attente : lit, n'écrit pas | Présent | oui | oui | `assertCapability` ; `D:packages/diasporale-domain/src/eligibility.ts` |
| 20 | Avertissement sur les conseils de santé ou de droit | Absent | non | non | motifs : `ne remplace`, `médical`, `juridique` dans `mutual-aid.json` (le kit, lui, l'a) |
| 21 | Avis dans la cloche : réponse reçue, réponse retenue | Présent | oui | oui | `A:convex/modules/diaspora/communityNotifications.ts` |
| | **Missions bénévoles** | | | | |
| 22 | Proposer une mission au nom d'une page d'association, par un signataire vivant | Présent | oui | oui | `createMission` ; `D:apps/diasporale_com/src/components/mutual-aid-mission-form.tsx` |
| 23 | Mission portée par une personne, une entreprise, une institution ou une page de communauté | Absent, par règle | non | non | refus `aid_page_kind_not_allowed` (`managedMissionPage`) |
| 24 | Début, période de 92 jours au plus, fuseau, lieu approximatif (quartier, repère) | Présent | oui | oui | `parseAidMission` |
| 25 | 1 à 500 places, « complète », réouverture au retrait | Présent | oui | oui | `signUpForMission`, `withdrawFromMission` |
| 26 | Inscription avec consentement explicite (nom montré à l'équipe) ; retrait avant le début | Présent | oui | oui | `D:apps/diasporale_com/src/components/mutual-aid-mission-detail.tsx` |
| 27 | Liste des bénévoles réservée à l'équipe vivante | Présent | oui | oui | `missionVolunteers` |
| 28 | Modifier, clore les inscriptions, annuler avec motif | Présent | oui | oui | `updateMission`, `closeMission`, `cancelMission` |
| 29 | Prévenir les inscrits d'une annulation ou d'un changement de date | Absent | non | non | l'écran dit « Les inscrits verront l'annulation et son motif » : vrai seulement s'ils rouvrent la fiche ; `cancelMission` et `updateMission` n'émettent aucun avis |
| 30 | Écrire aux bénévoles | Absent | non | non | l'écran dit « l'équipe vous écrira par la messagerie » ; aucun fil hors relation (`assertCanOpenPersonalThread`) ; aucune nature de conversation pour la mission (`CONVERSATION_KINDS`, `D:packages/diasporale-domain/src/conversation-contexts.ts`) |
| 31 | Mission complète visible, liste d'attente | Absent ici ; le moteur l'a pour les évènements | non | partiel | `listMissions` ne sert que l'état `open` ; attente dans `A:convex/modules/events/pageEventRegistrations.ts` |
| 32 | Rappel avant la mission ; présence constatée | Absent ici ; le moteur a le rappel des évènements | non | partiel | `A:convex/modules/events/pageEventReminders.ts` ; motifs : `reminder`, `attendance`, `hours` |
| 33 | Mission à distance, récurrente, avec conditions | Absent | non | non | motifs : `remote`, `recurr`, `skill` |
| 34 | Missions sur la fiche de la page, dans le hub, dans l'agenda personnel | Absent | non | oui | `D:apps/diasporale_com/src/screens/page-screen.tsx`, `hub-screen.tsx` et `agenda-screen.tsx` n'emploient pas `useMutualAid` ; `pageMissions` et `mySignups` existent |
| 35 | Mes inscriptions ; missions de mes associations | Présent | oui | oui | `mySignups`, `pageMissions` |
| 36 | Signaler une mission ; avis à l'équipe à chaque inscription | Présent | oui | oui | `noticeAidMissionSignup` |
| | **Mentorat** | | | | |
| 37 | Devenir mentor : choix explicite, horodaté, jamais déduit de la facette | Présent | oui | oui | `A:convex/modules/diaspora/mentoring.ts` (`becomeMentor`) ; `D:apps/diasporale_com/src/components/mentoring-profile-panel.tsx` |
| 38 | Profil : 1 à 5 domaines, présentation, 1 à 5 langues, pays, ville, disponibilité en texte, plafond de 1 à 10 | Présent | oui | oui | `D:packages/diasporale-domain/src/mentoring.ts` (`parseMentorProfile`) |
| 39 | Pause, reprise, retrait (décline les demandes, clôt les mentorats) | Présent | oui | oui | `setMentorState` |
| 40 | Chercher par pays et par domaine | Présent | oui | oui | `searchMentors` ; `D:apps/diasporale_com/src/screens/mentoring-screens.tsx` |
| 41 | Filtrer par langue ou par ville ; chercher par mots ; domaine dans l'adresse | Absent | non | non | `searchMentors` ne prend que le pays et le domaine ; le domaine vit dans l'état de l'écran |
| 42 | Fiche : badges de confiance, langues, ville et année d'arrivée selon la visibilité choisie | Présent | oui | oui | `projectMentorPlace` ; `D:apps/diasporale_com/src/components/mentoring-ui.tsx` |
| 43 | Badge « Mentor » sur la carte du mentor | Présent | oui | — | `D:packages/diasporale-features/src/components/cards/community-cards.tsx` |
| 44 | Badge « Mentor » sur le profil du membre | Absent | non | non | motifs : `mentor` dans `D:apps/diasporale_com/src/screens/profile-screens.tsx` |
| 45 | Demande : domaine, objectif, message, 0 à 3 créneaux souhaités, consentement, envoi unique | Présent | oui | oui | `requestMentoring` ; `D:apps/diasporale_com/src/components/mentoring-request-form.tsx` |
| 46 | Plafonds : 5 demandes ouvertes par personne, 20 en attente par mentor, une par paire | Présent | oui | oui | `checkMentoringAdmission` |
| 47 | Accepter (plafond relu dans la transaction), décliner, retirer sa demande, motif facultatif | Présent | oui | oui | `acceptMentoringRequest`, `declineMentoringRequest`, `cancelMentoringRequest` |
| 48 | Expiration à 14 jours, écrite chaque heure | Présent | oui | oui | `expireDueMentoringRequests` ; `A:convex/crons.ts` |
| 49 | Prévenir le mentoré d'une expiration | Absent | non | non | aucun genre d'avis dans `A:convex/modules/notifications/tables.ts` |
| 50 | Créneau proposé ou changé par le mentor | Présent | oui | oui | `proposeMentoringSlot` ; `D:apps/diasporale_com/src/components/mentoring-sheets.tsx` |
| 51 | Créneau confirmé par le mentoré, avis, rappel, export vers son agenda | Absent | non | non | `MENTORING_REQUEST_ACTIONS` : aucun geste du mentoré sur le créneau ; `proposeMentoringSlot` n'émet aucun avis ; motifs : `reminder`, `ical` |
| 52 | Conversation du mentorat, ouverte à l'acceptation | Fermé : la politique contextuelle reste fermée tant qu'un opérateur ne l'ouvre pas | oui | oui | `openContextualConversation` dans `mentoring.ts` ; `A:convex/modules/contextualMessaging/operator.ts` ; `D:apps/diasporale_com/src/components/contextual-conversations.tsx` |
| 53 | Appel ou visio dans le mentorat, avec l'accord des deux | Fermé : même porte | oui | oui | `mentoringConversation` (`callsEngaged`) |
| 54 | Plusieurs séances, journal, objectifs suivis | Absent | non | non | un seul champ `slot` par demande (`A:convex/modules/diaspora/mentoringTables.ts`) ; motifs : `sessions` |
| 55 | Retour après séance (DS-13) | Absent | non | non | motifs : `feedback`, `sessionNote`, `rating`, `review` |
| 56 | Clore un mentorat, par l'un ou l'autre, motif facultatif | Présent | oui | oui | `closeMentorship` |
| 57 | Mes demandes et demandes reçues, tous états ; filtre par état côté mentor | Présent | oui | oui | `D:apps/diasporale_com/src/components/mentoring-requests.tsx` |
| 58 | Poser son besoin quand aucun mentor ne correspond ; mentors suggérés | Absent | non | non | motifs : `mentoringNeed`, `suggest` dans la tranche du mentorat |
| 59 | Note publique ou classement des mentors | Absent, voulu | non | non | plan 15, DS-13 |
| 60 | Signaler un profil de mentor ; signaler une demande (le mentor seul) | Présent | oui | oui | `diasporaMentorProfile`, `diasporaMentoringRequest` dans `moderationTargets.ts` |
| 61 | Avis dans la cloche : demande reçue, acceptée, déclinée, close | Présent | oui | oui | `communityNotifications.ts` |
| | **Kit d'arrivée** | | | | |
| 62 | Ressource : titre, résumé, contenu, neuf rubriques, pays, ville facultative | Présent | oui | oui | `D:apps/diasporale_com/src/components/arrival-kit-form.tsx` ; `A:convex/modules/diaspora/arrivalKit.ts` (`proposeResource`) |
| 63 | Source obligatoire : nom, adresse https, traceurs retirés, lien externe sans référent | Présent | oui | oui | `D:packages/diasporale-domain/src/arrival-kit.ts` (`parseArrivalKitSourceUrl`) |
| 64 | Date de vérification ; « à revoir » après 12 mois, calculé à la lecture | Présent | oui | oui | `arrivalKitReviewCause` |
| 65 | Portée par une personne ou par une page (institution, association, communauté) | Présent | oui | oui | `carrierPageFor` |
| 66 | « Ressource officielle » seulement si la page porte le badge Officiel calculé | Présent ; aucune page Officiel n'existe encore (plan 15) | oui | oui | `D:apps/diasporale_com/src/screens/arrival-kit-screens.tsx` |
| 67 | Relecture par une autre personne (membre vérifié ou signataire vivant) : publier, ou renvoyer avec motif | Présent | oui | oui | `reviewResource` ; `D:apps/diasporale_com/src/components/arrival-kit-actions.tsx` |
| 68 | File de relecture par pays | Présent | oui | oui | `reviewQueue` |
| 69 | Prévenir les relecteurs qu'une ressource attend ; compteur « à relire » | Absent | non | non | motifs : `kit_resource_submitted`, compteur de file |
| 70 | Marquer « à revoir » avec motif | Partiel : aucun avis à qui a écrit | oui | oui | `markResourceForReview` |
| 71 | Signaler « périmée » : quatre motifs fermés, une fois par version, seuil de trois | Présent | oui | oui | `flagResourceOutdated` |
| 72 | Prévenir l'auteur quand sa ressource devient « à revoir » (âge, signalements) | Absent | non | non | état calculé à la lecture, sans tâche planifiée ni avis |
| 73 | « Mes propositions » ; 30 ressources vivantes au plus par personne | Présent | oui | oui | `myResources` |
| 74 | Journal des relectures | Partiel : écrit, jamais montré | non | oui | table `kitResourceReviews` (`A:convex/modules/diaspora/arrivalKitTables.ts`) |
| 75 | Filtre par rubrique, par ville, « national seulement » | Présent | oui | oui | `listResources` |
| 76 | Chercher par mots | Absent | non | non | motifs : `searchIndex` dans les tables du kit |
| 77 | Ordre par étape (avant le départ, à l'arrivée, premier mois) | Absent | non | non | motifs : `step`, `stage` |
| 78 | Ressource en français et en anglais | Absent | non | non | un texte par ressource ; motifs : `locale`, `translation` |
| 79 | Enregistrer une ressource | Absent | non | non | brique des favoris au plan 09 |
| 80 | Signaler une ressource pour abus ; avis « ressource relue » | Présent | oui | oui | `diasporaKitResource` ; `noticeKitResourceReviewed` |
| 81 | Contenu de départ dans le moteur | Absent : le kit naît vide | non | non | aucune écriture de `kitResources` dans `A:convex/modules/diaspora/seed.ts` ; neuf exemples fictifs dans `D:packages/diasporale-features/src/demo/arrival-kit.ts` |
| 82 | Lecture avant le départ, depuis le Gabon | Absent | non | non | le pays GA est refusé partout (`HOME_COUNTRY`, `D:packages/diasporale-domain/src/countries.ts`) ; le kit est réservé aux membres |
| | **Accueil du nouvel arrivant, transversal** | | | | |
| 83 | « Disponible pour aider » : réglage et mention au profil | Partiel : affiché, sans recherche ni effet | oui | oui | `D:apps/diasporale_com/src/screens/settings-screen.tsx` ; aucun filtre dans `A:convex/modules/diaspora/directory.ts` |
| 84 | Année d'arrivée sur la facette, visibilité au choix | Présent | oui | oui | `D:packages/diasporale-domain/src/facet.ts` |
| 85 | Entrées : Explorer, Communautés, « Mes mentorats » | Présent | oui | — | `D:apps/diasporale_com/src/screens/explore-screen.tsx` ; `D:apps/diasporale_com/src/components/community-shortcuts.tsx` |
| 86 | Entrées depuis l'accueil, le hub du pays, le fil | Absent | non | — | motifs : `kit`, `entraide`, `mentor` dans `D:apps/diasporale_com/src/screens/welcome-screen.tsx` et `D:apps/diasporale_com/src/screens/hub-screen.tsx` |
| 87 | Parcours du nouvel arrivant, liste personnelle à cocher | Absent | non | non | motifs : `checklist`, `premiers pas`, `newcomer` |
| 88 | Parrain d'accueil (binôme à l'arrivée) | Absent | non | non | le parrainage existant sert l'entrée dans le réseau (plan 01) |
| 89 | Appel à la solidarité (deuil, hospitalisation) | Absent | non | non | cagnottes écartées (docs/14, G8) ; motifs : `solidar`, `deuil` |
| 90 | Mesure d'utilité de l'entraide | Absent | non | non | les 13 mesures de `D:packages/diasporale-domain/src/pilot-metrics.ts` portent sur les services, les associations, les évènements et les avis |
| 91 | Export et effacement des dix tables | Présent | oui | oui | `A:convex/modules/people/dataPolicies.ts` ; `A:convex/modules/people/dataInventory.ts` |
| 92 | Fournisseur de démonstration pour les trois rubriques | Présent | oui | — | `D:packages/diasporale-features/src/demo/mutual-aid.ts` ; `D:packages/diasporale-features/src/demo/mentoring.ts` |
| 93 | Démonstration en ligne amorcée | Partiel : un profil de mentor et une mission ; ni question ni ressource | oui | — | `D:apps/diasporale_com/src/components/demo-account-bootstrap.tsx` |
| 94 | Débit borné ; comptes légers renforcés | Présent | — | oui | `A:convex/lib/rateLimit.ts` |
| 95 | Fermer une rubrique par pays sans fermer les autres | Absent | non | non | prévu par le plan global (§ 7.3) ; motifs : `moduleOpen`, `closedModules`, `featureFlag` |

Décompte : **Présent 50 · Partiel 5 · Absent 38 · Fermé 2**. Le plan 15 comptait ces trois rubriques pour trois lignes « Présent » : c'est vrai au niveau de la rubrique, moins vrai au niveau des options.

### Ce que le moteur sait déjà faire et que DIASPORALE ne montre pas

- **La conversation attachée à un objet** : mécanisme complet dans `A:convex/modules/contextualMessaging/registry.ts` ; le mentorat y est branché (lignes 52 et 53) mais la politique est fermée ; la mission bénévole n'y est pas.
- **Liste d'attente, rappel, présence** : écrits pour les évènements d'association (`pageEventRegistrations.ts`, `pageEventReminders.ts`) avec leurs règles pures (`D:packages/diasporale-domain/src/event-capacity.ts`). Les missions ne les emploient pas.
- **Recherche par mots** : index `search_by_text` des services et des offres d'emploi de la tranche ; rien pour les questions ni le kit.
- **Lectures prêtes sans écran** : `pageMissions` et `mySignups` (fiche de page, agenda), journal `kitResourceReviews`.
- **« Disponible pour aider »** : stocké, projeté selon sa visibilité, jamais cherché.

### Ce qui est écrit mais jamais recetté en réel

| Recette | État | Source |
|---|---|---|
| Question, réponse, réponse retenue ; mission, inscription consentie, liste de l'équipe ; profil de mentor, demande, acceptation | Jouées à deux comptes, **backend local**, 19/10 (un plantage de `/entraide` corrigé ce jour-là) | docs/recette/deux-comptes-2026-10-19 de DIASPORALE |
| Kit d'arrivée : proposer, relire, publier, renvoyer, signaler « périmée », nouvelle version | **Jamais jouée**, même en local | docs/32 § 5 |
| Mentorat : créneau proposé, clôture, déclin, expiration, pause et retrait du mentor, plafond atteint | Jamais jouées | — |
| Mission : complète puis rouverte, modification, clôture, annulation, retrait d'un rôle en cours de session | Jamais jouées | — |
| Conversation et appel d'un mentorat | Jamais jouées : politique fermée, opérateur requis | docs/32 § 12 |
| Signalement de ces six natures jusqu'à la décision et au recours | Signalement et masquage joués ; traitement jamais joué (aucune équipe) | docs/32 § 12 |
| Effacement d'un compte après question, réponse retenue, inscription, mentorat, ressource | Jamais jouée | docs/14 § 6.2 (R-G19) |
| Ces trois rubriques sur la démonstration en ligne | Jamais jouées : la recette du 22/10 porte sur la publication, le signalement et le bureau | docs/recette/demo-en-ligne-2026-10-22 |

Les tests existent dans le domaine, le moteur, les fournisseurs et les écrans (`mutualAid.test.ts`, `mentoring.test.ts`, `arrivalKit.test.ts`) ; le plan 15 relève un `verify` vert le 3/11. Un test n'est pas une recette.

## 3. Comparaison avec les applications de référence

### 3.1 Questions et réponses

| Capacité | Nextdoor | Reddit | Stack Overflow | DIASPORALE | Verdict |
|---|---|---|---|---|---|
| Question rangée par thème | catégories | « flair » | étiquettes | sept thèmes | Déjà fait |
| Question située (pays, ville) | quartier | par communauté | non | pays et ville saisie | Déjà fait |
| Réponse retenue par l'auteur | non | non ? | oui | oui, une seule, révocable | Déjà fait |
| Merci ou vote sur une réponse | « Merci » | votes pour et contre | votes pour et contre | non | À faire (ET-12), sans vote contre |
| Filtrer par thème, chercher, « sans réponse » | recherche, filtres ? | recherche, tri | recherche, étiquettes, « sans réponse » | par état seulement | À faire (ET-04) |
| Questions proches à la saisie | non | oui ? | oui | non | À faire (ET-12) |
| Suivre une question | oui ? | oui | oui | l'auteur seul est prévenu | À faire (ET-12) |
| Photos jointes | oui | oui | oui | non | À faire (ET-12), après la brique du moteur SD-02 |
| Fils de réponses | oui | arborescence | commentaires | un niveau | Écarté : un niveau, comme les commentaires du fil (EXF-DG-12) |
| Message privé à qui a répondu | oui | oui | non | entre relations seulement | À adapter : passer par la demande de relation (EXF-DG-30) |
| Réputation, points, palmarès | non ? | karma | réputation, badges | non | Écarté : pas de classement ; le badge « Mentor » suffit (ET-13) |
| Réponses de référence (FAQ, wiki) | non | wiki, épingles | wiki | le kit, daté et relu | Déjà fait ; lien question → ressource à faire (ET-12) |
| Coordonnées dans les textes | libres | libres | libres | refusées | Déjà fait, plus protecteur |
| Avertissement sur les conseils de santé ou de droit | non ? | selon la communauté | non | non | À faire (ET-03) |
| Signaler | oui | oui | oui | oui | Déjà fait ; traitement à recetter (DS-04, DS-05) |

### 3.2 Missions bénévoles

| Capacité | JeVeuxAider.gouv.fr | DIASPORALE | Verdict |
|---|---|---|---|
| Mission publiée par une organisation validée | oui | page d'association, signataire vivant | Déjà fait |
| Recherche par lieu | oui | pays et ville saisie | Déjà fait |
| Recherche par domaine d'action, par date | oui | non | Reporté : peu de missions au pilote |
| Mission à distance | oui | non | Reporté (ET-14 n'en traite pas) |
| Places recherchées et restantes | oui | oui | Déjà fait |
| Candidature validée par l'organisation | oui ? | inscription directe | Écarté au pilote : la liste suffit à l'équipe |
| Messagerie entre le bénévole et l'organisation | oui | non, bien que l'écran la promette | À faire (ET-01 pour le texte, ET-02 pour le canal) |
| Prévenir d'une annulation ou d'un report | oui ? | non : visible seulement en rouvrant la fiche | À faire (ET-01) |
| Rappel, liste d'attente | ? | non | À faire (ET-14) |
| Suivi de la présence ou des heures | ? | non | À faire, présence seulement (ET-14) |
| Consentement à montrer son nom | implicite à l'inscription ? | case décochée par défaut | Déjà fait, plus protecteur |
| Adresse du lieu | publique | quartier ou repère | Déjà fait ; l'adresse exacte passe par la conversation (ET-02) |

### 3.3 Mentorat

| Capacité | ADPList | MentorCruise | DIASPORALE | Verdict |
|---|---|---|---|---|
| Devenir mentor par choix, profil | oui | oui, sur dossier ? | choix explicite, profil complet | Déjà fait |
| Recherche par domaine | oui | oui | pays et domaine | Déjà fait |
| Filtres : langue, ville, disponibilité | oui | oui | non (langues affichées) | À faire (ET-04) |
| Agenda du mentor, réservation d'un créneau libre | oui | oui | créneaux souhaités, puis créneau proposé | À adapter (ET-05) : créneau convenu ; l'agenda de créneaux libres attend DS-12 |
| Confirmation et rappel de séance | oui | oui | non | À faire (ET-05) |
| Messagerie et visio | oui ? | oui ? | conversation et appel du moteur, fermés | À recetter (DS-04) |
| Plafond de mentorés | disponibilités | « places » | 1 à 10, relu en transaction | Déjà fait |
| Retour après séance | avis demandé | avis | non | À faire (DS-13), privé |
| Avis publics, notes, « meilleurs mentors » | oui | notes | non | Écarté (plan 15, DS-13) |
| Badge de mentor au profil | oui | — | sur la carte seulement | À faire (ET-13) |
| Suivi dans la durée, objectifs | ? | oui | une demande, un créneau | À faire (ET-11) |
| Séances de groupe | oui | non ? | non | Reporté |
| Poser son besoin faute de mentor | ? | ? | non | À faire (ET-11) |
| Paiement | gratuit | abonnement | bénévole | Écarté : le citoyen ne paie jamais |

### 3.4 Kit d'arrivée et accueil

| Capacité | Guides et communautés InterNations | DIASPORALE | Verdict |
|---|---|---|---|
| Guides par pays et par ville, par rubrique | oui | pays, ville saisie, neuf rubriques | Déjà fait ; contenu à écrire (ET-06) |
| Qui écrit | une rédaction ? | des membres ou des pages, relus par une autre personne | Déjà fait, différenciant |
| Source officielle citée | pas systématique ? | obligatoire, https, sans traceur | Déjà fait |
| Date de vérification, alerte de péremption, signalement « périmée » | date de mise à jour ? | 12 mois, seuil de trois signalements | Déjà fait ; prévenir l'auteur (ET-07) |
| Ordre par étape de l'installation | oui ? | non | À faire (ET-15) |
| Liste personnelle à cocher | accompagnement payant ? | non | À faire (ET-08) |
| Recherche, plusieurs langues | oui | non | À faire (ET-04, ET-15) |
| Lisible sans compte | en partie ? | réservé aux membres | Reporté (ET-16, décision 10) |
| Accueil des nouveaux : parcours, rencontres, bénévoles référents | oui | rencontres par les évènements (plan 08) ; ni parcours ni référent | À faire (ET-08) ; référents au plan 06 |
| Membres disponibles pour aider | — | drapeau sans recherche | À faire (ET-13) |

## 4. Ce qui manque

### 4.1 Bloquant avant l'ouverture du pilote

1. **Deux promesses que l'écran des missions ne tient pas** (lignes 29 et 30) : « l'équipe vous écrira par la messagerie », alors que la messagerie refuse d'ouvrir un fil hors relation ; « Les inscrits verront l'annulation et son motif », vrai seulement s'ils rouvrent la fiche, car aucun avis ne part. Lot ET-01.
2. **Le mentorat accepté n'a aucun canal** tant que la politique contextuelle est fermée : les textes refusent les coordonnées, et la conversation refuse de s'ouvrir. Porté par DS-04 (plan 04) et par la mise en production (DS-06, plan 17).
3. **Rien de ces rubriques n'a été joué hors du trio du 19/10** ; le kit n'a jamais été joué. Volet de DS-05 au § 6.
4. **Aucune équipe ne traite les signalements** de ces six natures (plan 14).

### 4.2 Fonctions attendues qui manquent

- Joindre les bénévoles d'une mission (ET-02).
- Retrouver une question ou une ressource : thème, mots, « sans réponse » (ET-04).
- Créneau de mentorat confirmé, avis et rappel (ET-05) ; retour après séance (DS-13).
- Un kit qui n'est pas vide le jour de l'ouverture, et des relecteurs (ET-06, ET-07).
- Un parcours pour le nouvel arrivant après l'accueil (ET-08).
- Les missions sur la fiche de l'association, comme le demande le plan global (G3), et dans l'agenda (ET-09).
- Une mesure d'utilité, exigée par la sortie de G8 (ET-10).

### 4.3 Options qui manquent sur ce qui existe

- **Questions** : filtre par thème ; onglet et vue portés par l'adresse ; rouvrir une question close ; merci ; suivre ; photo ; citer une ressource du kit ; envoyer une question dans iCom (brique IC-18 du moteur).
- **Missions** : mission complète visible ; liste d'attente ; rappel ; export vers l'agenda ; dupliquer une mission ; mission portée par une page Officiel.
- **Mentorat** : filtres langue et ville ; domaine dans l'adresse ; confirmer le créneau ; plusieurs séances ; date de retour d'une pause.
- **Kit** : recherche ; étape ; langue ; enregistrer ; compteur « à relire » ; journal des relectures ; prévenir avant la péremption.

### 4.4 Améliorations de l'existant

- **Trois listes fermées qui ne se répondent pas** : 7 thèmes de question, 9 rubriques du kit, 5 domaines de mentorat. Une table de correspondance permet de passer d'une question au kit et aux mentors (ET-08).
- **Texte « Pour poursuivre en privé »** : dire qu'il faut d'abord être en relation (ET-01).
- **Sortir toujours** : retirer sa ressource du kit exige le droit de publier (`withdrawResource`), alors que retirer sa question ou sa demande reste possible à un membre redevenu « en attente ». À aligner (ET-07).
- **Avis « Refusée. »** pour un contenu retiré après publication, et élision « de Entraide… » : relevés par docs/32 § 9 et la recette du 19/10 ; portés par DS-03 (plan 02).
- **Six boutons** : « Demander un mentorat » et « Retenir cette réponse » suivent la décision du 9/11 (DS-02, plan 02).

### 4.5 Ce qui distingue DIASPORALE

- **Un kit daté, sourcé et relu par un tiers**, qui avoue sa péremption : aucune référence ne le fait à ce niveau.
- **Aucune coordonnée publique** : ni téléphone, ni lien, ni adresse dans une question, une réponse, une mission.
- **Le consentement au geste** : nom montré à l'équipe d'une mission, message montré au mentor.
- **Un mentorat borné** : plafond choisi par le mentor, expiration, une demande par paire, pas de note publique.
- **Le pays comme contexte** : entraide, mentors et kit se lisent par pays d'accueil et ville saisie.

### 4.6 Écarté ou reporté, et pourquoi

| Sujet | Raison |
|---|---|
| Votes contre, réputation, palmarès, « meilleurs mentors » | Ne rien inventer, pas de classement (plan 15, DS-13) |
| Note publique d'un mentor | Écartée par le plan 15 |
| Paiement d'un mentorat ou d'une mission | D-G03 ; le citoyen ne paie jamais |
| Écriture par un compte en attente | Arbitrage A3 ; rouvert en décision 1, sans contournement |
| Cagnotte, collecte d'argent | docs/14, G8 : analyse propre (plan 12) ; les liens sont déjà refusés dans les textes |
| Appel à la solidarité (deuil, hospitalisation) | Données de santé et de tiers : avis du juriste (ET-17) |
| Kit lisible depuis le Gabon | Le réseau est réservé à la diaspora ; décision 10 (ET-16) |
| Agenda de créneaux libres du mentor | Même brique que DS-12 (plan 09) ; après le pilote |
| Fils de réponses à plusieurs niveaux | Un niveau, comme le fil |

## 5. Lots d'implémentation

Zone de S2 : dépôt DIASPORALE et `convex/modules/diaspora/`. Les tables de la tranche se déclarent dans la tranche. Tout le reste passe par une issue `[S1]` : genres d'avis (`notifications/tables.ts`), seaux de débit (`convex/lib/rateLimit.ts`), lignes de `convex/crons.ts`, politiques de données (`people/dataPolicies.ts`), natures de conversation. Chaque lot sert aussi la démonstration (D-G13), ses textes fr et en dans le fragment du chantier (D-G14), et garde les avis neutres.

### ET-01 — Bénévoles prévenus, promesses vraies · P0 · S · S2
- **Pour l'utilisateur** : un inscrit apprend dans la cloche que la mission est annulée ou déplacée ; l'écran ne promet plus un message que l'équipe ne peut pas envoyer.
- **Backend** : deux émetteurs dans `communityNotifications.ts`, appelés par `cancelMission` et par `updateMission` quand l'horaire change ; envoi par pages bornées d'inscrits confirmés, après la transaction ; un avis par mission et par version. Issue `[S1]` : deux genres neutres et leur garde de lecture.
- **Web** : phrases et liens dans la cloche ; textes `signup.privacy`, `volunteers.lead`, `cancelSheet.description` et `privateContact` rendus exacts tant qu'ET-02 n'est pas livré.
- **Mobile** : rien avant le plan 16.
- **Données personnelles** : aucun contenu dans l'avis ; le motif se lit sur la fiche.
- **Tests et cliquets** : un avis par inscrit confirmé, aucun pour un inscrit retiré ; aucun avis si l'horaire ne change pas ; `notification-payload-content`.
- **Critères d'acceptation** : à deux comptes, l'inscrit voit l'avis puis le motif ; aucune phrase de l'écran ne décrit un geste impossible.
- **Dépend de** : rien.
- **Porte** : issue `[S1]`.

### ET-02 — Conversation entre l'équipe et chaque bénévole · P1 · M · S2
- **Pour l'utilisateur** : l'inscrit écrit à l'équipe ; l'équipe écrit à chaque bénévole et lui donne l'adresse du rendez-vous.
- **Backend** : nature de conversation pour l'inscription (bénévole côté demandeur, page côté répondant, voix de page) : règle pure dans `conversation-contexts.ts`, résolveur dans `A:convex/modules/diaspora/conversationContexts.ts`, crochets d'ouverture et de synchronisation dans `signUpForMission`, `withdrawFromMission`, `cancelMission`. Issue `[S1]` : nature ajoutée à `A:packages/social-domain/src/contextualMessaging.ts`, au registre et au contrat.
- **Web** : « Écrire à l'équipe » sur la fiche ; « Écrire » sur chaque ligne de la liste des bénévoles, par l'entrée commune des conversations d'objet.
- **Mobile** : après le web.
- **Données personnelles** : messages déjà couverts par la surface `contextualMessage` ; à vérifier dans l'export.
- **Tests et cliquets** : fil clos au retrait et à l'annulation ; non-signataire refusé ; adresse exacte admise en voix de page seulement ; `contextual-hooks`.
- **Critères d'acceptation** : à deux comptes non reliés, l'échange aboutit dans les deux sens ; aucun groupe n'est créé entre bénévoles.
- **Dépend de** : DS-04 (volet CC-V, plan 04) ; ET-01 ; décision 3.
- **Porte** : politique contextuelle ouverte par un opérateur ; issue `[S1]`.

### ET-03 — Garde sur les conseils sensibles · P1 · S · S2
- **Pour l'utilisateur** : sous une question de santé ou de démarches, une ligne rappelle qu'une réponse de membre n'est ni un avis médical ni un avis juridique, et renvoie au kit et à la source officielle.
- **Backend** : liste des thèmes sensibles dans le domaine ; aucun stockage.
- **Web** : note sur la fiche et dans le formulaire de réponse ; au moment de poser une question de santé, rappel de ne pas publier de détail médical personnel ; lien vers la rubrique du kit du même pays.
- **Mobile** : après le web.
- **Données personnelles** : réduit le risque de données de santé publiées par leur auteur.
- **Tests et cliquets** : note présente pour les thèmes listés seulement ; cliquet des textes fr et en.
- **Critères d'acceptation** : texte relu par le propriétaire ; aucune mention « conforme ».
- **Dépend de** : rien.
- **Porte** : relecture du texte ; question posée au juriste (plan 14).

### ET-04 — Retrouver : thème, mots, sans réponse · P1 · M · S2
- **Pour l'utilisateur** : filtrer les questions par thème, chercher un mot, voir celles qui attendent une réponse ; chercher dans le kit ; filtrer les mentors par langue et par ville.
- **Backend** : index par thème et index de recherche sur les questions (modèle `search_by_text` des services) ; même index sur le titre et le résumé du kit ; arguments ajoutés à `listQuestions`, `listResources`, `searchMentors` ; chaque ligne rejugée (blocage, modération) ; lectures bornées.
- **Web** : champ et filtres dans les trois écrans ; onglet, vue, thème et domaine portés par l'adresse (`D:apps/diasporale_com/src/lib/routes.ts`) ; vide expliqué.
- **Mobile** : après le web.
- **Données personnelles** : aucune recherche gardée, comme aujourd'hui.
- **Tests et cliquets** : auteur bloqué absent des résultats ; contenu en relecture absent ; `no-unbounded-collect`.
- **Critères d'acceptation** : une adresse filtrée se partage et se recharge à l'identique.
- **Dépend de** : rien ; fournit ses index à la recherche transversale du plan 03.
- **Porte** : aucune.

### ET-05 — Mentorat : créneau convenu, avis, rappel · P1 · M · S2
- **Pour l'utilisateur** : le mentoré confirme ou refuse le créneau proposé ; chacun est prévenu ; un rappel arrive avant la séance ; le créneau s'ajoute à son agenda.
- **Backend** : gestes du mentoré sur le créneau (règle des transitions, version du créneau) ; avis neutres : créneau proposé, confirmé ou refusé, demande expirée (dans `expireDueMentoringRequests`) ; rappel par passage borné. Issue `[S1]` : genres d'avis, ligne de cron.
- **Web** : boutons dans `mentoring-requests.tsx`, un seul plein ; heure dans le fuseau du lecteur ; fichier d'agenda du créneau confirmé, sans coordonnée.
- **Mobile** : après le web.
- **Données personnelles** : rien de nouveau hors l'état du créneau, exporté avec la demande.
- **Tests et cliquets** : version périmée refusée ; un seul avis d'expiration ; changement d'heure (R-G21).
- **Critères d'acceptation** : à deux comptes, proposition, confirmation, rappel et fichier d'agenda constatés.
- **Dépend de** : DS-04 pour la conversation ; décision 4.
- **Porte** : issue `[S1]`.

### ET-06 — Kit de départ du pays pilote, relecteurs désignés · P1 · M · S2 + propriétaire
- **Pour l'utilisateur** : en ouvrant le kit de France, le nouvel arrivant trouve au moins une ressource vérifiée par rubrique.
- **Backend** : aucun ; la graine reste hors production.
- **Web** : aucun code. Trame des sujets à couvrir écrite dans `docs/` ; chaque ressource saisie par l'interface au nom d'une page d'association relais (ou du poste après DG-009b), avec sa source officielle et la date du jour, puis relue par une autre personne.
- **Mobile** : sans objet.
- **Données personnelles** : aucune dans une ressource.
- **Tests et cliquets** : contrôle à la main : relecteur distinct, source qui répond, date de vérification.
- **Critères d'acceptation** : liste des ressources publiées par rubrique, avec relecteur ; aucune rubrique dite couverte si elle est vide ; aucun texte écrit sans source vérifiée.
- **Dépend de** : DS-05 (le kit n'a jamais été recetté) ; DS-06.
- **Porte** : associations relais et relecteurs désignés par le propriétaire (décision 6).

### ET-07 — Vie d'une ressource : relecteurs et auteurs prévenus · P1 · S · S2
- **Pour l'utilisateur** : le relecteur voit qu'une ressource attend ; l'auteur apprend que la sienne est « à revoir » ou bientôt périmée.
- **Backend** : compteur borné de la file pour une personne habilitée ; avis à qui a écrit la version quand un relecteur la marque « à revoir » et quand le seuil de signalements est franchi ; passage borné avant la fin de validité ; `withdrawResource` ouvert à un membre redevenu « en attente ». Issue `[S1]` : genres, ligne de cron.
- **Web** : pastille sur « À relire » et dans Communautés ; journal des relectures montré à qui gère la ressource.
- **Mobile** : après le web.
- **Données personnelles** : le journal ne montre que le nom publié du relecteur (décision 9).
- **Tests et cliquets** : un seul avis au franchissement du seuil ; aucun avis à un tiers.
- **Critères d'acceptation** : à trois comptes, trois signalements produisent un avis et l'état « à revoir ».
- **Dépend de** : ET-06.
- **Porte** : issue `[S1]`.

### ET-08 — Premiers pas du nouvel arrivant · P1 · M · S2
- **Pour l'utilisateur** : après l'accueil, une carte « Premiers pas » : le kit de son pays et de sa ville, rubrique par rubrique, à cocher ; poser une question ; trouver un mentor ; les prochaines missions et rencontres.
- **Backend** : table privée de la liste cochée, dans la tranche ; correspondance pure entre thèmes, rubriques et domaines dans le domaine. Issue `[S1]` : politique de données de la table, seau de débit.
- **Web** : carte dans Communautés et lien depuis `/bienvenue`, sans nouvelle destination ; montrée selon l'année d'arrivée ou sur demande ; « Enregistrer » branché sur DS-11 (volet favoris, plan 09) quand il existe.
- **Mobile** : après le web.
- **Données personnelles** : liste jamais montrée à autrui, exportée, effacée ; aucune étape consulaire stockée.
- **Tests et cliquets** : liste d'autrui introuvable ; carte absente pour un membre installé ; `member-screens-full-width`.
- **Critères d'acceptation** : à 390 et 1280 px ; un compte en attente lit la carte.
- **Dépend de** : ET-06 ; décisions 7 et 12.
- **Porte** : issue `[S1]`.

### ET-09 — Missions et questions là où l'on passe · P1 · S · S2
- **Pour l'utilisateur** : les missions d'une association se voient sur sa fiche ; mes inscriptions figurent dans mon agenda ; le hub montre l'entraide du pays.
- **Backend** : deux lectures bornées (prochaines missions d'une page, dernières questions ouvertes d'un pays), servies selon la modération ; aucune table.
- **Web** : section sur la fiche d'association (`page-screen.tsx`) ; lignes dans l'agenda (écran du plan 08) ; bloc offert au hub (plan 06).
- **Mobile** : après le web.
- **Données personnelles** : aucune.
- **Tests et cliquets** : mission en relecture absente de la fiche ; `network-scoped-functions`.
- **Critères d'acceptation** : aucune section vide affichée comme active.
- **Dépend de** : plans 06 et 08 pour l'emplacement ; décision 2.
- **Porte** : aucune.

### ET-10 — Mesure d'utilité de l'entraide · P1 · S · S2
- **Pour l'utilisateur** : rien de visible ; le responsable du pilote sait si l'entraide sert.
- **Backend** : groupe ajouté aux mesures du pilote (`D:packages/diasporale-domain/src/pilot-metrics.ts`, `A:convex/modules/diaspora/pilotMetrics.ts`) : questions posées, part ayant reçu une réponse, délai de première réponse, part résolue ; inscriptions bénévoles ; demandes de mentorat et part acceptée ; ressources publiées et part « à revoir ». Seuil « moins de 5 » et dénominateurs comme l'existant.
- **Web** : section du tableau `/pilote` (plan 17).
- **Mobile** : sans objet.
- **Données personnelles** : agrégats seulement.
- **Tests et cliquets** : seuil ; idempotence du passage nocturne.
- **Critères d'acceptation** : « première aide aboutie » lisible, avec son dénominateur.
- **Dépend de** : plan 17.
- **Porte** : aucune.

### DS-13 — Mentorat : retour après séance · P2 · S · S2 · repris du plan 15
- **Pour l'utilisateur** : après le créneau convenu ou à la clôture, le mentoré et le mentor notent ce qui a été fait ; chacun retrouve ses mentorats passés.
- **Backend** : un retour par partie sur `mentoringRequests` (texte borné sans coordonnée, date), écrit par sa seule partie, lu par les deux ; admis une fois la demande acceptée et le créneau passé, ou à la clôture ; relu par `moderateDiasporaWrite` ; aucune note chiffrée.
- **Web** : bloc « Ce qui a été fait » dans « Mes mentorats » ; filtre « Clos » des deux côtés.
- **Mobile** : après le web.
- **Données personnelles** : chaque retour exporté à son auteur ; effacé avec la demande ; durée à poser avec le juriste (décision 5).
- **Tests et cliquets** : retour refusé avant acceptation ; retour d'un tiers introuvable ; aucun champ public.
- **Critères d'acceptation** : aucune note publique ni classement des mentors.
- **Dépend de** : DS-05 ; ET-05.
- **Porte** : aucune.

### ET-11 — Mentorat dans la durée : séances, objectifs, besoin publié · P2 · M · S2
- **Pour l'utilisateur** : suivre plusieurs séances et quelques objectifs ; publier son besoin quand aucun mentor ne correspond.
- **Backend** : table des séances d'une demande (prévue, tenue, manquée, annulée) ; objectifs en liste courte ; besoin publié par pays et domaine, lu par les mentors actifs du pays, qui proposent leur aide. Issue `[S1]` : politique de données, nature de modération du besoin.
- **Web** : dans « Mes mentorats » et sur la recherche vide.
- **Mobile** : après le web.
- **Données personnelles** : export aux deux parties ; besoin retiré par son auteur.
- **Tests et cliquets** : un besoin ne donne aucun droit de contact avant accord.
- **Critères d'acceptation** : une recherche vide propose de publier le besoin, jamais un mentor inventé.
- **Dépend de** : ET-05, DS-13 ; convergence avec le « besoin publié » du moteur (NU-05) à examiner (DS-16).
- **Porte** : issue `[S1]`.

### ET-12 — Entraide vivante : merci, suivre, photo, questions proches · P2 · M · S2
- **Pour l'utilisateur** : remercier une réponse, suivre une question, joindre une photo, voir les questions proches avant de poser la sienne, citer une ressource du kit.
- **Backend** : un merci par personne et par réponse, compté sur la réponse, jamais par personne ; abonnements et avis aux abonnés ; photos par l'admission des fichiers du moteur ; questions proches par l'index d'ET-04 ; référence d'une ressource choisie dans une liste, sans lien. Issue `[S1]` : politiques de données.
- **Web** : fiche de la question et formulaire.
- **Mobile** : après le web.
- **Données personnelles** : merci, abonnements et photos exportés et effacés.
- **Tests et cliquets** : aucun total par personne ; photo d'un contenu retiré non servie.
- **Critères d'acceptation** : aucun classement n'apparaît nulle part.
- **Dépend de** : ET-04 ; brique du moteur SD-02 pour les photos ; décision 8.
- **Porte** : issue `[S1]`.

### ET-13 — « Disponible pour aider » utile, badge Mentor au profil · P2 · S · S2
- **Pour l'utilisateur** : trouver les membres qui proposent leur aide dans son pays ; voir sur un profil que la personne est mentor.
- **Backend** : filtre sur le drapeau dans `directory.ts`, dans le respect de l'annuaire opt-in et de la visibilité du champ ; drapeau « mentor actif » calculé dans `A:convex/modules/diaspora/profile.ts`.
- **Web** : bloc « Ils proposent leur aide » dans l'entraide du pays ; badge sur le profil, avec lien vers la fiche de mentor ; invitation « Devenir mentor » à qui coche le drapeau.
- **Mobile** : après le web.
- **Données personnelles** : rien de nouveau ; badge calculé, jamais stocké.
- **Tests et cliquets** : membre hors annuaire absent du bloc ; badge absent d'un profil en pause.
- **Critères d'acceptation** : aucun compteur d'aide rendue.
- **Dépend de** : plan 05 (annuaire).
- **Porte** : aucune.

### ET-14 — Missions : complète visible, liste d'attente, rappel, présence · P2 · M · S2
- **Pour l'utilisateur** : voir une mission complète et s'y mettre en attente ; être rappelé la veille ; l'équipe note qui est venu.
- **Backend** : règles d'attente reprises du domaine des évènements ; promotion au retrait ; rappel choisi par l'inscrit ; présence notée après la mission ; `listMissions` sert aussi l'état `full`. Issue `[S1]` : avis, ligne de cron.
- **Web** : fiche et liste des missions ; liste de l'équipe.
- **Mobile** : après le web.
- **Données personnelles** : présence visible de l'équipe et de la personne seulement ; exportée.
- **Tests et cliquets** : deux inscriptions sur la dernière place ; ordre de la file.
- **Critères d'acceptation** : aucune sur-inscription ; file auditable.
- **Dépend de** : ET-01 ; une seule brique de rappel avec les plans 08 et 09.
- **Porte** : issue `[S1]`.

### ET-15 — Kit par étapes et en deux langues · P2 · M · S2
- **Pour l'utilisateur** : lire le kit dans l'ordre de l'installation ; le lire en anglais.
- **Backend** : étape fermée sur la ressource ; version anglaise liée, relue à part ; tri par étape.
- **Web** : filtre par étape ; bascule de langue sur la fiche.
- **Mobile** : après le web.
- **Données personnelles** : aucune.
- **Tests et cliquets** : une traduction non relue ne se publie pas.
- **Critères d'acceptation** : aucune traduction automatique présentée comme relue.
- **Dépend de** : ET-06.
- **Porte** : liste des étapes validée par le propriétaire.

### ET-16 — Kit lisible avant le départ · P3 · M · S1 + S2
- **Pour l'utilisateur** : un futur étudiant encore au Gabon lit, depuis ANTSIA, les ressources que leurs auteurs ont choisi d'y montrer.
- **Contenu** : geste explicite de l'auteur d'une ressource portée par une page ; projection en lecture seule dans le réseau racine ; rien d'autre ne sort de DIASPORALE.
- **Dépend de** : ET-06 ; moteur (visibilité `root` d'un objet de la tranche).
- **Porte** : décision 10 ; issue `[S1]`.

### ET-17 — Appel à la solidarité d'une association · P3 · M · S2
- **Pour l'utilisateur** : une association vérifiée annonce un deuil ou une hospitalisation et organise des présences, sans collecte d'argent.
- **Contenu** : type de mission dédié, porté par une page vérifiée ; aucun détail de santé d'une personne nommée sans son accord ; aucun lien, aucun compte bancaire.
- **Dépend de** : ET-01, ET-02.
- **Porte** : décision 11 ; avis du juriste sur les données de santé et de tiers.

## 6. Ordre recommandé et dépendances

| Vague | Lots | Pourquoi dans cet ordre |
|---|---|---|
| 1 | ET-01, volet de recette ci-dessous | Rendre vrai ce que l'écran promet ; prouver sur le moteur ce qui est écrit |
| 2 | ET-06, ET-07, ET-03, ET-10 | Un kit non vide, relu et suivi ; une garde ; une mesure : ce que la sortie de G8 exige avant d'ouvrir |
| 3 | ET-02, ET-05, ET-04 | Les canaux et les avis qui font aboutir une aide ; retrouver |
| 4 | ET-08, ET-09 | Le nouvel arrivant est guidé ; l'entraide se voit là où l'on passe |
| 5 | DS-13, ET-11 à ET-15 | Enrichissements, après les premiers retours du pilote |
| 6 | ET-16, ET-17 | Sous décision et avis du juriste |

**Ce que ce plan attend des autres plans** : plan 04, la politique contextuelle ouverte et recettée (DS-04) et la nature d'ET-02 ; plan 02, les boutons et les textes (DS-02, DS-03) ; plan 13, les préférences pour les nouveaux genres d'avis (DS-14) ; plan 14, une équipe de modération France ; plan 09, la brique « Enregistrer » et une seule brique de rappel ; plan 08, l'agenda et les règles d'attente ; plan 05, l'annuaire ; plan 06, le bloc du hub et l'ouverture d'une rubrique par pays (ligne 95, sans propriétaire aujourd'hui) ; plan 15, les pages Officiel ; plan 17, DS-05, DS-06 et le tableau du pilote. Entraide, mentorat et kit n'existent que dans la tranche ; ils serviraient ANTSIA (entraide de quartier, mentorat professionnel) : candidat à DS-16 après le pilote.

**Volet de recette en mode moteur (campagne DS-05)**. Backend local, comptes de démonstration par acteur (docs/34 de DIASPORALE) : `declare`, `parraine`, `verifie`, `leger`, `association`, `mentor`, `bloque`, `canada`, `moderateur`.

| Parcours | Étapes | Résultat attendu |
|---|---|---|
| Question | `declare` pose (France, Paris, Logement) ; `verifie` répond ; `declare` retient, modifie, clôt | Avis dans les deux cloches ; « modifiée » ; plus de réponse possible ; `leger` lit sans pouvoir répondre ; un numéro de téléphone est refusé |
| Blocage et pays | `bloque` ouvre la question ; `canada` lit l'entraide de France | Les réponses de `verifie` sont absentes pour `bloque` ; la lecture d'un autre pays est permise |
| Mission | `association` crée une mission de 2 places ; `declare` et `verifie` s'inscrivent ; `parraine` ouvre la fiche ; `verifie` se retire ; l'équipe déplace puis annule | Case de consentement exigée ; « complète » puis rouverte ; liste lue par l'équipe seule ; avis d'ET-01 quand il est livré |
| Mentorat | `declare` demande à `mentor` (2 créneaux, double clic) ; `mentor` accepte avec un créneau, en propose un autre dans deux onglets, clôt | Une seule demande ; conflit de version dit ; place libérée ; conversation ouverte si DS-04 est fait, sinon refus dit en clair |
| Plafonds | plafond du mentor à 1, deux demandes acceptées ; pause puis retrait du profil | Seconde acceptation refusée ; mentor absent de la recherche ; demandes déclinées et mentorats clos |
| Kit | `association` propose une ressource (France, Paris) ; `verifie` relit et publie ; `declare`, `parraine` et `canada` la signalent « périmée » ; nouvelle version | Auteur refusé comme relecteur ; « à revoir » au troisième signalement ; signalements remis à zéro ; nouvelle relecture exigée |
| Droits | export puis effacement d'un compte après question retenue, inscription, mentorat, ressource | Données propres exportées ; compteurs décrémentés ; mission rouverte ; réponse retenue vidée (R-G19) |
| Modération | signalement d'une question, d'une mission, d'un profil de mentor, puis décision de `moderateur` | Masquage pour le déclarant ; décision motivée ; recours (avec le plan 14) |

## 7. Décisions à prendre par le propriétaire

1. **Compte en attente et entraide.** Recommandation : garder la lecture seule (A3). Le kit et les questions se lisent déjà ; écrire avant le parrainage rouvrirait la porte aux comptes jetables.
2. **Qui porte une mission.** Recommandation : les associations seulement au pilote ; ouvrir aux pages Officiel quand elles existent (plan 15), jamais aux entreprises.
3. **Canal entre l'équipe et les bénévoles.** Recommandation : une conversation par inscription (ET-02), pas un groupe : un groupe montrerait les noms des bénévoles entre eux sans leur accord. Durée d'ouverture après la mission à fixer dans le lot.
4. **Créneau de mentorat.** Recommandation : le mentoré confirme ; rappel la veille, dans la cloche seulement tant que le push n'est pas ouvert.
5. **Retour après séance.** Recommandation : texte privé des deux côtés, aucune note. Question au juriste : durée de conservation, export du retour à la seule personne qui l'a écrit.
6. **Kit de départ.** Recommandation : deux associations relais écrivent, un relecteur désigné par pays relit ; les neuf rubriques nationales couvertes avant d'inviter les nouveaux arrivants.
7. **Carte « Premiers pas ».** Recommandation : montrée aux membres arrivés cette année ou l'an dernier, et à qui la demande ; jamais imposée.
8. **« Merci ».** Recommandation : oui, compté sur la réponse, sans total par personne ni classement.
9. **Nom public du relecteur du kit** (question ouverte depuis docs/32 § 5). Recommandation : garder le nom publié, annoncé au moment de relire ; à confirmer par le juriste.
10. **Kit avant le départ** (ET-16). Recommandation : oui après le pilote, pour les ressources portées par une page et par geste de leur auteur.
11. **Appel à la solidarité** (ET-17). Recommandation : fermé jusqu'à l'avis du juriste ; en attendant, l'association publie sur sa page et crée un évènement.
12. **Trois listes fermées.** Recommandation : une table de correspondance, pas une fusion : les valeurs stockées ne se perdent pas.

## 8. Risques et points d'attention

- **Rubriques ouvertes mais vides** : aucune graine dans le moteur, aucun moyen de fermer une rubrique par pays (ligne 95). Les vides sont expliqués, mais un kit vide déçoit le public qu'il vise.
- **Relecteurs rares** : relire exige un membre vérifié ou un signataire vivant ; tant que l'attestation consulaire est fermée, peu de membres sont vérifiés.
- **Mentorat sans canal** si la politique contextuelle n'est pas ouverte en production (DS-06).
- **Conseils dangereux et données de santé** publiées par leur auteur : garde ET-03, modération, question au juriste. Rien ici n'est dit « conforme ».
- **Mineurs** : aucun élargissement (D-G11) ; le mentorat reste entre adultes.
- **Fichiers hors zone** : avis, seaux, cron, politiques de données, natures de conversation appartiennent à S1 ; chaque lot le dit.
- **Trois rappels pour une seule brique** : évènements, rendez-vous de service, mentorat et missions ne doivent pas en construire trois.
- **Démonstration plus riche que le moteur** : la démonstration locale a des exemples fictifs ; le moteur n'a que ce que les comptes écrivent.
- **Contenu du kit** : un agent ne rédige pas une démarche administrative sans source vérifiée et sans relecture humaine.

## 9. Prompts d'implémentation

### Prompt ET-01
```text
Session S2 (DIASPORALE). Écris en français. Opus seulement.
Lis docs/etudes/2026-11-10-finalisation/11_ENTRAIDE_MENTORAT_KIT_ARRIVEE.md (§ 2 lignes 29 et 30, lot ET-01), docs/32 § 8, ANTSIA/convex/modules/diaspora/communityNotifications.ts et mutualAid.ts.
Vérifie d'abord que cancelMission et updateMission n'émettent toujours aucun avis. Dépose l'issue [S1] pour les deux genres neutres.
Branche claude/missions-inscrits-prevenus. Livre : émetteurs, phrases fr et en de la cloche, textes de la fiche rendus exacts, démonstration, tests.
Vérifie : bun run --cwd ../ANTSIA verify avec le verrou, puis une recette à deux comptes en local. Arrête-toi avant toute publication.
```

### Prompt ET-04
```text
Session S2. Lis le lot ET-04 du plan 11, ANTSIA/convex/modules/diaspora/servicesTables.ts (index search_by_text) et services.ts (lecture bornée), mutualAidTables.ts, arrivalKitTables.ts.
Branche claude/entraide-retrouver. Ajoute les index et les arguments, rejuge chaque ligne (blocage, modération), porte les filtres dans lib/routes.ts.
Tests : auteur bloqué absent, contenu en relecture absent, no-unbounded-collect. Recette à 390 et 1280 px. Arrête-toi avant toute publication.
```

### Prompt ET-05
```text
Session S2. Lis le lot ET-05 du plan 11, packages/diasporale-domain/src/mentoring.ts (MENTORING_TRANSITIONS), ANTSIA/convex/modules/diaspora/mentoring.ts, apps/diasporale_com/src/components/mentoring-requests.tsx. Applique la décision 4.
Dépose l'issue [S1] : genres d'avis et ligne de cron du rappel.
Branche claude/mentorat-creneau-convenu. Livre : gestes du mentoré, avis, rappel borné, fichier d'agenda, démonstration, textes fr et en, tests de version et de changement d'heure.
Vérifie : verify, recette à deux comptes. Dis en clair si la conversation reste fermée (DS-04). Arrête-toi avant toute publication.
```

### Prompt ET-08
```text
Session S2. Lis le lot ET-08 du plan 11, les trois listes fermées (AID_THEMES, ARRIVAL_KIT_CATEGORIES, MENTORING_DOMAINS), apps/diasporale_com/src/screens/communities-screen.tsx et welcome-screen.tsx. Applique les décisions 7 et 12.
Dépose l'issue [S1] : politique de données de la table privée, seau de débit.
Branche claude/premiers-pas. Aucune nouvelle destination. Livre la carte, la liste cochée privée, la correspondance testée, la démonstration, les textes fr et en.
Vérifie : verify ; 390 et 1280 px, clair et sombre ; comptes leger, declare, verifie. Arrête-toi avant toute publication.
```

### Prompt DS-13
```text
Session S2. Lis le lot DS-13 du plan 11 et du plan 15, la décision 5, ANTSIA/convex/modules/diaspora/mentoringTables.ts et people/dataInventory.ts.
Branche claude/mentorat-retour. Un retour privé par partie, admis après le créneau ou à la clôture, sans note chiffrée ; export à son seul auteur.
Tests : refus avant acceptation, tiers introuvable, aucun champ public. Verify, recette à deux comptes. Arrête-toi avant toute publication.
```

## 10. Sources lues

- Contexte commun de la session : dossier de reprise, cahier (docs/00), plan global (docs/14), registre des décisions (docs/17), plan 15 et plan directeur d'ANTSIA, registre des 317 lots, table des routes.
- DIASPORALE, documents : docs/32 (en entier), `D:docs/recette/deux-comptes-2026-10-19/README.md`, docs/recette/demo-en-ligne-2026-10-22 (début).
- Dossier produit : fiche F12, § 1 et § 2, stratégie de lancement (`OPPORTUNITES_COMMUNAUTE_DIASPORA.md`).
- Plans du moteur : UM-13 du plan 09 ; recherche des mots « mentor », « entraide », « bénévol » dans les seize plans (aucun lot hors plan 15).
- DIASPORALE, code : écrans `mutual-aid-screens.tsx`, `mentoring-screens.tsx`, `arrival-kit-screens.tsx` ; composants `mutual-aid-question-detail.tsx`, `mutual-aid-mission-detail.tsx`, `mentoring-requests.tsx`, `arrival-kit-actions.tsx`, `demo-account-bootstrap.tsx` ; ports et démonstrations des trois rubriques ; domaine `mutual-aid.ts`, `mentoring.ts`, `arrival-kit.ts`, `conversation-contexts.ts`, `eligibility.ts`, `countries.ts`, `pilot-metrics.ts` ; textes fr des trois fragments et de la cloche.
- ANTSIA, code : tranche `mutualAid.ts`, `mentoring.ts`, `arrivalKit.ts` et leurs tables, `communityNotifications.ts`, `conversationContexts.ts`, `moderationTargets.ts`, `seed.ts`, `demoAccounts.ts` ; `A:convex/modules/messaging/inbox.ts` ; `A:convex/modules/contextualMessaging/registry.ts` ; `convex/crons.ts` ; `convex/lib/rateLimit.ts` ; `people/dataPolicies.ts`.
- Non lu : les tests eux-mêmes, les adaptateurs moteur ligne à ligne, les annexes du plan du programme.
