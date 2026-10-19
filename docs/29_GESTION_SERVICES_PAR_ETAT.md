# Gestion des services par état et navigation dans les publications

18 octobre 2026 — **implémentation dans les sources ; vérifications différées sur instruction du propriétaire**.

## Gestion des offres

Le gestionnaire commun aux pages et à « Mon activité » propose un filtre sur les
états existants : brouillon, actif, en pause ou retiré. « Tous les états » conserve
la liste précédente. Changer d’état repart sur la première fenêtre ; le sélecteur
reste monté, et les fenêtres de l’ancienne sélection sont démontées.

Le filtre est appliqué avant pagination, sans cacher seulement les lignes déjà
chargées. L’état vide propre au filtre s’affiche à la fin effective de la lecture
et permet de revenir à tous les états. Aucun nombre d’offres n’est déduit d’une
fenêtre partielle.

Les contrôles de filtrage sont désactivés pendant l’ouverture d’un formulaire.
Enregistrer ou fermer ce formulaire permet de changer le filtre. Un bouton
« Fermer l’édition » reste accessible en dehors des résultats, même si une offre
éditée quitte la sélection après une modification externe. Les règles de
publication, pause, reprise, retrait et conflit de version restent existantes.

## Lecture et compatibilité

- `ServicesCapability.supportsManagedOfferStatusFilter` est facultatif. Il active
  le sélecteur ; les anciens fournisseurs conservent leur liste et leurs arguments.
- `useMyPageOffers` accepte `status` et `personId` facultatifs. Le fournisseur
  moteur transmet le lecteur attendu et ferme les projections identifiées pendant
  les transitions d’authentification. Le gestionnaire est lié à la source, au
  lecteur et à la page, et attend une session correspondante avant de monter les
  formulaires et les lecteurs de liste.
- `diaspora/services.myPageOffers` conserve ses gardes de réseau DIASPORALE,
  capacité de lecture et mandat vivant. Un lecteur attendu différent est refusé.
  Le validateur d’état est celui des offres existantes.
- L’index existant `by_network_and_page_and_status` est borné au réseau et à la
  page ; l’état est ajouté à cette sélection lorsqu’il est fourni, avant la
  pagination. Ordre, budgets, DTO et métadonnées de continuation sont conservés.
  La projection rejette les lignes hors page, réseau ou état demandé.
- La démonstration réutilise l’équipe vivante et le stockage existants. Le filtre
  précède la fenêtre ; les nouveaux curseurs sont liés à la page, au lecteur, au
  jeu fictif et à l’état. L’ancien périmètre `mine:<id>` reste conservé pour les
  appels sans état ni lecteur explicite.

Les textes complémentaires français/anglais sont isolés dans le fragment
`page-managed-services`. Aucun index, schéma, stockage ou mutation n’est ajouté.

## Publications dans la gestion

Les onglets de contenu sont réutilisés depuis la fiche et depuis la gestion.
Leur navigation distingue maintenant ces deux contextes. Depuis la gestion des
publications, choisir Photos ou Vidéos conserve la route de gestion et son
paramètre `onglet=publications`, ainsi que l’ancre du titre de cette section.
Depuis la fiche, la navigation reste dans la fiche. Le partage d’une rubrique
continue à produire un lien vers la fiche, sous les droits de lecture ordinaires.

Le contexte est une prop facultative de `PageContentViews`, et le constructeur de
lien utilise les routes centralisées existantes. Le panneau de gestion transmet
aussi le nom réel de la page au partage. Les autres appels restent compatibles.

## Coordination et état de preuve

Le périmètre a été annoncé aux deux sessions voisines. L’autre chat DIASPORALE a
confirmé l’absence de collision avec son lot iCal/agenda ; ses imports et entrées
`event-calendar` sont conservés. ANTSIA conserve les fichiers génériques et sa
tranche commerce. Le seul backend modifié ici est la query `myPageOffers` de la
tranche diaspora.

Aucun test, typage, lint, codegen, build, appel HTTP ou parcours navigateur lancé.
Aucun commit applicatif, push, déploiement ou changement d’environnement.
Les filtres et la navigation exécutés restent à constater à la reprise des
vérifications ; les preuves historiques ne valident pas cette tranche.
