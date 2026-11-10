# Plan directeur de finalisation de DIASPORALE

> Établi le 10 novembre 2026, par lecture de tous les documents du projet et du code d'`origin/main` (DIASPORALE `bead76d`, ANTSIA `fd58d73b`). Rien n'a été exécuté : ni test, ni recette, ni publication.
> Ce dossier est la suite du plan 15 du dossier de finalisation d'ANTSIA (9 novembre), qui tenait lieu de lot G0 pour DIASPORALE. Le plan 15 donnait l'état d'ensemble et vingt-trois lots. Ce dossier descend d'un niveau : dix-sept plans, un par fonctionnalité, chacun comparé aux meilleures applications de sa catégorie.
> Les comparaisons viennent de la connaissance de ces produits, sans revérification en ligne. Un « ? » marque ce qui n'est pas sûr.
> Ce dossier décrit des faiblesses encore ouvertes (§ 3.2). DIASPORALE n'est en ligne qu'en démonstration, avec des comptes fictifs ; les lots des vagues 1 et 2 les ferment avant toute ouverture. Quelques-unes tiennent au moteur commun, qui sert aussi ANTSIA : elles sont à déposer en issues `[S1]`, en tête de la vague 2.

Légende des chemins : `D:` = dépôt DIASPORALE, `A:` = dépôt ANTSIA.

## 0. L'essentiel en une page

**Le constat.** DIASPORALE est large et soigné. Sur 1 389 capacités comparées aux applications de référence, 579 existent, 171 existent en partie, 595 manquent et 44 sont fermées volontairement. Une soixantaine de celles qui manquent existent déjà dans le moteur : il suffit de les montrer. Pourtant le réseau ne peut pas ouvrir, pour six raisons.

| # | Raison | Exemple vérifié dans le code |
|---|---|---|
| 1 | Le réseau ne peut pas s'amorcer | Personne ne peut devenir « vérifié » au premier jour ; or seul un vérifié parraine ou crée une page |
| 2 | Le réseau ne peut pas se gouverner | Aucun administrateur ni modérateur du réseau ne peut être nommé hors des comptes de démonstration |
| 3 | Les trois parcours prioritaires ne se ferment pas en réel | La conversation d'une demande de service est fermée partout ; un évènement est introuvable hors de la page de son association |
| 4 | Des écrans promettent ce qui n'existe pas | « Sera relue », « l'équipe vous écrira », « 0 évènement à venir », « Appeler » |
| 5 | Quelques trous précis de vie privée | Photos envoyées brutes, avec leurs métadonnées (dont la position quand l'appareil l'inscrit) ; consentements à la mauvaise portée ; profil commun réécrit à l'entrée |
| 6 | Presque rien n'a été vu sur le vrai moteur | Deux recettes seulement : à deux comptes en local le 19/10, en ligne le 22/10 ; jamais sur un vrai téléphone |

**Le travail.** 354 lots : 56 bloquent l'ouverture du pilote (P0), 146 sont attendus par quiconque vient des grandes applications (P1), 86 enrichissent (P2), 66 attendent une condition externe (P3). 25 des lots bloquants n'ont aucune porte : ils n'attendent ni clé ni personne. 126 lots demandent quelque chose au moteur, dont 18 bloquants : c'est la première dépendance du projet. Le registre est dans [`EXECUTION.md`](EXECUTION.md).

**Le chemin.** Quatre jalons (§ 4) et huit vagues (§ 5). Les cinq premières mènent au pilote France : partir du vrai, fermer les trous, rendre le réseau gouvernable, ouvrir la porte, mettre en production.

**Vos quatre prochains gestes** (détail au § 6) :
1. Trancher l'amorçage : qui sont les premiers membres vérifiés, et qui administre le réseau.
2. Mandater le juriste : droit applicable à des résidents de France et d'Europe, textes, âge, durées de conservation.
3. Saisir l'équipe de consulat.ga : attestation, objets publics, poste pilote.
4. Ouvrir la session DIASPORALE dans une copie propre du dépôt et lancer la vague 1.

## 1. L'intention du propriétaire

| # | Intention | Source |
|---|---|---|
| 1 | **Un réseau fermé pour les Gabonais de l'étranger**, « officiel mais ouvert », par pays et global, séparé d'ANTSIA : ce qui s'y publie y reste, sauf geste de l'auteur | Cahier (docs/00), § 0 |
| 2 | **Un réseau dans le réseau** : entrer dans DIASPORALE, c'est être inclus dans ANTSIA. Un moteur, trois réseaux, deux dépôts | Plan du programme, § 0 et § 3 |
| 3 | **Remplacer une vie communautaire dispersée** sur des groupes WhatsApp et Facebook : information perdue, arnaques, aucune mémoire, talents invisibles | Dossier produit de juillet, § 1 |
| 4 | **TikTok pour découvrir, Instagram pour présenter, WhatsApp pour échanger, la diaspora pour donner le sens** | Étude du 18/10 (docs/13) |
| 5 | **Trois résultats d'abord** : trouver une compétence locale, faire vivre une association, découvrir et communiquer | Plan global (docs/14), § 1.1 |
| 6 | **La réussite se mesure** aux mises en relation utiles, aux prestations abouties, aux rencontres et aux aides réalisées, pas au temps passé | Étude du 18/10 |
| 7 | **La confiance se voit et ne s'achète pas** : quatre badges calculés, attestation consulaire minimale et consentie, parrainage tracé | Cahier, § 5 et § 6 |
| 8 | **Étanchéité** : aucune donnée consulaire dans le moteur, aucun profil créé d'office, aucune coordonnée exposée | Cahier, § 5 |
| 9 | **Le citoyen ne paie jamais.** Les revenus sont professionnels et étiquetés | Dossier produit, § 5 ; cahier, lot D4 |
| 10 | **Amener à l'identité numérique et à l'inscription consulaire** par un parcours d'élévation | Cahier, § 2.2 |
| 11 | **Ouvrir pays par pays**, la France d'abord, avec deux associations relais et un modérateur ; jamais un pays vide | Dossier produit, § 8 ; cahier, § 7 |
| 12 | **Ne rien affirmer sans preuve** : aucun chiffre non mesuré, aucune recette dite faite sans l'avoir vue | Cahier, § 6.5 ; doctrine de communication |

**Ce que le propriétaire a corrigé, et qui vaut règle** : ne rien inventer (ni avis, ni compteur) ; un seul bouton plein par zone, de la couleur de sa famille d'actions ; colonne unique ; cinq destinations ; classement par date et par règles explicables, pas de fil « Pour vous » comportemental ; aucune promesse de chiffrement de bout en bout ; aucun paiement ; groupes de discussion à 256 ; personne n'est inscrit d'office dans un groupe.

