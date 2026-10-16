---
title: "DIASPORALE.COM — Cahier des charges fonctionnel et technique"
version: "1.0"
date: "2026-10-14"
statut: "Proposition de référence — à valider par le propriétaire"
projet: "DIASPORALE"
reference: "NTSAGUI/DIASPORALE/CDC/2026/001"
maitre_d_ouvrage: "NTSAGUI Digital (propriété intellectuelle) ; données au Gabon (cible du programme)"
dependances:
  - "Documentation/RESEAUX_SOCIAUX/00_PLAN_RESEAUX_DANS_LE_RESEAU_DIASPORALE_ANTSIA_2026-10-14.md (plan de pilotage)"
  - "ECOSYSTEMES/ANTSIA/docs/00_CAHIER_DES_CHARGES_ANTSIA.md (le moteur social national, préalable)"
  - "ECOSYSTEMES/DIASPORALE/docs/01_PLAN_IMPLEMENTATION_PROMPTS_DIASPORALE.md (prompts d'exécution)"
  - "ECOSYSTEMES/GABON_DIPLOMATIE/docs/OPPORTUNITES_COMMUNAUTE_DIASPORA.md (dossier produit F01–F17, 13/07/2026)"
  - "ECOSYSTEMES/GABON_DIPLOMATIE/docs/DESIGN_SPECS_COMMUNAUTE.md (33 écrans, 17 composants)"
  - "Documentation/RESEAUX_SOCIAUX/annexes/{A,B,D}_*.md (audits du 14/10/2026)"
---

# DIASPORALE.COM — Cahier des charges fonctionnel et technique

> **Place dans le programme.** DIASPORALE.COM est le **réseau social fermé de la diaspora
> gabonaise**. C'est le premier réseau servi par le **moteur social national** (dépôt ANTSIA),
> et un réseau **enfant** du réseau public ANTSIA : être membre de DIASPORALE, c'est être membre
> d'ANTSIA avec un contexte en plus — le contexte de la diaspora, qui reste séparé. Le cahier
> des charges du moteur (`ANTSIA/docs/00`) est un **préalable** : ce document ne redéfinit pas
> le moteur, il dit ce que DIASPORALE en attend et ce qu'il y ajoute.

## 0. Décision de conception

DIASPORALE.COM est le lieu de rencontre numérique des Gabonais de l'étranger : fil et
publications, hubs par pays, pages des postes consulaires et des associations, évènements,
groupes, messagerie et appels, puis emploi, annonces et entraide. Il est **fermé** (réservé
aux Gabonais de l'étranger), **officiel mais ouvert** (on y entre avec son identité numérique
IDN, une attestation consulaire ou un compte léger parrainé), **par pays et global** (chaque
pays a son hub, une couche fédère toute la diaspora), et **séparé** : ce qui se publie dans
DIASPORALE reste dans DIASPORALE, sauf geste explicite de l'auteur vers ANTSIA.

Il est construit **par duplication** du réseau social de l'espace agent d'administration.ga
(iRéseau, iCom, stories, albums, direct, notifications — environ 22 000 lignes de backend et
près de 92 000 lignes de front avec iAppel, environ 3 300 cas de test, en production) selon les dix règles de duplication déjà
appliquées par PRO.GA, et **sur le moteur multi-réseaux** décrit dans le cahier ANTSIA. Son
code propre est petit : les règles d'adhésion de la diaspora, les facettes (pays, poste,
association), l'attestation consulaire, les hubs pays, l'import des objets publics de
consulat.ga et sa charte.

Ce qu'il n'est pas : une nouvelle application de consulat.ga (le réseau ne vit pas dans la base
consulaire — passeports, état civil, données sensibles — règle R7 du plan), une base de données
sur la diaspora (aucune donnée consulaire n'est copiée), un fil déversoir (le contexte est le
pays, la confiance est visible, la modération est par pays).

## 1. Contexte

- **La diaspora** : environ 30 000 personnes selon le dossier produit de juillet, dont la
  moitié en France ; sa vie communautaire se tient sur des groupes WhatsApp et Facebook
  fragmentés — information perdue, arnaques, aucune mémoire collective, talents et entreprises
  invisibles.
- **consulat.ga** (dépôt `administration-ga/gabon-diplomatie`, actif) : 3 485 profils (16/09),
  2 551 inscriptions consulaires rattachées (08/10, dont 2 549 au Consulat Général en France),
  44 représentations, 129 associations (127 en France), 8 entreprises, un Espace Communauté
  livré en juillet (fil par pays, évènements, associations, réactions, commentaires,
  abonnements aux postes et associations — sans lien de personne à personne). Le chiffre de
  4 500 utilisateurs annoncé par le propriétaire n'est écrit nulle part ; il correspond
  probablement au compteur global du back-office, qui compte agents, étrangers, comptes de
  démonstration et comptes supprimés. **La population éligible est à mesurer** (§6.5).
- **L'espace agent d'administration.ga** porte un réseau social complet (§3.1), couplé au
  modèle agent/poste/organisation en quelques points d'accroche seulement.
- **La doctrine du programme** (29/07/2026) : chaque marketplace est un réseau social ; la
  personne d'abord, l'organisation ensuite ; statuts `déclaré → vérifié` ; interopérabilité
  étanche par contrats HTTP.
- **identite.ga** est le fournisseur d'identité unique déclaré à l'APDPVP ; consulat.ga en est
  client et sait créer ou rattacher une identité IDN avec consentement.

## 2. Objectifs

### 2.1 Objectifs utilisateurs

1. Entrer en moins de trois minutes avec son identité IDN ou un compte léger, choisir son
   handle, voir immédiatement la vie de son pays de résidence.
2. Retrouver et suivre les Gabonais, les associations, les entreprises et les postes
   consulaires de son pays ; se connecter de personne à personne.
3. Publier, réagir, commenter, partager dans un contexte de confiance : qui est officiel, qui
   est vérifié, qui est de la communauté se voit toujours.
4. Organiser et rejoindre des évènements, des groupes, des associations ; échanger par
   messagerie et appels sans exposer ses coordonnées.
5. Trouver un emploi, un logement, un service, un mentor ; proposer ses compétences.
6. Rester maître de ses données : consentements explicites, visibilité par niveau, export et
   effacement effectifs.

### 2.2 Objectifs plateforme

1. Donner à la diaspora un espace institutionnalisé, modéré, pérenne, sans publicité
   intrusive ni profilage commercial.
