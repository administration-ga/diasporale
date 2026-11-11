# Vérifications d'assemblage — 11 novembre 2026

Ce rapport dit l'état vérifié des deux dépôts après les lots du 11 novembre : le lot couplé, assemblé, vérifié et fusionné par la session du moteur, les lots 5, 6, 7 et 8, assemblés, vérifiés et fusionnés par la session DIASPORALE, et les lots 11 et 13, couplés, assemblés, vérifiés et fusionnés par la session du moteur. Chaque lot a été vérifié dans le créneau lourd attribué par la session de coordination, sous le verrou commun des sessions. Ce rapport ne contient aucun identifiant de déploiement.

## Le couple vérifié

| Sujet | Constat |
|---|---|
| Couple de versions | ANTSIA `16f4391`, DIASPORALE `cfd5603` (`main` des deux dépôts après le lot 13) ; avant lui, ANTSIA `c44337f` et DIASPORALE `94eb9b9` (après le lot 8), ANTSIA `599dc93` et DIASPORALE `fabc540` (après le lot 11), ANTSIA `ecca990` et DIASPORALE `43b0aa1` (après le lot 7), `bf3ebe4` (après le lot 6), puis ANTSIA `22bae3c` et DIASPORALE `20e5df4` (après le lot 5) |
| Arbres | chaque vérification a tourné sur l'assemblage local des PR ; l'arbre de chaque `main` fusionné est identique à l'arbre vérifié (contrôle fait après la dernière fusion de chaque lot) |
| Commande | vérification complète depuis le moteur (`bun run verify` : génération, typage, tests du moteur, cliquets, scripts, puis typage, tests et lint de tous les espaces de travail, dont ceux de DIASPORALE), puis `bun run test:scripts` à la racine de DIASPORALE |
| Résultat | **vert** pour chaque lot |

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

## Lot 6 (session DIASPORALE)

