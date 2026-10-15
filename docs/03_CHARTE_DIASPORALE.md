---
title: "DIASPORALE.COM — Charte graphique « Sable de la diaspora »"
version: "2.0"
date: "2026-10-15"
statut: "Charte de travail v2 — arbitrage A7 (famille Consulaire / Sable) ; refonte demandée par le propriétaire le 15/10/2026 : épurée, contraste renforcé, sombre inversé, rayons resserrés, sans drapeau, avis en cartes flottantes"
projet: "DIASPORALE"
jetons: "ANTIA/packages/ui/src/themes/diasporale.css (contrat) + packages/diasporale-features/src/styles/extras.css (rôles propres) — [data-charte=\"diasporale\"]"
---

# DIASPORALE.COM — Charte « Sable de la diaspora »

> **Décision.** Arbitrage A7 du cahier (`docs/00` §20) pris par défaut : **famille
> Consulaire / Sable**, posée sur le **squelette de l'espace agent** (grille du fil, rail,
> onglets chemise, composeur en feuille, coquille mobile). Variante retenue dans la
> famille : **Sable**, la version chaude. Les inscrits de consulat.ga y retrouvent leur
> fond, leur bleu et leur rayon. DIASPORALE y ajoute trois choses qui lui sont propres :
> l'étiquette pays, le tampon « Officiel » et la superfamille IBM Plex en trois largeurs.
>
> Passe `frontend-design` faite le 14/10/2026. La couche de jetons couvre le contrat de
> thème du moteur ANTIA : échelles ui-v2, noms sémantiques shadcn, rôles `--esp-*` de
> l'espace personnel. Les composants dupliqués du socle s'y branchent **sans fork**
> (règle de duplication n° 7).
>
> **Version 2 (15/10/2026, demande du propriétaire).** Plus épurée : aucun filet autour des
> cartes, aucun liseré, presque pas d'ombre. Contraste renforcé (grès 6,46:1 sur le sable,
> texte 17,19:1 sur la carte sombre). Le sombre **retourne la page** : la carte est l'encre,
> plus profonde que le fond. Boutons et cartes moins arrondis (6 et 8 px) ; pilules et
> interrupteur inchangés. Plus aucune référence au drapeau. Les bandeaux deviennent des
> **cartes flottantes** qu'on écarte d'une croix. Vitrine vivante : `/charte`, contrastes
> mesurés en direct.

## 1. Le sujet, et la seule tâche de l'identité

- **Sujet** : le lieu de rencontre des Gabonais de l'étranger. Une population mobile,
  majoritairement sur téléphone. Elle vit entre deux pays et passe souvent par les
  aéroports, les colis et les groupes de messagerie.
- **Tâche de l'identité** : rendre lisibles d'un coup d'œil, partout, les deux
  informations dont dépend la confiance :
  1. **où** l'on est : le pays, contexte permanent (cahier §5, invariant 7) ;
  2. **qui** parle : Officiel, Vérifié, Agent public ou Communauté, jamais confondus
     (invariant 8).
- **Registre** : institutionnel mais habité. « L'interface cesse d'être un guichet et
  devient un espace où l'on reste » : c'est la raison d'être de Sable, et celle de
  DIASPORALE.

## 2. Palette

Six couleurs nommées portent toute l'interface. Le reste dérive de rampes régulières.

| Nom | Hex | Rôle |
|---|---|---|
| **Sable** | `#F7F6F2` | fond de page : le sable de consulat.ga, signature de la famille |
| **Papier** | `#FFFFFF` | cartes posées sur le sable |
| **Encre** | `#14130F` | texte ; fond du tampon « Officiel » (brun-noir chaud, jamais noir pur) |
| **Bleu Gabon** | `#0072B9` | action, lien, sélection, focus : palier 600 de la rampe H 246,6 |
| **Grès** | `#5C5952` | texte secondaire, icônes au repos (assombri en v2 : 6,46:1 sur le sable) |
| **Nuit** | `#201D18` | fond du thème sombre ; la carte y est l'**Encre** `#14130F`, plus profonde (jamais de noir pur) |

**Rampe Bleu Gabon** (identique à Consulaire et Sable, `#0072B9` épinglé au palier 600) :
`50 #EEF7FF · 100 #D7ECFF · 200 #B4DBFF · 300 #7EC2FF · 400 #449FE9 · 500 #2786CF ·
600 #0072B9 · 700 #005D98 · 800 #004C7D · 900 #003458 · 950 #001D35`.