## 2. La logique du projet et des métiers

### 2.1 Qui vient faire quoi

| Acteur | Ce qu'il vient faire | Ce que le projet lui doit | Plans |
|---|---|---|---|
| Le résident établi | Voir la vie de son pays, sortir, rendre service, se rendre visible | Un hub vivant, des évènements trouvables, un profil maîtrisé | 03, 05, 06, 08 |
| Le nouvel arrivant | S'installer, se loger, trouver ses premiers contacts | Un kit d'arrivée daté, de l'entraide, un mentor, des mises en garde | 11, 12 |
| Le responsable d'association | Exister, accueillir des adhérents, organiser, annoncer | Une page à lui, une équipe, des inscriptions, un canal vers ses adhérents | 07, 08, 04 |
| Le prestataire, l'entrepreneur | Trouver des clients | Une fiche, des demandes qualifiées, un rendez-vous tenu, des avis sur preuve | 09 |
| Le recruteur, à l'étranger ou au Gabon | Trouver des profils | Des offres, des candidatures privées, des talents consentants | 10 |
| Le poste consulaire, le ministère | Informer sa communauté | Une page « Officiel » non usurpable, des communiqués, des agrégats sans nom | 15 |
| Le modérateur de pays | Protéger | Une file, des délais visibles, des décisions motivées, une charte | 14 |
| L'administrateur du réseau | Tenir le réseau | Des rôles, des réglages, l'ouverture d'un pays, des mesures | 14, 06, 17 |
| Le proche resté au Gabon | Parler à sa famille | Il n'est pas membre : on le joint par ANTSIA, avec le même compte | 04 |
| consulat.ga | Attester, publier ses objets publics | Deux contrats signés, jamais une lecture de base | 01, 15 |
| IDN | Prouver l'identité | Une entrée unique pour tout le programme | 01 |
| Le moteur ANTSIA | Fournir les capacités communes | Des demandes claires, déposées en issues | tous |

### 2.2 Les parcours qui créent la valeur

Chaque plan sert une étape d'un de ces parcours. Un manque sur une étape casse la chaîne.

| Parcours | Étapes | Où il casse aujourd'hui |
|---|---|---|
| **A. « Je viens d'arriver à Paris, je cherche un coiffeur »** | entrer (01) → chercher (09) → lire la fiche et les avis (09) → demander (09) → échanger (04) → rendez-vous (09, 08) → être prévenu (13) → donner son avis (09) | Le prestataire ne peut pas créer sa page (vérification impossible) ; la conversation est fermée ; aucun avis ne paraît sans équipe ; rien ne prévient hors du site |
| **B. « Je fais vivre mon association »** | revendiquer ou créer la page (07) → équipe (07) → adhérents (07) → annoncer (03, 07) → évènement, inscriptions, accueil, galerie (08) → groupe (07, 04) | La revendication ne peut pas être tranchée ; l'évènement attend une approbation que personne ne peut donner, puis reste introuvable ; l'annulation ne prévient personne |
| **C. « Je découvre et je communique »** | fil et découverte (03) → profil (05) → relation (05) → message et appel (04) → hub (06) | Photos brutes ; au-delà de vingt commentaires, plus rien ; appels proposés sans serveur prouvé ; annuaire sans parcours |
| **D. « Je prouve qui je suis »** | code ou IDN (01) → parrainage (01) → attestation (01, 15) | IDN non branchée ; aucun parrain possible ; attestation fermée |
| **E. « Mon poste m'informe »** | page officielle (15) → communiqué (15) → avis (13) → démarche sur consulat.ga (15) | Aucune page de poste ne peut exister ; aucun lien vers la démarche |

### 2.3 La roue de croissance

Les associations relais et les postes apportent les premiers contenus. Les membres viennent pour leur pays. Ils cherchent un service, une aide, un emploi. Prestataires et recruteurs viennent pour ces demandes. Les mises en relation abouties et les avis sur preuve nourrissent la confiance. La confiance amène les suivants, par parrainage. Un pays vivant justifie l'ouverture du suivant.

Ce qui arrête la roue : un hub vide, une arnaque au logement, des notifications absentes ou trop nombreuses, une modération sans réponse, la lenteur sur un téléphone modeste.

### 2.4 Qui paie

| Toujours gratuit pour le membre | Payé plus tard par les professionnels, toujours étiqueté | Jamais |
|---|---|---|
| Entrer, publier, écrire, appeler, chercher, demander un service, candidater, adhérer, s'inscrire à un évènement, être aidé | Fiche d'entreprise enrichie, offre d'emploi mise en avant, encart étiqueté par pays, outils d'association, billetterie | Badge payant, accès payant à l'annuaire, vente de données, publicité dans la messagerie, classement payé caché |

Rien n'est vendu pendant le pilote. Aucun prix n'est fixé : le cadre se décide au lot LX-15 (plan 17).

### 2.5 Les séparations à ne jamais franchir

- **Le contexte du réseau** : visibilité `network` par défaut ; `root` seulement par geste de l'auteur, pour une audience publique.
- **L'étanchéité avec consulat.ga** : deux contrats signés, aucune lecture de base ; un dossier consulaire ne se traite jamais dans la messagerie.
- **La confiance et l'argent** : aucun badge ne s'achète ; l'attestation prouve une inscription, jamais une compétence.
- **Les portes** : pas d'annonce de particulier avant la conformité ; pas de paiement ; pas d'assistant avant le marquage de l'IA ; pas de pays ouvert sans modération.
- **Les zones d'écriture** : la session DIASPORALE écrit dans son dépôt et dans sa tranche du moteur ; tout le reste se demande par une issue `[S1]`.

### 2.6 La vie d'un Gabonais de l'étranger, moment par moment

C'est la logique métier propre à une diaspora. Le tableau dit ce que le produit offre aujourd'hui et ce qui manque.

