# Plan 04 — iCom : messages, appels et mise en relation

> Constaté par lecture du code d'`origin/main` (DIASPORALE `bead76d`, ANTSIA `fd58d73b`), le 10 novembre 2026. Rien n'a été exécuté : ni test, ni recette, ni publication.
> Applications de référence : WhatsApp (dont Communautés, Chaînes et Business), iMessage et FaceTime, Telegram, Signal, Messenger. Comparaison faite de mémoire, sans revérification en ligne ; un « ? » marque ce qui n'est pas sûr.
> Ce plan détaille, pour la messagerie, les appels et les conversations de mise en relation, le plan 15 du dossier de finalisation d'ANTSIA. Les lots qu'il en reprend gardent leur identifiant (DS-…, DG-…) ; les lots nouveaux portent le préfixe `IM-`.

Légende des chemins : `D:` = dépôt DIASPORALE, `A:` = dépôt ANTSIA. « Écran » = atteignable depuis l'interface de diasporale.com ; « Moteur » = la fonction existe côté serveur.

Lexique. **Fil** : une conversation. **Mise en relation** (sigle CC) : conversation ouverte par un objet (demande de service, mentorat, candidature), jamais par une relation. **Voix de page** : la page parle d'une seule voix, sans nommer le signataire qui écrit. **Politique** : interrupteur d'opérateur, par réseau et par nature de mise en relation, fermé par défaut. **Îlot** : endroit où DIASPORALE monte une surface du moteur avec son réseau et ses routes. Les lots `IC-…` et `ICP-3` sont ceux du plan 01 du moteur (session S1) : ce plan ne les refait pas.

## 1. L'intention du propriétaire

- **Pour qui** : des Gabonais de l'étranger dont la vie commune se tient aujourd'hui sur WhatsApp. La demande du 18/10 : « messagerie et appels inspirés de WhatsApp » ; résultat attendu : « retrouver une conversation, appeler une personne qui l'accepte » (docs/14 de DIASPORALE, en-tête et § 1.1).
- **Quoi** : iCom du moteur, monté tel quel, sans copie ni version propre à DIASPORALE (docs/14, § 2.1 ; décision du vault du 15/10, « iCom monté en îlots »).
- **Le contact passe par la messagerie** : aucune adresse ni numéro sur une surface publique, un bouton « Écrire » à la place (cahier, § 5, invariant 6 ; EXF-DG-33 ; fiche F13 du dossier produit).
- **Fermée aux inconnus** : un fil neuf ne s'ouvre qu'entre relations (ADR-0019 du moteur, option B rejetée). Un professionnel se joint par une demande structurée, sans « amitié artificielle » (D-G02). La conversation libre d'une mise en relation suit le contrat CONVERSATION-CONTEXTUELLE-V1, décisions D1 à D16 validées le 19/10.
- **Appels** : à deux et en groupe jusqu'à 11, jamais enregistrés. « Qui peut m'appeler : mes relations seulement », décidé le 9/11 (plan directeur du moteur, § 6.2). Un appel de mise en relation exige l'accord des deux personnes (D5).
- **Pas de promesse de chiffrement de bout en bout** : transport chiffré et contrôle d'accès, rien de plus n'est écrit à l'écran (D-G06, docs/17, § 3).
- **Groupes à 256** (D-G08). **Aucune publicité dans la messagerie** (cahier, lot D4).
- **iCom Pro reste à ANTSIA** : « DIASPORALE et les autres consommateurs gardent la messagerie unique » (ADR-0036) ; le prompt PD7 disait déjà « aucun élément iCom Pro ».
- **Refusé** : ouvrir les fils personnels aux inconnus sans acceptation ni quota ; recopier iCom ; écrire « chiffré » ; afficher une fonction vide.

## 2. Ce qui existe

