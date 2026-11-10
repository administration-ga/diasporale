# Plan 06 — Hubs pays, villes et carte de la diaspora

> Constaté par lecture du code d'`origin/main` (DIASPORALE `bead76d`, ANTSIA `fd58d73b`), le 10 novembre 2026. Rien n'a été exécuté : ni test, ni recette, ni publication.
> Applications de référence : InterNations (communautés locales et ambassadeurs), Nextdoor, Reddit, Groupes Facebook par ville, Discord, Meetup. Comparaison faite de mémoire, sans revérification en ligne ; un « ? » marque ce qui n'est pas sûr.
> Ce plan détaille, pour les hubs pays, les villes et la carte, le plan 15 du dossier de finalisation d'ANTSIA. Les lots qu'il en reprend gardent leur identifiant (DS-…, DG-…) ; les lots nouveaux portent le préfixe `HB-`.

Légende des chemins : `D:` = dépôt DIASPORALE, `A:` = dépôt ANTSIA. « Écran » = atteignable depuis l'interface de diasporale.com ; « Moteur » = la fonction existe côté serveur.

## 1. L'intention du propriétaire

- **Le pays est le contexte permanent.** Tout contenu porte un pays ou la portée « toute la diaspora » ; le fil par défaut est le pays de résidence plus la couche commune (cahier, § 5, invariant 7). Le réseau est « par pays et global » (cahier, § 0).
- **Le hub est l'écran le plus important du projet** (spécifications de design du 13/07, écran E02 ; repris en tête de `D:apps/diasporale_com/src/screens/hub-screen.tsx`). Il doit réunir compteurs, fil local, évènements, associations, entreprises, pages officielles et membres visibles, avec un sélecteur de pays mémorisé (EXF-DG-15). Les contenus de portée diaspora paraissent dans tous les hubs avec leur origine (EXF-DG-16).
- **Le pays ne restreint pas la lecture** : un membre lit tous les hubs ; le pays ordonne les fils et fixe la compétence des modérateurs (cahier, § 12, point 4). Consulter un autre pays ne réécrit jamais la résidence (plan global, G1, point 5).
- **Un pays s'ouvre avec deux associations relais et un modérateur** ; la France d'abord, puis l'Espagne, la Belgique, le Canada, le Maroc, le Sénégal selon les relais (cahier, § 7 et arbitrage A8). Chaque hub est pré-rempli avant son ouverture ; les associations en sont les ambassadrices (dossier produit, § 8, stratégie de lancement).
- **Pas de contenu communautaire sans modération dans un pays** (cahier, § 5, invariant 10 ; EXF-DG-42).
- **Des chiffres vrais et protecteurs** : compteurs comptés la nuit, jamais à la lecture, jamais un zéro de façade ; sous 20 membres, le nombre ne s'affiche pas (dossier produit, F16 ; plan global, G2, point 3).
- **La carte de la diaspora** vient ensuite : agrégats par pays, seuil contre la ré-identification (EXF-DG-17, DS-15 du plan 15).
- **La ville se saisit, sans GPS** ; aucune adresse de domicile n'est gardée (plan global, G4 ; étude du 18/10, § 5).
- **Toute règle propre au réseau s'écrit dans sa tranche**, jamais dans le moteur générique (décision du 15/10, « réseau gouverné par une tranche »).
- **Écarté** : parrainage commercial d'un hub au pilote (D-G04, lot D4) ; fil classé par le comportement (D-G05) ; drapeaux (la charte emploie le code du pays, et un globe pour la diaspora) ; nouvelle destination principale sans décision.

## 2. Ce qui existe