| Moment | Ce dont la personne a besoin | Aujourd'hui | Ce qui manque | Plans |
|---|---|---|---|---|
| **Avant le départ** | Préparer son arrivée, trouver un contact | Fermé : le Gabon n'est pas un pays de résidence admis | Lire le kit avant de partir (ET-16) | 11, 01 |
| **L'arrivée** | Papiers, logement, banque, premiers contacts | Kit d'arrivée, entraide et mentorat écrits ; kit vide, jamais joué ; le mentorat accepté n'a pas de canal | Kit de départ du pays pilote (ET-06), premiers pas (ET-08), guide contre les arnaques (AN-01), conversation ouverte (DS-04) | 11, 12, 04 |
| **La vie installée** | Un coiffeur, un traiteur, une association, une soirée, un emploi | Services, pages, évènements, emploi écrits ; aucun parcours ne se ferme en réel | Les lots P0 des plans 07 à 10 | 07, 08, 09, 10 |
| **L'État** | Savoir ce que dit son consulat, faire une démarche | Attestation fermée ; aucune page de poste ; aucun lien vers la démarche | Page du poste pilote (VC-04), passerelles (VC-06), attestation réelle (DG-009a) | 01, 15 |
| **Le lien avec le pays** | Parler à la famille, envoyer un colis, saisir une offre au Gabon | La messagerie est bornée au réseau : un proche resté au Gabon ne se joint pas d'ici ; une offre d'emploi au Gabon est refusée par le code ; colis et transferts fermés | Dire la frontière et ouvrir ANTSIA en un geste (IM-12, EA-19) ; postes au Gabon (EM-07) ; « de passage au Gabon » (RP-17) ; colis après la conformité (AN-12) | 04, 10, 05, 12 |
| **Les moments durs** | Deuil, hospitalisation, solidarité | Rien de structuré ; les cagnottes restent fermées | Appel à la solidarité d'une association, sans encaissement (ET-17) ; compte d'un membre décédé (NP-16) | 11, 13 |
| **Transmettre** | Guider un plus jeune, garder une mémoire | Mentorat écrit | Retour après séance (DS-13), mentorat dans la durée (ET-11) | 11 |
| **Déménager ou rentrer** | Changer de pays, revenir au Gabon | Le changement de pays n'a ni délai ni explication ; le retour n'est pas prévu | Déménagement et retour (EA-14) | 01 |

## 3. Où en est le projet

### 3.1 Par fonctionnalité

« Présent » veut dire « dans le code et atteignable en mode moteur », pas « recetté ». Ces décomptes ne sont pas un taux d'avancement : les capacités n'ont pas le même poids.

| Plan | Présent | Partiel | Absent | Fermé | Le manque qui compte le plus |
|---|---|---|---|---|---|
| [01 Entrée, adhésion, confiance](01_ENTREE_ADHESION_CONFIANCE.md) | 41 | 13 | 28 | 2 | Personne ne peut devenir « vérifié » au premier jour ; IDN est annoncée, pas branchée |
| [02 Coque, navigation, charte](02_COQUE_NAVIGATION_CHARTE_ACCESSIBILITE.md) | 40 | 13 | 25 | 1 | Aucune page d'erreur ; un lien reçu ne mène pas à sa page |
| [03 Fil, découverte, recherche](03_FIL_PUBLICATIONS_DECOUVERTE_RECHERCHE.md) | 39 | 10 | 31 | 0 | Les photos partent brutes ; au-delà de vingt commentaires, rien ne se lit |
| [04 iCom et mise en relation](04_ICOM_MESSAGES_APPELS_MISE_EN_RELATION.md) | 40 | 14 | 35 | 3 | La mise en relation n'a jamais parlé ; « Appeler » est proposé sans serveur prouvé |
| [05 Profil, relations, annuaire](05_PROFIL_RELATIONS_ANNUAIRE.md) | 33 | 11 | 33 | 3 | Photo de profil brute ; annuaire qu'on ne peut pas parcourir ; profil non signalable |
| [06 Hubs, villes, carte](06_HUBS_PAYS_VILLES_CARTE.md) | 31 | 14 | 26 | 1 | L'écran promet une relecture qui n'existe pas ; la règle d'ouverture d'un pays n'est appliquée nulle part |
| [07 Pages, associations, groupes](07_PAGES_ASSOCIATIONS_GROUPES.md) | 28 | 5 | 41 | 3 | Aucune revendication ne peut être tranchée en production |
| [08 Évènements, agenda](08_EVENEMENTS_AGENDA.md) | 35 | 13 | 36 | 2 | Un évènement est introuvable hors de sa page ; l'annulation ne prévient personne |
| [09 Services, rendez-vous, avis](09_SERVICES_RENDEZ_VOUS_AVIS.md) | 45 | 5 | 34 | 5 | « Coiffeur à Paris » ne peut pas se jouer en réel : trois portes fermées |
| [10 Emploi, talents](10_EMPLOI_TALENTS.md) | 45 | 1 | 41 | 2 | La boucle ne se ferme pas ; rien ne protège d'une fausse offre |
| [11 Entraide, mentorat, kit](11_ENTRAIDE_MENTORAT_KIT_ARRIVEE.md) | 50 | 5 | 38 | 2 | Deux promesses non tenues sur les missions ; le kit naît vide |
| [12 Petites annonces](12_PETITES_ANNONCES_BESOINS_DIASPORA.md) | 0 | 5 | 61 | 0 | Rien n'est construit ; les annonces existent déjà de fait dans le fil, sans garde |
| [13 Notifications, réglages, données](13_NOTIFICATIONS_REGLAGES_DONNEES.md) | 37 | 12 | 31 | 1 | Deux consentements à la mauvaise portée ; rien ne sort de l'application |
| [14 Modération, conformité](14_MODERATION_SECURITE_CONFORMITE.md) | 39 | 7 | 37 | 5 | Aucun rôle de réseau hors démonstration ; des objets entiers ne se signalent pas |
| [15 Vie publique consulaire](15_VIE_PUBLIQUE_CONSULAIRE.md) | 24 | 9 | 32 | 5 | Aucune page de poste ne peut exister |
| [16 Mobile et web installable](16_APPLICATION_MOBILE_PWA.md) | 25 | 10 | 33 | 3 | Jamais ouvert sur un vrai téléphone |
| [17 Lancement, pilote, exploitation](17_LANCEMENT_PILOTE_EXPLOITATION_MODELE_ECONOMIQUE.md) | 27 | 24 | 33 | 6 | La sonde dit « ok » sans moteur ; publier dépend d'un seul poste |
| **Total** | **579** | **171** | **595** | **44** | |

### 3.2 Les constats revérifiés un par un dans le code

Les agents ont rédigé les plans. Ces constats ont été revérifiés à la main dans le code d'`origin/main`, parce qu'ils décident des priorités. Les autres constats des plans ne l'ont pas été : chaque lot commence par vérifier que l'état décrit est toujours vrai.

