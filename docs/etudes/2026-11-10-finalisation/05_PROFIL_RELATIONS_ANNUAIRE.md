# Plan 05 — Profil, relations et annuaire des membres

> Constaté par lecture du code d'`origin/main` (DIASPORALE `bead76d`, ANTSIA `fd58d73b`), le 10 novembre 2026. Rien n'a été exécuté : ni test, ni recette, ni publication.
> Applications de référence : LinkedIn, Facebook, Instagram, InterNations, Bumble BFF. Comparaison faite de mémoire, sans revérification en ligne ; un « ? » marque ce qui n'est pas sûr.
> Ce plan détaille, pour le profil, la facette diaspora, les relations et l'annuaire des membres, le plan 15 du dossier de finalisation d'ANTSIA. Les lots qu'il en reprend gardent leur identifiant (DS-…, DG-…) ; les lots nouveaux portent le préfixe `RP-`.

Légende des chemins : `D:` = dépôt DIASPORALE, `A:` = dépôt ANTSIA. « Écran » = atteignable depuis l'interface de diasporale.com ; « Moteur » = la fonction existe côté serveur.

## 1. L'intention du propriétaire

- **Pour qui** : le Gabonais établi qui veut retrouver des compatriotes de sa ville ou de son métier, et le nouvel arrivant qui cherche un premier réseau (cahier § 6.1, P1 et P2 ; § 2.1, objectif 2 : « se connecter de personne à personne »).
- **Une personne, un profil.** L'identifiant, le nom affiché, l'accroche, la photo et la couverture sont ceux de la personne dans le moteur, communs à ANTSIA et à DIASPORALE. La facette diaspora n'est pas une seconde personne : ce sont des attributs propres au réseau (cahier § 4 ; en-tête de `D:packages/diasporale-domain/src/facet.ts`).
- **Protégé par défaut.** Seul le pays est visible du réseau ; la ville, des relations ; le reste, de soi. L'annuaire est masqué par défaut, opt-in par niveau, sans export, sans coordonnées (EXF-DG-08, EXF-DG-46 ; invariant 6).
- **Trouver sans exposer.** « Qui est gabonais à Nantes ? » : seuls ceux qui l'ont choisi apparaissent, et l'on écrit par la messagerie (dossier produit, fiche F11). Recherche bornée au réseau, refus indistinct (EXF-DG-19). Suggestions par pays, ville, association et relations communes, avec « ne plus me proposer » (EXF-DG-18).
- **Deux liens, jamais confondus** : la connexion, symétrique, et l'abonnement, unilatéral. Blocage silencieux dans les deux sens (EXF-DG-18, EXF-DG-43).
- **Confiance calculée** : quatre badges, jamais déclaratifs ni payants (invariant 8 ; cahier § 6.3).
- **Déjà décidé** : nom affiché libre, jamais tiré d'un état civil (ADR-0002 d'ANTSIA ; docs/10 de DIASPORALE) ; la liste des abonnés d'une personne n'est jamais montrée à un tiers, aucun compteur sur la fiche d'autrui (plan 05 d'ANTSIA, § 1) ; classement explicable, sans apprentissage comportemental (D-G05) ; bloquer supprime les abonnements dans les deux sens (décision du 9/11) ; un seul bouton plein par zone.
- **Refusé** : vendre l'accès à l'annuaire des personnes (fiche F11) ; créer un profil d'office (invariant 5) ; plusieurs comptes pour une personne ; faire payer le citoyen. Le profil professionnel (métier, compétences) relève des talents, plan 10 (EXF-DG-09).

## 2. Ce qui existe

