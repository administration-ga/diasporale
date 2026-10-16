---
title: "DIASPORALE.COM — Charte graphique « Sable de la diaspora »"
version: "3.2"
date: "2026-10-15"
statut: "Charte de travail v3 — arbitrage A7 (famille Consulaire / Sable) ; refonte demandée par le propriétaire le 15/10/2026 : épurée, contraste renforcé, couches du sombre renforcées (le fond reste le plus sombre), rayons resserrés, sans drapeau, avis en cartes flottantes ; v3 : palette confort (une teinte par thème, chroma basse, texte sans éblouissement, focus plein) ; v3.1 : avatars, teintes de statut, aplats ; v3.2 : bleu Gabon légèrement foncé (`#0167A8`, décision du propriétaire), sable posé, sélection sans contour"
projet: "DIASPORALE"
jetons: "ANTSIA/packages/ui/src/themes/diasporale.css (contrat) + packages/diasporale-features/src/styles/extras.css (rôles propres) — [data-charte=\"diasporale\"]"
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
> thème du moteur ANTSIA : échelles ui-v2, noms sémantiques shadcn, rôles `--esp-*` de
> l'espace personnel. Les composants dupliqués du socle s'y branchent **sans fork**
> (règle de duplication n° 7).
>
> **Version 2 (15/10/2026, demande du propriétaire).** Plus épurée : aucun filet autour des
> cartes, aucun liseré, presque pas d'ombre. Contraste renforcé (grès 6,46:1 sur le sable,
> grès clair 6,92:1 sur la carte sombre). **Élévation par la clarté** dans les deux thèmes : le
> fond est la couche la plus sombre, chaque surface qui monte s'éclaircit, avec des marches
> nettes puisqu'il n'y a plus de filet. Boutons et cartes moins arrondis (6 et 8 px) ; pilules et
> interrupteur inchangés. Plus aucune référence au drapeau. Les bandeaux deviennent des
> **cartes flottantes** qu'on écarte d'une croix. Vitrine vivante : `/charte`, contrastes
> mesurés en direct.
>
> **Version 3 (même jour, « plus agréable pour les yeux »).** Palette confort : une seule teinte
> chaude par thème et une saturation très basse, graduée (OKLCH) — plus de beige saturé en clair
> ni de brun olive en sombre. Texte principal ramené dans la zone 12–16:1 (15,68:1 sur le papier,
> 14,99:1 sur le fond sombre, au lieu de 18,59 et 17,19), papier `#FDFDFB` au lieu du blanc pur,
> bleu et tons du sombre adoucis, anneau de focus plein (5:1 au lieu d'un halo à 1,67:1).
>
> **Version 3.2 (même jour, décision du propriétaire).** Le bleu Gabon est légèrement foncé à
> teinte égale (`#0072B9` → `#0167A8`) : le lien tient 5,21:1 sur le sable au lieu de 4,57. Le
> sable se pose d'un cran (`#F1EFEB`) pour que le papier s'en détache à 1,13:1, comme les cartes des
> grands réseaux. Les textes secondaires et discrets sont plus fermes dans les deux thèmes, et
> l'échelle sombre est requantifiée à teinte constante. **Une sélection ne porte plus jamais de
> contour** : la pilule choisie passe à l'encre inversée, le curseur d'un sélecteur est la
> surface la plus claire de sa piste, l'option choisie prend une teinte qui se lève au-dessus de la
> carte en sombre au lieu d'un bleu nuit qui creusait (§4).

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
| **Sable** | `#F1EFEB` | fond de page : le sable de la famille, posé en v3 puis d'un cran en v3.2 (le papier s'en détache à 1,13:1) |
| **Papier** | `#FDFDFB` | cartes posées sur le sable (adouci en v3 : jamais de blanc pur) |
| **Encre** | `#25211E` | texte (15,68:1 sur le papier : fort sans dureté) ; fond du tampon « Officiel » |
| **Bleu Gabon** | `#0167A8` | action, lien, focus : barreau 500 du contrat, teinte H 246,6 ; légèrement foncé en v3.2 (`#0072B9` avant), 5,21:1 sur le sable |
| **Grès** | `#595550` | texte secondaire, icônes au repos (6,44:1 sur le sable, 7,26:1 sur le papier) |
| **Nuit** | `#151311` | fond du thème sombre, la couche la plus basse ; la carte `#24221F` se pose dessus, plus claire |

