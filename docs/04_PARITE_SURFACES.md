# Parité des surfaces — DIASPORALE.COM

> Tenu par la session de construction (PD4, point 6 du plan `docs/01`). État au 16/10/2026.
>
> **Référence** : les surfaces du réseau personnel de l'espace agent (socle), que
> `@antsia/social-features` dupliquera (PA6 d'ANTSIA). Tant que ce paquet n'existe pas, DIASPORALE
> porte ses propres surfaces dans `@diasporale/features`. Chacune lit le **port de données**
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
| Menu « … » | `PostMenu` | EXF-DG-12, 40 | 🟡 | `marks.toggleMark`, `hidePost`, `muteAuthor`, `moderation.reportPost`, `posts.remove` | sans « Modifier », sans relais ; signets sans liste |
| Profil personne (`ProfilPersonnePage`) | `/@handle` | EXF-DG-07, 08 | 🟡 | `getPublicProfile`, `diaspora.profile.memberFacet`, `posts.personPosts` | facette projetée ; mur paginé par le curseur du moteur ; photo et couverture lues et modifiables depuis les réglages en mode moteur ; aperçu limité aux informations et à la facette, publications et albums masqués (suite du 16/10 ci-dessous) |
| Relations (`PeoplePanel`, hooks de pagination) | `/relations`, demandes reçues, barre du profil, cloche | EXF-DG-18, 43 | 🟡 | `graph.connections.*`, `graph.follows.*`, hooks paginés du moteur | listes acceptées et reçues en mode moteur ; lecture en attente, réponses au droit de publier ; recherche/suggestions réservées à l’annuaire opt-in ; demandes envoyées et annulation non ajoutées dans cette tranche |
| Annuaire et recherche | `/membres` | EXF-DG-19, 46 | ✅ | `diaspora.directory.searchMembers` | opt-in par niveau ; masqué introuvable, même par identifiant exact |
| Suggestions | « Des membres à rencontrer » (rail du fil, `/membres`) | EXF-DG-18 | ✅ | `diaspora.suggestions.forMe`, `suggestions.dismiss` | pas de liste « masquées » à rouvrir (`restore` existe côté moteur) |
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
