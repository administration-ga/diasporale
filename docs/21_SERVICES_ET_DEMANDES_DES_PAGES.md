# Services et demandes dans les pages

18 octobre 2026 — **implémentation locale ; aucun contrôle lancé à la demande du propriétaire**.

## Parcours raccordés

- Les associations et entreprises disposent des onglets « Services » et
  « Demandes reçues » dans leur gestion de page. Les autres natures de page
  ne proposent pas ces onglets ; une adresse saisie manuellement affiche un
  état explicite sans ouvrir de droit.
- Les services utilisent le gestionnaire auparavant présent dans « Mon activité » :
  création, modification versionnée, publication, pause/reprise et retrait confirmé.
  Il est extrait dans `page-services-manager.tsx` et réutilisé par les deux surfaces,
  sans second formulaire ni duplication du catalogue.
- La boîte des demandes est la même `ServiceInbox`, bornée à cette page. Après
  lecture autorisée d’une demande reçue, son retour mène à la boîte de la bonne
  page. Le demandeur garde son parcours personnel. Le rôle et la page du retour
  proviennent de la projection autorisée, jamais d’un paramètre client libre.
- Les liens de gestion d’une offre ouvrent directement sa page prestataire,
  sans retomber sur la première page du sélecteur de « Mon activité ».
- Les fiches et « Mon activité → Pages » donnent accès aux outils de la page.
  Les nouveaux groupes et événements associatifs de la session parallèle sont conservés.

## Partie publique

Pour les associations et entreprises, « Écrire » sans action est remplacé par
une entrée « Demander un service » **seulement** lorsqu’une première fenêtre
contient une offre active lisible. Le lien mène aux services réels de la page,
puis à la demande structurée de l’offre choisie. Une fenêtre vide, une erreur
ou une capacité absente ne fabriquent pas de contact. Cette entrée n’est pas
proposée aux signataires de leur propre page.

La section `services-de-la-page` possède un titre, une ancre et un état vide
explicite. Les signataires voient les liens vers la gestion des services et la
boîte des demandes, même sans offre active. Les états de chargement et d’erreur
s’appuient sur le paginateur existant.

Le pays initial d’une nouvelle offre est celui de la page lorsqu’il est connu.
La ville de résidence du responsable n’est préremplie que si ce pays correspond
à sa résidence. Le formulaire reste explicite et modifiable avant publication.

## Frontières et sources

Pas de nouvelle conversation personnelle, relation sociale, coordonnée exposée,
paiement ou règle d’accès. Les capacités, fonctions de données, mandats vivants
et contrôles serveur existants restent l’autorité. Les textes français/anglais
sont isolés dans le fragment `page-services`.

Les sources modifiées portent la navigation et la composition des composants.
Aucun schéma, index, fonction backend ou environnement n’est modifié par cette
tranche. Aucun test, typage, lint, codegen, build ou parcours navigateur lancé ;
aucun résultat antérieur ne valide ces ajouts. Aucun commit applicatif, push ou
déploiement effectué.
