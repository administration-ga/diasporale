# Plan 16 — Application mobile et application web installable

> Constaté par lecture du code d'`origin/main` (DIASPORALE `bead76d`, ANTSIA `fd58d73b`), le 10 novembre 2026. Rien n'a été exécuté : ni test, ni recette, ni publication.
> Applications de référence : les applications mobiles de WhatsApp, d'Instagram, d'InterNations et de Nextdoor, et les critères d'une application web installable (Chrome, Safari). Comparaison faite de mémoire, sans revérification en ligne ; un « ? » marque ce qui n'est pas sûr.
> Ce plan détaille, pour le téléphone, le plan 15 du dossier de finalisation d'ANTSIA. Les lots qu'il en reprend gardent leur identifiant (DG-028) ; les lots nouveaux portent le préfixe `MO-`.

Légende des chemins : `D:` = dépôt DIASPORALE, `A:` = dépôt ANTSIA. « Écran » = atteignable depuis l'interface de diasporale.com ; « Moteur » = la fonction existe côté serveur. Dans ce plan, la colonne « Moteur » dit aussi quand la brique existe dans l'application mobile d'ANTSIA (« natif ANTSIA »).

Mots utilisés : **application web installable** = le site, ajouté à l'écran d'accueil du téléphone, qui s'ouvre en plein écran comme une application (souvent appelée PWA) ; **script de fond** = le petit programme du navigateur (service worker) qui reçoit les notifications et sert une page sans réseau ; **natif** = l'application installée depuis une boutique d'applications (Expo, React Native) ; **lien profond** = adresse qui ouvre un écran précis ; **renvoi web** = bouton d'une application native qui ouvre le site dans le navigateur.

## 1. L'intention du propriétaire

