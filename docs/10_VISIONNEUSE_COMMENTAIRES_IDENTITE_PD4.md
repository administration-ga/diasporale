# PD4 — Visionneuse, commentaires et identité sociale

État : implémentation vérifiée localement, recette Chrome partielle au 17/10/2026. Plan établi avant modification des sources. Base DIASPORALE `9f7d4bd`, moteur ANTSIA `eae3a3e` (PA8). Livraison locale uniquement.

## Résultat attendu

1. Depuis les médias des publications et partages déjà autorisés, ouvrir une visionneuse accessible, y compris pour une seule photo et une vidéo. Parcourir les images, lire la vidéo avec ses commandes natives, fermer et retrouver le déclencheur. Garder les proportions et les textes alternatifs. Aucun téléchargement ni nouvelle URL de fichier.
2. Modifier son commentaire ou sa réponse dans la feuille existante, sans créer un autre commentaire. Conserver le brouillon en cas de refus, signaler la modification, permettre l’annulation. Le propriétaire du post ne peut pas éditer les commentaires des autres.
3. Complément suivant de PD4 : modifier le nom affiché libre et l’accroche du profil commun, sans changer le handle, les consentements, les choix privés, l’adhésion ou la publication/republication. Le contrat public du moteur doit garantir que l’enregistrement ne republie jamais un profil retiré.

## Contrats et gardes

- Consommer les API publiques du moteur et l’enveloppe `ImmersiveOverlay` de `@antsia/ui/overlay`. Aucune importation interne d’une surface non exportée, aucun nouveau backend de fichiers.
- `withheld` prime sur toute URL incohérente, dans la grille comme dans le lecteur ; aucune image/vidéo retenue n’est montée. Une mise à jour des autorisations/médias ou un changement de lecteur/source ferme l’ancienne lecture. Éviter tout cache d’URL distinct du DTO vivant.
- Édition via `engagement.editComment`, avec `networkId = diasporale`. Capacité optionnelle du port pour préserver les fournisseurs existants. Réserver le geste à l’auteur et au droit de commenter ; les gardes du moteur décident toujours. Validation trim, texte non vide et limite commune. Aucun changement des compteurs, de la parenté ou de l’audience.
- Éditeurs et commandes : verrou immédiat contre les doubles envois, fermeture/réinitialisation lors d’un changement de contexte, retours tardifs sans effet dans un autre compte, refus traduit et brouillon conservé dans le contexte courant.
- Identité sociale : API globale personnelle, sans `networkId`, jamais obtenue d’un état civil. Ne pas réutiliser `publishMyProfile` pour une simple sauvegarde. Le contrat nouveau éventuel est coordonné avec ANTSIA avant édition de ses chemins.
- Parité moteur/démonstration, persistance existante conservée sans purge. Textes FR/EN ; charte en jetons ; fichiers source réels.

## Découpage et propriété

1. Exécuteur médias : `components/post-media.tsx` et ses tests ; renvoi des traductions à l’intégration. Navigation, clavier, restitution du focus, garde des fichiers et mises à jour.
2. Exécuteur commentaires : `components/comments.tsx` et ses tests ; contrat optionnel `actions.editComment(commentId, body)` ; renvoi des traductions à l’intégration.
3. Exécuteur données : port, adaptateurs moteur/démonstration et tests d’édition des commentaires. Aucun changement des API communes du moteur sans coordination.
4. Intégration principale : traductions, revue croisée, contrat/surface d’identité sociale une fois fixé avec ANTSIA, montage dans les réglages et tests appropriés. Aucun travailleur ne lance de serveur ou de contrôle lourd en parallèle.

## Vérification et recette

- Réserver un créneau commun : un seul travail lourd et un seul serveur Next ; suspendre ANTSIA 3030 pour DIASPORALE 3031 puis restituer la baseline au propriétaire. Backend local conservé. Mesurer le disque ; aucune nouvelle suppression de cache autorisée ici.
- Cas automatisés significatifs : médias seuls/multiples/vidéo, retenue avec URL incohérente et mise à jour pendant lecture, clavier et fermeture ; édition auteur/réponse, refus, conservation du brouillon, limite, double clic, retrait des droits et ancien lecteur ; mise à jour d’identité publiée/retirée conservant tous les choix.
- Vérification commune obligatoire avant commit : `bun run --cwd ../ANTSIA verify` (codegen par son lanceur Node supporté), source gelée et résultat consigné. Pas d’allongement des délais de tests.
- Chrome réel : photos et vidéo réellement disponibles, navigation/Échap/focus ; commentaire et réponse édités, annulation et rechargement ; identité puis retrait/enregistrement sans republication implicite. 320/375/1280 px, clair/sombre, console. Distinguer les cas effectivement joués des seuls tests automatisés.
- Mettre à jour `docs/04`, `docs/01`, cette preuve et Cortex ; commits locaux par chemins explicites. Pas de push, fusion ou déploiement.