**Rampe Bleu Gabon** (barreaux du contrat du moteur, teinte H 246,6) : `50 #EEF7FF · 100 #D7ECFF ·
200 #B4DBFF · 300 #7EC2FF · 400 #5BA5E5 (bleu du sombre) · 500 #0167A8 (bleu d'action) ·
600 #005791 (survol) · 700 #004C7D · 800 #003458 · 900 #17293F · 950 #001D35`. Jusqu'à la v3.1,
le bleu d'action était `#0072B9`, celui de la famille Consulaire ; la v3.2 le fonce de 3,7 points
de clarté (OKLCH), sans changer sa teinte.

**Neutres chauds (v3.2, une seule teinte OKLCH h 85, chroma ≤ 0,011)** : `0 #FDFDFB · 50 #F9F8F5 ·
100 #F1EFEB · 150 #ECEAE5 (creux) · 200 #E7E4DE (puce) · filet #DDDAD4 · 300 #CDCAC4`.
**Grès** : `#8B8882` (contour de champ, 3,47:1 sur le papier, 3,08:1 sur le sable) · `#6B6761`
(texte discret, 4,89:1 sur le sable, 4,67:1 sur le creux) · `#595550` (texte secondaire, 6,44:1) ·
`#3F3B37` · `#312D29`.
En v2, le creux, la puce et le filet étaient trois fois plus saturés que le fond (beige) ;
la v3 les aligne sur la même teinte.

**Élévation par la clarté.** Dans les deux thèmes, le fond est la couche la plus basse et
chaque surface qui monte s'éclaircit : papier sur sable en clair, carte relevée sur la nuit en
sombre. Sans filet, chaque marche se lit par la clarté. Échelle sombre (v3.2, une seule teinte
OKLCH h 75, requantifiée : la carte virait au rouge), du plus sombre au plus clair : fond
`#151311` < carte `#24221F` (1,17:1 sur le fond) < aplats `#2B2926` (survol, petites étiquettes,
squelettes : ils éclaircissent au lieu de creuser) < puce, piste des pilules et carte flottante
`#302E2A` (1,17:1 sur la carte) < survol fort et curseur des sélecteurs `#3B3834` ; teinte de
sélection `#243849`, une ardoise levée (1,31:1 sur la carte). Texte sable adouci `#E9E7E1`
(14,99:1 sur le fond, 12,83:1 sur la carte : pas de halo), grès clair `#B8B4AC` (7,68:1 sur la
carte), discret `#9C9790` (5,47:1 sur la carte, 4,67:1 sur ce qui flotte). Le bleu du sombre est
adouci (`#5BA5E5`), les tons aussi (vert `#6EBE85`, ambre `#D7AD63`, rose `#E18C85`).

**Statuts.** Le cahier prévoit quatre accents réservés aux statuts. Chaque statut a une
paire texte / teinte mesurée. En v3.1, les quatre teintes partagent la même clarté et la même
saturation dans chaque thème (OKLCH L 95,8 % C 0,030 en clair ; L 29,5 % C 0,045 en sombre,
toujours au-dessus de la carte) : l'ambre ne crie plus, la pastille rose ne se fond plus.

