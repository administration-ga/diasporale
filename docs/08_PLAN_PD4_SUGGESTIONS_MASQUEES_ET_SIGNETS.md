# PD4 — Suggestions masquées et signets paginés

Demande du 17/10/2026. Sources réelles dans le checkout partagé ; branche DIASPORALE
`codex/pd4-stories-albums`, branche du moteur conservée. Références locales : application
`a1de52e`, preuves `ef978b4`, ANTSIA PA6 `263d7df`/`aebd48b` (6 506 tests, preuve historique
à revérifier pour cette tranche). Aucun push, déploiement, changement de fichier d'environnement,
suppression de cache ou de session prévu.

## Objectifs et ordre

1. Retrouver ses suggestions masquées et retirer un masquage sans créer de relation ni
   d'abonnement. Respecter les permissions ACTUELLES d'annuaire et les blocages du tiers.
2. Corriger la lecture des enregistrements au-delà de la première page de 50 : curseurs
   natifs, pages réactives, vide filtré non terminal et reprise après erreur.
3. Corriger les écarts documentaires de PD4 devenus faux (modification d'une publication,
   présence de la liste des signets), sans annoncer la clôture de PD4 ou de ses autres lots.

## Constats et contrat à coordonner avec ANTSIA

- Le moteur possède `suggestions.dismiss`, `restore`, `paginateDismissed`, accessibles
  en attente. La liste expose aujourd'hui le mini-profil sans relecture de l'annuaire
  DIASPORALE ni des blocages ; elle ne sera pas montée telle quelle.
- Table/index existants `suggestionDismissals`, auteur/réseau/cible et auteur/réseau/date.
  Aucune nouvelle table, migration ou règle d'admission nécessaire.
- Proposition : pages natives de 12, maximum serveur 50 et 2 Mio, métadonnées conservées,
  identifiant de ligne comme version du masquage. Identité nullable ; en DIASPORALE,
  projection seulement après la règle opt-in actuelle, sinon ligne neutre sans lien/avatar.
- Restauration conditionnelle par version : un ancien bouton ne peut pas retirer un nouveau
  masquage de la même cible, même à date identique. Rejeu sans effet, auteur/réseau bornés,
  cible devenue invisible restaurable sans oracle. API propres de la tranche :
  `diaspora.suggestions.paginateDismissed` et `restoreDismissed({networkId,dismissalId})`.
  Les signatures génériques restent intactes. Après coordination, ANTSIA ajoute le refus
  `policyRefused` à l'ancienne liste sur les réseaux gouvernés : un appel direct ne doit
  pas contourner la projection de la tranche. Le masquage enregistré est conservé.
  Aucun avis au tiers ni écriture de graphe.
- Le scan des 500 premiers masquages de `diaspora.suggestions.forMe` peut laisser réapparaître
  un candidat masqué au-delà : le remplacer par le lookup exact indexé des candidats bornés.
- L'application ne doit pas appeler `forMe` pour un lecteur en attente si cette query exige
  `declaree`. La liste des choix personnels reste accessible sans ouvrir la création de liens.

## Réalisation

- Nouvel onglet adressable dans Mes relations, avec routes centrales et labels FR/EN ;
  découverte par `/membres` seulement. Démonstration fermée pour la liste privée du moteur.
- Surface locale DIASPORALE alimentée par la projection de sa tranche ; réutiliser le
  réducteur `cursor-pages` du moteur (réexport public nommé) : toutes pages abonnées,
  frontières réalignées, générations de lecteur/réseau, erreur/reprise sans perte de lignes.
  Mutex immédiat par ligne ; retirer seulement la version restaurée après succès.
- Signets : étendre le port de données par page, garder une forme cohérente en démonstration,
  transmettre le curseur natif sans le fabriquer. Chaque page reste abonnée ; dédoublonner
  par identifiant de signet/publication, continuer les pages filtrées vides non terminales.
  Les publications devenues illisibles disparaissent selon le moteur, sans détail supplémentaire.
- Préserver le rendu actuel des signets et leur retrait. Réinitialiser la chaîne quand le
  lecteur/réseau change ; une ancienne mutation ne modifie pas la nouvelle session.

## Propriété et coordination

- Root : plan/ABI, intégration de l'onglet, routes/locales, vérification, Chrome, preuves,
  commits par chemins et mémoire Obsidian. Aucun changement de branche dans le moteur.
- Exécuteur backend : seulement `convex/modules/diaspora/suggestions.ts` et son test dédié,
  lookup au-delà de 500, projection paginée et restauration conditionnelle de la tranche ;
  aucun fichier générique sans attribution ANTSIA.
- Exécuteur signets : port/provider/démonstration et écran de pagination, tests associés ;
  aucun fichier de relations ni aucun serveur/test lourd. Les locales sont coordonnées avec root.
- API générique : garde de l'ancienne liste et test de transition pris en charge par ANTSIA ;
  aucun autre changement de contrat. Seul raccord de surface commune : réexport nommé du
  réducteur pur existant, sans changement de son implémentation.
  Préserver les travaux PA6/PA7 et les changements des autres agents.

