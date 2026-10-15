---
title: "DIASPORALE.COM — Plan d'implémentation en prompts"
version: "1.0"
date: "2026-10-14"
statut: "Plan d'exécution — prompts Claude Code (Opus), à exécuter après ANTIA PA0–PA7"
projet: "DIASPORALE"
reference: "NTSAGUI/DIASPORALE/PI/2026/001"
dependances:
  - "ECOSYSTEMES/DIASPORALE/docs/00_CAHIER_DES_CHARGES_DIASPORALE.md (exigences EXF-DG / EXT-DG)"
  - "ECOSYSTEMES/ANTIA/docs/01_PLAN_IMPLEMENTATION_PROMPTS_ANTIA.md (le moteur : PA0 → PA7 doivent être clos)"
  - "Documentation/RESEAUX_SOCIAUX/00_PLAN_RESEAUX_DANS_LE_RESEAU_DIASPORALE_ANTIA_2026-10-14.md"
---

# DIASPORALE.COM — Plan d'implémentation en prompts

## État d'avancement (tenu par la session de construction)

> Session de construction ouverte le 14/10/2026 (Opus 5.5, effort maximal). Le moteur ANTIA
> se construit en parallèle : tant qu'il n'existe pas, DIASPORALE avance sur ce qui n'en
> dépend pas (étapes a → e du prompt de lancement, `docs/02`), puis enchaîne PD0 → PD10
> au fil des jalons d'ANTIA (PA2, PA3, PA7).

| Prompt | Clos le | Commit |
|---|---|---|
| a) `packages/diasporale-domain` (domaine pur, `bun test`) | 2026-10-14 | `b214e81` |
| b) Charte DIASPORALE (`docs/03_CHARTE_DIASPORALE.md`, jetons `[data-charte="diasporale"]`) | 2026-10-14 | `8b1306a` |
| c) `apps/diasporale_com` sur fournisseur factice (R1 à blanc sur :3031) | 2026-10-14 | `f5aff56` |
| d) `packages/diasporale-features` (C1–C17, CountrySwitch, badges, ModerationBanner, états vides) | 2026-10-14 | `b953739` |
| e) Contrats côté gabon-diplomatie (PR brouillon) + fournisseur d'attestation factice | 2026-10-15 | PR brouillon administration-ga/gabon-diplomatie#184 (`7d01f215`) et #185 (`540d3c45`), non fusionnées ; fournisseur factice `b953739`, lecture stricte `bb76017` |
| PD0 Câblage dans le moteur | en cours (15/10) | ANTIA `5535a63`, `97cec07` (installation), `2454aed` (catalogue) ; DIASPORALE `fa307c0`, `dffbe4b`, `fc8acef`, `1752d22` — reste `docker build` (disque de la machine) |
| PD1 Domaine diaspora et réseau `diasporale` dans le moteur | 2026-10-15 | domaine `7c5575e`, `c622cb9`, `c067746` ; tranche ANTIA `22b0383` (tables), `7cfafdd` (fonctions) ; côté moteur, par ANTIA : `97cec07` (`managedBy`, aides d'admission, `failAppRule`, seaux), `bf1f46c` (schéma) — reste la ligne de `convex/crons.ts` (demandée à ANTIA) |
| PD2 Entrer dans DIASPORALE (IDN, compte léger, handle, consentements) | partiel (15/10) | DIASPORALE `140a82c`, `a8ea1a9` ; tranche ANTIA `8176491`, `ecae28d` ; ANTIA `187adb6` (`isHandleAvailable`, proxy d'authentification commun) — R3 joué contre le moteur local ; reste R1 (IDN dans le moteur : PA4 d'ANTIA ; client OIDC sandbox `diasporale`) |
| PD3 Attestation consulaire `DIASPORA-ATTESTATION-V1` | partiel (15/10) | gabon-diplomatie : PR brouillon #184 (étape e) ; domaine `77fa3ff`, `3fa4213` ; tranche ANTIA `ac2eca3`, `be59fcf` ; application `34fa44a` — reste la recette R2 réelle (clé de service et URL de consulat.ga sur un déploiement, après validation juridique ; empreinte d'adresse d'un compte léger : PA4) |
| PD4 Fil, hub pays, profils et relations | en cours (15/10) | DIASPORALE `000b89d` (profils), `758f46d` (relations), `5c96109` (cloche), `1559188` (« Membres », annuaire opt-in), `492f4d0` (portée et pays, fil par voies, mur), `d5eb7a2` (commentaires), `aaaab80` (menu d'une publication), `03b8875` (suggestions ; publications de page), `53f8a48` (changement de hub mémorisé), `00002bf` (parité des surfaces, `docs/04`), `458d768` (publication seule, modification, signets), `892c7e5` (brouillon durable, mentions et mots-dièse — PR administration-ga/diasporale#1) ; tranche ANTIA `010a5d8` (`memberFacet`, cloche), `759643b` (journal de la modération), `bce7185` (annuaire de la tranche), `21380c1` (suggestions) ; ANTIA `817a433` (annuaire générique refusé sur un réseau gouverné), `3069a61` (fil par voies), `9f4308b` (texte riche du moteur — PR administration-ga/antia#1) — reste stories (lot 12b d'ANTIA) et albums (lot 14) à brancher, médias et partage cité du composeur, la recette Chrome complète |
| PD5 → PD10 | — | — |

Vérifications des étapes closes :
- **a)** 197 cas `bun test`, couverture lignes et fonctions 100 % imposée par
  `packages/diasporale-domain/bunfig.toml`, `tsc --noEmit` 0 ; 206 cas depuis le module
  d'attestation (`bb76017`).
- **b)** `tokens-contrast.test.ts` : 97 contrôles (paires texte ≥ 4,5:1, contours et focus
  ≥ 3:1, dans les deux thèmes ; contrat de thème couvert ; aucune primitive redéclarée en
  sombre ; drapeau réservé au filet). Le cliquet a recalé le texte discret (4,499:1 → 4,70:1).