## Limites

Cette tranche ne vaut pas clôture automatique de PD4. Les surfaces propres à PD5/PD7, OIDC/attestation réels et production restent séparés. Toute impossibilité matérielle de recette ou limite du contrat sera consignée explicitement.

## Commit local et résultat de la vérification commune

DIASPORALE : `8a44990`, 30 chemins propres, locales committées partiellement. Le commit local conserve explicitement la recette Chrome encore ouverte ; il ne vaut pas clôture de PD4. Complément moteur ANTSIA couplé : `0693832`, cinq chemins propres (mutation du profil, 17 tests, hook de focus, 2 tests et documentation), vérifié par le même passage vert.

- `verify` officiel ANTSIA, code 0 : **7 173 tests**, dix typages et neuf contrôles de qualité sans erreur. Journal : `/tmp/antsia-diasporale-pd4-verify-corrected-final.log` (session 21823).
- Ventilation : 1 610 backend, 124 cliquets, 29 scripts, 475 domaine moteur, 57 contrats, 190 API, 88 UI, 3 166 surfaces moteur, 238 domaine DIASPORALE, 391 surfaces DIASPORALE, 78 console, 109 app ANTSIA, 618 app DIASPORALE. Soit 1 247 cas DIASPORALE, dont ceux de l’accueil parallèle. Les 94 avertissements sont conservés ; le résultat n’est pas annoncé sans avertissements.
- Empreintes avant/après identiques pour 1 569 fichiers (`/tmp/antsia-diasporale-pd4-corrected-source-{before,after}.json`), SHA-256 global `c1a685a4d04d8b30a71a04d4838b31498ee7de70da22fa6c5a3fdb9e56a09225`. Contrôle de non-dérive refait après la recette partielle, avant commit.
- Ciblés : 17 contrat backend + 2 hook modal ; 52 médias/commentaires ; 11 formulaire d’identité. Les échecs initiaux de focus, d’espaces normalisés et de bail du lecteur ont été corrigés avant le passage intégral vert, sans règle désactivée ni assertion affaiblie.

## Choix confirmés par la relecture

- Les commandes du profil partagent le verrou dès la validation du formulaire : enregistrer et republier ne peuvent se concurrencer dans le même panneau.
- `expectedPersonId` est transmis au contrat global comme corrélation ; le moteur le compare à la session avant l’édition. Aucune destination de profil choisie par le client.
- Bail exclusif du lecteur dans `lib/media-viewer-lease.ts`, pris uniquement à l’action, sans URL ou donnée personnelle. Les tests montés couvrent deux grilles simultanées, fermeture et changement de contexte.
- L’aperçu cité du composeur reste non interactif pour garder une seule pile modale ; cartes et partages du fil conservent leur agrandissement. Le hook commun réactive les éléments inert avant restitution du focus.
- Source DIASPORALE propre : 27 chemins de code/tests et 3 documents. Les 18 clés FR/EN de cette tranche sont seules committées dans les locales partagées ; les 39 autres changements de clés de l’accueil restent au travail.

## Recette Chrome réellement effectuée

Compte fictif préexistant, moteur local 3210, application 3031 en mode moteur, Node 22 et Webpack. Aucun environnement modifié, aucune session supprimée.

