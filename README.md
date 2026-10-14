# DIASPORALE.COM — Le réseau social fermé de la diaspora gabonaise

Réseau social **fermé** des Gabonais de l'étranger : fil et publications, hubs par pays, pages
des postes consulaires et des associations, évènements, groupes, messagerie et appels, puis
emploi, annonces et entraide. Édité par **NTSAGUI Digital**.

DIASPORALE est une **application du moteur social national** (dépôt `ECOSYSTEMES/ANTIA`) et un
réseau **enfant** du réseau public ANTIA : être membre de DIASPORALE, c'est être membre d'ANTIA
avec un contexte en plus — celui de la diaspora, qui reste séparé.

## État du dossier (14 octobre 2026)

**Ouvert le 14/10/2026 : cahier des charges et plan d'implémentation. Aucun code encore.**
Le dépôt GitHub cible est `administration-ga/diasporale` (à créer par le propriétaire).

| Document | Rôle |
|---|---|
| [`docs/00_CAHIER_DES_CHARGES_DIASPORALE.md`](docs/00_CAHIER_DES_CHARGES_DIASPORALE.md) | cahier des charges fonctionnel et technique (exigences `EXF-DG` / `EXT-DG`, lots D0–D4, parcours R1–R10, arbitrages A1–A11) |
| [`docs/01_PLAN_IMPLEMENTATION_PROMPTS_DIASPORALE.md`](docs/01_PLAN_IMPLEMENTATION_PROMPTS_DIASPORALE.md) | onze prompts d'exécution PD0 → PD10, à coller un par un dans Claude Code (Opus) |
| `../../../Documentation/RESEAUX_SOCIAUX/00_PLAN_RESEAUX_DANS_LE_RESEAU_DIASPORALE_ANTIA_2026-10-14.md` | plan de pilotage « réseaux dans le réseau » et ses annexes (audits du socle et de consulat.ga) |
| `../ANTIA/docs/00_CAHIER_DES_CHARGES_ANTIA.md` | le moteur, préalable de ce projet |
| `../GABON_DIPLOMATIE/docs/OPPORTUNITES_COMMUNAUTE_DIASPORA.md` | dossier produit d'origine de la communauté diaspora (F01–F17, 33 écrans) |

## Ce que sera le dépôt (cible, après PD0)

```text
DIASPORALE/
├── apps/
│   ├── diasporale_com        # diasporale.com — Next.js 16, mobile-first (port 3031)
│   └── diasporale_mobile     # Expo (lot D3)
├── packages/
│   ├── diasporale-domain     # SSOT métier : facette diaspora, éligibilité, parrainage, pays, portée, badges (TS pur)
│   └── diasporale-features   # surfaces propres : hub pays, CountrySwitch, cartes, onboarding, modération pays, emploi…
├── docs/                    # cahier des charges, prompts, charte, parité, recette
└── Dockerfile               # contexte ECOSYSTEMES (copie du moteur puis de DIASPORALE)
```

Le **backend** de DIASPORALE est le moteur : `ECOSYSTEMES/ANTIA/convex/` (tranche propre
`convex/modules/diaspora/`). Convex ne déploie qu'un dossier de fonctions ; c'est voulu.
DIASPORALE est un **espace de travail bun externe** du moteur (`../DIASPORALE/apps/*`,
`../DIASPORALE/packages/*` dans `ANTIA/package.json`), sur le modèle des applications de l'État
vis-à-vis du socle (ADR-0165) : une seule installation, dans `ANTIA/`.

## Commandes (cibles, posées par PD0)

```bash
cd ../ANTIA && bun install            # une seule installation, dans le moteur
bun run --cwd ../ANTIA dev:diasporale  # http://localhost:3031
bun run --cwd ../ANTIA verify         # codegen + typecheck + tests + lint (moteur + DIASPORALE)
bun run --cwd ../ANTIA deploy diasporale
```

## Règles non négociables

- **Aucune donnée consulaire** dans le moteur : pas de passeport, de NIP, d'état civil, de
  mineur. consulat.ga **atteste** (booléen, pays, poste, date), avec le consentement de la
  personne, par le contrat `DIASPORA-ATTESTATION-V1` ; il ne fédère pas d'identité (IDN est le
  fournisseur unique).
- **Adhésion explicite** : aucun profil créé d'office à partir de consulat.ga ; la personne
  entre, consent, choisit son handle.
- **Contexte séparé** : visibilité `network` par défaut ; « publier aussi sur ANTIA » est un
  geste de l'auteur.
- **Le pays est le contexte permanent** ; **la confiance est visible** (Officiel · Vérifié ·
  Agent public · Communauté, calculés côté serveur) ; **le contact passe par la messagerie**.
- **Le citoyen ne paie jamais.**
- Dix règles de duplication du code du socle (cahier §3.4) ; code en anglais, UI en français
  via i18n ; aucune couleur littérale ; Opus pour tout le code.

## Droit

Loi gabonaise n° 001/2011 modifiée par la loi n° 025/2023 (APDPVP) ; RGPD pour les résidents
de l'Union européenne. Nouveau dossier APDPVP et analyse d'impact à déposer avant la mise en
ligne (lot D0).