- **Le téléphone d'abord.** 375 px de référence, bascule bureau à 960 px ; application Expo au lot D3 ; notifications par Expo, FCM, APNs et le navigateur (cahier § 14, EXT-DG-07).
- **Une application DIASPORALE.** `apps/diasporale_mobile`, Expo : fil, hub pays, évènements, messagerie et appels, stories, notifications ; parité des parcours R1 à R8 avec le site ; sortie du lot : parcours joués sur appareil (cahier § 10.2 et § 16, lot D3).
- **Pas une coque autour du site.** « Ne pas emballer simplement la page web en annonçant une parité téléphonique » ; réutiliser le domaine, l'API et les textes ; un émulateur ne prouve ni sonnerie, ni notification, ni son (plan global, G10).
- **WhatsApp pour modèle des appels.** La version qui revendique « la combinaison TikTok, Instagram, WhatsApp » doit avoir fini G6, G7 et G9, puis G10 pour la qualité d'appel native (plan global § 1.3).
- **Après le pilote web.** DG-028 est P3 ; la décision 8 du plan 15 (application distincte, ou réseau choisi dans l'application ANTSIA) devait se prendre après le pilote.
- **Déjà décidé.** Aucun chiffrement de bout en bout annoncé (D-G06) ; aucun paiement, donc rien d'achetable dans une application (D-G03) ; ville saisie, jamais la position de l'appareil (plan global, G4) ; notifications sans contenu privé ; sortie partout qui purge l'appareil.
- **Refusé.** Annoncer une parité sans preuve (dossier de reprise § 10.3) ; un mode hors ligne complet (cahier § 18) ; un cache du contenu social sur l'appareil (plan 13 du moteur, § 4.4).
- **Réservé au propriétaire.** Comptes des boutiques d'applications, compilations qui consomment du quota, soumissions, clés des notifications, domaine `diasporale.com`.

## 2. Ce qui existe

DIASPORALE n'a aucune application mobile : `D:apps` ne contient que `diasporale_com`. Ce chapitre décrit donc trois choses : comment le site se tient sur un téléphone, ce qui lui manque pour s'installer, et ce que l'application mobile d'ANTSIA rend réutilisable.

| # | Capacité | État | Écran | Moteur | Preuve |
|---|---|---|---|---|---|
| | **Le site sur un téléphone** | | | | |
| 1 | Coque téléphone : en-tête collant, barre basse flottante à cinq destinations, feuille du compte | Présent | oui | — | `D:apps/diasporale_com/src/components/app-shell.tsx` |
| 2 | Zones sûres de l'écran (encoche, barre d'accueil) et hauteur dynamique | Présent | oui | — | `D:apps/diasporale_com/src/app/layout.tsx` (`viewportFit: "cover"`) |
| 3 | Zoom du texte laissé libre | Présent | oui | — | `D:apps/diasporale_com/src/app/layout.tsx` (ni `maximumScale`, ni `userScalable`) |
| 4 | Bascule téléphone ou bureau à 960 px | Présent | oui | — | `A:packages/ui/src/overlay/useIsReseauMobile.ts` |
| 5 | Composeur en feuille, sélecteur de fichiers du téléphone (plusieurs photos, une vidéo) | Présent | oui | oui | `D:packages/diasporale-features/src/components/composer.tsx` |
| 6 | Photo réduite avant l'envoi | Partiel : la réduction ne sert que la démonstration ; en mode moteur la photo part entière | oui | — | `D:packages/diasporale-features/src/data/media.ts` (`downscaleImage`) |
| 7 | Brouillon du composeur gardé sur l'appareil | Présent | oui | — | `D:packages/diasporale-features/src/components/composer.tsx` (`readDraft`, `writeDraft`) |
| 8 | iCom en pages pleines sous 960 px | Présent en mode moteur (fermé en démonstration) | oui | oui | `D:apps/diasporale_com/src/screens/icom-screens.tsx`, `D:apps/diasporale_com/src/lib/icom-state.ts` |
| 9 | Appels audio et vidéo dans le navigateur du téléphone | Présent ; jamais essayé sur un téléphone | oui | oui | `D:apps/diasporale_com/src/components/icom.tsx`, `A:packages/social-features/src/shell/communication-shell.tsx` |
| 10 | Clavier numérique et remplissage automatique du code de connexion | Présent | oui | oui | `D:apps/diasporale_com/src/screens/enter-screens.tsx` (`inputMode="numeric"`, `autoComplete="one-time-code"`) |
| 11 | L'étape « code envoyé » survit à un aller-retour vers la messagerie | Absent : l'étape vit en mémoire de l'écran | non | — | `D:apps/diasporale_com/src/screens/enter-screens.tsx` (`useState`) ; motifs : `sessionStorage`, `localStorage` |
| 12 | Lien reçu sans être connecté : retour à l'écran visé après l'entrée | Absent : la garde envoie à la porte, puis l'entrée mène au fil | non | — | `D:apps/diasporale_com/src/components/gate.tsx` ; motifs : `returnTo`, `callbackURL`, `retour` |
| 13 | Partage par la feuille du système | Partiel : pages oui ; publications par copie du lien seulement | oui | — | `D:apps/diasporale_com/src/components/page-share-button.tsx` (`navigator.share`), `D:packages/diasporale-features/src/components/post-share.tsx` |
| 14 | Lecture vidéo qui respecte l'économie de données et le mouvement réduit du système | Présent (découverte verticale) | oui | — | `D:packages/diasporale-features/src/components/discovery/playback-environment.ts` |
| 15 | Réglage « Économiser les données » dans l'application | Absent ; prévu au moteur (SD-04) | non | non | motifs : `dataSaver`, `économiser les données` |
| 16 | Position de l'appareil | Fermé par choix : ville saisie ; la permission est refusée par l'en-tête du moteur | — | — | `A:packages/api/csp.mjs` (`geolocation=()`) |
| 17 | Caméra et micro permis à l'adresse du site | Présent | oui | — | `A:packages/api/csp.mjs` (`camera=(self), microphone=(self)`) |
| 18 | Contrôle au format téléphone | Partiel : le fil, simulé à 375 × 667 dans Chrome le 18/10 ; aucun appareil | — | — | `D:docs/recette/fils-mobiles-2026-10-18/README.md` |
| | **S'installer sur le téléphone** | | | | |
| 19 | Manifeste d'application (nom, icônes, adresse de départ, plein écran) | Absent | non | — | motifs : `manifest`, `webmanifest` ; `D:apps/diasporale_com` n'a pas de dossier `public` |
| 20 | Icône d'onglet, icône d'application, icône Apple | Absent | non | — | motifs : `favicon`, `icon`, `apple-icon` : aucun fichier ; ANTSIA n'a que `A:apps/antsia_ga/src/app/favicon.ico` |
| 21 | Couleur de la barre du système | Absent | non | — | motifs : `themeColor`, `theme-color` |
| 22 | Ouverture en plein écran depuis l'écran d'accueil | Absent | non | — | motifs : `appleWebApp`, `apple-mobile-web-app` |
| 23 | Invitation à installer | Absent | non | — | motifs : `beforeinstallprompt`, `installer` |
| 24 | Script de fond | Absent ici ; la politique du moteur l'admet (`worker-src 'self' blob:`) | non | — | motifs : `serviceWorker`, `service-worker` ; `A:packages/api/csp.mjs` |
| 25 | Page hors-ligne | Absent | non | — | motifs : `hors-ligne`, `offline` |
| 26 | Message quand le réseau manque | Partiel : erreur `network_unavailable` traduite, avec reprise ; l'état du réseau n'est pas suivi | oui | — | `D:packages/diasporale-features/src/data/errors.ts` ; motifs : `navigator.onLine`, `"offline"` |
| 27 | Pastille de non-lus sur l'icône | Absent | non | — | motif : `setAppBadge` |
| 28 | Cache de lecture du contenu social sur l'appareil | Absent, écarté par règle : risque de servir un contenu retiré | — | — | cahier § 18 ; plan 13 du moteur, § 4.4 |
| | **Notifications sur l'appareil** | | | | |
| 29 | Cloche dans l'application | Présent | oui | oui | `D:packages/diasporale-features/src/components/notification-bell.tsx` |
| 30 | Consentement « notifications », à l'accueil et dans les réglages | Présent | oui | oui | `D:apps/diasporale_com/src/screens/welcome-screen.tsx`, `D:apps/diasporale_com/src/screens/settings-screen.tsx` |
| 31 | Notifications du navigateur | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/notifications/pushSubscriptions.ts` (`subscribe`), `A:convex/modules/notifications/transports.ts` (`sendWeb`) ; écran modèle : `A:apps/antsia_ga/src/components/notification-controls.tsx` |
| 32 | Script de réception des notifications | Absent ici ; modèle dans ANTSIA | non | — | `A:apps/antsia_ga/src/lib/notification-worker.ts`, `A:apps/antsia_ga/src/app/notifications-worker/route.ts` |
| 33 | Déclaration de l'application `diasporale_com` au moteur de notifications | Fermé : variable `NOTIFICATION_APPLICATIONS_JSON` à poser ; le code admet plusieurs applications par réseau | — | oui | `A:convex/modules/notifications/configuration.ts` (`notificationApplication`) |
| 34 | Ouverture ciblée depuis une notification, droits relus | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/notifications/open.ts` ; page modèle : `A:apps/antsia_ga/src/app/(membre)/notifications/ouvrir/page.tsx` |
| 35 | Préférences par catégorie et plafond hebdomadaire | Absent ici ; le moteur l'a (plan 13, DS-14) | non | oui | `A:convex/modules/notifications/preferences.ts` |
| 36 | Titre de la notification à la marque DIASPORALE | Partiel : sur le site, le script posera son propre titre ; en natif, le moteur écrit « ANTSIA » | non | partiel | `A:convex/modules/notifications/transports.ts` (`BRAND_NAME`), `A:packages/social-contracts/src/brand.ts` |
| 37 | Notifications natives (APNs, FCM) vers une application DIASPORALE | Absent : pas d'application ; un seul sujet APNs d'alerte pour tout le moteur | non | partiel | `A:convex/modules/notifications/transports.ts` (`APNS_TOPIC`) |
| | **Appels sur le téléphone** | | | | |
| 38 | Appel entrant quand le site est ouvert | Présent en mode moteur | oui | oui | `D:apps/diasporale_com/src/components/icom.tsx` |
| 39 | Avis d'appel quand le site est fermé | Absent ici ; le moteur sait le pousser au navigateur inscrit (urgence haute, 45 secondes) | non | oui | `A:convex/modules/notifications/push.ts`, `A:convex/modules/notifications/open.ts` |
| 40 | Écran d'appel du système, téléphone verrouillé, appel en arrière-plan | Absent : impossible pour un site ; écrit pour l'application ANTSIA et fermé (`NATIVE_CALLS_ENABLED=false`) | non | natif ANTSIA | `A:apps/antsia_mobile/modules/antsia-call-system`, `A:apps/antsia_mobile/eas.json` |
| | **Caméra, code QR, billet, envoi** | | | | |
| 41 | Billet QR affiché par le participant | Présent | oui | oui | `D:apps/diasporale_com/src/components/association-event-attendance.tsx`, `A:packages/social-features/src/qr.ts` |
| 42 | Billet consultable sans réseau | Absent : émis par le serveur à la demande, valable 15 minutes, gardé dans l'écran seulement | non | — | `D:packages/diasporale-domain/src/event-attendance.ts` (`ASSOCIATION_EVENT_ATTENDANCE_TICKET_TTL_MS`), `A:convex/modules/events/pageEventAttendance.ts` (`issueTicket`) |
| 43 | Lecture du code par la caméra | Partiel : repose sur `BarcodeDetector`, que tous les navigateurs n'ont pas (Safari sur iPhone ?) ; sinon « caméra indisponible » | oui | — | `D:apps/diasporale_com/src/components/association-event-camera.ts` |
| 44 | Saisie du code à la main | Présent, peu praticable : 64 caractères hexadécimaux | oui | oui | `D:packages/diasporale-domain/src/event-attendance.ts` (`parseAssociationEventAttendanceCode`) |
| 45 | Envoi d'un média en arrière-plan, reprise après une coupure | Absent | non | non | motifs : `BackgroundFetch`, `SyncManager`, `resumable` |
| | **Liens et domaine** | | | | |
| 46 | Adresses partageables : pays, ville et filtres dans l'adresse | Présent | oui | — | `D:apps/diasporale_com/src/lib/routes.ts` |
| 47 | Domaine `diasporale.com` | Fermé : déclaré au catalogue, pas encore branché (propriétaire) | — | — | `A:deploy/catalog.json` |
| 48 | Fichiers qui lient le domaine à une application (liens universels) | Absent | non | — | motifs : `.well-known`, `assetlinks`, `apple-app-site-association` |
| | **Application native** | | | | |
| 49 | Application DIASPORALE pour iPhone ou Android | Absent | non | — | `D:apps` |
| 50 | Application ANTSIA : entrée par code et IDN, fil, messages, cloche, pages, démonstration | Absent ici ; ANTSIA l'a (17 routes natives), sans binaire compilé depuis `main` | non | natif ANTSIA | `A:apps/antsia_mobile/src/lib/routes.ts`, `A:docs/recette/integration-ios-2026-11-02/RAPPORT.md` |
| 51 | Choix du réseau dans l'application ANTSIA | Absent : le réseau `antsia` est écrit en dur | non | natif ANTSIA | `A:apps/antsia_mobile/src/app.tsx` (`getBySlug`) |
| 52 | Contrats natifs partagés : cycle de vie, retour IDN, sortie, requêtes | Présent, réutilisables tels quels (418 lignes) | — | natif | `A:packages/social-native/src/lifecycle.ts`, `A:packages/social-native/src/idn.ts`, `A:packages/social-native/src/sign-out.ts` |
| 53 | Socle natif (session, coffre, entrée, garde, composants) dans un paquet partagé | Partiel : écrit, mais logé dans l'application ANTSIA | — | natif ANTSIA | `A:apps/antsia_mobile/src/lib/session-controller.ts` |
| 54 | Règles métier de DIASPORALE utilisables en natif | Présent : TypeScript pur, aucune dépendance (7 224 lignes) | — | — | `D:packages/diasporale-domain/package.json` |
| 55 | Textes fr et en utilisables en natif | Présent : 45 fragments JSON par langue | — | — | `D:packages/diasporale-features/src/i18n/locales/fr` |
| 56 | Port de données et adaptateurs du moteur utilisables en natif | Partiel : le port n'a pas de dépendance au navigateur ; les adaptateurs (25 fichiers, 6 927 lignes) vivent dans l'application web | — | — | `D:packages/diasporale-features/src/data/port.ts`, `D:apps/diasporale_com/src/data/engine-kit.ts` |
| 57 | Écrans natifs des surfaces propres à DIASPORALE (hub, services, évènements, entraide) | Absent | non | — | aucun dossier d'application native dans `D:apps` |
| 58 | Jetons natifs de la charte DIASPORALE | Absent : le générateur ne projette que les sept thèmes d'ANTSIA | non | non | `A:scripts/sync-native-theme-tokens.mjs`, `A:packages/ui/src/themes/antsia-native.ts` |
| 59 | Retour IDN natif pour une seconde application | Absent : une seule adresse de retour native (`NATIVE_AUTH_REDIRECT_URI`) | non | partiel | `A:convex/betterAuth/nativeIdn.ts`, `A:docs/adr/0031-retour-idn-natif-lie-a-pkce.md` |
| 60 | Module d'appel natif partageable | Partiel : écrit, mais logé dans l'application ANTSIA | — | natif ANTSIA | `A:apps/antsia_mobile/modules/antsia-call-system`, `A:apps/antsia_mobile/plugins/with-native-calls.cjs` |
| 61 | Entrée du catalogue des applications pour un mobile DIASPORALE | Absent | — | non | `A:deploy/catalog.json` |
| 62 | Espace de travail prêt pour une application dans le dépôt DIASPORALE | Présent : `../DIASPORALE/apps/*` est déclaré | — | — | `A:package.json` |
| 63 | Profils de compilation et préparation des builds | Absent ici ; modèle dans ANTSIA | — | natif ANTSIA | `A:apps/antsia_mobile/eas.json`, `A:apps/antsia_mobile/scripts/prepare-build.mjs` |
| 64 | Démonstration dans l'application, backend de démonstration isolé | Absent ici ; modèle dans ANTSIA | — | natif ANTSIA | `A:apps/antsia_mobile/src/lib/native-demo.ts` |
| | **Ce que les boutiques d'applications exigent** | | | | |
| 65 | Signaler un contenu | Présent sur le site | oui | oui | `D:apps/diasporale_com/src/components/report-content-sheet.tsx` |
| 66 | Bloquer une personne, liste des blocages | Présent sur le site | oui | oui | `D:apps/diasporale_com/src/screens/relations-screen.tsx` |
| 67 | Supprimer son compte sans quitter l'application | Présent sur le site | oui | oui | `D:apps/diasporale_com/src/components/data-rights-settings.tsx` |
| 68 | Comptes de démonstration pour un vérificateur | Présent : 20 acteurs, sur un déploiement de démonstration déclaré seulement | oui | oui | `A:convex/modules/diaspora/demoAccounts.ts`, `A:docs/adr/0038-comptes-de-demonstration-diasporale.md` |
| 69 | Politique de confidentialité publiée | Partiel : charpente à compléter par le juriste | oui | — | `D:apps/diasporale_com/src/screens/legal-screen.tsx` |
| 70 | Adresse d'assistance ou page d'aide générale | Absent (seule existe l'aide au parrainage) | non | — | motifs : `assistance`, `support`, `contact` dans `D:apps/diasporale_com/src/lib/routes.ts` |
| 71 | Fiches des boutiques, étiquettes de confidentialité, classification d'âge | Absent | non | — | motifs : `App Store`, `Google Play`, `Data safety` dans les documents |

Décompte : **Présent 25 · Partiel 10 · Absent 33 · Fermé 3** (71 capacités).

### Ce que le moteur sait déjà faire et que DIASPORALE ne montre pas

- **Les notifications du navigateur, de bout en bout** : inscription d'un appareil par application et par réseau, envoi, texte neutre, ouverture qui relit les droits. Il manque à DIASPORALE le script de fond, le bouton d'activation et la route d'ouverture ; le moteur n'a rien à écrire, il lui faut ses clés et la déclaration de l'application (lignes 31 à 34).
- **Les avis de DIASPORALE partent déjà par la porte unique** (`notifyPerson` dans `A:convex/modules/diaspora/communityNotifications.ts` et `A:convex/modules/diaspora/serviceNotifications.ts`). Dès qu'un appareil est inscrit, une demande de service ou une place libérée arrive sur le téléphone, sans code nouveau dans la tranche.
- **L'avis d'appel poussé**, avec une porte qui dit si l'appel sonne encore (ligne 39).
- **Les préférences par catégorie et le plafond hebdomadaire** (ligne 35 ; plan 13).
- **Côté natif**, dans l'application ANTSIA : entrée par code, retour IDN par code à usage unique, sortie partout, fil, messages, cloche, démonstration ; module d'appel du système écrit et fermé (lignes 50 à 53, 60, 63, 64).

### Ce qui est écrit mais jamais recetté en réel

| Sujet | Dernier constat | Source |
|---|---|---|
| Le site sur un téléphone physique | Jamais. Le seul contrôle au format téléphone est une simulation dans Chrome, qui dit elle-même ne pas valoir un appareil | `D:docs/recette/fils-mobiles-2026-10-18/README.md` |
| Appels dans le navigateur d'un téléphone | Jamais joués ; aucune clé du serveur vidéo n'est posée | dossier de reprise § 3.6 ; plan 15 § 2 |
| Caméra pour pointer les présences | Jamais essayée, ni sur iPhone ni sur Android (DG-023 jamais joué) | plan 15 § 2 |
| Notifications du navigateur | Aucune recette réelle, même pour ANTSIA ; « envoyé » n'est qu'une admission par le fournisseur | plan 06 du moteur § 2 |
| Application ANTSIA | Aucun binaire compilé depuis `main` ; aucun essai sur iPhone physique | `A:docs/recette/integration-ios-2026-11-02/RAPPORT.md` |
| Entrée par IDN depuis une application installée | Jamais, ni web ni native, pour DIASPORALE | `D:apps/diasporale_com/src/app/entrer/idn/page.tsx` |

## 3. Comparaison avec les applications de référence

| Capacité | WhatsApp | Instagram | InterNations | Nextdoor | DIASPORALE | Verdict |
|---|---|---|---|---|---|---|
| Application dans les boutiques (iPhone, Android) | oui | oui | oui | oui | non | Reporté (DG-028, après le pilote) |
| Site utilisable au téléphone sans rien installer | non (le site accompagne l'application) | oui | oui | oui | oui | Déjà fait ; À recetter sur appareil (MO-01) |
| Site installable sur l'écran d'accueil | bureau seulement ? | oui ? | ? | ? | non | À faire (MO-02) |
| Notifications, application fermée | oui | oui | oui | oui | non | À faire (MO-05, MO-06, DS-14) |
| Ouverture sur l'écran exact depuis la notification | oui | oui | oui | oui | non | À faire (MO-06) |
| Répondre depuis la notification | oui | oui | ? | ? | non | Reporté (MO-16, natif seulement) |
| Pastille de non-lus sur l'icône | oui | oui | oui ? | oui | non | À faire (MO-06) |
| Écran d'appel du système, téléphone verrouillé | oui | oui | sans appels | sans appels | non | Reporté (MO-20, clés et recette physique) |
| Appel qui continue en arrière-plan | oui | oui | — | — | non garanti | Reporté (MO-20) |
| Photo prise et envoyée depuis l'application | oui | oui | oui ? | oui | oui (sélecteur du navigateur) | Déjà fait ; À recetter |
| Photo allégée avant l'envoi | oui | oui | ? | ? | non (mode moteur) | À faire au plan 03 (branche SD-02) |
| Envoi en arrière-plan avec reprise | oui | oui | ? | ? | non | Reporté (DG-028) |
| Réglage d'économie de données | oui | oui | ? | ? | réglage du système seulement | À faire au plan 03 (branche SD-04) |
| Version allégée pour téléphones modestes | non ? | oui (Lite, Android) | non ? | non ? | le site lui-même | À adapter : mesurer le poids (plan 02, DS-08) |
| Lecture hors ligne, file d'envoi | oui | partiel | ? | ? | non | Écarté pour le contenu (règle du moteur) ; page hors-ligne À faire (MO-05) |
| Lien reçu qui ouvre l'application | oui | oui | oui ? | oui | lien perdu à la connexion | À faire (MO-03), puis MO-21 |
| Partager vers l'application depuis une autre | oui | oui | ? | oui ? | non | Reporté (DG-028) |
| Lecteur de code QR intégré | oui | oui ? | ? | non ? | partiel | À adapter (MO-08) |
| Verrou par empreinte ou visage | oui | non ? | ? | ? | non | Reporté (DG-028) |
| Bloquer, signaler, supprimer son compte dans l'application | oui | oui | oui | oui | oui sur le site | Déjà fait ; à porter en natif (MO-19) |
| Entrée sans mot de passe | oui (numéro et code) | non | non ? | code ou lien ? | oui (code, IDN) | Déjà fait ; À adapter (MO-04) |
| Mode sombre du système, texte agrandi | oui | oui | ? | oui | oui | Déjà fait ; À recetter (MO-01) |
| Version minimale exigée | oui | ? | ? | ? | sans objet sur le web | Reporté (DG-028) |
| Plusieurs comptes sur un téléphone | oui ? | oui | non ? | non ? | non | Écarté (une personne, un identifiant) |
| Position de l'appareil | partage à la demande | lieux | ? | adresse à l'inscription | non | Écarté (ville saisie, plan global G4) |
| Application de bureau | oui | non | non | non | non | Écarté (cahier § 8.15) |

### Les trois voies, comparées

**L'indice d'effort** est la somme des tailles des lots de ce plan, avec la convention S = 1, M = 3, L = 8. Ce n'est ni une durée ni un devis : il sert à comparer les voies entre elles.

| | (a) Application Expo distincte, dans le dépôt DIASPORALE | (b) Réseau choisi dans l'application ANTSIA | (c) Application web installable d'abord |
|---|---|---|---|
| Marque | Nom, icône et charte DIASPORALE sur le téléphone et en boutique | Nom et icône ANTSIA ; DIASPORALE devient un espace à l'intérieur | Nom et icône DIASPORALE sur l'écran d'accueil ; aucune présence en boutique |
| Boutiques d'applications | Deux fiches de plus, deux vérifications ; risque d'être jugée doublon de l'application ANTSIA ( ? ) | Aucune fiche de plus ; la fiche ANTSIA doit décrire le réseau fermé | Aucune (Android : possible plus tard par l'application web vérifiée, décision 7) |
| Notifications | APNs et FCM propres ; le moteur doit porter le sujet APNs et le titre par application (MO-12) | Celles de l'application ANTSIA (MB-08) ; titre « ANTSIA » | Celles du navigateur ; sur iPhone, seulement après ajout à l'écran d'accueil ; titre posé par le site |
| Appels | Écran d'appel du système, après clés et recette (MO-20) | Ceux de l'application ANTSIA (MB-17) : un seul écran d'appel pour les deux réseaux | Le site ouvert sonne ; site fermé, au mieux une notification ; jamais l'écran d'appel du système |
| Contexte séparé | Net : deux applications | Fragile : deux réseaux dans une application, erreur de destination possible à la publication | Net : deux sites |
| Qui écrit | S2 | S3 écrit les écrans de DIASPORALE dans le dépôt ANTSIA | S2 |
| Changements du moteur | Quatre : retour IDN, sujet APNs, titre des notifications, catalogue (MO-12) | Un : jetons de la charte | Aucun (configuration seulement) |
| Lots comptés | MO-10 à MO-21 | MO-10, MO-11, jetons de MO-13 (S), MO-14 (M : le socle existe), MO-15 (M : le fil existe), MO-16 (S : les messages existent), MO-17, MO-18, MO-19 (S), MO-21 | MO-02, MO-05, MO-06, MO-09 |
| Indice d'effort | **57** | **25** | **6** |
| À attendre d'ailleurs | MB-02, MB-03, MB-06, MB-08, MB-17 du plan 14 ; comptes des boutiques ; clés | Les mêmes lots du plan 14 | CN-10 (clés du navigateur), DS-14 (plan 13), domaine |

S'y ajoutent cinq lots **communs aux trois voies** (indice 7) : MO-01, MO-03, MO-04, MO-07, MO-08. Ils améliorent le site au téléphone et servent tel quel une application native.

## 4. Ce qui manque

### 4.1 Bloquant avant l'ouverture du pilote

1. **Personne n'a jamais ouvert DIASPORALE sur un vrai téléphone.** Le pilote se jouera d'abord au téléphone. Une passe sur un iPhone et un téléphone Android, avec les comptes de démonstration, précède l'ouverture (MO-01).

Ce plan ne pose aucun autre bloquant : le site est déjà pensé pour le téléphone (lignes 1 à 5, 8, 10).

### 4.2 Fonctions attendues qui manquent

| Besoin | Avec l'application web installable | Limite | Lot |
|---|---|---|---|
| Icône sur l'écran d'accueil, plein écran | Oui, Android et iPhone | Sur iPhone, l'installation passe par le menu de partage de Safari : il faut l'expliquer | MO-02, MO-09 |
| Notifications, site fermé | Oui sur Android ; sur iPhone, seulement une fois le site ajouté à l'écran d'accueil | Texte neutre ; « envoyé » n'est pas « reçu » | MO-05, MO-06, DS-14 |
| Pastille de non-lus | Oui ( ? selon le système) | Un nombre, jamais un texte | MO-06 |
| Démarrer sans réseau | Page hors-ligne traduite | Aucun contenu social en réserve, par règle | MO-05 |
| Billet à la porte de la salle | Visible sans réseau pendant sa durée de vie | Il faut du réseau pour l'émettre ; 15 minutes aujourd'hui | MO-07, décision 4 |
| Pointer les présences | Caméra du navigateur, avec un décodeur de secours | À constater sur iPhone | MO-08 |
| Lien reçu qui mène au bon écran | Oui, une fois la destination conservée | S'ouvre dans le navigateur, pas toujours dans l'application installée ( ? sur iPhone) | MO-03 |
| Appel entrant, téléphone verrouillé | Non : au mieux une notification « appel » | C'est la limite qui justifie le natif | MO-20 |
| Appel qui continue en arrière-plan | Non garanti : le système peut suspendre la page | — | MO-20 |
| Envoi d'une vidéo en arrière-plan | Non | — | DG-028 |
| Présence dans les boutiques | Non | — | DG-028, décision 7 |

### 4.3 Options qui manquent sur ce qui existe

- **Porte d'entrée** : reprendre la saisie du code après être allé le lire (MO-04) ; arriver sur l'écran du lien reçu après s'être connecté (MO-03).
- **Billet** : le garder affichable après un rechargement ou une coupure (MO-07).
- **Pointage** : lire le code avec n'importe quel téléphone (MO-08).
- **Partage** : la feuille du système pour les publications et les évènements, comme pour les pages (ligne 13 ; à traiter au plan 03).
- **Données** : un réglage « Économiser les données » visible, au lieu du seul réglage du système (ligne 15 ; plan 03, SD-04).
- **Réglages** : une entrée « Installer l'application » et son explication pour iPhone (MO-09).
- **Notifications** : le titre « DIASPORALE », pas celui du moteur (MO-05).

### 4.4 Améliorations de l'existant

- **Alléger la photo avant l'envoi.** Aujourd'hui la photo d'un téléphone part entière en mode moteur (ligne 6) : c'est le premier coût en données d'un membre. Le plan 03 branche le lot SD-02 du moteur ; ce plan en vérifie l'effet sur appareil (MO-01).
- **Mesurer le poids et le premier affichage sur un téléphone modeste.** Rien n'a été mesuré (plan 02, DS-08 ; méthode du lot EX-09 du moteur).
- **Dire l'état du réseau avant l'échec.** Aujourd'hui le membre apprend la coupure par une erreur (ligne 26) ; le script de fond permet de le dire tout de suite (MO-05).
- **Raccourcir ce qui se saisit à la main.** Un code de 64 caractères ne se tape pas (ligne 44) ; à voir au plan 08.

### 4.5 Ce qui distingue DIASPORALE

- **Entrer sans mot de passe, avec une identité vérifiée.** Le code se remplit seul sur le téléphone (ligne 10) ; l'IDN reste la voie principale.
- **Aucune position demandée.** Une permission de moins à justifier auprès des membres et des boutiques (ligne 16).
- **Rien de privé sur l'écran verrouillé.** Les notifications sont neutres par règle du moteur.
- **Un billet sans donnée personnelle**, que seul un responsable confirme (lignes 41 et 44).
- **Vingt comptes de démonstration par acteur.** Un vérificateur de boutique peut entrer sans compte réel (ligne 68).
- **Un site déjà fait pour le téléphone.** L'application installable coûte peu parce que la coque existe.

### 4.6 Écarté ou reporté, et pourquoi

| Sujet | Décision | Raison |
|---|---|---|
| Coque autour du site présentée comme une application | Écarté | Plan global G10 ; les boutiques la refusent souvent ( ? ) |
| Cache du fil et des messages sur l'appareil | Écarté | Risque de servir un contenu retiré ou une session close (plan 13 du moteur, § 4.4) |
| Achat ou abonnement dans l'application | Écarté | Aucun paiement (D-G03) ; le citoyen ne paie jamais |
| Plusieurs comptes sur un téléphone | Écarté | Une personne, un identifiant |
| Position de l'appareil, carnet de contacts | Écarté | Ville saisie (G4) ; aucun import de contacts sans avis du juriste |
| Chiffrement de bout en bout annoncé | Reporté | D-G06 ; ne rien écrire de tel dans une fiche de boutique |
| Application native | Reporté | Après le pilote web et après les preuves de l'application ANTSIA (décision 1) |
| Appels natifs | Reporté | Clés, recette physique, et d'abord la recette des appels du site (plans 01 du moteur et 04) |
| Application de bureau | Écarté | Cahier § 8.15 |

## 5. Lots d'implémentation

Session S2, sauf mention. Toute dépendance nouvelle passe par le catalogue des versions du moteur : **issue [S1]**. Toute compilation native, toute soumission, toute publication de la démonstration : **accord écrit du propriétaire**.

### MO-01 — Passe sur téléphones réels · P0 · S · S2 + propriétaire
- **Pour l'utilisateur** : le site tient sur son vrai téléphone, pas seulement dans une fenêtre étroite d'ordinateur.
- **Backend** : aucun.
- **Web** : aucune fonction nouvelle. Liste d'essais sur un iPhone (Safari) et un téléphone Android (Chrome), contre la démonstration en ligne, parce que la caméra, le micro et le script de fond exigent une adresse sécurisée. Parcours : porte, code rempli seul, accueil, fil, composeur avec une photo prise sur place, hub, recherche d'un service, demande, message iCom, inscription à un évènement, billet, pointage par un second téléphone, sortie partout ; puis mode avion, rotation, grand texte, clavier. Chaque défaut devient un correctif ou un lot nommé.
- **Mobile** : la liste devient la première version de la matrice de parité du natif.
- **Données personnelles** : comptes de démonstration seulement ; aucune capture de contenu réel.
- **Tests et cliquets** : un test par défaut corrigé.
- **Critères d'acceptation** : rapport `docs/recette/telephones-<date>/RAPPORT.md` ; chaque ligne porte l'appareil, le système, le navigateur, la version servie et le constat ; un appel n'est dit « entendu » que s'il l'a été ; ce qui n'a pas pu s'essayer (appels sans clés) est écrit tel quel.
- **Dépend de** : DS-01 ; une démonstration à jour (plan 17).
- **Porte** : présence du propriétaire avec ses téléphones ; accord pour toute publication de la démonstration.

### MO-02 — Icônes, manifeste et installation · P1 · S · S2
- **Pour l'utilisateur** : DIASPORALE a son icône dans l'onglet et sur l'écran d'accueil, et s'ouvre en plein écran.
- **Backend** : aucun.
- **Web** : `app/manifest.ts` (nom, nom court, adresse de départ sur le fil, plein écran), icônes d'onglet et d'application (192, 512, masquable, Apple), couleur de la barre du système dans `viewport`, réglage Apple dans les métadonnées. Couleurs lues dans les jetons de la charte ; adresses tirées de la table des routes ; textes fr et en.
- **Mobile** : la même icône servira l'application native.
- **Données personnelles** : aucune.
- **Tests et cliquets** : test du manifeste ; cliquets des adresses et des couleurs en dur.
- **Critères d'acceptation** : Chrome sur Android propose l'installation ; Safari sur iPhone ajoute le site à l'écran d'accueil avec la bonne icône ; l'application installée ouvre le fil, ou la porte sans session ; l'entrée par code et par IDN aboutit dans l'application installée.
- **Dépend de** : MO-03 ; plan 02 (charte).
- **Porte** : icône validée par le propriétaire (décision 3).

### MO-03 — Destination conservée à travers l'entrée · P1 · S · S2
- **Pour l'utilisateur** : un lien reçu (évènement, page, offre) mène à cet écran, même s'il faut d'abord se connecter.
- **Backend** : aucun.
- **Web** : la garde retient le chemin demandé ; l'entrée (code, IDN) et l'accueil y ramènent. Le chemin est validé contre la table des routes : interne seulement, jamais une adresse complète, jamais un jeton ; une valeur inconnue mène au fil. Un compte en attente arrive sur la cible si elle lui est lisible, sinon sur son hub.
- **Mobile** : même règle pour les liens ouverts par une application (MO-21).
- **Données personnelles** : le chemin ne porte que des identifiants déjà publics ; rien n'est gardé après l'arrivée.
- **Tests et cliquets** : tests de la garde (anonyme, sans adhésion, membre) ; refus d'une adresse externe ; cliquet des adresses en dur.
- **Critères d'acceptation** : lien d'un évènement ouvert sans session, entrée, puis l'évènement ; lien malformé, puis le fil ; aucune redirection vers l'extérieur.
- **Dépend de** : plan 01 (porte et accueil).
- **Porte** : aucune.

### MO-04 — Reprise de la saisie du code après un aller-retour · P1 · S · S2
- **Pour l'utilisateur** : aller lire le code dans sa messagerie puis revenir retrouve l'écran de saisie, sans redemander un code.
- **Backend** : aucun.
- **Web** : l'étape « code envoyé » et la destination masquée vont dans le stockage de session de l'onglet, avec une échéance alignée sur la validité du code. Jamais le code lui-même. Purge à la réussite, à l'échéance et au changement de destination.
- **Mobile** : même besoin en natif (le socle d'ANTSIA garde l'intention en mémoire seulement).
- **Données personnelles** : l'adresse saisie reste sur l'appareil, masquée à l'écran, effacée à l'échéance.
- **Tests et cliquets** : rechargement, échéance, purge.
- **Critères d'acceptation** : sur iPhone, application installée fermée par le système puis rouverte : la saisie reprend ; après l'échéance, la porte repart du début.
- **Dépend de** : plan 01.
- **Porte** : aucune.

### MO-05 — Script de fond unique et page hors-ligne · P1 · M · S2
- **Pour l'utilisateur** : sans réseau, un message clair dans sa langue au lieu de la page d'erreur du navigateur ; l'application installée démarre toujours.
- **Backend** : aucun.
- **Web** : un seul script de fond pour tout le site, servi par une route de l'application sur le modèle d'ANTSIA (textes et adresses injectés depuis l'i18n et la table des routes ; titre « DIASPORALE »). Il met en réserve la page hors-ligne, rien d'autre : aucune réponse du moteur, aucun contenu social, aucune image de membre. Il porte déjà les deux écouteurs de notification du modèle, pour que DS-14 n'ait qu'à activer l'inscription. Numéro de version, mise à jour sans rechargement forcé, retrait propre si le script doit disparaître. La coque suit l'état du réseau et le dit.
- **Mobile** : sans objet.
- **Données personnelles** : aucune donnée de session ni contenu en réserve ; la sortie partout vide les réserves du script.
- **Tests et cliquets** : seule la page hors-ligne est mise en réserve ; une charge utile de notification qui porte un champ en trop est refusée ; cliquets de la sortie partout, du contenu des notifications et des adresses en dur.
- **Critères d'acceptation** : mode avion, page hors-ligne en fr et en en ; retour du réseau, reprise ; inspection des réserves : aucune réponse du moteur.
- **Dépend de** : MO-02 ; se coordonne avec DS-14 (plan 13) : un site n'a qu'un script de fond.
- **Porte** : aucune.

### MO-06 — Notifications sur l'écran d'accueil : pastille, aide iPhone, ouverture · P1 · S · S2
- **Pour l'utilisateur** : la pastille de l'icône dit qu'il y a du nouveau ; toucher une notification ouvre l'application installée sur le bon écran ; sur iPhone, l'écran explique qu'il faut d'abord ajouter DIASPORALE à l'écran d'accueil.
- **Backend** : aucun ; lecture de la porte d'ouverture du moteur, qui relit les droits.
- **Web** : route d'ouverture d'une notification (référence opaque, cible relue, repli neutre) si DS-14 ne l'a pas déjà posée ; pastille nourrie par le compteur de non-lus de la cloche ; aide contextuelle sur iPhone.
- **Mobile** : la même porte d'ouverture servira le natif.
- **Données personnelles** : un nombre, jamais un texte ; aucune destination privée dans la notification.
- **Tests et cliquets** : référence inconnue ou d'autrui, repli neutre ; pastille remise à zéro à la lecture.
- **Critères d'acceptation** : notification reçue site fermé, sur Android (Chrome) et sur iPhone (application installée) ; ouverture sur le bon écran ; « envoyé » n'est jamais présenté comme « reçu ».
- **Dépend de** : MO-05, DS-14 (plan 13), CN-10 (moteur).
- **Porte** : clés du navigateur et déclaration de l'application `diasporale_com` (propriétaire).

### MO-07 — Billet QR gardé pendant sa durée de vie · P1 · S · S2
- **Pour l'utilisateur** : son billet reste affichable s'il recharge la page ou perd le réseau devant la salle.
- **Backend** : aucun dans ce lot ; la durée du billet relève de la décision 4 et du plan 08.
- **Web** : le billet émis (code opaque et échéance) est gardé dans le stockage de session jusqu'à son échéance ; l'image se dessine sur l'appareil, sans réseau ; purge à l'échéance, au pointage et à la sortie ; l'écran dit l'heure d'échéance et propose de renouveler quand le réseau revient.
- **Mobile** : le natif gardera le billet dans son coffre.
- **Données personnelles** : le code ne contient aucune donnée personnelle ; il ne quitte pas l'onglet.
- **Tests et cliquets** : rechargement avant et après l'échéance ; purge à la sortie.
- **Critères d'acceptation** : billet émis, mode avion, rechargement : billet visible jusqu'à l'échéance, puis retiré.
- **Dépend de** : plan 08 (évènements).
- **Porte** : aucune.

### MO-08 — Lecture du code QR sur tous les téléphones · P1 · M · S2
- **Pour l'utilisateur** : un responsable pointe les présences avec n'importe quel téléphone, iPhone compris.
- **Backend** : aucun.
- **Web** : quand le navigateur n'a pas de détecteur de codes, un décodeur de secours lit l'image de la caméra, sur l'appareil, sans rien envoyer. Les règles du fichier restent : seul le format DIASPORALE est accepté, aucun cliché gardé, caméra coupée quand la page se cache. Le décodeur est une dépendance nouvelle : issue [S1].
- **Mobile** : le natif utilisera la caméra du système.
- **Données personnelles** : aucune image gardée ni envoyée.
- **Tests et cliquets** : détecteur absent, secours ; code étranger refusé ; caméra refusée, message.
- **Critères d'acceptation** : pointage réussi sur iPhone (Safari) et sur Android (Chrome), constaté sur appareil.
- **Dépend de** : MO-01 (constat) ; issue [S1] (dépendance).
- **Porte** : aucune.

### MO-09 — Invitation à installer, au bon moment · P2 · S · S2
- **Pour l'utilisateur** : après un geste utile (inscription à un évènement, premier message), une proposition discrète d'ajouter DIASPORALE à l'écran d'accueil ; jamais au chargement, jamais deux fois après un refus.
- **Backend** : aucun.
- **Web** : bouton d'installation sur Android ; feuille d'explication sur iPhone ; entrée « Installer l'application » dans les réglages.
- **Mobile** : sans objet.
- **Données personnelles** : le refus est retenu sur l'appareil seulement.
- **Tests et cliquets** : aucune invitation au montage ; refus mémorisé.
- **Critères d'acceptation** : aucune invitation sur une adresse qui n'est pas le domaine définitif.
- **Dépend de** : MO-02, MO-05.
- **Porte** : domaine `diasporale.com` branché (décision 2).

### MO-10 — Décision d'architecture mobile, écrite · P2 · S · S2 + propriétaire
- **Pour l'utilisateur** : rien de visible ; le projet sait quelle application il construira, et quand.
- **Backend** : aucun.
- **Web** : aucun.
- **Mobile** : document de décision, à partir des mesures du pilote (part des visites au téléphone, iPhone ou Android, installations, notifications activées, appels manqués) et de ce que l'application ANTSIA a prouvé depuis. Les trois voies, l'indice recalculé, les changements du moteur, les conditions.
- **Données personnelles** : agrégats du pilote seulement.
- **Tests et cliquets** : sans objet.
- **Critères d'acceptation** : décision datée ; ce qui n'est pas mesuré est dit ; aucun code natif avant elle.
- **Dépend de** : DG-029 (pilote) ; plan 14 du moteur.
- **Porte** : décision du propriétaire (décision 1).

### MO-11 — Adaptateurs du moteur partagés entre le site et le natif · P2 · L · S2
- **Pour l'utilisateur** : rien de visible ; le natif lira les mêmes vues et les mêmes codes d'erreur que le site.
- **Backend** : aucun.
- **Web** : sortir les 25 adaptateurs de l'application web vers un paquet du dépôt, avec un client d'authentification injecté ; le site garde le même comportement et les mêmes tests.
- **Mobile** : le paquet ne dépend ni du navigateur ni de Next.
- **Données personnelles** : aucune nouvelle.
- **Tests et cliquets** : tests portés sans changement ; un test refuse tout import du navigateur dans le paquet.
- **Critères d'acceptation** : `verify` vert ; aucune différence visible sur le site.
- **Dépend de** : MO-10.
- **Porte** : aucune.

### MO-12 — Le moteur accepte une seconde application native · P3 · M · S1
- **Pour l'utilisateur** : dans une application DIASPORALE, l'entrée par IDN aboutit et les notifications portent le bon nom.
- **Contenu** (issue [S1]) : plusieurs adresses de retour natives pour l'IDN, une par application (une seule aujourd'hui) ; sujet APNs d'alerte par application (une seule variable aujourd'hui) ; titre des notifications natives lu dans la marque du réseau (« ANTSIA » en dur aujourd'hui) ; entrée `diasporale_mobile` au catalogue.
- **Dépend de** : MO-10 ; MB-08 (plan 14).
- **Porte** : variables et clés du propriétaire.

### MO-13 — Socle natif partagé et jetons de la charte · P3 · M · S3 + S1
- **Pour l'utilisateur** : rien de visible ; l'application DIASPORALE n'aura pas son propre code de session, de coffre et d'appel.
- **Contenu** : sortir de l'application ANTSIA, vers un paquet partagé, la session, le coffre, l'entrée, la garde, les composants de base et le module d'appel (ou les copier avec leur en-tête de provenance, selon les dix règles) ; étendre le générateur de jetons natifs aux deux feuilles de la charte DIASPORALE.
- **Dépend de** : MB-02, MB-07 (le socle doit d'abord être éprouvé).
- **Porte** : aucune.

### DG-028 — Application mobile DIASPORALE · P3 · L · S2 ou S3 · repris du plan 15
- **Pour l'utilisateur** : DIASPORALE sur téléphone, avec ses notifications, puis ses appels.
- **Contenu** : selon la décision 1. Lots MO-14 à MO-21, dans cet ordre de portage : porte, fil, hub, messages, évènements et billet, services. Les cinq destinations du site, aucune de plus. Matrice de parité tenue par le code : chacune des 54 pages du site y est dite native, en renvoi web ou absente. Sortie partout et caches purgés. Critère de sortie du cahier : R1 à R8 joués sur un iPhone et un téléphone Android réels.
- **Dépend de** : plan 14 (MB-02, MB-03, MB-06, MB-08), DG-029, MO-10 à MO-13.
- **Porte** : comptes des boutiques d'applications ; accords de compilation et de soumission.

### MO-14 — Natif 1 : socle, porte et accueil · P3 · L · S2 ou S3
- **Pour l'utilisateur** : installer DIASPORALE, entrer par code ou par IDN, choisir son pays, consentir, arriver sur son hub.
- **Contenu** : squelette Expo dans le dépôt DIASPORALE (ou choix du réseau dans l'application ANTSIA, voie b) ; session, coffre, sortie partout ; accueil par `joinDiasporale` ; statut dérivé et bannières ; thème par les jetons ; matrice de parité et son test.
- **Dépend de** : MO-12, MO-13.
- **Porte** : accord de compilation ; disque libre.

### MO-15 — Natif 2 : fil et hub du pays · P3 · L · S2 ou S3
- **Pour l'utilisateur** : lire son pays et toute la diaspora, réagir, commenter, publier avec une photo, ouvrir son hub.
- **Contenu** : fil par portée, publication, commentaires, composeur avec photo allégée, cloche ; hub (compteurs, évènements, pages) ; signaler et masquer.
- **Dépend de** : MO-14 ; MB-09 du plan 14 pour la photo.
- **Porte** : aucune.

### MO-16 — Natif 3 : messages et notifications poussées · P3 · L · S2 ou S3
- **Pour l'utilisateur** : écrire, recevoir une notification application fermée, répondre depuis elle.
- **Contenu** : iCom personnel et groupes, conversations de mise en relation ; inscription de l'appareil liée à la session ; ouverture ciblée ; pastille.
- **Dépend de** : MO-12 ; MB-08, MB-11 du plan 14 ; plan 04.
- **Porte** : clés APNs et compte Firebase du propriétaire.

### MO-17 — Natif 4 : évènements, billet et lecteur de code · P3 · M · S2 ou S3
- **Pour l'utilisateur** : s'inscrire, garder son billet, pointer les présences avec la caméra du téléphone.
- **Contenu** : évènement d'association, inscription, attente, agenda ; billet dans le coffre ; lecteur de code natif.
- **Dépend de** : MO-15 ; plan 08.
- **Porte** : aucune.

### MO-18 — Natif 5 : services et demandes · P3 · M · S2 ou S3
- **Pour l'utilisateur** : chercher un service, envoyer une demande, suivre la proposition et le rendez-vous.
- **Contenu** : catalogue, fiche, demande, proposition, rendez-vous, « Mon activité » en lecture ; le reste en renvoi web, compté dans la matrice.
- **Dépend de** : MO-16 ; plan 09.
- **Porte** : aucune.

### MO-19 — Exigences des boutiques et dossier de publication · P3 · M · S2 + propriétaire
- **Pour l'utilisateur** : une fiche honnête ; bloquer, signaler et supprimer son compte sans quitter l'application.
- **Contenu** : les trois gestes en natif ; adresse d'assistance visible ; inventaire des données tiré du code, étiquettes de confidentialité, classification d'âge ; comptes de démonstration et notes pour les vérificateurs ; aucune promesse non prouvée (appels, chiffrement).
- **Dépend de** : MO-14 à MO-18 ; DS-07 (textes légaux) ; plan 14 du moteur (MB-04, MB-05, pour le modèle).
- **Porte** : comptes des boutiques, entité éditrice, juriste (âge).

### MO-20 — Appels natifs · P3 · L · S3 + S1
- **Pour l'utilisateur** : un appel DIASPORALE sonne comme un appel téléphonique, téléphone verrouillé.
- **Contenu** : module d'appel partagé (MO-13) configuré pour DIASPORALE ; recette sur deux iPhone et deux téléphones Android ; aucune annonce avant.
- **Dépend de** : MB-17 (plan 14), IC-01 (plan 01 du moteur), plan 04, MO-16.
- **Porte** : clés du serveur vidéo, APNs, FCM ; recette physique.

### MO-21 — Liens universels et domaine · P3 · S · S2
- **Pour l'utilisateur** : un lien DIASPORALE reçu par message ouvre l'application.
- **Contenu** : fichiers d'association servis par le site sur le domaine définitif ; liens déclarés dans l'application ; même validation du chemin que MO-03.
- **Dépend de** : MO-03, MO-14.
- **Porte** : domaine `diasporale.com` branché (propriétaire).

## 6. Ordre recommandé et dépendances

| Vague | Lots | Pourquoi dans cet ordre |
|---|---|---|
| 1 | MO-01, MO-03, MO-04 | Voir le site sur de vrais téléphones ; réparer l'entrée par lien et par code, utile à toutes les voies |
| 2 | MO-02, MO-05, MO-07, MO-08 | L'application installable, le hors-ligne minimal, le billet et le pointage |
| 3 | MO-06, MO-09 | Notifications et invitation, quand les clés et le domaine sont là |
| 4 | MO-10 | Décider du natif avec les mesures du pilote |
| 5 | MO-11, MO-12, MO-13 | Préparer le terrain du natif, sans écran |
| 6 | DG-028 : MO-14 à MO-19, MO-21 | L'application, tranche par tranche, puis les boutiques |
| 7 | MO-20 | Les appels natifs en dernier, après clés et recette physique |

**Ce que ce plan attend des autres plans.** Plan 01 : porte et accueil (MO-03, MO-04). Plan 02 : icône et charte (MO-02), poids et accessibilité (DS-08). Plan 03 : photo allégée, économie de données, partage par la feuille du système. Plan 04 : recette des appels du site, avant tout appel natif. Plan 08 : durée du billet, code plus court. Plan 13 : activation des notifications et préférences (DS-14). Plan 17 : démonstration à jour, domaine, production. Moteur : CN-10, SD-02, SD-04, et tout le plan 14.

**Ce que les autres plans attendent de celui-ci.** Chaque plan dit en une ligne par lot ce que le mobile devra porter ; ces lignes nourrissent la matrice de parité (DG-028) et l'ordre des tranches MO-14 à MO-18.

**Volet de recette en mode moteur (campagne DS-05).** C'est le lot MO-01, joué sur la démonstration en ligne.
- Comptes de démonstration (docs/34 de DIASPORALE) : `verifie`, `declare`, `leger`, `association`, `entreprise`.
- Étapes : `leger` entre par code sur iPhone et reste en lecture ; `verifie` publie une photo prise sur place depuis Android ; `declare` cherche un service et envoie une demande, `entreprise` y répond depuis l'autre téléphone ; `association` crée un évènement, `declare` s'inscrit et affiche son billet, `association` le pointe à la caméra ; les deux échangent un message ; chacun sort partout.
- Résultat attendu : chaque étape aboutit sur les deux téléphones, ou le rapport dit laquelle échoue et sur quel appareil. Mode avion : erreur lisible aujourd'hui, page hors-ligne après MO-05. Les appels ne s'essaient qu'avec les clés.

## 7. Décisions à prendre par le propriétaire

1. **Quelle voie pour le téléphone** (décision 8 du plan 15). Recommandation : **la voie (c) tout de suite, puis la voie (a), jamais avant trois preuves.** (c) coûte neuf fois moins que (a), sert les 54 pages du site sans attendre, et rien n'en est perdu ensuite. Les trois preuves : le pilote a ses mesures au téléphone ; l'application ANTSIA a un binaire compilé depuis `main`, essayé sur iPhone et Android réels, avec une notification reçue (MB-02, MB-03, MB-06, MB-08) ; le domaine, les textes légaux et les comptes des boutiques existent. Entre (a) et (b) : (a) garde la marque, le réseau fermé bien séparé, et laisse S2 maître de ses écrans, comme le cahier le prévoit (§ 10.2). (b) coûte moitié moins et donne un seul écran d'appel pour DIASPORALE et pour la famille restée au pays ; mais le nom DIASPORALE disparaît du téléphone et deux réseaux dans une application fragilisent « ce qui se publie dans DIASPORALE y reste ». C'est un choix de marque : le vôtre.
2. **Quand inviter à installer.** Recommandation : seulement sur `diasporale.com`. Une application web installée est liée à son adresse ; installée depuis l'adresse de démonstration, elle serait à réinstaller.
3. **L'icône de l'application.** Aucune n'existe. Recommandation : vous la fournissez ou la validez avant MO-02 ; rien n'est dessiné sans vous.
4. **La durée du billet QR** (15 minutes). Recommandation : la porter à toute la fenêtre d'accueil, pour l'émettre avant d'entrer dans une salle sans réseau ; le pointage reste unique et confirmé par un responsable. À trancher avec le plan 08 ; le fichier appartient à S1.
5. **Un décodeur de secours pour le pointage.** Recommandation : oui ; c'est la seule façon de pointer avec un iPhone sans application native.
6. **Avancer les notifications du navigateur.** DS-14 est P2 au plan 15. Recommandation : passer son volet « notifications du navigateur » en P1 ; sans lui, un prestataire n'apprend une demande qu'en ouvrant le site, et le pilote mesure justement les délais de réponse.
7. **Présence sur Google Play par l'application web vérifiée**, sans code natif. Recommandation : pas avant le pilote ; à reconsidérer si les membres Android la demandent ; ne jamais la présenter comme une application native.
8. **Si le natif se fait, qui l'écrit.** Recommandation : S2 pour les écrans de DIASPORALE, dans son dépôt ; S3 pour le socle partagé et les appels.
9. **Si le natif se fait, mêmes choix que le plan 14.** Jeton direct APNs et FCM ; rien d'achetable dans l'application ; âge déclaré aux boutiques après l'avis du juriste, DIASPORALE restant réservé aux majeurs tant que D-G11 tient.
10. **Appels natifs.** Recommandation : seulement après la recette réelle des appels du site et l'ouverture des appels de l'application ANTSIA (MB-17).

## 8. Risques et points d'attention

- **iPhone** : notifications du navigateur seulement après ajout à l'écran d'accueil ; stockage séparé de Safari, donc une nouvelle connexion dans l'application installée ; détecteur de codes peut-être absent ( ? ). Tout cela se constate sur appareil (MO-01).
- **Dépendance à la politique d'Apple** : Apple a déjà envisagé de retirer les applications web de l'écran d'accueil dans l'Union européenne, puis y a renoncé ( ? ). La moitié de la cible vit en France : à surveiller.
- **Une application web installée est liée à son adresse.** Changer de domaine force la réinstallation et perd les inscriptions aux notifications.
- **Un script de fond mal écrit sert du contenu périmé ou privé.** Réserve limitée à la page hors-ligne, version, retrait propre, purge à la sortie.
- **Un seul script de fond par site.** MO-05 et DS-14 doivent écrire le même fichier, pas deux.
- **Le natif hérite des risques d'ANTSIA** : aucun binaire compilé depuis `main`, appels fermés, notifications natives absentes, aucun essai sur appareil.
- **Deux applications du même éditeur sur le même moteur** peuvent être jugées doublons par une boutique ( ? ). Les règles des boutiques sont citées de mémoire : à relire au moment du lot.
- **Renvois web sans session** : la personne se reconnecte sur le site ; une application qui renvoie beaucoup au web peut être jugée trop pauvre.
- **Un second train de publication** : compilations, quotas, vérifications, sur un seul poste de 16 Go et une seule personne.
- **Ne rien promettre** : ni parité, ni appels, ni chiffrement de bout en bout, tant que la preuve manque.

## 9. Prompts d'implémentation

### Prompt MO-01
```text
Session S2 (DIASPORALE). Écris en français. Opus seulement.
Lis docs/etudes/2026-11-10-finalisation/16_APPLICATION_MOBILE_PWA.md (§ 2, lot MO-01, § 6 « volet de recette »), docs/34 (comptes de démonstration) et docs/recette/fils-mobiles-2026-10-18/README.md.
Aucun code avant le constat. Prépare la liste d'essais pour un iPhone (Safari) et un téléphone Android (Chrome), contre la démonstration en ligne : porte, code, accueil, fil, composeur avec photo, hub, service, demande, message, évènement, billet, pointage, sortie ; puis mode avion, rotation, grand texte. Vérifie d'abord, en lecture seule, quelle version la démonstration sert.
Je tiens les téléphones : guide-moi pas à pas, note ce que je constate, n'écris jamais « réussi » sans mon constat. Les appels ne s'essaient que si les clés existent ; sinon écris « non essayé ».
Livre docs/recette/telephones-<date>/RAPPORT.md (appareil, système, navigateur, version servie, constat par ligne), sans capture de contenu réel. Chaque défaut : un correctif avec son test, ou un lot nommé. Arrête-toi avant toute publication.
```

### Prompt MO-02 et MO-05
```text
Session S2. Lis le plan 16 (lots MO-02 et MO-05), apps/diasporale_com/src/app/layout.tsx et src/lib/routes.ts ; puis, dans ANTSIA, apps/antsia_ga/src/lib/notification-worker.ts, apps/antsia_ga/src/app/notifications-worker/route.ts (le modèle) et packages/api/csp.mjs.
Vérifie que l'état du § 2 est toujours vrai : aucun manifeste, aucune icône, aucun script de fond.
Branche claude/application-installable. Périmètre : apps/diasporale_com et les textes de packages/diasporale-features.
MO-02 : app/manifest.ts, icônes (192, 512, masquable, Apple), couleur de la barre du système, réglage Apple ; couleurs lues dans les jetons ; adresses tirées de la table des routes ; textes fr et en. L'icône est celle que j'ai validée : demande-la-moi si elle manque, n'en dessine pas.
MO-05 : une route qui sert LE script de fond du site. Page hors-ligne en réserve, rien d'autre. Écouteurs push et notificationclick du modèle, charge utile fermée, titre DIASPORALE. Version, retrait propre ; la sortie partout vide ses réserves.
Tests : manifeste ; script (aucune réponse du moteur en réserve, charge utile avec un champ en trop refusée). bun run --cwd ../ANTSIA verify avec le verrou. Recette à 390 px, puis sur la démonstration. N'ajoute aucune invitation à installer : MO-09 attend le domaine. Arrête-toi avant toute publication.
```

### Prompt MO-03 et MO-04
```text
Session S2. Lis le plan 16 (lots MO-03 et MO-04), apps/diasporale_com/src/components/gate.tsx, src/screens/enter-screens.tsx, src/screens/welcome-screen.tsx, src/lib/routes.ts, et le plan 01 du même dossier.
Branche claude/entree-par-lien. Périmètre : apps/diasporale_com.
MO-03 : la garde retient le chemin demandé ; l'entrée par code, par IDN et l'accueil y ramènent. Valide le chemin contre la table des routes : interne seulement, jamais d'adresse complète ni de jeton ; valeur inconnue, le fil. Écris le test qui refuse une adresse externe.
MO-04 : l'étape « code envoyé » et la destination masquée vont dans le stockage de session, avec une échéance ; jamais le code ; purge à la réussite, à l'échéance, au changement de destination.
Tests des deux, verify, puis recette avec deux comptes de démonstration : lien d'évènement ouvert sans session, entrée, évènement ; rechargement pendant la saisie du code. Arrête-toi avant toute publication.
```

### Prompt MO-07 et MO-08
```text
Session S2. Lis le plan 16 (lots MO-07 et MO-08), apps/diasporale_com/src/components/association-event-camera.ts, association-event-attendance.tsx, packages/diasporale-domain/src/event-attendance.ts, et le plan 08 du même dossier.
D'abord le constat du lot MO-01 : sur quel téléphone la caméra répond-elle « indisponible » ? S'il manque, demande-le-moi.
MO-08 : quand le détecteur de codes du navigateur manque, un décodeur de secours lit l'image de la caméra sur l'appareil. C'est une dépendance nouvelle : dépose une issue [S1] dans administration-ga/antsia pour le catalogue des versions et attends-la ; ne touche ni au package.json racine ni à bun.lock. Garde les règles du fichier : aucun cliché gardé, caméra coupée quand la page se cache, seul le format DIASPORALE accepté.
MO-07 : le billet émis reste dans le stockage de session jusqu'à son échéance ; purge à l'échéance, au pointage, à la sortie. Ne change pas la durée du billet : elle appartient au moteur (convex/modules/events, session S1) et à ma décision 4.
Tests, verify, puis un pointage réel entre deux téléphones. Arrête-toi avant toute publication.
```

### Prompt MO-10
```text
Session S2. Lis le plan 16 en entier ; le plan 14 du moteur (../ANTSIA/docs/etudes/2026-11-09-finalisation/14_APPLICATION_MOBILE.md, § 2) et EXECUTION.md pour l'état des lots MB-02, MB-03, MB-06, MB-08, MB-17 ; le rapport du pilote et le tableau /pilote.
N'écris aucun code. Relève les faits : part des visites au téléphone, iPhone ou Android, installations de l'application web, notifications activées, appels manqués faute de sonnerie, demandes des membres. Dis ce qui n'est pas mesuré.
Écris la décision dans docs/ du dépôt DIASPORALE : les trois voies, l'indice d'effort recalculé, les quatre changements du moteur, ce que l'application ANTSIA a prouvé depuis, ma décision et ses conditions. Si elle demande les changements du lot MO-12, prépare l'issue [S1] sans la déposer. Termine par les questions qui me restent. Arrête-toi là.
```

## 10. Sources lues

- Plans du moteur : `A:docs/etudes/2026-11-09-finalisation/14_APPLICATION_MOBILE.md` en entier ; `A:docs/etudes/2026-11-09-finalisation/13_CONSOLE_EXPLOITATION_LANCEMENT.md` (EX-09, EX-11, § 2 et § 4.4) ; `A:docs/etudes/2026-11-09-finalisation/06_COMPTE_IDENTITE_PARAMETRES_NOTIFICATIONS.md` (CN-10, lignes des notifications) ; `A:docs/etudes/2026-11-09-finalisation/15_DIASPORALE.md` ; plan directeur et registre des lots.
- Documents : cahier de DIASPORALE (§ 10.2, § 14, § 16, § 18), plan global (G4, G10, § 1.3), registre des décisions (docs/17), docs/34 ; `A:docs/adr/0031-retour-idn-natif-lie-a-pkce.md`, `A:docs/adr/0038-comptes-de-demonstration-diasporale.md` ; `A:docs/recette/integration-ios-2026-11-02/RAPPORT.md` ; `D:docs/recette/fils-mobiles-2026-10-18/README.md` ; `A:apps/antsia_mobile/README.md` ; dossier de reprise (§ 2, § 3.4, § 3.6, § 8.5, § 10.3, § 13).
- Code de DIASPORALE : `D:apps/diasporale_com/next.config.ts`, `D:apps/diasporale_com/package.json`, `D:apps/diasporale_com/src/app/layout.tsx`, coque, garde, porte, iCom, billet et caméra, partage, réglages ; `D:packages/diasporale-features/src/data` ; `D:packages/diasporale-domain/src` ; `D:apps/diasporale_com/src/data`.
- Code d'ANTSIA : `A:apps/antsia_mobile` (configuration, profils de compilation, routes, application, démonstration, modules et greffons) ; `A:packages/social-native` ; `A:convex/modules/notifications` ; `A:convex/betterAuth/nativeIdn.ts` ; `A:convex/modules/events/pageEventAttendance.ts` ; `A:packages/api/csp.mjs`, `A:packages/api/next-config.mjs` ; `A:deploy/catalog.json`, `A:package.json` ; `A:scripts/sync-native-theme-tokens.mjs` ; `A:tests/ratchets/no-cross-product-imports.test.ts` ; site d'ANTSIA pour le modèle des notifications.
- Non lu : le dossier produit d'origine (fiches F01 à F17) ne traite pas du mobile au-delà de ce que reprend le cahier ; les comparaisons avec les applications de référence et les règles des boutiques viennent de la mémoire.