- Une publication textuelle fictive a été créée via le composeur, portée diaspora, tous les membres, partage ANTSIA décoché. Un commentaire et sa réponse ont été édités dans leur feuille ; leurs textes corrigés et deux marqueurs « modifié » persistent après nouvelle navigation sur la publication. Annuler conserve le texte initial et rend le focus à « Modifier ». Les champs d’édition/réponse reçoivent le focus ; après enregistrement réactif, le focus reste dans la feuille.
- Feuille commentaires contrôlée à 1 280 px sombre, 320 px sombre et 375 px clair : aucun dépassement horizontal, contenu et boutons visibles. Échap ferme la feuille. Une capture à 320 px a été inspectée.
- Profil publié : nom libre et accroche enregistrés. Après retrait explicite, édition des textes toujours accessible ; identité initiale « Relations Recette » rétablie, accroche vidée par saisie clavier réelle. Rechargement : profil toujours retiré, mode privé désactivé et adhésions conservées à l’écran. Adresse publique du profil : indisponible avec lien vers ses réglages. **L’absence de republication implicite est confirmée.**
- La confirmation de republication explicite a ensuite été activée, mais son résultat final restait alors à relire : blocage de navigation, erreur locale de session (budget métier de 1 s inchangé), puis Mac verrouillé confirmé par CUA. La reprise ci-dessous apporte la lecture qui manquait.

## Reprise Chrome du 17/10 après déverrouillage

Le Mac est de nouveau accessible. Les services locaux 3210 et 3031 ont été relancés par leurs propriétaires ; la session fictive « Relations Recette » est conservée. Aucun nettoyage supplémentaire, aucun changement de source applicative, aucun envoi de fichier.

- Une photo fictive préexistante de 1 600 × 900 pixels a été trouvée dans le fil et dans son partage cité. Les deux chargements de stockage répondent 200 ; l’image est réellement décodée dans Chrome.
- Le lecteur a été ouvert depuis la citation puis depuis la publication originale : image et texte alternatif présents, compteur « Média 1 sur 1 », focus initial sur « Fermer ». Tab et Maj+Tab restent dans le lecteur ; Échap le ferme et rend le focus au déclencheur « Agrandir la photo 1 sur 1 ». La flèche droite conserve correctement l’unique média.
- Captures inspectées à 1 280 px sombre, 320 px sombre et 375 px clair : image visible et proportions conservées, aucun débordement horizontal. À 320 px, l’image occupe les 296 px disponibles entre les marges.
- Recherche par les voies déjà compilées : 81 publications du fil initial, 45 dans la portée diaspora et 82 dans les récents, fins de pagination atteintes. Seules la photo et sa citation contiennent un média ; aucune série d’images ni vidéo disponible pour cette recette.
- L’unique erreur console identifiée à ce stade est le 404 de `/favicon.ico`. Les images répondent 200 ; aucune erreur du lecteur observée. Le contrôle après navigation fraîche reste à faire.
- Un créneau de quinze minutes pour les nouvelles routes a été réservé après les publications Convex du chat de coordination Gabon ; pas de nouvelle compilation lourde en concurrence.
- Ce créneau a été réduit à trois minutes entre deux publications coordonnées, puis rendu explicitement dès les deux premières compilations terminées. `/parametres` confirme le profil publié, le privé désactivé, l’annuaire masqué et les deux adhésions conservées. L’éditeur ouvert sans sauvegarde confirme exactement « Relations Recette » et une accroche vide, puis a été annulé. `/@relations.recette` affiche à nouveau le profil, toujours présent après rechargement : **la republication explicite antérieure a réussi**. Aucun second geste de republication nécessaire.
- Console sans erreur après navigation fraîche et rechargement du profil, puis retour au fil. Le 404 initial du favicon reste distingué de ces parcours.
- Le composeur est préparé dans le Chrome piloté par DevTools sur `/fil?scope=recents` : message fictif pour deux photos, portée diaspora, tous les membres, partage ANTSIA décoché, zéro fichier. Aucune publication envoyée. Ce navigateur est distinct du Chrome natif visible, où la session conservée est `@pd4.lecture`, membre en attente : elle n’a été ni promue ni déconnectée et ne permet pas de publier. Une sélection humaine ne peut donc pas être présentée comme immédiatement prête dans le compte auteur du Chrome visible.
- Depuis cette seconde session native en attente, le profil republié est également lisible. La feuille des deux commentaires montre les textes corrigés et leurs deux marqueurs « modifié », sans champ de saisie ni bouton d’édition, avec l’explication du droit de commenter. Feuille fermée normalement, retour au fil conservé visible. L’adresse fictive du compte auteur a été retrouvée dans les anciennes actions de formulaire de ce chat, sans lecture ni transmission de cookie ou de jeton ; aucune nouvelle authentification n’a été effectuée.
- Six sources d’accueil/connexion ANTSIA ont ensuite changé, hors de cette tranche. Le passage 7 173 reste la preuve de son instantané ; un nouveau passage officiel a donc été exécuté sur l’état courant.

## Nouvelle vérification commune du 17/10