| Constat | Preuve | Lot |
|---|---|---|
| Personne ne peut devenir « vérifié » au premier jour : il faut l'attestation, ou IDN de niveau 2 et un parrain ; le parrain doit être vérifié depuis plus de trente jours | `D:packages/diasporale-domain/src/eligibility.ts`, `D:packages/diasporale-domain/src/sponsorship.ts` | EA-01 |
| Aucune fonction ne pose un rôle de réseau, sauf celle des comptes de démonstration | `A:convex/modules/platform/demoAccounts.ts` | MD-01, LX-03, AS-01 |
| La photo d'une publication part telle quelle en mode moteur ; le ré-encodage n'existe que dans la démonstration | `D:apps/diasporale_com/src/data/engine-source.ts` (`uploadMedia`), `D:packages/diasporale-features/src/demo/source.ts` | FD-01 |
| La photo de profil et la couverture partent telles quelles | `D:apps/diasporale_com/src/data/engine-profile-images.ts` | RP-01 |
| En mode moteur, le hub ne montre jamais d'évènement : la liste est vide en dur, le compteur est écrit à zéro | `D:apps/diasporale_com/src/data/engine-views.ts`, `A:convex/modules/diaspora/hubs.ts` | EV-02, HB-02 |
| La portée locale d'une publication n'est gardée qu'à l'écran ; le commentaire du code le dit | `D:apps/diasporale_com/src/data/engine-source.ts` (`publish`), `A:convex/modules/posts/posts.ts` | HB-03 |
| La sonde de santé répond « ok » sans lire sa configuration ni joindre le moteur | `D:apps/diasporale_com/src/app/api/sante-fonctionnelle/route.ts` | LX-01 |
| Sans la variable de source, une construction sert les données fictives, sans erreur | `D:apps/diasporale_com/src/lib/env.ts` | LX-01 |
| L'entrée publie d'abord le profil commun avec le nom et l'identifiant saisis, puis enchaîne trois à cinq écritures | `D:apps/diasporale_com/src/data/engine-source.ts` (`join`) | EA-04 |
| L'accord aux notifications part sans réseau, l'accord à l'annuaire avec | `D:apps/diasporale_com/src/data/engine-source.ts` (`join`) | NP-01 |
| Bloquer ne touche pas aux abonnements | `A:convex/modules/graph/connections.ts` (`blockPair`) | RP-03 |
| L'annuaire ne rend rien sous une longueur minimale de saisie : on ne peut pas le parcourir | `A:convex/modules/diaspora/directory.ts` (`searchMembers`) | RP-04 |
| Le port de signalement connaît neuf natures propres à DIASPORALE ; ni profil, ni page, ni évènement | `D:packages/diasporale-features/src/data/content-reports-port.ts` | MD-02 |
| « Disponible pour aider » et les associations sont repassés tels quels, sans champ de saisie | `D:apps/diasporale_com/src/screens/settings-screen.tsx` | RP-05 |
| La messagerie personnelle exige une relation ; l'écran des missions promet pourtant « l'équipe vous écrira par la messagerie » | `A:convex/modules/messaging/inbox.ts`, `D:packages/diasporale-features/src/i18n/locales/fr/mutual-aid.json` | ET-01, ET-02 |
| Trois natures de conversation attachée à un objet : demande de service, mentorat, candidature | `D:packages/diasporale-domain/src/conversation-contexts.ts` | IM-06, ET-02, AN-09 |
| Les cliquets « communication publique » et « aucune adresse en dur » ne lisent que les dossiers d'ANTSIA ; DIASPORALE a les siens pour les textes, les couleurs et les chaînes | `A:tests/ratchets/lib/source-files.ts`, `D:apps/diasporale_com/src/ratchets` | LX-06, UX-11 |

### 3.3 En ligne et en réel

- **En ligne** : la démonstration seulement. Elle répond, et sert le déploiement relevé le 9/11 (lecture seule, constaté le 10/11). `diasporale.com` ne répond pas. Aucun backend de production n'a de réseau `diasporale`.
- **En réel** : une recette à deux comptes sur backend local le 19/10 (photos, entraide, mission, mentorat, candidature, « coiffeur à Paris » jusqu'à l'avis déposé) ; une recette en ligne le 22/10 (publication, signalement, voie des délais légaux). Rien d'autre. Chaque plan liste, à la fin de son § 2, ce qui est écrit mais jamais recetté.

### 3.4 Ce que ce dossier précise du plan 15

| Ligne du plan 15 | Ce qu'il disait | Ce que la lecture détaillée montre | Plan |
|---|---|---|---|
| Entrée par IDN | Partiel : écran présent, recette jamais faite | L'écran est une simulation de démonstration ; en mode moteur le bouton est désactivé | 01 |
| Hubs par pays, évènements du pays | Présent | En mode moteur, le hub ne montre aucun évènement | 06, 08 |
| Évènement organisé par une personne | Absent | Il existe, entre relations, et se voit dans l'agenda ; ce qui manque est l'évènement de personne ouvert aux inscriptions | 08 |
| DS-09, plafond « 256 » | Critère d'acceptation | 256 vaut pour un groupe de discussion, pas pour un groupe thématique, qui est un lieu de publication | 07 |
| DS-14, notifications | P2 | Les volets « préférences » et « notifications du navigateur » passent en P1 : sans canal sortant, un professionnel n'apprend une demande qu'en ouvrant le site | 13, 16 |
| DG-030, paiements et outils professionnels | Absent du plan 15 | Repris du plan global (docs/14) | 17 |

## 4. Ce que « terminer » veut dire

Quatre jalons, chacun avec des critères vérifiables. Ils reprennent les lots D1 à D4 du cahier.

### Jalon 1 — Le pilote France peut ouvrir

| Domaine | Critère | Lots |
|---|---|---|
| État | `verify` vert sur `main` des deux dépôts ; documents d'état justes | DS-01 |
| Amorçage | Des membres vérifiés existent, par une décision tracée ; deux administrateurs et une équipe de modération France sont nommés hors démonstration | EA-01, MD-01, LX-03 |
| Entrée | Deux portes éprouvées en réel : code par e-mail et IDN ; un profil ANTSIA existant est respecté | EA-02, EA-04, EA-06 |
| Vérité | Aucun écran ne promet ce qui n'existe pas | HB-01, EV-02, VC-01, IM-01, ET-01, FD-04 |
| Vie privée | Photos nettoyées ; consentements à la bonne portée ; droits ouverts sans adhésion ; déclarant protégé | FD-01, RP-01, NP-01, NP-02, MD-07 |
| Gouvernance | Tout objet se signale ; les réglages de modération ont un écran ; des règles écrites et une permanence existent | MD-02 à MD-06 |
| Parcours | Les trois parcours prioritaires joués à plusieurs comptes sur le vrai moteur, conversation de mise en relation comprise | DS-04, DS-05, LX-04 |
| Droit | Textes relus par le juriste ; questions de droit applicable tranchées pour ce qui ouvre | DS-07, LX-05, EA-07 |
| Production | Réseau créé par la console, domaine, hébergement, expéditeur ; publication et retour arrière décrits dans le dépôt ; sonde vraie | DS-06, LX-01, LX-02 |
| Qualité | Accessibilité AA sur les parcours d'entrée, de publication et de signalement ; passe sur de vrais téléphones | DS-08, MO-01 |
| Animation | Deux associations relais, un kit de départ, des contenus consentis ; aucune rubrique vide présentée comme vivante | DG-029, ET-06, LX-11 |

