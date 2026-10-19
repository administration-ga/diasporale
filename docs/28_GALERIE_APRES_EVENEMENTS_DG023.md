---
title: "DIASPORALE — Galerie après les événements associatifs"
date: "2026-10-18"
statut: "Sources raccordées ; contrôles différés sur instruction du propriétaire"
reference: "DG-023, tranche galerie après événement"
---

# Galerie après les événements associatifs

Suite des inscriptions, rappels et présences QR. Travail dans les sources servies, sans test, codegen, typage, lint, build, navigateur, serveur ni déploiement. Aucun commit applicatif avant reprise des contrôles obligatoires.

## Décisions et découpage

1. La galerie s'ouvre à la fin exacte d'un événement associatif publié et non annulé. Le lecteur doit conserver l'accès à l'événement ; la participation ou une ancienne publication ne donne aucun droit supplémentaire.
2. Les responsables vivants de l'association publient sous l'identité de la page. Quatre photos ou une vidéo seule par ajout, avec légende facultative et textes alternatifs ; médias obligatoires. Réutiliser le composeur, les règles de dépôt/analyse et la visionneuse existants.
3. La galerie conserve l'audience actuelle de l'événement et reste dans DIASPORALE. Aucun choix d'élargissement au réseau racine, aucune publication générale suivie d'un rattachement tardif : le rattachement est atomique à la création.
4. Le moteur réutilise posts avec un champ pageEventGalleryId distinct du champ d'annonce eventId. Le contenu est collectif : aucun propriétaire personnel dans la ligne de galerie. La modération appartient à la page, avec politique explicite ; le rôle du déposant est relu au geste.
5. La garde d'événement précède les exceptions auteur/page dans l'accès aux publications. Lectures unitaires, fil, recherche, partages et nouvelles projections de médias doivent repasser cette garde. Une URL de stockage déjà délivrée conserve les limites du service de fichiers existant ; aucune révocation rétroactive de copie n'est revendiquée.
6. Liste paginée sous curseur natif, retrait confirmé par un responsable vivant, sans suppression de blob dans ce lot. Aucun téléversement ni exposition de la liste des participants à leur insu. L'édition des légendes et les contributions des participants hors équipe restent distinctes.
7. Fournisseurs moteur et démonstration servis par la même capacité facultative events.gallery ; démo fictive dans le stockage d'activités existant, aucun nouveau registre indépendant. La démo réutilise les images admissibles et ne prétend pas prouver le dépôt vidéo réel.

Le coordinateur porte le domaine/port, les raccords communs des posts et la documentation ; un exécutant porte le module et les gardes de galerie, un autre les fournisseurs, un autre l'interface et l'adaptation circonscrite du composeur. Le chat pages garde ses rubriques partageables et ses fragments ; ANTSIA conserve les génériques/P12. Contrôles et recettes restent différés.

## Sources et comportement

| Couche | Raccord réel |
|---|---|
| Domaine | `packages/diasporale-domain/src/event-gallery.ts` : fin UTC inclusive et événement non annulé ; export du domaine |
| Port | `association-event-gallery-port.ts`, capacité facultative `events.gallery`, codes fermés et marqueur facultatif `PostView.eventGalleryId` |
| Moteur ANTSIA | `convex/modules/events/pageEventGallery.ts` et `pageEventGalleryAccess.ts` ; `posts/tables.ts` porte le lien optionnel et deux index préfixés réseau |
| Publications communes | `posts/access.ts` garde le parent avant les exceptions ; `postWrite.ts` crée atomiquement un contenu collectif ; modération de page explicite et projection `FeedItem` marquée |
| Fournisseurs | `engine-association-activities.ts`, `demo/association-activities.ts` ; lecteur attendu, requêtes paginées et erreurs du port |
| Interface | `association-event-gallery.tsx`, monté dans le détail de `association-events.tsx` ; ajout par `PostComposerSheet`, lecture par `PostMediaGrid`, retrait confirmé |
| Composeur et textes | Option facultative `page.fixedScope`, brouillon propre à personne/page/événement, portée et audience imposées ; fragments `event-gallery` français/anglais raccordés à `resources.ts` |

