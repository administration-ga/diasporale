# Photos et vidéos des pages

18 octobre 2026 — **implémentation locale ; vérifications différées sur instruction du propriétaire**.

## Parcours raccordé

Les fiches et l’onglet Publications de la gestion proposent les vues
« Publications », « Photos » et « Vidéos ». La première conserve le mur et son
annonce épinglée. Les deux autres présentent les médias déjà publiés par la
page, par ordre chronologique, avec accès à leur publication d’origine.

Les onglets utilisent les composants accessibles existants. Les panneaux
inactifs sont démontés : les lectures paginées et les lecteurs de médias de
ce panneau ne restent pas montés derrière l’onglet sélectionné. Un changement
de page, lecteur ou type repart sur la première fenêtre correspondante.

La grille réutilise `PostMediaGrid` : délivrance des fichiers, médias retenus,
visionneuse, navigation entre les photos d’une même publication et lecture
exclusive des vidéos. Aucun nouveau téléversement ni album n’est créé.
Les états vides distinguent photos et vidéos ; un fournisseur sans capacité
média conserve le mur précédent.

## Lecture et pagination

- `PagePublicationsCapability.media` est facultatif. Sa lecture reçoit le
  handle, l’identité attendue, le type de média et un curseur composite.
- Le moteur expose `pages.pageMediaPosts`. L’identité attendue entre dans les
  arguments de requête et est comparée à la personne authentifiée. Le réseau
  et la page restent gardés par les fonctions existantes.
- Le filtre médias s’applique **avant** le remplissage de la fenêtre visible.
  La lecture examine les fenêtres bornées du mur et conserve comme curseur
  la dernière ligne examinée. Une fenêtre vide peut donc annoncer une suite.
- Une ligne retenue appartient à la page et à son réseau, n’est pas un partage,
  est publiée et admise par la modération sans exception pour son déposant,
  puis passe la garde de lisibilité habituelle. Aucun choix d’audience ne change.
- Les médias natifs et les médias fédérés empruntent la projection et la
  délivrance existantes. Un fichier retenu garde sa place, sans URL dévoilée.
- Le mur et les vues médias partagent une seule boucle de lecture bornée.
  Le filtre supplémentaire ne s’active que pour les nouvelles vues ; le contrat
  et la sélection du mur existant restent inchangés.
- L’adaptateur moteur ferme les données après un refus. La démonstration
  filtre avant pagination et applique `canRead` puis `postView`. Le masquage
  privé du fil ne devient pas un droit collectif sur le mur de la page.
- Les fenêtres de l’interface réutilisent la chaîne de curseurs du fil. La
  présentation ne fabrique ni tri serveur, ni nombre total de médias.

La démonstration existante ne stocke que des images : son onglet Vidéos reste
vide. La lecture de vidéos réelles passe par le fournisseur moteur. Cette
tranche n’étend pas le stockage de démonstration et ne constitue pas la galerie
de portfolio d’une offre de service.

## Périmètre et preuve

Sources raccordées : port des publications, fournisseurs moteur/démo,
`feed-pages.tsx`, `page-content-views.tsx`, fiche et gestion des publications,
export du composant média existant et fragment français/anglais `page-media`.
La seule modification backend porte sur la lecture dans `pages/pages.ts`,
annoncée au coordinateur ANTSIA.

Aucun schéma, index, stockage, mutation, notification ou environnement modifié.
Aucun test, typage, lint, codegen, build, appel HTTP ou parcours navigateur lancé.
Aucun commit applicatif, push ni déploiement. L’affichage et la navigation
exécutés restent à constater lorsque le propriétaire reprendra les vérifications.