### Jalon 2 — À la hauteur des références

Quelqu'un qui vient de WhatsApp, d'Instagram ou de Facebook retrouve ce qu'il attend : les lots P1 des plans 02 à 05, 08 et 13, et l'application web installable du plan 16.

### Jalon 3 — La communauté vit et s'étend

Services, associations, emploi et entraide sont utilisés et mesurés par `/pilote`. L'attestation consulaire est réelle. Le poste pilote a sa page. Un deuxième pays ouvre, avec sa propre équipe de modération (MD-08, HB-08).

### Jalon 4 — Le téléphone, les annonces, le modèle économique

Application mobile si les preuves la demandent ; petites annonces après la conformité ; offres professionnelles étiquetées ; assistant.

**Le jalon 1 passe avant tout.** Les jalons 2 et 3 avancent ensuite en parallèle.

## 5. La feuille de route

Huit vagues. Les cinq premières mènent au jalon 1 et contiennent les 56 lots bloquants. Le détail de chaque lot est dans son plan ; son état se suit dans [`EXECUTION.md`](EXECUTION.md).

### Vague 0 — Vos démarches (à lancer maintenant, elles sont longues)

Le juriste, l'amorçage, les responsables du réseau, l'équipe de consulat.ga, l'hébergement et le domaine, l'expéditeur des courriels, les associations relais. Détail au § 6.1.

### Vague 1 — Partir du vrai (aucune clé, aucun tiers)

| Ordre | Lots | Pourquoi |
|---|---|---|
| 1. Contrôle de départ | **DS-01** état réel et documents · **LX-01** sonde vraie et garde de la source · **LX-04** banc de recette local · **EV-01** évènements de démonstration | Les sessions suivantes partent d'un état vrai et d'un banc qui permet de jouer |
| 2. Dire vrai | **HB-01** pays non ouvert · **EV-02** plus de « zéro évènement » · **VC-01** l'officiel · **IM-01** appels retirés tant qu'ils ne sont pas prouvés · **ET-01** bénévoles · **FD-04** état réel d'une publication · **UX-03** menu du compte | Ce sont des promesses fausses déjà à l'écran ; chaque lot est petit |
| 3. Finir la charte | **DS-02** six boutons · **DS-03** écrans et textes | Décidé le 9/11 ; petit et visible |

### Vague 2 — Fermer les trous (aucune clé ; quelques demandes au moteur)

| Thème | Lots |
|---|---|
| Photos et vidéos | **FD-01**, **RP-01**, **FD-02** |
| Identité et consentements | **EA-03** statut relu · **EA-04** profil existant respecté · **NP-01** consentements · **NP-02** avec **EA-05** droits sans adhésion |
| Protection des personnes | **RP-03** blocage · **MD-07** déclarant protégé · **IM-02** qui peut m'appeler · **HB-03** garde serveur de la portée locale · **EM-02** conservation des candidatures |
| Solidité de l'écran | **UX-01** pages d'erreur · **UX-02** retour à la page demandée · **FD-03** tous les commentaires |

### Vague 3 — Rendre le réseau gouvernable et signalable

| Thème | Lots |
|---|---|
| Responsables | **MD-01** rôles du réseau, puis **LX-03** nomination en production et **AS-01** revendications |
| Réglages et règles | **MD-04** réglages de modération · **MD-05** règles et charte · **MD-06** permanence · **SV-01** avis publiables |
| Signaler | **MD-02** depuis chaque objet, avec **FD-05**, **RP-02**, **AS-02**, **EV-04**, **IM-03** · **MD-03** offre de service · **EM-01** fausses offres |
| Associations | **HB-02** évènements du pays dans le hub · **EV-03** avis aux inscrits |

### Vague 4 — Ouvrir la porte et prouver (clés, décisions, vraies personnes)

**EA-01** membres fondateurs · **EA-02** IDN · **EA-06** recette réelle de l'entrée · **EA-07** âge et identification · **DS-04** mise en relation et guichet · **DS-05** campagne de recettes sur le vrai moteur · **MO-01** passe sur de vrais téléphones.

### Vague 5 — Mettre en production

**LX-02** publication et retour arrière dans le dépôt · **DS-06** dossier de mise en production · **LX-05** puis **DS-07** textes · **DS-08** accessibilité et réseau lent · **DG-029** pilote France.

**→ Jalon 1 : le pilote France peut ouvrir.**

### Vagues 6 à 8 — Après l'ouverture

| Vague | Contenu | Lots | Jalon |
|---|---|---|---|
| 6 · À la hauteur des références | Les lots P1, dans l'ordre des trois résultats prioritaires. **Trouver une compétence** : rappel et report du rendez-vous, villes, photos d'une offre, écrire à une page, notifications du navigateur. **Faire vivre une association** : groupes ouverts, annonce aux adhérents, évènements dans le fil et le hub, report, couverture. **Découvrir et communiquer** : partage, mentions, statuts, annuaire par pays et par ville, demandes de message. **Confiance** : attestation réelle, page du poste, invitation, équipes par pays. **Tenir** : aide, états communs, application installable, mesure du pilote | 146 lots | 2 et 3 |
| 7 · La communauté s'étend | Les lots P2 : créneaux, favoris, alertes, carte, suivi d'un autre pays, mentorat dans la durée, résumé par pays, remontée dans le moteur des fonctions communes | 86 lots | 3 |
| 8 · Sous condition externe | Les lots P3 : petites annonces, application native, direct d'un évènement, offres professionnelles, paiement, assistant | 66 lots | 4 |

Dans chaque plan, le § 6 donne l'ordre interne de ses lots et son volet de recette.

### 5.1 Les mécanismes communs : un seul lot les construit

Plusieurs plans demandent la même brique, et quelques lots se recouvrent. Ce tableau fait foi : un lot construit, les autres s'y branchent ou se livrent dans le même changement.

