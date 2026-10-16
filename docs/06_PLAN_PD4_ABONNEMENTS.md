# PD4 — Mes abonnements et désabonnement en attente

Suite autorisée le 16/10/2026, après vérification PA5 et commit du complément de recette
albums/stories. Sources réelles de DIASPORALE et surfaces publiques du moteur ANTSIA.
Aucun push ni publication de production.

## Objectif et périmètre

Rendre mes abonnements consultables depuis `/relations?onglet=abonnements`, en réutilisant
la liste existante du moteur et son API publique. Un membre en attente peut consulter
sa liste et retirer son propre abonnement ; il ne gagne aucun droit de s’abonner,
publier ou communiquer. L’annuaire reste celui de la tranche diaspora, sous opt-in.

La gestion des déblocages attend une query publique spécifique des blocages émis par
l’appelant ; ne pas exposer le helper bidirectionnel interne. Hors de cette tranche :
la liste de mes abonnés, les demandes envoyées, PD5/PD6 et toute refonte de PeoplePanel.

## Exécution

1. Terminer le contrôle commun PA5, puis committer par chemins explicites le complément
   de graine locale et les trois documents de recette, sans embarquer les fichiers PA5.
2. Propriété accordée par ANTSIA après la vérification commune : exposer la carte des
   abonnements seule, avec ses styles, sans monter PeoplePanel ni sa recherche générique.
   Lecture `graph.follows.paginateMyFollows` et mutation `unfollow`, réseau injecté.
3. Conserver toutes les pages abonnées avec leurs curseurs natifs. Dédoublonner par personne,
   continuer après page vide non terminale, rebaser les descendants quand une frontière
   change ; erreur/reprise sans perdre les données valides. Réinitialiser au changement
   de lecteur ou de réseau. Ne pas modifier les autres paginateurs de PeoplePanel.
4. Conserver le rendu neutre des profils non publiés, sans lien fabriqué. Désabonnement
   verrouillé immédiatement par ligne ; retirer seulement après succès, traduire le refus,
   permettre une reprise. État vide avec destination explicite vers `/membres`, hors recherche
   générique. Décompte éventuel des abonnés agrégé, jamais liste d’abonnés exposée.
5. Ajouter le troisième onglet adressable de `/relations`, son état actif et le raccord
   au contexte réseau de lecture ; attendre si la personne de ce contexte ne correspond
   pas à l’adhésion courante. Démonstration et contexte moteur manquant : état fermé
   traduit. Ajouter les clés françaises/anglaises nécessaires.
6. Corriger le bouton du profil : ne plus suivre reste accessible en attente ; suivre
   et demander une connexion gardent le droit de communiquer. Gardes serveur inchangées.

## Preuves attendues

- Tests de la surface réelle : pages multiples/réactives, frontière déplacée, doublons,
  page vide non terminale, erreur/reprise, retrait réussi/refusé, double clic, identité/réseau,
  libellé neutre et destination vide. Aucun appel de recherche ou lecture d’abonnés.
- Tests du raccord monté : adresse, onglet actif, réseau/identité, lecture en attente,
  absence en démonstration et contextes fermés ; profil en attente autorisé à se désabonner
  mais interdit de suivre. Parité des traductions.
- Une seule tâche lourde et un seul frontend. Recette Chrome locale avec comptes fictifs :
  liste de l’abonnement de lecture existant, désabonnement réel en attente, relecture de
  sa disparition, bouton suivre fermé ; 320/375/1280 clair/sombre et console finale.
- Vérification commune complète avant commits, rapport de parité et mémoire Obsidian
  actualisés. Les preuves locales ne constituent pas une livraison de production.

## Origine du paginateur

`follows-pagination.ts` adapte le patron interne
`packages/social-features/src/features/reseau-albums/albums-pagination.ts` au commit
ANTSIA `8d4754d`, relu pendant cette tranche. L'en-tête indique cette adaptation interne
avec chemin, commit et différences. Le registre `KNOWN_SOURCE_COMMITS` reste consacré aux
copies du socle externe : aucun hash fictif ni élargissement de ce cliquet. La première
passe a relevé cette distinction d'en-tête ; la passe finale doit repasser tous les contrôles.

## Réalisation et recette

Les six étapes sont implémentées dans les sources réelles. La recette locale du compte
fictif en attente a montré un abonnement, son retrait public persistant après reload,
puis le bouton Suivre désactivé sur le profil. Pagination multiple, pages vides, erreurs,
refus et réponses périmées : tests de composants, pas une liste Chrome artificiellement
remplie. 320 sombre / 375 clair / 1 280 sombre vérifiés ; onglet actif mis en vue sur sa
piste, sans déplacement de la page. Aucun nouveau warning/erreur dans la navigation finale.
L'onglet créé est fermé, viewport et thème initial restaurés. Vérification finale : 6 268
tests, code 0 ; typages et lint sans erreur. Surface partagée committée dans ANTSIA
`d2a782b`. DIASPORALE 3031 arrêté, ANTSIA 3030 rétabli (`/entrer` HTTP 200), seul frontend ;
backend 3210 conservé. Preuves détaillées : `docs/04`.

Restent hors de cette tranche : demandes envoyées/annulation, gestion des déblocages
(contrat backend public préalable), réouverture des suggestions masquées, puis PD5/PD6.
