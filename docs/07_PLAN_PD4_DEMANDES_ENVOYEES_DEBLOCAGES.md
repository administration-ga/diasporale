# PD4 — Demandes envoyées, annulation et déblocages

Demande du 16/10/2026. Sources réelles DIASPORALE et moteur ANTSIA, même checkout partagé.
Branche DIASPORALE `codex/pd4-stories-albums`, aucun changement de branche du moteur.
Référence précédente : application `963bf61`, surface moteur `d2a782b`, verify 6 268 tests.
Aucun push, publication de production, modification d'environnement ou suppression de session.

## Objectif

1. Consulter les demandes que j'ai envoyées et annuler seulement une demande encore en attente.
2. Consulter les blocages que j'ai moi-même émis et les retirer sans créer de connexion
   ni d'abonnement. Les abonnements historiques sont conservés ; aucune reprise d'interaction
   n'est promise. Un blocage inverse reste sans divulgation.
3. Conserver lecture et gestes de retrait en attente, sous les gardes et sanctions du moteur.

## Contrats et coordination

- Query existante : `suggestions.suggestions.paginateSentInvitations`, réseau injecté, pages
  natives de 12, identité publique nullable ; seules mes demandes `requested` sont retournées.
- API d'annulation absente au démarrage. ANTSIA doit confirmer puis implémenter une mutation
  demandeur/réseau/état, débit, rejeu et résolution de la notification. Une demande acceptée
  pendant l'attente ne doit jamais devenir un retrait de connexion.
- Liste publique des blocages absente au démarrage. Les blocages résident dans `connections`
  et s'appliquent à tous les réseaux. Définir avec ANTSIA une lecture strictement personnelle,
  paginée et bornée des seuls blocages émis, sans exposer `blockedCounterpartIds` (bidirectionnel).
- ANTSIA décide le modèle/ABI, l'indexation et la projection minimale autorisée. Ne pas forcer
  l'accès à une identité via `publishedMiniProfile`, ni exposer les réseaux d'origine.
  Traiter les doublons interréseaux et l'intention de blocage propre quand l'autre partie
  a déjà bloqué : la nouvelle liste ne doit pas créer un oracle de blocage inverse.
- Propriété moteur/API à confirmer par le chat ANTSIA avant toute édition partagée.

## ABI gelé avec ANTSIA

Référence moteur : `docs/08_CONTRAT_DEMANDES_ET_DEBLOCAGES.md`.

- `cancelSentRequest({networkId, connectionId, expectedRequestedAt})` : version `at` de la
  liste envoyée, refus indistinct, annulation propre rejouable, notification résolue `cancelled`.
  La réémission augmente strictement `requestedAt`, même à horloge identique.
- `personBlocks` conserve chaque intention propre, unique par auteur/cible. Les anciens
  marqueurs de `connections` restent lus, sans migration ni reconstruction d'intentions perdues.
- `blocks.paginateMine({networkId, source, paginationOpts})` : deux sources `intents` et
  `legacy`, chacune avec sa chaîne native, DTO neutre `{targetPersonId, at}`, maximum 50,
  2 Mio. Déduplication par cible dans la surface ; aucune identité ni origine exposée.
- `unblockPerson` retire seulement l'intention et les marqueurs propres, globalement.
  Précontrôle de 101 lignes, refus au-delà de 100 avant mutation ; blocage inverse conservé.
- `connectionWith.blocked_by_me.connectionId` peut être `null` en l'absence de ligne dans
  le réseau courant. Les autres variantes gardent leur identifiant non nullable.
- Toutes les lectures/retraits ajoutés acceptent `en_attente`. Les gardes et les quotas restent
  ceux du moteur. ANTSIA conserve ses raccords débit, export/effacement, domaine et contrat.

## Exécution dans les vraies sources

1. ANTSIA : contrats et tests backend des deux gestes. Gardes en tête, débit avant droit,
   refus indistinct, reprise sûre, état inverse conservé, aucune notification de déblocage.
2. Surface demandes : exposer `SentInvitationsSection` seule depuis le barrel existant,
   réutiliser `SentInvitationsCard` et ses styles. Ne pas monter PeoplePanel ni une recherche.
   Toutes les pages restent abonnées, avec rebase, générations de montage, dédoublonnage,
   page vide non terminale franchissable et erreur/reprise sans perte de lignes.
3. Annulation : verrou immédiat par ligne, bouton explicite ; retirer seulement après succès,
   traduire le refus, autoriser une reprise et ignorer la résolution d'un ancien lecteur.
4. Surface blocages autonome, via primitives existantes. Expliquer la portée globale si le
   contrat la conserve. Identité neutre si aucune projection autorisée ; aucun lien de profil
   inventé. Déblocage avec confirmation accessible, annulation sans effet, erreur traduite,
   verrou immédiat et retrait des seules lignes propres après succès. Aucune nouvelle relation créée ; abonnements historiques conservés.
