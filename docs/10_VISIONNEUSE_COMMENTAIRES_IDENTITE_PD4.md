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

DIASPORALE : `8a44990`,30chemins propres, locales committées partiellement. Le commit local conserve explicitement la recette Chrome encore ouverte ; il ne vaut pas clôture de PD4. Complément moteur ANTSIA couplé : `0693832`, cinq chemins propres (mutation du profil,17tests, hook de focus,2tests et documentation), vérifié par le même passage vert.

- `verify` officiel ANTSIA, code0 : **7 173 tests**, dix typages et neuf contrôles de qualité sans erreur. Journal : `/tmp/antsia-diasporale-pd4-verify-corrected-final.log` (session21823).
- Ventilation :1610backend,124cliquets,29scripts,475domaine moteur,57contrats,190API,88UI,3166surfaces moteur,238domaine DIASPORALE,391surfaces DIASPORALE,78console,109app ANTSIA,618app DIASPORALE. Soit1247cas DIASPORALE, dont ceux de l’accueil parallèle.94avertissements conservés ; le résultat n’est pas annoncé sans avertissements.
- Empreintes avant/après identiques pour1569fichiers (`/tmp/antsia-diasporale-pd4-corrected-source-{before,after}.json`), SHA256global `c1a685a4d04d8b30a71a04d4838b31498ee7de70da22fa6c5a3fdb9e56a09225`. Contrôle de non-dérive refait après la recette partielle, avant commit.
- Ciblés :17contrat backend +2hook modal ;52médias/commentaires ;11formulaire d’identité. Les échecs initiaux de focus, d’espaces normalisés et de bail du lecteur ont été corrigés avant le passage intégral vert, sans règle désactivée ni assertion affaiblie.

## Choix confirmés par la relecture

- Les commandes du profil partagent le verrou dès la validation du formulaire : enregistrer et republier ne peuvent se concurrencer dans le même panneau.
- `expectedPersonId` est transmis au contrat global comme corrélation ; le moteur le compare à la session avant l’édition. Aucune destination de profil choisie par le client.
- Bail exclusif du lecteur dans `lib/media-viewer-lease.ts`, pris uniquement à l’action, sans URL ou donnée personnelle. Les tests montés couvrent deux grilles simultanées, fermeture et changement de contexte.
- L’aperçu cité du composeur reste non interactif pour garder une seule pile modale ; cartes et partages du fil conservent leur agrandissement. Le hook commun réactive les éléments inert avant restitution du focus.
- Source DIASPORALE propre :27chemins de code/tests et3documents. Les18clés FR/EN de cette tranche sont seules committées dans les locales partagées ; les39autres changements de clés de l’accueil restent au travail.

## Recette Chrome réellement effectuée

Compte fictif préexistant, moteur local3210, application3031 en mode moteur, Node22 et Webpack. Aucun environnement modifié, aucune session supprimée.

- Une publication textuelle fictive a été créée via le composeur, portée diaspora, tous les membres, partage ANTSIA décoché. Un commentaire et sa réponse ont été édités dans leur feuille ; leurs textes corrigés et deux marqueurs « modifié » persistent après nouvelle navigation sur la publication. Annuler conserve le texte initial et rend le focus à « Modifier ». Les champs d’édition/réponse reçoivent le focus ; après enregistrement réactif, le focus reste dans la feuille.
- Feuille commentaires contrôlée à1280sombre,320sombre et375clair : aucun dépassement horizontal, contenu et boutons visibles. Échap ferme la feuille. Une capture320 a été inspectée.
- Profil publié : nom libre et accroche enregistrés. Après retrait explicite, édition des textes toujours accessible ; identité initiale « Relations Recette » rétablie, accroche vidée par saisie clavier réelle. Rechargement : profil toujours retiré, mode privé désactivé et adhésions conservées à l’écran. Adresse publique du profil : indisponible avec lien vers ses réglages. **L’absence de republication implicite est confirmée.**
- La confirmation de republication explicite a ensuite été activée, mais son résultat final reste à relire : blocage de navigation, erreur locale de session (budget métier1s inchangé), puis Mac verrouillé confirmé par CUA. Ne pas annoncer le profil republié sans cette lecture.

## Recette restant à terminer

1. Déverrouillage manuel du Mac demandé à l’utilisateur ; aucune tentative de contournement du verrou. Relire immédiatement l’état du compte fictif et terminer sa republication explicite si nécessaire, avec nom/accroche d’origine et privé désactivé.
2. Médias : deux mires PNG et une vidéo2s sans son ont été préparées hors sources, puis copiées dans `.next/pd4-recette-fixtures` ignoré. L’outil Chrome `upload_file` refuse ses chemins configurés, même dans le workspace ; **aucun fichier n’a été envoyé**. Le lecteur a23tests verts, mais sa recette Chrome de fichiers réels (mono/multi-image, vidéo, Échap/focus,320/375/1280) reste ouverte. Résoudre l’accès légitime au sélecteur de fichiers, sans modifier la garde des médias.
3. Contrôler la console après une navigation fraîche ; conserver l’erreur locale de session et le redémarrage automatique Next observé comme incidents locaux, pas comme preuve d’une recette finale propre.
4. Restituer le créneau au chat accueil pour ses contrôles3030 puis3031, ce dernier visible selon sa demande humaine. Aucun second serveur de développement en parallèle.

## Machine, coordination et mémoire

Les deux seuls caches DIASPORALE autorisés ont été retirés après serveur arrêté et lsof vide. Espace189612→862376Kio mesuré à ce passage, très fluctuant ; ce delta n’est pas attribué intégralement à ces caches. Le chat ANTSIA a ensuite retiré son Turbopack recréé sous un accord humain reçu dans son chat. Les nettoyages privés Gabon/SETRAG sont des opérations distinctes de leur propriétaire. Aucun autre nettoyage effectué par cette tranche.

ANTSIA possède ses cinq chemins de contrat/hook/tests/docs ; le chat accueil possède ses écrans/routes et autres traductions. Le contrôle commun inclut leurs sources gelées ; chaque commit garde sa propriété. Pas de push, fusion ni déploiement.

Cortex indisponible : Git du vault d’abord incomplet puis chemin disparu, confirmé par les chats et relu localement. Aucune réparation, recréation, suppression de verrou ni écriture mémoire effectuée. Ce document garde le bilan de reprise jusqu’au retour du vault.