2. Faire de la communauté le canal d'acquisition de l'identité numérique IDN et des
   inscriptions consulaires (parcours d'élévation).
3. Constituer, **sans copier aucune donnée consulaire**, un graphe social qui alimente ensuite
   le réseau public ANTSIA.
4. Réutiliser le code éprouvé du programme (socle, PRO.GA) et ses doctrines plutôt que de
   reconstruire.
5. Servir de premier terrain au moteur social national : tout ce qui est appris ici profite à
   ANTSIA.

### 2.3 Indicateurs de pilotage (cibles indicatives an 1, à confirmer avec le propriétaire)

| Domaine | Indicateur | Cible |
|---|---|---|
| Acquisition | comptes créés par mois ; part des inscrits de consulat.ga entrés | croissance > 10 %/mois ; > 30 % à six mois |
| Confiance | part des membres vérifiés (IDN ou attestation) | > 50 % à six mois |
| Élévation | comptes légers qui activent IDN ou s'inscrivent au consulat sous 90 jours | > 15 % |
| Engagement | WAU/MAU ; publications par membre actif | > 35 % ; > 2 / mois |
| Contenu | pays actifs (≥ 1 évènement/mois) ; part des contenus créés par la communauté | ≥ 8 ; > 60 % |
| Modération | signalements traités sous 48 h | > 95 % |
| Qualité | aucune fuite de contexte (contenu `network` lu hors DIASPORALE) | 0 |

## 3. Sources et politique de réutilisation

### 3.1 Le socle administration.ga (code à dupliquer, via le moteur)

Mesuré le 14/10/2026 sur `origin/main` (annexes A et B du plan) :

| Brique | Backend (module Convex, lignes hors tests) | Front (feature, lignes) | Sort |
|---|---|---|---|
| Réseau personnel : profils, publications, réactions, commentaires, abonnements, cloche, signets, sourdines, stories, groupes de conversation, groupes thématiques, évènements, suggestions | `reseauPersonnel` 18 317 | `reseau-personnel` 29 508, `stories` 4 761, `notifications` 2 933 | tel quel 41 % / à adapter 52 % / à réécrire 6 % (backend) ; 49 / 42 / 9 % (front, iAppel compris) ; coque de l'espace agent à réécrire : 19 232 + 9 074 l. |
| Graphe des connexions | `reseau/connections.ts` | inclus | tel quel |
| Pages | `reseauPages` 1 645 | `PagesPanel`, `ProfilPagePage` | à adapter (autorité de page générique) |
| Albums | `reseauAlbums` 1 388 | `reseau-albums` 1 657 | tel quel |
| Messagerie 1:1 et groupes, appels | `chats.ts`, `messagerieScope`, `iappel` (partie personnelle), `meetings.ts` | `messagerie` 17 812 | à adapter fortement (scope personnel seul) |
| Direct (live) | `direct` 10 595 | `direct` 16 526 | à adapter |
| Fichiers, antivirus, garde de délivrance | `fileGuard` 3 604 | — | à adapter |

Ce qui manque au socle et que le **moteur** apporte : clé de réseau, membre hors
administration, identité externe, limitation de débit, modération à l'échelle, effacement
RGPD des contenus sociaux, push social, fil matérialisé, compteurs fragmentés (cahier ANTSIA).

### 3.2 Le dossier produit de la communauté diaspora (spécifications à reprendre)

`GABON_DIPLOMATIE/docs/OPPORTUNITES_COMMUNAUTE_DIASPORA.md` (F01–F17), `DESIGN_SPECS_COMMUNAUTE.md`
(33 écrans E01–E33, 17 composants C1–C17, principes P1–P5) et `PLAN_IMPLEMENTATION_ESPACE_COMMUNAUTE.md`
sont la **spécification fonctionnelle d'origine** de DIASPORALE. Ce cahier en reprend les
personas, les fiches features, la décision « scoping par pays », les principes de design
(trois niveaux de confiance, le pays est le contexte permanent, le contact passe par la
messagerie, états de modération visibles, états vides génératifs), la stratégie de lancement
(France d'abord, associations relais) et les KPI. Le **code** de l'Espace Communauté n'est pas
repris : il vit dans la base consulaire.

### 3.3 PRO.GA (seconde source d'adaptation)

`PRO_GA/packages/pro-domain/src/social-network.ts` et `PRO_GA/convex/modules/{social,relations,
contacts,moderation}` : une adaptation déjà faite à un contexte sans administration. Référence
pour les points d'accroche ; le socle reste la version la plus complète.

### 3.4 Les dix règles de duplication (héritées de PRO.GA, non négociables)

1. Copier d'abord, adapter ensuite : chaque fichier part d'une copie textuelle du fichier
   source ; l'adaptation est un diff minimal et documenté.
2. Traçabilité : en-tête `// Dupliqué de <chemin socle> @ <commit> — adaptations : <liste>`.
3. Périmètre d'adaptation fermé : imports et chemins, authentification (Better Auth du
   moteur), références métier (réseau, facettes, pages génériques), libellés, thème par
   jetons, gardes d'éligibilité ; suppression des dépendances administration (postes,
   rattachements, courrier, iDocument institutionnel). Tout le reste reste identique.
4. Aucun import inter-produit : jamais de `_generated`, de schéma, de table ni d'URL de
   stockage du socle ou de gabon-diplomatie dans le moteur. On copie du code, jamais des
   données ni des identités.
5. Les tests voyagent avec le code (23 fichiers et ~645 cas pour `reseauPersonnel` seul) ;
   vérifier qu'un test s'exécute.
6. Fusion avec l'existant, pas écrasement : ce que le moteur a déjà (A1) est conservé.
7. UI : primitives et jetons consommés sans fork ; le thème DIASPORALE passe par les jetons ;
   aucune couleur en dur (cliquet de charte).
8. Tranches verticales : un module = `convex/modules/<module>/` (tables, fonctions, tests,
   manifeste) + sa surface dans `social-features` ; validateurs précis, jamais `v.any()`.
9. Gardes systématiques : toute fonction d'écriture vérifie l'adhésion au réseau courant,
   l'éligibilité et la limitation de débit ; les gardes sont testées (refus sans adhésion,
   refus hors réseau).
10. Parité prouvée : un module n'est « dupliqué » que quand sa liste de parité est cochée et
    que typecheck, tests et lint sont verts.

## 4. Vocabulaire

| Terme | Définition |
|---|---|
| **Moteur** | le backend Convex et les paquets partagés du dépôt ANTSIA, qui servent tous les réseaux |
| **Réseau** | un espace social avec ses membres, son fil, ses pages, ses modérateurs ; `diasporale` est un réseau fermé, enfant du réseau racine `antsia` |
| **Personne** | l'identité sociale unique d'un être humain dans le moteur (handle, nom affiché, avatar) |
| **Adhésion** | l'appartenance d'une personne à un réseau, avec un statut (`en_attente`, `declaree`, `verifiee`, `suspendue`, `partie`) et un rôle |
| **Facette** | les attributs d'une personne propres à un réseau : pour DIASPORALE, pays de résidence, ville, poste de rattachement, associations |
| **Attestation consulaire** | la réponse minimale et consentie de consulat.ga : inscription active ou non, pays, poste, date |
| **Parrainage** | l'acte par lequel un membre vérifié admet un compte léger dans le réseau |
| **Hub pays** | la page d'un pays : fil local, évènements, associations, entreprises, membres opt-in |
| **Portée** (`reach`) | `local` (le pays) ou `diaspora` (tout le réseau) ; distincte de la **visibilité** (`network` : reste dans DIASPORALE ; `root` : aussi dans ANTSIA) |
| **Page** | la présence d'une organisation : institution (poste consulaire, ministère), association, entreprise, média ; une page a des signataires |
| **Badge** | Officiel · Vérifié · Agent public · Communauté — calculé côté serveur |

## 5. Invariants

Hérités du plan (R1 à R8) et précisés pour DIASPORALE :

1. **Clé de réseau partout** : aucune lecture ni écriture sociale sans `networkId = diasporale`
   ; la recherche, les suggestions et le fil ne sortent jamais du réseau (sauf les contenus
   `root`, lus par ANTSIA).
2. **Contexte séparé** : visibilité `network` par défaut ; `root` seulement si audience
   `public` et geste explicite de l'auteur ; un contenu `root` reste aussi dans DIASPORALE.
