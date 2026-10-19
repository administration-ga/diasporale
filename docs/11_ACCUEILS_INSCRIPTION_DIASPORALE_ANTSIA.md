# Accueils centrés sur l’inscription — 17 octobre 2026

> **Mise à jour du 19 octobre 2026 — une seule porte, comme l’accueil d’ANTSIA.** Demande
> du propriétaire : appliquer à `/entrer` les principes de l’accueil d’ANTSIA, où `/` et
> `/entrer` rendent le même écran (`AccessHomeScreen`). Sur DIASPORALE, `/entrer` n’affiche
> plus ses « deux portes » : il rend la porte de l’accueil (`EntryDoor`, vitrine à gauche,
> carte d’accès à droite). La carte porte l’intention (`inscription=1` : « Créer votre
> compte DIASPORALE », bouton « Recevoir le code », lien « J’ai déjà un compte : me
> connecter ») et l’avertissement `deconnexion=incomplete`, qui suspend la redirection
> d’une session encore ouverte. Les étapes `/entrer/code` et `/entrer/idn` (démonstration)
> sont montées dans la même porte, avec un retour vers `/entrer`. En démonstration, la carte
> garde un lien « Recevoir plutôt le code par SMS » vers `/entrer/code` ; le moteur
> n’expose que l’e-mail. Le mode sombre se bascule en un appui en haut à droite
> (`AppearanceToggle` du moteur, ADR-0027). Le mot-symbole est en matière liquide :
> voir la charte, §9.

Demande du propriétaire : présenter DIASPORALE et ANTSIA comme des réseaux sociaux
dont la première action est de créer son compte ou de se connecter, sur ordinateur
et sur téléphone, en prenant l’accueil de Facebook comme référence de structure.
La capture et le lien précis évoqués ne sont pas présents dans ce fil.

## Comportement implémenté dans les sources servies

- DIASPORALE `/` : marque et message court à gauche dès 960 px, carte d’accès à
  droite ; téléphone en une colonne. Connexion par code directement sur l’accueil,
  bouton « Créer un compte » vers `/entrer?inscription=1`, titre d’inscription dédié.
  Le formulaire par code est partagé avec `/entrer/code` (validation, erreurs,
  chargement, code fictif uniquement en démonstration). Une session existante mène
  au fil ou à l’accueil du nouveau membre selon son adhésion.
- ANTSIA `/` : même disposition, avec sa charte et sa porte d’identité commune
  `IdentityEntry`. La carte de connexion est partagée avec `/entrer` ;
  `/entrer?inscription=1` affiche l’intention de création de compte. La découverte
  publique reste accessible sur `/decouvrir`. Le garde de transmission de session,
  les restrictions et l’avertissement de déconnexion incomplète sont conservés.
- Les consentements restent explicites dans le parcours existant. Aucun nouveau
  compte ni aucune adhésion n’est créé par le simple affichage d’un accueil.
- Textes français et anglais ; couleurs issues des jetons existants, sans changement
  de charte ni ajout de mot de passe. Liens légaux, langues et repère de démonstration
  conservés. Les pays ouverts de DIASPORALE viennent de la source de données.

## Limites de l’authentification existante

DIASPORALE en démonstration simule IDN et les codes. Dans le fournisseur moteur,
IDN reste indisponible et le bouton de l’accueil l’indique ; il ne mène plus à la
page IDN vide. Le SMS reste réservé à la démonstration sur la page dédiée.
ANTSIA utilise la configuration d’authentification réellement fournie par son moteur.
Ces changements de présentation ne déclarent pas l’ouverture d’un service en production.

## Vérifications finales et contraintes de session

- Vérification commune ANTSIA/DIASPORALE intermédiaire après les corrections : **code 0,
  7 173 tests, 10 typages, 9 lints sans erreur**. Les 94 avertissements
  préexistants sont conservés. Log :
  `/tmp/antsia-diasporale-pd4-verify-corrected-final.log`.
- Empreintes des 1 569 fichiers contrôlés identiques avant/après :
  `c1a685a4d04d8b30a71a04d4838b31498ee7de70da22fa6c5a3fdb9e56a09225`.
  Inventaires : `/tmp/antsia-diasporale-pd4-corrected-source-before.json`
  et `-after.json`. Une autre session a ensuite repris l’accueil ANTSIA.
  La coordination a communiqué un nouveau passage complet réussi : **7 179 tests,
  10 typages, 10 suites workspace, 9 lints sans erreur / 93 avertissements**,
  avec 1 570 empreintes source identiques avant/après. Ce dernier passage a été
  exécuté par la session coordinatrice, et non relancé ici.
- Dernière passe ciblée d’entrée DIASPORALE : 46 tests, typage et lint ciblé
  verts. Logs `/tmp/diasporale-access-final-{targeted,types,lint}.log`.
  IDN indisponible expliqué aussi sur `/entrer`, lien inactif retiré ;
  cibles des liens légaux portées à 44 px.
- Après accord explicite, seuls les `.next` des deux applications et les
  `.vite`/`.vite-temp` des espaces de travail concernés ont été retirés.
  Espace disponible avant : 236 388 Kio ; après retrait des deux `.next` :
  627 492 Kio, soit environ **382 Mio récupérés à cet instant**.
  Aucun autre cache, source, dépendance ou donnée applicative supprimé.
- Le backend local 3210 et le seul serveur Next 3031 ont été repris par la
  coordination des sessions. ANTSIA 3030 n’a pas été lancé simultanément.