| Statut | Texte | Plein | Teinte | Sens |
|---|---|---|---|---|
| succès / vérifié | `#0F5F2F` | `#157A3D` | `#E3F7E7` (sombre `#1A3321`) | vérifié, publié, inscrit |
| alerte / en attente | `#8A5E00` | `#A16E00` | `#FBF0DB` (sombre `#382A10`) | en relecture, en attente de parrainage |
| danger / refus | `#B3261E` | `#B3261E` | `#FFEAE7` (sombre `#402321`) | refusé, signalé, erreur |
| information | `#004C7D` | `#0167A8` | `#E1F4FF` (sombre `#182F42`) | consignes, aides ; pastille des cartes flottantes « info » (v3.2) |

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
- **Sélection : jamais par un contour (v3.2)**. La pilule choisie d'un filtre passe à l'encre
  inversée : encre sur sable en clair, sable sur nuit en sombre (15:1). Le curseur d'un sélecteur
  (onglets chemise, thème, langue, courriel ou téléphone) est la surface la plus claire de sa
  piste : papier en clair, survol levé en sombre. Une option en carte, un pays ou une ligne non lue
  choisis prennent la teinte de sélection `--primary-50` : bleu très pâle en clair, ardoise
  `#243849` en sombre, plus claire que la carte et que ce qui flotte (le bleu 950 creusait un trou
  cerclé de bleu). L'état se lit toujours aussi sans la couleur : inversion de clarté, pastille
  radio remplie, coche.
- **Couches (v3.2)** : barres (en-tête, barre basse) 40 < feuilles (voile et panneau) 50 < pile
  des avis 55 < menus et bulles 60. Un avis passager reste lisible au-dessus d'une feuille. Une carte
  flottante persistante s'écarte tant qu'une feuille est ouverte. Un menu ouvert passe devant les
  cartes flottantes : sonner se posait sinon à 999999999 et masquait le dernier élément d'un menu.
  Le cliquet `layers.test.ts` tient l'échelle.
- **Thème sombre** : le fond est le plus sombre ; la carte, puis ce qui flotte, s'éclaircissent
  (voir §2).

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
  pilule. L'onglet actif est la surface la plus claire de la piste : papier en clair, survol
  levé en sombre (v3.2).
- **Composeur en feuille** : la création s'ouvre en feuille (bas d'écran au téléphone,
  centrée au bureau). La portée (étiquette pays ou diaspora) et la case « Publier aussi
  sur ANTSIA » y sont visibles avant l'envoi.
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

Valeurs de la v3.2 (15/10/2026). Elles sont aussi **mesurées en direct** sur `/charte`, dans le
thème affiché. Zone de confort (v3, tenue par le cliquet) : le texte principal reste entre 12 et
16:1 — fort, sans le noir sur blanc pur ni le halo du blanc sur noir.

| Paire | Ratio | | Paire (sombre) | Ratio |
|---|---|---|---|---|
| Encre `#25211E` / Sable `#F1EFEB` | 13,91 | | texte `#E9E7E1` / fond `#151311` | 14,99 |
| Encre / Papier `#FDFDFB` | 15,68 | | texte / carte `#24221F` | 12,83 |
| Grès `#595550` / Sable | 6,44 | | grès clair `#B8B4AC` / carte | 7,68 |
| Grès / Papier | 7,26 | | grès clair / fond | 8,97 |
| Bleu Gabon `#0167A8` / Papier (lien) | 5,88 | | bleu `#5BA5E5` / carte (lien) | 6,01 |
| Bleu Gabon / Sable (lien) | 5,21 | | encre `#151311` / bleu `#5BA5E5` (bouton) | 7,02 |
| Bleu Gabon / creux `#ECEAE5` (lien sur un aplat) | 4,98 | | texte / teinte de sélection `#243849` | 9,78 |
| papier / Bleu Gabon (bouton) | 5,88 | | vert `#6EBE85` / carte | 7,08 |
| vert `#0F5F2F` / teinte `#E3F7E7` | 6,94 | | ambre `#D7AD63` / carte | 7,59 |
| ambre `#8A5E00` / teinte `#FBF0DB` | 5,05 | | rose `#E18C85` / carte | 6,26 |
| rose `#B3261E` / teinte `#FFEAE7` | 5,66 | | contour de champ `#78746E` / carte | 3,42 |
| contour de champ `#8B8882` / Papier | 3,47 | | texte discret `#9C9790` / carte | 5,47 |
| texte discret `#6B6761` / Sable | 4,89 | | texte discret / carte flottante `#302E2A` | 4,67 |
| texte discret / creux | 4,67 | | grès clair / carte flottante | 6,56 |
| pilule choisie : papier `#F9F8F5` / encre | 15,04 | | pilule choisie : nuit / sable `#E9E7E1` | 14,99 |
| anneau de focus (bleu plein) / Papier | 5,88 | | anneau de focus / carte | 6,01 |

