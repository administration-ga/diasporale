# Mise en production de diasporale.com

> Lot DS-06 du plan 17 (`docs/etudes/2026-11-10-finalisation/17_LANCEMENT_PILOTE_EXPLOITATION_MODELE_ECONOMIQUE.md`),
> repris du plan 15 du moteur. Ce document vit dans un dépôt public : il nomme des variables, jamais
> leur valeur ; il ne cite aucun identifiant de projet, d'équipe ou de déploiement.
>
> **État au 10/11/2026 : rien de ce qui suit n'a été fait.** `diasporale.com` ne répond pas ; aucun
> backend de production n'a de réseau `diasporale` ; le réseau n'a jamais été créé par la console (la
> démonstration a été semée par la graine). Chaque étape dit qui agit, ce qu'il fait et la preuve
> qu'elle est faite ; on ne passe à la suivante qu'avec la preuve de la précédente.

## 0. Avant de commencer

**Les portes.** Rien ne commence sans les décisions du § 12 : hébergement (A10), domaine, secrets,
création du réseau, responsables du réseau, textes relus par un juriste. Toute commande vers un
backend ou un hébergeur de production exige l'accord écrit et détaillé du propriétaire (commit de
chaque dépôt, cible, ordre, retour arrière ; `docs/37_PUBLICATION_ET_RETOUR_ARRIERE.md`, § 1).

**Les lots qui doivent être fusionnés et vérifiés avant.** DS-05 (campagne de recettes sur le
moteur), LX-01 (sonde vraie et garde de la source, fusionné), LX-02 (publication et retour arrière,
`docs/37`), LX-03 (responsables du réseau), LX-05 puis DS-07 (textes), et, côté moteur, EX-06
(préparation d'un réseau dans la console) et EX-19 (liste de contrôle du lancement et bascule de
domaine).

**Jamais en production** : un compte de démonstration (ADR-0029 et ADR-0038 du moteur), une graine
(`seeds/foundations` refuse par construction), la source de données « demo » (garde de construction
LX-01).

## 1. Le backend du moteur est publié

**Qui** : la session du moteur (S1), sur accord.

- Le backend de production est publié depuis le commit d'ANTSIA nommé dans l'accord. Ce commit porte
  la tranche `convex/modules/diaspora/` que le site lit, et la sonde `health:ping` que la sonde du
  site (LX-01) joint.
- L'environnement du backend de production ne porte **ni** `ANTSIA_DEMO_DEPLOYMENT`, **ni**
  `ANTSIA_DEV_TOOLS`, **ni** `ANTSIA_SEEDS_ALLOWED` : le catalogue des comptes de démonstration y
  reste vide, et toute graine y est refusée.
- Le réseau racine existe (il sert antsia.ga) : un réseau fermé ne se crée que sous lui.

**Preuve** : le commit publié est noté dans l'accord ; l'essai à blanc n'annonce aucun index
supprimé ; `modules/diaspora/demoAccounts:catalogue` rend `[]` sur ce backend.

## 2. Le réseau est créé par la console

**Qui** : un administrateur de plateforme du moteur, dans la console (« Réseaux » › « Créer un
réseau »).

La console crée toujours un réseau **fermé**, **enfant de la racine** : ni le genre ni le parent ne
se saisissent. Les valeurs sont celles de la graine du domaine, que rend
`diasporaleConsoleNetworkForm()` de `@diasporale/domain` (`packages/diasporale-domain/src/console-network.ts`) ;
un test vérifie que ce document en est la copie exacte.

| Champ de la console | Valeur à saisir |
|---|---|
| Identifiant public | `diasporale` |
| Nom du réseau | `DIASPORALE` |
| Politique d’adhésion | « Déclarée ou vérifiée » (`declared_or_verified`) |
| Visibilité par défaut | « Dans ce réseau » (`network`) |
| Portées autorisées | `local, diaspora` |
| Pays ouverts | `FR` |
| Thème | `diasporale` |
| Admission du réseau | « Tranche d’admission DIASPORALE » (`diaspora`) |
| Schéma de facette (JSON) | le bloc ci-dessous, tel quel |
| Motif de la décision | rédigé par l'opérateur, 10 à 500 caractères, avec la date de l'accord du propriétaire |

