# Plan 08 — Évènements et agenda

> Constaté par lecture du code d'`origin/main` (DIASPORALE `bead76d`, ANTSIA `fd58d73b`), le 10 novembre 2026. Rien n'a été exécuté : ni test, ni recette, ni publication.
> Applications de référence : Meetup, Eventbrite, Luma, Évènements Facebook, Partiful, HelloAsso. Comparaison faite de mémoire, sans revérification en ligne ; un « ? » marque ce qui n'est pas sûr.
> Ce plan détaille, pour les évènements et l'agenda, le plan 15 du dossier de finalisation d'ANTSIA. Les lots qu'il en reprend gardent leur identifiant (DS-…, DG-…) ; les lots nouveaux portent le préfixe `EV-`.

Légende des chemins : `D:` = dépôt DIASPORALE, `A:` = dépôt ANTSIA. « Écran » = atteignable depuis l'interface de diasporale.com ; « Moteur » = la fonction existe côté serveur.
Dans le texte : « plan NN du moteur » désigne le dossier d'ANTSIA du 9/11 ; « plan NN de ce dossier » désigne les plans DIASPORALE du 10/11. Le dossier `A:convex/modules/events/` appartient à la session S1 : toute modification y passe par une issue `[S1]`.

## 1. L'intention du propriétaire

- **Pour qui** : les associations qui organisent (persona P3), les postes consulaires (P7), les membres établis et les nouveaux arrivants qui participent (P1, P2). Source : cahier § 6.1 ; fiche F03 du dossier produit.
- **Quoi** : un agenda personnel hérité du moteur, plus des évènements communautaires dont l'organisateur est une personne, une association ou une page officielle, avec capacité, date limite, liste d'attente, rappel la veille, code QR de présence et galerie (cahier § 8.8, EXF-DG-27 et EXF-DG-28). Le direct d'un évènement vient en V2 (EXF-DG-29).
- **Pourquoi maintenant** : « faire vivre une association » est le deuxième résultat prioritaire du plan global (docs/14 de DIASPORALE, § 1.1). Le pilote avec inscriptions attend cette tranche (docs/14, § 1.3).
- **Le parcours de référence** : R7 du cahier. Une association crée la soirée du 17 août, 150 places ; les membres de France la voient, s'inscrivent, reçoivent le rappel et un QR ; un membre du Canada ne la voit que si elle est ouverte à toute la diaspora.
- **Le pays reste le contexte** : tout contenu porte un pays ou la portée « diaspora » (cahier § 5, invariant 7). Les instants se lisent dans le fuseau de l'évènement et dans celui du lecteur (docs/14, § 7.1 ; recette R-G21).
- **Déjà décidé** (docs/21, 22, 24, 27, 28, 29 de DIASPORALE ; décisions du vault du 18/10) : évènement sous l'identité de la page, sans propriétaire personnel ; inscription volontaire, jamais d'office ; file d'attente dans l'ordre d'arrivée, sans choix de l'organisateur ; aucun nom d'inscrit montré ; rappel facultatif, décoché ; billet opaque de 15 minutes, présence confirmée par un responsable ; galerie publiée par l'équipe ; export iCal ponctuel, sans abonnement. La matrice des droits est au registre (docs/17, § 4). Le bouton « Afficher mon billet QR » passe en famille commerce (décision du 9/11, lot DS-02).
- **Refusé ou fermé** : billetterie payante et cotisations (D-G03, lot D4) ; adresse privée dans le lieu ; contrôle hors ligne et export d'émargement (docs/27) ; lien de visio externe (plan 07 du moteur, décision 9) ; publication directe dans un pays qui n'a pas encore son équipe de modération (cahier § 5, invariant 10).
- **Ce qui se mesure** : le tableau du pilote compte les inscriptions et les présences (F03 : inscrits, puis présents).

## 2. Ce qui existe