- **c)** `bun run verify` vert (typecheck des trois paquets, 206 + 142 + 14 tests, lint).
  Recette à blanc dans le navigateur sur `http://localhost:3031` : R1 complet (IDN fictif
  → France / Lyon → identifiant → consentements → hub), 320, 375 et 1452 px sans défilement
  horizontal, thèmes clair et sombre, console sans erreur. Cliquets : clés i18n (aucune clé
  morte, codes d'erreur fermés), aucune couleur ni chaîne affichée en dur.
- **PD0 (en cours)** : installation unique dans `ANTIA/` (espaces de travail `../DIASPORALE/*`,
  catalogue complété, port 3031, verify du moteur couvrant DIASPORALE) ; installation provisoire
  supprimée ; `createEngineNextConfig`, tsconfig et ESLint du moteur ; i18n par `createAppI18n` du
  moteur ; charte servie par `@antia/ui` + thème `diasporale.css` + rôles propres `extras.css` ;
  Dockerfile en contexte ECOSYSTEMES (non construit : disque de la machine). Vérifié : typecheck,
  212 + 155 + 15 tests, lint ; rendu contrôlé dans le navigateur, clair et sombre.
- **PD1** : tranche `ANTIA/convex/modules/diaspora/` (tables, faits, adhésion, parrainage,
  facette, hubs, graine, manifeste) sur les règles de `@diasporale/domain`. Vérifié dans l'arbre
  ANTIA : typecheck convex et tests 0, 67 tests convex (dont 23 de la tranche : compte léger en
  attente qui ne publie pas, parrainage qui le passe déclaré, adhésion ANTIA dérivée, refus
  indistinct de la cible, quota et ancienneté du parrain, retrait, départ, IDN étrangère, Gabon
  refusé comme pays, annuaire sous consentement, membre d'ANTIA seul sans accès, compteurs
  matérialisés jamais calculés à la lecture, graine idempotente), 35 cliquets (dont « toute
  fonction sociale bornée par le réseau », qui couvre la tranche) ; domaine 228 tests, 100 %.
  **Écarts au plan, assumés** :
  - le réseau est GOUVERNÉ par la tranche (`networks.managedBy = "diaspora"`, ajouté au moteur à
    la demande de DIASPORALE) : les chemins génériques `joinNetwork` et `setMyFacet` le refusent,
    sans quoi une IDN étrangère y entrait « déclarée » et un poste consulaire se saisissait ;
  - `countryHubs` ne recopie pas l'ouverture d'un pays : elle se lit dans `networks.openCountries`,
    réglage tracé de la console ;
  - table `memberPrivacy` en plus des quatre du plan : niveaux fins de la facette et niveau
    d'annuaire (le moteur générique ne connaît que `hidden`, `network`, `root`) ;
  - index nommés selon la convention du moteur (`by_network_and_country`…) ;
  - compteurs d'associations, d'entreprises et d'évènements à zéro jusqu'à leurs sources (PD5,
    PD7) ; le chiffre des membres sous le seuil de publication ne quitte pas le serveur.
- **PD2 (partiel)** : source de données « moteur » de l'application (`apps/diasporale_com/src/data`,
  `dev:engine`), à côté de la démonstration qui reste la valeur par défaut. Vérifié : `bun run verify`
  vert (232 + 169 + 40 tests, dont 17 pour la source moteur), puis **recette R3 contre le moteur
  local** sur :3031 :
  - deux comptes `@exemple.test` entrés par code à usage unique (outils de développement du moteur) ;
  - accueil en trois étapes, propositions et disponibilité d'identifiant par le moteur, aucune case
    précochée ;
  - adhésion « en attente » et adhésion ANTIA dérivée, carte de statut, « Publier » désactivé ;
  - parrain rendu vérifié par la graine de recette ; identifiant inconnu refusé de façon indistincte ;
  - parrainage, puis filleul « déclaré » (relevé en base).
  La recette a révélé une boucle de rendus (requêtes non mémorisées), corrigée en `a8ea1a9`.
  **Écarts assumés** : ce que le moteur ne sert pas encore se dit `feature_unavailable` ; le fil
  lit toute publication du moteur comme portée « diaspora » (règle du domaine pour un contenu
  sans pays) jusqu'au lot « posts » de PA3, et refuse de publier en portée « local » d'ici là.
- **PD3 (partiel)** : côté moteur (`convex/modules/diaspora/attestation.ts`), geste de
  consentement enregistré AVANT l'appel ; une demande par 24 h (le seau de débit refuse d'abord) ;
  requête de quatre champs signée HMAC (clé du déploiement, jamais dans le code) ; réponse relue en
  liste blanche ; ligne à l'empreinte du sujet ; issue confirmée = lien `consular_attestation`, poste
  sur la facette, statut « vérifiée ». Tests contre un faux consulat.ga qui vérifie la signature
  (confirmée, non confirmée, hors contrat, sans configuration, 24 h, blocage) : 32 tests de la
  tranche, 50 cliquets. Application : demande puis lecture de l'issue (20 tests). La lecture du
  domaine exigeait un écart : `contract`, émis par la route de #184, est désormais exigé (`77fa3ff`).
- **PD4 (en cours)** : profils par le moteur (`getPublicProfile` + `memberFacet` : facette projetée
  pour le lecteur, aperçu « autre pays » pour soi) ; relations (se connecter, accepter, suivre, bloquer)
  aux deux implémentations, branchées sur le graphe du moteur ; cloche DIASPORALE (parrainage reçu ou
  retiré, attestation confirmée ou non) ; retrait de parrainage par la modération motivé et inscrit au
  journal du moteur. Recette sur :3031 contre le moteur local : profil et aperçu, demande de connexion,
  première publication (portée « toute la diaspora ») et réaction ; **R4** constaté en base (publication
  `visibility: network` dans `diasporale`, sans « publier aussi sur ANTIA »). Vérifié : `bun run verify`
  vert (232 + 175 + 47 tests) ; tranche 35 tests, 53 cliquets. **Faille relevée** : l'annuaire
  générique du moteur listait les membres de `diasporale` sans leur accord (opt-in de DIASPORALE) —
  corrigée par ANTIA (`817a433` : chemin générique refusé sur un réseau gouverné, drapeau
  `directoryListed` posé par la tranche).
  Suite du 15/10, toutes vérifiées par `bun run verify` vert (208 + 57 tests) puis en recette sur :3031 :
  - **cloche** (`5c96109`) : demande de relation acceptée depuis la cloche, l'avis passe « acceptée » et lu ;
    « Notifications » (cloche) et « Avis » (pile flottante) ne se confondent plus pour les lecteurs d'écran ;
  - **annuaire opt-in** (tranche `bce7185`, 39 tests ; écran `/membres`, `1559188`) : chaque candidat
    rejugé par `isListedInDirectoryFor` (niveau, consentement EN VIGUEUR, statut, pays du lecteur,
    blocage) ; une fiche masquée est introuvable, même par identifiant exact ; en-tête mobile à 320, 360,
    375 px sans débordement ;
  - **portée et pays** (`492f4d0`) : « Mon pays », un hub et « Toute la diaspora » composent les voies du
    moteur selon `isShownInHub` ; une publication « Dans le hub France » paraît dans « France » et
    « Récents », pas dans « Toute la diaspora » ; mur de l'auteur.
  **Écarts assumés** :
  - relecture avant publication (invariant 10) : le moteur ne retient encore rien (PA5, crochet de
    politique accordé par ANTIA) ; d'ici là, publication locale refusée à l'écran pour un pays non ouvert —
    garde d'écran seulement, **bloquant pour la mise en ligne** ;
  - les publications de développement d'avant le lot 7 n'ont pas de portée : aucune voie ne les sert
    (données locales seulement).
- **e)** Côté gabon-diplomatie, sur deux branches en worktree (le `main` partagé n'est pas
  touché) : #184 `DIASPORA-ATTESTATION-V1` (route signée HMAC, exclusions indiscernables,
  idempotence par `consentRef`, journal à empreinte, correspondance e-mail par
  `hashPii`, ADR-0006 proposé) — 42 tests ; #185 `DIASPORA-COMMUNAUTE-V1` (export public
  en liste blanche, signature de la requête entière, pagination) — 17 tests ; suite backend
  complète verte (2 537 tests). Restent au propriétaire et au juriste : clés
  `DIASPORA_PARTNER_KEYS`, validation juridique, durée du journal, `convex codegen` sur un
  déploiement de développement avant fusion.
- **d)** 142 tests (parcours R1, R2, R3 sur le magasin de démonstration, composants,
  parité fr / en, contrastes). Lancer depuis PD0 : `bun install` dans `ANTIA/` (installation
  unique), puis `bun run --cwd ../ANTIA dev:diasporale` ou `bun run dev` à la racine de DIASPORALE.

