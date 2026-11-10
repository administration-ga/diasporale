# Plan 03 — Fil, publications, découverte et recherche

> Constaté par lecture du code d'`origin/main` (DIASPORALE `bead76d`, ANTSIA `fd58d73b`), le 10 novembre 2026. Rien n'a été exécuté : ni test, ni recette, ni publication.
> Applications de référence : Instagram, Facebook, TikTok, Threads et X, Nextdoor, LinkedIn. Comparaison faite de mémoire, sans revérification en ligne ; un « ? » marque ce qui n'est pas sûr.
> Ce plan détaille, pour le fil, les publications, les statuts, la découverte et la recherche, le plan 15 du dossier de finalisation d'ANTSIA. Les lots qu'il en reprend gardent leur identifiant (DS-…, DG-…) ; les lots nouveaux portent le préfixe `FD-`.

Légende des chemins : `D:` = dépôt DIASPORALE, `A:` = dépôt ANTSIA. « Écran » = atteignable depuis l'interface de diasporale.com ; « Moteur » = la fonction existe côté serveur.

Point de méthode. DIASPORALE a **ses propres** composeur, carte, commentaires et découverte (`D:packages/diasporale-features/src/components`). Les lots web des plans 02 et 03 du moteur (FP-…, SD-…) corrigent les écrans d'ANTSIA, pas ceux-ci. Seuls les statuts viennent tels quels du paquet partagé du moteur. Chaque lot du moteur qui touche le fil a donc ici un lot jumeau qui le branche.

## 1. L'intention du propriétaire

