# Filtrer les services d’une association ou d’une entreprise

18 octobre 2026 — **implémentation dans les sources ; vérifications différées sur instruction du propriétaire**.

## Parcours raccordé

La section « Services proposés » des fiches d’associations et d’entreprises
propose un choix de catégorie et un choix de mode de prestation. Les options
reprennent celles du catalogue : les catégories du domaine et les modes
présentiel ou à distance. Une offre qui propose les deux modes répond aux deux
filtres. Les filtres se combinent et ne font jamais sortir de la page choisie.

Changer un filtre repart sur la première fenêtre des résultats. Les sélecteurs
restent montés pour conserver la saisie et le focus ; seules les lectures et
fenêtres de l’ancienne liste sont démontées. Un bouton efface les deux filtres.
Un état vide propre aux filtres permet de revenir à tous les services actifs,
après la fin effective des fenêtres. Aucun total n’est déduit d’une fenêtre
partielle. Les choix sont locaux à cette section et ne sont pas inscrits dans
l’adresse dans cette tranche.

Les cartes, leurs liens vers la demande structurée, les actions de gestion et
l’ancre de la section utilisent le parcours existant. Le bouton « Demander un
service » de l’en-tête continue à lire la présence d’offres actives sans filtre.

## Contrat et lecture

- `ServicesCapability.supportsPageOfferFilters` est facultatif. Seuls les
  fournisseurs qui l’annoncent affichent les sélecteurs ; un ancien fournisseur
  conserve sa liste sans filtres.
- `usePageOffers` accepte les paramètres facultatifs `category`, `delivery` et
  `personId`, en conservant les anciens appels. Le nouveau lecteur transmet le
  membre courant ; le fournisseur moteur le traduit en `expectedPersonId`.
- La query `diaspora/services.pageOffers` conserve les gardes de réseau DIASPORALE,
  de capacité de lecture et de page lisible d’association/entreprise. Un lecteur
  attendu différent de la session courante est refusé. Catégorie et mode passent
  par `parseServiceSearch`, et les modes suivent `matchesDeliveryFilter`.
- La sélection utilise l’index existant `by_network_and_page_and_status` : réseau,
  page et état actif, puis filtres de catégorie et de mode **avant pagination**.
  L’ordre reste descendant. La projection relit les contraintes des nouvelles
  branches filtrées ; aucune offre d’une autre page n’est ajoutée.
- Avec filtre effectif, la fenêtre est bornée à vingt résultats au plus, deux cents
  lignes examinées et 1 Mio lu ; les budgets appelant plus petits sont conservés.
  Le curseur et `isDone` restent ceux du moteur. Une fenêtre vide peut annoncer une
  suite : elle ne signifie pas à elle seule qu’aucune offre ne correspond.
- Sans filtre effectif, les budgets de lecture précédents restent conservés. Aucun
  index, schéma, historique de recherche ou mutation n’est ajouté.
- Le fournisseur moteur ferme la projection des lecteurs identifiés pendant une
  transition d’authentification. Source, personne et page bornent l’arbre de la
  section ; catégorie et mode bornent les fenêtres de la liste.
- La démonstration valide et filtre les offres avant sa fenêtre. Les nouveaux
  curseurs sont liés à la page, au lecteur, au jeu de données et aux filtres
  normalisés ; le périmètre historique des anciens appels sans filtre ni lecteur
  explicite est conservé. Le stockage et les écritures restent inchangés.

Les textes complémentaires français/anglais sont isolés dans le fragment
`page-service-filters`. Les contrôles reprennent les champs et jetons existants,
avec retour à la ligne et cibles tactiles ; aucune recette mobile exécutée
n’est revendiquée.

## État de preuve

Les changements concernent les sources réelles du lecteur `pageOffers`, du port,
des fournisseurs moteur/démonstration et de la section de la fiche déjà importée.
La modification de `diaspora/services.ts` a été annoncée au coordinateur ANTSIA.

Aucun test, typage, lint, codegen, build, appel HTTP ou parcours navigateur lancé.
Aucun commit applicatif, push, déploiement ou changement d’environnement.
L’affichage, les filtres et leur navigation exécutés restent à constater à la
reprise des vérifications ; les preuves historiques ne valident pas cette tranche.