3. **Adhésion dérivée** : entrer dans DIASPORALE crée l'adhésion à ANTSIA ; quitter DIASPORALE
   ne retire pas ANTSIA ; une suspension dans ANTSIA suspend partout.
4. **Aucune donnée consulaire dans le moteur** : pas de passeport, pas de NIP, pas d'état
   civil, pas de mineur, pas de dossier ; l'attestation est un booléen, un pays, un poste, une
   date.
5. **Adhésion explicite** : aucun profil n'est créé d'office à partir de consulat.ga ; la
   personne entre, consent, choisit son handle (leçon des ADR-0080 et 0082 du socle).
6. **Le contact passe par la messagerie** : aucune adresse ni numéro sur une surface
   publique ; un bouton « Écrire » remplace toute coordonnée.
7. **Le pays est le contexte permanent** : tout contenu porte un pays ou la portée
   `diaspora` ; le fil par défaut est le pays de résidence plus la portée `diaspora`.
8. **La confiance est visible et jamais déclarative** : les quatre badges sont calculés par le
   serveur ; une page « Officiel » n'existe que par attestation (poste consulaire reconnu) ou
   par fédération.
9. **Le citoyen ne paie jamais** l'accès aux fonctions communautaires ; la monétisation,
   si elle vient, est B2B et étiquetée (lot D4, décisions du propriétaire).
10. **Modération par pays** avant toute ouverture d'une surface de contenu créé par la
    communauté dans ce pays.

## 6. Acteurs, comptes et confiance

### 6.1 Personas (repris du dossier produit)

| # | Persona | Besoins |
|---|---|---|
| P1 | Citoyen établi | évènements locaux, réseau, vendre/acheter, culture, visibilité professionnelle |
| P2 | Nouvel arrivant (étudiant, mutation) | logement, installation, premier réseau, mentorat, bons plans |
| P3 | Responsable d'association | visibilité, membres, évènements, communication, financement |
| P4 | Entrepreneur de la diaspora | clients, visibilité, recrutement, partenaires |
| P5 | Recruteur (diaspora ou Gabon) | vivier de talents, offres, contact de candidats |
| P6 | Annonceur, sponsor | audience par pays, encarts étiquetés (lot D4) |
| P7 | Institution (poste consulaire, MAE) | animer sa communauté, information officielle, agrégats |
| P8 | Modérateur pays | file de signalements, sanctions, pages à vérifier |
| P9 | Administrateur du réseau | règles d'adhésion, équipes de modération, pays ouverts, import, contrats |

### 6.2 Portes d'entrée