Vérifié de 13 h 48 à 13 h 59, fusions comprises, après la fusion du lot 10 de la session du moteur (antsia#155 à #158, `main` `20cecf0`).

| Contrôle | Résultat |
|---|---|
| Tests du moteur | 236 fichiers, 3 653 tests passés |
| Cliquets du moteur | 27 fichiers, 159 tests passés |
| Tests des scripts du moteur | 171 passés |
| Typage et tests des espaces de travail | aucun échec |
| dont DIASPORALE | domaine 792 (couverture à 100 %) ; surfaces 1 211 (62 fichiers) ; application 2 175 (147 fichiers) |
| Tests des scripts de DIASPORALE | 86 passés |
| Lint | aucune erreur |

- Moteur, PR 160 à sa tête `7cdf90c` (accord écrit de la session du moteur) ; DIASPORALE, PR 72 à sa tête `d1a1ea6`.
- `main` après fusion : ANTSIA `ecca990` (arbre `aa90391`), DIASPORALE `bf3ebe4` (arbre `bbcdab1`), identiques aux arbres vérifiés. Aucun conflit.
- Contenu (AS-01) : le moteur admet, pour instruire une revendication de page, le rôle de réseau ou le membre de l'équipe de modération compétente (`pageClaimReviewCapacity`, antsia#155). La file « Pages à vérifier » de la tranche suit cette règle à l'identique (antsia#160), et l'onglet de DIASPORALE la lit (`myPageClaimReview`), avec repli sur le rôle de réseau (#72).

## Lot 7 (session DIASPORALE)

Vérifié de 14 h 42 à 14 h 56, fusion comprise : moteur `ecca990` seul, DIASPORALE `3a24a6c` + PR 74 à sa tête `e141ae1`.

| Contrôle | Résultat |
|---|---|
| Tests du moteur | 3 653 passés ; cliquets 159 ; scripts 171 |
| dont DIASPORALE | domaine 792 (couverture à 100 %) ; surfaces 1 214 ; application 2 175 |
| Tests des scripts de DIASPORALE | 86 passés |
| Lint | aucune erreur |

- `main` après fusion : DIASPORALE `43b0aa1` (arbre `3d3916a`), identique à l'arbre vérifié ; ANTSIA inchangé.
- Contenu (MD-07) : la règle qui dit ce que l'auteur d'un contenu signalé lit d'un dossier est celle du moteur (`authorDecisionOutcome`, antsia#156) ; le port de DIASPORALE lui délègue au lieu de la recopier, et garde le filtre en défense.

## Lot 11 (session du moteur, couplé)

Assemblé, vérifié et fusionné par la session du moteur, avec l'accord écrit de la session DIASPORALE pour la PR 73, sous le gel de `main` de DIASPORALE. Un premier passage s'est arrêté rouge dès l'essai léger, sans rien fusionner : la PR 162 du moteur fermait une porte de décision que trois tests de la PR 156 appelaient encore. La 162 corrigée, le second passage est vert.

| Contrôle | Résultat (rapporté par la session du moteur) |
|---|---|
| Vérification complète | verte (`verify`, 706 s) |
| Tests du moteur | 239 fichiers, 3 694 tests passés ; cliquets 159 ; scripts 171 |
| Tests des scripts de DIASPORALE | 86 passés |
| Lint | 11 paquets |

- Moteur : PR 159, 161, 162, 163, 164 (le guichet de DIASPORALE range un commentaire de direct retenu, au pays de sa session) et 165 ; DIASPORALE : PR 73 (libellés du commentaire de direct, `145bc51`).
- `main` après fusion : ANTSIA `599dc93` (arbre `b7bbd4c`), DIASPORALE `fabc540` (arbre `e495677`), identiques aux arbres vérifiés (contrôlé aussi par la session DIASPORALE après la fusion).
- La PR 73 n'entre jamais seule : le cliquet `i18n-keys` est à double sens (clé manquante sans elle, clé orpheline sans la 163).

## Lot 8 (session DIASPORALE)

Moteur `c44337f` seul (il contient antsia#168 depuis son lot 12), DIASPORALE `17b5045` + PR 77 à sa tête `6c75222`.

- Premier passage à 15 h 49 : **rouge**, sans fusion. Un seul test d'écran (mentorat) a dépassé sa limite de 15 s (16,4 s) sous une charge de la machine de 150 ; rejoué seul, il passait en 4,3 s.
- Rejeu de 16 h 25 à 16 h 38, agents des autres sessions en pause : **vert**. Moteur 3 715 tests, cliquets 163, scripts 171 ; domaine 792 (couverture à 100 %), surfaces 1 215, application 2 177 ; lint sans erreur ; scripts de DIASPORALE 86.
- `main` après fusion : DIASPORALE `94eb9b9` (arbre `f98f33c`), identique à l'arbre vérifié.
- Contenu (UM-03, EM-01) : une offre d'emploi propose d'abord « Frais demandés au candidat » et « Usurpation d'une entreprise » ; le guichet et « Mes données » les nomment ; l'encart contre les fausses offres cite le motif dédié.

## Lot 13 (session du moteur, couplé)

Assemblé, vérifié et fusionné par la session du moteur, avec l'accord écrit de la session DIASPORALE pour la PR 78, sous le gel de `main` de DIASPORALE.

| Contrôle | Résultat (rapporté par la session du moteur) |
|---|---|
| Vérification complète | verte (`verify`, 785 s) |
| Tests du moteur | 3 733 ; cliquets 163 |
| Tests des scripts de DIASPORALE | verts |

- Moteur : PR 171 (actions d'audit des admissions fondatrices), 172 (avis de déplacement d'un rendez-vous, règles et émissions de la tranche écrites par la session DIASPORALE), 173, 174 (un signataire ne signale ni sa page, ni ses évènements, ni ses publications) et 175 ; DIASPORALE : PR 78 (la cloche nomme les deux avis de déplacement).
- `main` après fusion : ANTSIA `16f4391` (arbre `77794a0`), DIASPORALE `cfd5603` (arbre `bb32a69`), identiques aux arbres vérifiés (contrôlés aussi par la session DIASPORALE).

## Ce qui n'a pas été fait

- **Aucune recette au navigateur** de ces lots : ni en démonstration, ni en mode moteur, ni à deux comptes, ni sur téléphone.
- Aucune construction complète (`next build`), aucune image ; rien n'est en ligne.
- Aucune valeur de réglage de modération n'est écrite en base ; les valeurs de départ restent à valider par le propriétaire.

## Connu et laissé pour la suite

- Demande au moteur encore ouverte : l'écran de console des membres fondateurs (antsia#120, point 4) ; les décisions par la console et au journal attendent antsia#176. Servies puis fermées : filtre « non lues » et destination d'une invitation de groupe (antsia#149) ; durée du code publiée (antsia#151) ; auto-signalement d'un signataire (antsia#114) ; avis du déplacement d'un rendez-vous (antsia#133) ; équipe de modération et purge d'une revendication (antsia#148) ; décisions lues par l'auteur (antsia#99) ; avis aux inscrits d'un évènement (antsia#97) ; responsables du réseau (antsia#98). Le moteur prépare une PR à part pour la réponse d'avis et le direct d'une page.
- Revendications : les équipes par pays n'existent pas encore au moteur ; le rattrapage des revendications tranchées avant PG-01 et la durée de conservation des pièces (90 jours) restent à décider par le propriétaire et le juriste.
- La durée de cinq minutes d'une vidéo est une valeur proposée par le moteur, à valider par le propriétaire.