Règles non chromatiques :
- focus toujours visible (v3) : liseré de fond de 2 px puis anneau bleu plein de 2 px (`--shadow-focus`), 5,88:1 sur le papier, 6,01:1 sur la carte sombre (le halo à 35 % de la v2 ne tenait que 1,67:1) ;
- cibles de 44 px au minimum ;
- une information n'est jamais portée par la seule couleur : chaque badge a son icône et
  son libellé ;
- les titres se suivent sans saut de niveau ;
- tout tient sans défilement horizontal à 320 px.

Le cliquet `engine-theme-contrast.test.ts` (paquet `@diasporale/features`) recalcule ces
paires depuis la cascade réelle (base du moteur, thème, rôles propres), dans les deux thèmes ;
depuis la v3.2, il tient aussi la sélection sans contour (teinte levée en sombre, curseur plus clair
que sa piste, pilule choisie à 7:1 au moins sur le fond).

## 11. Mise en œuvre (depuis PD0, sur le moteur ANTSIA)

La charte vit en trois couches, importées dans cet ordre par
`apps/diasporale_com/src/app/globals.css`, après `@import "tailwindcss"` :

1. **Charte de base du moteur** — `@antsia/ui/styles.css` : déclare TOUS les jetons du contrat
   sur `[data-charte]` (échelles ui-v2, noms sémantiques shadcn, primitives et rôles `--esp-*`),
   relie les utilitaires Tailwind et pose la base (corps, titres, barres de défilement).
2. **Thème DIASPORALE** — `ANTSIA/packages/ui/src/themes/diasporale.css` (écrit par la session
   DIASPORALE) : réaccorde les primitives du contrat à la palette Sable (bleu Gabon `#0167A8` au
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
  arrêts du dégradé), vérifie l'élévation par la clarté dans les deux thèmes (carte au-dessus du
  fond, carte flottante au-dessus de la carte ; marches d'au moins 1,15 et 1,12 en sombre), les
  rayons de la v2 et l'absence de toute couleur du drapeau ;
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
   bleu de la famille Consulaire, plus clair et plus chaleureux sur le sable. En v3.2, sur décision
   du propriétaire, il est légèrement foncé à teinte égale : `#0167A8`. Le lien tient ainsi 5,21:1
   sur le sable au lieu de 4,57, et 4,98:1 sur un aplat au lieu de 4,33.