| # | Capacité | État | Écran | Moteur | Preuve |
|---|---|---|---|---|---|
| 1 | iCom du moteur monté tel quel, en îlots ; couche d'appel montée une seule fois | Présent | oui | oui | `D:apps/diasporale_com/src/components/icom.tsx` (`EngineIcom`, `IcomIsland`) ; `A:packages/social-features/src/shell/communication-shell.tsx` |
| 2 | Réservé aux membres qui peuvent écrire (déclaré, vérifié) ; sinon la page dit pourquoi | Présent | oui | oui | `D:apps/diasporale_com/src/lib/icom-state.ts` (`resolveIcomState`) ; `D:apps/diasporale_com/src/screens/icom-screens.tsx` (`IcomUnavailable`) |
| 3 | Destination « Messages » de la coque, présente seulement quand iCom est ouvert | Présent | oui | — | `D:apps/diasporale_com/src/components/app-shell.tsx` |
| 4 | Carte iCom au bureau (rail dès 1 280 px, détachée en dessous) ; pages `/messages` au téléphone | Présent | oui | oui | `D:apps/diasporale_com/src/components/app-shell.tsx` ; `D:apps/diasporale_com/src/lib/messages-route.ts` |
| 5 | iCom en démonstration locale (données fictives du navigateur) | Fermé : état `off`, raison `demo` ; seul le mode moteur l'ouvre | non | — | `D:apps/diasporale_com/src/lib/icom-state.ts` (`ICOM_DEMO`) |
| 6 | iCom sur le site de démonstration en ligne (mode moteur) | Partiel : ouvert mais vide ; aucune relation ni conversation n'est posée entre les comptes de démonstration, les graines de conversation visent la racine | oui | oui | `A:convex/modules/diaspora/demoAccounts.ts` ; `A:convex/seeds/demoConversations.ts` |
| 7 | Présentation par vues (Conversations, Appels, Contacts) et bascule iCom Pro | Fermé : DIASPORALE ne déclare ni `navigation` ni `icomPro` ; elle garde les quatre briques d'origine | non | oui | `A:packages/api/src/network.tsx` ; `A:packages/social-features/src/features/messagerie/icom-views.ts` |
| 8 | Conversation à deux entre relations du réseau ; le fil naît au premier envoi | Présent | oui | oui | `A:convex/modules/messaging/inbox.ts` (`startThreadWithHandle`, `assertCanOpenPersonalThread`) |
| 9 | « Écrire » sur le profil d'une relation ; fermé avec sa raison hors relation | Présent | oui | oui | `D:apps/diasporale_com/src/screens/profile-screens.tsx` (`PersonContact`) |
| 10 | Écrire à un membre qui n'est pas encore une relation (demande de message) | Absent | non | non | motifs : `messageRequest`, « demande de message » ; refus `THREAD_RELATION_REQUIRED` |
| 11 | Écrire ou appeler, depuis diasporale.com, un proche membre d'ANTSIA seulement | Absent : fils, relations et appels sont bornés au réseau courant ; la personne visée doit être membre actif de `diasporale` | non | non | `A:convex/modules/messaging/tables.ts` (`personalThreads.networkId`) ; `A:convex/modules/people/miniProfile.ts` (`findPublishedPersonByHandle`) ; `A:convex/modules/calls/access.ts` (`reachablePerson`) |
| 12 | Passerelle vers ses conversations du réseau racine | Absent : un texte dit l'adhésion dérivée, aucun lien | non | — | motifs : `rootNetwork`, `openAntsia`, lien vers antsia.ga (aucun dans l'application) |
| 13 | Pièces jointes : 5 par message, 25 Mo, liste blanche, garde des fichiers | Présent | oui | oui | `A:packages/social-contracts/src/attachments.ts` |
| 14 | Message vocal | Présent | oui | oui | `A:packages/social-features/src/features/messagerie/VoiceRecorderButton.tsx` |
| 15 | Vitesse de lecture d'un vocal ; transcription | Absent | non | non | motifs : `playbackRate`, `transcri` (plan 01 du moteur) |
| 16 | Six réactions, réponse citée, transfert | Présent | oui | oui | `A:packages/social-contracts/src/messageReactions.ts` ; `A:packages/social-features/src/features/messagerie/ReplyPreview.tsx` ; `A:convex/modules/messaging/forward.ts` |
| 17 | Modifier (15 min), supprimer pour moi ou pour tous | Présent | oui | oui | `A:packages/social-contracts/src/messaging.ts` |
| 18 | Épingler un message par fil | Présent | oui | oui | `A:convex/modules/messaging/pins.ts` |
| 19 | Accusés « Envoyé » et « Lu » ; « écrit… » | Présent | oui | oui | `A:convex/modules/messaging/messages.ts` (`markRead`) ; `A:convex/modules/messaging/typing.ts` |
| 20 | Accusés de lecture désactivables | Absent | non | non | motifs : `readReceipts` (lot IC-04) |
| 21 | Brouillon par conversation | Partiel : texte gardé en session, pièces à resélectionner | oui | — | `A:packages/social-features/src/features/messagerie/dock-store.ts` |
| 22 | Envoi différé hors connexion ; compression avant envoi ; économie de données | Absent | non | non | motifs : `offline queue`, `persist` (lot IC-10) |
| 23 | Recherche de conversations | Partiel : filtre sur la fenêtre chargée | oui | non | `A:packages/social-features/src/features/messagerie/MessagerieListView.tsx` |
| 24 | Recherche dans les messages | Absent | non | non | motifs : `searchMessages`, `withSearchIndex` (lot IC-07) |
| 25 | Médias, liens et documents d'une conversation | Partiel : groupe seulement, sur l'historique chargé | partiel | non | `A:packages/social-features/src/features/messagerie/groupe-ressources.ts` |
| 26 | Archiver une conversation ; sourdine d'une conversation à deux | Absent | non | non | motifs : `archivedAt`, `mutedUntil` (lot IC-06) |
| 27 | Messages marqués, programmés, éphémères, à vue unique | Absent | non | non | motifs : `starred`, `ephemeral`, `viewOnce` |
| 28 | Sondage, position, fiche de contact, aperçu des liens | Absent | non | non | motifs : `poll`, `shareLocation`, `linkPreview` |
| 29 | Badge de confiance et pays du correspondant dans la liste et l'en-tête | Absent : le fil nomme la personne, sans badge ni pays | non | non | `A:packages/social-features/src/features/messagerie/ConversationHeader.tsx` ; motifs : `badge` de confiance dans la messagerie |
| 30 | Heure locale du correspondant | Absent : le fuseau est une préférence privée, jamais projetée à l'autre | non | partiel | `A:convex/modules/people/preferences.ts` ; `A:convex/modules/messaging/inbox.ts` (`ThreadDto` sans fuseau) |
| 31 | Export d'une conversation | Absent ; l'export du compte contient les messages envoyés | partiel | partiel | `D:apps/diasporale_com/src/components/data-rights-settings.tsx` |
| 32 | Plusieurs appareils | Présent par construction ; jamais recetté | oui | oui | messages au serveur, sessions multiples |
| 33 | Chiffrement de bout en bout | Absent, par décision : aucun libellé « chiffré » | non | non | docs/17 de DIASPORALE, § 3 (D-G06) |
| 34 | Groupe de conversation : titre, photo, description, 256 membres | Présent | oui | oui | `A:convex/modules/groups/threads.ts` (`createGroup`) ; `A:packages/social-contracts/src/groupCapacity.ts` |
| 35 | Rôles, retrait d'un membre, départ, suppression | Présent | oui | oui | `A:packages/social-features/src/features/messagerie/MessagerieGroupeInfos.tsx` |
| 36 | Invitation nominative acceptée par l'invité ; relation exigée entre l'invitant et l'invité | Présent | oui | oui | `A:convex/modules/groups/invites.ts` (`inviteToGroup`, `respondGroupInvite`) |
| 37 | Invitation par lien et code QR, réinitialisables | Présent ; jamais joué dans DIASPORALE | oui | oui | `A:packages/social-features/src/features/messagerie/groupe-invitation-link.ts` |
| 38 | Seuls les admins écrivent (annonces) ; entrée par lien à approuver | Absent | non | non | motifs : `onlyAdmins`, `announcementOnly`, `joinRequest` (lot IC-14) |
| 39 | Mentions `@` ; « Lu par » | Absent | non | non | motifs : `mentionedPersonIds` ; curseur de lecture sans écran (lots IC-11, IC-15) |
| 40 | Sourdine d'un groupe | Partiel : fonction sans écran | non | oui | `A:convex/modules/groups/threads.ts` (`setGroupMuted`) |
| 41 | Groupe de conversation lié à une association, un évènement ou un pays | Absent : le groupe d'association est un mur de publications, pas une conversation | non | non | `A:convex/modules/diaspora/associationGroups.ts` ; `A:convex/modules/groups/tables.ts` (aucun rattachement) |
| 42 | Fil d'annonces d'une association, à la manière des Communautés | Absent | non | non | motifs : `announcement`, `pageId` dans les tables des groupes |
| 43 | Chaîne d'un poste consulaire (diffusion à sens unique) | Partiel : rappels des pages suivies sous les Statuts ; la variante `channel` est réservée, non rendue | partiel | partiel | `A:packages/social-features/src/features/messagerie/icom-public-reminders.ts` (suite au plan 15) |
| 44 | Listes de diffusion | Absent, écarté par le plan 01 du moteur | non | non | motifs : `broadcastList` |
| 45 | Appel audio à deux depuis le profil d'une relation | Présent ; échoue sans serveur média | oui | oui | `D:apps/diasporale_com/src/screens/profile-screens.tsx` (`IcomContact`) ; `A:packages/social-features/src/features/iappel/useRingRelation.ts` |
| 46 | Appel vidéo à deux | Partiel : depuis l'en-tête d'une conversation, pas depuis le profil | partiel | oui | `A:packages/social-features/src/features/messagerie/ConversationHeader.tsx` |
| 47 | Appel de groupe jusqu'à 11, ajout en cours d'appel | Présent | oui | oui | `A:convex/modules/calls/groupCalls.ts` |
| 48 | Sonnerie, refus avec message, double appel, mise en attente | Présent | oui | oui | `A:convex/modules/calls/ringing.ts` |
| 49 | Journal d'appels et rappel (brique iAppel) | Présent | oui | oui | `A:packages/social-features/src/features/messagerie/IcomAppelJournal.tsx` |
| 50 | Messagerie vocale après un appel manqué | Partiel : dépôt possible, aucune écoute | partiel | oui | `A:convex/modules/calls/voicemail.ts` (`listMine`, `playbackUrl`, sans écran) |
| 51 | Qui peut m'appeler | Partiel : par défaut tout membre déclaré fait sonner ; le réglage existe au serveur, sans écran | non | oui | `A:convex/modules/calls/preferences.ts` (`outsideRelationsCalls`, défaut `ring`) |
| 52 | Réglages iCom dans les paramètres : ne pas déranger, réponses rapides, messagerie vocale, présence, double appel | Absent ici ; le moteur l'a | non | oui | `D:apps/diasporale_com/src/screens/settings-screen.tsx` ; motifs : `callPreferences`, `setDnd`, `MyPresenceRow` |
| 53 | Présence des relations (en ligne, occupé, ne pas déranger) | Présent | oui | oui | `A:convex/modules/calls/presence.ts` |
| 54 | Gestes d'appel retirés quand le serveur média n'est pas configuré | Absent : l'erreur n'arrive qu'après le geste | non | non | `A:convex/lib/livekit.ts` (`mediaServerNotConfigured`) ; motifs : `callsAvailable` |
| 55 | Continuité de l'appel pendant la navigation | Présent | oui | — | `A:packages/social-features/src/shell/communication/global-call-surface-host.tsx` |
| 56 | Partage d'écran, lien d'appel, appel programmé | Absent | non | non | motifs : `callLink`, `scheduledCall` (lot IC-20 ; plan 04 du moteur) |
| 57 | Notification poussée d'un appel entrant | Absent ici : aucun push web | non | partiel | `A:convex/modules/calls/push.ts` ; motifs : `serviceWorker`, `PushManager` (plan 13) |
| 58 | Enregistrement d'un appel | Absent, écarté | non | non | plan 01 du moteur, § 4.4 |
| 59 | Brique « Statuts » d'iCom et lecteur plein écran | Présent (détail au plan 03) | oui | oui | `D:apps/diasporale_com/src/screens/icom-screens.tsx` (`StoriesScreen`) |
| 60 | Rappels des pages suivies sous les statuts | Présent | oui | oui | `A:packages/social-features/src/features/messagerie/IcomPublicReminders.tsx` ; `A:convex/modules/pages/followedUpdates.ts` |
| 61 | Conversation attachée à une demande de service, un mentorat, une candidature | Fermé : politique fermée par réseau et par nature ; un administrateur de plateforme l'ouvre | oui | oui | `A:convex/modules/contextualMessaging/operator.ts` (`setPolicy`) |
| 62 | Entrée « Écrire », « Ouvrir » ou « Revoir la conversation » sur l'écran de l'objet | Présent | oui | oui | `D:apps/diasporale_com/src/components/contextual-conversations.tsx` (`ObjectConversationEntry`) |
| 63 | Phases par nature : premier mot au répondant, appels à partir d'une proposition, d'une acceptation, d'une présélection | Présent | — | oui | `D:packages/diasporale-domain/src/conversation-contexts.ts` ; `A:convex/modules/diaspora/conversationContexts.ts` |
| 64 | Voix de page : tous les signataires vivants lisent et répondent, d'une seule voix | Présent | oui | oui | `A:convex/modules/contextualMessaging/access.ts` |
| 65 | Adresse exacte refusée en voix de personne, admise en voix de page | Présent | oui | oui | `D:packages/diasporale-domain/src/conversation-contexts.ts` (`conversationTextRefusal`) |
| 66 | Liste « Mises en relation » au téléphone | Partiel : mes fils personnels seulement ; les fils des pages que je signe n'y sont pas | partiel | oui | `D:apps/diasporale_com/src/components/contextual-conversations.tsx` (`useDiasporaleContextualMessages`, sans `pageId`) |
| 67 | Liste « Mises en relation » au bureau | Absent : la carte iCom ne reçoit pas la source contextuelle | non | oui | `A:packages/social-features/src/features/messagerie/MessagerieDock.tsx` |
| 68 | Liste des conversations d'une page pour son équipe | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/contextualMessaging/threads.ts` (`paginateForPage`) |
| 69 | Appel de mise en relation sous accord explicite des deux côtés | Présent ; jamais joué | oui | oui | `A:convex/modules/contextualMessaging/calls.ts` (`setCallConsent`, `start`) |
| 70 | Clôture par un côté ; fil clos quand l'objet se ferme ; historique en lecture seule | Présent | oui | oui | `A:convex/modules/contextualMessaging/threads.ts` (`close`) ; `A:convex/modules/contextualMessaging/hooks.ts` |
| 71 | Resynchronisation après une décision de modération | Présent | — | oui | `A:convex/modules/diaspora/conversationSync.ts` |
| 72 | Pièces (deux par message) et vocaux dans une mise en relation | Présent | oui | oui | `A:convex/modules/contextualMessaging/attachments.ts` |
| 73 | Réactions, réponse citée, transfert, modification, « écrit… », accusé montré à l'autre | Absent, par contrat V1 | non | non | `A:docs/contrats/CONVERSATION-CONTEXTUELLE-V1.md` (§ 2) |
| 74 | Signaler un message d'une mise en relation | Présent | oui | oui | `A:packages/social-features/src/features/messagerie/ContextualConversationView.tsx` |
| 75 | Avis neutres : nouveau message, mise en relation close | Présent | oui | oui | `D:packages/diasporale-features/src/components/notification-bell.tsx` |
| 76 | Durée de conservation d'une conversation close | Partiel : aucune durée décidée, aucune purge | — | partiel | `A:packages/social-domain/src/contextualMessaging.ts` (`CONTEXTUAL_RETENTION`) |
| 77 | Mise en relation en démonstration locale | Absent : le port ne sert pas la capacité | non | — | `D:packages/diasporale-features/src/data/conversations-port.ts` |
| 78 | Écrire à une page (association sans offre, poste consulaire, média) | Absent : bouton désactivé, « La messagerie arrive bientôt » | non | non | `D:apps/diasporale_com/src/screens/page-screen.tsx` ; `D:packages/diasporale-features/src/components/community-controls.tsx` (`ContactButton`) |
| 79 | Demandes reçues par une page, filtrées par état | Présent | oui | oui | `D:apps/diasporale_com/src/components/service-inbox.tsx` |
| 80 | Horaires de réponse, message d'absence, réponses enregistrées, suivi par un équipier | Absent | non | non | prévu au moteur pour les boutiques seulement (lot ICP-3) |
| 81 | Délai de réponse d'une page | Absent | non | non | motifs : `responseTime` dans la tranche et la messagerie |
| 82 | Bloquer depuis le profil ; liste des personnes bloquées ; le blocage ferme le fil | Présent | oui | oui | `D:apps/diasporale_com/src/screens/relations-screen.tsx` ; `A:convex/modules/messaging/participation.ts` (`requireThread`) |
| 83 | Bloquer ou signaler la personne depuis la conversation | Absent | non | non | aucun geste dans `A:packages/social-features/src/features/messagerie/ConversationHeader.tsx` (lot IC-03) |
| 84 | Signaler un message à deux | Absent : aucune cible de modération | non | non | `A:convex/modules/moderation/tables.ts` |
| 85 | Signaler un message de groupe | Partiel : cible au serveur, aucun geste | non | oui | `A:convex/modules/moderation/tables.ts` (`groupMessage`) |
| 86 | Débits sur l'ouverture d'un fil, l'envoi, les groupes, les appels | Présent | — | oui | `A:convex/lib/rateLimit.ts` |
| 87 | Pastille de non-lus sur « Messages » | Présent | oui | oui | `A:convex/modules/messaging/inbox.ts` (`totalUnread`) |
| 88 | Cloche : message de groupe, invitation à un groupe, appel manqué, message vocal | Partiel : émis par le moteur, lus « Nouvelle activité dans DIASPORALE. », sans lien | partiel | oui | `D:packages/diasporale-features/src/data/types.ts` (`NOTIFICATION_KINDS`) ; `D:apps/diasporale_com/src/data/engine-views.ts` (`toNotificationView`) |
| 89 | Cloche d'un message à deux | Absent | non | non | aucun genre dans `A:packages/social-domain/src/notifications.ts` (lot IC-09) |
| 90 | Export et effacement des messages et des fils | Présent ; jamais joué de bout en bout | oui | oui | `A:convex/modules/people/dataPolicies.ts` |
| 91 | Un seul nom pour la messagerie | Partiel : « Messages » dans la coque, « iCom », « iChat », « iAppel » dans la carte | partiel | — | `D:packages/diasporale-features/src/i18n/locales/fr/diasporale.json` ; `A:packages/social-features/src/i18n/locales/fr/messagerie.dock.json` |
| 92 | iCom dans une application mobile DIASPORALE | Absent | non | partiel | `A:apps/antsia_mobile` (plan 16) |

