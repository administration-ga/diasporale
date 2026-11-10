# Contrôle de départ — 10 novembre 2026 (lot DS-01)

Ce rapport dit l'état vérifié de `main` avant les travaux du dossier de finalisation (`docs/etudes/2026-11-10-finalisation/`). Il ne contient aucun identifiant de déploiement.

## Ce qui a été vérifié

| Sujet | Constat |
|---|---|
| Couple de versions | ANTSIA `fd58d73`, DIASPORALE `4d5f421` (`main` des deux dépôts) |
| Copie | clones neufs des deux dépôts, côte à côte ; `bun install --frozen-lockfile` avec bun 1.4.2 ; Node 22 pour la CLI Convex |
| Backend local | anonyme, monté une fois (`convex dev --once`) ; aucune variable posée |
| Commande | `bun run verify` depuis ANTSIA, sous le verrou commun des sessions |
| Résultat | **vert**, code 0, en 9 min 38 s (9 h 27 à 9 h 37), machine peu chargée |

## Les chiffres

| Contrôle | Résultat | Relevé précédent |
|---|---|---|
| Tests du moteur | 205 fichiers, 3 303 tests passés | 3 303 (2/11) |
| Cliquets du moteur | 26 fichiers, 150 tests passés | 150 (2/11) |
| Tests des scripts | 92 passés | — |
| Typage | 12 paquets, aucune erreur | 12 (2/11) |
| Tests des espaces de travail | 12 paquets, 13 398 passés, 4 sautés | 13 307 (2/11) |
| dont DIASPORALE | 3 084 : domaine 697, surfaces 970, application 1 417 | 3 084 (3/11) |
| Lint | 11 paquets, aucune erreur | 11 (2/11) |

## En ligne (lecture seule)

- La démonstration répond (page d'accueil et sonde : HTTP 200) et sert toujours le déploiement relevé le 9/11 : front `bead76d`, moteur `26741caa`. Les travaux fusionnés depuis ne sont donc pas en ligne.
- `diasporale.com` ne répond pas : aucun domaine de production n'est branché.

## La PR 21

Lue, ni fermée ni modifiée. Elle n'a plus rien d'unique par rapport à `main` : dix de ses quatorze fichiers sont identiques à `main` ; son commit sur les médias retenus est arrivé par la PR 22 ; le contrat de contraste et les teintes douces sont arrivés par la PR 29. Sur les quatre autres fichiers, `main` est plus récent : la fusionner ferait revenir `main` en arrière. Elle peut être fermée ; la décision revient au propriétaire.

## Ce qui n'a pas été fait

- Aucune recette en mode moteur : le réseau de test n'était pas semé et aucune variable n'était posée. Le banc de recette local vient avec le lot LX-04.
- Aucune construction complète (`next build`), aucune image.
- Aucun essai sur un vrai téléphone (lot MO-01).

## Les documents remis d'aplomb (PR 34)

L'encart de `docs/01`, `CLAUDE.md`, `README.md`, la parité (`docs/04`, ligne `/pilote`) et le rapport des couleurs du 3/11, qui disait à tort que rien n'était publié.