```json
{
  "fields": [
    {
      "key": "countryOfResidence",
      "kind": "country",
      "required": true,
      "defaultVisibility": "network",
      "excludedValues": [
        "GA"
      ]
    },
    {
      "key": "city",
      "kind": "text",
      "required": false,
      "defaultVisibility": "hidden",
      "maxLength": 80
    },
    {
      "key": "postSlug",
      "kind": "text",
      "required": false,
      "defaultVisibility": "hidden",
      "maxLength": 80
    },
    {
      "key": "associationIds",
      "kind": "textList",
      "required": false,
      "defaultVisibility": "hidden",
      "maxItems": 20
    },
    {
      "key": "arrivedAt",
      "kind": "year",
      "required": false,
      "defaultVisibility": "hidden"
    },
    {
      "key": "helpAvailable",
      "kind": "boolean",
      "required": false,
      "defaultVisibility": "network"
    }
  ]
}
```

Le même texte se régénère depuis la racine de DIASPORALE :

```bash
bun -e 'import { diasporaleConsoleNetworkForm } from "./packages/diasporale-domain/src/index.ts"; console.log(diasporaleConsoleNetworkForm().facetSchema)'
```

À relire avant d'enregistrer :

- **l'admission ne se change plus après la création** : un réseau créé avec l'admission générique
  ignorerait la nationalité, le parrainage et l'attestation consulaire, et ne se corrige pas par un
  réglage ;
- seuls le pays de résidence (jamais le Gabon) et la disponibilité pour l'entraide sont lisibles du
  réseau par défaut ; aucun champ n'est lisible depuis la racine ;
- l'identifiant public est unique : s'il existe déjà, la console refuse (conflit).

**Preuve** : la console liste le réseau avec « Tranche d’admission DIASPORALE » ; le journal des
décisions porte la création et son motif ; la lecture publique `modules/networks/networks:getBySlug`
(`slug` `diasporale`) rend `managedBy: "diaspora"`.

## 3. Le premier passage nocturne crée le hub de la France

**Qui** : personne, le moteur. La tâche planifiée « compteurs des hubs DIASPORALE » (chaque jour à
2 h 30 UTC) crée le hub de chaque pays ouvert et compte ses membres ; la mesure du pilote suit à
2 h 50 UTC. Rien n'est créé à la main.

**Preuve** : après la nuit qui suit la création du réseau, la santé du moteur (console) montre les
tâches planifiées passées (relevé global), et le hub de la France se lit sur le site. Aucune
annonce avant.

## 4. L'équipe de modération France et les responsables du réseau

**Qui** : un administrateur de plateforme dans la console du moteur, puis l'administration du réseau
dans le bureau de modération de diasporale.com, sur les noms désignés par le propriétaire.

- « Équipes de modération » : créer l'équipe de la France pour le réseau DIASPORALE, avec son motif,
  puis y placer les modérateurs désignés. Règle du projet : pas de pays ouvert sans modération.
- Responsables du réseau (administrateur et modérateur du réseau, lecteurs de `/pilote` et juges des
  recours ; lots EX-08 du moteur, MD-01 et LX-03, décision 3 du plan 17) :
  1. **Le premier administrateur** : un administrateur de plateforme, dans la console (section
     « Équipes », bloc « Responsables du réseau », réseau DIASPORALE), nomme la personne désignée,
     motif à l'appui. La console ne trouve un membre de DIASPORALE par son identifiant que s'il a
     choisi de paraître dans l'annuaire du réseau : la personne désignée doit l'avoir choisi au moment
     de la nomination (le rôle reste si elle le retire ensuite).
  2. **Les suivants** : l'administrateur nommé ouvre le bureau de modération (`/moderation`, onglet
     « Équipe », bloc « Responsables du réseau ») et nomme le second administrateur et les modérateurs
     du réseau par leur identifiant public, motif à l'appui. Recommandation du plan 14 (décision 2) :
     deux administrateurs, pour que nul ne juge le recours de sa propre décision.
  3. **Ce que le moteur tient sur les deux chemins** : seule une personne membre active, au statut
     « déclarée » au moins, reçoit un rôle ; aucune adhésion n'est créée ; le dernier administrateur
     actif ne se retire pas ; un départ du réseau retire le rôle ; chaque nomination, changement ou
     retrait entre au journal du moteur (`membership.role_set`) et vaut au geste suivant de la personne.
  4. **Jamais** : un rôle posé par une graine ou par la porte des comptes de démonstration.

**Preuve** : l'équipe est active dans la console ; la personne nommée ouvre `/pilote` et la file des
recours ; retirée, elle reçoit le refus indistinct au geste suivant. Le parcours est prouvé sur un
backend de test, sans la porte de démonstration (`convex/modules/diaspora/responsibles.test.ts` du
moteur) ; il reste à le constater en réel.