Décompte : **Présent 40 · Partiel 14 · Absent 35 · Fermé 3**.

### Ce que le moteur sait déjà faire et que DIASPORALE ne montre pas

| Capacité du moteur | Où | Ce qui manque ici | Lot |
|---|---|---|---|
| Réglages d'appel et de présence, par personne | `A:convex/modules/calls/preferences.ts` | Aucun écran, ni ici ni dans antsia.ga ; `MyPresenceRow` n'est monté nulle part | IM-02 |
| Liste des conversations d'une page | `A:convex/modules/contextualMessaging/threads.ts` (`paginateForPage`) | DIASPORALE n'appelle jamais la liste avec `pageId` | IM-08 |
| Avis d'appel manqué, de message vocal, de groupe | `A:convex/modules/calls/evaluate.ts`, `A:convex/modules/groups/unread.ts` | La cloche ne les nomme pas | IM-04 |
| Écoute de la messagerie vocale | `A:convex/modules/calls/voicemail.ts` | Aucun écran (S1) | IC-02, puis IM-03 |
| Sourdine d'un groupe, cible de signalement d'un message de groupe | `A:convex/modules/groups/threads.ts`, `A:convex/modules/moderation/tables.ts` | Aucun geste (S1) | IC-06, IC-03 |
| Vues d'iCom et espace iCom Pro | `A:packages/api/src/network.tsx` | Non déclarés, par décision (ADR-0036) | décision 7 |
| Fuseau personnel | `A:convex/modules/people/preferences.ts` | Jamais montré au correspondant | IM-17 |

### Ce qui est écrit mais jamais recetté en réel

| Sujet | État | Source |
|---|---|---|
| Échange complet à deux comptes dans DIASPORALE (texte, pièce, vocal, réaction, transfert, suppression) | Aucun rapport daté. Seul constat : « Écrire » et « Appeler » joués le 15/10 jusqu'à la fenêtre d'appel | docs/04 de DIASPORALE, ligne « Messagerie 1:1 et de groupe » |
| Tout appel réel | Jamais : « Connexion impossible », pas de serveur média ; aucune clé consignée | docs/04 ; plan 01 du moteur, § 2 |
| Groupes : création, invitation, lien et code QR, rôles | Jamais joués dans DIASPORALE | — |
| CC-V : conversation d'une demande, d'un mentorat, d'une candidature | Bloquée le 19/10 : politique fermée, table des opérateurs vide en local | `D:docs/recette/deux-comptes-2026-10-19/README.md` |
| Appel de mise en relation, clôture, signalement d'un message, voix de page | Jamais joués | `D:docs/32_EXECUTION_VAGUE_H.md` (§ 11) |
| iCom sur la démonstration en ligne | Ouvert, vide : aucun parcours consigné | `D:docs/34_COMPTES_DE_DEMONSTRATION.md` |
| Deux appareils, coupure réseau, blocage en cours d'échange, changement de compte sur le même navigateur | Jamais joués (R-G13, R-G15, R-G16, R-G17) | docs/14, § 6.2 |
| Export et effacement d'un compte qui a des messages et une mise en relation | Jamais joué (R-G19) | plan 15 du moteur, § 2 |

## 3. Comparaison avec les applications de référence

| Capacité | WhatsApp | iMessage | Telegram | Signal | Messenger | DIASPORALE | Verdict |
|---|---|---|---|---|---|---|---|
| Qui peut m'écrire en premier | qui a mon numéro | qui a mon numéro ; filtre des inconnus | qui a mon identifiant, réglable | demande de message | demande de message | mes relations seulement | À adapter (IM-07, sur IC-08) |
| Coordonnée montrée à l'interlocuteur | numéro | numéro ou adresse | identifiant, numéro masquable | identifiant, numéro masquable | compte | aucune | Déjà fait, à garder |
| Texte, réponse citée, réactions, transfert, épingle | oui | oui | oui | oui | oui | oui | Déjà fait, à recetter |
| Modifier, supprimer pour tous | oui | oui | oui | oui | oui | oui, 15 min | Déjà fait |
| Message vocal | oui | oui | oui | oui | oui | oui | Déjà fait, à recetter |
| Vitesse et transcription d'un vocal | oui | transcription oui, vitesse ? | oui | vitesse oui | ? | non | À faire (IM-10, sur IC-12) ; transcription reportée |
| Pièces, photos, documents | oui | oui | oui | oui | oui | 5 pièces, 25 Mo | Déjà fait |
| Accusés de lecture, désactivables | oui | oui, par fil | lu, sans réglage ? | oui | ? | « Lu », sans réglage | À faire (IM-02, sur IC-04) |
| Recherche dans l'historique | oui | oui | oui | oui | oui | fenêtre chargée | À faire (IM-10, sur IC-07) |
| Archiver, couper les alertes d'un fil | oui | alertes seulement | oui | oui | oui | non | À faire (IM-10, sur IC-06) |
| Messages éphémères, vue unique | oui | non | discussions secrètes | oui | oui | non | Reporté (IM-20, avis du juriste) |
| Sondages | oui | ? | oui | ? | oui | non | Reporté (IC-17, puis IM-14) |
| Mentions dans un groupe | oui | oui | oui | oui | oui | non | À faire (IM-10, sur IC-11) |
| Taille d'un groupe | 1 024 | 32 ? | 200 000 | 1 000 | 250 ? | 256 | Déjà fait (D-G08) |
| Invitation par lien et code QR | oui | non | oui | oui | oui | oui | À recetter |
| Seuls les admins écrivent | oui | non | oui | oui | ? | non | Reporté (IC-14, puis IM-14) |
| Communauté : annonces et sous-groupes | Communautés | non | sujets d'un groupe | non | discussions communautaires | mur du groupe d'association | À faire (IM-14) |
| Chaîne à sens unique | Chaînes | non | canaux | non | canaux de diffusion | pages suivies, rappels | À adapter (plan 15) |
| Listes de diffusion | oui | non | non | non | non | non | Écarté (démarchage, ADR-0019) |
| Appel audio et vidéo à deux | oui | FaceTime | oui | oui | oui | oui, non prouvé | À recetter (IM-11, sur IC-01) |
| Appel de groupe | 32 | 32 | oui | 50 ? | oui | 11 | Déjà fait, plafond gardé |
| Partage d'écran | oui | oui | oui | oui | oui | non | Reporté (IM-19, sur IC-20) |
| Lien d'appel | oui | oui | ? | oui | ? | non | Reporté (IM-19, plan 04 du moteur) |
| Message après un appel manqué | ? | message audio ou vidéo | non | non | ? | dépôt sans écoute | À faire (IM-03, sur IC-02) |
| Silence des appelants inconnus | oui | oui | réglable | ? | ? | tout membre fait sonner | À faire (IM-02, sur IC-04) : décidé le 9/11 |
| Présence et « vu à », réglables | oui | non | oui | non | statut actif | présence, sans réglage | À faire (IM-02) |
| Bloquer et signaler depuis le fil | oui | oui | oui | oui | oui | depuis le profil seulement | À faire (IM-03, sur IC-03) |
| Chiffrement de bout en bout | oui | oui | discussions secrètes seulement | oui | oui | non | Écarté pour l'instant (D-G06) ; décision IM-20 |
| Plusieurs appareils | oui | oui | oui | oui | oui | oui, par construction | À recetter |
| Export d'une conversation | oui | non | oui | non | avec les données du compte | export du compte | Reporté (plan 13) |
| Économie de données, envoi différé | oui | qualité d'image réduite | oui | appels | ? | non | À faire (IM-10, sur IC-10) |
| Aperçu des liens, autocollants, GIF | oui | oui | oui | oui | oui | non | Écarté (fournisseurs tiers, plan 01 du moteur) |
| Badge de confiance de l'interlocuteur | comptes professionnels | non | comptes vérifiés | non | comptes vérifiés | badges calculés, absents du fil | À faire (IM-09) |
| Heure locale de l'interlocuteur | non | non | non | non | non | non | À faire, différenciant (IM-17) |
| Traduction d'un message | ? | ? | oui | non | ? | non | Écarté (cahier, § 8.15) |
| Écrire à une organisation | compte Business | ? | compte professionnel ? | non | page | non, sauf demande de service | À faire (IM-06) |
| Conversation attachée à un objet | panier d'un compte Business | non | non | non | annonce Marketplace | demande, mentorat, candidature | Déjà fait, fermé : à ouvrir (DS-04) |
| Horaires, absence, accueil, réponses enregistrées | Business | non | ? | non | boîte professionnelle | non | Reporté (IM-15, sur ICP-3) |
| Boîte partagée d'une équipe | appareils liés d'un compte | non | ? | non | boîte de page | tous les signataires, sans liste | À faire (IM-08) |
| Parler à quelqu'un hors du réseau | oui | oui | oui | oui | oui | non : réseau fermé, la racine est à part | À adapter (IM-12, puis IM-18) |
| Publicité dans la messagerie | ? | non | messages sponsorisés des canaux | non | oui | non | Écarté (cahier, lot D4) |
| Application mobile, appel reçu écran verrouillé | oui | oui | oui | oui | oui | non | Reporté (IM-21, plan 16) |