- **Pour qui** : tout membre, pour voir d'abord la vie de son pays de résidence, puis celle de toute la diaspora (cahier, § 2.1 et invariant 7 : le pays est le contexte permanent).
- **Quoi** : « défilement inspiré de TikTok, présentation visuelle inspirée d'Instagram » (docs/14 de DIASPORALE, en-tête) ; troisième résultat prioritaire : « découvrir et communiquer facilement » (docs/14, § 1.1).
- **Le contexte reste séparé** : visibilité `network` par défaut ; « Publier aussi sur ANTSIA » est un geste, seulement pour une audience publique (cahier, EXF-DG-11, parcours R4).
- **Décidé** : classement par date et par règles explicables, aucun apprentissage du comportement (D-G05) ; « Pourquoi cette publication ? » ne dit que des raisons réelles (DG-019) ; réactions à quatre genres, commentaires à un niveau de réponse (EXF-DG-12) ; quatre images ou une vidéo, texte alternatif (EXF-DG-10).
- **Décidé le 9/11** : photos ré-encodées, métadonnées retirées, plus grand côté à 2 048 px ; fichiers de plus de 60 Mio refusés (plan directeur d'ANTSIA, § 6.2).
- **Faible débit** : fil et hub en moins de 1,5 s sur 3G (EXT-DG-02) ; un seul lecteur, son coupé au départ, rien de préchargé en économie de données (docs/14, G6).
- **Refusé** : fil « Pour vous » tiré du comportement, musique sans licence propre, publicité au pilote (D-G04), traduction automatique (cahier, § 8.15), toute promesse non mesurée.
- **Recherche** : bornée au réseau, refus indistinct (EXF-DG-19) ; l'historique de recherche n'est jamais montré à un professionnel (docs/14, G4).
- **Assistant** : iAsted concierge en option de la V2, lecture bornée au réseau, action toujours confirmée (EXF-DG-48 ; fiche F15 du dossier produit).

## 2. Ce qui existe

| # | Capacité | État | Écran | Moteur | Preuve |
|---|---|---|---|---|---|
| 1 | Fil à quatre portées : Mon pays (défaut), Toute la diaspora, Récents, Pour vous | Présent | oui | oui | `D:apps/diasporale_com/src/screens/feed-screen.tsx`, `D:packages/diasporale-domain/src/reach.ts` (`FEED_SCOPES`) |
| 2 | « Pour vous » : relations, pages et groupes suivis, par date, sans score de comportement | Présent | oui | oui | `D:apps/diasporale_com/src/data/engine-source.ts` (`feedRequest`), `A:convex/modules/posts/posts.ts` (`myFeed`) |
| 3 | Voies du hub : le local du pays plus la diaspora ; pays consulté porté par l'adresse | Présent | oui | oui | `D:apps/diasporale_com/src/data/engine-source.ts` (`feedRequest`) |
| 4 | Pages de 30 sur le curseur du moteur, « Voir plus de publications » | Présent | oui | oui | `D:apps/diasporale_com/src/components/feed-pages.tsx` |
| 5 | Fil lacunaire dit ; refus d'accès dit sans « Réessayer » | Présent | oui | oui | `D:apps/diasporale_com/src/components/feed-pages.tsx` |
| 6 | Pastille « N nouvelles publications » dans la liste | Absent : les arrivées s'insèrent seules en tête ; la pastille n'existe qu'en Découverte | non | — | motifs : `pending`, `refresh`, `nouvelles` dans `feed-pages.tsx` |
| 7 | Coût du fil borné | Partiel : une souscription vivante par page chargée, aucune fenêtre du DOM en liste | — | — | `D:apps/diasporale_com/src/components/feed-pages.tsx` (`SubscribedFeedPage`) |
| 8 | Rail (hub de mon pays, membres à rencontrer, prochains évènements) ; états vides par portée, avec « Publier » | Présent | oui | oui | `D:apps/diasporale_com/src/screens/feed-screen.tsx` (`FeedRail`) |
| 9 | Filtrer le fil par type (photos, vidéos, pages) | Absent | non | partiel | motifs : `mediaKind`, `onlyVideo`, `filterBy` dans `feed-screen.tsx` |
| 10 | Texte de 2 000 caractères, compteur, clé d'idempotence | Présent | oui | oui | `D:packages/diasporale-features/src/components/composer.tsx` |
| 11 | Quatre photos ou une vidéo seule ; règles du moteur jugées avant tout envoi | Présent | oui | oui | `D:packages/diasporale-features/src/data/media.ts` (`postMediaRefusal`) |
| 12 | Texte alternatif par média, 300 caractères | Présent | oui | oui | `D:packages/diasporale-features/src/components/composer.tsx` |
| 13 | **Photos ré-encodées, métadonnées et position GPS retirées avant l'envoi** | Absent en mode moteur : le fichier part tel quel, jusqu'à 20 Mio ; seule la démonstration réduit l'image | non | non | `D:apps/diasporale_com/src/data/engine-source.ts` (`uploadMedia`, l. 749-765), `D:packages/diasporale-features/src/demo/source.ts` (`DEMO_IMAGE_MAX_SIDE`), `A:packages/social-domain/src/content.ts` (`POST_IMAGE_MAX_BYTES`) |
| 14 | Vidéo lisible partout et bornée | Partiel : 100 Mio, MOV d'iPhone admis sans conversion, aucune borne de durée ; pas de vidéo en démonstration | oui | partiel | `A:packages/social-domain/src/content.ts` (`POST_VIDEO_MIME_TYPES`, `POST_VIDEO_MAX_BYTES`) |
| 15 | Réordonner, recadrer, retirer une photo jointe | Partiel : retirer seulement | partiel | — | `D:packages/diasporale-features/src/components/composer.tsx` (`detach`) |
| 16 | Portée visible avant l'envoi (mon hub ou toute la diaspora) ; audience (tous les membres ou mes relations) | Présent | oui | oui | `D:packages/diasporale-features/src/components/composer.tsx` |
| 17 | « Publier aussi sur ANTSIA » : case décochée, fermée hors audience publique, expliquée | Présent | oui | oui | `D:packages/diasporale-features/src/components/composer.tsx`, `D:packages/diasporale-domain/src/reach.ts` (`canAlsoPublishOnRoot`) |
| 18 | Publication locale dans un pays non ouvert | Partiel : l'écran annonce une relecture, l'adaptateur refuse (« pas encore ouverte ») ; garde d'écran seulement | partiel | non | `D:packages/diasporale-features/src/components/composer.tsx` (`reviewNotice`), `D:apps/diasporale_com/src/data/engine-source.ts` (`publish`, l. 777) |
| 19 | Brouillon | Partiel : texte et choix gardés dans ce navigateur, par personne ; ni médias, ni autre appareil | partiel | non | `D:packages/diasporale-features/src/components/composer.tsx` (`readDraft`, `writeDraft`) |
| 20 | Partage cité avec un mot facultatif, publications publiques seulement | Présent | oui | oui | `D:packages/diasporale-features/src/components/post-share.tsx` (`isShareable`) |
| 21 | Publications des pages et des associations dans le fil, sous l'identité de la page | Présent | oui | oui | `D:apps/diasporale_com/src/data/engine-views.ts` (`authorOf`) |
| 22 | Suggestions de mentions et de mots-dièse à la saisie ; sondage ; publication programmée ; brouillon gardé au serveur | Absent | non | non | motifs : `combobox`, `mentionSuggest`, `sondage`, `poll`, `scheduledAt`, `postDrafts` |
| 23 | Lieu précis, personnes identifiées sur une photo, déclaration d'un contenu d'IA | Absent | non | non | motifs : `geotag`, `taggedPerson`, `aiOrigin` |
| 24 | Carte : auteur, badges calculés, date liée, pays ou portée d'origine | Présent | oui | oui | `D:packages/diasporale-features/src/components/cards/post-card.tsx` |
| 25 | Auteur neutre quand le profil est retiré | Présent | oui | oui | `D:packages/diasporale-features/src/components/cards/post-card.tsx` (`neutralAuthor`) |
| 26 | Marque « modifiée » | Présent, sans date ni versions | oui | partiel | `D:packages/diasporale-features/src/components/cards/post-card.tsx` |
| 27 | Mentions et mots-dièse cliquables, casse de l'auteur gardée | Présent | oui | oui | `D:packages/diasporale-features/src/components/rich-text.tsx` |
| 28 | Adresse web cliquable, aperçu de lien | Absent : une adresse reste du texte brut | non | non | `A:packages/social-domain/src/richText.ts` (`splitBodyRich`) ; motifs : `linkify`, `linkPreview` |
| 29 | Grille des médias ; média retenu par la garde dit à l'écran ; visionneuse plein écran, clavier, focus rendu | Présent | oui | oui | `D:packages/diasporale-features/src/components/post-media.tsx` |
| 30 | Un seul lecteur vidéo à la fois dans l'onglet | Présent | oui | — | `D:packages/diasporale-features/src/lib/media-viewer-lease.ts` |
| 31 | Lecture coupée pendant un appel | Partiel : le registre offre `suspendMediaPlayback`, aucun appelant ne s'en sert | non | — | `D:packages/diasporale-features/src/lib/media-viewer-lease.ts` ; motifs : `suspendMediaPlayback(` hors de ce fichier |
| 32 | Affiche des vidéos, sous-titres, vitesse de lecture | Absent | non | non | motifs : `poster`, `<track`, `playbackRate` |
| 33 | État de modération visible de l'auteur (« en relecture ») | Partiel : la bannière existe, l'adaptateur moteur écrit toujours « publiée » | partiel | partiel | `D:apps/diasporale_com/src/data/engine-views.ts` (`toPostView`, l. 268), `A:convex/modules/moderation/policy.ts` (`moderateContentWrite`) |
| 34 | Réactions à quatre genres | Présent | oui | oui | `A:convex/modules/engagement/engagement.ts` (`toggleReaction`) |
| 35 | Décompte par genre ; liste de qui a réagi | Absent : total seul. Le moteur rend les décomptes par genre, pas la liste | non | partiel | `A:convex/modules/posts/posts.ts` (`feedItemValidator`) ; motifs : `reactors`, `whoReacted` |
| 36 | Commentaires, réponses à un niveau, modifier, retirer, marque « modifié » | Présent | oui | oui | `D:packages/diasporale-features/src/components/comments.tsx` |
| 37 | **Lire tous les commentaires** | Partiel : seuls les 20 premiers commentaires et 50 réponses se lisent, sans suite | partiel | oui | `D:packages/diasporale-features/src/data/types.ts` (`COMMENTS_PAGE`), `D:apps/diasporale_com/src/data/engine-source.ts` (`useComments`, l. 574-582) |
| 38 | Aimer ou épingler un commentaire ; restreindre ou fermer les commentaires | Absent | non | non | motifs : `commentLike`, `pinComment`, `commentPolicy` |
| 39 | Signaler une publication : douze motifs, accusé de réception | Présent | oui | oui | `D:packages/diasporale-features/src/components/post-menu.tsx` (`ReportPostSheet`) |
| 40 | Signaler un commentaire | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/moderation/moderation.ts` (`reportComment`) ; motifs : `reportComment` dans DIASPORALE |
| 41 | Menu : enregistrer, masquer, mettre en sourdine, modifier, retirer | Présent | oui | oui | `D:packages/diasporale-features/src/components/post-menu.tsx` |
| 42 | Modifier après publication | Partiel : le texte seul ; ni texte alternatif, ni audience, ni portée | partiel | partiel | `D:packages/diasporale-features/src/components/post-menu.tsx` (`EditPostSheet`) |
| 43 | Retirer la publication d'ANTSIA sans la retirer de DIASPORALE | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/posts/posts.ts` (`withdrawFromRoot`) |
| 44 | Épingler une publication sur son mur | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/posts/posts.ts` (`pinOnMyWall`) |
| 45 | Être averti des commentaires d'une publication | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/marks/tables.ts` (`POST_MARK_KINDS`, sorte `notify`) |
| 46 | « Pourquoi cette publication ? » | Présent : portée, audience, ANTSIA, règle du fil. La raison de relation rendue par le moteur n'est pas dite | oui | oui | `D:packages/diasporale-features/src/components/post-explanation.tsx` |
| 47 | Copier le lien d'une publication | Présent | oui | — | `D:packages/diasporale-features/src/components/post-share.tsx` |
| 48 | Lien ouvert sans session | Partiel : la porte, puis le fil ; l'adresse demandée n'est pas gardée | partiel | — | `D:apps/diasporale_com/src/components/gate.tsx` (l. 29) |
| 49 | Feuille de partage du système | Absent pour une publication ; présente pour une page | non | — | `D:apps/diasporale_com/src/components/page-share-button.tsx` ; motifs : `navigator.share` dans `post-share.tsx` |
| 50 | Envoyer une publication dans iCom | Absent | non | non | motifs : `sendToConversation`, référence de publication dans un message |
| 51 | Adresse publique d'une publication « Aussi dans ANTSIA » | Absent | non | partiel | motifs : `publicPostUrl`, origine d'ANTSIA dans la configuration |
| 52 | Publication seule, refus indistinct | Présent | oui | oui | `D:apps/diasporale_com/src/screens/post-screen.tsx` |
| 53 | Traduire ; vues et statistiques pour l'auteur | Absent | non | non | motifs : `translat`, `viewCount`, `impressions` |
| 54 | Signets paginés, retrait ; publications masquées et auteurs en sourdine, restaurables | Présent | oui | oui | `D:apps/diasporale_com/src/screens/bookmarks-screen.tsx`, `D:apps/diasporale_com/src/components/content-preferences-settings.tsx`, `A:convex/modules/diaspora/contentPreferences.ts` |
| 55 | Collections de signets, mots masqués | Absent | non | non | motifs : `collection`, `mutedWords` |
| 56 | Fil filtré par mot-dièse, portée et pays gardés, retrait du filtre | Présent | oui | oui | `D:apps/diasporale_com/src/screens/feed-screen.tsx` |
| 57 | Index des mots-dièse | Absent : filtre en mémoire, après les gardes, sur des fenêtres de 30 | — | non | `A:convex/modules/posts/posts.ts` (`myFeed`, argument `tag`) |
| 58 | Suivre un mot-dièse, tendances, nombre de publications | Absent | non | non | motifs : `followTag`, `trending`, `tendances` |
| 59 | Mode Découverte : une publication par écran, même source et même ordre que la liste | Présent | oui | oui | `D:packages/diasporale-features/src/components/discovery/feed-discovery.tsx` |
| 60 | Recyclage borné (cinq diapositives montées au plus) ; préchargement de la seule suivante, rien en économie de données | Présent | oui | — | `D:packages/diasporale-features/src/components/discovery/discovery-window.ts` (`slideRendering`) |
| 61 | Clavier, boutons, Échap, position annoncée, retour sur la même publication | Présent | oui | — | `D:packages/diasporale-features/src/components/discovery/discovery-position.ts`, `D:apps/diasporale_com/src/screens/feed-screen.tsx` (`ListReturn`) |
| 62 | Lecture automatique muette de l'élément actif ; aucune sous mouvement réduit ou économie de données | Présent, sur les seuls signaux du système | oui | — | `D:packages/diasporale-features/src/components/discovery/use-discovery-playback.ts`, `D:packages/diasporale-features/src/components/discovery/playback-environment.ts` |
| 63 | Réglage, dans DIASPORALE, de la lecture automatique et de l'économie de données | Absent | non | non | motifs : `autoplay`, `dataSaver`, `économ` dans `settings-screen.tsx` ; `A:convex/modules/people/preferences.ts` |
| 64 | Nouvelles publications au geste « Actualiser », avec leur nombre | Présent | oui | — | `D:packages/diasporale-features/src/components/discovery/discovery-state.ts` |
| 65 | Découverte des seules vidéos | Absent ici ; le moteur l'a, borné au réseau | non | oui | `A:convex/modules/posts/mediaFeed.ts` (`paginate`) |
| 66 | Qualité adaptée au débit, conversion au serveur (DG-018) | Absent | non | non | motifs : `hls`, `transcode`, `rendition` |
| 67 | Bandeau des statuts en tête du fil | Présent en mode moteur ; rien en démonstration | oui | oui | `D:apps/diasporale_com/src/components/feed-stories.tsx` |
| 68 | Lecteur plein écran des statuts, « Vu par », retrait | Présent (surface du moteur) | oui | oui | `D:apps/diasporale_com/src/screens/icom-screens.tsx`, `A:packages/social-features/src/features/stories/StoryViewer.tsx` |
| 69 | Créer un statut photo ou vidéo, légende, audience ; conversion du MOV | Présent | oui | oui | `A:packages/social-features/src/features/stories/StoryCreateSheet.tsx` |
| 70 | Un membre en attente lit les statuts ; créer exige le droit de publier | Présent | oui | oui | `D:apps/diasporale_com/src/components/feed-stories.tsx` (`canCreate`) |
| 71 | Photo de statut nettoyée de ses métadonnées | Absent (lot SD-02 du moteur) | non | non | `A:packages/social-features/src/features/stories/StoryCreateSheet.tsx` ; motifs : `exif`, `toBlob` |
| 72 | Signaler un statut | Absent à l'écran ; le moteur accepte la cible | non | oui | `A:convex/modules/moderation/tables.ts` (cible `story`) |
| 73 | Répondre ou réagir à un statut ; statut texte ; mentions ; sourdine ; anneau sur le profil ; à la une | Absent | non | non | motifs : `storyReply`, `textStory`, `storyMutes` |
| 74 | Statut au nom d'une page ou d'une association | Absent | non | non | `A:convex/modules/stories/stories.ts` (`publish`) |
| 75 | Explorer : raccourcis des rubriques, annuaire des pages, pays ouverts | Présent | oui | oui | `D:apps/diasporale_com/src/screens/explore-screen.tsx` |
| 76 | Champ de recherche dans Explorer ou dans l'en-tête | Absent : Explorer est un sommaire, sans saisie | non | — | motifs : `type="search"`, `role="search"` dans `explore-screen.tsx` et `app-shell.tsx` |
| 77 | Recherche de publications | Absent ici ; le moteur l'a, bornée au réseau | non | oui | `A:convex/modules/posts/posts.ts` (`search`) |
| 78 | Recherche par rubrique : membres, pages, services, emploi | Présent, chacune dans son écran | oui | oui | `D:packages/diasporale-features/src/data/port.ts` (`useMemberSearch`), `D:packages/diasporale-features/src/data/pages-port.ts`, `D:packages/diasporale-features/src/data/services-port.ts`, `D:packages/diasporale-features/src/data/jobs-port.ts` |
| 79 | Recherche transversale à onglets, recherches récentes (DS-11) | Absent | non | non | motifs : `/recherche`, `globalSearch`, `recentSearch` |
| 80 | Assistant iAsted (DS-19) | Absent | non | non | motifs : `iasted`, `concierge` |

Décompte : **Présent 39 · Partiel 10 · Absent 31 · Fermé 0**. Sept des « Absent » sont déjà servis par le moteur (lignes 40, 43, 44, 45, 65, 72, 77).

### Ce que le moteur sait déjà faire et que DIASPORALE ne montre pas

- Signaler un commentaire : `A:convex/modules/moderation/moderation.ts` (`reportComment`).
- Retirer la lecture dans ANTSIA, épingler et désépingler sur son mur : `A:convex/modules/posts/posts.ts` (`withdrawFromRoot`, `pinOnMyWall`, `unpinMyWall`).
- Être averti des commentaires : marque `notify` de `A:convex/modules/marks/marks.ts` (`toggleMark`), rendue au lecteur par `viewer.notifying`.
- Chercher dans les publications du réseau (`search` de `A:convex/modules/posts/posts.ts`, 100 candidats au plus, sans pagination) ; parcourir les seules vidéos (`paginate` de `A:convex/modules/posts/mediaFeed.ts`).
- Lire tous les commentaires : `A:convex/modules/engagement/engagement.ts` (`paginateComments`, `paginateReplies`) acceptent un curseur que l'adaptateur n'envoie jamais.
- Dans le DTO du fil, non repris par `toPostView` : décomptes par genre de réaction, raison de relation, évènement ou direct annoncé par une publication (`reactions.counts`, `reason`, `event`, `live` ; le dernier point est à trancher avec le plan 08).
- Relecture avant publication et termes bloqués (`setPolicy`, `setBlockedTerm` de `A:convex/modules/moderation/cases.ts`) : réglés par réseau et par surface, sans écran (plan 14).

### Ce qui est écrit mais jamais recetté en réel

| Élément | État constaté | Source |
|---|---|---|
| Deux photos publiées, puis lues par un autre compte (DG-002) | Validé, backend local, 19/10 | docs/recette/deux-comptes-2026-10-19 de DIASPORALE |
| Publication d'un texte, signalement, bureau | Joués en ligne sur la démonstration, 22/10 | docs/recette/demo-en-ligne-2026-10-22 |
| Partage : panneau, copie du lien | Local, compte en lecture seule, ordinateur et téléphone émulé, 18/10 | docs/recette/partage-2026-10-18 |
| Vidéo | Lecture d'une vidéo existante de 14,92 s en local ; création, envoi et son non validés | docs/04 de DIASPORALE, en-tête |
| Fil au téléphone | Émulation à 375 px seulement, aucun appareil | docs/recette/fils-mobiles-2026-10-18 |
| Commentaires : modifier, annuler ; mot-dièse filtré | Chrome local, 17 et 18/10 ; pages filtrées multiples par tests seuls | docs/09 et docs/10 de DIASPORALE |
| Découverte verticale (DG-017) | Tests seulement ; « recette longue et qualité mobile » ouvertes | docs/18 de DIASPORALE (inventaire de la vague G) |
| Statuts | Une image publiée et lue en local, 16/10 ; statut vidéo, « Vu par » à deux comptes, appareil réel : jamais | docs/04 de DIASPORALE |
| « Publier aussi sur ANTSIA », lu depuis ANTSIA (R4, R-G03) | Jamais joué en ligne entre les deux réseaux | cahier, § 9 ; plan 15, § 2 |
| Photo avec position GPS, MOV d'iPhone, 21 commentaires, publication retenue en relecture | Jamais joués | ce plan |
| Budget 3G du fil (EXT-DG-02), octets pour 30 publications | Jamais mesurés | plan 15, § 4.3 |

## 3. Comparaison avec les applications de référence

| Capacité | Instagram | Facebook | TikTok | Threads et X | Nextdoor | LinkedIn | DIASPORALE | Verdict |
|---|---|---|---|---|---|---|---|---|
| Fil par date, au choix | oui | oui | ? | oui | ? | oui | le seul ordre | Déjà fait |
| Fil par lieu de vie | non | non | non | non | quartier | non | pays, plus toute la diaspora | Déjà fait, à garder |
| Fil recommandé par le comportement | oui | oui | oui | oui | oui | oui | non | Écarté (D-G05) |
| « Pourquoi je vois ceci » | oui | oui | ? | ? | ? | oui | raisons réelles | Déjà fait ; raison de relation à ajouter (FD-17) |
| Nouvelles publications sans saut | oui | oui | — | oui | ? | oui | en Découverte seulement | À faire (FD-11) |
| Plusieurs photos | oui | oui | oui | oui | oui | oui | quatre | Déjà fait |
| Photos allégées, métadonnées retirées | oui | oui | ? | ? | ? | ? | non, fichier brut | **À faire (FD-01)** |
| Vidéo convertie, lisible partout | oui | oui | oui | oui | ? | oui | MOV admis tel quel | **À faire (FD-02)** |
| Texte alternatif | oui | oui | ? | oui | ? | oui | oui | Déjà fait |
| Recadrer, réordonner | oui | oui | oui | ? | ? | ? | retirer seulement | Reporté (peu de valeur avant le pilote) |
| Brouillons conservés | oui | oui | oui | oui | ? | oui | ce navigateur, sans médias | À adapter (FD-16) |
| Programmation | comptes pro | pages | ? | X oui | ? | oui | non | À faire (FD-16) |
| Sondage | statuts | groupes | ? | oui | oui | oui | non | À faire (FD-16) |
| Mentions avec suggestions | oui | oui | oui | oui | oui | oui | résolues, sans suggestions | À faire (FD-09) |
| Mots-dièse : page, suivi | oui | oui | oui | oui | ? | oui | filtre du fil | À adapter (FD-09, FD-17) |
| Lien cliquable, aperçu | non (légende) | oui | non | oui | oui | oui | texte brut | À faire, sans aperçu (FD-09) |
| Marque « modifié », versions | ? | historique | ? | fenêtre courte | ? | « Modifié » | marque seule | À adapter (FD-15) |
| Réactions à plusieurs genres | cœur | oui | cœur | cœur | oui | oui | quatre | Déjà fait |
| Voir qui a réagi | oui | oui | non | variable | ? | oui | non | À faire (FD-08) |
| Tous les commentaires lisibles | oui | oui | oui | oui | oui | oui | 20 premiers | **À faire (FD-03)** |
| Aimer un commentaire | oui | oui | oui | oui | oui | oui | non | À faire (FD-08) |
| Restreindre ou fermer les commentaires | oui | oui | oui | oui | oui | oui | non | À faire (FD-08) |
| Signaler un commentaire | oui | oui | oui | oui | oui | oui | non à l'écran | **À faire (FD-05)** |
| Relais ou citation | ? | oui | oui | oui | ? | oui | citation, publiques seulement | Déjà fait |
| Envoyer en message privé | oui | oui | oui | oui | ? | oui | non | À faire (FD-07) |
| Feuille de partage, lien qui ramène au contenu | oui | oui | oui | oui | oui | oui | copie ; la porte perd l'adresse | À adapter (FD-06) |
| Enregistrer, collections | oui | oui | oui | ? | oui | sans collections | signets seuls | À adapter (FD-17) |
| Masquer, sourdine, mots masqués | oui | oui | oui | oui | oui | ? | masquer, sourdine | À adapter (FD-17) |
| Être averti d'une publication | ? | oui | ? | ? | oui | ? | non (le moteur l'a) | À faire (FD-10) |
| Épingler sur son profil | oui | oui | oui | oui | — | oui | pages seulement | À faire (FD-10) |
| Publier aussi dans le réseau voisin | vers Facebook | vers Instagram | — | ? | — | — | « Publier aussi sur ANTSIA » | Déjà fait ; retrait après coup à faire (FD-10) |
| Fil vertical immersif | oui | oui | oui | onglet vidéo | non | onglet vidéo | Découverte | Déjà fait, à recetter |
| Vidéos seulement | oui | oui | oui | onglet vidéo | — | onglet vidéo | non (le moteur l'a) | À faire (FD-13) |
| Économie de données, lecture automatique réglable | oui | oui | oui | oui | ? | oui | signal du système seul | À faire (FD-11) |
| Vitesse, sous-titres | partiel | oui | oui | ? | ? | oui | non | À faire (FD-19) |
| Qualité adaptée au débit | oui | oui | oui | oui | ? | oui | non | Reporté (DG-018 du moteur, puis FD-20) |
| Statuts de 24 h | oui | oui | oui | non | non | non | oui | Déjà fait, à recetter |
| Répondre, réagir à un statut ; statut texte | oui | oui | ? | — | — | — | non | À faire (FD-12) |
| Signaler un statut | oui | oui | oui | — | — | — | non | **À faire (FD-05)** |
| Recherche à onglets | oui | oui | oui | oui | oui | oui | une recherche par rubrique | À faire (DS-11) |
| Recherches récentes, suggestions | oui | oui | oui | oui | ? | oui | non | À faire (DS-11) |
| Tendances | ? | ? | oui | oui | ? | oui | non | À adapter, avec seuil (FD-18) |
| Traduire une publication | oui | oui | ? | oui | ? | oui | non | Écarté (cahier, § 8.15) ; décision 8 |

## 4. Ce qui manque

### 4.1 Bloquant avant l'ouverture du pilote

1. **Les photos partent brutes.** En mode moteur, le composeur dépose le fichier choisi sans le ré-encoder : métadonnées, position GPS comprise, et jusqu'à 20 Mio. La décision du 9/11 n'est appliquée nulle part dans DIASPORALE, et le lot FP-01 du moteur ne touche pas ce composeur (FD-01).
2. **Vidéo d'iPhone illisible sur Android**, 100 Mio admis ; le message d'erreur écrit « 100 Mo » en dur alors que la décision est 60 Mio (FD-02).
3. **Au-delà de 20 commentaires, rien ne se lit**, pas même le commentaire qu'on vient d'envoyer (FD-03).
4. **L'auteur ne sait pas que sa publication est en relecture** : l'adaptateur écrit « publiée » en dur. Et dans un pays non ouvert, l'écran promet une relecture que l'adaptateur refuse (FD-04).
5. **Un commentaire et un statut ne se signalent pas**, alors que tout contenu doit l'être (EXF-DG-40) et que le moteur sait recevoir les deux (FD-05).
6. **Aucune recette du parcours complet à deux comptes en mode moteur** : photos, vidéo, audiences, « Publier aussi sur ANTSIA », statuts (volet du § 6).

### 4.2 Fonctions attendues qui manquent

- Partager par la feuille du téléphone, et retrouver la publication après la porte (FD-06) ; envoyer une publication dans iCom (FD-07).
- Voir qui a réagi, aimer un commentaire, limiter qui commente (FD-08).
- Suggestions de mentions et de mots-dièse ; adresses web cliquables (FD-09).
- Une vraie recherche : un champ, des onglets, les publications comprises (DS-11).
- Les seules vidéos en Découverte (FD-13) ; répondre et réagir à un statut (FD-12).

### 4.3 Options qui manquent sur ce qui existe

- Sur sa publication : la retirer d'ANTSIA sans la retirer d'ici, l'épingler sur son mur, être averti des commentaires (FD-10) ; modifier autre chose que le texte ; date de la modification (FD-15).
- Sur la carte : décompte par genre de réaction (FD-08) ; raison de relation dans « Pourquoi » (FD-17).
- Dans le composeur : réordonner les photos ; brouillon avec ses médias, sur un autre appareil ; sondage ; programmation (FD-16).
- Dans le fil : pastille des nouvelles publications en liste ; réglage de la lecture automatique et de l'économie de données (FD-11) ; suivre un mot-dièse, masquer un mot, ranger ses signets (FD-17).
- Dans les statuts : texte, mentions, sourdine d'un auteur, anneau sur le profil (FD-12) ; statut d'une page (FD-19).

### 4.4 Améliorations de l'existant

- **Explorer promet « Trouvez des membres, des pages et des communautés » sans offrir un seul champ** : c'est un sommaire. La recherche de publications existe au moteur et n'est pas appelée (DS-11).
- **Coût du fil** : chaque page chargée reste une souscription vivante ; toutes les images sont paresseuses, aucune n'est prioritaire (FD-14).
- **Appel et vidéo** : la coupure de la lecture pendant un appel est écrite et jamais branchée (FD-11).
- **Lien partagé** : la porte renvoie au fil, pas à la publication ; c'est le premier geste d'un membre qui colle un lien dans WhatsApp (FD-06).
- **Statuts absents de la démonstration** : le bandeau ne s'y affiche pas du tout, alors que toute capacité doit y être servie avec des données fictives (D-G13 ; FD-12).

### 4.5 Ce qui distingue DIASPORALE

- **Le pays d'abord** : aucun réseau de référence n'ordonne le fil par pays de résidence plus une couche commune.
- **Un fil honnête** : par date, raisons réelles, aucun signal de comportement lu. À dire, pas seulement à faire.
- **Le contexte séparé** : rien ne sort sans geste ; un lien partagé mène à la porte, jamais à un aperçu public.
- **Confiance visible** : badges calculés sur chaque carte ; auteur neutre quand un profil est retiré ; média retenu par l'antivirus dit à l'écran.
- **Léger par défaut** (à prouver) : lecteur unique, son coupé, rien de préchargé en économie de données, photos allégées dès FD-01.

### 4.6 Écarté ou reporté, et pourquoi

| Sujet | Sort | Raison |
|---|---|---|
| Fil « Pour vous » tiré du comportement | Écarté | D-G05 |
| Commentaires à plusieurs niveaux | Écarté | EXF-DG-12 : un niveau |
| Traduction automatique | Écarté | Cahier, § 8.15 ; à rouvrir par la décision 8 |
| Lieu précis, personnes identifiées sur photo | Écarté | Aucune coordonnée exposée ; consentement à concevoir |
| Musique, effets, duo | Écarté | Aucune licence (docs/14, G6) |
| Aperçu de lien | Reporté | Risque d'hameçonnage ; décision ouverte au moteur (IC-19) |
| Vues et statistiques | Reporté | FP-17 et FP-20 du moteur, après mesure de charge |
| Chaîne des médias au serveur (DG-018) | Renvoyé au moteur | Lot S1 du plan 03 d'ANTSIA, sous porte du fournisseur ; DIASPORALE le branche par FD-20 |
| Photos et vidéo dans une même publication | Écarté | Règle du domaine du moteur (`assertPostMedia`) |
| Rubriques de publication (question, bon plan…) | Écarté pour l'instant | Entraide et annonces ont leurs rubriques ; mots-dièse suivis (décision 9) |

## 5. Lots d'implémentation

### FD-01 — Photos nettoyées et allégées avant l'envoi · P0 · S · S2
- **Pour l'utilisateur** : ses photos ne livrent plus le lieu ni l'appareil ; elles partent plus légères.
- **Backend** : aucun. Les bornes viennent du domaine du moteur : quand FP-01 abaisse `POST_IMAGE_MAX_BYTES`, l'écran suit sans changement.
- **Web** : dans `uploadMedia` de `D:apps/diasporale_com/src/data/engine-source.ts`, ré-encoder chaque image avant le dépôt avec le module partagé que livre SD-02 ; un échec refuse le fichier, jamais l'original. Si SD-02 n'est pas fusionné, étendre `downscaleImage` de `D:packages/diasporale-features/src/data/media.ts` (déjà employé par la démonstration), grand côté à 2 048 px, puis converger. Les dimensions déclarées sont celles du fichier ré-encodé. Le même chemin sert les publications de page et la galerie d'évènement.
- **Mobile** : même règle dans le composeur natif (plan 16).
- **Données personnelles** : collecte réduite ; rien de plus à exporter.
- **Tests et cliquets** : un JPEG portant un bloc GPS sort sans segment EXIF ; refus si le canvas manque ; tests du composeur inchangés.
- **Critères d'acceptation** : en mode moteur, le fichier servi à un second compte n'a ni métadonnées ni côté de plus de 2 048 px ; un fichier illisible est refusé avec un message ; le GIF animé suit la règle arrêtée dans SD-02.
- **Dépend de** : SD-02 du moteur (module partagé) ; décision du 9/11.
- **Porte** : aucune.

### FD-02 — Vidéos lisibles partout et bornées · P0 · S · S2
- **Pour l'utilisateur** : la vidéo d'un iPhone se lit sur Android ; une vidéo trop lourde est refusée avant l'envoi, avec la vraie limite.
- **Backend** : aucun ici. SD-03 retire QuickTime des types admis et borne la durée ; EX-17 ramène la vidéo à 60 Mio.
- **Web** : brancher dans le dépôt du composeur la politique de conversion des statuts (`A:packages/social-features/src/features/stories/story-video-policy.ts`, que SD-03 généralise) ; textes `media_too_large` et `media_type_invalid` tirés des constantes du domaine ; durée mesurée par `describeMediaFile`.
- **Mobile** : plan 16.
- **Données personnelles** : aucune.
- **Tests et cliquets** : MOV converti, ou refusé avec la marche à suivre ; le texte d'erreur suit la borne ; `i18n-keys`.
- **Critères d'acceptation** : un MOV choisi dans Safari est lu dans Chrome sur Android ; aucun message ne cite une limite fausse.
- **Dépend de** : SD-03 et EX-17 du moteur.
- **Porte** : aucune.

### FD-03 — Lire tous les commentaires · P0 · S · S2
- **Pour l'utilisateur** : « Voir les commentaires suivants » ; son commentaire paraît toujours après l'envoi.
- **Backend** : aucun (`paginateComments` et `paginateReplies` acceptent déjà un curseur).
- **Web** : `useComments` et `useReplies` du port deviennent paginés (curseur, suite, reprise), sur le modèle de `useBookmarksPage` ; bouton de suite dans `D:packages/diasporale-features/src/components/comments.tsx` ; le commentaire envoyé est montré même hors de la page chargée ; fournisseur de démonstration aligné.
- **Mobile** : plan 16.
- **Données personnelles** : aucune.
- **Tests et cliquets** : 21 commentaires, le 21e se lit ; 51 réponses ; reprise après erreur ; changement de lecteur.
- **Critères d'acceptation** : à deux comptes, sur une publication à 25 commentaires, chacun lit les 25 et voit le sien après l'envoi.
- **Dépend de** : rien.
- **Porte** : aucune.

### FD-04 — L'auteur sait où en est sa publication · P0 · M · S2
- **Pour l'utilisateur** : « En relecture, visible de vous seul » sur sa carte quand la modération la retient ; dans un pays non ouvert, un seul message, vrai.
- **Backend** : issue [S1] : rendre à l'auteur l'état de modération de sa propre publication (champ du DTO du fil ou lecture réservée à soi) ; `publish` ne rend aujourd'hui que `postId` et `created`. Pays non ouvert : garde serveur dans la tranche, à la place de la garde d'écran (avec le plan 14).
- **Web** : `toPostView` et `publish` de l'adaptateur cessent d'écrire `published` en dur ; la bannière et le toast « Envoyé en relecture » disent l'état réel ; le texte du composeur et le refus disent la même chose.
- **Mobile** : même bannière.
- **Données personnelles** : aucune nouvelle ; la décision se lit déjà dans « Mes données ».
- **Tests et cliquets** : publication retenue par un terme bloqué : bannière chez l'auteur, rien chez un tiers ; pays non ouvert : un seul comportement.
- **Critères d'acceptation** : aucune publication retenue n'est annoncée « Publié. » ; un client modifié ne publie pas en local dans un pays non ouvert.
- **Dépend de** : plan 14 (relecture à l'ouverture ; MC-02 du moteur) ; plan 06 (pays ouverts).
- **Porte** : publication du moteur par S1 avant toute mise à jour de la démonstration.

### FD-05 — Signaler un commentaire et un statut · P0 · S · S2
- **Pour l'utilisateur** : « Signaler » dans le menu d'un commentaire et dans le lecteur d'un statut ; mêmes motifs, même accusé de réception.
- **Backend** : aucun pour le commentaire (`reportComment` existe). Pour le statut, la cible existe ; SD-01 ajoute la commande au lecteur partagé.
- **Web** : action dans `comments.tsx`, jamais sur son propre commentaire ; feuille de signalement sortie de `post-menu.tsx` pour servir aux deux ; `reportComment` au port et aux deux fournisseurs ; statut : vérifier que la commande de SD-01 paraît dans `/actus` et que le dossier arrive au bureau du pays.
- **Mobile** : exigé par les boutiques d'applications (plan 16).
- **Données personnelles** : régime existant des signalements ; « Mes signalements » les liste (plan 13).
- **Tests et cliquets** : commande absente sur son propre contenu ; rejeu sans doublon ; `i18n-keys`.
- **Critères d'acceptation** : à deux comptes, un commentaire et un statut signalés arrivent dans la voie voulue du bureau, avec accusé de réception.
- **Dépend de** : plan 14 (natures et bureau) ; SD-01 du moteur.
- **Porte** : aucune.

### FD-06 — Partager vraiment · P1 · M · S2
- **Pour l'utilisateur** : « Partager… » ouvre la feuille du téléphone ; le lien collé dans WhatsApp ramène à la publication après l'entrée.
- **Backend** : aucun.
- **Web** : `navigator.share` avec repli sur la copie, comme `page-share-button.tsx` ; la garde retient l'adresse interne demandée et y ramène après la porte (jamais une adresse externe) ; pour une publication « Aussi dans ANTSIA », proposer aussi son adresse publique quand FP-04 l'a livrée, origine lue dans la configuration.
- **Mobile** : feuille native (plan 16).
- **Données personnelles** : aucune ; l'adresse retenue vit le temps de l'entrée.
- **Tests et cliquets** : `no-hardcoded-urls` ; adresse externe refusée ; aucun aperçu public d'un contenu `network`.
- **Critères d'acceptation** : lien ouvert sans session, entrée, arrivée sur la publication ; un extérieur au réseau voit l'accueil, rien du contenu.
- **Dépend de** : plans 01 et 02 (porte et coque) ; FP-04 du moteur.
- **Porte** : aucune.

### FD-07 — Envoyer une publication dans iCom · P1 · S · S2
- **Pour l'utilisateur** : « Envoyer à… » depuis le panneau de partage, vers une conversation existante.
- **Backend** : aucun ici ; FP-05 et IC-18 ajoutent au message la référence d'une publication, relue pour chaque lecteur.
- **Web** : entrée dans `post-share.tsx`, choix de la conversation par la surface d'iCom, confirmation.
- **Mobile** : après le web.
- **Données personnelles** : la référence suit le message (export, effacement).
- **Tests et cliquets** : publication réservée aux relations envoyée à un tiers : « indisponible ».
- **Critères d'acceptation** : l'aperçu ne paraît que pour qui peut lire ; une publication retirée devient indisponible dans la conversation.
- **Dépend de** : FP-05 et IC-18 du moteur ; plan 04.
- **Porte** : aucune.

### FD-08 — Interactions attendues · P1 · M · S2
- **Pour l'utilisateur** : décompte par genre de réaction, liste de qui a réagi, « J'aime » sur un commentaire, choix de qui peut commenter.
- **Backend** : aucun ici ; décomptes par genre déjà dans le DTO ; liste par FP-07 ; « J'aime » et politique des commentaires par FP-06.
- **Web** : `toPostView` reprend les décomptes ; dialogue paginé des personnes, annuaire opt-in respecté (nom neutre sinon) ; bouton et choix dans `comments.tsx` et dans le composeur.
- **Mobile** : après le web.
- **Données personnelles** : celles des lots du moteur.
- **Tests et cliquets** : aucun bloqué dans la liste ; politique « relations » : refus indistinct d'un tiers.
- **Critères d'acceptation** : la somme des genres égale le total ; fermer les commentaires n'efface rien.
- **Dépend de** : FP-06 et FP-07 du moteur ; décision 3.
- **Porte** : aucune.

### FD-09 — Saisie aidée : mentions, mots-dièse, liens · P1 · M · S2
- **Pour l'utilisateur** : « @ » propose des personnes, « # » des mots déjà employés ; une adresse web se clique.
- **Backend** : aucun ici ; requête bornée de FP-08, index des mots-dièse de SD-12.
- **Web** : liste accessible dans le composeur et les commentaires ; ne proposer que des relations et des membres visibles dans l'annuaire ; adresses rendues cliquables par `rich-text.tsx`, nouvel onglet, avertissement « Vous quittez DIASPORALE » ; aucun aperçu.
- **Mobile** : après le web.
- **Données personnelles** : aucune.
- **Tests et cliquets** : aucune personne bloquée ou masquée proposée ; aucun HTML interprété ; clavier et lecteur d'écran.
- **Critères d'acceptation** : la suggestion insère un identifiant que le moteur résout ; un lien sort toujours avec l'avertissement.
- **Dépend de** : FP-08 et SD-12 du moteur ; décision 2.
- **Porte** : aucune.

### FD-10 — Gestes de l'auteur que le moteur sert déjà · P1 · S · S2
- **Pour l'utilisateur** : retirer sa publication d'ANTSIA sans la retirer d'ici ; l'épingler sur son mur ; être averti des commentaires.
- **Backend** : aucun (`withdrawFromRoot`, `pinOnMyWall`, `unpinMyWall`, marque `notify`).
- **Web** : trois entrées dans `post-menu.tsx` ; actions au port et aux deux fournisseurs ; épingle montrée par le mur (plan 05).
- **Mobile** : après le web.
- **Données personnelles** : la marque d'avis est déjà dans l'inventaire du moteur.
- **Tests et cliquets** : retrait d'ANTSIA : la carte perd « Aussi dans ANTSIA » ; une seule épingle.
- **Critères d'acceptation** : après retrait, la publication reste lisible dans DIASPORALE et n'est plus rendue par ANTSIA.
- **Dépend de** : rien.
- **Porte** : aucune.

### FD-11 — Lecture maîtrisée · P1 · M · S2
- **Pour l'utilisateur** : un réglage « Économiser les données » et « Lecture automatique » ; la vidéo se tait quand un appel arrive ; « N nouvelles publications » en liste.
- **Backend** : aucun ici ; SD-04 ajoute les deux préférences de la personne.
- **Web** : `playback-environment.ts` lit la préférence en plus du signal du système ; `suspendMediaPlayback("call")` branché sur l'état d'appel d'iCom (issue [S1] si l'hôte d'appel ne l'expose pas) ; la première page du fil n'insère plus rien sous les yeux du lecteur : une pastille l'annonce.
- **Mobile** : plan 16.
- **Données personnelles** : préférences exportées (plan 13).
- **Tests et cliquets** : « Jamais » empêche toute lecture automatique ; appel en cours : aucune lecture possible.
- **Critères d'acceptation** : en économie de données, aucun octet vidéo avant le geste « Lire » ; R-G02 du plan global joué.
- **Dépend de** : SD-04 du moteur ; plans 04 et 13.
- **Porte** : aucune.

### FD-12 — Statuts à la hauteur · P1 · M · S2
- **Pour l'utilisateur** : répondre et réagir à un statut, publier un mot sur fond de la charte, mentionner, mettre un auteur en sourdine, voir l'anneau sur un profil.
- **Backend** : aucun ici (SD-06, SD-07, SD-08 du moteur).
- **Web** : adopter chaque capacité par déclaration explicite (ADR-0017 : DIASPORALE n'adopte rien sans décision) ; un compte en attente lit sans répondre ; fonds du statut texte par les jetons de la charte DIASPORALE ; en démonstration, des statuts fictifs (D-G13) ou, à défaut, un état « indisponible » dit à l'écran.
- **Mobile** : plan 16.
- **Données personnelles** : celles des lots du moteur.
- **Tests et cliquets** : `no-hardcoded-colors` ; réponse refusée hors relation.
- **Critères d'acceptation** : la réponse arrive dans iCom ; après 24 h, le message reste, la vignette non.
- **Dépend de** : SD-06, SD-07, SD-08 du moteur ; plans 04 et 05.
- **Porte** : aucune.

### FD-13 — Découverte des vidéos · P1 · M · S2
- **Pour l'utilisateur** : un troisième choix « Vidéos » à côté de Liste et Découverte : les seules vidéos, une par écran.
- **Backend** : aucun (`mediaFeed.paginate`, borné au réseau) ; SD-10 l'indexe, SD-05 ajoute l'affiche.
- **Web** : capacité facultative du port, adaptateur moteur, démonstration sans vidéo dite telle ; même lecteur unique ; fenêtre sans vidéo annoncée tant que SD-10 n'est pas livré.
- **Mobile** : plan 16.
- **Données personnelles** : aucune.
- **Tests et cliquets** : `i18n-keys` (famille `discovery`) ; garde de délivrance respectée.
- **Critères d'acceptation** : aucune sixième destination ; une vidéo retenue par l'antivirus n'apparaît pas.
- **Dépend de** : SD-10 et SD-05 du moteur ; décision 6.
- **Porte** : aucune.

### FD-14 — Fil léger · P1 · M · S2
- **Pour l'utilisateur** : un fil qui reste fluide après cent publications et qui coûte moins de données.
- **Backend** : aucun.
- **Web** : dans `feed-pages.tsx`, garder vivantes les trois dernières pages et figer les autres ; première image prioritaire, les suivantes paresseuses ; dimensions toujours réservées ; relevé des octets pour « ouvrir le fil et lire 30 publications », avant et après FD-01.
- **Mobile** : même principe si la mesure le justifie.
- **Données personnelles** : aucune.
- **Tests et cliquets** : curseurs stables, frontière réalignée, position de retour.
- **Critères d'acceptation** : mesures consignées telles quelles ; aucune cible dite atteinte sans mesure.
- **Dépend de** : FD-01 ; plan 02 (DS-08, protocole 3G) ; FP-10 du moteur pour la méthode.
- **Porte** : aucune.

### DS-11 (volet recherche) — Recherche transversale dans Explorer · P1 · M · S2 · repris du plan 15
- **Pour l'utilisateur** : un champ en tête d'Explorer et une loupe dans l'en-tête ; onglets Tout, Membres, Pages, Publications, Services, Emploi.
- **Backend** : aucun pour commencer : chaque onglet appelle la recherche existante ; publications par `posts.search` (100 candidats, limite dite à l'écran jusqu'à SD-11).
- **Web** : adresse de recherche dans `D:apps/diasporale_com/src/lib/routes.ts`, sans nouvelle destination principale ; capacité `postSearch` au port ; « Tout » : trois résultats par type, sans score mêlé ; recherches récentes dans le navigateur, purgées à la sortie.
- **Mobile** : plan 16.
- **Données personnelles** : aucune recherche gardée au serveur ; jamais montrée à un professionnel.
- **Tests et cliquets** : blocage et annuaire opt-in respectés ; `no-hardcoded-urls` ; purge à la déconnexion.
- **Critères d'acceptation** : une publication `network` se trouve ici et pas depuis ANTSIA ; un membre masqué reste introuvable.
- **Dépend de** : rien pour la première tranche ; SD-11 et SD-12 du moteur pour la pagination et l'onglet des mots-dièse ; plan 09 pour le volet favoris.
- **Porte** : aucune. Priorité relevée de P2 à P1 : le moteur sert déjà la recherche de publications, quatre rubriques ont déjà la leur, et Explorer la promet sans l'offrir.

### FD-15 — Publication modifiée : date et versions · P2 · S · S2
- **Pour l'utilisateur** : la marque « modifiée » donne sa date ; l'auteur relit ses versions.
- **Backend** : aucun ici (FP-03 du moteur). **Web** : date au survol et pour le lecteur d'écran ; dialogue des versions réservé à l'auteur. **Mobile** : la marque. **Critères d'acceptation** : un autre membre ne voit aucune version. **Dépend de** : FP-03. **Porte** : aucune.

### FD-16 — Brouillons, programmation, sondages · P2 · L · S2
- **Pour l'utilisateur** : retrouver un brouillon avec ses photos sur un autre appareil ; préparer une publication pour une heure ; poser une question à choix.
- **Backend** : aucun ici (FP-13, FP-14, FP-15 du moteur). **Web** : trois capacités du composeur, chacune facultative au port ; vote secret, résultats agrégés. **Mobile** : après le web. **Critères d'acceptation** : une publication programmée n'est jamais publiée si l'auteur a perdu le droit. **Dépend de** : FP-13, FP-14, FP-15. **Porte** : aucune.

### FD-17 — « Mon fil » enrichi · P2 · M · S2
- **Pour l'utilisateur** : suivre un mot-dièse, masquer un mot, ranger ses signets ; « Pourquoi » dit aussi « une de vos relations » ou « une page que vous suivez ».
- **Backend** : aucun ici (FP-16, FP-19, FP-18 du moteur). **Web** : réglages dans `/parametres#mon-fil` ; la raison de relation vient du DTO, jamais devinée. **Mobile** : après le web. **Critères d'acceptation** : chaque carte venue d'un mot-dièse suivi le dit ; aucun intérêt déduit. **Dépend de** : FP-16, FP-18, FP-19 ; décision 7. **Porte** : décision du propriétaire.

### FD-18 — Tendances du réseau, par pays · P2 · M · S1 puis S2
- **Pour l'utilisateur** : les mots-dièse du moment dans son hub et dans toute la diaspora.
- **Backend** : issue [S1] : agrégat par réseau et par pays (aujourd'hui réservé à la racine), après SD-12 et SD-16 ; seuil de 5 publications et 5 auteurs. **Web** : bloc dans Explorer ; rien plutôt qu'un zéro. **Mobile** : après le web. **Critères d'acceptation** : aucune tendance sous le seuil ; aucun nom de personne. **Dépend de** : SD-12, SD-16. **Porte** : aucune.

### FD-19 — Vidéo et statuts, second niveau · P2 · M · S2
- **Pour l'utilisateur** : sous-titres fournis par l'auteur, vitesse de lecture ; statut au nom d'une page ou d'une association.
- **Backend** : aucun ici (SD-17, SD-09, SD-20 du moteur). **Web** : piste de texte et vitesse dans les lecteurs de DIASPORALE ; choix « au nom de ma page » sous mandat vivant. **Mobile** : après le web. **Critères d'acceptation** : un ancien signataire ne publie plus de statut. **Dépend de** : SD-09, SD-17, SD-20 ; plan 07. **Porte** : aucune.

### DS-19 — iAsted concierge · P3 · M · S2 · repris du plan 15
- **Pour l'utilisateur** : « Quels évènements à Lyon ce mois-ci ? » dans le champ d'Explorer.
- **Contenu** : outils de lecture bornés au réseau (évènements, associations, entreprises, offres, kit d'arrivée), mêmes gardes que l'écran ; réponses étiquetées IA, sources citées ; aucune action sans confirmation ; refus hors réseau testé ; consentement à la première utilisation.
- **Dépend de** : SU11a et SU01i du moteur (plan 16) ; DS-11 (les mêmes recherches servent d'outils).
- **Porte** : fournisseur et clés (propriétaire), marquage de l'IA, décision 11.

### FD-20 — Découverte adaptée au débit · P3 · S · S2
- **Pour l'utilisateur** : la vidéo choisit sa qualité selon le réseau.
- **Contenu** : brancher dans les lecteurs de DIASPORALE les variantes, affiches et sous-titres que produira DG-018 ; aucun dérivé servi après retrait de la source (R-G18).
- **Dépend de** : DG-018 du moteur (plan 03 d'ANTSIA).
- **Porte** : choix du fournisseur et hébergement (propriétaire).

## 6. Ordre recommandé et dépendances

| Vague | Lots | Pourquoi dans cet ordre |
|---|---|---|
| 1 | FD-01, FD-02, FD-03, FD-05, FD-04 | Vie privée d'abord, puis les défauts qu'un premier membre rencontre |
| 2 | Volet de recette ci-dessous | Prouver à deux comptes avant d'ajouter |
| 3 | FD-10, FD-06, DS-11 (volet recherche), FD-14 | Sans attendre le moteur : gestes déjà servis, partage, recherche, poids |
| 4 | FD-08, FD-09, FD-11, FD-13, FD-12, FD-07 | Suivent les lots du moteur dont ils dépendent |
| 5 | FD-15 à FD-19 | Confort, après les premiers retours |
| 6 | DS-19, FD-20 | Sous condition externe |

**Ce que ce plan attend des autres plans.** Moteur : SD-02, SD-03, EX-17 (vague 1) ; FP-03 à FP-08, FP-10, SD-01, SD-04 à SD-10, SD-12 ; puis FP-13 à FP-19, SD-16, SD-17, SD-20, DG-018, SU11a. DIASPORALE : plans 01 et 02 (retour après la porte), 04 (iCom : envoyer, état d'appel, réponse à un statut), 05 (mur, anneau), 06 (pays ouverts), 07 (statut de page), 09 (favoris), 13 (réglages, avis), 14 (natures de signalement, relecture), 16 (mobile). Chaque lot « issue [S1] » exige une publication du moteur avant celle de la démonstration.

**Volet de recette en mode moteur (campagne DS-05).** Comptes de démonstration (docs/34 de DIASPORALE) : membre vérifié, membre parrainée, compte en attente, membre d'un autre pays, membre bloqué, modératrice.

| Étape | Résultat attendu |
|---|---|
| Le vérifié publie 4 photos, dont une avec position GPS, texte alternatif, hub local | La parrainée lit les 4 ; le fichier servi n'a aucune métadonnée (après FD-01) |
| Vidéo MOV, puis MP4 de plus de 60 Mio | Convertie ou refusée avec le bon message (après FD-02) |
| Portée « toute la diaspora » lue depuis un autre pays ; portée locale ; « Mes relations » | La première paraît avec le pays d'origine, la deuxième ne paraît pas ; la troisième est invisible d'un tiers, même par lien direct |
| « Publier aussi sur ANTSIA », puis retrait | Lue dans ANTSIA avec son origine, puis absente (R4, R-G03 ; FD-10) |
| Réagir, 25 commentaires, répondre, modifier, retirer | Tout se lit des deux côtés (FD-03) ; cloche sans contenu |
| Citer, copier le lien, l'ouvrir sans session | Entrée, puis la publication (FD-06) ; un extérieur ne voit rien |
| Masquer, sourdine, restaurer ; signaler publication, commentaire, statut ; le bloqué ouvre le fil, le mur, la recherche | Choix privés tenus ; dossiers au bureau de la modératrice (FD-05) ; rien de l'auteur qui l'a bloqué |
| Statut photo et vidéo, « Vu par », expiration | Lus par la relation ; le compte en attente lit sans créer |
| Découverte : cent éléments, une vidéo, un appel | Un seul média joue ; arrêt pendant l'appel (FD-11) ; retour exact |

## 7. Décisions à prendre par le propriétaire

1. **Photos** : appliquer à DIASPORALE la décision du 9/11 telle quelle, et la règle du GIF animé que fixera SD-02. Recommandation : oui, sans variante propre. Raison : une seule règle pour les deux réseaux.
2. **Liens dans les publications** : cliquables avec avertissement de sortie, sans aperçu au pilote. Raison : les arnaques passent par des liens (cahier, § 19) ; l'aperçu attend la décision du moteur.
3. **Liste de qui a réagi** : visible de tout lecteur autorisé, bloqués exclus. Raison : même choix que le moteur (plan 02, décision 6).
4. **Partage hors du réseau** : garder le lien membre et le retour après la porte ; adresse publique seulement pour une publication « Aussi dans ANTSIA ». Raison : contexte séparé.
5. **Recherches récentes** : dans le navigateur seulement, purgées à la sortie. Raison : aucune recherche au serveur (docs/14, G4).
6. **Vidéos** : un troisième affichage du fil, pas une destination ; pas de lecture en boucle tant que le moteur ne l'a pas décidée. Raison : cinq destinations.
7. **« Pour vous »** : l'élargir aux mots-dièse suivis. Recommandation : oui, intérêts choisis, toujours par date. Raison : un nouveau membre sans relation a aujourd'hui un « Pour vous » vide.
8. **Traduction** : rouvrir ou non l'exclusion du cahier. Recommandation : attendre le pilote ; mesurer d'abord la part des publications non francophones.
9. **Rubriques de publication** : ne pas en créer. Raison : entraide, annonces et emploi ont leurs écrans ; les mots-dièse suivis couvrent le reste.
10. **Relecture par pays** : le moteur la règle par réseau et par surface ; le cahier la veut par pays (invariant 10). Recommandation : garde serveur par pays dans la tranche, écrite avec le plan 14. Raison : la garde d'écran actuelle se contourne.
11. **iAsted concierge** : après le pilote, en lecture seule d'abord. Raison : il dépend de la passerelle du moteur, d'un fournisseur et du marquage de l'IA.

## 8. Risques et points d'attention

- **Deux bases d'écrans** : un lot web du moteur sur le fil ne corrige pas DIASPORALE ; tenir à jour la correspondance du § 6. FD-01 a un repli interne : ne pas laisser un P0 de vie privée derrière un lot d'une autre session.
- **La démonstration masque le défaut des photos** : elle réduit déjà les images. Seule une recette en mode moteur prouve FD-01.
- **Champ nouveau dans un DTO du moteur** (FD-04) : les projections se lisent en schéma strict ; publier le moteur avant le front.
- **Garde d'écran du pays non ouvert** : contournable par un client modifié tant que FD-04 n'est pas livré.
- **Lien partagé** : ne jamais produire d'aperçu public d'un contenu `network` ; l'adresse retenue par la porte doit être interne.
- **Statuts** : surfaces partagées ; une nouveauté du moteur ne doit paraître ici que déclarée et recettée.
- **Chiffres** : les compteurs de la démonstration sont fictifs et dits tels, aucun ne passe en mode moteur ; le coût du fil (une souscription par page) se mesure avant et après FD-14, sans cible annoncée.

## 9. Prompts d'implémentation

### Prompt FD-01
```text
Session S2 (DIASPORALE). Écris en français. Opus seulement, aucun sous-agent Sonnet.
Lis : CLAUDE.md, docs/etudes/2026-11-10-finalisation/03_FIL_PUBLICATIONS_DECOUVERTE_RECHERCHE.md (§ 2 ligne 13, lot FD-01), le lot SD-02 du plan 03 d'ANTSIA.
Vérifie d'abord que uploadMedia (apps/diasporale_com/src/data/engine-source.ts) envoie toujours le fichier brut, et si le module partagé de SD-02 existe dans main d'ANTSIA.
Branche claude/photos-nettoyees depuis origin/main. Périmètre : engine-source.ts, packages/diasporale-features/src/data/media.ts, leurs tests, les textes fr et en.
Livre : ré-encodage avant dépôt (module de SD-02 s'il existe, sinon downscaleImage étendu), grand côté 2 048 px, refus si le ré-encodage échoue, dimensions déclarées du fichier ré-encodé.
Vérifie : test avec un JPEG portant un bloc GPS ; bun run --cwd ../ANTSIA verify avec le verrou ; recette en mode moteur à deux comptes, fichier servi contrôlé. Arrête-toi avant toute publication.
```

### Prompt FD-03
```text
Session S2. Lis le lot FD-03 de ce plan, packages/diasporale-features/src/components/comments.tsx, data/port.ts (useComments, useReplies, useBookmarksPage) et engine-source.ts.
Branche claude/commentaires-pagines. Rends les deux lectures paginées (curseur, suite, reprise) dans le port, l'adaptateur moteur et la démonstration ; ajoute « Voir les commentaires suivants » ; montre toujours le commentaire qu'on vient d'envoyer.
Tests : 21 commentaires, 51 réponses, reprise après erreur, changement de lecteur. Textes fr et en dans un fragment du chantier.
Vérifie : verify vert ; recette à deux comptes sur une publication à 25 commentaires. Arrête-toi avant toute publication.
```

### Prompt DS-11 (volet recherche)
```text
Session S2. Lis le lot DS-11 (volet recherche) de ce plan, apps/diasporale_com/src/screens/explore-screen.tsx, lib/routes.ts, les ports pages, services, jobs et useMemberSearch, et posts.search d'ANTSIA.
Branche claude/recherche-explorer. Ajoute l'adresse de recherche dans routes.ts, le champ en tête d'Explorer, la loupe de l'en-tête, les onglets Tout, Membres, Pages, Publications, Services, Emploi. Publications : capacité facultative du port sur posts.search, limite dite à l'écran. « Tout » : trois résultats par type. Recherches récentes dans le navigateur, purgées par la déconnexion.
N'ajoute aucune destination principale. Aucune recherche gardée au serveur.
Vérifie : verify vert ; membre masqué introuvable ; publication network introuvable depuis ANTSIA ; 390 et 1280 px. Arrête-toi avant toute publication.
```

## 10. Sources lues

- Brief commun ; plans 02, 03 et 16 du dossier de finalisation d'ANTSIA (§ 2, § 5, décisions) ; plan 15 (§ 2, lots DS-11 et DS-19) ; plan directeur d'ANTSIA (§ 5.1, § 6.2).
- DIASPORALE : cahier (docs/00), plan global (docs/14), registre des décisions (docs/17), docs/04, 05, 09, 10, 12, 16 ; recettes du 16 au 22/10 (deux comptes, démonstration en ligne, partage, fils au téléphone).
- Dossier produit d'origine : fiches F10 et F15, § 1. Vault : décisions du fil paginé, des statuts et albums du moteur.
- Code DIASPORALE : écrans du fil, de la publication, des signets et d'Explorer ; composeur, carte, médias, menu, partage, explication, commentaires, texte enrichi, découverte ; port, adaptateur moteur, fournisseur de démonstration ; garde d'accès ; table des routes.
- Code ANTSIA : modules `posts`, `engagement`, `marks`, `stories`, `moderation`, `media`, `public` ; domaine `content`, `richText`, `stories` ; surfaces partagées des statuts et des albums ; ADR-0017.
