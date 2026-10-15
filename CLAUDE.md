# DIASPORALE.COM — Consignes pour les agents (Claude Code, Codex)

> Dossier ouvert le 14/10/2026. **Où l'on en est** : l'encart « État d'avancement » en tête de
> `docs/01` (étapes a → e livrées le 14–15/10 ; PD0, câblage dans le moteur, en cours). Code :
> `packages/diasporale-domain` (règles pures), `packages/diasporale-features` (surfaces, interface
> de données, fournisseur de démonstration), `apps/diasporale_com` (Next.js 16, port 3031).
> Avant tout travail, lire dans l'ordre :
> 1. `docs/00_CAHIER_DES_CHARGES_DIASPORALE.md` (ce que le produit est, ses invariants, ses lots) ;
> 2. `../ANTIA/docs/00_CAHIER_DES_CHARGES_ANTIA.md` (le moteur dont DIASPORALE est une application) ;
> 3. `docs/01_PLAN_IMPLEMENTATION_PROMPTS_DIASPORALE.md` (le prompt à exécuter, un à la fois, avec son préambule commun) ;
> 4. `../../../Documentation/RESEAUX_SOCIAUX/00_PLAN_RESEAUX_DANS_LE_RESEAU_DIASPORALE_ANTIA_2026-10-14.md` et ses annexes.

## Ce qu'est ce dépôt

- L'**application** `diasporale.com` et ses règles propres (facette diaspora, éligibilité,
  parrainage, hubs pays, emploi, annonces, entraide), **espace de travail bun externe** du
  moteur `ECOSYSTEMES/ANTIA`. Le backend est celui du moteur (tranche `convex/modules/diaspora/`
  dans ANTIA). Une seule installation : `bun install` dans `ANTIA/`, jamais ici.
- Un réseau **fermé**, enfant du réseau public ANTIA, dans le moteur multi-réseaux.
- **Charte** : le contrat de couleurs vit dans `../ANTIA/packages/ui/src/themes/diasporale.css`
  (écrit par la session DIASPORALE) ; les rôles propres dans
  `packages/diasporale-features/src/styles/extras.css` (renvois au contrat seulement) ;
  référence `docs/03_CHARTE_DIASPORALE.md`.
- **Données** : les écrans lisent un port (`@diasporale/features/data`) ; aujourd'hui le
  fournisseur de DÉMONSTRATION (données fictives, ce navigateur seulement), demain celui du moteur.

## Invariants (ne jamais contourner)

- `networkId = diasporale` sur toute lecture et toute écriture sociale ; visibilité `network`
  par défaut ; `root` seulement si audience publique et geste de l'auteur.
- Entrer dans DIASPORALE crée l'adhésion ANTIA (dérivée) ; une suspension ANTIA suspend partout.
- **Aucune donnée consulaire** (passeport, NIP, état civil, mineur, dossier) n'entre jamais
  dans le moteur ; consulat.ga atteste (booléen, pays, poste, date) avec consentement ; aucune
  lecture de base à base ; aucun import de `_generated` ou de schéma d'un autre dépôt.
- Aucun profil créé d'office ; consentements explicites, horodatés, révocables.
- Badges calculés côté serveur ; refus indistinct ; toute écriture bornée (adhésion →
  éligibilité → limitation de débit → droit).
- Aucune coordonnée exposée : le contact passe par la messagerie.
- Le citoyen ne paie jamais ; toute monétisation est B2B et étiquetée (lot D4, décisions).

## Conventions

- Code en anglais, UI en français **via i18n** (`fr.json`, `en.json`) ; TypeScript strict ;
  validateurs précis, jamais `v.any()` ; aucune couleur littérale hors des fichiers de jetons
  (`[data-charte="diasporale"]`) ; React Hook Form + Zod ; sonner ; lucide-react.
- Duplication depuis le socle : les dix règles (cahier §3.4) ; en-tête de provenance sur
  chaque fichier copié ; tests portés et exécutés ; parité prouvée.
- Modèle : **Opus** pour tout le code (consigne du propriétaire du 25/09/2026).
- Livraison : branche dédiée, commits en français, PR, fusion après vérification (décision du
  23/09/2026) ; la création de dépôts, de projets Convex, d'hébergement, de secrets et de
  domaines reste au propriétaire ; aucune commande vers un déploiement de production sans
  décision explicite ; jamais de `--rapide` sans demande.
- Dépôts voisins touchés par ce projet : `../GABON_DIPLOMATIE` (contrats `DIASPORA-ATTESTATION-V1`
  et `DIASPORA-COMMUNAUTE-V1`, par PR, en coordination avec l'équipe qui publie gabon-diplomatie),
  `../../SERVICES_TRANSVERSES/identite.ga` (client OIDC par le portail développeur).

## Vérification

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" bun run --cwd ../ANTIA verify   # obligatoire avant tout commit : codegen, typecheck, tests, lint
```

Node 22 en tête du PATH : le Mac a Node 25, sous lequel `codegen` échoue dès qu'une action
`"use node"` existe dans le moteur (lot 15 d'ANTIA, voir son `CLAUDE.md`).

Cliquets attendus (verts avant toute PR) : réseau borné, aucun import inter-produit, charte,
i18n, `.collect()` borné, `v.any()`, communication publique (aucun chiffre non mesuré, aucun
audit ou hébergement affirmé), aucune URL codée en dur.

## Mémoire

Vault Obsidian : `10-PROJETS/diasporale/` (fiche, contexte actif, décisions). Mettre à jour en
fin de travail (`/memoire-maj`).