| # | Capacité | État | Écran | Moteur | Preuve |
|---|---|---|---|---|---|
| 1 | Hub d'un pays à l'adresse `/pays/<iso>`, ouvert à tout membre, compte en attente compris | Présent | oui | oui | `D:apps/diasporale_com/src/screens/hub-screen.tsx`, `A:convex/modules/diaspora/hubs.ts` (`getCountryHub`) |
| 2 | Code inconnu ou Gabon : la même page « Ce hub n'existe pas » | Présent | oui | oui | `D:apps/diasporale_com/src/screens/hub-screen.tsx` (`Hub`), `D:packages/diasporale-domain/src/countries.ts` (`parseResidenceCountry`) |
| 3 | En-tête : code du pays en grand, titre, statut « Pays ouvert » ou « Pas encore ouvert » | Présent | oui | oui | `D:apps/diasporale_com/src/screens/hub-screen.tsx` (`HubBody`), `D:packages/diasporale-features/src/components/country-tag.tsx` (`CountryMonument`) |
| 4 | Compteurs des membres visibles, des associations et des entreprises | Présent | oui | oui | `A:convex/modules/diaspora/hubs.ts` (`refreshHubCountersPage`, `refreshHubPageCountersPage`), `D:packages/diasporale-features/src/components/stat-counter.tsx` |
| 5 | Compteur « Évènements à venir » | Partiel : le passage écrit toujours zéro | oui | non | `A:convex/modules/diaspora/hubs.ts` (`writeHubCounters`) |
| 6 | Seuil des membres : sous 20, l'écran dit « Moins de 20 » et le chiffre ne quitte pas le serveur | Présent | oui | oui | `D:packages/diasporale-domain/src/hubs.ts` (`MEMBER_COUNTER_DISPLAY_THRESHOLD`, `presentHubCounters`) |
| 7 | Seuls comptent les membres qui ont choisi l'annuaire, accord relu au comptage | Présent | oui | oui | `D:packages/diasporale-domain/src/hubs.ts` (`countsAsHubMember`), `A:convex/modules/diaspora/hubs.ts` (`countsInHub`) |
| 8 | Passage nocturne paginé (2 h 30 UTC, pages de 200) : aucune lecture ne compte | Présent | — | oui | `A:convex/crons.ts`, `A:convex/modules/diaspora/hubs.ts` (`refreshHubCounters`) |
| 9 | Hub sans contenu : « bientôt disponible », jamais une rangée de zéros | Présent | oui | oui | `D:packages/diasporale-domain/src/hubs.ts` (`presentHubCounters`, champ `dormant`) |
| 10 | Date du dernier comptage | Absent ici ; le moteur l'a (`countersComputedAt`) | non | oui | `D:apps/diasporale_com/src/data/engine-views.ts` (`toCountryHubView`), `A:convex/modules/diaspora/validators.ts` |
| 11 | Mention « compteurs de démonstration » | Présent | oui | — | `D:packages/diasporale-features/src/demo/selectors.ts` (`hubCounters`) |
| 12 | Section « Pages officielles » en tête du hub | Présent ; une page officielle ne naît aujourd'hui que par un geste d'opérateur à la console, l'import public manque (plan 15) | oui | oui | `A:convex/modules/diaspora/hubPages.ts` (`listCountryPages`), `A:convex/modules/pages/admin.ts` (`createInstitutionPage`) |
| 13 | Onglet Actualités : publications locales du pays et portée diaspora, paginées | Présent | oui | oui | `D:apps/diasporale_com/src/components/feed-pages.tsx`, `D:apps/diasporale_com/src/data/engine-source.ts` (`feedRequest`), `A:convex/modules/posts/posts.ts` (`myFeed`) |
| 14 | Mention d'origine d'un contenu diaspora venu d'un autre pays | Présent | oui | oui | `D:packages/diasporale-features/src/components/country-tag.tsx` (`ContentScopeTag`), `D:packages/diasporale-domain/src/reach.ts` (`originCountryBadge`) |
| 15 | Onglet Évènements du pays | Partiel : démonstration seulement ; en mode moteur la liste est toujours vide et dit « Aucun évènement prévu » | oui | non | `D:apps/diasporale_com/src/data/engine-views.ts` (`toCountryHubView`), `A:convex/modules/events/pageEvents.ts` (seule lecture : `listForPage`) |
| 16 | Onglets Associations et Entreprises : 12 par liste, puis l'annuaire filtré sur le pays | Présent | oui | oui | `A:convex/modules/diaspora/hubPages.ts` (`HUB_PAGES_PER_KIND`, `HUB_PAGES_SCAN`), `D:apps/diasporale_com/src/screens/hub-screen.tsx` (`HubPageList`) |
| 17 | Onglet Emploi : offres ouvertes du pays | Présent | oui | oui | `D:apps/diasporale_com/src/components/job-hub-tab.tsx` |
| 18 | Onglet Membres du pays | Absent ; la recherche de l'annuaire se filtre par pays (plan 05) | non | partiel | `D:apps/diasporale_com/src/screens/members-screen.tsx` ; motifs : `HubMembers`, `tab.membres` |
| 19 | Onglets Groupes et Annonces | Absent : libellés prêts, rien derrière (plans 07 et 12) | non | non | `D:packages/diasporale-features/src/components/community-controls.tsx` (`COMMUNITY_TABS`) |
| 20 | Chargement, erreur avec reprise, vide par section | Présent | oui | — | `D:apps/diasporale_com/src/screens/hub-screen.tsx` (`HubPagesError`) |
| 21 | Accueil au premier passage et bannière du statut d'adhésion | Présent | oui | oui | `D:apps/diasporale_com/src/screens/hub-screen.tsx` (`HubBody`) |
| 22 | Annonce épinglée du hub (« À la une ») | Absent | non | non | motifs : `hubPin`, `pinnedHub`, `hubAnnouncement` |
| 23 | Règles et « À propos » du hub | Absent | non | non | motifs : `hubRules`, `communityRules`, `aboutHub` |
| 24 | Résumé d'activité du pays (« ce mois-ci ») | Absent ici ; le moteur garde une mesure par pays, réservée aux responsables | non | partiel | `A:convex/modules/diaspora/pilotMetricsTables.ts` ; motifs : `activitySummary`, `hubDigest` |
| 25 | Partager le hub et y revenir après l'entrée | Absent : sans session, le visiteur est renvoyé à l'entrée et l'adresse est perdue | non | — | `D:apps/diasporale_com/src/components/gate.tsx` ; motifs : `shareHub`, `redirectTo`, `nextPath` |
| 26 | Poste consulaire du membre mis en avant | Absent (plan 15) | non | non | motifs : `jurisdiction`, `juridiction` |
| 27 | Destination « Communautés » : le hub de mon pays de résidence | Présent | oui | — | `D:apps/diasporale_com/src/screens/communities-screen.tsx` |
| 28 | Raccourcis du pays : agenda, entraide, kit d'arrivée, mentorat, emploi | Partiel : sur « Communautés » seulement, pas sur le hub d'un autre pays ; ni Services ni Membres | oui | — | `D:apps/diasporale_com/src/components/community-shortcuts.tsx` |
| 29 | Pays de résidence toujours visible, avec la ville | Présent | oui | — | `D:apps/diasporale_com/src/components/app-shell.tsx` (`HomeCountryLink`) |
| 30 | Lire le hub de n'importe quel pays | Présent | oui | oui | `D:apps/diasporale_com/src/screens/hub-screen.tsx` (`CountryJump`) |
| 31 | Avis « Zone consultée » et retour à mon pays, résidence inchangée | Présent | oui | — | `D:apps/diasporale_com/src/components/app-shell.tsx` (`ZoneNotice`) |
| 32 | Sélecteur : 248 pays, recherche par nom sans accent ou par code, mention « Ouvert » | Présent | oui | — | `D:packages/diasporale-features/src/components/country-switch.tsx`, `D:packages/diasporale-features/src/lib/countries.ts` |
| 33 | Accès rapide : mon pays et trois pays récents | Partiel : gardés dans ce navigateur seulement | oui | non | `D:packages/diasporale-features/src/components/country-switch.tsx` (`readRecent`) |
| 34 | Noms de pays dans la langue de la personne, sans liste écrite | Présent | oui | — | `D:packages/diasporale-features/src/lib/countries.ts` (`countryName`) |
| 35 | Pays ouverts dans Explorer | Partiel : pays ouverts seulement, sans compteur ni tri par activité | oui | oui | `D:apps/diasporale_com/src/screens/explore-screen.tsx` (`OpenCountries`) |
| 36 | Pays ouverts sur la porte d'entrée, sans chiffre | Présent | oui | oui | `D:apps/diasporale_com/src/components/open-countries.tsx`, `A:convex/modules/diaspora/hubs.ts` (`listOpenCountries`) |
| 37 | Carte « Votre pays » et « Prochains évènements » dans le rail du fil | Partiel : évènements toujours vides en mode moteur | oui | non | `D:apps/diasporale_com/src/screens/feed-screen.tsx` (`FeedRail`) |
| 38 | Suivre un autre pays que le sien | Absent ; le fil du moteur accepte quatre voies | non | partiel | `A:packages/social-domain/src/content.ts` (`FEED_LANES_MAX`) ; motifs : `followedCountries`, `hubFollow` |
| 39 | Vue « Toute la diaspora » (pages, évènements, pays) | Partiel : une portée du fil seulement | fil | oui | `D:packages/diasporale-domain/src/reach.ts` (`FEED_SCOPES`) ; motifs : `globalHub` |
| 40 | Index de tous les pays avec leur activité | Absent ; les lignes existent côté moteur | non | partiel | `A:convex/modules/diaspora/tables.ts` (`countryHubs`) ; motifs : `countryIndex` |
| 41 | Publier « dans le hub de mon pays » ou « pour toute la diaspora » | Présent | oui | oui | `D:packages/diasporale-features/src/components/composer.tsx`, `D:packages/diasporale-domain/src/reach.ts` |
| 42 | Une personne ne publie en local que dans son pays | Partiel : garde d'écran seule ; le serveur accepte tout code de deux lettres | oui | non | `A:packages/social-domain/src/content.ts` (`assertPostReach`), `A:convex/modules/posts/posts.ts` (`publish`) |
| 43 | Publication locale dans un pays non ouvert | Fermé : l'adaptateur la refuse, alors que trois textes annoncent une relecture ; s'ouvre avec la relecture par pays | oui | non | `D:apps/diasporale_com/src/data/engine-source.ts` (`publish`), `D:apps/diasporale_com/src/data/engine.test.ts` |
| 44 | Relecture avant publication dans un pays non ouvert | Partiel : règle pure, appliquée par la démonstration seule ; la modération du moteur ignore le pays | démo | non | `D:packages/diasporale-domain/src/moderation.ts` (`publicationPolicy`), `D:packages/diasporale-features/src/demo/store.ts`, `A:convex/modules/moderation/policy.ts` (`moderateContentWrite`) |
| 45 | Portée par ville ou par région | Absent | non | non | `A:convex/modules/posts/tables.ts` ; motifs : `cityKey` sur les publications, `region` |
| 46 | Liste des pays ouverts, réglage tracé du réseau | Présent | console | oui | `A:convex/modules/networks/networks.ts` (`update`), `A:apps/admin_antsia_ga/src/components/console-dashboard.tsx` |
| 47 | France ouverte au départ | Présent | — | oui | `D:packages/diasporale-domain/src/countries.ts` (`DEFAULT_OPEN_COUNTRIES`), `A:convex/modules/diaspora/seed.ts` |
| 48 | Règle « deux associations relais et un modérateur » | Partiel : fonction pure et ses tests ; aucun appelant au serveur ni à l'écran | texte | non | `D:packages/diasporale-domain/src/opening.ts` (`canOpenCountry`) |
| 49 | Ouvrir ou refermer un pays depuis DIASPORALE | Absent : seul un administrateur de la plateforme le fait, en tapant des codes à la console | non | console | `A:convex/modules/networks/networks.ts` (`update`) ; motifs : `openCountry`, `closeCountry` |
| 50 | Contrôle des codes saisis | Partiel : deux majuscules suffisent, « UK », « GA » ou « ZZ » passent ; la lecture les ignore sans le dire | console | partiel | `A:convex/modules/networks/networks.ts` (`assertSettings`) |
| 51 | Association relais désignée | Partiel : un champ de la démonstration, jamais affiché | non | non | `D:packages/diasporale-features/src/demo/state.ts` |
| 52 | Modérateur d'un pays | Absent : une équipe porte une nature de contenu ; le pays filtre la file, il ne délimite aucune compétence | non | non | `A:convex/modules/diaspora/moderationDesk.ts`, `A:convex/modules/moderation/tables.ts` |
| 53 | Tableau de préparation d'un pays | Absent | non | non | motifs : `readiness`, `openingGaps` |
| 54 | Se porter volontaire, ou être prévenu de l'ouverture | Absent | non | non | motifs : `openingVolunteer`, `relayCommitment`, `notifyOpening` |
| 55 | Ordre d'ouverture envisagé (ES, BE, CA, MA, SN) | Partiel : constante sans appelant | non | non | `D:packages/diasporale-domain/src/countries.ts` (`NEXT_OPENING_CANDIDATES`) |
| 56 | Avis « pas encore ouvert » : hub, accueil, composeur | Partiel : affichés, mais inexacts en mode moteur (ligne 43) | oui | — | `D:packages/diasporale-features/src/i18n/locales/fr/diasporale.json`, `D:apps/diasporale_com/src/screens/welcome-screen.tsx` |
| 57 | Pays de la démonstration (FR, BE, CA) ouverts sans écraser une décision | Présent | — | oui | `A:convex/modules/diaspora/demoAccounts.ts` (`openDemoCountries`) |
| 58 | Date d'ouverture d'un pays | Absent ici ; l'historique des réglages du réseau la garde | non | oui | `A:convex/modules/networks/tables.ts` (`networkSettingsHistory`) |
| 59 | Ville du membre : texte libre, une ligne, 80 caractères, visible des relations par défaut | Présent | oui | oui | `D:packages/diasporale-domain/src/facet.ts` (`DEFAULT_FACET_VISIBILITY`, `CITY_MAX_LENGTH`) |
| 60 | Ville repliée en clé (accents, casse, espaces) dans les services, l'entraide, le kit et l'emploi | Présent | oui | oui | `D:packages/diasporale-domain/src/services.ts` (`cityKeyOf`) |
| 61 | Villes proposées à la saisie | Absent : « Paris », « Paris 15e » et « Île-de-France » font trois villes | non | non | motifs : `citySuggestions`, `localities`, `knownCities` |
| 62 | Villes actives d'un pays et filtre par ville dans le hub | Absent | non | non | motifs : `cityHub`, `topCities` |
| 63 | Niveau intermédiaire : région, État, province | Absent | non | non | motifs : `stateCode`, `regionOf` |
| 64 | Géolocalisation | Absent, par choix : ville saisie, sans GPS | non | non | `D:apps/diasporale_com/src/lib/routes.ts` (`zoneHref`) |
| 65 | Carte de la diaspora | Absent | non | partiel | motifs : `diasporaMap`, `choropl`, `worldMap` |
| 66 | Agrégats lisibles sans compte pour les pays ouverts, seuil appliqué | Présent | porte | oui | `A:convex/modules/diaspora/hubs.ts` (`listOpenCountries`) |
| 67 | Regroupement des pays sous le seuil | Absent | non | non | motifs : `regionGroup`, `countryGroup` |
| 68 | Mesure par pays pour les responsables (plan 17) | Présent | oui | oui | `A:convex/modules/diaspora/pilotMetricsTables.ts` |
| 69 | Fuseau horaire du hub | Absent, sans objet : un pays en a parfois plusieurs ; l'évènement porte le sien | non | oui | `A:convex/modules/events/tables.ts`, `A:convex/modules/people/preferences.ts` |
| 70 | Relais locaux visibles | Absent | non | non | motifs : `ambassad`, `relay` hors démonstration |
| 71 | Vitrine publique d'un pays | Absent : réseau fermé | non | non | motifs : `publicHub` |
| 72 | Encart commercial du hub | Absent, écarté au pilote (D-G04) | non | non | motifs : `SponsoredSlot` dans l'écran du hub |

