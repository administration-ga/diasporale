# Avis sur les services des associations et entreprises

18 octobre 2026 — **implémentation dans les sources ; vérifications différées sur instruction du propriétaire**.

## Parcours raccordés

Les fiches d’associations et d’entreprises disposent d’un onglet « Avis », à
côté des publications et des médias lorsque le fournisseur expose cette
capacité. Il rassemble les avis publiés sur les services de cette page. Chaque
avis conserve sa note, son texte, sa preuve exacte et la réponse de la page
autorisée par les règles DG-016. Le titre réel du service renvoie vers son offre.

Dans la gestion de page, `onglet=avis` ouvre la même liste avec une introduction
destinée aux responsables. « Mes pages » propose un raccourci. Le mandat vivant
ferme toujours la gestion dès qu’il disparaît ; les possibilités de répondre,
modifier ou retirer une réponse restent celles projetées par le moteur. Les
formulaires et mutations DG-016 existants sont réutilisés, sans deuxième circuit
de réponse ni de création d’avis. Déposer un avis reste lié à la demande et au
rendez-vous admissibles.

La liste distingue chargement, erreur, absence d’avis accessibles et capacité
indisponible. Les panneaux de la fiche restent démontés hors sélection : ouvrir
une page ne monte pas simultanément les lecteurs des publications, photos,
vidéos et avis. Les liens et onglets utilisent les composants existants avec
retour à la ligne et surfaces tactiles ; aucune recette ordinateur/téléphone
n’est revendiquée.

## Lecture et protection

- Le port ajoute une méthode facultative `usePageReviews`, un type de ligne
  étendant la projection existante par `offerTitle`, et une fenêtre à curseur
  nullable en fin de liste. Les anciens fournisseurs conservent leurs parcours.
- La query moteur `diaspora/serviceReviews.pageReviews` exige le lecteur attendu,
  le réseau DIASPORALE et une page lisible d’association ou d’entreprise. Elle
  utilise l’index existant `by_network_and_page_and_createdAt`, en ordre descendant.
  Chaque fenêtre lit au plus 50 lignes brutes et 2 Mio ; les budgets appelant plus
  petits sont conservés. Le fournisseur demande vingt lignes par fenêtre.
- Seuls les avis dont la modération autorise la publication entrent dans cette
  liste, y compris dans la gestion. Le lecteur existant relit demande, rendez-vous,
  offre active, preuve, blocages et modération. Le titre provient de l’offre réelle
  du même réseau et de la même page. La projection existante conserve le masquage
  des identités indisponibles, les droits vivants et la modération indépendante
  des réponses.
- Aucun identifiant privé de demande, de rendez-vous ou d’auteur n’est ajouté au
  DTO. La preuve reste « rendez-vous confirmé » ou « réalisation déclarée », selon
  le cas ; aucune certification indépendante n’est suggérée.
- La lecture conserve le curseur serveur et sa fin effective. Une fenêtre filtrée
  vide peut avoir une suite. Le pager partagé accepte désormais la fin nullable ;
  une continuation annoncée sans curseur donne un état d’erreur explicite.
- Le fournisseur moteur ferme les données pendant une transition d’authentification
  et transmet `expectedPersonId` dans la query. Les composants sont liés à la source,
  au lecteur et à la page. Un changement de lecteur n’emporte pas l’ancienne liste.
- La démonstration réutilise ses droits, preuves et stockage existants. Sa fenêtre
  de vingt lignes est prise avant filtrage de visibilité ; son curseur est lié à
  la page, au lecteur et au jeu de données. Aucun avis fictif publié et aucune
  publication automatique ne sont ajoutés : un avis en attente reste en attente.

La liste n’affiche ni moyenne, ni total tiré d’une fenêtre partielle. Les
traductions sont isolées dans le fragment français/anglais `page-reviews`.
Aucun schéma, index, stockage ou traitement de migration n’est ajouté.

## État de preuve

Les parcours sont branchés dans les sources réelles du moteur, des fournisseurs,
des fiches et de la gestion. Le périmètre additif `serviceReviews.ts` a été annoncé
au coordinateur ANTSIA pour préserver les travaux DG-016 et DG-023 voisins.

Aucun test, typage, lint, codegen, build, appel HTTP ou parcours navigateur lancé.
Aucun commit applicatif, push, déploiement ou changement d’environnement.
Le chargement et les interactions exécutés restent à constater à la reprise
des vérifications ; les preuves historiques ne valident pas cette tranche.