## Vérifications et critères de fin

- Backend : acteur/réseau, attente/sanctions/session révoquée, pagination bornée, blocage,
  départ/effacement, visibilité/consentement/pays ; restauration obsolète et rejeu sous
  horloge fixe ; candidat masqué après les 500 premières lignes toujours exclu.
- UI montée : pages réactives, frontière déplacée, vide non terminal, panne/reprise,
  double clic/refus, identité neutre, changement de lecteur/réseau, absence de requête privée
  en démonstration ; signets au-delà de la première page et suppression en cours de lecture.
- Contrôles coordonnés : codegen puis typages/tests/lint, `verify` commun complet avant
  commit. Une tâche lourde et un seul frontend ; mesurer disque/swap avant démarrage.
- Chrome uniquement : comptes fictifs, masquer puis lister/restaurer et recharger ; vérifier
  le retour parmi les candidats seulement si encore éligible, sans nouvelle relation/suivi.
  Signets au-delà d'une page avec insertion/retrait réactifs si fixture locale disponible.
  320/375/1 280, clair/sombre, onglet actif visible, console ; distinguer preuve UI et tests.
- Fermer les seuls onglets créés, réinitialiser le viewport/thème temporaire, restituer le
  serveur coordonné si nécessaire. Docs/04 + état docs/01, commits locaux, mémoire mise à jour.

## Directive d'identité reçue pendant la vérification — 17/10

- Les noms civils de famille sont en majuscules ; chaque prénom, y compris les segments
  composés, possède une initiale majuscule puis des minuscules. Accents, apostrophes et
  tirets sont conservés. Aucun normaliseur civil complet et versionné n'a été trouvé dans
  le moteur, le socle ou IDN ; les utilitaires ASCII d'adresses ne conviennent pas.
- Après restitution du créneau et attribution ANTSIA : module pur partagé `civilName`
  dans `social-domain`, testé, consommé réellement par DIASPORALE sans nouvelle dépendance.
  Le paquet features peut le réexporter pour le formulaire existant.
- Périmètre civil actuel : IDN simulé seulement. Normaliser saisie/validation, écriture,
  reconnexion et hydratation locale ; presets canoniques et noms civils explicites pour
  les fixtures, en supprimant leur déduction par découpage du nom social.
- Conserver identifiants, `sub`, consentements et données voisines. Les noms sociaux choisis
  restent libres ; aucune transformation des organisations, titres, fichiers, documents
  certifiés ni preuves signées. Le mode moteur ne reçoit aujourd'hui aucun prénom/patronyme
  structuré par ce parcours ; aucune donnée civile consulaire n'est ajoutée.
- Tests ciblés : Unicode, composés, ponctuation, espaces et idempotence ; formulaire monté,
  persistance/rechargement/reconnexion, indices civils canoniques et nom social inchangé.
  Ces nouveaux chemins devront être revérifiés après la passe actuellement gelée, avant commit.

## Vérification finale locale — 17/10

- Passe complète `verify` terminée code 0 : **6 786 tests**, dont 953 DIASPORALE
  (domaine 190, features 285, application 478), dix espaces typés et neuf lints sans erreur.
  Journal `/tmp/diasporale-pd4-hidden-bookmarks-verify-analysis15.log` ; les trente fichiers
  de code contrôlés sont identiques au gel. Backend 1 551 tests en 52,06 s, cliquets 124 ;
  les 18 cas des suggestions masquées et les 31 cas de casse civile sont inclus.
- Configuration de cette preuve : Node 22.22.3 pour toute la chaîne, heap 1 536 Mio,
  `GOMAXPROCS=2`, tâches sérialisées et créneau réservé avec les trois chats voisins.
  Backend local : `ANALYZE_CONCURRENCY=1` et budget d’analyse temporaire **15 s**,
  preuve minimale `/tmp/antsia-pa7-backend-local-analysis15-proof.json`. Le délai des
  fonctions applicatives reste à son défaut 1 s ; les tests gardent leurs délais/assertions.
  Ce résultat est distinct du budget d’analyse par défaut 4 s et de toute preuve de production.
  Aucun fichier d’environnement, cache, donnée ou session modifié par DIASPORALE.
- Les premières passes sous charge, le dépassement du test LiveKit et les analyses à 4 s
  sont des tentatives distinctes : journaux et limites dans `docs/04`. Aucun total final
  n’en est dérivé. ANTSIA a corrigé le focus de ses seules préférences avant cette passe verte.
- Chrome reste à terminer : première compilation de connexion non aboutie sous Node 25
  puis 22 pendant les essais précédents, aucun scénario métier de cette tranche encore validé.
  Les seuls frontends de test ont été arrêtés, l’onglet remis à vide ; backend confié à ANTSIA.
- La limite historique des sujets IDN fictifs `ß`/`SS` ne justifie aucun rapprochement par nom
  ni réécriture de sujet. Les cas civils ne valent pas raccord OIDC réel. PD4 reste ouvert.