Décompte : **Présent 31 · Partiel 14 · Absent 26 · Fermé 1**.

### Ce que le moteur sait déjà faire et que DIASPORALE ne montre pas

- **La date du comptage** : `getCountryHub` la rend, l'adaptateur ne la reprend pas (ligne 10).
- **Quatre voies de fil** : le pays de résidence et la diaspora en occupent deux ; deux pays suivis tiennent sans toucher au moteur (ligne 38).
- **Une ligne par pays connu ou compté** dans `countryHubs` : c'est la matière de l'index des pays et de la carte (lignes 40 et 65).
- **Une mesure d'activité par pays et par jour** (`pilotMetricsDaily`), aujourd'hui réservée aux responsables (ligne 24).
- **L'historique des réglages du réseau**, qui sait quand un pays a été ouvert, jamais affiché (ligne 58).
- **La ville d'une page** (`A:convex/modules/pages/tables.ts`), que ni le hub ni l'annuaire ne filtrent.
- **Les compteurs des pays ouverts**, servis à Explorer et à la porte, qui n'affichent que l'étiquette du pays (ligne 35).

### Ce qui est écrit mais jamais recetté en réel

| Recette | État | Source |
|---|---|---|
| Fil du hub France et du hub Canada, pagination | Jouée le 16/10 sur un backend local, comptes fictifs | docs/04 de DIASPORALE |
| Pages du hub et compteurs d'associations et d'entreprises (DG-007) | Tests seulement ; jamais vus à plusieurs comptes sur un vrai moteur | rapport de la vague G (docs/18 de DIASPORALE) |
| Compteurs après une nuit de passage | Jamais observés sur un déploiement | plan 15, § 2 |
| Membre d'un pays non ouvert, en mode moteur | Jamais joué à l'écran ; un test prouve le refus | `D:apps/diasporale_com/src/data/engine.test.ts` |
| Section « Pages officielles » | Jamais vue avec une page créée par la console ; la démonstration a l'acteur `institution` | docs/34 de DIASPORALE |
| Changement de pays de résidence, puis hub et compteurs | Jamais joué | — |
| Hub en anglais, et à 390 px | Non consigné | — |

## 3. Comparaison avec les applications de référence

| Capacité | InterNations | Nextdoor | Reddit | Groupes Facebook | Discord | Meetup | DIASPORALE | Verdict |
|---|---|---|---|---|---|---|---|---|
| Communauté locale comme point d'entrée | par ville | par quartier | par communauté | par ville | par serveur | par ville | par pays | Déjà fait |
| Niveau ville | oui | oui | oui | oui | salons | oui | texte libre, sans vue | À faire (HB-10) |
| Lire une communauté voisine | oui | quartiers voisins | oui | selon le groupe | oui | oui | tous les hubs | Déjà fait |
| En suivre plusieurs | ? | voisins | oui | oui | oui | oui | non | À faire (HB-12) |
| Vue globale | forum mondial ? | non | oui | non | non | non | portée du fil | À adapter (HB-13) |
| Index des communautés, triées par activité | oui | non | oui | recherche | découverte | oui | pays ouverts seulement | À faire (HB-13) |
| Règles affichées de la communauté | générales | oui | oui | oui | oui | description | non | À faire (HB-05) |
| Annonce épinglée | ? | ? | oui | oui | oui | ? | non | À faire (HB-14) |
| Animateurs locaux désignés | ambassadeurs | « leads » | modérateurs | administrateurs | rôles | organisateurs | non | À faire (HB-08, HB-15) |
| Responsables visibles | oui | oui | oui | oui | oui | oui | non | À adapter (HB-05, décision 12) |
| Condition pour ouvrir une communauté | décision de l'éditeur ? | membres fondateurs ? | libre | libre | libre | un organisateur | règle affichée, non codée | À faire (HB-08) |
| Se proposer pour animer | oui | ? | parfois | non | non | oui | non | À faire (HB-09) |
| Compteur de membres | oui | ? | oui | oui | oui | oui | membres visibles, seuil 20 | Déjà fait, plus protecteur ; à compléter (décision 6) |
| Fraîcheur des chiffres | non | non | non | non | non | non | non ; le moteur l'a | À faire (HB-05) |
| Évènements de la communauté | oui | oui | non | oui | oui | cœur du produit | vide en mode moteur | À faire (HB-02) |
| Emploi, services, entraide par communauté | partiel | oui | non | par publications | salons | non | rubriques filtrées par pays | Déjà fait ; raccourcis à compléter (HB-04) |
| Guide local pour l'arrivée | oui | non | wiki | guides | non | non | kit d'arrivée (plan 11) | Déjà fait ; raccourci (HB-04) |
| Accueil des nouveaux | oui | oui | non | oui | oui | non | un avis au premier passage | À adapter (plan 11) |
| Carte | ? | oui | non | non | non | ? | non | À faire (DS-15) |
| Lien d'invitation vers la communauté | ? | oui | oui | oui | oui | oui | non, retour perdu | À faire (HB-06) |
| Page lisible sans compte | partielle | non | oui | groupes publics | non | oui | non | Reporté (HB-19 : réseau fermé) |
| Regroupement de petites communautés | ? | non | fils composés | non | non | rayon | non | Reporté (HB-17 : effectifs à mesurer) |
| Publier vers les communautés voisines | non | oui | publication croisée | non | non | non | pays ou toute la diaspora | Déjà fait ; ville : HB-10 |
| Relecture avant parution | non | non | option | option | option | non | annoncée, non tenue en mode moteur | À faire (HB-01, puis HB-11) |
| Résumé périodique par communauté | oui | oui | non | oui | non | oui | non | À faire (DS-14, plan 13) |
| Statistiques pour les responsables | ? | non | oui | oui | oui | oui | mesure par pays | Déjà fait (plan 17) |
| Parrainage commercial de la communauté | ? | oui | oui | non | non | oui | non | Écarté (D-G04 : aucune publicité au pilote) |
| Géolocalisation | non | adresse vérifiée | non | lieu | non | « près de moi » | ville saisie | Écarté (plan global, G4 : sans GPS) |
| Fil classé par le comportement | ? | oui | oui | oui | non | non | non | Écarté (D-G05) |

## 4. Ce qui manque

### 4.1 Bloquant avant l'ouverture du pilote

