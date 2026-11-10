# Plan 09 — Services, rendez-vous et avis

> Constaté par lecture du code d'`origin/main` (DIASPORALE `bead76d`, ANTSIA `fd58d73b`), le 10 novembre 2026. Rien n'a été exécuté : ni test, ni recette, ni publication.
> Applications de référence : Planity, Treatwell, Booksy et Doctolib (réserver) ; Thumbtack, Malt et WhatsApp Business (demander, chiffrer, échanger) ; fiche d'établissement Google et Yelp (avis). Comparaison faite de mémoire, sans revérification en ligne ; un « ? » marque ce qui n'est pas sûr.
> Ce plan détaille, pour les services, les rendez-vous et les avis, le plan 15 du dossier de finalisation d'ANTSIA. Les lots qu'il en reprend gardent leur identifiant (DS-11, DS-12, DS-16) ; les lots nouveaux portent le préfixe `SV-`.

Légende des chemins : `D:` = dépôt DIASPORALE, `A:` = dépôt ANTSIA. « Écran » = atteignable depuis l'interface de diasporale.com ; « Moteur » = la fonction existe côté serveur.

## 1. L'intention du propriétaire

- **Le premier résultat prioritaire du produit** : « trouver une compétence locale : rechercher "coiffure, Paris", consulter une offre précise, adresser une demande, obtenir une réponse, convenir d'un rendez-vous, échanger et confirmer le résultat » (docs/14 de DIASPORALE, § 1.1). Le premier pilote utile doit le couvrir « avec des conversations fiables ».
- **Pour qui** : le citoyen établi et le nouvel arrivant qui cherchent (P1, P2) ; l'entrepreneur de la diaspora et l'association qui proposent (P4, P3). Exemple du dossier produit : « un traiteur gabonais à Paris pour un mariage » (fiche F05).
- **Mise en relation seulement** : catalogue, demandes, rendez-vous et avis vivent dans la tranche `diaspora` du moteur, sans paiement, sans lien avec PRO.GA, sans vocabulaire de vente (D-G01) ; un tarif est « annoncé par le professionnel » (D-G03).
- **Une demande structurée, pas une amitié** : besoin, fenêtres souhaitées, proposition versionnée ; aucune relation sociale créée ; le nom du demandeur n'est montré à l'équipe qu'avec son accord (D-G02).
- **Aucune coordonnée, aucune adresse de domicile stockée** : le lieu d'une proposition reste approximatif ; l'adresse professionnelle ne circule que dans la conversation de la demande, en voix de page (docs/32 de DIASPORALE, § 7, décision D8 du contrat de conversation).
- **Un avis exige une preuve** : rendez-vous confirmé arrivé à terme, ou réalisation déclarée ; « pas d'avis achetés, auto-évaluation ou note initiale inventée » (docs/14, G5 ; docs/19).
- **Catégories du pilote** : coiffure et beauté non médicale, création numérique, photographie, traduction, aide à l'installation ; les professions réglementées attendent une politique (docs/14, G4 ; D-G10).
- **Sans GPS** : la ville se saisit ; aucune localisation précise n'est exigée (docs/14, G4 et recette R-G04). Zone pilote : Paris et Île-de-France, hypothèse à confirmer (D-G12).
- **Ce que G4 demandait et qui n'est pas construit** : photos ou vidéo de portfolio sur l'offre, favoris, disponibilité déclarée (docs/14, G4 points 1 à 3).
- **Refusé** : vendre un badge de confiance ; faire croire qu'une attestation consulaire certifie une compétence ; faire payer le citoyen ; toute publicité au pilote (docs/14, G9 et G11 ; D-G04).

## 2. Ce qui existe

