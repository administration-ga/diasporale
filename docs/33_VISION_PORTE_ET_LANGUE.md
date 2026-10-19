# Vision sur la porte, pied de page et langue — 19 octobre 2026

Demande du propriétaire (19/10, soir) : « Implémente les informations de la vision de DIASPORALE.
Supprime le bouton clair/sombre au pied de page. Implémente correctement la traduction, elle doit
être fonctionnelle. » Les comptes de démonstration, demandés le même jour, sont livrés à part par
une autre session (contrat `packages/diasporale-domain/src/demo-accounts.ts`).

## 1. La vision, sous la porte

`components/door-vision.tsx`, monté par `LandingScreen` dans le nouvel emplacement `after` de
`EntryDoor` : sur `/` et `/entrer` seulement (pas sur `/entrer/code` ni `/entrer/idn`), toujours
APRÈS la carte d'accès, qui reste la première action (docs/11 : « Créer un compte » visible sans
défilement au téléphone).

| Bloc | Contenu (fragment `door-vision.json`, clés `landing.vision.*`) |
|---|---|
| Ce qu'est DIASPORALE | Réseau social fermé des Gabonais de l'étranger : votre pays, votre communauté, et l'on sait toujours qui publie |
| Ce que vous y trouvez | Pays et communauté ; s'installer et s'entraider ; travailler et entreprendre ; associations ; échanger sans exposer ses coordonnées |
| Les pays déjà ouverts | Au téléphone seulement (la vitrine les montre au bureau) : pastilles lues dans la source, « Bientôt disponible » pour un pays en sommeil, rien plutôt qu'un zéro |
| Un réseau de confiance | Réservé, contexte séparé ; repères de confiance calculés ; vérification consulaire consentie, rien d'autre ; parrainage tracé ; vos données, vos choix ; gratuit pour les membres |
| Comment entrer | Code par e-mail sans mot de passe ; pays de résidence et consentements un par un ; lire tout de suite, publier après vérification ou parrainage ; « Rejoindre DIASPORALE » (sauf sur la carte d'inscription) |

Sources : cahier des charges §1–2 et invariants, étude 13, accueils 11, charte 03. Règles de
communication publique tenues à la main (le cliquet d'ANTSIA ne lit pas DIASPORALE) : aucun
chiffre, aucune promesse d'audit, d'hébergement, de chiffrement ni de disponibilité ; pas de
« RGPD », pas de drapeau, pas de SMS ni d'IDN annoncés ; un seul titre en Plex Condensed par écran
(la vision n'en ajoute aucun). Le mot-symbole liquide est intact : la vitrine garde son ancêtre
`isolate` et sa zone de geste. `OpenCountriesList` (nouveau `components/open-countries.tsx`) sert la
vitrine et la vision.

## 2. Pied de page

`SiteFooter` ne porte plus que la langue : le sélecteur Clair / Sombre / Système est retiré. Le mode
reste réglable par le bouton rond de la porte, dans `/parametres` (Langue et apparence) et en tête de
la charte ; le choix mémorisé continue de s'appliquer partout.

## 3. Langue : une bascule qui fonctionne

Constat (exploration du 19/10) : les 6 806 clés existent dans les deux langues et aucune phrase
d'interface n'est écrite en dur, mais **la bascule ne changeait que le titre de l'onglet**.
L'instance i18next du client était créée une fois (`useState`) et jamais changée de langue ;
`router.refresh()` réexécutait les composants serveur sans toucher l'état du client. Le contenu
restait dans l'ancienne langue jusqu'au prochain rechargement complet, sous un `<html lang>` déjà
basculé.

| Correction | Fichiers |
|---|---|
| Le fournisseur rejoint la langue du rendu serveur quand elle CHANGE (pas au montage, pour ne pas défaire une langue appliquée par un enfant) | `diasporale-features/src/i18n/client.tsx` (`I18nProvider`, nouveau `useChangeLocale`) |
| Le choix s'applique tout de suite : cookie, instance du client (écrans DIASPORALE et surfaces du moteur, dates comprises), `<html lang>`, puis rafraîchissement du serveur ; une langue déjà en place ne rafraîchit rien | `components/account-locale.tsx` (`useApplyLocale`), `components/preferences.tsx` (`LanguageSwitch`) |
| En session, la langue est enregistrée sur le compte et suit la personne (même mécanisme que le thème, `lib/theme-account-sync.ts` réutilisé) ; à la connexion, la langue du compte s'applique ; un refus rend celle du compte et le signale | `AccountLocale`, `AccountView.locale`, action facultative `saveAccountLocale` (moteur : `setMyPreferences({ locale })` ; démonstration : compte fictif) |
| Première visite : la langue du navigateur (`Accept-Language`) si aucun cookie, sinon le français | `i18n/accept-language.ts`, `i18n/server.ts` |

La langue enregistrée sur le compte sert aussi le moteur, qui compose les avis poussés et les
récapitulatifs dans `person.locale`.

## 4. Preuves

- Tests : `account-locale.test.tsx` (bascule sur place sans remontage, `aria-pressed`, cookie,
  `<html lang>`, rafraîchissement unique, langue du compte enregistrée et appliquée à la connexion,
  appareil gardé sans langue de compte), `accept-language.test.ts`, tests de la porte, cliquets i18n
  et chaînes ; typage des trois paquets à zéro.
- Navigateur (serveur local, moteur) : la porte affiche la vision en français et en anglais, sans
  débordement à 395 px et à 1280 px ; le pied de page ne garde que Français / English ; au clic sur
  « English », la même page (sans rechargement) passe en anglais, titre de l'onglet compris,
  `<html lang="en">`, « English » marqué choisi.
- Vérification commune : voir la PR.

## 5. Limites

- ~~Le code de connexion envoyé par e-mail suit la langue du déploiement (`AUTH_DEFAULT_LOCALE`) et
  porte la marque ANTSIA.~~ Levée le 19/10 : le code suit la langue affichée et porte la marque du
  réseau d'origine (docs/35).
- Le jeu de démonstration (source « démonstration ») est écrit en français : c'est du contenu, pas
  de l'interface.
- Les textes légaux restent des textes provisoires, en attente du juriste.