1. **L'écran promet une relecture qui n'existe pas.** L'avis du hub, celui de l'accueil et celui du composeur disent qu'une publication locale d'un pays non ouvert « sera relue ». En mode moteur, l'adaptateur la refuse avec « Cette fonction n'est pas encore ouverte ». Le pilote est en France, mais on entre depuis n'importe quel pays : un membre de Bruxelles ou de Montréal le rencontre le premier jour (HB-01).
2. **Les évènements sont invisibles dans le hub.** En mode moteur, l'onglet dit « Aucun évènement prévu », le compteur vaut zéro et le rail du fil est vide, même quand une association a publié un évènement. Aucune autre lecture ne liste les évènements d'un pays : on ne les trouve que sur la page de l'association, ou dans son agenda une fois inscrit. Or « faire vivre une association » est le deuxième résultat prioritaire du pilote (HB-02).
3. **La portée locale n'est gardée qu'à l'écran.** Le serveur accepte une publication locale pour n'importe quel code de deux lettres : un appel direct publie dans le hub d'un autre pays, ou d'un pays non ouvert. L'invariant « pas de contenu sans modération dans un pays » ne tient donc pas côté serveur (HB-03).

### 4.2 Fonctions attendues qui manquent

- Ouvrir un pays depuis DIASPORALE, avec la règle vérifiée et un motif (HB-08) ; se porter volontaire pour l'ouvrir (HB-09).
- Un niveau ville : saisie guidée, villes actives, filtre (HB-10).
- Suivre un deuxième pays (HB-12) ; une vue « Toute la diaspora » et un index des pays (HB-13) ; la carte (DS-15).
- Une annonce en tête du hub (HB-14) ; un « À propos » avec les règles (HB-05) ; des relais visibles (HB-15).
- Un lien de hub qui survit à l'entrée (HB-06).
- La relecture réelle des publications locales avant l'ouverture (HB-11).

### 4.3 Options qui manquent sur ce qui existe

