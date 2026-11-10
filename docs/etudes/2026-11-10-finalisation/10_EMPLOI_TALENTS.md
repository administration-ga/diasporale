# Plan 10 — Emploi, talents et réseau professionnel

> Constaté par lecture du code d'`origin/main` (DIASPORALE `bead76d`, ANTSIA `fd58d73b`), le 10 novembre 2026. Rien n'a été exécuté : ni test, ni recette, ni publication.
> Applications de référence : LinkedIn (Emploi, Recruiter), Indeed, Welcome to the Jungle, APEC, Malt. Comparaison faite de mémoire, sans revérification en ligne ; un « ? » marque ce qui n'est pas sûr.
> Ce plan détaille, pour l'emploi et les talents, le plan 15 du dossier de finalisation d'ANTSIA. Les lots qu'il en reprend gardent leur identifiant (DS-…, DG-…) ; les lots nouveaux portent le préfixe `EM-`.

Légende des chemins : `D:` = dépôt DIASPORALE, `A:` = dépôt ANTSIA. « Écran » = atteignable depuis l'interface de diasporale.com ; « Moteur » = la fonction existe côté serveur.

## 1. L'intention du propriétaire

- **Pour qui** : le citoyen établi et le nouvel arrivant qui cherchent un emploi ou de la visibilité (P1, P2), l'entrepreneur de la diaspora qui recrute sur place (P4), le recruteur « diaspora ou Gabon » (P5). Source : cahier § 6.1 ; dossier produit, fiches F06 et F07.
- **Quoi** : des offres d'emploi, une candidature « en un geste avec le profil professionnel », un fil recruteur–candidat, des alertes par filtres (EXF-DG-34) ; un annuaire des talents opt-in, protégé de l'extraction (EXF-DG-35) ; un profil professionnel « visible des recruteurs vérifiés seulement » au choix (EXF-DG-09). Le dossier produit en fait la fonction phare de la communauté (F07).
- **Cas d'usage d'origine** (F06, F07) : le restaurant gabonais de Bruxelles cherche un cuisinier ; une entreprise de Libreville recrute dans la diaspora ; l'étudiant filtre « temps partiel, ma ville » ; l'ingénieure de Berlin est contactée pour un projet au Gabon ; un programme de retour des compétences lit des agrégats.
- **Déjà décidé** : l'offre appartient à une page d'entreprise ou d'association ; la candidature est privée et consentie ; le profil de talent est opt-in, sans export de masse (DG-025, docs/32 de DIASPORALE § 1). La mise en contact est structurée et attachée à un objet (D-G02). La conversation naît à la présélection, en voix de page ; clore une offre ne ferme rien ; pas d'état « recrutement terminé » en V1 (contrat CONVERSATION-CONTEXTUELLE-V1, décisions D2 à D6 du 19/10). Classement chronologique et explicable (D-G05).
- **Refusé** : faire payer pour candidater (plan directeur d'ANTSIA § 2.4) ; vendre l'accès à l'annuaire des personnes (dossier produit § 5.1) ; classer des candidats par popularité sociale (étude du 18/10) ; demander l'âge, le sexe, l'origine, la situation familiale ou une photo (règle du domaine) ; afficher une coordonnée.
- **Relecture au lancement** : les offres passent en relecture à l'ouverture d'un pays, puis en publication directe (EXF-DG-34, EXF-DG-42 ; F07, étape 2).
- **Qui paie** : le talent, jamais. Le recruteur peut-être un jour (packs, offre mise en avant) : lot D4, pas au pilote (D-G03, D-G04 ; F07).
- **Ouvert côté droit** : durée de conservation des candidatures ; motif de non-sélection face au droit d'accès (docs/32 de DIASPORALE § 5, point 6 ; ADR-0024 du moteur, point 6).
- **Lien avec le moteur** : ANTSIA a son propre emploi, reflété de PRO.GA et fermé (plan 09 du moteur). D-G01 interdit tout lien PRO.GA à la mise en relation de DIASPORALE. DS-16 prévoit de faire converger les deux.

## 2. Ce qui existe

| # | Capacité | État | Écran | Moteur | Preuve |
|---|---|---|---|---|---|
| | **Publier et gérer une offre (côté page)** | | | | |
| 1 | Publier une offre au nom d'une page d'entreprise ou d'association | Présent | oui | oui | `A:convex/modules/diaspora/jobs.ts` (`createJobOffer`), `D:apps/diasporale_com/src/components/job-offer-form.tsx` |
| 2 | Publier en son nom propre (membre vérifié sans page), comme l'envisageait EXF-DG-34 | Absent, par règle : une offre appartient à une page | non | non | `D:packages/diasporale-domain/src/jobs.ts` (`JOB_EMPLOYER_OWNER_KINDS`) |
| 3 | Réserver la publication aux pages au badge « Vérifié » | Absent : toute page active d'entreprise ou d'association publie | non | non | `A:convex/modules/diaspora/jobs.ts` (`managedEmployerPage`) |
| 4 | Champs : intitulé, description, contrat, pays, ville saisie, mode de travail, langues, rémunération, date limite | Présent | oui | oui | `D:packages/diasporale-domain/src/jobs.ts` (`parseJobOffer`) |
| 5 | Contrats : CDI, CDD, stage, temps partiel, indépendant | Présent | oui | oui | `D:packages/diasporale-domain/src/jobs.ts` (`JOB_OFFER_CONTRACTS`) |
| 6 | Alternance, emploi saisonnier ; niveau attendu, date de prise de poste, temps de travail | Absent | non | non | motifs : `apprenticeship`, `alternance`, `seasonal`, `level`, `startsAt` |
| 7 | Secteur d'activité (demandé par EXF-DG-34) | Absent | non | non | motifs : `sector`, `secteur` dans `A:convex/modules/diaspora/jobsTables.ts` |
| 8 | Langues de travail, dont le lingala et le fang | Présent | oui | oui | `D:packages/diasporale-domain/src/services.ts` (`SERVICE_LANGUAGE_CODES`) |
| 9 | Rémunération annoncée : fourchette, devise, période | Présent | oui | oui | `D:apps/diasporale_com/src/components/job-parts.tsx` (`formatJobPay`) |
| 10 | Aucune coordonnée dans une offre : téléphone, e-mail, lien, adresse refusés | Présent | oui | oui | `D:packages/diasporale-domain/src/jobs.ts` (`jobTextHasContact`) |
| 11 | Aucun critère personnel : ni âge, ni sexe, ni origine, ni situation familiale, ni photo | Présent | oui | oui | `D:packages/diasporale-features/src/i18n/locales/fr/jobs.json` (`jobs.form.fairness`) |
| 12 | Brouillon, publier, suspendre, reprendre, clore (définitif) | Présent | oui | oui | `A:convex/modules/diaspora/jobs.ts` (`setJobOfferStatus`) |
| 13 | Modifier sous contrôle de version (deux signataires) | Présent | oui | oui | `A:convex/modules/diaspora/jobs.ts` (`updateJobOffer`) |
| 14 | Date limite facultative, six mois au plus ; clôture écrite chaque heure | Présent | oui | oui | `A:convex/crons.ts` (`diaspora-job-offers-expiry`) |
| 15 | Fin de vie d'une offre sans date limite | Absent : elle reste ouverte sans fin, sans relance | non | non | `D:packages/diasporale-domain/src/jobs.ts` (`checkJobDeadline` admet `null`) ; motifs : `renew`, `extend`, `relance` |
| 16 | Plafond de 30 offres non closes par page | Présent | — | oui | `A:convex/modules/diaspora/jobs.ts` (`assertJobOfferQuota`) |
| 17 | Relecture préalable des offres au lancement | Fermé : publiée dès l'écriture, sauf politique du réseau pour cette surface ; aucun écran ne la pose (lot MC-02 du moteur) | non | oui | `A:convex/modules/diaspora/moderationContent.ts` (`moderateDiasporaWrite`) |
| 18 | État de modération de l'offre montré à l'équipe | Présent | oui | oui | `D:apps/diasporale_com/src/components/job-parts.tsx` (`JobModerationNote`) |
| 19 | Dupliquer une offre, la marquer « pourvue », la mettre en avant | Absent du module ; les variantes « pourvue » et « sponsorisée » ne sont dessinées que pour la page de la charte | non | non | `D:apps/diasporale_com/src/screens/charte-screen.tsx` ; motifs : `duplicate`, `filled` dans `jobsTables.ts` |
| 20 | Espace recruteur dans « Mon activité » et dans la gestion de la page | Présent | oui | oui | `D:apps/diasporale_com/src/components/job-recruiter-panel.tsx`, `D:apps/diasporale_com/src/screens/page-admin-screens.tsx` |
| | **Chercher et lire une offre** | | | | |
| 21 | Recherche : texte, pays, ville saisie sans GPS, contrat, mode de travail | Présent | oui | oui | `A:convex/modules/diaspora/jobs.ts` (`searchJobOffers`) |
| 22 | Recherche portée par l'adresse (partage, retour arrière) | Partiel : pays et ville seulement ; texte, contrat et mode restent dans l'écran | oui | — | `D:apps/diasporale_com/src/lib/routes.ts` (`jobs`), `D:apps/diasporale_com/src/screens/jobs-screens.tsx` (`LocalFilters`) |
| 23 | Filtres par langue, secteur, rémunération, ancienneté ; tri | Absent | non | non | motifs : `language`, `sortBy`, `postedWithin` dans `parseJobSearch` |
| 24 | Résultats paginés, les plus récents d'abord, vide expliqué | Présent | oui | oui | `D:apps/diasporale_com/src/screens/jobs-screens.tsx` (`JobResults`) |
| 25 | Fiche : page qui recrute et badge calculé, lieu, langues, rémunération, date limite, date de publication | Présent | oui | oui | `D:apps/diasporale_com/src/screens/jobs-screens.tsx` (`JobOfferArticle`) |
| 26 | Avertissement « le badge dit qui est la page, il ne garantit pas l'offre » | Présent | oui | — | `D:packages/diasporale-features/src/i18n/locales/fr/jobs.json` (`jobs.offer.badgeNote`) |
| 27 | Rappel « on ne paie jamais pour candidater », conseils contre les fausses offres | Absent | non | — | motifs : `frais`, `argent`, `payer`, `gratuit` dans le fragment `jobs.json` |
| 28 | Offres d'une page sur sa fiche (page employeur) | Absent : lire les offres d'une page est réservé à ses signataires | non | non | `A:convex/modules/diaspora/jobs.ts` (`pageJobOffers`), `D:apps/diasporale_com/src/screens/page-screen.tsx` (motifs `useJobs`, `emploi` : aucun) |
| 29 | Onglet « Emploi » du hub d'un pays | Présent | oui | oui | `D:apps/diasporale_com/src/components/job-hub-tab.tsx` |
| 30 | Entrées : Communautés, Explorer, « Mes candidatures » de l'espace personnel | Présent | oui | — | `D:apps/diasporale_com/src/components/community-shortcuts.tsx`, `D:apps/diasporale_com/src/components/app-shell.tsx` |
| 31 | Offre située au Gabon (« retour au pays ») | Absent : refus `job_country_is_home` | non | non | `D:packages/diasporale-domain/src/jobs.ts` (`parseJobCountry`) |
| 32 | Recruteur installé au Gabon | Absent : publier exige d'être signataire d'une page du réseau, donc membre, donc résident hors du Gabon | non | non | `D:packages/diasporale-domain/src/countries.ts` (`RESIDENCE_COUNTRY_CODES`) |
| 33 | Enregistrer une offre | Absent | non | non | motifs : `savedJob`, `bookmark`, `enregistr` dans les écrans d'emploi |
| 34 | Alertes d'emploi par filtres (EXF-DG-34) | Absent | non | non | motifs : `jobAlert`, `savedSearch`, `alerte` |
| 35 | Offres proposées d'après mon profil ; avis aux membres du pays à la publication (F07) | Absent | non | non | motifs : `recommended`, `matching` ; trois genres d'avis seulement (ligne 53) |
| 36 | Partager une offre (lien, iCom, fil de la page) | Absent | non | non | motifs : `share`, `partag` dans `D:apps/diasporale_com/src/components/job-parts.tsx` |
| 37 | Signaler une offre ; signalée, elle est masquée pour moi | Présent | oui | oui | `D:apps/diasporale_com/src/components/report-content-sheet.tsx`, `A:convex/modules/diaspora/moderationTargets.ts` |
| 38 | Motif de signalement « arnaque » ou « frais demandés » | Absent : douze motifs généraux | non | non | `A:packages/social-domain/src/moderation.ts` (`CONTENT_REPORT_REASONS`) |
| 39 | Concours publics, recrutements officiels | Absent | non | non | motifs : `concours`, `travail.ga` |
| 40 | Offres d'employeurs du Gabon reflétées de PRO.GA | Absent ici ; le moteur l'a, fermé par politique de réseau et par le registre d'activation | non | oui | `A:convex/modules/shops/jobs.ts` (`discover`), `A:convex/modules/shops/commerceActivation.ts` |
| | **Candidater et suivre** | | | | |
| 41 | Candidater : message de 20 à 3 000 signes, consentement explicite à transmettre son nom | Présent | oui | oui | `A:convex/modules/diaspora/jobs.ts` (`applyToJobOffer`), `D:apps/diasporale_com/src/components/job-apply-entry.tsx` |
| 42 | Joindre son profil de talent, au choix, jamais coché d'avance | Présent | oui | oui | `D:apps/diasporale_com/src/components/job-apply-entry.tsx` |
| 43 | Joindre un CV ou une pièce à la candidature | Absent ici ; le moteur l'a pour ses propres candidatures (PDF, antivirus complet) | non | oui | `A:convex/modules/shops/jobFiles.ts` |
| 44 | Candidater en un geste, sans message ; questions de présélection | Absent | non | non | motifs : `screening`, `question` ; `JOB_APPLICATION_MESSAGE_MIN_LENGTH` vaut 20 |
| 45 | Une candidature par personne et par offre ; double envoi sans doublon | Présent | oui | oui | `D:packages/diasporale-domain/src/jobs.ts` (`jobApplicationFingerprint`) |
| 46 | Candidature liée à la version lue de l'offre ; refus sur l'offre de sa propre page | Présent | oui | oui | `A:convex/modules/diaspora/jobs.ts` (`applyToJobOffer`) |
| 47 | Compte en attente : lit les offres, ne candidate pas, l'écran dit pourquoi | Présent | oui | oui | `D:packages/diasporale-domain/src/eligibility.ts` (`CAPABILITIES_BY_STATUS`) |
| 48 | Débit : 20 candidatures par heure, 5 par jour pour un compte déclaré sans badge | Présent | — | oui | `A:convex/lib/rateLimit.ts` |
| 49 | « Mes candidatures » : état, date, page, message, profil joint, offre encore ouverte | Présent | oui | oui | `A:convex/modules/diaspora/jobs.ts` (`myJobApplications`) |
| 50 | États : envoyée, vue, présélectionnée, non retenue, retirée | Présent | oui | oui | `D:packages/diasporale-domain/src/jobs.ts` (`JOB_APPLICATION_STATUSES`) |
| 51 | États « entretien », « proposition », « recrutée » | Absent ici (décision du 19/10 : pas d'état de fin en V1) ; le moteur les lit de PRO.GA | non | oui | `A:packages/social-domain/src/commerce-jobs.ts` |
| 52 | Retirer sa candidature : définitif, l'équipe n'en voit plus que l'état | Présent | oui | oui | `A:convex/modules/diaspora/jobs.ts` (`withdrawJobApplication`) |
| 53 | Avis dans la cloche : candidature reçue (équipe), présélection et non-sélection (candidat) | Présent | oui | oui | `A:convex/modules/diaspora/communityNotifications.ts` |
| 54 | Avis « vue par l'équipe », « offre close », relance d'une candidature sans réponse | Absent | non | non | motifs : `job_application_seen`, `job_offer_closed` dans les genres d'avis |
| 55 | Recandidater après un retrait | Absent : l'unicité compte aussi la candidature retirée | non | non | `A:convex/modules/diaspora/jobs.ts` (`myApplicationOf`) |
| 56 | Motif de non-sélection montré au candidat | Absent, par choix : note de l'équipe seule ; question juridique ouverte | non | non | `A:convex/modules/people/dataInventory.ts` |
| 57 | Conversation avec l'équipe : ouverte à la présélection, voix de page, pièces et appels admis | Fermé : la politique contextuelle n'est ouverte sur aucun déploiement | oui | oui | `D:packages/diasporale-domain/src/conversation-contexts.ts` (`jobApplicationConversation`), `A:convex/modules/diaspora/conversationContexts.ts` |
| 58 | Écrire à l'équipe avant la présélection | Absent, par choix (le premier mot est au répondant) | non | non | `A:docs/contrats/CONVERSATION-CONTEXTUELLE-V1.md` |
| 59 | État de modération de ma candidature | Présent | oui | oui | `D:apps/diasporale_com/src/screens/jobs-screens.tsx` (`MyApplicationRow`) |
| 60 | Export de mes candidatures, sans la note de l'équipe ni l'identité de qui a décidé | Présent | oui | oui | `A:convex/modules/people/dataInventory.ts` |
| 61 | Durée de conservation et purge des candidatures closes | Absent : aucune purge temporelle | non | non | motifs : `retention`, `purge` dans `A:convex/modules/diaspora/jobs.ts` ; `A:convex/modules/people/dataPolicies.ts` (propriété seule) |
| | **L'équipe qui recrute** | | | | |
| 62 | Candidatures d'une offre, filtrées par état, réservées aux signataires vivants | Présent | oui | oui | `A:convex/modules/diaspora/jobs.ts` (`jobOfferApplications`) |
| 63 | Marquer vue, présélectionner, ne pas retenir (note facultative de 500 signes), signaler une candidature | Présent | oui | oui | `D:apps/diasporale_com/src/components/job-recruiter-panel.tsx` |
| 64 | Nom publié et lien vers le profil du candidat (consentement) | Présent | oui | oui | `A:convex/modules/diaspora/jobs.ts` (`receivedApplicationOf`) |
| 65 | Nombre de candidatures par offre, repère « nouvelles » | Absent | non | non | motifs : `applicationCount`, `unread` |
| 66 | Notes d'équipe, étiquettes, attribution à un membre de l'équipe | Absent (seule la note de refus existe) | non | non | motifs : `teamNote`, `tag`, `assignee` |
| 67 | Planifier un entretien ; délai de réponse affiché ; statistiques d'une offre | Absent | non | non | motifs : `interview`, `responseTime`, `viewCount` |
| 68 | Indicateurs emploi au tableau du pilote | Absent : quatre groupes, aucun pour l'emploi | non | non | `D:packages/diasporale-domain/src/pilot-metrics.ts` (`PILOT_METRIC_GROUPS`) |
| | **Talents et profil professionnel** | | | | |
| 69 | Profil de talent opt-in, un par personne, case d'accord jamais cochée | Présent | oui | oui | `A:convex/modules/diaspora/jobs.ts` (`saveMyTalentProfile`), `D:apps/diasporale_com/src/components/job-talent-profile.tsx` |
| 70 | Champs : titre, 1 à 15 compétences déclarées, disponibilité, langues, pays | Présent | oui | oui | `D:packages/diasporale-domain/src/jobs.ts` (`parseTalentProfile`) |
| 71 | Ville, contrat recherché, secteur, niveau par compétence ou par langue | Absent | non | non | motifs : `city`, `soughtContract`, `skillLevel` dans `talentProfiles` |
| 72 | Expériences, formations, diplômes ; recommandations | Absent ici et dans le moteur (lot UM-13 du moteur) | non | non | motifs : `experience`, `education`, `diploma`, `recommendation` |
| 73 | Présentation, réalisations, activités liées | Absent ici ; le moteur l'a dans son profil professionnel | non | oui | `A:packages/social-domain/src/professionals.ts` |
| 74 | Visibilité : dans la recherche du réseau, ou masqué (joint aux seules candidatures choisies) | Présent | oui | oui | `D:packages/diasporale-domain/src/jobs.ts` (`TALENT_VISIBILITIES`) |
| 75 | Visibilité « recruteurs vérifiés seulement » (EXF-DG-09) | Absent : tout membre déclaré ou vérifié cherche les talents | non | non | `A:convex/modules/diaspora/jobs.ts` (`searchTalents`) |
| 76 | Masquer, réactiver, supprimer son profil | Présent | oui | oui | `A:convex/modules/diaspora/jobs.ts` (`removeMyTalentProfile`) |
| 77 | Recherche : pays obligatoire, compétence facultative, 12 par page, nom court | Présent | oui | oui | `D:packages/diasporale-domain/src/jobs.ts` (`talentShortName`) |
| 78 | Fiche détaillée d'un talent | Absent : la carte est le seul écran | non | non | `D:apps/diasporale_com/src/components/job-parts.tsx` (`TalentHitCard`) |
| 79 | Contacter un talent, lui proposer une offre | Absent : la carte n'offre que « Signaler » ; aucun identifiant de personne ne sort | non | non | `A:convex/modules/diaspora/jobs.ts` (`talentHitValidator`) |
| 80 | « Ouvert à un poste au Gabon » | Absent : le pays d'un talent ne peut pas être le Gabon | non | non | `D:packages/diasporale-domain/src/jobs.ts` (`parseTalentProfile`) |
| 81 | Profil de talent visible sur le profil du membre | Absent | non | non | `D:apps/diasporale_com/src/screens/profile-screens.tsx` (motif `talent` : aucun) |
| 82 | Garde contre l'extraction : plafond strict, aucun export, nom court, blocage respecté | Présent | oui | oui | `A:convex/modules/diaspora/jobs.ts` (`listedTalentFor`) |
| 83 | Signaler un profil de talent ; état de modération de mon profil | Présent | oui | oui | `A:convex/modules/diaspora/jobs.ts` (`readableTalentProfileOrNull`) |
| 84 | Collaborations entre professionnels (proposer, accepter, conversation) | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/professionals/collaborations.ts` |
| 85 | Agrégats des compétences par pays pour la puissance publique (F06) | Absent | non | non | motifs : `talentAggregate`, `skillsByCountry` |
| | **Transverse** | | | | |
| 86 | Deux fournisseurs à parité (moteur, démonstration aux données fictives) ; textes fr et en | Présent | oui | oui | `D:apps/diasporale_com/src/data/engine-jobs.ts`, `D:packages/diasporale-features/src/demo/jobs.ts` |
| 87 | Effacement : candidature et profil à la personne, offre à la page | Présent | — | oui | `A:convex/modules/people/dataPolicies.ts` |
| 88 | Comptes de démonstration « entreprise » (une offre) et « talent » (un profil) | Présent | oui | oui | `A:convex/modules/diaspora/demoAccounts.ts` |
| 89 | Application mobile | Absent (plan 16) | non | — | plan 15, ligne 64 |

Décompte : **Présent 45 · Partiel 1 · Absent 41 · Fermé 2** (89 lignes). Cinq « Absent » existent déjà dans le moteur (lignes 40, 43, 51, 73, 84).

### Ce que le moteur sait déjà faire et que DIASPORALE ne montre pas

| Capacité du moteur | Où | Ce que DIASPORALE en ferait |
|---|---|---|
| Pièces PDF d'une candidature : garde des fichiers, antivirus complet, jamais servies par adresse | `A:convex/modules/shops/jobFiles.ts` | Le CV, si la décision 4 l'ouvre (EM-15) ; l'usage de fichier appartient à S1 |
| Profil professionnel : présentation, 12 compétences, 6 langues, zone, réalisations, activités liées, visibilité publique consentie | `A:convex/modules/professionals/profiles.ts` | Modèle du parcours (EM-09) ; cible de la convergence (DS-16) |
| Annuaire filtré des professionnels | `A:convex/modules/professionals/read.ts` (`search`) | Les filtres de l'annuaire des talents (EM-11) |
| Étapes longues d'une candidature : reçue, en examen, entretien, proposition, retenue | `A:packages/social-domain/src/commerce-jobs.ts` | Le vocabulaire d'EM-10 |
| Offres reflétées d'employeurs passés par PRO.GA, politique par réseau | `A:convex/modules/shops/jobs.ts` | La passerelle « offres du Gabon » (EM-16), fermée par D-G01 et par le registre d'activation |

### Ce qui est écrit mais jamais recetté en réel

Les tests existent, une centaine de cas comptés par motif : 23 dans la tranche, 31 dans le domaine, 24 pour les écrans, 14 pour la démonstration, 11 pour l'adaptateur. `verify` était vert le 3/11 (plan 15). Un test n'est pas une recette.

| Parcours | État | Source |
|---|---|---|
| Offre publiée, candidature, présélection, avis dans les deux cloches | Joué à deux comptes, backend local, largeur téléphone, le 19/10 | `D:docs/recette/deux-comptes-2026-10-19/README.md` |
| Conversation d'une candidature présélectionnée | Bloquée : politique contextuelle fermée, aucun opérateur en local | même rapport |
| Non-sélection avec note, retrait, recandidature refusée ; brouillon, suspension, reprise, clôture, date limite atteinte, quota, conflit entre deux signataires | Jamais joués | — |
| Profil de talent (créer, masquer, supprimer), recherche, profil joint à une candidature | Jamais joués | — |
| Signalement d'une offre, d'un talent, d'une candidature, puis traitement au guichet | Jamais joués : le guichet n'a pas d'équipe | `D:docs/32_EXECUTION_VAGUE_H.md` |
| Compte en attente, bloqué, suspendu ; export et effacement d'une candidature | Jamais joués | — |
| Parcours complets sur ordinateur, version anglaise, onglet Emploi du hub | Jamais joués | — |
| Emploi sur le site de démonstration en ligne | Non consigné : aucun rapport ne dit l'avoir ouvert | rapports de recette de DIASPORALE |

## 3. Comparaison avec les applications de référence

| Capacité | LinkedIn | Indeed | Welcome to the Jungle | APEC | Malt | DIASPORALE | Verdict |
|---|---|---|---|---|---|---|---|
| Recherche par mots et par lieu | oui | oui | oui | oui | par compétence | texte, pays, ville saisie | Déjà fait |
| Filtres contrat et télétravail | oui | oui | oui | oui | — | oui | Déjà fait |
| Filtres secteur, niveau, date, salaire | oui | oui | oui | oui | tarif | non | À faire (EM-05, EM-06) |
| Recherche retrouvée par son adresse | oui | oui | oui | oui | oui | pays et ville seulement | À adapter (EM-05) |
| Stage, alternance, emploi étudiant | oui | oui | oui | jeunes diplômés ? | — | stage et temps partiel | À adapter (EM-06) |
| Rémunération affichée | selon l'offre | annonce ou estimation | selon l'offre | fourchette fréquente | tarif journalier | fourchette annoncée, facultative | Déjà fait |
| Offres enregistrées | oui | oui | oui | oui | — | non | À faire (DS-11, avec la brique du plan 09) |
| Alertes par critères | oui | oui | oui ? | oui | — | non | À faire (DS-11) |
| Offres proposées | oui, d'après l'activité | oui | ? | oui ? | projets proposés | non | À adapter : d'après le profil déclaré seulement (DS-11) ; activité écartée (D-G05) |
| Candidature simplifiée avec le profil | oui | oui | formulaire | oui | — | message et profil de talent | Déjà fait |
| CV joint | oui | oui | oui | oui | — | non | Reporté (EM-15, décision 4) ; parcours structuré d'abord (EM-09) |
| Questions de présélection | oui | oui | ? | ? | — | non | Reporté : après les retours du pilote |
| Suivi des étapes par le candidat | partiel | oui | oui ? | oui | — | cinq états | Déjà fait ; à étendre (EM-10) |
| Message entre recruteur et candidat | oui | oui | ? | ? | oui | conversation à la présélection, fermée | À recetter (DS-04, plan 04) |
| Nombre de candidats affiché | oui | ? | non | non | — | non | Écarté : petits nombres, même règle que le seuil du pilote |
| Page employeur avec ses offres | oui | oui | oui, riche | ? | — | non | À faire (EM-04) |
| Avis sur les employeurs | non | oui | non | non | avis après mission | non | Écarté : un avis exige une preuve (DG-016), il n'y en a pas ici |
| Employeur vérifié | vérifications | ? | pages éditoriales | comptes recruteurs ? | — | badge calculé de la page | Déjà fait |
| Signaler une offre | oui | oui | ? | oui ? | — | oui | Déjà fait ; motif « arnaque » à ajouter (plan 14, MC-06) |
| Rappel « aucun frais », conseils contre la fraude | centre d'aide ? | oui | ? | ? | — | non | À faire (EM-01) |
| Profil avec parcours et formations | oui | CV en ligne | oui ? | oui | oui | titre et compétences | À faire (EM-09) |
| « À l'écoute », visible des seuls recruteurs | oui | CV public ou privé | ? | oui | disponibilité | disponibilité déclarée, visible de tout membre | À adapter (EM-11) |
| Le recruteur contacte un candidat | oui, payant | oui, payant | ? | oui | oui | non | À adapter : proposition attachée à une offre, gratuite, plafonnée (EM-08) |
| Recommandations, validations de compétences | oui | non | non | non | oui | non | Reporté (UM-13 du moteur) ; risque de complaisance |
| Suivi des candidats par l'équipe (étapes, notes) | oui, payant | oui | ? | ? | — | trois gestes, une note de refus | À adapter (EM-10) |
| Offres sponsorisées, accès payant à la base de profils | oui | oui | présence payante | non ? | — | non | Écarté : pas de publicité au pilote (D-G04, lot D4 au plan 17) ; l'accès aux personnes ne se vend pas (dossier produit § 5.1) |
| Application mobile, notifications poussées | oui | oui | ? | oui | oui | non | Reporté (plan 16, DS-14) |
| Postes dans le pays d'origine, retour au pays | non | non | non | non | — | refusé par la règle | À faire (EM-07) |
| Reconnaissance des diplômes, premier emploi à l'étranger | non | guides | contenus | conseils | — | kit d'arrivée et mentorat, sans lien avec l'emploi | À adapter (EM-13) |
| Candidature sans photo ni critère personnel | photo usuelle | CV libre | CV libre | CV libre | photo usuelle | aucun champ de ce type | Déjà fait, à garder |
| Coordonnées protégées jusqu'à la présélection | non | non | non | non | oui | oui | Déjà fait, à garder |

## 4. Ce qui manque

### 4.1 Bloquant avant l'ouverture du pilote

1. **La boucle ne se ferme pas.** Après une présélection, tout échange passe par la conversation de la candidature. Elle est fermée sur tous les déploiements. Tant qu'un opérateur n'ouvre pas la politique, une présélection ne mène nulle part (DS-04, plan 04).
2. **Rien ne protège d'une fausse offre.** Aucune mention « on ne paie jamais pour candidater », aucun motif « arnaque » au signalement. C'est le premier risque d'un réseau de diaspora : faux recruteurs, frais de dossier, promesses de visa (EM-01 ; plan 14).
3. **Les candidatures se gardent sans limite.** Aucune durée, aucune purge. Le sort du motif de non-sélection face au droit d'accès n'est pas tranché (EM-02 ; juriste).
4. **La relecture au lancement ne peut pas s'activer.** Le cahier la demande ; le code la permet ; aucun écran ne pose la politique (MC-02 du moteur, plan 14 ; décision 1).
5. **Presque rien n'a été joué.** Un seul parcours court, en local (volet de recette au § 6).

### 4.2 Fonctions attendues qui manquent

- La page d'une entreprise ne montre pas ses offres (EM-04).
- Aucun poste au Gabon, aucun recruteur du Gabon : le persona P5 et le « retour au pays » sont impossibles (EM-07, EM-16).
- L'annuaire des talents est une impasse : on trouve une personne, on ne peut rien lui proposer (EM-08).
- Le profil de talent n'a ni expériences ni formations ; la candidature n'a pas de CV (EM-09, EM-15).
- Ni offres enregistrées ni alertes (DS-11).
- Une offre sans date limite ne se ferme jamais (EM-03).
- Pas d'entretien, pas d'embauche, pas d'offre « pourvue » : on ne sait pas si un recrutement a abouti (EM-10).

### 4.3 Options qui manquent sur ce qui existe

| Écran | Option absente |
|---|---|
| Recherche `/emploi` | Texte, contrat et mode absents de l'adresse ; aucun filtre par langue, secteur, ancienneté ; pas de tri ; pas de rappel des filtres actifs ; la carte ne dit pas quand l'offre a été publiée |
| Formulaire d'offre | Secteur, niveau, alternance, emploi saisonnier, date de prise de poste, temps de travail ; dupliquer |
| Fiche d'une offre | Enregistrer, partager, « autres offres de cette page », rappel « aucun frais » |
| Feuille de candidature | Le message est perdu si la feuille se ferme (`D:apps/diasporale_com/src/components/job-apply-entry.tsx`, la feuille se démonte) ; aucune pièce |
| « Mes candidatures » | Aucun filtre par état ; pas de recandidature après un retrait ; aucun avis quand l'offre se clôt |
| Espace recruteur | Aucun compteur de candidatures ; « Vue » est un geste à part, pas l'effet de l'ouverture ; aucune note d'équipe ; pas de prolongation d'une offre |
| Talents | Pays unique et obligatoire ; aucun filtre par disponibilité, langue ou ville ; pas de fiche ; pas de ville dans le profil |

### 4.4 Améliorations de l'existant

- **Filtres après pagination.** Le contrat et le mode sont jugés après la lecture de la page : une page peut revenir courte ou vide tout en annonçant une suite (`A:convex/modules/diaspora/jobs.ts`, `searchJobOffers`). Les ajouter aux champs filtrables de l'index (EM-05).
- **Qui publie.** Toute page active publie, quel que soit son badge. Au pilote, compenser par la relecture préalable (décision 1).
- **Lien de l'avis.** L'avis « candidature reçue » mène à la gestion de la page ; vérifier en recette qu'il ouvre bien la bonne offre.
- **Textes.** « l'équipe de {{page}} » : même défaut d'élision que celui relevé le 19/10 (plan 02, DS-03).

### 4.5 Ce qui distingue DIASPORALE

- **Une candidature sans coordonnées ni critères personnels** : ni téléphone, ni e-mail, ni âge, ni photo avant la présélection. Aucune référence ne va si loin.
- **L'employeur est une page au badge calculé**, et l'écran dit que le badge ne garantit pas l'offre.
- **Des talents sous nom court**, par pays, douze par page, sans export : un annuaire qui ne s'aspire pas.
- **Des consentements horodatés** : nom transmis, profil joint.
- **Le lingala et le fang** parmi les langues de travail.
- **À construire** : le retour au pays (EM-07), la proposition sans coordonnée (EM-08), les passerelles vers le mentorat et le kit d'arrivée (EM-13).

### 4.6 Écarté ou reporté, et pourquoi

| Sujet | Décision | Raison |
|---|---|---|
| Offres sponsorisées, packs recruteur | Écarté au pilote | D-G04 ; lot D4 (plan 17) |
| Accès payant à l'annuaire des talents | Écarté | Dossier produit § 5.1 : l'accès aux personnes ne se vend pas |
| Offres proposées d'après le comportement | Écarté | D-G05 |
| Avis sur les employeurs | Écarté | Aucun engagement prouvé à noter (DG-016) ; risque de diffamation |
| Nombre de candidats montré aux candidats | Écarté | Petits nombres ; rien plutôt qu'un chiffre qui trompe |
| Offre publiée par une personne sans page | Écarté | Règle du domaine : une page porte l'offre et ses signataires en répondent |
| Écrire à l'équipe avant la présélection | Écarté | Contrat de conversation, premier mot au répondant |
| Offres lisibles sans compte | Écarté | Réseau fermé ; la vitrine ne montre aucune offre |
| Recommandations, questions de présélection, entretien planifié | Reporté | Lot UM-13 du moteur pour les premières ; les autres après les retours du pilote |

## 5. Lots d'implémentation

Zone d'écriture : dépôt DIASPORALE ; dans ANTSIA, `convex/modules/diaspora/` seulement. Une table nouvelle se déclare dans `A:convex/modules/diaspora/jobsTables.ts`, que le schéma agrège déjà. Restent à S1, donc en issue `[S1]` : seaux de débit (`A:convex/lib/rateLimit.ts`), passages planifiés (`A:convex/crons.ts`), genres d'avis (`A:convex/modules/notifications/tables.ts`), export et effacement (`A:convex/modules/people/dataPolicies.ts`), natures de signalement.

### EM-01 — Fiche et candidature protégées contre les fausses offres · P0 · S · S2
- **Pour l'utilisateur** : sur chaque offre et au moment de candidater, il lit qu'on ne paie jamais pour candidater, et comment signaler une fausse offre.
- **Backend** : aucun. Le motif « arnaque, frais demandés » vient du moteur (MC-06, relayé par le plan 14) ; d'ici là, « Autre » avec une note.
- **Web** : encart sur la fiche (`jobs-screens.tsx`) et dans la feuille (`job-apply-entry.tsx`) ; rappel dans le formulaire du recruteur ; lien vers la ressource « Reconnaître une fausse offre » du kit d'arrivée si elle existe (plan 11) ; fragments fr et en de `jobs.json`.
- **Mobile** : même texte quand l'emploi sera porté (plan 16).
- **Données personnelles** : aucune.
- **Tests et cliquets** : rendu des deux encarts ; `i18n-keys` ; `public-communication` (aucune phrase ne dit que DIASPORALE vérifie les offres).
- **Critères d'acceptation** : la mention se lit sans défiler dans la feuille à 390 px ; « Signaler » est à côté ; aucun bouton plein ajouté.
- **Dépend de** : rien ; le motif dédié attend le plan 14.
- **Porte** : relecture du texte par le propriétaire.

### EM-02 — Conservation des candidatures : durées décidées et purge · P0 · S · S2
- **Pour l'utilisateur** : une candidature close ne reste pas indéfiniment chez un recruteur ; la règle est écrite dans la politique de confidentialité.
- **Backend** : durée dans `@diasporale/domain`, à `null` tant que le juriste n'a pas répondu (aucune purge, comme `COMMERCE_JOBS_RETENTION` du moteur) ; passage borné de purge dans la tranche (non retenue, retirée, offre close depuis la durée) ; index par état et date. Issue `[S1]` : ligne de cron ; sort de la note de refus dans l'export.
- **Web** : une phrase dans « Mes candidatures » et dans l'espace recruteur, seulement quand la durée existe.
- **Mobile** : sans objet.
- **Données personnelles** : c'est l'objet du lot ; la conversation liée et les avis suivent la purge (plan 04).
- **Tests et cliquets** : `no-unbounded-collect`, `crons-contract` ; une candidature en cours n'est jamais purgée.
- **Critères d'acceptation** : après la durée, la ligne et sa conversation ont disparu des deux côtés ; un export fait avant reste complet ; aucune durée inventée dans le code.
- **Dépend de** : DS-07 (textes légaux, plan 17) ; plan 14.
- **Porte** : juriste (durées, note de refus et droit d'accès).

### EM-03 — Durée de vie d'une offre et relance de l'équipe · P1 · S · S2
- **Pour l'utilisateur** : aucune offre ouverte n'est une offre oubliée ; l'équipe est prévenue avant la clôture et prolonge d'un geste.
- **Backend** : date limite par défaut à la publication quand aucune n'est saisie (durée de la décision 7) ; geste de prolongation sous version, dans l'horizon de six mois ; les offres déjà ouvertes sans date en reçoivent une, par lots bornés. Issue `[S1]` : genre d'avis « une offre de votre page se clôt bientôt ».
- **Web** : date préremplie et modifiable dans `job-offer-form.tsx` ; « Prolonger » dans `job-recruiter-panel.tsx` ; date de publication sur la carte.
- **Mobile** : avis poussé avec DS-14.
- **Données personnelles** : aucune.
- **Tests et cliquets** : domaine (date par défaut, horizon) ; moteur (prolongation, offre close refusée) ; `crons-contract`.
- **Critères d'acceptation** : plus aucune offre ouverte sans date limite ; deux prolongations ne dépassent pas six mois.
- **Dépend de** : décision 7.
- **Porte** : décision 7.

### EM-04 — Rubrique « Emplois » sur la fiche d'une page · P1 · S · S2
- **Pour l'utilisateur** : sur la page d'une entreprise ou d'une association, il voit ses offres ouvertes ; depuis une offre, les autres offres de la page.
- **Backend** : lecture paginée des offres ouvertes d'une page lisible, servies par la modération, même projection que la recherche (`jobs.ts`).
- **Web** : composant de section, monté par la fiche de page seulement s'il y a une offre ouverte ; `jobs-port.ts` et fournisseur de démonstration ; lien « Voir les offres de cette page » sur la fiche d'offre. `page-screen.tsx` appartient au plan 07 : montage à coordonner.
- **Mobile** : plan 16.
- **Données personnelles** : aucune.
- **Tests et cliquets** : page sans offre, pas de section ; offre suspendue ou en relecture absente ; `network-scoped-functions`.
- **Critères d'acceptation** : aucune rubrique vide ; une page illisible pour le lecteur ne montre rien.
- **Dépend de** : plan 07 (rubriques d'une page).
- **Porte** : aucune.

### EM-05 — Recherche d'offres : filtres dans l'adresse, langue, ancienneté · P1 · M · S2
- **Pour l'utilisateur** : une recherche se partage et se retrouve ; il filtre aussi par langue de travail et par ancienneté.
- **Backend** : `parseJobSearch` étendu (langue, « publiées depuis ») ; contrat et mode ajoutés aux champs filtrables de l'index de recherche.
- **Web** : `routes.jobs` porte tous les filtres, comme `routes.services` ; rappel des filtres actifs ; date de publication sur la carte.
- **Mobile** : plan 16.
- **Données personnelles** : aucune ; aucune recherche n'est gardée.
- **Tests et cliquets** : domaine ; moteur (page pleine sous filtre de contrat) ; `no-hardcoded-urls`.
- **Critères d'acceptation** : l'adresse copiée rend la même recherche à un autre membre ; le retour arrière garde les filtres.
- **Dépend de** : EM-06 pour le filtre par secteur.
- **Porte** : aucune.

### EM-06 — Offre plus précise : secteur, niveau, alternance, prise de poste · P1 · M · S2
- **Pour l'utilisateur** : il sait pour qui est l'offre (débutant accepté, stage, alternance), dans quel secteur, pour quand.
- **Backend** : champs facultatifs dans `jobsTables.ts` et `parseJobOffer` : secteur (liste fermée, décision 8), niveau (débutant accepté, confirmé, expérimenté), mois de prise de poste ; contrats ajoutés (alternance, saisonnier). Jamais d'âge.
- **Web** : formulaire, carte, fiche, filtres ; famille `job.contract.*` ; la liste des cartes suit celle du domaine (test d'égalité existant).
- **Mobile** : plan 16.
- **Données personnelles** : aucune.
- **Tests et cliquets** : domaine ; `i18n-families` ; une offre ancienne sans ces champs se lit encore.
- **Critères d'acceptation** : « stage ou alternance » trouve les deux ; le niveau ne s'exprime jamais en années d'âge.
- **Dépend de** : décision 8.
- **Porte** : décision 8 (listes).

### EM-07 — Postes au Gabon : le « retour au pays » · P1 · M · S2
- **Pour l'utilisateur** : une page du réseau publie un poste basé au Gabon ; un membre filtre « Au Gabon ».
- **Backend** : `parseJobCountry` admet le Gabon pour le lieu d'une offre seulement (la résidence d'un membre et le pays d'un talent restent hors Gabon) ; le dossier de modération d'une telle offre suit le pays de la page (`moderationTargets.ts`).
- **Web** : « Gabon » dans le formulaire et la recherche ; repère « Au Gabon » sur la carte ; lien « Postes au Gabon » dans l'onglet Emploi du hub.
- **Mobile** : plan 16.
- **Données personnelles** : aucune.
- **Tests et cliquets** : domaine (offre au Gabon admise, talent et résidence au Gabon refusés) ; guichet du pays de la page ; `network-scoped-functions`.
- **Critères d'acceptation** : un poste à Libreville publié par la page d'une entreprise de la diaspora se trouve par « Au Gabon » ; le hub France ne le compte pas parmi les offres de France.
- **Dépend de** : décision 2 ; plan 06 (le Gabon n'est pas un hub) ; plan 14 (guichet).
- **Porte** : décision 2 : le code refuse aujourd'hui le Gabon exprès.

### EM-08 — Proposer une offre à un talent · P1 · L · S2
- **Pour l'utilisateur** : une page qui recrute propose une de ses offres ouvertes à un talent ; le talent, qui a choisi de recevoir des propositions, répond « Voir l'offre et candidater » ou « Non merci ». Aucune coordonnée ne circule.
- **Backend** : table des propositions (offre, page, talent ; envoyée, acceptée, déclinée, expirée ; une par offre et par talent) ; envoi réservé au signataire vivant d'une page qui a une offre ouverte, vers un talent listé et consentant, sans blocage, avec clé d'idempotence ; champ « reçoit des propositions » sur le profil de talent, choix explicite ; expiration. Issue `[S1]` : seau de débit par personne et par page, deux genres d'avis neutres, export et effacement, nature de signalement.
- **Web** : « Proposer une offre » sur la carte d'un talent, visible des seuls signataires concernés ; choix de l'offre ; « Propositions reçues » dans « Mes candidatures » ; accepter ouvre la feuille de candidature.
- **Mobile** : avis poussé (DS-14).
- **Données personnelles** : proposition exportée aux deux parties ; le talent coupe les propositions quand il veut ; rien de la personne n'est montré avant sa candidature.
- **Tests et cliquets** : refus sans offre ouverte, sans consentement, sous blocage, au-delà du plafond ; double envoi ; `notification-payload-content` ; `rate-limited-writes`.
- **Critères d'acceptation** : à deux comptes, « entreprise » propose à « talent », qui accepte et candidate ; un talent qui n'a pas consenti n'affiche pas le bouton ; décliner ne montre à la page que l'état.
- **Dépend de** : plan 13 (cloche).
- **Porte** : décision 6.

### EM-09 — Parcours dans le profil de talent : expériences et formations · P1 · M · S2
- **Pour l'utilisateur** : il décrit ses postes et ses diplômes une fois ; l'équipe qui reçoit sa candidature les lit, sans CV ni coordonnée.
- **Backend** : champs bornés sur `talentProfiles` : expériences (intitulé, structure en texte, années) et formations (diplôme, établissement, année, pays d'obtention) ; règles pures dans le domaine, écrites pour être extraites (D-G01) ; texte relu par la modération ; jamais de date de naissance.
- **Web** : éditeur dans `job-talent-profile.tsx` ; parcours montré dans la candidature reçue, avec la mention « déclaré par la personne ».
- **Mobile** : plan 16.
- **Données personnelles** : export et effacement avec le profil ; relu vivant, jamais copié dans la candidature.
- **Tests et cliquets** : domaine ; coordonnée refusée ; profil supprimé, parcours disparu des candidatures.
- **Critères d'acceptation** : un parcours de trois lignes se lit dans la candidature ; aucune entreprise ni aucun diplôme n'est dit « vérifié ».
- **Dépend de** : décision 5 ; le lot UM-13 du moteur fera la même chose sur son profil professionnel (voir DS-16).
- **Porte** : décision 5.

### EM-10 — Suivi de recrutement et espace recruteur · P2 · M · S2
- **Pour l'utilisateur** : le candidat sait s'il est convoqué, puis retenu ; l'offre dit « pourvue » ; l'équipe voit d'un coup d'œil ses candidatures.
- **Backend** : états « entretien » et « retenue » ; clôture « pourvue » ; message facultatif de la page montré au candidat, distinct de la note d'équipe ; avis aux candidats en cours quand l'offre se clôt ; recandidature après retrait si l'offre est ouverte ; compteurs par état (`contentCounters.ts`) ; « Vue » à l'ouverture ; dupliquer en brouillon.
- **Web** : espace recruteur, « Mes candidatures », filtre par état.
- **Mobile** : plan 16.
- **Données personnelles** : la note d'équipe reste hors de l'export du candidat tant que le juriste ne dit pas autre chose.
- **Tests et cliquets** : transitions du domaine ; `contextual-hooks` (la conversation reste ouverte jusqu'à une issue).
- **Critères d'acceptation** : aucune transition en arrière ; une offre pourvue quitte la recherche.
- **Dépend de** : DS-05 ; retours du pilote.
- **Porte** : décision 9 (rouvrir le choix du 19/10 : pas d'état de fin en V1).

### DS-11 (volet alertes emploi) — Retrouver : offres enregistrées et alertes emploi · P2 · M · S2 · repris du plan 15
- **Pour l'utilisateur** : il garde une offre ; il est prévenu, une fois par jour au plus, quand une offre répond à ses critères.
- **Backend** : « Enregistrer » branche la brique des favoris du plan 09 sur l'offre ; table des alertes (mots, pays, ville, contrat, mode, secteur ; nombre borné) ; passage quotidien borné ; avis neutre sans titre d'offre. « Offres proches de mon profil » est une alerte préremplie depuis le profil de talent, jamais un calcul sur l'activité. Issue `[S1]` : cron, genre d'avis, seau, export.
- **Web** : bouton `outline` sur la carte et la fiche ; onglet « Enregistrées » et réglage des alertes dans `/emploi` ; « Créer une alerte avec ces filtres » depuis la recherche.
- **Mobile** : avis poussé (DS-14).
- **Données personnelles** : export et effacement ; une alerte n'est jamais montrée à une page.
- **Tests et cliquets** : `no-unbounded-collect`, `notification-payload-content`, `crons-contract`.
- **Critères d'acceptation** : aucune alerte ne cite une offre close ; aucun avis s'il n'y a rien de neuf ; une offre close quitte les enregistrées.
- **Dépend de** : plan 09 (favoris) ; EM-05 ; plan 13 ; même sobriété que le lot UM-05 du moteur.
- **Porte** : aucune.

### EM-11 — Talents : ville, contrat recherché, visibilité choisie, fiche · P2 · M · S2
- **Pour l'utilisateur** : il précise sa ville et ce qu'il cherche ; il peut n'être visible que des pages au badge « Vérifié » ou « Officiel » ; un recruteur ouvre une fiche lisible.
- **Backend** : champs facultatifs (ville, contrats recherchés, « ouvert à un poste au Gabon ») ; troisième visibilité, jugée sur le rôle vivant du lecteur dans une page vérifiée ; filtres par disponibilité, langue, ville.
- **Web** : éditeur, recherche, fiche d'un talent (toujours sous nom court).
- **Mobile** : plan 16.
- **Données personnelles** : export ; aucun champ sensible.
- **Tests et cliquets** : un membre sans page vérifiée ne trouve pas un profil restreint ; plafond de page inchangé.
- **Critères d'acceptation** : la visibilité restreinte se vérifie à deux comptes ; aucune liste ne s'exporte.
- **Dépend de** : EM-07 pour « poste au Gabon » ; plan 07 (badge des pages).
- **Porte** : aucune.

### EM-12 — Faire connaître une offre : iCom et fil de la page · P2 · M · S2
- **Pour l'utilisateur** : il envoie une offre à une relation ; la page annonce son offre dans son fil.
- **Backend** : aucun dans la tranche si le moteur fournit la référence d'objet dans un message (IC-18) et la carte d'objet dans une publication. Issue `[S1]` : nature « offre d'emploi DIASPORALE » dans ces deux briques.
- **Web** : « Partager » sur la fiche (lien à copier tout de suite ; iCom et fil quand les briques existent).
- **Mobile** : plan 16.
- **Données personnelles** : aucune ; la carte relit l'offre et ses droits à chaque affichage.
- **Tests et cliquets** : une offre close s'affiche close dans le message ; `network-scoped-functions`.
- **Critères d'acceptation** : aucune offre n'est lisible hors du réseau par ce chemin.
- **Dépend de** : IC-18 (plan 01 du moteur), plans 03 et 04.
- **Porte** : aucune.

### EM-13 — Premier emploi à l'étranger : passerelles vers le mentorat et le kit · P2 · S · S2
- **Pour l'utilisateur** : depuis l'emploi, il trouve un mentor « travail » et les ressources « emploi » de son pays (CV local, reconnaissance des diplômes, droit au travail des étudiants).
- **Backend** : aucun ; le domaine « travail » du mentorat et la catégorie « emploi » du kit existent (`D:packages/diasporale-domain/src/mentoring.ts`, `D:packages/diasporale-domain/src/arrival-kit.ts`).
- **Web** : deux liens dans `/emploi` et sur la fiche, vers les rubriques filtrées ; les contenus du kit relèvent du plan 11.
- **Mobile** : plan 16.
- **Données personnelles** : aucune.
- **Tests et cliquets** : `no-hardcoded-urls` ; liens absents si la rubrique n'est pas servie.
- **Critères d'acceptation** : aucun lien vers une rubrique vide.
- **Dépend de** : plan 11.
- **Porte** : aucune.

### EM-14 — Indicateurs emploi du pilote · P2 · S · S2
- **Pour l'utilisateur** : le responsable du réseau sait si l'emploi sert : offres ouvertes, candidatures, part lue, part présélectionnée, délai de première lecture.
- **Backend** : groupe « emploi » dans `pilot-metrics.ts` et `pilotMetrics.ts`, mêmes règles : agrégats nocturnes, seuil « moins de 5 », dénominateur visible.
- **Web** : tableau `/pilote` (plan 17).
- **Mobile** : sans objet.
- **Données personnelles** : agrégats seulement.
- **Tests et cliquets** : sous le seuil, aucun nombre.
- **Critères d'acceptation** : chaque taux montre sa base ; aucun chiffre par page ni par personne.
- **Dépend de** : plan 17.
- **Porte** : aucune.

### DS-16 (volet emploi) — Remontée dans le moteur des fonctions communes · P2 · L · S1 (plan 09) avec S2 · repris du plan 15
- **Pour l'utilisateur** : un seul emploi et un seul profil professionnel dans le programme, sans double code.
- **Contenu** : rapprocher `diaspora/jobs.ts` des candidatures du moteur et le profil de talent du profil professionnel du moteur ; garder ce que DIASPORALE a de plus (nom court, aucune coordonnée, aucun critère personnel).
- **Dépend de** : plan 09 du moteur (UM-02, UM-13) ; pilote terminé.
- **Porte** : décision 6 du plan 15.

### EM-15 — CV en pièce jointe dès la candidature · P3 · M · S2
- **Pour l'utilisateur** : il joint un PDF à sa candidature.
- **Contenu** : usage de fichier gardé (antivirus complet, jamais servi par adresse), lu par l'équipe vivante seule. Un CV porte des coordonnées : c'est une exception à la règle actuelle. Aujourd'hui, une pièce ne passe que dans la conversation, après la présélection.
- **Dépend de** : EM-09 ; issue `[S1]` (usage de fichier).
- **Porte** : décision 4.

### EM-16 — Offres du Gabon lues sur ANTSIA · P3 · M · S1 puis S2
- **Pour l'utilisateur** : il voit, depuis DIASPORALE, les offres d'employeurs installés au Gabon publiées sur le réseau public.
- **Contenu** : d'abord un simple lien vers l'espace emploi d'ANTSIA (lot SU08 du moteur) ; plus tard, une lecture des offres du réseau racine par l'adhésion dérivée. Rien n'est copié dans DIASPORALE.
- **Dépend de** : UM-02, UM-04, SU08 du moteur ; un vrai catalogue PRO.GA.
- **Porte** : décision 3 ; D-G01 (« aucun lien PRO.GA ») à préciser.

### EM-17 — Concours et recrutements officiels · P3 · S · S2
- **Pour l'utilisateur** : il lit les avis de recrutement des postes consulaires et de l'État.
- **Contenu** : rubrique alimentée par les pages « Officiel » seulement ; aucune offre officielle sans source signée.
- **Dépend de** : plan 15 (DG-009b) ; UM-18 du moteur.
- **Porte** : contrat avec gabon-diplomatie.

### EM-18 — Agrégats des compétences de la diaspora · P3 · M · S2
- **Pour l'utilisateur** : une institution lit combien de talents déclarés existent par pays et par domaine, sans aucun nom.
- **Contenu** : agrégats nocturnes des profils listés, seuil d'affichage, lecture réservée ; les talents en sont informés dans le texte de l'opt-in.
- **Dépend de** : EM-11, EM-14 ; plan 15.
- **Porte** : décision 10 ; juriste.

## 6. Ordre recommandé et dépendances

| Vague | Lots | Pourquoi dans cet ordre |
|---|---|---|
| 1 | EM-01, volet de recette ci-dessous | Protéger et prouver avant d'ajouter ; rien n'attend personne |
| 2 | EM-02, EM-03, EM-04 | Le droit et la fraîcheur des offres ; la page employeur est petite et visible |
| 3 | EM-07, EM-05, EM-06 | Le retour au pays dès que la décision 2 est prise ; puis une recherche et des offres plus précises |
| 4 | EM-08, EM-09 | L'annuaire des talents cesse d'être une impasse |
| 5 | DS-11, EM-10, EM-11, EM-13, EM-14, EM-12 | Enrichissements, après les premiers retours |
| Sous condition | DS-16, EM-15, EM-16, EM-17, EM-18 | Décisions, moteur, contrats |

**Ce que ce plan attend des autres plans** : plan 04 et DS-04 (ouvrir la conversation de candidature : sans elle, rien n'aboutit) ; plan 14 (motif « arnaque », relecture préalable par la politique du réseau, guichet d'une offre au Gabon) ; plan 09 (brique « Enregistrer ») ; plan 07 (rubriques et badge d'une page) ; plan 13 (cloche, avis poussés) ; plan 11 (kit et mentorat) ; plan 17 (tableau du pilote, textes légaux) ; plan 15 (pages « Officiel ») ; plan 02 (textes, élisions).

**Volet de recette en mode moteur (campagne DS-05).** Comptes de démonstration par acteur (docs/34 de DIASPORALE) : « entreprise » (page et offre), « talent », « declare », « verifie », « leger », « moderateur », « bloque », « suspendu ».

| Étape | Résultat attendu |
|---|---|
| « entreprise » crée un brouillon, l'ouvre, le suspend, le reprend | La recherche ne montre l'offre qu'ouverte |
| « declare » candidate : sans consentement, puis avec, puis double clic | Refus expliqué, puis une seule candidature ; la fiche dit « déjà candidat » |
| « leger » ouvre l'offre | Lecture ; « Candidater » inactif, avec l'explication |
| « entreprise » marque vue, présélectionne « declare », ne retient pas « verifie » avec une note | Deux avis neutres ; « verifie » lit « Non retenue », jamais la note ; son export ne la contient pas |
| « declare » ouvre la conversation, puis retire sa candidature | Conversation selon la politique (DS-04) ; l'équipe ne voit plus que l'état ; recandidater est refusé |
| Deux signataires modifient la même offre | Le second reçoit le conflit et recharge |
| Offre à date limite proche | Close à l'heure dite ; le passage horaire écrit la clôture |
| « talent » : profil cherché par compétence, masqué, supprimé | Trouvé sous nom court ; introuvable ; retiré de la candidature où il était joint |
| « declare » signale une offre ; « moderateur » tranche | Offre masquée pour lui ; dossier au guichet du pays de l'offre ; avis à la page |
| « suspendu », « bloque » | Aucune lecture ; le talent qui a bloqué reste introuvable |

## 7. Décisions à prendre par le propriétaire

1. **Relecture des offres au pilote.** Recommandation : toutes les offres en relecture préalable pendant le pilote, puis publication directe pays par pays. Raison : le cahier le demande, et toute page publie aujourd'hui quel que soit son badge.
2. **Postes au Gabon.** Recommandation : oui (EM-07). Raison : c'est la moitié du persona P5 et le « retour au pays » ; le code le refuse exprès.
3. **Recruteurs installés au Gabon.** Recommandation : d'abord par une page du réseau tenue par un membre de la diaspora (possible avec EM-07) ; plus tard par ANTSIA (EM-16) ; ne pas ouvrir l'adhésion à des résidents du Gabon. Raison : le réseau est réservé aux Gabonais de l'étranger.
4. **CV.** Recommandation : pas de CV à la candidature au pilote ; un parcours structuré (EM-09), et le PDF dans la conversation après la présélection. Raison : un CV livre des coordonnées à un inconnu ; c'est ce que la règle actuelle évite.
5. **Un seul profil professionnel.** Recommandation : enrichir le profil de talent au pilote, converger avec celui du moteur après (DS-16). Raison : il est branché, modéré et servi par la démonstration.
6. **Proposition à un talent.** Recommandation : oui, attachée à une offre ouverte, sur accord du talent, avec un plafond par page à fixer comme valeur de départ (D-G15). Raison : sans cela l'annuaire ne sert à rien.
7. **Durée de vie d'une offre sans date.** Recommandation : 60 jours, renouvelables. Raison : le dossier produit prévoyait 30 ou 60 jours (F07).
8. **Listes des contrats et des secteurs.** Recommandation : ajouter alternance et saisonnier ; une liste de secteurs propre à l'emploi, plus large que les huit secteurs des pages. Raison : stages et alternances sont le premier emploi de la diaspora étudiante.
9. **États de fin.** Recommandation : ajouter « entretien », « retenue » et « pourvue » après le pilote. Raison : sans eux on ne mesure aucun recrutement abouti.
10. **Questions au juriste.** Durée de conservation d'une candidature (l'usage français serait de deux ans au plus après le dernier contact : à confirmer ?) ; note de refus et droit d'accès ; mentions qu'une offre doit porter selon le pays ; agrégats des compétences (EM-18).

## 8. Risques et points d'attention

- **Faux recruteurs** : premier risque. EM-01 et la relecture préalable passent avant toute promotion de l'emploi.
- **Une rubrique vide** : aucun chiffre inventé, aucune offre fictive hors de la démonstration ; recruter des pages avant d'annoncer l'emploi (plan 17).
- **Deux emplois dans le programme** : la tranche de DIASPORALE et l'emploi reflété d'ANTSIA divergent déjà (états, pièces, profil). Tout champ nouveau s'écrit en règle pure extractible.
- **Fichiers de S1** : seaux, crons, genres d'avis, export. Chaque lot qui ajoute une table ouvre son issue `[S1]` avant de coder.
- **Extraction des talents** : toute nouveauté (fiche, filtres, proposition) garde le nom court, le plafond et l'absence d'identifiant.
- **Discrimination** : aucun champ d'âge, de sexe, d'origine, de situation familiale, de photo ; le niveau ne se dit jamais en âge.
- **Offre au Gabon** : le Gabon n'a ni hub ni équipe de modération ; la règle de guichet doit être écrite avant EM-07.
- **Droit du travail par pays** : une offre obéit au droit du lieu du poste ; rien n'est dit « conforme ».
- **Démonstration partagée** : ce qu'un visiteur publie est vu des suivants (ADR-0038).

## 9. Prompts d'implémentation

### Prompt EM-01
```text
Tu es la session S2 (DIASPORALE). Écris-moi en français. Opus pour tout le code, aucun sous-agent Sonnet.
Lis : CLAUDE.md ; docs/etudes/2026-11-10-finalisation/10_EMPLOI_TALENTS.md (§ 1, § 2, lot EM-01) ; packages/diasporale-features/src/i18n/locales/fr/jobs.json ; apps/diasporale_com/src/screens/jobs-screens.tsx ; apps/diasporale_com/src/components/job-apply-entry.tsx et job-offer-form.tsx.
Vérifie d'abord que la mention manque toujours (cherche « frais », « argent », « payer » dans jobs.json).
Branche claude/emploi-fausses-offres depuis origin/main. Périmètre : ces trois écrans, les fragments fr et en de jobs.json, leurs tests.
Fais : un encart « On ne paie jamais pour candidater » sur la fiche et dans la feuille de candidature, avec « Signaler » à côté ; un rappel dans le formulaire du recruteur. Aucune phrase ne dit que DIASPORALE vérifie les offres. Aucun bouton plein ajouté.
Vérifie : bun run --cwd ../ANTSIA verify (avec le verrou) ; recette à 390 et 1280 px, clair et sombre, Sable et Gaboma, comptes « entreprise » et « declare ».
Soumets-moi le texte avant de fusionner. Arrête-toi avant toute publication.
```

### Prompt EM-04
```text
Session S2. Lis le lot EM-04 du plan 10, ANTSIA/convex/modules/diaspora/jobs.ts (searchJobOffers, pageJobOffers, readableJobOfferOrNull), apps/diasporale_com/src/screens/page-screen.tsx, apps/diasporale_com/src/components/page-services-section.tsx (modèle de section), packages/diasporale-features/src/data/jobs-port.ts et demo/jobs.ts.
Branche claude/emplois-sur-la-page. Périmètre : jobs.ts de la tranche, jobs-port.ts, engine-jobs.ts, demo/jobs.ts, un composant de section, son montage dans la fiche de page (préviens la session qui tient les pages), fragments de textes.
Fais : une lecture paginée des offres OUVERTES d'une page lisible, servies par la modération ; la section ne se monte que s'il y a une offre ; un lien « Voir les offres de cette page » sur la fiche d'offre.
Tests : page sans offre, offre suspendue, offre en relecture, lecteur d'un autre réseau.
Vérifie : verify ; recette avec « entreprise » (publie) et « declare » (lit). Arrête-toi avant toute publication.
```

### Prompt EM-07
```text
Session S2. N'exécute ce lot qu'après la décision 2 du plan 10 (postes au Gabon).
Lis : packages/diasporale-domain/src/jobs.ts (parseJobCountry, parseTalentProfile), countries.ts, ANTSIA/convex/modules/diaspora/jobs.ts, moderationTargets.ts (pays au guichet), job-offer-form.tsx, jobs-screens.tsx, job-hub-tab.tsx.
Branche claude/emploi-postes-au-gabon. Périmètre : domaine jobs, tranche jobs et moderationTargets, écrans d'emploi, fragments fr et en.
Fais : le lieu d'une OFFRE peut être le Gabon ; la résidence d'un membre et le pays d'un talent restent hors Gabon ; le dossier de modération d'une offre au Gabon suit le pays de la page ; filtre et repère « Au Gabon ».
Tests : domaine (trois cas), moteur (guichet), écran (filtre). Le hub d'un pays ne compte pas ces offres comme les siennes.
Vérifie : verify ; recette à deux comptes. Si une règle hors de la tranche bloque, ouvre une issue [S1] et arrête-toi.
```

### Prompt EM-08
```text
Session S2. N'exécute ce lot qu'après la décision 6 du plan 10.
Lis : le lot EM-08, ANTSIA/convex/modules/diaspora/jobs.ts (searchTalents, listedTalentFor, applyToJobOffer), jobsTables.ts, mentoring.ts de la tranche (modèle d'une demande consentie qui expire), communityNotifications.ts, apps/diasporale_com/src/components/job-parts.tsx (TalentHitCard) et job-talent-profile.tsx.
Avant de coder, ouvre l'issue [S1] : un seau de débit, deux genres d'avis neutres, la politique d'export et d'effacement, la nature de signalement. Attends sa réponse.
Branche claude/emploi-proposer-une-offre. Fais : la table des propositions dans jobsTables.ts ; l'envoi (signataire vivant, offre ouverte, talent listé qui accepte les propositions, aucun blocage, clé d'idempotence) ; la réponse ; l'expiration ; le choix « recevoir des propositions » dans le profil ; le bouton sur la carte ; « Propositions reçues » dans « Mes candidatures » ; le fournisseur de démonstration ; les textes fr et en.
Aucun identifiant de personne ni aucune coordonnée ne sort. Décliner ne montre à la page que l'état.
Vérifie : verify ; recette « entreprise » propose, « talent » accepte et candidate. Arrête-toi avant toute publication.
```

## 10. Sources lues

- Contexte hérité : cahier des charges, plan global, registre des décisions (docs/00, 14, 17 de DIASPORALE), plan 15, plan directeur et registre des lots d'ANTSIA.
- Plan du moteur : `A:docs/etudes/2026-11-09-finalisation/09_UNIVERS_SERVICES_EMPLOI_RESTAURATION.md` (§ 2 emploi et réseau professionnel, lots UM-02 à UM-05, SU08, UM-10, UM-11, UM-13, UM-16, UM-18) ; `A:docs/adr/0024-emploi-consenti-et-candidatures-privees.md` ; `A:docs/contrats/PRO-COMMERCE-JOBS-V1.md` (§ 1 à 3).
- DIASPORALE : `D:docs/32_EXECUTION_VAGUE_H.md` (§ 1, 4 à 7, 12) ; `D:docs/recette/deux-comptes-2026-10-19/README.md` ; `D:docs/34_COMPTES_DE_DEMONSTRATION.md` (acteurs).
- Dossier produit d'origine : fiches F06 et F07, § 5 (monétisation).
- Code DIASPORALE : `D:packages/diasporale-domain/src/jobs.ts` (en entier), `D:packages/diasporale-domain/src/conversation-contexts.ts`, `D:packages/diasporale-domain/src/eligibility.ts`, `D:packages/diasporale-domain/src/pilot-metrics.ts` ; `D:packages/diasporale-features/src/data/jobs-port.ts` ; `D:packages/diasporale-features/src/demo/jobs.ts` (repères) ; écrans et composants `job-*` ; `D:apps/diasporale_com/src/data/engine-jobs.ts` ; fragment `jobs.json`.
- Code ANTSIA : `A:convex/modules/diaspora/jobs.ts` et `A:convex/modules/diaspora/jobsTables.ts` (en entier) ; avis, modération, conversation et comptes de démonstration de la tranche (repères) ; `A:convex/modules/people/dataInventory.ts` ; `A:convex/lib/rateLimit.ts` ; `A:convex/modules/shops/` et `A:convex/modules/professionals/` (en-têtes et listes de fonctions).
- Non lu : le dépôt PRO.GA ; les tests un par un ; le site de démonstration en ligne.