| Brique | Lot qui la construit | Lots qui s'y branchent |
|---|---|---|
| Rôles du réseau (administrateur, modérateur) | MD-01 | LX-03 (nomination en production, lecteurs de `/pilote`), AS-01 (revendications), HB-08 (ouvrir un pays) |
| Préparer une image avant l'envoi | FD-01, sur la brique SD-02 du moteur si elle est livrée | RP-01 |
| Signaler un objet | MD-02 (contrat des natures, feuille commune, bureau) | FD-05, RP-02, AS-02, EV-04, IM-03, MD-03, MD-10, AN-10 : chacun pose le geste dans ses écrans |
| Réglages de modération et relecture | MD-04, sur MC-02 du moteur | SV-01, HB-11, FD-04, les décisions de relecture des plans 08, 09, 10 |
| « Mes données » hors adhésion | NP-02 | EA-05 : même changement |
| Revenir à la page demandée après la connexion | UX-02 | MO-03 : même changement ; HB-06, MO-21 |
| Conversation attachée à un objet, nouvelles natures | IM-06 (écrire à une page), par la procédure fermée du contrat | AS-07, ET-02, AN-09 ; DS-04 ouvre la politique pour les trois natures existantes |
| Évènements d'un pays | HB-02 (lecture bornée dans la tranche), puis EV-05 (lecture indexée du moteur, ville, catégorie, portée) | EV-07, VC-13, UX-17 |
| Rappel d'un engagement daté | SV-02 | ET-05, ET-14 ; les évènements gardent le rappel du moteur |
| Matrice des avis et genres manquants | NP-05 | EV-03, SV-02, SV-07, ET-01, ET-07, AS-06, IM-04 |
| Notifications hors du site | DS-14 (volet notifications du navigateur) | MO-06, NP-11, NP-12 |
| Enregistrer un objet | DS-11 (volet favoris), plan 09 | DS-11 (volet alertes emploi), AN-15, les ressources du kit |
| Villes | HB-10 | SV-06, RP-04, EM-11, AS-16, EV-05 |
| Passage vers ANTSIA | EA-19 | IM-12, SV-17, EM-16 |
| Mesures du pilote | LX-09 | ET-10, EM-14, MD-11, MD-16, AN-17 |
| Mesure d'usage consentie | LX-14 | NP-15 : même changement |
| Lutte contre les arnaques | MC-06 du moteur (motif), MD-13 | AN-01, EM-01 |
| Règles de la communauté | MD-05 (le texte), LX-05 (les pages) | EA-13 (acceptation à l'entrée), HB-05 |
| Lecture du code QR | EV-10 (code court, pointage par identifiant), MO-08 (décodeur de secours) | MO-07 |
| Contenus de démonstration | LX-08 | IM-05, EV-01 |
| « Je cherche » | AN-14 | SV-16, ET-11 : un seul mécanisme |

## 6. Vos décisions et vos démarches

### 6.1 Les démarches longues, à lancer maintenant

| # | Démarche | Ce qu'elle débloque |
|---|---|---|
| 1 | **Juriste** : droit applicable à la modération et aux données pour des résidents de France et d'Europe, en plus de l'ordonnance gabonaise 0011 ; textes légaux ; âge ; durées de conservation ; statut de l'attestation | Vagues 4 et 5 ; plans 01, 10, 13, 14, 17 |
| 2 | **Amorçage** : désigner les membres fondateurs, les deux administrateurs du réseau et les modérateurs de France | EA-01, MD-01, LX-03 ; tout le reste |
| 3 | **Équipe de consulat.ga** : remettre à niveau les deux contrats, désigner le poste pilote et son mandat, poser le bouton « Rejoindre DIASPORALE » | DG-009a, DG-009b, VC-03, VC-04, VC-10 |
| 4 | **Clés et comptes** : adresse d'envoi des courriels, client IDN, clés des notifications du navigateur, serveur d'appels si les appels ouvrent | EA-02, EA-06, DS-14, IM-11 |
| 5 | **Hébergement et domaine** de `diasporale.com` | DS-06, UX-10, MO-02 |
| 6 | **Associations relais et volontaires** du pilote : deux associations, quelques prestataires, quelques nouveaux arrivants | DG-029, ET-06, LX-11 |
| 7 | **Moteur** : faire savoir à la session du moteur que 126 lots lui demandent quelque chose, dont 18 bloquants ; les premiers sont HB-03, EV-03, MD-01 et MD-07 | Vagues 2 et 3 |

### 6.2 Les décisions qui débloquent la vague 1 à 4

Chacune a une recommandation, détaillée au § 7 du plan cité.

| Question | Recommandation | Lot | Plan |
|---|---|---|---|
| Qui sont les premiers membres vérifiés | Une cohorte fondatrice admise par un opérateur, tracée, plafonnée, dispensée d'ancienneté pour parrainer | EA-01 | 01, décision 1 |
| Qui administre et qui modère | Deux administrateurs, trois modérateurs pour la France ; lever pour DIASPORALE le refus du moteur plutôt que dupliquer | MD-01, LX-03 | 14, décision 2 ; 17, décision 3 |
| IDN | Le client central du moteur pour le pilote | EA-02 | 01, décision 2 |
| Mise en relation | Ouvrir la politique en local, puis sur la démonstration, puis en production le jour du pilote | DS-04 | 04, décision 1 |
| Appels au pilote | Pas d'appels tant qu'ils ne sont pas prouvés à deux ; les gestes sont retirés d'ici là | IM-01 | 04, décision 2 |
| Relecture au lancement | Évènements, avis, offres de service et offres d'emploi relus avant publication pendant les premières semaines, puis levée pays par pays | MD-04 | 14, décision 4 ; 08, 09, 10, décision 1 |
| Pays non ouvert | Fermer la publication locale et le dire, puis ouvrir une vraie relecture | HB-01, HB-11 | 06, décision 1 |
| Ce que lit un compte en attente | Garder la lecture pendant le pilote, mesurer, puis fixer une durée | EA-18 | 01, décision 4 |
| Ce que l'auteur d'un contenu signalé apprend | Seulement une mesure prise, jamais l'ouverture d'un dossier | MD-07 | 14, décision 6 |
| Canal sortant au pilote | Notifications du navigateur, et un courriel quotidien neutre pour la mise en relation | DS-14, NP-11 | 13, décision 1 |
| Le téléphone | L'application web installable d'abord ; le natif seulement après trois preuves | MO-02 à MO-08 | 16, décision 1 |
| Voie de l'officiel pour les postes | L'import contractuel ; pour le pilote, la page du poste créée par la console avec un mandat écrit | VC-02, VC-04 | 15, décisions 1 et 3 |
| Postes au Gabon dans l'emploi | Oui : c'est la moitié du persona du recruteur et le « retour au pays » | EM-07 | 10, décision 2 |
| Famille restée au Gabon | Dire la frontière et poser le lien vers ANTSIA tout de suite ; décider après le pilote d'un espace commun | IM-12 | 04, décision 5 |
| Intégration continue | Oui, en lecture seule, sans secret | LX-07 | 17, décision 8 |
| Modèle économique | Rien au pilote ; ensuite un cadre écrit avant toute offre | LX-15 | 17, décision 12 |

### 6.3 Les autres décisions

Chaque plan liste les siennes à son § 7, de dix à quatorze, chacune avec une recommandation et sa raison. Celles qui touchent au droit sont posées comme des questions au juriste : aucun plan n'affirme une conformité.

## 7. Comment exécuter

### 7.1 Les sessions

| Session | Périmètre | Lots |
|---|---|---|
| **S2** DIASPORALE | Le dépôt DIASPORALE ; dans ANTSIA, seulement `convex/modules/diaspora/` et les feuilles de thème de DIASPORALE | Presque tous ; 228 sans rien demander au moteur |
| **S1** moteur | Tout autre fichier d'ANTSIA, dont `convex/schema.ts`, `convex/modules/events/`, le registre des conversations et les genres d'avis | Reçoit une issue `[S1]` pour 126 lots ; publie le backend |
| **S3** mobile | L'application native, si elle se décide | 8 lots |
| Hors sessions | L'équipe de gabon-diplomatie (6 lots) ; le propriétaire (13 lots l'associent) | |

