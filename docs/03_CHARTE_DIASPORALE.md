---
title: "DIASPORALE.COM — Charte graphique « Sable de la diaspora »"
version: "1.0"
date: "2026-10-14"
statut: "Charte de travail — arbitrage A7 pris par défaut (famille Consulaire / Sable), à confirmer par le propriétaire"
projet: "DIASPORALE"
jetons: "packages/diasporale-features/src/styles/tokens.css — [data-charte=\"diasporale\"]"
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
| **Grès** | `#66635D` | texte secondaire, icônes au repos |
| **Nuit brune** | `#14130F` → `#201D18` | fond et cartes du thème sombre (jamais de noir pur) |

**Rampe Bleu Gabon** (identique à Consulaire et Sable, `#0072B9` épinglé au palier 600) :
`50 #EEF7FF · 100 #D7ECFF · 200 #B4DBFF · 300 #7EC2FF · 400 #449FE9 · 500 #2786CF ·
600 #0072B9 · 700 #005D98 · 800 #004C7D · 900 #003458 · 950 #001D35`.

**Neutres chauds (sable)** : `50 #FBFAF6 · 100 #F7F6F2 · 150 #F3EFE4 · 200 #EFEBE0 ·
300 #E6E2D8 · 400 #D2CDBF`. **Grès** : `500 #918E89` (contour de champ) ·
`600 #736E61` (texte discret, 4,70:1 sur sable) · `700 #66635D` (texte secondaire) · `800 #3A3833`.

**Statuts.** Le cahier prévoit quatre accents réservés aux statuts. Chaque statut a une
paire texte / teinte mesurée :

| Statut | Texte | Plein | Teinte | Sens |
|---|---|---|---|---|
| succès / vérifié | `#0F5F2F` | `#157A3D` | `#E3F1E8` | vérifié, publié, inscrit |
| alerte / en attente | `#8A5E00` | `#A16E00` | `#FAEDCA` | en relecture, en attente de parrainage |
| danger / refus | `#B3261E` | `#B3261E` | `#FDECEA` | refusé, signalé, erreur |
| information | `#004C7D` | `#0072B9` | `#EEF7FF` | consignes, aides |

**Le drapeau est décoratif, jamais fonctionnel.** On prend les valeurs officielles, seule
source de vérité du programme (`DESIGN_SYSTEMS/README.md`) : vert `#009E60`, jaune
`#FCD116`, bleu `#3A75C4`. Il n'apparaît qu'en **un** endroit : le filet tricolore de
2 px en tête de la vitrine (spec E01). Il ne sert jamais de texte, de fond de bouton ni
d'état.

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
étiquette 11 (mono, capitales, interlettrage +0,06 em). Le corps ne descend jamais sous
13 px ; aucune information n'est portée par une taille inférieure à 11 px.

Les polices sont auto-hébergées au build (`next/font`), sans requête externe à
l'exécution. Variables : `--dg-font-sans`, `--dg-font-display`, `--dg-font-mono`, et les
noms du contrat (`--font-sans`, `--font-display`, `--font-mono`) qui y renvoient.

## 4. Géométrie et relief

- **Rayon de base 10 px** (A7) : `xs 4 · sm 6 · md 10 · lg 14 · xl 16 · 2xl 20 · 3xl 24`.
  Les pastilles, la piste des onglets et la barre basse sont en pilule (`--esp-r-chrome:
  999px`).
- **Relief chaud** : les ombres sont teintées d'encre (`rgb(20 19 15 / α)`), jamais
  noires, comme dans Sable. Une carte se détache du sable par le papier blanc, un filet
  `#E6E2D8` et une ombre de 1 à 2 px. Seuls les éléments qui passent DEVANT la page
  (feuille, barre basse, carte iCom détachée) portent une ombre large.
- **Thème sombre** : l'élévation se lit par la clarté. Fond `#14130F` < section
  `#1C1A15` < carte `#201D18` < puce `#2A2620`.

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

- **Bandeau de modération** pour l'auteur seulement, en tête de carte ou de page :
  - *En relecture* : ambre, `Clock` ;
  - *Publié* : vert, `CircleCheck` ;
  - *Refusé* : rose, `CircleAlert`, avec le motif.

  Fond de teinte plein, liseré gauche de 3 px dans la couleur pleine. Les autres membres
  ne voient jamais un contenu non publié.