- L’ancien onglet de connexion refusée est conservé sans intervention. Un second
  onglet DIASPORALE fonctionnel a permis la recette navigateur ci-dessous.
- La recette Chrome PD4 de l’autre session conserve son compte fictif et son
  propre contexte ; elle ne vaut pas preuve de rendu des accueils de cette session.
- Vault Obsidian inaccessible (`Stale NFS file handle`) lors de cette session.
  Aucun fichier mémoire modifié ici. Aucun push, déploiement ni changement
  d’environnement effectué par cette session.

Les modifications étrangères présentes dans les deux répertoires partagés sont conservées.

## Recette navigateur DIASPORALE — 17 octobre 2026

Recette effectuée sur le serveur local moteur `http://localhost:3031/`, dans
l’onglet anonyme du navigateur intégré, avec le thème système existant (sombre).
Aucun code source applicatif changé pendant cette recette.

- Accueil contrôlé visuellement à 1 280 × 900 et à 390 × 844 : disposition en
  deux colonnes sur ordinateur, une colonne sur téléphone, connexion et création
  de compte distinctes. Le bouton de création reste visible sans défilement à
  390 × 844. Champs et boutons principaux : 48 px de haut.
- Largeurs 320, 375, 390, 768 et 1 280 px : largeur du document égale à celle
  de la fenêtre sur l’accueil, sans débordement horizontal. Même contrôle réussi
  pour la page d’inscription à 320 et 375 px.
- Clic réel « Créer un compte » vers `/entrer?inscription=1`, titre correct,
  puis lien vers `/entrer/code` et formulaire e-mail accessible sur ordinateur
  et téléphone. Retour à l’accueil fonctionnel.
- Soumissions à vide et avec `adresse-invalide` refusées : message français
  associé au champ, `aria-invalid=true`, focus ramené au champ e-mail ; erreur
  lisible sur téléphone sans débordement. Aucun envoi de code déclenché.
- Aucune erreur console capturée pendant les écrans parcourus.
- IDN est indisponible et annoncé comme tel. **Incohérence de texte relevée** :
  la porte d’inscription annonce « Code par e-mail ou SMS » alors que le fournisseur
  moteur expose uniquement l’e-mail. Le SMS est réservé à la démonstration.
- Réception et vérification d’un vrai code, création du compte, consentements et
  accès au réseau après inscription **non vérifiés dans cette recette** : aucun
  compte créé et aucun consentement validé.
- Fenêtre remise à sa taille habituelle, champ fictif effacé, onglet laissé sur `/`.

Captures : [ordinateur](recette/accueil-inscription-2026-10-17/accueil-ordinateur.jpg),
[téléphone](recette/accueil-inscription-2026-10-17/accueil-telephone.jpg),
[inscription ordinateur](recette/accueil-inscription-2026-10-17/inscription-ordinateur.jpg),
[inscription téléphone](recette/accueil-inscription-2026-10-17/inscription-telephone.jpg),
[validation ordinateur](recette/accueil-inscription-2026-10-17/validation-ordinateur.jpg),
[validation téléphone](recette/accueil-inscription-2026-10-17/validation-telephone.jpg).

## Vérification complète finale sur sources figées — 17 octobre 2026

Après les corrections de surfaces des deux applications, le `bun run verify`
officiel du moteur ANTSIA a terminé avec **code 0** : génération des liaisons,
typage strict Convex et des tests, **10 contrôles de types des espaces de travail**,
**7 179 tests réussis** (6 912 Vitest + 267 Bun, dont 10 tâches de tests des espaces
de travail), puis **9 tâches de lint, sans erreur et avec 94 avertissements**.
Les tests de contraste du thème DIASPORALE corrigé sont inclus dans cette passe.

Les **1 580 fichiers source/configuration contrôlés sont strictement identiques
avant et après**. Empreinte SHA-256 de l’inventaire :
`0107f0a643cc31c3f6f2a6dc18a4065b77a9fc7f46e8cc917cc7d581042cd6b7`.
Cette preuve couvre le dernier thème ANTSIA et ses deux composants d’entrée,
ainsi que le thème DIASPORALE et sa vitrine v3.3.

- Journal : `/tmp/antsia-diasporale-surfaces-verify-final-20261017.log`.
- Résumé : `/tmp/antsia-diasporale-surfaces-verify-final-20261017-summary.json`.
- Inventaires : `/tmp/antsia-diasporale-surfaces-verify-20261017-source-final-before.json`
  et `-after.json`.
- Cible de génération confirmée : backend anonyme local sur 3210 ; lanceur Convex
  avec Node 22, aucune commande de production. Exécution séquentielle, mémoire
  JavaScript bornée à 2 Gio, Vitest limité à un processus et Go à deux processeurs.
- Les deux applications restent actives sur 3030 et 3031, avec le backend commun
  conservé. Aucun changement de source applicative, commit, push ou déploiement
  effectué pendant cette vérification.

Une première passe a aussi terminé sans erreur, mais deux composants ANTSIA ont
changé pendant son exécution : elle est conservée comme résultat intermédiaire
dans `/tmp/antsia-diasporale-surfaces-verify-20261017.log` et ne sert pas de preuve
de stabilité finale. La passe finale ci-dessus a repris après le gel effectif de
toutes les corrections.

Ce résultat atteste les contrôles automatiques ; il ne constitue pas une recette
native réussie des photos multiples ou de la vidéo.