**Neutres chauds (sable)** : `50 #FBFAF6 · 100 #F7F6F2 · 150 #F3EFE4 · 200 #EFEBE0 ·
300 #E6E2D8 · 400 #D2CDBF`. **Grès** : `#918E89` (contour de champ, 3,26:1) ·
`#6B675D` (texte discret, 5,22:1 sur sable) · `#5C5952` (texte secondaire, 6,46:1) · `#3A3833`.

**Le sombre retourne la page (v2).** En clair, la carte est plus claire que le fond (papier sur
sable) ; en sombre, elle est plus profonde (encre sur nuit). Dans les deux thèmes, le contenu
se pose sur la surface la plus contrastée. Échelle sombre : carte `#14130F` < fond `#201D18` <
section, puce et carte flottante `#2A2620` < survol `#322E27` ; texte sable `#F7F6F2`, grès
clair `#B0AA99` (8,02:1 sur la carte), discret `#948E7E`.

**Statuts.** Le cahier prévoit quatre accents réservés aux statuts. Chaque statut a une
paire texte / teinte mesurée :

| Statut | Texte | Plein | Teinte | Sens |
|---|---|---|---|---|
| succès / vérifié | `#0F5F2F` | `#157A3D` | `#E3F1E8` | vérifié, publié, inscrit |
| alerte / en attente | `#8A5E00` | `#A16E00` | `#FAEDCA` | en relecture, en attente de parrainage |
| danger / refus | `#B3261E` | `#B3261E` | `#FDECEA` | refusé, signalé, erreur |
| information | `#004C7D` | `#0072B9` | `#EEF7FF` | consignes, aides |

**Aucune référence au drapeau (v2).** Le filet tricolore de la vitrine et les trois couleurs
du drapeau sont retirés de la charte, des jetons et des écrans (décision du propriétaire du
15/10/2026). Le cliquet de couleurs n'admet plus aucune exception.

## 3. Typographie — la superfamille IBM Plex en trois largeurs

La famille Sable porte IBM Plex Sans : c'est la police que les inscrits de consulat.ga
lisent aujourd'hui (`packages/ui/src/styles/foundations.css` de gabon-diplomatie).
DIASPORALE garde le corps et lui ajoute deux largeurs de la même superfamille. Le
caractère vient ainsi de la largeur, pas d'une police étrangère.

| Rôle | Police | Graisses | Usage |
|---|---|---|---|
| **Display** | IBM Plex Sans Condensed | 600, 700 | titre de hub, titre de vitrine, en-têtes de section, avec retenue : un titre par écran au plus |
| **Corps / UI** | IBM Plex Sans | 400, 500, 600 | tout le reste ; corps à **15 px** (grand public, comme Sable), interligne 1,55 |
| **Codes** | IBM Plex Mono | 500, 600 | codes pays ISO, compteurs, quotas (« 3/10 »), horodatages d'étiquette |

Échelle : display 40/32 (`clamp`) · h1 24 · h2 20 · h3 17 · corps 15 · légende 13 ·
étiquette 11 (mono, capitales, interlettrage +0,06 em). Depuis la v2, la règle « un titre en
Condensed par écran » est tenue par le code : la base du moteur met tous les titres en
display, la couche DIASPORALE ramène `h2`–`h6` à Plex Sans 600 ; un titre qui doit rester en
display le demande (`font-display`). Le corps ne descend jamais sous
13 px ; aucune information n'est portée par une taille inférieure à 11 px.

Les polices sont auto-hébergées au build (`next/font`), sans requête externe à
l'exécution. Variables : `--dg-font-sans`, `--dg-font-display`, `--dg-font-mono`, et les
noms du contrat (`--font-sans`, `--font-display`, `--font-mono`) qui y renvoient.

## 4. Géométrie et relief

- **Rayons resserrés (v2)** : `xs 4 · sm 4 · md 6 · lg 6 · xl 8 · 2xl 12 · 3xl 16 · 4xl 20`.
  4 px pour les badges et l'étiquette, 6 px pour les contrôles (bouton, champ, option), 8 px
  pour les cartes et les cartes flottantes, 12 px pour les panneaux et les feuilles. Les
  pilules (onglets, filtres, sélecteurs de langue et de thème) et l'interrupteur restent en
  pilule (`--esp-r-chrome: 999px`), sans changement.