## 5. La mise en relation

**Qui** : un administrateur de plateforme, dans la fiche du réseau, panneau « Conversations de mise
en relation ».

Trois natures, fermées par défaut : demandes de service, mentorats acceptés, candidatures
présélectionnées. Chacune s'ouvre séparément, avec un motif d'au moins dix caractères inscrit au
journal. Lesquelles ouvrir au lancement se décide avec le lot DS-04 ; fermée, la nature bloque
toute ouverture de conversation, tout message et tout appel liés à une demande.

**Preuve** : la décision et son motif au journal ; avec de vrais comptes, « Écrire » ouvre la
conversation d'une demande (recette réelle, par le propriétaire).

## 6. Les variables (noms seulement)

### 6.1 Backend du moteur de production (posées par le propriétaire)

| Variable | Ce qu'elle doit porter pour DIASPORALE |
|---|---|
| `TRUSTED_ORIGINS` | ajouter l'origine du site (liste séparée par des virgules) ; `SITE_URL` reste celle d'antsia.ga |
| `NOTIFICATION_APPLICATIONS_JSON` | ajouter une entrée `applicationId`, `networkSlug` (`diasporale`), `origin` (celle du site), `entryPath`. Une seule entrée invalide vide **tout** le registre, celui d'ANTSIA compris : relire avant de poser. DIASPORALE ne s'en sert pas encore (notifications hors du site, lot DS-14) |
| `RESEND_FROM_ADDRESS` et `RESEND_API_KEY` | une seule adresse d'envoi par déploiement : seule la marque du message change selon le réseau. Une adresse propre à DIASPORALE est la décision 13 du plan 17 |
| `IDN_CLIENT_ID`, `IDN_CLIENT_SECRET`, `IDN_ISSUER` ou `IDN_DISCOVERY_URL` | seulement quand l'entrée par IDN s'ouvre (plan 01, lot EA-02) : client OIDC de DIASPORALE à enregistrer par le portail développeur d'identite.ga |

Ni `ANTSIA_DEMO_DEPLOYMENT`, ni `ANTSIA_DEV_TOOLS`, ni `ANTSIA_SEEDS_ALLOWED` (étape 1).

### 6.2 Site (passées par `scripts/release.mjs`, cible `production`)

Les six variables publiques du catalogue et `CONVEX_SITE_URL`. Le script les tire des variables de la
machine qui publie (`docs/37`, § 3) ; aucune ne se saisit à la main.

| Variable du site | Origine |
|---|---|
| `NEXT_PUBLIC_DIASPORALE_DATA_SOURCE` | posée par le script : `engine` |
| `NEXT_PUBLIC_SITE_URL` | `DIASPORALE_PRODUCTION_SITE_URL` : l'origine du domaine retenu (étape 7) |
| `NEXT_PUBLIC_CONVEX_URL` | `DIASPORALE_PRODUCTION_CONVEX_URL` : le backend de l'étape 1 |
| `CONVEX_SITE_URL` | `DIASPORALE_PRODUCTION_CONVEX_SITE_URL` : les actions HTTP du même backend |
| `NEXT_PUBLIC_BUILD_SHA` | posée par le script : l'étiquette tirée des deux commits |
| `NEXT_PUBLIC_IDN_PORTAL_URL` | `DIASPORALE_PRODUCTION_IDN_PORTAL_URL`, facultative : absente, le lien d'élévation ne s'affiche pas |
| `NEXT_PUBLIC_CONSULATE_URL` | `DIASPORALE_PRODUCTION_CONSULATE_URL`, facultative : idem |

Le projet d'hébergement de production se désigne par `DIASPORALE_PRODUCTION_VERCEL_PROJECT_ID`, avec
`DIASPORALE_VERCEL_ORG_ID` et `DIASPORALE_VERCEL_SCOPE`. Une même ressource déclarée pour la
démonstration et pour la production est refusée par le script.

## 7. Le domaine

**Qui** : le propriétaire. Le catalogue de publication du moteur prévoit `diasporale.com`.

Rattacher le domaine au projet d'hébergement de production, poser ses enregistrements DNS, attendre
le certificat. Son origine est celle de `DIASPORALE_PRODUCTION_SITE_URL` et de l'entrée ajoutée à
`TRUSTED_ORIGINS`.

**Preuve** : le certificat est valide ; la ligne « domaines » de la liste de contrôle du moteur
(EX-19) est cochée.

## 8. L'indexation

