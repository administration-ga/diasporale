# DG-003 — Choix privés du fil

Date : 18 octobre 2026. État : **implémentation raccordée aux sources réelles ; vérifications différées à la demande du propriétaire**.

## Résultat utilisateur

La page **Réglages**, immédiatement après les adhésions, contient maintenant une rubrique **Mon fil** avec deux onglets :

- **Publications masquées** : aperçu autorisé, date du choix lorsqu'elle est connue, lien vers la publication et action **Ne plus masquer**.
- **Auteurs en sourdine** : identité autorisée ou ligne neutre, date du choix lorsqu'elle est connue et action **Ne plus mettre en sourdine**.

Les listes avancent et reviennent par pages de vingt choix. Elles disposent d'états de chargement, vide et erreur, d'un réessai local côté moteur et d'un retour de résultat. Un choix restauré est retiré de la fenêtre sans attendre un rechargement complet. Les textes sont disponibles en français et en anglais.

Adresse membre : `/parametres#mon-fil`, construite par `routes.settingsFeed()`.

## Raccordements

- `apps/diasporale_com/src/screens/settings-screen.tsx` monte réellement le nouveau composant `components/content-preferences-settings.tsx`.
- Le port de données expose la capacité optionnelle `contentPreferences`, ses lectures paginées et sa restauration par identifiant de choix.
- Le fournisseur moteur utilise les quatre fonctions de `ANTSIA/convex/modules/diaspora/contentPreferences.ts` : `paginateHiddenPosts`, `paginateMutedAuthors`, `restoreHiddenPost`, `restoreMutedAuthor`.
- Le fournisseur de démonstration porte la même capacité, avec un sélecteur pur dans `packages/diasporale-features/src/demo/content-preferences.ts`.

## Droits et effets

Chaque fonction du moteur est bornée par le réseau DIASPORALE, la session et son adhésion. `expectedPersonId` corrèle chaque demande au lecteur de l'écran. Les lectures sont bornées à cinquante lignes et deux Mio au maximum, vingt lignes étant demandées par l'application.

Une marque de masquage n'accorde aucun droit de lecture. La publication est relue par les gardes existantes ; les personnes ne sont nommées qu'après admission par l'annuaire opt-in du lecteur. Une publication de page est projetée sous l'identité de la page autorisée, jamais celle de son signataire. Un contenu retiré, une page inaccessible ou un profil non découvrable laisse une ligne neutre.

La restauration vise la ligne exacte du choix, dans la table et le réseau de la personne authentifiée. Elle ne crée ni relation ni suivi et n'envoie aucune notification. Une ancienne version ne retire pas un choix plus récent. Un choix devenu illisible peut être annulé sans rouvrir son contenu. Les quotas habituels `mark.toggle` et `mute.toggle` sont conservés.

Le rendu est isolé par fournisseur, personne, onglet et curseur. Les commandes répétées sont bornées, et une réponse arrivée après démontage n'affiche aucun retour dans le nouveau contexte. Une page refusée ne reprend pas ses détails depuis son ancien cache.

## Démonstration existante conservée

Les instantanés v7 restent au même format principal et ne sont pas réinitialisés. Les marques de masquage reçoivent une identité optionnelle ; les sourdines conservent leur tableau de paires et reçoivent des métadonnées parallèles. Les identités sont attribuées par séquence, indépendamment de l'horloge. Les anciennes sourdines sans date gardent la valeur inconnue `at = 0`, que l'interface n'affiche pas comme une date inventée.

Une restauration locale relit la session et ses droits avant et après la latence, y compris un changement A → B → A. Les masquages sont conservés comme choix neutres après retrait de la publication, alors que les signets suivent leur comportement antérieur.

## Limites de cette livraison

Le propriétaire a demandé de poursuivre l'implémentation et de laisser les vérifications. Aucune suite de tests, aucun typage, lint, build, codegen manuel ni recette navigateur n'a été exécuté pour ce lot. Le fichier backend `contentPreferences.test.ts` contient des scénarios préparés, sans résultat revendiqué.

Les précédents 7 212 tests ne couvrent pas ces nouveaux changements. La génération des références Convex et les contrôles du prochain état seront coordonnés avec le propriétaire du moteur lorsqu'ils seront repris. La preuve des deux photos demeure distincte et ne bloque pas l'écriture de cette tranche.

Aucun environnement, schéma ou droit n'a été élargi. Aucun push, déploiement de production, nettoyage, changement de session ou manipulation de données utilisateur n'a été effectué.
