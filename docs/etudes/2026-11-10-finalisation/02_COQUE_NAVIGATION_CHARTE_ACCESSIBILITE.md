# Plan 02 — Coque, navigation, charte et accessibilité

> Constaté par lecture du code d'`origin/main` (DIASPORALE `bead76d`, ANTSIA `fd58d73b`), le 10 novembre 2026. Rien n'a été exécuté : ni test, ni recette, ni publication.
> Applications de référence : Instagram, WhatsApp, LinkedIn, InterNations, Nextdoor, Facebook. Comparaison faite de mémoire, sans revérification en ligne ; un « ? » marque ce qui n'est pas sûr.
> Ce plan détaille, pour la coque, la navigation, la charte, les textes et l'accessibilité, le plan 15 du dossier de finalisation d'ANTSIA. Les lots qu'il en reprend gardent leur identifiant (DS-02, DS-03, DS-08) ; les lots nouveaux portent le préfixe `UX-`.

Légende des chemins : `D:` = dépôt DIASPORALE, `A:` = dépôt ANTSIA. « Écran » = atteignable depuis l'interface de diasporale.com ; « Moteur » = la fonction existe côté serveur (« — » quand aucune fonction serveur n'est en jeu).

## 1. L'intention du propriétaire

- **Pour qui** : des Gabonais de l'étranger, « majoritairement sur téléphone », entre deux pays, souvent sur un réseau lent (charte, § 1 ; cahier, EXT-DG-02 et EXT-DG-07).
- **Quoi** : l'aisance des grandes applications sans les copier : défilement de TikTok, présentation d'Instagram, messagerie de WhatsApp (plan global docs/14, en-tête ; plan directeur d'ANTSIA, § 1, n° 9).
- **Deux choses lisibles partout** : où l'on est (le pays, contexte permanent) et qui parle (Officiel, Vérifié, Agent public, Communauté) (cahier, § 5, invariants 7 et 8 ; charte, § 1).
- **Cinq destinations** : Fil, Explorer, Services, Communautés, Messages ; profil et réglages sous l'avatar ; « Publier » toujours au même endroit ; aucune destination de plus sans décision (DG-005 ; plan global, G1).
- **Charte v4**, adoptée le 2/11 : deux thèmes au choix du membre (Sable par défaut, Gaboma), clair ou sombre, une couleur par famille d'actions, un seul bouton plein par zone ; six boutons tranchés le 9/11 (charte docs/03 ; plan 15, décision 1).
- **Français et anglais**, par les fichiers de textes seulement ; « la traduction doit être fonctionnelle » (cahier, EXT-DG-06 ; docs/33).
- **Accessible et léger** : niveau AA, cibles de 44 px, focus visible ; fil et hub en moins de 1,5 s au premier affichage en 3G (cahier, EXT-DG-05 et EXT-DG-02).
- **Ne rien inventer** : aucun chiffre en vitrine qui ne soit mesuré, aucune promesse d'audit, d'hébergement ou de chiffrement (docs/33, § 1 ; dossier de reprise, § 7).
- **Refusé** : drapeau et armoiries, hors du thème Gaboma choisi par le membre ; bouton flottant « Publier » ; bandeau à plat pour un avis ; choix clair ou sombre au pied de page (charte, § 12 et § 13 ; docs/33, § 2).
- **Prudence** : avant de changer la pose d'une page, confirmer que c'est bien demandé (dossier de reprise, § 7).

## 2. Ce qui existe

| # | Capacité | État | Écran | Moteur | Preuve |
|---|---|---|---|---|---|
| 1 | Rail du bureau : pays, cinq destinations, « Mon espace », Publier, carte du compte | Présent | oui | — | `D:apps/diasporale_com/src/components/app-shell.tsx` (`DesktopRail`) |
| 2 | Barre basse flottante à cinq destinations au téléphone | Présent | oui | — | même fichier (`MobileTabBar`) |
| 3 | Quatre destinations, sans trou, quand iCom n'est pas servi | Présent | oui | — | même fichier (`primaryEntries`) |
| 4 | En-tête collant du téléphone : mot-symbole, Publier, cloche, compte | Présent | oui | — | même fichier (`MobileHeader`) |
| 5 | Menu du compte : menu au bureau, feuille au téléphone, au clavier | Présent | oui | — | même fichier (`AccountMenu`, `AccountSheet`) ; `D:apps/diasporale_com/src/components/app-shell.test.tsx` |
| 6 | Destination courante marquée et annoncée | Partiel : aucune destination n'est marquée sur l'entraide, le kit d'arrivée, le mentorat, l'emploi, les talents, l'agenda, l'annuaire des pages, une page, un profil | oui | — | même fichier (`primaryEntries`, `withinAny`) |
| 7 | Entrées réservées aux responsables (Modération, Pilote) | Présent | oui | oui | même fichier (`responsibleEntries`) |
| 8 | Publier : action stable, expliquée quand elle est fermée | Présent | oui | — | même fichier (`PublishAction`) |
| 9 | Pays de résidence visible dans la coque | Partiel : au rail oui ; dans l'en-tête du téléphone seulement à partir de 440 px de large | oui | — | même fichier (`HomeCountryLink`, classe `hidden min-[440px]:flex`) |
| 10 | Zone consultée annoncée sur le hub d'un autre pays | Présent | oui | — | même fichier (`ZoneNotice`) |
| 11 | Compteur de la cloche, plafonné à « 99+ » | Présent | oui | oui | `D:packages/diasporale-features/src/components/notification-bell.tsx` |
| 12 | Pastille de non-lus sur « Messages » | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/messaging/inbox.ts` (`totalUnread`), `A:convex/modules/groups/threads.ts` (`totalUnread`) ; motifs dans la coque : `unread`, `totalUnread` |
| 13 | Recherche à portée depuis la coque | Absent (la recherche elle-même est au plan 03) | non | — | motifs dans la coque : `SearchIcon`, `routes.search`, `recherche` |
| 14 | Retour au téléphone | Partiel : un lien de texte par écran, vers la racine de la rubrique, filtres perdus ; rien dans l'en-tête ; profil, album et réglages sans retour | oui | — | `D:apps/diasporale_com/src/screens/services-screens.tsx` ; motifs : `router.back`, `history.back` |
| 15 | Se déconnecter depuis le menu du compte | Absent : la sortie n'est que dans les réglages | non | oui | `D:apps/diasporale_com/src/components/sign-out-settings.tsx` ; motifs dans la coque : `signOut` |
| 16 | « Mon agenda » dans l'espace personnel | Absent : on n'y vient que par Communautés | non | oui | `D:apps/diasporale_com/src/components/community-shortcuts.tsx` ; `routes.agenda()` absent de la coque |
| 17 | Rail droit dès 1 280 px : iCom partout, suggestions sur le fil | Présent | oui | — | `D:apps/diasporale_com/src/screens/feed-screen.tsx` |
| 18 | Zone sûre des téléphones à encoche | Présent | oui | — | `D:apps/diasporale_com/src/app/layout.tsx` (`viewportFit`) |
| 19 | Barre basse masquée pendant la saisie au clavier du téléphone | Absent ici ; antsia.ga l'a | non | — | `A:apps/antsia_ga/src/components/mobile-navigation-viewport.tsx` ; motifs : `visualViewport` |
| 20 | Pose des écrans : une colonne de 792 px au plus | Présent ; la règle « pleine largeur » d'ANTSIA ne s'applique pas ici | oui | — | `A:tests/ratchets/member-screens-full-width.test.ts` ne lit qu'`apps/antsia_ga` |
| 21 | Porte unique (`/` et `/entrer`) et vision sous la porte | Présent | oui | — | `D:apps/diasporale_com/src/components/entry-door.tsx`, `D:apps/diasporale_com/src/components/door-vision.tsx` |
| 22 | Pays ouverts sur la vitrine, rien plutôt qu'un zéro | Présent | oui | oui | `D:apps/diasporale_com/src/components/open-countries.tsx` |
| 23 | Mot-symbole liquide, repli en texte | Présent | oui | — | `D:apps/diasporale_com/src/components/liquid-wordmark.tsx` |
| 24 | Titre et description du site, titre par page | Présent : 52 pages sur 54 ont leur titre | oui | — | `D:apps/diasporale_com/src/app/layout.tsx` (`generateMetadata`) |
| 25 | Aperçu de lien : image, titre de partage, adresse de base | Absent | non | — | motifs : `openGraph`, `twitter`, `metadataBase`, `opengraph-image` |
| 26 | Icône du site | Absent : aucun dossier `public`, aucun fichier d'icône | non | — | motifs : `favicon`, `icon.`, `apple-icon` ; antsia.ga a la sienne : `A:apps/antsia_ga/src/app/favicon.ico` |
| 27 | Indexation par les moteurs de recherche | Fermé : tout le site est en `noindex, nofollow`, vitrine comprise ; une décision au lancement l'ouvre | — | — | `D:apps/diasporale_com/src/app/layout.tsx` (ligne `robots`) ; motifs : `robots.ts`, `sitemap.ts` |
| 28 | Pied de page public : mentions, confidentialité, charte, langue | Présent | oui | — | `D:apps/diasporale_com/src/components/site-chrome.tsx` (`SiteFooter`) |
| 29 | Textes légaux atteignables depuis l'espace membre | Absent : les liens n'existent que dans le pied des pages publiques | non | — | même fichier ; `routes.legalNotice()` et `routes.privacy()` absents de la coque et des réglages |
| 30 | Page `/charte` vivante, contrastes mesurés à l'écran | Présent | oui | — | `D:apps/diasporale_com/src/screens/charte-screen.tsx` |
| 31 | Page introuvable | Présent | oui | — | `D:apps/diasporale_com/src/app/not-found.tsx` |
| 32 | Page d'erreur de l'application | Absent | non | — | motifs : `error.tsx`, `global-error.tsx`, `ErrorBoundary` |
| 33 | Squelettes de chargement | Présent : 88 emplois ; aucun fichier `loading.tsx` | oui | — | `D:apps/diasporale_com/src/components/gate.tsx` (`GateSkeleton`) |
| 34 | États vides qui disent quoi faire | Présent : 85 emplois | oui | — | `D:packages/diasporale-features/src/components/empty-state.tsx` |
| 35 | Erreur de chargement dite, avec reprise | Partiel : écrite écran par écran (25 branches), sans forme commune ; cinq reprises par rechargement complet de la page | oui | — | `D:apps/diasporale_com/src/screens/explore-screen.tsx` ; motif : `window.location.reload` |
| 36 | Refus d'accès dit tel quel, sans « Réessayer » | Partiel : fil, murs et Découverte ; ailleurs six ensembles locaux ; jamais rejoué en mode moteur | oui | oui | `D:packages/diasporale-features/src/data/errors.ts` (`ACCESS_REFUSAL_CODES`), `D:apps/diasporale_com/src/components/feed-pages.tsx` |
| 37 | Avis passagers annoncés ; cartes flottantes écartables, choix mémorisé | Présent | oui | — | `D:apps/diasporale_com/src/components/toast-region.tsx`, `D:apps/diasporale_com/src/components/floating-cards.tsx` |
| 38 | Repère permanent « Démo » | Présent | oui | — | `D:apps/diasporale_com/src/components/site-chrome.tsx` (`AppDemoChip`) |
| 39 | Perte de connexion dite à l'écran | Absent | non | — | motifs : `navigator.onLine`, `useConvexConnectionState`, `offline` |
| 40 | Nouvelle version publiée pendant la visite | Absent ; une erreur de chargement de fichier a été vue le 18/10 | non | — | motifs : `ChunkLoad`, `BUILD_SHA` ; `D:docs/recette/fils-chrome-2026-10-18/README.md` |
| 41 | Page hors-ligne | Absent (plan 16) | non | — | motifs : `serviceWorker`, `manifest` |
| 42 | Charte v4 par jetons, deux thèmes (Sable, Gaboma) | Présent | oui | — | `A:packages/ui/src/themes/diasporale.css`, `A:packages/ui/src/themes/diasporale-gaboma.css` |
| 43 | Mode clair, sombre ou celui du système | Présent : porte, réglages, page `/charte` ; plus au pied de page | oui | — | `D:apps/diasporale_com/src/components/preferences.tsx` (`ThemeSwitch`) |
| 44 | Thème et mode posés avant le premier affichage | Présent | oui | — | `D:apps/diasporale_com/src/components/appearance-boot-script.tsx` |
| 45 | Thème enregistré sur le compte, commun avec antsia.ga | Présent | oui | oui | `D:apps/diasporale_com/src/components/account-theme.tsx` |
| 46 | Sélecteur de thème avec aperçu | Présent, dans les réglages seulement | oui | — | `D:apps/diasporale_com/src/components/theme-picker.tsx` |
| 47 | Une couleur par famille d'actions | Partiel : 29 boutons faits ; six décidés le 9/11, non appliqués | oui | — | `D:packages/diasporale-features/src/primitives/button.tsx`, `D:docs/recette/couleurs-par-famille-2026-11-03/RAPPORT.md` |
| 48 | Un seul bouton plein par zone | Partiel : deux tests de zone, aucun contrôle général | oui | — | `D:apps/diasporale_com/src/screens/profile-screens.test.tsx`, `D:apps/diasporale_com/src/screens/page-screen.test.tsx` |
| 49 | Cliquets de la charte : contrastes (deux thèmes, deux modes), couleurs en dur, ordre des couches | Présent | — | — | `D:packages/diasporale-features/src/styles/engine-theme-contrast.test.ts`, `D:apps/diasporale_com/src/ratchets/no-hardcoded-colors.test.ts`, `D:packages/diasporale-features/src/styles/layers.test.ts` |
| 50 | Écrans vus avec les couleurs par famille | Partiel : évènement, groupe, « Accepter », conversations de contexte jamais vus | oui | — | rapport du 3/11, « Non vus à l'écran » |
| 51 | Thème Gaboma vu à l'écran dans DIASPORALE | Partiel : jamais capturé | oui | — | `D:docs/recette/charte-v4-2026-11-02/RAPPORT.md` (« Non vérifié ») |
| 52 | Français et anglais à parité (4 077 clés par langue, 45 fragments), aucun texte en dur | Présent | oui | — | `D:packages/diasporale-features/src/i18n/locales.test.ts`, `D:apps/diasporale_com/src/ratchets/no-hardcoded-strings.test.ts` |
| 53 | Langue : bascule immédiate, enregistrée sur le compte, navigateur à la première visite | Présent | oui | oui | `D:apps/diasporale_com/src/components/account-locale.tsx`, `D:apps/diasporale_com/src/i18n/accept-language.ts` |
| 54 | Noms de pays, dates et nombres dans la langue | Présent | oui | — | `D:packages/diasporale-features/src/lib/countries.ts`, `D:packages/diasporale-features/src/lib/format.ts` |
| 55 | Apostrophes d'une seule sorte | Partiel : 752 droites et 299 typographiques ; la cloche mêle les deux | oui | — | `D:packages/diasporale-features/src/i18n/locales/fr/diasporale.json`, `D:packages/diasporale-features/src/i18n/locales/fr/community-notifications.json` |
| 56 | Élision devant un nom (« de Entraide… », « que Alice ») | Absent : 26 gabarits dans 11 fragments | non | — | `D:packages/diasporale-features/src/i18n/locales/fr/page-publications.json` ; motifs : `elision`, `élision` |
| 57 | Texte qui ne suppose pas le genre de la personne | Partiel : « vous en êtes l'administrateur », « Exclu le… », « Parrainé le… » | oui | — | `D:packages/diasporale-features/src/i18n/locales/fr/page-admin.json`, `D:packages/diasporale-features/src/i18n/locales/fr/associations.json` |
| 58 | Communication publique tenue par un cliquet | Absent ici : celui d'ANTSIA ne lit pas DIASPORALE ; tenue à la main | — | — | `A:tests/ratchets/public-communication.test.ts` ; `D:docs/33_VISION_PORTE_ET_LANGUE.md` (§ 1) |
| 59 | Contenu de démonstration dans les deux langues | Partiel : français seulement, limite assumée | oui | — | `D:docs/33_VISION_PORTE_ET_LANGUE.md` (§ 5) |
| 60 | Lien d'évitement « Aller au contenu » | Présent | oui | — | `D:apps/diasporale_com/src/app/layout.tsx` |
| 61 | Anneau de focus de la charte sur tout élément | Présent | oui | — | `D:packages/diasporale-features/src/styles/tailwind-theme.css` |
| 62 | Cibles de 44 px | Présent ; restent quelques cibles de 32 à 36 px (liens des cartes flottantes, petits boutons en ligne), à revoir au lot DS-08 | oui | — | `D:packages/diasporale-features/src/primitives/button.tsx` |
| 63 | Mouvement réduit respecté | Présent : feuilles de style et mot-symbole | oui | — | `D:packages/diasporale-features/src/styles/tailwind-theme.css` |
| 64 | Contrôle à l'écriture : règles `jsx-a11y` en avertissement, autofocus en erreur | Présent | — | — | `D:apps/diasporale_com/eslint.config.mjs` |
| 65 | Champs reliés à leur aide et à leur erreur ; feuilles et menus avec piège de focus | Présent | oui | — | `D:packages/diasporale-features/src/primitives/field.tsx`, `D:packages/diasporale-features/src/primitives/sheet.tsx` |
| 66 | Taille du texte réglable | Absent ; le moteur ne l'a pas non plus (CN-15) | non | non | motifs : `textSize`, `fontScale`, `taille du texte` |
| 67 | Raccourcis clavier | Absent, hors visionneuse et Découverte | non | — | motifs : `shortcut`, `hotkey`, `aria-keyshortcuts` |
| 68 | Audit AA par route (clavier, lecteur d'écran, zoom, 320 px) | Absent : jamais fait | — | — | aucun rapport sous docs/recette ; motifs : `VoiceOver`, `NVDA`, `TalkBack` |
| 69 | Outil d'audit automatique | Absent des deux dépôts | — | — | motifs dans les `package.json` : `axe`, `lighthouse`, `playwright` |
| 70 | Page ou déclaration d'accessibilité | Absent | non | — | motifs dans les routes : `accessibilite`, `accessibility` |
| 71 | Premier affichage en 3G mesuré (cible de 1,5 s) | Absent : jamais mesuré | — | — | aucun relevé dans les documents ; motifs : `3G`, `Lighthouse`, `LCP` |
| 72 | Chargement à la demande des parties lourdes | Absent : aucun import différé ; iCom et les appels sont importés par la coque | non | — | `D:apps/diasporale_com/src/components/icom.tsx` ; motifs : `next/dynamic`, `React.lazy` |
| 73 | Polices hébergées avec le site | Présent | oui | — | `A:packages/ui/src/styles.css` |
| 74 | Images du fil dimensionnées, chargées à la demande | Présent ; les variantes d'image par taille d'écran relèvent de la chaîne des médias (plan 03) | oui | — | `D:packages/diasporale-features/src/components/post-media.tsx` |
| 75 | Aide, questions fréquentes | Absent | non | — | motifs : `/aide`, `faq`, `help` |
| 76 | Joindre l'assistance, signaler un problème technique | Absent | non | — | motifs : `support`, `assistance`, `contact` |
| 77 | Retour à la page demandée après la connexion | Absent : la garde renvoie à la porte sans retenir l'adresse | non | — | `D:apps/diasporale_com/src/components/gate.tsx` (`router.replace(routes.enter())`) ; motifs : `returnTo`, `retour=` |
| 78 | Repères du premier jour | Partiel : une carte de bienvenue sur le hub, rien ensuite | oui | — | `D:apps/diasporale_com/src/screens/hub-screen.tsx` (`bienvenue`) |
| 79 | État du service | Absent ; le moteur ne l'a pas non plus (EX-05) | non | non | motifs : `page d'état`, `status` |

Décompte : **Présent 40 · Partiel 13 · Absent 25 · Fermé 1**.

### Ce que le moteur sait déjà faire et que DIASPORALE ne montre pas

- **Non-lus de la messagerie** : deux lectures d'un seul document chacune, déjà employées par la coque du moteur dans `A:packages/social-features/src/shell/reseau-menu-destinations-ui.tsx`. La barre de DIASPORALE ne les lit pas.
- **Thème au rail** : `A:packages/social-features/src/shell/appearance/AppearanceControl.tsx` propose le thème dès que l'application lui donne le nom de ses thèmes (ADR-0030). DIASPORALE ne le donne pas.
- **Barre masquée pendant la saisie** : code de l'application antsia.ga, à dupliquer avec son en-tête de provenance (ligne 19).
- **Limite d'erreur des listes** : `A:packages/social-features/src/shell/ReseauPaginatedErrorBoundary.tsx`. DIASPORALE n'a aucune limite d'erreur.
- **Adresse de base des métadonnées** : antsia.ga la pose dans son gabarit racine ; DIASPORALE non.

### Ce qui est écrit mais jamais recetté en réel

| Sujet | État | Source |
|---|---|---|
| Six familles de couleurs sur évènement, groupe, formulaires d'adhésion et de candidature, « Accepter », présence, conversations | Jamais vues à l'écran | rapport du 3/11 |
| Thème Gaboma dans DIASPORALE ; mode sombre hors profil, page et offre | Jamais capturés | rapports du 2/11 et du 3/11 |
| Vrai téléphone | Jamais | rapport du 2/11 |
| 320 px, zoom à 200 %, clavier seul, lecteur d'écran | Jamais ; les recettes vont de 375 à 395 px, sur le fil et quelques écrans | recettes du 18/10, du 19/10, du 2/11, du 3/11 |
| Premier affichage en 3G | Jamais mesuré | — |
| Refus d'accès du fil et sortie depuis l'accueil, en mode moteur | Vus en démonstration seulement | dossier de reprise, § 10.2 |
| Anglais relu écran par écran | Non consigné | — |

## 3. Comparaison avec les applications de référence

| Capacité | Instagram | WhatsApp | LinkedIn | InterNations | Nextdoor | Facebook | DIASPORALE | Verdict |
|---|---|---|---|---|---|---|---|---|
| Barre basse de quatre à cinq destinations | oui | oui | oui | oui ? | oui | oui | oui | Déjà fait |
| Destination d'origine marquée en profondeur | oui | oui | oui | ? | oui ? | oui | en partie | À faire (UX-05) |
| Pastille de non-lus sur la messagerie | oui | oui | oui | oui ? | oui ? | oui | non | À faire (UX-06) |
| Compteur de notifications | oui | par discussion | oui | oui ? | oui | oui | oui | Déjà fait |
| Recherche toujours à portée | oui | oui | oui | oui ? | oui | oui | non | À faire (UX-15, après le plan 03) |
| Publier en un geste, au même endroit | oui | oui | oui | ? | oui | oui | oui | Déjà fait |
| Retour constant en tête d'écran | oui | oui | oui | oui ? | oui | oui | en partie | À faire (UX-07) |
| Menu du compte avec aide et déconnexion | oui | aide oui, sortie sur le web | oui | oui ? | oui | oui | ni l'une ni l'autre | À faire (UX-03) |
| Lieu toujours visible (ville, quartier, communauté) | non | non | non | oui | oui | non | pas sur un téléphone | À faire (UX-08) |
| Consulter un autre lieu sans changer le sien | — | — | — | oui ? | oui ? | — | oui | Déjà fait |
| Un lien reçu ouvre sa page après la connexion | oui | oui | oui | oui ? | oui | oui | non | À faire (UX-02) |
| Aperçu de lien et icône du site | oui | oui | oui | oui ? | oui | oui | non | À faire (UX-10) |
| Page d'erreur à la marque, avec une issue | oui | oui ? | oui | ? | ? | oui | non | À faire (UX-01) |
| Perte de connexion dite | oui | oui | oui | ? | ? | oui | non | À faire (UX-09) |
| Squelettes et états vides qui guident | oui | en partie ? | oui | ? | oui ? | oui | oui | Déjà fait |
| Mode sombre | oui | oui | oui | ? | oui | oui | oui | Déjà fait |
| Thèmes de couleur au choix | non | fonds et couleurs de discussion | non | non ? | non | non | oui, deux | Déjà fait |
| Langue choisie dans l'application | oui | oui | oui | oui ? | ? | oui | oui, deux | Déjà fait |
| Taille du texte dans l'application | celle du système | oui (Android) | celle du système | ? | ? | celle du système | non | Reporté (UX-14, dépend de CN-15) |
| Raccourcis clavier sur le web | ? | oui | ? | non ? | non ? | oui | non | À faire (UX-15) |
| Mouvement réduit du système respecté | oui | oui ? | oui ? | ? | ? | oui | oui | Déjà fait |
| Page ou déclaration d'accessibilité | oui | oui ? | oui | ? | ? | oui | non | Reporté (UX-19, juriste) |
| Centre d'aide et questions fréquentes | oui | oui | oui | oui | oui | oui | non | À faire (UX-04) |
| Signaler un problème technique | oui | oui | oui | oui ? | oui | oui | non | À faire (UX-04) |
| Règles et textes légaux depuis les réglages | oui | oui | oui | oui | oui | oui | non, une fois connecté | À faire (UX-03) |
| Repères du premier jour | suggestions de comptes | non | oui | oui ? | oui | oui | une carte | À faire (UX-16) |
| Version allégée ou économie de données | oui | oui | oui ? | non ? | non ? | oui | non mesuré | À recetter (DS-08), puis UX-12 |
| Installable depuis le navigateur | oui ? | non ? | oui ? | ? | ? | oui ? | non | Reporté (plan 16) |
| Barre masquée quand le clavier s'ouvre | oui | oui | oui | ? | ? | oui | non | À faire (UX-13) |
| Audit d'accessibilité avant ouverture | — | — | — | — | — | — | jamais fait | À recetter (DS-08) |
| Une couleur par famille d'actions, un seul bouton plein | non | non | non | non ? | non | non | en partie | À adapter (DS-02) |
| Pose au bureau | colonne centrée | pleine largeur | colonnes centrées | colonnes ? | colonnes | colonnes centrées | colonne de 792 px | Reporté (UX-18, décision 9) |

## 4. Ce qui manque

### 4.1 Bloquant avant l'ouverture du pilote

1. **Aucune page d'erreur.** L'application ne remplace pas l'écran d'erreur par défaut du cadre : une exception de rendu y tombe, avec le texte du cadre, hors charte et sans issue. Aucune limite d'erreur ne protège un écran (UX-01).
2. **Un lien reçu ne mène pas à sa page.** Dans un réseau fermé, tout lien partagé tombe sur la porte ; après la connexion, la personne arrive au fil, et l'adresse est perdue. Une association qui partage son évènement sur WhatsApp n'y amène personne (UX-02).
3. **Une fois connecté, on n'atteint plus ni les mentions légales ni la politique de confidentialité**, et le menu du compte n'offre pas de sortie (UX-03). Question au juriste : ces textes doivent-ils rester à portée depuis chaque écran ?

### 4.2 Fonctions attendues qui manquent

- Aide, questions fréquentes, moyen de signaler un problème technique (UX-04).
- Pastille de non-lus sur « Messages » (UX-06).
- Retour constant, qui rend la liste telle qu'on l'a laissée (UX-07).
- Connexion perdue dite à l'écran (UX-09).
- Icône du site et aperçu de lien (UX-10).
- Recherche à portée (UX-15, quand le plan 03 la livre).
- Taille du texte (UX-14, quand le moteur livre CN-15).
- Application installable et page hors-ligne : plan 16.

### 4.3 Options qui manquent sur ce qui existe

- **Barre basse et rail** : destination marquée sur les rubriques de Communautés et d'Explorer (UX-05) ; masquage pendant la saisie (UX-13).
- **En-tête du téléphone** : pays de résidence sous 440 px (UX-08).
- **Menu du compte** : se déconnecter, aide, textes légaux (UX-03) ; langue, apparence et thème sans passer par les réglages (UX-14).
- **« Mon espace »** : « Mon agenda » ; dix entrées sans regroupement (UX-17).
- **Fiches** : retour à la liste filtrée ; retour sur un profil et un album (UX-07).
- **Erreurs et page introuvable** : reprise sans recharger toute la page (UX-09) ; liens vers le fil et vers l'aide (UX-01, UX-04).
- **Vitrine et bureau** : indexation décidée page par page (UX-10) ; raccourcis clavier (UX-15).

### 4.4 Améliorations de l'existant

- **Six boutons** décidés le 9/11, à appliquer (DS-02) ; écrans jamais vus et refus en mode moteur (DS-03).
- **Textes** : 26 gabarits où un nom suit « de » ou « que » ; deux sortes d'apostrophes ; quelques phrases au masculin (DS-03 pour les trois cas nommés, UX-11 pour la règle et son cliquet).
- **Vitrine tenue à la main** : le cliquet de communication publique ne lit pas DIASPORALE (UX-11).
- **Audit AA et mesure 3G** jamais faits (DS-08). Points déjà relevés par le rapport du 2/11 : l'onglet actif ne se détache plus de son rail qu'à 1,09:1 ; avec Inter, les libellés de la barre basse sont plus coupés.
- **Poids du premier chargement** : rien n'est chargé à la demande (UX-12, après la mesure).
- **Erreurs** : une forme par écran, six ensembles locaux de refus (UX-09).

### 4.5 Ce qui distingue DIASPORALE

- **Le pays comme repère** : étiquette pays, zone consultée annoncée, résidence jamais réécrite par une visite.
- **« Publier » fermé mais expliqué** : la raison, puis les chemins qui le rouvrent (parrainage, vérification, recours).
- **La confiance jusque dans le menu du compte** : les badges y sont calculés, pas déclarés.
- **Deux thèmes choisis par le membre**, enregistrés sur le compte commun aux réseaux ; contrastes mesurés à l'écran sur `/charte` et tenus par un cliquet.
- **Une couleur par famille d'actions** et un seul bouton plein par zone : une règle propre aux chartes du programme, que les références comparées ici ne suivent pas.
- **Parité exacte du français et de l'anglais**, aucune couleur ni aucun texte en dur, repère « Démo » permanent.

### 4.6 Écarté ou reporté, et pourquoi

| Sujet | Raison |
|---|---|
| Sixième destination principale | Règle des cinq destinations ; toute nouvelle rubrique entre par Explorer ou Communautés |
| Bouton flottant « Publier » | La pile des cartes flottantes occupe le bas de l'écran ; choix écrit dans la coque |
| Drapeau, armoiries | Charte § 12 ; seule exception, le thème Gaboma choisi par le membre |
| Cinq autres thèmes et motifs de fond d'ANTSIA | Décision du 19/10 : deux thèmes ; un thème inconnu ici laisse le choix de l'appareil |
| Un thème par réseau | Décision du 19/10 : le thème est celui du compte, commun aux réseaux |
| Cache hors-ligne du contenu | Risque de servir un contenu retiré ou une session close (plan 13 d'ANTSIA, § 4) |
| Traduction automatique des contenus | Hors périmètre du cahier (§ 8.15) |
| Application « allégée » séparée | Une seule application, allégée (UX-12) |
| Pleine largeur au bureau | Aucune pose ne change sans décision (UX-18) |
| Page d'état | Dépend du lot EX-05 du moteur (UX-19) |

## 5. Lots d'implémentation

Sauf mention, ces lots n'écrivent rien au serveur : ni seau de débit, ni idempotence, ni signalement, ni export ne sont en jeu. Chacun sert aussi le fournisseur de démonstration et porte son fragment de textes, en français et en anglais.

### DS-02 — Six boutons à trancher · P1 · S · S2 · repris du plan 15
- **Pour l'utilisateur** : chaque geste porte la couleur de sa famille, partout.
- **Backend** : aucun.
- **Web** : appliquer la décision du 9/11. « Demander un mentorat » et son envoi en `commerce` (`D:apps/diasporale_com/src/components/mentoring-request-form.tsx`, `D:apps/diasporale_com/src/screens/mentoring-screens.tsx`) ; « Parrainer » en `social` (`D:apps/diasporale_com/src/screens/sponsor-attestation-screens.tsx`) ; « Faire une proposition » en `commerce`, « Envoyer » du formulaire en `send` (`D:apps/diasporale_com/src/screens/service-request-screens.tsx`, `D:apps/diasporale_com/src/components/service-proposal-form.tsx`) ; « Afficher mon billet QR » en `commerce` (`D:apps/diasporale_com/src/components/association-event-attendance.tsx`) ; « Appeler » en `message` (`D:apps/diasporale_com/src/screens/profile-screens.tsx`) ; « Retenir cette réponse » reste `outline`, et la mention de la réponse retenue passe de l'encre d'identité à l'encre de succès (`D:apps/diasporale_com/src/components/mutual-aid-question-detail.tsx`). Les quatre autres boutons du tableau du 3/11 ne changent pas (décision 1).
- **Mobile** : la table des familles vaut pour l'application (plan 16).
- **Données personnelles** : aucune.
- **Tests et cliquets** : un test « un seul bouton plein » par zone touchée, sur le modèle des deux tests existants ; cliquet de contraste vert sur les deux thèmes et les deux modes ; `D:docs/recette/couleurs-par-famille-2026-11-03/inventaire-boutons.json` refait.
- **Critères d'acceptation** : six variantes posées, aucune autre changée ; captures à 390 et 1280 px, clair et sombre, Sable et Gaboma.
- **Dépend de** : rien, la décision est prise.
- **Porte** : publication de la démonstration sur accord.

### DS-03 — Écrans jamais vus, refus en mode moteur, textes · P1 · S · S2 · repris du plan 15
- **Pour l'utilisateur** : évènement, groupe et « Accepter » corrects ; un refus d'accès dit sans « Réessayer » ; trois textes justes.
- **Backend** : aucun.
- **Web** : (1) voir à l'écran, avec les comptes `association`, `verifie`, `declare`, `mentor` et `entreprise` mis dans le bon état, l'inscription à un évènement (`D:apps/diasporale_com/src/components/association-events.tsx`), le groupe (`D:apps/diasporale_com/src/components/association-group.tsx`), « Accepter » une relation (`D:apps/diasporale_com/src/components/connection-list.tsx`), puis le reste de la liste « Non vus » du rapport du 3/11 ; (2) rejouer en mode moteur le refus d'accès du fil avec le compte `suspendu` et la sortie depuis l'accueil avec le compte `exterieur` (`D:apps/diasporale_com/src/screens/welcome-screen.tsx`) ; (3) corriger les trois textes nommés : « de » devant le nom d'une page (clé `pagePublications.publishAs` et voisines), « vous en êtes l'administrateur » (clé `pageAdmin.create.created`), apostrophes des avis de la cloche. La règle générale est au lot UX-11.
- **Mobile** : sans objet.
- **Données personnelles** : aucune.
- **Tests et cliquets** : `i18n-keys` ; ne pas remplacer les ensembles locaux de refus par `ACCESS_REFUSAL_CODES` : ils purgent le cache et comptent `network_unavailable`.
- **Critères d'acceptation** : captures aux deux largeurs et aux deux modes ; un rapport qui dit, écran par écran, vu ou non vu.
- **Dépend de** : DS-02 pour les couleurs ; backend local du lot DS-01.
- **Porte** : aucune.

### DS-08 — Accessibilité AA et budget 3G · P1 · M · S2 · repris du plan 15
- **Pour l'utilisateur** : utilisable au clavier, au lecteur d'écran, texte agrandi, et sur un réseau lent.
- **Backend** : aucun.
- **Web** : audit des six routes du plan 15 (`/fil`, `/pays/<iso>`, `/services`, `/entraide`, `/pages/<page>`, `/messages`), plus la porte, l'accueil, le composeur et le signalement : clavier seul, deux lecteurs d'écran, zoom à 200 %, largeurs de 320, 375, 440 et 1280 px, clair et sombre, Sable et Gaboma, mouvement réduit. Mesure du premier affichage de `/`, `/fil` et `/pays/fr` sur un profil 3G, selon le protocole du lot EX-09 du moteur ; poids par route consigné. Au moins un passage sur un vrai téléphone.
- **Mobile** : l'application aura son propre audit (plan 16).
- **Données personnelles** : aucune ; comptes de démonstration seulement.
- **Tests et cliquets** : l'outil d'audit automatique retenu par « PA10 · audits » du moteur ; s'il manque au catalogue, issue [S1].
- **Critères d'acceptation** : rapport daté par route, défauts classés ; chaque défaut bloquant devient un lot P0 ; temps dits tels quels, cible du cahier dite atteinte seulement si elle l'est.
- **Dépend de** : DS-02, DS-03 ; EX-09 et PA10 · audits (moteur).
- **Porte** : aucune.

### UX-01 — Pages d'erreur de l'application · P0 · S · S2
- **Pour l'utilisateur** : quand un écran casse, une page à la marque le dit, propose « Réessayer » et « Revenir au fil » ; après une publication du site, « Recharger » suffit.
- **Backend** : aucun.
- **Web** : créer `error.tsx` et `global-error.tsx` sous `D:apps/diasporale_com/src/app` ; textes par un fragment de locale ; la charte reste posée ; une erreur de chargement de fichier est reconnue et dite « nouvelle version disponible » ; aucun détail technique à l'écran ; la page introuvable gagne un lien vers le fil.
- **Mobile** : écran d'erreur propre à l'application (plan 16).
- **Données personnelles** : aucune ; aucune erreur envoyée à un tiers tant que la mesure d'usage n'est pas décidée (plan 17).
- **Tests et cliquets** : rendu des deux pages en français et en anglais ; un test qui force une exception dans un écran ; `no-hardcoded-strings`, `i18n-keys`.
- **Critères d'acceptation** : une exception sur `/fil` montre la page d'erreur dans la langue de la personne, focus sur le titre ; « Réessayer » relance l'écran ; vu à 390 et 1280 px, clair et sombre, dans les deux thèmes.
- **Dépend de** : rien.
- **Porte** : aucune.

### UX-02 — Revenir à la page demandée après la connexion · P0 · S · S2
- **Pour l'utilisateur** : le lien d'un évènement reçu sur WhatsApp ouvre cet évènement une fois connecté, pas le fil.
- **Backend** : aucun.
- **Web** : la garde (`D:apps/diasporale_com/src/components/gate.tsx`) retient l'adresse demandée avant de renvoyer à la porte ; une fonction pure n'accepte qu'un chemin interne connu de la table des routes et refuse toute adresse externe ; mémoire dans l'onglet, jamais dans l'adresse ; la sortie de la porte (`D:apps/diasporale_com/src/screens/enter-screens.tsx`) et la fin de l'accueil (`D:apps/diasporale_com/src/screens/welcome-screen.tsx`) la consomment une fois ; une page refusée rend le refus habituel.
- **Mobile** : liens profonds et liens universels au plan 16.
- **Données personnelles** : l'adresse reste dans l'onglet et s'efface à la déconnexion.
- **Tests et cliquets** : la fonction pure (adresse externe, double barre, schéma, chemin inconnu, chemin valide avec filtres) ; parcours porte, code, page ; effacement à la sortie.
- **Critères d'acceptation** : lien d'un évènement ouvert hors session, code saisi, évènement affiché ; nouveau membre : accueil d'abord, puis la page ; aucune redirection vers l'extérieur possible.
- **Dépend de** : plan 01, qui possède la porte et l'accueil : même chantier ou chantiers enchaînés.
- **Porte** : aucune.

### UX-03 — Menu du compte complet : informations, aide, déconnexion · P0 · S · S2
- **Pour l'utilisateur** : depuis l'avatar, « Aide et informations » (mentions légales, confidentialité, charte graphique ; l'aide s'y ajoute avec UX-04) et « Se déconnecter ».
- **Backend** : aucun ; la sortie emploie la fonction existante de `D:apps/diasporale_com/src/components/sign-out-settings.tsx`.
- **Web** : `accountEntries` de la coque gagne un groupe d'informations et l'action de sortie, en bouton neutre ; mêmes entrées dans la feuille du téléphone.
- **Mobile** : même menu dans l'application (plan 16).
- **Données personnelles** : aucune.
- **Tests et cliquets** : test de la coque : entrées présentes, clavier, sortie appelée ; `no-hardcoded-urls`.
- **Critères d'acceptation** : textes légaux et sortie à deux gestes depuis tout écran, en mode moteur et en démonstration.
- **Dépend de** : rien pour les liens ; le contenu des textes légaux vient du lot DS-07 (plan 17).
- **Porte** : aucune.

### UX-04 — Aide et assistance · P1 · M · S2
- **Pour l'utilisateur** : une page « Aide » : questions fréquentes par thème (entrer et être vérifié, publier, pays, pages et associations, services, messages, données, signalements) et « Signaler un problème technique ».
- **Backend** : selon la décision 3. Au pilote : aucun, l'adresse d'assistance de l'éditeur est lue dans l'environnement public.
- **Web** : route `/aide` déclarée dans `D:apps/diasporale_com/src/lib/routes.ts`, lisible sans session ; chaque réponse renvoie à l'écran réel ; aucun délai promis, aucun chiffre ; le rapport de problème joint la version servie et l'adresse de la page, jamais un contenu ; liens depuis le menu du compte, le pied de page, la page introuvable et la page d'erreur.
- **Mobile** : même contenu (plan 16).
- **Données personnelles** : aucune coordonnée de membre ; si un formulaire est retenu plus tard, ses tickets entrent dans l'export et l'effacement.
- **Tests et cliquets** : `i18n-keys`, `no-hardcoded-urls`, cliquet de communication publique (UX-11).
- **Critères d'acceptation** : aide à deux gestes ; aucun lien mort quand l'adresse d'assistance manque (bloc masqué).
- **Dépend de** : UX-03 ; plan 14 pour « Signaler un contenu ».
- **Porte** : adresse d'assistance fournie par le propriétaire.

### UX-05 — La barre dit toujours où l'on est · P1 · S · S2
- **Pour l'utilisateur** : sur l'entraide, une page ou l'agenda, la destination d'origine reste marquée.
- **Backend** : aucun.
- **Web** : dans la coque, une table rattache chaque route à une destination ou à « Mon espace » (proposition : décision 5) ; elle remplace les listes écrites à la main dans `primaryEntries`.
- **Mobile** : même table (plan 16).
- **Données personnelles** : aucune.
- **Tests et cliquets** : test de complétude : toute adresse de la table des routes, hors porte et pages publiques, a une destination et une seule.
- **Critères d'acceptation** : `aria-current` posé sur une seule entrée pour chaque route de membre ; toute route nouvelle sans destination fait échouer le test.
- **Dépend de** : décision 5.
- **Porte** : aucune.

### UX-06 — Pastille de non-lus sur « Messages » · P1 · S · S2
- **Pour l'utilisateur** : voir d'un coup d'œil qu'un message attend.
- **Backend** : aucun ; les deux lectures `totalUnread` du moteur existent.
- **Web** : sous l'îlot iCom, la coque lit les deux décomptes et pose une pastille plafonnée sur l'entrée « Messages » du rail et de la barre basse ; nom accessible « Messages, N non lus » ; rien en démonstration.
- **Mobile** : pastille de l'icône de l'application (plan 16).
- **Données personnelles** : un nombre, aucun contenu.
- **Tests et cliquets** : pastille absente à zéro, plafonnée, annoncée ; aucune lecture quand iCom est fermé.
- **Critères d'acceptation** : à deux comptes, un message reçu fait paraître la pastille sans rechargement ; l'ouvrir la retire.
- **Dépend de** : plan 04, qui dit si les conversations de mise en relation comptent.
- **Porte** : aucune.

### UX-07 — Retour fiable et filtres gardés · P1 · M · S2
- **Pour l'utilisateur** : « Retour » au même endroit sur chaque fiche, et la liste telle qu'on l'a laissée.
- **Backend** : aucun.
- **Web** : un composant commun de retour dans `D:packages/diasporale-features/src/components` ; il rend la liste filtrée d'où l'on vient, sinon la racine de la rubrique ; posé sur les fiches d'offre, d'emploi, de publication, d'album, de profil, de page, d'évènement, de ressource, de question, de demande et de mentor.
- **Mobile** : geste de retour natif (plan 16).
- **Données personnelles** : aucune.
- **Tests et cliquets** : retour après une recherche filtrée ; arrivée par lien direct ; clavier.
- **Critères d'acceptation** : depuis les services filtrés par ville, ouvrir une offre puis « Retour » rend la même liste ; le libellé nomme la destination.
- **Dépend de** : UX-05.
- **Porte** : aucune.

### UX-08 — Le pays visible au téléphone · P1 · S · S2
- **Pour l'utilisateur** : le pays reste sous les yeux, même sur un petit écran.
- **Backend** : aucun.
- **Web** : l'en-tête du téléphone porte le code du pays dès 320 px ; sous 380 px, le mot-symbole se réduit à son œillet pour lui laisser la place (décision 7) ; il mène à Communautés.
- **Mobile** : même repère (plan 16).
- **Données personnelles** : aucune.
- **Tests et cliquets** : test de la coque à 320, 375 et 440 px ; aucun débordement.
- **Critères d'acceptation** : pays lisible dans l'en-tête à 320 px, avec et sans repère « Démo ».
- **Dépend de** : décision 7.
- **Porte** : aucune.

### UX-09 — États communs : chargement, erreur, refus, connexion perdue · P1 · M · S2
- **Pour l'utilisateur** : la même phrase et le même geste partout ; un bandeau quand la connexion tombe.
- **Backend** : aucun.
- **Web** : composants communs d'erreur de chargement (reprise de la lecture, jamais un rechargement complet) et de refus d'accès (sans reprise, avec les chemins utiles) ; bandeau « Connexion perdue » posé par la coque ; les écrans gardent leur logique : les ensembles locaux de refus continuent de purger le cache.
- **Mobile** : mêmes états (plan 16).
- **Données personnelles** : aucune.
- **Tests et cliquets** : chaque état en français et en anglais ; un test par écran migré prouve que la purge reste.
- **Critères d'acceptation** : aucun « Réessayer » sur un refus d'accès ; plus aucun `window.location.reload` dans les écrans ; le bandeau paraît à la coupure et part au retour.
- **Dépend de** : DS-03.
- **Porte** : aucune.

### UX-10 — Icône, aperçu de lien et indexation de la vitrine · P1 · S · S2
- **Pour l'utilisateur** : l'onglet porte l'icône de DIASPORALE ; l'adresse partagée montre un titre, une phrase et une image propres.
- **Backend** : aucun.
- **Web** : icône et icône d'écran d'accueil tirées du mot-symbole ; adresse de base lue dans l'environnement public ; image de partage de marque, sans contenu du réseau ni chiffre ; règle d'indexation par page : vitrine et textes légaux selon la décision 4, tout le reste exclu.
- **Mobile** : le plan 16 réemploie les icônes.
- **Données personnelles** : aucune ; aucune page de membre indexable.
- **Tests et cliquets** : métadonnées de la vitrine ; test qui refuse l'indexation d'une route de membre, de `/charte` et de `/demo`.
- **Critères d'acceptation** : aperçu lisible dans une messagerie ; icône dans l'onglet ; démonstration jamais indexée.
- **Dépend de** : plan 17 pour le domaine.
- **Porte** : domaine ; décision 4.

### UX-11 — Textes et cliquets : élision, apostrophes, genre, communication publique · P1 · M · S2
- **Pour l'utilisateur** : plus de « de Entraide », une seule apostrophe, des phrases qui ne supposent pas son genre.
- **Backend** : aucun.
- **Web** : reformuler les 26 gabarits pour qu'un nom ne suive jamais « de » ni « que » (le « h » muet interdit une règle automatique) ; une seule apostrophe dans les 45 fragments (décision 8) ; formes neutres pour la personne qui lit (décision 11) ; même passe sur l'anglais.
- **Mobile** : mêmes fragments.
- **Données personnelles** : aucune.
- **Tests et cliquets** : nouveaux cliquets dans `D:apps/diasporale_com/src/ratchets` : gabarit « de ou que suivi d'un nom » refusé, apostrophe unique, et communication publique dupliquée de celle d'ANTSIA avec son en-tête de provenance.
- **Critères d'acceptation** : les trois cliquets verts ; aucune clé ajoutée ou retirée ; les textes des surfaces du moteur montées ici font l'objet d'une issue [S1].
- **Dépend de** : DS-03 ; décisions 8 et 11.
- **Porte** : aucune.

### UX-12 — Alléger le premier chargement · P1 · M · S2
- **Pour l'utilisateur** : le fil s'affiche sans attendre la messagerie ni les appels.
- **Backend** : aucun.
- **Web** : d'après la mesure du lot DS-08 : charger à la demande l'îlot iCom et le moteur du mot-symbole liquide ; budget de poids par route, écrit et tenu ; images dimensionnées. Si l'allègement exige de toucher aux paquets du moteur (scène d'appel), issue [S1].
- **Mobile** : sans objet.
- **Données personnelles** : aucune.
- **Tests et cliquets** : un appel entrant sonne encore ; la messagerie s'ouvre au premier geste.
- **Critères d'acceptation** : budget tenu, ou écart dit avec sa cause ; mesure refaite et consignée.
- **Dépend de** : DS-08 ; plan 04.
- **Porte** : aucune.

### UX-13 — Barre basse et clavier du téléphone · P1 · S · S2
- **Pour l'utilisateur** : la barre ne mange pas l'écran pendant qu'on écrit.
- **Backend** : aucun.
- **Web** : constater d'abord sur un vrai téléphone (DS-08) ; dupliquer le masquage d'antsia.ga avec son en-tête de provenance ; la barre revient à la fin de la saisie.
- **Mobile** : sans objet.
- **Données personnelles** : aucune.
- **Tests et cliquets** : tests portés avec le code.
- **Critères d'acceptation** : sur iPhone et sur Android, un formulaire long se remplit sans que la barre couvre le champ ni son bouton.
- **Dépend de** : DS-08.
- **Porte** : aucune.

### UX-14 — Affichage à portée : taille du texte, animations, apparence, langue · P2 · S · S2
- **Pour l'utilisateur** : agrandir le texte, réduire les animations, changer de thème ou de langue sans chercher.
- **Contenu** : brancher le lot CN-15 du moteur dans les réglages ; vérifier la barre basse en « très grande » ; donner le nom des thèmes au contrôle du rail ; langue et apparence dans le menu du compte.
- **Dépend de** : CN-15 (S1) ; plan 13 pour l'emplacement dans les réglages.
- **Porte** : aucune.

### UX-15 — Recherche à portée et raccourcis clavier · P2 · S · S2
- **Pour l'utilisateur** : une loupe toujours visible ; au bureau, « / » ouvre la recherche et « ? » liste les raccourcis.
- **Contenu** : loupe dans l'en-tête du téléphone et champ au rail, vers la recherche du plan 03 ; raccourcis à une touche désactivables, inactifs dans un champ.
- **Dépend de** : plan 03 (recherche transversale).
- **Porte** : aucune.

### UX-16 — Premiers pas · P2 · M · S2
- **Pour l'utilisateur** : après l'accueil, une carte dit les trois ou quatre gestes utiles : compléter son profil, suivre les pages de son pays, trouver son association, se faire vérifier.
- **Contenu** : carte écartable ; chaque étape ne paraît que si elle est possible et non faite ; l'avancement se lit dans l'état réel, rien de nouveau n'est stocké ; aucune liste vide.
- **Dépend de** : plan 01 (accueil) ; modèle du lot CN-11 du moteur.
- **Porte** : aucune.

### UX-17 — « Mon espace » : agenda et regroupement · P2 · S · S2
- **Pour l'utilisateur** : retrouver ses inscriptions depuis son espace ; une liste plus courte à lire.
- **Contenu** : ajouter « Mon agenda » ; regrouper les dix entrées par famille (mes échanges, mes communautés, mon activité) si la décision 6 le retient.
- **Dépend de** : plan 08 (agenda) ; décision 6.
- **Porte** : aucune.

### UX-18 — Pose des écrans : colonne ou pleine largeur · P3 · M · S2
- **Pour l'utilisateur** : au bureau, des écrans de liste (services, pages, modération) qui emploient la largeur.
- **Contenu** : appliquer ou non à DIASPORALE la règle « pleine largeur » d'ANTSIA ; captures comparées avant toute modification.
- **Dépend de** : DS-08.
- **Porte** : décision 9 du propriétaire.

### UX-19 — Déclaration d'accessibilité et état du service · P3 · S · S2
- **Pour l'utilisateur** : savoir ce qui a été vérifié, et si le service fonctionne.
- **Contenu** : page « Accessibilité » qui dit ce qui est vérifié et ce qui ne l'est pas, sans le mot « conforme » ; lien vers la page d'état quand elle existe.
- **Dépend de** : DS-08 ; EX-05 (moteur).
- **Porte** : juriste (obligation applicable ou non).

## 6. Ordre recommandé et dépendances

| Vague | Lots | Pourquoi dans cet ordre |
|---|---|---|
| 1 | DS-02, DS-03, UX-01, UX-03 | Petits, visibles, sans dépendance ; finissent la charte et ferment deux trous |
| 2 | UX-02, UX-05, UX-06, UX-08 | La navigation dit vrai : le lien mène à sa page, la barre dit où l'on est |
| 3 | DS-08, puis UX-12, UX-13 | Mesurer avant de corriger ; les défauts bloquants passent en P0 |
| 4 | UX-09, UX-07, UX-11, UX-10, UX-04 | Formes communes, textes, vitrine et aide, avant la production |
| 5 | UX-14 à UX-17 | Après les premiers retours du pilote |
| 6 | UX-18, UX-19 | Sur décision |

**Ce que ce plan attend des autres plans.** Plan 01 : la porte et l'accueil, touchés par UX-02 et UX-16. Plan 03 : la recherche (UX-15). Plan 04 : le périmètre des non-lus (UX-06) et le chargement d'iCom sans perdre la sonnerie (UX-12). Plan 13 : l'emplacement des réglages d'affichage (UX-14). Plan 14 : « Signaler un contenu » et les règles, cités par l'aide (UX-04). Plan 16 : manifeste, page hors-ligne, liens profonds ; il réemploie les icônes d'UX-10. Plan 17 : domaine (UX-10), textes légaux (UX-03), campagne DS-05. Moteur : CN-15, EX-05, EX-09, PA10 · audits.

**Ce que les autres plans attendent de celui-ci.** Les familles de boutons (DS-02) pour tout bouton nouveau ; la table des destinations (UX-05) pour toute route nouvelle ; le retour commun (UX-07) ; les états communs (UX-09) ; la règle des textes (UX-11).

**Volet de recette en mode moteur (campagne DS-05).**

| Compte de démonstration | Étapes | Résultat attendu |
|---|---|---|
| `verifie` | Les cinq destinations à 390 et 1280 px, Sable puis Gaboma, clair puis sombre | Aucun débordement ; destination marquée ; pays visible |
| `leger` | « Publier » depuis le rail et l'en-tête | Action fermée, raison annoncée, chemins vers le parrainage et la vérification |
| `suspendu` | Ouvrir le fil | Refus dit tel quel, sans « Réessayer » ; « Mes données » reste ouvert |
| `exterieur` | Arriver sur l'accueil, puis « Se déconnecter partout » | Sortie faite, retour à la porte |
| `belgique` | Ouvrir le hub de la France | Zone consultée annoncée ; résidence inchangée |
| `declare` | Passer en anglais, recharger, rouvrir sur un autre navigateur | Langue du compte appliquée partout |
| `association`, `mentor`, `entreprise` | Évènement, groupe, mentorat, proposition, billet QR | Les six boutons et les écrans jamais vus, aux couleurs décidées |
| aucun, puis `verifie` | Ouvrir hors session le lien d'une page ; saisir le code | Après UX-02 : la page demandée s'affiche |
| `verifie` | Adresse inconnue ; écran forcé en erreur | Page introuvable ; après UX-01, page d'erreur à la marque |

## 7. Décisions à prendre par le propriétaire

1. **Les quatre autres boutons du tableau du 3/11** (« Se connecter pour demander ce service », « Envoyer l'invitation », « Envoyer le recours », « Partager dans mon fil »). Recommandation : les laisser tels quels. Raison : chacun est l'action principale de son formulaire, et la règle d'un seul bouton plein y est déjà tenue. Les six autres sont décidés depuis le 9/11.
2. **Audit avant le pilote.** Recommandation : jouer DS-08 sur les parcours d'entrée, de publication et de signalement avant d'ouvrir ; tout défaut bloquant devient P0. Raison : le cahier exige le niveau AA vérifié sur les écrans livrés.
3. **Canal d'assistance** : adresse de l'éditeur, page « Assistance » jointe par la messagerie, ou formulaire. Recommandation : l'adresse de l'éditeur au pilote. Raison : aucun code serveur, et les retours du pilote ne partent plus sur WhatsApp.
4. **Indexation.** Recommandation : rendre la vitrine et les textes légaux indexables à l'ouverture de la production, pas avant ; la démonstration, jamais. Raison : les textes légaux sont encore une charpente.
5. **Table des destinations.** Recommandation : entraide, kit d'arrivée, mentorat, emploi, talents, agenda, groupes et évènements sous Communautés ; annuaire des pages, page et profil d'un autre membre sous Explorer. Raison : c'est par là qu'on y entre aujourd'hui.
6. **« Mon espace ».** Recommandation : ajouter « Mon agenda » tout de suite ; regrouper après les premiers retours. Raison : l'agenda est la seule liste personnelle absente.
7. **Pays ou mot-symbole dans l'en-tête étroit.** Recommandation : le pays prime sous 380 px. Raison : le pays est le contexte permanent (invariant 7).
8. **Apostrophe.** Recommandation : la typographique, partout. Raison : c'est l'usage français, et les fragments les plus récents l'emploient ; un cliquet tient la règle.
9. **Pose au bureau.** Recommandation : ne rien changer avant le pilote, puis décider sur captures comparées. Raison : toute pose se confirme avant d'être changée.
10. **Relecture de l'anglais** par une personne dont c'est la langue. Recommandation : avant l'ouverture d'un pays anglophone, pas avant le pilote France.
11. **Formes neutres** pour la personne qui lit. Recommandation : oui. Raison : l'interface ne connaît pas le genre de la personne.

## 8. Risques et points d'attention

- **Fichiers partagés avec d'autres plans** : la porte et l'accueil (plan 01), les réglages (plan 13), l'îlot iCom (plan 04). Un seul chantier à la fois par fichier.
- **Ensembles locaux de refus** : les unifier sans précaution casserait la purge du cache (dossier de reprise, § 10.2).
- **Deux feuilles de thème à tenir ensemble** : toute mesure changée dans Sable se reporte dans Gaboma, sinon le cliquet échoue.
- **Thème commun aux réseaux** : choisir Gaboma ici le pose aussi sur antsia.ga ; le dire dans tout texte nouveau.
- **Outil d'audit** : le catalogue racine appartient à S1 ; sans lui, DS-08 se fait à la main.
- **Allègement et appels** : charger iCom à la demande ne doit pas retarder la sonnerie d'un appel entrant.
- **Retour après connexion** : la seule entrée d'une adresse dans le parcours de connexion ; la fonction de contrôle est la sécurité du lot.
- **Aucune mesure ne vaut preuve** tant qu'elle n'est pas refaite sur un vrai téléphone.
- **Sujets juridiques** : accès aux textes légaux, déclaration d'accessibilité, indexation : questions posées, rien n'est dit conforme.

## 9. Prompts d'implémentation

### Prompt DS-03
```text
Session S2 (DIASPORALE). Écris en français. Opus seulement. Branche claude/ecrans-refus-textes depuis origin/main.
Lis : CLAUDE.md, docs/etudes/2026-11-10-finalisation/02_COQUE_NAVIGATION_CHARTE_ACCESSIBILITE.md (§ 2 lignes 36, 50, 55 à 57 ; lot DS-03), docs/recette/couleurs-par-famille-2026-11-03/RAPPORT.md, docs/34_COMPTES_DE_DEMONSTRATION.md.
Backend local 3320/3321 (accord pour les variables), site en mode moteur. Mets les comptes de démonstration dans le bon état et regarde chaque écran de la liste « Non vus » à 390 et 1280 px, clair et sombre. Rejoue le refus d'accès du fil (compte suspendu) et la sortie depuis l'accueil (compte exterieur).
Corrige les trois textes nommés par le lot, en français et en anglais. Ne remplace pas les ensembles locaux de refus par ACCESS_REFUSAL_CODES.
Livre : docs/recette/<date>/RAPPORT.md (vu ou non vu, écran par écran), verify vert avec le verrou. Arrête-toi avant toute publication.
```

### Prompt DS-08
```text
Session S2. Lis le lot DS-08 de ce plan, le cahier (EXT-DG-02, EXT-DG-05), docs/03 § 10, et dans ../ANTSIA les lots EX-09 et « PA10 · audits » du plan 13.
N'ajoute aucune dépendance : si l'outil d'audit manque au catalogue, ouvre une issue [S1] et fais l'audit à la main.
Audite les routes du lot : clavier seul, deux lecteurs d'écran, zoom à 200 %, 320, 375, 440 et 1280 px, clair et sombre, Sable et Gaboma, mouvement réduit. Mesure le premier affichage de /, /fil et /pays/fr sur un profil 3G, en local et sur la démonstration (lecture seule). Demande-moi un passage sur mon téléphone.
Livre : docs/recette/accessibilite-<date>/RAPPORT.md, défauts classés, temps dits tels quels. Ne corrige que ce qui tient en une ligne ; le reste devient des lots. N'écris jamais « conforme ».
```

### Prompt UX-01
```text
Session S2. Branche claude/pages-erreur. Lis le lot UX-01, apps/diasporale_com/src/app/layout.tsx et not-found.tsx, components/providers.tsx.
Crée error.tsx et global-error.tsx dans apps/diasporale_com/src/app : composants clients, textes dans un nouveau fragment de locale (fr et en), charte posée, « Réessayer », « Revenir au fil », cas « nouvelle version disponible ». Aucun détail technique à l'écran, aucun envoi à un tiers.
Tests : rendu fr et en, exception forcée dans un écran, cliquets i18n et chaînes. Recette à 390 et 1280 px, clair et sombre, Sable et Gaboma.
Verify vert avec le verrou. Arrête-toi avant de publier la démonstration.
```

### Prompt UX-02
```text
Session S2. Branche claude/retour-apres-connexion. Lis le lot UX-02, components/gate.tsx, screens/enter-screens.tsx, screens/welcome-screen.tsx, lib/routes.ts, et le plan 01 du même dossier pour ne pas défaire la porte.
Écris d'abord la fonction pure et ses tests : elle n'accepte qu'un chemin interne connu de la table des routes ; adresse externe, double barre, schéma et chemin inconnu rendent rien.
Puis : la garde retient l'adresse dans l'onglet, la porte et la fin de l'accueil la consomment une fois, la déconnexion l'efface. Rien dans l'adresse de la page.
Recette à deux navigateurs : lien d'un évènement ouvert hors session, code, évènement affiché ; compte neuf : accueil puis page. Verify vert. Arrête-toi avant toute publication.
```

### Prompt UX-05 et UX-06
```text
Session S2. Branche claude/barre-reperes. Lis les lots UX-05 et UX-06, components/app-shell.tsx et son test, components/icom.tsx, et dans ../ANTSIA packages/social-features/src/shell/reseau-menu-destinations-ui.tsx (lecture seule).
UX-05 : remplace les listes de primaryEntries par une table route → destination, selon la décision 5 du plan ; test de complétude sur toute la table des routes.
UX-06 : sous l'îlot iCom, lis les deux décomptes totalUnread du moteur et pose la pastille sur « Messages » (rail et barre basse), plafonnée, annoncée. Rien en démonstration. Ne modifie aucun fichier d'ANTSIA.
Tests de la coque étendus ; recette à deux comptes en mode moteur. Verify vert. Arrête-toi avant toute publication.
```

## 10. Sources lues

- Brief commun et contexte de la session principale : dossier de reprise, cahier docs/00, plan global docs/14, registre docs/17, plan 15 et plan directeur d'ANTSIA, registre des lots.
- Plans du moteur : 13 (EX-05, EX-09, EX-10, EX-11, EX-18, PA10 · audits) et 06 (CN-06, CN-11, CN-15).
- DIASPORALE, documents : docs/03 (en entier), docs/04 (§ 3), docs/11 et docs/15 (titres, § S-07), docs/13 (§ 3.1, § 8, § 11.1), docs/33 (en entier), docs/34 (acteurs) ; recettes `charte-v4-2026-11-02`, `couleurs-par-famille-2026-11-03`, `fils-mobiles-2026-10-18`, `fils-chrome-2026-10-18`.
- ANTSIA, documents : ADR 0017, 0026, 0027, 0030 (décisions). Non lus : docs/22 et docs/23 d'ANTSIA, dont les décisions utiles sont dans ces ADR.
- Vault : décisions `charte-v2-epuree-cartes-flottantes`, `themes-au-choix-sable-et-gaboma`, `theme-du-compte-commun-aux-reseaux`.
- Code de DIASPORALE : `D:apps/diasporale_com/src/app` (gabarit racine, page introuvable, feuille globale, pages), `D:apps/diasporale_com/next.config.ts`, `D:apps/diasporale_com/src/components` (coque, habillage, garde, fournisseurs, cartes flottantes, préférences, thème, langue, mot-symbole, porte, vision), `D:apps/diasporale_com/src/screens` (vitrine, charte, Explorer, Communautés, textes légaux, retours des fiches), `D:apps/diasporale_com/src/lib`, `D:apps/diasporale_com/src/ratchets`, `D:packages/diasporale-features/src/primitives`, `D:packages/diasporale-features/src/styles`, `D:packages/diasporale-features/src/i18n` (45 fragments par langue, comptés et comparés par un script de lecture).
- Code d'ANTSIA : `A:packages/ui/src/themes`, `A:packages/ui/src/styles.css`, `A:packages/social-features/src/shell`, `A:packages/social-features/src/i18n`, `A:convex/modules/messaging/inbox.ts`, `A:tests/ratchets`, `A:packages/eslint-config`, `A:apps/antsia_ga/src/app` et `A:apps/antsia_ga/src/components` (pour comparer).
