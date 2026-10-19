---
title: "DIASPORALE — Coûts, alertes et mesure minimale du pilote"
date: "2026-10-18"
statut: "Sources raccordées ; vérifications différées sur instruction du propriétaire ; grille de coûts hypothétique, aucun tarif affirmé"
reference: "DG-027 · G11 · plan global §7"
---

# Coûts, alertes et mesure minimale du pilote

Le ticket **DG-027** du [plan global](14_PLAN_GLOBAL_IMPLEMENTATION_DIASPORALE.md) demande « coûts, alertes et mesure minimale », avec pour preuve de fin des « budgets et tableaux sans contenu privé ». Ce document décrit la mesure réellement écrite dans les sources (§1 à §3), la grille de coûts à trois scénarios **hypothétiques** construite avec les formules du §7.2 (§4), l'état des alertes du §7.3 (§5), les raccords demandés hors de la réservation du chantier (§6) et le niveau de preuve (§7).

Aucun chiffre de ce document ne décrit une mesure de production. Aucun tarif fournisseur n'y est affirmé : les colonnes de prix restent « à vérifier ».

## 1. Les indicateurs implémentés

La liste est **fermée** dans le domaine (`packages/diasporale-domain/src/pilot-metrics.ts`, `PILOT_METRICS`). Une demande, une adhésion ou un avis compte le **jour UTC de sa création**, avec son état au dernier passage ; une place d'évènement compte le jour de son évènement. Chaque taux rapporte une partie de la cohorte à sa base, toujours affichée.

| Indicateur | Ce qui est compté | Base du taux |
|---|---|---|
| Offres actives | Offres `active` des pages lisibles, relevées au passage (par pays de service) | — (relevé) |
| Demandes envoyées | Demandes créées dans la période | — |
| Demandes répondues | Parmi elles : une proposition (version 1) ou un refus de la page | Demandes envoyées |
| Demandes confirmées | Parmi elles : un rendez-vous convenu, même annulé ensuite | Demandes envoyées |
| Prestations réalisées | Parmi elles : réalisation déclarée par la page | Demandes confirmées |
| Demandes annulées | Parmi elles : annulées par la personne ou la page | Demandes envoyées |
| Demandes expirées | Parmi elles : état expiré, ou échéance atteinte non encore écrite | Demandes envoyées |
| Délai de première réponse | Médiane et 75e centile, par classe d'heures (1, 2, 3, 4, 6, 8, 12, 18, 24, 36, 48, 72, 96, 120, 168, 240, 336, 720 h, puis « plus de 720 h ») | Demandes répondues dont le délai est classé |
| Adhésions demandées | Premières demandes d'adhésion à une association (une ligne par personne et association) | — |
| Adhésions acceptées | Parmi elles : acceptées à ce jour, même quittées ou exclues ensuite | Adhésions demandées |
| Inscriptions aux évènements | Places confirmées aux évènements de page non annulés de la période | — |
| Présences aux évènements | Parmi elles : présences pointées | Inscriptions |
| Avis publiés | Avis créés dans la période, actifs et publiés par la modération à ce jour | — |

Portées : tout le réseau (`country = null`, y compris les lignes sans pays) ou un pays de résidence. Périodes : 7, 30 ou 90 jours UTC complets, finissant au dernier jour mesuré.

## 2. Comment la mesure est produite

### Agrégats matérialisés

- Table `pilotMetricsDaily` (`ANTSIA/convex/modules/diaspora/pilotMetricsTables.ts`) : réseau, portée (pays ou `null`), minuit UTC du jour, onze compteurs (`PILOT_DAILY_COUNTERS`), histogramme des délais (dix-neuf classes), offres actives (sur la ligne du dernier jour complet de chaque passage) et date du passage. Aucun identifiant de personne, de page, de demande ; aucun texte.
- Index : `by_network_and_country_and_dayStartAt` (lecture d'une période, dernier jour mesuré) et `by_network_and_dayStartAt` (écriture de toutes les portées d'un jour).

### Passage nocturne

`refreshPilotMetrics` (mutation interne, cron quotidien à inscrire par ANTSIA) lance `refreshPilotMetricsPage`, chaîné par le planificateur. Il recalcule les **90 jours UTC complets** qui précèdent son jour, par **blocs de dix jours** :

