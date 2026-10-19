# Annonces épinglées des associations et entreprises

18 octobre 2026 — **implémentation dans les sources partagées ; vérifications différées à la demande du propriétaire**.

## Parcours raccordé

Les responsables disposent des gestes « Épingler » et « Retirer l’épingle » sur
les publications de leur page. Le même composant est utilisé sur la fiche et
dans l’onglet Publications de la gestion. Une annonce lisible occupe la tête du
mur, même si sa publication est ancienne ; sa deuxième apparition est écartée
visuellement des fenêtres chronologiques. Les rapports, comptes et curseurs
de pagination restent ceux du serveur.

Une feuille demande confirmation avant le choix, son remplacement ou son
retrait. La version lue est figée à l’ouverture. Une nouvelle épingle reçue
pendant la confirmation impose de fermer puis rouvrir la feuille ; un conflit
serveur ne déclenche aucun remplacement automatique. Un verrou couvre les
doubles envois et les retours reçus après fermeture ou changement de lecteur
sont ignorés par l’interface.

Le retrait de l’épingle conserve la publication. Épingler conserve son texte,
ses médias, son audience, sa portée et ses dates. Le geste ne republie pas,
n’ajoute pas de notification et n’élargit pas la visibilité. Réactions,
commentaires, partage, édition et retrait passent par les composants existants.

## Données et autorité

- `PagePublicationsCapability.pinning` est facultatif : les fournisseurs sans
  cette capacité conservent le mur existant, sans action factice.
- La lecture reçoit le handle et l’identité attendue du lecteur. Cette identité
  entre dans les arguments de la requête et sa clé de cache, puis est comparée
  à la personne authentifiée côté serveur. Chargement et erreur ont leur état
  propre, avec reprise ; sans lecture disponible, les choix d’épingle sont bloqués.
- Le moteur conserve un seul `pages.pinnedPostId`, champ optionnel sur la table
  existante. Aucune table ni aucun index supplémentaire. La cible est relue
  par identifiant, sans parcourir l’historique de la page.
- `pages.pagePinnedPost` garde la page, le réseau et la cible native de cette
  page. Une publication retirée, en attente de modération, modérée ou inaccessible
  ne livre ni carte ni identifiant brut. La projection est celle du mur existant.
- `pages.setPagePinnedPost` exige l’adhésion autorisée, le débit et un mandat
  de signataire vivant sur une page native. Dans la même transaction, la cible
  est gardée et l’épingle lisible courante est comparée à la version attendue.
  Une référence devenue illisible est normalisée en absence. Un rejeu identique
  sous mandat encore valable ne réécrit rien.
- Chaque changement effectif ajoute `page.post_pin` au journal du moteur,
  avec acteur, qualité, page et références de publications, sans leur contenu.
  Le conflit générique est traduit en `page_pin_changed` dans l’adaptateur.
- La démonstration conserve le choix collectif dans un champ optionnel de
  l’état v7 brut, compatible avec les états antérieurs et les pages créées par
  la surcouche de gestion. Elle applique mandat, permission de lecture et
  comparaison de version dans son magasin synchrone. Les préférences privées
  du fil ne deviennent pas un droit collectif sur l’épingle.

## Sources et état de preuve

Le raccord utilise le port des publications, les fournisseurs moteur/démo,
`feed-pages.tsx`, `page-post-pin.tsx` et le fragment français/anglais
`page-pinning`. Il conserve les services, demandes, groupes et événements de
page ajoutés en parallèle.

Les trois ajouts génériques du moteur ont été annoncés au coordinateur ANTSIA :
champ de table, lecture/écriture d’épingle et verbe d’audit. Les autres fonctions
de page et la fédération sont conservées. Aucun fichier d’environnement ni
configuration de déploiement modifié.

Aucun test, typage, lint, codegen, build, requête HTTP ou parcours navigateur
lancé. Aucun commit applicatif, push ni déploiement. Les résultats antérieurs
ne valident pas cette tranche ; l’exécution et l’affichage restent à constater
lorsque le propriétaire réautorisera les vérifications.
