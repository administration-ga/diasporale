# Plan 13 — Notifications, réglages et données personnelles

> Constaté par lecture du code d'`origin/main` (DIASPORALE `bead76d`, ANTSIA `fd58d73b`), le 10 novembre 2026. Rien n'a été exécuté : ni test, ni recette, ni publication.
> Applications de référence : réglages et notifications d'Instagram, de Facebook, de LinkedIn, de WhatsApp et de Nextdoor. Comparaison faite de mémoire, sans revérification en ligne ; un « ? » marque ce qui n'est pas sûr.
> Ce plan détaille, pour la cloche, les réglages et les droits sur ses données, le plan 15 du dossier de finalisation d'ANTSIA. Les lots qu'il en reprend gardent leur identifiant (DS-…, DG-…) ; les lots nouveaux portent le préfixe `NP-`.

Légende des chemins : `D:` = dépôt DIASPORALE, `A:` = dépôt ANTSIA. « Écran » = atteignable depuis l'interface de diasporale.com ; « Moteur » = la fonction existe côté serveur.

## 1. L'intention du propriétaire

- **Pour qui** : tout membre, du compte en attente au membre suspendu. Il doit « rester maître de ses données : consentements explicites, visibilité par niveau, export et effacement effectifs » (cahier § 2.1, objectif 6).
- **La cloche** : héritée du moteur, sans aucun contenu dans la notification, avec des préférences fines et un plafond hebdomadaire des notifications communautaires (cahier EXF-DG-38).
- **Hors de l'application** : push Web et mobile pour les mentions, réponses, invitations, évènements du pays et offres qui correspondent ; résumé mensuel par pays par e-mail (cahier EXF-DG-39 ; fiche F14 du dossier produit).
- **Une matrice** évènement → destinataire → canal → plafond, des heures calmes, le fuseau personnel, la sourdine par conversation et par association. Un avis de service attendu ne se confond jamais avec une communication promotionnelle (plan global, docs/14 de DIASPORALE, § 7.4).
- **Consentements** : registre horodaté et révocable (profil social, annuaire, attestation consulaire, notifications, talents), jamais de case précochée, retrait aussi simple que l'accord (cahier EXF-DG-44 ; invariants § 5).
- **Données** : export, puis effacement effectif de tous les contenus sociaux et des fichiers, avec délai et confirmation ; conservation bornée (cahier EXF-DG-45 et EXF-DG-47 ; parcours R9 ; scénario R-G19 du plan global).
- **Droits ouverts au suspendu**, sans lui rouvrir les surfaces sociales (registre des droits, docs/17 de DIASPORALE, § 4, dernière ligne ; ADR-0009 du moteur, point 3).
- **Le compte est commun aux réseaux** : langue et thème suivent la personne ; l'effacement vise tout le compte, quitter DIASPORALE ne vise que l'adhésion (ADR-0026 du moteur ; docs/09 de DIASPORALE).
- **Déjà décidé** : avis neutres, relus à la lecture (docs/32 de DIASPORALE, § 7 et § 8) ; aucune publicité au pilote, donc ni avis promotionnel ni résumé sponsorisé (D-G04 ; F17 renvoyé au lot D4) ; aucun classement comportemental, donc aucun avis « susceptible de vous plaire » (D-G05).
- **Refusé** : un réglage sans effet côté serveur, un contenu privé dans un envoi externe, un statut « conforme » déduit d'un test technique (plan global, lot G9).

## 2. Ce qui existe

