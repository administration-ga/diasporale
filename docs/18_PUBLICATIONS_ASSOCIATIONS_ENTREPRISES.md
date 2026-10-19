# Publications des pages d’associations et d’entreprises

18 octobre 2026 — **implémentation locale, vérifications différées à la demande du propriétaire**.

## Périmètre

Les fiches, l’annuaire, la création, la revendication, l’équipe, les adhésions
associatives et le catalogue existaient déjà dans l’arbre partagé de la vague G.
Cette tranche complète leur parole publique ; elle ne remplace pas ces travaux.

- Sur `/pages/<handle>`, un signataire vivant disposant du droit de publier peut
  ouvrir « Publier au nom de… ». Le nom de la page est visible avant l’envoi.
- Le composeur existant est réutilisé : texte, photos/vidéo suivant les limites
  du moteur, textes alternatifs, clé d’idempotence et brouillon propre à la
  personne **et** à la page. Les dépôts passent par la même garde des fichiers.
- L’audience choisit tous les membres ou les abonnés de **cette page**, jamais
  les relations personnelles du signataire. La portée locale prend le pays de
  la page, relu par le fournisseur ; une page sans pays propose la diaspora.
- La visibilité suit la règle collective de la page. Aucune case individuelle
  « Publier aussi sur ANTSIA » n’est proposée dans ce composeur.
- Le mur utilise les curseurs réels de `pages.pagePosts`, par fenêtres de vingt,
  avec « Afficher plus », chargement, reprise et rebase des fenêtres réactives.
- Un signataire vivant peut retirer une publication de la page après confirmation,
  même s’il n’en était pas le déposant. Le serveur relit toujours son autorité.

## Raccordement

Capacité facultative `pagePublications` du port, dans
`packages/diasporale-features/src/data/page-publications-port.ts`.
Les fournisseurs moteur et démonstration portent leurs propres adaptateurs.
La fiche historique reste affichable pour un fournisseur sans cette capacité.

Le moteur consomme les fonctions existantes `pages.publishAsPage`, `pagePosts`
et `removePagePost` dans **DIASPORALE**. Aucun schéma ni module générique du
moteur n’est modifié par cette tranche. Le pays local doit être ouvert, comme
pour la publication personnelle ; le crochet de politique serveur de la tranche
reste une étape distincte. Le message de succès dit « envoyée » : la réponse
d’écriture ne prouve ni la visibilité après modération ni la délivrance d’un média.

Le mur réutilise la chaîne `feed-pages.tsx`. Ses actions de gestion collective
sont distinctes du menu d’édition personnelle. Les nouveaux textes français et
anglais vivent dans le fragment `page-publications`.

Dans la démonstration, les publications utilisent le magasin et les dépôts
existants. Le contexte de lecture joint les pages nouvellement créées sans les
réécrire dans le jeu persisté ; fiches, annuaire et hub les retrouvent. Les
abonnements et rôles vivants gouvernent l’audience « abonnés ». Le cache de
rejeu reste propre au lecteur et à la page, borné et réinitialisé avec la démo.
Ces comportements sont implémentés, sans recette exécutée.

## État de preuve

Aucun test, typage, lint, codegen, build ni parcours navigateur n’a été lancé
pour cette tranche. Aucun résultat antérieur ne valide ces nouveaux fichiers.
Aucune publication distante, aucun déploiement et aucune modification de
configuration ne sont inclus. Reprendre les contrôles seulement sur instruction
du propriétaire, en coordonnant le créneau avec ANTSIA et les autres sessions.
