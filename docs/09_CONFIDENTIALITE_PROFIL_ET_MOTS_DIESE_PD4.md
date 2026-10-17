# PD4 — Confidentialité du profil, retrait et mots-dièse

État : tranche du 17 octobre 2026 implémentée et recettée dans Chrome ; dernière vérification complète verte sur la branche locale `codex/pd4-stories-albums`.

## Objectif et limites

Ajouter aux réglages réels le mode privé, le retrait et la republication explicite du profil commun ANTSIA/DIASPORALE. Compléter PD4 avec les mots-dièse cliquables et le fil filtré paginé. Corriger le raccord distinct « Quitter DIASPORALE », actuellement branché sur une révocation de consentement.

Le profil est global : ses commandes personnelles n'acceptent pas de `networkId`. L'annuaire et les visibilités de facette restent propres à DIASPORALE. Toutes les lectures sociales du fil conservent le réseau DIASPORALE et les gardes existantes. Aucun nouveau backend, import privé, changement d'environnement ou opération de production.

## Contrat fonctionnel

- **Privé** : retrait de la découverte et refus des nouveaux abonnements/demandes entrants ; lien connu, publications et relations existantes conservés. Expliquer la portée dans les deux applications.
- **Retirer le profil** : confirmation explicite, fiche publique indisponible, auteurs rendus neutres ; identité réservée, médias, contenus, relations, adhésions et consentements conservés. Ce geste ne quitte pas DIASPORALE.
- **Republier** : confirmation distincte depuis les réglages toujours accessibles ; retransmettre l'identité et l'accroche conservées, conserver le choix privé et les choix d'annuaire. Aucun onboarding ni consentement implicite. Une publication acceptée ne garantit pas sa visibilité immédiate : la modération reste souveraine.
- **Quitter DIASPORALE** : appeler `diaspora.membership.leaveDiasporale`, sans retirer le profil global ni révoquer un consentement global. Le compte et l'adhésion ANTSIA restent ; le parrainage reçu prend fin selon le moteur.
- **Mots-dièse** : liens clavier conservant la casse affichée et utilisant le jeton canonique du moteur. Le filtre restreint le fil autorisé, conserve portée/pays, dispose d'un retrait explicite, participe à l'identité de pagination et garde les pages vides continuables.

## Raccord et propriété des fichiers

1. Données personnelles et parité démonstration : capacité optionnelle `profilePublication` du port, DTO propriétaire dédié (jamais ajouté au DTO public), lecture `getMyPerson`, trois commandes explicites. Adaptateurs moteur/démo, prédicats de publication/découverte, départ distinct, tests associés. La persistance démo existante est conservée avec champs rétrocompatibles, sans remise à zéro.
2. Surface locale : nouveau panneau de réglages et tests ; états chargement/erreur/absent/publié/retiré, verrou immédiat commun aux commandes, confirmations fermées sur changement d'état ou de lecteur, erreurs traduites et réessai. Les gestes personnels de protection ne dérivent pas du droit de publier dans le réseau.
3. Complément du fil : `RichText`, routage, écran et pagination ; ensuite transport `tag` dans le port et les deux adaptateurs, avec tests de restriction et d'identité du curseur. Les fichiers d'adaptateurs sont modifiés séquentiellement après le lot personnel.
4. Intégration principale : montage dans les réglages, retour vers les réglages lorsque son profil retiré est indisponible, textes FR/EN, correction du départ, revue et preuves.

Les sous-agents travaillent sur des responsabilités explicites dans le même répertoire ; aucun changement voisin n'est annulé. Le moteur et ses surfaces communes restent à ANTSIA. Coordination avant tout créneau lourd et toute bascule du serveur 3032.

## Concurrence et confidentialité

La lecture propriétaire est corrélée à la personne de la session. Chaque commande relit la personne avant l'écriture et refuse un changement de lecteur. La republication reprend les champs actuels côté adaptateur, jamais un ancien formulaire public. Aucun résultat tardif ne rouvre une confirmation ni n'annonce une réussite à une nouvelle personne. Le moteur ne fournit pas de version atomique : les écritures simultanées entre sessions restent ordonnées par leur arrivée ; aucune garantie de comparaison de version n'est revendiquée.

L'aperçu existant ne simule que la facette d'un membre actif d'un autre pays sans relation. Il ne prouve pas la vue de tout public ; son texte doit le dire. Les images de profil retenues restent protégées, même en présence d’une URL incohérente. Aucun nom civil n'est déduit du nom affiché libre.

La revue de cette tranche ajoute deux fermetures nécessaires : une réponse de départ après changement de personne ne produit plus d'avis ni de navigation ; un refus d'accès au fil ou au mur retire les anciennes cartes mises en cache et ne les réexpose qu'après une lecture fraîche autorisée. Les pannes transitoires conservent les contenus encore autorisés. Un auteur neutralisé reste sans lien, nom retenu ou badge dans la carte et ses commandes.

## Vérification prévue

