---
title: "DIASPORALE — Audit des skills et couverture des compétences"
date: "2026-10-18"
version: "1.0"
statut: "Audit statique de 18 skills ; aucune installation ni modification des skills"
---

# DIASPORALE — Audit des skills

## 1. Verdict et portée

**Les skills de produit et de design sont utiles pour structurer le travail. Plusieurs skills techniques contiennent des exemples défectueux, des dépendances absentes ou des hypothèses incompatibles avec le moteur actuel.** Ils ne doivent pas être copiés sans contrôle.

L’audit a lu **18 fichiers SKILL.md**, vérifié leurs ressources locales pertinentes et confronté certains exemples au code/package installé. Aucun exemple n’a été exécuté ; aucun script, plugin, environnement ou skill n’a été modifié. Les problèmes ci-dessous concernent les **skills**, pas des vulnérabilités démontrées dans DIASPORALE.

Ce périmètre sélectionné couvre les compétences pertinentes à la demande. Il ne constitue pas un audit de toute la bibliothèque, ni un audit de sécurité complet des dépendances.

Pour l’étude actuelle, les trois skills appliqués comme méthodes sont **plan-big-execute-small**, **competitive-brief** et **design-system**. Les autres ont été examinés pour définir leur usage futur. Le [plan global](14_PLAN_GLOBAL_IMPLEMENTATION_DIASPORALE.md) reste le contrat d’exécution proposé.

## 2. Matrice des 18 skills

Verdicts : **retenir** = méthode utilisable dans son périmètre ; **adapter** = méthode utile avec préambule projet ; **écarter les exemples** = ne pas en faire une référence de code ; **ressource indisponible** = fonction annoncée non utilisable telle quelle localement.

| Skill et source exacte | Verdict | Compétence / lots | Adaptation nécessaire |
|---|---|---|---|
| [competitive-brief](/Users/okatech/.codex/plugins/cache/claude-cowork/product-management/1.2.0/skills/competitive-brief/SKILL.md) | Retenir | Comparaison et différenciation ; G0/G11 | Sources datées ; pas de note concurrentielle inventée |
| [write-spec](/Users/okatech/.codex/plugins/cache/claude-cowork/product-management/1.2.0/skills/write-spec/SKILL.md) | Retenir avec préambule | Spécifications, acteurs, scénarios ; tous lots | Ajouter réseau, droits, données et preuves de sortie |
| [roadmap-update](/Users/okatech/.codex/plugins/cache/claude-cowork/product-management/1.2.0/skills/roadmap-update/SKILL.md) | Retenir | Priorités, dépendances ; tous lots | Les scores RICE exigent des données ; pas d’effort chiffré fictif |
| [design-system](/Users/okatech/.codex/plugins/cache/claude-cowork/design/1.2.0/skills/design-system/SKILL.md) | Retenir | Jetons, composants, états ; G1/G6 | Prolonger la charte Sable ; ne pas remplacer les primitives |
| [accessibility-review](/Users/okatech/.codex/plugins/cache/claude-cowork/design/1.2.0/skills/accessibility-review/SKILL.md) | Adapter/corriger | Clavier, focus, lecteurs d’écran ; tous lots | Corriger le niveau WCAG et compléter médias/2.2 |
| [user-research](/Users/okatech/.codex/plugins/cache/claude-cowork/design/1.2.0/skills/user-research/SKILL.md) | Retenir avec préambule | Entretiens et tâches ; G1/G11 | Consentement, diversité des profils, connectivité, langues |
| [design-critique](/Users/okatech/.codex/plugins/cache/claude-cowork/design/1.2.0/skills/design-critique/SKILL.md) | Retenir | Hiérarchie et cohérence ; G1/G6 | Juger les surfaces réelles et leurs états, pas une capture idéale seule |
| [architecture](/Users/okatech/.codex/plugins/cache/claude-cowork/engineering/1.2.0/skills/architecture/SKILL.md) | Retenir | ADR et arbitrages ; G0/G5/G6/G7 | Réutilisation ANTSIA avant toute nouvelle pile |
| [testing-strategy](/Users/okatech/.codex/plugins/cache/claude-cowork/engineering/1.2.0/skills/testing-strategy/SKILL.md) | Adapter | Plan par risque ; tous lots | Trame courte ; ajouter concurrence, réseau fermé, média et appareils |
| [api-security-best-practices](/Users/okatech/.codex/plugins/cache/claude-cowork/anthropic-skills/1.0.0/skills/api-security-best-practices/SKILL.md) | Adapter ; revoir exemples | Menaces, autorisation objet, débit ; G9 | Exemples Express/JWT/Prisma distincts de Better Auth/Convex |
| [convex-backend](/Users/okatech/.codex/plugins/cache/claude-cowork/anthropic-skills/1.0.0/skills/convex-backend/SKILL.md) | Écarter les exemples en l’état | Liste des sujets backend | Plusieurs erreurs avérées ; guidelines ANTSIA et docs officielles prioritaires |
| [module-architecture](/Users/okatech/.codex/plugins/cache/claude-cowork/anthropic-skills/1.0.0/skills/module-architecture/SKILL.md) | Adapter | Réutilisation et frontières ; G0/G2/G7 | Catalogue historique, structure différente de celle du moteur |
| [workflow-state-machine](/Users/okatech/.codex/plugins/cache/claude-cowork/anthropic-skills/1.0.0/skills/workflow-state-machine/SKILL.md) | Adapter | Demandes, réservations, adhésions ; G3/G5 | Ajouter permissions, versions, idempotence et i18n |
| [ui-ux-pro-max](/Users/okatech/.codex/plugins/cache/claude-cowork/anthropic-skills/1.0.0/skills/ui-ux-pro-max/SKILL.md) | Ressource indisponible ; checklist partielle utile | Repères d’interaction ; G1 | Recherche locale annoncée absente ; pas de nouvelle charte générée |
| [tailwind-styling](/Users/okatech/.codex/plugins/cache/claude-cowork/anthropic-skills/1.0.0/skills/tailwind-styling/SKILL.md) | Adapter fortement | Composition responsive ; G1 | Cible v3 périmée pour le catalogue v4.3.3 ; jetons DIASPORALE obligatoires |
| [plan-big-execute-small](/Users/okatech/.agents/skills/plan-big-execute-small/SKILL.md) | Retenir avec outils actuels | Découpage, audits indépendants | Noms de primitives à adapter ; propriété des fichiers et ressources bornées |
| [memoire](/Users/okatech/.agents/skills/memoire/SKILL.md) | Ressource indisponible dans ce contexte | Décisions et registre des modules | Vault absent au chemin attendu ; ne pas prétendre l’avoir consulté |
| [vercel:chat-sdk](/Users/okatech/.codex/plugins/cache/openai-curated-remote/vercel/0.54.1/skills/chat-sdk/SKILL.md) | Hors cœur iCom | Bots ou intégrations futures | Ne remplace ni messagerie personnelle, ni appels, ni E2EE |

