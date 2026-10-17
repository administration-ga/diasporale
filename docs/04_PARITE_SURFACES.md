# Parité des surfaces — DIASPORALE.COM

> Tenu par la session de construction (PD4, point 6 du plan `docs/01`). État au 17/10/2026.
>
> **Référence** : les surfaces du réseau personnel de l'espace agent (socle), portées
> dans `@antsia/social-features` et réutilisées par DIASPORALE. Les surfaces propres de
> `@diasporale/features` lisent le **port de données**
> (`@diasporale/features/data`), qui a deux implémentations :
> - la **démonstration** : données fictives, ce navigateur seulement, mêmes règles du domaine ;
> - le **moteur** : ANTSIA local, tranche `convex/modules/diaspora/` et fonctions génériques.
>
> **Légende** : ✅ livré (démonstration et moteur, testé, vu sur :3031) · 🟡 partiel ·
> ⏳ attend le moteur · ⬜ à faire.

## 1. Surfaces de PD4 (EXF-DG-07 à 19)

| Surface de référence | Surface DIASPORALE | Exigences | État | Source moteur | Écarts |
|---|---|---|---|---|---|
| Fil (`FeedPage`) | `/fil` : « Mon pays », « Toute la diaspora », « Récents », « Pour vous » | EXF-DG-13 | ✅ | `posts.myFeed` (portées, voies du hub) | pages de 30, curseur composite du moteur ; « Voir plus » explicite, pages réactives et frontière réalignée ; même chaîne dans le hub pays (recette du 16/10 ci-dessous) |
| Composeur en feuille | `PostComposerSheet` | EXF-DG-10, 11 | ✅ | `posts.publish` (portée, pays, ANTSIA, médias, partage, idempotence), `media.generateUploadUrl` (`media_social`) | médias : quatre photos ou une vidéo seule, texte alternatif par média, règles du moteur jugées avant tout envoi (PR administration-ga/diasporale#5) ; la démonstration garde des photos réduites, pas de vidéo ; partage cité (original en aperçu, mot facultatif, sans média) et idempotence, une clé par série d'essais (PR administration-ga/diasporale#6) ; brouillon durable dans CE navigateur (texte et choix, sans les médias ; une clé par personne, rétabli à l'ouverture, effacé à la publication, jamais envoyé) ; local refusé dans un pays non ouvert (§3) |
| Carte de publication | `PostCard` | EXF-DG-10, 12 | ✅ | DTO `myFeed` | auteur d'une page : sa carte ; « signé par » attend PD5 ; mentions (lien vers le profil) et mots-dièse découpés par le moteur (`splitBodyRich`), dans les commentaires aussi, casse de l'auteur gardée (ANTSIA l'abaisse) ; un mot-dièse n'ouvre pas encore de recherche ; médias : photo seule à ses proportions, grille carrée de deux à quatre, retenue de la garde dite (analyse en cours, bloqué), sans visionneuse plein écran ; partage : « Partager » sur une publication publique et publiée, avec son compte, et l'original intégré, re-gardé pour chaque lecteur (« indisponible » s'il ne se lit plus) |
| Réactions (4 genres) | palette de la carte | EXF-DG-12 | ✅ | `engagement.toggleReaction` | — |
| Commentaires | feuille « Commentaires » | EXF-DG-12 | ✅ | `engagement.paginateComments`, `paginateReplies`, `comment`, `removeComment` | pas d'édition d'un commentaire |
| Menu « … » | `PostMenu` | EXF-DG-12, 40 | ✅ | `marks.toggleMark`, `hidePost`, `muteAuthor`, `moderation.reportPost`, `posts.edit`, `posts.remove` | modification de sa publication déjà livrée ; partage cité depuis la carte et son composeur ; liste privée des signets déjà présente à `/enregistrements`, pagination complétée dans la tranche du 17/10 ci-dessous |
| Signets | `/enregistrements` | EXF-DG-12 | ✅ moteur | `marks.paginateBookmarks`, `marks.toggleMark` | port `useBookmarksPage`, pages natives réactives de 50 et démonstration paginée ; vide filtré non terminal, reprise et retrait protégés implémentés ; Chrome : 50→51 uniques, retrait puis 50 persistants après rechargement ; démonstration couverte automatiquement |
| Profil personne (`ProfilPersonnePage`) | `/@handle` | EXF-DG-07, 08 | 🟡 | `getPublicProfile`, `diaspora.profile.memberFacet`, `posts.personPosts` | facette projetée ; mur paginé par le curseur du moteur ; photo et couverture lues et modifiables depuis les réglages en mode moteur ; aperçu limité aux informations et à la facette, publications et albums masqués (suite du 16/10 ci-dessous) |
| Relations (`PeoplePanel`, hooks de pagination) | `/relations` : six onglets — relations, demandes reçues, envoyées, abonnements, blocages, masquées ; barre du profil et cloche | EXF-DG-18, 43 | 🟡 | `graph.connections.*`, `graph.follows.*`, `suggestions.paginateSentInvitations`, `graph.blocks.paginateMine`, `diaspora.suggestions.paginateDismissed` / `restoreDismissed`, surfaces paginées du moteur et composant local `EngineDismissedSuggestions` | six listes raccordées en mode moteur, pages natives réactives et reprise ; lecture des choix personnels, désabonnement, annulation versionnée, déblocage et restauration des masquages accessibles en attente ; réponses et nouveau suivi au droit de publier ; blocages propres sans identité ; masquées avec profils actuellement autorisés par l’annuaire ou ligne neutre ; découverte réservée à l’annuaire opt-in ; preuves Chrome antérieures pour annulation/déblocage conservées ci-dessous ; démonstration fermée ; sixième onglet recetté dans Chrome, restauration et vide persistants, focus et responsive vérifiés |
| Annuaire et recherche | `/membres` | EXF-DG-19, 46 | ✅ | `diaspora.directory.searchMembers` | opt-in par niveau ; masqué introuvable, même par identifiant exact |
| Suggestions | « Des membres à rencontrer » (rail du fil, `/membres`), `/relations?onglet=masquees` | EXF-DG-18 | 🟡 | `diaspora.suggestions.forMe`, `suggestions.dismiss`, façade `diaspora.suggestions.paginateDismissed` / `restoreDismissed` | propositions fermées tant que le lecteur ne peut pas publier ; choix masqués privés paginés et restaurables par identifiant de version, avec relecture actuelle de l’annuaire et des blocages ; scan des 500 masquages remplacé par des recherches exactes indexées ; API générique de liste non montée ; vérification automatisée et recette Chrome vertes : restauration persistante, retour du candidat encore éligible, aucune relation ni aucun suivi créé |
| Cloche | `NotificationBell` | EXF-DG-38 | ✅ | `notifications.bell.*` | le partage d'une publication se dit (« a partagé votre publication ») ; genres de PD5 à PD8 dits « nouvelle activité » d'ici là |
| Hub pays | `/pays/[iso]` | EXF-DG-15, 16 | 🟡 | `diaspora.hubs.getCountryHub`, voies du fil | compteurs et fil local ; pages, associations, entreprises (PD5) et évènements (PD7) vides ; membres opt-in par la recherche filtrée |
| Sélecteur de pays (C11) | `CountrySwitch` | EXF-DG-15 | ✅ | — | accès rapide : mon pays, puis les trois derniers choisis (ce navigateur) |
| Stories 24 h (`StoriesTray`) | bandeau de `/fil`, `/actus` (lecteur plein écran du moteur, mode moteur) | EXF-DG-14 | 🟡 | `stories.*` (lot 12b d'ANTSIA, servi) | `StoriesViewerPage` monté sous l'îlot iCom (PD7), atteint par la brique « Statuts » d'iCom ; `…/nouvelle` ouvre le composeur ; bandeau du fil monté avec `StoriesStyles`, portrait et handle publié du moteur, horloge à la minute et ouverture par `?auteur=` (16/10, tests verts et recette Chrome locale) ; lecture en attente via le contexte réseau de lecture, création réservée au droit de publier, y compris à l’adresse directe ; rien en démonstration |
| Albums (`AlbumPage`) | onglets Photos/Albums du profil, `/@handle/albums/[id]` | EXF-DG-14 | 🟡 | `albums.*`, `@antsia/social-features/albums` (F2) | pagination native, brouillons/retraits du propriétaire et vitrine publiée des autres ; reprise du même album par `?modifier=1`, sauvegarde des métadonnées/photos/ordre/couverture, retrait confirmé sans suppression ; aperçu et démonstration fermés ; recette entre comptes terminée : audiences, retrait puis reprise/republication du même album (suite ci-dessous) |
| Coquille mobile et bureau | `AppShell` | EXT-DG-05 | ✅ | — | colonne (Fil, Mon pays, Membres, Messages en mode moteur, Profil, Parrainer, Réglages), barre basse, en-tête (Membres, Messages en mode moteur, cloche, pays) ; rail droit ouvert par la carte iCom |
| Cartes flottantes | `FloatingNotice`, pile « Avis » | charte v2 §7 | ✅ | — | échelle de couches de la charte : barres 40 < feuilles 50 < pile 55 < menus 60 |

## 2. Hors PD4 (pour mémoire)

| Surface | Prompt | État |
|---|---|---|
| Pages officielles, associations, entreprises, revendication, import public | PD5 | ⬜ — moteur prêt (lot 13 d'ANTSIA, `pages.*`) |
| Groupes thématiques (EXF-DG-24), groupe d'adhérents (EXF-DG-26) | PD5, PD7 | ⬜ — moteur prêt (lots 9 et 13) |
| Messagerie 1:1 et de groupe (EXF-DG-30), « Écrire », appels | PD7 | 🟡 — iCom du moteur monté tel quel, en mode moteur, pour un membre qui peut publier (branche locale `pd7/icom`, PR après le push d'ANTSIA) : carte iCom dans le rail dès 1 280 px, détachée en dessous ; pages `/messages` au téléphone ; « Écrire » et « Appeler » sur le profil d'une relation (le moteur n'ouvre un fil neuf qu'entre relations) ; ailleurs, « Écrire » fermé dit pourquoi. Écarts : rien en démonstration ; « Écrire » vers un correspondant déjà en conversation ouvre un brouillon, l'historique revient au premier envoi (geste du moteur, signalé à ANTSIA) ; « Appeler » joué jusqu'à la fenêtre d'appel du moteur (le backend local n'a pas de serveur média : « Connexion impossible », `mediaServerNotConfigured`) ; pas de messagerie de page |
| Évènements communautaires (EXF-DG-27, 28) | PD7 | ⬜ — évènements personnels servis (lot 12a) |
| File de modération, sanctions, relecture (EXF-DG-40 à 43) | PD6 | ⏳ — PA5 d'ANTSIA |
| Export et effacement (EXF-DG-45) | PD6 | ⏳ — effacement du moteur (PA5), crochet de tranche à prévoir pour ses tables |

## 3. Écarts assumés

- **Relecture avant publication** (invariant 10, EXF-DG-42) : le moteur ne retient encore aucun
  contenu (`pending_review`). Le crochet de politique de la tranche est accordé par ANTSIA pour PA5.
  D'ici là, une publication locale est refusée à l'écran dans un pays non ouvert ; c'est une garde
  d'écran seulement, **bloquante pour la mise en ligne**.
- **Publications de développement sans portée** : celles d'avant le lot 7 du moteur n'entrent
  dans aucune voie du hub. Données locales seulement.
- **Annuaire racine d'ANTSIA** : un membre de DIASPORALE reste trouvable dans l'annuaire public
  d'ANTSIA si son profil y est découvrable. Décision du propriétaire attendue (avis à l'accueil,
  option « profil privé »).
- **Effacement** : aucune table de la tranche n'est purgée tant que l'effacement du moteur
  n'existe pas (PA5). La recette R9 (PD6) l'exigera.

## 4. Vérifications

Chaque ligne ✅ :
- est couverte par les tests de la démonstration (`demo/store.test.ts`) et de la source moteur
  (`data/engine.test.ts`), plus la tranche quand une fonction lui appartient (`diaspora.test.ts`) ;
- a été jouée sur `http://localhost:3031` contre le moteur local avec les comptes de recette
  `@exemple.test`.

L'en-tête mobile a été contrôlé à 320, 360 et 375 px, sans défilement horizontal.

### Reprise du 16/10 — stories et albums (PD4)

- Branche locale `codex/pd4-stories-albums`, fondée sur `pd7/icom` : aucun push ni déploiement de production.
- Vérification DIASPORALE verte : typage, 238 tests du domaine, 248 des features, 101 de l'app,
  lint. Les 23 nouveaux tests couvrent le contexte moteur de lecture distinct d'iCom, le
  réseau/charte DIASPORALE, le handle publié, l'horloge des stories, la navigation, la lecture
  des albums en attente, les gardes de création et le composeur adressable.
- **Chrome, moteur local** : nouveau compte de recette fictif ; avant vérification, onglet
  Albums lisible sans création. Après vérification par la graine de recette locale : création
  d'un album « Tout le réseau » avec deux images fictives, légendes et choix de couverture,
  publication puis galerie à l'adresse publique sous `/@handle/albums/[id]`, deux images chargées.
- **Stories** : création depuis le bandeau, publication d'une image fictive, retour au fil,
  vignette affichée puis ouverture du bon auteur par `?auteur=`. Le lecteur mobile exige une
  hauteur définie de son parent : corrigé dans `StoriesScreen` (`h-dvh`), scène mesurée à
  800 px sur un écran 320 × 800 (elle était nulle), image affichée dans la capture.
- **Mise en page** : galerie à 320 px sombre et 375 px clair, fil à 320 px sombre,
  375 px clair et 1 280 px clair, sans débordement horizontal ; aperçu demandé avec
  `onglet=albums&apercu=1` : onglets et composeur d'album absents. Console sans erreur sur le
  parcours final ; avertissement Next sur `scroll-behavior: smooth` préexistant.
- **Serveurs** : bascule autorisée par le propriétaire ; serveur 3027 suspendu pendant la
  recette, DIASPORALE 3031 ensuite arrêté, serveur 3027 rétabli et HTTP 200 constaté.
- Limites du lecteur de stories héritées du moteur : pas encore de lecture pour un membre
  en attente ; fermeture par retour au fil (le marqueur de restauration de l'historique n'est
  pas exporté par le moteur). Aucun contournement ni import profond ajouté.
- Restent à recetter : albums réservés aux relations vus par un second compte, retrait,
  absence d'accès depuis ANTSIA ; ces gardes sont celles du moteur, sans modification ici.

**Reprise des contrôles du moteur (16/10)** : les sept anciens échecs Direct sont résolus
par ANTSIA `1a5f74f` ; les trois fichiers ciblés passent, 19 tests sur 19. Toutes les étapes
requises de `verify` sont ensuite validées dans l'arbre partagé, en coordination avec la session
ANTSIA : codegen, typage Convex/tests et des dix paquets, 1 104 tests Convex (dont les nouveaux
cas Direct), 53 cliquets, 24 tests de scripts, 2 869 tests des interfaces du moteur, tests des
applications et lint des neuf paquets qui le déclarent (aucune erreur ; avertissements du
moteur conservés).

Le script `verify` n'a pas terminé en un passage unique : disque plein puis délais de cinq
secondes sous forte charge. Les étapes ont été reprises et leurs résultats partagés, sans
changer les assertions : un paquet et un worker à la fois pour les tests d'application,
délai de trente secondes ; soixante secondes pour les scans de fichiers du moteur. La suite
social-features d'ANTSIA a passé ses 173 fichiers avec le délai fonctionnel de cinq secondes.
Seul le cache régénérable DIASPORALE `apps/diasporale_com/.next/dev/cache/turbopack` (7 Go) a été
supprimé, après autorisation explicite ; aucune donnée supprimée, aucun fichier ANTSIA modifié
par cette session.

### Suite du 16/10 — Mes relations (PD4)

- `/relations` et `?onglet=demandes` : liens nommés, onglet sélectionné par l'adresse.
  Accès par le menu bureau, son profil hors aperçu et l'écran Membres ; cinq entrées de la
  barre mobile conservées. Les profils restent la porte de la relation en démonstration.
- Réutilisation des hooks paginés du moteur, sans requête ni graphe dupliqué : deux curseurs
  natifs de douze pour les relations acceptées, un curseur de dix pour les demandes reçues.
  `PeoplePanel` n'est pas monté : sa recherche générique ne suit pas l'annuaire opt-in.
- `IcomIsland` et réseau de lecture DIASPORALE, en attente inclus ; changement de personne,
  réseau ou onglet réinitialise la liste. Aucun appel moteur en démonstration.
- Accepter/refuser passe par le port d'actions existant, avec droit de publier et contrôle
  serveur ; retrait de la demande seulement après succès. Les erreurs préservent les données,
  proposent de réessayer et passent avant l'état vide ; chargement suivant explicite.
- **Contrôles automatisés** : 23 nouveaux tests (8 de présentation, 9 de l’adaptateur, 6 de l’écran),
  610 tests DIASPORALE verts (238 domaine + 248 features + 124 application), typage et lint
  sans erreur. Réseau/charte, curseurs, réponses, échecs, lecture seule et remise à zéro couverts.
- **Chrome, moteur local** : deux comptes fictifs, sessions isolées ; demande envoyée depuis
  le profil, reçue sur `/relations?onglet=demandes`. Pour le membre `en_attente`, demande lisible,
  boutons Accepter/Refuser désactivés et explication de lecture seule. Après vérification par
  la graine locale de recette : boutons actifs, acceptation réussie, demande retirée, relation
  affichée dans `/relations` chez les deux comptes. Le second compte n'a consenti ni à
  l'annuaire ni aux notifications lors de son inscription.
- **Mise en page** : liste non vide à 320 px sombre, 375 px clair et 1 280 px clair ; largeur
  du document égale à celle de l'écran à chaque mesure. Console finale sans erreur ni avertissement.
  La pagination au-delà de la première page et le refus ont ensuite été joués dans le navigateur
  (suite ci-dessous).
- **Incident local et rétablissement** : backend interrompu pendant le premier essai
  d'acceptation sous forte charge ; redémarrage du backend local puis reprise complète du
  parcours réussie. DIASPORALE 3031 arrêté à la fin ; serveurs 3027 et 3030 rétablis après
  contrôle de leur identité, ressources déjà compilées servies en HTTP 200 sur chacun.
- Limites : pas de liste des demandes envoyées ni d'annulation sur cette page ; les gestes
  du profil, les abonnements et la cloche existants restent les autres portes de la relation.


### Suite du 16/10 — Refus, pagination réelle et fil/hub paginés (PD4)

- **Relations, Chrome et moteur local** : 25 profils de recette reliés au seul compte fictif
  de recette, plus douze demandeurs distincts. Pour chaque personne fictive, adhésion racine
  ANTSIA puis DIASPORALE ; aucune session ni coordonnée créée. Préparation par le seed existant
  `devSocial:demoPerson`, puis demande par la mutation publique sous la seule identité fictive.
  Aucun helper ni fichier backend nouveau ; aucune donnée consulaire réelle.
- **Demandes reçues** : dix lignes à la première page, douze après « Voir la suite » ; douze
  identifiants uniques, fin confirmée. Refus d'une ligne : avis « Demande refusée. », retrait
  immédiat de la liste ; après rechargement, dix puis onze lignes uniques, demande refusée
  toujours absente. Elle n'apparaît pas dans les acceptées.
- **Relations acceptées** : dix-sept lignes au premier affichage (douze par côté canonique
  au plus), puis vingt-six identifiants uniques : les vingt-cinq fixtures et la relation
  existante. « Voir la suite » disparaît après épuisement ; pas de curseur fabriqué par l'app.
- **Fil et hub pays** : contrat `useFeedPage` du port, conservant `useFeed` pour compatibilité.
  Curseur composite et signal de fenêtre lacunaire du moteur conservés sans les reconstruire
  depuis les cartes filtrées. Un abonnement par page, chaîne pilotée par les helpers publics
  `reseau-feed-pages` d'ANTSIA ; toutes les pages restent réactives. Même composant réellement
  monté sur `/fil` et `/pays/[iso]`, droit de réaction inchangé, erreur et reprise par page,
  données déjà lues conservées, bouton explicite et annonce accessible traduite.
- **Recette du fil** : trente cartes puis quarante (trente-six publications fictives et quatre
  antérieures), sans doublon ; après les deux publications supplémentaires de recette,
  quarante-deux cartes dont les trente-huit fixtures uniques. La dernière insertion est faite
  pendant que les deux pages restent montées : frontière déplacée, nouvelle tête visible,
  aucune des trente-huit fixtures manquante et aucun doublon. Fin du fil confirmée.
- **Portées et pays** : « Toute la diaspora » affiche seulement les six fixtures de portée
  diaspora ; le hub Canada affiche les mêmes six, sans les publications locales françaises.
  Hub France : trente puis quarante-deux cartes, les trente-huit fixtures uniques et fin.
  Le passage de portée et de pays repart à la première page.
- **R4, lecture directe locale** : deux publications fictives (une locale FR, une diaspora),
  lisibles dans DIASPORALE, rendent `notFound` depuis la racine sous l'identité de leur auteur.
  Fil racine parcouru jusqu'à sa fin : deux publications antérieures, aucun des trente-six
  identifiants de la préparation initiale. Visibilité `network`, aucun partage vers la racine.
- **Mise en page** : relations et fil à 320 px sombre, fil à 375 px clair et 1 280 px sombre,
  hub à 1 280 px sombre ; aucune largeur de document supérieure à celle de l'écran.
  Console finale du fil et du hub sans erreur ni avertissement. Next a redémarré automatiquement
  lors de compilations sous sa limite mémoire de développement ; recette reprise après
  chargement complet, sans modifier ni supprimer de cache.
- **Données de recette** : trente-sept profils fictifs et trente-huit publications textuelles,
  laissés sur le seul moteur local ; aucune suppression ni publication distante.
- **Tests ajoutés** : chaîne de pages (17 cas), adaptateur moteur (11), démonstration (6),
  plus trois tests montés du hub : 37 nouveaux cas au total. Ils couvrent continuation vide,
  reprise, données conservées, rebase, changement de contexte, droits de lecture/réaction
  et curseur à instant égal. Vérification commune ANTSIA complète : 647 tests DIASPORALE
  (238 domaine + 254 features + 155 app), typage des dix paquets et lint des neuf concernés verts ;
  1 124 tests backend, 102 cliquets, 24 scripts et 2 891 tests des surfaces du moteur verts.
  Preuve locale : `/tmp/antsia-pa3-lot17-verify.log`, exécution coordonnée par la session ANTSIA.
- **Erreur de hub corrigée** : le chargement, l'erreur et le résultat prêt sont distincts ;
  un échec ne laisse plus de squelette permanent. Message générique traduit et action explicite
  « Recharger la page » pour recréer le client et ses abonnements, couverts par trois tests montés.
- **Serveurs** : DIASPORALE 3031 arrêté avant les tests ; ANTSIA 3030 rétabli après les contrôles,
  ressource compilée HTTP 200 ; backend local 3210 conservé. Aucun fichier ANTSIA modifié ici,
  aucun push ni déploiement distant.
- **PD4 restait ouvert après cette tranche** : pagination du mur personnel ; gestion de l'avatar/couverture ;
  albums au-delà des douze premiers, reprise de brouillons et recette d'audience/retrait ;
  lecture seule des stories en attente (contrat de création séparé à fournir par ANTSIA).
  Pages/associations du hub relèvent de PD5, évènements de PD7, modération de PD6.


### Suite du 16/10 — Mur personnel et images du profil (PD4)

- **Mur indépendant de la fiche** : `useProfilePostsPage` dans le port moteur et la démonstration.
  `personPosts` reçoit le réseau DIASPORALE, le handle normalisé, une limite de trente et le
  curseur brut ; publication épinglée uniquement en tête, réactions conservées. La fiche
  n'attend plus son mur. Même chaîne réactive que le fil/hub : reprise par page, réalignement,
  fin distincte d'une page vide, reset lecteur/source/handle. Erreur de fiche avec rechargement.
- **Aperçu corrigé** : la facette publique est projetée ; le mur et les albums sont masqués
  faute de projection serveur pour un autre lecteur. Les commandes du propriétaire sont
  retirées de l'aperçu, sauf le retour. Le texte explique cette limite.
- **Photo et couverture** : DTO gardés d'ANTSIA ; aucune URL retenue n'entre dans le DOM ou
  le style. Avatar et couverture reprennent les helpers publics du moteur, avec repli de
  l'avatar en cas d'erreur et réinitialisation lors du remplacement. Dans les réglages : deux
  formulaires RHF/Zod, validation du moteur avant dépôt (JPEG/PNG/WebP, limite conservatrice
  de cinq Mio pour les deux usages), erreurs fermées et fichier conservé en cas d'échec,
  état d'analyse accessible, retrait de référence confirmé. Mutations publiques du profil
  commun : pas de retrait global du profil ni de changement de confidentialité ajouté.
  L'écran explique que ces images sont communes aux réseaux ; éditeur réservé au profil
  propre et au droit de publier, absent de la démonstration.
- **Préparation du mur réel** : graine interne de la seule tranche diaspora, autorisée avec
  ANTSIA. Confirmation et backend strictement local, cible fixe ET adresse fictive vérifiée,
  profil et adhésions préexistants actifs, trente-cinq textes de recette dans DIASPORALE,
  visibilité réseau, aucune racine, idempotence. Elle ne crée ni personne ni adhésion et ne
  supprime rien ; quinze tests de gardes et pagination ajoutés côté moteur. Les identités
  CLI sans session vivante restent refusées par PA4, aucun contournement ajouté.
- **Tests de cette tranche** : quatre-vingt-seize nouveaux cas DIASPORALE (cinq démonstration,
  quatre-vingt-onze application), couvrant port, chaîne, fiche montée, aperçu, éditeur, dépôt
  et délivrance. Passe ciblée et typage app/features verts ; les compléments PA4 suivent la vérification commune ci-dessous.
- **Restent PD4** : albums au-delà des douze premiers, brouillons, audiences entre comptes,
  retrait et étanchéité ; lecture seule des stories en attente. Les portes IDN/OTP de PA4 restent à raccorder ; IDN réel attend les clients de sandbox du propriétaire.

- **Raccord PA4 demandé par ANTSIA** : l'action « Déconnecter tous mes appareils » utilise
  désormais le helper commun de révocation, puis recharge entièrement l'entrée. Nettoyage
  de l'état mémoire et des seules clés `diasporale:brouillon:` en complément des états du
  moteur ; préférences et autres produits préservés. Avertissement après navigation si
  révocation serveur ou nettoyage local incomplet, même si une session reste valide ; aucune
  redirection de réglages concurrente. Attente, double clic et reprise d'erreur traités.
  Trente-trois tests d'intégration et de présentation ajoutés.

- **Chrome, moteur local** : mur d'un autre compte fictif : trente puis trente-cinq textes de
  recette uniques, dernière publication atteinte et bouton disparu. Passage à son propre
  profil : aucune fixture du mur précédent. Préparation rejouée : zéro création, trente-cinq
  existantes. Photo et couverture fictives déposées par les formulaires, images effectivement
  chargées (256 × 256 et 1 200 × 400). Photo remplacée : nouvelle URL, image chargée ; retrait
  annulé puis confirmé, référence absente et avis de retrait. Les fichiers stockés ne sont pas
  supprimés. Le retrait de couverture a été déclenché mais sa relecture a été interrompue par
  un redémarrage de Next : pas de preuve de relecture annoncée pour ce dernier geste.
- **Aperçu et mise en page** : `?apercu=1&onglet=albums` sur son profil montre la facette publique,
  le texte de limite et le seul lien « Revenir à mon profil » ; aucun lien de publication ni
  onglet/composeur d'album. Profil/aperçu à 320 px sombre et 1 280 px sombre, réglages à 375 px
  clair : largeur du document égale à l'écran. Captures vérifiées visuellement.
- **Déconnexion réelle** : deux sessions du même compte fictif, contextes Chrome isolés.
  Depuis les réglages : rechargement complet de l'entrée, aucun brouillon DIASPORALE ni état
  personnel `antsia:`/`antia:` dans ce navigateur. Après rechargement de l'autre contexte :
  entrée, aucune publication ni navigation privée. Avertissement de résultat incomplet aussi
  vu à l'adresse de retour, sans simuler une réussite de révocation ; cet essai valide son
  affichage, pas une panne serveur réelle. Consoles finales sans erreur ni avertissement.
- **Ressources et périmètre** : Next 3031 arrêté avant la vérification commune, aucun autre
  frontend n'avait été suspendu dans ce créneau. Backend 3210 conservé, onglets de recette
  créés par cette session refermés. Première limite mémoire à 1 Gio insuffisante ; reprise à
  1,5 Gio puis redémarrage automatique Next lors des compilations. Aucun cache supprimé.
  Un compte fictif supplémentaire reste sans profil ni adhésion après le parcours par code ;
  aucune personne réelle, donnée supprimée ou publication distante. La recette d'image locale
  ne constitue pas une preuve d'antivirus réel ni d'hébergement de production.
- **Garde de session réactive** : `EngineConvexProvider` reçoit maintenant `mySession`, pour
  couper les contenus lors d'une révocation reçue pendant qu'un onglet reste ouvert.
  Deux tests du raccord ajoutés ; la recette de cette session a prouvé le refus de la seconde
  session après rechargement, pas encore sa fermeture spontanée sans rechargement.

- **Tranche diaspora et PA4** : après une vérification effective dans l'enfant, le helper
  d'ANTSIA promeut seulement la racine existante et active ; rôle, origine, départs et
  sanctions sont conservés. Pour le compte léger, l'attestation utilise l'empreinte du
  courriel actuellement vérifié par Better Auth ; le sujet IDN reste prioritaire. La demande
  est re-gardée avant l'envoi ET avant l'enregistrement de la réponse : même sujet et même
  consentement initial encore en vigueur, personne/réseau/finalité liés. Changement ou retrait
  pendant l'aller-retour : échec technique fermé, aucun lien, promotion, badge ou notification
  de vérification. Un nouveau consentement ne réactive pas une ancienne demande. Vingt-cinq
  cas d'intégration ajoutés ; aucun appel réel à consulat.ga ni client IDN de sandbox testé.

- **Vérification finale commune** : `verify` terminé code 0 dans l'arbre partagé PA4, après
  correction du raccord des quatre clés d'avis d'image et du lien indisponible en démo.
  **778 tests DIASPORALE** (238 domaine + 259 features + 281 application), soit 131 nouveaux
  cas depuis la tranche fil/hub ; **5 836 tests au total** : notamment 1 302 backend, 111
  cliquets, 130 API et 2 918 surfaces moteur. Typage des dix espaces et lint des neuf concernés
  sans erreur. Avertissements conservés, dont deux dans l'éditeur d'images (analyse statique
  d'une référence enfermée dans le callback RHF et recommandation Next sur l'image native).
  Preuve locale : `/tmp/antsia-pa4-verify.log`, code final confirmé par la session ANTSIA.
  Les 25 intégrations de tranche PA4 et les 15 cas de graine locale sont inclus.

### Suite du 16/10 — Albums complets et lecture des stories en attente

- **Coordination** : surfaces `reseau-albums/*`, locales `albums.json` et composants
  `StoriesTray`/`StoriesViewerPage` délégués par ANTSIA. API/identité préservées ; raccord
  de navigation PA4 adapté à `navigate(result)` sous le verrou commun du moteur.
  Moteur committé localement : `8d4754d`, après PA4 `ee8ba1e` ; aucun push.
- **Albums** : `paginateMyAlbums` sur son onglet Albums (tous états),
  `paginatePersonAlbums` sur Photos et chez autrui. Pages réactives chaînées par les
  curseurs natifs ; continuation après page filtrée vide, dédoublonnage, invalidation
  des descendants à chaque frontière modifiée, erreur avec reprise et données conservées.
  Réinitialisation réseau/personne/profil/variante/source ; cartes en liens accessibles.
- **Reprise** : `getAlbum` propriétaire, même identifiant ; titre/description/audience
  RHF/Zod, photos serveur distinctes des nouveaux fichiers, ordre/couverture/légendes
  conservés. Ajout borné à 60, rattachement relu avant libération des fichiers locaux,
  idempotence et alt préservé. Sauvegarde explicite possible sans photo. Un album publié
  est annoncé comme tel : enregistrer modifie sa version visible, sans faux brouillon.
- **Retrait** : dialogue du kit d'espace avec ses styles, confirmation et verrou immédiat,
  erreur traduite/reprise ; `withdraw` seulement, aucune suppression définitive. Les DTO
  retenus restent sans image même s'ils contiennent une URL incohérente.
- **Stories** : réseau de lecture distinct d'iCom ; `canCreate=false` en attente, bandeau
  et lecteur conservés, aucun composeur monté même via `/actus/nouvelle`. Le comptage
  `markSeen` reste celui du serveur, explicitement autorisé en attente. Cache borné par
  réseau/personne ; changement de droit démonte le composeur et oublie son intention.
- **Graine locale** : treize brouillons vides, privés, sur le seul compte fictif réservé
  préexistant et vérifié ; confirmation + backend local obligatoires, aucune identité,
  adhésion ou image créée par la graine. Rejeu idempotent préservant les modifications,
  collision de réseau/suppression refusée atomiquement. Création locale 13/0 constatée.
- **Contrôles ciblés** : 160 tests des surfaces partagées, 66 du raccord DIASPORALE et
  35 de la graine/mur verts ; typage et lint sans erreur. Journaux locaux
  `/tmp/diasporale-pd4-{albums,app,seed}-targeted.log` et `/tmp/diasporale-pd4-types.log`.
  Puis `bun run --cwd ../ANTSIA verify` terminé **code 0** : **6 007 tests**, dont
  **822 DIASPORALE** (238 domaine +259 features +325 app), 1 322 backend, 111 cliquets,
  170 API et 2 983 surfaces moteur ; dix typages et neuf lints sans erreur. Log complet
  `/tmp/diasporale-pd4-albums-verify.log`. Avertissements lint présents (images natives
  des surfaces partagées et avertissements hérités) ; aucun avertissement de référence
  ajouté au composeur après correction par effet de mise en page.
- **Chrome local effectivement joué** : propriétaire 12→13 albums, 13 liens uniques puis
  fin ; reprise du brouillon, titre/description/audience enregistrés sur le même album ;
  deux images fictives déposées par le circuit normal, légendes et ordre B/A enregistrés ;
  rechargement avec métadonnées/photos/ordre et couverture existante conservés, publication
  du même album, deux images chargées. Redémarrage Next sous son seuil mémoire repris.
- **Chrome croisé, après déverrouillage manuel** : album public lu par un autre membre,
  puis audience « Mes connexions » enregistrée ; la connexion existante garde ses deux
  images, le membre sans connexion reçoit le refus indistinct et zéro image. Retour à
  l'audience publique : les deux images redeviennent lisibles dans son onglet ouvert.
- **Retrait joué** : dialogue modal fixe avec focus interne, annulation sans changement,
  puis confirmation : l'auteur voit « Retiré » avec les deux photos ; l'autre onglet se
  ferme réactivement, puis reste inaccessible avec zéro image après rechargement.
  Reprise et republication du même identifiant : deux photos/légendes dans l'ordre B/A.
- **Mise en page réellement vue** : galerie à 320 px sombre, 375 px clair, 1 280 px sombre,
  document égal à la largeur d'écran, deux images chargées ; captures inspectées. Console
  finale de la galerie rechargée sans erreur ni avertissement. Les erreurs de ressources
  antérieures venaient des redémarrages automatiques de Next à son seuil mémoire ; les
  navigations concernées ont été rechargées puis rejouées, sans les compter comme succès.
- **Ressources** : suppression explicitement autorisée du seul ancien cache ANTSIA
  `apps/antsia_ga/.next/dev/cache/turbopack`, serveur arrêté et aucun fichier ouvert ;
  environ 1 Gio libéré (462 Mio → 1,5 Gio à cet instant). Aucun autre cache ni donnée
  supprimé. Après les contrôles, frontend ANTSIA rétabli sur 3030 et backend local conservé.
- **Story réellement lue en attente** : `pd4.lecture` confirmé « En attente » dans ses
  réglages et par l'avis de compte du fil ; nouvelle story synthétique publique publiée par
  l'auteur via le circuit normal. Le plateau exige une source ; l'API normale refuse le
  suivi en attente, garde inchangée. `storyReaderForRecette`, interne et strictement locale,
  prépare le seul abonnement fictif entre deux identités fixes vérifiées (avec agrégat),
  sans modifier identité, adhésion, consentement ou média ; 54 tests de graines verts,
  dont 19 nouveaux. Exécution locale : `created: true` après « Functions ready ».
  Le fil affiche « 1 actu, 1 non vue » ; son bouton ouvre `/actus?auteur=relations.recette`,
  image 540×960 effectivement chargée, hauteur rendue environ 635 px, légende attendue,
  aucun input fichier/composeur. Publication du compte en attente toujours désactivée.
- **Adresse de création en attente** : après le second déverrouillage manuel,
  `/actus/nouvelle` affiche le lecteur avec la même image chargée (375 px, hauteur rendue
  812 px), aucun champ fichier, aucune zone de texte ni bouton de publication. Le bandeau
  du fil est aussi réellement vu à 375 px clair et 320 px sombre sans débordement, avec
  l'avis « Votre compte est en attente » et sans carte de création ; console finale propre.
  L'onglet isolé est fermé, l'onglet propriétaire vidé et l'émulation réinitialisée.
- **Historique du blocage PA5 avant correction** : première tentative arrêtée au codegen
  par les contrats de contexte des notifications ; après corrections coordonnées, le
  codegen et les typages Convex/tests passent, puis **1 425 tests backend réussissent et
  17 échouent** dans cinq fichiers après les changements PA5. Log `/tmp/diasporale-pd4-stories-final-verify-2.log`.
  Les 54 tests graines/mur/albums/lecteur passent. Les échecs sont transmis au chat ANTSIA,
  ses fichiers conservés ; aucun commit de cette nouvelle graine avant `verify` commun vert.
  La vérification à 6 007 tests reste la preuve des commits applicatifs précédents, sans
  annoncer ce nouveau snapshot PA5 entièrement vert. Frontend DIASPORALE arrêté ;
  frontend ANTSIA rétabli sur 3030 (`/entrer` HTTP 200), seul frontend actif, backend 3210
  conservé. Aucune production.

### Reprise du contrôle PA5 — 16/10

- Les cinq fichiers précédemment en échec et les graines diaspora passent ensemble :
  **144 tests, six fichiers, code 0** (`/tmp/diasporale-pa5-17-recheck.log`). Les 17 cas
  précédents sont résolus ; les assertions d’audience et les gardes serveur sont conservées.
- Le contrôle commun est sérialisé avec ANTSIA, sans frontend : **6 223 tests, code 0**,
  dont backend **1 455**, **122 cliquets**, **24 tests de scripts**, surfaces moteur **2 987**
  et DIASPORALE **828** (238 domaine, 259 surfaces, 331 application). Codegen, types Convex
  et tests, dix typages d’espaces et neuf lints sans erreur ; avertissements existants.
  Preuve finale : `/tmp/antsia-pa5-verify-validated.log`, code confirmé par ANTSIA après
  fermeture du cas d’export d’un message original retiré. Les échecs intermédiaires des
  passes `green` et antérieures restent historiques, pas le résultat final.
- Le complément de graine locale et le rapport de recette peuvent être committés sur ce
  contrôle partagé, sans embarquer les fichiers PA5 d’ANTSIA. Les six cas supplémentaires
  du bouton profil sont également couverts ; leur livraison appartient à la tranche suivante
  « Mes abonnements » (`docs/06`). Aucun nouveau contrôle navigateur revendiqué ici.


### Mes abonnements et désabonnement en attente — 16/10

- **Raccord réel** : troisième onglet adressable `/relations?onglet=abonnements`, navigation
  française/anglaise. `FollowsSection` est la carte existante du moteur exposée seule avec
  ses styles et un lien de découverte injecté vers `/membres`. Aucun montage de recherche
  générique ni lecture d’une liste d’abonnés ; leur décompte propre reste agrégé.
- **Pages** : taille native de 12, chaque page reste abonnée ; dédoublonnage par personne,
  amont prioritaire, page vide non terminale franchissable, frontière réalignée et anciens
  rapports ignorés même si un curseur revient. Erreur/reprise conserve les lignes valides.
  Verrou immédiat par ligne, retrait seulement après succès, refus traduit et nouvelle
  tentative possible. Changer de lecteur/réseau remonte la chaîne ; un contexte de lecture
  encore lié à l’ancienne adhésion ne monte aucune liste privée.
- **Droits** : le profil permet aussi de ne plus suivre en attente ; suivre, demander une
  connexion et répondre restent fermés. Le moteur juge toujours l’opération ; aucune garde
  ni API backend nouvelle. Une mutation de liste terminant après démontage ne notifie pas
  le nouveau lecteur. La sentinelle est nettoyée au commit du changement de contexte.
- **Tests** : 34 nouveaux cas moteur (22 section montée, 11 paginateur pur, un PeoplePanel),
  17 application (onze raccord, six profil). Ciblés : **60 moteur et 37 application verts**.
  La passe complète finale est **code 0 : 6 268 tests**, dont 1 455 backend, 122 cliquets,
  24 scripts, 3 021 surfaces moteur et 839 DIASPORALE (238 domaine, 259 surfaces, 342 app).
  Codegen, types Convex/tests, dix typages d’espaces et neuf lints sans erreur ; avertissements
  existants. Preuve : `/tmp/diasporale-pd4-following-verify-release.log`.
- **Chrome réel** : lecteur fictif `pd4.lecture`, statut « En attente » relu dans les réglages,
  ANTSIA dérivée « Déclarée ». Liste initiale : un abonnement à `relations.recette` ; profil
  suivi : désabonnement actif, connexion/messagerie fermées. Retrait depuis la liste via la
  mutation publique, avis « Suivi retiré », état vide vers `/membres`. Après rechargement :
  aucun bouton de retrait ; sur le profil, « Suivre » et « Se connecter » désactivés.
  L’abonnement fictif est laissé retiré ; la graine locale peut le préparer pour une autre recette.
- **Visuel** : 320 sombre, 375 clair, 1 280 sombre sans débordement du document. L’onglet actif
  initialement coupé est maintenant mis en vue par défilement de sa piste seulement, sans
  déplacer la page ni le focus. Avertissement Next du défilement doux corrigé par l’attribut
  racine prévu ; aller-retour demandes/abonnements : état actif correct, console finale sans
  nouveau warning ni erreur. Captures locales : `/tmp/diasporale-pd4-abonnements-320-sombre.jpg`
  et `/tmp/diasporale-pd4-abonnements-375-clair.jpg`. Thème clair initial rétabli, viewport
  réinitialisé, seul onglet créé fermé ; aucune session révoquée.
- **Limite de preuve** : pagination multiple, pages vides, refus et courses validés par les
  composants montés ; Chrome utilise un seul abonnement réel. La démonstration garde la
  surface fermée. Déblocages : query publique des seuls blocages émis à définir avec ANTSIA ;
  ne pas exposer le helper interne bidirectionnel. Aucun push ni publication de production.

- **Clôture coordonnée** : surface moteur `d2a782b` (six fichiers seulement) ; DIASPORALE 3031
  arrêté, ANTSIA 3030 rétabli (`/entrer` HTTP 200), backend 3210 conservé. Aucune suppression
  de cache ou de session, aucun push.

### Demandes envoyées, annulation versionnée et déblocages — 17/10

- **Sources committées localement** : backend ANTSIA `1637c12`, surfaces moteur `a2350ca`
  (dix fichiers), application DIASPORALE `a1de52e` (six fichiers, dont le plan `docs/07`).
  Contrat backend : `ANTSIA/docs/08_CONTRAT_DEMANDES_ET_DEBLOCAGES.md`.
- **Cinq onglets réels** : relations acceptées, demandes reçues, envoyées
  (`/relations?onglet=envoyees`), abonnements et blocages (`?onglet=blocages`).
  `SentInvitationsSection` et `BlockedPeopleSection` réutilisent les surfaces du moteur.
  La découverte reste un lien vers `/membres`, sans recherche générique montée ; les
  nouvelles listes restent fermées dans la démonstration.
- **Annulation implémentée et testée** : la liste publique existante conserve
  `at=requestedAt`. `cancelSentRequest` exige le réseau, la ligne et cette version exacte ;
  seul son demandeur peut l’annuler, y compris en attente. Rejeu idempotent limité à la
  version effectivement annulée ; acceptation, autre réseau, tiers et ancienne version
  refusés de façon indistincte. La réémission avance strictement la version. L’annulation
  résout la notification reçue en `cancelled`, sans nouvelle notification ni retrait d’une
  relation acceptée. Mutex immédiat par ligne ; retrait de l’écran après succès seulement,
  limité à l’identifiant **et** à sa version, erreurs traduites et nouvelle tentative possible.
- **Blocages propres** : intentions globales `personBlocks` et marqueurs historiques lus
  par deux curseurs natifs indépendants ; fusion réactive et dédoublonnage par cible. Le DTO
  ne livre que l’identifiant technique et la date : aucun nom, profil, avatar, handle,
  réseau d’origine ou blocage entrant exposé. La confirmation retire seulement les intentions
  de l’appelant ; un blocage inverse reste effectif. Aucun suivi ni relation recréé ; les
  suivis historiques sont conservés. Lecture de 101 lignes historiques pour refuser au-delà
  de 100 **avant toute mutation**, garde de cible effacée, état `blocked_by_me` compatible
  avec un `connectionId` nullable.
- **Pages et contexte** : réducteur partagé `cursor-pages` pour abonnements, demandes
  envoyées et blocages ; chaque page montée reste abonnée, amont prioritaire sur les doublons,
  pages vides non terminales continuables, rebase des descendants et générations contre les
  réponses périmées. Panne/reprise conserve les lignes valides. Changement de réseau ou de
  lecteur : réinitialisation immédiate ; aucune résolution de mutation de l’ancien lecteur
  ne retire une ligne ni n’affiche un avis au nouveau.
- **Vérification finale** : `verify` commun terminé **code 0**, **6 365 tests**, soit
  **97 cas supplémentaires** depuis les 6 268 précédents : 26 backend, 48 surfaces moteur,
  23 application. La passe comprend notamment 1 481 tests backend, 122 cliquets, 24 scripts,
  3 069 surfaces moteur et 862 DIASPORALE (365 application, 238 domaine, 259 features).
  Codegen, types Convex/tests, dix typages d’espaces et neuf lints sans erreur ;
  avertissements préexistants. Preuve : `/tmp/diasporale-pd4-requests-blocks-verify-release.log`.
  Les ciblés précédents avaient validé 59 cas backend, 108 UI moteur et 39 application ;
  la passe finale inclut le quarantième cas de `relations-screen`, consacré au listener de
  redimensionnement et à son nettoyage.
- **Chrome réel, déblocage validé** : `pd4.lecture` confirmé « En attente » dans ses réglages,
  adhésion ANTSIA dérivée « Déclarée ». Blocage du propriétaire public `relations.recette`
  par la mutation normale, sans relation ni suivi préalable. La liste rend une seule ligne
  neutre malgré intention et marqueur historique, sans profil. « Annuler » dans la
  **confirmation de déblocage** conserve le blocage après rechargement ; confirmation du
  retrait : avis « Blocage retiré », puis état vide persistant après rechargement. Sur le
  profil, « Suivre » et « Se connecter » restent désactivés pour ce lecteur en attente.
- **Visuel réellement vu** : 320 px sombre, 375 px clair et 1 280 px sombre sans débordement
  horizontal, onglet actif visible. Transition 1 280 → 320 px observée sans nouveau rendu :
  seul le défilement de la piste des onglets est ajusté par le listener `resize`. Captures
  locales : `/tmp/diasporale-pd4-blocages-375-clair.jpg` et
  `/tmp/diasporale-pd4-blocages-320-sombre.jpg`.
- **Chrome réel, annulation validée ensuite** : après correction par ANTSIA de son erreur
  PA6 hors périmètre dans `MessagerieListView.tsx`, le parcours de connexion réel du compte
  vérifié Relations Recette aboutit. Demande publique à `@pd4.lecture`, compte fictif en
  attente ; le profil affiche « Demande envoyée ». `/relations?onglet=envoyees` rend une
  ligne « Lecture Recette PD4 », « En attente de réponse » et le bouton d’annulation.
  Clic réel : avis « Demande annulée. », puis liste vide. Rechargement complet sans cache :
  vide persistant ; revisite du profil : « Se connecter » de nouveau proposé. La recette
  reste dans Chrome ; aucun navigateur intégré employé.
- **Portée exacte de cette preuve** : pas de tentative réelle du destinataire après
  annulation ; refus, version et notification `cancelled` couverts par les tests. Dernière
  navigation vers les demandes envoyées : aucun avertissement ni erreur console, aucune
  réponse de ressource avec statut ≥ 400. Un 404 transitoire non identifié a été observé
  après le premier rechargement et n’a pas été reproduit ensuite : ce constat ne vaut pas
  absence d’erreur sur tout le parcours. La capture d’annulation a été affichée par l’outil,
  mais son export en fichier a été refusé ; aucun fichier de capture d’annulation revendiqué.
  Les deux captures de blocages déjà citées restent les fichiers disponibles.
- **Ressources et clôture de la recette** : deux caches Webpack précisément autorisés
  avaient été supprimés après arrêt de 3031 et vérification de l’absence de fichiers ouverts :
  gain mesuré **733 460 Kio** (environ 716 Mio), espace libre **302 468 → 1 035 928 Kio**
  à cet instant. Une nouvelle saturation `ENOSPC` a ensuite fait tomber le backend ; reprise
  **sans suppression supplémentaire**, backend « Functions ready » à 08 h 17 dans
  `/tmp/diasporale-pd4-convex-recipe-final.log`, frontend relancé avec plafond mémoire de
  2 048 Mio. Chrome a conservé l’authentification du propriétaire. Viewport réinitialisé avant
  la perte d’accès à l’extension Chrome normale ; retour au thème clair de cette session
  non recontrôlé. Dernier onglet dédié à la recette fermé ; seul l’onglet vide de l’outil reste.
  DIASPORALE 3031 arrêté ; backend 3210 rétabli. Aucun autre cache, environnement, donnée
  ou session supprimé ; aucun push ni production.
- **Restitution confirmée** : DIASPORALE 3031 arrêté, frontend ANTSIA 3030 rétabli,
  `/entrer` **HTTP 200**, backend 3210 prêt et conservé. Seuls 3210 et 3030 écoutent.
  Journal frontend : `/tmp/diasporale-pd4-antsia-3030-restored.log`. ANTSIA informé,
  créneau PA6 rendu ; dernier onglet de recette fermé, onglet vide de l’outil seul restant.
- **Écart hors périmètre signalé à ANTSIA** : pendant une redirection du lecteur en attente,
  `/fil` appelle `diaspora.suggestions.forMe` et reçoit `statusInsufficient` ; non corrigé
  dans cette tranche.

### Suggestions masquées et signets paginés — 17/10, tests et recette moteur terminés

- **Périmètre et état** : réalisation du plan
  [`docs/08_PLAN_PD4_SUGGESTIONS_MASQUEES_ET_SIGNETS.md`](08_PLAN_PD4_SUGGESTIONS_MASQUEES_ET_SIGNETS.md).
  Sources applicatives committées localement : `4a48fc6` (masquées/signets), `bce25cd`
  (noms civils simulés). Vérification finale complète code 0 et recette Chrome moteur terminées.
  PD4 reste ouvert. Les résultats et restitutions de serveurs des sections précédentes
  constituent des preuves historiques distinctes.
- **Sixième onglet** : `/relations?onglet=masquees` monte le composant local DIASPORALE
  `EngineDismissedSuggestions`, sans la recherche générique de `PeoplePanel`. Les pages de
  douze utilisent la façade `diaspora.suggestions.paginateDismissed` ; maximum serveur de
  cinquante lignes et 2 Mio par page. Chaque page reste abonnée ; le réducteur public
  `cursor-pages` du moteur porte fusion, frontières, générations et reprise. La découverte
  reste exclusivement `/membres` ; la surface privée du moteur reste fermée en démonstration.
- **Identité relue pour chaque lecteur** : la façade applique les règles actuelles de
  l’annuaire DIASPORALE et des blocages avant toute projection. Une cible encore autorisée
  possède son mini-profil ; sinon la ligne demeure neutre, sans nom, handle, avatar ni lien.
  En attente, la liste des choix personnels et leur restauration restent accessibles,
  avec identité neutre faute de droit d’annuaire. Aucune nouvelle relation, aucun suivi
  et aucune notification au tiers ne résultent de cette restauration.
- **Restauration versionnée** : mutation `diaspora.suggestions.restoreDismissed` avec
  `networkId` et `dismissalId`, l’identifiant du masquage servant de version. Acteur et
  réseau bornent le choix ; un bouton ancien ne retire pas un nouveau masquage de la même
  cible. Mutex immédiat par ligne, retrait après succès et protection contre une résolution
  pour un ancien lecteur. ANTSIA ferme également l’ancienne liste générique
  `suggestions.paginateDismissed` par `policyRefused` sur les réseaux gouvernés, avant toute
  projection, avec test de transition et conservation des choix enregistrés. Elle n’est pas
  montée ici ; les signatures des anciennes mutations restent intactes.
- **Exclusion complète des choix masqués** : `diaspora.suggestions.forMe` remplace le scan
  des 500 premières lignes par un lookup exact indexé de chaque candidat du vivier borné
  à 120. Un masquage situé au-delà de la première tranche ne se perd plus. Dans l’adaptateur
  de l’application, `forMe` reste ignoré tant que l’adhésion est non résolue ou que le lecteur
  ne peut pas publier ; un membre en attente reçoit une liste de propositions vide.
  Cela corrige dans cette nouvelle tranche l’appel `statusInsufficient` signalé plus haut.
- **Signets au-delà des cinquante premiers** : `/enregistrements` et le retrait existaient
  déjà, comme la modification de publication et le partage cité. Le nouveau port
  `useBookmarksPage` conserve l’ancien `useBookmarks` et transmet les curseurs natifs
  opaques, sans les convertir en curseurs de fil. Fenêtres de cinquante, toutes pages
  montées et réactives, dédoublonnage par publication, amont prioritaire, descendants
  abandonnés si la frontière change ; page filtrée vide non terminale continuable.
  Erreur et reprise conservent les lignes valides ; lecteur, réseau ou mode remettent la
  chaîne à zéro. La démonstration possède sa pagination locale cohérente. Le rendu reste
  l’aperçu réduit autorisé par le DTO, sans fabriquer de carte de publication complète.
- **Retrait des signets** : verrou immédiat par ligne et clé de composant composée de
  `postId` et `markedAt`. Retrait local limité à cette version après succès public ;
  si `toggleBookmark` renvoie `bookmarked: true`, la ligne attend la vérité réactive,
  sans avis de retrait ni seconde bascule automatique. La résolution d’une ancienne
  version distinguée par `markedAt` ou d’un ancien lecteur ne retire pas la nouvelle ligne
  et ne lui adresse pas d’avis. Une panne garde la commande réessayable. Limite conservée
  du contrat `toggleBookmark` : aucun jeton conditionnel ne distingue un réenregistrement
  ayant exactement le même horodatage ; aucune nouvelle garantie backend n’est ajoutée.
- **Refus et confidentialité des pages en cache** : les projections réactives sont reportées
  avant peinture. Un refus d’accès en lecture ou en retrait masque toute la chaîne concernée ;
  chaque page doit apporter sa propre réponse de reprise autorisée, dans la génération
  courante. Le succès d’une autre page, un rendu de cache ou une ancienne réponse ne la
  réautorise pas. Le refus d’un retrait de signet déclenche une relecture sans annoncer de
  suppression ni relancer la bascule. Les pannes temporaires gardent les lignes valides.
- **Cibles UI code 0, 17/10** : 148 tests dans quatre fichiers de l’application (38 masquées,
  38 écran signets, 21 adaptateur et 51 intégration des relations), puis 10 de démonstration.
  Un worker, heap Node de 1 Gio, délais de tests et hooks de 30 s ; assertions conservées.
  Journaux `/tmp/diasporale-pd4-hidden-bookmarks-app-targets-final.log` (13,73 s) et
  `/tmp/diasporale-pd4-bookmarks-demo-targets-final.log` (1,70 s). Avertissement Node 25
  `localstorage-file` connu, sans erreur de test. La première passe interrompue n’est pas comptée.
- **Noms civils structurés** : module pur partagé `@antsia/social-domain/civilName`,
  NFC, patronymes en capitales et prénoms par segment, accents/apostrophes/tirets conservés.
  Le formulaire IDN simulé normalise réellement les champs au blur, par Zod et avant écriture ;
  les snapshots locaux sont corrigés sans perdre les identifiants ni les données voisines.
  Fixtures civiles explicites, sans découpage d’un nom social. Les alias choisis, sujets,
  attributs de confiance et consentements sont conservés ; aucune donnée civile consulaire
  ni preuve signée n’est ajoutée ou réécrite. Limite du sujet fictif dérivé du nom : une ancienne
  forme `ß` peut différer d’une nouvelle saisie déjà normalisée `SS` ; aucun rapprochement
  par nom ni changement du sujet historique. Ce parcours n’est pas le raccord IDN réel.
- **Passe finale complète code 0** : 6 786 tests, dont 953 DIASPORALE (domaine 190,
  features 285, application 478), dix espaces typés et neuf lints sans erreur. Journal
  `/tmp/diasporale-pd4-hidden-bookmarks-verify-analysis15.log`. Répartition totale : backend
  1 551 en 52,06 s, cliquets 124, scripts 29, social-domain 473, contrats 57, diaspora-domain
  190, UI 86, social-features 3 154, API 238, diasporale-features 285, admin 78, ANTSIA 43,
  DIASPORALE 478. Les 18 cas backend des masquées et 31 cas civils sont inclus ; les deux
  correctifs Hooks, dimensions des avatars, `content-visibility` et focus ANTSIA sont vérifiés.
  Les trente fichiers de code contrôlés sont identiques au gel avant/après la passe.
- **Configuration de preuve** : Node 22.22.3 pour toute la chaîne, heap 1 536 Mio,
  `GOMAXPROCS=2`, tâches sérialisées et créneau réservé avec les trois chats voisins.
  Backend local : concurrence d’analyse un et budget d’analyse temporaire **15 s**,
  preuve minimale `/tmp/antsia-pa7-backend-local-analysis15-proof.json`. Délai applicatif
  conservé à 1 s et délais/assertions des tests inchangés. Aucun contrôle neutralisé.
  Cette passe ne prouve pas le budget d’analyse par défaut 4 s ni une livraison de production.
- **Tentatives précédentes distinctes** : `/tmp/antsia-pa7-verify-final.log` avait 6 786 verts
  avant les derniers détails UI. `verify-release.log` a échoué sur le focus ANTSIA, corrigé
  par son propriétaire. Les essais `verify-final.log`, `verify-node22.log` et
  `verify-coordinated.log` ont rencontré le budget d’analyse 4 s. `verify-final-retry.log`
  a été interrompu après 11 min 16 s de backend Node 25 sans bilan. `verify-serial.log`
  (concurrence d’analyse un) a passé codegen/types, puis rencontré un délai LiveKit avant
  interruption 130 ; `verify-bounded.log` a été interrompu 130 après codegen/types pour
  laisser finir les publications voisines, sans bilan de tests. Ces derniers journaux ont
  tous le préfixe `/tmp/diasporale-pd4-hidden-bookmarks-` ; aucun total final n’en est déduit.
  Charge globale observée jusqu’à 128,58 et 51 processus exécutables ; cause exclusive
  non établie. Aucun processus étranger arrêté. ANTSIA a retiré son seul cache console
  autorisé ; DIASPORALE n’a supprimé aucun cache, donnée ou session.
- **Commits locaux** : application `4a48fc6`, civil simulé `bce25cd`, moteur
  masquées/réducteur `b03498b`, civil `18cd63e`, préférences ANTSIA `8737055`. Aucun push.
- **Chrome — moteur local réel** : session fictive vérifiée existante réutilisée, sans nouvelle
  connexion. Masquage de Filleul Recette depuis les suggestions, présence dans le sixième
  onglet, restauration et vide persistants après rechargement. Candidat de nouveau proposé
  dans `/membres` car encore éligible ; son profil propose toujours « Se connecter » et
  « Suivre », et « Écrire » reste fermé : aucun lien automatique. Deuxième cycle au clavier :
  Tab vers la restauration, focus visible, Entrée, avis « Choix de masquage mis à jour. »
  puis liste vide à nouveau confirmée après rechargement.
- **Signets 50→51→50** : sur les seules publications fictives déjà présentes, 50 ajouts
  privés par les menus du fil, en plus d’un signet existant. Première page de 50 ;
  « Voir plus d’enregistrements » donne 51 liens distincts et termine la chaîne. Retrait
  d’un signet nouvellement créé par Tab/Entrée : 50 lignes uniques, avis de retrait.
  Rechargement complet : 50 uniques, puis continuation terminale vide sans perdre de ligne.
  Les 50 choix de recette restants sont conservés sur ce compte fictif ; publications intactes.
- **Présentation** : masquées à 320 sombre, 375 clair et 1 280 sombre, onglet actif visible
  à chaque redimensionnement ; signets aux mêmes largeurs, aucun débordement horizontal.
  Focus clavier constaté sur restauration et retrait, anneau visible dans les deux thèmes.
  Console finale des pages signets et masquées sans nouveau warning ni erreur.
  Limites : pagination des masquées au-delà de douze et transitions d’identité/autorisations
  couvertes par les tests, sans nouveau rejeu croisé avec un membre en attente dans Chrome.
  La démonstration paginée est couverte automatiquement ; cette recette est celle du moteur.
- **Environnement restitué** : compilation coordonnée sous Node 22/Webpack, connexion en
  3,2 s puis routes membres/relations/signets préchauffées. Journal
  `/tmp/diasporale-pd4-hidden-bookmarks-chrome-coordinated.log`. Les premières compilations
  non abouties restent des essais distincts (`-chrome.log`, `-chrome-node22.log`).
  Émulation supprimée, viewport initial 1 280×690 et préférence sombre confirmés, unique
  onglet remis sur `about:blank`. Next 3031 arrêté proprement code 0 ; baseline sans frontend
  3030/3031/3032 restituée. Backend ANTSIA conservé avec son analyse locale temporaire 15 s,
  créneau entièrement rendu aux trois chats. Pas de nettoyage de cache/données/sessions,
  pas de fichier d’environnement modifié ; disque final mesuré 912 Mio, aucun gain de nettoyage revendiqué.
- **Suite PD4** : commandes de confidentialité et de retrait du profil ; cette tranche
  ne clôt ni PD4 ni les portes IDN/consulaires réelles.
