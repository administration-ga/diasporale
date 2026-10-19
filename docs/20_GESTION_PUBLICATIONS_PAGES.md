# Gestion des publications des associations et entreprises

18 octobre 2026 — **implémentation locale, sans vérifications sur demande du propriétaire**.

## Parcours

- L’espace de gestion d’une page propose un onglet « Publications », accessible
  aussi depuis « Mon activité → Pages ». Il utilise le même mur paginé et le
  même composeur que la fiche ; aucun second stock de publications n’est créé.
- Un signataire vivant autorisé à publier peut modifier le texte d’une
  publication native de sa page, y compris s’il n’en était pas le déposant.
  Le rôle historique ne suffit jamais. Les miroirs fédérés sont refusés.
- Le geste conserve les médias, leur ordre, l’audience, la portée et l’identité
  de la page. Un texte vide reste possible si un média porte la publication.
- La version lue est figée à l’ouverture : texte et date d’édition. Le serveur
  compare ces deux valeurs dans la transaction avant une modification effective.
  Une réponse perdue se rejoue sans nouvelle écriture si le texte demandé est
  déjà présent et que les gardes de statut et d’autorité sont toujours satisfaites.
- En cas de conflit, le brouillon saisi est conservé. Un geste explicite propose
  de le remplacer par le texte actuel, après réception de cette nouvelle version ;
  la mise à jour réactive seule ne réinitialise jamais le formulaire.
- L’édition passe par la politique de modération. Le retour dit « envoyée »,
  sans prétendre que le contenu est immédiatement visible.

## Contrats

`PagePublicationsCapability.edit` est facultatif ; les anciens fournisseurs
gardent la lecture, la publication et le retrait sans faux bouton d’édition.
`PostView.editedAt` est ajouté de manière compatible et renseigné par les
projections moteur/démonstration. Les contrôles d’édition de la page restent
distincts du menu personnel d’une publication.

Le moteur expose `pages.editPagePost`, dans le périmètre générique cédé par le
coordinateur ANTSIA. La mutation réutilise les aides de contenu, de recherche,
de mentions et de modération. Le conflit générique est traduit en
`page_post_changed` seulement dans cette action DIASPORALE.

Une modification effective ajoute `page.post_edit` au journal du moteur dans
la même transaction : acteur, qualité, page, publication et date, sans garder
le corps du texte. L’énumération canonique d’audit reçoit ce seul verbe ; son
validateur en dérive. Un signataire non administrateur est journalisé comme
membre, avec son rôle réel en détail, sans lui attribuer la qualité d’administrateur.
Le rejeu sans changement n’ajoute pas de ligne.

La démonstration applique le même mandat, la comparaison de version et les
règles du texte dans son magasin existant. Aucun média n’est redéposé ni effacé.
Les textes français/anglais vivent dans le fragment `page-post-editing`.

## État de preuve

Aucun test, typage, lint, codegen, build ou parcours navigateur n’a été lancé.
Aucun commit applicatif, push, déploiement ou changement d’environnement.
Les preuves des tranches précédentes ne valident pas ces nouveaux ajouts.
