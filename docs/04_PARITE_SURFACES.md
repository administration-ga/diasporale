# Parité des surfaces — DIASPORALE.COM

> Tenu par la session de construction (PD4, point 6 du plan `docs/01`). État au 15/10/2026.
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
| Profil personne (`ProfilPersonnePage`) | `/@handle` | EXF-DG-07, 08 | 🟡 | `getPublicProfile`, `diaspora.profile.memberFacet`, `posts.personPosts` | facette projetée, aperçu, mur ; sans onglets médias ni albums, sans photo |
| Relations (`PeoplePanel`) | barre de relation du profil, cloche | EXF-DG-18, 43 | 🟡 | `graph.connections.*`, `graph.follows.*` | pas de page « mes relations » ni « mes demandes » (on répond depuis la cloche) |
| Annuaire et recherche | `/membres` | EXF-DG-19, 46 | ✅ | `diaspora.directory.searchMembers` | opt-in par niveau ; masqué introuvable, même par identifiant exact |
| Suggestions | « Des membres à rencontrer » (rail du fil, `/membres`) | EXF-DG-18 | ✅ | `diaspora.suggestions.forMe`, `suggestions.dismiss` | pas de liste « masquées » à rouvrir (`restore` existe côté moteur) |
| Cloche | `NotificationBell` | EXF-DG-38 | ✅ | `notifications.bell.*` | le partage d'une publication se dit (« a partagé votre publication ») ; genres de PD5 à PD8 dits « nouvelle activité » d'ici là |
| Hub pays | `/pays/[iso]` | EXF-DG-15, 16 | 🟡 | `diaspora.hubs.getCountryHub`, voies du fil | compteurs et fil local ; pages, associations, entreprises (PD5) et évènements (PD7) vides ; membres opt-in par la recherche filtrée |
| Sélecteur de pays (C11) | `CountrySwitch` | EXF-DG-15 | ✅ | — | accès rapide : mon pays, puis les trois derniers choisis (ce navigateur) |
| Stories 24 h (`StoriesTray`) | `/actus` (lecteur plein écran du moteur, mode moteur) | EXF-DG-14 | 🟡 | `stories.*` (lot 12b d'ANTIA, servi) | `StoriesViewerPage` monté sous l'îlot iCom (PD7), atteint par la brique « Statuts » d'iCom ; `…/nouvelle` ouvre le composeur ; le bandeau `StoriesTray` du fil reste à monter (après le push d'ANTIA) ; rien en démonstration |
| Albums (`AlbumPage`) | — | EXF-DG-14 | ⬜ | `albums.*` (lot 14 d'ANTIA, servi) | à brancher ; la surface vient avec le lot F2 d'ANTIA (réseau personnel) |
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
