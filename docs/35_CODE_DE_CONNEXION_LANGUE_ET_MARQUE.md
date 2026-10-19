# Code de connexion : langue de la personne et marque du réseau — 19 octobre 2026

Constat du 19/10 : le code (e-mail ou SMS) partait dans la langue du déploiement
(`AUTH_DEFAULT_LOCALE`), avec la marque ANTSIA, même quand la personne lisait diasporale.com en
anglais. Suite de docs/33 (§ 5, Limites).

## 1. Le canal de la langue : l'en-tête `Accept-Language`

| Piste | Décision |
|---|---|
| Un champ admis par Better Auth | Écartée. `email-otp/send-verification-otp` valide son corps par un schéma zod (`email`, `type`) qui retire tout autre champ ; `phone-number/send-otp` de même. |
| La langue du compte, si la personne existe | Écartée. À la demande du code, personne n'est connecté : il faudrait chercher un compte par son adresse avant l'envoi, un écart de temps qui trahirait l'existence du compte (contraire au refus indistinct). Le message différerait aussi de la langue de l'écran. La langue du compte s'applique après la connexion (docs/33). |
| Un en-tête relayé par les proxys `/api/auth/*` | **Retenue** : `Accept-Language`. C'est l'en-tête standard de la langue voulue. Il est permis aux scripts et sûr pour CORS : aucun pré-vol à changer. |

Ordre de priorité, du plus fort au plus faible :

1. **La langue choisie.** Chaque application la pose sur sa demande de code : c'est la langue
   affichée.
   - DIASPORALE : l'instance i18next, qui suit le cookie `diasporale-langue` quand il existe.
   - antsia.ga : l'instance i18next de la porte, car antsia.ga n'a pas de cookie de langue.
2. **La langue du navigateur.** Il l'envoie de lui-même quand un client ne pose rien.
3. **`AUTH_DEFAULT_LOCALE`** (`fr` ou `en`), sinon le français.

Le relais n'avait rien à changer. `@antsia/api/auth-proxy`, que les deux applications
réexportent, recopie tous les en-têtes sauf ceux du saut (`x-forwarded-*`, en-têtes de connexion).
`Origin`, `Accept-Language` et le cookie de langue arrivent donc au moteur. Le constat contraire
était inexact ; un test le fige désormais (`auth-proxy.test.ts`).

## 2. La marque : l'origine de la requête

Le moteur la tire lui-même de l'en-tête `Origin`. Le navigateur le pose, et le moteur le vérifie
contre les origines de confiance avant tout envoi.

- L'origine désigne une application du catalogue (`deploy/catalog.json`) : son adresse publique,
  ou son port local quand les outils de développement sont ouverts.
- Une application servie par une tranche porte la marque de son réseau. Le manifeste de la tranche
  la déclare : `convex/modules/diaspora/manifest.ts` donne `diasporale_com` et le nom de la graine,
  `DIASPORALE`.
- Toute autre origine, ou aucune, porte `ANTSIA`.

Le texte ne porte que la marque, le code et sa durée : aucune coordonnée.

## 3. Ce qui change

| Lieu | Changement |
|---|---|
| `ANTSIA/packages/social-contracts/src/authentication.ts` | `localeFromAcceptLanguage`, `otpLocale` (l'ordre ci-dessus), `otpMessage` typé par langue. |
| `ANTSIA/convex/betterAuth/settings.ts` | `applicationOfOrigin` : origine vers application du catalogue. |
| `ANTSIA/convex/betterAuth/delivery.ts` | `otpPresentation` (langue et marque de la requête) ; `deliverOtp` compose avec elles. |
| `ANTSIA/convex/betterAuth/auth.ts` | Les deux rappels d'envoi (e-mail, SMS) passent l'origine et la langue de la requête. |
| `ANTSIA/convex/modules/diaspora/manifest.ts` | `application` et `brand` de la tranche. |
| `ANTSIA/packages/social-features/…/IdentityEntry.tsx` | La porte d'antsia.ga pose la langue affichée sur l'envoi du code (e-mail et SMS). |
| `DIASPORALE/apps/diasporale_com/src/data/engine-source.ts` | `requestCode` pose la langue affichée ; `engine-providers.tsx` la relit à chaque demande, par une référence tenue à jour à chaque rendu. |

## 4. Preuves

- **`bun run --cwd ANTSIA verify`** : code 0, le 19/10 de 22:50 à 23:04, sur l'arbre partagé.
  - Backend : 2 631 tests.
  - Cliquets : 140.
  - Paquets et applications, dont diasporale.com : 1 383 tests.
  - Lint : aucune erreur.
- **Moteur**, sur le vrai gestionnaire Better Auth (convex-test, transport Resend et relais SMS
  simulés) :
  - un code demandé en anglais depuis diasporale.com part en anglais, à la marque DIASPORALE ;
  - en français, préférences régionales comprises ;
  - sans langue : `AUTH_DEFAULT_LOCALE`, sinon le français ;
  - la langue demandée passe devant celle du déploiement ;
  - le SMS suit les mêmes règles.
- **Pile locale** (relais réel, moteur local) :
  - le vrai client Better Auth, avec les greffons des applications, émet `Accept-Language: en` ;
  - le moteur répond `{ success: true }` et enregistre le code.
- **Clients** : la porte d'antsia.ga pose `fr` ou `en` selon la langue affichée ; la source de
  diasporale.com relit la langue à chaque demande, après une bascule, sans être recréée.
- **Défaut trouvé par ce dernier test.** `react-i18next` 16 renvoie une copie figée d'`i18n`
  par langue. Un lecteur qui la garde reste sur la langue du premier affichage. La langue passe
  donc par une référence tenue à jour à chaque rendu (`engine-providers.tsx`).

## 5. Limites

- L'expéditeur (`RESEND_FROM_ADDRESS`) reste celui du déploiement. Un nom d'expéditeur par réseau
  demande un domaine vérifié : décision du propriétaire.
- En développement local, le code est lu sur place (`devTools.latestOtp`) et aucun message n'est
  composé. La composition est prouvée par les tests du vrai gestionnaire Better Auth, transport
  simulé.
- Une origine hors catalogue (préproduction ajoutée par `TRUSTED_ORIGINS`) porte la marque ANTSIA.
- Le SMS sur diasporale.com attend toujours PA4 (`requestCode` refuse le téléphone). Le moteur le
  compose déjà dans la langue et à la marque de la requête.
- Aucune publication en nuage : l'hébergement (A5), le Convex de production et les variables de
  `deploy-app.mjs` relèvent du propriétaire. Le code est servi par la pile locale.