**Arbitrages pris par défaut** (recommandations du cahier `docs/00` §20, retenues comme
valeurs de travail jusqu'à décision écrite du propriétaire) : A1 ANTIA / `antia.ga`, DIASPORALE.COM
confirmé ; A2 un moteur, trois réseaux, deux dépôts ; A3 un parrain vérifié depuis plus de
30 jours, dix parrainages par fenêtre glissante de 30 jours, `en_attente` en lecture seule ;
A4 attestation consulaire par contrat minimal consenti, après validation juridique (sinon
lancement sans badge consulaire) ; A5 Espace Communauté de consulat.ga gelé puis redirigé
après D1 ; A6 carte téléphone 440 × 956, plancher 375 ; A7 famille Consulaire / Sable sur
le squelette de l'espace agent ; A8 France seule au lancement, puis Espagne, Belgique,
Canada, Maroc, Sénégal ; A9 aucune monétisation en V1 ; A10 Convex (région UE si
disponible) et hébergement à décider ; A11 dossier APDPVP et analyse d'impact dès D0.

**Numérotation des documents** : `docs/02` est pris par le prompt de lancement ; la charte
devient `docs/03`, la parité des surfaces `docs/04`, la recette D1 `docs/05`, le rapport de
parité et de lancement `docs/06` (décalage d'un rang par rapport aux prompts ci-dessous).

## 0. Objet et mode d'emploi

Ce plan exécute le cahier des charges `docs/00` en **onze prompts** (PD0 → PD10), rangés par
lot (D0 → D4). Chaque prompt se colle **tel quel, un à la fois**, dans Claude Code ouvert à la
racine `Digital GABON/DIGITAL_GOUV/`, précédé du **préambule commun** (§2). Chaque prompt se
termine par un état **vert** (typecheck, tests, lint du périmètre touché), un commit dans le
dépôt concerné et un rapport de fin (ce qui a été fait, ce qui a été vérifié, ce qui reste).
L'ordre est obligatoire. On ne lance jamais deux prompts à la fois sur le même dépôt.

Règles d'exécution héritées du programme :

- **Modèle** : Opus, jamais Sonnet, pour tout le code (consigne du propriétaire du 25/09/2026).
- **Livraison** : une fois vérifié, le travail est poussé, proposé en PR et fusionné sans
  redemander l'accord (décision du 23/09/2026) ; **sauf** la création de dépôts, de projets
  Convex, de projets d'hébergement, de secrets et de domaines, qui restent au propriétaire.
- **Jamais** : secret dans le dépôt, donnée réelle de consulat.ga dans le moteur, lecture de
  base à base, `--rapide` sans demande explicite, force-push.
- **Dépôts touchés** : `ECOSYSTEMES/ANTIA` (le moteur et ses paquets ; la tranche
  `convex/modules/diaspora`), `ECOSYSTEMES/DIASPORALE` (l'application et ses paquets),
  `ECOSYSTEMES/GABON_DIPLOMATIE` (les deux contrats, par PR, en coordination avec le
  développeur qui publie la prod), `SERVICES_TRANSVERSES/identite.ga` (client OIDC, par le
  portail développeur plutôt que par le code).

## 1. Préalables vérifiables (liste à cocher avant PD0)

- [ ] ANTIA PA0 → PA7 clos : moteur avec deux réseaux de test, identité IDN, modération V1,
      paquets `social-domain`, `social-features`, console ; `bun run verify` vert dans `ANTIA/`.
- [ ] Décisions A1 à A11 du cahier `docs/00` §20 rendues et écrites (au moins A1, A2, A3, A7, A8).
- [ ] Dépôt `administration-ga/diasporale` créé par le propriétaire (vide) ; domaine
      `diasporale.com` confirmé.
- [ ] Client OIDC `diasporale` créé au portail développeur d'identite.ga en **sandbox**
      (callback `https://diasporale.com/api/auth/oauth2/callback/idn` et l'origine de recette).
- [ ] Dossier APDPVP et analyse d'impact lancés (juriste) ; mesure de la population éligible
      faite par le propriétaire (cahier §6.5).
- [ ] Pour PD3 et PD5 : accord du propriétaire et validation juridique de l'attestation
      consulaire ; coordination avec l'équipe qui publie gabon-diplomatie de gabon-diplomatie.

## 2. Préambule commun (à coller en tête de chaque prompt)

```text
[PRÉAMBULE COMMUN — DIASPORALE]
Tu travailles dans « Digital GABON/DIGITAL_GOUV/ ». Lis d'abord
ECOSYSTEMES/DIASPORALE/docs/00_CAHIER_DES_CHARGES_DIASPORALE.md, ECOSYSTEMES/ANTIA/docs/00_CAHIER_DES_CHARGES_ANTIA.md
et ECOSYSTEMES/ANTIA/CLAUDE.md. Le moteur social vit dans ECOSYSTEMES/ANTIA (backend Convex, paquets
social-domain et social-features) ; DIASPORALE est une application de ce moteur, espace de travail bun
externe déclaré dans ANTIA/package.json. Règles non négociables :
- dix règles de duplication (copier d'abord, en-tête de provenance, périmètre d'adaptation fermé, aucun
  import de _generated/schéma/table du socle ou de gabon-diplomatie, tests portés, fusion sans écrasement,
  jetons sans fork, tranches verticales, gardes testées, parité prouvée) ;
- invariants R1–R8 : networkId partout, visibilité network par défaut, adhésion dérivée vers antia,
  une personne un handle, badges calculés côté serveur, modération par réseau, aucune donnée consulaire,
  adhésion explicite ;
- code en anglais, UI en français via i18n (aucune chaîne en dur), TypeScript strict, validateurs précis
  (jamais v.any()), aucune couleur littérale, React Hook Form + Zod, sonner, lucide-react ;
- aucune commande qui écrit sur un déploiement Convex de production, aucune donnée réelle, aucun secret ;
- travail sur une branche dédiée, commits en français, PR, fusion après vérification ; création de dépôts,
  projets et secrets réservée au propriétaire ;
- en fin de prompt : typecheck 0, tests et lint verts sur le périmètre touché ; rapport de fin avec ce qui
  est vérifié et ce qui ne l'est pas. Si un préalable manque, arrête-toi et dis-le.
```

## 3. Table de correspondance source → cible

| Source | Cible | Prompt |
|---|---|---|
| Moteur ANTIA (`convex/modules/{networks,people,posts,graph,pages,groups,events,messaging,calls,live,notifications,moderation,files,consents}`) | consommé tel quel ; seed du réseau `diasporale` | PD1 |
| `ANTIA/packages/social-features` (fil, profil, relations, groupes, évènements, pages, albums, stories, notifications, messagerie, direct) | montés dans `DIASPORALE/apps/diasporale_com` avec le contexte réseau `diasporale` et la charte DIASPORALE | PD4, PD7 |
| Nouveau : `ANTIA/convex/modules/diaspora/` (`countryHubs`, `sponsorships`, `consularAttestations`, `communityImports`, V2 : `jobPostings`, `jobApplications`, `jobAlerts`, `classifieds`, `mentorships`) | tranche propre à la diaspora, dans le moteur | PD1, PD3, PD5, PD8 |
| Nouveau : `DIASPORALE/packages/diasporale-domain` (TS pur : facette, éligibilité, parrainage, pays, portée, badges) | SSOT métier de DIASPORALE, importé par le moteur et par l'application | PD1 |
| Nouveau : `DIASPORALE/packages/diasporale-features` (hub pays, CountrySwitch, cartes C1–C17, onboarding diaspora, modération pays, emploi, annonces, entraide) | surfaces propres | PD2, PD4, PD5, PD6, PD8 |
| `GABON_DIPLOMATIE/packages/backend/convex` : nouvelle route HTTP `DIASPORA-ATTESTATION-V1`, export `DIASPORA-COMMUNAUTE-V1`, boutons « Rejoindre DIASPORALE » et « Activer IDN » | côté consulat.ga, par PR | PD3, PD5 |
| Spécifications : `GABON_DIPLOMATIE/docs/{OPPORTUNITES_COMMUNAUTE_DIASPORA,DESIGN_SPECS_COMMUNAUTE}.md` | reprises, pas de code | tous |

## 4. Les prompts

---

### PROMPT PD0 — Préalables, ouverture du dépôt et câblage dans le moteur (lot D0)

**Objectif.** Un dépôt `DIASPORALE` qui compile comme espace de travail externe du moteur, sans
une ligne de métier.

**Contexte.** Le moteur est dans `ECOSYSTEMES/ANTIA` (PA0–PA7 clos). Le modèle d'un espace de
travail externe est celui des applications de l'État vis-à-vis du socle (ADR-0165) et de
`PLATEFORMES_PUBLIQUES/demarche.ga` (annexe D §C.6 du plan). Les quatre câblages invisibles en
local sont connus : workspace absent du `package.json`, `ARG` manquants dans le Dockerfile,
liaison IAM, domain mapping.

> Vérifie les préalables du §1 (lis `ANTIA/docs/01` : PA0–PA7 doivent être marqués clos dans
> son encart d'état) ; si l'un manque, arrête-toi et liste ce qui manque.
> 1. Dans `ECOSYSTEMES/DIASPORALE/` (déjà ouvert : README, CLAUDE.md, docs/), crée
>    `apps/diasporale_com` (Next.js 16, React 19, Tailwind v4, `output: "standalone"`,
>    `outputFileTracingRoot` et `turbopack.root` = `ECOSYSTEMES`, alias vers le `node_modules`
>    du moteur, CSP comme demarche.ga), `packages/diasporale-domain` (TS pur, zéro dépendance,
>    tests `bun test`) et `packages/diasporale-features` (React, dépend de
>    `@antia/social-features`, `@antia/ui`, `@antia/api`). Noms de paquets : `diasporale-com`,
>    `@diasporale/domain`, `@diasporale/features`. `tsconfig` étend celui du moteur ; alias
>    `@convex/*` → `../ANTIA/convex/*` (typage seulement).
> 2. Dans `ANTIA/package.json`, ajoute les workspaces `../DIASPORALE/apps/*` et
>    `../DIASPORALE/packages/*` ; régénère `bun.lock` depuis une installation propre ; ajoute
>    les scripts `dev:diasporale` (port 3031) et l'entrée `diasporale` du catalogue de
>    déploiement du moteur (service, Dockerfile en contexte `ECOSYSTEMES`, `site_url`
>    `https://diasporale.com`, tous les `ARG NEXT_PUBLIC_*`). Ajoute `diasporale.com` et
>    l'origine de recette aux origines de confiance de Better Auth du moteur (par variable,
>    jamais en dur).
> 3. Page d'accueil provisoire `/` de `diasporale_com` : titre, « bientôt », aucun contenu
>    inventé (doctrine de communication publique) ; `/sante-fonctionnelle` qui répond 200.
> 4. `Dockerfile` autoportant en contexte `ECOSYSTEMES` (copie du moteur puis de
>    DIASPORALE, `bun install --frozen-lockfile` dans ANTIA, build dans l'app, image
>    `node:20-alpine`, port 8080).
> 5. `.gitignore`, `README` et `CLAUDE.md` du dépôt mis à jour (commandes réelles).
> Interdits : aucun module métier, aucune table. Critère de sortie : `bun install` dans ANTIA
> passe ; `bun run --cwd ANTIA dev:diasporale` sert la page ; `bun run verify` du moteur reste
> vert ; `docker build` du Dockerfile réussit en local ; commit dans DIASPORALE et dans ANTIA.

**Critères de done.** Deux commits (ANTIA : workspaces et catalogue ; DIASPORALE : squelette) ;
`verify` vert ; page servie ; image construite.
**Vérification.** `bun run verify` ; `curl` de `/sante-fonctionnelle` ; `docker build`.
**Couvre.** EXT-DG-01 (origines), EXT-DG-10 (coût : un seul projet Convex).

---

### PROMPT PD1 — Domaine diaspora et réseau `diasporale` dans le moteur (lot D1)

**Objectif.** Le réseau `diasporale` existe dans le moteur avec sa politique d'adhésion, ses
facettes, sa tranche propre et ses tests.

**Contexte.** Le moteur fournit `networks`, `persons`, `identityLinks`, `networkMemberships`,
`personFacets` et `requireMembership` (cahier ANTIA §11–12). La doctrine `déclaré → vérifié`
est celle du programme.

> 1. `DIASPORALE/packages/diasporale-domain` : `facet.ts` (schéma de facette : `countryOfResidence`
>    ISO 3166-1 ≠ GA obligatoire, `city?`, `postSlug?`, `associationIds`, `arrivedAt?`,
>    `helpAvailable`, visibilités par champ), `eligibility.ts` (statuts `en_attente | declaree |
>    verifiee | suspendue | partie`, transitions, ce que chaque statut autorise — table du cahier
>    §6.2), `sponsorship.ts` (parrain vérifié depuis > 30 j, dix parrainages par mois, retrait),
>    `reach.ts` (`local | diaspora`), `countries.ts` (liste ISO, pays ouverts), `badges.ts`
>    (règles pures : Officiel, Vérifié, Agent public, Communauté). Tests `bun test` : 100 % des
>    transitions et des refus.
> 2. Dans le moteur, tranche `ANTIA/convex/modules/diaspora/` : `tables.ts` (`countryHubs`
>    {networkId, country, open, counters matérialisés, updatedAt}, `sponsorships` {networkId,
>    sponsorPersonId, sponsoredPersonId, createdAt, revokedAt?}, `consularAttestations`
>    {personId, subjectKind, subjectHash, result, country?, postSlug?, since?, consentId,
>    requestedAt, respondedAt}, `communityImports` {importRef, kind, status, createdAt}),
>    `manifest.ts`, `membership.ts` (`joinDiasporale` : crée l'adhésion `diasporale` au statut
>    issu de `eligibility`, la facette, et l'adhésion dérivée `antia` ; `sponsor`,
>    `revokeSponsorship` ; `leave`), `hubs.ts` (`getCountryHub`, `listOpenCountries`,
>    cron quotidien de matérialisation des compteurs), index `by_network_country`. Validateurs
>    précis. Seed du réseau `diasporale` (`kind closed`, `parentId antia`, politique
>    `declared_or_verified`, visibilité `network`, pays ouverts = `["FR"]`), idempotent, gardé par
>    une confirmation hors production.
> 3. Tests convex-test : un compte léger est `en_attente` et ne publie pas ; un parrainage le
>    passe `declaree` ; l'adhésion `antia` dérivée existe ; `networkId` obligatoire sur toute
>    query de la tranche ; un membre d'`antia` seul ne lit pas un contenu `network` de
>    `diasporale` ; les compteurs de hub ne sont jamais calculés à la lecture.
> Critère de sortie : typecheck convex 0 ; suite du moteur verte (ancienne et nouvelle) ; le
> cliquet « toute query sociale est bornée par le réseau » couvre la tranche `diaspora`.

**Critères de done.** Domaine pur testé ; tranche `diaspora` avec tests ; seed idempotent.
**Vérification.** `bun run --cwd ANTIA test:domain`, `test`, `typecheck:convex`.
**Couvre.** EXF-DG-04 (parrainage), EXF-DG-08 (facette), EXF-DG-15/16 (hubs, portée), EXT-DG-02 (compteurs).

---

### PROMPT PD2 — Entrer dans DIASPORALE : IDN, compte léger, handle, consentements (lot D1)

**Objectif.** Une personne entre par IDN ou par un code à usage unique, choisit son handle,
consent, et voit son statut.

**Contexte.** Better Auth du moteur (PA4) porte déjà IDN (`@idn-ga/better-auth`, PKCE,
`/userinfo` avec `loa` et `nationality`) et les codes à usage unique ; la cloche et
`use-profile-onboarding`, `HandleChoiceCard`, `ProfilePublicationCard` sont dans
`social-features`. Les écrans E11, E12, E13 des specs design donnent la bifurcation
d'accueil, l'onboarding en trois étapes et le parcours d'élévation.

> 1. `apps/diasporale_com` : routes `/entrer` (deux portes, IDN affichée en premier ; aucun mot
>    de passe), `/bienvenue` (trois écrans : pays et ville avec `CountrySelect` ; handle et
>    nom affiché via `HandleChoiceCard` ; consentements explicites non précochés : profil
>    social, annuaire opt-in, notifications), `/parametres` (facette, confidentialité,
>    consentements, « Mes données »). Textes en français via i18n (`@diasporale/features/i18n`,
>    fichiers `fr.json`, `en.json` vide pour l'instant).
> 2. Composant `MembershipStatusBanner` (`@diasporale/features`) : `en_attente` → « demandez un
>    parrainage ou vérifiez votre inscription consulaire » ; `declaree` → élévation (« Activer
>    mon identité numérique IDN », « M'inscrire au consulat ») ; `verifiee` → badge. Les liens
>    d'élévation renvoient vers identite.ga et consulat.ga ; le retour conserve la session
>    (retour OIDC ou jeton à usage unique du moteur).
> 3. Parrainage : écran « Parrainer » (par handle ou lien à usage unique), journal des
>    parrainages donnés, retrait ; quotas affichés.
> 4. Enregistrement des consentements dans `consents` du moteur à chaque geste ; révocation en
>    un geste depuis `/parametres` ; export et effacement déclenchables (le moteur les exécute,
>    PA5).
> 5. Tests : composants montés (jsdom) pour les trois écrans et la bannière ; test de
>    contrat « aucune case précochée » ; test i18n « aucune chaîne hors locale » (cliquet).
> Critère de sortie : parcours R1 (IDN) et R3 (compte léger puis parrainage) joués en recette
> contre le déploiement de dev du moteur ; typecheck, tests, lint verts ; accessibilité AA des
> trois écrans vérifiée (focus, labels, contraste).

**Critères de done.** Parcours R1 et R3 joués ; cliquets i18n et consentements verts.
**Vérification.** Recette dans Chrome (deux comptes de test), `web-design-guidelines` sur les écrans.
**Couvre.** EXF-DG-01, 02, 04, 05, 44 ; EXT-DG-05, 06.

---

### PROMPT PD3 — Attestation consulaire `DIASPORA-ATTESTATION-V1` (lot D1, deux dépôts)

**Objectif.** Une personne consent, le moteur demande à consulat.ga si une inscription
consulaire active existe, et pose le statut `verifiee` avec le pays et le poste. Rien d'autre
ne circule.

**Contexte.** consulat.ga n'est pas un fournisseur OIDC et ne doit pas le devenir (IDN est
l'IdP unique déclaré) ; il atteste. Côté gabon-diplomatie, le backend est
`packages/backend/convex` (`http.ts`, `schemas/profiles.ts`, `consularRegistrations`,
`users.idnSub`, `users.email`) ; la publication de gabon-diplomatie suit sa propre gouvernance
: **ce prompt livre une PR, pas une publication**. Validation juridique
et accord du propriétaire requis (préalable).

> **Côté gabon-diplomatie** (branche `feat/diaspora-attestation-v1`, PR) :
> 1. Contrat `docs/contrats/DIASPORA-ATTESTATION-V1.md` : requête `{ subjectKind: "idnSub" |
>    "emailHash", subject, consentRef, requestedAt }`, réponse `{ verified: boolean,
>    countryOfResidence?, postSlug?, registrationStatus?: "active" | "expired" | "none",
>    since?, attestedAt }`, signature HMAC par clé de service par environnement, horodatage,
>    idempotence par `consentRef`, codes d'erreur fermés. Jamais de nom, de passeport, de NIP,
>    de date de naissance, de mineur.
> 2. Route `httpAction` `POST /api/partner/diaspora/attestation` dans `http.ts` : vérifie la
>    signature, résout le compte par `idnSub` ou par e-mail vérifié (`emailHash` = SHA-256 de
>    l'e-mail normalisé), exclut agents (`memberships`), mineurs (`childProfiles`), comptes
>    supprimés ou en demande de suppression, étrangers (`userType` visa/admin) ; lit
>    `consularRegistrations` actives et `profiles.managedByOrgId` → `orgs.slug` ; journalise
>    dans une table `partnerAttestationLog` (hash du sujet, résultat, date — pas le sujet).
>    Rate limit par clé. Tests convex-test : chaque exclusion, chaque code d'erreur, la
>    signature invalide, l'idempotence.
> 3. ADR `docs/adr/0006-consulat-atteste-ne-federe-pas-d-identite.md` (gabarit du dépôt).
> **Côté moteur** (`ANTIA/convex/modules/diaspora/attestation.ts`) :
> 4. Mutation `requestConsularAttestation` : exige l'adhésion `diasporale`, enregistre le
>    consentement (`consents`, finalité `consular_attestation`), crée la ligne
>    `consularAttestations` et planifie l'action `callAttestation` (clé de service en variable
>    d'environnement du déploiement, jamais dans le code) ; à la réponse, pose
>    `identityLinks(kind: consular_attestation)`, le statut `verifiee`, la facette `postSlug` et
>    `countryOfResidence` si absente ; en cas de `none` ou d'erreur, message neutre « nous
>    n'avons pas pu confirmer » sans détail consulaire. Limitation : une demande par 24 h.
> 5. UI : bouton « Vérifier mon inscription consulaire » dans `/parametres` et dans la bannière
>    ; écran de consentement explicite (ce qui est demandé, ce qui est reçu, ce qui ne l'est
>    jamais) ; état « en cours », « vérifié depuis le … », « non confirmé ».
> 6. Tests : moteur avec un faux serveur (réponse signée) ; refus sans consentement ; aucune
>    donnée hors contrat persistée (test qui inspecte la ligne écrite).
> Critère de sortie : PR gabon-diplomatie ouverte et verte (suite + lint du périmètre) ;
> moteur vert ; recette croisée réelle en **dev** (déploiement dev de gabon-diplomatie
> ou un déploiement de recette créé par le propriétaire) : R2 joué
> ; aucune commande vers la prod consulaire.

**Critères de done.** Contrat écrit ; PR ouverte côté consulat.ga ; R2 joué en dev.
**Vérification.** Tests des deux côtés ; `grep` : aucune donnée hors contrat ; journal des deux côtés.
**Couvre.** EXF-DG-03, 06 (boutons côté consulat.ga, posés dans la même PR : « Rejoindre DIASPORALE », « Activer IDN »), EXT-DG-03, 04.

---

### PROMPT PD4 — Fil, hub pays, profils et relations (lot D1)

**Objectif.** Le réseau vit : fil par pays et pour toute la diaspora, hub pays, profils avec
facette, relations, abonnements, suggestions, stories, albums — à partir des surfaces du
moteur, dans la charte DIASPORALE.

**Contexte.** `social-features` (PA6) expose les écrans dupliqués de l'espace agent :
`ReseauAgentPage` → `FeedPage` générique, `ProfilPersonnePage`, `PeoplePanel`, `GroupsPanel`,
`EvenementsPanel`, `StoriesTray`, `AlbumPage`, coquille mobile, cartes flottantes ; les URL
sont paramétrées par un adaptateur de routage et un `NetworkProvider`. La direction artistique
DIASPORALE (A7) est arrêtée.

> 0. Passe `frontend-design` : à partir de la décision A7, écris `DIASPORALE/docs/02_CHARTE_DIASPORALE.md`
>    (parti pris, palette en jetons, typographie, rayons, états, thème sombre, exemples) et
>    `packages/diasporale-features/src/styles/tokens.css` posé sur `[data-charte="diasporale"]`.
>    Aucune couleur littérale hors de ce fichier ; cliquet de charte du moteur étendu à l'app.
> 1. Routes : `/fil` (volets `?tab=` relations, groupes, pages, evenements, directs ; portées
>    « Mon pays » par défaut, « Toute la diaspora », « Récents », « Pour vous »), `/pays/[iso]`
>    (hub : `StatCounter` ×4 depuis `countryHubs`, fil local, évènements, associations,
>    entreprises, pages officielles, membres opt-in), `/@[handle]`, `/@[handle]/albums/[id]`,
>    `/actus`, `/parametres` (déjà), coquille mobile et bureau (bascule 960 px héritée).
>    `NetworkProvider` = `diasporale` ; aucune URL `/espace` ne subsiste (grep nul).
> 2. Composeur : audience, pays ou portée `diaspora`, case « Publier aussi sur ANTIA »
>    (seulement si audience publique) avec une ligne d'explication ; `CountryChip` et
>    `ScopeBadge` sur toute carte ; badges P1 (Officiel, Vérifié, Agent public, Communauté)
>    sur cartes et pages.
> 3. Profil : facette diaspora (pays, ville, poste si attesté, associations, année d'arrivée)
>    avec visibilités par champ ; `?apercu=1` ; onglets hérités.
> 4. Relations : connexions, abonnements, suggestions par pays, ville, association ; blocage ;
>    `CountrySwitch` (feuille de sélection, mémorisation locale puis facette).
> 5. Vocabulaire : « membres » et « communauté » remplacent « agents » et « administrations »
>    (liste fermée de remplacements dans `i18n/fr.json`) ; fuseau horaire = pays de résidence.
> 6. Tests : composants montés clés (fil, hub, composeur avec la case ANTIA, profil) ; test de
>    contrat « aucun `/espace` » ; test « un contenu `network` n'est jamais rendu avec
>    `networkId` ≠ diasporale » ; parité cochée pour chaque écran repris
>    (`docs/03_PARITE_SURFACES.md`).
> Critère de sortie : R4 joué (contexte séparé) avec l'application ANTIA de dev ou une query
> directe ; typecheck, tests, lint verts ; `web-design-guidelines` sans défaut bloquant ;
> vérification réelle dans Chrome à 320 px, 375 px et 1 280 px, thème sombre.

**Critères de done.** Fil, hub, profil, relations livrés ; charte en jetons ; parité cochée.
**Vérification.** Recette Chrome ; cliquets (charte, `/espace`, réseau borné, i18n).
**Couvre.** EXF-DG-07, 08, 10, 11, 12, 13, 14, 15, 16, 18, 19 ; EXT-DG-05, 06, 07.

---

### PROMPT PD5 — Pages officielles, associations, entreprises et import public (lot D1, deux dépôts)

**Objectif.** Les postes consulaires ont leur page « Officiel », les 129 associations existent
non revendiquées et se revendiquent, les entreprises se créent et se vérifient ; les objets
publics de consulat.ga sont importés une fois.

**Contexte.** Le moteur fournit `pages` avec `ownerKind`, `trust`, signataires et
`pageClaims` (PA3) ; les specs E06–E09 (associations : listing, fiche, revendication en trois
étapes, gestion) et C2/C3 (cartes). Côté consulat.ga : `associations` (10 types, `country`,
claims), `companies`, `communityEvents`, `posts`, `orgs` (postes, `jurisdictionCountries`).

> **Côté gabon-diplomatie** (branche `feat/diaspora-communaute-v1`, PR) :
> 1. Contrat `docs/contrats/DIASPORA-COMMUNAUTE-V1.md` et route `GET /api/partner/diaspora/export`
>    (clé de service, pagination par curseur, signature) qui ne sert **que** des objets publics
>    déjà visibles sans compte : postes (`slug`, nom, type, pays, pays de juridiction, logo
>    public), associations (`slug`, nom, type, pays, ville, description publique, logo ;
>    jamais les membres ni leurs e-mails), entreprises publiques, évènements publics à venir,
>    communiqués publiés (titre, corps, date, poste émetteur). Tests : aucun champ personnel
>    dans la sortie (test d'allowlist).
> **Côté moteur** :
> 2. `ANTIA/convex/modules/diaspora/import.ts` : action d'import idempotente par `importRef`
>    (`kind:slug`), qui crée les pages (postes → `ownerKind institution`, `trust official` ;
>    associations → `association`, `trust community`, `claimable: true` ; entreprises →
>    `company`), les évènements publics (organisateur = page), les communiqués (publications
>    de page, `reach` = pays du poste ou `diaspora` pour le ministère) ; journal
>    `communityImports` ; relance sans doublon.
> 3. Pages d'institution : signataires = personnes dont le lien d'identité IDN est confirmé
>    par le poste via une **procédure d'habilitation tracée** (l'administrateur du réseau
>    enregistre l'habilitation sur présentation d'un mandat du poste ; aucune lecture de
>    `memberships` consulaires) ; publication « Officiel » ; réponses « Officiel ».
> 4. Revendication d'association : flux en trois étapes (E08) avec preuves (statuts,
>    récépissé, mandat) déposées via l'admission de fichiers du moteur, instruction par le
>    modérateur pays (`pageClaims`), décision tracée, badge Vérifié, groupe d'adhérents créé
>    d'office, signataires nommés par l'association.
> 5. Pages d'entreprise : création par un membre vérifié, preuves (registre, mandat), fiche,
>    publications ; aucune vitrine premium (D4).
> 6. UI (`@diasporale/features`) : `AssociationCard`, `CompanyCard`, listings `/associations`,
>    `/entreprises`, fiches `/pages/[handle]` (hérité `ProfilPagePage` avec autorité générique),
>    bouton « Écrire » (messagerie, jamais de coordonnées), bouton « Revendiquer cette page ».
> 7. Tests : allowlist d'export ; idempotence d'import ; un membre ordinaire ne publie pas sur
>    une page Officiel ; revendication validée → badge et groupe ; refus indistinct.
> Critère de sortie : import joué en dev depuis le déploiement dev de gabon-diplomatie ; R5 et
> R6 joués ; PR gabon-diplomatie verte ; moteur et app verts.

**Critères de done.** Contrat et export ; import idempotent ; pages et revendication.
**Vérification.** Tests ; recette R5, R6 ; journal d'import.
**Couvre.** EXF-DG-20, 21, 22, 23, 26 (groupe d'association), 33 ; EXT-DG-03.

---

### PROMPT PD6 — Modération par pays, données, vitrine : clôture du lot D1 (lot D1)

**Objectif.** La France s'ouvre : équipe de modération France, signalements de tout type,
sanctions et recours, consentements, export et effacement, vitrine publique, textes légaux ;
recette complète du lot ; mise en ligne vérifiée.

**Contexte.** Le moteur fournit la modération V1 (PA5 : `reports` polymorphes, `sanctions`,
`appeals`, `moderationTeams`, limitation de débit, effacement RGPD). Les specs E16 (file de
modération) et P4 (états de modération visibles pour l'auteur).

> 1. `moderationTeams` : équipe `diasporale/FR` (rôles modérateur pays) et équipe réseau ;
>    écran `/moderation` (rôle) : file par pays (tous types de contenus), masquer, retirer,
>    avertir, sourdine temporaire, suspendre, exclure ; motifs ; recours ; pages à vérifier ;
>    évènements en relecture. `ModerationBanner` pour l'auteur (en relecture, publié, refusé).
>    Relecture par défaut pour les surfaces de contenu communautaire tant qu'un pays n'a pas
>    deux modérateurs actifs (paramètre de réseau).
> 2. Limitation de débit : vérifier que toute mutation d'écriture de l'app passe par les seaux
>    du moteur (publication, commentaire, réaction, connexion, abonnement, message, dépôt de
>    fichier) ; valeurs renforcées pour `declaree` sans badge ; test de contrat.
> 3. Données : `/parametres/donnees` (export, effacement avec délai et confirmation,
>    consentements, visibilité annuaire `hidden | country | network`) ; test R9 : après
>    effacement, aucune table sociale ni blob ne porte la personne.
> 4. Vitrine `/` : ce qu'est DIASPORALE, comment on entre, les pays ouverts, les compteurs
>    matérialisés (jamais un chiffre en dur), mentions légales et politique de confidentialité
>    (loi n° 001/2011 modifiée par la loi n° 025/2023, APDPVP, RGPD pour les résidents de l'UE,
>    responsable de traitement **à confirmer par le juriste** : marqueur `TODO JURISTE` visible
>    en recette, bloquant pour la mise en ligne) ; cliquet de communication publique (aucun
>    pourcentage, audit ou hébergement affirmé sans preuve).
> 5. Recette du lot D1 : parcours R1, R2, R3, R4, R5, R6, R8, R9, R10 joués en recette,
>    consignés dans `DIASPORALE/docs/04_RECETTE_D1.md` avec captures ; `web-design-guidelines`
>    sur toutes les routes ; accessibilité AA.
> 6. Mise en ligne (seulement si les textes légaux sont validés et la décision A10 rendue) :
>    déploiement du moteur en production (backend d'abord), puis de l'app ; domaine ; preuve
>    par révision servie et par un parcours R1 réel ; rapport. Sinon : mise en ligne de
>    recette seulement, et le dire.
> Critère de sortie : D1 recetté ; cliquets verts ; mise en ligne vérifiée ou explicitement
> différée avec la raison.

**Critères de done.** Modération France opérationnelle ; données conformes ; vitrine ; recette D1.
**Vérification.** `docs/04_RECETTE_D1.md` ; révision servie = commit livré.
**Couvre.** EXF-DG-40, 41, 42, 43, 44, 45, 46, 47 ; EXT-DG-03, 04, 08, 09.

---

### PROMPT PD7 — Évènements communautaires, groupes de conversation, iCom et direct (lot D2)

**Objectif.** La communauté se rencontre : évènements avec inscriptions, groupes de
conversation, messagerie et appels, directs d'évènements.

**Contexte.** Le moteur fournit `events` (agenda hérité), `groupThreads` et messagerie
(PA3), `calls` LiveKit (PA3, après l'audit iAppel demandé par ANTIA PA1), `live` (direct
hérité). Specs F03, F08, F13 ; écrans E03–E05, E14, E24.

> 1. Évènements communautaires : extension `eventRegistrations` (capacité, date limite, liste
>    d'attente, inscription, QR de présence, galerie), `organizerKind ∈ {person, association,
>    institution}` ; création par une page vérifiée ou un membre vérifié ; relecture au
>    lancement ; rappel J-1 (cron du moteur) ; iCal hérité ; `EventCard` compacte et large,
>    états « Complet » et « Passé » ; listing `/evenements` filtrable (pays, catégorie, date).
> 2. Groupes de conversation (hérités) : création réservée aux `declaree` et `verifiee` ;
>    groupe d'office par association revendiquée ; pièces jointes, vocaux, réactions, liens
>    d'invitation et QR ; « écrit… » ; recherche.
> 3. iCom : dock ancré sur le bureau et carte détachée au format décidé (A6), pages pleines
>    sous 960 px ; messagerie 1:1 entre relations (le fil naît au premier envoi) ; présence
>    des relations ; appels 1:1 et de groupe (≤ 11) ; sonnerie et push ; **aucun** élément
>    iCom Pro (canaux institutionnels, horaires, secrétariat).
> 4. Direct : une page officielle ou une association vérifiée diffuse un évènement (antenne,
>    spectateurs, chat, rediffusion 90 jours, consentement à l'enregistrement).
> 5. Tests : capacité et liste d'attente ; un membre `en_attente` ne rejoint pas un groupe ;
>    un direct n'est créable que par une page habilitée ; parité des écrans repris.
> Critère de sortie : R7 joué ; recette des appels à trois sur deux navigateurs et un mobile ;
> suite verte.

**Critères de done.** Évènements complets ; groupes ; iCom ; direct.
**Vérification.** Recette R7 ; appels réels en dev (LiveKit du programme) ; tests.
**Couvre.** EXF-DG-24, 25, 27, 28, 29, 30, 31, 32, 33.

---

### PROMPT PD8 — Emploi, talents, annonces, entraide, notifications et iAsted (lot D2)

**Objectif.** Les trois usages des groupes Facebook, en mieux : emploi, logement et vente,
entraide ; et la rétention par les notifications.

**Contexte.** Fiches F06, F07, F09, F12, F14, F15 ; écrans E17–E26 ; cartes C4, C5, C6, C9.
Le moteur fournit push (PA5), préférences, iAsted (si PA7 l'a porté ; sinon ce point attend).

> 1. Tranche `diaspora` : `jobPostings` (titre, description, `companyPageId?` ou membre
>    vérifié, pays, ville, secteur, contrat, télétravail, fourchette, statut, expiration),
>    `jobApplications` (offre, personne, instantané du profil professionnel, message, statut),
>    `jobAlerts` ; `classifieds` (catégorie logement / biens / services / colis, prix, ville,
>    photos, statut) ; `mentorships` ; `profileProfessional` dans la facette (métier,
>    compétences, langues, `isPublic`, `recruitersOnly`). Crons d'expiration. Gardes :
>    publier une offre = vérifié ou page d'entreprise vérifiée ; logement = vérifiés ;
>    relecture au lancement ; limitation de débit ; contact par messagerie uniquement.
> 2. Talents : recherche bornée (pays, métier, compétences, langues) sur les seuls profils
>    `isPublic` ; champs choisis ; pagination stricte ; pas d'export ; écran de consentement
>    E18 au passage en public.
> 3. UI : `/emploi` (+ détail, candidature en un geste, espace recruteur « mes offres,
>    candidatures »), `/talents`, `/annonces` (+ publication, guide anti-arnaque), `/entraide`
>    (mentors disponibles, kit d'arrivée par pays, badge Mentor) ; cartes C4 C5 C6 C9.
> 4. Notifications : push pour mentions, réponses, invitations, évènements de mon pays,
>    offres croisant mes compétences ; préférence « Vie communautaire » ; plafond
>    hebdomadaire ; digest mensuel par pays (e-mail charté, Resend du moteur) ; deep links.
> 5. iAsted concierge (option, si le moteur l'a) : outils `find_events`, `find_associations`,
>    `find_companies`, `find_jobs` bornés au réseau courant ; actions confirmées
>    `register_to_event`, `create_classified_draft` ; aucune donnée hors réseau.
> 6. Tests : gardes de publication ; allowlist des champs talents ; anti-extraction ;
>    expiration ; plafond de push ; parité des écrans.
> Critère de sortie : KPI emploi et annonces mesurés sur PostHog en dev ; suite verte ;
> accessibilité des nouveaux écrans vérifiée.

**Critères de done.** Quatre modules V2 livrés ; push et digest ; option iAsted.
**Vérification.** Tests ; recette d'une offre, d'une candidature, d'une annonce ; PostHog.
**Couvre.** EXF-DG-09, 17 (carte de la diaspora : compteurs et SVG), 34, 35, 36, 37, 38, 39, 48.

---

### PROMPT PD9 — Application mobile Expo (lot D3)

**Objectif.** DIASPORALE dans la poche : fil, hub, évènements, messagerie, appels, stories,
push.

**Contexte.** La diaspora est mobile ; consulat.ga a `citizen-mobile` (Expo 57, Expo Router,
`mobile-ui-v2`) et la maquette « Accueil — Feed Communauté » (pager horizontal, header
stable). Le moteur expose la même API ; Better Auth `bearer` pour le mobile.

> 1. `DIASPORALE/apps/diasporale_mobile` (Expo, Expo Router, React Native, `@antia/api` en mode
>    bearer, i18n partagé) ; design system mobile : jetons DIASPORALE, composants `FlatCard`,
>    `Badge`, `Avatar`, `Chip`, `Sheet` (reprise des patrons de `mobile-ui-v2`, pas de copie de
>    code consulaire).
> 2. Écrans : accueil paginé (fil pays ↔ toute la diaspora), hub pays, article et commentaires,
>    profil, évènements et inscription avec QR, messagerie et appels (LiveKit RN), stories,
>    notifications ; onboarding IDN (navigateur système) et compte léger.
> 3. Push Expo/FCM/APNs branchés sur le moteur ; deep links ; tutoriel premier lancement.
> 4. Tests : composants purs ; parcours R1–R8 joués sur un appareil (iOS et Android) ; crash
>    reporting.
> Critère de sortie : builds EAS de recette ; parité R1–R8 ; publication sur les stores par le
> propriétaire (comptes), le prompt prépare les fiches.

**Critères de done.** Application de recette ; parité ; fiches store préparées.
**Vérification.** Appareils réels ; crash-free.
**Couvre.** EXT-DG-07 ; EXF-DG-38, 39 (push natif).

---

### PROMPT PD10 — Rapport de parité, préparation au lancement et passation (chaque fin de lot, puis final)

**Objectif.** Prouver, pas supposer.

> 1. `DIASPORALE/docs/05_RAPPORT_PARITE_ET_LANCEMENT.md` : par module dupliqué, la liste de
>    parité source ↔ cible cochée (fonctionnalités, tests, gardes) ; les adaptations (liste
>    fermée, règle 3) ; les conservations ; les écarts assumés ; les TODO.
> 2. Vérifications globales : `bun run verify` du moteur et de l'app ; cliquets (réseau
>    borné, aucun import inter-produit, aucune couleur en dur, aucune chaîne hors i18n, aucun
>    `.collect()` non borné, aucun `v.any()`, communication publique) ; `grep` de toute
>    donnée consulaire interdite dans le moteur (passport, nip, birth, child) ; revue
>    d'autorisation (`convex-authz`) ; audit de préparation (`convex-launch-readiness`).
> 3. Mise à jour de `docs/00` (encart d'état, décisions rendues), de `README.md` et de
>    `CLAUDE.md` du dépôt ; mémoire du programme (vault : fiche, contexte actif, décisions).
> 4. Passation : ce qui est en ligne, ce qui ne l'est pas, les clés et comptes qui restent au
>    propriétaire, les risques ouverts.
> Critère de sortie : rapport complet ; aucune publication sans vérification après coup.

**Couvre.** EXT-DG-09 et la Definition of Done du cahier §17.

## 5. Traçabilité des exigences

| Exigence | Prompts | Exigence | Prompts |
|---|---|---|---|
| EXF-DG-01, 02 | PD2 | EXF-DG-24, 25, 26 | PD5 (26), PD7 |
| EXF-DG-03 | PD3 | EXF-DG-27, 28, 29 | PD7 |
| EXF-DG-04 | PD1, PD2 | EXF-DG-30, 31, 32, 33 | PD5 (33), PD7 |
| EXF-DG-05, 06 | PD2, PD3 | EXF-DG-34, 35, 36, 37 | PD8 |
| EXF-DG-07, 08 | PD1, PD4 | EXF-DG-38, 39 | PD8, PD9 |
| EXF-DG-09 | PD8 | EXF-DG-40, 41, 42, 43 | PD6 |
| EXF-DG-10 à 14 | PD4 | EXF-DG-44, 45, 46, 47 | PD2, PD6 |
| EXF-DG-15, 16, 17 | PD1, PD4, PD8 (17) | EXF-DG-48 | PD8 |
| EXF-DG-18, 19 | PD4 | EXT-DG-01 | PD0 |
| EXF-DG-20 à 23 | PD5 | EXT-DG-02 à 10 | PD1, PD3, PD4, PD6, PD9, PD10 |

## 6. Critères d'acceptation du plan

- [ ] Le moteur n'a jamais lu la base consulaire ; aucune donnée hors des deux contrats n'a
      transité ; les deux PR côté gabon-diplomatie sont relues par le développeur qui publie la
      prod et par le propriétaire.
- [ ] Chaque module dupliqué porte sa provenance, ses tests et sa parité cochée.
- [ ] Les parcours R1 à R10 sont joués et consignés ; R4 et R10 (contexte séparé, fuite
      interdite) sont des tests automatisés.
- [ ] La France est ouverte avec deux associations relais et un modérateur actif avant toute
      annonce ; aucun chiffre public n'est affirmé sans mesure.
- [ ] Les textes légaux sont validés par un juriste ; le dossier APDPVP est déposé ; le
      registre des consentements est alimenté.
- [ ] `bun run verify` vert dans ANTIA (moteur + DIASPORALE) ; mise en ligne vérifiée après coup
      et rapportée ; mémoire du programme mise à jour.