- **Relief : presque rien (v2)**. Aucun filet autour d'une carte, aucun liseré, aucun contour
  épais. Une carte se détache par la clarté (papier sur sable, encre sur nuit) et un souffle
  d'ombre teinté d'encre (`0 1px 2px` à 5 %). Ce qui passe DEVANT la page (carte flottante,
  barre basse) prend un souffle de plus (`0 4px 14px -4px` à 8 %). Les seuls traits restants
  sont fonctionnels : contour de champ (3:1, WCAG 1.4.11) et filets de séparation internes.
- **Thème sombre** : la carte est la surface la plus profonde ; ce qui flotte remonte vers la
  clarté (voir §2).

## 5. La signature : l'étiquette pays

Le pays est le contexte permanent du réseau. DIASPORALE lui donne une forme qu'aucune
autre application du programme n'a : **l'étiquette**, celle qu'on accroche à une
valise.

```text
  ◖• FR  Lyon ▏        étiquette compacte : œillet, code ISO en mono, ville
  ◖• ⊕  Toute la diaspora ▏   portée diaspora (icône globe, jamais un drapeau)
```

- **Forme** : bord gauche taillé en pointe douce, œillet de 6 px percé dans la couleur du
  fond, code ISO en IBM Plex Mono 600 en capitales, ville en Plex Sans 500.
- **Partout où un contenu a un pays** (spec P2 : carte, page, évènement, annonce) :
  `CountryTag` pour un pays, `ScopeTag` pour la portée diaspora, pastille d'origine pour
  un contenu diaspora venu d'un autre pays (EXF-DG-16).
- **En grand, une fois par écran, dans l'en-tête du hub** : le code ISO devient
  monumental (« FR », Plex Mono 600, 96 px sur bureau, 64 px sur téléphone), à côté du
  titre « La communauté de France » en Plex Condensed. C'est **le risque esthétique
  assumé** de la charte.
  - *Pourquoi le code plutôt que le drapeau ou le nom* : le code est ce que le système
    stocke ; il se lit pareil en français et en anglais ; et une diaspora qui vit entre
    deux aéroports le reconnaît avant le nom, comme sur une carte d'embarquement.
  - *Ce qu'on refuse* : un drapeau emoji géant, une carte du monde en fond, un dégradé.
- Le nom du pays n'est jamais écrit en dur : il est calculé par `Intl.DisplayNames` dans
  la langue de la personne.

## 6. La confiance, toujours visible (P1)

| Badge | Traitement | Icône (lucide) | Règle |
|---|---|---|---|
| **Officiel** | **tampon d'encre** : fond `Encre`, texte `Sable`, capitales mono 11 px | `Landmark` | inversé en sombre (fond sable, texte encre) ; jamais imitable par une teinte de statut |
| **Vérifié** | pastille vert succès, texte `#0F5F2F` sur teinte `#E3F1E8` | `BadgeCheck` | calculé côté serveur (IDN `loa ≥ 2` ou attestation) |
| **Agent public** | pastille bleu, texte `#004C7D` sur `#EEF7FF` | `IdCard` | lien `administration` vivant |
| **Communauté** | puce sable `#EFEBE0`, texte Grès | `Users` | l'absence des autres, jamais un rang |
| **Sponsorisé** (D4) | puce sable, libellé toujours présent | `Megaphone` | un seul emplacement par écran ; jamais dans la messagerie |

**Écart assumé à la spec P1.** La spec donne à « Officiel » une puce grise (S2). La charte
en fait un **tampon d'encre inversé**, pour tenir la règle de la spec elle-même : un
contenu institutionnel ne doit jamais pouvoir être confondu avec un contenu
communautaire. Le gris S2 est trop proche de la puce « Communauté ».

## 7. États de modération (P4) et états vides (P5)

