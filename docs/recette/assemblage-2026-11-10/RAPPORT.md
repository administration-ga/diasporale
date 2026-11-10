# Vérification d'assemblage — 10 novembre 2026, 15 h 17

Ce rapport dit l'état vérifié des deux dépôts après la fusion du lot de quatorze PR de DIASPORALE et de deux PR de la tranche du moteur. Il ne contient aucun identifiant de déploiement.

## Ce qui a été vérifié

| Sujet | Constat |
|---|---|
| Couple de versions | ANTSIA `9295782`, DIASPORALE `d010a6b` (`main` des deux dépôts après fusion) |
| Arbres | la vérification a tourné sur l'assemblage local des PR ; l'arbre de chaque `main` fusionné est identique à l'arbre vérifié (contrôle fait après la dernière fusion) |
| Copie | clones des deux dépôts côte à côte ; `bun install --frozen-lockfile` sans changement ; backend local anonyme pour la génération des types |
| Commandes | vérification de DIASPORALE (`bun run verify`), puis vérification commune depuis le moteur (`bun run --cwd ../ANTSIA verify`), sous le verrou commun des sessions |
| Résultat | **vert** aux deux étapes ; de 15 h 17 à 15 h 42, fusions comprises |

## Les chiffres

| Contrôle | Résultat |
|---|---|
| Tests du moteur | 217 fichiers, 3 434 tests passés |
| Cliquets du moteur | 26 fichiers, 150 tests passés |
| Tests des scripts du moteur | 92 passés |
| Typage | 12 paquets, aucune erreur |
| Tests des espaces de travail | 12 paquets, aucun échec |
| dont DIASPORALE | domaine 720 ; surfaces 1 063 (53 fichiers) ; application 1 978 (129 fichiers) |
| Tests des scripts de DIASPORALE | 86 passés |
| Lint | 11 paquets, aucune erreur |

## Ce que le lot contient

- DIASPORALE, PR 42, 43, 44, 45, 47, 48, 49, 50, 52, 53, 54, 55, 56 et 57 : évènements de démonstration, état d'une publication et lecture de tous les commentaires, évènements du pays dans le hub, encart contre les fausses offres, décisions lues par l'auteur, scripts de publication et dossier de mise en production, signalement depuis chaque objet, accueil qui respecte un profil existant et retour à la page demandée, charpente des textes et réglages d'iCom, entrée par IDN, photos préparées et vidéos bornées, table des destinations et pastille de non-lus, règles de la communauté et permanence, raccourcis et « À propos » du hub, garde de qualité du dépôt.
- Moteur, PR 106 et 109 (tranche diaspora seulement) : banc de recette local de la mise en relation, consentements à la portée exacte, évènements du pays et compteur nocturne.

Le détail lot par lot est dans le registre (`docs/etudes/2026-11-10-finalisation/EXECUTION.md`).

## Ce qui n'a pas été fait

- **Aucune recette au navigateur** de ces lots, ni en démonstration ni en mode moteur, ni à deux comptes, ni sur téléphone.
- Aucune construction complète (`next build`), aucune image.
- Rien n'est en ligne : aucune publication n'a été faite.
- Le retour arrière n'a pas été joué sur la démonstration ; l'exercice à blanc de la procédure d'incident non plus.

## Ce que la vérification a attrapé avant la fusion

Cinq écarts, tous nés de la réunion de PR écrites en parallèle ou d'une avancée du moteur, corrigés dans les PR concernées avant ce tour vert :

1. un code d'erreur de formulaire rendu par une action (accueil) ;
2. un test qui remplaçait un module au lieu de fournir la vraie source de données (encart des fausses offres, après le déplacement de la feuille de signalement) ;
3. deux délais de test dépassés sous une machine très chargée : le délai par test passe à 15 s dans l'application et dans le paquet de surfaces ;
4. un refus nouveau du moteur à la préparation d'une image, absent de la table des refus ;
5. une adresse nouvelle (une règle de la communauté) absente de la table des destinations.
