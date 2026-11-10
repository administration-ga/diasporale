# Plan 01 — Entrée, adhésion et confiance

> Constaté par lecture du code d'`origin/main` (DIASPORALE `bead76d`, ANTSIA `fd58d73b`), le 10 novembre 2026. Rien n'a été exécuté : ni test, ni recette, ni publication.
> Applications de référence : InterNations, Nextdoor, LinkedIn (vérification), Blind, l'entrée sur invitation de Clubhouse, les questions d'adhésion des Groupes Facebook, WhatsApp (entrée par numéro). Comparaison faite de mémoire, sans revérification en ligne ; un « ? » marque ce qui n'est pas sûr.
> Ce plan détaille, pour l'entrée, l'adhésion et la confiance, le plan 15 du dossier de finalisation d'ANTSIA. Les lots qu'il en reprend gardent leur identifiant (DS-…, DG-…) ; les lots nouveaux portent le préfixe `EA-`.

Légende des chemins : `D:` = dépôt DIASPORALE, `A:` = dépôt ANTSIA. « Écran » = atteignable depuis l'interface de diasporale.com ; « Moteur » = la fonction existe côté serveur.

## 1. L'intention du propriétaire

- **Pour qui** : les Gabonais de l'étranger. Entrer en moins de trois minutes, choisir son identifiant, voir tout de suite la vie de son pays (cahier, § 2.1, objectif 1).
- **Officiel mais ouvert** : trois portes. IDN affichée en premier, le compte léger par code, l'attestation consulaire à la demande. L'inscription consulaire est une élévation du compte, pas un prérequis (cahier, § 6.2 ; dossier produit, fiche F01).
- **Un statut jamais saisi** : en attente, déclarée, vérifiée se dérivent de faits relus à chaque acte. Quatre badges calculés côté serveur, jamais payants (cahier, § 5, invariant 8 ; ADR-0002 d'ANTSIA).
- **Parrainage** : un parrain vérifié depuis plus de 30 jours, dix parrainages par 30 jours, le compte en attente lit sans publier. Valeurs de l'arbitrage A3, retenues par défaut (docs/01 de DIASPORALE).
- **Aucune donnée consulaire** : consulat.ga atteste un oui ou un non, un pays, un poste, une date, avec le consentement de la personne ; il n'est pas fournisseur d'identité (cahier, § 5, invariant 4 ; A4 ; ADR-0002).
- **Rien d'office** : aucun profil, aucune adhésion sans geste ; consentements un par un, jamais précochés, révocables (invariant 5 ; EXF-DG-02, EXF-DG-44).
- **Une personne, un identifiant** : entrer dans DIASPORALE crée l'adhésion ANTSIA ; quitter DIASPORALE ne la retire pas ; une suspension à la racine vaut partout (invariant 3).
- **Une seule porte**, comme l'accueil d'ANTSIA ; le code part dans la langue affichée et à la marque du réseau (décisions du 19/10 ; docs/11 et docs/35 de DIASPORALE).
- **La communauté amène vers IDN et vers le consulat** : part des comptes légers qui s'élèvent sous 90 jours, cible indicative au-dessus de 15 % (cahier, § 2.2 et § 2.3).
- **Refusé** : le mot de passe ; un badge qui s'achète ; les comptes de démonstration en production (ADR-0038) ; tout élargissement aux mineurs sans décision (D-G11) ; un profil créé à partir de la base consulaire.

## 2. Ce qui existe

| # | Capacité | État | Écran | Moteur | Preuve |
|---|---|---|---|---|---|
| | **La porte** | | | | |
| 1 | Porte unique pour `/` et `/entrer`, intention « se connecter » ou « créer un compte » | Présent | oui | — | `D:apps/diasporale_com/src/screens/landing-screen.tsx`, `D:apps/diasporale_com/src/components/entry-door.tsx` |
| 2 | Vision sous la porte et pays ouverts, sans chiffre | Présent | oui | oui | `D:apps/diasporale_com/src/components/door-vision.tsx`, `D:apps/diasporale_com/src/components/open-countries.tsx` |
| 3 | Code par e-mail : six chiffres, trois essais, usage unique | Fermé en production : il faut les clés d'envoi du courriel (`RESEND_API_KEY`, `RESEND_FROM_ADDRESS`). Ouvert en local et pour les adresses réservées de la démonstration | oui | oui | `D:apps/diasporale_com/src/data/engine-source.ts` (`requestCode`, `verifyCode`), `A:convex/betterAuth/auth.ts` (`emailOTP`) |
| 4 | Code composé dans la langue affichée, à la marque DIASPORALE | Présent | — | oui | `A:convex/betterAuth/delivery.ts` (`otpPresentation`), `A:convex/modules/diaspora/manifest.ts` |
| 5 | Courriel envoyé depuis une adresse propre à DIASPORALE | Absent : un seul expéditeur par déploiement | non | non | `A:convex/betterAuth/delivery.ts` ; docs/35 de DIASPORALE, § 5 |
| 6 | Durée de validité du code dite à l'écran | Partiel : l'écran dit « 10 minutes », le moteur expire le code à 5 | oui | oui | `D:packages/diasporale-features/src/i18n/locales/fr/diasporale.json` (`code.lead`), `A:convex/betterAuth/auth.ts` (`OTP_TTL_SECONDS`) |
| 7 | Renvoyer le code, avec un délai d'attente | Absent ici ; le moteur l'a | non : seul « Changer d'adresse » | oui | `D:apps/diasporale_com/src/screens/enter-screens.tsx`, `A:packages/social-features/src/features/identity/IdentityEntry.tsx` (`RESEND_COOLDOWN_MS`) |
| 8 | Reprendre la saisie du code après un rechargement | Absent : l'adresse en attente ne vit qu'en mémoire | non | — | `D:apps/diasporale_com/src/data/engine-source.ts` (`pendingEmail`) |
| 9 | Code par SMS | Absent ici ; le moteur l'a, fermé sans passerelle | démonstration seulement | oui | `D:apps/diasporale_com/src/data/engine-source.ts` (`requestCode` refuse le téléphone), `A:convex/betterAuth/auth.ts` (`phoneNumber`) |
| 10 | Entrée par IDN | Absent ici ; le moteur l'a | non : bouton désactivé, « disponible prochainement » ; l'écran `/entrer/idn` n'est qu'une simulation de démonstration | oui | `D:apps/diasporale_com/src/screens/landing-screen.tsx` (`IdnEntry`), `D:apps/diasporale_com/src/data/engine-source.ts` (`signInWithIdn`), `A:convex/betterAuth/auth.ts` (`genericOAuth`) |
| 11 | Portes affichées selon ce que le déploiement sait vraiment servir | Absent ici ; le moteur l'a | non | oui | `A:convex/modules/platform/authentication.ts` (`configuration`) ; aucun appel dans DIASPORALE |
| 12 | Limites de débit : trois envois de code par cinq minutes, cinq connexions par quinze minutes | Présent | — | oui | `A:convex/lib/rateLimit.ts` (`auth.otp.send`, `auth.login`) |
| 13 | Clé d'accès ; appel vocal pour le code | Absent | non | non | motifs : `passkey`, `webauthn`, `voiceCall` |
| 14 | Session déjà ouverte renvoyée au fil ou à l'accueil ; avis de déconnexion incomplète | Présent | oui | oui | `D:apps/diasporale_com/src/screens/enter-screens.tsx` (`useLeaveEntryWhenSignedIn`) |
| | **L'accueil du nouveau membre** | | | | |
| 15 | Trois écrans : pays et ville, nom et identifiant, consentements | Présent | oui | oui | `D:apps/diasporale_com/src/screens/welcome-screen.tsx`, `A:convex/modules/diaspora/membership.ts` (`joinDiasporale`) |
| 16 | Pays de résidence obligatoire, Gabon refusé | Présent | oui | oui | `D:packages/diasporale-domain/src/countries.ts` (`parseResidenceCountry`) |
| 17 | Avis « ce pays n'est pas encore ouvert » | Partiel : le texte promet une relecture ; l'écran refuse la publication locale, et la publication ne lit pas l'ouverture du pays côté serveur | oui | non | `D:apps/diasporale_com/src/screens/welcome-screen.tsx`, `D:apps/diasporale_com/src/data/engine-source.ts` (`publish`) |
| 18 | Identifiants proposés, aucun présélectionné | Présent | oui | oui | `A:convex/modules/people/profile.ts` (`suggestHandles`) |
| 19 | Identifiant vérifié pendant la saisie | Partiel : vérifié au bouton « Suivant » seulement | oui | oui | `D:apps/diasporale_com/src/screens/welcome-screen.tsx` (`checkHandle`) |
| 20 | Consentements un par un, jamais précochés, version du texte gardée | Présent | oui | oui | `D:packages/diasporale-domain/src/consents.ts`, `A:convex/modules/people/consents.ts` |
| 21 | Niveau d'annuaire choisi à l'entrée, masqué par défaut | Présent | oui | oui | `A:convex/modules/diaspora/membership.ts` (`joinDiasporale`) |
| 22 | Adhésion ANTSIA dérivée créée à l'entrée | Présent | oui | oui | `A:convex/modules/people/admission.ts` (`admitToNetwork`) |
| 23 | Entrée d'une personne qui a déjà un profil ANTSIA | Partiel : l'accueil redemande nom et identifiant sans rien préremplir ; valider réécrit le profil commun et efface son accroche | oui | oui | `D:apps/diasporale_com/src/screens/welcome-screen.tsx`, `D:apps/diasporale_com/src/data/engine-source.ts` (`join`), `A:convex/modules/people/profile.ts` (`publishMyProfile`) |
| 24 | Retour après un départ | Partiel : même accueil vierge, mêmes effets | oui | oui | `D:apps/diasporale_com/src/components/gate.tsx` |
| 25 | Entrée en une seule écriture | Partiel : trois à cinq écritures successives ; un échec au milieu laisse un profil publié sans adhésion | oui | oui | `D:apps/diasporale_com/src/data/engine-source.ts` (`join`) |
| 26 | Déclaration d'âge | Absent | non | non | motifs : `dateOfBirth`, `birth`, `majeur`, `minAge` |
| 27 | Déclaration « Gabonais de l'étranger » ; règles de la communauté acceptées | Absent | non | non | motifs : `communityRules`, `acceptRules`, `rulesAccepted` |
| 28 | Fiche d'identification du titulaire (ordonnance 0011, art. 4) | Absent : attend le juriste (SU01b du moteur) | non | non | plan 12 du moteur |
| 29 | Accueil guidé après l'entrée (photo, pages du pays, notifications) | Absent : un seul avis de bienvenue sur le hub | non | — | `D:apps/diasporale_com/src/screens/hub-screen.tsx` |
| 30 | Sortir de l'accueil sans être membre | Présent : « Se déconnecter partout » | oui | oui | `D:apps/diasporale_com/src/screens/welcome-screen.tsx` (`WelcomeSignOut`) |
| 31 | Exporter ses données ou supprimer son compte sans adhésion | Absent ici : les réglages exigent l'adhésion ; le moteur sert ces droits à toute personne | non | oui | `D:apps/diasporale_com/src/screens/settings-screen.tsx`, `D:apps/diasporale_com/src/data/engine-data-rights.ts` |
| | **Statut et badges** | | | | |
| 32 | Statut dérivé des faits : en attente, déclarée, vérifiée | Présent | oui | oui | `D:packages/diasporale-domain/src/eligibility.ts` (`deriveMembershipStatus`), `A:convex/modules/diaspora/facts.ts` (`applyDerivedStatus`) |
| 33 | Une identité IDN étrangère n'ouvre pas la porte à elle seule | Présent | — | oui | `D:packages/diasporale-domain/src/engine.ts` (`idnGroundFromLink`) |
| 34 | Statut relu quand l'identité change hors de la tranche (IDN liée, niveau relevé, lien révoqué) | Absent : la réconciliation du moteur saute les réseaux gouvernés | non | non | `A:convex/modules/people/identity.ts` (`reconcileMemberships`) |
| 35 | Droits par statut : lire, publier, communiquer, créer une page, parrainer | Présent | oui | oui | `D:packages/diasporale-domain/src/eligibility.ts` (`capabilitiesOf`) |
| 36 | Suspension à la racine valant partout | Présent | oui | oui | `A:convex/modules/diaspora/facts.ts` (`effectiveStatusIn`) |
| 37 | Quatre badges calculés côté serveur | Présent | oui | oui | `D:packages/diasporale-domain/src/badges.ts`, `A:convex/modules/diaspora/membership.ts` (`myMembership`) |
| 38 | Explication d'un badge | Partiel : infobulle au survol, rien au doigt | oui | — | `D:packages/diasporale-features/src/components/trust-badge.tsx` |
| 39 | Carte de statut avec ses chemins | Présent | oui | — | `D:packages/diasporale-features/src/components/membership-status-banner.tsx`, `D:apps/diasporale_com/src/components/status-banner.tsx` |
| 40 | Dire ce qu'un badge « Vérifié » ne donne pas encore à un compte « déclaré » | Partiel : le texte ne dit pas que créer une page et parrainer restent fermés | oui | — | `D:packages/diasporale-features/src/i18n/locales/fr/diasporale.json` (`status.declaredVerifiedBody`) |
| 41 | Devenir « vérifiée » sans l'attestation consulaire, au lancement | Absent : aucune admission par décision du réseau ; la source `operator` du moteur n'est employée nulle part | non | non | `A:packages/social-domain/src/membership.ts` (`VERIFICATION_SOURCES`), `D:packages/diasporale-domain/src/eligibility.ts` |
| | **Le compte en attente** | | | | |
| 42 | Lire le réseau sans publier ni écrire | Présent | oui | oui | `A:convex/lib/functions.ts` (`networkQuery`), `D:packages/diasporale-domain/src/eligibility.ts` |
| 43 | Bouton Publier qui explique le refus et donne les deux chemins | Présent | oui | — | `D:apps/diasporale_com/src/components/app-shell.tsx` (`publishRefusal`) |
| 44 | Aide « obtenir un parrainage » : identifiant à copier | Présent | oui | — | `D:apps/diasporale_com/src/screens/settings-screen.tsx` (`SponsorHelpSection`) |
| 45 | Lien ou code QR de demande de parrainage à partager | Absent | non | non | motifs, dans les écrans et fonctions du parrainage : `inviteLink`, `qr` |
| 46 | Limite de durée ou de portée de lecture d'un compte en attente | Absent | non | non | motifs : `expirePending`, `pendingExpir` |
| | **Le parrainage** | | | | |
| 47 | Parrainer par identifiant | Présent | oui | oui | `D:apps/diasporale_com/src/screens/sponsor-attestation-screens.tsx` (`SponsorScreen`), `A:convex/modules/diaspora/membership.ts` (`sponsor`) |
| 48 | Seuils codés : parrain vérifié depuis plus de 30 jours, dix par 30 jours glissants, un seul parrain suffit | Présent | oui | oui | `D:packages/diasporale-domain/src/sponsorship.ts` (`checkSponsorship`) |
| 49 | Refus indistinct de la cible | Présent | oui | oui | `A:convex/modules/diaspora/membership.ts` (`sponsor`) |
| 50 | Tableau du parrain : quota restant, date d'ancienneté, journal | Présent | oui | oui | `A:convex/modules/diaspora/membership.ts` (`sponsorDashboard`) |
| 51 | Retrait par le parrain ; statut du filleul relu | Présent | oui | oui | `A:convex/modules/diaspora/membership.ts` (`revokeSponsorship`) |
| 52 | Retrait par la modération, motivé et journalisé | Partiel : fonction prête, aucun écran ; l'application n'envoie pas de motif | non | oui | `A:convex/modules/diaspora/membership.ts` (`revokeSponsorship`), `D:apps/diasporale_com/src/data/engine-source.ts` |
| 53 | Avis au filleul : parrainage reçu, parrainage retiré | Présent | oui | oui | `A:convex/modules/diaspora/membership.ts` (avis `sponsorship_received`, `sponsorship_withdrawn`) |
| 54 | Inviter une personne qui n'a pas encore de compte (lien à usage borné) | Absent | non | non | motifs : `sponsorInvit`, `inviteCode` |
| 55 | Parrainage éteint au départ, à rejouer au retour | Présent | oui | oui | `A:convex/modules/diaspora/facts.ts` (`endSponsorshipOnDeparture`) |
| | **L'attestation consulaire, côté membre** | | | | |
| 56 | Écran de consentement : ce qui est demandé, reçu, jamais reçu | Présent | oui | — | `D:apps/diasporale_com/src/screens/sponsor-attestation-screens.tsx` (`AttestationScreen`) |
| 57 | Demande signée, réponse relue en liste blanche, empreinte du sujet seule | Fermé : sans `DIASPORA_ATTESTATION_URL`, `DIASPORA_PARTNER_KEY_ID` et `DIASPORA_PARTNER_KEY`, la demande finit en échec technique | oui | oui | `A:convex/modules/diaspora/attestation.ts` (`callAttestation`) |
| 58 | Quatre issues : en cours, confirmée, non confirmée sans raison, échec | Présent | oui | oui | `A:convex/modules/diaspora/tables.ts` (`ATTESTATION_RESULTS`) |
| 59 | Une demande par 24 heures | Partiel : la règle tient, la date de la prochaine tentative n'est pas montrée | oui | oui | `D:packages/diasporale-domain/src/attestation.ts` (`canRequestAttestation`) |
| 60 | Sujet présenté : IDN d'abord, sinon l'empreinte de l'e-mail vérifié | Présent | — | oui | `A:convex/modules/diaspora/attestation.ts` (`subjectOf`) |
| 61 | Poste consulaire posé sur la facette ; pays seulement s'il manquait | Présent | oui | oui | `D:packages/diasporale-domain/src/facet.ts` (`applyAttestationToFacet`) |
| 62 | Avis dans la cloche : confirmée, non confirmée | Présent | oui | oui | `A:convex/modules/diaspora/attestation.ts` (`recordAttestation`) |
| 63 | Expiration ou revérification périodique | Absent : une attestation confirmée vaut sans limite | non | non | motifs dans la tranche : `reverify`, `expires` |
| 64 | Révocation venue de consulat.ga | Absent : l'évènement `attestation_revoked` n'existe que dans le domaine | non | non | `D:packages/diasporale-domain/src/eligibility.ts` ; aucun consommateur dans la tranche |
| 65 | Retrait du consentement | Partiel : il empêche une nouvelle demande ; le lien d'identité et le statut « vérifiée » restent | oui | oui | `A:convex/modules/people/consents.ts` (`revokeConsent`), `D:apps/diasporale_com/src/screens/settings-screen.tsx` |
| 66 | Rattacher son poste quand on est déjà vérifié par une autre voie | Absent : refus « déjà vérifié » | non | non | `A:convex/modules/diaspora/attestation.ts` (`requestConsularAttestation`) |
| 67 | Fournisseur de démonstration de l'attestation | Présent | oui | — | `D:packages/diasporale-features/src/demo/attestation-provider.ts` |
| | **L'élévation du compte** | | | | |
| 68 | Bannières « Activer mon identité IDN » et « M'inscrire au consulat » | Partiel : liens sortants simples, affichés seulement si l'adresse est fournie à la construction ; aucun retour, aucune relecture du statut | oui | — | `D:apps/diasporale_com/src/components/status-banner.tsx`, `D:apps/diasporale_com/src/lib/env.ts` |
| 69 | Rattacher IDN à un compte léger déjà ouvert | Absent ici ; le moteur l'a | non | oui | `A:apps/antsia_ga/src/components/identity-tools.tsx` (`authClient.oauth2.link`) |
| 70 | « Rejoindre DIASPORALE » depuis consulat.ga | Absent (plan 15) | non | non | cahier, EXF-DG-06 |
| | **Pays de résidence** | | | | |
| 71 | Changer de pays ou de ville dans les réglages | Présent | oui | oui | `A:convex/modules/diaspora/facet.ts` (`updateMyFacet`) |
| 72 | Garde contre les changements de pays répétés | Partiel : seul le seau `person.facet` borne ; ni délai, ni confirmation, ni journal | oui | oui | `A:convex/modules/diaspora/facet.ts` |
| 73 | Effet d'un déménagement sur le poste consulaire attesté | Absent : le poste reste celui de l'ancien pays | non | non | `D:packages/diasporale-domain/src/facet.ts` (`parseFacetInput`) |
| 74 | Retour au Gabon | Absent : le pays GA est refusé ; seule issue, quitter DIASPORALE | non | non | `D:packages/diasporale-domain/src/countries.ts`, `A:convex/modules/diaspora/membership.ts` (`leaveDiasporale`) |
| | **Sortie, sessions, compte** | | | | |
| 75 | Se déconnecter partout : révocation serveur, puis purge locale | Présent | oui | oui | `D:apps/diasporale_com/src/components/sign-out-settings.tsx`, `A:packages/api/src/sign-out-everywhere.ts` |
| 76 | Session de sept jours, relue côté serveur à chaque accès | Présent | — | oui | `A:convex/betterAuth/auth.ts` |
| 77 | Liste des appareils, fermer une seule session, alerte de nouvelle connexion | Absent, ici et dans le moteur (CN-03, CN-04) | non | non | motifs : `listSessions`, `revokeSession` |
| 78 | Voir son moyen de connexion, en ajouter un second, en changer | Absent (CN-05) : l'adresse masquée est prévue dans la vue du compte, jamais montrée | non | non | `D:packages/diasporale-features/src/data/types.ts` (`AccountView`) |
| 79 | Quitter DIASPORALE en gardant ANTSIA | Présent | oui | oui | `D:apps/diasporale_com/src/screens/settings-screen.tsx`, `A:convex/modules/diaspora/membership.ts` (`leaveDiasporale`) |
| 80 | Passer à ANTSIA sans se reconnecter, et en revenir | Absent ici ; le moteur a la brique | non | oui | `A:packages/api/src/use-sso-navigate.ts` ; motif dans DIASPORALE : `useSsoNavigate` |
| | **Comptes de démonstration** | | | | |
| 81 | Vingt acteurs, entrée en un appui par le vrai code | Présent : en local et sur la démonstration déclarée seulement | oui | oui | `D:packages/diasporale-domain/src/demo-accounts.ts`, `D:apps/diasporale_com/src/components/demo-accounts-panel.tsx`, `A:convex/modules/diaspora/demoAccounts.ts` |
| 82 | Production fermée par construction | Présent | — | oui | `A:convex/lib/devTools.ts` (`demoAccountsAllowed`) |
| 83 | Parcours à blanc R1, R2, R3, sans moteur | Présent | oui | — | `D:apps/diasporale_com/src/screens/demo-screen.tsx` |
| 84 | Remise à zéro des comptes partagés de la démonstration en ligne | Absent (EX-15 du moteur) | non | non | ADR-0038 d'ANTSIA |

Décompte : **Présent 41 · Partiel 13 · Absent 28 · Fermé 2**. Sur les 28 absences, 7 existent déjà dans le moteur (lignes 7, 9, 10, 11, 31, 69, 80) : ce sont les gains rapides.

### Ce que le moteur sait déjà faire et que DIASPORALE ne montre pas

- **Entrer par IDN** : en production sur le réseau racine depuis le 20/10 (docs/25 d'ANTSIA). Le client d'authentification de DIASPORALE est déjà celui du moteur, greffon IDN compris (`A:packages/api/src/auth-client.ts`) ; le retour entre origines est adopté par l'amorce commune (`A:packages/api/src/cross-domain-session-bootstrap.ts`). Il ne manque que l'appel.
- **Recevoir le code par SMS** : même client, numéros de tous pays admis (`A:convex/betterAuth/settings.ts`, `isE164Phone`).
- **N'afficher que les portes ouvertes**, avec un renvoi temporisé : `A:convex/modules/platform/authentication.ts` et `A:packages/social-features/src/features/identity/IdentityEntry.tsx`.
- **Rattacher IDN à un compte léger** : `A:apps/antsia_ga/src/components/identity-tools.tsx`.
- **Exercer ses droits sans être membre** : ANTSIA sert « Mes données » hors de la coque (`A:apps/antsia_ga/src/app/mes-donnees/page.tsx`) ; l'adaptateur de DIASPORALE lit déjà des fonctions à la personne.
- **Passer d'une application à l'autre** par un jeton à usage unique : `A:packages/api/src/use-sso-navigate.ts`.
- **Tracer un code QR opaque** : `A:packages/social-features/src/features/qr/OpaqueQrCode.tsx`.

### Ce qui est écrit mais jamais recetté en réel

| Recette | État | Source |
|---|---|---|
| Code reçu dans une vraie boîte, à la marque DIASPORALE | Jamais : composition prouvée par tests, transport simulé | docs/35 de DIASPORALE, § 5 |
| Entrée par IDN dans DIASPORALE | Impossible aujourd'hui : non branchée | lignes 10 et 11 du tableau |
| Attestation réelle avec consulat.ga (parcours R2) | Jamais : faux consulat de test seulement | docs/01 de DIASPORALE, ligne PD3 |
| Parrainage par un vrai parrain vérifié depuis 30 jours | Jamais : joué en local le 15/10 avec un parrain rendu vérifié par la graine | docs/01 de DIASPORALE, ligne PD2 |
| Comptes de démonstration par acteur | Joués en local le 19/10 et en ligne sur la démonstration le 22/10 | docs/34 de DIASPORALE ; recette `demo-en-ligne-2026-10-22` |
| Sortie depuis l'accueil et refus d'accès dits tels quels | Vus en démonstration seulement | dossier de reprise, § 10.2 |
| Changement de pays, départ puis retour, retrait d'un consentement | Aucune recette consignée | — |

## 3. Comparaison avec les applications de référence

| Capacité | InterNations | Nextdoor | LinkedIn | Blind | Clubhouse (à ses débuts) | Groupes Facebook privés | WhatsApp | DIASPORALE | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Entrer sans mot de passe | non | ? | non, clé d'accès possible | non ? | oui, code par SMS | compte Facebook | oui | oui, par e-mail | Déjà fait ; À recetter (EA-06) |
| Entrer par une identité officielle | non | non | pièce vérifiée par un tiers | non | non | non | non | IDN : le moteur l'a, pas l'écran | À faire (EA-02) |
| Code par SMS | non ? | oui, téléphone vérifié | second facteur | non | oui | — | oui | démonstration seulement | À faire (EA-12) |
| Renvoyer le code après un délai | — | oui ? | oui | oui ? | oui | — | oui, appel vocal aussi | non | À faire (EA-08) ; appel vocal écarté |
| Connexion par Google ou Apple | oui ? | oui | oui | ? | ? | — | non | non | Écarté (ADR-0002 : IDN seul fournisseur) |
| Clé d'accès | ? | ? | oui | ? | — | oui | oui | non | Reporté (EA-15, après CN-14) |
| Admission contrôlée | approbation par l'équipe | adresse vérifiée | non | e-mail professionnel | invitation | approbation par les administrateurs | non | statut dérivé : parrainage, attestation | Déjà fait ; amorçage À faire (EA-01) |
| Un membre se porte garant | invitation d'un membre ? | un voisin vérifié confirme ? | non | non | oui, parrain affiché | invitation | non | parrainage tracé, quota, refus indistinct | Déjà fait |
| Lien d'invitation | oui ? | oui | oui | ? | par numéro | oui | oui | non | À faire (EA-11) |
| Code QR à montrer ou à partager | non ? | ? | oui | — | — | ? | oui | non | À faire (EA-10) |
| Attente avec accès limité | accès après approbation | rien n'est lisible avant vérification | — | lecture limitée ? | liste d'attente | rien de lisible avant admission | — | en attente : lit tout le réseau | À adapter (EA-10, EA-18) |
| Questions ou déclaration à l'entrée | nationalité, pays de résidence | adresse | — | employeur | — | jusqu'à trois questions | — | pays et ville seulement | À faire (EA-13) |
| Règles acceptées à l'entrée | conditions | engagement de bon voisinage | conditions | conditions | règles de la communauté ? | règles du groupe | conditions | non | À faire (EA-13) |
| Porte d'âge | oui, 18 ans ? | oui, 13 ans ? | oui, 16 ans | oui ? | oui, 18 ans ? | 13 ans | 13 ans | non | À faire (EA-07, juriste) |
| Badge de vérification gratuit | non | voisin vérifié | oui | implicite | non | — | comptes d'entreprise | quatre badges calculés | Déjà fait |
| Raison du badge lisible | ? | ? | oui | — | — | — | — | au survol seulement | À adapter (EA-17) |
| Passer de non vérifié à vérifié | — | vérifier son adresse | ajouter une vérification | — | — | — | — | bannières sans effet | À faire (EA-09) |
| Compte existant reconnu, sans double saisie | — | — | — | — | — | profil Facebook repris | — | profil ANTSIA redemandé et réécrit | À faire (EA-04) |
| Accueil guidé : photo, personnes, groupes | oui | oui | oui | ? | oui | — | non | non | À adapter (EA-17), sans profilage |
| Changer de lieu | changer de communauté | nouvelle vérification d'adresse | libre | revérifier l'employeur | — | — | changer de numéro | libre, sans garde | À adapter (EA-14) |
| Vérification qui expire | — | à chaque déménagement | — | revérification périodique ? | — | — | — | jamais | À faire (EA-16) |
| Preuve officielle d'inscription ou de résidence | non | adresse postale | non | non | non | non | non | attestation consulaire consentie, fermée | À faire (DG-009a) |
| Appareils connectés, fermer une session | ? | ? | oui | ? | ? | oui | oui, appareils liés | « partout » seulement | À faire (EA-15) |
| Alerte de nouvelle connexion | ? | ? | oui | ? | ? | oui | oui | non | À faire (EA-15) |
| Changer d'e-mail ou de numéro | oui | oui | oui | oui | oui | oui | oui | non | À faire (EA-15) |
| Supprimer son compte | oui | oui | oui | oui | oui | quitter le groupe | oui | membres seulement | À faire (EA-05) |
| Passer d'un produit de la même maison à l'autre sans se reconnecter | — | — | — | — | — | oui | — | non | À faire (EA-19) |
| Adhésion payante pour l'accès complet | oui | non | non | non | non | non | non | non | Écarté (le citoyen ne paie jamais) |
| Plusieurs comptes | non | non | non | — | non | profils multiples | deux comptes | non | Écarté (une personne, un identifiant) |
| Trouver ses proches par le carnet d'adresses | ? | oui | oui | non | oui | oui | oui | non | Écarté (aucune coordonnée exposée ; PF-18 du moteur, sous avis du juriste) |

## 4. Ce qui manque

### 4.1 Bloquant avant l'ouverture du pilote

1. **Personne ne peut devenir « vérifiée » au premier jour.** La règle exige l'attestation consulaire, ou IDN de niveau 2 plus un parrainage. L'attestation est fermée (clés, contrat, juriste). Le parrainage exige un parrain vérifié depuis plus de 30 jours : il n'en existe aucun au lancement. Or seule une personne vérifiée crée une page ou parraine. Sans décision, les comptes entrés par e-mail restent en lecture seule ; même avec IDN branchée, un membre reste « déclarée » : il publie, mais aucune association ne peut ouvrir sa page (EA-01).
2. **IDN est annoncée, pas branchée.** La porte dit « disponible prochainement ». Le parcours R1 du cahier est impossible, alors que le moteur sert IDN (EA-02).
3. **Le statut ne se relit pas** quand l'identité change hors de la tranche (EA-03).
4. **Un membre d'ANTSIA qui entre dans DIASPORALE voit son profil commun réécrit** et son accroche effacée (EA-04).
5. **Un compte sans adhésion est enfermé** : ni export, ni suppression depuis diasporale.com (EA-05).
6. **L'entrée réelle n'a jamais été prouvée** : aucun code reçu dans une vraie boîte ; en production, la porte e-mail reste fermée sans clés (EA-06, avec CN-02 du moteur).
7. **Âge et identification** : DIASPORALE a son propre écran d'accueil ; les étapes que le moteur prévoit pour ANTSIA ne s'y monteront pas seules (EA-07, juriste).

Hors de ce plan, mais bloquant pour lui : aucune fonction ne nomme le premier administrateur ou modérateur du réseau en production (plans 14 et 17).

### 4.2 Fonctions attendues qui manquent

- Le code par SMS (EA-12) et le renvoi du code (EA-08).
- Rattacher IDN à son compte léger, avec un effet immédiat sur le statut (EA-09).
- Un lien et un code QR pour demander un parrainage ; une invitation pour quelqu'un qui n'a pas encore de compte (EA-10, EA-11). C'est par là que les groupes WhatsApp existants peuvent venir.
- L'attestation consulaire réelle (DG-009a) et son cycle de vie (EA-16).
- Une déclaration d'entrée et des règles acceptées (EA-13).
- Voir ses appareils, être prévenu d'une connexion, changer d'e-mail (EA-15).

### 4.3 Options qui manquent sur ce qui existe

- **Code** : renvoi, durée exacte, reprise après rechargement, message de débit avec le délai restant.
- **Accueil** : identifiant vérifié pendant la saisie ; année d'arrivée proposée dès l'entrée (elle sert l'entraide) ; reprise à l'étape en cours.
- **Parrainage** : adresse `/parrainer` préremplie par un lien ; case « je connais cette personne » ; retrait par la modération depuis un écran.
- **Attestation** : date de la prochaine tentative ; date affichée qui soit celle de l'attestation, pas celle de la demande ; rattacher son poste quand on est déjà vérifié ; revérifier après un déménagement.
- **Pays** : confirmation avant de changer, avec ce que cela change ; délai entre deux changements.
- **Session** : fermer cet appareil seulement.
- **Badges** : explication au doigt ; ce qui reste fermé à un compte déclaré.

### 4.4 Améliorations de l'existant

- **Textes faux ou flous** : « valable 10 minutes » ; « IDN prochainement » ; « vos publications locales sont relues » ; l'erreur d'attestation qui ne dit pas quand réessayer.
- **Entrée en plusieurs écritures** : la rendre reprenable, ou la réunir côté serveur.
- **Écran de vérification** montré à un membre déjà vérifié par une autre voie, qui se voit ensuite refuser.
- **Liens d'élévation absents** tant que les deux adresses publiques ne sont pas fournies à la construction : à inscrire au dossier de mise en production (DS-06).
- **Retrait du consentement à l'attestation** : dire clairement ce qu'il fait, puis lui donner l'effet décidé (EA-16).

### 4.5 Ce qui distingue DIASPORALE

- Un statut dérivé de faits relus, jamais saisi, avec un seul chemin de calcul.
- Une preuve officielle minimale et consentie : aucune des références n'a d'équivalent.
- Un parrainage tracé, plafonné, retirable, qui n'apprend rien sur la personne visée.
- Quatre badges gratuits, calculés, qu'aucun champ ne peut usurper.
- Des consentements séparés, jamais précochés, avec la version du texte.
- Un code à la marque du réseau et dans la langue de la personne.
- Vingt comptes de démonstration qui passent par les vraies portes.

### 4.6 Écarté ou reporté, et pourquoi

Les verdicts « Écarté » du § 3 valent ici (mot de passe et connexion par Google ou Apple, comptes multiples, adhésion payante, carnet d'adresses). S'y ajoutent :

| Sujet | Raison |
|---|---|
| Appel vocal pour le code | Coût par pays, aucune demande constatée |
| Second facteur propre | IDN porte son code ; pour un compte léger, la clé d'accès (CN-14) |
| consulat.ga comme fournisseur d'identité | ADR-0002, option B écartée |
| Récupération d'un compte par l'assistance | Risque d'usurpation (plan 06 du moteur, décision D6) |
| Clé d'accès | Reportée après CN-14 du moteur ; jamais pour créer un compte ni porter un badge |

## 5. Lots d'implémentation

Zone de la session S2 : le dépôt DIASPORALE et, dans ANTSIA, `convex/modules/diaspora/`. Toute nouvelle table, tout nouveau seau de débit, tout genre d'avis, toute finalité de consentement, toute action d'audit, toute ligne de tâche planifiée et tout écran de la console passent par une issue [S1] (`A:convex/modules/people/dataPolicies.ts`, `A:convex/lib/rateLimit.ts`, `A:packages/social-domain/src/audit.ts`).

Règle commune à tous les lots nouveaux : le fournisseur de démonstration sert la même capacité (D-G13) ; les textes vont dans un fragment français et anglais propre au chantier (D-G14) ; chaque écriture a son seau (D-G15) et son idempotence (D-G16) ; les avis restent neutres ; toute donnée nouvelle entre à l'export et à l'effacement. Aucun objet de ce plan n'est un contenu signalable ; le parrainage abusif se traite au bureau de modération (EA-18).

### EA-01 — Amorcer la confiance : membres fondateurs admis par décision tracée · P0 · M · S2
- **Pour l'utilisateur** : au premier jour, des responsables d'association et des membres connus sont « vérifiés » ; ils créent leur page et parrainent.
- **Backend** : un fait nouveau, « admission par décision du réseau », dans `D:packages/diasporale-domain/src/eligibility.ts` (il vérifie ; source `operator`). Table des admissions (nom convenu avec S1) et fonctions d'opérateur dans la tranche (admettre, retirer, lister) : motif obligatoire, cohorte plafonnée, option « dispense d'ancienneté pour parrainer ». `membershipGrounds` le lit. Issue [S1] : politique de données, action d'audit, seau, écran de la console.
- **Web** : aucun écran de membre ; statut et badge suivent. Le texte d'aide du badge dit cette voie. Démonstration : un acteur fondateur.
- **Mobile** : sans objet.
- **Données personnelles** : la décision (date, motif) entre dans l'export de la personne admise et s'efface avec elle.
- **Tests et cliquets** : admission puis parrainage immédiat si la dispense est accordée ; retrait qui fait retomber le statut selon les faits restants ; refus hors opérateur ; plafond tenu ; `network-scoped-functions`.
- **Critères d'acceptation** : sur un backend local sans attestation, un compte entré par e-mail devient « vérifiée » par décision, crée une page, parraine un second compte ; chaque geste est au journal.
- **Dépend de** : décision 1 ; console du moteur (plan 13).
- **Porte** : décision du propriétaire (qui, combien, dispense, badge affiché).

### EA-02 — Entrée par IDN branchée dans DIASPORALE · P0 · M · S2
- **Pour l'utilisateur** : « Continuer avec IDN » fonctionne ; le parcours R1 du cahier devient possible.
- **Backend** : aucun code ; le moteur sert IDN par un retour central.
- **Web** : `signInWithIdn` appelle le client du moteur (fournisseur `idn`, retour sur `/bienvenue`) ; une lecture du port expose les portes ouvertes (`platform/authentication.configuration`) et la porte n'active que celles-là ; « disponible prochainement » ne reste que si la porte est fermée ; `/entrer/idn` reste à la démonstration.
- **Mobile** : avec le plan 16 (retour natif, ADR-0031).
- **Données personnelles** : aucune nouvelle ; aucun nom civil recopié.
- **Tests et cliquets** : bouton actif seulement si la configuration le dit ; refus traduit ; arrivée avec jeton à usage unique ; démonstration inchangée ; `no-hardcoded-urls`.
- **Critères d'acceptation** : sur un déploiement où IDN est configuré, une identité gabonaise entre, saisit son pays et arrive « déclarée », avec le badge si son niveau le permet ; une identité étrangère reste « en attente ».
- **Dépend de** : EA-03 ; décision 2 ; origine de DIASPORALE parmi les origines de confiance (DS-06).
- **Porte** : variables IDN et origines sur le déploiement (propriétaire) ; recette avec un vrai compte IDN.

### EA-03 — Statut relu quand l'identité change · P0 · S · S2
- **Pour l'utilisateur** : lier IDN, gagner un niveau ou perdre un lien change le statut sans attendre.
- **Backend** : `refreshMyMembership` dans la tranche (relit les faits, applique la règle, seau `network.join`) ; `myMembership` dit si le statut enregistré diffère du statut attendu. Issue [S1] : que la réconciliation du moteur appelle la tranche pour un réseau gouverné au lieu de le sauter.
- **Web** : appel à l'ouverture de session et au retour d'IDN, seulement si un écart est signalé.
- **Mobile** : sans objet.
- **Données personnelles** : aucune.
- **Tests et cliquets** : compte léger qui lie IDN → « déclarée » ; lien révoqué → retombe ; suspendu et parti inchangés ; aucun appel sans écart.
- **Critères d'acceptation** : après une ouverture de session, aucun membre ne garde un statut que ses faits ne justifient plus.
- **Dépend de** : rien.
- **Porte** : aucune.

### EA-04 — Accueil qui respecte un profil existant · P0 · S · S2
- **Pour l'utilisateur** : un membre d'ANTSIA entre dans DIASPORALE avec son nom, son identifiant et son accroche ; rien n'est réécrit.
- **Backend** : aucun.
- **Web** : l'accueil lit `useMyProfile`. Profil publié : l'étape 2 montre l'identité commune sans la redemander et `join` n'appelle plus `publishMyProfile`. Profil retiré : republication par un geste explicite, accroche conservée. Retour après départ : pays et ville préremplis. Écriture reprenable si une étape échoue.
- **Mobile** : sans objet.
- **Données personnelles** : aucune nouvelle ; c'est une perte de données qui cesse.
- **Tests et cliquets** : l'acteur `exterieur` entre ; identifiant, nom affiché et accroche identiques avant et après ; parcours du nouveau compte inchangé ; même test au fournisseur de démonstration.
- **Critères d'acceptation** : recette à deux comptes sur le moteur local ; aucune ligne d'historique d'identifiant nouvelle pour un profil existant.
- **Dépend de** : rien.
- **Porte** : aucune.

### EA-05 — Droits personnels et sortie sans adhésion · P0 · S · S2
- **Pour l'utilisateur** : connecté mais pas membre (accueil abandonné, départ, extérieur), on exporte ses données et on supprime son compte depuis diasporale.com.
- **Backend** : aucun ; ces fonctions sont à la personne.
- **Web** : route `/mes-donnees` déclarée dans `D:apps/diasporale_com/src/lib/routes.ts`, hors de la garde d'adhésion, qui monte le panneau « Mes données » ; lien depuis `/bienvenue` et le pied de page.
- **Mobile** : à porter (exigence des boutiques d'applications).
- **Données personnelles** : aucune nouvelle.
- **Tests et cliquets** : accessible sans adhésion, après un départ, sous suspension ; aucune surface sociale rouverte.
- **Critères d'acceptation** : un compte créé puis abandonné à l'accueil demande son effacement, puis l'annule.
- **Dépend de** : plan 13 (le panneau lui appartient).
- **Porte** : aucune.

### EA-06 — Recette réelle de l'entrée de DIASPORALE · P0 · S · S2 + propriétaire
- **Pour l'utilisateur** : le code arrive vraiment, au nom de DIASPORALE.
- **Backend** : aucun code. Si un expéditeur par application est décidé (décision 6) : issue [S1] sur `A:convex/betterAuth/delivery.ts`.
- **Web** : corrections de ce que la recette révèle.
- **Mobile** : sans objet.
- **Données personnelles** : aucune capture de code ni d'adresse réelle.
- **Tests et cliquets** : un test par défaut trouvé.
- **Critères d'acceptation** : rapport daté sous `docs/recette/` : code reçu dans une vraie boîte, en français puis en anglais, marque DIASPORALE, expéditeur relevé ; trois essais faux bloqués ; quatrième envoi en cinq minutes refusé avec un message clair ; accueil puis hub ; déconnexion partout sur deux navigateurs. Chaque point dit fait ou non fait.
- **Dépend de** : CN-01 et CN-02 du moteur ; EA-08 ; DS-06.
- **Porte** : clés d'envoi et domaine (propriétaire) ; accord écrit sur le déploiement visé.

### EA-07 — Âge et identification dans l'accueil de DIASPORALE · P0 · M · S2
- **Pour l'utilisateur** : une question d'âge claire à l'entrée ; si la loi l'exige, une fiche privée, jamais affichée.
- **Backend** : tables et règles au plan 12 du moteur (SU01b, SU01c) ; la tranche refuse l'entrée sans déclaration quand le réglage est actif.
- **Web** : étapes ajoutées à `D:apps/diasporale_com/src/screens/welcome-screen.tsx` ; noms par le normaliseur partagé ; refus neutre, sans profil ni adhésion créés ; comptes existants invités à la connexion suivante.
- **Mobile** : même étape, plan 16.
- **Données personnelles** : seulement ce que le juriste exige ; export complet ; aucune pièce conservée.
- **Tests et cliquets** : une déclaration sous le seuil ne crée rien ; rien de la fiche n'apparaît dans un profil, une recherche ou un avis.
- **Critères d'acceptation** : impossible d'entrer sans déclaration quand le réglage est actif.
- **Dépend de** : SU01b et SU01c du moteur ; plan 14.
- **Porte** : juriste (seuil d'âge pour des résidents de France et d'ailleurs, identification) ; D-G11.

### EA-08 — Porte fiable : durée vraie, renvoi du code, reprise après rechargement · P1 · S · S2
- **Pour l'utilisateur** : on sait combien de temps vaut le code, on peut le redemander, on ne perd rien en changeant d'application pour lire son courriel.
- **Backend** : aucun.
- **Web** : durée lue du moteur ou texte sans chiffre ; « Renvoyer le code » avec délai de 60 secondes ; adresse en attente gardée le temps de la session du navigateur ; refus de débit avec le délai restant ; identifiant vérifié pendant la saisie ; année d'arrivée proposée, facultative.
- **Mobile** : sans objet.
- **Données personnelles** : l'adresse en attente ne quitte pas le navigateur et s'efface à la connexion.
- **Tests et cliquets** : rechargement entre l'envoi et la saisie ; renvoi refusé avant le délai ; `i18n-keys`.
- **Critères d'acceptation** : aucun texte ne dit une durée que le moteur ne tient pas ; parcours complet à 390 px après un rechargement.
- **Dépend de** : plan 02 (textes).
- **Porte** : aucune.

### DG-009a — Attestation consulaire réelle · P1 · M · S2 + gabon-diplomatie · repris du plan 15
- **Pour l'utilisateur** : « Vérifier mon inscription consulaire » rend un résultat.
- **Backend** : rien à écrire pour l'appel ; trois variables à poser sur un déploiement de recette.
- **Web** : écran éprouvé sur les trois réponses ; date de la prochaine tentative ; pas de formulaire pour un membre déjà vérifié ; lien « m'inscrire au consulat » après un refus.
- **Mobile** : sans objet.
- **Données personnelles** : seule l'empreinte du sujet est gardée ; aucun dossier consulaire réel comme donnée de recette.
- **Tests et cliquets** : test de minimisation (un champ en trop est refusé).
- **Critères d'acceptation** : parcours R2 joué avec le producteur ; contrat fusionné par son équipe.
- **Dépend de** : plan 15 (producteur) ; EA-16 pour le retrait.
- **Porte** : juriste (A4), clés, équipe de consulat.ga.

### EA-09 — Élévation : rattacher IDN à un compte léger, bannières qui agissent · P1 · M · S2
- **Pour l'utilisateur** : « Vérifier avec IDN » depuis la carte de statut ; au retour, le statut et le badge ont changé.
- **Backend** : aucun au-delà d'EA-03 ; le rattachement existe dans le moteur.
- **Web** : action de rattachement dans la carte de statut et les réglages ; retour sur l'écran de départ ; lien vers consulat.ga avec une invitation à revenir vérifier.
- **Mobile** : plan 16.
- **Données personnelles** : aucune nouvelle ; les adresses peuvent différer, aucune fusion implicite (ADR-0008).
- **Tests et cliquets** : identité déjà liée à une autre personne refusée de façon indistincte ; statut relu au retour.
- **Critères d'acceptation** : un compte en attente lie une identité gabonaise et devient « déclarée » sans se reconnecter.
- **Dépend de** : EA-02, EA-03.
- **Porte** : variables IDN (propriétaire).

### EA-10 — Compte en attente : salle d'attente, lien et QR de demande de parrainage · P1 · S · S2
- **Pour l'utilisateur** : on sait quoi faire en attendant ; on envoie un lien à un proche déjà membre, qui parraine en un geste.
- **Backend** : aucun.
- **Web** : panneau « En attente » (ce que je peux lire, mes trois chemins) ; lien `/parrainer` prérempli par l'identifiant, partage du système, code QR (`OpaqueQrCode`) ; côté parrain, formulaire prérempli et case « je connais cette personne ».
- **Mobile** : même panneau, plan 16.
- **Données personnelles** : le lien ne porte que l'identifiant public.
- **Tests et cliquets** : lien ouvert par un membre non éligible : son propre refus, rien sur la cible ; `no-hardcoded-urls`.
- **Critères d'acceptation** : à deux comptes, parrainage obtenu par le lien, sans saisie.
- **Dépend de** : rien.
- **Porte** : aucune.

### EA-11 — Invitation par un membre vérifié · P1 · M · S2
- **Pour l'utilisateur** : un membre vérifié envoie un lien dans son groupe ; la personne qui entre par ce lien est parrainée à l'arrivée.
- **Backend** : table des invitations dans la tranche (code gardé sous empreinte, échéance, un usage) ; créer une invitation, la consommer à l'entrée ; chaque usage compte dans le quota ; refus indistinct si le parrain n'est plus éligible. Issue [S1] : politique de données, seaux.
- **Web** : « Inviter » dans `/parrainer`, liste des invitations en cours, retrait ; la porte garde le code le temps de l'inscription.
- **Mobile** : lien profond, plan 16.
- **Données personnelles** : aucune coordonnée de l'invité n'est demandée ; invitations exportées, effacées avec le parrain.
- **Tests et cliquets** : lien rejoué, expiré, parrain suspendu ; quota tenu ; idempotence.
- **Critères d'acceptation** : un compte neuf entré par le lien arrive « déclarée » ; le journal du parrain le montre.
- **Dépend de** : EA-04, EA-10.
- **Porte** : aucune.

### EA-12 — Code par SMS · P1 · S · S2
- **Pour l'utilisateur** : entrer avec son numéro quand on n'a pas d'e-mail sous la main.
- **Backend** : aucun code ; passerelle à configurer.
- **Web** : `requestCode` et `verifyCode` servent le téléphone par le client du moteur ; choix e-mail ou SMS montré seulement si la porte est ouverte (EA-02).
- **Mobile** : plan 16.
- **Données personnelles** : le moteur ne garde qu'une empreinte du numéro. Un compte entré par SMS n'a pas d'e-mail vérifié : l'attestation lui demandera IDN ou un e-mail.
- **Tests et cliquets** : numéro invalide ; porte fermée non montrée.
- **Critères d'acceptation** : code reçu sur un téléphone de test hors du Gabon.
- **Dépend de** : EA-02 ; CN-02 du moteur.
- **Porte** : passerelle et budget par pays (propriétaire, décision 5).

### EA-13 — Déclaration d'entrée et règles de la communauté · P1 · S · S2
- **Pour l'utilisateur** : une phrase à cocher sur qui peut entrer, et les règles à accepter, avant de rejoindre.
- **Backend** : deux finalités de plus, enregistrées comme des consentements, avec la version du texte ; exigées par `joinDiasporale`. Issue [S1] : les deux finalités dans la liste fermée du moteur.
- **Web** : écran 3 de l'accueil ; mêmes cases pour un membre existant à la connexion suivante.
- **Mobile** : plan 16.
- **Données personnelles** : la déclaration n'est jamais affichée ; exportée.
- **Tests et cliquets** : entrée refusée sans les deux ; aucune case précochée.
- **Critères d'acceptation** : texte en français et en anglais, relu.
- **Dépend de** : plan 14 (texte des règles) ; décision 7.
- **Porte** : juriste pour les deux textes.

### EA-14 — Déménagement et retour au Gabon · P1 · S · S2
- **Pour l'utilisateur** : changer de pays en sachant ce que cela change ; rentrer au Gabon sans perdre son compte.
- **Backend** : date du dernier changement de pays gardée avec les réglages de confidentialité du membre ; délai minimal entre deux changements ; au changement, le poste attesté est marqué « à revérifier ».
- **Web** : confirmation avant le changement ; parcours « Je rentre au Gabon » : ce qui reste (compte, identifiant, ANTSIA), export proposé, départ.
- **Mobile** : plan 16.
- **Données personnelles** : la date du changement est privée, exportée.
- **Tests et cliquets** : second changement avant le délai refusé avec la date ; pays GA toujours refusé.
- **Critères d'acceptation** : un membre passe de France au Canada, voit son hub changer et son poste « à revérifier ».
- **Dépend de** : plan 06 (hubs) ; EA-16.
- **Porte** : décisions 8 et 9.

### EA-15 — Compte : appareils, alerte de connexion, moyens de connexion · P1 · M · S2
- **Pour l'utilisateur** : une rubrique « Compte » : mes appareils, fermer une session, mon e-mail masqué, en ajouter ou en changer.
- **Backend** : aucun ici ; CN-03, CN-04 et CN-05 du moteur construisent les fonctions.
- **Web** : lectures et actions ajoutées au port, aux deux fournisseurs ; rubrique dans `/parametres` ; phrase de l'avis « nouvelle connexion ». Ensuite, la clé d'accès quand CN-14 existe.
- **Mobile** : plan 16.
- **Données personnelles** : ni adresse IP ni jeton affichés.
- **Tests et cliquets** : `i18n-keys` ; une session fermée refuse aussitôt.
- **Critères d'acceptation** : deux navigateurs ; fermer l'un depuis l'autre.
- **Dépend de** : CN-03, CN-04, CN-05 ; plan 13 (réglages).
- **Porte** : aucune.

### EA-16 — Cycle de vie de l'attestation · P1 · M · S2 + gabon-diplomatie
- **Pour l'utilisateur** : retirer son accord a un effet clair ; une attestation ancienne se renouvelle sans surprise.
- **Backend** : au retrait du consentement, lien d'identité révoqué et statut relu ; revérification périodique par une tâche bornée, sous consentement en vigueur (ligne de tâche planifiée : issue [S1]) ; réception d'une révocation signée venue de consulat.ga (contrat de cycle de vie, plan 15).
- **Web** : texte du consentement mis à jour ; état « à revérifier » ; avis neutre.
- **Mobile** : sans objet.
- **Données personnelles** : rien de plus que l'empreinte, le pays, le poste, la date.
- **Tests et cliquets** : retrait → statut selon les faits restants ; revérification négative → même effet ; aucun champ consulaire ajouté.
- **Critères d'acceptation** : un membre vérifié par la seule attestation qui retire son accord redevient ce que ses autres faits justifient.
- **Dépend de** : DG-009a ; plan 15.
- **Porte** : juriste ; équipe de consulat.ga ; décisions 10 et 11.

### EA-17 — Accueil guidé du nouveau membre, badges et statut expliqués · P2 · M · S2
- **Pour l'utilisateur** : après l'entrée, trois étapes passables (photo, pages et associations de mon pays, notifications) ; un appui sur un badge dit d'où il vient.
- **Backend** : aucun.
- **Web** : panneau à la première visite du hub, mémorisé ; aucune liste vide montrée ; feuille « Pourquoi ce badge ? » ; texte de ce qui reste fermé à un compte déclaré ; nouvel arrivant orienté vers le kit d'arrivée.
- **Mobile** : plan 16.
- **Données personnelles** : aucune ; aucun centre d'intérêt demandé.
- **Tests et cliquets** : chaque étape passable ; feuille atteignable au clavier.
- **Critères d'acceptation** : un compte neuf arrive au hub avec ou sans les étapes.
- **Dépend de** : plans 05, 07, 11, 13.
- **Porte** : aucune.

### EA-18 — Limites du compte en attente et retrait de parrainage par la modération · P2 · S · S2
- **Pour l'utilisateur** : un compte jamais parrainé ne lit pas le réseau indéfiniment ; un modérateur retire un parrainage abusif en donnant son motif.
- **Backend** : durée de lecture d'un compte en attente et rappel avant l'échéance, selon la décision 4 (genre d'avis : issue [S1]) ; la fonction de retrait existe.
- **Web** : dans le bureau de modération, parrain d'un membre signalé et retrait motivé.
- **Mobile** : sans objet.
- **Données personnelles** : motif au journal du moteur.
- **Tests et cliquets** : retrait sans motif refusé ; compte en attente échu : lecture fermée, droits personnels ouverts.
- **Critères d'acceptation** : mesure du pilote lue avant de fixer la durée.
- **Dépend de** : plan 14 ; décision 4.
- **Porte** : décision du propriétaire.

### EA-19 — Passer de DIASPORALE à ANTSIA et retour · P2 · S · S2
- **Pour l'utilisateur** : « Ouvrir ANTSIA » dans le menu du compte, sans se reconnecter.
- **Backend** : aucun ; jeton à usage unique du moteur.
- **Web** : entrée dans le menu du compte ; adresse d'ANTSIA lue de l'environnement public. Issue [S1] : « Ouvrir DIASPORALE » côté antsia.ga pour un membre.
- **Mobile** : sans objet.
- **Données personnelles** : aucune.
- **Tests et cliquets** : origine non admise refusée ; aucun départ pendant une déconnexion.
- **Critères d'acceptation** : aller et retour à deux onglets, même personne.
- **Dépend de** : plan 02 (menu du compte).
- **Porte** : domaines des deux sites branchés (propriétaire).

### EA-20 — Proches non gabonais · P3 · S · S2
- **Pour l'utilisateur** : un conjoint ou un proche sait s'il peut entrer, et à quel titre.
- **Contenu** : aujourd'hui, un compte léger parrainé entre sans que rien ne soit demandé ; une identité IDN étrangère attend un parrainage. Selon la décision 7 : soit rien ne change, soit un fait « proche » déclaré par le parrain, sans badge propre.
- **Dépend de** : EA-13.
- **Porte** : décision du propriétaire ; juriste.

## 6. Ordre recommandé et dépendances

| Vague | Lots | Pourquoi dans cet ordre |
|---|---|---|
| 1 | EA-04, EA-05, EA-03, EA-08 | Aucune porte : cesser d'abîmer un profil, d'enfermer un compte, d'afficher un texte faux |
| 2 | EA-01, EA-02 | Deux décisions rapides ; sans elles, le pilote n'a ni membre vérifié ni porte IDN |
| 3 | EA-06, DG-009a | Clés et tiers : prouver l'entrée, ouvrir l'attestation |
| 4 | EA-07, EA-13, EA-16 | Juriste : âge, déclaration, règles, cycle de vie |
| 5 | EA-10, EA-11, EA-09, EA-12 | Faire venir : parrainage facile, invitation, élévation, SMS |
| 6 | EA-14, EA-15 | Vie du compte |
| 7 | EA-17 à EA-20 | Après les premiers retours |

**Ce que ce plan attend des autres plans.** Moteur : 06 (CN-01 à CN-05, CN-14), 12 (SU01b, SU01c, règles d'utilisation), 13 (console pour EA-01 ; EX-08 exclut les réseaux gouvernés : nommer les responsables de DIASPORALE reste à écrire ; EX-15). DIASPORALE : 02 (textes, menu du compte), 06 (pays ouverts, relecture des pays non ouverts), 13 (panneau « Mes données », rubrique « Compte »), 14 (équipes, premier administrateur, texte des règles), 15 (producteur de l'attestation, « Rejoindre DIASPORALE » depuis consulat.ga), 16 (mobile), 17 (DS-06 : origines de confiance, variables IDN, adresses publiques d'IDN et de consulat.ga).

**Volet de recette en mode moteur (campagne DS-05).** Backend local ; comptes de démonstration `verifie`, `exterieur` et `suspendu-racine`, plus un compte neuf entré par code.

| Étape | Geste | Résultat attendu |
|---|---|---|
| 1 | Compte neuf : code, accueil en trois écrans, France | Adhésion « en attente », racine « déclarée », Publier fermé avec ses deux chemins |
| 2 | `verifie` parraine le compte neuf par son identifiant | « Déclarée » sans rechargement ; avis « parrainage reçu » ; quota 9 sur 10 |
| 3 | `verifie` retire le parrainage | Retour à « en attente » ; avis ; journal à deux lignes |
| 4 | `exterieur`, profil ANTSIA avec accroche, entre dans DIASPORALE | Avant EA-04 : constat de la réécriture ; après : identité inchangée |
| 5 | Demande d'attestation sans variables | Échec technique dit sans raison consulaire ; nouvelle demande refusée avant 24 heures |
| 6 | Changer de pays vers le Canada, puis tenter le Gabon | Hub changé ; Gabon refusé ; poste inchangé (constat) |
| 7 | Quitter DIASPORALE, puis revenir | Parrainage éteint ; ANTSIA intacte ; accueil au retour |
| 8 | `suspendu-racine` | Refus partout ; « Mes données » ouvert |
| 9 | Deux navigateurs, « Se déconnecter partout » | Les deux reviennent à la porte, sans avis d'échec |

## 7. Décisions à prendre par le propriétaire

1. **Premiers membres vérifiés.** Recommandation : une cohorte fondatrice admise par un opérateur, tracée, plafonnée, avec dispense d'ancienneté pour parrainer. Raison : sinon l'ouverture dépend d'un tiers (attestation), et même ouverte, nul ne parraine avant 30 jours. Le cahier prévoit des « badges manuels tracés » (§ 6.4).
2. **IDN : client central ou client propre à DIASPORALE.** Recommandation : le client central pour le pilote. Raison : aucun code moteur ; l'écran d'IDN nommera ANTSIA, à dire sur la porte. Un client propre est une issue [S1].
3. **Ancienneté et quota du parrain pendant le pilote.** Recommandation : garder 30 jours et dix ; la dispense ne vaut que pour les fondateurs.
4. **Ce que lit un compte en attente, et combien de temps.** Recommandation : garder la lecture pendant le pilote, mesurer, puis fixer une durée (EA-18). Raison : toute adresse e-mail suffit à entrer et à lire.
5. **SMS.** Recommandation : l'e-mail d'abord ; le SMS après chiffrage par pays, avec un budget.
6. **Expéditeur des courriels.** Recommandation : une adresse du domaine de DIASPORALE avant la production. Raison : un code venu d'une autre marque finit en indésirables ou inquiète.
7. **Déclaration d'entrée et proches non gabonais.** Recommandation : une déclaration simple et les règles (EA-13) ; ne rien changer pour les proches au pilote, le parrain en répond ; avis du juriste sur le texte.
8. **Retour au Gabon.** Recommandation : un départ guidé vers ANTSIA ; aucun statut « ancien de la diaspora » au pilote.
9. **Changement de pays.** Recommandation : un changement par 30 jours, avec confirmation. Raison : changer de pays ouvre les champs visibles « par pays ».
10. **Retrait du consentement à l'attestation.** Recommandation : il retire le lien et fait relire le statut. À faire confirmer par le juriste.
11. **Durée d'une attestation.** Recommandation : revérification annuelle, à valider avec consulat.ga et le juriste.
12. **Âge.** Recommandation : dès l'avis du juriste, une déclaration à l'entrée, sans pièce ; D-G11 écarte les mineurs.

## 8. Risques et points d'attention

- **Dépôt public** : ce plan décrit des faiblesses encore ouvertes. EA-04 et EA-05 passent d'abord.
- **Dispense des fondateurs** : un compte fondateur compromis parraine sans délai. Cohorte courte, quota inchangé, retrait par l'opérateur.
- **SMS** : coût par pays et envois abusifs ; un plafond par numéro et par origine existe, pas un budget.
- **IDN** : la marque montrée par IDN sera celle du réseau racine tant que le client est central.
- **Attestation** : jamais de dossier consulaire réel en recette ; les tests du faux consulat ne prouvent pas le partenaire réel.
- **Fichiers partagés** : tables, seaux, actions d'audit et console sont à S1 ; EA-01 et EA-11 attendent une issue.
- **Deux accueils** : celui d'ANTSIA et celui de DIASPORALE évoluent séparément ; toute règle d'entrée du moteur est à porter ici.
- **Comptes de démonstration partagés** : ce qu'un visiteur fait sous un acteur est vu des suivants ; chaque lot commence par vérifier dans le code que l'état décrit ici est encore vrai.

## 9. Prompts d'implémentation

### Prompt EA-04
```text
Session S2 (DIASPORALE). Écris en français. Opus seulement.
Lis : docs/etudes/2026-11-10-finalisation/01_ENTREE_ADHESION_CONFIANCE.md (§ 2, lignes 23 à 25 ; lot EA-04), docs/34.
Vérifie d'abord dans le code que l'accueil ne lit toujours pas le profil existant et que join appelle publishMyProfile sans accroche.
Branche claude/accueil-profil-existant depuis origin/main. Périmètre : apps/diasporale_com/src/screens/welcome-screen.tsx, src/data/engine-source.ts (join), le fournisseur de démonstration, leurs tests.
Fais : l'accueil lit useMyProfile ; profil publié = identité montrée, non redemandée, publishMyProfile non appelé ; profil retiré = republication par un geste explicite, accroche conservée ; retour après départ = pays et ville préremplis ; entrée reprenable.
Vérifie : test « exterieur » (identifiant, nom, accroche identiques), bun run --cwd ../ANTSIA verify sous le verrou, recette à deux comptes sur le moteur local à 390 et 1280 px. Arrête-toi avant toute publication.
```

### Prompt EA-05
```text
Session S2 (DIASPORALE). Écris en français. Opus seulement.
Lis : le lot EA-05 de docs/etudes/2026-11-10-finalisation/01_ENTREE_ADHESION_CONFIANCE.md, docs/17 (dernière ligne de la matrice des droits), ANTSIA/apps/antsia_ga/src/app/mes-donnees/page.tsx.
Branche claude/mes-donnees-sans-adhesion. Périmètre : src/lib/routes.ts, une page src/app/mes-donnees, src/screens/welcome-screen.tsx, le pied de page, textes fr et en.
Fais : route hors de la garde d'adhésion qui monte le panneau « Mes données » existant ; lien depuis /bienvenue et le pied de page ; aucune surface sociale rouverte.
Vérifie : accès sans adhésion, après départ, sous suspension ; demande puis annulation d'effacement avec un compte abandonné à l'accueil ; verify vert. Arrête-toi avant toute publication.
```

### Prompt EA-02 et EA-03
```text
Session S2 (DIASPORALE). Écris en français. Opus seulement.
Lis : les lots EA-02 et EA-03 de docs/etudes/2026-11-10-finalisation/01_ENTREE_ADHESION_CONFIANCE.md, les ADR 0002 et 0008 d'ANTSIA, ANTSIA/packages/social-features/src/features/identity/IdentityEntry.tsx (modèle, à ne pas copier), ANTSIA/convex/modules/people/identity.ts (reconcileMemberships).
Demande-moi d'abord : client IDN central ou propre (décision 2), et l'accord pour les variables du backend local.
Branche claude/entree-idn. Périmètre : port et source moteur (signInWithIdn, lecture des portes ouvertes), src/screens/landing-screen.tsx, fournisseur de démonstration, convex/modules/diaspora/membership.ts (refreshMyMembership), tests.
Fais : EA-03 d'abord, puis EA-02. Dépose l'issue [S1] « réconciliation des réseaux gouvernés ».
Vérifie : tests de la tranche (lien IDN, lien révoqué, suspendu, parti), bouton IDN actif seulement si la configuration le dit, verify vert. La recette avec un vrai compte IDN est une porte : dis-moi ce qu'il faut et attends.
```

### Prompt EA-01
```text
Session S2 (DIASPORALE). Écris en français. Opus seulement.
Lis : le lot EA-01 de docs/etudes/2026-11-10-finalisation/01_ENTREE_ADHESION_CONFIANCE.md, la décision 1 telle que je l'ai rendue, packages/diasporale-domain/src/eligibility.ts et sponsorship.ts, ANTSIA/convex/modules/diaspora/facts.ts, membership.ts, pilotMetrics.ts (exemple de fonction d'opérateur).
Dépose d'abord l'issue [S1] : nom de la table des admissions et sa politique de données, action d'audit, seau de débit, écran de la console.
Branche claude/admission-fondateurs. Périmètre : domaine (fait, règle, source operator), tranche (table, fonctions d'opérateur pour admettre, retirer et lister, membershipGrounds), fournisseur de démonstration, texte d'aide du badge.
Vérifie : admission puis page créée puis parrainage, retrait, refus hors opérateur, plafond ; couverture du domaine à 100 % ; verify vert. N'exécute rien sur un déploiement en ligne.
```

## 10. Sources lues

- Contexte commun : dossier de reprise, cahier (docs/00), plan global (docs/14), registre des décisions (docs/17), plan 15 et plan directeur d'ANTSIA, registre des lots, table des routes.
- Moteur : plan 06 (§ 2, § 5, § 7) ; plans 12 et 13 (titres des lots SU01b, SU01c, MC-07, EX-06, EX-08, EX-15) ; ADR 0002, 0008, 0031, 0038, 0039 ; docs/25 (état du raccordement IDN).
- DIASPORALE : docs/01 (encart, PD1 à PD3), docs/11, 33, 34, 35 ; recettes `deux-comptes-2026-10-19` et `demo-en-ligne-2026-10-22` ; dossier produit, fiche F01 et § 1 à 3 ; vault, décisions porte unique, contrats partenaires, réseau gouverné, raccords PA4.
- Code DIASPORALE : écrans d'entrée, d'accueil, de parrainage et de vérification, réglages, garde, cartes de statut, source moteur, port et types, domaine (éligibilité, parrainage, badges, consentements, pays, facette, attestation, pont moteur), textes français et anglais, fournisseur de démonstration.
- Code ANTSIA : tranche `convex/modules/diaspora` (adhésion, attestation, faits, facette, tables, manifeste, comptes de démonstration, graine) ; `convex/betterAuth` ; modules `people` (identité, profil, consentements, adhésions, admission) ; `platform/authentication` ; `lib/functions`, `lib/rateLimit`, `lib/devTools` ; paquet `api` (client, passage entre applications, amorce de session) ; porte commune `IdentityEntry` ; catalogue des applications.