- **Cartes flottantes (v2)** — la forme unique des avis (`FloatingNotice`) : une carte posée
  devant la page, sans contour ni liseré, le ton porté par la seule pastille d'icône, le titre
  en encre, une **croix** (cible de 44 px) pour l'écarter. Les avis de page (démonstration,
  statut d'adhésion) passent dans la pile flottante de l'application (sonner : en bas à
  droite au bureau, pleine largeur au-dessus de la barre basse au téléphone). Une carte
  écartée le reste (stockage du navigateur : la session pour la démonstration, durablement
  pour un statut, jusqu'au prochain changement). Seuls un marqueur bloquant (« TODO
  JURISTE ») et un code à recopier n'ont pas de croix.
- **Avis de modération** pour l'auteur seulement, en carte flottante en tête de la carte :
  - *En relecture* : ambre, `Clock` ;
  - *Publié* : vert, `CircleCheck` ;
  - *Refusé* : rose, `CircleAlert`, avec le motif.

  Les autres membres ne voient jamais un contenu non publié.
- **États vides génératifs** : une phrase qui dit ce qui manque, puis l'action qui le
  comble (« Aucun évènement en Belgique pour l'instant. Proposez le premier. »). Jamais
  un écran muet, jamais un compteur à zéro en vitrine : un hub sans contenu dit
  « bientôt » (`hubs.ts`).
- **Mode démonstration** : tant que le fournisseur factice est actif, une carte flottante
  l'explique (« Démonstration : toutes les données sont fictives »), et un **repère
  permanent « Démo »** reste dans l'en-tête, même la carte écartée (un clic la rouvre). Aucune
  capture ne peut faire passer une donnée de démonstration pour réelle.

## 8. Le squelette, hérité de l'espace agent

Le squelette se duplique avec le code (cahier §15). Seuls les jetons changent.

- **Bureau (≥ 960 px)** : rail de navigation à gauche ; colonne du fil de 680 à 792 px ;
  rail droit de 312 px (iCom, suggestions, pages, évènements). La grille passe à deux
  colonnes dès 1 008 px de conteneur (`@container`).
- **Onglets chemise** : les volets et les portées du fil (« Mon pays », « Toute la
  diaspora », « Récents », « Pour vous ») sont des onglets à languette sur une piste en
  pilule. L'onglet actif est en papier, les autres en sable.
- **Composeur en feuille** : la création s'ouvre en feuille (bas d'écran au téléphone,
  centrée au bureau). La portée (étiquette pays ou diaspora) et la case « Publier aussi
  sur ANTIA » y sont visibles avant l'envoi.
- **Téléphone (< 960 px)** :
  - en-tête collant (mot-symbole, sélecteur de pays, cloche, avatar) ;
  - barre basse flottante en pilule, sable translucide en clair, opaque en sombre :
    Fil · Pays · Créer · Messages · Menu ;
  - feuille Menu.
- **Format téléphone unique** (A6) : 440 × 956, plancher 375. Il sert à la carte iCom
  détachée et aux cartes flottantes.
- **Mot-symbole** : « DIASPORALE » en Plex Condensed 700, interlettrage +0,04 em.
  L'œillet de l'étiquette sert de point d'ancrage à gauche. Aucun logo ne reprend les
  armoiries ou le drapeau.

## 9. Mouvement

Le mouvement est sobre et sert la compréhension :
- entrée des cartes : 160 ms `cubic-bezier(0.16, 1, 0.3, 1)`, translation de 4 px et
  opacité, en cascade de 30 ms dans le hub ;
- feuilles : 220 ms, même courbe.

Pas d'animation sur une action au clavier. `prefers-reduced-motion` coupe tout.

## 10. Accessibilité — paires mesurées (WCAG 2.1)

Valeurs de la v2 (15/10/2026). Elles sont aussi **mesurées en direct** sur `/charte`, dans le
thème affiché.