5. Application : onglets adressables `/relations?onglet=envoyees` et `?onglet=blocages`, routes
   centrales, état actif mis en vue sur la piste, contexte cohérent avec l'adhésion, reset par
   lecteur/réseau/onglet. Démonstration et contexte fermé : aucun abonnement moteur monté.
   Toutes les nouvelles phrases en français/anglais. Écrans existants et APIs consommées réutilisés.

## Propriétés de travail

- Root : plan, coordination, routes/écran/tests/locales DIASPORALE, intégration, contrôles,
  recette Chrome, documentation, commits par chemins, mémoire Obsidian.
- Exécuteur demandes : `PeoplePanel.tsx`, son test et `SentInvitationsSection.test.tsx`.
- Exécuteur blocages : `BlockedPeopleSection.tsx` et son test uniquement.
- Root : barrel, traductions moteur et réducteur générique `cursor-pages.ts` ; adaptateur
  des abonnements conservant son ABI, sans nouvelle copie de pagination.
- Backend : ANTSIA a délégué les quatre fichiers graph, leurs tests, le seuil de lecture des
  demandes envoyées et son test. ANTSIA garde débit, données personnelles, domaine et contrat.
  Chaque agent conserve le travail voisin et ne lance aucun job lourd.

## Vérification et recette

- Tests backend : auteur/réseau, destinataire et tiers refusés, attente/sanction/session morte,
  annulation/rejeu/course acceptation, notification résolue ; émission seule, blocage inverse,
  doublons interréseaux, pagination bornée et effacement. Scénario propre après blocage inverse.
- Tests montés : pages réactives et frontière déplacée, vide non terminal, panne/reprise,
  mutation refusée/double clic, confirmation et annulation, changement de lecteur/réseau,
  DTO neutre et absence de recherche/liste d'abonnés ; labels FR/EN.
- Tests du raccord : deux adresses, sélection/reset, attente, contexte incohérent, démonstration.
- Un seul frontend et une seule tâche lourde. Arrêter 3030 avant codegen/tests, conserver le
  backend 3210, coordonner toute publication locale puis `bun run --cwd ../ANTSIA verify`.
- Chrome local, comptes fictifs : demande envoyée puis annulation persistante après reload,
  autre compte ne peut plus répondre ; blocage réel puis liste personnelle, annulation du
  dialogue sans effet, déblocage confirmé et fermeture conservée d'un éventuel blocage inverse
  selon fixture sûre. Ne supprimer ni relation réelle ni session, ne promouvoir aucun membre.
- 320 sombre / 375 clair / 1 280 sombre, onglet actif visible et absence de débordement ; console
  finale. Captures aux moments utiles, viewport/thème rétablis, seuls onglets de recette fermés.
- Contrôles finaux avant commits, rapports de preuves et limites dans `docs/04`, mémoire mise
  à jour. DIASPORALE 3031 arrêté et serveur ANTSIA 3030 rétabli après le créneau de recette.

## Résultat — 17/10/2026

- Commits locaux : backend ANTSIA `1637c12`, surfaces `a2350ca`, application `a1de52e`.
- Vérification commune de la tranche terminée code 0 : **6 365 tests**, dont 97 nouveaux cas
  et 862 DIASPORALE, codegen, typages et neuf lints sans erreur. Journal final :
  `/tmp/diasporale-pd4-requests-blocks-verify-release.log` ; précède les nouveaux travaux PA6.
- Chrome : blocage et déblocage d'un lecteur fictif en attente, confirmation annulée sans
  effet puis retrait persistant ; demande réellement envoyée par le propriétaire fictif,
  affichée puis annulée, avis de succès, vide après rechargement complet et profil redevenu
  « Se connecter ». Aucune tentative du destinataire après annulation rejouée dans Chrome :
  refus, course et notification sont couverts par les tests.
- Rendu 320 sombre, 375 clair et 1 280 sombre, onglet actif visible lors du redimensionnement.
  Console finale de la liste envoyée sans avertissement ni erreur ; 404 transitoire antérieur
  non reproduit. Le retour du thème clair de la session Chrome initiale n'a pas pu être
  recontrôlé après perte de l'extension ; viewport réinitialisé et onglets dédiés fermés.
- Deux caches Webpack exactement autorisés supprimés une fois (~716 Mio mesurés) ; aucun
  autre cache, environnement, donnée ou session supprimé. Backend restauré après ENOSPC,
  DIASPORALE 3031 arrêté, ANTSIA 3030 rétabli (`/entrer` HTTP 200), backend 3210 conservé.
  Créneau rendu au chat ANTSIA. Preuves détaillées et limites : `docs/04`.
- Aucun push ni publication de production. PD4 reste ouvert pour ses autres écarts de parité.