## 4. Ce qui manque

### 4.1 Bloquant avant l'ouverture du pilote

1. **La mise en relation n'a jamais parlé.** La politique est fermée sur tous les déploiements : après une demande de service, un mentorat accepté ou une candidature présélectionnée, « Écrire » répond « La conversation de cette mise en relation est fermée pour le moment ». Or c'est le seul canal libre entre deux membres qui ne sont pas des relations (DS-04).
2. **« Appeler » est proposé sans serveur prouvé.** Sans clés, l'appelant lit « La visioconférence n'est pas configurée sur ce déploiement. Contactez l'administrateur de la plateforme. » Il faut soit prouver les appels (IC-01, IM-11), soit retirer les gestes (IM-01).
3. **Tout membre déclaré peut faire sonner tout membre**, et DIASPORALE n'a aucun écran pour le régler. La décision du 9/11 (« mes relations seulement ») n'est pas encore dans le code (IC-04, IM-02).
4. **La messagerie vocale se dépose, personne ne l'écoute.** Le texte promet « Il le retrouvera dans son journal d'appels » (IC-02, IM-03).
5. **Un message à deux ou de groupe ne se signale pas**, et rien ne permet de bloquer depuis le fil (IC-03, IM-03).
6. **Aucune recette consignée d'un échange à deux comptes** dans DIASPORALE (volet de la campagne DS-05, § 6).

### 4.2 Fonctions attendues qui manquent

- **Écrire à une page.** Sur la fiche d'un poste consulaire, d'un média ou d'une page de communauté, le bouton « Écrire » est désactivé (« La messagerie arrive bientôt ») ; une association ou une entreprise sans offre publiée n'affiche aucun contact. EXF-DG-33 n'est tenu que par la demande de service (IM-06).
- **Écrire à un membre de son pays qui n'est pas une relation** : il faut d'abord demander une relation et attendre (IM-07).
- **Retrouver ses mises en relation** : aucune liste au bureau ; l'équipe d'une page n'a aucune liste de ses conversations, elle ouvre chaque demande une à une (IM-08).
- **Une cloche qui parle d'iCom** : appel manqué, message vocal, message de groupe, invitation à un groupe (IM-04) ; message à deux (IC-09).
- **Le quotidien d'une messagerie** : chercher dans l'historique, archiver, couper les alertes, mentionner, retrouver les photos d'un fil (IM-10, sur IC-06, IC-07, IC-11, IC-13).
- **Joindre la famille restée au Gabon** : impossible depuis diasporale.com, et rien ne dit où le faire (IM-12).
- **Des appels réellement entendus**, à deux et à trois (IM-11).

### 4.3 Options qui manquent sur ce qui existe

- Profil : appel audio seulement, pas de vidéo (IM-16).
- Conversation : ni badge de confiance, ni pays, ni heure locale du correspondant (IM-09, IM-17) ; vocal sans vitesse de lecture ; brouillon qui perd ses pièces au rechargement.
- Groupe : pas de mode « annonces seules », pas d'entrée à approuver, pas de mentions, pas de « Lu par », sourdine sans écran.
- Appels : aucun réglage visible (ne pas déranger, réponses rapides, double appel, présence), pas de partage d'écran, pas de lien d'appel.
- Mise en relation : pas de réaction, de réponse citée ni d'accusé (voulu par le contrat V1) ; aucune durée de conservation décidée (D7).
- Démonstration en ligne : iCom ouvert mais vide, aucune relation entre les comptes fictifs (IM-05).
- Nom : « Messages » dans la coque, « iCom », « iChat » et « iAppel » dans la carte (IM-13).

### 4.4 Améliorations de l'existant

- **Dire la frontière des réseaux** : un fil DIASPORALE et un fil ANTSIA entre les deux mêmes personnes sont deux fils. L'écran doit le dire là où la question se pose (iCom vide, réglages) (IM-12).
- **Suivre le moteur sans surprise** : chaque lot S1 d'iCom change DIASPORALE sans PR chez elle. Il faut un contrôle à chaque livraison : deux thèmes, deux largeurs, cloche, guichet (IM-10).
- **Présentation par volets** : DIASPORALE garde la carte à quatre briques ; ANTSIA est passée aux vues d'iCom. Les lots S1 visent d'abord ces vues : chaque issue demande que la présentation par volets soit servie, ou la question se tranche (décision 7).
- **Faible débit** : compression avant envoi et envoi différé viennent d'IC-10 ; la mesure sur un profil 3G n'existe pas (IM-10, avec DS-08).

### 4.5 Ce qui distingue DIASPORALE

- **Aucune coordonnée exposée** : ni numéro ni adresse. Aucune des cinq références ne le garantit sans réglage.
- **Une conversation attachée à l'objet**, ouverte et fermée par lui, avec un premier mot au professionnel et une adresse exacte refusée en voix de personne. C'est plus protecteur que la conversation libre d'une annonce.
- **Une page parle d'une seule voix** : le client ne sait pas quel équipier écrit ; le guichet, lui, le sait.
- **Des interlocuteurs identifiés** : entrée contrôlée, badges calculés. À montrer dans le fil (IM-09).
- **L'heure de l'autre** : une diaspora vit sur plusieurs fuseaux ; aucune référence ne l'affiche (IM-17).
- **Statuts honnêtes** : « Envoyé » et « Lu », jamais « Livré » sans preuve ; pas de publicité.

### 4.6 Écarté ou reporté, et pourquoi

| Sujet | Décision | Raison |
|---|---|---|
| Fils personnels ouverts aux inconnus sans acceptation | Écarté | ADR-0019, option B rejetée |
| Listes de diffusion, publicité dans la messagerie | Écarté | Démarchage ; cahier, lot D4 |
| Promesse de chiffrement de bout en bout | Écarté pour l'instant | D-G06 ; décision à instruire (IC-23, IM-20) |
| Version d'iCom propre à DIASPORALE, démonstration locale d'iCom | Écarté | Décision du 15/10 : surfaces montées telles quelles ; la démonstration dit qu'iCom y est fermé |
| iCom Pro (bascule, activités) | Écarté, sauf décision 7 | ADR-0036 : opt-in d'ANTSIA |
| Groupes au-delà de 256 | Écarté | D-G08 |
| Messages éphémères, vue unique | Reporté | Tension avec la preuve d'un signalement : avis du juriste |
| Traduction des messages, transcription des vocaux | Reporté | Cahier, § 8.15 ; plan 16 du moteur |
| Autocollants, GIF, aperçu de liens externes | Écarté | Fournisseurs tiers (plan 01 du moteur) |
| Enregistrement des appels | Écarté | Plan 01 du moteur |
| Direct d'un évènement | Plan 08 | Route `conference` non servie ; DS-18 |

## 5. Lots d'implémentation