- Tests ciblés : privé/retrait/republication, conservation des données et des choix, lecteur changé, double geste, refus/réessai, état démo ancien, départ distinct, liens Unicode, filtres et curseurs.
- Vérification complète du moteur : `bun run --cwd ../ANTSIA verify`, après disponibilité Convex et dans un créneau sans autre traitement lourd. Aucune hausse des délais des tests.
- Chrome réel : compte fictif existant, privé puis retour au réglage initial, retrait confirmé puis republication explicite, accroche/adhésion conservées, commandes accessibles après retrait ; mot-dièse, retrait du filtre et pagination. Contrôles clavier et largeurs 320/375/1280, clair/sombre, console.
- Ne pas exécuter un départ réel sur le compte de recette partagé : contrat vérifié par tests ; aucune suppression de données ou session. Restaurer serveur et émulation avec leurs propriétaires.
- Commits locaux par chemins explicites seulement après la vérification complète ; mise à jour du Cortex et du présent document avec les preuves et limites observées.

## Suite PD4

Cette tranche ne clôt pas tout PD4. Visionneuse complète des médias, modification des commentaires et édition de l’identité sociale sans republication incidente demandent encore un raccord approprié ; ces écarts restent au plan principal et ne sont pas annoncés livrés ici.

## Recette Chrome réellement jouée

- Compte fictif existant, session conservée : privé enregistré, profil encore accessible par son adresse connue ; retrait confirmé, fiche indisponible avec lien de retour vers ses réglages. Trente publications déjà présentes restent dans le fil avec auteur « Un membre », sans lien d'auteur ni badge.
- Réglages toujours accessibles : privé désactivé puis réactivé pendant le retrait, sans republication ; republication explicitement confirmée, mode privé conservé après rechargement. Identifiant et nom affiché inchangés, publications relisibles, adhésion et consentement social conservés. L'annuaire est resté masqué. Le choix privé initial désactivé a finalement été rétabli.
- Confirmation : focus initial sur Annuler ; Échap ferme et rend le focus au déclencheur. Le lien de mot-dièse est activable par Entrée et garde la casse affichée avec jeton canonique accentué dans l'URL.
- Une publication fictive locale a été créée par le composeur avec `#ConfidentialitéPD4`, portée diaspora, sans publication racine. Fil récent : 30 puis 60 cartes uniques ; activation du mot-dièse après cette seconde page : une seule carte correspondante, anciennes pages absentes. Filtre négatif : état vide spécifique et aucune carte.
- Pays Canada et portée conservés dans les liens ; retrait du filtre supprime seulement le tag. Le fil filtré de cette recette n'a qu'une correspondance : les multiples pages filtrées et les fenêtres vides continuables sont couvertes automatiquement, sans être revendiquées comme recette Chrome multi-page filtrée.
- 320 px sombre, 375 px clair et 1 280 px sombre : absence de débordement mesurée après correction du sélecteur d'apparence (il dépassait de 5 px à 320). Feuilles et carte filtrée inspectées visuellement. Console finale sans erreur.
- Aucune recette Chrome croisée des annuaires ou du départ réel n'est revendiquée ; contrats et projections couverts par les tests. Aucun média ou session supprimé ; la publication fictive de recette reste locale.
- Next3031 arrêté code0, backend3210 conservé. Après reconnexion du navigateur, onglet vide et émulation supprimée confirmés, dimensions initiales 1 280×690 et préférence sombre restaurées. Créneau CPU restitué après le dernier contrôle ; confirmation du retour de la console ANTSIA attendue de son propriétaire.

## Vérification finale du snapshot recetté

- `bun run --cwd ../ANTSIA verify` terminé **code0** après la correction responsive : **6 909 tests**, dont **1 124 DIASPORALE** (238 domaine, 309 features, 577 application), dix espaces typés et neuf lints sans erreur. Les 123 nouveaux cas sont inclus. Les avertissements préexistants sont conservés ; les deux avertissements introduits sur les marqueurs de contexte ont été corrigés.
- Journal local : `/tmp/diasporale-pd4-privacy-tags-verify-chrome-final.log`. Les **36 fichiers source** sont identiques au gel avant/après cette dernière passe. Moteur de référence `24d28240e6501582ddc248421e210a541d8e5af1`, avant les nouvelles écritures PA8 coordonnées.
- Bun1.4.2, Node25.9.0 pour la chaîne standard ; le lanceur du moteur choisit Node22.22.3 pour la génération Convex. Aucun préfixe manuel de PATH ; GOMAXPROCS2, heap1536Mio, contrôles sérialisés. Délais de tests inchangés.
- Backend local conservé avec analyse concurrente1 et budget d'analyse15s hérités du créneau précédent ; UDF1s inchangé. Cette preuve locale ne prouve ni le budget d'analyse par défaut4s, ni une livraison de production.
- Historique du contrôle : une passe interrompue volontairement pour les cas de revue, puis une passe verte avec deux avertissements nouveaux corrigés, une passe verte avant Chrome et cette passe verte finale après le retour à la ligne du sélecteur. Aucun échec masqué ni assertion assouplie.
- CPU et Chrome restitués aux quatre chats autorisés avant les commits et le Cortex. Aucun nouveau nettoyage, changement d'environnement, envoi distant du code ou opération de production.