1. offres actives des pages lisibles (garde des pages du moteur), pages de 100 ;
2. pour chaque bloc : demandes, puis adhésions, puis avis, lus par l'index de création du moteur (`_creationTime`, à un jour près de la date métier `createdAt`, qui seule range une ligne dans son jour), pages de 100 ;
3. évènements de page commencés dans le bloc (index `by_network_organizer_startAt`, organisateur personnel absent), pages de 25, puis leurs places confirmées évènement par évènement, pages de 100 ;
4. écriture du bloc : **une ligne par jour et par portée**, une seule fois par passage — tout le réseau toujours, chaque pays compté ce jour-là, chaque pays déjà présent ce jour-là (remis à zéro s'il n'a plus rien) ; au plus 300 lignes par étape.

Le passage ne lit que des états, des dates et des références ; les textes libres (besoin, détails, motif, avis, mot joint) ne sont ni recopiés ni agrégés. Rejoué, il réécrit les mêmes lignes (idempotence) ; une ligne source effacée disparaît de son jour au passage suivant.

### Lectures et présentation

- `pilotMetrics` (réseau, `networkQuery`) : réservée aux rôles `network_admin` et `network_moderator` ; refus indistinct pour tout autre membre, **avant** le jugement des arguments. `pilotMetricsAccess` dit au lecteur son seul droit (entrée du menu). `consolePilotMetrics` (`operatorQuery`) sert la même projection aux opérateurs de plateforme vivants.
- La lecture additionne au plus 90 lignes déjà agrégées ; elle ne lit aucune table source. `daysMeasured` dit les jours effectivement écrits ; `computedAt` est le plus ancien passage parmi ces jours.
- Présentations (`presentPilotIndicators`) : un compte sous **5** se dit « moins de 5 », jamais le chiffre ; une part dont l'écart avec sa base est inférieur à 5 est **masquée** (l'écart se déduirait sinon) ; un taux n'est publié qu'avec une part publiée, en points entiers ; un délai se donne par classe (« 12 h au plus »), non publié sous cinq réponses. Même seuil que l'export de transparence du moteur.
- Interface : route `/pilote` (`apps/diasporale_com/src/app/pilote/page.tsx`), écran `pilot-metrics-screen.tsx` (pays ouverts ou tout le réseau, période au clavier, tableaux à deux colonnes lisibles à 320 px, FR/EN), port `pilot-metrics-port.ts`, adaptateur moteur `engine-pilot-metrics.ts`, démonstration `demo/pilot-metrics.ts`.
- Démonstration : agrégats **fictifs**, déterministes, signalés à l'écran ; deux responsables fictifs (`p-mireille`, `p-nadia`) ouvrent le tableau, les autres membres reçoivent le refus indistinct.

## 3. Ce que la mesure ne fait pas

- **Aucune donnée personnelle** dans les agrégats : ni identifiant de personne, ni nom, ni coordonnée, ni texte de demande, de proposition, de message, d'avis ou de recherche.
- **Aucun suivi individuel** : aucun parcours, aucune session, aucune cohorte de personnes, aucun identifiant persistant ; la mesure compte des lignes métier, pas des gens.
- **Recherches sans résultat et abandons : non mesurés.** Les mesurer exigerait un compteur quotidien anonyme dans la recherche du catalogue, sans texte de requête ; il n'est pas écrit dans ce lot.
- Pas de protection complémentaire entre deux indicateurs qui ne sont pas liés par un taux (par exemple « répondues » moins « confirmées ») ; l'accès reste réservé aux responsables du réseau.
- Une adhésion redemandée après un refus ne crée pas de nouvelle entrée : la table ne garde qu'une ligne par personne et association.
- L'état de modération des évènements n'est pas relu ; les évènements annulés sont exclus.
- Au-delà de 90 jours, un jour n'est plus recalculé : ses comptes restent ceux du dernier passage qui l'a écrit. Aucune purge automatique de ces agrégats anonymes n'est écrite.
- Pendant l'écriture d'un passage, une période peut mêler des jours de deux passages ; `computedAt` affiche alors le plus ancien.
- Aucun export, aucune alerte, aucun envoi à un tiers.

## 4. Grille de coûts — trois scénarios hypothétiques

Les volumes ci-dessous découlent d'**hypothèses de travail** et des formules du §7.2 du plan global. Ce ne sont ni des prévisions, ni des mesures. Ils doivent être remplacés par les relevés du pilote, puis complétés des tarifs vérifiés, de la région, des sous-traitants, de la réversibilité et des conditions de sortie des données.

### 4.1 Hypothèses