### DS-04 (volet CC-V) — Recette CC-V et traitement au guichet · P0 · M · S2 · repris du plan 15
- **Pour l'utilisateur** : la conversation d'une demande de service, d'un mentorat accepté ou d'une candidature présélectionnée s'ouvre vraiment. Le volet « guichet » de ce lot est au plan 14.
- **Backend** : aucun code attendu. Sur le backend local, puis sur la démonstration : ouvrir les trois natures par `setPolicy` (`A:convex/modules/contextualMessaging/operator.ts`), avec motif et journal. Un défaut du chargeur se corrige dans `A:convex/modules/diaspora/conversationContexts.ts` ; tout autre défaut devient une issue [S1].
- **Web** : corriger ce que la recette révèle dans `D:apps/diasporale_com/src/components/contextual-conversations.tsx` et dans les quatre écrans qui montent l'entrée.
- **Mobile** : sans objet.
- **Données personnelles** : vérifier que les messages d'une mise en relation entrent dans l'export et l'effacement ; en voix de page, trace sans contenu (D13, à confirmer par le juriste).
- **Tests et cliquets** : `A:tests/ratchets/contextual-hooks.test.ts` vert ; un test par défaut trouvé.
- **Critères d'acceptation** : à deux comptes et pour chaque nature : premier mot au répondant sur une demande ; voix de page sans nom de signataire ; adresse exacte refusée en voix de personne, admise en voix de page ; pièce et vocal ; appel refusé sans les deux accords, admis avec ; clôture par un côté ; fil clos quand l'objet se ferme, historique lisible ; message signalé arrivé au guichet ; politique refermée : écriture bloquée, lecture gardée.
- **Dépend de** : DS-01 ; plan 14 pour l'équipe de modération.
- **Porte** : accord du propriétaire pour ouvrir la politique sur la démonstration (décision 1) ; publication éventuelle.

### IM-01 — Appels : rien n'est proposé tant que le serveur d'appels n'est pas prouvé · P0 · S · S2
- **Pour l'utilisateur** : aucun bouton « Appeler » qui finit sur une erreur de configuration.
- **Backend** : issue [S1] : une déclaration « appels ouverts » lue par les surfaces du moteur, à côté de `liveAvailable` (`A:packages/api/src/network.tsx`), qui retire les gestes d'appel de l'en-tête d'un fil, de la liste des relations et du journal.
- **Web** : sans attendre, `PersonContact` (`D:apps/diasporale_com/src/screens/profile-screens.tsx`) ne rend « Appeler » que si l'application déclare les appels ouverts : variable publique du front posée à la publication, nom seulement dans le dépôt.
- **Mobile** : même règle à porter.
- **Données personnelles** : aucune.
- **Tests et cliquets** : appels fermés, aucun bouton d'appel sur le profil ; ouverts, le bouton revient ; un seul bouton plein par zone.
- **Critères d'acceptation** : sur un déploiement sans serveur média, le profil ne propose aucun appel ; l'état de la carte iCom est consigné tant que l'issue [S1] n'est pas livrée.
- **Dépend de** : décision 2.
- **Porte** : aucune pour le code ; l'ouverture réelle attend les clés du propriétaire et IC-01.

### IM-02 — Réglages iCom dans les paramètres de DIASPORALE · P0 · S · S2
- **Pour l'utilisateur** : choisir qui peut m'appeler, me mettre en « Ne pas déranger », régler ma messagerie vocale, ma présence et le double appel.
- **Backend** : aucun : `getMine`, `update` et `setDnd` existent (`A:convex/modules/calls/preferences.ts`), par personne, pour tous ses réseaux. Le défaut « mes relations seulement » et les accusés désactivables arrivent avec IC-04 (S1).
- **Web** : rubrique « Messages et appels » dans `D:apps/diasporale_com/src/screens/settings-screen.tsx`, React Hook Form et Zod. Monter la surface d'IC-04 si elle est livrée dans le paquet du moteur ; sinon écrire la section sur ces fonctions. Dire que ces réglages valent aussi dans ANTSIA.
- **Mobile** : à porter avec les réglages natifs.
- **Données personnelles** : `callPreferences` est déjà dans l'inventaire (`A:convex/modules/people/dataPolicies.ts`).
- **Tests et cliquets** : un test par interrupteur prouve son effet serveur ; fragment de textes fr et en ; cliquet i18n.
- **Critères d'acceptation** : à deux comptes non reliés, « silencieux hors relations » réglé ici empêche la sonnerie ; aucun interrupteur sans effet.
- **Dépend de** : IC-04 pour le défaut et les accusés ; plan 13 pour la place de la rubrique.
- **Porte** : aucune.

### IM-03 — Messagerie vocale, signaler et bloquer depuis le fil : raccord dans DIASPORALE · P0 · S · S2
- **Pour l'utilisateur** : écouter le message laissé après un appel manqué ; signaler un message ; bloquer sans quitter la conversation.
- **Backend** : aucun dans la tranche ; IC-02 et IC-03 (S1) livrent l'écoute et la cible du message à deux. Vérifier avec le plan 14 dans quelle file du bureau par pays tombe un message à deux ou de groupe (`A:convex/modules/diaspora/moderationDesk.ts`).
- **Web** : surfaces héritées ; nommer la nouvelle surface de modération au guichet et dans « Mes données » (fr et en) ; vérifier les îlots dans les thèmes Sable et Gaboma.
- **Mobile** : à porter.
- **Données personnelles** : signalements selon la politique existante ; messagerie vocale déjà inventoriée.
- **Tests et cliquets** : cliquet i18n des surfaces de modération ; test d'écran du guichet avec la nouvelle surface.
- **Critères d'acceptation** : à deux comptes : message vocal déposé, écouté, marqué lu, supprimé ; message signalé visible au bureau du bon pays ; « Bloquer » ferme le fil des deux côtés.
- **Dépend de** : IC-02, IC-03 ; plan 14.
- **Porte** : aucune.

### IM-04 — La cloche nomme les avis d'iCom et y mène · P1 · S · S2
- **Pour l'utilisateur** : lire « Appel manqué », « Message vocal », « Nouveau message dans un groupe », « Invitation à un groupe », et y aller d'un geste.
- **Backend** : aucun : ces genres sont déjà émis (`A:convex/modules/calls/evaluate.ts`, `A:convex/modules/calls/voicemail.ts`, `A:convex/modules/groups/unread.ts`, `A:convex/modules/groups/invites.ts`).
- **Web** : ajouter les quatre genres à `NOTIFICATION_KINDS` (`D:packages/diasporale-features/src/data/types.ts`), avec phrase neutre, icône et lien dans `D:packages/diasporale-features/src/components/notification-bell.tsx` ; projeter leur sujet dans `D:apps/diasporale_com/src/data/engine-views.ts`. La démonstration locale n'en sert aucun : iCom y est fermé.
- **Mobile** : à porter.
- **Données personnelles** : aucune ; avis sans contenu ni nom de fichier.
- **Tests et cliquets** : un test par genre (phrase, lien) ; `notification-payload-content`.
- **Critères d'acceptation** : plus aucun avis d'iCom ne se lit « Nouvelle activité dans DIASPORALE. » ; l'invitation mène à l'acceptation, l'appel manqué au journal.
- **Dépend de** : plan 13 (cloche).
- **Porte** : aucune.

### IM-05 — iCom vivant sur la démonstration · P1 · M · S2
- **Pour l'utilisateur** : le visiteur de la démonstration voit une conversation, un groupe et une mise en relation sans devoir d'abord nouer une relation.
- **Backend** : dans l'équipement des comptes fictifs (`A:convex/modules/diaspora/demoAccounts.ts`) : relations acceptées entre quelques acteurs par les mutations du graphe, une conversation, un groupe de trois, une demande de service avec proposition, un mentorat accepté ; contenu fictif ; idempotent ; refusé hors déploiement de démonstration.
- **Web** : le panneau des comptes dit quels acteurs sont déjà reliés.
- **Mobile** : sans objet.
- **Données personnelles** : comptes `demo.diasporale.test` seulement.
- **Tests et cliquets** : équipement rejoué sans doublon ; refus en production.
- **Critères d'acceptation** : `verifie` et `declare` ont « Écrire » ouvert l'un vers l'autre ; la liste des mises en relation n'est vide ni pour `entreprise` ni pour `mentor`.
- **Dépend de** : DS-04 ; IM-08.
- **Porte** : accord pour republier la démonstration et y ouvrir la politique (décision 1).

### IM-06 — Écrire à une page : prise de contact acceptée par l'équipe · P1 · L · S2
- **Pour l'utilisateur** : écrire à une association, à une entreprise sans offre publiée ou à un poste consulaire, sans coordonnée ; l'équipe accepte ou décline.
- **Backend** : objet « prise de contact » dans la tranche : page, demandeur, motif choisi dans une liste fermée, premier message en texte seul, états demandé, accepté, décliné, clos ; une seule en cours par personne et par page ; réglage de la page « accepte les prises de contact » ; seau de débit ; idempotence. Nouvelle nature de mise en relation par la procédure fermée du contrat (§ 10.5) : issue [S1] pour le validateur, le registre et le cliquet.
- **Web** : le bouton « Écrire » de `D:apps/diasporale_com/src/screens/page-screen.tsx` ouvre une feuille (React Hook Form, Zod) ; onglet de l'équipe dans la gestion de la page ; port, adaptateur moteur, fournisseur de démonstration, fragment de textes.
- **Mobile** : à porter.
- **Données personnelles** : export et effacement des prises de contact ; signalement ; avis neutres à l'équipe (vingt signataires au plus) et au demandeur.
- **Tests et cliquets** : un tiers ne lit rien ; double envoi, une seule prise de contact ; page fermée aux contacts, aucun bouton ; contact de sa propre page refusé.
- **Critères d'acceptation** : à deux comptes : demande, acceptation, conversation en voix de page, clôture ; refus motivé visible du demandeur sans nom de signataire.
- **Dépend de** : DS-04 ; plan 07 (gestion de page) ; plan 15 pour les postes consulaires.
- **Porte** : décision 3 ; issue [S1] pour la nature.