La session S2 travaille dans une copie propre tirée d'`origin/main`, pas dans l'ancien clone local, qui a du retard et des modifications non commitées.

### 7.2 La vie d'un lot

1. Relire le lot dans son plan et **vérifier dans le code que l'état décrit est toujours vrai** : les plans datent du 10 novembre 2026.
2. Regarder au § 5.1 si un autre lot construit la brique.
3. Branche `claude/<sujet>` depuis `origin/main`.
4. Livrer le lot entier dans les vrais fichiers, branché et atteignable depuis l'interface : tranche du moteur, port, adaptateur moteur, fournisseur de démonstration, écrans, textes en français et en anglais, signalement, export et effacement, tests, cliquets.
5. `bun run --cwd ../ANTSIA verify` vert, une seule exécution à la fois sur la machine.
6. Recette au navigateur à 390, 834 et 1440 px, en Sable et en Gaboma, en mode moteur, avec les comptes de démonstration par acteur.
7. PR en français, fusion, mise à jour de la ligne du lot dans `EXECUTION.md`.
8. Publication de la démonstration : seulement après l'accord écrit et détaillé du propriétaire. Si le lot change ce que le moteur expose, S1 publie le backend d'abord.

Un lot est **terminé** quand il est fusionné, vérifié et recetté. Il est **en ligne** quand il est publié et que la version servie le prouve. Il est **recetté en réel** quand il a été éprouvé avec de vraies personnes. Ces trois états ne se confondent jamais.

### 7.3 Le prompt commun d'un lot

Chaque plan fournit, à son § 9, des prompts prêts à coller pour ses lots les plus importants. Pour tout autre lot, ce gabarit suffit :

```text
Tu exécutes le lot <ID> du plan <NN> de DIASPORALE. Écris-moi toujours en français. Utilise Opus pour tout le code, jamais de sous-agent Sonnet.

Tu es la session S2. Tu écris dans le dépôt DIASPORALE et, dans ANTSIA, seulement dans convex/modules/diaspora/ et les feuilles de thème de DIASPORALE. Tout autre besoin du moteur devient une issue [S1] dans administration-ga/antsia, sans donnée sensible.

Lis d'abord, dans l'ordre :
1. CLAUDE.md du dépôt ;
2. docs/etudes/2026-11-10-finalisation/00_PLAN_DIRECTEUR.md, § 1, § 2, § 5.1 et § 7 ;
3. docs/etudes/2026-11-10-finalisation/<fichier du plan>, § 1 et § 2, puis le lot <ID> au § 5 ;
4. les documents et les décisions que ce lot cite.

Avant de coder, vérifie dans le code que l'état décrit par le plan est toujours vrai : le plan date du 10 novembre 2026. S'il ne l'est plus, dis-le-moi et adapte le lot. Regarde au § 5.1 du plan directeur si un autre lot construit la brique.

Livre le lot entier, dans les vrais fichiers, branché et atteignable depuis l'interface : tranche, port, adaptateur moteur, fournisseur de démonstration, écrans, textes en français et en anglais, signalement, export et effacement des nouvelles données, tests, cliquets. Respecte les invariants et les critères d'acceptation du lot.

Vérifie : bun run --cwd ../ANTSIA verify (avec le verrou commun aux sessions), puis une recette au navigateur à 390, 834 et 1440 px, en Sable et en Gaboma, en mode moteur, avec les comptes de démonstration. Donne-moi les preuves.

Arrête-toi et demande-moi :
- avant toute publication, toute variable d'environnement, tout secret, toute suppression de données ;
- à chaque porte indiquée par le lot ;
- sur tout sujet juridique.

N'invente aucun chiffre, avis ni contenu. Ne dis jamais qu'une recette est faite si tu ne l'as pas constatée. Termine par : ce qui est vrai maintenant, les preuves, ce qui n'a pas été vérifié, la mise à jour de EXECUTION.md, et le lot suivant.
```

### 7.4 Où vivent ces plans

Ce dossier est dans le dépôt de DIASPORALE, sous `docs/etudes/2026-11-10-finalisation/`. Le plan 15 et le registre d'ANTSIA restent dans le dépôt d'ANTSIA, sous `docs/etudes/2026-11-09-finalisation/`.

Les lots repris du plan 15 gardent leur identifiant (DS-…, DG-…). Quand ce dossier en découpe un en volets, l'état se suit ici, volet par volet ; la ligne du registre d'ANTSIA se met à jour quand tous les volets sont fusionnés.

## 8. Risques majeurs