La liste moteur lit au plus cinquante lignes et deux Mio par fenêtre, sous curseur natif ; elle ne renvoie que des ajouts effectivement publiés après modération. Le reçu d'ajout n'est jamais présenté comme une preuve de visibilité. Les anciennes pages sans capacité `gallery` continuent leur parcours existant.

La garde actuelle vérifie personne, adhésion au réseau, page native d'association, état de l'événement et audience. Une ancienne inscription, un billet QR, un rôle retiré ou un ancien résultat de lecture ne sont pas des droits acquis. L'ajout ne contient aucun `authorPersonId` ; le responsable est seulement l'acteur du dépôt dans les contrôles existants. Aucune personne technique, nouvelle table personnelle, notification de mention ou diffusion aux abonnés n'est ajoutée.

Les publications de galerie peuvent être proposées par les surfaces générales du moteur sous les mêmes gardes. Leur marqueur masque l'édition/épingle/retrait ordinaires de page ; `pages.removePagePost` refuse ces lignes. Le retrait dédié relit le parent et le mandat, vérifie le couple événement/publication et utilise le retrait logique existant. L'édition de légende reste une extension distincte.

Une requête Convex ne se réveille pas au seul passage du temps : la vue change une fois sa clé de relecture à la fin locale et offre « Actualiser » si le serveur refuse encore l'ouverture. Cette clé ne donne aucun droit ; seule l'heure serveur décide. Un refus de lecture ferme les médias précédents, y compris après une erreur transitoire : le refus reste affiché jusqu'à « Réessayer », qui repart de la première fenêtre sans restaurer les anciennes images pendant le chargement. Un changement de personne, événement, audience ou mandat remonte le contexte concerné et neutralise les retours d'écriture tardifs.

La démonstration garde les ajouts collectifs dans son état d'activités existant v1 et consomme les références d'images du magasin commun sans créer une publication personnelle parallèle. Toutes les références sont jugées avant consommation ; un dépôt déjà utilisé ne peut pas servir à une autre publication. Les données restent fictives dans ce navigateur ; la vidéo réelle relève du fournisseur moteur.

## Contrôles écrits, à exécuter ultérieurement

- Fin exacte, avant/après et annulation ; une clé de rafraîchissement forgée n'avance jamais l'heure serveur.
- Lecture réseau/adhérents, membre en attente autorisé, perte d'adhésion, page masquée, événement privé/retiré et réseaux étrangers ; aucune exception auteur/signataire.
- Mandat vivant, publication collective, absence de diffusion racine, médias obligatoires, quatre photos ou vidéo seule, métadonnées réelles et admission des fichiers.
- Rejeu de clé sans second ajout ni nouvelle consommation ; contenu différent en conflit ; références de démo invalides conservées et références admises non réutilisables.
- Pagination bornée, fenêtre vide avec suite, suppression des anciennes lignes après erreur/retrait d'accès ; démontage de la visionneuse et de la confirmation.
- Brouillon au bon contexte, choix d'audience absents, portée imposée, texte alternatif et retour tardif après fermeture ou perte de rôle.
- Retrait confirmé, retrait répété, événement/publication étrangers et refus de la porte générique de page.

Aucun test, codegen, typecheck, lint, build, contrôle navigateur ou appel HTTP n'est exécuté dans cette tranche. Aucun serveur n'est démarré/arrêté et aucun environnement n'est modifié. Les scénarios ne constituent pas des résultats ; les preuves historiques ne valident pas ces sources. Aucun commit applicatif avant les contrôles communs obligatoires.

## Limites et suite DG-023

La révocation d'une audience bloque les nouvelles lectures et nouvelles restitutions des médias par l'application. Une URL brute de stockage déjà délivrée, un téléchargement ou une capture suivent les limites du service de fichiers existant ; ce lot ne fournit pas de révocation rétroactive. La conservation d'un fichier après effacement de son déposant reste soumise aux règles de stockage/effacement existantes ; aucune rétention supplémentaire n'est revendiquée.

Contributions des participants hors équipe, édition des légendes, export de médias, téléchargement groupé et notifications de nouvel ajout sont hors de cette tranche. [iCal et agenda personnel](29_EXPORT_ICAL_AGENDA_ASSOCIATIF_DG023.md) sont ajoutés ensuite en sources, sans contrôles. Recettes médias/QR, réception des rappels et imports iCal réels restent à prouver ; DG-023 et PD7 ne sont pas clôturés.
