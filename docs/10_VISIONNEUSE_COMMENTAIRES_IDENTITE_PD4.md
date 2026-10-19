# PD4 — Visionneuse, commentaires et identité sociale

État : implémentation vérifiée localement, recette Chrome partielle au 18/10/2026 ; lecture d’une vidéo existante désormais validée, galerie de deux photos encore ouverte. Plan établi avant modification des sources. Base DIASPORALE `9f7d4bd`, moteur ANTSIA `eae3a3e` (PA8). Livraison locale uniquement.

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

- Réserver un créneau commun : un seul travail lourd ; le mandat humain actualisé autorise les deux Next 3030/3031 simultanément, avec mémoire bornée et backend local 3210 conservé. Préserver les serveurs de leurs propriétaires. Mesurer le disque ; aucune nouvelle suppression de cache autorisée ici.
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

## Reprise après sélection humaine des deux photos

L’utilisateur a confirmé avoir sélectionné les deux PNG dans Chrome. À la lecture suivante, `/fil` a d’abord affiché « Ouverture de votre session… », puis le fil du compte auteur `Relations Recette`, sans composeur ouvert. La publication `kn7cnjtv0y03mv8gk7aff9nzw18ge6j3` contient le texte prévu (« Vérification de la navigation entre deux photos fictives »), mais aucun média n’est rendu. Le composeur rouvert est vide, sans aperçu ni pièce jointe ; aucune erreur console n’est relevée sur cette navigation. La cause et l’auteur de la publication textuelle ne sont pas établis. **Cette publication ne valide pas la recette des deux photos.**

Un nouveau composeur a été préparé par l’interface normale : « PD4 — Essai réel de deux photos fictives : navigation et accessibilité. #RecetteMediasPD4 », portée diaspora, tous les membres, partage ANTSIA décoché. Aucun clic sur Publier. L’envoi automatique précédemment refusé n’a pas été retenté ; la sélection humaine des deux PNG reste nécessaire avant la recette multi-image, puis celle de la vidéo.

Au retour humain suivant (« les deux aperçus sont visibles »), la première lecture montre déjà un nouveau post `kn77h24efya8fdx6kfxyqse2r98gfcj7` portant ce nouveau texte, sans composeur ni média rendu. Aucun clic sur Publier, aucune navigation ni recharge n’a été effectué par cette reprise entre le passage de main et ce constat. DOM, arbre d’accessibilité et capture du fil concordent : zéro image et zéro vidéo sur la nouvelle carte, aucun message de retenue, console sans erreur. Le Chrome natif possède une fenêtre à deux onglets DIASPORALE/ANTSIA ; le menu des fenêtres consulté pour le diagnostic a été refermé, puis DIASPORALE remis au premier plan. Aucune autre fenêtre contenant les aperçus n’a été identifiée. Une clarification textuelle sur l’endroit exact où l’utilisateur voit les aperçus et une lecture bornée du nombre de médias côté moteur ont été demandées, avant toute troisième sélection. **Aucune preuve supplémentaire de succès photos ou vidéo n’est acquise à ce stade.**

ANTSIA confirme ensuite la lecture locale bornée de cette ligne exacte : publication publiée et non retirée, champ `media` absent, longueur effective **0**, aucun état média à délivrer. Les chemins `posts.publish`/`writePost` et `resolvePostMediaDtos` relus utilisent cette même propriété : le défaut observé n’est pas une simple perte de projection dans la visionneuse. La cause de l’omission avant l’enregistrement reste non établie. Cette lecture n’a effectué aucune mutation ni exposé de secret ou de donnée privée. Les deux propriétaires d’accueil confirment n’avoir manipulé ni ce Chrome natif ni le composeur ; leurs captures distinctes étaient dans le navigateur intégré. La clarification humaine reste en attente. Capture du fil : `/tmp/diasporale-pd4-post-sans-photos.jpg`. La vidéo préparée a été relue sur disque (H.264, 320 × 240, 2 s, sans audio, 48 610 octets) ; sa présence ne vaut pas recette de lecture dans Chrome.

L’utilisateur a précisé que les deux aperçus se trouvent dans « Nouvelle publication » sur `localhost:3031`. La lecture suivante du Chrome piloté montre toujours le même fil, sans composeur et sans média ; la fenêtre native est de nouveau sur l’onglet ANTSIA 3030 (« Préparation de la connexion… »). Cette réponse précise l’endroit annoncé sans résoudre le décalage entre les vues. Aucun clic, nouvelle publication, recharge ni nouvel envoi effectué. Une capture du composeur vu par l’utilisateur est nécessaire pour identifier son état ou sa fenêtre avant de répéter la sélection.

