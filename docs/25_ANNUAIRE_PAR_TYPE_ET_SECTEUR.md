# Annuaire par type d’association et secteur d’entreprise

18 octobre 2026 — **implémentation dans les sources ; vérifications différées sur instruction du propriétaire**.

## Parcours raccordés

L’annuaire propose un filtre de type après le choix « Associations », ou un
filtre de secteur après le choix « Entreprises ». Les options et leurs labels
sont ceux déjà utilisés pour la présentation et les cartes des pages. Le
changement de nature retire la classification incompatible.

Les filtres se combinent avec la recherche et le pays. Leur sélection repart
sur une première fenêtre, sans réutiliser un curseur d’une autre catégorie.
Une action réinitialise les filtres. Le message de résultat vide tient compte
de la catégorie et n’apparaît qu’après la fin effective des fenêtres.

L’adresse conserve les choix sous `type`, `activite` ou `secteur`, ainsi que
les paramètres de recherche et de pays existants. Une catégorie valide seule
permet de retrouver sa nature ; une valeur inconnue n’est pas interprétée
comme catégorie. Une adresse contradictoire est interprétée selon le contexte
explicitement choisi, sans transmettre de catégorie incompatible au moteur.

Les retours de navigation resynchronisent les filtres. Le retour de l’adresse
émise par le formulaire ne remplace pas une frappe plus récente dans le champ
de recherche. La synchronisation ne remonte pas l’annuaire à chaque frappe.

La rubrique « À propos » donne accès aux associations du même type ou aux
entreprises du même secteur, dans le pays de la page lorsqu’il est connu.
L’entrée n’existe que si cette information est renseignée et si le fournisseur
annonce la capacité de filtrage. Les pages suivies conservent leur parcours.

## Lecture et compatibilité

- `PageDirectoryRequest` accepte les champs facultatifs `associationType` et
  `sector`. `PagesCapability.supportsDirectoryCategories` active les nouveaux
  contrôles ; un ancien fournisseur ne promet pas un filtre qu’il ignore.
- Le helper des fournisseurs normalise les catégories avec les règles de
  présentation partagées. Une seule catégorie infère la nature correspondante.
  Deux catégories ou une nature incompatible donnent un refus fermé.
- Les fonctions moteur `discover` et `paginateDiscover` appliquent nature et
  catégorie dans la requête avant la fenêtre, pour la recherche comme les index,
  dans le réseau ou la racine. Les droits, la confiance, l’ordre et les badges
  conservent leur définition existante.
- Pour une catégorie, la fenêtre de pages est plafonnée à 200 lignes examinées
  et 1 Mio lu ; un budget appelant plus petit reste respecté. Une fenêtre vide
  peut annoncer une suite. Le rail sans curseur prend seulement une première
  fenêtre et peut être partiel. Sans catégorie, la lecture précédente est conservée.
- Les métadonnées existantes suffisent : aucun nouvel index, schéma, stockage
  ou traitement de reprise n’est ajouté. Les pages non classées restent visibles
  dans l’annuaire général et ne reçoivent pas de classification inventée.
- La démonstration filtre les identités projetées après les modifications de
  gestion, puis pagine. Son curseur reste lié au lecteur, au jeu fictif et aux
  filtres normalisés. Effacer un type ou un secteur retire la page de ce filtre.

Les textes complémentaires sont isolés dans le fragment français/anglais
`page-directory-categories`. Les gardes et refus du moteur sont conservés ;
aucun mandat, abonnement ou droit d’accès n’est créé par la recherche.

## Périmètre et état de preuve

Le changement générique dans `pages/pages.ts` a été annoncé au coordinateur
ANTSIA. Les autres sources raccordées sont le port et ses fournisseurs,
l’annuaire, ses routes et son écran, la rubrique À propos et les traductions.
Les médias, épingles, services et activités associatives sont conservés.

Aucun test, typage, lint, codegen, build, appel HTTP ou parcours navigateur
lancé. Aucun commit applicatif, push, déploiement ou changement d’environnement.
L’affichage et la navigation exécutés restent à constater lors de la reprise
des vérifications ; les preuves historiques ne valident pas cette tranche.