| Risque | Parade |
|---|---|
| **Ouvrir sans pouvoir amorcer ni gouverner** | EA-01 et MD-01 avant toute annonce ; le pilote ne commence pas sans membres vérifiés ni responsables nommés |
| **L'ampleur** : 354 lots, presque tous pour une seule session | Tenir l'ordre des vagues ; ne commencer aucun lot P1 tant qu'un lot P0 sans porte reste à faire |
| **Dépendre du moteur** : 126 lots lui demandent quelque chose, dont 18 bloquants | Déposer les issues `[S1]` tôt, en commençant par celles des vagues 2 et 3 ; ne jamais contourner la zone d'écriture |
| **Ouvrir avant d'avoir prouvé** | Le jalon 1 exige les recettes à plusieurs comptes ; un lot fusionné n'est pas un lot recetté |
| **Un hub vide** | Aucun pays ouvert sans relais, modérateur et contenus de départ ; aucun compteur faux |
| **Les arnaques** au logement, à l'emploi, au faux consulat | Guide et mises en garde avant le pilote (AN-01, EM-01), motif « arnaque » (MD-13), annonces fermées jusqu'à la conformité |
| **Le droit de deux territoires** : Gabon, et France ou Europe pour les résidents | Juriste mandaté tôt ; rien n'est dit « conforme » ; les lots concernés portent la porte « juriste » |
| **Le lien consulaire en retard** | Le pilote ouvre sans attestation ni page de poste, avec IDN, le code par e-mail et les fondateurs ; l'écran ne promet rien d'ici là (VC-01) |
| **Le téléphone** : la cible s'en sert d'abord, rien n'y a été essayé | MO-01 avant l'ouverture ; application installable en vague 6 |
| **Un seul poste, aucune intégration continue** | Publication décrite dans le dépôt (LX-02), intégration continue en lecture seule (LX-07) |
| **Des plans qui vieillissent** | Chaque lot commence par vérifier dans le code que l'état décrit est toujours vrai |

## 9. Les documents de ce dossier

| Fichier | Contenu |
|---|---|
| `00_PLAN_DIRECTEUR.md` | Ce document |
| [`EXECUTION.md`](EXECUTION.md) | Le registre des 354 lots et leur état |
| [`01_ENTREE_ADHESION_CONFIANCE.md`](01_ENTREE_ADHESION_CONFIANCE.md) | L'entrée face à InterNations, Nextdoor, LinkedIn, aux invitations et aux questions d'adhésion des groupes |
| [`02_COQUE_NAVIGATION_CHARTE_ACCESSIBILITE.md`](02_COQUE_NAVIGATION_CHARTE_ACCESSIBILITE.md) | La coque et la navigation face à Instagram, WhatsApp, LinkedIn, Facebook |
| [`03_FIL_PUBLICATIONS_DECOUVERTE_RECHERCHE.md`](03_FIL_PUBLICATIONS_DECOUVERTE_RECHERCHE.md) | Le fil, les statuts, la découverte et la recherche face à Instagram, Facebook, TikTok, Threads |
| [`04_ICOM_MESSAGES_APPELS_MISE_EN_RELATION.md`](04_ICOM_MESSAGES_APPELS_MISE_EN_RELATION.md) | iCom face à WhatsApp, iMessage, Telegram, Signal, Messenger |
| [`05_PROFIL_RELATIONS_ANNUAIRE.md`](05_PROFIL_RELATIONS_ANNUAIRE.md) | Profil, relations et annuaire face à LinkedIn, Facebook, Instagram, InterNations |
| [`06_HUBS_PAYS_VILLES_CARTE.md`](06_HUBS_PAYS_VILLES_CARTE.md) | Les hubs face aux communautés d'InterNations, à Nextdoor, aux groupes par ville, à Discord |
| [`07_PAGES_ASSOCIATIONS_GROUPES.md`](07_PAGES_ASSOCIATIONS_GROUPES.md) | Pages, associations et groupes face à Facebook, LinkedIn, HelloAsso, AssoConnect, aux Communautés WhatsApp |
| [`08_EVENEMENTS_AGENDA.md`](08_EVENEMENTS_AGENDA.md) | Les évènements face à Meetup, Eventbrite, Luma, Facebook, Partiful |
| [`09_SERVICES_RENDEZ_VOUS_AVIS.md`](09_SERVICES_RENDEZ_VOUS_AVIS.md) | Les services face à Planity, Treatwell, Doctolib, à la fiche Google, à Malt, à WhatsApp Business |
| [`10_EMPLOI_TALENTS.md`](10_EMPLOI_TALENTS.md) | L'emploi face à LinkedIn, Indeed, Welcome to the Jungle, l'APEC |
| [`11_ENTRAIDE_MENTORAT_KIT_ARRIVEE.md`](11_ENTRAIDE_MENTORAT_KIT_ARRIVEE.md) | Entraide, mentorat et kit d'arrivée face à Nextdoor, Stack Overflow, ADPList, aux guides d'InterNations |
| [`12_PETITES_ANNONCES_BESOINS_DIASPORA.md`](12_PETITES_ANNONCES_BESOINS_DIASPORA.md) | Les annonces face à Leboncoin, Vinted, Cocolis, BlaBlaCar ; les besoins gardés fermés |
| [`13_NOTIFICATIONS_REGLAGES_DONNEES.md`](13_NOTIFICATIONS_REGLAGES_DONNEES.md) | Notifications, réglages et données face aux réglages des grandes applications |
| [`14_MODERATION_SECURITE_CONFORMITE.md`](14_MODERATION_SECURITE_CONFORMITE.md) | La modération face aux outils de Facebook, Nextdoor, Discord, Reddit |
| [`15_VIE_PUBLIQUE_CONSULAIRE.md`](15_VIE_PUBLIQUE_CONSULAIRE.md) | La parole officielle face à Fil d'Ariane, aux pages des ambassades, aux portails d'autres États |
| [`16_APPLICATION_MOBILE_PWA.md`](16_APPLICATION_MOBILE_PWA.md) | Le téléphone : application web installable, puis application native |
| [`17_LANCEMENT_PILOTE_EXPLOITATION_MODELE_ECONOMIQUE.md`](17_LANCEMENT_PILOTE_EXPLOITATION_MODELE_ECONOMIQUE.md) | Lancement, pilote, exploitation et modèle économique |

**Comment ces plans ont été établis.** Un agent par fonctionnalité a lu les documents du projet (cahier, plan global, registre des décisions, dossier produit de juillet, plan du programme, plans du moteur), puis le code d'`origin/main` des deux dépôts. Chaque état est prouvé par un chemin de fichier ou par les motifs cherchés. Un script a contrôlé les quelque 1 300 chemins cités : aucun n'est introuvable. Les décomptes ont été recomptés sur les tableaux. Les constats du § 3.2 ont été revérifiés à la main. Les comparaisons avec les applications de référence viennent de la connaissance de ces produits : chaque plan marque d'un « ? » ce dont il n'est pas sûr.