Les propriétaires ont confirmé le nouveau mandat humain autorisant simultanément les deux applications locales, 3030 et 3031, avec le backend 3210 conservé. Cette autorisation remplace l’alternance historique décrite ci-dessus : Node 22/Webpack, mémoire bornée à 2 048 Mio par Next et deux threads de travail. Aucun service n’a été arrêté par cette reprise.

Les corrections visuelles parallèles de DIASPORALE et ANTSIA ont changé les sources après le passage commun à 7 179 tests. Ce résultat et l’empreinte des 1 570 fichiers restent la preuve de leur instantané antérieur, sans valider intégralement les nouveaux styles. Un gel des sources et des rechargements DIASPORALE a été demandé à ANTSIA pour préserver la prochaine sélection humaine jusqu’à la fin des deux essais médias. Aucun contrôle lourd ni changement applicatif effectué par cette reprise.

ANTSIA a ensuite relayé une nouvelle demande humaine reçue dans le chat d’accueil : terminer le créneau médias et lancer le contrôle complet des deux applications. Le propriétaire accueil possède cet unique passage officiel ; aucun contrôle n’est dupliqué ici. Le point sûr local a été confirmé (aucun composeur, fichier ni envoi visible), sans transformer cette instruction de fin de créneau en preuve de réussite de la recette médias.

## Recette restant à terminer

1. Les deux mires PNG et la vidéo préparée de 2 s sans son restent des fichiers de recette non envoyés par cette session. L’outil Chrome `upload_file` a refusé leur périmètre ; aucun autre mécanisme n’a contourné ce refus. La photo seule et son partage cité sont recettés. La **lecture d’une autre vidéo existante, de 14,92 s**, est maintenant validée dans la section du 18/10 ci-dessous ; cet essai n’établit ni son auteur de publication ni la réussite de notre parcours d’envoi.
2. Les trois cartes de recette photos encore présentes dans les 30 cartes du fil France ont chacune zéro image. Aucun composeur auteur n’est corrélé durablement. ANTSIA centralise une demande de publication manuelle de **deux photos sans texte**, puis de son lien ; le membre lecteur en attente conservé pourra alors éprouver la galerie. Aucun nouvel envoi automatisé, suppression, changement de session ou nouvelle publication textuelle.
3. Conserver les deux applications 3030/3031 et le backend 3210 selon le mandat humain actualisé. Aucun changement global du viewport pour préserver la fenêtre mobile de l’autre propriétaire. Les preuves de tests restent liées à leur instantané ; aucun nouveau contrôle lourd pour cette recette en lecture seule.

## Contrôle commun final après corrections visuelles

Le propriétaire accueil a terminé le passage officiel final, session **85261**, avec **code 0**. ANTSIA l’a relu puis transmis ; cette reprise a relu le journal et le résumé sur disque, comparé les inventaires avant/après et recalculé chaque empreinte contre les sources actuelles. Aucun second passage exécuté ici.

- **7 179 tests réussis** : 6 912 Vitest et 267 Bun ; dix typages des espaces de travail, typages stricts Convex et des tests, dix tâches de tests des espaces et neuf tâches de lint. **Zéro erreur de lint, 94 avertissements conservés.** Le test de contraste DIASPORALE corrigé est inclus.
- **1 580 fichiers source/configuration identiques avant/après ; zéro dérive à la relecture locale.** Inventaires : `/tmp/antsia-diasporale-surfaces-verify-20261017-source-final-before.json` et `/tmp/antsia-diasporale-surfaces-verify-20261017-source-final-after.json`. SHA-256 des octets de ce dernier fichier JSON : `4b8158ed19bf3b879d9dfef65ab15ee1c4242327d65e4e68f75f64a30cf150bc`.
- Journal : `/tmp/antsia-diasporale-surfaces-verify-final-20261017.log` ; résumé : `/tmp/antsia-diasporale-surfaces-verify-final-20261017-summary.json`. Cible locale 3210, lanceur Node 22, exécution séquentielle. Les deux Next 3030/3031 restent conservés selon le mandat humain.
- Un passage intermédiaire à 7 179 tests avait également réussi, mais deux sources ANTSIA avaient changé pendant ce passage. Seul le passage final stable ci-dessus valide le nouvel instantané visuel ; les contrôles antérieurs restent des preuves historiques.

