# Publication et retour arrière de diasporale.com

> Lot LX-02 du plan 17 (`docs/etudes/2026-11-10-finalisation/17_LANCEMENT_PILOTE_EXPLOITATION_MODELE_ECONOMIQUE.md`).
> Ce document vit dans un dépôt public : il nomme des variables, jamais leur valeur ; il ne cite
> aucun identifiant de projet, d'équipe ou de déploiement, aucune adresse de déploiement.
>
> **État au 10/11/2026** : les scripts sont écrits et testés sans réseau (hébergeur, machine et
> sonde simulés). **Aucune publication ni aucun retour arrière n'a été joué avec eux.** Le critère
> « un retour arrière est joué sur la démonstration et consigné » reste à remplir, sur accord écrit.

Jusqu'au 3/11/2026, publier le site de démonstration et revenir en arrière reposaient sur des
scripts tenus hors de tout dépôt, sur un seul poste, avec des identifiants écrits en clair. Ils
entrent ici, sous la même méthode, avec des garde-fous testés et des identifiants lus dans
l'environnement de la machine qui publie. La production (`docs/36_MISE_EN_PRODUCTION.md`) emploie
les mêmes scripts, avec la cible `production`.

## 1. La porte

Toute publication, démonstration comprise, et tout retour arrière exigent **l'accord écrit et
détaillé du propriétaire**, qui nomme :

1. le **commit de chaque dépôt** : ANTSIA et DIASPORALE ;
2. la **cible** : `demo` ou `production` ;
3. l'**ordre** : le backend du moteur d'abord, publié par la session du moteur depuis le même
   commit d'ANTSIA ; puis ce site ; un seul publieur à la fois ;
4. le **retour arrière** : le déploiement servi avant la bascule, et la version qu'il dit.

Les scripts rappellent ces quatre points, puis s'arrêtent devant une phrase à taper. **Aucune option
ne contourne la porte** : `--yes` ou `--force` sont refusés comme arguments inconnus, aucune variable
ne vaut accord, et une entrée qui n'est pas un terminal (tube, script, agent) refuse. Sans accord,
l'opérateur tape autre chose et rien ne part. Le plan, lui, ne lance rien : il se colle tel quel dans
la demande d'accord, car il ne recopie aucune valeur de la machine.

## 2. Les scripts

| Script | Rôle | Par défaut | Avec `--execute` |
|---|---|---|---|
| `scripts/release.mjs` | publier le site d'une cible | affiche le plan, rien ne part | exécute, après deux phrases tapées : « PUBLIER … » puis « BASCULER … » |
| `scripts/release-check.mjs` | contrôler une version servie | lecture seule (deux requêtes GET sur le site) | sans objet |
| `scripts/rollback.mjs` | remettre en service le déploiement précédent | affiche le plan, rien ne part | exécute, après la phrase « REVENIR … » |
| `scripts/release-lib.mjs` | bibliothèque commune (cibles, variables, contexte figé, porte) | — | — |

Ils se lancent avec `node` (22 ou plus) ou `bun`, depuis la racine de DIASPORALE, ANTSIA à côté dans
`ECOSYSTEMES`. Tests : `bun test ./scripts` depuis la racine de DIASPORALE (repris par `bun run
test`). Aucun test ne joint le réseau.

## 3. Le poste qui publie

Préalables, posés par le propriétaire ou par l'opérateur qu'il désigne :