- Les raccourcis (kit d'arrivée, entraide, mentorat, emploi) n'apparaissent que sur son propre pays ; Services et Membres n'y sont pas (HB-04).
- Les compteurs ne disent ni leur date ni ce qu'ils comptent : « Membres visibles » veut dire « inscrits à l'annuaire », masqués par défaut (HB-05, décision 6).
- Les pays récents ne suivent pas le compte d'un appareil à l'autre (HB-12).
- Explorer ne montre que les pays ouverts, sans compteur ni ordre d'activité ; un membre d'un pays non ouvert n'y voit pas le sien (HB-13).
- Le sélecteur ne regroupe pas les pays ouverts en tête (HB-13).
- La console accepte des codes faux sans rien dire (HB-07).
- Dans un pays à plusieurs postes, rien ne met le sien en avant ; un pays sans poste ne dit pas quel poste est compétent (HB-16).

### 4.4 Améliorations de l'existant

- Deux textes de vide promettent ce qui n'existe pas encore : « Les associations… arrivent avec l'import public » et « Les évènements des associations et des postes apparaîtront ici ». À reformuler dans HB-01 et HB-02.
- Un hub se dit « bientôt disponible » d'après ses quatre compteurs seulement : un pays où l'on publie déjà, sans membre visible ni page, reste annoncé en sommeil. À corriger avec HB-02 (compter aussi les publications locales récentes).
- Chaque lecture du hub relit jusqu'à 120 pages du pays, garde comprise. À mesurer sur réseau lent avec le plan 02 avant d'élargir.
- L'adaptateur répond toujours « publié », même si le moteur a retenu la publication (plan 03 ; nécessaire à HB-11).
- La règle d'ouverture, l'ordre des pays candidats et le champ « relais » de la démonstration sont du code sans appelant : HB-08 les emploie ou les retire.

### 4.5 Ce qui distingue DIASPORALE

- **Des chiffres qui protègent** : seuil de 20, membres comptés seulement s'ils l'ont choisi, comptage nocturne, « bientôt disponible » plutôt qu'un zéro. Aucune référence ne fait ce choix.
- **Le pays comme contexte**, avec la mention d'origine d'un contenu venu d'ailleurs et la lecture libre de tous les hubs sans toucher à la résidence.
- **Une ouverture conditionnée** à des relais et à une modération, là où les références laissent n'importe qui ouvrir une communauté.
- **Aucune géolocalisation** : la ville se saisit.
- **Un hub qui relie** le fil, les pages, l'emploi et, demain, les évènements et le poste consulaire du pays : ni un groupe Facebook ni un serveur Discord ne réunit cela.

### 4.6 Écarté ou reporté, et pourquoi

| Sujet | Raison |
|---|---|
| Parrainage commercial d'un hub | D-G04 : aucune publicité au pilote ; lot D4 (plan 17) |
| Géolocalisation, « près de moi » | Plan global, G4 : ville saisie, sans GPS |
| Compteur de membres par ville | La ville d'un membre n'est visible que de ses relations par défaut : un compteur la trahirait |
| Fil du hub classé par le comportement | D-G05 |
| Drapeaux | Charte : code du pays, globe pour la diaspora |
| Sixième destination principale | Goût constaté du propriétaire : cinq destinations |
| Vitrine publique d'un pays | Réseau fermé ; décision 13 (HB-19) |
| Régions et niveau État ou province | Attendre les effectifs réels et des listes validées (HB-17, HB-18) |
| Fuseau horaire d'un hub | Sans objet : l'évènement porte son fuseau (plan 08) |

## 5. Lots d'implémentation

Règles communes à tous les lots. Zone S2 : le dépôt DIASPORALE et `A:convex/modules/diaspora`. Hors zone, donc par issue `[S1]` : `A:convex/modules/networks/networks.ts`, `A:convex/modules/posts/posts.ts`, `A:convex/modules/events`, `A:convex/crons.ts`, `A:convex/lib/rateLimit.ts` (seaux de débit), `A:convex/modules/people/dataPolicies.ts` (toute table nouvelle y déclare son export et son effacement) et la console. Une table ajoutée dans `A:convex/modules/diaspora/tables.ts` entre dans le schéma sans le modifier ; elle s'inscrit au manifeste `A:convex/modules/diaspora/manifest.ts`. Chaque lot sert aussi la démonstration (D-G13), écrit ses textes dans un fragment fr et en à lui (D-G14), borne ses écritures (D-G15) et les rend rejouables (D-G16). Aucun lot ne crée de contenu libre nouveau : l'annonce épinglée est une publication, déjà signalable (plan 14) ; engagements, candidatures et demandes d'avis ne sont lus que par leur auteur et par l'administrateur du réseau.

### HB-01 — Dire vrai dans un pays non ouvert · P0 · S · S2
- **Pour l'utilisateur** : un membre d'un pays non ouvert sait ce qu'il peut faire : tout lire, publier pour toute la diaspora, pas encore dans le hub de son pays. Plus de promesse de relecture suivie d'un refus.
- **Backend** : aucun.
- **Web** : corriger en fr et en les trois avis (`hub.notOpenNotice`, `welcome.countryNotOpen`, `composer.reviewNotice`) et le texte du vide des associations ; dans `D:packages/diasporale-features/src/components/composer.tsx`, l'option locale est inactive et expliquée quand le pays n'est pas ouvert, la portée par défaut devient « toute la diaspora ». La démonstration (`D:packages/diasporale-features/src/demo/store.ts`) suit la même règle.
- **Mobile** : même règle au portage (plan 16).
- **Données personnelles** : aucune.
- **Tests et cliquets** : test du composeur (pays non ouvert : option locale inactive, portée diaspora) ; test de l'écran du hub ; `i18n-locales`, `public-communication`.
- **Critères d'acceptation** : avec un compte de démonstration passé en Espagne, le composeur ne propose pas le hub local, la publication « diaspora » aboutit, aucun écran ne dit « relue » ; en France, rien ne change.
- **Dépend de** : décision 1.
- **Porte** : aucune.

### HB-02 — Évènements du pays dans le hub · P0 · M · S2
- **Pour l'utilisateur** : l'onglet Évènements, le compteur et le rail du fil montrent les prochains évènements publics des associations du pays.
- **Backend** : fichier `hubEvents.ts` à créer dans la tranche : lecture bornée des évènements à venir des pages actives du pays (même fenêtre que `listCountryPages`, index `by_network_page_startAt`), chacun repassé par la garde importée de `A:convex/modules/events/pageEventAccess.ts` ; seuls les évènements d'audience réseau, publiés, non annulés. Le passage nocturne de `A:convex/modules/diaspora/hubs.ts` compte les évènements à venir et les publications locales récentes. Si le plan 08 livre déjà une lecture des évènements par pays, ce lot s'y branche. Au-delà de la fenêtre : issue `[S1]` pour un index par date (prévu par PG-10).
- **Web** : capacité facultative du port, adaptateur moteur, démonstration alignée ; onglet paginé avec lien vers l'agenda ; tant que la lecture manque, l'onglet et le compteur ne s'affichent pas en mode moteur.
- **Mobile** : onglet repris au portage.
- **Données personnelles** : aucune ; objets publics du réseau.
- **Tests et cliquets** : évènement réservé aux adhérents absent de la liste et du compteur ; évènement annulé ou retenu par la modération absent ; pays voisin absent ; `network-scoped-functions`, `no-unbounded-collect`.
- **Critères d'acceptation** : à deux comptes, l'association crée un évènement public ; le second compte le voit dans le hub France et dans le rail ; le compteur vaut 1 après le passage ; l'évènement privé n'apparaît pas.
- **Dépend de** : plan 08 (fiche et audiences d'un évènement).
- **Porte** : aucune en local.

### HB-03 — Gardes serveur de la portée locale · P0 · S · S1 et S2
- **Pour l'utilisateur** : rien de visible ; nul ne peut, par un appel direct, publier dans le hub d'un autre pays ni dans un pays non ouvert.
- **Backend** : issue `[S1]` : pour un réseau gouverné par une tranche, `A:convex/modules/posts/posts.ts` (`publish`) et `A:convex/modules/events/events.ts` (`announce`) appellent une règle de placement fournie par la tranche. La tranche (fichier à créer) refuse une portée locale si le pays n'est pas celui de l'auteur (ou de la page pour une publication de page), si le pays n'est pas ouvert tant que HB-11 n'est pas livré, ou si le code est le Gabon ou n'existe pas.
- **Web** : la garde de `D:apps/diasporale_com/src/data/engine-source.ts` reste et traduit le nouveau refus.
- **Mobile** : sans objet, même fonction.
- **Données personnelles** : la règle lit le pays de résidence de l'auteur seulement.
- **Tests et cliquets** : quatre refus et un succès au moteur ; publication « diaspora » inchangée ; `network-scoped-functions`.
- **Critères d'acceptation** : appel direct avec un autre pays, un pays non ouvert, « GA » ou « ZZ » : refusé ; pays de résidence ouvert : publié.
- **Dépend de** : décision 2.
- **Porte** : fichiers du moteur, donc S1.

### HB-04 — Raccourcis et rubriques du pays consulté · P1 · S · S2
- **Pour l'utilisateur** : qui prépare une installation au Canada trouve, depuis le hub du Canada, son kit d'arrivée, son entraide, ses mentors, ses emplois, ses services et ses pages.
- **Backend** : aucun.
- **Web** : `D:apps/diasporale_com/src/screens/hub-screen.tsx` monte `CommunityShortcuts` avec le pays consulté sur tout hub ; ajout de Services et de l'annuaire des membres filtrés (ce dernier dépend du plan 05) ; l'agenda, personnel, reste sur son pays.
- **Mobile** : repris au portage.
- **Données personnelles** : aucune.
- **Tests et cliquets** : test d'écran sur le hub d'un autre pays ; `no-hardcoded-urls`.
- **Critères d'acceptation** : depuis `/pays/ca`, chaque raccourci ouvre la rubrique filtrée sur le Canada ; la résidence ne change pas.
- **Dépend de** : rien.
- **Porte** : aucune.

### HB-05 — À propos du hub : statut, règles, compteurs datés · P1 · S · S2
- **Pour l'utilisateur** : comprendre ce hub : ce que veut dire « ouvert », les règles, qui modère, ce que comptent les chiffres et de quand ils datent.
- **Backend** : aucun pour la date du comptage (déjà rendue) ; la date d'ouverture est écrite par HB-08 et ne s'affiche qu'ensuite.
- **Web** : bloc repliable sous l'en-tête : statut, règle d'ouverture, lien vers les règles d'utilisation (plan 14), rappel du signalement ; sous les compteurs, « comptés le… » et « Membres visibles : ceux qui ont choisi l'annuaire » ; `D:apps/diasporale_com/src/data/engine-views.ts` reprend la date.
- **Mobile** : repris au portage.
- **Données personnelles** : aucun nom de modérateur sans son accord (décision 12).
- **Tests et cliquets** : date affichée égale à celle du passage ; `i18n-locales`.
- **Critères d'acceptation** : après un passage, le hub dit la date ; avant tout passage, il n'en dit aucune.
- **Dépend de** : plan 14 pour le texte des règles ; sans lui, le bloc s'ouvre sans ce lien.
- **Porte** : aucune.

### HB-06 — Lien partageable d'un hub · P1 · S · S2
- **Pour l'utilisateur** : coller le lien du hub dans un groupe WhatsApp ; qui l'ouvre entre, puis arrive sur ce hub.
- **Backend** : aucun.
- **Web** : bouton « Partager ce hub » ; `D:apps/diasporale_com/src/components/gate.tsx` garde l'adresse demandée, validée contre la table des routes, et y revient après l'entrée. Si le plan 01 ou le plan 02 porte déjà ce retour, ce lot ne garde que le bouton.
- **Mobile** : lien profond au plan 16.
- **Données personnelles** : l'adresse de retour ne contient qu'un chemin interne.
- **Tests et cliquets** : retour vers un hub ; adresse externe ou inconnue ignorée ; `no-hardcoded-urls`.
- **Critères d'acceptation** : lien ouvert sans session, entrée, puis hub demandé ; un nouvel inscrit passe par l'accueil et le lien ne fixe pas sa résidence.
- **Dépend de** : plans 01 et 02.
- **Porte** : aucune.

### HB-07 — Codes pays contrôlés à la console · P1 · S · S1
- **Pour l'utilisateur** : l'opérateur ne peut plus « ouvrir » un code qui n'existe pas.
- **Backend** : issue `[S1]`, à joindre à EX-06 : pour le réseau gouverné par la tranche diaspora, `A:convex/modules/networks/networks.ts` (`assertSettings`) refuse un code hors ISO 3166-1 et le Gabon.
- **Web** : `A:apps/admin_antsia_ga/src/components/console-dashboard.tsx` : liste de pays nommés au lieu du champ libre.
- **Mobile** : sans objet.
- **Données personnelles** : aucune.
- **Tests et cliquets** : « UK », « GA », « ZZ » refusés ; « GB » accepté ; `operator-audit`.
- **Critères d'acceptation** : le refus nomme le champ ; l'historique des réglages n'est pas écrit en cas de refus.
- **Dépend de** : EX-06.
- **Porte** : fichiers du moteur, donc S1.

### HB-08 — Préparer et ouvrir un pays depuis DIASPORALE · P1 · L · S2 et S1
- **Pour l'utilisateur** : l'administrateur du réseau voit, pays par pays, ce qui manque pour ouvrir, puis ouvre ou referme avec un motif.
- **Backend** : dans la tranche : engagements de relais (page d'association vérifiée, pays, date) et modérateurs désignés pour un pays ; lecture « préparation » qui applique `countryOpeningGaps` de `D:packages/diasporale-domain/src/opening.ts` et joint l'activité du pays ; ouverture et fermeture réservées à l'administrateur du réseau, motif obligatoire, dérogation journalisée, date écrite sur le hub. Issue `[S1]` : une aide du module des réseaux qui écrit la liste des pays avec son historique et son journal, au lieu d'un patch direct ; seaux de débit ; inventaire des données.
- **Web** : onglet « Pays » du bureau `/moderation`, sans nouvelle destination : liste, manques, fiche d'un pays, formulaire React Hook Form et Zod.
- **Mobile** : sans objet, outil de responsable.
- **Données personnelles** : la désignation d'un modérateur s'exporte et s'efface avec son compte ; l'engagement appartient à la page.
- **Tests et cliquets** : la règle bloque à un relais ou sans modérateur ; dérogation tracée ; non-administrateur : refus indistinct ; `operator-audit`, `rate-limited-writes`, `network-scoped-functions`.
- **Critères d'acceptation** : avec les comptes `administrateur`, `association` et `moderateur`, l'Espagne passe de « deux manques » à « prête », s'ouvre, paraît dans Explorer et sur la porte ; la refermer rétablit « pas encore ouvert ».
- **Dépend de** : plan 14 (équipes et compétence par pays) ; EX-08 ou plan 17 pour nommer l'administrateur du réseau, rôle que seuls les comptes de démonstration reçoivent aujourd'hui ; décisions 3, 4, 5, 14.
- **Porte** : décision du propriétaire ; S1.

### HB-09 — Se porter volontaire pour ouvrir son pays · P1 · M · S2
- **Pour l'utilisateur** : dans un hub non ouvert, « Aider à ouvrir ce pays » : une association vérifiée s'engage comme relais, un membre vérifié se propose pour modérer, chacun peut demander à être prévenu.
- **Backend** : tranche : propositions de relais, candidatures de modération, demandes d'avis ; écritures bornées (adhésion, statut, débit, idempotence) ; aucune ne donne un pouvoir ; avis neutre à l'ouverture, écrit par le rédacteur unique du moteur (plan 13).
- **Web** : carte dans l'avis « pas encore ouvert » ; état de sa proposition ; retrait.
- **Mobile** : repris au portage.
- **Données personnelles** : candidature et demande d'avis exportées et effacées ; lues par l'administrateur du réseau seulement ; nombre d'intéressés public au-dessus du seuil seulement.
- **Tests et cliquets** : compte en attente refusé ; double envoi sans doublon ; retrait ; `notification-payload-content`, `rate-limited-writes`.
- **Critères d'acceptation** : trois comptes d'un pays non ouvert s'engagent, se proposent, demandent l'avis ; l'administrateur les lit dans HB-08 ; à l'ouverture, l'avis part une fois.
- **Dépend de** : HB-08 ; plan 13 ; plan 07 (page vérifiée).
- **Porte** : aucune.

### HB-10 — Villes : saisie guidée et filtre par ville · P1 · M · S2
- **Pour l'utilisateur** : en tapant « par », on lui propose « Paris » ; le hub France montre ses villes actives ; « Lyon » filtre pages, services, entraide, kit et emploi.
- **Backend** : le passage nocturne tient une table des villes d'un pays : clé de `cityKeyOf` (`D:packages/diasporale-domain/src/services.ts`), libellé le plus fréquent, nombre d'objets publics par nature (pages, offres, ressources du kit, missions) ; jamais une donnée de membre ; alias validés par le propriétaire, liste vide au départ.
- **Web** : suggestions sur le champ Ville (réglages, accueil, formulaires des rubriques) ; rangée « Villes » dans le hub ; la puce filtre les onglets Associations, Entreprises et Emploi et ouvre les rubriques filtrées ; l'onglet Actualités n'est pas filtré, les publications n'ont pas de ville.
- **Mobile** : repris au portage.
- **Données personnelles** : la ville d'un membre n'alimente aucun agrégat ; aucun compteur de membres par ville.
- **Tests et cliquets** : repli des accents et de la casse ; ville sans objet public absente ; alias ; `no-unbounded-collect`, `crons-contract`.
- **Critères d'acceptation** : deux pages « Lyon » et « LYON » font une ville ; la puce Lyon ne montre que Lyon ; aucune ville ne paraît du seul fait qu'un membre y habite.
- **Dépend de** : plans 07, 09, 10, 11 (filtres de leurs rubriques, déjà au moteur).
- **Porte** : décision 7 pour les alias.

### HB-11 — Relecture réelle des publications locales avant l'ouverture · P1 · M · S1 puis S2
- **Pour l'utilisateur** : dans un pays non ouvert, publier dans son hub redevient possible ; la publication attend la relecture de l'équipe du réseau et son auteur la voit « en relecture ».
- **Backend** : plan 14 : la modération du moteur apprend la relecture préalable par pays pour un réseau gouverné (aujourd'hui `A:convex/modules/moderation/policy.ts` ne lit qu'une politique par réseau et par nature) ; la tranche fournit `publicationPolicy`, déjà écrite ; file dédiée dans le bureau.
- **Web** : HB-01 s'inverse : option locale réactivée, textes redevenus vrais, état rendu par l'adaptateur au lieu de « publié ».
- **Mobile** : repris au portage.
- **Données personnelles** : aucune nouvelle.
- **Tests et cliquets** : pays non ouvert : en relecture, lu par l'auteur et l'équipe seulement ; pays ouvert : inchangé.
- **Critères d'acceptation** : à trois comptes (auteur, modérateur du réseau, lecteur), la publication n'est lue par personne avant la décision ; acceptée, elle paraît dans le hub ; refusée, l'auteur est prévenu.
- **Dépend de** : plan 14 ; MC-02 ; HB-03.
- **Porte** : fichiers du moteur ; une équipe de modération du réseau doit exister.

### HB-12 — Suivre un autre pays · P2 · M · S2
- **Pour l'utilisateur** : installé à Bruxelles après des études à Lille, il suit la France ; son fil peut y joindre les publications locales de France, marquées de leur pays ; ses pays suivis le suivent d'un appareil à l'autre.
- **Backend** : tranche : pays suivis, deux au plus (le fil du moteur accepte quatre voies) ; lecture et écriture personnelles.
- **Web** : « Suivre ce pays » sur un hub ; réglage dans `/parametres` ; bascule sur le fil ; `D:packages/diasporale-features/src/components/country-switch.tsx` lit la liste du compte.
- **Mobile** : repris au portage.
- **Données personnelles** : exportés, effacés, jamais montrés à autrui.
- **Tests et cliquets** : troisième pays refusé ; composition des voies ; `rate-limited-writes`.
- **Critères d'acceptation** : pays suivi retrouvé sur un second navigateur ; ses publications locales paraissent avec leur étiquette ; ne plus le suivre les retire.
- **Dépend de** : plan 03 (fil) ; décision 8.
- **Porte** : aucune.

### HB-13 — Vue « Toute la diaspora » dans Communautés · P2 · M · S2
- **Pour l'utilisateur** : une bascule « Mon pays / Toute la diaspora » : fil commun, pages sans pays, évènements de portée diaspora, tous les pays avec leur état et leurs compteurs.
- **Backend** : lecture bornée de l'index des pays (lignes `countryHubs`, seuil appliqué, ouverts d'abord), dans une projection à part : les projections publiques en ligne ne changent pas.
- **Web** : bascule dans `D:apps/diasporale_com/src/screens/communities-screen.tsx`, sans nouvelle destination ; Explorer y renvoie ; le sélecteur regroupe les pays ouverts en tête.
- **Mobile** : repris au portage.
- **Données personnelles** : agrégats seulement.
- **Tests et cliquets** : pays sous le seuil sans nombre ; `member-screens-full-width`, `no-unbounded-collect`.
- **Critères d'acceptation** : un membre d'un pays non ouvert y trouve son pays ; aucun pays sans contenu n'affiche de zéro.
- **Dépend de** : HB-02 ; décision 9.
- **Porte** : aucune.

### DS-15 — Carte de la diaspora · P2 · M · S2 · repris du plan 15
- **Pour l'utilisateur** : voir où vit la communauté, pays par pays.
- **Backend** : la lecture de l'index des pays (HB-13) ; seuil de `D:packages/diasporale-domain/src/hubs.ts` ; règle pure et testée : aucun total qui permette de retrouver par soustraction un pays sous le seuil.
- **Web** : carte du monde dessinée dans la page, sans fond de carte ni service tiers, teintée par classe d'effectif ; liste triée équivalente pour le clavier et le lecteur d'écran ; au téléphone, la liste d'abord ; un pays mène à son hub. Placée dans la vue « Toute la diaspora ».
- **Mobile** : la liste, puis la carte.
- **Données personnelles** : agrégats seulement ; aucune ville, aucune position.
- **Tests et cliquets** : pays sous le seuil sans nombre ni teinte d'effectif ; un seul pays sous le seuil : pas de total ; `public-communication`.
- **Critères d'acceptation** : aucune position individuelle ; rien plutôt qu'un zéro ; la carte dit la date du comptage.
- **Dépend de** : HB-13 ; DS-05.
- **Porte** : tracé des frontières validé par le propriétaire (décision 10).

### HB-14 — Annonce épinglée du hub · P2 · M · S2
- **Pour l'utilisateur** : en tête du hub, une annonce choisie, une seule, avec une date de fin : communiqué du poste, appel d'une association relais.
- **Backend** : tranche : épingle de hub (pays, publication, auteur du geste, fin) ; réservée à l'administrateur du réseau et au modérateur désigné du pays ; publication publique, publiée, du pays ou de portée diaspora, relue par la garde des publications à chaque lecture.
- **Web** : carte « À la une » au-dessus des onglets ; geste dans le menu de la publication pour qui en a le droit.
- **Mobile** : repris au portage.
- **Données personnelles** : aucune ; le geste est journalisé.
- **Tests et cliquets** : publication retirée ou masquée : l'épingle disparaît ; fin dépassée : idem ; `rate-limited-writes`.
- **Critères d'acceptation** : épingle visible de tout lecteur du hub ; un membre ordinaire ne peut pas épingler.
- **Dépend de** : HB-08 ; plan 03 ; plan 15 (publications officielles).
- **Porte** : aucune.

### HB-15 — Relais locaux visibles · P2 · S · S2
- **Pour l'utilisateur** : savoir vers qui se tourner : les associations relais du pays, nommées dans le hub.
- **Backend** : lecture des engagements en vigueur (HB-08) ; la mention est calculée, ne s'achète pas et n'est pas un badge de confiance.
- **Web** : bloc « Vos relais » dans « À propos » ; mention sur la carte de l'association ; durée d'engagement et retrait.
- **Mobile** : repris au portage.
- **Données personnelles** : aucune personne nommée (décision 5).
- **Tests et cliquets** : engagement retiré : mention retirée ; page suspendue : absente.
- **Critères d'acceptation** : deux relais engagés paraissent dans le hub ; retirer un engagement le retire à la lecture suivante.
- **Dépend de** : HB-08 ; HB-05.
- **Porte** : aucune.

### HB-16 — Mon poste consulaire en tête du hub · P2 · S · S2
- **Pour l'utilisateur** : dans un pays à plusieurs postes, le sien d'abord ; dans un pays sans poste, le poste compétent.
- **Backend** : rapprocher le poste de la facette, posé par l'attestation, de la page officielle importée ; pays de compétence d'un poste fourni par le contrat d'import.
- **Web** : ordre de la section « Pages officielles » ; phrase « Votre poste ».
- **Mobile** : repris au portage.
- **Données personnelles** : le poste d'un membre n'est lu que pour lui.
- **Tests et cliquets** : membre sans attestation : ordre inchangé ; aucune fuite du poste d'autrui.
- **Critères d'acceptation** : un membre attesté voit son poste en premier ; un membre d'un pays sans poste voit le poste compétent, nommé comme tel.
- **Dépend de** : DG-009a ; DG-009b (plan 15).
- **Porte** : contrat avec gabon-diplomatie.

### HB-17 — Régions pour les pays à petits effectifs · P3 · M · S2
- **Pour l'utilisateur** : un membre d'un pays peu peuplé trouve une vie locale à l'échelle de sa région plutôt qu'un hub vide.
- **Contenu** : régions faites de listes de pays validées par le propriétaire ; page de région qui réunit fils locaux, pages et évènements (trois pays au plus par les quatre voies, sinon issue `[S1]`) ; compteur régional seulement si aucun pays ne s'en déduit.
- **Dépend de** : HB-13 ; effectifs réels après le pilote.
- **Porte** : décision 11.

### HB-18 — Niveau intermédiaire pour les grands pays · P3 · M · S2
- **Pour l'utilisateur** : aux États-Unis ou au Canada, filtrer par État ou par province.
- **Contenu** : champ facultatif entre le pays et la ville, pour les seuls pays dont le propriétaire valide la liste ; même mécanique que les villes.
- **Dépend de** : HB-10 ; ouverture effective de ces pays.
- **Porte** : listes validées par le propriétaire.

### HB-19 — Vitrine publique d'un pays · P3 · M · S2
- **Pour l'utilisateur** : une page lisible sans compte : le pays, son statut, ses chiffres au-dessus du seuil, les publications officielles rendues publiques par leur auteur, comment entrer.
- **Contenu** : projection publique à part ; aucune donnée de membre, aucun contenu resté dans le réseau ; référencement avec EX-10.
- **Dépend de** : plan 15 ; EX-10.
- **Porte** : décision 13.

## 6. Ordre recommandé et dépendances

| Vague | Lots | Pourquoi dans cet ordre |
|---|---|---|
| 1 | HB-01, HB-03, HB-02 | Dire vrai, fermer la garde, montrer les évènements : avant le pilote |
| 2 | HB-04, HB-05, HB-06, HB-07 | Petits lots sans porte, utiles dès le premier jour |
| 3 | HB-08, HB-09, HB-11 | Ouvrir proprement le deuxième pays |
| 4 | HB-10 | La France concentre la moitié de la diaspora : la ville devient nécessaire quand son hub se remplit |
| 5 | HB-12, HB-13, DS-15, HB-14, HB-15, HB-16 | Après les premiers retours |
| 6 | HB-17, HB-18, HB-19 | Sous condition |

**Ce que ce plan attend des autres plans.** Plan 01 : effets d'un changement de pays, retour après l'entrée. Plan 02 : place de la bascule, accessibilité de la carte, mesure sur réseau lent. Plan 03 : état de modération rendu par l'adaptateur, menu de publication. Plan 05 : annuaire filtrable par pays depuis une adresse. Plan 07 : onglet Groupes (DS-09), page vérifiée. Plan 08 : lecture des évènements par pays, à préciser avec HB-02. Plan 12 : onglet Annonces. Plan 13 : avis « votre pays ouvre », avis d'annonce épinglée, résumé mensuel du pays (DS-14). Plan 14 : équipes et relecture par pays, texte des règles. Plan 15 : pages officielles, pays de compétence d'un poste. Plan 17 : qui nomme l'administrateur du réseau ; indicateur « pays actifs ». Moteur : EX-06, EX-08, PG-10, MC-02.

**Ce que les autres plans peuvent attendre de celui-ci.** La table des villes d'un pays (HB-10) pour leurs filtres ; l'index des pays (HB-13) pour le pilote ; la règle de placement (HB-03) pour toute nouvelle surface locale.

**Volet de recette en mode moteur (campagne DS-05).** Backend local, réseau semé, comptes de démonstration par acteur. Sur la démonstration, la France, la Belgique et le Canada sont ouverts : le cas « non ouvert » se joue avec un autre pays.

| # | Compte | Geste | Résultat attendu |
|---|---|---|---|
| 1 | `verifie` (France) | Ouvre Communautés avant tout passage nocturne, puis après un passage lancé à la main | « bientôt disponible » ou compteurs absents, puis compteurs ; « Moins de 20 » sous le seuil |
| 2 | `verifie` puis `belgique` | Publie en local, puis pour toute la diaspora | La première paraît dans le hub France seulement ; la seconde dans les deux hubs, avec « Depuis : France » en Belgique |
| 3 | `belgique` | « Changer de pays », Canada | Avis « Zone consultée », retour à son pays, résidence inchangée |
| 4 | `association`, `institution` | Pages actives du pays | Onglet Associations ; section « Pages officielles » ; compteur après le passage |
| 5 | `declare`, passé en Espagne dans ses réglages | Ouvre son hub, puis le composeur | « Pas encore ouvert » ; comportement de HB-01 ; aucun texte ne dit « relue » |
| 6 | Tout membre | `/pays/zz` et `/pays/ga` | La même page « Ce hub n'existe pas » |
| 7 | `association` puis `verifie` | Crée un évènement public, puis un évènement réservé aux adhérents | Avant HB-02 : rien dans le hub, à consigner tel quel ; après : le premier seul |
| 8 | `canada`, en anglais, à 390 px | Parcourt le hub | Textes anglais, aucun débordement |

Le seuil de 20 se prouve par le test du moteur (`A:convex/modules/diaspora/diaspora.test.ts`) ; il n'a pas à être rejoué à la main.

## 7. Décisions à prendre par le propriétaire

1. **Pays non ouvert, d'ici la relecture.** Recommandation : fermer la publication locale et le dire (HB-01), puis ouvrir la relecture (HB-11). Raison : l'écran promet aujourd'hui une relecture que le moteur ne fait pas.
2. **Publier dans le hub d'un autre pays.** Recommandation : non pour le fil, comme le composeur le propose déjà ; les rubriques (entraide, emploi, services) gardent leur zone libre, car on y prépare une installation.
3. **Qui ouvre un pays.** Recommandation : l'administrateur du réseau, depuis DIASPORALE (cahier, § 6.4), la console gardant la main. Raison : taper des codes à la console n'est pas un geste de gouvernance.
4. **Règle d'ouverture bloquante ou indicative.** Recommandation : bloquante, avec dérogation motivée et journalisée. Raison : le texte de l'application l'énonce comme une règle.
5. **Qu'est-ce qu'un relais.** Recommandation : une association vérifiée, comme le dit le cahier ; une personne seulement plus tard, sur décision.
6. **Ce que compte « Membres ».** Aujourd'hui : les seuls membres inscrits à l'annuaire, masqués par défaut ; le hub France peut afficher « Moins de 20 » avec des centaines de membres. Recommandation : afficher le nombre de membres actifs du pays, au même seuil de 20, et garder « visibles dans l'annuaire » pour l'annuaire. C'est rouvrir un point du cahier (EXF-DG-15) : à vous de trancher.
7. **Villes.** Recommandation : saisie guidée par les villes déjà employées, sans liste inventée ; une liste d'alias pour la France (agglomérations) validée par vous ; aucun compteur de membres par ville.
8. **Pays suivis.** Recommandation : deux au plus, limite actuelle du fil.
9. **« Toute la diaspora ».** Recommandation : une bascule dans Communautés, pas une sixième destination.
10. **Carte.** Recommandation : tracé des frontières choisi et validé par vous (sujet diplomatique : le Maroc figure parmi les pays candidats) ; aucun total s'il révèle un pays sous le seuil.
11. **Régions.** Recommandation : attendre les effectifs réels ; liste validée par vous.
12. **Nommer les responsables d'un hub.** Recommandation : l'équipe nommée collectivement ; un nom seulement avec l'accord de la personne.
13. **Vitrine publique d'un pays.** Recommandation : non au pilote ; le réseau est fermé.
14. **Refermer un pays.** Recommandation : les publications locales restent lisibles ; les nouvelles suivent le régime « non ouvert ».

## 8. Risques et points d'attention

- **Hubs vides hors de France.** Sans import public ni relais, un hub ouvert reste muet. Ne pas ouvrir un pays sans contenu de départ (dossier produit, § 8).
- **Des compteurs qui desservent.** Avec l'annuaire masqué par défaut, « Moins de 20 » durera, même en France (décision 6).
- **Divulgation par différence.** Un total mondial, une région ou un compteur d'intéressés peut révéler un pays sous le seuil. Chaque agrégat nouveau reprend la règle testée de DS-15.
- **Fichiers hors de la zone S2.** HB-03, HB-07, HB-08 et HB-11 passent par S1 ; rien ne s'y contourne par un patch direct de la tranche.
- **Pas de modérateur par pays dans le moteur.** HB-08 désigne, il ne donne aucune compétence ; la compétence par pays relève du plan 14.
- **Projections publiques strictes.** Ajouter un champ à `listOpenCountries` casse les sites en ligne : toute lecture nouvelle part dans une projection à part.
- **Coût du hub.** 120 pages relues à chaque lecture, plus les évènements avec HB-02 : à mesurer avant d'élargir les fenêtres.
- **Villes.** La saisie libre éclate les villes ; à petite échelle, une ville peut désigner une personne : seuls les objets publics comptent.
- **Démonstration.** Trois pays y sont ouverts ; la démonstration locale simule une relecture que le moteur n'a pas : HB-01 aligne les deux.
- **Changement de résidence.** Les compteurs suivent avec une nuit de retard ; les publications gardent leur pays d'origine (plan 01).

## 9. Prompts d'implémentation

### Prompt HB-01
```text
Session S2 (DIASPORALE). Écris en français. Opus seulement.
Lis : docs/etudes/2026-11-10-finalisation/06_HUBS_PAYS_VILLES_CARTE.md (§ 2 lignes 43, 44, 56 ; lot HB-01 ; décision 1), apps/diasporale_com/src/data/engine-source.ts (publish), packages/diasporale-features/src/components/composer.tsx, les clés hub.notOpenNotice, welcome.countryNotOpen et composer.reviewNotice en fr et en.
Vérifie d'abord dans le code que l'adaptateur refuse toujours une publication locale dans un pays non ouvert. Si ce n'est plus vrai, dis-le-moi.
Branche claude/pays-non-ouvert depuis origin/main. Périmètre : dépôt DIASPORALE seulement.
Fais : l'option locale du composeur est inactive et expliquée quand le pays n'est pas ouvert, la portée par défaut devient « toute la diaspora » ; les trois avis et le texte du vide des associations disent ce qui est vrai ; la démonstration suit la même règle.
Vérifie : bun run --cwd ../ANTSIA verify avec le verrou ; recette à 390 et 1280 px avec un compte de démonstration passé en Espagne. Arrête-toi avant toute publication.
```

### Prompt HB-02
```text
Session S2. Lis le lot HB-02 et le § 6 du plan 06, le plan 08 du même dossier (évènements), ../ANTSIA/convex/modules/diaspora/hubPages.ts et hubs.ts, ../ANTSIA/convex/modules/events/pageEventAccess.ts et tables.ts, apps/diasporale_com/src/data/engine-views.ts (toCountryHubView).
Vérifie d'abord que le hub ne lit toujours aucun évènement en mode moteur et que le compteur vaut toujours zéro.
Branche claude/hub-evenements. Périmètre : dépôt DIASPORALE et ../ANTSIA/convex/modules/diaspora/. Ne modifie pas convex/modules/events/ : si un index manque, écris une issue [S1].
Fais : lecture bornée des évènements publics à venir d'un pays, gardée par la garde des évènements ; compteur dans le passage nocturne ; capacité du port, adaptateur, démonstration ; onglet paginé, rail du fil ; un test par refus (évènement privé, annulé, autre pays).
Vérifie : verify vert ; recette à deux comptes (association, verifie) en local. Arrête-toi avant toute publication.
```

### Prompt HB-03
```text
Session S1 pour le moteur, S2 pour la tranche. Lis le lot HB-03 et la décision 2 du plan 06, ../ANTSIA/convex/modules/posts/posts.ts (publish), ../ANTSIA/packages/social-domain/src/content.ts (assertPostReach), ../ANTSIA/convex/modules/diaspora/facts.ts.
Vérifie d'abord, par un test qui échoue, qu'un appel direct publie aujourd'hui en portée locale dans un autre pays que celui de l'auteur.
S2 dépose l'issue [S1] : un appel à une règle de placement fournie par la tranche, pour un réseau gouverné. S1 pose l'appel ; S2 écrit la règle dans convex/modules/diaspora/ : pays de l'auteur ou de la page, pays ouvert, jamais le Gabon ni un code inconnu.
Vérifie : verify vert ; les quatre refus et le succès. Arrête-toi avant toute publication ; ce lot change ce que le moteur expose, S1 publie le backend d'abord.
```

### Prompt HB-08
```text
Session S2. Lis le lot HB-08 et les décisions 3, 4, 5 et 14 du plan 06, packages/diasporale-domain/src/opening.ts, ../ANTSIA/convex/modules/networks/networks.ts, ../ANTSIA/convex/modules/diaspora/moderationDesk.ts, les plans 14 et 17 du même dossier.
Ne commence pas sans mes décisions 3, 4 et 5. Dépose d'abord les issues [S1] : aide d'écriture des pays ouverts avec historique et journal, seaux de débit, inventaire des données.
Branche claude/ouvrir-un-pays. Fais : engagements de relais, modérateurs désignés, lecture « préparation », ouverture et fermeture motivées, onglet « Pays » du bureau /moderation, démonstration, textes fr et en.
Vérifie : verify vert ; recette avec les comptes administrateur, association et moderateur : l'Espagne passe de deux manques à prête, s'ouvre, se referme. Arrête-toi avant toute publication.
```

### Prompt HB-10
```text
Session S2. Lis le lot HB-10 et la décision 7 du plan 06, packages/diasporale-domain/src/services.ts (cityKeyOf), ../ANTSIA/convex/modules/diaspora/hubs.ts (passage nocturne), les tables des services, de l'entraide, du kit et de l'emploi dans la tranche.
N'écris aucune liste de villes ni d'alias de ton chef : la liste d'alias reste vide tant que je ne l'ai pas fournie.
Branche claude/villes. Fais : table des villes d'un pays tenue par le passage nocturne, à partir des seuls objets publics ; suggestions sur le champ Ville ; rangée « Villes » du hub et filtres ; démonstration ; tests de repli.
Vérifie : verify vert ; aucune ville n'apparaît du seul fait qu'un membre y habite. Arrête-toi avant toute publication.
```

## 10. Sources lues

- Contexte commun de la session : dossier de reprise, cahier des charges, plan global, registre des décisions, plan 15 et plan directeur d'ANTSIA, registre des lots, table des routes.
- Plans du moteur : plan 13 (EX-06, EX-08, EX-16, § 2), plan 07 (PG-03, PG-10), plan 10 (NU-02), plan 11 (VP-03), plan 12 (MC-02, équipes), plan 02 (voies du fil, FP-16).
- DIASPORALE : docs/04 (lignes du hub, recette du 16/10), docs/13 (§ 2 et § 3), docs/34 ; dossier produit du 13/07 : fiches F02 et F16, § 6 et § 8 ; spécifications de design : écrans E01, E02, E31, E32.
- Vault : décisions « réseau gouverné par une tranche » (15/10) et « modération a posteriori des contenus communautaires » (18/10) ; fiche du projet (compteurs de hub).
- Code DIASPORALE : écrans du hub, de Communautés, d'Explorer, du fil, de l'accueil, des réglages, des membres ; composants des pays ouverts, des raccourcis, de l'onglet Emploi, du fil paginé, de la coque, de la porte ; adaptateur moteur et ses tests ; sélecteur, étiquette et compteur ; composeur ; démonstration (état, sélecteurs, magasin) ; domaine : hubs, pays, ouverture, portée, réseau, modération, facette, services ; textes fr.
- Code ANTSIA : tranche diaspora (hubs, pages du hub, faits, graine, tables, facette, annuaire, suggestions, comptes de démonstration, bureau de modération, modération des contenus, mesure du pilote, tests) ; modules réseaux, publications, modération, évènements, pages, préférences ; tâches planifiées ; console (réglages d'un réseau).