Le résultat automatisé n’ajoute aucune preuve de recette des deux photos ou de la vidéo. Le dernier post reste sans média et la capture du composeur humain est toujours attendue. Aucun changement de code applicatif, nouvel envoi, suppression, push ni déploiement effectué par cette reprise.

## Reprise du 18/10 : contexte Chrome et défaut reproductible

La capture annoncée dans le nouveau message n’est jointe dans aucun des deux chats. DevTools a été réinitialisé et ne présente qu’un onglet vide. L’extension du Chrome habituel est, elle, de nouveau accessible : son onglet DIASPORALE affiche d’abord un refus de connexion. Les ports 3210 et 3030 sont déjà actifs ; le propriétaire rétablit 3031. Aucun serveur supplémentaire lancé par cette reprise, aucun cache supprimé ni environnement modifié.

Après rechargement normal de cette erreur réseau, le Chrome habituel retrouve `@pd4.lecture`, membre en attente : lecture disponible, Publier désactivé, aucun composeur ni aperçu. Cette session est conservée. Le propriétaire ANTSIA termine et libère son bref contrôle mobile natif avant toute autre manipulation. Une nouvelle fenêtre privée Chrome est alors ouverte ; connexion normale du compte fictif auteur par le code local affiché dans son formulaire, lu transitoirement sans sortie ni conservation. Le fil confirme `@relations.recette`, vérifié, avec Publier actif. Aucun fichier choisi ni publication envoyée pendant cette préparation.

ANTSIA possède désormais le diagnostic et le correctif de `composer.tsx` ainsi que ses nouveaux tests ; la session DIASPORALE conserve la recette Chrome. Un cas distinct des essais historiques est effectivement reproduit : après le départ d’une publication de texte, le formulaire accepte encore un ajout de photos pendant l’attente de réponse. Les aperçus apparaissent, mais le contenu déjà envoyé ne comprend pas ces photos ; le succès efface ensuite les pièces ajoutées trop tard. Le test échoue avant correction et passe après. Cela ne prouve pas la cause des anciens posts sans média.

Le correctif servi prend un verrou synchrone avant la validation, gèle les contrôles pendant la soumission et ignore un événement de fichier ou de retrait tardif. Les sept tests du vrai composeur vérifient les deux dépôts terminant dans le désordre, l’ordre et les descriptions transmis, la fermeture/réouverture, le refus sans publication textuelle de repli, le fichier tardif et le double envoi bloqués, la vidéo seule, la reprise après refus avec les mêmes dépôts et clé, et la libération du verrou après validation refusée. Aucun contournement de la garde des fichiers et aucun changement d’audience ou du contrat serveur. Commit local **`9317ec5`**, exactement `composer.tsx`, `composer.test.tsx` et [la preuve ciblée docs/12](12_CORRECTION_COURSE_COMPOSEUR_MEDIAS.md), sans les sources étrangères d’accueil ou de charte.

Les trois chats Gabon autorisés ont réservé un créneau CPU exclusif pour un passage officiel commun après les contrôles ciblés. La fenêtre auteur reste sans composeur ni fichier pendant ce passage. Le résultat final, la préparation du composeur sans texte et la future recette réelle seront consignés après leurs observations respectives. Le résultat précédent à 7 179 tests demeure celui de son instantané antérieur.

### Passage officiel du 18/10

`verify` officiel ANTSIA, session **53670**, terminé avec **code 0** : **7 186 tests** (6 919 Vitest et 267 Bun), dix typages des espaces de travail, dix tâches de tests et neuf tâches de lint, sans erreur et avec **94 avertissements préexistants**. Journal et résumé relus localement : `/tmp/antsia-diasporale-media-verify-20261018.log` et `/tmp/antsia-diasporale-media-verify-20261018-summary.json`.

Les inventaires `/tmp/antsia-diasporale-media-20261018-source-before.json` et `-after.json` contiennent **1 581 fichiers identiques**. Une première comparaison locale aux sources après le passage confirme zéro dérive. Empreinte compacte rapportée dans le résumé : `a85d56b7e759a20422e290a2439b7d784e123580b2b4ffbddcbc88b3e91f439a` ; SHA-256 des octets du fichier JSON après : `0e532ce204fded4bebc9dc51b7b2a064cb374b5d3f57b31fcf2d7a175b0ef487`. Les deux calculs sont distincts.

