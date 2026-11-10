# Vérification d'assemblage — 10 novembre 2026, 18 h 03

Ce rapport dit l'état vérifié des deux dépôts après la fusion du second lot de la journée : six PR de DIASPORALE et cinq PR de la tranche du moteur. Il ne contient aucun identifiant de déploiement.

## Ce qui a été vérifié

| Sujet | Constat |
|---|---|
| Couple de versions | ANTSIA `d5163aa`, DIASPORALE `96dbf5c` (`main` des deux dépôts après fusion) |
| Arbres | la vérification a tourné sur l'assemblage local des PR ; l'arbre de chaque `main` fusionné est identique à l'arbre vérifié (contrôle fait par le script après la dernière fusion) |
| Commandes | vérification de DIASPORALE (`bun run verify`), puis vérification commune depuis le moteur (`bun run --cwd ../ANTSIA verify`), sous le verrou commun des sessions |
| Résultat | **vert** aux deux étapes ; de 18 h 03 à 18 h 23, fusions comprises |

## Les chiffres

| Contrôle | Résultat |
|---|---|
| Tests du moteur | 229 fichiers, 3 569 tests passés |
| Cliquets du moteur | 27 fichiers, 154 tests passés |
| Tests des scripts du moteur | 171 passés |
| Typage | 12 paquets, aucune erreur |
| Tests des espaces de travail | 12 paquets, aucun échec |
| dont DIASPORALE | domaine 792 (couverture à 100 %) ; surfaces 1 092 (56 fichiers) ; application 2 099 (140 fichiers) |
| Tests des scripts de DIASPORALE | 86 passés |
| Lint | 11 paquets, aucune erreur |

## Ce que le lot contient

- DIASPORALE, PR 51, 58, 59, 60, 62 et 63 : membres fondateurs admis par décision tracée et statut relu quand l'identité change ; manifeste, icônes, script de fond et page hors-ligne ; proposition de rendez-vous préremplie, rendez-vous simultanés, déplacement d'un rendez-vous confirmé ; entraide retrouvée par thème et par mots, missions et questions là où l'on passe, indicateurs d'utilité ; responsables du réseau nommés par l'administration ; avis aux inscrits d'un évènement et aux bénévoles d'une mission.
- Moteur, PR 119, 132, 135, 136 et 139 : la tranche diaspora, plus, avec l'accord de la session du moteur et après sa relecture, le classement de la table des admissions fondatrices dans la politique de données et les deux genres d'avis des missions.

Le détail lot par lot est dans le registre (`docs/etudes/2026-11-10-finalisation/EXECUTION.md`).

## Ce qui n'a pas été fait

- **Aucune recette au navigateur** de ces lots, ni de ceux du premier assemblage de la journée : ni en démonstration, ni en mode moteur, ni à deux comptes, ni sur téléphone.
- Aucune construction complète (`next build`), aucune image ; rien n'est en ligne.
- Aucune admission fondatrice ne peut encore être décidée depuis une console : les actions d'audit et l'écran sont demandés au moteur.
- Personne n'est nommé responsable du réseau : la nomination réelle revient au propriétaire.

## Ce que la vérification a attrapé avant la fusion

Quatre tours rouges avant ce tour vert, tous sur des écarts que les agents ne pouvaient pas voir, faute de jouer le typage et la suite entière du domaine :

1. le typage du domaine (un compteur lu sans tester sa présence ; un champ facultatif posé à « indéfini ») ;
2. le typage du paquet de surfaces (un refus jugé par la présence d'un champ au lieu de sa valeur ; une lecture qui peut ne rien rendre) ;
3. le typage de la tranche du moteur, vu par l'application (un type qui exigeait un réglage facultatif ; un relevé inféré trop étroit) ;
4. la couverture du domaine, tenue à 100 % (une fonction exportée sans test).

Depuis, les agents jouent le typage des paquets légers et la suite du domaine avant de pousser.

## Connu et laissé pour la suite

- La porte d'entrée dit encore que le code est « valable 10 minutes » ; le moteur l'expire à 5 minutes. La correction est dans une PR ouverte, pas encore assemblée.