| Hypothèse | S1 — pilote resserré | S2 — pilote France | S3 — plusieurs pays |
|---|---|---|---|
| Membres actifs par jour (U) | 100 | 1 000 | 5 000 |
| Sessions par jour et par actif (S) | 2 | 2 | 3 |
| Minutes de vidéo par session (M) | 5 | 5 | 6 |
| Jours du mois (J) | 30 | 30 | 30 |
| Débit moyen distribué | 1 Mbit/s | 1 Mbit/s | 1 Mbit/s |
| Vidéos conservées | 200 | 2 000 | 10 000 |
| Durée moyenne d'une vidéo | 30 s | 30 s | 30 s |
| Somme des débits des variantes | 4 Mbit/s | 4 Mbit/s | 4 Mbit/s |
| Appels par jour (durée 10 min, 2 participants) | 10 | 100 | 500 |
| Notifications par actif et par jour | 3 | 3 | 3 |
| Offres actives | 50 | 500 | 2 500 |
| Demandes / adhésions / avis sur 90 jours | 300 / 150 / 60 | 3 000 / 1 500 / 600 | 15 000 / 7 500 / 3 000 |
| Évènements / places sur 90 jours | 20 / 400 | 200 / 4 000 | 1 000 / 20 000 |
| Pays mesurés | 1 | 1 | 10 |

### 4.2 Volumes calculés (formules du §7.2)

| Grandeur | Formule | S1 | S2 | S3 |
|---|---|---|---|---|
| Minutes de vidéo lues par mois | U × S × M × J | 30 000 | 300 000 | 2 700 000 |
| Go vidéo distribués par mois | minutes × débit × 60 / 8 / 1 000 | 225 | 2 250 | 20 250 |
| Minutes-participants d'appels par mois | appels × 10 × 2 × J | 6 000 | 60 000 | 300 000 |
| Stockage vidéo (Go) | vidéos × durée × Σ débits / 8 / 1 000 | 3 | 30 | 150 |
| Notifications par mois | U × 3 × J | 9 000 | 90 000 | 450 000 |
| Lignes écrites par le passage de mesure | 90 × (1 + pays) | 180 | 180 | 990 |
| Lectures par passage de mesure | 2 × offres + 3 × demandes + 2 × adhésions + 3 × avis + 2 × évènements + places + lignes | 2 100 | 19 380 | 96 990 |
| Lectures du passage par mois | lectures × J | 63 000 | 581 400 | 2 909 700 |
| Lectures d'un affichage du tableau | au plus 2 × 90 + 1 lignes agrégées | 181 | 181 | 181 |