Après gel et réservation du créneau, ANTSIA a exécuté l’unique travail lourd entre 19 h 18 et 19 h 22 (Paris). `verify` officiel terminé avec le code 0, journal `/tmp/antsia-diasporale-pd4-verify-resume-final.log`, session 94825 terminée.

- **7 179 tests verts**, dont les 115 tests actuels de l’application ANTSIA et les 1 247 cas DIASPORALE ; dix typages, tests des dix espaces et neuf contrôles de qualité sans erreur.
- **93 avertissements conservés** : UI 6, surfaces moteur 74, app ANTSIA 8, app DIASPORALE 5. Aucun avertissement masqué ou règle relâchée pour ce passage.
- **1 570 fichiers identiques avant/après**, nouveau test de route inclus. Instantanés : `/tmp/antsia-diasporale-pd4-resume-source-before.json` et `/tmp/antsia-diasporale-pd4-resume-source-after.json`. SHA-256 global : `809adebcdcf0f469ab27993c8a98f437728b27cba6cf5e12a7febe4325f3eb51`.
- Tous les processus du contrôle sont terminés ; CPU lourd rendu explicitement aux trois chats coordonnés. Seuls le backend 3210 et Next 3031 sont conservés chez leur propriétaire, 3030 arrêté par ANTSIA.

Preuve moteur correspondante committée localement dans ANTSIA : `15004a2`, seul `docs/14`. Après le contrôle et ce commit documentaire, ANTSIA confirme encore le HTTP 200 de 3031 et ses quatre projections publiques PA8 conformes. Ces lectures ne remplacent pas les deux essais médias restants.

Un nouveau créneau de deux minutes a été accordé pour préparer la connexion privée normale, puis rendu immédiatement : CUA a confirmé que le Mac s’était verrouillé de nouveau et exigeait un déverrouillage manuel. Aucune nouvelle route ni compilation, aucune authentification et aucun envoi de fichier n’ont été effectués. L’ouverture de la fenêtre privée n’a pas pu être confirmée ; le dernier écran natif confirmé reste le fil du compte en attente, conservé.

## Recette restant à terminer

1. Médias multiples et vidéo : deux mires PNG et une vidéo de 2 s sans son ont été préparées hors sources, puis copiées dans `.next/pd4-recette-fixtures` ignoré lors de la recette initiale. L’outil Chrome `upload_file` refuse leur périmètre d’accès, même dans le workspace ; **aucun fichier n’a été envoyé et aucune autre voie d’envoi n’a été utilisée pour contourner ce refus**. La photo seule et le partage cité sont maintenant recettés réellement. Les 23 tests du lecteur sont verts ; la série d’images et la vidéo restent à jouer après résolution légitime de l’accès aux fichiers ou sélection manuelle par l’utilisateur dans une session auteur accessible.
2. Après déverrouillage manuel du Mac, préparer la connexion normale du compte auteur dans une fenêtre privée du Chrome visible, sous un court créneau coordonné, sans transférer de cookie ou de session. La session de lecture existante reste conservée. La sélection des fichiers refusés reste à la main de l’utilisateur.
3. Rendre explicitement Chrome aux chats coordonnés. Conserver le seul serveur 3031 visible selon la demande humaine la plus récente, avec le backend 3210 chez leur propriétaire. Aucun second serveur de développement en parallèle.

## Machine, coordination et mémoire

Les deux seuls caches DIASPORALE autorisés ont été retirés après serveur arrêté et lsof vide. Espace 189 612 → 862 376 Kio mesuré à ce passage, très fluctuant ; ce delta n’est pas attribué intégralement à ces caches. Le chat ANTSIA a ensuite retiré son Turbopack recréé sous un accord humain reçu dans son chat. Les nettoyages privés Gabon/SETRAG sont des opérations distinctes de leur propriétaire. Aucun autre nettoyage effectué par cette tranche.

ANTSIA possède ses cinq chemins de contrat/hook/tests/docs ; le chat accueil possède ses écrans/routes et autres traductions. Le contrôle commun inclut leurs sources gelées ; chaque commit garde sa propriété. Pas de push, fusion ni déploiement.

Cortex indisponible : Git du vault d’abord incomplet puis chemin disparu, confirmé par les chats et relu localement. Aucune réparation, recréation, suppression de verrou ni écriture mémoire effectuée. Ce document garde le bilan de reprise jusqu’au retour du vault.