### IM-07 — Demandes de message entre membres · P1 · M · S2
- **Pour l'utilisateur** : écrire une fois à un membre qui n'est pas une relation ; il accepte, refuse ou bloque.
- **Backend** : IC-08 (S1) ; rien dans la tranche.
- **Web** : « Écrire » du profil hors relation ouvre la demande au lieu de l'indice « réservé à vos relations » ; réglage « qui peut m'écrire » dans la rubrique d'IM-02 ; avis dans la cloche ; l'onglet des demandes d'iCom est hérité.
- **Mobile** : à porter.
- **Données personnelles** : celles d'IC-08 (export, effacement, conservation d'un refus).
- **Tests et cliquets** : compte en attente refusé ; bloqué, refus indistinct.
- **Critères d'acceptation** : deux membres déclarés non reliés ouvrent une conversation par une demande acceptée ; aucune seconde demande sans réponse.
- **Dépend de** : IC-08 ; IM-02 ; IM-04.
- **Porte** : décision 4.

### IM-08 — Mises en relation : liste au bureau et boîte de la page · P1 · S · S2
- **Pour l'utilisateur** : retrouver toutes ses mises en relation au bureau ; pour une équipe, voir les conversations de sa page en une liste.
- **Backend** : aucun : `paginateMine` et `paginateForPage` existent (`A:convex/modules/contextualMessaging/threads.ts`).
- **Web** : monter la liste injectée par `A:packages/social-features/src/features/messagerie/use-contextual-messages.tsx`, avec `pageId` pour une page, dans « Mes demandes », « Mes mentorats », « Mes candidatures » et dans l'onglet « Demandes » de « Mon activité » (`D:apps/diasporale_com/src/components/service-inbox.tsx`), sous l'îlot iCom. Aucune nouvelle destination.
- **Mobile** : à porter.
- **Données personnelles** : aucune nouvelle.
- **Tests et cliquets** : un signataire retiré ne lit plus la boîte ; `member-screens-full-width`.
- **Critères d'acceptation** : au bureau, la liste est à deux gestes de la coque ; la boîte d'une page montre les fils lus au nom de la page, jamais les fils personnels.
- **Dépend de** : DS-04.
- **Porte** : aucune.

### IM-09 — Savoir à qui l'on parle : badge de confiance et pays dans la conversation · P1 · S · S1
- **Pour l'utilisateur** : voir « Vérifié », « Officiel » ou « Communauté » et le pays de l'autre dans la liste et l'en-tête d'un fil.
- **Backend** : issue [S1] : badges calculés dans l'étiquette du correspondant (`counterpartOf`, `A:convex/modules/messaging/participation.ts`) et emplacement d'en-tête injectable ; le pays vient de la facette de la tranche.
- **Web** : DIASPORALE remplit l'emplacement avec son étiquette de pays.
- **Mobile** : à porter.
- **Données personnelles** : aucune : projection de données déjà visibles sur le profil, visibilité par champ respectée.
- **Tests et cliquets** : badge jamais stocké ; pays caché par son titulaire, absent du fil.
- **Critères d'acceptation** : un membre vérifié porte son badge dans l'en-tête ; un pays masqué ne s'y lit pas.
- **Dépend de** : plan 05 (visibilité de la facette).
- **Porte** : aucune.

### IM-10 — Suivre les lots iCom du moteur dans DIASPORALE · P1 · M · S2
- **Pour l'utilisateur** : archiver, couper les alertes, chercher, mentionner, écouter plus vite, retrouver les médias, envoyer sur un réseau lent, dès que le moteur le livre.
- **Backend** : aucun.
- **Web** : à chaque lot S1 fusionné (IC-05, IC-06, IC-07, IC-09, IC-10, IC-11, IC-12, IC-13) : contrôler l'îlot dans les deux thèmes et à deux largeurs ; nommer les nouveaux genres dans la cloche ; vérifier que la carte à quatre briques reçoit l'option, sinon issue [S1] ; mesurer l'ouverture d'iCom et l'envoi d'une photo sur un profil 3G, avec DS-08.
- **Mobile** : sans objet.
- **Données personnelles** : celles de chaque lot S1.
- **Tests et cliquets** : tests d'îlot (`D:apps/diasporale_com/src/screens/icom-screens.tsx`) tenus à jour ; cliquet i18n.
- **Critères d'acceptation** : un tableau de suivi daté sous docs/recette ; aucune option livrée au moteur n'est absente ici sans raison écrite ; les temps mesurés sont dits tels quels.
- **Dépend de** : les lots S1 cités ; DS-08.
- **Porte** : publication de la démonstration après accord.

### IM-11 — Appels réels : recette à deux et à trois · P1 · S · S2
- **Pour l'utilisateur** : un appel audio et vidéo réellement entendu, dans les deux sens.
- **Backend** : aucun code ; clés du serveur d'appels posées par le propriétaire sur un déploiement de recette.
- **Web** : scénario à deux comptes puis à trois : appel depuis le profil et depuis un fil, refus, double appel, navigation pendant l'appel, permission refusée, coupure réseau, appel de mise en relation sous double accord.
- **Mobile** : téléphone réel en navigateur ; l'appel natif reste au plan 16.
- **Données personnelles** : comptes de recette seulement.
- **Tests et cliquets** : rapport daté sous docs/recette, fait ou non fait par ligne.
- **Critères d'acceptation** : son entendu des deux côtés ; trois participants ; un appel d'un compte bloqué ne sonne pas.
- **Dépend de** : IC-01 ; IM-01 ; DS-04.
- **Porte** : clés du propriétaire ; accord pour toute action sur un déploiement en ligne.

### IM-12 — Famille au Gabon : dire la frontière et ouvrir ANTSIA en un geste · P1 · S · S2
- **Pour l'utilisateur** : comprendre que ses proches restés au pays se joignent par ANTSIA, avec le même compte, et y aller.
- **Backend** : aucun.
- **Web** : une phrase et un lien dans iCom quand la liste est vide et dans « Adhésions » des réglages ; l'adresse d'ANTSIA vient de la configuration publique du front, jamais écrite en dur ; le lien n'apparaît que si elle est posée.
- **Mobile** : à porter.
- **Données personnelles** : aucune ; rien ne traverse d'un réseau à l'autre.
- **Tests et cliquets** : `no-hardcoded-urls` ; sans adresse configurée, aucun lien.
- **Critères d'acceptation** : le texte dit que les conversations des deux réseaux sont séparées ; aucun contenu de DIASPORALE n'est montré dans ANTSIA.
- **Dépend de** : domaine d'ANTSIA branché (plan 13 du moteur).
- **Porte** : décision 5.

### IM-13 — Un seul nom pour la messagerie · P1 · S · S2
- **Pour l'utilisateur** : le même mot dans la barre, le titre de la page, la carte et les avis.
- **Backend** : aucun.
- **Web** : aligner `nav.messages` et `messages.title` (`D:packages/diasporale-features/src/i18n/locales/fr/diasporale.json`, et en) sur le nom décidé ; si les libellés des briques du moteur doivent changer, issue [S1] (IC-05).
- **Mobile** : à porter.
- **Données personnelles** : aucune.
- **Tests et cliquets** : cliquet i18n ; test de la coque.
- **Critères d'acceptation** : un seul nom à l'écran, en français et en anglais.
- **Dépend de** : IC-05.
- **Porte** : décision 6.

### IM-14 — Fil d'annonces et discussion d'une association · P2 · L · S2
- **Pour l'utilisateur** : recevoir les annonces de son association dans iCom et discuter entre adhérents, à la manière d'une communauté.
- **Backend** : rattachement d'un groupe de conversation à une page d'association dans la tranche (une ligne de liaison, entrée volontaire des adhérents acceptés, sortie à la perte de l'adhésion) ; le mode « seuls les responsables écrivent » vient d'IC-14 (S1).
- **Web** : entrée depuis la page de l'association et depuis « Mes associations » ; port, démonstration, textes.
- **Mobile** : à porter.
- **Données personnelles** : appartenance dans l'export et l'effacement ; aucun adhérent inscrit d'office.
- **Tests et cliquets** : adhérent parti, accès perdu ; plafond de 256 respecté ; aucune inscription automatique.
- **Critères d'acceptation** : une association de plus de 256 adhérents garde son mur comme canal d'annonces ; rien n'est présenté comme illimité.
- **Dépend de** : IC-14 ; plan 07 (adhésions) ; décision 8.
- **Porte** : aucune.

### IM-15 — Boîte de la page : réponses enregistrées, horaires de réponse, absence, suivi · P2 · L · S1
- **Pour l'utilisateur** : la page annonce quand elle répond, insère une réponse enregistrée, et l'équipe sait qui suit chaque conversation.
- **Backend** : issue [S1] : généraliser aux pages les réglages qu'ICP-3 construit pour les boutiques (semaine d'horaires avec fuseau de la page, message d'absence envoyé une fois, réponses bornées, équipier qui suit, visible de l'équipe seulement) ; délai de réponse calculé, jamais estimé.
- **Web** : réglages dans la gestion de la page ; affichage avant le premier message.
- **Mobile** : à porter.
- **Données personnelles** : le suivi par un équipier s'efface avec le fil ; le client ne voit jamais son nom.
- **Tests et cliquets** : une seule réponse automatique par fil et par période ; équipier retiré, suivi retiré.
- **Critères d'acceptation** : hors horaires, une seule réponse automatique, marquée comme telle ; aucun délai affiché sans donnée réelle.
- **Dépend de** : ICP-3 ; IM-06 ; IM-08 ; convergence DS-16.
- **Porte** : décision 7.