## 3. Problèmes constatés et remèdes

### S-01 — Bundle UX incomplet

Dans `ui-ux-pro-max/SKILL.md`, lignes 133–149, la recherche locale est présentée comme obligatoire et appelle `scripts/search.py` ; `ui-reasoning.csv` est annoncé comme base de raisonnement. Le bundle installé ne contient que `SKILL.md`, sans ce script ni ce CSV. Le script est également absent aux chemins `.claude` vérifiés dans DIASPORALE, ANTSIA et le dossier utilisateur ; le CSV n’a pas fait l’objet d’une recherche séparée dans chacun de ces derniers emplacements.

Le skill propose également installation de Python, génération d’un nouveau design system, puis implémentation. Ces étapes ne sont pas appropriées à cette demande d’étude avec une charte existante. Les nombres de palettes, associations typographiques et graphiques divergent entre son frontmatter et son introduction.

**Traitement :** garder les conseils généraux d’ergonomie ; ne pas lancer les commandes annoncées, ne pas inventer les résultats du moteur de recherche, ne pas remplacer Sable. Une réparation éventuelle du bundle appartient à un travail distinct de gestion des skills.

### S-02 — Hypothèse Tailwind périmée

Le skill `tailwind-styling`, ligne 11, affirme « tous Tailwind v3 ». Le catalogue ANTSIA lu pendant l’audit fixe **Tailwind 4.3.3**. Ses palettes institutionnelles, styles `:root` et exemples de badges à couleurs directes ne représentent pas les rôles DIASPORALE.

**Traitement :** suivre le catalogue installé et les fichiers CSS du moteur ; réécrire les exemples en rôles sémantiques du thème. La charte locale et les tests de contrat priment sur l’exemple générique.

### S-03 — Exemples Convex dangereux à recopier

Constats dans `convex-backend/SKILL.md` :