Aujourd'hui tout le site est exclu des moteurs de recherche (`robots: { index: false, follow: false
}` dans `apps/diasporale_com/src/app/layout.tsx`), sans plan du site. Recommandation du plan 17
(décision 5) : indexer la vitrine seule au lancement, **jamais une page de membre**. C'est un
changement de code, dans un lot à part, livré et vérifié avant l'ouverture ; sans lui, le site reste
exclu, ce qui est sûr.

**Preuve** : seules les pages de la vitrine perdent l'exclusion, vérifié sur la version servie.

## 9. La publication du site et son contrôle

**Qui** : l'opérateur désigné, sur accord écrit (commits, cible `production`, ordre, retour arrière).

```bash
node scripts/release.mjs --target production --antsia <commit ANTSIA> --diasporale <commit DIASPORALE>
```

Le plan d'abord, puis `--execute` et ses deux phrases (`docs/37`, § 4). Le contrôle public dit l'état
« ok », la version attendue, la source « engine », le moteur joint, et une politique de sécurité
limitée au backend de production. Il se rejoue seul :

```bash
node scripts/release-check.mjs --target production --version <étiquette>
```

Puis, à la main : `/entrer` ne montre aucun panneau de comptes de démonstration ; les routes clés
s'affichent à 390 et 1 440 px ; un vrai compte entre (recette réelle, plan 01, lot EA-06).

**Preuve** : la version servie est l'étiquette de l'accord ; le rapport de recette daté (dans
`docs/recette/`) cite les deux commits, l'étiquette et les verdicts, aucun identifiant.

## 10. Le retour arrière

- **Le site** : `node scripts/rollback.mjs --target production --to <déploiement précédent> --version
  <son étiquette>` (`docs/37`, § 6). À la toute première publication, il n'y a pas de déploiement
  précédent : revenir en arrière consiste à retirer le domaine du projet (geste du propriétaire).
- **Un pays** : retiré des pays ouverts par la console (réglage du réseau, avec motif) ; rien n'est
  supprimé.
- **Le réseau** : jamais supprimé ; son archivage exige deux administrateurs de plateforme (une
  demande, puis une approbation par un autre).
- **Le backend** : la session du moteur republie le commit précédent d'ANTSIA, jamais d'index
  supprimé sans décision.

## 11. Données personnelles : sous-traitants et lieux d'hébergement

À remplir par le propriétaire avant l'ouverture ; ce document n'affirme rien à leur sujet.

| Service | Sous-traitant | Lieu d'hébergement des données | Contrat de sous-traitance |
|---|---|---|---|
| Hébergement du site | à remplir | à remplir | à remplir |
| Backend du moteur (base, fichiers, fonctions) | à remplir | à remplir | à remplir |
| Envoi des courriels | à remplir | à remplir | à remplir |
| Appels audio et vidéo | à remplir | à remplir | à remplir |
| Identité numérique (IDN) | à remplir | à remplir | à remplir |

## 12. Décisions et gestes qui restent au propriétaire

1. **Hébergement (A10, décision 4 du plan 17)** : confirmer l'hébergeur déjà employé pour la
   démonstration, ou l'image autoportante en secours ; créer le projet de production et le régler.
2. **Domaine** : le détenir, le rattacher, poser ses DNS (étape 7).
3. **Secrets et variables du backend** : `TRUSTED_ORIGINS`, `NOTIFICATION_APPLICATIONS_JSON`, adresse
   d'envoi et sa clé, client IDN le moment venu (étape 6.1) ; variables de la machine qui publie
   (`docs/37`, § 3).
4. **Création du réseau** : la faire, ou la confier nommément à un administrateur de plateforme, avec
   le motif (étape 2).
5. **Responsables du réseau (décision 3)** : désigner les deux personnes ; le premier administrateur
   est nommé à la console par un administrateur de plateforme, les suivants par l'administration du
   réseau dans le bureau (étape 4). Aucun code ne nomme personne à la place du propriétaire.
6. **Modérateurs de l'équipe France** (étape 4).
7. **Natures de mise en relation ouvertes au lancement** (étape 5, avec DS-04).
8. **Adresse d'envoi propre à DIASPORALE ou commune (décision 13)**.
9. **Indexation de la vitrine (décision 5)** (étape 8).
10. **Textes légaux** : juriste, droit applicable, entité éditrice (décision 6, lots LX-05 et DS-07) ;
    sous-traitants et lieux d'hébergement (§ 11).
11. **Pilote France** : zone, volontaires, deux associations relais (décision 7, lot DG-029).
12. **L'accord écrit de chaque publication** : commits, cible, ordre, retour arrière.