| Paire | Ratio | | Paire (sombre) | Ratio |
|---|---|---|---|---|
| Encre / Sable | 17,19 | | texte sable / fond nuit `#201D18` | 15,53 |
| Encre / Papier | 18,59 | | texte sable / carte encre `#14130F` | 17,19 |
| Grès `#5C5952` / Sable | 6,46 | | grès clair `#B0AA99` / carte | 8,02 |
| Grès / Papier | 6,99 | | grès clair / fond | 7,24 |
| Bleu Gabon / Papier (lien) | 5,11 | | bleu `#449FE9` / carte (lien) | 6,53 |
| Bleu Gabon / Sable (lien) | 4,73 | | encre `#14130F` / bleu `#449FE9` (bouton) | 6,53 |
| blanc / Bleu Gabon (bouton) | 5,11 | | vert `#4CBB75` / carte | 7,68 |
| vert `#0F5F2F` / teinte `#E3F1E8` | 6,68 | | ambre `#D8A53C` / carte | 8,29 |
| ambre `#8A5E00` / teinte `#FAEDCA` | 4,90 | | rose `#E58079` / carte | 6,81 |
| rose `#B3261E` / teinte `#FDECEA` | 5,72 | | contour de champ `#7D7666` / carte | 4,12 |
| contour de champ `#918E89` / Papier | 3,26 | | texte discret `#948E7E` / carte | 5,69 |
| texte discret `#6B675D` / Sable | 5,22 | | grès clair / carte flottante `#2A2620` | 6,48 |
| tampon Sable / Encre | 17,19 | | | |

Règles non chromatiques :
- focus toujours visible : anneau de 3 px `--shadow-focus` ;
- cibles de 44 px au minimum ;
- une information n'est jamais portée par la seule couleur : chaque badge a son icône et
  son libellé ;
- les titres se suivent sans saut de niveau ;
- tout tient sans défilement horizontal à 320 px.

Le cliquet `tokens-contrast.test.ts` (paquet `@diasporale/features`) recalcule ces
paires depuis le fichier de jetons, dans les deux thèmes.

## 11. Mise en œuvre (depuis PD0, sur le moteur ANTIA)

La charte vit en trois couches, importées dans cet ordre par
`apps/diasporale_com/src/app/globals.css`, après `@import "tailwindcss"` :

1. **Charte de base du moteur** — `@antia/ui/styles.css` : déclare TOUS les jetons du contrat
   sur `[data-charte]` (échelles ui-v2, noms sémantiques shadcn, primitives et rôles `--esp-*`),
   relie les utilitaires Tailwind et pose la base (corps, titres, barres de défilement).
2. **Thème DIASPORALE** — `ANTIA/packages/ui/src/themes/diasporale.css` (écrit par la session
   DIASPORALE) : réaccorde les primitives du contrat à la palette Sable (bleu Gabon `#0072B9` au
   barreau 500, sable, grès, encre, nuit brune, tons, avatars) et redéclare tous les rôles, en
   clair comme en sombre. Il ne déclare QUE des jetons du contrat (cliquet `theme-contract` du
   moteur) et c'est le SEUL endroit où vivent les couleurs de DIASPORALE.
3. **Rôles propres** — `packages/diasporale-features/src/styles/extras.css` : étiquette pays,
   badges, bandeaux de modération et de démonstration, bouton destructif, voile, mouvement.
   Chaque rôle RENVOIE à un jeton du contrat ; aucune couleur n'y est littérale (v2). Puis
   `tailwind-theme.css` : les utilitaires de ces rôles (`bg-tag`, `text-official-foreground`…),
   les reliefs nommés, trois écarts de base bornés au nœud DIASPORALE (un lien d'interface hérite
   sa couleur ; anneau de focus de la charte ; sous-titres `h2`–`h6` en Plex Sans 600).

- **Pose** : `data-charte="diasporale"` sur `<html>`, où `next-themes` pose aussi la classe
  `dark`. Les portails (feuilles, menus, toasts) héritent donc de la charte.
- **Cascade sombre** : le bloc sombre de la base (`.dark[data-charte]`, spécificité 0,2,0)
  l'emporte sur le bloc clair du thème (0,1,0). Le thème redéclare donc en sombre CHAQUE rôle du
  bloc sombre de la base, sinon le bleu du moteur reparaîtrait.
- **Cartes flottantes** : la primitive `FloatingNotice` (`@diasporale/features`) ; la pile
  flottante et la mémoire des cartes écartées dans `apps/diasporale_com/src/components/floating-cards.tsx`
  (sonner, `useFloatingCard`, `useDismissal`).
- **Cliquets** : `engine-theme-contrast.test.ts` rejoue la cascade base, thème, rôles propres
  dans les deux thèmes (texte ≥ 4,5:1, contours et focus ≥ 3:1, titre de bannière sur les deux
  arrêts du dégradé), vérifie l'inversion du sombre (carte plus profonde que le fond, carte
  flottante plus claire), les rayons de la v2 et l'absence de toute couleur du drapeau ;
  `theme-contract` et `no-hardcoded-colors` côté moteur ; le cliquet de couleurs de
  l'application n'admet plus aucune couleur littérale.