- les deux dépôts clonés côte à côte sous `ECOSYSTEMES/`, à jour d'`origin/main` ;
- la ligne de commande de l'hébergeur installée et **connectée par le propriétaire** (`vercel
  login`) : aucun jeton ne passe par les scripts ;
- le projet d'hébergement de la cible, créé par le propriétaire et réglé comme celui de la
  démonstration (`../ANTSIA/docs/23_ENVIRONNEMENT_DE_DEMONSTRATION.md`, § 6) : dossier racine
  `DIASPORALE/apps/diasporale_com`, Node 24, installation
  `cd ../../../ANTSIA && npx --yes bun@1.4.2 install --frozen-lockfile`, construction
  `npx --yes bun@1.4.2 run build` ;
- les **variables de la machine**, posées dans le terminal de la session de publication, jamais dans
  un fichier du dépôt.

`<CIBLE>` vaut `DEMO` ou `PRODUCTION` : chaque cible a ses propres variables, et les réglages de la
démonstration ne peuvent pas servir la production par mégarde.

| Variable de la machine | Rôle | Passe au site sous le nom |
|---|---|---|
| `DIASPORALE_<CIBLE>_SITE_URL` | origine https du site de la cible | `NEXT_PUBLIC_SITE_URL` |
| `DIASPORALE_<CIBLE>_CONVEX_URL` | origine du backend du moteur de la cible | `NEXT_PUBLIC_CONVEX_URL` |
| `DIASPORALE_<CIBLE>_CONVEX_SITE_URL` | origine des actions HTTP du même backend | `CONVEX_SITE_URL` |
| `DIASPORALE_<CIBLE>_VERCEL_PROJECT_ID` | projet d'hébergement de la cible | `VERCEL_PROJECT_ID` (ligne de commande seulement) |
| `DIASPORALE_<CIBLE>_IDN_PORTAL_URL` (facultative) | portail IDN ; absente, le lien d'élévation ne s'affiche pas | `NEXT_PUBLIC_IDN_PORTAL_URL` |
| `DIASPORALE_<CIBLE>_CONSULATE_URL` (facultative) | consulat.ga ; absente, le lien ne s'affiche pas | `NEXT_PUBLIC_CONSULATE_URL` |
| `DIASPORALE_VERCEL_ORG_ID` | équipe d'hébergement | `VERCEL_ORG_ID` (ligne de commande seulement) |
| `DIASPORALE_VERCEL_SCOPE` | portée des commandes de l'hébergeur | option `--scope` |
| `DIASPORALE_RELEASE_WORKDIR` (facultative) | dossier parent du dossier de travail, hors des dépôts | — |

Le script pose lui-même `NEXT_PUBLIC_DIASPORALE_DATA_SOURCE=engine` (un site publié sert le moteur,
jamais les données fictives) et `NEXT_PUBLIC_BUILD_SHA=<étiquette de version>` (que la sonde dira).
La garde de construction (LX-01, `apps/diasporale_com/src/lib/production-build-guard.ts`) refuserait
de toute façon une construction vers un domaine public sans ces deux valeurs.

Le plan refuse : une variable manquante ; une origine qui n'est pas en https ou qui porte un chemin ;
un site sur un poste de développement (`localhost`, `*.test`…) ; une même ressource déclarée pour la
démonstration et pour la production ; toute variable hors de la liste publique. Cette liste est celle
du catalogue de publication du moteur (`../ANTSIA/deploy/catalog.json`, entrée `diasporale_com`) :
un test les compare.

## 4. Publier

### 4.1 Le plan

```bash
node scripts/release.mjs --target demo --antsia <commit ANTSIA> --diasporale <commit DIASPORALE>
```

Le script résout chaque référence en commit complet et en arbre, par le dépôt local seulement, dit si
chacun est sur `origin/main` (relevé local, relu avant toute exécution), liste les variables de la
machine qui manquent, et affiche les étapes ci-dessous avec les commandes exactes. Les valeurs de la
machine y paraissent sous leur nom (`<DIASPORALE_DEMO_SITE_URL>`), jamais en clair.

### 4.2 Les étapes

| # | Étape | Commande | Ce qui arrête |
|---|---|---|---|
| 1 | Porte : accord écrit, puis « PUBLIER <cible> <version> » tapé | — | toute autre réponse, ou une entrée qui n'est pas un terminal |
| 2 | Relire `origin/main` des deux dépôts | `git fetch origin main` | échec de la lecture |
| 3 | Chaque commit est sur `origin/main` | `git merge-base --is-ancestor` | une branche non fusionnée, un HEAD local |
| 4 | Contexte figé dans un dossier vide hors des dépôts : `git archive` de chaque commit (fichiers suivis seulement, aucun `.env.local`), `.vercelignore`, empreinte SHA-256 des sources | `git archive`, `tar` | une archive impossible |
| 5 | Relever le déploiement servi et la version que dit sa sonde : la cible du retour arrière | `vercel inspect <site>` et la sonde | rien (une première publication le dit) |
| 6 | Publier **sans bascule** : variables publiques en construction et en exécution, les deux commits et l'empreinte en métadonnées | `vercel deploy --prod --skip-domain --archive=tgz` | aucune adresse de déploiement rendue |
| 7 | Le déploiement est prêt | `vercel inspect <déploiement>` | un état autre que `READY` |
| 8 | Contrôle privé : la sonde du déploiement dit « ok », la version attendue, la source « engine », le moteur configuré et joint | `vercel curl /api/sante-fonctionnelle --deployment` | le moindre écart : **aucune bascule**, le domaine sert toujours l'ancienne version |
| 9 | Seconde porte : « BASCULER <cible> <version> » tapé, après lecture du contrôle | — | toute autre réponse : le déploiement reste publié sans domaine |
| 10 | Bascule du domaine | `vercel promote <déploiement>` | échec de la bascule |
| 11 | Contrôle public (cinq essais espacés, le temps de la propagation) : sonde, version servie, moteur visé | `release-check.mjs` | un écart : le script s'arrête et **propose** la commande de retour arrière, sans la jouer |

### 4.3 L'étiquette de version

`diasporale-<12 premiers caractères du commit DIASPORALE>-antsia-<12 premiers caractères du commit
ANTSIA>-<cible>`, la même forme que les publications de la démonstration du 22/10 au 3/11. La sonde
la rend dans son champ `version` ; c'est la preuve que la version servie est celle de l'accord.

### 4.4 Le relevé

Chaque exécution écrit `release.json` dans son dossier de travail (sous le dossier temporaire du
système, ou sous `DIASPORALE_RELEASE_WORKDIR`) : commits, étiquette, empreinte et nombre de fichiers,
déploiement créé, déploiement servi avant la bascule et sa version, étapes franchies, écarts. Ce
relevé contient des identifiants : il **ne s'ajoute jamais au dépôt**. Un rapport de recette dans
`docs/recette/` ne reprend que la date, les deux commits, l'étiquette et les verdicts.

## 5. Contrôler

```bash
node scripts/release-check.mjs --target demo --version <étiquette>
```

Trois preuves, lues sur le site de la cible :

1. la sonde `/api/sante-fonctionnelle` (LX-01) dit l'état « ok », l'application `diasporale-com`, la
   source « engine », le moteur configuré et joint ;
2. la version servie est l'étiquette attendue ;
3. le **moteur visé** est celui de la cible : la politique de sécurité du contenu (`connect-src`,
   construite à partir de l'adresse du moteur au moment de la construction) autorise l'origine de
   `DIASPORALE_<CIBLE>_CONVEX_URL`, et aucune origine d'un autre moteur.

Le contrôle ne suit aucune redirection : une protection d'accès posée sur le domaine public le ferait
échouer (le contrôle privé de l'étape 8 passe, lui, par la ligne de commande de l'hébergeur). Ses
messages nomment les variables ; une erreur du réseau n'est jamais recopiée, car elle peut citer une
adresse.

## 6. Revenir en arrière

### 6.1 Le site

```bash
node scripts/rollback.mjs --target demo --to <déploiement servi avant la bascule> --version <son étiquette>
```

Le déploiement et son étiquette sont ceux que l'étape 5 a relevés (`release.json`) ; après un contrôle
public en écart, `release.mjs` affiche la commande exacte. Avec `--execute`, après la phrase « REVENIR
<cible> <version> », le script :

1. vérifie que le déploiement désigné existe, est prêt, a été publié pour la production de la cible
   et appartient au projet de `DIASPORALE_<CIBLE>_VERCEL_PROJECT_ID` ;
2. le remet en service par promotion (`vercel promote`) : **rien n'est reconstruit ni supprimé** ;
3. contrôle que le site dit de nouveau l'étiquette attendue, sur le bon moteur.

Si le contrôle privé échoue (étape 8), il n'y a rien à défaire : le domaine n'a pas changé. À la toute
première publication d'une cible, aucun déploiement précédent n'existe : revenir en arrière consiste
alors à retirer le domaine du projet, geste du propriétaire dans le tableau de bord de l'hébergeur.

### 6.2 Le backend du moteur

Ces scripts ne touchent à aucun backend. La session du moteur remet un backend en arrière en
republiant le commit précédent d'ANTSIA (essai à blanc d'abord, jamais d'index supprimé sans
décision). L'ordre entre le site et le backend se fixe dans l'accord ; après chaque geste,
`release-check.mjs` dit si le site sert encore sa version sur le bon moteur.

## 7. Ce que ces scripts ne couvrent pas

- **L'image autoportante** (`apps/diasporale_com/Dockerfile`) : le secours si la décision
  d'hébergement (A10) l'impose. Son plan se lit avec `bun run --cwd ../ANTSIA deploy:diasporale`
  (`scripts/deploy-app.mjs` du moteur, plan seulement). Elle n'a jamais été construite.
- **Le backend du moteur** : publié et remis en arrière par sa session (lot EX-01 du moteur, même
  forme).
- **La remise à zéro de la démonstration** : `../ANTSIA/docs/23_ENVIRONNEMENT_DE_DEMONSTRATION.md`, § 5.
- **La création du réseau en production** : `docs/36_MISE_EN_PRODUCTION.md`.

## 8. Correspondance avec la méthode tenue hors dépôt (22/10 au 3/11/2026)

| Méthode hors dépôt | Dans le dépôt |
|---|---|
| Préparation : `git archive` des deux commits dans un dossier neuf, `.vercelignore`, empreinte des sources | étape 4 (`freezeContext`, `release-lib.mjs`) ; même liste d'exclusions |
| Publication : `vercel deploy --prod --archive=tgz`, cinq variables publiques en construction et en exécution, les deux commits et l'empreinte en métadonnées | étape 6, avec `--skip-domain` : la bascule devient une étape séparée |
| État `READY` relu par `vercel inspect` | étape 7 |
| Contrôle privé par `vercel curl` avant la bascule | étape 8 |
| Bascule manuelle (`vercel promote`) | étapes 9 et 10, derrière une seconde phrase |
| Contrôles après coup : santé, politique de sécurité limitée au bon backend | étape 11 (`release-check.mjs`) |
| Retour arrière : promotion manuelle du déploiement précédent, noté à la main | `rollback.mjs`, cible relevée à l'étape 5 |
| Identifiants de projet, d'équipe et de backend écrits dans les scripts | variables de la machine, lues à l'exécution |