| Lignes | Défaut dans l’exemple | Risque si copié | Correction requise |
|---|---|---|---|
| 521–532 | `deleteRequest` utilise les permissions d’un `userId` fourni par le client | Usurpation d’autorité si aucune garde supplémentaire | Déduire l’acteur de la session et vérifier le droit sur l’objet |
| 544–565 | Curseur déclaré mais jamais appliqué ; même `.take()` | Répétition de la première page | Pagination réelle, stable et bornée |
| 1034–1051 | Migration relisant le premier lot sans progression | Boucle sans avancement pour un lot complet | Curseur/checkpoint persistant et reprise idempotente |
| 461 et 1445 | `v.any()` proposé ou admis si documenté | Contrat non conforme au projet | Validateurs précis, aucun passe-droit |
| 399, 602, 723, 1008, 1169 | `.collect()` sans borne démontrée | Lecture non maîtrisée | Index et pagination ; borne justifiée si collecte |

Le skill contient ailleurs de bons avertissements, notamment contre la confiance accordée à un identifiant client. Le problème est son **incohérence interne**, pas l’absence totale de bons conseils.

**Traitement :** utiliser le skill comme liste de thèmes à examiner, pas comme bibliothèque de code. Les constructeurs de fonctions, gardes et projections déjà testés dans ANTSIA sont la référence.

### S-04 — Exemples d’API et CLI Convex non alignés