### IM-16 — Options d'appel : vidéo depuis le profil, appel d'un groupe · P2 · S · S2
- **Pour l'utilisateur** : choisir audio ou vidéo sur le profil d'une relation.
- **Backend** : aucun : `ring` accepte déjà le type de média (`A:packages/social-features/src/features/iappel/useRingRelation.ts`).
- **Web** : second geste dans `IcomContact` (`D:apps/diasporale_com/src/screens/profile-screens.tsx`), « Appeler » restant en variante `message` tonale (décision du 9/11 sur les six boutons).
- **Mobile** : à porter.
- **Données personnelles** : aucune.
- **Tests et cliquets** : un seul bouton plein par zone ; contraste dans les deux thèmes.
- **Critères d'acceptation** : l'appel vidéo part du profil ; aucun geste quand les appels sont fermés.
- **Dépend de** : IM-01 ; IM-11.
- **Porte** : aucune.

### IM-17 — Heure locale du correspondant · P2 · S · S1
- **Pour l'utilisateur** : lire « 23 h 10 chez elle » avant d'écrire ou d'appeler.
- **Backend** : issue [S1] : projeter l'heure locale du correspondant, calculée du fuseau qu'il accepte de montrer ; jamais le fuseau brut ni une position.
- **Web** : en-tête du fil et fiche du profil ; réglage de visibilité dans la rubrique d'IM-02, désactivable.
- **Mobile** : à porter.
- **Données personnelles** : le fuseau reste une préférence ; choix de visibilité exporté.
- **Tests et cliquets** : visibilité coupée, aucune heure ; changement d'heure saisonnier juste.
- **Critères d'acceptation** : l'heure affichée correspond au fuseau réglé ; rien n'est déduit du pays seul.
- **Dépend de** : IM-09 ; plan 05.
- **Porte** : décision 9.

### IM-18 — Conversations du réseau racine dans la carte iCom · P2 · M · S1
- **Pour l'utilisateur** : écrire et appeler ses proches d'ANTSIA sans quitter diasporale.com, dans un espace nommé à part.
- **Backend** : aucun droit nouveau : le membre a déjà son adhésion dérivée ; issue [S1] : monter un second îlot sur le réseau racine, avec ses propres non-lus et son propre stockage.
- **Web** : bascule « DIASPORALE | ANTSIA » dans la carte ; rien de la racine ne se mêle aux listes du réseau.
- **Mobile** : à porter.
- **Données personnelles** : aucune donnée ne change de réseau.
- **Tests et cliquets** : un fil de la racine n'apparaît jamais dans les listes de `diasporale`, et l'inverse ; `network-scoped-functions`.
- **Critères d'acceptation** : les deux espaces sont nommés et séparés ; la suspension à la racine ferme les deux.
- **Dépend de** : IM-12 ; retour du pilote.
- **Porte** : décision 5.

### IM-19 — Réunion d'association : partage d'écran et lien d'appel · P3 · M · S2
- **Pour l'utilisateur** : tenir une réunion de bureau en visio, avec un lien et un écran partagé.
- **Contenu** : brancher le partage d'écran (IC-20) et le lien d'invitation des conférences du plan 04 du moteur sur les groupes et les évènements d'association ; seul un responsable vivant ouvre la réunion.
- **Dépend de** : IC-20 ; plan 04 du moteur ; plan 08 ; IM-11.
- **Porte** : clés du serveur d'appels.

### IM-20 — Chiffrement, messages éphémères, vue unique : décisions et textes honnêtes · P3 · S · S2
- **Pour l'utilisateur** : savoir exactement comment ses messages sont protégés.
- **Contenu** : reprendre dans la confidentialité de DIASPORALE le niveau réellement livré (docs/17, § 3) ; suivre l'ADR d'IC-23 ; aucun réglage de façade ; éphémères et vue unique seulement après l'avis du juriste sur la preuve d'un signalement.
- **Dépend de** : IC-23 ; DS-07 ; plan 14.
- **Porte** : décision 11 ; juriste.

### IM-21 — iCom dans l'application mobile de DIASPORALE · P3 · L · S3
- **Pour l'utilisateur** : messages, groupes, mises en relation et appel reçu écran verrouillé, sur téléphone.
- **Contenu** : réemployer le natif d'ANTSIA (`A:packages/social-native`) avec le réseau `diasporale` ; sortie globale et caches purgés ; aucun appel natif avant la preuve sur appareils réels.
- **Dépend de** : plan 16 ; IC-22 ; MB-11 ; MB-17.
- **Porte** : comptes des magasins d'applications ; clés du serveur d'appels et des notifications.

## 6. Ordre recommandé et dépendances

| Vague | Lots | Pourquoi dans cet ordre |
|---|---|---|
| 1 | DS-04 (volet CC-V), IM-01, IM-02 | Rendre vrai ce qui est promis ; aucun ne dépend d'une clé ; IM-02 se fait sur des fonctions déjà là |
| 2 | IM-03, IM-04, IM-08 | Dès qu'IC-02 et IC-03 sont fusionnés ; la cloche et la boîte de la page ne dépendent de personne |
| 3 | IM-05, IM-13, IM-12 | Démonstration vivante, un seul nom, la frontière des réseaux dite |
| 4 | IM-11 | Dès les clés et IC-01 |
| 5 | IM-06, IM-07, IM-09, IM-10 | Les fonctions attendues ; IM-06 et IM-07 demandent une décision et un lot S1 |
| 6 | IM-14 à IM-18 | Après les premiers retours du pilote |
| 7 | IM-19, IM-20, IM-21 | Sous condition externe |