Le CPU a été rendu explicitement aux trois chats après la prolongation convenue. Aucun second passage lancé ici. Une correction distincte de session ANTSIA a ensuite modifié ses deux fichiers `session-bridge.tsx`/`session-bridge.test.tsx` ; une configuration `.claude/launch.json` est également apparue dans ce dépôt voisin. Le passage à 7 186 tests valide son instantané et le correctif DIASPORALE, sans constituer une vérification intégrale de ces changements ANTSIA ultérieurs. Les sources applicatives DIASPORALE restent inchangées.

### Préparation native réellement observée et blocage restant

Le contrôle natif ne conserve pas une corrélation stable avec la fenêtre privée : des lectures successives reviennent sur le Chrome habituel Asted, compte en attente, sans sélectionner ni publier. La cause du changement de fenêtre n’est pas établie. La page DevTools distincte, dont l’auteur et le composeur sont lisibles, n’est pas présentée comme physiquement visible pour l’utilisateur.

Une dernière préparation privée a rencontré un incident distinct : après validation normale du code, `/bienvenue` a d’abord refusé la connexion, puis affiché un `ChunkLoadError` sur `app/layout.js`. Le propriétaire de Next confirme un redémarrage automatique de son processus après franchissement du seuil mémoire pendant la compilation, sans suppression ni relance manuelle. Nouveau processus prêt ; `/bienvenue`, `/fil` et le module JavaScript redeviennent accessibles. Cette panne n’établit pas la cause des anciens posts sans média.

Après reprise normale vers `/fil` puis **un seul rechargement manuel**, le lien de navigation Profil confirme `@relations.recette` dans la fenêtre privée native. Le composeur ouvert y montre effectivement **0 / 2000 caractères**, aucune pièce jointe, **France** par défaut, tous les membres cochés et partage ANTSIA décoché. Avant de choisir la portée diaspora et de capturer l’écran, la lecture suivante du contrôle App retourne à la fenêtre **normale Asted**, `/fil`, `@pd4.lecture` en attente, Publier désactivé. La garde de contexte arrête le geste : aucune portée modifiée, aucun fichier choisi, aucun clic sur Publier et aucune capture du composeur final obtenue.

Toutes les recréations, navigations et actions Chrome sont alors arrêtées. ANTSIA centralise l’unique demande humaine de remise au premier plan de la fenêtre auteur, avant toute nouvelle sélection. **À ce stade de la préparation, les deux photos et la vidéo restent non validées** ; la lecture vidéo acquise ensuite est décrite ci-dessous. Cortex est toujours absent à la vérification du 18/10 ; aucune réparation ni écriture mémoire tentée.

Après confirmation humaine de remise au premier plan, la reprise se limite strictement à la lecture. L’arbre natif renvoie cette fois un nouvel onglet normal Asted (`chrome://newtab/`), sans composeur ; l’inventaire indique Chrome présent, une nouvelle surface d’extension et aucun onglet DIASPORALE. La capture native suivante, sans clic ni activation, montre ANTSIA `/fil` sur 3030 avec le compte fictif `@recette.f3`, également sans composeur. ANTSIA confirme qu’un redémarrage de Chrome et une nouvelle fenêtre ANTSIA sont survenus ; la cause du redémarrage reste inconnue. Ces observations ne prouvent pas que la fenêtre déclarée par l’utilisateur est fermée, mais elles ne permettent toujours pas de la corréler. Capture de diagnostic uniquement : `/tmp/diasporale-native-surface-20261018.jpg`. Aucune donnée de compte personnel issue du nouvel onglet n’est reprise dans cette preuve. Aucun fichier, nouvelle fenêtre, nouvelle connexion, navigation ou publication pendant cette reprise en lecture seule.

## Vidéo existante : recette native du 18/10 achevée