| # | Capacité | État | Écran | Moteur | Preuve |
|---|---|---|---|---|---|
| | **Créer et gérer un évènement d'association** | | | | |
| 1 | Créer un évènement sous l'identité de la page (titre, description, lieu) | Présent | oui | oui | `D:apps/diasporale_com/src/components/association-event-form.tsx` ; `A:convex/modules/events/pageEvents.ts` (`create`) |
| 2 | Évènement d'une page d'entreprise ou d'une page officielle | Fermé (ouvre : PG-03 du moteur, natures de page admises) | non | non | `A:convex/modules/events/pageEventAccess.ts` (`associationEventPage` : association seulement) |
| 3 | Audience au choix : adhérents (défaut) ou tous les membres de DIASPORALE | Présent | oui | oui | `A:convex/modules/events/tables.ts` (`pageAudience`) |
| 4 | Fuseau choisi, heures saisies dans ce fuseau, stockées en temps universel | Présent | oui | oui | `D:apps/diasporale_com/src/components/association-event-form.tsx` |
| 5 | Heure inexistante ou ambiguë au changement d'heure : refusée | Présent | oui | oui | `D:packages/diasporale-domain/src/service-requests.ts` (`zonedWallTimeToUtc`) |
| 6 | Modifier sous version attendue (deux responsables ne s'écrasent pas) | Présent | oui | oui | `A:convex/modules/events/pageEvents.ts` (`update`) |
| 7 | Reporter : changer la date quand une inscription existe | Absent (refus `association_event_schedule_locked`) | non | non | `A:convex/modules/events/pageEvents.ts` (`update`) |
| 8 | Annuler : l'évènement reste visible, marqué annulé | Présent | oui | oui | `A:convex/modules/events/pageEvents.ts` (`cancel`) |
| 9 | Motif d'annulation | Absent | non | non | motifs : `cancelReason`, `cancellationReason`, `motif` dans `A:convex/modules/events/pageEvents.ts` |
| 10 | Brouillon avant publication | Absent | non | non | deux statuts seulement : `A:packages/social-domain/src/events.ts` (`PERSONAL_EVENT_STATUSES`) |
| 11 | Dupliquer un évènement | Absent | non | non | motifs : `duplicate`, `dupliquer`, `clone` |
| 12 | Image de couverture | Absent | non | non | motifs : `coverImage`, `cover`, `banner` dans `A:convex/modules/events/tables.ts` |
| 13 | Catégorie de l'évènement | Partiel : la carte fictive du hub en a cinq, l'évènement d'association aucune | démo | non | `D:packages/diasporale-features/src/data/types.ts` (`EVENT_CATEGORIES`) |
| 14 | Lieu | Partiel : texte libre de 200 caractères ; ni ville séparée, ni adresse structurée, ni carte | oui | oui | `A:packages/social-domain/src/events.ts` (`PERSONAL_EVENT_LOCATION_MAX_LENGTH`) ; consigne « pas d'adresse privée » : `D:packages/diasporale-features/src/i18n/locales/fr/association-activities.json` |
| 15 | Évènement en ligne (lien de visio ou conférence rattachée) | Absent | non | non | motifs : `meetingUrl`, `onlineUrl`, `liveSessionId` |
| 16 | Co-organisation par deux pages | Absent | non | non | motifs : `coOrganizer`, `coHost` ; un seul `organizerPageId` |
| 17 | Récurrence | Absent | non | non | motifs : `rrule`, `RRULE`, `recurr` |
| 18 | Relecture avant publication tant qu'aucune politique n'est posée pour la surface `event` | Présent | oui | oui | `A:convex/modules/moderation/policy.ts` (`moderatePageContentWrite` : sans politique, `pending_review`) |
| 19 | « En attente de modération » visible de l'équipe seule | Présent | oui | oui | `A:convex/modules/events/pageEventAccess.ts` (`pageEventAccess`) |
| 20 | Débit et idempotence, par personne et par page | Présent | — | oui | `A:convex/lib/rateLimit.ts` (`event.create`, `event.manage`, `event.respond`, `event.attendance`) |
| | **S'inscrire** | | | | |
| 21 | Demander une place (membre déclaré ou vérifié), sans doublon au double clic | Présent | oui | oui | `A:convex/modules/events/pageEvents.ts` (`register`) |
| 22 | Capacité facultative de 1 à 10 000, places restantes affichées | Présent | oui | oui | `D:packages/diasporale-domain/src/event-capacity.ts` |
| 23 | Liste d'attente dans l'ordre d'arrivée, rang personnel | Présent | oui | oui | `A:convex/modules/events/pageEventRegistrations.ts` (`registerPageEventParticipation`) |
| 24 | Place attribuée automatiquement quand une place se libère | Présent | oui | oui | `A:convex/modules/events/pageEventRegistrations.ts` (`fillPageEventSeatsNow`) |
| 25 | Avis « votre place est confirmée » | Absent | non | non | `A:convex/modules/events/pageEventRegistrations.ts` (`fillPageEventSeatsNow` ne programme que le rappel) |
| 26 | Date limite d'inscription, réouverture qui garde l'ordre | Présent | oui | oui | `D:packages/diasporale-domain/src/event-timing.ts` |
| 27 | Retirer son inscription ou sa demande | Présent | oui | oui | `A:convex/modules/events/pageEvents.ts` (`unregister`) |
| 28 | Accompagnants (plusieurs places par inscription) | Absent | non | non | motifs : `guest`, `plusOne`, `accompagn` ; une ligne par personne |
| 29 | Questions à l'inscription | Absent | non | non | motifs : `registrationForm`, `questions`, `customField` |
| 30 | « Intéressé » sans s'inscrire | Absent | non | non | motifs : `interested`, `intéressé` |
| 31 | Liste des inscrits pour l'équipe | Absent, par décision : compteurs seuls | non | non | `A:convex/modules/events/events.ts` (`paginateEventParticipants` refuse un évènement de page) |
| 32 | Message de l'organisateur aux inscrits | Absent | non | non | motifs : `broadcast`, `announcement`, `organizerNote` |
| | **Rappels et avis** | | | | |
| 33 | Rappel personnel 24 heures avant, facultatif, décoché par défaut | Présent | oui | oui | `A:convex/modules/events/pageEventReminders.ts` (`setReminder`, `deliverPageEventReminder`) |
| 34 | Rappel écrit dans la cloche, sans titre ni lieu, droits relus à l'envoi | Présent | oui | oui | `A:convex/modules/events/pageEventReminderAccess.ts` ; `D:packages/diasporale-features/src/components/notification-bell.tsx` |
| 35 | Rappel reçu sur l'appareil (push, e-mail) | Absent ici : aucun push dans DIASPORALE (plan 13 de ce dossier) | non | partiel | l'écran le dit : « ne garantit pas la réception », `D:packages/diasporale-features/src/i18n/locales/fr/association-activities.json` |
| 36 | Autre délai de rappel, ou plusieurs rappels | Absent | non | non | un seul délai : `D:packages/diasporale-domain/src/event-timing.ts` (`ASSOCIATION_EVENT_REMINDER_LEAD_MS`) |
| 37 | Avis aux inscrits quand l'évènement est annulé | Absent | non | non | `cancel` n'écrit aucun avis ; un seul genre d'avis pour un évènement de page : `A:packages/social-domain/src/notifications.ts` |
| 38 | Avis aux abonnés ou aux adhérents d'un nouvel évènement | Absent | non | non | `A:convex/modules/pages/followedUpdates.ts` ne lit aucun évènement |
| | **Le jour de l'évènement** | | | | |
| 39 | Billet QR personnel, opaque, valable 15 minutes, renouvelable | Présent | oui | oui | `A:convex/modules/events/pageEventAttendance.ts` (`issueTicket`) |
| 40 | Fenêtre d'accueil : d'une heure avant le début jusqu'à la fin | Présent | oui | oui | `D:packages/diasporale-domain/src/event-attendance.ts` |
| 41 | Lecture du billet par la caméra du contrôleur | Partiel : seulement si le navigateur offre `BarcodeDetector` ; aucun lecteur de repli | oui | — | `D:apps/diasporale_com/src/components/association-event-camera.ts` |
| 42 | Saisie du code à la main en secours | Partiel : le code fait 89 caractères | oui | oui | `D:packages/diasporale-domain/src/event-attendance.ts` (`parseAssociationEventAttendanceCode`) |
| 43 | Aperçu puis confirmation par un responsable ; un second scan ne compte pas deux fois | Présent | oui | oui | `A:convex/modules/events/pageEventAttendance.ts` (`previewTicket`, `checkIn`) |
| 44 | Plusieurs contrôleurs en même temps | Présent | oui | oui | tout signataire vivant : `A:convex/modules/events/pageEventAccess.ts` (`canManagePageEvent`) |
| 45 | Corriger un pointage ; relevé des présents réservé à l'équipe | Présent | oui | oui | `A:convex/modules/events/pageEventAttendance.ts` (`clear`, `listPresent`) |
| 46 | Pointer un inscrit sans billet (téléphone éteint) | Absent | non | non | `A:convex/modules/events/pageEventAttendance.ts` (`checkIn` exige un code) |
| 47 | Contrôle hors ligne ; export de l'émargement | Absent, par décision (docs/27 de DIASPORALE) | non | non | motifs : `offline`, `csv`, `exportAttend` |
| 48 | Rôle « contrôleur » sans droit de gestion | Absent | non | non | tout signataire a tous les droits ; rôles de page : PG-08 du moteur |
| | **Après l'évènement** | | | | |
| 49 | Galerie ouverte à la fin, publiée sous l'identité de la page | Présent | oui | oui | `A:convex/modules/events/pageEventGallery.ts` (`publish`, `list`) ; `D:apps/diasporale_com/src/components/association-event-gallery.tsx` |
| 50 | Quatre photos ou une vidéo par ajout, légende, textes alternatifs | Présent | oui | oui | `D:packages/diasporale-features/src/data/association-event-gallery-port.ts` |
| 51 | Retrait d'un ajout par l'équipe | Présent | oui | oui | `A:convex/modules/events/pageEventGallery.ts` (`remove`) |
| 52 | Photos déposées par les participants | Absent | non | non | hors tranche (docs/28 de DIASPORALE) ; le dépôt exige l'équipe : `A:convex/modules/events/pageEventGallery.ts` (`publish`) |
| 53 | Demander le retrait d'une photo où l'on apparaît | Absent | non | partiel | aucun geste sur un ajout : `D:apps/diasporale_com/src/components/association-event-gallery.tsx` |
| 54 | Bilan pour l'équipe : inscrits, présents | Partiel : les deux nombres existent, sur deux encarts, sans vue de bilan | oui | oui | `A:convex/modules/events/pageEventAttendanceState.ts` (`countPageEventAttendance`) |
| 55 | Mesure du pilote : inscriptions et présences | Présent | oui | oui | `A:convex/modules/diaspora/pilotMetrics.ts` ; `D:packages/diasporale-domain/src/pilot-metrics.ts` |
| | **Agenda et calendrier** | | | | |
| 56 | « Mon agenda » : évènements personnels et inscriptions associatives | Partiel : complet en mode moteur ; la démonstration ne montre que les inscriptions associatives | oui | oui | `D:apps/diasporale_com/src/screens/agenda-screen.tsx` |
| 57 | Pagination par périodes, au-delà de 200 lignes | Présent | oui | oui | `A:convex/modules/events/events.ts` (`paginateMyAgenda`) |
| 58 | Entrée vers l'agenda | Partiel : raccourci de Communautés et détail d'un évènement ; rien dans l'espace personnel | oui | — | `D:apps/diasporale_com/src/components/community-shortcuts.tsx` ; aucune entrée dans `D:apps/diasporale_com/src/components/app-shell.tsx` |
| 59 | Export iCal d'un évènement (confirmé, provisoire, annulé) | Présent | oui | oui | `A:convex/modules/events/pageEventCalendar.ts` (`exportIcal`) ; `D:apps/diasporale_com/src/components/association-event-calendar.tsx` |
| 60 | Abonnement à un flux de calendrier | Absent, par décision (docs/29 de DIASPORALE) | non | non | motifs : `webcal`, `subscribe`, `feedToken` |
| 61 | Vue par mois ou par semaine | Absent | non | non | listes seulement : `A:packages/social-features/src/features/reseau-personnel/EvenementsPanel.tsx` |
| 62 | Double affichage : heure de l'évènement et heure du lecteur | Présent | oui | — | `D:apps/diasporale_com/src/components/service-request-ui.tsx` (`SlotText`) |
| 63 | Un évènement accepté en cours fait taire la sonnerie des appels | Présent | — | oui | `A:convex/modules/calls/evaluate.ts` (`isInAcceptedEvent`) |
| | **Évènement organisé par une personne** | | | | |
| 64 | Créer un évènement personnel, inviter ses relations une à une | Partiel : présent en mode moteur par le panneau du moteur ; absent de la démonstration | oui | oui | `A:convex/modules/events/events.ts` (`create`, `invite`) ; `A:packages/social-features/src/features/reseau-personnel/EvenementsPanel.tsx` |
| 65 | Répondre : oui, non, peut-être | Partiel : le serveur accepte « peut-être », l'écran n'a que deux boutons | oui | oui | `A:convex/modules/events/events.ts` (`respond`) |
| 66 | Les invités d'un évènement personnel se voient entre eux | Présent | oui | oui | `A:convex/modules/events/events.ts` (`paginateEventParticipants`) |
| 67 | Modifier un évènement personnel ; l'exporter en iCal | Absent (PG-05 du moteur) | non | non | `A:convex/modules/events/events.ts` n'exporte ni modification ni export |
| 68 | Annoncer son évènement dans le fil, par pays ou pour toute la diaspora | Partiel : la publication part, le fil de DIASPORALE n'affiche pas la carte de l'évènement | oui | oui | `A:convex/modules/events/events.ts` (`announce`) ; `D:apps/diasporale_com/src/data/engine-views.ts` (`toPostView` ignore le champ `event`) |
| 69 | Évènement de personne ouvert aux inscriptions, avec capacité | Absent | non | non | l'inscription exige une page organisatrice : `A:convex/modules/events/pageEvents.ts` (`register`) |
| | **Trouver un évènement** | | | | |
| 70 | Évènements sur la page de l'association, détail à adresse propre | Présent | oui | oui | `D:apps/diasporale_com/src/screens/page-screen.tsx` ; `D:apps/diasporale_com/src/app/pages/[handle]/evenements/[eventId]/page.tsx` |
| 71 | Ordre de la liste d'une page | Partiel : du plus ancien au plus récent, sans séparer à venir et passés | oui | oui | `A:convex/modules/events/pageEvents.ts` (`listForPage`, index `by_network_page_startAt` sans borne de date) |
| 72 | Onglet « Évènements » du hub | Partiel : démonstration seulement ; en mode moteur la liste est toujours vide | démo | non | `D:apps/diasporale_com/src/data/engine-views.ts` (`toCountryHubView` : `events: []`) |
| 73 | Compteur « évènements à venir » du hub et du rail du fil | Partiel : toujours zéro en mode moteur | oui | non | `A:convex/modules/diaspora/hubs.ts` (`upcomingEvents: 0`) ; `D:apps/diasporale_com/src/screens/feed-screen.tsx` |
| 74 | Liste des évènements du réseau par date, ville, catégorie | Absent | non | non | seule lecture : `listForPage` ; aucun index par date dans `A:convex/modules/events/tables.ts` |
| 75 | Pays ou portée « toute la diaspora » d'un évènement de page | Absent | non | non | l'évènement ne porte ni pays ni portée : `A:convex/modules/events/tables.ts` |
| 76 | Annoncer un évènement de page dans le fil, avec sa carte | Absent | non | partiel | `announce` refuse une page ; la carte sait déjà lire un évènement de page : `A:convex/modules/events/card.ts` |
| 77 | Partager un évènement (copier le lien, feuille de partage) | Absent | non | — | motifs : `share`, `partag` dans les composants d'évènement ; modèle voisin : `D:apps/diasporale_com/src/components/page-share-button.tsx` |
| 78 | Lien cliquable vers un évènement dans une publication | Absent | non | — | seuls mentions et mots-dièse sont actifs : `D:packages/diasporale-features/src/components/rich-text.tsx` |
| 79 | Signaler un évènement | Absent ici ; le moteur l'a | non | oui | cible `event` : `A:convex/modules/moderation/targets.ts` ; natures du port sans `event` : `D:packages/diasporale-features/src/data/content-reports-port.ts` |
| | **Direct, discussion, argent** | | | | |
| 80 | Direct d'un évènement | Absent ici ; le moteur a le direct au nom d'une page | non | oui | `A:convex/modules/live/sessions.ts` ; route `conference` déclarée, aucune page servie : `D:apps/diasporale_com/src/lib/routes.ts` |
| 81 | Discussion d'évènement | Absent (PG-14 du moteur) | non | non | motifs : `eventDiscussionId`, `discussion` |
| 82 | Billetterie payante, cotisation | Fermé (D-G03 ; lot D4) | non | non | aucun champ de prix : `A:convex/modules/events/tables.ts` |
| | **Qualité** | | | | |
| 83 | Démonstration servie par le même port (évènements d'association) | Présent | oui | — | `D:packages/diasporale-features/src/demo/association-activities.ts` |
| 84 | Export et effacement : inscriptions à la personne, trace du créateur anonymisée | Présent | — | oui | `A:convex/modules/people/dataPolicies.ts` ; `A:convex/modules/people/erasure.ts` |
| 85 | Tests du moteur et des écrans | Présent | — | oui | `A:convex/modules/events/pageEvents.test.ts` ; `D:apps/diasporale_com/src/components/association-event-attendance.test.tsx` |
| 86 | Comptes de démonstration équipés d'un évènement | Absent | non | non | gestes joués : offre, emploi, mission ; `D:apps/diasporale_com/src/components/demo-account-bootstrap.tsx` |

Décompte : **Présent 35 · Partiel 13 · Absent 36 · Fermé 2** (86 capacités).

### Ce que le moteur sait déjà faire et que DIASPORALE ne montre pas

- **Signaler un évènement** : la modération a la cible `event` (`A:convex/modules/moderation/targets.ts`) ; aucun bouton dans DIASPORALE.
- **La carte d'un évènement dans une publication** : le fil du moteur la rend (`A:convex/modules/posts/posts.ts`, `toFeedItem`) ; l'adaptateur de DIASPORALE ne la reprend pas.
- **Publier un évènement retenu** : le bureau a la file des contenus retenus et la décision d'approbation (`A:convex/modules/diaspora/moderationDesk.ts`, `pendingQueue`). C'est aujourd'hui le seul chemin qui publie un évènement d'association. Il n'a jamais été joué.
- **Prévenir les abonnés d'une page** : le genre `page_post` existe (`A:packages/social-domain/src/notifications.ts`). Il servira dès qu'une page pourra annoncer son évènement par une publication.
- **Compter les évènements par pays** : la mesure du pilote lit déjà les évènements par passage paginé (`A:convex/modules/diaspora/pilotMetrics.ts`). Le compteur du hub peut suivre le même chemin.
- **Le direct au nom d'une page** : `A:convex/modules/live/sessions.ts` ; aucune route servie ici.
- **Le format iCal** : `A:packages/social-domain/src/icalendar.ts`, réutilisable pour un évènement personnel (PG-05 du moteur).
- Le module `A:convex/modules/personalMeetings/capabilities.ts` ne concerne pas les évènements : c'est la porte fermée des rencontres.

### Ce qui est écrit mais jamais recetté en réel

Les tests existent et `verify` était vert le 3/11 (`D:docs/recette/couleurs-par-famille-2026-11-03/RAPPORT.md`). Aucune recette n'a porté sur les évènements.

| Recette | État | Source |
|---|---|---|
| Création, modification à deux responsables, annulation | Jamais jouée sur un vrai backend | docs/21 de DIASPORALE ; plan 15 d'ANTSIA, § 2 |
| Dernière place disputée, file d'attente, promotion (R-G12) | Jamais jouée | docs/22 ; docs/14, § 6.2 |
| Date limite ; rappel réellement écrit dans la cloche | Jamais constaté | docs/24 |
| Billet QR, caméra sur téléphone réel, deux contrôleurs, correction | Jamais jouée ; aucun essai sur iPhone ni sur Android | docs/27 |
| Galerie avec de vraies photos et une vidéo, audience adhérents | Jamais jouée | docs/28 |
| Fichier iCal importé dans un agenda tiers ; changement d'heure vu d'un autre fuseau (R-G21) | Jamais jouée | docs/29 |
| Agenda au-delà de 200 lignes | Tests seulement | docs/30 |
| Évènement retenu, puis approuvé au bureau | Jamais jouée : aucune équipe de modération sur un déploiement | plan 15 d'ANTSIA, § 4.1 |
| Écran d'un évènement avec les couleurs par famille | Jamais vu, faute de compte dans le bon état | rapport des couleurs du 3/11 |
| Effacement d'un inscrit, place libérée (R-G19) | Jamais jouée | docs/14, § 6.2 |

## 3. Comparaison avec les applications de référence

| Capacité | Meetup | Eventbrite | Luma | Facebook | Partiful | HelloAsso | DIASPORALE | Verdict |
|---|---|---|---|---|---|---|---|---|
| Créer un évènement avec date, lieu, description | oui | oui | oui | oui | oui | oui | oui, pour une association | Déjà fait · À recetter |
| Image de couverture | oui | oui | oui | oui | oui | oui | non | À faire (EV-09) |
| Lieu avec adresse et carte | oui | oui | oui | oui | oui | oui | texte libre | À adapter (EV-05 : ville saisie ; pas de carte, pas d'adresse privée) |
| Évènement en ligne | oui | oui | oui | oui | ? | ? | non | Reporté (DS-18 ; pas de lien externe) |
| Capacité | oui | oui | oui | non ? | oui | oui | oui | Déjà fait |
| Liste d'attente automatique | oui | oui | oui | non | oui ? | ? | oui, ordre d'arrivée | Déjà fait |
| Prévenir quand une place se libère | oui | oui | oui | — | oui ? | ? | non | À faire (EV-03) |
| Date limite d'inscription | oui | oui | oui ? | non | ? | oui | oui | Déjà fait |
| Accompagnants | oui | oui | oui ? | non | oui | oui | non | À faire (EV-12) |
| Questions à l'inscription | oui | oui | oui | non | oui ? | oui | non | Reporté (EV-16, PG-17 du moteur) |
| « Intéressé » ou « Peut-être » | non | enregistrer | non ? | oui | oui | non | non | À faire (EV-13) |
| Rappels avant l'évènement | oui | oui | oui | oui | oui | ? | un rappel, sur demande, dans la cloche | À adapter (EV-03 ; push : plan 13 de ce dossier) |
| Ajouter à son calendrier | oui | oui | oui | oui | oui | ? | fichier iCal | Déjà fait · À recetter |
| S'abonner à un calendrier | oui | ? | oui | ? | non ? | non | non | Reporté (EV-18, décision 8) |
| Billet à code et contrôle à l'entrée | ? | oui | oui | non | non ? | oui | oui | À recetter sur téléphones réels (EV-10) |
| Contrôle sans réseau | ? | oui ? | ? | — | — | ? | non | Écarté (docs/27 de DIASPORALE) |
| Liste des inscrits pour l'organisateur | oui | oui | oui | oui | oui | oui | compteurs seuls | À décider (décision 3, EV-10) |
| Export des inscrits | oui | oui | oui | ? | ? | oui | non | Écarté (pas d'export nominatif, docs/27) |
| Voir qui participe | oui | non | au choix | oui | au choix | non | non | Écarté (aucune liste publique de personnes) |
| Écrire aux inscrits | oui | oui | oui | oui | oui | oui ? | non | À adapter (EV-08 : note de l'organisateur, avis neutre) |
| Annulation qui prévient les inscrits | oui | oui | oui | oui | oui | oui ? | non | À faire (EV-03) |
| Changer la date après des inscriptions | oui | oui | oui | oui | oui | oui | refusé | À faire (EV-08) |
| Évènements récurrents | oui | oui | oui | oui | non ? | ? | non | Reporté (DS-10, PG-17 du moteur) |
| Discussion de l'évènement | oui | non | ? | oui | oui | non | non | À faire (EV-13) |
| Photos après l'évènement | oui | non | ? | oui | oui | non | galerie de l'équipe | Déjà fait ; participants : Reporté (EV-17) |
| Découvrir par ville, date, catégorie | oui | oui | oui | oui | non | oui ? | non | À faire (EV-05) |
| Partager, inviter | oui | oui | oui | oui | oui | oui | non | À faire (EV-07) |
| Signaler un évènement | oui | oui | ? | oui | ? | oui ? | non | À faire (EV-04) |
| Dupliquer un évènement | oui | oui | oui | oui | ? | oui | non | À faire (EV-14) |
| Statistiques pour l'organisateur | partiel | oui | oui | oui | non ? | oui | deux nombres, plus la mesure du pilote | À adapter (EV-14) |
| Prix ou participation affichés | oui | oui | oui | oui | oui ? | oui | non | À décider (décision 6, EV-15) |
| Billetterie payante | oui | oui | oui | ? | ? | oui | non | Écarté (D-G03, lot D4) |
| Direct | lien externe | lien externe | oui ? | oui | non | non | non | Reporté (DS-18) |
| Heure dans le fuseau du lecteur | oui | oui | oui | oui | oui | — | deux heures affichées | Déjà fait |
| Organisé par une personne, ouvert à tous | par un groupe | oui | oui | oui | oui | non | invitations entre relations | À faire (DS-10) |
| Organisé par une entreprise ou une institution | oui | oui | oui | oui | — | association | association seulement | À faire (EV-11) |

## 4. Ce qui manque

### 4.1 Bloquant avant l'ouverture du pilote

1. **Rien n'a été vu ni joué.** Aucun parcours d'évènement n'a tourné sur un vrai backend ; les comptes de démonstration n'ont aucun évènement (EV-01, puis volet de recette au § 6).
2. **Sans équipe de modération, aucun évènement ne paraît.** Tant qu'aucune politique n'est posée pour la surface `event`, chaque évènement d'association reste « en attente » et n'est vu que de son équipe. La seule sortie est l'approbation au bureau. Le réglage de la politique n'a pas d'écran (MC-02 du moteur). Décision 1.
3. **L'annulation ne prévient personne, la place obtenue non plus.** L'écran promet pourtant une place « automatiquement ». Un inscrit peut se déplacer pour rien, ou ne jamais savoir qu'il a une place (EV-03).
4. **Le hub affiche « 0 évènement à venir » en mode moteur**, même quand des évènements existent. C'est un nombre non mesuré, contraire à la règle du projet (EV-02).
5. **Un évènement ne se signale pas**, alors que le cahier le liste parmi les contenus signalables (EXF-DG-40) (EV-04).

### 4.2 Fonctions attendues qui manquent

- Trouver les évènements de son pays par date, ville et catégorie ; les évènements ouverts à toute la diaspora (EV-05).
- Annoncer un évènement dans le fil, avec sa carte ; le partager (EV-07).
- Reporter un évènement sans l'annuler ; informer les inscrits d'un changement (EV-08).
- Une image (EV-09).
- Un accueil qui marche sur tous les téléphones (EV-10).
- Des évènements pour les entreprises et les pages officielles (EV-11).
- Un évènement de personne ouvert aux inscriptions ; la récurrence (DS-10).
- Venir à plusieurs (EV-12) ; « Intéressé » et discussion (EV-13) ; le direct (DS-18).

### 4.3 Options qui manquent sur ce qui existe

- Liste d'une page : à venir d'abord, passés ensuite (EV-06).
- Rappel : proposé seulement après l'inscription, un seul délai, dans la cloche seule (EV-03 ; plan 13 de ce dossier).
- Annulation : pas de motif (EV-03). Évènement : ni brouillon, ni duplication (EV-14).
- Accueil : pas de rôle « contrôleur », fenêtre d'accueil fixe, pas de pointage sans billet (EV-10 ; PG-08 du moteur).
- Galerie : légende non modifiable, aucun geste pour un participant (EV-17).
- Agenda : pas d'entrée dans l'espace personnel (plan 02 de ce dossier), pas de vue par mois, pas d'export d'un évènement personnel (PG-05 du moteur).
- Évènement personnel : pas de « Peut-être » à l'écran, pas d'invitation à plusieurs, pas de modification (PG-05 du moteur).
- Bilan de l'équipe : inscrits et présents ne sont pas réunis (EV-14). Participation aux frais : aucune mention possible (EV-15).

### 4.4 Améliorations de l'existant

- **Un seul modèle d'évènement.** Deux coexistent : la carte fictive du hub (catégorie, ville, portée, sans lien) et l'évènement d'association (réel, sans catégorie ni ville). EV-05 les réunit.
- **Une carte plus lisible.** La carte montre quatre nombres et deux phrases de règle avant le bouton. Ordre proposé : date, lieu, bouton, puis le détail ; la règle de clôture seulement dans le détail.
- **Le fuseau.** Le sélecteur propose toutes les zones ; proposer d'abord celle du pays de la page.
- **« Actualiser ma place »** est un geste technique : l'expliquer, ou le rendre inutile par l'avis de EV-03.
- **La démonstration** n'a pas d'évènement personnel : l'agenda y paraît plus pauvre qu'en mode moteur (DS-10).
- **Le lien.** Une publication ne rend aucun lien cliquable : une association ne peut pas pointer vers son évènement (plan 03 de ce dossier ; EV-07 l'évite par la carte).

### 4.5 Ce qui distingue DIASPORALE

- Deux heures affichées, celle de l'évènement et celle du lecteur ; les heures ambiguës du changement d'heure sont refusées. Utile à une communauté répartie sur plusieurs fuseaux.
- Une file d'attente honnête : ordre d'arrivée, aucun passe-droit, son propre rang visible.
- Un billet qui ne contient aucune donnée ; une présence confirmée par un humain, corrigeable.
- Inscription, adhésion et groupe sont trois gestes distincts ; aucune liste publique de personnes.
- Un fichier iCal qui dit vrai : « provisoire » tant que la place n'est pas confirmée.
- Un rappel qui relit les droits au moment de partir ; rien n'est écrit si l'accès a été perdu.
- Les appels se taisent pendant un évènement accepté.
- La mesure du pilote rapporte les présences aux inscriptions, avec son dénominateur.

### 4.6 Écarté ou reporté, et pourquoi

| Sujet | Raison |
|---|---|
| Billetterie payante, cotisation, mise en avant payée d'un évènement | D-G03, D-G04 ; lot D4 |
| Contrôle hors ligne, export de l'émargement | docs/27 de DIASPORALE ; pas d'export nominatif |
| Choix des inscrits par l'organisateur | docs/22 : ordre d'arrivée, sans sélection |
| Liste publique « qui participe » | Aucune liste de personnes sur une surface du réseau |
| Lien de visio externe | Plan 07 du moteur, décision 9 : rattacher une conférence du moteur |
| Partage d'un évènement à une personne sans compte | Réseau fermé ; plan 07 du moteur, décision 8 |
| Carte géographique, position | Ville saisie, sans GPS (règle des services, R-G04) |
| Covoiturage vers l'évènement | Plan 12 de ce dossier |
| Collecte ou cagnotte liée à un évènement | docs/14, G8 : analyse réglementaire propre |
| Évènements suggérés selon le comportement | D-G05 |
| Application mobile | Plan 16 de ce dossier ; le web au téléphone sert le billet |

## 5. Lots d'implémentation

### EV-01 — Évènements de démonstration et parcours rejouables · P0 · S · S2
- **Pour l'utilisateur** : rien ne change en production ; les écrans d'évènement se voient enfin sur le backend local, puis sur la démonstration.
- **Backend** : aucun dans `A:convex/modules/events/`. Aucune politique de modération n'est écrite depuis la tranche : l'évènement créé reste « en attente », et le compte `moderateur` le publie au bureau, par le chemin réel.
- **Web** : nouveau geste `associationEvent` de l'acteur `association` dans `D:packages/diasporale-domain/src/demo-accounts.ts` et `D:apps/diasporale_com/src/components/demo-account-bootstrap.tsx` : deux évènements marqués fictifs (un ouvert au réseau, 2 places, dans 7 jours ; un réservé aux adhérents), créés par la capacité du port, clé d'idempotence stable.
- **Mobile** : sans objet.
- **Données personnelles** : aucune ; contenus fictifs ; catalogue vide hors développement local et démonstration déclarée (ADR-0038).
- **Tests et cliquets** : test du geste (rejeu sans doublon) ; test du domaine des acteurs ; cliquets de textes fr et en.
- **Critères d'acceptation** : en entrant par `association`, la page montre deux évènements en attente ; après approbation par `moderateur`, `declare` voit le premier et s'inscrit ; captures à 390 et 1280 px, Sable et Gaboma.
- **Dépend de** : DS-01 ; plan 14 de ce dossier (bureau, contenus retenus).
- **Porte** : accord pour les variables du backend local ; publication de la démonstration sur accord écrit.

### EV-02 — Le hub ne dit plus « zéro évènement » · P0 · S · S2
- **Pour l'utilisateur** : plus de « 0 évènement à venir » faux ; l'onglet dit où trouver les évènements.
- **Backend** : aucun. Le champ `upcomingEvents` reste écrit à zéro par `A:convex/modules/diaspora/hubs.ts` jusqu'à EV-05.
- **Web** : en mode moteur, retirer le compteur d'évènements de `D:apps/diasporale_com/src/screens/hub-screen.tsx` et de `D:apps/diasporale_com/src/screens/feed-screen.tsx` ; l'onglet renvoie aux associations du pays et à « Mon agenda » ; `toCountryHubView` de `D:apps/diasporale_com/src/data/engine-views.ts` marque la source « non mesurée » ; le calcul « hub dormant » de `D:packages/diasporale-domain/src/hubs.ts` n'emploie plus ce zéro.
- **Mobile** : sans objet.
- **Données personnelles** : aucune.
- **Tests et cliquets** : test d'écran « aucun nombre d'évènements en mode moteur » ; démonstration inchangée.
- **Critères d'acceptation** : sur le backend local avec un évènement publié, ni le hub ni le rail n'affichent de nombre d'évènements ; aucun autre compteur ne change.
- **Dépend de** : rien ; coordination avec le plan 06 de ce dossier, qui possède l'écran du hub.
- **Porte** : aucune.

### EV-03 — Avis aux inscrits : annulation, place obtenue · P0 · M · S1 puis S2
- **Pour l'utilisateur** : je suis prévenu quand l'évènement est annulé et quand ma demande devient une place ; le rappel m'est proposé dès l'inscription.
- **Backend** : issue `[S1]` sur `A:convex/modules/events/pageEvents.ts` (`cancel`) et `A:convex/modules/events/pageEventRegistrations.ts` (`fillPageEventSeatsNow`) : deux genres d'avis neutres, sans titre ni lieu, écrits par le rédacteur unique ; diffusion par lots bornés aux confirmés et aux personnes en attente ; même garde de visibilité que le rappel ; motif d'annulation pris dans une liste fermée, sans texte libre.
- **Web** : libellés des deux genres dans la cloche et lien vers le détail (`D:packages/diasporale-features/src/components/notification-bell.tsx`) ; la confirmation d'annulation dit que les inscrits seront prévenus ; la case du rappel entre dans le geste d'inscription (`D:apps/diasporale_com/src/components/association-events.tsx`) ; la démonstration simule ces avis dans le navigateur et le dit.
- **Mobile** : push avec le plan 16 de ce dossier.
- **Données personnelles** : aucun contenu dans l'avis ; avis effacés avec le compte.
- **Tests et cliquets** : `notification-payload-content`, `notifications-writer` ; une personne qui a perdu l'accès n'est pas prévenue ; pas de doublon au rejeu.
- **Critères d'acceptation** : à deux comptes, l'annulation écrit une ligne de cloche chez chaque inscrit ; un retrait promeut la première personne en attente et lui écrit un avis ; l'agenda dit « annulé ».
- **Dépend de** : issue `[S1]` ; plan 13 de ce dossier (cloche, préférences).
- **Porte** : publication du backend par S1.

### EV-04 — Signaler un évènement et un ajout de galerie · P0 · S · S2
- **Pour l'utilisateur** : « Signaler » sur un évènement et sur une photo de galerie, comme sur les autres contenus.
- **Backend** : rien à écrire : la cible `event` existe (`A:convex/modules/moderation/targets.ts`) ; un ajout de galerie est une publication.
- **Web** : ajouter ces deux natures au port `D:packages/diasporale-features/src/data/content-reports-port.ts`, à `D:apps/diasporale_com/src/data/engine-content-reports.ts` et à `D:packages/diasporale-features/src/demo/content-reports.ts` ; action dans la carte et le détail (`D:apps/diasporale_com/src/components/association-events.tsx`) et sur chaque ajout (`D:apps/diasporale_com/src/components/association-event-gallery.tsx`) ; jamais offerte à l'équipe de la page.
- **Mobile** : après le web.
- **Données personnelles** : le signalement suit les règles du plan 14 de ce dossier ; l'équipe n'apprend jamais qui a signalé.
- **Tests et cliquets** : test du port (nature admise, rejeu « déjà signalé ») ; test d'écran (pas d'action pour un signataire).
- **Critères d'acceptation** : un membre signale ; l'évènement est masqué pour lui ; le dossier arrive au bureau sous « Évènement ».
- **Dépend de** : plan 14 de ce dossier (mécanisme et bureau) ; MC-01 du moteur pour l'alignement des natures.
- **Porte** : aucune.

### EV-05 — Évènements du pays dans le hub : liste, compteur, ville, catégorie, portée · P1 · L · S1 puis S2
- **Pour l'utilisateur** : l'onglet « Évènements » du hub liste les évènements à venir des associations du pays et ceux ouverts à toute la diaspora ; je filtre par mois, ville, catégorie.
- **Backend** : issue `[S1]`, à tirer de PG-10 du moteur sans attendre « Intéressé » : champs facultatifs sur l'évènement de page (ville saisie, catégorie parmi les cinq de `EVENT_CATEGORIES`, portée `local` ou `diaspora`, pays recopié de la page), index par réseau et date, lecture paginée gardée par `pageEventAccess`, limitée aux évènements publiés d'audience réseau. Côté tranche : `A:convex/modules/diaspora/hubs.ts` compte les évènements à venir dans son passage nocturne, comme le fait déjà `A:convex/modules/diaspora/pilotMetrics.ts`.
- **Web** : nouvelle lecture dans `D:packages/diasporale-features/src/data/association-activities-port.ts` ; l'onglet du hub et Communautés s'y branchent ; `D:packages/diasporale-features/src/components/cards/event-card.tsx` devient la carte d'un évènement d'association, avec lien vers le détail ; formulaire : ville, catégorie, case « Ouvrir à toute la diaspora » expliquée ; les évènements fictifs du hub deviennent ceux des associations de la démonstration.
- **Mobile** : après le web.
- **Données personnelles** : aucune ; ville saisie, jamais de position.
- **Tests et cliquets** : `network-scoped-functions`, `no-unbounded-collect` ; un évènement réservé aux adhérents n'apparaît jamais dans le hub ; fenêtre filtrée vide avec suite annoncée.
- **Critères d'acceptation** : un évènement publié à Lyon paraît dans le hub France, pas dans le hub Canada ; ouvert à la diaspora, il paraît partout avec l'étiquette d'origine ; le compteur égale la liste après le passage nocturne.
- **Dépend de** : EV-01, EV-02 ; PG-10 du moteur ; plan 06 de ce dossier ; décision 9.
- **Porte** : issue `[S1]` acceptée ; publication du backend par S1. Repli si S1 ne peut pas : une projection nocturne dans la tranche, avec son retard dit à l'écran.

### EV-06 — Liste d'une page : à venir d'abord, passés ensuite · P1 · S · S1 puis S2
- **Pour l'utilisateur** : sur la page d'une association, les prochains évènements sont en tête.
- **Backend** : issue `[S1]` : `listForPage` reçoit une période et une ancre, comme `paginateMyAgenda` (`A:convex/modules/events/events.ts`) ; même index, bornes de date.
- **Web** : deux listes dans `D:apps/diasporale_com/src/components/association-events.tsx` : « À venir », puis « Passés » repliée ; l'équipe voit en tête ses évènements en attente de modération.
- **Mobile** : après le web.
- **Données personnelles** : aucune.
- **Tests et cliquets** : test du moteur (ordre, bornes) ; test d'écran des deux listes ; démonstration alignée.
- **Critères d'acceptation** : avec 30 évènements passés et 2 à venir, les 2 à venir sont visibles sans « Afficher plus ».
- **Dépend de** : issue `[S1]`.
- **Porte** : aucune.

### EV-07 — Faire connaître un évènement : annonce de la page, carte dans le fil, partage · P1 · M · S1 puis S2
- **Pour l'utilisateur** : la page annonce son évènement dans le fil ; la carte montre la date, le lieu, les places et mène à l'inscription ; « Partager » copie le lien.
- **Backend** : issue `[S1]` : annonce d'un évènement de page par une publication de la page (une seule fois, visibilité `network`, jamais vers ANTSIA), réservée aux évènements d'audience réseau ; la carte lit déjà un évènement de page (`A:convex/modules/events/card.ts`).
- **Web** : `toPostView` (`D:apps/diasporale_com/src/data/engine-views.ts`) reprend le champ `event` ; `D:packages/diasporale-features/src/components/cards/post-card.tsx` affiche la carte (évènement de page : lien vers le détail ; évènement personnel : ma réponse) ; bouton « Annoncer » pour l'équipe ; bouton « Partager » sur le détail, sur le modèle de `D:apps/diasporale_com/src/components/page-share-button.tsx` ; envoi dans iCom quand IC-18 du moteur existe.
- **Mobile** : après le web.
- **Données personnelles** : aucune ; un évènement réservé aux adhérents ne s'annonce pas dans le fil (il se dit dans le groupe de l'association, plan 07 de ce dossier).
- **Tests et cliquets** : annonce rejouée sans doublon ; carte relue à chaque lecture (annulé : la carte le dit) ; `no-hardcoded-urls`.
- **Critères d'acceptation** : l'annonce paraît dans le fil des abonnés avec sa carte ; le lien copié ouvre le détail à un membre et la porte à un non-membre.
- **Dépend de** : plan 03 de ce dossier (carte de publication) ; plan 13 (avis `page_post`) ; IC-18 du moteur pour iCom.
- **Porte** : issue `[S1]` ; publication du backend par S1.

### EV-08 — Reporter un évènement et informer les inscrits · P1 · M · S1 puis S2
- **Pour l'utilisateur** : l'association change la date sans tout annuler ; je garde ma place, je suis prévenu, je peux me retirer.
- **Backend** : issue `[S1]` : `update` admet un changement de dates avec des inscrits, sous confirmation explicite ; places conservées, rappels reprogrammés, billets émis invalidés ; avis neutre « un évènement a changé » ; note de l'organisateur de 280 caractères, modérée comme le reste.
- **Web** : feuille « Reporter » distincte de « Modifier » ; mention « Date modifiée le … » ; note de l'organisateur en tête du détail ; le fichier iCal réexporté garde son identité et monte de version.
- **Mobile** : après le web.
- **Données personnelles** : aucune donnée nouvelle sur la personne.
- **Tests et cliquets** : aucun rappel à l'ancienne date ; un billet émis avant le report est refusé ; changement d'heure (R-G21).
- **Critères d'acceptation** : à deux comptes, l'inscrit voit la nouvelle date, a une ligne de cloche, reçoit son rappel à la nouvelle veille.
- **Dépend de** : EV-03.
- **Porte** : issue `[S1]`.

### EV-09 — Image de couverture d'un évènement · P1 · M · S1 puis S2
- **Pour l'utilisateur** : un évènement a une image, sur la carte, le détail, le hub et le fil.
- **Backend** : issue `[S1]` : une image facultative sur l'évènement, par la garde des fichiers (antivirus, ré-encodage et retrait des métadonnées de SD-02 du moteur), texte alternatif obligatoire, délivrance sous `pageEventAccess`.
- **Web** : dépôt dans `D:apps/diasporale_com/src/components/association-event-form.tsx` avec le composant du composeur ; sans image, un aplat de la charte, aucune image inventée.
- **Mobile** : après le web.
- **Données personnelles** : métadonnées de la photo retirées (décision du 9/11) ; l'image suit l'évènement à la suppression.
- **Tests et cliquets** : `file-delivery-gate`, `upload-policy` ; l'image d'un évènement réservé aux adhérents n'est pas servie à un non-adhérent.
- **Critères d'acceptation** : image visible des seuls ayants droit, à 390 et 1280 px, clair et sombre.
- **Dépend de** : SD-02 et EX-17 du moteur.
- **Porte** : issue `[S1]`.

### EV-10 — Accueil qui marche sur tous les téléphones, et liste des inscrits pour l'équipe · P1 · M · S1 puis S2
- **Pour l'utilisateur** : à l'entrée, le pointage marche même si la caméra ne lit pas le QR ou si mon téléphone est éteint ; l'équipe sait qui vient.
- **Backend** : issue `[S1]` sur `A:convex/modules/events/pageEventAttendance.ts` : code court à six chiffres, valable deux minutes, propre à l'évènement, gardé en empreinte ; pointage par identifiant public d'un inscrit confirmé (même fenêtre, même seau `event.attendance`, refus indistinct) ; lecteur QR de repli si une bibliothèque est admise (`package.json` : S1). Si la décision 3 est prise : liste paginée des confirmés, réservée à l'équipe vivante, nom d'usage seul, sans export.
- **Web** : le code court sous le QR ; « Pointer par identifiant » sous la saisie (`D:apps/diasporale_com/src/components/association-event-attendance.tsx`) ; onglet « Inscrits » pour l'équipe ; phrase ajoutée au geste d'inscription : l'équipe verra votre nom d'usage.
- **Mobile** : après le web.
- **Données personnelles** : aucun champ nouveau ; l'information au moment du geste conditionne la liste.
- **Tests et cliquets** : `rate-limited-writes` ; code court expiré ou d'un autre évènement refusé ; liste invisible d'un simple membre.
- **Critères d'acceptation** : recette sur un iPhone et un téléphone Android réels : pointage par caméra, par code court, par identifiant ; second pointage « déjà enregistré ».
- **Dépend de** : volet de recette du § 6 (mesure de ce que la caméra lit vraiment) ; PG-08 du moteur pour un rôle « contrôleur ».
- **Porte** : décision 3 pour la liste ; le code court et le pointage par identifiant n'attendent rien.

### EV-11 — Évènements des pages d'entreprise et des pages officielles · P1 · M · S1 (PG-03) puis S2
- **Pour l'utilisateur** : un restaurateur annonce une soirée, un poste consulaire une permanence, avec les mêmes inscriptions.
- **Backend** : PG-03 du moteur (politique par réseau, natures admises). Demande `[S1]` : admettre `company` et `institution` dans DIASPORALE, avec l'audience réseau seule.
- **Web** : `D:apps/diasporale_com/src/screens/page-screen.tsx` monte la section pour ces natures et retire les cartes héritées ; le choix d'audience disparaît quand une seule est possible.
- **Mobile** : après le web.
- **Données personnelles** : inchangées.
- **Tests et cliquets** : une page d'entreprise ne crée pas d'évènement réservé à des adhérents ; tests portés de l'association.
- **Critères d'acceptation** : création, inscription, attente et pointage sur une page d'entreprise de la démonstration.
- **Dépend de** : PG-03 du moteur ; plan 15 de ce dossier pour les pages officielles ; décision 4.
- **Porte** : décisions 1 et 2 du plan 07 du moteur ; décision 4 de ce plan.

### DS-10 — Évènements de personne et récurrents · P2 · M · S1 (plan 07) puis S2 · repris du plan 15
- **Pour l'utilisateur** : un membre organise une rencontre ouverte ; une association planifie « chaque premier samedi ».
- **Backend** : précision de ce plan : l'évènement personnel existe déjà (création, invitation des relations, réponse, annonce) et il est monté dans « Mon agenda ». Trois manques distincts. Un : les compléments de PG-05 du moteur (modifier, « Peut-être », inviter à plusieurs, iCal) arrivent par le panneau du moteur. Deux : l'évènement de personne ouvert aux inscriptions avec capacité et attente n'est prévu par aucun lot du moteur ; issue `[S1]` à ouvrir. Trois : la récurrence relève de PG-17 du moteur.
- **Web** : entrée « Organiser une rencontre » depuis Communautés ; carte dans le hub (EV-05) ; évènements personnels fictifs dans la démonstration.
- **Mobile** : après le web.
- **Données personnelles** : inscriptions déjà à l'inventaire.
- **Tests et cliquets** : fuseau et changement d'heure (R-G21) ; refus pour un compte non admis à organiser.
- **Critères d'acceptation** : évènement de personne avec capacité et attente ; série dont une occurrence s'annule seule.
- **Dépend de** : PG-05 et PG-17 du moteur ; EV-05.
- **Porte** : décision 5.

### EV-12 — Accompagnants : « je viens à trois » · P2 · M · S1 puis S2
- **Pour l'utilisateur** : je m'inscris pour plusieurs places quand l'association le permet.
- **Backend** : issue `[S1]` : nombre de places par inscription, plafonné par l'organisateur (défaut 1) ; la capacité compte des places ; la file reste dans l'ordre d'arrivée, sans doublement par une demande plus petite ; aucun nom ni âge d'accompagnant.
- **Web** : sélecteur du nombre de places ; le billet vaut pour le groupe ; les compteurs disent « places ».
- **Mobile** : après le web.
- **Données personnelles** : un nombre, rien sur les accompagnants.
- **Tests et cliquets** : 8 places prises sur 10, une demande de 3 attend ; le pointage compte 3 présents.
- **Critères d'acceptation** : aucune sur-réservation à deux demandes simultanées.
- **Dépend de** : EV-03.
- **Porte** : issue `[S1]`.

### EV-13 — « Intéressé » et discussion d'évènement · P2 · S · S2
- **Pour l'utilisateur** : je garde un évènement sans prendre de place ; inscrits et équipe échangent avant et après.
- **Backend** : aucun : se branche sur PG-10 (réponse sans place) et PG-14 (discussion) du moteur.
- **Web** : bouton neutre « Intéressé » ; section distincte dans « Mon agenda » ; onglet « Discussion » du détail ; port, démonstration et textes.
- **Mobile** : après le web.
- **Données personnelles** : « Intéressé » exporté et effacé ; discussion : publications ordinaires.
- **Tests et cliquets** : une personne retirée perd la lecture de la discussion.
- **Critères d'acceptation** : un « Intéressé » reçoit l'avis d'annulation et n'occupe aucune place.
- **Dépend de** : PG-10 et PG-14 du moteur ; plan 09 de ce dossier si la brique des favoris porte le geste.
- **Porte** : aucune.

### EV-14 — Dupliquer un évènement et tableau de bord de l'équipe · P2 · M · S2
- **Pour l'utilisateur** : l'équipe recrée une activité en un geste et voit, pour chaque évènement passé, inscrits et présents.
- **Backend** : aucun si EV-06 est livré ; les nombres existent déjà.
- **Web** : « Dupliquer » préremplit le formulaire (dates vides, nouvelle clé) ; onglet « Évènements » dans la gestion de la page (`D:apps/diasporale_com/src/screens/page-admin-screens.tsx`) : en attente, à venir, passés, avec inscrits et présents.
- **Mobile** : après le web.
- **Données personnelles** : aucune ; nombres seulement.
- **Tests et cliquets** : un évènement sans pointage affiche « présences non relevées », jamais un taux.
- **Critères d'acceptation** : aucun nombre inventé ; duplication sans copie des inscriptions.
- **Dépend de** : EV-06 ; plan 07 de ce dossier (gestion de page).
- **Porte** : aucune.

### EV-15 — Participation aux frais annoncée, sans encaissement · P2 · S · S1 puis S2
- **Pour l'utilisateur** : je lis « entrée libre » ou le montant annoncé par l'association, réglé sur place.
- **Backend** : issue `[S1]` : montant facultatif en unité mineure et devise, règles de `D:packages/diasporale-domain/src/money.ts`.
- **Web** : champ du formulaire ; mention fixe : annoncé par l'association, DIASPORALE n'encaisse rien.
- **Mobile** : après le web.
- **Données personnelles** : aucune.
- **Tests et cliquets** : aucun bouton de paiement ; devise obligatoire avec un montant.
- **Critères d'acceptation** : la mention ne change ni l'inscription ni la capacité.
- **Dépend de** : décision 6.
- **Porte** : décision du propriétaire.

### DS-16 (volet évènements) — Remontée dans le moteur des fonctions communes · P2 · L · S1 (plans 07, 08, 09) avec S2 · repris du plan 15
- **Pour l'utilisateur** : rien ne change dans DIASPORALE ; ANTSIA gagne les mêmes évènements.
- **Backend** : c'est PG-03 du moteur. Part de S2 : accord écrit sur la propriété des règles ; `A:convex/modules/diaspora/associationEventRules.ts` réexporte depuis le moteur, puis disparaît ; le réseau `diasporale` reçoit sa politique d'évènements de page avant le retrait du verrou `assertDiasporaNetwork` (`A:convex/modules/diaspora/facts.ts`).
- **Web** : les écrans lisent les règles du moteur (ils lisent déjà `A:packages/social-domain/src/events.ts`) ; les quatre fichiers de règles de `D:packages/diasporale-domain/src/event-capacity.ts` et voisins restent jusqu'à un test de parité vert, puis sont retirés ; mêmes chemins d'API, aucun adaptateur changé.
- **Mobile** : sans objet.
- **Données personnelles** : inventaire d'effacement unique, inchangé.
- **Tests et cliquets** : `no-cross-product-imports`, `provenance-headers` ; tests DIASPORALE verts avant et après.
- **Critères d'acceptation** : aucun évènement existant ne change d'état ; `verify` vert dans les deux dépôts.
- **Dépend de** : PG-03 du moteur ; décision 6 du plan 15 d'ANTSIA.
- **Porte** : décision du propriétaire.

### EV-16 — Questions à l'inscription · P3 · S · S2
- **Pour l'utilisateur** : deux ou trois questions courtes à l'inscription (régime, taille de tenue).
- **Contenu** : branchement sur PG-17 du moteur ; réponses visibles de l'équipe seule, exportées, effacées, purgées après l'évènement.
- **Dépend de** : PG-17 du moteur ; EV-10 pour l'onglet de l'équipe.
- **Porte** : lot du moteur livré.

### EV-17 — Galerie : contributions des participants et droit à l'image · P3 · M · S1 puis S2
- **Pour l'utilisateur** : un présent propose ses photos ; chacun peut demander le retrait d'une image où il apparaît.
- **Contenu** : dépôt réservé aux présents pointés, relu par l'équipe avant publication ; geste « Demander le retrait » à motif fermé, traité par l'équipe puis par le bureau ; légende modifiable.
- **Dépend de** : EV-04 ; plan 14 de ce dossier.
- **Porte** : avis du juriste sur le droit à l'image ; décision 7.

### EV-18 — Abonnement à mon agenda par flux de calendrier · P3 · M · S1 puis S2
- **Pour l'utilisateur** : mon calendrier habituel suit mes inscriptions sans réexport.
- **Contenu** : adresse secrète, révocable, servie par une route du moteur ; elle livre des titres hors session : c'est le point à trancher.
- **Dépend de** : plan 13 de ce dossier (réglages).
- **Porte** : décision 8 ; revue de sécurité.

### DS-18 — Direct d'un évènement d'association · P3 · M · S2 · repris du plan 15
- **Pour l'utilisateur** : suivre l'assemblée générale de loin.
- **Contenu** : servir la route `conference` de `D:apps/diasporale_com/src/lib/routes.ts` avec les surfaces du moteur, comme `A:apps/antsia_ga/src/components/direct/conference-screen.tsx` ; poser `liveAvailable` dans `D:apps/diasporale_com/src/components/icom.tsx` ; bouton « Diffuser en direct » du détail, au nom de la page, pendant la fenêtre de l'évènement. Deux manques côté moteur : aucun lien entre un évènement et un direct, et aucune audience « adhérents » dans `A:packages/social-domain/src/live/domain.ts` (DL-14, DL-06 du moteur). Consentement à l'enregistrement : DL-02.
- **Dépend de** : plan 04 du moteur (DL-01, DL-02, DL-06, DL-14).
- **Porte** : clés LiveKit et Egress.

### EV-19 — Évènements jumelés entre pays · P3 · M · S2
- **Pour l'utilisateur** : la fête du 17 août réunit, sous une même étiquette, les évènements de plusieurs pays.
- **Contenu** : une « célébration commune » créée par une page officielle ou par le réseau ; chaque association y rattache son évènement ; vue commune dans tous les hubs.
- **Dépend de** : EV-05, EV-11 ; plan 15 de ce dossier.
- **Porte** : pages officielles en place ; décision 9.

## 6. Ordre recommandé et dépendances

| Vague | Lots | Pourquoi dans cet ordre |
|---|---|---|
| 1 | EV-01, EV-02 | Voir les écrans, retirer le faux zéro : zone S2, sans attente |
| 2 | EV-04, EV-03 | Protéger et tenir la promesse faite à l'inscrit ; EV-03 attend une issue `[S1]` |
| 3 | Volet de recette ci-dessous (campagne DS-05) | Prouver avant d'ajouter |
| 4 | EV-05, EV-06, EV-07 | Trouver et faire connaître : sans eux, l'évènement ne vit que sur la page |
| 5 | EV-08, EV-09, EV-10, EV-11 | Reporter, illustrer, accueillir, ouvrir aux autres pages |
| 6 | DS-16 (volet évènements), DS-10, EV-12 à EV-15 | Convergence et enrichissements, après les premiers retours |
| 7 | EV-16 à EV-19, DS-18 | Sous condition externe |

**Demandes à S1, à regrouper en deux issues.** Issue A (P0) : avis d'annulation et de place obtenue (EV-03). Issue B (P1) : période dans la liste d'une page (EV-06), liste par date avec ville, catégorie et portée (EV-05), annonce d'un évènement de page (EV-07), report (EV-08), image (EV-09), code court et pointage par identifiant (EV-10). En tout, quatorze des vingt-deux lots de ce plan demandent une modification du moteur, et cinq autres attendent un lot déjà prévu ailleurs ; seuls EV-01, EV-02 et EV-04 se font dans la zone S2 sans rien attendre. S1 porte déjà 260 lots.

**Ce que ce plan attend des autres plans.** Moteur : plan 07 (PG-03, PG-05, PG-08, PG-10, PG-14, PG-17), plan 04 (DL-01, DL-02, DL-06, DL-14), plan 12 (MC-01, MC-02), plan 03 (SD-02), plan 01 (IC-18), plan 06 (CN-10). Ce dossier : plan 02 (entrée « Mon agenda », bouton du billet, DS-02), plan 03 (carte de publication, liens), plan 06 (écran du hub), plan 07 (gestion de page, groupe), plan 09 (favoris), plan 13 (cloche, préférences, push), plan 14 (signalement, bureau, politique de relecture), plan 15 (pages officielles), plan 16 (mobile), plan 17 (campagne DS-05).

**Volet de recette en mode moteur (campagne DS-05).** Backend local, comptes de démonstration (docs/34 de DIASPORALE) : `association` (équipe), `moderateur`, `declare`, `verifie`, `canada`, `leger` (en attente), `suspendu`. Chaque étape se dit faite ou non faite.

| Étape | Geste | Résultat attendu |
|---|---|---|
| 1 | `association` crée un évènement ouvert au réseau, 2 places | « En attente de modération » ; `declare` ne voit rien |
| 2 | `moderateur` approuve au bureau | `declare` voit l'évènement |
| 3 | `declare` et `verifie` s'inscrivent ; `canada` demande une place ; `leger` ouvre la page | deux confirmés ; `canada` au rang 1 ; `leger` lit sans pouvoir s'inscrire |
| 4 | Deux navigateurs prennent la dernière place en même temps (R-G12) | une seule confirmation, l'autre en attente |
| 5 | `verifie` se retire | `canada` confirmé ; avis une fois EV-03 livré |
| 6 | Capacité réduite sous les confirmés, puis augmentée | refus, puis promotion |
| 7 | Date changée après inscription | refus, jusqu'à EV-08 |
| 8 | Évènement débutant dans 24 h 05, rappel coché | une ligne de cloche à l'échéance ; réception sur appareil : non faite |
| 9 | Dans l'heure qui précède : billet de `declare`, lecture sur un téléphone Android puis sur un iPhone, puis saisie ; second scan ; correction | présence unique ; noter ce que chaque navigateur lit |
| 10 | Après la fin : deux photos par `association` ; lecture par `declare`, puis par un non-adhérent sur un évènement réservé | galerie visible des seuls ayants droit ; retrait effectif |
| 11 | Fichier iCal importé dans trois agendas ; lecture depuis un fuseau canadien (R-G21) ; annulation réexportée | même instant partout ; l'annulation se lit après réimport |
| 12 | « Mon agenda » de `declare` et de `canada` | confirmé et attente dans les bonnes sections |
| 13 | Effacement de `verifie` (R-G19) | place libérée, file avancée |
| 14 | Lecture depuis ANTSIA (R-G03) ; compte `suspendu` | aucun évènement de DIASPORALE lisible |

## 7. Décisions à prendre par le propriétaire

1. **Relecture des évènements avant publication, au pilote.** Aujourd'hui, faute de politique, tout évènement attend une approbation. Recommandation : garder la relecture au démarrage, avec un délai tenu par l'équipe France (viser 24 heures : 48 heures est trop long pour un évènement), puis publication directe pour les associations vérifiées. Raison : cahier EXF-DG-42 ; risque de faux évènements.
2. **Motif d'annulation.** Recommandation : une liste fermée (lieu indisponible, météo, organisateur empêché, autre), sans texte libre. Raison : pas de texte à modérer dans l'urgence.
3. **Liste des inscrits pour l'équipe.** La décision du 18/10 l'écarte. Recommandation : la rouvrir pour l'équipe seule, nom d'usage, sans export, avec l'information donnée au moment de l'inscription. Raison : accueil et sécurité ; le relevé des présents montre déjà ces noms.
4. **Évènements des pages d'entreprise au pilote.** Recommandation : oui, sans mise en avant. Raison : une soirée dans un restaurant gabonais fait vivre le hub ; ce n'est pas de la publicité tant qu'elle reste sur la page et dans l'onglet (D-G04).
5. **Qui organise un évènement de personne ouvert aux inscriptions.** Recommandation : les membres vérifiés, avec capacité obligatoire et relecture. Raison : le cahier (§ 6.2) l'ouvre aux déclarés, mais un évènement ouvert engage des inconnus.
6. **Participation aux frais annoncée.** Recommandation : oui, comme information, sur le modèle du tarif annoncé des services (D-G03). Raison : sans elle, le montant ira dans la description, sans format.
7. **Photos des participants dans la galerie.** Recommandation : non au pilote ; livrer d'abord « Demander le retrait ». Raison : droit à l'image, charge de relecture.
8. **Flux de calendrier.** Recommandation : non au pilote. Raison : une adresse secrète livre des titres hors session.
9. **Portée « toute la diaspora ».** Recommandation : réservée aux associations vérifiées et aux pages officielles, sous relecture. Raison : elle écrit dans tous les hubs.
10. **Rappel par défaut.** Recommandation : le garder décoché, mais le proposer dans le geste d'inscription. Raison : consentement explicite, sans geste caché.

## 8. Risques et points d'attention

- **Un agenda vide au pilote.** Sans équipe France active au bureau, aucun évènement ne paraît (§ 4.1, point 2).
- **La dépendance à S1.** Quatorze lots sur vingt-deux attendent une modification du moteur, le plus souvent dans `A:convex/modules/events/`. Grouper les demandes ; ne rien contourner depuis la tranche.
- **L'accueil.** La lecture par caméra dépend de `BarcodeDetector`, absent de Safari sur iPhone et de Firefox ? ; le code de secours fait 89 caractères ; le billet demande du réseau à la porte. À mesurer à l'étape 9 de la recette.
- **Deux copies des règles.** Après PG-03, les règles vivront dans le moteur et dans `@diasporale/domain` : un test de parité, puis une seule copie (DS-16).
- **Le rappel.** Une ligne de cloche n'est pas une réception. Ne jamais écrire « rappel envoyé » sans push prouvé.
- **Les fuseaux.** Un report ou une série traverse un changement d'heure : rejouer R-G21 à chaque lot qui touche les dates.
- **Les noms.** Toute liste d'inscrits ou de présents montre des personnes : nom d'usage seul, jamais de coordonnée, jamais d'export.
- **La démonstration en ligne.** Ses comptes sont partagés : un évènement créé par un visiteur est vu des suivants (ADR-0038).

## 9. Prompts d'implémentation

### Prompt EV-01
```text
Session S2 (DIASPORALE). Écris en français. Opus seulement.
Lis : docs/etudes/2026-11-10-finalisation/08_EVENEMENTS_AGENDA.md (§ 2, § 6), docs/34_COMPTES_DE_DEMONSTRATION.md, docs/21 et 22.
Branche claude/demo-evenements depuis origin/main. Périmètre : packages/diasporale-domain/src/demo-accounts.ts, apps/diasporale_com/src/components/demo-account-bootstrap.tsx, leurs tests, textes fr et en.
Fais : ajoute à l'acteur « association » un geste qui crée, par la capacité du port, deux évènements marqués fictifs (un ouvert au réseau, 2 places, dans 7 jours ; un réservé aux adhérents). Rejeu sans doublon. N'écris aucune politique de modération : l'évènement reste en attente, « moderateur » l'approuve au bureau.
Vérifie : bun run --cwd ../ANTSIA verify avec le verrou ; backend local 3320/3321 (demande l'accord pour les variables) ; captures à 390 et 1280 px, Sable et Gaboma. Arrête-toi avant toute publication.
```

### Prompt EV-02
```text
Session S2. Lis le § 2 du plan 08 (lignes 72 et 73) et le lot EV-02.
Branche claude/hub-sans-faux-zero. Périmètre : apps/diasporale_com/src/screens/hub-screen.tsx et feed-screen.tsx, apps/diasporale_com/src/data/engine-views.ts, packages/diasporale-domain/src/hubs.ts, packages/diasporale-features/src/data/types.ts, tests et textes.
Vérifie d'abord dans le code que le compteur vaut toujours zéro en mode moteur. Puis retire le nombre d'évènements en mode moteur, garde la démonstration, et fais dire à l'onglet où trouver les évènements. Préviens la session du plan 06 : elle possède l'écran du hub.
Vérifie : verify vert ; backend local avec un évènement publié : aucun nombre d'évènements à l'écran. Arrête-toi avant toute publication.
```

### Prompt EV-03
```text
Session S2, avec une issue [S1]. Lis le lot EV-03, docs/24, ANTSIA/convex/modules/events/pageEvents.ts (cancel), pageEventRegistrations.ts (fillPageEventSeatsNow), pageEventReminders.ts.
Étape 1 : ouvre l'issue « [S1] Avis aux inscrits d'un évènement de page : annulation, place obtenue » dans administration-ga/antsia. Dis les deux genres neutres, la diffusion par lots, la garde de visibilité, le motif fermé. Aucune donnée sensible : le dépôt est public.
Étape 2, après la publication du backend par S1 : branche claude/avis-evenements ; libellés fr et en des deux genres, lien vers le détail, phrase de la confirmation d'annulation, rappel proposé dans le geste d'inscription, démonstration qui simule et le dit.
Vérifie : verify vert ; à deux comptes, annulation puis promotion, une ligne de cloche chacune. Ne dis pas « reçu sur l'appareil ».
```

### Prompt EV-05
```text
Session S2, avec une issue [S1]. Lis les lots EV-05 et EV-02, le plan 07 du moteur (PG-10), ANTSIA/convex/modules/diaspora/hubs.ts et pilotMetrics.ts, apps/diasporale_com/src/screens/hub-screen.tsx.
Étape 1 : issue « [S1] Évènements de page : ville, catégorie, portée, liste par date » ; demande l'index, les champs facultatifs et la lecture paginée gardée, sans « Intéressé ».
Étape 2 : dans la tranche, compte les évènements à venir par pays dans le passage nocturne des hubs. Dans le dépôt DIASPORALE : lecture du port, onglet du hub, carte reliée au détail, champs du formulaire, démonstration sur le même modèle.
Critères : Lyon paraît dans le hub France et pas dans le hub Canada ; un évènement réservé aux adhérents ne paraît jamais ; le compteur égale la liste après le passage.
Vérifie : verify vert ; recette à 390, 834 et 1440 px. Arrête-toi avant toute publication ; S1 publie le backend d'abord.
```

## 10. Sources lues

- Brief commun de la session principale ; dossier de reprise, § 7, § 10.2 et § 13.
- DIASPORALE : cahier (docs/00, § 5, § 6, § 8.8, § 9), plan global (docs/14, § 1, § 3, § 4 G3 et G8, § 6.2, § 7), registre des droits (docs/17, § 2 et § 4), docs/21, 22, 24, 27, 28, 29, 30 en entier, docs/34, rapport des couleurs du 3/11.
- ANTSIA : plan 07 du moteur (§ 2, PG-03, PG-04, PG-05, PG-10, PG-14, PG-17, § 6, § 7), plan 04 du moteur (§ 2, DL-01, DL-02, DL-06, DL-13, § 7), plan 15, registre des lots.
- Dossier produit : fiche F03. Vault : décisions du 18/10 sur la capacité, la clôture et les rappels, les présences QR.
- Code DIASPORALE : `D:apps/diasporale_com/src/components/association-events.tsx`, le formulaire, les présences, la caméra, la galerie, le calendrier ; `D:apps/diasporale_com/src/screens/agenda-screen.tsx`, `D:apps/diasporale_com/src/screens/hub-screen.tsx`, `D:apps/diasporale_com/src/screens/page-screen.tsx` ; `D:apps/diasporale_com/src/data/engine-association-activities.ts`, `D:apps/diasporale_com/src/data/engine-views.ts` ; les quatre ports d'évènements ; `D:packages/diasporale-features/src/demo/association-activities.ts` ; les règles `event-…` du domaine ; les textes fr des fragments d'évènements.
- Code ANTSIA : les treize fichiers de `A:convex/modules/events/` ; `A:convex/modules/diaspora/associationEventRules.ts`, `A:convex/modules/diaspora/hubs.ts`, `A:convex/modules/diaspora/pilotMetrics.ts`, `A:convex/modules/diaspora/moderationDesk.ts` ; `A:convex/modules/moderation/policy.ts`, `A:convex/modules/moderation/cases.ts` ; `A:convex/modules/live/sessions.ts` ; `A:convex/modules/personalMeetings/capabilities.ts` ; `A:packages/social-features/src/features/reseau-personnel/EvenementsPanel.tsx`.