Hors overhead, cache et reprises. Les volumes des pas planifiés du passage (une cinquantaine d'étapes au minimum, davantage avec les pages supplémentaires) sont à relever au pilote.

### 4.3 Coûts mensuels — à calculer après vérification des tarifs

`coût_mensuel = socle + base/lectures/écritures + stockage + transcodage + trafic + minutes_appels + notifications + observabilité + modération/support`

| Poste | Unité de facturation | Tarif unitaire | Coût S1 | Coût S2 | Coût S3 |
|---|---|---|---|---|---|
| Socle (abonnements, environnements) | forfait | à vérifier | à calculer | à calculer | à calculer |
| Base : appels de fonctions, lectures, écritures | volume du fournisseur | à vérifier | à calculer | à calculer | à calculer |
| Stockage de la base et des fichiers | Go-mois | à vérifier | à calculer | à calculer | à calculer |
| Transcodage des vidéos (non construit, G6b) | minute encodée | à vérifier | à calculer | à calculer | à calculer |
| Trafic sortant | Go | à vérifier | à calculer | à calculer | à calculer |
| Temps réel (appels) | minute-participant | à vérifier | à calculer | à calculer | à calculer |
| Notifications (push, courriel) | envoi | à vérifier | à calculer | à calculer | à calculer |
| Observabilité (journaux, alertes) | volume ou forfait | à vérifier | à calculer | à calculer | à calculer |
| Modération et support | heure humaine | à vérifier | à calculer | à calculer | à calculer |

Les coûts humains de modération ne valent pas zéro. Région, sous-traitants, réversibilité et sortie des données : **à renseigner** pour chaque fournisseur avant tout choix.

### 4.4 Coût par service abouti

`coût_par_service_abouti = coût_attribuable_services / prestations_réalisées`

Le dénominateur est l'indicateur « Prestations réalisées » du tableau `/pilote`, sur la même période. Sous le seuil (« moins de 5 »), le ratio ne se calcule pas : il désignerait quelques prestations, donc quelques personnes.

## 5. Alertes du §7.3 : ce qui existe, ce qui manque

| Alerte ou mécanisme | Ce qui existe dans les sources | Ce qui manque |
|---|---|---|
| Erreurs de dépôt | Garde des fichiers : états d'analyse (`fileScans`), reprise des analyses figées toutes les 5 min, purge quotidienne des fichiers infectés ; compte `pendingFiles` des métriques de console, recalculé à la demande d'un opérateur | Seuil d'alerte, destinataire, envoi automatique |
| Files de transcodage | Rien : la chaîne de transcodage n'est pas construite (G6b, décision D-G07) | Tout, avec la chaîne elle-même |
| Notifications en échec | États de livraison `failed` et `unavailable` ; vidage des livraisons toutes les 30 s | Compteur d'échecs exposé, seuil, alerte |
| Appels sans média | Nettoyage des appels et des présences périmés (30 s et 60 s) | Mesure d'un appel établi sans flux, signal |
| Saturation TURN | Rien côté moteur | Relevé du service temps réel, seuil, alerte |
| Recherches sans résultat | Rien (aucun journal de requêtes, à dessein) | Compteur quotidien anonyme par pays, sans texte |
| Demandes sans réponse | **Mesurées par ce lot** : demandes répondues et expirées, avec leur base, au tableau `/pilote` | Seuil et signal (console ou cloche des responsables) |
| Reprise idempotente | Contrat de commande des demandes (D-G16) ; passage de mesure rejouable sans double compte | — |
| Lettres mortes | Compte `deadLetters` (fédération) des métriques de console | Lettres mortes des notifications et des jobs applicatifs, alerte |
| Santé des tâches planifiées | Relevé toutes les 5 min (`operationalHealth.observe`), signal dans la console, sans nom ni argument de tâche | Erreurs synchrones non couvertes ; alertes et journaux Convex, seuil et astreinte à raccorder par le propriétaire (ANTSIA `docs/20`) |
| Sauvegarde et restauration | Procédure écrite et outillée (ANTSIA `docs/20`) | Exercice exécuté et rapporté |
| Fermeture par pays ou module | Pays ouverts du réseau (`networks.openCountries`, console) ; capacités facultatives du port DIASPORALE | Drapeau de fermeture par module côté moteur |
| Retour à la version précédente | — | Plan écrit, dépendant des décisions d'hébergement du propriétaire |

Le mode dégradé reste celui du §7.3 : aucune donnée de ce tableau ne marque un message distribué, un rendez-vous accepté ou un fichier publié.

## 6. Raccords demandés hors de la réservation du chantier

1. **Cron** (`ANTSIA/convex/crons.ts`, délégué au coordinateur) : la mutation interne `internal.modules.diaspora.pilotMetrics.refreshPilotMetrics`, arguments `{}` — quotidienne, après le passage des hubs ; identifiant ASCII.
2. **Inventaire des données** (`ANTSIA/convex/modules/people/dataPolicies.ts`) : `pilotMetricsDaily: {shared: true}` — agrégat anonyme partagé, ni exporté ni effacé par personne, recalculé par le passage.
3. **Manifeste de la tranche** (`ANTSIA/convex/modules/diaspora/manifest.ts`) : ajouter `pilotMetricsDaily` aux tables et `modules/diaspora/pilotMetrics:refreshPilotMetrics` aux passages planifiés (le test de la tranche compare le manifeste aux tables).
4. **Menu** (`apps/diasporale_com/src/components/app-shell.tsx`) : une entrée `routes.pilotDashboard()`, libellé `pilotMetrics.nav`, montrée seulement quand `usePilotMetrics()?.useAccess()` rend `allowed: true`.
5. **Parité** (`docs/04_PARITE_SURFACES.md`) : la ligne de la surface `/pilote` (moteur et démonstration fictive).

## 7. Niveau de preuve

| Preuve | État |
|---|---|
| Sources du domaine, du moteur, du port, des fournisseurs, de l'écran et de la route | Écrites et raccordées dans l'arbre |
| Tests (domaine à couverture complète, convex-test, fournisseurs, écran) | **Écrits, non exécutés** |
| Codegen, typage, lint, build | Différés sur instruction du propriétaire ; l'API générée ne connaît `pilotMetrics` qu'après le prochain codegen |
| Recette navigateur (clavier, 320 px, FR/EN, deux comptes) | Non jouée |
| Grille de coûts | Hypothétique ; aucun tarif vérifié |
| Production | Aucun déploiement, aucun cron inscrit, aucune mesure réelle |