**Ce que ce plan attend des autres plans.** Moteur, plan 01 : IC-01 à IC-14, IC-20, IC-23, ICP-3 ; plan 04 (conférences) ; plan 13 (domaine d'ANTSIA). DIASPORALE : plan 05 (relations, blocage, visibilité de la facette) ; plan 07 (gestion de page, adhésions) ; plan 08 (évènements, direct) ; plans 09, 10 et 11, clients des mises en relation ; plan 13 (cloche, réglages, push, export) ; plan 14 (guichet, natures de signalement) ; plan 15 (postes consulaires, chaîne) ; plan 16 (mobile) ; plan 17 (campagne DS-05, DS-06, DS-07). **Ce que les autres attendent de celui-ci** : la politique ouverte et recettée (DS-04) avant toute recette des plans 09, 10 et 11 ; la boîte de la page (IM-08) ; la prise de contact (IM-06) pour les pages du plan 15.

**Volet de recette en mode moteur (campagne DS-05).** Backend local, comptes de démonstration par acteur : `verifie`, `declare`, `leger`, `belgique`, `entreprise`, `mentor`, `talent`, `bloque`, `suspendu`.

| Étape | Action | Résultat attendu |
|---|---|---|
| 1 | `verifie` demande une relation à `declare`, qui accepte | « Écrire » et « Appeler » s'ouvrent sur les deux profils |
| 2 | Texte, photo, vocal ; réponse citée, réaction, transfert, modification, suppression pour tous | Accusé « Lu », pastille juste, aucun doublon après rechargement |
| 3 | `leger` ouvre `/messages` | « Pour échanger, il faut être membre déclaré » ; aucune liste |
| 4 | `verifie` crée un groupe de trois, copie le lien ; `belgique` entre par le lien | Entrée sans relation préalable, rôle membre, départ possible |
| 5 | `verifie` bloque `declare` pendant l'échange | Fil fermé des deux côtés, refus indistinct (R-G13) |
| 6 | `suspendu` ouvre `/messages` | iCom fermé ; « Mes données » reste ouvert |
| 7 | Déconnexion, puis connexion d'un autre compte sur le même navigateur | Aucun brouillon ni fil du compte précédent (R-G17) |
| 8 | Les deux mêmes personnes ouvrent ANTSIA | Le fil de DIASPORALE n'y est pas (R-G03) |
| 9 | « Appeler » sans serveur média | Avant IM-01 : message d'erreur consigné ; après : aucun bouton |
| 10 | CC-V, selon DS-04 : `declare` et `entreprise`, `declare` et `mentor`, `talent` et `entreprise` | Les critères d'acceptation de DS-04, nature par nature |

## 7. Décisions à prendre par le propriétaire

1. **Ouvrir la politique des mises en relation** sur le backend local, puis sur la démonstration, puis en production le jour du pilote, pour les trois natures. Recommandation : oui. Raison : sans elle, la mise en relation n'a aucune conversation ; c'est déjà la décision 9 proposée par le plan 15.
2. **Appels au pilote.** Recommandation : pilote sans appels tant qu'IC-01 n'est pas passé, gestes retirés (IM-01). Raison : rien n'a été éprouvé avec un vrai serveur ; un bouton qui échoue coûte plus qu'un bouton absent.
3. **Écrire à une page.** Recommandation : une prise de contact acceptée par l'équipe, pour les pages vérifiées et les pages « Officiel » qui l'ouvrent, texte seul, une seule en cours par personne et par page (IM-06). Raison : EXF-DG-33 et la fiche F13 le demandent ; aujourd'hui le bouton dit « bientôt ».
4. **Demandes de message entre membres.** Recommandation : ouvertes aux membres déclarés et vérifiés, une par paire, texte seul, réglables par chacun. Raison : le réseau est fermé et l'entrée contrôlée ; l'ADR-0019 exige acceptation et quota, cette forme les tient.
5. **Famille restée au Gabon.** Recommandation : dire la frontière et poser le lien tout de suite (IM-12) ; décider après le pilote d'un espace « ANTSIA » dans la carte (IM-18). Raison : le contexte séparé est un invariant ; l'espace commun est un choix d'architecture à prendre avec S1.
6. **Nom.** Recommandation : « iCom » partout, comme l'ADR-0036 l'a décidé pour ANTSIA, avec « Conversations », « Appels », « Relations » pour les briques. Raison : un seul nom dans le programme.
7. **iCom Pro et vues d'iCom dans DIASPORALE.** Recommandation : ne pas ouvrir la bascule ; donner aux pages les réglages utiles (IM-15) ; décider après le pilote de passer aux vues d'iCom d'ANTSIA. Raison : l'ADR-0036 réserve iCom Pro à ANTSIA ; rouvrir ce point est possible, pas le contourner.
8. **Groupe d'association.** Recommandation : garder 256 pour la discussion, le mur restant le canal d'annonces au-delà. Raison : D-G08.
9. **Heure locale du correspondant.** Recommandation : oui, montrée aux relations, désactivable. Raison : utile à une diaspora ; la donnée est faible mais personnelle, à inscrire au registre des consentements.
10. **Conservation et export** des mises en relation (D7, D13). Recommandation : poser la question au juriste avec les textes légaux (DS-07). Raison : aucune durée n'existe.
11. **Chiffrement.** Recommandation : aucune promesse avant l'ADR d'IC-23. Raison : D-G06.
12. **Démonstration.** Recommandation : peupler iCom sur le site de démonstration (IM-05), contenu marqué fictif. Raison : aujourd'hui la destination « Messages » y est vide.

## 8. Risques et points d'attention

- **La parité suit le moteur.** `packages/social-features` et les modules `messaging`, `groups`, `calls`, `contextualMessaging` sont à S1 : S2 monte, nomme, teste, mais ne corrige pas. Un défaut d'iCom vu dans DIASPORALE est une issue [S1].
- **Deux présentations.** ANTSIA sert les vues d'iCom ; DIASPORALE la carte à quatre briques. Un lot S1 peut n'arriver que dans la première.
- **Politique oubliée le jour de l'ouverture** : toutes les entrées « Écrire » des demandes, mentorats et candidatures resteraient fermées. À inscrire dans DS-06.
- **Comptes de démonstration partagés** : ce qu'un visiteur écrit est lu par le suivant (ADR-0038).
- **Voix de page** : un abus se signale au guichet, qui seul voit l'auteur réel ; l'équipe d'une page ne tranche jamais un dossier de ses propres fils.
- **Membre suspendu** : iCom se ferme, historique compris ; seul l'export reste.
- **Coût des appels** : aucun volume mesuré ; à suivre avec la grille de coûts (docs/31).
- **Droit** : conservation des messages, export en voix de page, heure locale, messages éphémères : questions pour le juriste, rien n'est dit « conforme ».

## 9. Prompts d'implémentation

### Prompt DS-04 (volet CC-V)
```text
Session S2. Écris en français. Opus seulement. Lis CLAUDE.md, docs/etudes/2026-11-10-finalisation/04_ICOM_MESSAGES_APPELS_MISE_EN_RELATION.md (§ 2 lignes 61 à 77, lot DS-04), docs/32 § 7, 11 et 12, ../ANTSIA/docs/contrats/CONVERSATION-CONTEXTUELLE-V1.md, docs/recette/deux-comptes-2026-10-19.
Vérifie d'abord que la politique est toujours fermée. Sur le backend local seulement, et après mon accord : ouvre les trois natures par contextualMessaging/operator.setPolicy et crée une équipe de modération France par la console locale.
Joue à deux comptes fictifs les critères du lot, nature par nature. Corrige dans le dépôt DIASPORALE ou dans convex/modules/diaspora/ ; tout défaut ailleurs devient une issue [S1].
Livre un rapport daté dans docs/recette/, fait ou non fait par ligne. bun run --cwd ../ANTSIA verify avec le verrou. Arrête-toi avant toute action sur la démonstration en ligne.
```

### Prompt IM-02
```text
Session S2. Lis CLAUDE.md, ce plan (lot IM-02, décision du 9/11 sur les appels), ../ANTSIA/convex/modules/calls/preferences.ts, apps/diasporale_com/src/screens/settings-screen.tsx. Vérifie d'abord si IC-04 a livré une surface de réglages dans @antsia/social-features : si oui, monte-la sous l'îlot iCom ; sinon écris la rubrique « Messages et appels » sur getMine, update et setDnd.
React Hook Form et Zod, sonner, textes fr et en dans un fragment à part, une phrase qui dit que ces réglages valent aussi dans ANTSIA. Un test par interrupteur prouve son effet serveur. Ne change aucun défaut côté moteur.
Vérifie : verify avec le verrou, recette à deux comptes non reliés (appel silencieux hors relations), 390 et 1280 px, Sable et Gaboma. Arrête-toi avant toute publication.
```

### Prompt IM-04
```text
Session S2. Lis ce plan (ligne 88 du § 2, lot IM-04), packages/diasporale-features/src/data/types.ts, packages/diasporale-features/src/components/notification-bell.tsx, apps/diasporale_com/src/data/engine-views.ts, lib/routes.ts.
Ajoute les genres call_missed, voicemail_left, group_message et group_added : phrase neutre fr et en, icône, lien (journal d'appels, groupe, invitation) composé par la table des routes. Aucun contenu dans l'avis. Un test par genre.
Vérifie : verify avec le verrou ; à deux comptes sur le backend local, un message de groupe et une invitation ne se lisent plus « Nouvelle activité ». Arrête-toi avant toute publication.
```

### Prompt IM-06
```text
Session S2. Demande-moi d'abord la décision 3 du plan 04. Lis ce plan (lot IM-06), ../ANTSIA/docs/contrats/CONVERSATION-CONTEXTUELLE-V1.md § 10.3 à 10.5, ../ANTSIA/convex/modules/diaspora/conversationContexts.ts, serviceRequests.ts (modèle d'objet et d'idempotence), apps/diasporale_com/src/screens/page-screen.tsx.
Écris d'abord le contrat court de l'objet « prise de contact » (états, droits, débit, export, effacement, avis) et ouvre l'issue [S1] pour la nouvelle nature : ne touche ni au registre ni au schéma. Puis livre la tranche, le port, l'adaptateur, la démonstration, la feuille et l'onglet de l'équipe.
Vérifie : verify avec le verrou ; recette à deux comptes (demande, acceptation, voix de page, clôture, refus). Arrête-toi avant toute publication.
```

### Prompt IM-08
```text
Session S2. Lis ce plan (lignes 66 à 68 du § 2, lot IM-08), ../ANTSIA/packages/social-features/src/features/messagerie/use-contextual-messages.tsx, apps/diasporale_com/src/components/contextual-conversations.tsx et service-inbox.tsx.
Monte la liste des mises en relation, sous l'îlot iCom : mes fils dans « Mes demandes », « Mes mentorats » et « Mes candidatures » ; les fils d'une page (pageId) dans l'onglet « Demandes » de « Mon activité ». Aucune nouvelle destination, écrans en pleine largeur.
Tests : signataire retiré, boîte fermée ; fils personnels absents de la boîte d'une page. Vérifie : verify avec le verrou, 390 et 1280 px. Arrête-toi avant toute publication.
```

## 10. Sources lues

- Brief commun du 10/11 ; dossier de reprise du 9/11 ; plan directeur, registre et plan 15 du moteur ; plan 01 du moteur en entier (`A:docs/etudes/2026-11-09-finalisation/01_ICOM_MESSAGERIE_ET_APPELS.md`).
- Moteur : `A:docs/contrats/CONVERSATION-CONTEXTUELLE-V1.md` (§ 1, 2, 5.8, 5.9, 6.6, 7, 8, 14) ; `A:docs/adr/0019-boutique-progressive-et-canal-commercial.md` ; `A:docs/adr/0021-contact-commercial-et-consentement-crm.md` ; `A:docs/adr/0025-conversation-contextuelle.md` ; `A:docs/adr/0036-icom-et-icom-pro.md`.
- DIASPORALE : cahier (§ 5, 8.9, 8.15), docs/14 (G5, G7, § 6.2), docs/17 (§ 2 à 4), `D:docs/32_EXECUTION_VAGUE_H.md` (§ 7, 11, 12), `D:docs/04_PARITE_SURFACES.md` (lignes iCom), `D:docs/34_COMPTES_DE_DEMONSTRATION.md`, `D:docs/01_PLAN_IMPLEMENTATION_PROMPTS_DIASPORALE.md` (prompt PD7), `D:docs/recette/deux-comptes-2026-10-19/README.md`.
- Dossier produit : fiches F08 et F13, § 1.3. Vault : décisions « iCom monté en îlots », « conversations contextuelles ouvertes par l'objet », « mise en relation dans la tranche diaspora ».
- Code DIASPORALE : `D:apps/diasporale_com/src/components/icom.tsx`, `D:apps/diasporale_com/src/lib/icom-state.ts`, `D:apps/diasporale_com/src/lib/messages-route.ts`, `D:apps/diasporale_com/src/lib/engine-routes.ts`, `D:apps/diasporale_com/src/lib/routes.ts`, `D:apps/diasporale_com/src/screens/icom-screens.tsx`, `D:apps/diasporale_com/src/data/engine-conversations.ts`, `D:packages/diasporale-features/src/data/conversations-port.ts`, `D:packages/diasporale-domain/src/conversation-contexts.ts`, la coque, le profil, la fiche de page, les réglages, la cloche et ses textes.
- Code moteur : modules `messaging`, `groups`, `calls`, `contextualMessaging`, `graph`, `people`, `moderation` (tables) ; tranche `diaspora` (`conversationContexts`, `conversationSync`, `demoAccounts`, `associationGroups`) ; `A:packages/api/src/network.tsx` ; surfaces `messagerie`, `iappel` et `shell` de `A:packages/social-features/src/features/messagerie/MessagesRoute.tsx` à la carte iCom ; `A:convex/lib/rateLimit.ts` ; `A:convex/lib/livekit.ts`.
- Non lu : le module `commercialMessaging` au-delà de ses tables, le natif (`A:apps/antsia_mobile`), la console d'ANTSIA au-delà du nom de l'écran de politique.