| # | Capacité | État | Écran | Moteur | Preuve |
|---|---|---|---|---|---|
| 1 | Fiche d'un membre à l'adresse `/@identifiant` : nom, identifiant, accroche, badges, photo, couverture | Présent | oui | oui | `D:apps/diasporale_com/src/screens/profile-screens.tsx` ; `A:convex/modules/people/profile.ts` (`getPublicProfile`) |
| 2 | Fiche réservée aux membres : un non-membre ne voit rien, pas même un aperçu | Présent (voulu) | oui | oui | `D:apps/diasporale_com/src/components/gate.tsx` ; `A:convex/modules/people/miniProfile.ts` (`findPublishedPersonByHandle`) |
| 3 | Refus indistinct : inconnu, retiré, hors réseau ou bloqué rendent la même page | Présent | oui | oui | `A:convex/modules/diaspora/profile.ts` (`memberFacet`) |
| 4 | Modifier le nom affiché et l'accroche sans republier | Présent | oui | oui | `D:apps/diasporale_com/src/components/profile-identity-settings.tsx` ; `updateMyProfile` |
| 5 | Changer d'identifiant | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/people/profile.ts` (`publishMyProfile`, table `handleHistory`) ; motifs : `handle` dans les réglages (aucun champ) |
| 6 | Nom affiché libre ; la règle « NOM en majuscules » ne vaut que pour les champs civils | Présent (voulu) | oui | oui | `A:packages/social-domain/src/civilName.ts` |
| 7 | Refuser un numéro, une adresse ou un lien dans le nom et l'accroche | Absent | non | non | `A:packages/social-domain/src/content.ts` (`assertHeadline` : longueur seule) ; la règle existe pour les offres : `D:packages/diasporale-domain/src/services.ts` (`containsContactDetails`) |
| 8 | Quatre badges calculés, montrés partout où la personne paraît | Présent | oui | oui | `D:packages/diasporale-features/src/components/trust-badge.tsx` ; `A:convex/modules/people/persons.ts` (`badgesOf`) |
| 9 | Explication d'un badge | Partiel : infobulle au survol (`title`), rien au toucher | partiel | — | même composant |
| 10 | Pages gérées et associations de la personne sur sa fiche | Absent | non | partiel | motifs : `MyPagesPanel`, `myAssociations` dans la fiche ; le panneau n'existe que pour soi : `D:apps/diasporale_com/src/components/my-pages-panel.tsx` |
| 11 | Lien de la fiche vers le profil de talent ou de mentor | Absent | non | oui | motifs : `talent`, `mentor` dans la fiche ; données : `A:convex/modules/diaspora/jobsTables.ts`, `A:convex/modules/diaspora/mentoringTables.ts` |
| 12 | « Me voir comme les autres » | Partiel : un seul point de vue (membre actif d'un autre pays, sans relation) ; publications et albums masqués | partiel | partiel | `profile-screens.tsx` (`?apercu=1`) ; `memberFacet` (`preview`) |
| 13 | « Membre depuis » sur la fiche d'autrui | Absent | non | non | motifs : `memberSince`, `joinedAt` (présents dans les seuls réglages) |
| 14 | Pays de résidence, saisi, jamais le Gabon | Présent | oui | oui | `D:apps/diasporale_com/src/screens/settings-screen.tsx` (`FacetSection`) ; `A:convex/modules/diaspora/facet.ts` (`updateMyFacet`) |
| 15 | Ville, texte libre de 80 caractères | Présent | oui | oui | `D:packages/diasporale-domain/src/facet.ts` (`parseCity`) |
| 16 | Ville modérée et sans coordonnées | Absent | non | non | motifs : `moderateContentWrite`, `containsContactDetails` dans la fonction `updateMyFacet` |
| 17 | Année d'arrivée | Présent | oui | oui | `facet.ts` du domaine (`parseArrivedAt`) |
| 18 | Visibilité par champ, quatre niveaux : moi, mes relations, membres de mon pays, tout le réseau | Présent pour pays, ville, poste et année | oui | oui | `facet.ts` du domaine (`isFieldVisibleTo`) ; `settings-screen.tsx` (`EDITABLE_VISIBILITY`) ; `A:convex/modules/diaspora/tables.ts` (`memberPrivacy`) |
| 19 | Poste consulaire de rattachement | Fermé : posé par l'attestation seule (DG-009a, fermée) ; en mode moteur son nom n'est jamais résolu | non | partiel | `D:apps/diasporale_com/src/data/engine-views.ts` (`postName: null`) |
| 20 | Associations de la personne (`associationIds`) | Partiel : stocké et projeté, jamais saisi ni alimenté par les adhésions réelles ; visibilité non réglable | non | partiel | `settings-screen.tsx` (valeur repassée telle quelle) ; adhésions ailleurs : `A:convex/modules/diaspora/associationsTables.ts` |
| 21 | « Disponible pour aider les nouveaux arrivants » | Partiel : stocké et affiché sur la fiche ; aucun interrupteur, visibilité non réglable | partiel | oui | `settings-screen.tsx` (`helpAvailable: facet.helpAvailable`) |
| 22 | Langues parlées | Absent sur la facette (présentes aux profils de talent et de mentor) | non | non | motifs : `languages` dans le domaine de la facette |
| 23 | Métier, études | Absent sur la fiche (le titre vit au profil de talent, plan 10) | non | non | motifs : `title`, `education`, `school` dans la facette |
| 24 | Attache au Gabon ; « de passage au Gabon du… au… » | Absent | non | non | motifs : `origin`, `province`, `hometown`, `visiting`, `passage`, `séjour` |
| 25 | Présentation propre à DIASPORALE, distincte du profil commun | Absent : l'accroche est celle du profil commun | non | non | `D:apps/diasporale_com/src/components/profile-publication-settings.tsx` |
| 26 | Photo et couverture : dépôt, remplacement, retrait ; analyse antivirus et retenue dites à l'écran | Présent | oui | oui | `D:apps/diasporale_com/src/components/profile-images-editor.tsx` ; `setMyAvatar`, `setMyCover` |
| 27 | Retrait des métadonnées avant l'envoi (position GPS, appareil) | Absent | non | non | `D:apps/diasporale_com/src/data/engine-profile-images.ts` (`body: file`) ; les albums le font : `A:packages/social-features/src/features/reseau-albums/album-model.ts` (`albumReencodePlan`) |
| 28 | Recadrage et aperçu avant l'envoi | Absent | non | non | motifs : `crop`, `canvas`, `recadr` dans l'éditeur |
| 29 | Images du profil en démonstration | Fermé (voulu : aucun faux dépôt) | non | — | `D:apps/diasporale_com/src/components/profile-images-settings.tsx` |
| 30 | Vraie photo dans l'annuaire, les suggestions et les listes de relations | Partiel : le serveur rend `avatarUrl`, la vue l'écarte ; initiales affichées | partiel | oui | `engine-views.ts` (`toMemberHitView`) |
| 31 | Mur paginé ; publication épinglée lue | Présent | oui | oui | `D:apps/diasporale_com/src/components/feed-pages.tsx` ; `A:convex/modules/posts/posts.ts` (`personPosts`) |
| 32 | Épingler une publication sur son mur | Absent ici ; le moteur l'a | non | oui | `posts.ts` (`pinOnMyWall`, `unpinMyWall`) ; motifs : `pinOnMyWall` dans l'adaptateur moteur |
| 33 | Onglets Publications, Photos, Albums | Partiel : « Photos » montre des couvertures d'albums, pas les photos des publications ; onglets fermés en démonstration | partiel | partiel | `D:apps/diasporale_com/src/components/profile-albums.tsx` |
| 34 | Albums : créer, reprendre un brouillon, publier, modifier depuis la galerie, retirer | Présent | oui | oui | `D:apps/diasporale_com/src/screens/album-screen.tsx` ; `A:packages/social-features/src/features/reseau-albums/AlbumPage.tsx` |
| 35 | Supprimer un album, retirer une photo publiée | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/albums/albums.ts` (`remove`, `removeItem`), sans appel dans la galerie (lot PF-11) |
| 36 | Signaler un album | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/moderation/targets.ts` (cible `album`) ; lot PF-02 |
| 37 | Onglets Médias, Relais, Identifié ; statuts à la une | Absent | non | non | lots PF-14 à PF-16 du moteur |
| 38 | Demander une connexion | Présent | oui | oui | `profile-screens.tsx` (`RelationBar`) ; `A:convex/modules/graph/connections.ts` (`requestConnection`) |
| 39 | Joindre un mot à sa demande | Absent ici ; le moteur l'a | non | oui | `requestConnection` (`message`) ; l'adaptateur n'en envoie pas ; le mot reçu s'affiche : `D:apps/diasporale_com/src/components/connection-list.tsx` |
| 40 | Accepter, refuser : fiche, liste, cloche | Présent | oui | oui | `D:apps/diasporale_com/src/components/personal-connections.tsx` |
| 41 | Demandes envoyées, annulation versionnée | Présent | oui | oui | `D:apps/diasporale_com/src/screens/relations-screen.tsx` ; `cancelSentRequest` |
| 42 | Annuler une demande depuis la fiche | Absent : « Demande envoyée » est un bouton inerte | non | partiel | `profile-screens.tsx` |
| 43 | Mes relations, paginées | Présent | oui | oui | `A:packages/social-features/src/features/reseau-personnel/use-dual-connection-pagination.ts` |
| 44 | Chercher dans mes relations | Absent ici ; le moteur l'a | non | oui | `connections.ts` (`searchMine`) ; motifs : `searchMine` dans DIASPORALE |
| 45 | Écrire ou appeler depuis une ligne de relation | Absent : la ligne ne mène qu'à la fiche | non | oui | `connection-list.tsx` |
| 46 | Écrire, appeler une relation depuis sa fiche | Présent en mode moteur ; fermé hors relation et en démonstration (plan 04) | oui | oui | `profile-screens.tsx` (`PersonContact`) |
| 47 | Rompre une relation | Absent, moteur compris (lot PF-05) | non | non | pastille « En relation » inerte dans `RelationBar` |
| 48 | Relations en commun sur la fiche, et leur liste | Absent ; comptées pour les seules suggestions | non | partiel | `A:convex/modules/diaspora/suggestions.ts` (`mutualConnections`) |
| 49 | Décompte de mes relations | Absent | non | non | motifs : `connectionCount` |
| 50 | Suivre, ne plus suivre | Présent | oui | oui | `A:convex/modules/graph/follows.ts` (`follow`, `unfollow`) |
| 51 | Mes abonnements ; désabonnement possible même en attente | Présent | oui | oui | `A:packages/social-features/src/features/reseau-personnel/PeoplePanel.tsx` (`FollowsSection`) |
| 52 | Nombre de mes abonnés, lu de moi seul | Présent | oui | oui | `follows.ts` (`myFollowerCount`) |
| 53 | Liste de mes abonnés, retirer un abonné | Absent, moteur compris (lot PF-07) | non | non | `follows.ts` (liste refusée à tous) |
| 54 | « Vous suit », « Suivre en retour » | Absent (lot PF-07) | non | non | la vue de relation n'a pas ce fait : `D:packages/diasporale-features/src/data/types.ts` (`RelationView`) |
| 55 | Bloquer depuis la fiche, avec confirmation | Présent | oui | oui | `RelationBar` ; `connections.ts` (`blockPerson`) |
| 56 | Débloquer ; liste de mes blocages | Présent | oui | oui | `A:packages/social-features/src/features/reseau-personnel/BlockedPeopleSection.tsx` ; `A:convex/modules/graph/blocks.ts` |
| 57 | Bloquer depuis le menu d'une publication | Absent (plan 03) | non | oui | `D:packages/diasporale-features/src/components/post-menu.tsx` |
| 58 | Le blocage retire les abonnements dans les deux sens | Absent : décidé le 9/11, pas encore codé (lot PF-01) ; l'écran dit déjà « vos liens tombent » | non | non | `connections.ts` (`blockPair` ne touche pas la table `follows`) |
| 59 | Blocage appliqué de personne à personne : fiche, annuaire, suggestions, parrainage, talents, entraide, mentorat, avis, cloche | Présent | oui | oui | `isBlockedBetween` lu par neuf fichiers de la tranche (hors graine), dont `A:convex/modules/diaspora/directory.ts` et `A:convex/modules/diaspora/mentoring.ts` |
| 60 | Blocage et objets portés par une page (demande de service, adhésion) ou ressource du kit ; la candidature reste à vérifier | Partiel : la conversation attachée écarte déjà le signataire en blocage ; la demande elle-même ne lit pas le blocage | — | partiel | garde de la conversation : `A:convex/modules/contextualMessaging/access.ts` (`liveTeamMember`) ; aucun appel à `isBlockedBetween` dans `A:convex/modules/diaspora/serviceRequests.ts`, `A:convex/modules/diaspora/associations.ts`, `A:convex/modules/diaspora/arrivalKit.ts` |
| 61 | Mettre un auteur en sourdine | Partiel : depuis une publication (plan 03), pas depuis la fiche | partiel | oui | `post-menu.tsx` |
| 62 | Signaler un profil | Absent ici ; le moteur l'a | non | oui | neuf natures `diaspora…`, aucun profil : `D:packages/diasporale-features/src/data/content-reports-port.ts` ; cible `person` : `A:convex/modules/moderation/targets.ts` |
| 63 | Annuaire opt-in à trois niveaux, masqué par défaut, consentement requis | Présent | oui | oui | `D:packages/diasporale-domain/src/directory.ts` ; `setDirectoryVisibility` |
| 64 | Chercher un membre par son nom ou son identifiant exact ; filtre « mon pays » | Présent | oui | oui | `D:apps/diasporale_com/src/screens/members-screen.tsx` ; `directory.ts` de la tranche (`searchMembers`) |
| 65 | Parcourir les membres d'un pays ou d'une ville sans connaître un nom | Absent | non | non | `searchMembers` exige deux caractères ; ni pays ni ville dans l'index : `A:convex/modules/people/tables.ts` (`peopleDirectory`) |
| 66 | Filtres : ville, « disponible pour aider », langue, vérifié | Absent | non | non | motifs : `city`, `helpAvailable` dans les arguments de `searchMembers` |
| 67 | Liste des membres sur le hub du pays | Partiel : un compteur seulement (plan 06) | partiel | partiel | `D:apps/diasporale_com/src/screens/hub-screen.tsx` |
| 68 | Garde contre l'extraction | Partiel : 20 résultats, pas de curseur, 60 candidats lus ; aucune limite de débit en lecture | — | partiel | `directory.ts` de la tranche (`DIRECTORY_SCAN`) |
| 69 | Annuaire réservé aux membres actifs ; le compte en attente n'y entre pas | Présent | oui | oui | `searchMembers` (`minStatus: "declaree"`) |
| 70 | Chaque candidat rejugé à la lecture : niveau, consentement en vigueur, statut, pays, blocage | Présent | — | oui | `directory.ts` de la tranche (`listedMemberFor`) |
| 71 | Le membre reste trouvable dans l'annuaire d'ANTSIA si son profil commun est découvrable | Présent (voulu) ; peu dit à l'écran | oui | oui | `A:convex/modules/people/directory.ts` (`searchPeople`) ; docs/04 de DIASPORALE, § 3 |
| 72 | Six suggestions expliquées, tirées de l'annuaire opt-in | Présent | oui | oui | `D:packages/diasporale-features/src/components/suggestions.tsx` ; `forMe` |
| 73 | Raison « association en commun » | Fermé de fait : elle lit `associationIds`, jamais alimenté | non | partiel | `D:packages/diasporale-domain/src/suggestions.ts` |
| 74 | « Ne plus me proposer », liste des masquées, restauration versionnée | Présent | oui | oui | `D:apps/diasporale_com/src/components/dismissed-suggestions.tsx` |
| 75 | Vivier des suggestions | Partiel : les 120 inscrits les plus récents de tout le réseau, sans tri par pays | — | partiel | `suggestions.ts` de la tranche (`SUGGESTION_POOL`) |
| 76 | Suivre depuis une suggestion ; en voir plus de six | Absent | non | non | `suggestions.tsx` |
| 77 | Mode privé, retrait, republication, confirmations, portée commune expliquée | Présent | oui | oui | `profile-publication-settings.tsx` ; `setMyProfilePrivacy`, `withdrawMyProfile` |
| 78 | Partager un profil : lien, partage natif | Absent ; le modèle existe pour les pages | non | — | `D:apps/diasporale_com/src/components/page-share-button.tsx` |
| 79 | Code QR du profil | Absent ; le générateur sert déjà aux billets | non | — | `A:packages/social-features/src/features/qr/OpaqueQrCode.tsx` |
| 80 | Démonstration : fiche, relation, blocage, annuaire, suggestions, facette, publication du profil | Présent ; listes de relations, images et albums fermés | oui | — | `D:packages/diasporale-features/src/demo/source.ts` |

Décompte : **Présent 33 · Partiel 11 · Absent 33 · Fermé 3**.

### Ce que le moteur sait déjà faire et que DIASPORALE ne montre pas

Sept gains rapides, sans écrire de serveur : changer d'identifiant (5) ; joindre un mot à une demande (39) ; chercher dans ses relations (44) ; épingler sur son mur (32) ; signaler un profil (62) ; montrer la vraie photo dans les listes (30) ; code QR (79). Deux autres arrivent par les surfaces partagées dès que le moteur les livre : supprimer un album ou une photo (PF-11), signaler un album (PF-02).

### Ce qui est écrit mais jamais recetté en réel

| Sujet | État connu | Source |
|---|---|---|
| Relations, demandes, annulation, blocage et déblocage | Joués dans Chrome sur backend local, comptes fictifs, 16 et 17/10 | docs/06 et docs/07 de DIASPORALE |
| Mode privé, retrait, republication, identité | Joués dans Chrome en local le 17/10 ; départ réel non joué | docs/09 et docs/10 de DIASPORALE |
| Annuaire vu par deux membres de pays différents | Jamais joué : « aucune recette Chrome croisée des annuaires » ; tests seulement | docs/09 de DIASPORALE |
| Suggestions : « même ville », « relations en commun » | Masquage et restauration joués ; les raisons, jamais à plusieurs comptes | docs/08 de DIASPORALE |
| Photo et couverture | Dépôt et lecture locaux le 16/10 ; relecture du retrait de couverture interrompue ; antivirus réel jamais prouvé sur une image de profil | docs/04 de DIASPORALE ; plan 05 d'ANTSIA |
| Albums | Recette locale entre comptes le 16/10 | docs/04 de DIASPORALE |
| Tout ce périmètre, en ligne ou à deux vraies identités | Jamais | plan 15 d'ANTSIA, § 2 |

## 3. Comparaison avec les applications de référence

| Capacité | LinkedIn | Facebook | Instagram | InterNations | Bumble BFF | DIASPORALE | Verdict |
|---|---|---|---|---|---|---|---|
| Nom, accroche, photo, couverture | Oui | Oui | Oui, sans couverture | Oui | Photos | Oui | Déjà fait |
| Recadrer sa photo | Oui | Oui | Oui | ? | Oui | Non | À faire (RP-01) |
| Photos envoyées sans position GPS | Oui ? | Oui ? | Oui ? | ? | ? | Non | À faire, P0 (RP-01) |
| Changer d'identifiant ou d'adresse | Oui | Oui | Oui | ? | — | Non, moteur prêt | À faire (RP-13) |
| Badge de vérification | Oui, gratuit | Payant | Payant | Admission contrôlée | Oui, par photo | Calculé, jamais payant | Déjà fait ; à expliquer (RP-11) |
| Visibilité champ par champ | Part. | Oui | Non | Part. ? | Non | Quatre niveaux, dont « mon pays » | Déjà fait, différenciant |
| Langues parlées | Oui | Oui | Non | Oui ? | Oui ? | Non | À faire (RP-12) |
| Métier, parcours, formation | Oui | Oui | Non | Oui | Oui | Profil de talent à part | À adapter : relier (RP-12) ; le reste au plan 10 |
| Centres d'intérêt | Oui | Oui | Non | Oui | Oui | Non | Reporté (RP-20, après PF-09) |
| Ville ou pays d'origine | Non ? | Oui | Non | Oui | Non | Non | Reporté (RP-19, juriste) |
| Présence temporaire dans un autre lieu | Non | Non | Non | ? | Mode voyage ? | Non | À faire après décision (RP-17) |
| Organisations de la personne sur sa fiche | Oui | Oui | Non | Oui | Non | Non | À faire (RP-05) |
| Disponibilité déclarée (« ouvert à… ») | Oui | Non | Non | ? | Non | Champ sans interrupteur | À faire (RP-05) |
| Voir son profil comme un autre | Oui | Oui | Non | ? | Non | Un seul point de vue | À adapter (RP-14) |
| Publication épinglée | Oui | Oui | Oui | Non | — | Lue, sans geste | À faire (RP-15) |
| Onglet des médias | Oui | Oui | Oui | Part. | — | Albums seulement | À faire après PF-14 (RP-15) |
| Albums photo | Non | Oui | Non | Oui ? | Non | Oui | Déjà fait ; suppression à brancher (RP-16) |
| Relation symétrique | Oui | Oui | Non | Oui | Oui | Oui | Déjà fait |
| Mot joint à la demande | Oui | Non | — | Oui ? | — | Non, moteur prêt | À faire (RP-06) |
| Annuler une demande envoyée | Oui | Oui | Oui | ? | — | Depuis la liste, pas la fiche | À adapter (RP-06) |
| Rompre une relation | Oui | Oui | — | Oui ? | Oui | Non | À faire après PF-05 (RP-07) |
| Suivre sans être relié | Oui | Oui | Oui | Non ? | Non | Oui | Déjà fait |
| Voir ses abonnés, suivre en retour, en retirer un | Oui | Oui | Oui | — | — | Nombre seulement | À faire après PF-07 (RP-07) |
| Relations en commun | Oui | Oui | Oui | Oui ? | Non | Dans les suggestions | À faire après PF-10 (RP-07) |
| Bloquer, liste des bloqués | Oui | Oui | Oui | Oui | Oui | Oui | Déjà fait ; abonnements à retirer (RP-03) |
| Signaler un profil | Oui | Oui | Oui | Oui | Oui | Non | À faire, P0 (RP-02) |
| Sourdine | Oui | Oui | Oui | ? | — | Depuis une publication | Déjà fait ; depuis la fiche (RP-02) |
| Annuaire de membres | Recherche ouverte | Recherche ouverte | Recherche ouverte | Par communauté locale | Profils proposés | Opt-in, masqué par défaut | Déjà fait, plus protecteur |
| Parcourir par ville ou pays | Oui | Part. | Non | Oui | Par distance | Non | À faire (RP-04) |
| Filtres (langue, secteur, disponibilité) | Oui | Part. | Non | Oui | Oui | Pays seulement | À faire par étapes (RP-04, RP-12) |
| Suggestions expliquées | Oui | Oui | Part. | Oui ? | Oui | Oui | Déjà fait ; vivier à revoir (RP-09) |
| Masquer une suggestion, la retrouver | Part. | Part. | Part. | ? | Non | Oui, restaurable | Déjà fait, différenciant |
| Lien et code QR du profil | Oui | Oui | Oui | ? | Non | Non | À faire (RP-08) |
| Import du carnet de contacts | Oui | Oui | Oui | ? | Non | Non | Écarté (données de tiers ; PF-18 du moteur, juriste) |
| Compteurs publics de relations ou d'abonnés | Oui | Oui | Oui | Non ? | Non | Non | Écarté sur la fiche d'autrui (décision en vigueur) ; à soi seul (RP-07) |
| « Qui a vu mon profil » | Oui, en partie payant | Non | Non | Oui ? | Non | Non | Écarté (aucune mesure d'audience personnelle) |
| Profil lisible sans compte | Oui | Part. | Oui | Aperçu | Non | Non | Écarté (réseau fermé) |
| Compte privé à demandes d'abonnement | Non | Part. | Oui | — | — | Mode privé « hors découverte » | Écarté (la connexion est l'audience privée, plan 05 d'ANTSIA, D11) |
| Payer pour chercher ou écrire | Oui | Non | Non | Oui ? | Oui | Non | Écarté (le citoyen ne paie jamais) |

## 4. Ce qui manque

### 4.1 Bloquant avant l'ouverture du pilote

1. **La photo et la couverture partent telles quelles**, avec leurs métadonnées, donc souvent la position GPS du domicile. Elles sont vues de tout le réseau. Les albums, eux, ré-encodent (ligne 27).
2. **Un profil ne peut pas être signalé** depuis DIASPORALE, alors que le moteur accepte la cible (ligne 62). Un réseau qui ouvre à de vraies personnes doit offrir ce geste.
3. **Le blocage promet plus qu'il ne fait** : l'écran dit « vos liens tombent », les abonnements restent tant que PF-01 n'est pas livré (ligne 58). Et un membre bloqué peut encore déposer une demande, avec son texte libre, auprès de la page que tient seule la personne qui l'a bloqué : le moteur ferme la conversation, pas la demande (ligne 60 ; scénario R-G13 du plan global).
4. **Aucune recette à plusieurs comptes** de l'annuaire par niveau et du blocage (R-G13, R-G14), ni en local ni en ligne.

### 4.2 Fonctions attendues qui manquent

- Parcourir les membres de son pays et de sa ville : c'est le cas d'usage fondateur de la fiche F11, et il n'est pas servi (ligne 65).
- Rendre vrais deux champs déjà stockés : « disponible pour aider » et les associations (lignes 20, 21, 73).
- Rompre une relation ; voir ses abonnés ; suivre en retour ; relations en commun (lignes 47, 48, 53, 54).
- Partager un profil par lien et par code QR (lignes 78, 79).
- Dire ses langues ; relier la fiche au profil de talent et de mentor (lignes 11, 22).
- Changer d'identifiant (ligne 5).

### 4.3 Options qui manquent sur ce qui existe

- Demande de connexion : un mot d'accompagnement ; un chemin d'annulation depuis la fiche (lignes 39, 42).
- Mes relations : une recherche ; « Écrire » et « Appeler » sur chaque ligne (lignes 44, 45).
- Annuaire : filtres ville, entraide, langue ; vraie photo dans les résultats (lignes 30, 66).
- Facette : régler la visibilité des associations et de l'entraide (ligne 18).
- Aperçu : trois points de vue au lieu d'un (ligne 12).
- Suggestions : « Suivre », « En voir d'autres » (ligne 76).
- Fiche d'autrui : sourdine, copie du lien, signalement dans un même menu (lignes 61, 62, 78).
- Mur : épingler ; albums : supprimer, retirer une photo, signaler (lignes 32, 35, 36).

### 4.4 Améliorations de l'existant

- **Barre de relation** : jusqu'à cinq boutons côte à côte (Se connecter, Suivre, Bloquer, Écrire, Appeler). Ranger Bloquer, Signaler, Sourdine et Copier le lien dans un menu « … » ; garder un seul bouton plein.
- **Badges** : l'explication doit s'ouvrir au toucher et au clavier, pas seulement au survol (ligne 9).
- **Onglet « Photos »** : il montre des albums. Le nommer pour ce qu'il est tant que les médias des publications n'ont pas leur source (ligne 33).
- **Vivier des suggestions** : tiré par pays d'abord, pour qu'un membre du Canada ne dépende pas des 120 derniers inscrits de France (ligne 75).
- **Poste de rattachement** : résoudre son nom par la page « Officiel » du poste quand elle existera (ligne 19 ; plan 15).
- **Écran de l'annuaire** : dire en une phrase que le profil commun reste trouvable dans ANTSIA, avec le lien vers le mode privé (ligne 71).
- **Coordonnées** : refuser un numéro, une adresse ou un lien dans l'accroche et la ville (lignes 7, 16).
- **Commentaire faux** : `RelationBar` écrit que bloquer « défait les abonnements » ; c'est faux tant que PF-01 n'est pas livré.

### 4.5 Ce qui distingue DIASPORALE

- **La visibilité champ par champ à quatre niveaux**, dont « les membres de mon pays » : aucune référence n'a ce niveau. À garder et à étendre à chaque champ nouveau.
- **Un annuaire à double accord** (niveau choisi et consentement en vigueur), rejugé à chaque lecture ; retirer le consentement suffit à disparaître aussitôt.
- **Des suggestions honnêtes** : la raison affichée ne repose que sur ce que le lecteur a le droit de voir. Une ville réservée aux relations ne fait pas une « même ville » pour un inconnu.
- **Le refus indistinct** partout : bloqué, masqué, privé ou inconnu rendent la même réponse.
- **Des choix privés que l'on retrouve** : blocages, demandes envoyées, suggestions masquées, chacun avec sa liste et son retrait versionné.
- **La confiance calculée et gratuite**, et le contact sans coordonnée.

### 4.6 Écarté ou reporté, et pourquoi

| Sujet | Décision | Raison |
|---|---|---|
| Ethnie, religion, situation familiale, date de naissance, sexe | Jamais | Données sensibles ou sans utilité ; minimisation ; D-G11 pour l'âge |
| Ville ou province d'origine au Gabon | Reporté (RP-19) | Peut révéler une origine ; avis du juriste avant toute ligne de code |
| Profil lisible sans compte | Écarté | Réseau fermé ; le profil commun a déjà sa fiche publique côté ANTSIA |
| Compteurs sur la fiche d'autrui, « qui a vu mon profil » | Écarté | Décision en vigueur ; aucun chiffre sans mesure |
| Import du carnet de contacts | Écarté | Données de tiers non consentants ; suit PF-18 du moteur |
| Plusieurs comptes, compte privé à demandes d'abonnement | Écarté | Une personne, un identifiant ; la connexion est l'audience privée |
| Établissement, promotion | Reporté | Texte libre à modérer ; un groupe thématique d'anciens sert mieux ce besoin (plan 07) |
| Centres d'intérêt, identification sur les photos, amis proches, statuts à la une | Reporté (RP-20) | Le moteur les construit d'abord (PF-09, PF-15 à PF-17) |
| Présentation propre à DIASPORALE | Écarté pour l'instant | Une personne, un profil ; à rouvrir si les membres le demandent |

## 5. Lots d'implémentation

### RP-01 — Photo et couverture nettoyées et recadrées · P0 · M · S2
- **Pour l'utilisateur** : je choisis une image, je la recadre (cercle pour la photo, bandeau pour la couverture), je vois l'aperçu ; ce qui part n'a plus ni position ni modèle d'appareil.
- **Backend** : aucun. La garde des fichiers et l'antivirus du moteur restent l'autorité.
- **Web** : l'éditeur d'images et son adaptateur moteur appellent la brique commune « préparer une image » du lot SD-02 (ré-encodage systématique, plus grand côté à 2 048 px, décision du 9/11) et le recadreur de PF-03 s'il est exporté ; sinon un recadreur local au clavier et à la souris. Un ré-encodage impossible refuse le fichier, jamais l'original. Textes fr et en dans un fragment `profile-images`.
- **Mobile** : après le web (plan 16).
- **Données personnelles** : moins de données envoyées ; rien de neuf à exporter.
- **Tests et cliquets** : tests du cadrage et du refus ; `upload-policy`, `fresh-upload`.
- **Critères d'acceptation** : une image porteuse de coordonnées GPS ressort sans métadonnées sur le fichier stocké en local ; le recadrage est fidèle à l'aperçu ; la démonstration reste sans faux dépôt.
- **Dépend de** : SD-02 (brique commune), PF-03.
- **Porte** : aucune.

### RP-02 — Signaler un profil, et menu « … » de la fiche · P0 · S · S2
- **Pour l'utilisateur** : sur la fiche d'autrui, un menu « … » : Signaler ce profil, Bloquer, Mettre en sourdine, Copier le lien. Un seul bouton plein reste visible.
- **Backend** : aucun ; `moderation.cases.report` accepte la cible `person`, avec rejeu, délais légaux et accusé de réception.
- **Web** : nature `person` ajoutée au contrat des natures signalables, à l'adaptateur moteur et au fournisseur de démonstration ; nouveau composant de menu dans l'application ; le bouton se fige une fois le signalement fait ; impossible de signaler sa propre fiche. Fragment de textes `content-reports`.
- **Mobile** : après le web.
- **Données personnelles** : le signalement suit l'inventaire de la modération ; il paraît dans « Mes signalements » (plan 13).
- **Tests et cliquets** : nature inconnue refusée avant tout appel ; second signalement sans doublon ; `i18n-locales`.
- **Critères d'acceptation** : à deux comptes, le dossier s'ouvre et son accusé arrive ; le plan 14 confirme quelle file le reçoit (le profil est commun : le moteur l'attache au réseau racine).
- **Dépend de** : plan 14 (natures et file), MC-01 et PF-02 du moteur pour l'album.
- **Porte** : aucune.

### RP-03 — Blocage : abonnements, textes et pages · P0 · M · S2
- **Pour l'utilisateur** : bloquer fait ce que l'écran dit, partout ; la personne bloquée ne me rejoint plus par la page que je tiens.
- **Backend** : après PF-01 (S1), rien pour les abonnements. La conversation attachée à un objet est déjà gardée par le moteur. Dans la tranche : une demande de service, une adhésion ou une candidature vers une page dont **tous** les signataires vivants ont bloqué l'auteur reçoit le refus indistinct. Règle écrite dans une matrice avant le code (décision 5).
- **Web** : texte de confirmation aligné sur l'effet réel ; commentaire de `RelationBar` corrigé ; tests de l'adaptateur mis à jour.
- **Mobile** : sans objet.
- **Données personnelles** : `personBlocks` déjà exporté (intentions émises) et effacé.
- **Tests et cliquets** : un test par surface de la matrice ; `network-scoped-functions`.
- **Critères d'acceptation** : R-G13 et R-G14 joués à deux comptes ; après blocage, plus d'abonnement dans aucun sens ; aucune notification ; débloquer ne recrée rien.
- **Dépend de** : PF-01 ; plans 07, 09, 10 pour les surfaces touchées.
- **Porte** : décision 5.

### RP-04 — Annuaire navigable par pays et par ville · P1 · L · S2
- **Pour l'utilisateur** : sans connaître de nom, je vois les membres de mon pays qui ont choisi d'apparaître, je filtre par ville et par « disponible pour aider ».
- **Backend** : dans la tranche, une table d'index (pays, clé de ville, niveau, entraide, date) tenue par les écritures de la facette, du niveau et du consentement ; la ville n'y entre que si sa visibilité vaut « mon pays » ou « tout le réseau ». Nouvelle lecture paginée, 20 par page, profondeur bornée, réservée aux membres actifs ; chaque candidat repasse `listedMemberFor`. Aucun décompte par ville. Issue [S1] : classer la table dans l'inventaire d'export et d'effacement.
- **Web** : écran Membres : liste du pays par défaut, champ de ville saisi sans GPS, interrupteur d'entraide, états vides honnêtes ; lien depuis le hub (plan 06). Démonstration servie. Fragment `member-directory`.
- **Mobile** : après le web.
- **Données personnelles** : projection dérivée, effacée avec la personne ; exportée ; retirer le consentement vide l'index dans la même transaction.
- **Tests et cliquets** : masqué introuvable ; niveau « mon pays » invisible d'un autre pays ; ville réservée aux relations absente du filtre ; `no-unbounded-collect`.
- **Critères d'acceptation** : « membres en France, à Nantes » rend les seuls consentants ; au-delà de la profondeur, l'écran invite à affiner ; aucun chiffre affiché sous un seuil.
- **Dépend de** : RP-05 pour le filtre d'entraide.
- **Porte** : décision 3.

### RP-05 — Entraide, associations et pages sur la fiche · P1 · M · S2
- **Pour l'utilisateur** : j'active « disponible pour aider » ; je choisis, une par une, les associations et les pages que ma fiche montre ; on voit le poste dont je relève quand sa page existe.
- **Backend** : la tranche lit les adhésions acceptées et les rôles vivants de signataire ; un choix d'affichage par adhésion, décoché par défaut ; le niveau du champ « Associations » fixe qui voit la liste. Le champ saisi `associationIds` cesse d'être la source. La raison « association en commun » ne compte que ce que les deux ont choisi de montrer.
- **Web** : interrupteur et visibilité de l'entraide dans « Ma facette » ; choix d'affichage dans « Mes associations » ; rubrique sur la fiche ; nom du poste résolu par sa page.
- **Mobile** : après le web.
- **Données personnelles** : appartenir à une association peut révéler une conviction : rien n'est montré sans geste ; export et effacement des choix.
- **Tests et cliquets** : adhésion non choisie jamais projetée ; adhésion retirée disparaît aussitôt.
- **Critères d'acceptation** : à deux comptes, l'association choisie paraît selon le niveau, l'autre non ; « disponible pour aider » paraît sur la fiche et sert de filtre.
- **Dépend de** : plan 07 (adhésions), plan 11 (sens de l'entraide), plan 15 (page du poste).
- **Porte** : décisions 1 et 2.

### RP-06 — Gestes de relation déjà prêts au moteur · P1 · M · S2
- **Pour l'utilisateur** : un mot avec ma demande ; depuis « Demande envoyée », j'arrive à la liste où l'annuler ; je cherche dans mes relations ; j'écris ou j'appelle depuis la liste.
- **Backend** : aucun (`requestConnection` avec `message`, `searchMine`). Annulation directe depuis la fiche : issue [S1] pour ajouter la version de la demande à `connectionWith`.
- **Web** : feuille de demande avec mot facultatif ; « Demande envoyée » devient un lien ; champ de recherche ; « Écrire » et « Appeler » en variante tonale (décision du 9/11) par iCom.
- **Mobile** : après le web.
- **Données personnelles** : le mot entre dans l'export des connexions.
- **Tests et cliquets** : mot trop long refusé ; double clic sans double demande.
- **Critères d'acceptation** : le destinataire lit le mot dans ses demandes reçues ; la recherche ne lit que mes relations.
- **Dépend de** : plan 04 pour iCom.
- **Porte** : aucune.

### RP-07 — Rompre, mes abonnés, suivre en retour, relations en commun · P1 · M · S2
- **Pour l'utilisateur** : « Retirer de mes relations » ; un onglet « Abonnés » vu de moi seul ; « Suivre en retour » ; « 3 relations en commun » sur une fiche.
- **Backend** : aucun dans la tranche ; branche les lots PF-05, PF-07 et PF-10 du moteur.
- **Web** : menu sur « En relation » ; septième onglet de Mes relations ; ligne et liste des relations en commun ; mes décomptes sur ma seule fiche.
- **Mobile** : après le web.
- **Données personnelles** : aucune nouvelle ; la liste d'abonnés n'est jamais lue par un tiers.
- **Tests et cliquets** : un tiers ne lit ni liste ni décompte ; lecture tronquée dite « au moins ».
- **Critères d'acceptation** : après rupture, une publication réservée aux relations n'est plus lue ; aucune notification.
- **Dépend de** : PF-05, PF-07, PF-10 et leurs décisions D2 à D4.
- **Porte** : celles de ces lots.

### RP-08 — Partager un profil : lien, partage natif, code QR · P1 · S · S2
- **Pour l'utilisateur** : « Partager mon profil » : copier le lien, feuille de partage du téléphone, code QR plein écran.
- **Backend** : aucun.
- **Web** : reprise du bouton de partage des pages et du générateur de codes QR ; l'origine vient de l'environnement ; rien n'est proposé pour un profil privé ou retiré. Le texte dit que le lien ne s'ouvre que pour un membre.
- **Mobile** : après le web.
- **Données personnelles** : aucune.
- **Tests et cliquets** : `no-hardcoded-urls`.
- **Critères d'acceptation** : le code scanné ouvre la fiche pour un membre, la porte d'entrée pour un autre.
- **Dépend de** : plan 01 si un lien de parrainage voit le jour (un seul code, pas deux).
- **Porte** : aucune.

### RP-09 — Suggestions à l'échelle · P1 · M · S2
- **Pour l'utilisateur** : des suggestions de mon pays d'abord ; « Suivre » sans se connecter ; « En voir d'autres ».
- **Backend** : vivier tiré de l'index de RP-04 (pays du lecteur, puis réseau) ; raisons inchangées, plus l'association en commun de RP-05 ; aucune donnée de comportement (D-G05).
- **Web** : bouton « Suivre » en variante neutre ; lien vers l'annuaire filtré.
- **Mobile** : après le web.
- **Données personnelles** : rien de stocké.
- **Tests et cliquets** : graphe connu, ordre attendu ; masqué jamais reproposé.
- **Critères d'acceptation** : un membre d'un pays peu peuplé reçoit d'abord ses compatriotes ; aucune raison sans donnée réelle.
- **Dépend de** : RP-04, RP-05.
- **Porte** : aucune.

### RP-10 — Aucune coordonnée dans l'accroche, le nom et la ville · P1 · S · S2
- **Pour l'utilisateur** : si je tape un numéro ou une adresse, l'écran me dit d'écrire par la messagerie.
- **Backend** : la règle du domaine refuse les coordonnées dans la ville (tranche). Accroche et nom : issue [S1], le profil étant commun.
- **Web** : même règle dans les formulaires d'accueil et de réglages.
- **Mobile** : après le web.
- **Données personnelles** : aucune.
- **Tests et cliquets** : cas du numéro, de l'adresse, du lien, du nom de domaine.
- **Critères d'acceptation** : refus à l'écran et au serveur pour la ville ; décision écrite pour l'accroche.
- **Dépend de** : décision 4.
- **Porte** : décision 4.

### RP-11 — Une fiche plus claire · P1 · S · S2
- **Pour l'utilisateur** : je touche un badge, il s'explique ; je vois les vraies photos dans l'annuaire ; l'onglet dit ce qu'il contient.
- **Backend** : aucun (`avatarUrl` est déjà rendu).
- **Web** : explication des badges au toucher et au clavier ; photo délivrée dans l'annuaire, les suggestions et les relations, retenue respectée ; onglet « Photos » renommé ; phrase sur l'annuaire d'ANTSIA.
- **Mobile** : après le web.
- **Données personnelles** : aucune.
- **Tests et cliquets** : une image retenue n'entre jamais dans la page.
- **Critères d'acceptation** : contrôle à 390 et 1280 px, clavier et lecteur d'écran.
- **Dépend de** : plan 02 pour la charte.
- **Porte** : aucune.

### RP-12 — Langues, et lien vers le profil de talent et de mentor · P2 · M · S2
- **Pour l'utilisateur** : je dis mes langues ; ma fiche mène à mon profil de talent ou de mentor si je les ai rendus visibles.
- **Backend** : champ de facette `languages`, liste fermée des codes déjà employés par les services, cinq au plus, visible de mes relations par défaut ; niveau optionnel ajouté à `memberPrivacy`. Le schéma de facette du réseau doit être mis à jour par la console avant la première écriture.
- **Web** : saisie et visibilité ; deux cartes sur la fiche, lues par les gardes existantes.
- **Mobile** : après le web.
- **Données personnelles** : export et effacement ; une langue peut suggérer une origine : question au juriste avant d'allonger la liste.
- **Tests et cliquets** : code inconnu refusé ; profil de talent « non listé » jamais montré.
- **Critères d'acceptation** : un champ masqué n'apparaît dans aucune projection.
- **Dépend de** : plans 10 et 11.
- **Porte** : geste d'opérateur sur le schéma du réseau ; décision 7.

### RP-13 — Changer d'identifiant · P2 · S · S2
- **Pour l'utilisateur** : je change mon identifiant ; l'ancien me reste réservé.
- **Backend** : `publishMyProfile` existe, mais il republie un profil retiré : le geste n'est offert qu'à un profil publié.
- **Web** : champ avec contrôle de disponibilité en direct et confirmation : les anciens liens ne mènent plus à la fiche.
- **Mobile** : après le web.
- **Données personnelles** : historique des identifiants déjà inventorié.
- **Tests et cliquets** : identifiant pris refusé ; profil retiré : geste absent.
- **Critères d'acceptation** : la fiche répond à la nouvelle adresse ; l'ancienne rend le refus indistinct.
- **Dépend de** : rien.
- **Porte** : décision 10.

### RP-14 — Aperçu selon trois lecteurs · P2 · M · S2
- **Pour l'utilisateur** : je me vois comme une relation, comme un membre de mon pays, comme un membre d'un autre pays ; l'écran dit si l'annuaire me montre à ce lecteur.
- **Backend** : `memberFacet` rend trois projections à la personne elle-même, par la règle pure du domaine.
- **Web** : sélecteur de point de vue ; limite rappelée pour les publications.
- **Mobile** : après le web.
- **Données personnelles** : aucune.
- **Tests et cliquets** : jamais rendu à un tiers.
- **Critères d'acceptation** : les trois vues concordent avec ce que voient trois comptes réels.
- **Dépend de** : rien.
- **Porte** : aucune.

### RP-15 — Mur : épingler, puis onglet des médias · P2 · M · S2
- **Pour l'utilisateur** : j'épingle une publication en tête de mon mur ; plus tard, la grille de mes photos et vidéos.
- **Backend** : aucun pour l'épingle ; `posts.personMedia` attend PF-14.
- **Web** : entrée dans le menu de publication (composant du plan 03) ; onglet rendu seulement si sa source existe.
- **Mobile** : après le web.
- **Données personnelles** : aucune.
- **Tests et cliquets** : une seule épingle ; une publication réservée aux relations jamais servie à un abonné.
- **Critères d'acceptation** : l'épingle tient au rechargement.
- **Dépend de** : plan 03 ; PF-14.
- **Porte** : aucune.

### RP-16 — Albums : supprimer, retirer une photo, signaler · P2 · S · S2
- **Pour l'utilisateur** : je supprime un album ou une photo ; je signale l'album d'un autre.
- **Backend** : aucun.
- **Web** : la galerie partagée gagne ces gestes avec PF-11 et PF-02 ; ici, tests de montage, textes et recette dans DIASPORALE.
- **Mobile** : après le web.
- **Données personnelles** : fichiers purgés par le moteur.
- **Tests et cliquets** : propriétaire seul ; `file-delivery-gate`.
- **Critères d'acceptation** : un album supprimé disparaît des listes et ses fichiers ne sont plus servis.
- **Dépend de** : PF-11, PF-02.
- **Porte** : aucune.

### RP-17 — « De passage au Gabon » · P2 · M · S2
- **Pour l'utilisateur** : j'indique un séjour au pays, au mois près ; mes relations le voient et savent que l'on peut s'y retrouver.
- **Backend** : deux champs de facette (mois de début, mois de fin), visibles au plus de mes relations, expirés à la lecture ; jamais dans l'annuaire ni les suggestions.
- **Web** : saisie dans « Ma facette » ; mention sur la fiche ; filtre dans Mes relations.
- **Mobile** : après le web.
- **Données personnelles** : dire son absence a un risque : niveau plafonné aux relations, rappel à l'écran ; export, effacement.
- **Tests et cliquets** : niveau « réseau » refusé ; séjour passé jamais projeté.
- **Critères d'acceptation** : un non-relié ne voit rien.
- **Dépend de** : RP-12 pour le schéma de facette.
- **Porte** : décision 8.

### RP-18 — Annuaire : extraction mesurée, puis freinée · P2 · M · S2
- **Pour l'utilisateur** : rien de visible, sauf pour qui aspire l'annuaire.
- **Backend** : compter les recherches par personne et par jour dans la mesure du pilote, sans leur contenu ; si l'abus se voit, ouvrir chaque série de recherches par une écriture qui consomme un seau de débit. Issue [S1] pour le seau.
- **Web** : message « trop de recherches, réessayez plus tard ».
- **Mobile** : sans objet.
- **Données personnelles** : compteur agrégé, sans terme recherché.
- **Tests et cliquets** : au-delà du seuil, la lecture refuse ; `rate-limited-writes`.
- **Critères d'acceptation** : un parcours par préfixes de deux lettres s'arrête au seuil.
- **Dépend de** : plan 17 (mesure du pilote).
- **Porte** : décision 3.

### RP-19 — Attache au Gabon · P3 · S · S2
- **Pour l'utilisateur** : dire, si je le veux, la ville du Gabon à laquelle je suis attaché.
- **Contenu** : champ masqué par défaut, jamais un critère de recherche ni de suggestion ; aucune mention d'ethnie, jamais.
- **Dépend de** : RP-12.
- **Porte** : avis écrit du juriste sur les données révélant une origine ; décision 9.

### RP-20 — Suites du moteur : centres d'intérêt, identification, amis proches, statuts à la une · P3 · M · S2
- **Pour l'utilisateur** : retrouver dans DIASPORALE ce que le moteur ouvre dans ANTSIA.
- **Contenu** : brancher chaque capacité dans la fiche et la facette, avec la visibilité par champ et la démonstration.
- **Dépend de** : PF-09, PF-15, PF-16, PF-17.
- **Porte** : décisions de ces lots.

## 6. Ordre recommandé et dépendances

| Vague | Lots | Pourquoi dans cet ordre |
|---|---|---|
| 1 | RP-01, RP-02, RP-03 | Vie privée et protection avant d'ouvrir ; ils suivent de près SD-02 et PF-01 du moteur |
| 2 | RP-05, RP-04, RP-06, RP-08, RP-10, RP-11 | Le cœur de valeur : se trouver par ville, se présenter, se relier ; aucun n'attend le moteur |
| 3 | RP-07, RP-09 | Attendent PF-05, PF-07, PF-10 et l'index de RP-04 |
| 4 | RP-12 à RP-18 | Enrichissements, après les premiers retours du pilote |
| 5 | RP-19, RP-20 | Sous condition : juriste, lots du moteur |

**Ce que ce plan attend des autres plans.** Moteur : SD-02 (image préparée), PF-01, PF-02, PF-03, PF-05, PF-07, PF-10, PF-11, PF-14, MC-01. DIASPORALE : plan 01 (changement de pays, lien de parrainage), plan 02 (menu, charte), plan 03 (menu de publication, recherche transversale), plan 04 (Écrire, Appeler), plan 06 (lien du hub vers les membres), plan 07 (adhésions), plans 10 et 11 (talent, mentor, sens de l'entraide), plan 13 (« Mes données », « Mes signalements »), plan 14 (natures et file), plan 15 (page du poste), plan 16 (mobile). Avis de cloche employés : `connection_request`, `connection_accepted`, `new_follower`, déjà en place ; aucun avis pour un blocage, une rupture ou un abonné retiré.

**Volet de recette en mode moteur (campagne DS-05).** Comptes de démonstration : `verifie`, `declare`, `belgique`, `canada`, `leger`, `bloque`, `suspendu`, `exterieur`.

| Étape | Geste | Résultat attendu |
|---|---|---|
| 1 | `declare` choisit le niveau « mon pays » ; `belgique` puis `verifie` le cherchent | Introuvable pour `belgique`, trouvé par `verifie` ; au niveau « tout le réseau », trouvé par les deux ; consentement retiré : introuvable pour tous (R-G14) |
| 2 | `declare` réserve sa ville à ses relations ; `verifie` ouvre sa fiche avant puis après la connexion | Ville absente, puis présente ; l'aperçu de `declare` concorde |
| 3 | `canada` demande une connexion à `declare`, l'annule, la renvoie ; `declare` accepte | Une seule ligne ; cloche résolue ; « En relation » des deux côtés |
| 4 | `verifie` et `bloque` (blocage posé) | Fiche indisponible des deux côtés ; absents l'un pour l'autre de l'annuaire, des suggestions et du fil ; débloquer ne recrée ni lien ni abonnement (R-G13) |
| 5 | `leger`, en attente, ouvre une fiche et ses listes | Lecture ; ni Suivre ni Se connecter ; désabonnement et déblocage possibles ; annuaire fermé |
| 6 | Un compte passe en privé, retire puis republie son profil | Lien connu encore lisible en privé ; fiche indisponible une fois retirée ; choix conservés à la republication |
| 7 | `exterieur`, non-membre, ouvre `/@identifiant` | Aucune fiche : renvoi à l'accueil |
| 8 | `suspendu` ouvre une fiche | Refus dit tel quel, sans « Réessayer » |

## 7. Décisions à prendre par le propriétaire

1. **Associations sur la fiche : d'où viennent-elles ?** Recommandation : des adhésions acceptées et des pages réellement gérées, montrées une par une sur un geste, plutôt que d'un champ saisi à la main. Raison : une source vraie, et rien de montré sans accord.
2. **« Disponible pour aider ».** Recommandation : garder l'interrupteur simple de la facette (EXF-DG-37), distinct du profil de mentor. Raison : un geste léger pour accueillir, sans engagement.
3. **Parcourir l'annuaire.** Recommandation : oui, pour les membres actifs, par pays puis par ville, profondeur bornée, sans décompte par ville ; freiner par un seau de débit seulement si la mesure du pilote montre un abus. Raison : c'est le cas d'usage de la fiche F11.
4. **Coordonnées dans l'accroche.** Recommandation : les refuser dans DIASPORALE comme dans ANTSIA. Raison : invariant « le contact passe par la messagerie ». La décision vaut pour les deux réseaux, le profil étant commun.
5. **Blocage et pages.** Recommandation : refuser de façon indistincte la demande d'une personne vers une page dont tous les signataires vivants l'ont bloquée ; laisser lisible une ressource du kit. Raison : fermer le dernier chemin de harcèlement sans donner à un seul signataire le pouvoir de fermer une page collective.
6. **« Membre depuis ».** Recommandation : l'année seulement, visible des membres actifs ; jamais le parrain. Raison : repère de confiance sans donnée fine.
7. **Langues.** Recommandation : la liste fermée existante ; question au juriste avant d'y ajouter d'autres langues du Gabon.
8. **« De passage au Gabon ».** Recommandation : oui, en vague 4, au mois près, pour les seules relations. Raison : usage réel des vacances au pays, risque contenu.
9. **Attache au Gabon.** Recommandation : ne rien coder avant l'avis du juriste.
10. **Changer d'identifiant.** Recommandation : oui, sans redirection de l'ancien. Raison : le moteur le sait déjà ; une redirection révélerait le lien entre les deux.
11. **Signalement d'un profil.** Le moteur l'attache au réseau racine. Recommandation : le laisser à la racine et donner au bureau de DIASPORALE la lecture des dossiers ouverts depuis DIASPORALE ; à trancher avec le plan 14.
12. **D2 à D4 du plan 05 d'ANTSIA** (abonnés vus de soi seul, décomptes à soi, conversation après une rupture) : recommandation de reprendre ici les mêmes réponses.

## 8. Risques et points d'attention

- **Profil commun** : identité, images, mode privé et retrait valent aussi dans ANTSIA. Chaque écran le dit ; chaque lot le teste dans les deux sens.
- **Zone d'écriture** : les modules `people`, `graph`, `albums` et les surfaces partagées appartiennent à S1. Ce plan n'écrit que dans le dépôt DIASPORALE et la tranche diaspora ; le reste passe par une issue [S1].
- **Surfaces partagées** : `AlbumPage`, `FollowsSection`, `BlockedPeopleSection` changeront avec les lots PF. Reprendre les tests de montage et republier la démonstration après une publication du moteur.
- **PF-01 change `blockPair`** : les tests de l'adaptateur de DIASPORALE suivent le même jour.
- **Schéma de facette** : un champ nouveau exige la mise à jour de la ligne du réseau, sinon le moteur refuse l'écriture. Ordre : backend publié par S1, schéma par l'opérateur, puis le front. `memberPrivacy` valide un objet strict : tout niveau nouveau y entre comme champ optionnel.
- **Réidentification** : dans une petite ville, « Gabonais à X » peut désigner une personne. Aucun décompte par ville ; la ville n'est indexée que sur un niveau choisi ; rien plutôt qu'un chiffre faible.
- **Données sensibles** : origine, langues, appartenance associative. Jamais l'ethnie. Le juriste tranche ; aucun écran ne dit « conforme ».
- **Extraction de l'annuaire** : aujourd'hui bornée par les pages, pas par le débit (ligne 68).
- **Démonstration** : comptes partagés par tous les visiteurs ; un blocage ou un masquage posé par l'un est vu des suivants.
- **Ne rien inventer** : ni compteur de vues, ni raison de suggestion sans donnée, ni chiffre sous un seuil.

## 9. Prompts d'implémentation

### Prompt RP-01
```text
Tu es la session S2 (DIASPORALE). Écris en français. Opus seulement.
Lis : CLAUDE.md ; docs/etudes/2026-11-10-finalisation/05_PROFIL_RELATIONS_ANNUAIRE.md (§ 2 lignes 26 à 30, lot RP-01) ; le lot SD-02 du plan 03 d'ANTSIA et le lot PF-03 du plan 05 d'ANTSIA.
Vérifie d'abord : la brique « préparer une image » de SD-02 est-elle dans origin/main d'ANTSIA ? Si non, arrête-toi et dis-le : ne la duplique pas.
Branche claude/images-profil-nettoyees. Périmètre : apps/diasporale_com/src/components/profile-images-editor.tsx, src/data/engine-profile-images.ts, leurs tests, un fragment de textes profile-images (fr, en).
Livre : recadrage (cercle, bandeau) au clavier et à la souris, aperçu, envoi ré-encodé sans métadonnées, refus si le ré-encodage échoue. Aucun changement serveur, aucun faux dépôt en démonstration.
Vérifie : bun run --cwd ../ANTSIA verify avec le verrou ; en local, dépose une image porteuse de coordonnées GPS et prouve que le fichier stocké n'en a plus ; recette à 390 et 1280 px, clair et sombre.
Arrête-toi avant toute publication.
```

### Prompt RP-02
```text
Session S2. Lis le lot RP-02 et la décision 11 du plan 05 de DIASPORALE ; le plan 14 de DIASPORALE (natures signalables) ; ../ANTSIA/convex/modules/moderation/cases.ts (report) et targets.ts (cible person).
Vérifie que la cible person existe toujours et note quel réseau reçoit le dossier.
Branche claude/signaler-un-profil. Périmètre : packages/diasporale-features/src/data/content-reports-port.ts, src/demo/content-reports.ts, apps/diasporale_com/src/data/engine-content-reports.ts, src/screens/profile-screens.tsx, un nouveau composant de menu, textes fr et en, tests.
Livre : menu « … » de la fiche d'autrui (Signaler, Bloquer, Mettre en sourdine, Copier le lien), un seul bouton plein visible, bouton figé après signalement, signalement de soi impossible, démonstration servie.
Vérifie : verify ; à deux comptes de démonstration, le dossier s'ouvre et l'accusé arrive dans « Mes signalements ». Dis-moi dans quelle file il est lu. Arrête-toi avant toute publication.
```

### Prompt RP-03
```text
Session S2. Lis le lot RP-03 et la décision 5 ; docs/14 § 6.2 (R-G13, R-G14) ; ../ANTSIA/docs/08_CONTRAT_DEMANDES_ET_DEBLOCAGES.md ; l'état du lot PF-01 dans le registre d'ANTSIA.
Écris d'abord la matrice « surface → effet du blocage » (fiche, annuaire, suggestions, fil, iCom, entraide, mentorat, talents, avis, demande de service, adhésion, candidature, kit) avec, pour chacune, le fichier qui porte la garde ou son absence. Soumets-la-moi avant de coder.
Puis, dans convex/modules/diaspora seulement : refus indistinct quand tous les signataires vivants d'une page ont bloqué l'auteur. Tout besoin hors tranche : issue [S1].
Aligne le texte de confirmation et le commentaire de RelationBar sur l'effet réel. Un test par ligne de la matrice.
Vérifie : verify ; recette R-G13 et R-G14 à deux comptes (verifie, bloque). Arrête-toi avant toute publication.
```

### Prompt RP-04
```text
Session S2. Lis le lot RP-04 et la décision 3 ; la fiche F11 du dossier produit ; ../ANTSIA/convex/modules/diaspora/directory.ts, facts.ts, tables.ts, manifest.ts ; packages/diasporale-domain/src/directory.ts.
Vérifie que l'annuaire ne se parcourt toujours pas sans nom et que la décision 3 est prise.
Branche claude/annuaire-par-ville. Tranche : table d'index (pays, clé de ville, niveau, entraide, date), tenue par chaque écriture de facette, de niveau et de consentement ; lecture paginée de 20, profondeur bornée, candidats rejugés par listedMemberFor ; manifeste à jour. Dépose une issue [S1] pour l'inventaire d'export et d'effacement, sans modifier ces fichiers.
Écran Membres : liste du pays, champ de ville, interrupteur d'entraide, états vides, démonstration, fragment member-directory (fr, en).
Tests : masqué introuvable ; « mon pays » invisible d'ailleurs ; ville réservée aux relations absente du filtre ; consentement retiré, index vidé.
Vérifie : verify ; étapes 1 et 2 du volet de recette. Arrête-toi avant toute publication ; S1 publie le backend d'abord.
```

## 10. Sources lues

- Brief commun ; plan 15 et plan directeur d'ANTSIA ; registre des lots ; dossier de reprise.
- Plan du moteur : `A:docs/etudes/2026-11-09-finalisation/05_PROFIL_RELATIONS_ALBUMS.md` (en entier).
- DIASPORALE : cahier (docs/00, § 4 à § 8, § 12), docs/04 (lignes du profil, des relations, de l'annuaire, des albums), docs/06, 07, 08, 09, 10, docs/14, docs/17, docs/34.
- ANTSIA : `A:docs/08_CONTRAT_DEMANDES_ET_DEBLOCAGES.md`, `A:docs/14_COMPLEMENT_IDENTITE_DIASPORALE_PD4.md` (contrat d'identité).
- Dossier produit d'origine : fiches F06 et F11, § 3.2 et § 7.2.
- Vault : décisions du 16/10 (abonnements, albums, mur et images, relations paginées) et du 17/10 (demandes et blocages, suggestions masquées, confidentialité du profil commun).
- Code DIASPORALE : écrans du profil, des relations, des membres, de l'album, des réglages, d'Explorer ; composants cités au § 2 ; `D:apps/diasporale_com/src/data/engine-source.ts` ; `D:apps/diasporale_com/src/lib/routes.ts` ; domaine `facet`, `directory`, `suggestions`, `badges`, `engine`, `services` ; port, types et démonstration du paquet de surfaces ; textes `D:packages/diasporale-features/src/i18n/locales/fr/diasporale.json`.
- Code ANTSIA : tranche diaspora (`facet`, `profile`, `directory`, `suggestions`, `facts`, `tables`, `validators`, `moderationDesk`) ; modules `people`, `graph`, `suggestions`, `albums`, `moderation` ; `A:convex/modules/contextualMessaging/access.ts` ; `A:convex/lib/rateLimit.ts` ; `A:convex/schema.ts` ; surfaces `reseau-personnel`, `reseau-albums`, `qr`.
- Non vérifié : aucun écran n'a été ouvert ; le comportement réel du bureau de modération face à un dossier de profil ; l'état d'avancement des lots PF et SD-02 après le 9/11.
