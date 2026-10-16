# PD4 — Albums complets, puis stories en lecture seule

Demande du 16/10/2026. Branche locale `codex/pd4-stories-albums`, sources réelles,
installation et backend ANTSIA partagés. Aucun push ni déploiement de production.

1. Compléter les surfaces publiques des albums d'ANTSIA, après accord de sa session :
   pagination par curseur serveur (y compris pages filtrées vides), dédoublonnage et
   relecture réactive, remise à zéro au changement de lecteur/réseau/profil ; état
   d'erreur et reprise. Le propriétaire lit `paginateMyAlbums`, autrui la projection
   `paginatePersonAlbums`, sans fabriquer de droits côté client.
2. Rendre les brouillons et albums retirés retrouvables puis reprenables : charger
   `getAlbum`, conserver identifiants/photos/ordre/couverture existants, enregistrer
   titre/description/audience sur le même album, ajouter sans recréer ni perdre les
   photos. Édition réservée au propriétaire. Publier reste soumis au statut serveur.
   Le choix d'audience est expliqué dans le réseau fermé ; aucun pont racine implicite.
3. Retrait confirmé, attente et erreur traduites, retour à l'état retiré conservé
   pour son propriétaire ; refus identique pour les autres lecteurs. Aucun appel de
   suppression définitive d'album ou de fichier dans ce parcours.
4. Ensuite séparer lecture et création/interactions des stories dans les surfaces
   partagées : un membre en attente peut lire, sans composeur, réaction ou réponse.
   Monter ce contrat avec le réseau de lecture DIASPORALE ; l'accès direct à l'adresse
   de création ne doit pas le contourner. Conserver suspension, réseau et audiences.
5. Vérifier les contrats et composants montés : plusieurs pages dont une vide non
   terminale, changement d'identité, erreur/reprise, brouillon après rechargement,
   sauvegarde des métadonnées, audience/retrait entre lecteurs, lectures stories en
   attente et écritures refusées. Une seule tâche lourde et un seul frontend actifs.
6. Recette Chrome locale avec comptes fictifs : >12 albums, reprise après fermeture,
   audiences public/connexions, retrait et relecture entre comptes ; story réellement
   visible en attente et création fermée. Contrôler 320/375/1280 px, clair/sombre et
   console. Sérialiser avec la recette ANTSIA et rétablir les serveurs autorisés.
7. `bun run --cwd ../ANTSIA verify` avant commits par chemins explicites ; rapport de
   parité avec preuves et limites, jalons PD4 mis à jour, mémoire Obsidian actualisée.

Les images sont gardées par le moteur et réencodées avant dépôt ; aucun jeton, code
temporaire ni contenu consulaire ne doit apparaître dans les traces ou les notes.

Complément de recette du 16/10 : le plateau ne contient que soi, ses connexions et
les personnes suivies. Le compte fictif `pd4.lecture`, réellement en attente, ne
peut pas créer un abonnement via l’API normale (statut déclaré requis). Pour
vérifier un média réel sans modifier les droits, ajouter une graine interne
strictement locale : deux identités fictives fixes et leurs adresses vérifiées
relues, statuts existants exigés, création idempotente du seul abonnement de
recette et de son agrégat. Aucun profil, statut, consentement ou média modifié.
Exécuter cette préparation hors frontend, puis vérifier avec la vraie session
en attente ; conserver les refus normaux de création.