| # | Capacité | État | Écran | Moteur | Preuve |
|---|---|---|---|---|---|
| | **Qui propose** | | | | |
| 1 | Offre portée par une page d'entreprise ou d'association ; ses signataires vivants la gèrent | Présent | oui | oui | `D:packages/diasporale-domain/src/services.ts` (`SERVICE_PROVIDER_OWNER_KINDS`), `A:convex/modules/diaspora/services.ts` (`managedProviderPage`) |
| 2 | Proposer en son nom, sans page | Absent, voulu : une offre n'appartient jamais à une personne | non | non | `A:convex/modules/diaspora/servicesTables.ts` (en-tête) ; motifs : `ownerPersonId`, `providerPersonId` |
| 3 | Créer la page qui portera l'offre | Fermé en pratique : il faut une adhésion vérifiée, que seules donnent l'attestation consulaire (fermée) ou l'IDN de niveau 2 avec parrainage (jamais recetté) ; ouvre : plan 01 (EA-01, EA-02, DG-009a) | oui | oui | `A:convex/modules/pages/pages.ts` (`createPage`, `minStatus: "verifiee"`), `D:packages/diasporale-domain/src/eligibility.ts` |
| 4 | Badge calculé de la page sur la carte et la fiche, avec la mention « il ne garantit pas la qualité de la prestation » | Présent | oui | oui | `D:apps/diasporale_com/src/components/service-card.tsx`, `D:packages/diasporale-features/src/i18n/locales/fr/services.json` (`offer.badgeNote`) |
| 5 | Politique des professions réglementées | Absent : aucune catégorie de santé, de droit ou de finance, mais ni refus explicite ni engagement du prestataire | non | non | `D:packages/diasporale-domain/src/services.ts` (commentaire de `SERVICE_CATEGORIES`) ; motifs : `regulated`, `réglement`, `licence` |
| | **L'offre** | | | | |
| 6 | Titre, description ; téléphone, courriel et lien refusés dans les textes | Présent | oui | oui | `D:packages/diasporale-domain/src/services.ts` (`parseServiceOffer`, `containsContactDetails`) |
| 7 | Catégories | Partiel : cinq seulement (coiffure et beauté, création numérique, photographie, traduction, aide à l'installation) ; ni traiteur, ni couture, ni cours, ni évènementiel, ni déménagement | oui | oui | `D:packages/diasporale-domain/src/services.ts` (`SERVICE_CATEGORIES`) |
| 8 | Zone : un pays de résidence (jamais le Gabon) et une ville saisie | Présent | oui | oui | `D:packages/diasporale-domain/src/services.ts` (`parseServiceCountry`, `parseServiceCity`) |
| 9 | Plusieurs villes desservies, agglomération | Absent | non | non | motifs : `servedCities`, `cities:`, `zone desservie` |
| 10 | Mode : présentiel, à distance, les deux | Présent ; « à domicile » et « chez le professionnel » ne se distinguent pas | oui | oui | `D:packages/diasporale-domain/src/services.ts` (`SERVICE_DELIVERY_MODES`) |
| 11 | Langues de la prestation : onze codes, dont le lingala et le fang ; cinq au plus | Présent | oui | oui | `D:packages/diasporale-domain/src/services.ts` (`SERVICE_LANGUAGE_CODES`) |
| 12 | Durée indicative, de 5 minutes à 24 heures | Présent | oui | oui | `D:packages/diasporale-domain/src/services.ts` (`SERVICE_DURATION_MIN_MINUTES`), `D:apps/diasporale_com/src/components/service-offer-form.tsx` |
| 13 | Tarif annoncé : fixe, « à partir de », sur devis, gratuit ; onze devises (euro, dollar canadien, deux francs CFA…) | Présent | oui | oui | `D:packages/diasporale-domain/src/money.ts` (`CURRENCY_MINOR_UNITS`), `D:apps/diasporale_com/src/components/service-format.ts` |
| 14 | Photos, vidéo, portfolio de l'offre | Absent : la table n'a aucun champ de média | non | non | `A:convex/modules/diaspora/servicesTables.ts` ; motifs : `media`, `portfolio`, `storageId` |
| 15 | Brouillon, publication, pause, reprise, retrait terminal ; version attendue ; 30 offres par page | Présent | oui | oui | `A:convex/modules/diaspora/services.ts` (`createOffer`, `updateOffer`, `setOfferStatus`), `D:apps/diasporale_com/src/components/page-services-manager.tsx` |
| 16 | Relecture ou mots bloqués à l'écriture d'une offre | Absent : la tranche des offres n'appelle jamais la modération | non | non | motifs : `moderat`, `contentState` dans `A:convex/modules/diaspora/services.ts` |
| 17 | Signaler une offre | Absent : aucune nature pour l'offre parmi les surfaces modérées ni dans la feuille commune | non | non | `A:packages/social-domain/src/moderationPolicy.ts` (`MODERATION_SURFACES`), `D:packages/diasporale-features/src/data/content-reports-port.ts` (`CONTENT_REPORT_KINDS`) |
| 18 | Fiche de l'offre : prestataire, zone, mode, langues, durée, tarif, date de mise à jour, « aucun paiement sur DIASPORALE » | Présent | oui | oui | `D:apps/diasporale_com/src/screens/services-screens.tsx` (`OfferDetailBody`) |
| 19 | Offres actives sur la fiche de la page, filtres par catégorie et par mode, « Demander un service » | Présent | oui | oui | `D:apps/diasporale_com/src/components/page-services-section.tsx`, `A:convex/modules/diaspora/services.ts` (`pageOffers`) |
| 20 | Enregistrer une offre | Absent | non | non | motifs : `savedOffer`, `favori`, `favorite`, `wishlist` |
| 21 | Partager une offre (lien, iCom) | Absent : le partage n'existe que pour une page | non | non | `D:apps/diasporale_com/src/components/page-share-button.tsx` |
| | **Chercher** | | | | |
| 22 | Catalogue `/services`, plus récentes d'abord, pagination par curseur, vide expliqué | Présent | oui | oui | `A:convex/modules/diaspora/services.ts` (`searchOffers`), `D:apps/diasporale_com/src/components/service-pager.tsx` |
| 23 | Recherche par texte, sans accents (titre, description, ville) | Présent | oui | oui | `A:convex/modules/diaspora/servicesTables.ts` (`search_by_text`) |
| 24 | Filtres pays, catégorie, présentiel ou distance | Présent | oui | oui | `D:packages/diasporale-domain/src/services.ts` (`parseServiceSearch`) |
| 25 | Filtre par ville saisie, sans GPS | Partiel : égalité exacte ; « Paris » ne trouve ni « Montreuil » ni « Paris 11e » ; avec un texte, la ville est filtrée après la page de résultats | oui | oui | `A:convex/modules/diaspora/services.ts` (`catalogQuery`), `D:packages/diasporale-domain/src/services.ts` (`cityKeyOf`) |
| 26 | Budget maximal dans la même devise, règle dite à l'écran | Présent ; le budget n'est pas porté par l'adresse | oui | oui | `D:packages/diasporale-domain/src/services.ts` (`serviceBudgetFit`), `D:apps/diasporale_com/src/screens/services-screens.tsx` |
| 27 | Pays de résidence appliqué par défaut | Absent : le catalogue s'ouvre sur tous les pays | non | — | `D:apps/diasporale_com/src/screens/services-screens.tsx` (`filtersFromParams`) |
| 28 | Tri par prix, filtre par langue, filtre par date disponible | Absent | non | non | motifs : `sort`, `orderBy`, `language` dans `ServiceSearchFilters` |
| 29 | Suggestions de villes | Absent | non | non | motifs : `suggest`, `autocomplete`, `knownCities` |
| 30 | Entrée « Services » dans les cinq destinations, carte dans Explorer | Présent | oui | — | `D:apps/diasporale_com/src/components/app-shell.tsx`, `D:apps/diasporale_com/src/screens/explore-screen.tsx` |
| 31 | Entrée depuis le hub d'un pays | Absent | non | — | motifs : `service` dans `D:apps/diasporale_com/src/screens/hub-screen.tsx` |
| 32 | Aucun historique de recherche gardé | Présent (décision) | — | oui | `A:convex/modules/diaspora/services.ts` (commentaire de `searchOffers`) |
| | **Demander** | | | | |
| 33 | Demande structurée : besoin de 10 à 1 000 signes, une à trois fenêtres, fuseau du navigateur | Présent | oui | oui | `D:apps/diasporale_com/src/components/service-request-entry.tsx`, `A:convex/modules/diaspora/serviceRequests.ts` (`createServiceRequest`) |
| 34 | Accord explicite pour montrer son nom et son identifiant à l'équipe, obligatoire et horodaté | Présent | oui | oui | `A:convex/modules/diaspora/serviceRequestsTables.ts` (`identityConsentAt`) |
| 35 | Double envoi sans doublon, une seule demande ouverte par offre, version de l'offre citée | Présent | oui | oui | `D:packages/diasporale-domain/src/service-requests.ts` (`serviceRequestFingerprint`) |
| 36 | Demande refusée sur sa propre page et au compte en attente, qui lit pourtant le catalogue | Présent | oui | oui | `A:convex/modules/diaspora/serviceRequests.ts` (`request_own_page`, `minStatus: "declaree"`) |
| 37 | Photo de référence, lieu souhaité (domicile ou sur place), nombre de personnes | Absent : le formulaire n'a que le besoin, les fenêtres et l'accord | non | non | `D:apps/diasporale_com/src/components/service-request-entry.tsx` (`RequestForm`) |
| 38 | Un même besoin adressé à plusieurs prestataires | Absent | non | non | motifs : `openRequest`, `broadcast`, `je cherche` |
| 39 | « Mes demandes » : liste, état effectif, prochaine étape | Présent ; sans filtre par état côté demandeur | oui | oui | `D:apps/diasporale_com/src/screens/service-request-screens.tsx`, `A:convex/modules/diaspora/serviceRequests.ts` (`myServiceRequests`) |
| 40 | Échéance constatée à la lecture, écrite toutes les quinze minutes | Présent | — | oui | `A:convex/crons.ts`, `A:convex/modules/diaspora/serviceRequests.ts` (`expireDueServiceRequests`) |
| | **Proposer** | | | | |
| 41 | Proposition : montant, devise, durée, créneau, fuseau, lieu approximatif ou à distance, contenu, conditions d'annulation, échéance de l'accord | Présent | oui | oui | `D:apps/diasporale_com/src/components/service-proposal-form.tsx`, `A:convex/modules/diaspora/serviceRequests.ts` (`proposeService`) |
| 42 | Dix versions au plus ; la version lue est citée, un second onglet ne l'écrase pas | Présent | oui | oui | `D:packages/diasporale-domain/src/service-requests.ts` (`checkProposalVersion`) |
| 43 | Proposition préremplie depuis l'offre | Absent : devise « EUR », 60 minutes et montant vide par défaut, même pour une offre à prix fixe dans une autre devise | non | — | `D:apps/diasporale_com/src/components/service-proposal-form.tsx` (`initialValues`) |
| 44 | Modèles de conditions, réponses rapides | Absent | non | non | motifs : `template`, `quickReply`, `modèle` |
| 45 | Décliner une demande, motif facultatif | Présent | oui | oui | `A:convex/modules/diaspora/serviceRequests.ts` (`refuseServiceRequest`) |
| 46 | Contre-proposition chiffrée du demandeur | Absent, voulu : il accepte, retire sa demande ou écrit dans la conversation | non | non | `D:packages/diasporale-domain/src/service-requests.ts` (`TRANSITIONS`) |
| | **Le rendez-vous** | | | | |
| 47 | Accord sur la version courante ; rendez-vous confirmé ; contrôle transactionnel du créneau | Présent | oui | oui | `A:convex/modules/diaspora/serviceRequests.ts` (`acceptServiceProposal`) |
| 48 | Agenda de la page | Partiel : un seul rendez-vous à la fois par page ; ni collaborateur ni capacité ; un salon à deux fauteuils se voit refuser le second créneau | — | oui | `A:convex/modules/diaspora/serviceRequests.ts` (`slotTaken`) |
| 49 | Deux fuseaux affichés : celui du rendez-vous et le mien | Présent | oui | — | `D:apps/diasporale_com/src/components/service-request-ui.tsx` (`SlotText`) |
| 50 | Annuler avant le début ; motif requis après l'accord | Présent | oui | oui | `A:convex/modules/diaspora/serviceRequests.ts` (`cancelServiceRequest`) |
| 51 | Déplacer un rendez-vous confirmé | Absent : il faut annuler puis redemander | non | non | `D:packages/diasporale-domain/src/service-requests.ts` (`SERVICE_REQUEST_ACTIONS`) |
| 52 | Rappel avant le rendez-vous | Absent | non | non | motifs : `reminder`, `rappel` dans les fichiers `service*` de la tranche |
| 53 | Rendez-vous dans l'agenda personnel, export iCal | Absent ici ; le moteur l'a pour les évènements | non | modèle | `D:apps/diasporale_com/src/screens/agenda-screen.tsx`, `A:convex/modules/events/pageEventCalendar.ts` (`exportIcal`) |
| 54 | Constat par la page, après le début : prestation réalisée ou absence | Présent | oui | oui | `A:convex/modules/diaspora/serviceRequests.ts` (`completeServiceBooking`, `markServiceNoShow`) |
| 55 | Absence contestée par le demandeur, une fois, sous 14 jours, lisible des deux côtés | Présent | oui | oui | `A:convex/modules/diaspora/serviceRequests.ts` (`contestServiceNoShow`) |
| 56 | Le demandeur dit que le professionnel n'est pas venu ; rendez-vous jamais constaté | Absent : l'état reste « confirmé » sans fin | non | non | `D:packages/diasporale-domain/src/service-requests.ts` (`checkServiceRequestTransition`) |
| 57 | Dossier de litige, lien vers la modération | Absent | non | non | motifs : `serviceDisputes`, `dispute`, `litige` |
| 58 | Chronologie de la demande, dérivée des faits | Présent | oui | oui | `D:packages/diasporale-domain/src/service-requests.ts` (`serviceRequestTimeline`) |
| 59 | Adresse exacte : jamais stockée ; admise seulement dans la conversation, en voix de page | Présent (règle) | — | oui | `D:packages/diasporale-domain/src/conversation-contexts.ts` (`conversationTextRefusal`) |
| 60 | Blocage entre personnes | Partiel : appliqué par le moteur à la conversation, pas à l'envoi d'une demande ni d'une proposition | — | partiel | `A:convex/modules/contextualMessaging/access.ts` ; motif : `isBlockedBetween` absent de `A:convex/modules/diaspora/serviceRequests.ts` |
| | **Disponibilités** | | | | |
| 61 | Horaires ou disponibilités déclarés | Absent | non | non | motifs : `serviceAvailability`, `openingHours`, `weeklyRule` |
| 62 | Créneau libre réservé sans attendre de proposition | Absent | non | non | motifs : `bookSlot`, `slotPicker` dans DIASPORALE |
| 63 | Liste d'attente, alerte de créneau libéré | Absent | non | non | motifs : `waitlist`, `liste d'attente` dans les fichiers `service*` |
| | **Échanger** | | | | |
| 64 | Conversation attachée à la demande, ouverte à l'envoi ; le prestataire parle d'abord | Fermé : la politique contextuelle du réseau reste fermée tant qu'un opérateur ne l'ouvre pas | oui | oui | `D:apps/diasporale_com/src/components/contextual-conversations.tsx`, `A:convex/modules/contextualMessaging/operator.ts` (`setPolicy`) |
| 65 | Appels et pièces jointes dans cette conversation, à partir d'une proposition | Fermé (même porte) | oui | oui | `D:packages/diasporale-domain/src/conversation-contexts.ts` (`serviceRequestConversation`) |
| 66 | Boîte des demandes reçues par une page, filtre par état | Présent | oui | oui | `D:apps/diasporale_com/src/components/service-inbox.tsx` |
| | **Avis** | | | | |
| 67 | Avis du demandeur après la fin du rendez-vous : note de 1 à 5, texte de 10 à 2 000 signes, accord de publication | Présent | oui | oui | `A:convex/modules/diaspora/serviceReviews.ts` (`createReview`), `D:apps/diasporale_com/src/components/service-review-editor.tsx` |
| 68 | Preuve nommée : « rendez-vous confirmé » ou « réalisation déclarée », sans certification | Présent | oui | oui | `D:packages/diasporale-domain/src/service-reviews.ts` (`SERVICE_REVIEW_PROOFS`) |
| 69 | Un avis par rendez-vous ; modification versionnée ; retrait terminal ; auto-avis refusé | Présent | oui | oui | `D:packages/diasporale-domain/src/service-reviews.ts` (`serviceReviewEligibility`) |
| 70 | Publication de l'avis | Fermé : sans politique de modération posée pour la surface `serviceReview`, tout avis reste en attente ; ouvre : un administrateur du réseau pose la politique, une équipe approuve | oui | oui | `A:convex/modules/diaspora/serviceReviews.ts` (`moderateReviewWrite`), `A:convex/modules/moderation/cases.ts` (`setPolicy`) |
| 71 | Réponse de la page, modifiable et retirable | Présent (attend la ligne 70) | oui | oui | `A:convex/modules/diaspora/serviceReviews.ts` (`replyToReview`) |
| 72 | Signaler un avis ou une réponse | Présent ; par une feuille propre à quatre motifs, pas par la feuille commune aux douze motifs et à l'accusé de réception | oui | oui | `D:apps/diasporale_com/src/components/service-reviews-section.tsx`, `D:apps/diasporale_com/src/components/report-content-sheet.tsx` |
| 73 | Avis sur la fiche de l'offre et dans l'onglet « Avis » de la page | Présent | oui | oui | `D:apps/diasporale_com/src/components/page-reviews-section.tsx` |
| 74 | Note moyenne, nombre d'avis, tri | Absent, voulu à ce stade | non | non | `D:docs/26_AVIS_SUR_LES_SERVICES_DES_PAGES.md` |
| 75 | Photos dans un avis | Absent | non | non | `A:convex/modules/diaspora/serviceReviewsTables.ts` |
| 76 | Invitation à donner son avis à la fin du rendez-vous | Absent | non | non | motifs : `review_invited`, `invit` dans `A:convex/modules/diaspora/serviceNotifications.ts` |
| 77 | L'équipe prévenue d'un avis publié | Absent : le seul avis de cloche des avis est la réponse de la page | non | non | `A:convex/modules/diaspora/serviceNotifications.ts` (`noticeServiceReviewReplied`) |
| 78 | Avis d'une relation mis en avant | Absent | non | non | motifs : `relation`, `connection` dans `A:convex/modules/diaspora/serviceReviews.ts` |
| | **Mon activité et transverse** | | | | |
| 79 | `/mon-activite` : offres, demandes, emplois, pages ; sélecteur de page ; offres filtrées par état | Présent | oui | oui | `D:apps/diasporale_com/src/components/service-activity.ts`, `A:convex/modules/diaspora/services.ts` (`myPageOffers`) |
| 80 | Demandes à traiter, rendez-vous à venir, statistiques, délai de réponse d'une page | Absent ; le délai de première réponse n'est calculé que pour tout le réseau | non | partiel | `D:packages/diasporale-domain/src/pilot-metrics.ts` (`first_response_hours`) |
| 81 | Calendrier des rendez-vous de la page | Absent | non | non | motifs : `calendar` dans les composants `service-*` |
| 82 | Dix avis neutres dans la cloche (demande reçue, proposition, refus, accord, annulation, échéance, réalisée, absence, contestation, réponse à l'avis) | Présent | oui | oui | `A:convex/modules/diaspora/serviceNotifications.ts` (`NOTICE_RULES`) |
| 83 | Démonstration : catalogue, demandes et avis fictifs | Présent ; les avis y restent en attente, la conversation n'y est pas servie | oui | — | `D:packages/diasporale-features/src/demo/services.ts`, `D:packages/diasporale-features/src/demo/service-requests.ts`, `D:packages/diasporale-features/src/demo/service-reviews.ts` |
| 84 | Export et effacement des six tables | Partiel : la demande et l'avis sortent ; la proposition reçue et le rendez-vous ne sont dans aucun fichier d'export (constat du plan 13, lot NP-03) ; rien n'a été recetté | oui | partiel | `A:convex/modules/people/dataPolicies.ts`, `A:convex/modules/people/dataInventory.ts` (`exportableRecord`) |
| 85 | Six seaux de débit, dont un renforcé pour le compte sans badge | Présent | — | oui | `A:convex/lib/rateLimit.ts` |
| 86 | Mesure du pilote : huit indicateurs des services, un des avis | Présent ; les recherches sans résultat ne sont pas comptées | oui | oui | `A:convex/modules/diaspora/pilotMetrics.ts`, `D:packages/diasporale-domain/src/pilot-metrics.ts` |
| 87 | Paiement, acompte, facturation | Fermé par décision (D-G03) | non | non | `D:docs/17_REGISTRE_DECISIONS_DROITS_G0.md` |
| 88 | Prestataire installé au Gabon, service rendu au pays | Absent : le pays d'une offre ne peut pas être le Gabon | non | non | `D:packages/diasporale-domain/src/services.ts` (`service_country_is_home`) |
| 89 | Application mobile | Absent | non | — | `D:apps` |

Décompte : **Présent 45 · Partiel 5 · Absent 34 · Fermé 5** (89 lignes, intertitres exclus).

### Ce que le moteur sait déjà faire et que DIASPORALE ne montre pas

- **Publier un avis** : la politique d'une surface et les équipes de modération existent (`A:convex/modules/moderation/cases.ts`, `setPolicy`, `createTeam`). Ouvrir les avis est un réglage et une recette, pas du code.
- **La conversation de la demande** : entièrement câblée des deux côtés ; seule la politique contextuelle la ferme (`A:convex/modules/contextualMessaging/operator.ts`).
- **La feuille de signalement commune** (douze motifs, accusé de réception, « Mes signalements ») sert neuf natures de la communauté (`D:apps/diasporale_com/src/components/report-content-sheet.tsx`) ; les avis de service n'y passent pas.
- **Rappel et export iCal** : le patron existe pour les évènements d'association (`A:convex/modules/events/pageEventReminders.ts`, `A:convex/modules/events/pageEventCalendar.ts`). Ces fichiers appartiennent à S1 : on reprend le patron, pas le fichier.
- **Les photos d'une page** : la lecture des médias publiés par une page existe (docs/24 de DIASPORALE) ; elle peut nourrir les « réalisations » d'une offre sans nouvelle chaîne de dépôt.
- **Heures murales et créneaux** : ANTSIA a ses règles (`A:packages/social-domain/src/serviceTime.ts`) et un sélecteur de créneaux (`A:apps/antsia_ga/src/components/services/service-slot-picker.tsx`). DIASPORALE a écrit les mêmes règles de son côté : deux copies à faire converger (DS-16).
- **Le délai de première réponse** est déjà calculé pour le réseau entier (`A:convex/modules/diaspora/pilotMetrics.ts`) ; le montrer par page demande peu.

### Ce qui est écrit mais jamais recetté en réel

| Sujet | Dernier constat | Source |
|---|---|---|
| « Coiffeur à Paris » : demande, proposition, accord, prestation constatée, avis déposé | Joué à deux comptes, backend local, écran de téléphone, le 19/10. L'avis est resté en attente : publication et réponse de la page jamais jouées | `D:docs/recette/deux-comptes-2026-10-19/README.md` |
| Conversation de la demande, voix de page, adresse refusée ou admise, appels | Jamais jouée : politique fermée | `D:docs/32_EXECUTION_VAGUE_H.md` (§ 11, § 12) |
| Filtres des services d'une page, gestion des offres par état, onglet « Avis » | Écrits le 18/10 sans contrôle ; depuis, `verify` vert (3/11, d'après le plan 15) ; jamais vus en recette | `D:docs/27_FILTRES_SERVICES_PAR_PAGE.md`, `D:docs/29_GESTION_SERVICES_PAR_ETAT.md`, `D:docs/26_AVIS_SUR_LES_SERVICES_DES_PAGES.md` |
| Contestation d'une absence | Tests seulement | `D:docs/32_EXECUTION_VAGUE_H.md` (§ 8) |
| Deux accords sur le même créneau, double envoi, proposition modifiée dans un second onglet (R-G05 à R-G07) | Tests seulement | `D:docs/14_PLAN_GLOBAL_IMPLEMENTATION_DIASPORALE.md` (§ 6.2) |
| Échéance écrite par la tâche planifiée et avis d'échéance | Jamais observés | `A:convex/crons.ts` |
| Demandeur à Montréal, page à Paris, changement d'heure (R-G21) | Jamais joué | idem § 6.2 |
| Export et effacement après un service (R-G19) | Jamais joués | idem § 6.2 |
| Parcours au format ordinateur, au clavier, au lecteur d'écran | Aucune recette consignée | la recette du 19/10 s'est faite sur un écran de 395 px |
| En ligne sur la démonstration | Aucun parcours de service consigné en ligne ; la recette du 22/10 portait sur la publication et le signalement | `D:docs/recette/demo-en-ligne-2026-10-22/README.md` |

## 3. Comparaison avec les applications de référence

**Trouver et réserver**

| Capacité | Planity | Treatwell | Booksy | Doctolib | DIASPORALE | Verdict |
|---|---|---|---|---|---|---|
| Chercher par prestation et par ville | oui | oui | oui | oui | texte, pays, ville exacte | À adapter (SV-06) |
| « Autour de moi » par géolocalisation | oui | oui | oui | oui | non | Écarté (sans GPS, R-G04) ; villes desservies à la place (SV-06) |
| Photos de l'établissement ou des réalisations | oui | oui | oui | photo du praticien | non | À faire (SV-08) |
| Adresse, plan, horaires publics | oui | oui | oui | oui | aucune adresse publique | Écarté pour l'adresse (invariant 6) ; horaires : DS-12 |
| Liste des prestations avec durée et prix | oui | oui | oui | motifs de consultation | une offre par prestation, 30 par page | Déjà fait |
| Créneau libre réservé tout de suite | oui | oui | oui | oui | demande puis proposition | Reporté (DS-12) |
| Choix du collaborateur | oui | oui | oui | oui | un seul agenda par page | À faire (SV-09), puis DS-12 |
| Rappel avant le rendez-vous | oui | oui | oui | oui | non | À faire (SV-02) |
| Déplacer en ligne | oui | oui | oui | oui | annuler puis redemander | À faire (SV-03) |
| Annuler en ligne | oui | oui | oui | oui | oui, motif après l'accord | Déjà fait |
| Ajouter à son calendrier | oui ? | oui ? | oui | oui | non | À faire (SV-02) |
| Prestation à domicile déclarée | ? | ? | oui | selon le praticien | « présentiel » sans précision | À adapter (SV-11) |
| Langue parlée affichée | non | non | non | oui, en filtre | sur l'offre, pas en filtre | À faire (SV-06) |
| Alerte de créneau plus tôt, liste d'attente | ? | non ? | oui ? | oui | non | Reporté (après DS-12) |
| Paiement en ligne, empreinte, acompte | selon le salon | oui | oui | non, sauf téléconsultation | aucun | Écarté (D-G03) |
| Heure donnée dans le fuseau de chaque partie | sans objet | sans objet | sans objet | sans objet | oui | Déjà fait, propre à une diaspora |

**Demander, chiffrer, échanger**

| Capacité | Thumbtack | Malt | WhatsApp Business | DIASPORALE | Verdict |
|---|---|---|---|---|---|
| Décrire son besoin | questionnaire par métier | brief de mission | message libre | texte libre et fenêtres | À adapter (SV-11) |
| Un besoin envoyé à plusieurs prestataires | oui | oui | non | non | Reporté (SV-16, avec le lot AN-14 du plan 12) |
| Devis chiffré et versionné | estimation, devis | devis | non | proposition, dix versions | Déjà fait, plus strict |
| Conditions d'annulation écrites dans l'accord | variable | conditions de mission | non | oui, à chaque proposition | Déjà fait |
| Réponse préparée : modèles, réponses rapides, message d'absence | modèles ? | non ? | oui | non | À faire (SV-04) ; réponses enregistrées d'iCom : ICP-3 du moteur, IM-15 du plan 04 |
| Messagerie attachée à la demande | oui | oui | c'est le produit | écrite, fermée | À recetter (DS-04, plan 04) |
| Appel | oui ? | non ? | oui | après une proposition, fermé | À recetter (plan 04) |
| Délai de réponse affiché | oui | oui | non | non | À faire (SV-12) |
| Disponibilité déclarée | selon le professionnel | oui | horaires | non | Reporté (DS-12) |
| Catalogue avec photos | réalisations | portfolio | oui | prix sans image | À faire (SV-08) |
| Favoris | oui ? | oui | non | non | À faire (DS-11) |
| Partager une fiche | oui | oui | lien court, code QR | non | À faire (SV-14) |
| Bloquer un contact | — | — | oui | pas pour une page | À faire (SV-15) |
| Paiement tenu par la plateforme | optionnel | oui | selon le pays | non | Écarté (D-G03) |
| Mise en relation payée par le professionnel | oui | commission | non | gratuite | Écarté au pilote (D-G04) ; lot D4 au plan 17 |
| Badge payant ou de performance | Top Pro | Super Malter | Meta Verified, payant | badge calculé de la page | Écarté : aucun badge vendu ni badge de rang |

**Avis et confiance**

| Capacité | Fiche Google | Yelp | Planity, Treatwell | Malt | DIASPORALE | Verdict |
|---|---|---|---|---|---|---|
| Qui peut écrire | tout compte | tout compte | client venu au rendez-vous | client d'une mission | demandeur d'un rendez-vous arrivé à terme | Déjà fait |
| Preuve affichée avec l'avis | non | non | « avis vérifié » | mission réalisée | deux preuves nommées | Déjà fait, différenciant |
| Note de 1 à 5 et texte | oui | oui | oui | oui | oui | Déjà fait |
| Notes par critère | non | non | oui ? | oui ? | non | Écarté au pilote : une note suffit |
| Photos dans l'avis | oui | oui | non ? | non | non | Reporté : chaîne des médias et modération d'abord |
| Note moyenne et nombre d'avis | oui | oui | oui | oui | non | À faire sous seuil (SV-13) |
| Tri et filtre des avis | oui | oui | oui | — | ordre chronologique | À faire (SV-13) |
| Réponse du professionnel | oui | oui | oui | oui ? | oui | Déjà fait, à recetter (SV-01) |
| Signaler un avis | oui | oui | oui | oui | oui, quatre motifs | À adapter (SV-07) |
| Le professionnel prévenu d'un avis | oui | oui | oui | oui | non | À faire (SV-07) |
| Invitation à noter après la prestation | non | non | oui | oui | non | À faire (SV-07) |
| Vote « utile » | oui | oui | non | non | non | Écarté : pas de classement par popularité (D-G05) |
| Filtrage des avis douteux | automatique | automatique | par la preuve | par la preuve | preuve et relecture humaine | À recetter (SV-01) |
| Avis de proches mis en avant | non | amis ? | non | recommandations | non | À faire sous décision (SV-13) |
| Contester une absence déclarée | — | — | non ? | — | oui | Déjà fait, différenciant |

## 4. Ce qui manque

### 4.1 Bloquant avant l'ouverture du pilote

1. **Trois portes ferment le parcours en réel.** (a) Personne ne peut créer la page d'un prestataire sans adhésion vérifiée ; or l'attestation consulaire est fermée et l'IDN n'a jamais été recetté (plan 01 : EA-01, EA-02, DG-009a). (b) La conversation de la demande est fermée : aucune adresse ni aucun téléphone ne peut circuler, donc aucun rendez-vous en présentiel ne peut être honoré (DS-04, plan 04). (c) Aucun avis ne peut paraître sans politique de modération ni équipe (SV-01 ; MD-01 et MD-04 du plan 14).
2. **Une offre ne se signale pas et n'est jamais relue.** Le cahier veut tout contenu signalable, offre comprise (EXF-DG-40), et une modération en place avant d'ouvrir une surface (invariant 10). C'est le lot MD-03 du plan 14 : ce plan ne le refait pas, il l'attend avant tout recrutement de prestataires.
3. **Le parcours n'a jamais été joué jusqu'à l'avis publié et la réponse de la page**, ni la concurrence sur un créneau, ni l'export et l'effacement après un service (volet de la campagne DS-05, § 6).

### 4.2 Fonctions attendues qui manquent

- **Avant le rendez-vous** : un rappel, le rendez-vous dans son agenda, un fichier de calendrier (SV-02) ; le déplacer sans l'annuler (SV-03).
- **Pour choisir** : des photos des réalisations (SV-08), car une coiffeuse se choisit sur image ; les catégories du quotidien de la diaspora : traiteur, couture, cours, fêtes et cérémonies, déménagement (SV-05).
- **Pour trouver** : une offre de Montreuil doit répondre à « Paris » (SV-06) ; enregistrer une offre (DS-11).
- **Pour le professionnel** : plusieurs rendez-vous à la même heure quand la page a plusieurs collaborateurs (SV-09) ; être prévenu d'un avis (SV-07) ; à terme, ouvrir ses créneaux (DS-12).
- **Quand cela se passe mal** : dire que c'est le professionnel qui a manqué (SV-10).

### 4.3 Options qui manquent sur ce qui existe

| Écran | Options absentes |
|---|---|
| `/services` | pays de résidence appliqué d'entrée, avec une pastille de zone retirable ; tri par prix ; filtre par langue ; budget et tri dans l'adresse ; suggestions de villes ; pastilles de catégories ; entrée depuis le hub du pays |
| Fiche d'une offre | signaler, enregistrer, partager ; photos ; « autres prestations de cette page » |
| Formulaire de demande | photo de référence ; lieu souhaité (à domicile, chez le professionnel) ; nombre de personnes ; « date souple » |
| Formulaire de proposition | reprise du prix, de la durée et de la devise de l'offre ; conditions et lieu par défaut de la page ; « reprendre la version précédente » |
| « Mes demandes » | filtre par état ; « rendez-vous à venir » en tête |
| Fiche d'un rendez-vous | ajouter à mon calendrier ; déplacer ; signaler un problème |
| Boîte des demandes d'une page | compteur « à traiter » ; vue du jour ; refuser les demandes d'une personne |
| Avis | tri ; moyenne sous seuil ; motif de signalement commun |

### 4.4 Améliorations de l'existant

- **Recherche par texte et par ville** : la ville n'est pas un champ filtré de l'index plein texte ; le filtre s'applique après la page de résultats, qui peut revenir vide tout en annonçant une suite. Ajouter la ville aux champs filtrés (SV-06).
- **Proposition** : onze champs à remplir pour chaque demande, sans rien reprendre de l'offre (SV-04).
- **Signalement d'un avis** : la feuille propre aux avis n'a ni les douze motifs, ni l'accusé de réception, ni le suivi dans « Mes signalements » (SV-07).
- **Rendez-vous « confirmé » sans fin** quand la page ne constate rien : relance neutre de l'équipe (SV-10).
- **Deux copies des règles d'heures murales** (domaine de DIASPORALE, domaine du moteur) : source de divergence (DS-16).
- **Recherches sans résultat** : rien ne les compte, alors que le plan global demande de les mesurer (G11). Un compteur sans contenu, par catégorie et par pays, dirait quelles catégories ouvrir : besoin adressé au lot LX-09 du plan 17.
- **Export et effacement** : la proposition reçue et le rendez-vous manquent à l'export du demandeur (lot NP-03 du plan 13). L'effacement d'un demandeur emporte ses demandes, donc l'historique du prestataire : à expliquer dans les textes ; durée de conservation à demander au juriste (décision 12).

### 4.5 Ce qui distingue DIASPORALE

- **Avis sur preuve**, avec deux preuves nommées, et une absence qui se conteste : aucune référence ne fait les trois.
- **Aucune coordonnée publique** : l'adresse du salon ne se donne que dans la conversation de la demande, en voix de page.
- **Pensé pour une diaspora** : deux fuseaux affichés, onze devises sans conversion trompeuse, langues de prestation dont le lingala et le fang.
- **Mise en relation gratuite des deux côtés** : aucun contact payant, aucun badge vendu ; la mention « le badge ne garantit pas la prestation » est écrite.
- **Un accord écrit** : conditions d'annulation dans chaque proposition, versions conservées, chronologie dérivée des faits.

### 4.6 Écarté ou reporté, et pourquoi

| Sujet | Décision | Raison |
|---|---|---|
| Paiement, acompte, pénalité d'absence | Écarté | D-G03 ; un paiement serait le ticket DG-030 du plan 17 |
| Géolocalisation « autour de moi » | Écarté | Ville saisie, aucune localisation exigée (R-G04) |
| Adresse publique sur l'offre ou la page | Écarté | Invariant 6 ; l'adresse passe par la conversation |
| Professions réglementées (santé, droit, finance) | Reporté | D-G10 : une politique par pays d'abord (décision 4) |
| Badge de rang, mise en avant payée, contact payant | Écarté au pilote | D-G04 ; aucun badge de confiance à vendre |
| Vote « utile », classement par popularité | Écarté | D-G05 : règles explicables seulement |
| « Trois de vos relations ont réservé ici » | Écarté | Révèlerait des demandes privées ; seule la mise en avant d'avis publiés est proposée (SV-13) |
| Photos dans un avis, notes par critère | Reporté | Chaîne des médias et modération à prouver d'abord |
| Liste d'attente, alerte de créneau | Reporté | N'a de sens qu'après DS-12 |
| Contre-proposition chiffrée du demandeur | Écarté | La conversation suffit ; une seule partie chiffre |
| Prestataire installé au Gabon dans DIASPORALE | Écarté | Réseau réservé aux Gabonais de l'étranger ; passerelle vers ANTSIA (SV-17) |
| Vitrine premium d'entreprise | Reporté | Lot D4, décision du propriétaire (plan 17) |

## 5. Lots d'implémentation

Rappel de zone : S2 écrit le dépôt DIASPORALE et, dans ANTSIA, la tranche `A:convex/modules/diaspora`. Un nouveau seau de débit (`A:convex/lib/rateLimit.ts`), une politique de données (`A:convex/modules/people/dataPolicies.ts`), un genre d'avis (`A:convex/modules/notifications/tables.ts`), une tâche planifiée (`A:convex/crons.ts`) ou une nature modérée (`A:packages/social-domain/src/moderationPolicy.ts`) se demandent par une issue `[S1]`. Les lots UM-06, UM-07, UM-12 et CM-09 du moteur portent sur les services et les offres d'ANTSIA, servis par PRO.GA : ils ne construisent rien pour la tranche `diaspora`. Les lots ci-dessous en reprennent le patron ; la convergence est DS-16. Signaler et modérer une offre est le lot MD-03 du plan 14 ; signaler une demande ou une proposition, son lot MD-10 : ils ne sont pas refaits ici.

### SV-01 — Avis publiables : politique des deux surfaces et parcours prouvé · P0 · S · S2
- **Pour l'utilisateur** : l'avis déposé paraît après relecture ; la page répond ; chacun est prévenu.
- **Backend** : aucun code attendu. Procédure écrite : un administrateur du réseau pose la politique des surfaces `serviceReview` et `serviceReviewReply`, une équipe France existe. Tests du moteur qui prouvent les deux réglages (relecture avant publication, publication directe) ; correctifs éventuels dans `A:convex/modules/diaspora/serviceReviews.ts` seulement.
- **Web** : contrôle de la fiche d'offre, de l'onglet « Avis » de la page et de la gestion après publication ; aucune moyenne affichée.
- **Mobile** : sans objet.
- **Données personnelles** : l'avis porte le nom publié de son auteur, avec son accord ; rien de nouveau.
- **Tests et cliquets** : cas « sans politique » et « politique posée » ; adaptateur moteur ; démonstration inchangée (avis en attente, dit tel quel).
- **Critères d'acceptation** : `declare` note, `moderateur` approuve, l'avis paraît pour `verifie`, `entreprise` répond, la réponse paraît après relecture, `declare` reçoit l'avis de cloche ; sans politique, rien ne paraît et l'auteur lit « en attente ».
- **Dépend de** : MD-01 et MD-04 du plan 14 ; campagne DS-05.
- **Porte** : décision 2 ; rôle d'administrateur du réseau sur chaque déploiement (propriétaire).

### SV-02 — Rappel du rendez-vous, rendez-vous à venir et fichier de calendrier · P1 · M · S2
- **Pour l'utilisateur** : un rappel la veille ; mes rendez-vous à venir en tête de « Mes demandes » ; un fichier à ajouter au calendrier du téléphone.
- **Backend** : tâche planifiée à l'accord, annulée à l'annulation ou au report, avec reçu, sur le patron de `A:convex/modules/events/pageEventReminders.ts` ; avis neutre `service_booking_reminder` aux deux parties, sans nom ni lieu ; lectures bornées des rendez-vous à venir du demandeur et de la page ; export iCal d'un rendez-vous, sans adresse. Issue `[S1]` : genre d'avis (matrice du lot NP-05 du plan 13), seau de l'export.
- **Web** : section « Rendez-vous à venir » dans `D:apps/diasporale_com/src/screens/service-request-screens.tsx` et dans la boîte des demandes ; bouton « Ajouter à mon calendrier » ; la capacité du port est offerte à l'écran `/agenda` (plan 08).
- **Mobile** : notification sur le téléphone avec le plan 16.
- **Données personnelles** : champs de reçu sur `serviceBookings`, aucune table nouvelle ; la tâche tombe à l'effacement.
- **Tests et cliquets** : aucun rappel pour un rendez-vous annulé, déplacé ou passé ; changement d'heure ; `notification-payload-content`, `notifications-writer`.
- **Critères d'acceptation** : rappel reçu une seule fois par chaque partie ; fichier importé avec la bonne heure à Paris et à Montréal.
- **Dépend de** : plan 13 (NP-05 ; préférences, heures calmes et push : DS-14, NP-12) ; plan 08 (agenda).
- **Porte** : décision 6 (moment du rappel).

### SV-03 — Déplacer un rendez-vous confirmé · P1 · M · S2
- **Pour l'utilisateur** : proposer un autre horaire sans annuler ; l'autre partie accepte, ou le rendez-vous reste tel quel.
- **Backend** : règles pures dans `D:packages/diasporale-domain/src/service-requests.ts` (une seule proposition de report ouverte, avant le début, échéance) ; gestes `proposeReschedule` et `acceptReschedule` dans `A:convex/modules/diaspora/serviceRequests.ts` ; même contrôle transactionnel du créneau ; le rendez-vous garde son identité, les autres conditions ne changent pas ; conversation resynchronisée ; deux avis neutres (issue `[S1]`).
- **Web** : « Proposer un autre horaire » sur la fiche ; feuille d'accord qui montre l'ancien et le nouveau créneau, dans les deux fuseaux.
- **Mobile** : après le web.
- **Données personnelles** : aucune donnée nouvelle ; historique dans la chronologie.
- **Tests et cliquets** : report refusé ou échu sans effet ; deux accords concurrents, un seul ; version attendue ; démonstration à parité.
- **Critères d'acceptation** : le rappel et le fichier de calendrier suivent le nouveau créneau ; l'avis reste admissible sur le rendez-vous déplacé.
- **Dépend de** : SV-02.
- **Porte** : aucune.

### SV-04 — Proposition préremplie et réglages de prestation de la page · P1 · S · S2
- **Pour l'utilisateur** : répondre à une demande en trois vérifications au lieu de onze saisies.
- **Backend** : petite table de réglages par page dans la tranche (fuseau, lieu approximatif habituel, conditions d'annulation habituelles), écrite par les signataires vivants ; mêmes refus de coordonnées et d'adresse que la proposition. Issue `[S1]` : politique de données (contenu de page).
- **Web** : `D:apps/diasporale_com/src/components/service-proposal-form.tsx` reprend le prix, la durée et la devise de l'offre, les réglages de la page et la première fenêtre du demandeur ; « Reprendre la version précédente » ; éditeur des réglages dans la gestion des services.
- **Mobile** : après le web.
- **Données personnelles** : aucune ; les réglages appartiennent à la page.
- **Tests et cliquets** : offre « sur devis » : montant laissé vide ; rien n'est envoyé sans validation ; cliquet des textes.
- **Critères d'acceptation** : pour une offre à prix fixe, le professionnel n'a qu'à vérifier le créneau, le lieu et l'échéance.
- **Dépend de** : rien.
- **Porte** : aucune.

### SV-05 — Catégories élargies et politique des professions réglementées · P1 · M · S2
- **Pour l'utilisateur** : trouver un traiteur, une couturière, un répétiteur, une animation de fête, une aide au déménagement.
- **Backend** : allonger `SERVICE_CATEGORIES` (le contrat permet d'ajouter, jamais de retirer) ; marquer certaines catégories « relecture obligatoire » (appui sur les lots MD-03 et MD-04 du plan 14) ; aucune catégorie de santé, de droit, de finance ni de garde d'enfants tant que la politique n'existe pas.
- **Web** : libellés français et anglais ; pastilles de catégories sur `/services` ; filtre de la fiche de page ; texte court qui dit ce que le catalogue n'accueille pas.
- **Mobile** : après le web.
- **Données personnelles** : aucune.
- **Tests et cliquets** : test de la liste fermée ; fragment de textes ; démonstration : une offre fictive par catégorie ouverte.
- **Critères d'acceptation** : une catégorie ne s'ouvre que si un prestataire volontaire existe dans la zone pilote ; aucune rubrique vide présentée.
- **Dépend de** : MD-03 du plan 14 ; plan 17 (recrutement du pilote).
- **Porte** : décisions 3 et 4 ; juriste pour le texte sur les professions réglementées.

### SV-06 — Trouver près de chez soi : villes desservies, pays d'entrée, langue, tri · P1 · M · S2
- **Pour l'utilisateur** : « coiffure » à « Paris » trouve aussi la coiffeuse de Montreuil qui dit desservir Paris ; le catalogue s'ouvre sur mon pays.
- **Backend** : villes desservies sur l'offre (borne à fixer, cinq proposé) et table d'index par ville dans la tranche ; ville ajoutée aux champs filtrés de l'index plein texte de `A:convex/modules/diaspora/servicesTables.ts` ; filtre par langue ; tri par prix dans une devise choisie. Les suggestions de villes viennent de la table des villes du lot HB-10 du plan 06 : elle n'est pas refaite ici.
- **Web** : pays de résidence appliqué d'entrée, pastille « Zone » retirable ; suggestions sous le champ ville (HB-10) ; budget et tri portés par `D:apps/diasporale_com/src/lib/routes.ts` ; lien « Services de ce pays » offert au hub (lot HB-04 du plan 06).
- **Mobile** : après le web.
- **Données personnelles** : aucune ; toujours aucun historique de recherche.
- **Tests et cliquets** : `no-unbounded-collect` ; ville sans offre : état vide qui propose le pays entier ; démonstration à parité.
- **Critères d'acceptation** : aucune position demandée ; une fenêtre de résultats n'est plus vide quand des offres existent ; l'adresse copiée rend la même recherche.
- **Dépend de** : HB-04 et HB-10 du plan 06 ; plan 03 (recherche transversale, qui lira le même catalogue).
- **Porte** : décision 5.

### SV-07 — Avis : prévenir l'équipe, inviter le demandeur, feuille de signalement commune · P1 · S · S2
- **Pour l'utilisateur** : la page sait qu'un avis vient de paraître ; le demandeur est invité à donner le sien ; signaler un avis se fait comme partout ailleurs.
- **Backend** : deux avis neutres dans `A:convex/modules/diaspora/serviceNotifications.ts` : à l'équipe vivante quand l'avis devient public, au demandeur à la fin d'un rendez-vous admissible, une fois ; tâche planifiée à la fin du rendez-vous. Issue `[S1]` : deux genres.
- **Web** : cloche (icônes, phrases dans les deux langues) ; `D:apps/diasporale_com/src/components/service-reviews-section.tsx` passe par la feuille commune, avec ses motifs, son accusé et « Mes signalements ».
- **Mobile** : après le web.
- **Données personnelles** : aucun contenu dans l'avis de cloche.
- **Tests et cliquets** : aucun avis de cloche pour un avis en attente ou retiré ; `notification-payload-content` ; `D:apps/diasporale_com/src/ratchets/i18n-keys.test.ts`.
- **Critères d'acceptation** : la page reçoit l'avis de cloche à la publication, jamais au dépôt ; une invitation n'est jamais renvoyée.
- **Dépend de** : SV-01 ; NP-05 du plan 13 ; MD-02 et MD-13 du plan 14 (feuille commune, motifs d'arnaque).
- **Porte** : aucune.

### SV-08 — Réalisations : photos de la page attachées à une offre · P1 · M · S2
- **Pour l'utilisateur** : voir le travail du professionnel avant de demander.
- **Backend** : champ facultatif de publications de la page attachées à l'offre (borne à fixer, six proposé) ; à la lecture, chaque publication est relue par la garde du moteur (même page, publiée, visible du lecteur) ; une publication retirée disparaît de l'offre. Aucun nouveau dépôt de fichier.
- **Web** : sélecteur parmi les photos publiées de la page dans `D:apps/diasporale_com/src/components/service-offer-form.tsx` ; une image sur la carte, une bande sur la fiche, avec la visionneuse existante.
- **Mobile** : après le web.
- **Données personnelles** : droit à l'image inchangé : celui de la publication d'origine.
- **Tests et cliquets** : publication d'une autre page refusée ; publication retirée ou masquée absente ; démonstration avec images fictives.
- **Critères d'acceptation** : aucune image servie hors de la garde de délivrance ; une offre sans image garde sa mise en page.
- **Dépend de** : plan 07 (médias de page) ; SD-02 et FP-01 du moteur pour le nettoyage des photos.
- **Porte** : décision 8.

### SV-09 — Plusieurs rendez-vous simultanés pour une page · P1 · S · S2
- **Pour l'utilisateur** : un salon à plusieurs collaborateurs confirme deux rendez-vous à la même heure.
- **Backend** : capacité simultanée dans les réglages de prestation de la page (SV-04) ; `slotTaken` compte les rendez-vous qui se chevauchent et refuse à partir de la capacité ; valeur par défaut : un.
- **Web** : réglage dans la gestion des services ; message de refus inchangé.
- **Mobile** : sans objet.
- **Données personnelles** : aucune.
- **Tests et cliquets** : capacité deux, trois accords concurrents : deux réussissent (R-G06 étendu).
- **Critères d'acceptation** : aucune sur-réservation au-delà de la capacité déclarée.
- **Dépend de** : SV-04.
- **Porte** : aucune.

### SV-10 — Problème sur un rendez-vous : professionnel absent, rendez-vous sans constat · P1 · M · S2
- **Pour l'utilisateur** : dire, preuve à l'appui du rendez-vous, que le professionnel n'est pas venu ou que la prestation ne correspond pas ; la page répond une fois.
- **Backend** : geste du demandeur, une fois, après le début et dans un délai à fixer, motif choisi dans une liste fermée et texte sans coordonnée ; l'état ne change pas, la trace se lit des deux côtés ; une réponse de la page ; avis neutre à l'équipe ; relance neutre de l'équipe quand un rendez-vous passé reste sans constat. Aucune décision de la plateforme sur le fond.
- **Web** : « Signaler un problème » sur la fiche du rendez-vous ; lien vers le signalement de la proposition ou de l'offre (lots MD-10 et MD-03 du plan 14) quand il y a tromperie.
- **Mobile** : après le web.
- **Données personnelles** : trace exportée aux deux parties ; effacée avec la demande.
- **Tests et cliquets** : second signalement refusé ; délai dépassé refusé ; `rate-limited-writes` ; démonstration à parité.
- **Critères d'acceptation** : la trace ne réécrit pas l'historique ; l'avis reste possible ; aucun texte ne promet une médiation.
- **Dépend de** : MD-03 et MD-10 du plan 14.
- **Porte** : décision 9 ; juriste pour les textes.

### DS-11 (volet favoris) — Retrouver : offres enregistrées · P2 · M · S2 · repris du plan 15
- **Pour l'utilisateur** : garder une offre et la retrouver.
- **Backend** : table `diasporaSavedItems` dans la tranche (réseau, personne, nature, identifiant, date) : c'est la brique commune ; nature « offre de service » ici, « offre d'emploi » (plan 10) et « annonce » (plan 12) ensuite. Gestes enregistrer et retirer, liste bornée par nature ; l'objet est relu, un objet retiré disparaît. Issue `[S1]` : seau de débit et politique de données.
- **Web** : bouton « Enregistrer » en `outline` sur la carte et la fiche ; onglet « Services » dans `D:apps/diasporale_com/src/screens/bookmarks-screen.tsx` : aucune nouvelle destination.
- **Mobile** : après le web.
- **Données personnelles** : privé ; exporté et effacé ; jamais montré ni compté pour le prestataire.
- **Tests et cliquets** : `no-unbounded-collect` ; offre retirée absente de la liste ; démonstration à parité.
- **Critères d'acceptation** : un enregistrement ne change aucun classement ; rien ne révèle qui a enregistré.
- **Dépend de** : plan 03 (écran des signets) ; issue `[S1]`.
- **Porte** : aucune.

### DS-12 — Disponibilités des prestataires et créneaux · P2 · L · S2 · repris du plan 15
- **Pour l'utilisateur** : voir quand le professionnel travaille, puis choisir un créneau libre au lieu d'attendre une proposition.
- **Backend** : en trois tranches. (a) Réglages de la page : SV-04 et SV-09. (b) Disponibilités déclarées : règles hebdomadaires et exceptions dans le fuseau IANA de la page, montrées comme une information, jamais comme une garantie. (c) Réservation directe pour une offre à prix et durée fixes : un geste crée la demande, la proposition tirée de l'offre et le rendez-vous dans la même transaction, avec le contrôle de capacité ; délai minimal et horizon réglés par la page.
- **Web** : éditeur de disponibilités dans la gestion des services ; sélecteur de créneaux sur la fiche de l'offre, heure donnée dans les deux fuseaux.
- **Mobile** : après le web.
- **Données personnelles** : disponibilités : donnée de la page ; export du demandeur inchangé.
- **Tests et cliquets** : deux réservations simultanées, une seule au-delà de la capacité (R-G06) ; heure inexistante ou double au changement d'heure refusée ; annulation qui libère le créneau.
- **Critères d'acceptation** : un créneau pris disparaît ; rien n'est présenté comme libre sans règle déclarée ; aucune pénalité, aucun paiement.
- **Dépend de** : SV-04, SV-09, SV-02, campagne DS-05.
- **Porte** : décision 10 ; aucun paiement.

### SV-11 — Demande enrichie : photo de référence, lieu souhaité, nombre de personnes · P2 · M · S2
- **Pour l'utilisateur** : montrer la coiffure voulue ; dire « chez moi » ou « chez le professionnel » ; dire pour combien de personnes.
- **Backend** : champs facultatifs sur `serviceRequests` (lieu souhaité dans une liste fermée, nombre borné) ; une image par la chaîne de fichiers du moteur, lue par les seuls participants. Issue `[S1]` : usage de fichier et garde de délivrance.
- **Web** : `D:apps/diasporale_com/src/components/service-request-entry.tsx` ; affichage côté page.
- **Mobile** : après le web.
- **Données personnelles** : image privée, exportée au demandeur, effacée avec la demande ; jamais dans un avis de cloche.
- **Tests et cliquets** : `file-delivery-gate`, `upload-policy` ; tiers refusé ; démonstration sans dépôt réel.
- **Critères d'acceptation** : l'image n'est servie qu'au demandeur et à l'équipe vivante ; un rôle retiré la ferme aussitôt.
- **Dépend de** : EX-17 et SD-02 du moteur.
- **Porte** : aucune.

### SV-12 — « Mon activité » : à traiter, rendez-vous à venir, délai de réponse · P2 · M · S2
- **Pour l'utilisateur** : le professionnel voit ce qui l'attend ; le demandeur voit, quand assez de demandes existent, sous quel délai la page répond.
- **Backend** : compteurs bornés par page (demandes sans réponse, rendez-vous à venir) ; délai médian de première réponse par page, calculé de nuit avec les agrégats du pilote, montré au public seulement au-dessus d'un seuil de demandes.
- **Web** : en-tête de `/mon-activite` et de la gestion de page ; mention sur la fiche de l'offre.
- **Mobile** : après le web.
- **Données personnelles** : agrégats de page, aucune personne.
- **Tests et cliquets** : aucun chiffre sous le seuil ; `crons-contract` si la tâche change (issue `[S1]`).
- **Critères d'acceptation** : aucun nombre inventé ; rien plutôt qu'un zéro.
- **Dépend de** : plan 17 (agrégats du pilote).
- **Porte** : décision 7 (seuils).

### SV-13 — Avis : moyenne sous seuil, tri, avis d'une relation · P2 · M · S2
- **Pour l'utilisateur** : une note d'ensemble quand elle a un sens ; lire d'abord l'avis d'une personne que je connais.
- **Backend** : agrégat par offre et par page des seuls avis publiés, recalculé à chaque publication ou retrait ; moyenne servie au-dessus d'un seuil ; tri récent ou par note ; marque « une de vos relations », calculée côté serveur à partir d'avis déjà publics.
- **Web** : en-tête de la liste des avis ; aucune note sur la carte du catalogue tant que le seuil n'est pas atteint.
- **Mobile** : après le web.
- **Données personnelles** : aucune donnée nouvelle ; jamais « X relations ont réservé ».
- **Tests et cliquets** : avis en attente ou retiré hors de l'agrégat ; blocage respecté.
- **Critères d'acceptation** : aucune moyenne sur deux avis ; la marque de relation ne révèle rien qui ne soit déjà publié.
- **Dépend de** : SV-01 ; données du pilote.
- **Porte** : décision 7.

### SV-14 — Partager une offre · P2 · S · S2
- **Pour l'utilisateur** : envoyer une offre à un proche, dans le réseau.
- **Backend** : aucun pour le lien ; la carte d'offre dans un message attend le lot IC-18 du moteur.
- **Web** : bouton de partage sur la fiche, sur le modèle de `D:apps/diasporale_com/src/components/page-share-button.tsx` ; le lien ouvre la porte d'entrée pour qui n'est pas membre.
- **Mobile** : feuille de partage du système avec le plan 16.
- **Données personnelles** : aucune.
- **Tests et cliquets** : lien d'une offre retirée : état neutre ; `no-hardcoded-urls`.
- **Critères d'acceptation** : aucun contenu de l'offre visible hors du réseau.
- **Dépend de** : IM-10 du plan 04 pour la carte dans iCom.
- **Porte** : aucune.

### SV-15 — Refuser les demandes d'une personne · P2 · S · S2
- **Pour l'utilisateur** : une page cesse de recevoir les demandes d'une personne qui abuse, sans la bloquer partout.
- **Backend** : liste par page, écrite par ses administrateurs ; l'envoi d'une demande est alors refusé de façon indistincte ; les blocages personnels entre le demandeur et l'auteur d'une proposition sont aussi relus à l'envoi.
- **Web** : geste dans la fiche d'une demande reçue ; liste dans la gestion de page.
- **Mobile** : après le web.
- **Données personnelles** : liste privée de la page ; issue `[S1]` pour sa politique de données.
- **Tests et cliquets** : refus indistinct ; retrait de la liste effectif.
- **Critères d'acceptation** : la personne écartée ne reçoit aucun signe distinct d'une offre indisponible.
- **Dépend de** : MD-10 du plan 14.
- **Porte** : aucune.

### DS-16 (volet services et avis) — Remontée dans le moteur des fonctions communes · P2 · L · S1 avec S2 · repris du plan 15
- **Pour l'utilisateur** : rien de visible ; ANTSIA gagne les avis sur preuve et la mise en relation légère sans second code.
- **Backend** : d'abord les règles pures communes (montants, heures murales, admissibilité d'un avis, contestation d'une absence) déplacées dans le domaine du moteur, que le domaine de DIASPORALE réexporte ; puis un seul mécanisme d'avis pour les deux réseaux (le lot UM-07 du moteur prend ceux de DIASPORALE pour modèle) ; enfin la décision de garder ou non deux catalogues (léger ici, PRO.GA là).
- **Web** : adaptateurs de DIASPORALE repointés, écrans inchangés.
- **Mobile** : sans objet.
- **Données personnelles** : un seul inventaire d'effacement ; aucune donnée déplacée sans migration écrite.
- **Tests et cliquets** : tests portés ; `no-cross-product-imports`.
- **Critères d'acceptation** : mêmes chemins d'API pour DIASPORALE, ou migration écrite ; aucune donnée perdue.
- **Dépend de** : plans 08 et 09 du moteur ; pilote terminé.
- **Porte** : décision 11.

### SV-16 — Demande ouverte à plusieurs prestataires · P3 · L · S2
- **Pour l'utilisateur** : décrire un besoin une fois ; les pages de la catégorie et de la ville peuvent proposer.
- **Contenu** : un seul mécanisme avec le « je cherche » du plan 12 (lot AN-14) ; propositions par la machine existante ; plafond de réponses ; relecture avant diffusion.
- **Dépend de** : AN-14 du plan 12 ; MD-03 du plan 14 ; SV-06.
- **Porte** : décision du propriétaire ; garde-fous contre la sollicitation.

### SV-17 — Services au pays : passerelle vers les prestataires du Gabon sur ANTSIA · P3 · S · S2
- **Pour l'utilisateur** : trouver, depuis DIASPORALE, un professionnel au Gabon pour un suivi de chantier ou une démarche.
- **Contenu** : un lien vers l'univers des services d'ANTSIA, où tout membre de DIASPORALE a déjà son adhésion ; aucun contenu d'ANTSIA mêlé au catalogue de DIASPORALE ; aucune tuile tant que cet univers est fermé ; même geste que le lot IM-12 du plan 04 pour la famille restée au pays.
- **Dépend de** : lot UM-01 du moteur (services d'ANTSIA ouverts).
- **Porte** : décision 12.

## 6. Ordre recommandé et dépendances

| Vague | Lots | Pourquoi dans cet ordre |
|---|---|---|
| 1 | SV-01, volet DS-05, avec le lot MD-03 du plan 14 | Rendre le parcours sûr et vrai avant d'y inviter un seul prestataire |
| 2 | SV-04, SV-09, SV-07, SV-02 | Le quotidien : répondre vite, ne pas refuser un second client, ne pas oublier |
| 3 | SV-06, SV-05, SV-08 | Trouver : la ville, la catégorie, l'image |
| 4 | SV-03, SV-10 | Les imprévus d'un rendez-vous |
| 5 | DS-11, SV-11, SV-12, SV-13, SV-14, SV-15 | Enrichissements, après les premiers retours du pilote |
| 6 | DS-12, DS-16 | Créneaux, puis convergence avec le moteur |
| Sous condition | SV-16, SV-17 | Décisions, plan 12, ouverture des services d'ANTSIA |

**Ce que ce plan attend des autres plans**

- **Plan 01** : un chemin réel vers l'adhésion vérifiée pour les premiers prestataires : membres fondateurs (EA-01), IDN (EA-02), attestation (DG-009a). Sans lui, aucune page, donc aucune offre.
- **Plan 04** : la conversation de la demande ouverte et recettée (DS-04, volet CC-V). C'est le seul canal de l'adresse et du téléphone.
- **Plan 14** : la nature de l'offre (MD-03), les responsables et les réglages (MD-01, MD-04), le signalement d'une demande (MD-10), les motifs d'arnaque (MD-13).
- **Plan 13** : genres d'avis (NP-05), export complet (NP-03), préférences et push (DS-14). **Plan 08** : l'écran `/agenda`. **Plan 03** : l'écran des signets et la recherche transversale. **Plan 06** : l'entrée « Services » du hub (HB-04) et la table des villes (HB-10). **Plan 07** : la création d'une page et ses médias. **Plan 02** : les couleurs des boutons (DS-02).
- **Plan 17** : la campagne DS-05, le compteur des recherches sans résultat (LX-09), le recrutement des prestataires du pilote, le lot D4.

**Volet de recette en mode moteur (campagne DS-05)** — backend local, comptes de démonstration `entreprise`, `declare`, `verifie`, `leger`, `canada`, `moderateur`, `administrateur` (docs/34 de DIASPORALE).

| # | Geste | Résultat attendu |
|---|---|---|
| 1 | `entreprise` publie une offre de coiffure à Paris, prix fixe | `declare` la trouve par « coiffure » et « Paris » ; `leger` la lit sans pouvoir demander |
| 2 | `declare` envoie sa demande, deux fois après une coupure | une seule demande, un seul avis de cloche chez `entreprise` (R-G05) |
| 3 | `entreprise` propose, puis modifie dans un second onglet | l'ancienne version est refusée à l'accord (R-G07) |
| 4 | `declare` et `verifie` acceptent deux propositions sur le même créneau | une seule réservation ; l'autre reçoit « créneau indisponible » (R-G06) |
| 5 | conversation ouverte par l'opérateur (DS-04) | adresse du salon admise en voix de page, refusée en voix de personne |
| 6 | après le début : « réalisée » sur une demande, « absence » sur une autre, puis contestation | états exacts, avis neutres, contestation lue des deux côtés |
| 7 | `administrateur` pose la politique ; `declare` note ; `moderateur` approuve ; `entreprise` répond | avis publié avec sa preuve, réponse publiée (SV-01) |
| 8 | `canada` lit une proposition faite à Paris | deux heures affichées, même instant (R-G21) |
| 9 | `entreprise` retire l'offre ; son rôle est retiré pendant sa session | lien conservé neutre ; gestes refusés aussitôt (R-G08, R-G11) |
| 10 | `declare` exporte ses données, puis demande l'effacement | export : la demande et l'avis y sont ; la proposition et le rendez-vous n'y viendront qu'avec le lot NP-03 du plan 13. Effacement : demande, propositions, rendez-vous et avis disparaissent ; la réponse de la page reste, anonymisée (R-G19) |

## 7. Décisions à prendre par le propriétaire

1. **Relire les offres avant publication, au lancement** (réglage du lot MD-04 du plan 14). Recommandation : oui pour les premières semaines du pilote, puis publication directe avec modération après coup. Raison : un faux professionnel coûte plus cher qu'un délai (invariant 10).
2. **Politique des avis.** Recommandation : relecture avant publication au début, publication directe ensuite. Raison : la preuve limite déjà les faux avis ; la relecture protège des règlements de compte.
3. **Catégories à ouvrir.** Recommandation : ajouter traiteur et cuisine, couture, cours et soutien scolaire, fêtes et cérémonies, déménagement ; n'ouvrir chacune que si un prestataire volontaire existe. Raison : le besoin du dossier produit, sans rubrique vide.
4. **Professions réglementées.** Recommandation : les tenir hors du catalogue, le dire à l'écran, et demander au juriste une politique par pays. Raison : D-G10.
5. **La ville.** Recommandation : villes desservies déclarées par le professionnel, sans rayon ni GPS. Raison : R-G04 et la vie privée.
6. **Rappel.** Recommandation : la veille en fin d'après-midi, dans le fuseau du rendez-vous, une seule fois, dans la cloche d'abord. Raison : la diaspora vit sur plusieurs fuseaux ; l'heure de Libreville n'a pas de sens ici.
7. **Chiffres montrés.** Recommandation : ni moyenne ni délai de réponse au pilote ; puis un seuil que vous fixez. Raison : aucun chiffre sans données réelles.
8. **Photos d'une offre.** Recommandation : réutiliser les publications de la page, sans nouveau dépôt. Raison : une seule chaîne de médias à sécuriser.
9. **Problème sur un rendez-vous.** Recommandation : une trace lisible des deux côtés et un signalement, sans médiation promise. Raison : la plateforme met en relation, elle ne tranche pas un litige ; texte à faire relire.
10. **Créneaux.** Recommandation : commencer par la capacité et les disponibilités déclarées ; la réservation directe seulement pour les offres à prix et durée fixes. Raison : sans paiement, aucune protection contre l'absence.
11. **Convergence avec le moteur (DS-16).** Recommandation : après le pilote, en commençant par les règles pures. Raison : ne pas déstabiliser ce qui marche.
12. **Services au pays et conservation.** Recommandation : pas de prestataire du Gabon dans DIASPORALE, une passerelle vers ANTSIA quand ses services ouvrent ; demander au juriste la durée de conservation des demandes closes. Raison : le réseau est réservé à la diaspora ; aucune durée ne s'invente.

## 8. Risques et points d'attention

- **Trois clés hors de ce plan** conditionnent le parcours : adhésion vérifiée d'un prestataire, politique contextuelle, politique des avis. Tant qu'une seule manque, « coiffeur à Paris » ne se joue pas en réel.
- **Faux professionnels** : une offre paraît aujourd'hui sans relecture ni signalement. L'attestation consulaire ne certifie pas une compétence ; le dire, et attendre le lot MD-03 du plan 14 avant tout recrutement.
- **Limite de la preuve** : « rendez-vous confirmé » ne prouve pas la prestation ; une page et un complice peuvent fabriquer un avis. Garder les deux mentions et la relecture.
- **Fichiers hors zone** : seaux, politiques de données, genres d'avis, tâches planifiées et natures modérées appartiennent à S1. Chaque lot le prévoit par une issue.
- **Deux implémentations** des services (tranche `diaspora`, univers PRO.GA d'ANTSIA, fermé par `A:convex/modules/shops/commerceActivation.ts`). Les noms `serviceReview` appartiennent à DIASPORALE ; ne pas les réutiliser côté ANTSIA.
- **Vocabulaire** : condition posée par ANTSIA le 18/10 : aucun mot de vente (« commande », « panier », « achat »). La variante de bouton `commerce` est un nom de couleur, pas un texte.
- **Données sensibles dans le besoin** : un texte libre peut dire la santé ou la situation d'une personne. Le garder aux seuls participants, hors des avis de cloche.
- **Charge** : le contrôle de créneau lit au plus 200 rendez-vous ; une recherche par texte et par ville peut rendre des fenêtres vides. À mesurer pendant la campagne.
- **Démonstration** : chaque capacité nouvelle doit y être servie (D-G13) ; les avis y restent en attente, ce qui doit rester dit.

## 9. Prompts d'implémentation

### Prompt SV-01
```text
Session S2 (DIASPORALE). Écris-moi en français. Opus seulement.
Lis le plan 09 (ligne 70 du § 2, lot SV-01), docs/19, docs/26, docs/recette/deux-comptes-2026-10-19.
Backend local seulement. Avec le compte administrateur de démonstration, pose la politique des surfaces serviceReview et serviceReviewReply, puis vérifie l'équipe du compte moderateur.
Joue : rendez-vous arrivé à terme → avis de declare → approbation → lecture par verifie → réponse de entreprise → approbation → avis de cloche. Rejoue sans politique : rien ne doit paraître.
Ajoute les tests qui manquent (avec et sans politique). Corrige seulement serviceReviews.ts et les écrans d'avis.
Livre : docs/recette/avis-services-<date>/RAPPORT.md, fait ou non fait par étape ; la procédure à reprendre dans le dossier de mise en production (DS-06). Verify vert. Aucune commande vers un déploiement en ligne.
```

### Prompt SV-02
```text
Session S2 (DIASPORALE). Écris-moi en français. Opus seulement.
Lis le plan 09 (lot SV-02), convex/modules/events/pageEventReminders.ts et pageEventCalendar.ts (patron seulement : ces fichiers sont à S1), docs/24_DATES_LIMITES et docs/29_EXPORT_ICAL.
Dépose l'issue [S1] : genre d'avis service_booking_reminder, seau de l'export. Demande-moi la décision 6 (moment du rappel) si elle n'est pas écrite.
Fais : tâche planifiée à l'accord, annulée à l'annulation ; avis neutre aux deux parties ; lectures « rendez-vous à venir » ; export iCal sans adresse ; section en tête de Mes demandes et de la boîte des demandes ; bouton de calendrier ; démonstration ; textes fr et en.
Tests : rendez-vous annulé ou passé sans rappel ; changement d'heure ; fuseaux Europe/Paris et America/Toronto.
Vérifie : verify vert ; recette à deux comptes ; fichier importé dans un calendrier. Arrête-toi avant de publier.
```

### Prompt SV-04
```text
Session S2 (DIASPORALE). Écris-moi en français. Opus seulement.
Lis : CLAUDE.md ; docs/etudes/2026-11-10-finalisation/00_PLAN_DIRECTEUR.md ; le plan 09 (lignes 43, 44 et 48 du § 2, lots SV-04 et SV-09) ; docs/17 § 4 ; docs/21.
Vérifie d'abord que le formulaire de proposition part toujours de « EUR », 60 minutes et d'un montant vide.
Branche claude/reglages-prestation depuis origin/main. Dépose l'issue [S1] : politique de données de la table des réglages (contenu de page).
Fais : table des réglages par page dans la tranche (fuseau, lieu approximatif, conditions habituelles, capacité simultanée) ; proposition préremplie depuis l'offre, les réglages et la première fenêtre du demandeur ; « Reprendre la version précédente » ; contrôle de créneau qui compte jusqu'à la capacité ; éditeur dans la gestion des services ; démonstration ; textes fr et en.
Tests : offre sur devis sans montant prérempli ; capacité deux, trois accords concurrents, deux réussissent ; refus des coordonnées dans les réglages.
Vérifie : bun run --cwd ../ANTSIA verify avec le verrou ; recette à deux comptes, 390 et 1280 px. Arrête-toi avant toute publication.
```

### Prompt SV-06
```text
Session S2 (DIASPORALE). Écris-moi en français. Opus seulement.
Lis le plan 09 (lignes 25 à 31 du § 2, lot SV-06), packages/diasporale-domain/src/services.ts, convex/modules/diaspora/services.ts et servicesTables.ts, docs/27.
Demande-moi la décision 5 (villes desservies, borne). Le changement d'index vit dans la tranche ; préviens S1, qui publie le backend.
Fais : villes desservies sur l'offre et leur table d'index ; ville dans les champs filtrés de l'index plein texte ; filtre langue ; tri par prix dans une devise ; pays de résidence appliqué d'entrée avec pastille retirable ; budget et tri dans la table des routes ; démonstration à parité.
Tests : « Paris » trouve une offre de Montreuil qui dessert Paris ; ville sans offre : vide expliqué ; aucune lecture non bornée.
Vérifie : verify vert ; recette à 390 et 1280 px. Aucune géolocalisation, aucun historique de recherche.
```

## 10. Sources lues

- Brief commun ; plan 15 d'ANTSIA (lignes 38 à 42, lots DS-11, DS-12, DS-16) ; plan directeur d'ANTSIA (§ 5.1) ; plans du moteur 09 (services, UM-01, UM-06 à UM-09, UM-12), 08 (CM-09, CM-16), 12 (MC-01, MC-06), 07 (PG-15), 01 (IC-18).
- DIASPORALE : cahier (§ 5, § 6, § 8), docs/14 (G4, G5, G9, G11, § 3, § 6.2), docs/17, 18, 19, 21, 24, 26, 27, 29, 32 (§ 7 à 12), 34 ; recette `deux-comptes-2026-10-19`.
- Plans frères du même dossier, pour les renvois (en-têtes de lots) : 01, 04, 06, 07, 10, 12, 13, 14, 17.
- Dossier produit : fiche F05 et § 5. Vault : décisions « avis admissibles et réponse de page », « mise en relation dans la tranche diaspora ».
- Code DIASPORALE : domaine (`services`, `service-requests`, `service-reviews`, `money`, `conversation-contexts`, `eligibility`, `pilot-metrics`, `demo-accounts`) ; ports et démonstration des services, des demandes et des avis ; adaptateurs moteur ; écrans `services-screens`, `service-request-screens`, `agenda-screen`, `hub-screen`, `explore-screen` ; composants `service-*`, `page-services-*`, `page-reviews-section`, `report-content-sheet` ; table des routes ; fragments de textes français.
- Code ANTSIA : tranche `diaspora` (`services`, `servicesTables`, `serviceRequests`, `serviceRequestsTables`, `serviceReviews`, `serviceReviewsTables`, `serviceNotifications`, `conversationContexts`, `moderationTargets`, `pilotMetrics`, `manifest`, `tables`) ; `pages/pages.ts`, `pages/access.ts` ; `moderation` (`cases`, `tables`) ; `notifications/tables.ts` ; `people/dataPolicies.ts`, `people/dataInventory.ts` ; `lib/rateLimit.ts` ; `crons.ts` ; `events/pageEventReminders.ts`, `events/pageEventCalendar.ts` ; `contextualMessaging` (`operator`, `access`) ; `shops/commerceActivation.ts` ; domaine du moteur (`moderationPolicy`, `moderation`, `serviceTime`, `pagePresentation`).
