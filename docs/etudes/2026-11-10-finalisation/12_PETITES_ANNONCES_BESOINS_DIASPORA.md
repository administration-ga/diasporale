# Plan 12 — Petites annonces et besoins propres à la diaspora

> Constaté par lecture du code d'`origin/main` (DIASPORALE `bead76d`, ANTSIA `fd58d73b`), le 10 novembre 2026. Rien n'a été exécuté : ni test, ni recette, ni publication.
> Applications de référence : Leboncoin, Facebook Marketplace, Vinted, Studapart, La Carte des Colocs, Cocolis, BlaBlaCar. Comparaison faite de mémoire, sans revérification en ligne ; un « ? » marque ce qui n'est pas sûr.
> Ce plan détaille, pour les petites annonces, le plan 15 du dossier de finalisation d'ANTSIA. Les lots qu'il en reprend gardent leur identifiant (DS-…, DG-…) ; les lots nouveaux portent le préfixe `AN-`.

Légende des chemins : `D:` = dépôt DIASPORALE, `A:` = dépôt ANTSIA. « Écran » = atteignable depuis l'interface de diasporale.com ; « Moteur » = la fonction existe côté serveur.

Cette fonctionnalité n'existe pas dans le code. Ce plan est donc d'abord un plan de conception : il prouve l'absence, dit ce qui est déjà posé autour, fait l'analyse métier par catégorie que le plan global exige avant tout code, puis découpe le travail. **Aucun lot n'ouvre une annonce au public avant les lots de conformité SU01a, b, c, d et h du moteur.**

## 1. L'intention du propriétaire