- **États vides génératifs** : une phrase qui dit ce qui manque, puis l'action qui le
  comble (« Aucun évènement en Belgique pour l'instant. Proposez le premier. »). Jamais
  un écran muet, jamais un compteur à zéro en vitrine : un hub sans contenu dit
  « bientôt » (`hubs.ts`).
- **Mode démonstration** : tant que le fournisseur factice est actif, un bandeau ambre
  permanent l'annonce (« Démonstration : toutes les données sont fictives »). Aucune
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

| Paire | Ratio | | Paire (sombre) | Ratio |
|---|---|---|---|---|
| Encre / Sable | 17,19 | | texte `#F4F1E8` / fond `#14130F` | 16,46 |
| Encre / Papier | 18,59 | | texte / carte `#201D18` | 14,87 |
| Grès / Sable | 5,54 | | secondaire `#A8A291` / carte | 6,59 |
| Bleu Gabon / Papier (lien) | 5,11 | | bleu `#449FE9` / carte (lien) | 5,90 |
| Bleu Gabon / Sable (lien) | 4,73 | | encre `#14130F` / bleu `#449FE9` (bouton) | 6,53 |
| blanc / Bleu Gabon (bouton) | 5,11 | | vert `#4CBB75` / carte | 6,94 |
| Bleu 700 / puce `#EFEBE0` (onglet actif) | 5,84 | | ambre `#D8A53C` / carte | 7,49 |
| vert `#0F5F2F` / teinte `#E3F1E8` | 6,68 | | rose `#E58079` / carte | 6,15 |
| ambre `#8A5E00` / teinte `#FAEDCA` | 4,90 | | contour de champ `#7D7666` / carte | 3,72 |
| rose `#B3261E` / teinte `#FDECEA` | 5,72 | | bleu `#449FE9` / puce `#2A2620` | 5,29 |
| contour de champ `#918E89` / Papier | 3,26 | | texte discret `#8C8676` / carte | 4,63 |
| texte discret `#736E61` / Sable | 4,70 | | | |
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

## 11. Mise en œuvre

- **Fichier unique** : `packages/diasporale-features/src/styles/tokens.css`. C'est le
  **seul** fichier de DIASPORALE autorisé à porter une couleur littérale (cliquet
  `no-hardcoded-colors`). Il sera recopié tel quel dans
  `ANTIA/packages/ui/src/themes/diasporale.css` quand le moteur publiera son contrat de
  thème (PA0).
- **Trois blocs** :
  1. les **primitives** (`--dg-*`), seules valeurs littérales ;
  2. les **rôles clairs**, uniquement des renvois aux primitives ;
  3. les **rôles sombres** (`.dark [data-charte="diasporale"]`), qui ne redéclarent
     aucune primitive.
- **Contrat de thème** couvert pour les composants dupliqués du socle :
  - **shadcn** : `--background`, `--foreground`, `--card(-foreground)`,
    `--popover(-foreground)`, `--primary(-foreground)`, `--secondary(-foreground)`,
    `--muted(-foreground)`, `--accent(-foreground)`, `--destructive(-foreground)`,
    `--border`, `--input`, `--ring`, `--chart-1…5`, `--sidebar-*` ;
  - **ui-v2** : `--primary-50…800`, `--primary-fill(-hover)`, `--on-fill`,
    `--ink-0…900`, `--info-*`, `--success-*`, `--warning-*`, `--danger-*`, `--status-*`,
    `--shadow-xs…xl`, `--shadow-focus`, `--radius-xs…4xl`, `--font-sans`,
    `--font-display`, `--font-mono` ;
  - **espace personnel** : `--esp-surface-card`, `--esp-shadow-card(-hover)`,
    `--esp-shadow-float`, `--esp-tone-*`, `--esp-mobilebar-*`, `--esp-segment-on(-fg)`,
    `--esp-r-chrome`, `--esp-ava-1…6`, `--esp-on-avatar`, `--esp-accent-soft`,
    `--esp-accent-deep`, `--esp-immersive-ink`, `--esp-immersive-on-ink`,
    `--esp-neutral-chip`, `--esp-neutral-hover`, `--esp-reseau-tabbar-inset`.
- **Rôles propres à DIASPORALE** :
  - `--dg-tag-*` : l'étiquette pays ;
  - `--dg-official-*`, `--dg-verified-*`, `--dg-agent-*`, `--dg-community-*`,
    `--dg-sponsored-*` : les badges ;
  - `--dg-moderation-*` : les bandeaux de modération ;
  - `--dg-demo-*` : le bandeau de démonstration ;
  - `--dg-stripe` : le filet tricolore.
- **Pose** : l'application met `data-charte="diasporale"` sur `<html>`, où `next-themes`
  pose aussi la classe `dark` (sélecteur `[data-charte="diasporale"].dark`). Les portails
  (feuilles, menus, toasts) sont rendus dans `<body>` et héritent donc de la charte.

## 12. Interdits

| Interdit | À la place |
|---|---|
| Une couleur littérale hors du fichier de jetons (hex, `rgb()`, classe Tailwind brute `bg-blue-500`) | un rôle (`bg-card`, `text-muted-foreground`, `var(--dg-tag-bg)`) |
| Les couleurs du drapeau en texte, fond de bouton ou état | un statut, ou le bleu Gabon |
| Noir pur ou blanc pur en thème sombre | nuit brune et texte `#F4F1E8` |
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

*Fin de la charte DIASPORALE — version 1.0 du 14 octobre 2026.*