Une nouvelle publication existante a été signalée par le propriétaire mobile : [publication locale `kn795ekrtd65evydvry3973ff58gh306`](http://localhost:3031/publication/kn795ekrtd65evydvry3973ff58gh306), auteur affiché « Relations Recette », texte « test », portée France. Aucun envoi ni clic Publier effectué par cette session. Elle ne doit pas être attribuée à notre mire silencieuse de 2 s.

L’ancienne extension Chrome étant explicitement indisponible, la nouvelle surface a été sélectionnée selon la procédure de reprise ; l’onglet exact `969036313` affiche `/fil`, `@pd4.lecture`, membre en attente, Publier et Réagir désactivés. Les observations et gestes suivants restent dans cet onglet corrélé, sans modifier les sessions ou l’autre fenêtre ANTSIA.

- ANTSIA a lu en local la seule ligne correspondante, sans mutation : `published`, un média `video/mp4`, 22 869 119 octets, 1 290 × 2 796 pixels et durée déclarée 14 920 ms, référence de stockage présente. Aucune URL de stockage, clé ou donnée de session conservée dans cette preuve.
- Chrome décode la vidéo aux mêmes dimensions, durée 14,92 s, `readyState = 4`, erreur nulle. Au départ elle est pausée à 0, sans autoplay. Lecture native du fil : 0 → 2,448 s ; pause à 2,461 s.
- Agrandissement : focus initial « Fermer », compteur « Média 1 sur 1 », nouvelle vidéo pausée à 0. Lecture 0 → 7,696 s, pause à 7,708 s. Tab et Maj+Tab restent dans le dialogue ; Échap ferme et restitue le focus exact « Agrandir la vidéo ».
- Second cycle avec la grille en lecture : l’agrandissement la met en pause à 2,522 s ; la visionneuse reste initialement pausée à 0. Après lecture à 2,272 s, Échap retire la vidéo de la visionneuse ; seule la grille pausée demeure, focus rendu au déclencheur. Aucune instance vidéo en lecture ne subsiste après fermeture ; la piste audio elle-même n’a pas été éprouvée.
- Lien de la publication ouvert normalement, puis un rechargement normal unique : même compte lecteur, même publication et vidéo redécodée, pausée à 0, durée/dimensions conservées. Nouvelle lecture dans la carte 0 → 7,198 s, pause à 7,210 s ; nouvelle lecture agrandie 0 → 5,093 s, pause à 5,106 s, capture inspectée. Cela valide la persistance après rechargement, sans prétendre avoir vidé le cache réseau du navigateur.
- Taille réellement contrôlée pour cette vidéo : **1 100 × 690 px, thème clair**, aucun débordement horizontal. Aucun viewport global modifié ; les essais mobiles de la photo seule restent distincts. Console de cet onglet : aucun avertissement ni erreur relevé lors de ces lectures.
- Retour au fil : zéro dialogue, une seule vidéo pausée à 0. Inventaire borné aux **30 cartes déjà chargées** : la vidéo ci-dessus est le seul média ; les trois cartes `kn77h24efya8fdx6kfxyqse2r98gfcj7`, `kn7cnjtv0y03mv8gk7aff9nzw18ge6j3` et `kn70c993rhxcr392ec7bdhej8s8gfqnb` ont zéro image/vidéo. Aucune pagination supplémentaire. Cela n’est pas un inventaire global de tous les médias du réseau.

Preuves propres à cette session : [capture de la pause à 5 s](recette/pd4-video-2026-10-18/visionneuse-pause-5s.jpg), [relevé borné](recette/pd4-video-2026-10-18/preuve.json). La lecture vidéo est acquise ; l’envoi initial, la piste audio, les variantes d’écran de cette vidéo et la galerie des deux photos restent distincts. PD4 reste ouvert. Les sources applicatives n’ont pas été changées par cette recette ; les 7 186 tests restent la preuve de l’instantané officiel décrit plus haut.

## Machine, coordination et mémoire

Les deux seuls caches DIASPORALE autorisés ont été retirés après serveur arrêté et lsof vide. Espace 189 612 → 862 376 Kio mesuré à ce passage, très fluctuant ; ce delta n’est pas attribué intégralement à ces caches. Le chat ANTSIA a ensuite retiré son Turbopack recréé sous un accord humain reçu dans son chat. Les nettoyages privés Gabon/SETRAG sont des opérations distinctes de leur propriétaire. Aucun autre nettoyage effectué par cette tranche.

ANTSIA possède ses cinq chemins de contrat/hook/tests/docs ; le chat accueil possède ses écrans/routes et autres traductions. Le contrôle commun inclut leurs sources gelées ; chaque commit garde sa propriété. Pas de push, fusion ni déploiement.

Diagnostic des processus : lire uniquement PID, PPID et nom de commande pour le backend local. Une lecture de sa ligne complète a affiché accidentellement un paramètre secret ; incident signalé à l’utilisateur et à la coordination, sans recopier sa valeur dans les preuves, les documents ou les messages. Aucun changement de clé, session ou environnement effectué. Éviter toute nouvelle sortie des arguments complets du backend.

Cortex indisponible : Git du vault d’abord incomplet puis chemin disparu, confirmé par les chats et relu localement. Aucune réparation, recréation, suppression de verrou ni écriture mémoire effectuée. Ce document garde le bilan de reprise jusqu’au retour du vault.