- **Pour qui** : le nouvel arrivant qui cherche une chambre, la famille qui déménage et vend ses meubles, le voyageur qui rentre au pays avec de la place dans sa valise (dossier produit d'origine, fiche F09 ; personas P1 et P2 du cahier § 6.1).
- **Quoi** : des annonces **structurées et cherchables**, à la place des groupes WhatsApp et Facebook où l'information se perd et où les arnaques au logement circulent (dossier produit § 1.1 et § 1.3 ; prompt PD8 de docs/01 de DIASPORALE : « les trois usages des groupes Facebook, en mieux »).
- **Exigence du cahier** (EXF-DG-36) : logement **réservé aux vérifiés**, biens, services, transport de colis ; contact par messagerie ; guide contre les arnaques ; signalement en un geste. Route prévue : `/annonces` (cahier § 10.1).
- **Parcours de référence R8** du cahier : une annonce de logement frauduleuse, signalée par trois membres, masquée pour eux, retirée par le modérateur du pays, avec recours. Ce parcours n'a aujourd'hui aucun support.
- **Déjà décidé** : fermé jusqu'à SU01 et jusqu'à une analyse par catégorie (plan 15, décision 7 ; DS-17 en P3). Le plan global (docs/14, G8) l'écrit : colis, cagnottes, logements avec encaissement et investissements collectifs « ne sont pas activés comme de simples catégories génériques ».
- **Aucun paiement** : la plateforme ne facture ni n'encaisse (D-G03) ; aucune publicité au pilote (D-G04) ; le citoyen ne paie jamais (cahier § 5, invariant 9). La « remontée en tête payante » et l'« annonce urgente » de la fiche F09 sont donc écartées pour le particulier.
- **Aucune coordonnée exposée** : le contact passe par la messagerie (cahier § 5, invariant 6) ; aucune adresse de domicile stockée (docs/32 § 7).
- **Refusé** : tontines et cagnottes tant qu'aucun établissement agréé ne porte les fonds (étude des sept univers d'ANTSIA § 3) ; financement de projets avant une étude distincte (docs/13 de DIASPORALE § 10).
- **Un levier d'élévation** : un compte léger qui veut publier un logement est conduit vers la vérification (spécifications de design d'origine, parcours « Élévation », écrans E13 et E23). L'annonce sert l'objectif 2.2 du cahier : amener à l'identité IDN et à l'inscription consulaire.
- **Aucun alias vide** : ni route, ni onglet, ni tuile avant de vraies annonces (ADR-0034 d'ANTSIA ; goûts du propriétaire).

## 2. Ce qui existe

Motifs cherchés dans le code des deux dépôts (`apps`, `packages`, `convex`), sans tenir compte de la casse : **M1** `classified`, `annonce`, `listing` · **M2** `sublet`, `sous-location`, `roommate`, `flatshare`, `colocation` · **M3** `parcel`, `colis`, `valise`, `luggage`, `carpool`, `covoiturage`, `rideshare` · **M4** `giveaway`, `à donner`, `secondhand`, `d'occasion`, `à vendre` · **M5** `savedSearch`, `searchAlert`, `searchNeed`, `jeCherche`, `savedItem`, `savedOffer`, `wishlist`, `favori` · **M6** `scam`, `fraud`, `arnaque`, `escroquerie` · **M7** `cagnotte`, `tontine`, `crowdfund`, `fundrais`, `remittance`, `transfert d'argent` · **M8** `prohibitedCategor`, `forbiddenCategor`, `bannedCategor`, `catégories interdites` · **M9** `funeral`, `obsèques`, `décès`, `rapatriement` (au sens funéraire).

| # | Capacité | État | Écran | Moteur | Preuve |
|---|---|---|---|---|---|
| 1 | Carte d'annonce : catégorie, titre, prix, pays et ville, déposant et badges, ancienneté | Partiel : composant présent, vignette en icône, sans photo ni donnée | `/charte` seulement | non | `D:packages/diasporale-features/src/components/cards/community-cards.tsx` (`ClassifiedCard`), `D:apps/diasporale_com/src/screens/charte-screen.tsx` |
| 2 | Forme de données d'une annonce pour l'écran | Partiel : ni photos, ni sens, ni échéance, ni état | non | non | `D:packages/diasporale-features/src/data/types.ts` (`ClassifiedView`) |
| 3 | Liste fermée des catégories et libellés fr et en | Partiel : cinq valeurs (`housing`, `goods`, `services`, `parcel`, `other`) ; ni dons ni covoiturage ; `services` double le catalogue des pages | non | non | `D:packages/diasporale-features/src/data/types.ts` (`CLASSIFIED_CATEGORIES`), `D:packages/diasporale-features/src/i18n/locales/fr/diasporale.json`, `D:apps/diasporale_com/src/ratchets/i18n-keys.test.ts` |
| 4 | Onglet « Annonces » du hub d'un pays | Partiel : déclaré et traduit, jamais passé par le hub | non | non | `D:packages/diasporale-features/src/components/community-controls.tsx` (`COMMUNITY_TABS`), `D:apps/diasporale_com/src/screens/hub-screen.tsx` |
| 5 | Relecture préalable imposable à une surface (« annonces au lancement ») | Partiel : règle pure prête, aucun appelant pour des annonces | non | non | `D:packages/diasporale-domain/src/moderation.ts` (`publicationPolicy`, `surfaceForcesReview`) |
| 6 | Route et rubrique `/annonces` | Absent (voulu : aucun alias vide) | non | non | motifs : M1 dans `D:apps/diasporale_com/src/lib/routes.ts` et dans `D:apps/diasporale_com/src/app` |
| 7 | Table et fonctions d'annonces | Absent : aucune table au manifeste de la tranche (le cahier § 11 prévoyait `classifieds`), aucun module d'annonces dans le moteur | non | non | `A:convex/modules/diaspora/manifest.ts` ; motifs : M1 dans `A:convex` |
| 8 | Capacité « annonces » du port de données | Absent | non | non | `D:packages/diasporale-features/src/data/port.ts` (aucune entrée) |
| 9 | Annonces fictives du fournisseur de démonstration | Absent | non | non | motifs : M1 dans `D:packages/diasporale-features/src/demo` |
| 10 | Déposer une annonce en étapes (catégorie, détails, photos, prix et lieu, aperçu) | Absent | non | non | motifs : M1 |
| 11 | Brouillon d'annonce repris plus tard | Absent | non | non | motifs : M1 |
| 12 | Photos d'une annonce (plusieurs, ordre, texte alternatif) | Absent ; brique : règles des médias d'une publication | non | non | `D:packages/diasporale-features/src/data/media.ts` |
| 13 | Photos nettoyées de leurs métadonnées avant l'envoi | Absent : en mode moteur le fichier part tel quel ; la réduction ne sert que la démonstration | non | non | `D:apps/diasporale_com/src/data/engine-source.ts` (`uploadMedia`), `D:packages/diasporale-features/src/data/media.ts` (`downscaleImage`) ; lot SD-02 du moteur |
| 14 | Prix avec devise du pays (fixe, à débattre, gratuit) | Absent ; brique : montants en unités mineures, onze devises | non | non | `D:packages/diasporale-domain/src/money.ts` |
| 15 | Ville saisie sans GPS, quartier sans adresse | Absent ; brique : ville normalisée | non | non | `D:packages/diasporale-domain/src/services.ts` (`cityKeyOf`, `parseServiceCity`) |
| 16 | Portée de l'annonce (mon pays, toute la diaspora) | Absent | non | non | motifs : M1 |
| 17 | Refus d'une coordonnée ou d'une adresse dans le titre et le texte | Absent ; briques prêtes | non | non | `D:packages/diasporale-domain/src/services.ts` (`containsContactDetails`), `D:packages/diasporale-domain/src/service-requests.ts` (`containsExactAddress`) |
| 18 | Aperçu avant publication et rappel des règles | Absent | non | non | motifs : M1 |
| 19 | Publication à l'abri d'un double appui ou d'une coupure | Absent | non | non | motifs : M1 |
| 20 | Liste par catégorie | Absent | non | non | motifs : M1 |
| 21 | Filtre par pays et par ville | Absent ; patron d'adresse prêt | non | non | `D:apps/diasporale_com/src/lib/routes.ts` (`zoneHref`) |
| 22 | Filtre par prix | Absent | non | non | motifs : M1 |
| 23 | Sens de l'annonce : « je propose » ou « je cherche » | Absent | non | non | motifs : M5 |
| 24 | Recherche par mots | Absent | non | non | motifs : M1 |
| 25 | Tri par date | Absent | non | non | motifs : M1 |
| 26 | Fiche d'une annonce (photos, prix, lieu, déposant, ancienneté) | Absent | non | non | motifs : M1 |
| 27 | Annonces d'un pays dans son hub | Absent (voir ligne 4) | non | non | `D:apps/diasporale_com/src/screens/hub-screen.tsx` |
| 28 | Annonces d'un membre sur son profil | Absent | non | non | motifs : M1 |
| 29 | Envoyer une annonce dans une conversation | Absent | non | non | motifs : M1 |
| 30 | Enregistrer une annonce | Absent : les signets ne visent que les publications | non | non | `A:convex/modules/marks/marks.ts`, `D:apps/diasporale_com/src/screens/bookmarks-screen.tsx` |
| 31 | Alerte sur une recherche | Absent | non | non | motifs : M5 |
| 32 | « Écrire à l'annonceur » sans relation préalable ni coordonnée | Absent : la messagerie personnelle exige une relation ; aucune nature de conversation pour une annonce | non | non | `A:convex/modules/messaging/inbox.ts` (`startThreadWithHandle`), `A:convex/modules/contextualMessaging/registry.ts` |
| 33 | Message prérempli (« Toujours disponible ? ») | Absent | non | non | motifs : M1 |
| 34 | Rappel de prudence à l'ouverture de la conversation | Absent | non | non | motifs : M6 |
| 35 | Conversation fermée quand l'annonce est retirée | Absent | non | non | `A:convex/modules/contextualMessaging/registry.ts` |
| 36 | Appel depuis la conversation d'une annonce | Absent | non | non | idem |
| 37 | « Mes annonces » avec leurs états | Absent | non | non | motifs : M1 |
| 38 | Modifier une annonce publiée | Absent | non | non | motifs : M1 |
| 39 | Marquer « vendu », « donné », « pourvu » | Absent | non | non | motifs : M1 |
| 40 | Échéance et retrait automatique | Absent ; patron : clôture horaire des offres d'emploi | non | non | `A:convex/crons.ts`, `A:convex/modules/diaspora/jobs.ts` (`closeExpiredJobOffers`) |
| 41 | Renouveler avant l'échéance | Absent | non | non | motifs : M1 |
| 42 | Rappel « votre annonce expire », sans contenu | Absent ; brique : avis communautaires neutres | non | non | `A:convex/modules/diaspora/communityNotifications.ts` |
| 43 | Quota d'annonces actives selon le statut | Absent ; brique : seaux renforcés des comptes sans badge | non | non | `A:convex/lib/rateLimit.ts` |
| 44 | « Passer pro » : de l'annonce à la page | Absent ; brique : créer une page est réservé aux vérifiés | non | non | `D:packages/diasporale-domain/src/eligibility.ts` (`create_page`) |
| 45 | Logement réservé aux membres vérifiés | Absent : aucune capacité propre aux annonces | non | non | `D:packages/diasporale-domain/src/eligibility.ts` (`MEMBER_CAPABILITIES`) |
| 46 | Signaler une annonce | Absent : aucune nature d'annonce parmi les cibles | non | non | `A:convex/modules/moderation/tables.ts`, `D:packages/diasporale-features/src/data/content-reports-port.ts` |
| 47 | Motif de signalement « arnaque ou fraude » | Absent : douze motifs sans arnaque ; seul le signalement d'un avis de service connaît `fraud` | non | non | `A:packages/social-domain/src/moderation.ts` (`CONTENT_REPORT_REASONS`), `D:packages/diasporale-features/src/data/service-reviews-port.ts` ; lots NU-01 et MC-06 du moteur |
| 48 | Relecture de chaque annonce avant publication, à l'ouverture d'un pays | Absent (voir ligne 5) | non | non | `D:packages/diasporale-domain/src/moderation.ts` |
| 49 | Annonce au bureau de modération (aperçu borné, décision, recours) | Absent | non | non | `A:convex/modules/diaspora/moderationTargets.ts` (neuf natures, aucune annonce) |
| 50 | Objets et catégories interdits | Absent | non | non | motifs : M8 ; lot CM-02 du moteur pour le commerce |
| 51 | Guide « Éviter les arnaques » | Absent | non | non | motifs : M6 |
| 52 | Mention « DIASPORALE n'est pas partie à la transaction » | Absent | non | non | motifs : M6 |
| 53 | Limites des comptes récents sur les annonces | Absent | non | non | lot MC-07 du moteur |
| 54 | Logement : type, loyer, charges, meublé, dates, dépôt affiché | Absent | non | non | motifs : M2 (seuls des textes d'entraide et du kit d'arrivée répondent) |
| 55 | Logement : déclaration « j'ai le droit de proposer ce logement » | Absent | non | non | motifs : M2 |
| 56 | Colis vers le Gabon : trajet, date, kilos, ce que le voyageur refuse | Absent comme annonce ; l'usage passe par une publication libre du fil | non | non | motifs : M3 ; exemple de démonstration dans `D:packages/diasporale-features/src/demo/state.ts` |
| 57 | Covoiturage : départ, arrivée, date, places | Absent | non | non | motifs : M3 (aucun résultat pour le covoiturage) |
| 58 | Objets d'occasion : état, remise en main propre | Absent | non | non | motifs : M4 |
| 59 | Dons | Absent | non | non | motifs : M4 |
| 60 | « Je cherche » (logement, objet, trajet) | Absent comme annonce ; aujourd'hui une question d'entraide de thème logement ou transport | non | non | motifs : M5 ; `A:convex/modules/diaspora/mutualAid.ts` |
| 61 | Annonces dans l'export et l'effacement du compte | Absent ; brique : inventaire des tables | non | non | `A:convex/modules/people/dataPolicies.ts` |
| 62 | Annonces dans la mesure du pilote | Absent | non | non | `A:convex/modules/diaspora/pilotMetrics.ts` |
| 63 | Annonces sur le téléphone | Absent : aucune application mobile DIASPORALE | non | non | `D:apps` |
| 64 | Cagnotte, tontine, transfert ou change d'argent | Absent, voulu | non | non | motifs : M7 (seul un dossier fictif du bureau de démonstration cite une cagnotte extérieure) |
| 65 | Rapatriement d'un corps, obsèques | Absent, voulu | non | non | motifs : M9 |
| 66 | Vente de produits alimentaires du pays par un particulier | Absent, voulu ; la page d'entreprise du secteur alimentation existe | non | non | `A:packages/social-domain/src/pagePresentation.ts` (`PAGE_COMPANY_SECTORS`) |

Décompte : **Présent 0 · Partiel 5 · Absent 61 · Fermé 0**.

### Ce que le moteur sait déjà faire et que DIASPORALE ne montre pas

Pour les annonces : rien. Le moteur n'a ni table ni fonction d'annonce de particulier ; son plan 10 les prévoit (SU07a, à faire). Les boutiques et la marketplace d'ANTSIA ne sont pas montées dans DIASPORALE par décision (D-G01 : aucun lien PRO.GA) : ce n'est pas un gain rapide. Ce qui existe déjà et que les annonces réemploieront :

| Brique | Où | Ce qu'il lui manque pour une annonce |
|---|---|---|
| Conversation attachée à un objet, sans relation ni coordonnée | `A:convex/modules/contextualMessaging/registry.ts`, `A:convex/modules/diaspora/conversationContexts.ts`, `D:apps/diasporale_com/src/components/contextual-conversations.tsx` | Une nature pour l'annonce (quatre natures admises, aucune) ; la politique est fermée par défaut (`A:convex/modules/contextualMessaging/operator.ts`, `setPolicy`) |
| Signalement par une porte unique, masque pour le déclarant, bureau par pays, délais légaux | `D:apps/diasporale_com/src/components/report-content-sheet.tsx`, `A:convex/modules/diaspora/moderationTargets.ts` | Une nature d'annonce au validateur fermé ; le motif « arnaque » |
| Relecture par pays, publication directe à deux modérateurs actifs | `D:packages/diasporale-domain/src/moderation.ts` | Un appelant |
| Signets de publications | `A:convex/modules/marks/marks.ts`, `D:apps/diasporale_com/src/app/enregistrements/page.tsx` | La brique « Enregistrer » du plan 09 (DS-11, volet favoris), à construire |
| Statut dérivé, capacités, badges calculés | `D:packages/diasporale-domain/src/eligibility.ts` | Une règle par catégorie |
| Montants, devises, ville saisie, refus des coordonnées et de l'adresse | `D:packages/diasporale-domain/src/money.ts`, `D:packages/diasporale-domain/src/services.ts` | Rien : réemploi direct |
| Clôture planifiée par lots, avis neutres, inventaire d'effacement | `A:convex/crons.ts`, `A:convex/modules/diaspora/communityNotifications.ts`, `A:convex/modules/people/dataPolicies.ts` | Les lignes des annonces |

### Ce qui est écrit mais jamais recetté en réel

- Rien n'est écrit, donc rien n'est à recetter. La carte n'a été vue que sur la page de la charte.
- **Les annonces existent de fait dans le fil.** La publication libre ne juge que sa longueur (`A:packages/social-domain/src/content.ts`, `assertPostContent`) : ni catégorie, ni échéance, ni statut exigé, ni refus d'un numéro de téléphone. Le fournisseur de démonstration le montre : une publication fictive propose de la place dans une valise « pour des médicaments ou des courriers » (`D:packages/diasporale-features/src/demo/state.ts`). Cet usage n'a jamais été mesuré ni recetté.
- Le parcours R8 du cahier (annonce de logement frauduleuse) n'a jamais pu être joué. La recette en ligne du 22/10 a porté sur une publication, pas sur une annonce.

## 3. Comparaison avec les applications de référence

« oui » = fonction connue de mémoire ; « ? » = non affirmé ; « — » = sans objet.

| Capacité | Leboncoin | Marketplace | Vinted | Studapart | Carte des Colocs | Cocolis | BlaBlaCar | DIASPORALE | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Déposer en quelques étapes, avec photos | oui | oui | oui | oui | oui | oui | oui, sans photo | non | À faire (AN-06) |
| Catégories fermées, champs propres | oui | oui | oui | logement seul | colocation seule | colis seul | trajet seul | cinq libellés sans champs | À faire (AN-02, AN-06) |
| Annonce de recherche (« je cherche ») | oui ? | non ? | non | dossier du locataire | oui | oui (l'expéditeur publie) | non (alerte) | non | À faire (AN-14) |
| Dons | oui | oui | non | — | — | — | — | non | À faire (AN-06) |
| Recherche par lieu | carte et rayon | rayon | non (envoi) | ville, école | carte | trajet | trajet | non | À adapter : ville saisie, sans GPS ni carte (AN-07) |
| Filtres de prix et de date | oui | oui | oui | oui | oui | oui | oui | non | À faire (AN-07) |
| Alerte sur une recherche | oui | ? | oui ? | ? | oui ? | ? | oui | non | À faire (AN-14) |
| Enregistrer une annonce | oui | oui | oui | oui ? | oui ? | ? | — | signets de publications seulement | À faire (AN-15) |
| Messagerie intégrée | oui | oui | oui | oui ? | oui | oui | oui | non | À faire (AN-09) |
| Numéro de téléphone affiché | au choix du déposant | non | non | ? | ? | ? | après réservation ? | jamais | Écarté (cahier § 5, invariant 6) |
| Message prérempli | oui ? | oui | non ? | — | — | — | — | non | À faire (AN-09) |
| Identité du déposant vérifiée | en partie ? | non | en partie ? | oui ? | non ? | oui ? | oui | badge calculé | À adapter : afficher le badge et l'ancienneté (AN-07) |
| Catégorie à risque réservée aux vérifiés | non | non | non | ? | non | ? | ? | non | À faire (AN-11, AN-12) |
| Paiement protégé | oui | selon le pays ? | oui | oui | non ? | oui | oui | non | Écarté (D-G03 ; plan 17 pour toute suite) |
| Assurance | non ? | non | protection de l'acheteur | garant payant | non | oui | oui | non | Écarté : aucun produit d'assurance |
| Avis après transaction | oui | oui | oui | ? | non ? | oui | oui | non | Écarté : pas d'engagement prouvé sans paiement (règle des avis sur preuve, DG-016) |
| Durée de vie, renouvellement | oui ? | oui ? | non ? | — | ? | date du trajet | date du trajet | non | À faire (AN-08) |
| Marquer vendu ou pourvu | oui | oui | oui | oui ? | oui ? | oui | — | non | À faire (AN-08) |
| Mise en avant payante | oui | oui | oui | ? | ? | ? | non | non | Écarté pour le particulier (cahier § 5, invariant 9) |
| Compte professionnel distinct | oui | ? | oui ? | oui | ? | oui ? | non | page d'entreprise | À adapter (AN-16) |
| Signaler une annonce | oui | oui | oui | oui ? | oui | oui | oui | non | À faire (AN-10) |
| Conseils de prudence dans le parcours | oui | oui | oui | ? | oui ? | oui ? | oui | non | À faire (AN-01) |
| Objets interdits publiés | oui | oui | oui | — | — | oui | — | non | À faire (AN-02, AN-04) |
| Dossier du locataire, garant | non ? | non | — | oui | non ? | — | — | non | Écarté : engagement financier ; ressource du kit d'arrivée (plan 11) |
| Demande de visite avec créneaux | non ? | non | — | oui ? | non | — | — | non | Reporté : après le logement, sur le modèle de SU04 du moteur |
| Trajet daté, places ou kilos | — | — | — | — | — | oui | oui | non | À faire (AN-12, AN-13) |
| Prix encadré, partage des frais | — | — | — | — | — | prix suggéré ? | oui | non | À adapter : aucun calcul, participation à convenir (décision 7) |
| Vues de l'annonce pour le déposant | oui | oui | oui | ? | ? | ? | — | non | Reporté : aucun compteur avant mesure (plan 17) |
| Relecture avant publication | oui ? | automatique ? | automatique ? | oui ? | ? | ? | ? | règle prête, sans appelant | À faire (AN-10), par pays |
| Partage hors de l'application | oui | oui | oui | oui | oui | oui | oui | non | Écarté : réseau fermé, visibilité `network` |
| Application mobile, photo depuis l'appareil | oui | oui | oui | oui ? | oui | oui | oui | non | Reporté (AN-18, plan 16) |

## 4. Ce qui manque

### 4.1 Bloquant avant l'ouverture du pilote

Rien de ce plan ne bloque le pilote : les annonces restent fermées (DS-17, P3). Deux points sont pourtant à régler avant, parce que les annonces existent déjà de fait dans le fil et dans l'entraide :
1. Aucun texte ne met en garde contre les arnaques au logement ou à l'acompte, et aucun motif « arnaque » ne permet de les signaler comme telles. Le guide est le lot AN-01 ; le motif vient du moteur (NU-01, MC-06) et du plan 14.
2. Le parcours R8 du cahier ne peut pas se jouer sur une annonce. Le plan 17 doit dire s'il le joue sur une publication ou s'il le reporte à l'ouverture des annonces.

### 4.2 Fonctions attendues qui manquent

Toute la rubrique : déposer une annonce avec photos, la retrouver par catégorie, ville et prix, lire une fiche, écrire au déposant sans être en relation, gérer « Mes annonces » (états, échéance, renouvellement, pourvue), enregistrer, être prévenu, publier un « je cherche », signaler. Et, par catégorie, les champs qui font la différence avec une publication libre : loyer et dates pour un logement, trajet et date pour un colis ou un covoiturage.

### 4.3 Options qui manquent sur ce qui existe

- **Carte** : pas de photo (une icône), pas de sens « je cherche », pas d'état (« pourvue », « expire bientôt »), pas de date de voyage.
- **Forme de données** : ni photos, ni sens, ni échéance, ni état de modération, ni identifiant du déposant pour ouvrir une conversation.
- **Catégories** : `services` fait doublon avec le catalogue des pages (D-G02) ; `other` est un déversoir ; les dons et le covoiturage manquent.
- **Onglet du hub** : déclaré, jamais monté.
- **Signalement** : pas de nature d'annonce, pas de motif « arnaque ».
- **Conversation attachée à un objet** : pas de nature d'annonce ; la règle de texte refuse l'adresse exacte en voix de personne, ce qui pose la question du lieu d'une visite (décision 8).
- **Signets** : publications seulement.

### 4.4 Améliorations de l'existant

- Retirer « médicaments » de la publication fictive « place dans ma valise » : la démonstration ne doit pas banaliser un transport que les règles interdiront (AN-01).
- Appliquer au texte des publications du réseau la garde des coordonnées déjà en place pour les services, l'emploi, l'entraide et le kit d'arrivée : cela relève du plan 03, signalé ici.
- Monter le rappel de prudence sur les questions d'entraide de thème logement et transport, en accord avec le plan 11.
- Rendre le fournisseur de démonstration cohérent : la page fictive « Valise solidaire » dit bien qu'un service régulier de colis relève d'une page d'entreprise.

### 4.5 Ce qui distingue DIASPORALE

- **Le logement réservé aux vérifiés**, par attestation consulaire ou IDN : aucune référence généraliste ne le fait.
- **L'annonce comme levier d'élévation** vers l'identité numérique et l'inscription consulaire.
- **Aucune coordonnée, aucune adresse** : le premier contact reste dans un fil signalable et fermable.
- **Le pays et la ville comme contexte**, sans GPS, avec une modération du pays et une relecture à l'ouverture.
- **Le colis vers le Gabon**, catégorie née de la diaspora ; les références de transport entre particuliers ne semblent pas la servir (« ? », à vérifier).
- **L'honnêteté** : la plateforme dit qu'elle n'est partie à aucune transaction, ne vend aucune mise en avant, ne promet aucune garantie.
- **Le faible débit** : liste sans carte, photos allégées, filtres au serveur.

### 4.6 Écarté ou reporté, et pourquoi

| Sujet | Sort | Raison | Ce que DIASPORALE offre à la place, sans encaissement |
|---|---|---|---|
| Cagnotte de solidarité (deuil, maladie, rapatriement) | Fermé | Des fonds seraient collectés ou portés : établissement agréé exigé (étude des sept univers § 3) ; risque de fausse collecte | Publication épinglée et évènement d'une association vérifiée, mission bénévole (plans 07, 08, 11) ; un lien extérieur reste sous la seule responsabilité de l'association et se signale |
| Tontine | Fermé | Épargne tournante : tenue de comptes et litiges entre membres | Groupe privé d'association pour s'organiser, sans outil de cotisation (plan 07) |
| Transfert et change d'argent entre particuliers | Fermé, et interdit en annonce | Service de paiement réglementé ; à confirmer par le juriste | Aucune mise en relation ; règle écrite (AN-04) |
| Rapatriement d'un corps, obsèques | Fermé | Services funéraires et assurance réglementés ; personnes vulnérables | Ressource datée du kit d'arrivée, page officielle du poste, associations de solidarité (plans 11, 15, 07) |
| Billetterie, revente de billets | Fermé | Paiement fermé (D-G03) ; billets nominatifs | Inscription gratuite et billet QR des évènements (plan 08) |
| Produits alimentaires du pays, commerce régulier | Hors annonces | Activité commerciale, règles sanitaires et douanières | Page d'entreprise du secteur alimentation et ses publications (plan 07) |
| Terrain ou maison à acheter au Gabon | Renvoyé à ANTSIA | Doubles ventes ; l'univers Immobilier d'ANTSIA portera le contrôle du document (SU04, SU15) | Rien avant l'ouverture de cet univers |
| Garant de logement | Écarté | Engagement financier | Ressource du kit d'arrivée (plan 11) |
| Paiement protégé, envoi organisé, assurance | Écarté | D-G03 | Remise en main propre, rappel de prudence |
| Mise en avant payante, « annonce urgente » | Écarté | Le citoyen ne paie jamais | Offre professionnelle éventuelle au plan 17 |
| Avis sur un déposant | Écarté | Aucun engagement prouvé | Badge calculé et ancienneté |
| Catégorie « Services » entre particuliers | Écarté | Double le catalogue des pages (D-G02) | « Passer pro » (AN-16) |
| Annonce visible d'ANTSIA | Reporté | Contexte séparé | Décision 10 |
| Carte, géolocalisation | Écarté | Ville saisie sans GPS (plan global, G4) | — |
| Vues d'une annonce | Reporté | Ne rien compter avant mesure | — |

### 4.7 Analyse métier par catégorie

C'est le préalable exigé par le plan global (G8) et par DS-17. Toutes les valeurs chiffrées sont des **propositions de réglage, pas des mesures** (décision 4).

| Catégorie | Qui publie | Qui écrit au déposant | Ce que dit l'annonce | Prix | Durée de vie | Risque premier | Parade | Rang d'ouverture |
|---|---|---|---|---|---|---|---|---|
| Dons | déclaré ou vérifié | déclaré ou vérifié | objet, état, ville, photos | aucun | 30 jours | faux don servant d'appât, objet interdit | relecture, liste d'interdits | 1 |
| Objets d'occasion | déclaré ou vérifié | déclaré ou vérifié | objet, état, ville, remise en main propre, photos | fixe ou à débattre, devise du pays | 30 jours | acompte, objet volé ou contrefait | rappel de prudence, aucun envoi organisé, motif « arnaque » | 1 |
| « Je cherche » | déclaré ou vérifié | déclaré ou vérifié | besoin, ville, période | sans montant imposé | 30 jours | faux offreur qui démarche le chercheur | privé par défaut, rappel dans le fil | 2 |
| Covoiturage | conducteur vérifié ; passager déclaré | déclaré ou vérifié | départ, arrivée, date, places | participation à convenir | jusqu'au jour du trajet | sécurité des personnes ; transport rémunéré déguisé | vérifié, aucun calcul de prix, question au juriste | 3 |
| Logement (location, colocation, sous-location, hébergement court) | vérifié seulement | déclaré ou vérifié | type, ville et quartier sans adresse, loyer et charges, meublé, dates, dépôt **affiché** | loyer mensuel, devise du pays | 30 jours | faux bailleur, acompte avant visite, sous-location sans droit | vérifié, déclaration cochée, relecture maintenue, deux annonces actives au plus | 4 |
| Colis vers le Gabon (place offerte, colis à confier) | vérifié seulement | déclaré ou vérifié | villes, date du voyage, kilos, ce que le voyageur refuse | participation à convenir | jusqu'au jour du voyage | contenu interdit ou dangereux, argent liquide, responsabilité du voyageur | vérifié, liste d'interdits, déclaration cochée, relecture maintenue, avis du juriste | 5 |

Règles communes : un compte en attente lit et ne fait rien d'autre ; cinq annonces actives pour un vérifié, deux pour un déclaré ; visibilité `network` ; portée locale par défaut ; ville saisie, jamais d'adresse ; texte sans coordonnée ; photos nettoyées avant l'envoi (SD-02) ; contact par une conversation attachée à la prise de contact, jamais par la messagerie personnelle ; aucune annonce d'emploi (plan 10), de service (plan 09), d'évènement (plan 08) ni de commerce régulier (page d'entreprise).

## 5. Lots d'implémentation

Choix d'architecture retenu par ces lots (décision 1) : **un seul module d'annonces, celui du moteur (SU07a)**, réglé par réseau ; DIASPORALE apporte ses règles, sa surface et ses textes. Les noms de fichiers à créer sont des propositions.

### AN-01 — Guide « Éviter les arnaques » et rappel de prudence · P1 · S · S2
- **Pour l'utilisateur** : une page courte dit ce qu'il ne faut jamais faire (verser un acompte avant d'avoir vu, payer sans reçu, envoyer une pièce d'identité à un inconnu), comment signaler, et que DIASPORALE n'est partie à aucune transaction. Le même rappel tient en une ligne là où les annonces de fait circulent.
- **Backend** : aucun.
- **Web** : écran de contenu sur le patron de `D:apps/diasporale_com/src/screens/legal-screen.tsx` ; route déclarée dans `D:apps/diasporale_com/src/lib/routes.ts` ; lien depuis le pied de page ; composant de rappel réutilisable dans `@diasporale/features` ; premier montage sur les questions d'entraide de thème logement et transport ; fragment de textes `safety-guide` en fr et en ; la publication fictive `post-2` de `D:packages/diasporale-features/src/demo/state.ts` ne propose plus de porter des médicaments.
- **Mobile** : même texte, avec le plan 16.
- **Données personnelles** : aucune.
- **Tests et cliquets** : `i18n-keys`, `no-hardcoded-strings` ; test d'écran (lien et rappel rendus).
- **Critères d'acceptation** : la page s'ouvre depuis le pied de page à 390 et 1280 px, en clair et en sombre ; le rappel apparaît sur une question d'entraide de thème logement ; aucune phrase ne dit « garanti », « sécurisé » ou « vérifié par DIASPORALE » ; le texte cite le motif « arnaque » seulement quand il existe.
- **Dépend de** : plan 02 (place de l'aide dans la coque), plan 11 (écran de l'entraide), plan 14 (motif repris de MC-06).
- **Porte** : relecture du texte par le propriétaire.

### AN-02 — Règles pures des annonces dans le domaine · P2 · M · S2
- **Pour l'utilisateur** : rien de visible ; l'écran et le serveur refuseront exactement la même chose.
- **Backend** : aucun. Domaine pur dans `packages/diasporale-domain/src/classifieds.ts` (à créer) : catégories et sens ; statut exigé pour publier et pour écrire, par catégorie ; quotas ; durée de vie et échéance ; états et transitions (brouillon, en relecture, publiée, pourvue, expirée, retirée) ; prix par `D:packages/diasporale-domain/src/money.ts` ; ville par `cityKeyOf` ; refus des coordonnées et de l'adresse ; liste fermée des objets interdits ; seuil de « Passer pro ».
- **Web** : `CLASSIFIED_CATEGORIES` lit le domaine ; `ClassifiedView` gagne sens, photos, échéance et état ; la carte de la charte suit. Aucune route.
- **Mobile** : règles partagées telles quelles.
- **Données personnelles** : aucune.
- **Tests et cliquets** : tests de domaine ; `i18n-keys` (libellés des catégories).
- **Critères d'acceptation** : un logement est refusé à un déclaré et admis à un vérifié ; le quota dépassé est refusé ; l'échéance d'un colis est la fin du jour du voyage ; un texte portant un numéro est refusé ; `services` et `other` ne sont plus des catégories ; aucune route n'est créée.
- **Dépend de** : décisions 2, 3 et 4.
- **Porte** : décisions du propriétaire.

### AN-03 — Contrat d'annonces pour plusieurs réseaux, demandé au moteur · P2 · S · S2
- **Pour l'utilisateur** : rien de visible ; il évite un module d'annonces né pour un seul réseau.
- **Backend** : issue `[S1]` avant le début de SU07a. Ce que DIASPORALE attend : zone en pays et ville saisie (le plan 10 écrit province, ville, quartier) ; devise ISO par annonce (il écrit XAF) ; politique par réseau (catégories ouvertes, statut exigé, quotas, durée, relecture forcée) réglée en console et journalisée ; noyau livrable sans la taxonomie v2 de SU03 ; conversation attachée à une **prise de contact**, une par lecteur intéressé ; nature de signalement ; seaux de débit ; drapeau d'ouverture par réseau et par pays ; visibilité `network`.
- **Web** : note de contrat dans `docs/` de DIASPORALE.
- **Mobile** : sans objet.
- **Données personnelles** : le contrat liste les tables et leur propriétaire pour l'inventaire d'effacement.
- **Tests et cliquets** : sans objet.
- **Critères d'acceptation** : issue déposée sans donnée sensible ; réponse de S1 consignée ; ADR du moteur ouvert (étape 1 de la procédure fermée du contrat de conversation contextuelle, § 10.5).
- **Dépend de** : décision 1 ; AN-02 pour la liste des règles.
- **Porte** : décision du propriétaire.

### AN-04 — Besoins fermés : règles écrites, refus explicites et orientation · P2 · S · S2
- **Pour l'utilisateur** : qui cherche une cagnotte, une tontine, un envoi d'argent ou un rapatriement lit ce que DIASPORALE ne fait pas, pourquoi, et où aller : page d'une association, kit d'arrivée, page officielle du poste.
- **Backend** : aucun ; la liste des objets interdits vit dans le domaine (AN-02) : change et transfert d'argent, collecte de fonds, médicaments, documents officiels, billets nominatifs, denrées. Liste à valider.
- **Web** : section « Ce que DIASPORALE ne fait pas » du guide d'AN-01 ; aucune nouvelle surface.
- **Mobile** : même texte.
- **Données personnelles** : aucune.
- **Tests et cliquets** : `public-communication` du moteur comme modèle : aucune règle de droit affirmée sans source.
- **Critères d'acceptation** : chaque besoin fermé du § 4.6 a sa phrase et son orientation ; aucun lien de paiement ; texte relu.
- **Dépend de** : SU01f du moteur (règles d'utilisation), plans 07, 11 et 15 pour les renvois.
- **Porte** : relecture par le juriste des phrases qui citent le droit.

### AN-05 — Port des annonces, démonstration et adaptateur moteur · P3 · M · S2
- **Pour l'utilisateur** : rien tant que le réseau n'a pas ouvert la rubrique.
- **Contenu** : capacité facultative `classifieds` du port (`classifieds-port.ts`, à créer) ; annonces fictives étiquetées dans le fournisseur de démonstration (D-G13) ; adaptateur `engine-classifieds.ts` qui ne rend la capacité que si le moteur dit la rubrique ouverte pour ce réseau ; codes d'erreur fermés ; idempotence (D-G16).
- **Dépend de** : SU07a du moteur, AN-02, AN-03.
- **Porte** : fusion de SU07a.

### AN-06 — Déposer une annonce · P3 · L · S2
- **Pour l'utilisateur** : choisir la catégorie et le sens, décrire, ajouter des photos, donner le prix et la ville, voir l'aperçu et les règles, publier ; reprendre un brouillon.
- **Contenu** : formulaire en étapes (React Hook Form et Zod) ouvert depuis l'action Publier, sans nouvelle destination ; premières catégories : dons et objets ; photos par la garde des fichiers, nettoyées avant l'envoi ; refus traduits (quota, statut, coordonnée) ; fragment de textes `classifieds` ; seau de débit demandé à S1 (D-G15).
- **Dépend de** : AN-05 ; SD-02 du moteur ; plans 02 et 03 pour l'action Publier.
- **Porte** : SU01a, b, c, d, h pour toute mise en ligne.

### AN-07 — Rubrique : liste, filtres, fiche et onglet du hub · P3 · L · S2
- **Pour l'utilisateur** : parcourir les annonces de son pays, filtrer par catégorie, sens, ville et prix, ouvrir une fiche avec le badge et l'ancienneté du déposant.
- **Contenu** : route `/annonces` déclarée dans la table des routes le jour de l'ouverture ; entrée depuis Communautés et Explorer ; onglet « Annonces » du hub passé seulement si la capacité existe et si le pays a des annonces ; états vides honnêtes ; pagination au serveur ; aucune carte.
- **Dépend de** : AN-05 ; plans 03 et 06.
- **Porte** : comme AN-06.

### AN-08 — « Mes annonces » · P3 · M · S2
- **Pour l'utilisateur** : voir ses annonces et leur état, modifier, renouveler, marquer « pourvue », retirer ; être prévenu avant l'échéance.
- **Contenu** : entrée dans l'espace personnel ; rappel d'échéance par un avis neutre, sans titre ni prix ; retrait automatique par le passage planifié du moteur ; effacement des annonces expirées selon la durée décidée.
- **Dépend de** : AN-05 ; plan 13 pour l'avis.
- **Porte** : comme AN-06.

### AN-09 — Écrire à l'annonceur · P3 · M · S2
- **Pour l'utilisateur** : écrire au déposant sans être en relation et sans échanger de numéro ; le fil se ferme quand l'annonce est retirée.
- **Contenu** : nouvelle nature de conversation attachée à la prise de contact (procédure fermée § 10.5 : décision, ADR, registre, libellés, guichet, export) ; premier mot au lecteur intéressé ; accord pour montrer son nom publié ; rappel de prudence en tête du fil ; aucun appel au départ (décision 9) ; règle de texte du lieu de visite (décision 8).
- **Dépend de** : plan 04 (mécanisme et recette DS-04) ; issue `[S1]` pour le registre et le domaine du moteur ; politique ouverte par un opérateur.
- **Porte** : décision du propriétaire et ADR.

### AN-10 — Signaler une annonce, relecture et bureau · P3 · M · S2
- **Pour l'utilisateur** : signaler une annonce ou un fil d'annonce en un geste, avec le motif « arnaque » ; le modérateur du pays relit avant publication à l'ouverture.
- **Contenu** : nature d'annonce au validateur du moteur (issue `[S1]`) ; aperçu borné au bureau ; relecture forcée par `surfaceForcesReview` ; masque pour le déclarant ; décision motivée et recours ; parcours R8 du cahier.
- **Dépend de** : plan 14 ; NU-01 et MC-06 du moteur.
- **Porte** : équipe de modération du pays en place.

### AN-11 — Logement · P3 · M · S2
- **Pour l'utilisateur** : proposer ou trouver une location, une colocation ou un hébergement court entre membres ; un compte non vérifié qui veut publier est conduit vers la vérification.
- **Contenu** : champs propres (type, loyer, charges, meublé, dates, dépôt affiché) ; réservé aux vérifiés ; déclaration cochée « j'ai le droit de proposer ce logement » ; relecture maintenue ; deux annonces actives au plus ; bloc d'élévation vers `D:apps/diasporale_com/src/app/verification/page.tsx`.
- **Dépend de** : AN-06, AN-09, AN-10 ; plan 01 (élévation).
- **Porte** : questions au juriste (décision 11).

### AN-12 — Colis vers le Gabon · P3 · M · S2
- **Pour l'utilisateur** : offrir de la place dans une valise ou confier un colis à un voyageur vérifié.
- **Contenu** : villes, date du voyage, kilos, ce que le voyageur refuse ; liste d'interdits affichée ; déclaration cochée des deux côtés ; échéance au jour du voyage ; aucun montant tant que le juriste n'a pas répondu.
- **Dépend de** : AN-06, AN-09, AN-10.
- **Porte** : avis du juriste (décision 7).

### AN-13 — Covoiturage · P3 · S · S2
- **Pour l'utilisateur** : proposer ou chercher un trajet entre deux villes ou vers un évènement.
- **Contenu** : départ, arrivée, date, places ; conducteur vérifié ; participation à convenir, sans calcul ; rattachement facultatif à un évènement d'association.
- **Dépend de** : AN-06, AN-09 ; plan 08 pour le rattachement.
- **Porte** : question au juriste (décision 11).

### AN-14 — « Je cherche » et alerte · P3 · M · S2
- **Pour l'utilisateur** : décrire un besoin, le garder privé ou le publier, et être prévenu quand une annonce correspond.
- **Contenu** : branchement de NU-05 et NU-04 du moteur ; avis sans contenu ; passerelle vers l'entraide quand le besoin est une question.
- **Dépend de** : NU-04 et NU-05 du moteur ; plans 11 et 13.
- **Porte** : comme AN-06.

### AN-15 — Enregistrer une annonce · P3 · S · S2
- **Pour l'utilisateur** : garder une annonce et la retrouver ; une annonce retirée ne montre plus rien.
- **Contenu** : branchement sur la brique « Enregistrer » du plan 09 (DS-11, volet favoris) ; jamais visible du déposant.
- **Dépend de** : plan 09 ; NU-03 du moteur.
- **Porte** : aucune autre que l'ouverture.

### AN-16 — « Passer pro » : de l'annonce à la page · P3 · S · S2
- **Pour l'utilisateur** : qui publie souvent se voit proposer de créer une page d'entreprise ou d'association.
- **Contenu** : encart dans « Mes annonces » au-delà du seuil ; renvoi vers la création de page ; branchement de SU07b du moteur.
- **Dépend de** : AN-08 ; plan 07 ; SU07b.
- **Porte** : seuil fixé par le propriétaire.

### AN-17 — Mesure des annonces · P3 · S · S2
- **Pour l'utilisateur** : le responsable du réseau lit, par pays, les annonces actives, les prises de contact et les signalements.
- **Contenu** : agrégats nocturnes dans le tableau du pilote, seuil « moins de 5 », aucun contenu privé.
- **Dépend de** : plan 17.
- **Porte** : aucune autre que l'ouverture.

### AN-18 — Annonces sur le téléphone · P3 · M · S3
- **Pour l'utilisateur** : déposer une annonce depuis l'appareil photo, recevoir une alerte.
- **Contenu** : écrans natifs sur les mêmes règles ; NU-08 du moteur.
- **Dépend de** : plan 16 ; AN-06, AN-07.
- **Porte** : décision sur l'application mobile (DG-028).

### DS-17 — Petites annonces · P3 · L · S2 · repris du plan 15
- **Pour l'utilisateur** : vendre, donner, chercher un logement entre membres, pays par pays.
- **Backend** : aucun code propre ; ouverture de la politique d'annonces et de la politique de conversation pour le réseau `diasporale`, par un opérateur, pays par pays.
- **Web** : assemblage des lots AN-05 à AN-10 ; route et onglet créés dans le même commit que l'ouverture.
- **Mobile** : après le web (AN-18).
- **Données personnelles** : test d'effacement : annonces, photos, prises de contact, alertes et enregistrements disparaissent avec le compte.
- **Tests et cliquets** : `network-scoped-functions`, `rate-limited-writes`, `no-unbounded-collect`, `file-delivery-gate`, `contextual-registry`, `notification-payload-content` côté moteur ; `i18n-keys` côté DIASPORALE.
- **Critères d'acceptation** : recette à trois comptes du § 6 ; R8 du cahier joué ; R-G03 (rien n'est lu d'ANTSIA) ; aucune annonce sans relecture dans un pays qui ouvre ; rapport daté dans `docs/recette/`.
- **Dépend de** : AN-02 à AN-10 ; plans 10 et 12 du moteur ; plan 17.
- **Porte** : SU01a, b, c, d, h ; décision 7 du plan 15 ; équipe de modération du pays ; accord écrit pour la publication.

## 6. Ordre recommandé et dépendances

| Vague | Lots | Pourquoi dans cet ordre |
|---|---|---|
| 0, avant le pilote | AN-01 | Les annonces existent de fait dans le fil : le rappel de prudence n'attend pas la rubrique |
| 1, pendant le pilote, sans rien ouvrir | AN-03, AN-02, AN-04 | Déposer le contrat avant que S1 ne code SU07a ; fixer les règles ; dire non proprement |
| 2, quand SU07a est fusionné | AN-05, AN-06, AN-07, AN-08 | Le noyau, derrière une capacité absente |
| 3 | AN-09, AN-10 | Contact et modération : conditions de toute ouverture |
| 4 | DS-17 : dons et objets, un seul pays | Roder la modération sur les catégories les moins risquées |
| 5 | AN-14, AN-15, AN-13, AN-11, AN-17 | Le logement vient quand la relecture tient ses délais |
| 6 | AN-12, AN-16, AN-18 | Colis après l'avis du juriste ; mobile avec le plan 16 |

**Ce que ce plan attend des autres plans.** Moteur : plan 10 (SU07a, SU07b, NU-01, NU-03, NU-04, NU-05, NU-07), plan 12 (SU01a, b, c, d, h ; SU01f ; MC-06 ; MC-07), plan 03 (SD-02), plan 08 (CM-02 pour la liste des interdits). DIASPORALE : plan 02 (aide, action Publier), plan 03 (composeur ; garde des coordonnées sur les publications), plan 04 (conversation attachée, DS-04), plan 06 (onglet du hub), plan 07 (pages), plan 08 (trajet vers un évènement), plan 09 (brique « Enregistrer »), plan 11 (entraide, kit d'arrivée), plan 13 (avis, « Mes données »), plan 14 (nature, motif, bureau), plan 15 (page officielle du poste), plan 16 (mobile), plan 17 (ouverture, mesure, DG-030).

**Volet de recette en mode moteur (campagne DS-05).**
- *Aujourd'hui*, avec le compte `verifie` : aucune page ne répond à `/annonces` ; le hub France ne montre pas d'onglet « Annonces » ; la carte d'annonce n'apparaît que sur `/charte`. Résultat attendu : trois absences constatées, aucun alias vide.
- *À l'ouverture (DS-17)*, comptes de docs/34 de DIASPORALE : `leger` (en attente) lit et ne peut ni publier ni écrire ; `declare` publie un don, se voit refuser un logement et lit l'invitation à se faire vérifier ; `verifie` publie un logement, qui part en relecture ; `moderateur` l'admet ; `parraine` écrit au déposant, un numéro saisi dans l'annonce est refusé, le rappel de prudence est en tête du fil ; `bloque` ne voit pas l'annonce de `verifie` ; `declare`, `parraine` et `belgique` signalent pour « arnaque » : l'annonce disparaît pour eux, `moderateur` la retire, `verifie` fait recours ; l'échéance retire l'annonce ; l'effacement du compte emporte annonces et photos ; `exterieur` ne lit rien.

## 7. Décisions à prendre par le propriétaire

1. **Un module commun ou une tranche propre.** Recommandation : le module d'annonces du moteur (SU07a), réglé par réseau. Raison : services et emploi existent déjà en double entre DIASPORALE et ANTSIA (DS-16) ; une troisième copie coûterait plus cher que d'attendre S1.
2. **Les catégories.** Recommandation : dons, objets, logement, covoiturage, colis, avec le sens « je propose » ou « je cherche » ; ni « services » (catalogue des pages) ni « autre ». Raison : une catégorie sans règle est un contournement.
3. **Qui publie quoi.** Recommandation : logement et colis aux vérifiés ; conducteur vérifié ; le reste aux déclarés et aux vérifiés ; un compte en attente lit. Raison : cahier EXF-DG-36, et levier d'élévation.
4. **Quotas et durées.** Proposition de travail : 30 jours renouvelables ; colis et trajets jusqu'au jour du voyage ; cinq annonces actives pour un vérifié, deux pour un déclaré, deux logements au plus ; effacement 30 jours après l'échéance. Raison : mêmes ordres de grandeur que le plan 10 du moteur ; à corriger après mesure.
5. **Ordre d'ouverture.** Recommandation : dons et objets d'abord, dans un seul pays doté d'une équipe de modération ; logement ensuite ; colis en dernier. Raison : apprendre sur le risque le plus faible.
6. **Relecture.** Recommandation : toute annonce relue à l'ouverture d'un pays ; publication directe ensuite, sauf logement et colis. Raison : R8 du cahier vise le logement.
7. **Colis : participation et responsabilité.** Recommandation : interroger le juriste avant d'écrire AN-12 ; d'ici là, aucun montant. Raison : transport rémunéré et douane ne se devinent pas.
8. **Lieu d'une visite.** Recommandation : un geste « Partager le lieu de la visite », donné à une seule personne, hors notification, effacé avec le fil ; cela amende la règle de texte D8. Raison : sans lieu, les échanges quittent la plateforme.
9. **Appels depuis un fil d'annonce.** Recommandation : fermés au départ. Raison : deux inconnus, aucun engagement.
10. **Annonce visible d'ANTSIA.** Recommandation : non ; à rouvrir pour le colis après le pilote. Raison : contexte séparé.
11. **Questions au juriste** : sous-location ; obligations d'une rubrique d'annonces entre particuliers pour des résidents de France et d'Europe ; covoiturage et partage de frais ; transport de colis ; appel aux dons ; conservation d'une annonce expirée ; âge minimal pour publier et pour écrire. Recommandation : les poser en une fois, avec celles du plan 14, avant d'écrire AN-11, AN-12 et AN-13. Raison : chaque réponse change une règle du domaine, pas seulement un texte.
12. **Mise en avant payante.** Recommandation : jamais pour le particulier ; une offre professionnelle se discute au plan 17. Raison : le citoyen ne paie jamais.

## 8. Risques et points d'attention

- **Arnaques au logement** : premier risque, déjà possible dans le fil. Parades : AN-01 tout de suite, vérifiés seuls, relecture, motif dédié.
- **Rubrique vide** : aucune route sans annonce réelle ; ouverture par pays, avec des associations relais.
- **Contournement par le fil** : si la rubrique est plus contraignante que la publication libre, les annonces resteront dans le fil. Le plan 03 doit trancher la garde des coordonnées.
- **Module né pour un seul réseau** : sans AN-03, SU07a porte province, quartier et XAF ; DIASPORALE devrait le dupliquer.
- **Dépendance à SU03** : la taxonomie v2 attend une session PRO.GA ; le noyau des annonces ne doit pas en dépendre.
- **Droit de plusieurs pays** : logement, covoiturage et colis ne suivent pas les mêmes règles en France, en Belgique ou au Canada. Rien n'est dit « conforme ».
- **Rencontres physiques** : sécurité des personnes ; les mineurs restent hors des annonces (SU01c, D-G11).
- **Photos** : une photo de logement peut porter la position du domicile tant que SD-02 n'est pas livré.
- **Charge de modération** : relecture systématique ; un pays n'ouvre la rubrique qu'avec son équipe.
- **Double emploi avec l'entraide** : « je cherche un logement » existe déjà comme question ; une passerelle évite deux endroits concurrents.
- **Fichiers partagés** : schéma, seaux, validateur des cibles et registre des conversations appartiennent à S1.

## 9. Prompts d'implémentation

### Prompt AN-01
```text
Tu es la session S2 (DIASPORALE). Écris-moi en français. Opus seulement.
Lis : CLAUDE.md, docs/etudes/2026-11-10-finalisation/12_PETITES_ANNONCES_BESOINS_DIASPORA.md (§ 1, § 2 « jamais recetté », § 4.6, lot AN-01), apps/diasporale_com/src/screens/legal-screen.tsx, la fiche F09 du dossier produit d'origine.
Branche claude/guide-arnaques depuis origin/main. Périmètre : dépôt DIASPORALE seulement.
Vérifie d'abord que l'état décrit est encore vrai : aucune page de prudence, publication fictive post-2 du fournisseur de démonstration.
Livre : l'écran du guide et sa route dans apps/diasporale_com/src/lib/routes.ts, le composant de rappel dans @diasporale/features, son montage sur les questions d'entraide de thème logement et transport, le fragment de textes safety-guide en fr et en, la correction du texte fictif post-2.
Soumets-moi le texte du guide avant de le figer. N'écris ni « garanti », ni « sécurisé », ni chiffre.
Vérifie : bun run --cwd ../ANTSIA verify avec le verrou ; captures à 390 et 1280 px, en clair et en sombre.
Arrête-toi avant toute publication de la démonstration.
```

### Prompt AN-03
```text
Session S2. Écris-moi en français.
Lis : le plan 12 de DIASPORALE (§ 4.7, § 5 AN-03, § 7 décision 1), ../ANTSIA/docs/etudes/2026-11-09-finalisation/10_NOUVEAUX_UNIVERS_ET_ANNONCES.md (SU07a, NU-01, NU-07), ../ANTSIA/docs/contrats/CONVERSATION-CONTEXTUELLE-V1.md (§ 10.5).
Demande-moi d'abord la décision 1 (module commun ou tranche). Si c'est le module commun :
rédige une note de contrat dans docs/, sous le prochain numéro libre (zone pays et ville saisie, devise ISO, politique par réseau, noyau sans SU03, conversation par prise de contact, nature de signalement, seaux, drapeau d'ouverture par pays, visibilité network, tables et propriétaires), puis ouvre une issue [S1] dans administration-ga/antsia qui la résume. Le dépôt est public : aucune donnée sensible.
N'écris aucun code du moteur. Termine par la réponse attendue de S1 et la date de dépôt.
```

### Prompt AN-02
```text
Session S2. Écris-moi en français. Opus seulement.
Lis : le plan 12 de DIASPORALE (§ 4.7 et lot AN-02) ; dans packages/diasporale-domain/src : services.ts, money.ts, eligibility.ts, moderation.ts, service-requests.ts ; puis packages/diasporale-features/src/data/types.ts.
Demande-moi les décisions 2, 3 et 4 si elles ne sont pas écrites. Branche claude/regles-annonces.
Crée packages/diasporale-domain/src/classifieds.ts et ses tests : catégories et sens, statut exigé pour publier et pour écrire, quotas, durée et échéance, états et transitions, prix, ville, refus des coordonnées et de l'adresse, objets interdits, seuil de « Passer pro ». Réemploie les règles existantes, n'en recopie aucune.
Fais lire le domaine par CLASSIFIED_CATEGORIES ; complète ClassifiedView et la carte de la charte ; libellés fr et en.
Ne crée ni route, ni port, ni fournisseur. Vérifie : verify vert. Arrête-toi là.
```

### Prompt DS-17
```text
Session S2. Écris-moi en français. Opus seulement.
Condition : SU01a, b, c, d, h et SU07a du moteur sont fusionnés, AN-02 à AN-10 aussi. Si l'un manque, dis-le et arrête-toi.
Lis : le plan 12 de DIASPORALE (§ 5 DS-17, § 6 volet de recette), docs/34, docs/14 § 6.2 (R-G03, R-G19), le cahier § 9 (R8).
Sur le backend local seulement : demande l'accord, ouvre la politique d'annonces et la politique de conversation du réseau diasporale pour la France, catégories dons et objets.
Joue la recette à trois comptes du § 6, puis R8 et l'effacement. Pour chaque défaut : test qui échoue, correctif, test vert ; tout défaut du moteur devient une issue [S1].
Livre : docs/recette/annonces-<date>/RAPPORT.md, fait ou non fait par étape. Arrête-toi avant toute action sur la démonstration en ligne et avant toute ouverture d'un pays.
```

## 10. Sources lues

- Déjà en contexte : cahier des charges (EXF-DG-36, § 5, § 9 R8, § 10.1, § 11), plan global (G4, G8, § 6.2), registre des décisions (D-G01 à D-G16), plan 15 d'ANTSIA (DS-17, décision 7), plan directeur et registre des lots d'ANTSIA, table des routes.
- Moteur : `A:docs/etudes/2026-11-09-finalisation/10_NOUVEAUX_UNIVERS_ET_ANNONCES.md` (en entier), `A:docs/etudes/2026-11-09-finalisation/12_MODERATION_CONFORMITE_SECURITE.md` (§ 1 à § 8), `A:docs/etudes/2026-10-21-sept-univers-et-vie-publique/ETUDE_SEPT_UNIVERS_ANTSIA.md` (§ 2.2, § 3, § 7.3, § 8, § 10), `A:docs/etudes/2026-10-21-sept-univers-et-vie-publique/SU01_CONFORMITE_ORDONNANCE_0011.md` (§ 3, § 4), `A:docs/contrats/CONVERSATION-CONTEXTUELLE-V1.md` (§ 3.1, § 4.1, § 5.5, § 5.9, § 10.5, § 14).
- DIASPORALE : `D:docs/01_PLAN_IMPLEMENTATION_PROMPTS_DIASPORALE.md` (prompt PD8), `D:docs/13_ETUDE_RESEAU_SOCIAL_DIASPORALE.md` (§ 10), `D:docs/34_COMPTES_DE_DEMONSTRATION.md`.
- Dossier produit d'origine (dépôt gabon-diplomatie, copie locale) : fiche F09, § 1, § 5, § 7.3 ; spécifications de design : carte C5, écrans E13, E22, E23, parcours « Élévation ».
- Code DIASPORALE : cartes, types, textes, écran de la charte, hub, table des routes, port, fournisseur de démonstration, domaine (`money`, `services`, `service-requests`, `eligibility`, `moderation`, `mutual-aid`, `conversation-contexts`), médias.
- Code ANTSIA : tranche `diaspora` (manifeste, cibles de modération, contextes de conversation, emploi, entraide), `contextualMessaging`, `moderation`, `marks`, `messaging`, `people`, `lib/rateLimit.ts`, `crons.ts`, `social-domain` (`moderation`, `moderationPolicy`, `contextualMessaging`, `content`, `pagePresentation`).
- Non lu : le code de PRO.GA ; aucune source en ligne sur les applications de référence.