6. **Trois teintes d'avatar assombries.** Le socle affirme que le blanc tient sur ses six
   teintes ; mesuré sous des initiales de 13 px, trois échouent : `#0E8A4D` (4,41:1),
   `#DF7F0A` (2,93:1) et `#1D8B96` (4,05:1). Elles sont assombries dans la même teinte —
   `#0C7A44`, `#A35A09`, `#167580` — et tiennent toutes au moins 5,07:1. L'ordre des six
   teintes est conservé : une personne garde sa couleur d'un réseau à l'autre.
   En v3.1, les six teintes sont réglées au validateur de palette du skill dataviz (simulation
   Machado 2009, toutes paires, puisque deux avatars quelconques peuvent se suivre dans un fil) :
   `#2971D5 · #01793D · #9A5600 · #804DAE · #C94050 · #238090`. La pire paire passe de ΔE 9,2 à
   12,5 en vision normale et de 2,2 à 6,3 en daltonisme (le bleu et le violet se confondaient pour
   un deutéranope) ; le blanc tient au moins 4,6:1 ; l'écart moyen aux teintes d'avant est
   ΔE 3 (même identité visuelle). Le seuil de 15 en vision normale sur toutes les paires n'est pas
   atteignable avec six familles assez foncées pour des initiales blanches : l'identité ne repose
   jamais sur la seule couleur (initiales et nom l'accompagnent toujours). Le sarcelle plafonne à
   une chroma de 0,08, limite du gamut sRGB à cette clarté.
7. **Texte discret `#736E61`** plutôt que `#767164` : la première valeur, annoncée à
   4,50:1 sur le sable, mesurait en réalité 4,499:1. Le cliquet de contraste l'a refusée
   le 14 octobre 2026 ; la nouvelle valeur tient 4,70:1 sur le sable et 5,08:1 sur le papier.

8. **Couches du sombre renforcées (v2)** : sans filet autour des cartes, les marches de clarté
   s'écartent (carte `#24211C` à 1,16:1 du fond, au lieu de `#201D18` à 1,11:1 en v1) ; le creux
   (aplats, survol dans une carte) passe sous la carte, la carte flottante au-dessus. Le 15/10,
   une première version de la v2 inversait le sombre (carte plus profonde que le fond) ; le
   propriétaire l'a écartée le jour même : le fond reste la couche la plus sombre.
9. **Démonstration fermable (v2)** : la carte de démonstration a une croix, à rebours du bandeau
   permanent de la v1 ; l'invariant est tenu par le repère « Démo » permanent de l'en-tête.
10. **Texte secondaire assombri (v2)** : `#5C5952` plutôt que `#66635D` (6,46:1 au lieu de
    5,54:1 sur le sable), texte discret `#6B675D` (5,22:1) ; en sombre, grès clair `#B0AA99`.

11. **Palette confort (v3, même jour)** : une seule teinte chaude par thème et une chroma basse,
    graduée (OKLCH) ; texte principal ramené dans la zone 12–16:1 (encre `#25211E`, texte sombre
    `#E9E7E1`) au lieu de 18,59 et 17,19 ; papier `#FDFDFB` au lieu du blanc pur ; sable `#F4F2EE`
    (le bleu Gabon y tient 4,57:1) ; bleu et tons du sombre moins saturés ; anneau de focus plein.

12. **Harmonisation (v3.1, même jour)** : teintes de statut à clarté et saturation égales dans
    chaque thème ; aplats sombres au-dessus de la carte (le survol éclaircit) ; avatars réglés au
    validateur de palette (voir n° 6) ; étiquette « Toute la diaspora » sur la teinte bleue de
    statut dans les deux thèmes.

13. **Bleu foncé, fond posé, sélection sans contour (v3.2, même jour, décision du propriétaire)** :
    bleu Gabon `#0167A8` (voir n° 5) ; sable `#F1EFEB`, creux, puce et filet d'un même pas (carte à
    1,13:1 du fond au lieu de 1,10) ; grès `#595550` et discret `#6B6761` plus fermes, et en
    sombre grès clair `#B8B4AC` et discret `#9C9790` (4,45:1 sur ce qui flotte avant : sous le
    seuil) ; échelle sombre requantifiée à teinte constante ; sélection sans contour ni bleu nuit
    (§4) ; la navigation active et la barre basse redéclarent `--esp-accent-*` en sombre (le libellé
    actif de la barre basse tombait à 1,8:1) ; la pastille « info » prend la teinte de statut bleue.

*Fin de la charte DIASPORALE — version 3.2 du 15 octobre 2026.*
