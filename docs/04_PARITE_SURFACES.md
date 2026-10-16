# Parité des surfaces — DIASPORALE.COM

> Tenu par la session de construction (PD4, point 6 du plan `docs/01`). État au 16/10/2026.
>
> **Référence** : les surfaces du réseau personnel de l'espace agent (socle), que
> `@antia/social-features` dupliquera (PA6 d'ANTIA). Tant que ce paquet n'existe pas, DIASPORALE
> porte ses propres surfaces dans `@diasporale/features`. Chacune lit le **port de données**
> (`@diasporale/features/data`), qui a deux implémentations :
> - la **démonstration** : données fictives, ce navigateur seulement, mêmes règles du domaine ;
> - le **moteur** : ANTIA local, tranche `convex/modules/diaspora/` et fonctions génériques.
>
> **Légende** : ✅ livré (démonstration et moteur, testé, vu sur :3031) · 🟡 partiel ·
> ⏳ attend le moteur · ⬜ à faire.

## 1. Surfaces de PD4 (EXF-DG-07 à 19)

| Surface de référence | Surface DIASPORALE | Exigences | État | Source moteur | Écarts |
|---|---|---|---|---|---|
| Fil (`FeedPage`) | `/fil` : « Mon pays », « Toute la diaspora », « Récents », « Pour vous » | EXF-DG-13 | ✅ | `posts.myFeed` (portées, voies du hub) | une page de 30, sans curseur ni « voir plus » |
| Composeur en feuille | `PostComposerSheet` | EXF-DG-10, 11 | ✅ | `posts.publish` (portée, pays, ANTIA, médias, partage, idempotence), `media.generateUploadUrl` (`media_social`) | médias : quatre photos ou une vidéo seule, texte alternatif par média, règles du moteur jugées avant tout envoi (PR administration-ga/diasporale#5) ; la démonstration garde des photos réduites, pas de vidéo ; partage cité (original en aperçu, mot facultatif, sans média) et idempotence, une clé par série d'essais (PR administration-ga/diasporale#6) ; brouillon durable dans CE navigateur (texte et choix, sans les médias ; une clé par personne, rétabli à l'ouverture, effacé à la publication, jamais envoyé) ; local refusé dans un pays non ouvert (§3) |
| Carte de publication | `PostCard` | EXF-DG-10, 12 | ✅ | DTO `myFeed` | auteur d'une page : sa carte ; « signé par » attend PD5 ; mentions (lien vers le profil) et mots-dièse découpés par le moteur (`splitBodyRich`), dans les commentaires aussi, casse de l'auteur gardée (ANTIA l'abaisse) ; un mot-dièse n'ouvre pas encore de recherche ; médias : photo seule à ses proportions, grille carrée de deux à quatre, retenue de la garde dite (analyse en cours, bloqué), sans visionneuse plein écran ; partage : « Partager » sur une publication publique et publiée, avec son compte, et l'original intégré, re-gardé pour chaque lecteur (« indisponible » s'il ne se lit plus) |
| Réactions (4 genres) | palette de la carte | EXF-DG-12 | ✅ | `engagement.toggleReaction` | — |
| Commentaires | feuille « Commentaires » | EXF-DG-12 | ✅ | `engagement.paginateComments`, `paginateReplies`, `comment`, `removeComment` | pas d'édition d'un commentaire |
| Menu « … » | `PostMenu` | EXF-DG-12, 40 | 🟡 | `marks.toggleMark`, `hidePost`, `muteAuthor`, `moderation.reportPost`, `posts.remove` | sans « Modifier », sans relais ; signets sans liste |
| Profil personne (`ProfilPersonnePage`) | `/@handle` | EXF-DG-07, 08 | 🟡 | `getPublicProfile`, `diaspora.profile.memberFacet`, `posts.personPosts` | facette projetée, aperçu, mur ; onglets Photos et Albums branchés en mode moteur et vus dans Chrome le 16/10, masqués en aperçu ; sans gestion de photo de profil |
| Relations (`PeoplePanel`) | barre de relation du profil, cloche | EXF-DG-18, 43 | 🟡 | `graph.connections.*`, `graph.follows.*` | pas de page « mes relations » ni « mes demandes » (on répond depuis la cloche) |
| Annuaire et recherche | `/membres` | EXF-DG-19, 46 | ✅ | `diaspora.directory.searchMembers` | opt-in par niveau ; masqué introuvable, même par identifiant exact |
| Suggestions | « Des membres à rencontrer » (rail du fil, `/membres`) | EXF-DG-18 | ✅ | `diaspora.suggestions.forMe`, `suggestions.dismiss` | pas de liste « masquées » à rouvrir (`restore` existe côté moteur) |
| Cloche | `NotificationBell` | EXF-DG-38 | ✅ | `notifications.bell.*` | le partage d'une publication se dit (« a partagé votre publication ») ; genres de PD5 à PD8 dits « nouvelle activité » d'ici là |
| Hub pays | `/pays/[iso]` | EXF-DG-15, 16 | 🟡 | `diaspora.hubs.getCountryHub`, voies du fil | compteurs et fil local ; pages, associations, entreprises (PD5) et évènements (PD7) vides ; membres opt-in par la recherche filtrée |
| Sélecteur de pays (C11) | `CountrySwitch` | EXF-DG-15 | ✅ | — | accès rapide : mon pays, puis les trois derniers choisis (ce navigateur) |
| Stories 24 h (`StoriesTray`) | bandeau de `/fil`, `/actus` (lecteur plein écran du moteur, mode moteur) | EXF-DG-14 | 🟡 | `stories.*` (lot 12b d'ANTIA, servi) | `StoriesViewerPage` monté sous l'îlot iCom (PD7), atteint par la brique « Statuts » d'iCom ; `…/nouvelle` ouvre le composeur ; bandeau du fil monté avec `StoriesStyles`, portrait et handle publié du moteur, horloge à la minute et ouverture par `?auteur=` (16/10, tests verts et recette Chrome locale) ; même accès que le lecteur actuel : membres qui peuvent publier seulement ; rien en démonstration |
| Albums (`AlbumPage`) | onglets Photos/Albums du profil, `/@handle/albums/[id]` | EXF-DG-14 | 🟡 | `albums.*`, `@antia/social-features/albums` (F2) | surfaces du moteur montées sans copie ; lecture dès `en_attente`, création chez soi seulement avec droit de publier, onglets masqués en aperçu (le moteur ne projette pas encore pour un autre lecteur) ; composeur adressable par `?onglet=albums&nouveau=1`, galerie après publication (16/10, tests verts et recette Chrome locale) ; pas d'albums en démonstration ; liste bornée aux douze premiers albums publiés, sans reprise des brouillons |
| Coquille mobile et bureau | `AppShell` | EXT-DG-05 | ✅ | — | colonne (Fil, Mon pays, Membres, Messages en mode moteur, Profil, Parrainer, Réglages), barre basse, en-tête (Membres, Messages en mode moteur, cloche, pays) ; rail droit ouvert par la carte iCom |
| Cartes flottantes | `FloatingNotice`, pile « Avis » | charte v2 §7 | ✅ | — | échelle de couches de la charte : barres 40 < feuilles 50 < pile 55 < menus 60 |

## 2. Hors PD4 (pour mémoire)

| Surface | Prompt | État |
|---|---|---|
| Pages officielles, associations, entreprises, revendication, import public | PD5 | ⬜ — moteur prêt (lot 13 d'ANTIA, `pages.*`) |
| Groupes thématiques (EXF-DG-24), groupe d'adhérents (EXF-DG-26) | PD5, PD7 | ⬜ — moteur prêt (lots 9 et 13) |
| Messagerie 1:1 et de groupe (EXF-DG-30), « Écrire », appels | PD7 | 🟡 — iCom du moteur monté tel quel, en mode moteur, pour un membre qui peut publier (branche locale `pd7/icom`, PR après le push d'ANTIA) : carte iCom dans le rail dès 1 280 px, détachée en dessous ; pages `/messages` au téléphone ; « Écrire » et « Appeler » sur le profil d'une relation (le moteur n'ouvre un fil neuf qu'entre relations) ; ailleurs, « Écrire » fermé dit pourquoi. Écarts : rien en démonstration ; « Écrire » vers un correspondant déjà en conversation ouvre un brouillon, l'historique revient au premier envoi (geste du moteur, signalé à ANTIA) ; « Appeler » joué jusqu'à la fenêtre d'appel du moteur (le backend local n'a pas de serveur média : « Connexion impossible », `mediaServerNotConfigured`) ; pas de messagerie de page |
| Évènements communautaires (EXF-DG-27, 28) | PD7 | ⬜ — évènements personnels servis (lot 12a) |
| File de modération, sanctions, relecture (EXF-DG-40 à 43) | PD6 | ⏳ — PA5 d'ANTIA |
| Export et effacement (EXF-DG-45) | PD6 | ⏳ — effacement du moteur (PA5), crochet de tranche à prévoir pour ses tables |

## 3. Écarts assumés

- **Relecture avant publication** (invariant 10, EXF-DG-42) : le moteur ne retient encore aucun
  contenu (`pending_review`). Le crochet de politique de la tranche est accordé par ANTIA pour PA5.
  D'ici là, une publication locale est refusée à l'écran dans un pays non ouvert ; c'est une garde
  d'écran seulement, **bloquante pour la mise en ligne**.
- **Publications de développement sans portée** : celles d'avant le lot 7 du moteur n'entrent
  dans aucune voie du hub. Données locales seulement.
- **Annuaire racine d'ANTIA** : un membre de DIASPORALE reste trouvable dans l'annuaire public
  d'ANTIA si son profil y est découvrable. Décision du propriétaire attendue (avis à l'accueil,
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
  absence d'accès depuis ANTIA ; ces gardes sont celles du moteur, sans modification ici.

**Reprise des contrôles du moteur (16/10)** : les sept anciens échecs Direct sont résolus
par ANTIA `1a5f74f` ; les trois fichiers ciblés passent, 19 tests sur 19. Toutes les étapes
requises de `verify` sont ensuite validées dans l'arbre partagé, en coordination avec la session
ANTIA : codegen, typage Convex/tests et des dix paquets, 1 104 tests Convex (dont les nouveaux
cas Direct), 53 cliquets, 24 tests de scripts, 2 869 tests des interfaces du moteur, tests des
applications et lint des neuf paquets qui le déclarent (aucune erreur ; avertissements du
moteur conservés).

Le script `verify` n'a pas terminé en un passage unique : disque plein puis délais de cinq
secondes sous forte charge. Les étapes ont été reprises et leurs résultats partagés, sans
changer les assertions : un paquet et un worker à la fois pour les tests d'application,
délai de trente secondes ; soixante secondes pour les scans de fichiers du moteur. La suite
social-features d'ANTIA a passé ses 173 fichiers avec le délai fonctionnel de cinq secondes.
Seul le cache régénérable DIASPORALE `apps/diasporale_com/.next/dev/cache/turbopack` (7 Go) a été
supprimé, après autorisation explicite ; aucune donnée supprimée, aucun fichier ANTIA modifié
par cette session.
