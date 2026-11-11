# Vérifications d'assemblage — 11 novembre 2026

Ce rapport dit l'état vérifié des deux dépôts après les deux lots du 11 novembre : le lot couplé, assemblé, vérifié et fusionné par la session du moteur, puis le lot 5, assemblé, vérifié et fusionné par la session DIASPORALE. Chaque lot a été vérifié dans le créneau lourd attribué par la session de coordination, sous le verrou commun des sessions. Ce rapport ne contient aucun identifiant de déploiement.

## Le couple vérifié

| Sujet | Constat |
|---|---|
| Couple de versions | ANTSIA `22bae3c`, DIASPORALE `20e5df4` (`main` des deux dépôts après le lot 5) |
| Arbres | chaque vérification a tourné sur l'assemblage local des PR ; l'arbre de chaque `main` fusionné est identique à l'arbre vérifié (contrôle fait après la dernière fusion de chaque lot) |
| Commande | vérification complète depuis le moteur (`bun run verify` : génération, typage, tests du moteur, cliquets, scripts, puis typage, tests et lint de tous les espaces de travail, dont ceux de DIASPORALE), puis `bun run test:scripts` à la racine de DIASPORALE |
| Résultat | **vert** pour les deux lots |

## Lot couplé (session du moteur)

- DIASPORALE, PR 65, 64 et 66 ; moteur, PR 137, 143, 140 et 138, dans cet ordre, aux têtes gelées par les deux sessions.
- `main` après fusion : DIASPORALE `c796f48` (arbre `0d8003c`), ANTSIA `b378724` (arbre `fd6a199`), identiques aux arbres vérifiés.
- Chiffres rapportés par la session du moteur : tests du moteur 3 628, cliquets 159, typage et tests de 12 paquets (domaine de DIASPORALE à 100 % de couverture), lint de 11 paquets, scripts de DIASPORALE 86.
- Contenu : le guichet nomme un groupe et un message personnel signalés (MC-01) ; bloquer dit son effet réel et une page fermée par les blocages se tait (RP-03) ; vidéos MP4 ou WebM seulement, durée bornée (FD-02) ; accusés de lecture, « mes relations seulement » par défaut et appels déclarés au moteur (IC-04 du moteur, IM-01 et IM-02).

## Lot 5 (session DIASPORALE)

Vérifié de 11 h 10 à 11 h 30, fusions comprises.

| Contrôle | Résultat |
|---|---|
| Tests du moteur | 235 fichiers, 3 634 tests passés |
| Cliquets du moteur | 27 fichiers, 159 tests passés |
| Tests des scripts du moteur | 171 passés |
| Typage | 12 paquets, aucune erreur |
| Tests des espaces de travail | 12 paquets, aucun échec |
| dont DIASPORALE | domaine 792 (couverture à 100 %) ; surfaces 1 211 (62 fichiers) ; application 2 174 (147 fichiers) |
| Tests des scripts de DIASPORALE | 86 passés |
| Lint | 11 paquets, aucune erreur |

- DIASPORALE, PR 67, 68 et 69 ; moteur, PR 147 et 154 (accord écrit de la session du moteur pour les fusionner dans son `main`).
- `main` après fusion : ANTSIA `22bae3c` (arbre `46ad515`), DIASPORALE `20e5df4` (arbre `0d1e2a1`), identiques aux arbres vérifiés.
- Deux conflits d'union dans la PR 69 (`return-path.test.ts`, `resources.ts`), résolus en gardant les deux côtés, dans le même ordre à l'assemblage et à la mise à jour de la branche.
- Contenu : réglages de modération au guichet (MD-04) et « Pages à vérifier » par pays (AS-01) ; cloche complète, page des notifications, genres nommés, avis d'iCom (NP-04, IM-04) ; porte fiable sans durée de code chiffrée, reprise après rechargement, salle d'attente du compte en attente (EA-08, MO-04, EA-10) ; dans la tranche du moteur, le dernier administrateur ne quitte pas DIASPORALE sans remplaçant, et la réconciliation du moteur relit les adhésions de DIASPORALE (`rederiveMembership` inscrit au registre des tranches).

Le détail lot par lot est dans le registre (`docs/etudes/2026-11-10-finalisation/EXECUTION.md`).

## Ce qui n'a pas été fait

- **Aucune recette au navigateur** de ces lots : ni en démonstration, ni en mode moteur, ni à deux comptes, ni sur téléphone.
- Aucune construction complète (`next build`), aucune image ; rien n'est en ligne.
- Aucune valeur de réglage de modération n'est écrite en base ; les valeurs de départ restent à valider par le propriétaire.

## Connu et laissé pour la suite

- Demandes au moteur : équipe de modération admise et échéance de purge d'une revendication (antsia#148, en cours) ; filtre « non lues » côté serveur et destination d'une invitation de groupe (antsia#149) ; durée de validité du code publiée par le moteur (antsia#151).
- Quand le moteur admettra les équipes de modération pour les revendications, la file « Pages à vérifier » de la tranche devra suivre.
- La durée de cinq minutes d'une vidéo est une valeur proposée par le moteur, à valider par le propriétaire.
