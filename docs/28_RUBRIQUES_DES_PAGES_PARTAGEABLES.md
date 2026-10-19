# Accès direct et partage des rubriques des pages

18 octobre 2026 — **implémentation dans les sources ; vérifications différées sur instruction du propriétaire**.

## Parcours raccordés

Les onglets de contenu des pages lisent leur sélection dans l’adresse via
`contenu=publications`, `photos`, `videos` ou `avis`. Ouvrir un lien de rubrique
sélectionne son panneau lorsqu’il est disponible pour ce fournisseur. Un
changement d’onglet ajoute une entrée à l’historique du navigateur sans imposer
de défilement ; retour et suivant relisent la rubrique depuis l’adresse.

Le paramètre est strictement limité aux quatre rubriques. Une valeur inconnue,
répétée ou indisponible revient aux publications sans écrire automatiquement une
nouvelle adresse. Les photos et vidéos exigent toujours la capacité média, et
les avis leur lecteur propre. Sans ces capacités, l’ancien mur reste utilisé.

La rubrique choisie dispose d’un bouton « Partager cette rubrique ». Il réutilise
la feuille de partage existante avec le nom de la page et le libellé de la
rubrique, un lien à copier, la sélection manuelle en cas de refus du presse-papiers
et le partage natif lorsqu’il est disponible. Le bouton général de l’en-tête
continue à partager la page entière.

## Navigation et confidentialité

- Le helper `lib/page-content.ts` définit les codes et libellés des rubriques et
  construit les liens depuis la route de page existante. Le lien canonique de
  partage ne reprend aucun autre paramètre de l’adresse courante. Il cible l’ancre
  du titre des contenus déjà présente dans la fiche.
- La navigation entre onglets conserve les paramètres voisins de la page locale,
  mais remplace toutes les occurrences de `contenu` par le code choisi. Le partage
  reste distinct de cette navigation : il ne copie ni recherche voisine, ni donnée
  de session depuis l’adresse.
- Complément de gestion : le contexte facultatif du composant conserve la route
  de gestion des publications et son ancre lors d’un changement de rubrique. Le
  partage conserve son lien vers la fiche sous les droits ordinaires ; voir
  [la suite de gestion](29_GESTION_SERVICES_PAR_ETAT.md).
- Les onglets contrôlés suivent l’adresse sans deuxième état de sélection ni
  effet de réécriture automatique. Un `Suspense` local attend les paramètres avant
  de monter une liste ; les panneaux inactifs et leurs lecteurs média restent
  démontés. L’activation clavier reste manuelle.
- Source, lecteur, page et handle conservent le périmètre de la vue. Le changement
  de rubrique remet à zéro la feuille de partage et ses opérations en cours ; une
  réponse asynchrone ancienne ne confirme pas la copie d’une nouvelle rubrique.
- Ces liens n’accordent aucun droit : réseau fermé, adhésion, audience, modération,
  fichiers et disponibilité des avis gardent leurs règles existantes. L’interface
  rappelle la nécessité d’une adhésion à DIASPORALE.

Les textes complémentaires français/anglais sont isolés dans le fragment
`page-content-links`. Le nom réel de la page est transmis au composant d’onglets
par une prop facultative pour conserver la compatibilité des anciens appels.

## Coordination et état de preuve

Le périmètre a été annoncé et accepté directement avec l’autre session DIASPORALE,
qui conserve la galerie après les événements associatifs. La présente tranche
modifie les onglets des fiches et la feuille de partage, ajoute un helper et un
fragment de traductions, et transmet le nom dans la fiche. Les imports de langues
voisins sont conservés lors du raccord additif.

Aucun backend, port de données, schéma, index, mutation ou média n’est ajouté.
Les routes événementielles et la galerie voisine restent dans leur propre lot.
ANTSIA conserve ses fichiers génériques et sa tranche P12.

Aucun test, typage, lint, codegen, build, appel HTTP ou parcours navigateur lancé.
Aucun commit applicatif, push, déploiement ou changement d’environnement.
L’ouverture des liens, le retour/suivant et le partage exécutés restent à constater
à la reprise des vérifications ; les preuves historiques ne valident pas cette tranche.