Le package Convex installé, version 1.45.0 inspectée, ne correspond pas à plusieurs exemples : imports `query`/`mutation`/`rawMutation` directement depuis `convex/server`, `cronJob`, `v.int32()`, `v.string().pick(...)` et `q.regex(...)`. Les API doivent être vérifiées dans la version réellement utilisée ; la documentation officielle des queries importe le constructeur depuis `_generated/server` **du même projet**. [Convex — Queries](https://docs.convex.dev/functions/query-functions).

Les commandes ou options `--dry-run-migrations`, `push` et `generate-client` proposées dans le skill ne figurent pas dans le programme CLI inspecté. `codegen` y figure. **`insights --details` existe**, et n’est pas retenu comme erreur.

Le skill mentionne une commande de production sans rappeler le garde-fou du propriétaire. Une commande présente dans une documentation n’accorde jamais l’autorisation de l’exécuter.

**Traitement :** lire `guidelines.md`, les wrappers du moteur et la documentation officielle ; utiliser le lanceur Node supporté. Aucune commande vers la production dans un audit ou une étude.

### S-05 — Exemples de sécurité API à adapter

Dans `api-security-best-practices`, le middleware exige `issuer` et `audience` (196–202), tandis que l’exemple de renouvellement n’ajoute pas ces champs au jeton (289–296). L’exemple Zod ignore la valeur renvoyée par `schema.parse(req.body)` (442), puis le handler reprend le corps brut (458), ce qui perd les transformations éventuelles.

**Traitement :** conserver le modèle de menace et la revue d’autorisation, revoir les snippets, puis les adapter au contrat Better Auth/Convex existant. Ne pas reconstruire un système de mots de passe ou de JWT parallèle. Conserver l’entrée IDN et code à usage unique prévue au §6.2 du [cahier DIASPORALE](00_CAHIER_DES_CHARGES_DIASPORALE.md).

### S-06 — Machines à états et architecture modulaires incomplètes

Le skill `workflow-state-machine` recommande de vérifier les permissions, mais son exemple ne montre que lecture et transition (63–82), accepte un statut en chaîne libre et utilise des couleurs/libellés bruts. Une transition valide n’est pas une autorisation.

`module-architecture` impose un fichier Convex par module alors que le moteur organise des tranches ; son exemple de barre latérale utilise aussi une variable `position` non définie. Son catalogue ne remplace pas l’inventaire actuel des sources.

**Traitement :** conserver les matrices de transitions ; ajouter acteur, scope, état courant, version, échéance, débit, effets et audit. Suivre la structure réelle ANTSIA, sans déplacer artificiellement les modules pour correspondre au skill.

### S-07 — Mauvais niveau d’un critère d’accessibilité

`accessibility-review` place le critère **2.5.5 / 44 px** sous le titre « WCAG 2.1 AA ». Le W3C le classe **AAA**. Le critère **2.5.8 de WCAG 2.2**, de niveau AA, prévoit 24 × 24 px avec exceptions. [W3C 2.5.5](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html), [W3C 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

**Traitement :** garder 44 px comme objectif ergonomique du projet, corriger l’étiquette normative et compléter la recette vidéo, mouvement, gestes alternatifs et lecteur d’écran. Ne pas déduire une conformité globale d’une checklist.

### S-08 — Ressources et outils supposés

- Les `CONNECTORS.md` référencés dans les bundles produit/design/engineering sont présents. Les placeholders décrivent des catégories de connexions ; ils ne prouvent pas qu’un compte Figma, Slack, Linear ou Notion est connecté.
- Les ressources `node_modules/chat/docs` et `node_modules/chat/resources/templates.json` du skill Chat SDK sont absentes des workspaces DIASPORALE et ANTSIA. Cela ne justifie pas une installation pour cette étude.
- Plusieurs skills complémentaires cités par les deux gros skills techniques ne sont pas dans les racines inventoriées ou le catalogue exposé : notamment `auth-patterns`, `convex-migration-helper`, `convex-performance-audit`, `react-vite-spa`, `nextjs-app-router`.
- Le playbook de délégation cite `send_input`, `close_agent`, `update_plan` et une signature `role` qui ne correspondent pas aux outils exposés ici. L’intention reste applicable avec `agent_type`, `send_message` et `followup_task`.

**Traitement :** vérifier les outils et ressources avant emploi ; ne pas annoncer une publication de wiki, création de tickets, exécution de script ou connexion externe qui n’a pas eu lieu.

### S-09 — Mémoire de projet inaccessible

Le chemin `/Users/okatech/Documents/Obsidian Vault` était absent, sans lien symbolique ; `OKATECH_VAULT` n’était pas défini dans le contexte inspecté. Le script `resolve-slug.sh` existe mais son chemin par défaut mène au même emplacement ; il quitte silencieusement si le mapping manque. Le skill `memoire` demande également d’ignorer des fichiers absents.

**Traitement :** consigner cette limite ; s’appuyer sur les décisions présentes dans les dépôts et l’historique vérifié. Ne pas créer un second vault, réécrire la mémoire ou affirmer avoir consulté le registre partagé des modules.

## 4. Compétences réellement nécessaires de A à Z

Les compétences ci-dessous complètent les méthodes générales. Aucun des 18 skills audités ne fournit à lui seul une application équivalente à TikTok, Instagram ou WhatsApp.

| Domaine | Ce que les skills couvrent | Expertise ou guide à ajouter au dispositif |
|---|---|---|
| Produit diaspora | Personae, étude concurrentielle, spécifications | Recherche locale, animation associative, modèle de confiance |
| UI et design system | Composants, hiérarchie, états | Recette réelle des gestes, médias, accessibilité et mobile |
| Domaine et données | États, API, tests génériques | Contrats ANTSIA, concurrence métier, réseau/audience, effacement |
| Vidéo publiée | Checklists visuelles | Admission, transcodage, ABR, sous-titres, dérivés privés, coûts |
| Recommandation | Objectifs et priorisation | Démarrage à froid, diversité, mesure, confidentialité et contrôle utilisateur |
| Messagerie | Temps réel générique | Idempotence, livraison, multiappareil, reprise, pièces jointes |
| Appels | Architecture générale | WebRTC, LiveKit, TURN, sonnerie, qualité, cycle de vie natif |
| E2EE | Sensibilisation sécurité | Protocoles éprouvés, clés, appareils, récupération et revue cryptographique |
| Associations | Spécifications et états | Mandats, adhésions consenties, passation, gouvernance et événements |
| Services | PRD et transitions | Catalogue, prix, ressources, réservation, avis, litiges, obligations par pays |
| Modération | Sécurité API | Processus humain, recours, harcèlement, média et contenu signalé en contexte E2EE |
| Paiements futurs | Arbitrages | PSP, pays, remboursements, rapprochement, support et contrôle juridique |
| Natif | Repères de stacks | PushKit/CallKit, Telecom, FCM/APNs, réseau faible et appareils physiques |
| Exploitation | Méthodes de tests | SLO, budgets, alertes, reprise, sauvegardes et incident média/RTC |

Les skills Zoom répertoriés dans le catalogue n’ont pas été audités dans ce périmètre et ne constituent pas une raison de remplacer LiveKit. Leur présence ne prouve pas qu’un outil Zoom soit connecté. Un choix de fournisseur résulte des besoins et du système existant, pas de la quantité de skills disponibles.

## 5. Chaîne de travail recommandée

1. **Cadrer** avec `competitive-brief` et les sources datées ; décrire faits, hypothèses et recommandations.
2. **Spécifier** avec `write-spec` : acteur, besoin, données, droits, erreurs, transitions, critères d’acceptation.
3. **Prioriser** avec `roadmap-update`, selon valeur, dépendances, risque et capacité réelle.
4. **Concevoir** avec `design-system`, `user-research`, `design-critique` et la checklist d’accessibilité corrigée.
5. **Choisir l’architecture** avec `architecture` et les ADR ANTSIA, après inventaire de réutilisation.
6. **Exécuter par tranche** avec `plan-big-execute-small`, sur les vrais fichiers, propriétaires définis et tâches indépendantes seulement.
7. **Vérifier** avec `testing-strategy` enrichi : domaine, gardes, composants, recette, appareils et observation du service réellement délivré.
8. **Documenter** la preuve, ses limites et la prochaine tranche ; les actions externes gardent leurs autorisations propres.

La consigne de modèle pour le code dans les instructions du dépôt doit être conciliée avant une délégation de code future ; cette étude n’a délégué que lecture et recherche. Aucun changement silencieux de modèle ou de politique de livraison n’est proposé.

### Préambule obligatoire des futures tâches

> Travailler dans le source réellement servi. Réutiliser ANTSIA. Toute opération sociale est bornée par le réseau, la session, l’adhésion, l’audience et les droits courants. Aucun dossier consulaire ni personne importée automatiquement. Consentements explicites, contact protégé, gratuité communautaire. Code anglais, interface FR/EN, jetons DIASPORALE, TypeScript strict. Ne pas modifier les primitives shadcn. Préserver les changements partagés. Aucune publication, suppression ou configuration sensible sans l’autorité correspondante. Distinguer présence dans le code, tests, recette et production.

Pour les champs d’identité civile effectivement nécessaires : normaliseur partagé et testé des noms/prénoms ; ne pas appliquer mécaniquement cette convention aux organisations ou aux noms sociaux choisis. Aucun justificatif déjà signé n’est réécrit pour sa casse.

## 6. Guides projet à préparer lors des lots concernés

Il s’agit de **propositions de guides**, pas de nouveaux skills installés. Ils peuvent vivre comme procédures du dépôt avant une éventuelle transformation en skills.

| Guide proposé | Entrée / sortie | Preuve attendue |
|---|---|---|
| `social-media-delivery` | Média admis → variantes autorisées et retirables | Upload interrompu, accès refusé, révocation des dérivés |
| `social-discovery` | Inventaire admissible → liste diverse et explicable | Ordre stable, contrôle utilisateur, absence de fuite |
| `icom-delivery` | Message créé → état de livraison honnête | Reconnexion, doublon, plusieurs appareils |
| `rtc-call-lifecycle` | Intention d’appel → fin corrélée sur tous les appareils | Audio réel, sonnerie, TURN, blocage et réseau perdu |
| `private-communications` | Modèle de menace → décision E2EE et plan de clés | Revue spécialisée, appareils révoqués, récupération |
| `diaspora-service-booking` | Demande → proposition → réservation → résultat | Version, collision, annulation, avis admissible |
| `association-governance` | Mandat → rôles → adhésions → passation | Droits retirés, aucun membre ajouté d’office |
| `native-social-recipe` | Build identifié → parcours iOS/Android réels | Push, écran verrouillé, audio/Bluetooth, sortie globale |

Chaque guide doit nommer le module existant, la version technique vérifiée, les préconditions, les fichiers possédés, les actions interdites, les données admissibles et la procédure de preuve. Son succès se constate sur le module réel ; le fait de lire un guide ne valide rien à lui seul.

## 7. Corrections à prioriser dans la bibliothèque

| Priorité | Action proposée | Effet recherché |
|---|---|---|
| P0 | Corriger ou mettre en avertissement les snippets Convex S-03/S-04 | Empêcher une copie de logique d’autorisation ou de pagination fausse |
| P1 | Réparer les exemples de sécurité S-05 | Éviter un contrat de jeton incohérent ou des transformations validées mais non réutilisées |
| P1 | Signaler les ressources UX absentes | Ne plus faire dépendre une tâche d’un script inexistant |
| P1 | Actualiser Tailwind et les règles de jetons | Respecter la stack réelle et la charte du produit |
| P1 | Corriger WCAG et enrichir la recette média | Exprimer les niveaux correctement et vérifier les usages |
| P2 | Actualiser noms d’outils et références croisées | Procédures exécutables avec l’environnement présent |
| P2 | Retrouver le vault et rendre son absence visible | Restaurer la continuité sans créer une mémoire concurrente |

Ces corrections n’ont pas été appliquées aux bundles installés. Les documents d’étude évitent les exemples défectueux ; les futurs développements doivent s’appuyer sur les contrats réels du moteur et les sources officielles vérifiées.