| # | Capacité | État | Écran | Moteur | Preuve |
|---|---|---|---|---|---|
| 1 | Cloche dans la coque, au bureau et au téléphone ; feuille au clic | Présent | oui | oui | `D:apps/diasporale_com/src/components/app-shell.tsx`, `D:packages/diasporale-features/src/components/notification-bell.tsx` |
| 2 | Pastille des non-lus, « 99+ » au-delà | Présent | oui | oui | `A:convex/modules/notifications/bell.ts` (`unreadCount`) |
| 3 | Avis bornés au réseau `diasporale` : ceux d'ANTSIA restent dans ANTSIA | Présent | oui | oui | `A:convex/modules/notifications/bell.ts` (`paginateNotifications`) |
| 4 | Mise à jour en direct | Présent | oui | oui | `D:apps/diasporale_com/src/data/engine-source.ts` (`useNotifications`) |
| 5 | Liste des avis | Partiel : les 30 derniers seulement, aucune suite, alors que le moteur pagine | partiel | oui | `D:apps/diasporale_com/src/data/engine-source.ts` (`BELL_PAGE`) |
| 6 | Page des notifications, avec tout l'historique | Absent | non | oui | motifs : `/notifications`, `routes.notifications` dans `D:apps/diasporale_com/src/lib/routes.ts` |
| 7 | Marquer un avis lu ; tout marquer lu | Présent | oui | oui | `A:convex/modules/notifications/bell.ts` (`markRead`, `markAllRead`) |
| 8 | Filtre « Non lues », sections « Nouveau » et « Plus tôt » | Absent ici ; le moteur l'a | non | oui | `A:packages/social-features/src/features/notifications/NotificationsList.tsx` |
| 9 | Regroupement (« X et 3 autres ») | Absent | non | non | une ligne par genre, sujet et acteur : `A:packages/social-domain/src/notifications.ts` ; lot CN-08 du moteur |
| 10 | Accepter ou refuser une demande de relation depuis l'avis ; issue affichée ensuite | Présent | oui | oui | `D:packages/diasporale-features/src/components/notification-bell.tsx` (`pendingConnectionId`, `inviteOutcome`) |
| 11 | Lien vers l'objet, relu avec les droits du lecteur | Présent | oui | oui | `D:packages/diasporale-features/src/routing.tsx`, `A:convex/modules/notifications/targets.ts` |
| 12 | 42 genres nommés (liste plus bas) | Présent | oui | oui | `D:packages/diasporale-features/src/data/types.ts` (`NOTIFICATION_KINDS`) |
| 13 | 16 genres communs du moteur dits « Nouvelle activité dans DIASPORALE » | Partiel : message ou invitation de groupe, page suivie, album, invitation à un évènement, fichier retenu, appel manqué, message vocal n'ont ni phrase ni geste | partiel | oui | `D:apps/diasporale_com/src/data/engine-views.ts` (`SPOKEN_KINDS`), `A:packages/social-domain/src/notifications.ts` |
| 14 | Avis neutres : ni contenu, ni montant, ni nom pour les avis du système | Présent | oui | oui | `A:convex/modules/diaspora/serviceNotifications.ts`, `A:convex/modules/diaspora/communityNotifications.ts` |
| 15 | Un avis dont l'objet ne se lit plus quitte la cloche et le décompte | Présent | oui | oui | `A:convex/modules/notifications/policy.ts` (`notificationStillVisible`) |
| 16 | Dédoublonnage : le même geste remplace son avis | Présent | — | oui | `A:convex/modules/notifications/notify.ts` |
| 17 | Supprimer un avis ; « moins d'avis de ce type » | Absent | non | non | motifs : `deleteNotification`, `dismiss` dans `A:convex/modules/notifications/bell.ts` |
| 18 | Nombre de non-lus dans le titre de l'onglet | Absent | non | — | motif : `document.title` dans `D:apps/diasporale_com/src` |
| 19 | Rappel J-1 d'un évènement d'association | Partiel : écrit dans la cloche, aucun envoi hors de l'application | partiel | oui | `A:convex/modules/events/pageEventReminders.ts` |
| 20 | Avis d'un évènement annulé ou modifié, d'une place libérée | Absent | non | non | aucun `notifyPerson` dans `A:convex/modules/events/pageEventRegistrations.ts` (plan 08) |
| 21 | Avis d'une revendication de page tranchée, d'un rôle d'équipe donné ou retiré | Absent | non | non | aucun avis hors `page_post` dans `A:convex/modules/pages` (lot PG-01 du moteur) |
| 22 | Avis à l'équipe d'un nouvel avis sur un service ; rappel d'un rendez-vous ou d'une séance de mentorat | Absent | non | non | seul `noticeServiceReviewReplied` dans `A:convex/modules/diaspora/serviceReviews.ts` ; motifs `reminder`, `rappel` (plans 09 et 11) |
| 23 | Préférences par catégorie (six) pour le push et le récapitulatif | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/notifications/preferences.ts` (`getMine`, `update`) |
| 24 | Catégories propres à DIASPORALE | Absent : les 25 genres de la tranche tombent tous dans « social » | non | non | `A:convex/modules/notifications/policy.ts` (`notificationRowCategory`) |
| 25 | Couper une famille d'avis dans la cloche elle-même | Absent | non | non | l'écriture ne lit aucune préférence : `A:convex/modules/notifications/notify.ts` |
| 26 | Plafond hebdomadaire des envois (35 par défaut, 100 au plus) | Absent ici ; le moteur l'a | non | oui | `A:packages/social-domain/src/notificationDelivery.ts`, `A:convex/modules/notifications/deliveries.ts` |
| 27 | Pause, heures calmes | Absent | non | non | motifs : `quietHours`, `pausedUntil` ; lot CN-07 du moteur |
| 28 | Push web : service worker, abonnement de l'appareil | Absent ici ; le moteur l'a, non configuré | non | oui | `A:convex/modules/notifications/pushSubscriptions.ts`, `A:apps/antsia_ga/src/lib/notification-worker.ts` ; motifs cherchés dans DIASPORALE : `serviceWorker`, `PushManager`, `vapid` |
| 29 | Ouverture ciblée d'une notification poussée | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/notifications/open.ts` |
| 30 | DIASPORALE déclarée comme application de notification | Fermé : variable `NOTIFICATION_APPLICATIONS_JSON`, au propriétaire | non | oui | `A:convex/modules/notifications/configuration.ts` |
| 31 | Consentement « notifications » relu avant tout envoi | Partiel : DIASPORALE l'enregistre sans réseau, le moteur l'exige pour le réseau exact | partiel | oui | `D:apps/diasporale_com/src/data/engine-source.ts` (`join`, `setConsent`), `A:convex/modules/notifications/consent.ts` |
| 32 | Récapitulatif par e-mail : nombre d'avis non lus, une fois par semaine au plus | Absent ici ; le moteur l'a, fermé sans clés d'envoi | non | oui | `A:convex/modules/notifications/digest.ts` |
| 33 | Marque DIASPORALE dans ce récapitulatif | Absent : l'objet porte la marque du réseau racine | non | non | `A:convex/modules/notifications/digest.ts` (`BRAND_NAME`) |
| 34 | Résumé mensuel par pays (EXF-DG-39) ; désabonnement en un geste | Absent | non | non | motifs : `monthly`, `List-Unsubscribe` ; lot CN-09 du moteur |
| 35 | Courriels envoyés aujourd'hui : le seul code de connexion, à la marque du réseau | Présent | — | oui | `A:convex/betterAuth/delivery.ts` |
| 36 | Push natif | Absent : aucune application mobile (plan 16) | non | partiel | `D:apps/diasporale_com` est la seule application |
| 37 | Page `/parametres` : onze rubriques sur une seule page | Présent | oui | — | `D:apps/diasporale_com/src/screens/settings-screen.tsx` |
| 38 | Sommaire, sous-pages ou recherche dans les réglages | Absent | non | — | motifs : `sommaire`, `toc`, `settingsSearch` |
| 39 | Adresses directes : mon fil, images, mes données, mes signalements, parrainage | Présent | oui | — | `D:apps/diasporale_com/src/lib/routes.ts` |
| 40 | Mes réseaux : statut, badges, date d'entrée, parrain, adhésion ANTSIA dérivée | Présent | oui | oui | `D:apps/diasporale_com/src/screens/settings-screen.tsx` (`MembershipSection`) |
| 41 | Nom affiché et accroche | Présent | oui | oui | `D:apps/diasporale_com/src/components/profile-identity-settings.tsx` |
| 42 | Profil privé, retrait, republication ; images (détail au plan 05) | Présent | oui | oui | `D:apps/diasporale_com/src/components/profile-publication-settings.tsx`, `D:apps/diasporale_com/src/components/profile-images-settings.tsx` |
| 43 | Facette, visibilité par champ, niveau d'annuaire (plans 01 et 05) | Présent | oui | oui | `D:apps/diasporale_com/src/screens/settings-screen.tsx` (`FacetSection`, `DirectorySection`) |
| 44 | Mon fil : publications masquées, auteurs en sourdine, restauration | Présent | oui | oui | `D:apps/diasporale_com/src/components/content-preferences-settings.tsx`, `A:convex/modules/diaspora/contentPreferences.ts` |
| 45 | Personnes bloquées, hors des réglages, dans les relations (plan 05) | Présent | oui | oui | `D:apps/diasporale_com/src/lib/routes.ts` (`relations`) |
| 46 | Langue (français, anglais) enregistrée sur le compte | Présent | oui | oui | `D:apps/diasporale_com/src/components/account-locale.tsx`, `A:convex/modules/people/preferences.ts` |
| 47 | Apparence claire, sombre ou du système | Présent | oui | — | `D:apps/diasporale_com/src/components/preferences.tsx` |
| 48 | Thème Sable ou Gaboma, enregistré sur le compte | Présent | oui | oui | `D:apps/diasporale_com/src/components/theme-picker.tsx`, `D:apps/diasporale_com/src/components/account-theme.tsx` |
| 49 | Fuseau horaire personnel | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/people/preferences.ts` (`setMyPreferences`, champ `timeZone`), jamais envoyé par `D:apps/diasporale_com/src/data/engine-source.ts` |
| 50 | Taille du texte, animations réduites | Absent | non | non | lot CN-15 du moteur (plan 02) |
| 51 | Se déconnecter partout | Présent | oui | oui | `D:apps/diasporale_com/src/components/sign-out-settings.tsx` |
| 52 | Appareils et sessions, alerte de connexion, changement d'e-mail ou de téléphone | Absent | non | non | lots CN-03, CN-04, CN-05 du moteur (plan 01) |
| 53 | Quitter DIASPORALE ; l'adhésion ANTSIA reste | Présent | oui | oui | `A:convex/modules/diaspora/membership.ts` (`leaveDiasporale`) |
| 54 | L'écran distingue « quitter DIASPORALE » et « effacer le compte commun » | Présent | oui | — | `D:packages/diasporale-features/src/i18n/locales/fr/data-rights.json` (clés `erasure.scope`, `erasure.leaveInstead`) |
| 55 | Dire ce que deviennent mes contenus et mes profils volontaires après un départ | Partiel : le départ ne supprime rien, l'écran ne le dit pas | partiel | oui | `A:convex/modules/diaspora/membership.ts` (`leaveDiasporale` : statut `partie`, parrainage éteint, rien d'autre) |
| 56 | Registre affiché : cinq finalités, date et version du texte | Présent | oui | oui | `D:apps/diasporale_com/src/screens/settings-screen.tsx` (`CONSENT_ROWS`), `A:convex/modules/diaspora/membership.ts` (`myConsents`) |
| 57 | Aucune case précochée | Présent | oui | oui | `D:packages/diasporale-domain/src/consents.ts` (`initialConsentChoices`) |
| 58 | Retrait « annuaire » : la fiche quitte l'annuaire aussitôt | Présent | oui | oui | `D:apps/diasporale_com/src/data/engine-source.ts` (`setConsent`) |
| 59 | Retrait « notifications » | Partiel : enregistré, sans effet ; rien n'est envoyé et la cloche ne lit pas ce consentement | partiel | partiel | `A:convex/modules/notifications/policy.ts` (`pushAllowed`) |
| 60 | Retrait « attestation consulaire » | Partiel : l'écran annonce le retrait, la ligne du réseau reste en vigueur | partiel | oui | retrait sans réseau dans `D:apps/diasporale_com/src/data/engine-source.ts` (`setConsent`) ; accord posé avec le réseau dans `A:convex/modules/diaspora/attestation.ts` ; règle de `A:convex/modules/people/consents.ts` (`revokeConsent`) |
| 61 | Profil social verrouillé : on retire son profil ou on quitte | Présent | oui | oui | `D:apps/diasporale_com/src/screens/settings-screen.tsx` |
| 62 | Finalité « talents » | Partiel : ligne grisée « Bientôt », alors que les talents existent et portent leur propre accord | partiel | oui | `D:packages/diasporale-features/src/i18n/locales/fr/diasporale.json` (clé `consentPurpose.talents`), `A:convex/modules/diaspora/jobsTables.ts` |
| 63 | Accords donnés dans un objet : nom montré à une page, avis publié, mentor, mentoré, candidature | Partiel : horodatés dans l'objet, absents du registre affiché | non | oui | `A:convex/modules/diaspora/serviceRequestsTables.ts` (`identityConsentAt`), `A:convex/modules/diaspora/mentoringTables.ts` (`consentAt`, `optedInAt`), `A:convex/modules/diaspora/serviceReviewsTables.ts` |
| 64 | Relire le texte accepté ; historique de mes gestes | Absent | non | partiel | versions seules dans `A:packages/social-domain/src/consent.ts` ; lot CN-12 du moteur |
| 65 | Accord au récapitulatif par e-mail ; mesure d'usage consentie | Absent ici ; le moteur les a | non | oui | `A:packages/social-domain/src/consent.ts` (`email_digest`, `usage_analytics`) |
| 66 | Export : fichier JSON assemblé dans le navigateur, avancement, interruption | Présent | oui | oui | `D:apps/diasporale_com/src/components/data-rights-settings.tsx`, `D:apps/diasporale_com/src/data/engine-data-rights.ts`, `A:convex/modules/people/erasure.ts` (`exportMyData`, `exportMyDataPage`) |
| 67 | Export des 26 tables de la tranche | Partiel : la proposition reçue et le rendez-vous ne sont dans aucun fichier (inventaire plus bas) | — | partiel | `A:convex/modules/people/dataInventory.ts` (`exportableRecord`), `A:convex/modules/people/commerce-trust-data-policy.test.ts` |
| 68 | Export lisible sans outil ; choix des rubriques ; reprise | Absent | non | non | un seul format, `DATA_EXPORT_FORMAT`, dans `D:apps/diasporale_com/src/data/engine-data-rights.ts` |
| 69 | Effacement : confirmation forte, 30 jours de grâce, annulation, compte à rebours | Présent | oui | oui | `A:convex/modules/people/erasure.ts` (`requestErasure`, `cancelErasure`, `ERASURE_GRACE_MS`) |
| 70 | Effacement en cascade des tables de la tranche et de leurs compteurs | Présent | — | oui | `A:convex/modules/people/dataPolicies.ts`, `A:convex/modules/diaspora/contentCounters.ts` (`removeDiasporaCounters`) |
| 71 | Dire ce que les autres perdent quand je m'efface | Partiel : le texte cite profil, publications, réactions, consentements et parrainages, rien d'autre | partiel | — | `D:packages/diasporale-features/src/i18n/locales/fr/diasporale.json` (clé `settings.deleteConfirmBody`) |
| 72 | Rappel avant l'échéance ; confirmation de fin | Absent | non | non | aucun envoi dans `A:convex/modules/people/erasure.ts` |
| 73 | Décisions de modération de tous les réseaux du compte, et recours | Présent | oui | oui | `D:apps/diasporale_com/src/components/moderation-decisions.tsx`, `A:convex/modules/moderation/cases.ts` (`myDecisions`, `fileAppeal`) |
| 74 | « Mes signalements » : accusé, échéance légale, issue | Partiel : en mode moteur seulement, absent de la démonstration | oui | oui | `D:apps/diasporale_com/src/components/my-reports.tsx`, `A:convex/modules/moderation/cases.ts` (`myReports`) ; aucun `useReports` dans `D:packages/diasporale-features/src/demo/data-rights.ts` |
| 75 | « Mes données » ouverte au membre suspendu | Présent | oui | oui | `D:apps/diasporale_com/src/components/gate.tsx` |
| 76 | « Mes données » pour qui a quitté DIASPORALE ou n'y a jamais adhéré | Absent ici ; le moteur l'a, dans ANTSIA | non | oui | renvoi vers l'accueil dans `D:apps/diasporale_com/src/components/gate.tsx` ; déconnexion seule dans `D:apps/diasporale_com/src/screens/welcome-screen.tsx` ; `A:apps/antsia_ga/src/app/mes-donnees/page.tsx` |
| 77 | État du compte ; demandes datées de rectification ; journal du compte | Absent | non | non | lots MC-04, SU01e, CN-13 du moteur |
| 78 | Durées de conservation des tables de la tranche, purge | Absent | — | non | motifs : `purge`, `retention` dans `A:convex/modules/diaspora` |
| 79 | Conservation des avis (180 jours lus, 365 non lus) et des exports (24 h) | Présent | — | oui | `A:convex/modules/notifications/retention.ts`, `A:convex/crons.ts` |
| 80 | Démonstration à parité : cloche, consentements, export, effacement | Présent | oui | — | `D:packages/diasporale-features/src/demo/store.ts`, `D:packages/diasporale-features/src/demo/data-rights.ts` |
| 81 | Compte d'un membre décédé, personne de confiance | Absent | non | non | motifs : `memorial`, `legacy`, `décès` |

Décompte : **Présent 37 · Partiel 12 · Absent 31 · Fermé 1**. Neuf des « Absent » sont déjà servis par le moteur.

### Les genres de la cloche (42 nommés, plus « Nouvelle activité »)

| Famille | Genres | Destinataire | Ce que l'avis ouvre |
|---|---|---|---|
| Relations et publications (7) | `connection_request`, `connection_accepted`, `new_follower`, `post_reaction`, `post_comment`, `post_share`, `mention` | la personne visée | le profil de qui a agi, la publication ; la demande se tranche sur place |
| Parrainage et attestation (4) | `sponsorship_received`, `sponsorship_withdrawn`, `attestation_verified`, `attestation_not_confirmed` | le membre | le profil du parrain ; rien pour l'attestation |
| Évènement (1) | `association_event_reminder` | l'inscrit qui a demandé le rappel | l'évènement |
| Mise en relation (10) | `service_request_received`, `service_proposal_received`, `service_request_declined`, `service_proposal_accepted`, `service_request_cancelled`, `service_request_expired`, `service_booking_completed`, `service_booking_no_show`, `service_no_show_contested`, `service_review_replied` | le demandeur, ou l'équipe de la page | la demande, vue de son côté |
| Adhésion associative (4) | `association_membership_requested`, `association_membership_accepted`, `association_membership_declined`, `association_membership_removed` | les responsables, ou la personne | les adhérents de la page, ou « Mes associations » |
| Vie communautaire (11) | `aid_answer_received`, `aid_answer_retained`, `aid_mission_signup`, `mentoring_request_received`, `mentoring_request_accepted`, `mentoring_request_declined`, `mentoring_closed`, `job_application_received`, `job_application_shortlisted`, `job_application_not_selected`, `kit_resource_reviewed` | l'auteur, l'équipe, le mentor, le mentoré, la personne qui candidate | la question, la mission, « Mes mentorats », les candidatures, la ressource |
| Conversation de mise en relation (2) | `contextual_message`, `contextual_closed` | l'autre côté du fil | le fil |
| Modération (3) | `moderation_decision`, `report_received`, `report_decided` | la personne concernée, les signataires de la page, le déclarant | « Mes données », les décisions de la page, « Mes signalements » |

Aucun de ces avis ne sort de l'application : il n'existe ni push, ni e-mail, ni SMS pour eux dans DIASPORALE.

### Inventaire des tables de la tranche : export et effacement

Les 26 tables du manifeste (`A:convex/modules/diaspora/manifest.ts`) sont toutes classées dans `A:convex/modules/people/dataPolicies.ts`. L'export refuse de partir si une table du schéma n'est pas classée (`unclassifiedDataTables`). Aucune table de la tranche ne porte de fichier.

| Table | Classement | Export : qui reçoit quoi | Effacement de la personne | À savoir |
|---|---|---|---|---|
| `countryHubs` | partagée | personne (agrégat) | sans effet | — |
| `sponsorships` | aux deux parties | parrain et filleul : la ligne | supprimée si l'un des deux s'efface | le fichier de l'un porte l'identifiant interne de l'autre |
| `consularAttestations` | à la personne | la personne : résultat, pays, poste, dates, empreinte | supprimée | aucune donnée consulaire |
| `communityImports` | partagée | personne | sans effet | table jamais écrite |
| `memberPrivacy` | à la personne | la personne | supprimée | — |
| `serviceOffers` | partagée, contenu de page | personne | conservée | — |
| `serviceRequests` | au demandeur | le demandeur : besoin, fenêtres, états, motifs | supprimée ; entraîne propositions, rendez-vous, avis et conversation | l'équipe de la page perd la demande reçue |
| `serviceProposals` | sans propriétaire, suit la demande | **personne** | supprimée avec la demande ; signataire rendu anonyme | manque : le demandeur ne reçoit pas la proposition qu'il a acceptée |
| `serviceBookings` | suit la demande | **personne** | supprimée avec la demande | manque : le rendez-vous n'est dans aucun fichier |
| `serviceReviews` | à l'auteur, suit la demande | l'auteur | supprimée | — |
| `serviceReviewReplies` | sans propriétaire, suit l'avis | personne (contenu de page) | supprimée avec l'avis ; signataire rendu anonyme | — |
| `associationMemberships` | à la personne | la personne | supprimée | la référence du responsable qui a décidé disparaît à son effacement |
| `aidQuestions` | à l'auteur | l'auteur | supprimée ; entraîne toutes ses réponses | les réponses écrites par d'autres disparaissent avec la question |
| `aidAnswers` | à l'auteur, suit la question | l'auteur | supprimée ; compteur et réponse retenue ajustés | — |
| `aidMissions` | partagée, contenu de page | personne | conservée | — |
| `aidMissionSignups` | à la personne, suit la mission | la personne | supprimée ; places recalculées | — |
| `mentorProfiles` | au mentor | le mentor | supprimée ; entraîne fiches et demandes | — |
| `mentorListings` | au mentor, suit le profil | le mentor | supprimée | — |
| `mentoringRequests` | aux deux parties, suit le profil | le mentoré : tout ; le mentor : sans l'objectif ni le message | supprimée si l'un des deux s'efface | l'autre partie perd l'historique du mentorat |
| `pilotMetricsDaily` | partagée | personne (agrégat) | sans effet | — |
| `jobOffers` | partagée, contenu de page | personne | conservée | — |
| `jobApplications` | au candidat | le candidat, sans le motif de non-sélection ni l'identité de qui a décidé | supprimée | l'équipe perd la candidature ; motif hors export : point ouvert |
| `talentProfiles` | à la personne | la personne | supprimée | — |
| `kitResources` | à l'auteur si elle est personnelle | l'auteur d'une ressource personnelle ; rien pour une ressource de page | personnelle : supprimée ; de page : conservée, auteurs rendus anonymes | — |
| `kitResourceReviews` | sans propriétaire, suit la ressource | le relecteur : son verdict et son motif | supprimée avec la ressource | — |
| `kitOutdatedFlags` | à la personne, suit la ressource | la personne | supprimée ; compteur ajusté | — |

Bilan : effacement couvert pour 26 tables sur 26 ; export couvert pour 24, et deux tables (`serviceProposals`, `serviceBookings`) ne sont rendues à personne, ce que le test `A:convex/modules/people/commerce-trust-data-policy.test.ts` fige. Les inscriptions aux évènements vivent dans les tables du moteur (`events`, `eventParticipants`), classées elles aussi.

### Ce que le moteur sait déjà faire et que DIASPORALE ne montre pas

- Envois : préférences par catégorie et plafond (`A:convex/modules/notifications/preferences.ts`), abonnement d'un appareil, liste et révocation de mes appareils (`A:convex/modules/notifications/pushSubscriptions.ts`), ouverture ciblée (`A:convex/modules/notifications/open.ts`), récapitulatif par e-mail avec son consentement propre (`A:convex/modules/notifications/digest.ts`).
- Cloche : suite au-delà de la première page, filtre « Non lues », sections (`A:packages/social-features/src/features/notifications/NotificationsList.tsx`).
- Compte : fuseau personnel (`A:convex/modules/people/preferences.ts`) ; page « Mes données » hors de la coque de membre (`A:apps/antsia_ga/src/app/mes-donnees/page.tsx`).

### Ce qui est écrit mais jamais recetté en réel

| Recette | État | Source |
|---|---|---|
| Avis d'entraide, de mission, de mentorat et de candidature dans les deux cloches | Vus à deux comptes, backend local, le 19/10 | docs/recette/deux-comptes-2026-10-19 de DIASPORALE |
| Accusé au déclarant, avis de décision, « Mes signalements » | Joués sur backend local le 22/10, à 1280 et 390 px | docs/recette/su01d-avis-et-motifs-2026-10-22 de DIASPORALE |
| Export puis effacement après un service et une adhésion (R-G19) | Jamais joués | docs/14 de DIASPORALE, § 6.2 ; plan 15, § 2 |
| Effacement arrivé à échéance, avec ses effets sur l'autre partie | Jamais joué ; tests sur données fictives | plan 06 du moteur, § 2 |
| Retrait de chaque consentement, puis relecture de son effet | Jamais joué en mode moteur | lignes 59 et 60 ci-dessus |
| Décision de modération lue par l'auteur, puis recours | Jamais joué : il faut une équipe de modération | docs/32 de DIASPORALE, § 12 |
| Rappel J-1 reçu ; push, e-mail | Jamais : aucun canal sortant n'est branché | lignes 19, 28 et 32 ci-dessus |

## 3. Comparaison avec les applications de référence

| Capacité | Instagram | Facebook | LinkedIn | WhatsApp | Nextdoor | DIASPORALE | Verdict |
|---|---|---|---|---|---|---|---|
| Centre de notifications avec historique | oui | oui | oui | non | oui | feuille de 30 avis | À faire (NP-04) |
| Filtre non lues ou par type | ? | oui | oui | — | ? | non | À faire (NP-04) |
| Regroupement des avis | oui | oui | oui | — | ? | non | Reporté (CN-08 du moteur ; rendu prévu par NP-04) |
| Marquer lu, tout marquer lu | non | oui | oui | — | ? | oui | Déjà fait |
| Agir depuis l'avis | oui | oui | oui | — | ? | relation seulement | À adapter (NP-04 : invitation de groupe, d'évènement) |
| Supprimer un avis, « moins comme ceci » | non | oui | oui | — | ? | non | Écarté au pilote : conservation déjà bornée, préférences à la place |
| Réglages par type d'avis | oui | oui | oui | par discussion | oui | non | À faire (DS-14, volet préférences) |
| Réglages par canal : application, push, e-mail | oui | oui, et SMS | oui | — | oui | non | À faire (DS-14, volet préférences) |
| Tout suspendre un moment | oui | ? | ? | par discussion | ? | non | À faire (NP-12) |
| Heures calmes | oui | ? | ? | non | ? | non | À faire (NP-12) |
| Push sur le navigateur | oui | oui | oui | oui | ? | non | À faire (DS-14, volet push) |
| Contenu du message dans le push | oui | oui | oui | oui, réglable | oui | jamais | Écarté : aucun contenu privé hors de l'application (docs/14, § 7.4) |
| Résumé par e-mail | ? | oui | oui | non | oui | non | À faire (DS-14, volet résumé) |
| Résumé par zone : quartier, pays | non | non | non | non | oui | non | À faire (DS-14, volet résumé) |
| Désabonnement en un geste | oui | oui | oui | — | oui | non | À faire (CN-09 du moteur, DS-14) |
| Sourdine d'une page, d'un groupe, d'un évènement | oui | oui | oui | oui | ? | auteurs du fil seulement | À faire (NP-14) |
| Rappel d'évènement hors de l'application | ? | oui | oui | — | oui | cloche seulement | À faire (DS-14, volet push) |
| Réglages rangés, avec recherche | oui | oui | oui | oui | ? | une page longue | À faire (NP-06) |
| Langue ; thème clair ou sombre | oui | oui | oui | oui | ? | français, anglais ; clair, sombre, deux thèmes | Déjà fait |
| Fuseau ou région | — | oui | ? | — | — | non | À faire (NP-07) |
| Appareils connectés, fermeture à distance | oui | oui | oui | oui | ? | « partout » seulement | Reporté (CN-03 du moteur ; plan 01) |
| Confidentialité réunie en un lieu | oui | oui | oui | oui | ? | dispersée dans la page | À adapter (NP-06) |
| Mise en veille du compte | oui | oui | oui | non | ? | profil retiré, ou quitter le réseau | Déjà fait, autrement |
| Suppression avec délai de retour | 30 jours | 30 jours | 14 jours ? | immédiate | ? | 30 jours, annulable | Déjà fait |
| Télécharger ses données | oui | oui | oui | rapport du compte | ? | JSON | Déjà fait ; À adapter (NP-03) |
| Choisir les rubriques, format lisible | oui | oui | oui | non | ? | non | À faire (NP-13) |
| Consentements par finalité, datés | partiel | partiel | partiel | non | ? | cinq finalités datées | À adapter (NP-01, NP-08) |
| Décisions de modération et recours | oui | oui | partiel | examen sur demande | ? | décisions, motifs, recours | Déjà fait ; À recetter |
| Suivi de mes signalements | oui | oui | ? | non | ? | accusé, échéance légale, issue | Déjà fait |
| Journal d'activité du compte | oui | oui | partiel | non | ? | non | Reporté (CN-13 du moteur) |
| Compte d'une personne décédée | commémoration | contact légataire | fermeture par un proche | non | ? | non | Reporté (NP-16, juriste) |
| Préférences publicitaires | oui | oui | oui | non | ? | aucune publicité | Écarté (D-G04) |

## 4. Ce qui manque

### 4.1 Bloquant avant l'ouverture du pilote

1. **Deux consentements à la mauvaise portée.** Le retrait de l'attestation consulaire ne retire rien (ligne 60). L'accord aux notifications n'ouvrira aucun envoi tant qu'il est enregistré sans réseau (ligne 31). Lot NP-01.
2. **« Mes données » fermée à qui est parti.** Après « Quitter DIASPORALE », l'écran des réglages renvoie à l'accueil, qui n'offre que la déconnexion (ligne 76). Lot NP-02.
3. **Export et effacement jamais joués de bout en bout** sur le moteur (R-G19) : volet de la campagne DS-05, décrit au § 6.
4. **Aucun canal sortant.** Un professionnel n'apprend une demande, et un inscrit son rappel J-1, qu'en ouvrant le site. Le premier résultat attendu du pilote, une demande répondue, en dépend. La porte est externe (clés d'envoi) : le lot reste P1, mais la décision 1 est à prendre avant l'ouverture.

### 4.2 Fonctions attendues qui manquent

- Notifications : une page avec la suite au-delà de 30 avis (NP-04) ; des préférences par famille et un plafond visibles (DS-14, volet préférences) ; les notifications du navigateur (volet push) ; un résumé par pays (volet résumé) ; une sourdine par page, association et groupe (NP-14).
- Réglages : des rubriques (NP-06), un fuseau personnel (NP-07).
- Données : un registre de consentements complet, avec le texte accepté (NP-08) ; des durées de conservation pour les demandes closes, les candidatures et les attestations (NP-10).

### 4.3 Options qui manquent sur ce qui existe

- **Cloche** : filtre « Non lues », sections, neuf genres déjà émis sans phrase (message de groupe, ajout à un groupe, invitation à un groupe thématique, invitation à un évènement, publication d'une page suivie, album, fichier retenu, appel manqué, message vocal), accepter ou refuser une invitation depuis l'avis, compteur dans l'onglet.
- **Réglages** : sommaire, lien vers les personnes bloquées, lien vers les réglages d'appel (plan 04), fuseau.
- **Consentements** : lire le texte, voir l'historique, retrouver les accords donnés dans une demande, un avis ou un mentorat.
- **Mes données** : garder la date du dernier export au-delà de l'onglet, choisir les rubriques, être averti avant l'échéance d'un effacement, être prévenu quand on est le dernier administrateur d'une page.
- **Quitter** : dire ce qui reste visible après le départ.

### 4.4 Améliorations de l'existant

- Texte de confirmation de l'effacement : il ne cite ni les demandes de service, ni les questions d'entraide et leurs réponses, ni les mentorats, ni les candidatures (ligne 71).
- Ligne « talents » du registre : « Bientôt » est périmé (ligne 62).
- Export : y joindre la proposition et le rendez-vous (NP-03) ; un fichier lisible (NP-13).
- Récapitulatif : porter la marque du réseau, comme le code de connexion le fait déjà (ligne 33).
- Durée de l'export : le moteur lit chaque table en entier, vingt lignes à la fois ; le temps croît avec la taille du réseau, pas avec celle du compte (voir § 8).

### 4.5 Ce qui distingue DIASPORALE

- Des avis sans contenu, relus à chaque lecture : un avis dont l'objet n'est plus lisible disparaît de lui-même.
- Des consentements par finalité, datés, sans case précochée.
- Des droits ouverts au suspendu ; ses décisions de tous les réseaux, leurs motifs et un recours ; le suivi de ses signalements avec l'échéance légale.
- Un export assemblé dans le navigateur, sans adresse de fichier ni stockage tiers.
- Un effacement réel, en cascade, avec références rendues anonymes ; 26 tables de la tranche classées sur 26.
- À venir : un résumé par pays, que seul Nextdoor approche par quartier.

### 4.6 Écarté ou reporté, et pourquoi

| Sujet | Décision | Raison |
|---|---|---|
| Contenu ou nom dans un push ou un e-mail | Écarté | docs/14 § 7.4 ; ADR-0009 du moteur, point 7 |
| Avis promotionnels, relances d'activité, suggestions | Écarté | D-G04, D-G05 |
| Résumé sponsorisé | Reporté au lot D4 | F14 et F17 du dossier produit ; plan 17 |
| SMS de notification | Écarté au pilote | coût ; le code par SMS est lui-même fermé |
| Supprimer les avis un à un | Écarté au pilote | conservation bornée, préférences à la place |
| Appareils, alerte de connexion, moyens de connexion ; taille du texte ; réglages d'appel ; push natif | Renvoyés aux plans 01, 02, 04 et 16 | lots CN-03 à CN-05 et CN-15 du moteur ; iCom ; aucune application mobile |
| État du compte, demandes datées de rectification | Moteur | lots MC-04 et SU01e ; plan 14 |

## 5. Lots d'implémentation

### NP-01 — Consentements : portée et retrait effectifs · P0 · S · S2
- **Pour l'utilisateur** : retirer un consentement le retire vraiment ; accepter les notifications ouvre vraiment les envois.
- **Backend** : aucun fichier du moteur. Dans `D:apps/diasporale_com/src/data/engine-source.ts` (`join`, `setConsent`), passer le réseau pour `notifications` et `consular_attestation`, comme pour `directory` ; au retrait, révoquer la ligne du réseau et l'ancienne ligne sans réseau. Un test de la tranche prouve que `myConsents` et `notificationConsent` disent alors la même chose.
- **Web** : la ligne « talents » cesse de dire « Bientôt » et renvoie au profil de talent, où vit son accord ; le texte de l'attestation dit l'effet réel du retrait (une demande en cours s'arrête, le statut acquis reste). Textes fr et en.
- **Mobile** : même règle de portée (plan 16).
- **Données personnelles** : lignes `consents` déjà exportées et effacées.
- **Tests et cliquets** : test de l'adaptateur (réseau passé pour les trois finalités) ; test de la tranche « accord, retrait, suite de la demande refusée » ; `i18n-locales`.
- **Critères d'acceptation** : en mode moteur, le compte `declare` demande l'attestation (échec technique attendu sans clés), retire l'accord, recharge : l'interrupteur reste éteint. Après accord aux notifications, `pushAllowed` est vrai dans un test avec un abonnement actif.
- **Dépend de** : rien.
- **Porte** : aucune.

### NP-02 — « Mes données » ouverte hors adhésion, et en démonstration · P0 · S · S2
- **Pour l'utilisateur** : après avoir quitté DIASPORALE, ou sans y être entré, exporter, demander l'effacement, lire ses décisions et former un recours depuis diasporale.com.
- **Backend** : aucun ; les portes du moteur ne lisent aucune adhésion.
- **Web** : route `/mes-donnees` dans `D:apps/diasporale_com/src/lib/routes.ts`, hors de la coque de membre, derrière une garde « connecté, adhésion facultative » ajoutée à `D:apps/diasporale_com/src/components/gate.tsx` ; `DataRightsSettings` reçoit la personne et non l'adhésion ; lien depuis l'accueil, à côté de « Se déconnecter partout ». La rubrique des réglages reste en place.
- **Mobile** : même écran hors adhésion (plan 16).
- **Données personnelles** : aucune nouvelle.
- **Tests et cliquets** : garde testée pour `partie`, sans adhésion, suspendu ; aucune surface sociale montée ; `no-hardcoded-urls`. Démonstration : `useReports` servi par `D:packages/diasporale-features/src/demo/data-rights.ts` (liste vide, comme les décisions).
- **Critères d'acceptation** : les comptes `exterieur` et `suspendu-racine`, puis un compte qui vient de partir, téléchargent leur export ; « Mes signalements » s'affiche en démonstration.
- **Dépend de** : rien.
- **Porte** : aucune.

### NP-03 — Export complet des mises en relation · P1 · S · S2 + S1
- **Pour l'utilisateur** : mon fichier contient la proposition que j'ai reçue et mon rendez-vous, pas seulement ma demande.
- **Backend** : issue [S1] sur `A:convex/modules/people/dataInventory.ts` : rendre au demandeur la proposition (sans le signataire) et le rendez-vous. La fonction étant pure, deux voies : un champ `requesterPersonId` facultatif posé par la tranche dans `A:convex/modules/diaspora/serviceRequestsTables.ts`, ou une lecture du parent dans `exportMyDataPage`. S1 choisit ; l'effacement ne change pas.
- **Web** : aucun.
- **Mobile** : sans objet.
- **Données personnelles** : périmètre du droit d'accès à confirmer par le juriste, avec le motif de non-sélection d'une candidature (décisions 5 et 6).
- **Tests et cliquets** : `A:convex/modules/people/commerce-trust-data-policy.test.ts` mis à jour : le demandeur reçoit la proposition sans `authorPersonId` ; un tiers ne reçoit rien.
- **Critères d'acceptation** : l'export du compte `declare`, après un rendez-vous confirmé, contient le montant, le créneau et l'état.
- **Dépend de** : décision 5.
- **Porte** : avis du juriste conseillé.

### NP-04 — Cloche complète : page, suite, filtre, genres nommés · P1 · M · S2
- **Pour l'utilisateur** : retrouver tous mes avis, ne voir que les non-lus, et lire une phrase juste pour chacun.
- **Backend** : aucun ; `paginateNotifications` pagine déjà.
- **Web** : route `/notifications`, page pleine largeur ; la feuille garde les premiers avis et un lien « Tout voir ». Lecture paginée dans le port et ses deux fournisseurs. Filtre « Toutes » ou « Non lues », sections « Nouveau » et « Plus tôt ». Phrase, icône et lien pour les neuf genres communs déjà émis (§ 4.3) ; issue et gestes pour une invitation de groupe ou d'évènement. Un genre inconnu reste « Nouvelle activité ». Nouveau fragment de textes fr et en.
- **Mobile** : liste native équivalente (plan 16).
- **Données personnelles** : aucune nouvelle.
- **Tests et cliquets** : test qui liste les genres communs du moteur et échoue si l'un n'a ni phrase ni décision d'exclusion ; pagination ; `member-screens-full-width`, `no-hardcoded-strings`.
- **Critères d'acceptation** : avec 45 avis, la page les montre tous ; « Non lues » n'en garde que les non-lus ; un fichier retenu par l'antivirus se lit comme tel. Quand CN-08 sert une ligne groupée, le rendu l'accepte sans autre lot.
- **Dépend de** : rien.
- **Porte** : aucune.

### NP-05 — Matrice des avis et genres manquants · P1 · S · S2 + S1
- **Pour l'utilisateur** : chaque transition qui me concerne m'avertit une fois, au bon endroit.
- **Backend** : tenir le tableau des genres du § 2 comme matrice de référence. Genres à ajouter, chacun porté par son plan : évènement annulé ou modifié, place libérée (plan 08) ; revendication tranchée, rôle d'équipe (plan 07, PG-01) ; nouvel avis sur une offre, rappel de rendez-vous (plan 09) ; candidature retirée (plan 10) ; rappel de séance, ressource signalée périmée (plan 11). Les genres se déclarent dans `A:convex/modules/notifications/tables.ts` : issue [S1]. Les émetteurs s'écrivent dans la tranche, sur le modèle de `A:convex/modules/diaspora/communityNotifications.ts`.
- **Web** : phrase, icône et lien de chaque genre ; la carte typée des icônes refuse déjà de compiler s'il en manque un.
- **Mobile** : mêmes phrases (plan 16).
- **Données personnelles** : avis sans contenu ; la ligne suit le destinataire à l'effacement.
- **Tests et cliquets** : `notification-payload-content`, `notifications-writer` ; par genre : garde d'écriture, garde de lecture, dédoublonnage.
- **Critères d'acceptation** : aucune transition des parcours P0 et P1 sans avis, ou sans la mention écrite « pas d'avis, et pourquoi ».
- **Dépend de** : plans 07 à 11.
- **Porte** : aucune.

### DS-14 (volet préférences) — Préférences de notification par famille et plafond · P1 · M · S2 + S1 · repris du plan 15
- **Pour l'utilisateur** : choisir ce qui sonne sur mon appareil et ce qui entre dans le résumé ; fixer un plafond par semaine. Priorité relevée de P2 à P1 : le push ne s'ouvre pas sans ces réglages.
- **Backend** : brancher `getMine` et `update` de `A:convex/modules/notifications/preferences.ts`. Issue [S1] : laisser la tranche déclarer ses catégories, pour que les 25 genres de DIASPORALE ne tombent plus tous dans « social » (`notificationRowCategory`). En attendant, l'écran nomme honnêtement les six catégories du moteur.
- **Web** : rubrique « Notifications » des réglages (NP-06) : un interrupteur par famille et par canal, plafond hebdomadaire expliqué, « Tout couper ». Démonstration à parité. Textes fr et en.
- **Mobile** : mêmes familles (plan 16).
- **Données personnelles** : `notificationPreferences` déjà exportée et effacée.
- **Tests et cliquets** : une famille coupée rend `pushAllowed` faux pour un avis de mise en relation ; un membre suspendu peut réduire, pas activer.
- **Critères d'acceptation** : un genre coupé ne sonne plus sur l'appareil ; la cloche suit la décision 3.
- **Dépend de** : NP-01, NP-06 ; plan 06 du moteur.
- **Porte** : décisions 2 et 3.

### DS-14 (volet push) — Notifications du navigateur · P1 · M · S2 + S1 · repris du plan 15
- **Pour l'utilisateur** : apprendre, onglet fermé, qu'une proposition, une réponse ou un rappel m'attend, sans rien lire du contenu. Priorité relevée de P2 à P1 : aujourd'hui, rien ne sort de l'application.
- **Backend** : rien à écrire (`subscribe`, `configuration`, `open.ts`). Au propriétaire : l'entrée de DIASPORALE dans `NOTIFICATION_APPLICATIONS_JSON`, les clés VAPID, `WEB_PUSH_ALLOWED_ORIGINS`.
- **Web** : route du service worker et page d'ouverture `/notifications/ouvrir` dans DIASPORALE. Le générateur du worker et l'activation vivent dans l'application d'ANTSIA (`A:apps/antsia_ga/src/lib/notification-worker.ts`, `A:apps/antsia_ga/src/components/notification-controls.tsx`) : issue [S1] pour les sortir dans un paquet partagé ; à défaut, copie avec en-tête de provenance. Activation proposée au moment utile (première demande envoyée, premier message), jamais au chargement. Liste de mes appareils abonnés, révocables.
- **Mobile** : sur iPhone, le push web n'existe qu'après ajout à l'écran d'accueil (plan 16).
- **Données personnelles** : abonnement lié à la session, coupé par « Se déconnecter partout » ; exporté sans clé.
- **Tests et cliquets** : `notification-payload-content` ; la page d'ouverture rend le même refus pour la référence d'autrui que pour une référence inventée ; aucune demande d'autorisation au montage.
- **Critères d'acceptation** : réception constatée sur Chrome Android, un navigateur de bureau et Safari iOS installé ; ouverture de la bonne demande ; rapport de recette daté. Une admission chez le fournisseur n'est pas une réception.
- **Dépend de** : NP-01, volet préférences, CN-10 du moteur.
- **Porte** : clés et variables (propriétaire) ; publication.

### NP-06 — Réglages en rubriques · P1 · M · S2
- **Pour l'utilisateur** : trouver un réglage en deux gestes.
- **Backend** : aucun.
- **Web** : `/parametres` devient un sommaire : Compte et sécurité (mes réseaux, parrainage, session, et l'emplacement des lots CN-03 à CN-05 du plan 01), Profil, Confidentialité (facette, annuaire, mon fil, lien vers les personnes bloquées), Notifications, Langue et région, Apparence, Consentements, Mes données. Les cinq adresses directes existantes continuent d'ouvrir leur rubrique. Pleine largeur, un seul bouton plein par zone, aucune ligne pour une fonction absente.
- **Mobile** : même sommaire (plan 16).
- **Données personnelles** : aucune.
- **Tests et cliquets** : chaque ancienne adresse ouvre sa rubrique ; rendu de chaque rubrique ; `member-screens-full-width`, `no-hardcoded-urls`.
- **Critères d'acceptation** : depuis le menu du compte, chaque réglage existant s'atteint en deux gestes à 390 et 1280 px.
- **Dépend de** : rien.
- **Porte** : aucune.

### NP-07 — Fuseau personnel et région · P1 · S · S2
- **Pour l'utilisateur** : mes rappels, mes heures calmes et mon résumé suivent l'heure où je vis.
- **Backend** : aucun ; `setMyPreferences` accepte déjà `timeZone`.
- **Web** : fuseau détecté et enregistré à la première entrée (avec le plan 01), montré et modifiable dans « Langue et région » ; action `saveAccountTimeZone` dans le port et ses deux fournisseurs.
- **Mobile** : fuseau de l'appareil proposé (plan 16).
- **Données personnelles** : champ du compte commun, déjà exporté.
- **Tests et cliquets** : fuseau invalide refusé ; changer de fuseau ne remonte ni salle ni brouillon (règle de l'ADR-0010).
- **Critères d'acceptation** : un compte créé à Montréal garde son fuseau après rechargement, et ANTSIA relit le même.
- **Dépend de** : plan 01.
- **Porte** : aucune.

### NP-08 — Registre des consentements complet · P1 · M · S2
- **Pour l'utilisateur** : voir tout ce que j'ai accepté, le texte lu, la date, et comment le retirer.
- **Backend** : lecture bornée, dans la tranche, de mes accords portés par un objet (demande de service, candidature, mentorat, avis publié, profil de mentor). Le texte et son empreinte viennent du lot CN-12 du moteur.
- **Web** : rubrique « Consentements » : pour chaque finalité, « Lire le texte », l'historique des gestes ; pour chaque accord d'objet, le lien vers l'objet et le geste qui le retire. Lignes « résumé par e-mail » et « mesure d'usage » seulement quand ces fonctions existent.
- **Mobile** : même registre (plan 16).
- **Données personnelles** : rien de nouveau n'est stocké.
- **Tests et cliquets** : chaque version de texte existe en fr et en ; `i18n-locales`.
- **Critères d'acceptation** : après une demande de service et un avis, le registre montre les deux accords, datés.
- **Dépend de** : NP-01, NP-06, CN-12 du moteur.
- **Porte** : textes relus par le juriste (DS-07).

### NP-09 — Effacement expliqué, suites pour les autres · P1 · S · S2
- **Pour l'utilisateur** : savoir, avant de confirmer, ce qui disparaît pour moi et pour les autres.
- **Backend** : aucun.
- **Web** : la feuille de confirmation reprend l'inventaire du § 2 par famille : ce qui est supprimé, ce que l'autre partie perd, ce qui reste sous un nom neutre. Elle avertit si je suis le dernier administrateur d'une page et mène à la passation (plan 07). Le départ de DIASPORALE dit, lui, ce qui reste. Textes fr et en.
- **Mobile** : mêmes textes (plan 16).
- **Données personnelles** : aucune.
- **Tests et cliquets** : `i18n-locales` ; test de l'avertissement « dernier administrateur ».
- **Critères d'acceptation** : le texte correspond, ligne à ligne, à ce que la recette R-G19 a constaté.
- **Dépend de** : volet de recette du § 6 ; plan 07.
- **Porte** : aucune.

### NP-10 — Durées de conservation de la tranche · P1 · M · S2 + S1
- **Pour l'utilisateur** : une demande close, une candidature non retenue ou une attestation échouée ne restent pas indéfiniment.
- **Backend** : passes de purge bornées dans la tranche, sur le modèle de `expireDueServiceRequests` ; la ligne planifiée de `A:convex/crons.ts` est une issue [S1]. Tables visées : demandes closes, candidatures tranchées, mentorats clos, attestations non abouties, parrainages retirés.
- **Web** : les durées s'affichent dans « Mes données » et dans la politique de confidentialité (plan 17).
- **Mobile** : sans objet.
- **Données personnelles** : c'est l'objet du lot ; aucune durée n'est inventée.
- **Tests et cliquets** : seule une ligne échue est purgée ; la cascade suit ; `crons-contract`.
- **Critères d'acceptation** : chaque table de l'inventaire a une durée écrite, ou la mention « gardée jusqu'à l'effacement ».
- **Dépend de** : décision 7.
- **Porte** : juriste (durées).

### DS-14 (volet résumé) — Résumé mensuel par pays · P2 · M · S2 + S1 · repris du plan 15
- **Pour l'utilisateur** : un e-mail par mois sur la vie de mon pays, et un lien pour ne plus le recevoir.
- **Backend** : passage mensuel de la tranche par pays ouvert, à partir de compteurs déjà calculés ; aucun nom, aucun titre. Issue [S1] : un résumé de réseau à charge utile neutre, la marque du réseau dans l'objet (ligne 33), et le désabonnement du lot CN-09.
- **Web** : accord explicite dans « Notifications », jamais précoché ; page publique de confirmation du désabonnement.
- **Mobile** : sans objet.
- **Données personnelles** : consentement `email_digest` propre au réseau ; adresse jamais copiée hors du composant d'authentification.
- **Tests et cliquets** : aucun nom ni titre dans la charge utile ; un pays sous le seuil n'envoie rien ; `public-communication`.
- **Critères d'acceptation** : un résumé reçu sur une boîte de test ; un clic coupe le suivant.
- **Dépend de** : CN-09 et CN-02 du moteur, NP-08, plan 06 (compteurs des hubs).
- **Porte** : clé d'envoi, expéditeur par réseau, décision 4.

### NP-11 — Courriel quotidien des avis en attente · P2 · M · S1
- **Pour l'utilisateur** : sans push possible, apprendre dans la journée qu'une proposition ou une demande m'attend.
- **Backend** : issue [S1] : fréquence du récapitulatif réglable par réseau (quotidienne au lieu d'hebdomadaire), limitée aux familles choisies, même texte neutre, même consentement, même plafond.
- **Web** : choix de la fréquence dans « Notifications ».
- **Mobile** : sans objet.
- **Données personnelles** : inchangées.
- **Tests et cliquets** : `notification-payload-content` ; un seul envoi par jour et par personne.
- **Critères d'acceptation** : une demande de service reçue la veille produit un e-mail, sans contenu.
- **Dépend de** : volet préférences ; CN-02 du moteur.
- **Porte** : décision 1 ; clé d'envoi.

### NP-12 — Pause et heures calmes · P2 · S · S2
- **Pour l'utilisateur** : suspendre les envois un moment, ou chaque nuit, dans mon fuseau.
- **Backend** : aucun ; champs et règle du lot CN-07 du moteur.
- **Web** : commandes dans « Notifications » ; les avis restent dans la cloche.
- **Mobile** : après le web (plan 16).
- **Données personnelles** : champs exportés avec les préférences.
- **Tests et cliquets** : plage qui chevauche minuit, changement d'heure du pays de résidence.
- **Critères d'acceptation** : pendant la plage, l'avis entre dans la cloche et son push part à la fin.
- **Dépend de** : CN-07 du moteur, NP-07, volet push.
- **Porte** : aucune.

### NP-13 — Export lisible et par rubrique · P2 · M · S2
- **Pour l'utilisateur** : un document que je peux lire, rangé par rubrique, en plus du fichier JSON.
- **Backend** : aucun.
- **Web** : assemblage local d'un document lisible à partir du JSON, titres par table dans un fragment de textes ; choix des rubriques avant l'assemblage ; date du dernier export gardée sur l'appareil.
- **Mobile** : partage du fichier par le système (plan 16).
- **Données personnelles** : rien ne quitte le navigateur.
- **Tests et cliquets** : toute table inconnue va sous « Autres données », jamais ignorée.
- **Critères d'acceptation** : un membre non technicien retrouve ses demandes et ses adhésions dans le document.
- **Dépend de** : NP-03.
- **Porte** : aucune.

### NP-14 — Sourdine par page, association et groupe · P2 · M · S2 + S1
- **Pour l'utilisateur** : continuer de suivre une page ou d'appartenir à un groupe sans être averti à chaque publication.
- **Backend** : issue [S1] : la diffusion `page_post` et les avis de groupe lisent un choix de sourdine par abonnement ; pour les avis d'adhésion, choix porté par la tranche.
- **Web** : commande sur la fiche de la page et du groupe ; liste des sourdines dans « Notifications ».
- **Mobile** : après le web (plan 16).
- **Données personnelles** : choix exporté et effacé avec l'abonnement.
- **Tests et cliquets** : une page en sourdine n'écrit plus d'avis ; l'abonnement reste.
- **Critères d'acceptation** : après sourdine, la page publie et ma cloche ne bouge pas.
- **Dépend de** : NP-04 ; plan 07.
- **Porte** : aucune.

### NP-15 — Mesure d'usage consentie · P3 · S · S2
- **Pour l'utilisateur** : accepter ou refuser, d'un geste, une mesure d'usage sans contenu ni identifiant.
- **Contenu** : brancher le consentement global `usage_analytics` et le transport du moteur ; au pilote, les agrégats de `/pilote` suffisent (décision 8).
- **Dépend de** : lot EX-21 du moteur ; plan 17.
- **Porte** : projet de mesure et jeton (propriétaire) ; texte validé.

### NP-16 — Compte d'un membre décédé · P3 · M · S2
- **Pour l'utilisateur** : un proche peut demander la fermeture du compte d'un membre disparu.
- **Contenu** : procédure écrite avant tout code : qui demande, quelle preuve, qui décide, quel délai ; aucune pièce n'entre dans le moteur.
- **Dépend de** : plan 14 (guichet), plan 17 (mentions légales).
- **Porte** : juriste ; décision 9.

## 6. Ordre recommandé et dépendances

| Vague | Lots | Pourquoi dans cet ordre |
|---|---|---|
| 1 | NP-01, NP-02 | Deux corrections courtes, sans porte, avant toute recette |
| 2 | volet de recette ci-dessous, NP-09, NP-03 | Prouver l'export et l'effacement, puis dire vrai et compléter le fichier |
| 3 | NP-04, NP-05, NP-06, NP-07 | La cloche et les réglages que tout membre voit dès le premier jour |
| 4 | DS-14 (préférences), DS-14 (push), NP-08 | Les envois, dès que les clés existent |
| 5 | NP-10 | Dès l'avis du juriste |
| 6 | DS-14 (résumé), NP-11, NP-12, NP-13, NP-14 | Après les premiers retours du pilote |
| 7 | NP-15, NP-16 | Sous condition externe |

**Ce que ce plan attend des autres plans.** Moteur : plan 06 (CN-02, CN-07, CN-08, CN-09, CN-10, CN-12, CN-13), plan 12 (MC-04, SU01e, SU01g), plan 13 (EX-11, EX-21). DIASPORALE : plan 01 (fuseau et consentements à l'accueil ; appareils et sessions), plan 02 (textes, accessibilité des nouvelles pages), plan 04 (destination des avis d'appel manqué et de message vocal), plans 07 à 11 (genres manquants), plan 14 (guichet pour la recette des décisions), plan 16 (application installable, push natif), plan 17 (campagne DS-05, textes légaux, variables).

**Ce que les autres plans attendent de celui-ci.** Pour tout nouvel avis : un genre déclaré par S1, une garde d'écriture et une garde de lecture dans la tranche, une phrase neutre en fr et en, un lien qui relit les droits, une ligne dans le tableau des genres. Pour toute nouvelle table : son classement dans `A:convex/modules/people/dataPolicies.ts` (S1) et une ligne dans l'inventaire du § 2.

**Volet de recette en mode moteur (campagne DS-05).** Backend local, comptes de démonstration par acteur (docs/34 de DIASPORALE).

| # | Comptes | Étapes | Résultat attendu |
|---|---|---|---|
| 1 | `declare`, `entreprise` | Demande de service, proposition, accord | Un avis neutre de chaque côté, lien vers la demande ; « tout marquer lu » vide la pastille |
| 2 | `entreprise`, `verifie` | `verifie` devient signataire de la page, reçoit un avis, puis perd son rôle | Dans sa cloche, les avis de la page ont disparu |
| 3 | `declare` | Retrait de l'annuaire, puis de l'attestation, puis des notifications | Chaque retrait tient après rechargement (après NP-01) |
| 4 | `declare`, `association` | Après un rendez-vous confirmé et une adhésion acceptée : export | Le fichier contient la demande, l'avis et l'adhésion ; noter l'absence de la proposition et du rendez-vous |
| 5 | `declare`, `mentor` | Demande d'effacement, annulation, nouvelle demande ; échéance avancée sur le backend local, avec l'accord du propriétaire | La page perd la demande et l'avis ; le mentor perd le mentorat ; une question posée par `declare` disparaît avec ses réponses ; rien ne nomme plus la personne |
| 6 | `suspendu`, `suspendu-racine` | Ouvrir « Mes données », exporter | Export rendu, aucune surface sociale ouverte |
| 7 | `parraine`, `verifie`, `moderateur` | Signalement, décision, recours de l'auteur | Accusé puis avis de décision au déclarant ; décision et recours dans « Mes données » de l'auteur |
| 8 | un compte neuf | Quitter DIASPORALE | Accueil ; relever ce qui reste visible des autres : annuaire, mentor, talents, publications |

Chaque ligne se conclut par « fait » ou « non fait », avec la date et la révision.

## 7. Décisions à prendre par le propriétaire

1. **Canal sortant au pilote.** Recommandation : push du navigateur, plus un courriel quotidien neutre pour les avis de mise en relation (NP-11). Raison : sur iPhone, le push web exige l'installation sur l'écran d'accueil ; sans courriel, ces membres n'apprennent rien.
2. **Familles de préférences.** Recommandation : Relations et publications ; Mise en relation ; Associations et évènements ; Entraide et mentorat ; Emploi ; Sécurité et modération. Raison : ce sont les rubriques que le membre connaît déjà.
3. **Couper un avis dans la cloche elle-même.** Recommandation : oui pour les familles sociales ; non pour la mise en relation, la modération et la sécurité. Raison : un avis de service attendu ne se perd pas.
4. **Contenu et rythme du résumé par pays.** Recommandation : mensuel, des nombres par rubrique et un lien, aucun titre ni nom. Raison : rien de ce qui est publié dans le réseau fermé ne doit le quitter par e-mail.
5. **Fichier d'export : la proposition reçue et le rendez-vous.** Recommandation : les rendre au demandeur, sans l'identité du signataire. Raison : ce sont des données qui le concernent.
6. **Motif de non-sélection d'une candidature, hors export.** Recommandation : le faire trancher par le juriste (point laissé ouvert par docs/32 de DIASPORALE, § 5).
7. **Durées de conservation.** Recommandation : demander une durée par famille au juriste ; d'ici là, écrire « gardé jusqu'à l'effacement du compte » dans la politique, sans purge silencieuse.
8. **Mesure d'usage.** Recommandation : s'en tenir aux agrégats de `/pilote` pendant le pilote. Raison : aucun consentement de plus à demander.
9. **Compte d'un membre décédé.** Recommandation : fermeture sur demande d'un proche, traitée hors ligne par l'éditeur ; pas de compte de commémoration.
10. **Ce que fait « Quitter DIASPORALE ».** Recommandation : après la ligne 8 de la recette, retirer d'office les fiches volontaires (annuaire, mentor, talents) au départ, et le dire à l'écran. À décider avec le plan 01.

## 8. Risques et points d'attention

- **Une personne, plusieurs réseaux** : toute finalité de consentement doit dire sa portée, réseau ou personne. Les deux écarts du NP-01 viennent de là.
- **Fichiers du moteur** : genres, catégories, classement des tables, inventaire d'export, tâches planifiées et récapitulatif appartiennent à S1. Chaque besoin passe par une issue `[S1]`.
- **Transports non prouvés** : aucun push ni e-mail de notification n'a été reçu sur un appareil réel. Un état « envoyé » est une admission.
- **iPhone** : pas de push web sans installation sur l'écran d'accueil ; ne rien promettre de plus.
- **Durée de l'export** : `exportMyDataPage` lit chaque table entière, vingt lignes à la fois, depuis le navigateur. Sa durée croît donc avec la taille du réseau, pas avec celle du compte. Elle n'a jamais été mesurée : à faire avec la charge du plan 13 du moteur, puis issue `[S1]` si besoin.
- **Effacement et tiers** : l'autre partie perd un mentorat, des réponses, une demande reçue. Le dire avant (NP-09), le vérifier après (recette, ligne 5).
- **Dernier administrateur d'une page** : son effacement laisse la page sans équipe ; rien ne l'empêche dans `A:convex/modules/people/erasure.ts`. À traiter avec le plan 07.
- **Démonstration en ligne** : les comptes sont partagés ; un visiteur peut y demander un effacement ou quitter le réseau. La grâce de 30 jours et la remise à zéro (lot EX-15 du moteur) limitent l'effet, sans l'empêcher.
- **Réglage sans effet** : toute préférence nouvelle doit être relue côté serveur avant l'envoi, jamais seulement à l'écran.
- **Sujets juridiques** : droit d'accès, durées, compte d'un défunt. Ce plan décrit ; le juriste tranche ; rien n'est dit « conforme ».

## 9. Prompts d'implémentation

### Prompt NP-01
```text
Tu exécutes le lot NP-01 du plan 13 de DIASPORALE. Session S2. Écris-moi en français. Opus seulement.
Lis : CLAUDE.md ; docs/etudes/2026-11-10-finalisation/13_NOTIFICATIONS_REGLAGES_DONNEES.md (§ 2, lignes 31, 59, 60, 62 ; lot NP-01) ; apps/diasporale_com/src/data/engine-source.ts (join, setConsent) ; dans ../ANTSIA : convex/modules/people/consents.ts, convex/modules/notifications/consent.ts, convex/modules/diaspora/attestation.ts et membership.ts (myConsents).
Vérifie d'abord que les deux écarts de portée existent toujours. Branche claude/consentements-portee depuis origin/main.
Fais : passe le réseau pour « notifications » et « consular_attestation » à l'accord comme au retrait ; au retrait, révoque aussi l'ancienne ligne sans réseau. Corrige la ligne « talents » et le texte de l'attestation, en fr et en. Écris le test de l'adaptateur et un test de la tranche : accord, retrait, suite de la demande refusée ; accord aux notifications, pushAllowed vrai.
Vérifie : bun run --cwd ../ANTSIA verify avec le verrou ; recette en mode moteur avec le compte « declare ». Ne modifie aucun fichier du moteur hors convex/modules/diaspora/. Arrête-toi avant toute publication.
```

### Prompt NP-02
```text
Tu exécutes le lot NP-02 du plan 13 de DIASPORALE. Session S2. Écris-moi en français. Opus seulement.
Lis : CLAUDE.md ; le plan 13 (§ 2, lignes 74 à 76 ; lot NP-02) ; apps/diasporale_com/src/components/gate.tsx, data-rights-settings.tsx, screens/welcome-screen.tsx, lib/routes.ts ; packages/diasporale-features/src/demo/data-rights.ts ; dans ../ANTSIA : apps/antsia_ga/src/app/mes-donnees/page.tsx (le modèle).
Branche claude/mes-donnees-hors-adhesion depuis origin/main.
Fais : route /mes-donnees hors de la coque de membre, garde « connecté, adhésion facultative », DataRightsSettings alimenté par la personne ; lien depuis l'accueil ; « Mes signalements » servi par la démonstration. Garde la rubrique des réglages telle quelle.
Vérifie : tests de la garde (parti, sans adhésion, suspendu), verify avec le verrou, recette avec les comptes « exterieur » et « suspendu-racine » à 390 et 1280 px, clair et sombre. Arrête-toi avant toute publication.
```

### Prompt DS-14 (volet push)
```text
Tu exécutes le volet « push » du lot DS-14, plan 13 de DIASPORALE. Session S2. Écris-moi en français. Opus seulement.
Lis : CLAUDE.md ; le plan 13 (§ 2, lignes 28 à 31 ; lot DS-14, volet push ; § 8) ; dans ../ANTSIA : docs/adr/0009-gardes-et-droits-personnels-pa5.md (point 7), convex/modules/notifications/pushSubscriptions.ts, configuration.ts, open.ts, apps/antsia_ga/src/lib/notification-worker.ts, apps/antsia_ga/src/components/notification-controls.tsx.
Prérequis : NP-01 fusionné. Dépose d'abord l'issue [S1] qui demande de sortir le générateur du worker et l'activation dans un paquet partagé ; attends sa réponse avant de copier quoi que ce soit.
Fais : route du service worker, page /notifications/ouvrir qui relit la cible par open.ts et compose l'adresse par la table des routes, activation proposée au moment utile, liste de mes appareils abonnés. Donne-moi la liste exacte des variables à poser ; n'en pose aucune.
Vérifie : notification-payload-content, verify avec le verrou. La recette de réception (Chrome Android, bureau, Safari iOS installé) attend mes clés : arrête-toi et demande-les-moi. Arrête-toi avant toute publication.
```

Les autres lots suivent le gabarit du plan directeur d'ANTSIA (§ 7.3), avec ce fichier à la place du plan cité.

## 10. Sources lues

- Brief commun ; dossier de reprise (§ 2, 7, 10.2, 13) ; plan 15 et plan directeur d'ANTSIA ; registre des 317 lots.
- Plans du moteur : 06 en entier ; 12 (MC-04, SU01e, SU01g) ; 13 (EX-11, EX-21) ; 14 (MB-08).
- DIASPORALE : cahier (§ 2, 5, 8.11, 8.13, 9), docs/09, docs/14 (§ 3.4, G9, § 7.4), docs/16, docs/17, docs/32 (§ 7, 8, 11, 12), docs/34, recettes `su01d-avis-et-motifs-2026-10-22` et `deux-comptes-2026-10-19`.
- ANTSIA : ADR 0009, 0010, 0026, 0038.
- Dossier produit d'origine : fiche F14 et § 7 (consentement, données personnelles).
- Code DIASPORALE : écran des réglages et ses dix composants, garde, accueil, table des routes, cloche et types du port, adaptateurs moteur (source, vues, droits personnels), démonstration (magasin, droits), règles de consentement du domaine, textes français.
- Code ANTSIA : `convex/modules/notifications/` (cloche, écriture, tables, politique, préférences, consentement, livraisons, récapitulatif, conservation, abonnements, configuration, ouverture) ; `convex/modules/people/` (consentements, préférences, export et effacement, classement et inventaire des tables, tests de politique) ; `convex/modules/diaspora/` (manifeste, adhésion, attestation, avis de mise en relation et de vie communautaire, compteurs, les dix fichiers de tables) ; `convex/modules/events/` (rappels, inscriptions) ; `convex/betterAuth/delivery.ts` ; `convex/crons.ts` ; paquets `social-domain` (genres, livraison, consentement) et `social-features` (liste des notifications) ; application d'ANTSIA (worker, commandes de notification, page « Mes données »).