## 12. Interdits

| Interdit | À la place |
|---|---|
| Une couleur littérale hors du fichier de jetons (hex, `rgb()`, classe Tailwind brute `bg-blue-500`) | un rôle (`bg-card`, `text-muted-foreground`, `var(--dg-tag-bg)`) |
| Toute référence au drapeau (filet tricolore, couleurs du drapeau) | rien : la v2 l'a retirée |
| Un contour épais, un liseré coloré, une ombre large | une carte sans filet, un souffle d'ombre |
| Un bandeau à plat pour un avis | une carte flottante, avec sa croix |
| Noir pur ou blanc pur en thème sombre | nuit, encre et texte sable `#F7F6F2` |
| Blanc sur le bouton primaire en sombre | encre `#14130F` sur `#449FE9` (6,53) |
| Un drapeau emoji comme seul indicateur de pays | l'étiquette : code ISO + nom calculé |
| Un chiffre en vitrine qui n'est pas un compteur matérialisé | « bientôt », ou rien |
| Une coordonnée (e-mail, téléphone) sur une surface | le bouton « Écrire » (messagerie) |
| Plus d'un titre en Plex Condensed par écran | Plex Sans 600 pour les sous-titres |

## 13. Écarts assumés

1. **Variante Sable plutôt que Consulaire blanc.** Le réseau est un lieu où l'on reste, pas
   un guichet. La variante Sable est celle que les inscrits connaissent déjà sur
   consulat.ga.
2. **IBM Plex en trois largeurs** plutôt qu'Inter et Plus Jakarta Sans (typographie de la
   variante Consulaire citée au cahier §15). Sable et consulat.ga sont en Plex : la
   continuité réelle des inscrits passe par Plex.
3. **Tampon « Officiel » inversé** plutôt que la puce S2 de la spec P1 (voir §6).
4. **Ambre de texte `#8A5E00`** plutôt que `#A16E00` ou `#986800` : ce sont les seules
   valeurs qui tiennent 4,5:1 sur la teinte d'alerte comme sur le sable.
5. **Le bleu Gabon `#0072B9`** (cahier §15) plutôt que le `#0B4F9C` de l'espace agent et
   de consulat.ga. Le bleu profond reste celui de l'administration ; DIASPORALE prend le
   bleu de la famille Consulaire, plus clair et plus chaleureux sur le sable.
6. **Trois teintes d'avatar assombries.** Le socle affirme que le blanc tient sur ses six
   teintes ; mesuré sous des initiales de 13 px, trois échouent : `#0E8A4D` (4,41:1),
   `#DF7F0A` (2,93:1) et `#1D8B96` (4,05:1). Elles sont assombries dans la même teinte —
   `#0C7A44`, `#A35A09`, `#167580` — et tiennent toutes au moins 5,07:1. L'ordre des six
   teintes est conservé : une personne garde sa couleur d'un réseau à l'autre.
7. **Texte discret `#736E61`** plutôt que `#767164` : la première valeur, annoncée à
   4,50:1 sur le sable, mesurait en réalité 4,499:1. Le cliquet de contraste l'a refusée
   le 14 octobre 2026 ; la nouvelle valeur tient 4,70:1 sur le sable et 5,08:1 sur le papier.

8. **Sombre inversé (v2)** : la carte est plus profonde que le fond, à rebours de l'élévation
   « par la clarté » de la v1 et du socle. Demande du propriétaire : en clair comme en sombre, le
   contenu se pose sur la surface la plus contrastée. Ce qui flotte (carte flottante, menu)
   remonte vers la clarté.
9. **Démonstration fermable (v2)** : la carte de démonstration a une croix, à rebours du bandeau
   permanent de la v1 ; l'invariant est tenu par le repère « Démo » permanent de l'en-tête.
10. **Texte secondaire assombri (v2)** : `#5C5952` plutôt que `#66635D` (6,46:1 au lieu de
    5,54:1 sur le sable), texte discret `#6B675D` (5,22:1) ; en sombre, grès clair `#B0AA99`.

*Fin de la charte DIASPORALE — version 2.0 du 15 octobre 2026.*