| Porte | Preuve | Statut d'adhésion obtenu | Badge |
|---|---|---|---|
| **IDN (identite.ga)**, affichée en premier | identité civile, nationalité, `loa` | `declaree` (pays de résidence saisi) ; `verifiee` si `loa ≥ 2` **et** attestation consulaire ou parrainage | **Vérifié** si `loa ≥ 2` |
| **Compte léger** (code à usage unique e-mail ou SMS) | contrôle d'une adresse ou d'un numéro | `en_attente` jusqu'au parrainage par un membre vérifié ou à l'attestation consulaire ; puis `declaree` | **Communauté** |
| **Attestation consulaire** (après connexion, à la demande de la personne) | consulat.ga confirme une inscription consulaire active pour cet `idnSub` ou pour cette adresse vérifiée | `verifiee` | **Vérifié** |
| **Lien administration.ga** (depuis l'espace agent) | rattachement validé reflété par le socle | adhésion `administration` dans le moteur ; aucune adhésion DIASPORALE automatique | **Agent public** |

Ce que donne chaque statut :

| Statut | Lire le hub pays et les pages | Publier, commenter, réagir | Messagerie, appels, groupes | Créer une page ou un évènement | Apparaître dans l'annuaire opt-in |
|---|---|---|---|---|---|
| `en_attente` | oui (contenus publics du réseau) | non | non | non | non |
| `declaree` | oui | oui (limitation de débit renforcée) | oui | évènement oui ; page après vérification | oui, s'il le choisit |
| `verifiee` | oui | oui | oui | oui | oui, s'il le choisit |
| `suspendue` | lecture seule ou rien, selon la sanction | non | non | non | non |

Le seuil exact du parrainage (un ou deux parrains, ancienneté minimale du parrain) est un
arbitrage (§20, A3). Valeur par défaut recommandée : **un parrain vérifié depuis plus de
30 jours**, dix parrainages par parrain et par mois.

### 6.3 Les quatre badges

| Badge | Condition (calculée côté serveur) | Où |
|---|---|---|
| **Officiel** | page d'institution reconnue : poste consulaire importé par le contrat communauté, ministère, ou page d'administration reflétée par fédération | pages et leurs publications, réponses des signataires |
| **Vérifié** | adhésion `verifiee` (attestation consulaire) ou lien IDN `loa ≥ 2` | profil, publications, évènements, annonces, offres |
| **Agent public** | lien d'identité `administration` (reflet du socle) | profil |
| **Communauté** | aucun des précédents | profil, contenus |

### 6.4 Rôles

| Rôle | Portée | Pouvoirs |
|---|---|---|
| membre | réseau | publier, réagir, commenter, suivre, se connecter, créer groupes et évènements, parrainer (si vérifié) |
| signataire de page | page | publier au nom de la page, répondre « Officiel » |
| administrateur de page | page | signataires, identité de la page, revendication |
| modérateur pays | réseau × pays | file de signalements, masquer, sanctions graduées, pages à vérifier, évènements en relecture |
| modérateur réseau | réseau | tous pays, recours, équipes |
| administrateur du réseau | réseau | règles d'adhésion, pays ouverts, import, contrats, badges manuels tracés |
| plateforme (console ANTSIA) | moteur | création des réseaux, équipes, incidents, journal |

### 6.5 Mesure de la population éligible (préalable au lancement)

À compter par le propriétaire depuis `admin.consulat.ga`, sans aucune extraction nominative :
comptes actifs, non supprimés et sans demande de suppression ; sans rattachement à un poste
(donc pas agents) ; profil de nationalité gabonaise, `userType ∈ {long_stay, short_stay}` ;
majeurs ; et parmi eux la part déjà rattachée à IDN. Ce chiffre borne la campagne
d'information et ne se publie pas sans preuve (doctrine de communication publique).

## 7. Le réseau `diasporale` dans le moteur

| Attribut du réseau | Valeur |
|---|---|
| `slug` | `diasporale` |
| `kind` | `closed` |
| `parentId` | `antsia` |
| `membershipPolicy` | `declared_or_verified` (déclaration + IDN, attestation ou parrainage) |
| `defaultVisibility` | `network` |
| `facetSchema` | `countryOfResidence` (ISO 3166-1, obligatoire, ≠ GA), `city?`, `postSlug?` (poste consulaire de rattachement, posé par l'attestation), `associationIds[]`, `arrivedAt?` (année d'arrivée, pour l'entraide) |
| `reachValues` | `local` (pays), `diaspora` (tout le réseau) |
| `moderation` | équipes par pays + équipe réseau |
| `theme` | jetons DIASPORALE (§15) |
| `openCountries` | liste des pays ouverts (lancement : France) ; un pays s'ouvre avec deux associations relais et un modérateur |

## 8. Périmètre fonctionnel

Chaque exigence porte un identifiant `EXF-DG-NN` (fonctionnel) ou `EXT-DG-NN` (technique) ;
le plan de prompts (`docs/01`) couvre 100 % des exigences. **V1** = lots D1 ; **V2** = D2 ;
**V3** = D3 et D4.

### 8.1 M1 — Entrée, identité, adhésion (V1)

- **EXF-DG-01** Connexion par IDN (OIDC, PKCE, `/userinfo` : `loa`, `nationality`), affichée en
  premier ; compte léger par code à usage unique e-mail ou SMS ; jamais de mot de passe.
- **EXF-DG-02** Onboarding en trois écrans : pays de résidence et ville, handle (suggestions
  `prenom.nom` / `nom.prenom`, aucun présélectionné) et nom affiché, consentements
  explicites (profil social, annuaire opt-in, notifications) — jamais de case précochée.
- **EXF-DG-03** Attestation consulaire à la demande : la personne déclenche « Vérifier mon
  inscription consulaire », consent à la requête, le moteur interroge consulat.ga
  (`DIASPORA-ATTESTATION-V1`) et pose le statut `verifiee`, le pays et le poste ; le refus ou
  l'absence est expliqué sans exposer la raison consulaire.
- **EXF-DG-04** Parrainage : un membre vérifié admet un compte `en_attente` (lien ou handle) ;
  quotas, journal, retrait possible.
- **EXF-DG-05** Parcours d'élévation : bannières « Activer mon identité numérique IDN » et
  « M'inscrire au consulat » qui renvoient vers identite.ga et consulat.ga ; retour dans
  DIASPORALE sans perte de session (jeton à usage unique ou retour OIDC).
- **EXF-DG-06** Depuis consulat.ga : boutons « Rejoindre DIASPORALE » et « Activer IDN » (chantier
  côté gabon-diplomatie), sans aucun transfert de données hors consentement.
- **EXT-DG-01** Better Auth du moteur : origines de confiance `diasporale.com`, `antsia.ga`,
  consoles ; sessions par origine ; `signOutEverywhere` (révocation serveur puis purge locale).

### 8.2 M2 — Profil et facettes (V1)

- **EXF-DG-07** Profil publié (hérité) : avatar, couverture, nom affiché, accroche, mode
  privé, dépublication ; onglets Publications · Photos · Albums ; `?apercu=1` pour se voir
  comme les autres.
- **EXF-DG-08** Facette diaspora : pays et ville, poste de rattachement (badge), associations,
  année d'arrivée, « disponible pour l'entraide » (V2) ; visibilité par champ.
- **EXF-DG-09** Profil professionnel (V2, hérité d'iCV côté consulat.ga en spécification) :
  métier, compétences, langues ; `isPublic` et « visible des recruteurs vérifiés seulement ».

### 8.3 M3 — Fil et publications (V1, hérité)

- **EXF-DG-10** Publication : texte (2 000 caractères), 4 images ou 1 vidéo avec texte
  alternatif, partage cité, hashtags et mentions, audience (`public` dans le réseau,
  `connections`, groupe, page), **pays ou portée `diaspora`**, idempotence, brouillon durable.
- **EXF-DG-11** Visibilité : `network` par défaut ; case « Publier aussi sur ANTSIA » (seulement
  si audience `public`) ; explication en une ligne de ce que cela change.
- **EXF-DG-12** Réactions (4 genres), commentaires à un niveau de réponse, relais, signets,
  masquage, sourdine d'un auteur, signalement (6 motifs), édition et retrait.
- **EXF-DG-13** Fil : « Mon pays » (par défaut), « Toute la diaspora », « Récents »,
  « Pour vous » ; curseur et temps réel ; états vides génératifs.
- **EXF-DG-14** Stories 24 h et albums photo (60 photos, EXIF retiré), hérités.

### 8.4 M4 — Hubs pays (V1, du dossier produit F02)

- **EXF-DG-15** `/pays/[iso]` : compteurs (membres opt-in, associations, entreprises,
  évènements à venir), fil local, évènements, associations, entreprises, pages officielles du
  pays, membres opt-in ; sélecteur de pays mémorisé.
- **EXF-DG-16** Les contenus `reach: diaspora` apparaissent dans tous les hubs avec une
  pastille d'origine.
- **EXF-DG-17** Carte de la diaspora (V2, F16) : agrégats par pays, seuil minimal
  d'affichage anti-réidentification, compteurs matérialisés chaque jour.

### 8.5 M5 — Relations, abonnements, suggestions (V1, hérité)

- **EXF-DG-18** Connexions symétriques (demande, acceptation, refus, blocage silencieux),
  abonnements unilatéraux, suggestions par pays, ville, association et relations communes,
  « ne plus me proposer ».
- **EXF-DG-19** Recherche de personnes bornée au réseau ; refus indistinct (handle inconnu,
  profil privé ou blocage rendent le même résultat).

### 8.6 M6 — Pages : institutions, associations, entreprises (V1)

- **EXF-DG-20** Pages d'institution « Officiel » : un poste consulaire par page, créée par
  l'import contractuel, signataires = agents du poste qui se connectent par IDN et dont le
  rôle est confirmé par le poste (procédure d'habilitation tracée) ; ministère des Affaires
  étrangères.
- **EXF-DG-21** Pages d'association : importées **non revendiquées** (129), revendicables
  avec preuves (statuts, récépissé, mandat) instruites par le modérateur pays ; badge
  « Vérifié » à la revendication validée ; membres, signataires, publications, évènements.
- **EXF-DG-22** Pages d'entreprise : création par un membre vérifié, vérification
  (registre, mandat), fiche et publications ; vitrine premium = lot D4.
- **EXF-DG-23** Abonnement à une page ; fil des pages suivies ; une publication de page a
  pour pays celui de la page ou la portée `diaspora`.

### 8.7 M7 — Groupes (V1 thématiques, V2 conversation)

- **EXF-DG-24** Groupes thématiques découvrables par pays ou `diaspora` (« Gabonais de Lyon »,
  « Parents de la diaspora »), rôles owner / moderator / member, mur `group`, épingles.
- **EXF-DG-25** Groupes de conversation (jusqu'à 1 000 membres, invitations par lien et QR,
  pièces jointes, vocaux, réactions) — hérités de la messagerie (V2).
- **EXF-DG-26** Un groupe d'association est créé d'office pour chaque association revendiquée
  (membres = adhérents validés).

### 8.8 M8 — Évènements (V1 agenda hérité, V2 communautaire)

- **EXF-DG-27** Évènements hérités (agenda personnel, invitations, réponses, iCal, annonce au
  réseau) + pays et portée.
- **EXF-DG-28** Évènements communautaires (F03) : organisateur = personne, association ou
  page officielle ; capacité, date limite, liste d'attente, inscriptions, rappel J-1, QR de
  présence, galerie après l'évènement ; relecture par le modérateur pays à l'ouverture d'un
  pays, publication directe ensuite.
- **EXF-DG-29** Direct (live) d'un évènement par une page officielle ou une association
  vérifiée (V2, hérité de `direct` : antenne à 8, 200 spectateurs, rediffusion 90 jours).

### 8.9 M9 — iCom : messagerie, appels, présence (V2, hérité)

- **EXF-DG-30** Messagerie 1:1 entre relations (le fil naît au premier envoi), groupes,
  pièces jointes (5 par message, 25 Mo, liste blanche), vocaux (2 min), 6 réactions, édition
  et suppression 15 min, accusés de lecture en 1:1, « écrit… », recherche.
- **EXF-DG-31** Appels audio et vidéo LiveKit 1:1 et de groupe (jusqu'à 11), présence des
  relations, sonnerie, push.
- **EXF-DG-32** Un seul format de carte « téléphone » (390 × 844 ou 440 × 956 — arbitrage
  A6) ; sous 960 px, pages pleines.
- **EXF-DG-33** Contact d'une page, d'une association, d'un recruteur ou d'un vendeur
  **uniquement** par la messagerie ; jamais de coordonnées exposées.

### 8.10 M10 — Emploi, talents, annonces, entraide (V2, F06 F07 F09 F12)

- **EXF-DG-34** Offres d'emploi : publication par un membre vérifié ou une page
  d'entreprise vérifiée, pays, secteur, contrat, expiration, candidature en un geste avec le
  profil professionnel, fil de messagerie recruteur ↔ candidat, alertes par filtres ;
  relecture au lancement.
- **EXF-DG-35** Annuaire des talents : profils professionnels `isPublic`, recherche par pays,
  métier, compétences, langues ; champs choisis, anti-extraction (pagination stricte,
  limitation de débit, pas d'export).
- **EXF-DG-36** Petites annonces : logement (réservé aux vérifiés), biens, services,
  transport de colis ; contact par messagerie ; guide anti-arnaque ; signalement en un geste.
- **EXF-DG-37** Entraide et mentorat : « disponible pour aider » sur la facette ; appariement
  simple par pays, ville et domaine ; kit d'arrivée par pays ; badge « Mentor ».

### 8.11 M11 — Notifications (V1 cloche, V2 push et digest)

- **EXF-DG-38** Cloche sociale héritée (16 genres), aucun contenu dans la notification ;
  préférences fines ; plafond hebdomadaire des notifications communautaires.
- **EXF-DG-39** Push Web et mobile pour les évènements sociaux (mentions, réponses,
  invitations, évènements du pays, offres correspondant aux compétences) ; digest mensuel
  par pays par e-mail.

### 8.12 M12 — Modération, confiance, sécurité (V1)

- **EXF-DG-40** Tout contenu est signalable (publication, commentaire, message de groupe,
  évènement, page, annonce, offre, profil) ; file par pays, puis file réseau ; décision
  motivée ; audit.
- **EXF-DG-41** Sanctions graduées (avertissement, retrait, sourdine temporaire, suspension,
  exclusion) ; recours auprès du modérateur réseau ; rapport de modération périodique.
- **EXF-DG-42** Relecture (`pending_review`) par défaut à l'ouverture d'un pays ou d'une
  surface, puis publication directe avec modération a posteriori quand des modérateurs sont
  actifs ; mots bloqués ; limitation de débit sur toutes les écritures.
- **EXF-DG-43** Blocage silencieux, dans les deux sens, qui ferme fil, murs, recherche,
  suggestions, groupes, messagerie et directs.

### 8.13 M13 — Vie privée et données (V1)

- **EXF-DG-44** Registre des consentements horodaté et révocable (profil social, annuaire,
  attestation consulaire, notifications, talents) ; information claire au moment du geste.
- **EXF-DG-45** Export de ses données ; effacement effectif de tous les contenus sociaux
  (profil, publications, commentaires, réactions, abonnements, connexions, messages, stories,
  albums, facettes) et des blobs ; délai et confirmation.
- **EXF-DG-46** Annuaire des membres opt-in par niveau (`hidden` par défaut, `country`,
  `network`) ; réservé aux membres ; sans export.
- **EXF-DG-47** Rétention : signalements et sanctions bornés, stories 24 h, téléversements
  orphelins purgés, notifications 180 jours après lecture.

### 8.14 M14 — iAsted concierge (V2, option)

- **EXF-DG-48** Outils de lecture (évènements, associations, entreprises, offres par pays) et
  d'action confirmée (s'inscrire à un évènement, brouillon d'annonce) ; aucune donnée hors du
  réseau courant ; même garde serveur que l'interface.

### 8.15 Hors périmètre V1 et V2

Billetterie payante, paiements, sponsoring et vitrines premium (lot D4, décisions du
propriétaire) ; démarches consulaires (restent sur consulat.ga) ; messagerie avec les agents
du poste au titre d'un dossier (consulat.ga) ; sondages, marketplace de biens avec paiement ;
traduction automatique ; application de bureau.

## 9. Parcours de référence

Rédigés « Étant donné …, quand …, alors … » ; chacun devient un test de recette (R1–R10).

- **R1 — Un inscrit de consulat.ga entre.** Étant donné une personne inscrite au Consulat
  Général en France, rattachée à IDN ; quand elle clique « Rejoindre DIASPORALE » dans
  consulat.ga, se connecte par IDN sur diasporale.com, saisit « France, Lyon », choisit son
  handle et consent ; alors elle est `declaree`, voit le hub France, et son adhésion ANTSIA
  existe (dérivée).
- **R2 — Vérification consulaire.** Étant donné R1 ; quand elle demande « Vérifier mon
  inscription consulaire » et consent ; alors le moteur reçoit `{verified: true, FR,
  cg-france, since}`, pose `verifiee`, le badge Vérifié et le poste ; aucune autre donnée n'est
  stockée.
- **R3 — Compte léger parrainé.** Étant donné un étudiant sans IDN ni inscription ; quand il
  entre par SMS, saisit « Canada, Montréal » ; alors il est `en_attente`, lit le hub Canada
  sans publier ; quand un membre vérifié depuis plus de 30 jours le parraine ; alors il est
  `declaree` et publie.
- **R4 — Contexte séparé.** Étant donné une publication `public` dans DIASPORALE sans « aussi
  sur ANTSIA » ; alors aucune requête d'ANTSIA ne la rend ; quand l'auteur coche « aussi sur
  ANTSIA » ; alors elle est lue dans le fil racine avec la pastille « Diaspora » et reste dans
  DIASPORALE.
- **R5 — Page officielle.** Étant donné l'import du Consulat Général en France ; alors sa page
  porte « Officiel », ses publications aussi ; un membre ordinaire ne peut pas y publier ;
  un agent du poste habilité par la procédure le peut.
- **R6 — Association revendiquée.** Étant donné une association importée non revendiquée ;
  quand sa présidente dépose statuts et mandat ; quand le modérateur France valide ; alors la
  page devient « Vérifié », elle a un groupe d'adhérents et peut créer des évènements.
- **R7 — Évènement.** Étant donné une association vérifiée ; quand elle crée la soirée du
  17 août avec 150 places ; alors les membres de France la voient, s'inscrivent, reçoivent le
  rappel J-1 et un QR ; un membre du Canada ne la voit que si elle est `reach: diaspora`.
- **R8 — Signalement.** Étant donné une annonce de logement frauduleuse ; quand trois membres
  la signalent ; alors elle est masquée pour les déclarants, entre dans la file France ; quand
  le modérateur la retire et suspend l'auteur sept jours ; alors l'auteur est prévenu, peut
  faire recours, l'audit est écrit.
- **R9 — Effacement.** Étant donné un membre qui demande l'effacement ; alors après le délai,
  aucune table sociale ni aucun blob ne porte plus sa trace ; les contenus des autres qui le
  citaient affichent « compte supprimé ».
- **R10 — Fuite interdite.** Étant donné un client qui appelle une query sociale sans
  `networkId` ou avec `antsia` sur un contenu `network` de DIASPORALE ; alors le serveur refuse
  de façon indistincte ; le cliquet de test le prouve.

## 10. Surfaces attendues

### 10.1 Web (`apps/diasporale_com`, Next.js 16, mobile-first)

| Route | Contenu | Hérité de (espace agent) |
|---|---|---|
| `/` | vitrine publique : ce qu'est DIASPORALE, pays, compteurs matérialisés, entrer | — (nouvelle, charte DIASPORALE) |
| `/entrer`, `/bienvenue` | portes IDN / compte léger ; onboarding 3 écrans | `use-profile-onboarding`, `HandleChoiceCard` |
| `/fil` | le fil et ses volets (`?tab=` relations, groupes, pages, evenements, directs) | `ReseauAgentPage` (bureau), `ReseauMobilePage` (téléphone) |
| `/pays/[iso]` | hub pays | nouveau, composé de `FeedPages`, `EvenementsPanel`, `PagesPanel` |
| `/@[handle]`, `/@[handle]/albums/[id]` | profil, albums | `ProfilPersonnePage`, `AlbumPage` |
| `/pages/[handle]` | page d'institution, d'association, d'entreprise | `ProfilPagePage` (autorité générique) |
| `/groupes`, `/groupes/[id]` | groupes thématiques | `GroupsPanel` |
| `/evenements`, `/evenements/[id]` | évènements communautaires | `EvenementsPanel` + F03 |
| `/messages/*` | messagerie (pages pleines sous 960 px) | `features/messagerie` |
| `/actus`, `/direct/[id]` | stories, directs | `stories`, `direct` |
| `/emploi`, `/talents`, `/annonces`, `/entraide` | V2 | nouveaux, sur C4 C5 C6 C9 des specs design |
| `/parametres` | profil, facette, confidentialité, consentements, données | `ParametresPersonnelsPage` (allégée) |
| `/moderation` | file pays, sanctions, pages à vérifier (rôle) | nouveau (patrons de la console ANTSIA) |
| `/mentions-legales`, `/confidentialite` | textes (loi 001/2011 mod. 025/2023, RGPD), autorité APDPVP | — |

Coque légère (cahier ANTSIA) : fournisseurs Convex, TanStack et authentification, adaptateur
de routage, cloche, dock iCom, hôte d'appel, charte ; **jamais** AppShell, personal-nav,
org-provider ni les hôtes du Poste.

### 10.2 Mobile (`apps/diasporale_mobile`, Expo, lot D3)

Fil, hub pays, évènements, messagerie et appels, stories, notifications push ; parité des
parcours R1 à R8 avec le web.

## 11. Modèle de données

Le moteur porte les tables (cahier ANTSIA §11). DIASPORALE s'y lit ainsi :

| Table (moteur) | Ce que DIASPORALE y met |
|---|---|
| `networks` | la ligne `diasporale` (§7) |
| `persons`, `identityLinks` | la personne ; liens `idn`, `local`, `consular_attestation` (subject = empreinte, `verifiedAt`, `postSlug`, `country`) |
| `networkMemberships` | `networkId: diasporale`, `status`, `role`, `verifiedBy ∈ {idn, consulat, sponsor}`, `sponsorPersonId?`, `derivedRoot: true` sur l'adhésion `antsia` créée |
| `personFacets` | `networkId: diasporale`, `countryOfResidence`, `city`, `postSlug`, `associationIds`, `arrivedAt`, `helpAvailable`, visibilités par champ |
| `posts` (+ `postReactions`, `postComments`, `postMarks`, `contentReports`) | `networkId`, `audience`, `visibility ∈ {network, root}`, `country?`, `reach ∈ {local, diaspora}` |
| `pages`, `pageFollows`, `pageSignatories`, `pageClaims` | `ownerKind ∈ {institution, association, company, media}`, `trust ∈ {official, verified, community}`, `country`, `importRef?` |
| `connections`, `follows`, `suggestionDismissals`, `mutes` | hérités, bornés par réseau |
| `thematicGroups*`, `groupThreads*`, `groupMessages*` | hérités, `networkId`, `country?`, `associationPageId?` |
| `events`, `eventParticipants`, `eventRegistrations` (nouvelle : capacité, liste d'attente, QR) | hérités + F03 |
| `stories`, `storyViews`, `albums`, `albumItems` | hérités |
| `chats`, `chatMessages`, `calls` | messagerie personnelle seule (plus de `posteA/posteB`) |
| `notifications`, `pushSubscriptions`, `notificationPreferences` | hérités + préférences communautaires |
| `moderationTeams`, `sanctions`, `appeals` | équipes par pays |
| `consents` | registre horodaté et révocable |
| **Tranche `diaspora`** (propre) : `countryHubs` (compteurs matérialisés, pays ouverts), `sponsorships`, `consularAttestations` (empreinte, résultat, date, consentement), `communityImports` (journal de l'import public), `jobPostings`, `jobApplications`, `jobAlerts`, `classifieds`, `mentorships` | V1 pour les quatre premières, V2 pour les suivantes |

Règles : validateurs précis, `v.any()` interdit, index composés `by_network_*` sur toute table
sociale, compteurs fragmentés pour les contenus chauds, aucune donnée consulaire.

## 12. Autorisation et visibilité

1. Toute fonction publique résout d'abord la personne (Better Auth du moteur) puis
   l'adhésion au réseau demandé (`requireMembership(networkId, minStatus)`), puis
   l'éligibilité (statut), puis la limitation de débit, puis le droit sur la ressource.
2. La règle de visibilité d'une publication est le prédicat pur hérité
   (`isPersonalPostVisibleTo`) étendu de `networkId` et `visibility` : un lecteur hors réseau
   ne voit que les contenus `root` ; un lecteur dans le réseau applique l'audience héritée.
3. Les pages : publier au nom d'une page exige un rôle de signataire vivant ; une page
   `official` n'a pas de revendication possible ; une page `community` devient `verified` par
   décision tracée.
4. Le pays ne restreint pas la lecture (un membre peut lire tous les hubs) ; il ordonne les
   fils et scelle la compétence des modérateurs.
5. Les badges, les compteurs publics et les projections de l'annuaire se lisent dans des
   projections allowlistées, jamais dans l'enregistrement source.
6. Refus indistinct partout où l'existence d'une ressource est une information.

## 13. Interopérabilité

| Contrat | Sens | Contenu | Mécanique |
|---|---|---|---|
| **IDN OIDC** | identite.ga → moteur | identité, `loa`, `nationality`, `profile_type` | client OIDC `diasporale` enregistré au portail développeur (sandbox puis production), callback `https://diasporale.com/api/auth/oauth2/callback/idn` ; SDK `@idn-ga/better-auth` ; consentement sur l'écran d'identite.ga |
| **`DIASPORA-ATTESTATION-V1`** | moteur → consulat.ga (requête), réponse signée | `{ subjectKind: idnSub \| emailHash, subject }` → `{ verified, countryOfResidence, postSlug, registrationStatus, since }` | route HTTP idempotente côté gabon-diplomatie, clé de service, journal des deux côtés, consentement enregistré dans le moteur avant l'appel ; aucune autre donnée ; chantier côté gabon-diplomatie (ADR 0006 proposé) |
| **`DIASPORA-COMMUNAUTE-V1`** | consulat.ga → moteur, une fois (puis à la demande) | objets **publics** : postes consulaires (pages Officiel), associations (pages non revendiquées), entreprises, évènements publics à venir, communiqués officiels | export signé, import idempotent par `importRef`, journal `communityImports` ; jamais de personne |
| Cycle de vie | consulat.ga → moteur (V2) | révocation d'une inscription, suppression de compte | webhook signé ; le statut `verifiee` retombe à `declaree` |
| **ANTSIA** | interne au moteur | adhésion dérivée, contenus `root` | aucune interface : mêmes tables |

Règles héritées de la doctrine : contrats déclarés et versionnés, types copiés chez le
consommateur, routes idempotentes, clés de service par environnement, aucune lecture de base
à base, aucun client Convex croisé.

## 14. Exigences non fonctionnelles

- **EXT-DG-02 Performance** : fil et hub en moins de 1,5 s au premier rendu sur 3G ; fil
  matérialisé dès que le réseau dépasse 200 sources par personne (palier du moteur) ;
  compteurs fragmentés ; pagination partout ; aucune agrégation à la lecture.
- **EXT-DG-03 Sécurité** : autorisation côté serveur uniquement ; limitation de débit sur
  toutes les écritures et les URL de dépôt ; admission des fichiers et garde de délivrance
  fail-closed (avatars, stories, albums compris) ; CSP ; secrets par environnement, jamais
  dans le dépôt ; `schemaValidation: true`.
- **EXT-DG-04 Données** : loi n° 001/2011 modifiée par la loi n° 025/2023 (APDPVP) et RGPD
  (France) ; dossier APDPVP propre à DIASPORALE ; analyse d'impact ; registre des
  consentements ; export et effacement effectifs ; minimisation ; hébergement Convex en région
  UE si disponible, déclaré honnêtement.
- **EXT-DG-05 Accessibilité** : WCAG 2.1 AA, cibles de 44 px, focus visible, lecteur d'écran,
  thème sombre ; relecture `web-design-guidelines` avant livraison.
- **EXT-DG-06 Langues** : français d'abord ; toutes les chaînes passent par i18n dès le
  départ (le socle n'en a pas : c'est une adaptation) ; anglais en V2 ; fuseau horaire par
  pays de résidence (le socle fige Africa/Libreville).
- **EXT-DG-07 Mobile-first** : 375 px de référence, bascule bureau à 960 px (héritée) ;
  application Expo en D3 ; push Expo, FCM, APNs, Web Push.
- **EXT-DG-08 Observabilité** : PostHog (instance UE), journal d'audit des décisions de
  modération, tableau des files, alertes sur les erreurs Convex ; aucun chiffre public non
  mesuré.
- **EXT-DG-09 Qualité** : tests portés avec le code, cliquets d'architecture (réseau borné,
  charte, aucun import inter-produit, aucun `.collect()` non borné), typecheck à zéro, suite
  verte avant toute publication ; parité prouvée module par module.
- **EXT-DG-10 Coût** : un projet Convex partagé avec ANTSIA ; budget mensuel et seuil de
  coupure décidés par le propriétaire ; Cloud Build ou Vercel selon décision.

## 15. Design et charte

- **Le squelette vient de l'espace agent** : grille du fil (680–792 px + rail 312 px, paliers
  `@container`), rail droit (iCom, suggestions, pages, évènements, directs), onglets chemise,
  composeur en feuille, coquille mobile (en-tête collant, barre basse, feuille Menu, pager
  vertical), cartes flottantes et format téléphone — tout cela se duplique avec le code.
- **Les jetons changent, pas les composants** (règle 7) : la charte DIASPORALE est une couche
  de jetons posée sur `data-charte="diasporale"` (couleurs, polices, rayons, espacements) ;
  aucune couleur littérale ; cliquet de charte.
- **Direction artistique** : passe `frontend-design` obligatoire avant la première ligne
  d'interface, à partir de deux options du programme : la famille **Consulaire / Sable**
  (continuité pour les inscrits de consulat.ga : six gris, bleu Gabon `#0072B9`, beige
  `#F4F3ED`, Inter Variable et Plus Jakarta Sans, rayon 10 px ; version chaude `sable`) ou la
  charte **Personnel « parchemin »** de l'espace agent (neutres chauds, bleu `#0b4f9c`, rayons
  12 à 18 px, Familjen Grotesk et DM Mono). Les couleurs du drapeau sont décoratives
  seulement. Arbitrage A7 (§20).
- **Principes de design propres à la communauté** (specs du 13/07) : trois niveaux de
  confiance toujours visibles, le pays est le contexte permanent (CountryChip, ScopeBadge),
  le contact passe par la messagerie, états de modération visibles pour l'auteur, états vides
  génératifs.
- **Composants à concevoir** (C1–C17 des specs) : EventCard, AssociationCard, CompanyCard,
  JobCard, ClassifiedCard, TalentCard, GroupCard, PostCard (hérité), MentorCard, StatCounter,
  CountryChip/ScopeBadge, badges, SponsoredSlot (D4), ModerationBanner, CountrySwitch, hub
  Bento 12 colonnes.
- **Contrôle** : `web-design-guidelines` avant livraison ; vérification réelle dans Chrome
  (contraste, focus, reflow 320 px, console).

## 16. Lots

### Lot D0 — Préalables (propriétaire, juriste, ANTSIA A0–A2)

Décisions du §20 rendues ; dépôt `administration-ga/diasporale` créé ; client OIDC `diasporale`
en sandbox ; dossier APDPVP et analyse d'impact lancés ; mesure de la population éligible ;
**moteur livré** (A1 noyau, A2 réseaux et identité). **Sortie :** `bun run verify` du moteur
vert avec deux réseaux de test ; décisions écrites dans ce document (§20 mis à jour).

### Lot D1 — DIASPORALE V1 web, pilote France (M1 M2 M3 M4 M5 M6 M7-thématiques M11-cloche M12 M13)

Application `diasporale_com` (espace de travail bun externe du moteur) ; réseau `diasporale` ;
facettes ; onboarding IDN et compte léger ; parrainage ; attestation consulaire (contrat des
deux côtés) ; fil, hub pays, profils, relations, pages officielles et d'associations, groupes
thématiques, évènements hérités, stories et albums ; import public unique ; modération France
; consentements, export, effacement ; charte DIASPORALE ; vitrine. **Sortie :** parcours R1 à
R6, R8 à R10 joués en recette sur le déploiement de recette ; suite verte ; parité des modules
dupliqués cochée ; mise en ligne sur diasporale.com vérifiée ; France ouverte.

### Lot D2 — DIASPORALE V2 (M7-conversation M8-communautaire M9 M10 M11-push M14)

Évènements communautaires complets et direct ; messagerie, appels, présence ; emploi,
talents, annonces, entraide ; push et digest par pays ; iAsted concierge ; anglais ;
ouverture de nouveaux pays (deux associations relais et un modérateur chacun). **Sortie :**
R7 joué ; KPI du §2.3 mesurés sur PostHog ; files de modération < 48 h sur quatre semaines.

### Lot D3 — DIASPORALE mobile

Application Expo ; parité R1–R8 ; push natif ; publication sur les stores (comptes du
propriétaire). **Sortie :** parcours clés joués sur appareil ; crash-free > 99 %.

### Lot D4 — La communauté qui se finance (décisions du propriétaire)

Vitrines d'entreprises premium, offres sponsorisées, encarts étiquetés par pays, billetterie
(commission), premium associations ; brique de paiement ; le citoyen ne paie jamais.
**Sortie :** doctrine tenue (étiquetage systématique, densité plafonnée, jamais dans la
messagerie) ; premiers revenus mesurés.

## 17. Critères de recette transverses et Definition of Done

- Deux réseaux de test (`diasporale`, `antsia`) : aucun contenu `network` de l'un n'est lu par
  l'autre ; un membre de `diasporale` est membre d'`antsia` ; `root` exige `public`.
- Aucune table du moteur ne porte de donnée consulaire ; aucun import de `_generated` ni de
  schéma du socle ou de gabon-diplomatie (cliquet).
- Chaque module dupliqué a son en-tête de provenance, ses tests portés, sa liste de parité
  cochée.
- Toute écriture sociale est bornée par la limitation de débit et par l'adhésion ; le refus
  est indistinct.
- L'effacement d'un compte vide toutes les tables sociales et les blobs (test).
- Aucune couleur en dur, aucune chaîne hors i18n, aucun `.collect()` non borné, aucun
  `v.any()` (cliquets).
- Accessibilité AA vérifiée sur les écrans du lot ; relecture `web-design-guidelines` sans
  défaut bloquant.
- Mise en ligne vérifiée après coup (révision servie = commit livré) et rapportée.
- Definition of Done d'un lot : critères de sortie du lot + ces critères transverses +
  documentation (`docs/`, ADR) + mémoire du programme mise à jour.

## 18. Hors périmètre initial

Voir §8.15. S'y ajoutent : la reprise du code de l'Espace Communauté de consulat.ga ; toute
lecture de la base consulaire ; la migration de l'iRéseau du socle sur le moteur ; les démarches
consulaires ; l'application de bureau ; le mode hors ligne.

## 19. Risques et mesures

| Risque | Mesure |
|---|---|
| Population éligible plus faible que 4 500 | mesurer avant d'annoncer ; comptes légers et parrainage ; associations relais ; lancement France |
| Attestation consulaire retardée (formalités ou gouvernance de publication côté consulat.ga) | D1 démarre avec IDN, comptes légers et parrainage ; le badge consulaire arrive quand le contrat est en place |
| Réseau vide | import public, pages officielles, cold start par pays, états vides génératifs |
| Confusion officiel / communauté | badges calculés, pages Officiel seulement par import ou fédération |
| Arnaques (logement, ventes) | logement réservé aux vérifiés, signalement en un geste, messagerie traçable, guide anti-arnaque |
| Modération débordée | relecture au lancement, équipes par pays avant ouverture, sanctions graduées, limitation de débit |
| Fuite de contexte | `networkId` obligatoire, cliquet, refus indistinct |
| Dette héritée (compteurs chauds, fil à la lecture, garde contournée) | corrigée dans le moteur (A2, A4) |
| Divergence socle ↔ moteur | provenance tracée ; rapport de parité ; portage des correctifs par décision |
| Dépendance au monorepo (`file:`/workspaces) | documentée ; vendoring possible en V5 |

## 20. Décisions à valider avant développement (arbitrages)

| # | Question | Recommandation |
|---|---|---|
| A1 | Nom et domaine du réseau racine (ANTSIA / ANTSA, `antsia.ga`) ; DIASPORALE.COM confirmé | ANTSIA (`antsia.ga` figure déjà au registre des dépôts du propriétaire) |
| A2 | Architecture « un moteur, trois réseaux, deux dépôts » | oui (plan §4) |
| A3 | Seuils du parrainage et accès des comptes `en_attente` | un parrain vérifié depuis > 30 j ; dix parrainages/mois ; `en_attente` = lecture seule |
| A4 | Attestation consulaire : contrat minimal consenti depuis consulat.ga, après validation juridique | oui ; sinon lancement sans badge consulaire |
| A5 | Espace Communauté de consulat.ga | geler et rediriger vers DIASPORALE après D1 |
| A6 | Format de la carte téléphone | 440 × 956 (le plus récent du programme), plancher 375 |
| A7 | Charte DIASPORALE | famille Consulaire / Sable (continuité), squelette de l'espace agent ; passe `frontend-design` |
| A8 | Pays ouverts au lancement | France seule ; puis Espagne, Belgique, Canada, Maroc, Sénégal selon les relais |
| A9 | Monétisation | aucune en V1 ; D4 B2B étiqueté ; le citoyen ne paie jamais |
| A10 | Hébergement | Convex (région UE si disponible) + Cloud Run ou Vercel ; budget |
| A11 | Formalités | dossier APDPVP et analyse d'impact dès D0 ; mentions légales et politique de confidentialité relues par un juriste |

## 21. Références

- Plan de pilotage : `Documentation/RESEAUX_SOCIAUX/00_PLAN_RESEAUX_DANS_LE_RESEAU_DIASPORALE_ANTSIA_2026-10-14.md`
  et ses annexes A (backend socle), B (front socle), C (comptes consulat.ga), D (conventions).
- Cahier du moteur : `ECOSYSTEMES/ANTSIA/docs/00_CAHIER_DES_CHARGES_ANTSIA.md`.
- Dossier produit diaspora : `ECOSYSTEMES/GABON_DIPLOMATIE/docs/OPPORTUNITES_COMMUNAUTE_DIASPORA.md`,
  `DESIGN_SPECS_COMMUNAUTE.md`, `PLAN_IMPLEMENTATION_ESPACE_COMMUNAUTE.md`, `AUDIT_AUTHZ_SWEEP_2026-07-10.md`.
- Socle : `ADMINISTRATION_GA/socle/convex/modules/{reseauPersonnel,reseau,reseauPages,reseauAlbums,direct,fileGuard}`,
  `socle/packages/agent-features/src/features/{reseau-personnel,messagerie,direct,stories,notifications,reseau-albums}` ;
  ADR 0080, 0082, 0087, 0096, 0123, 0148, 0160, 0177, 0191.
- Doctrine : `REORGANISATION_ADMINISTRATION_GA_RESEAU_SOCIAL_2026-07-29.md`,
  `DOCTRINE_ACCES_ACQUISITION_RESEAU_SOCIAL.md`, `DOCTRINE_COMMUNICATION_PUBLIQUE.md`.
- PRO.GA : `PRO_GA/docs/11_PLAN_IMPLEMENTATION_PROMPTS_PRO_GA.md` (dix règles),
  `12_OWNER_MAP_DUPLICATION_I_MODULES.md`, `14_RAPPORT_PARITE_I_MODULES.md`.
- identite.ga : `SERVICES_TRANSVERSES/identite.ga` (`docs/adr/0001-oidc-architecture.md`, SDK `@idn-ga/better-auth`).
- Chartes : `okatech-projects/DESIGN_SYSTEMS/{consulaire,sable,gabon-connect}.md`, `CITIZEN_DESIGN_SYSTEM_V3.md`.
- Droit : loi n° 001/2011 modifiée par la loi n° 025/2023 (APDPVP) ; RGPD ; dossier
  `Documentation/00_Transverse/APDPVP/05_Dossier_APDPVP_consulat_ga.pdf` (à étendre par un dossier DIASPORALE).

*Fin du cahier des charges DIASPORALE.COM — version 1.0 du 14 octobre 2026.*
