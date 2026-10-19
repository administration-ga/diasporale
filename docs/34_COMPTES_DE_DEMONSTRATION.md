# Comptes de démonstration par acteur — 19 octobre 2026

Demande du propriétaire : « le bouton des comptes démo des différents acteurs et users de
DIASPORALE ». Le contrat (17 acteurs) a été posé par la session du plan global ; le
propriétaire a confié la suite à la session de la porte d'entrée. Modèle : les comptes de
démonstration de la racine d'ANTSIA (`convex/modules/platform/demoAccounts.ts`,
`DemoAccountsPanel`, `DemoAccountBootstrap`).

## Ce que voit la personne qui teste

- Sur la porte (`/` et `/entrer`), sous la carte d'accès : un bouton « Comptes de
  démonstration », « Développement local seulement ».
- Il ouvre une feuille, groupée en Membres (statut par statut), Pages et Rôles et services.
- Chaque acteur montre son nom fictif « Prénom NOM », ce qu'il illustre, son pays et le statut
  qu'il obtiendra.
- Un appui suffit. La connexion passe par le VRAI code à usage unique, lu pour la personne. Puis
  l'accueil, l'équipement et les gestes se font tout seuls, avec un avis du début à la fin. On
  arrive sur le fil.
- En démonstration (données fictives de ce navigateur), le même bouton mène à `/demo`.
- Ailleurs, catalogue vide, production comprise : rien ne s'affiche.

## Les acteurs (`packages/diasporale-domain/src/demo-accounts.ts`)

Adresses réservées `<acteur>@demo.diasporale.test`. Le domaine `.test` n'est jamais routable.

| Groupe | Acteurs | Ce qui est posé |
|---|---|---|
| Membres | nouveau, leger, declare, parraine, verifie, belgique, canada | Statut dérivé des faits fictifs : rien (en attente), IDN niveau 1 ou 2, parrainage par « verifie », attestation consulaire ; hubs Belgique et Canada. |
| Pages | association, entreprise, media, communaute, institution | Une page par nature dans le pays de l'acteur, l'acteur administrateur. Confiance communauté, vérifiée ou officielle (institution seulement). Type d'association ou secteur. |
| Rôles et services | mentor, talent, moderateur, administrateur, suspendu | Profil de mentor, profil de talent ; rôle de modération et équipe de démonstration ; administration du réseau ; suspension posée en dernier. |

Gestes réels, joués par l'application à la première entrée :
- profil de mentor (mentor) et profil de talent (talent) ;
- offre de service et offre d'emploi de la page d'entreprise (entreprise) ;
- mission bénévole de l'association (association).

## Fonctionnement

1. **Catalogue** : `api.modules.diaspora.demoAccounts.catalogue`, une `@publicProjection`.
   Elle est vide hors des outils de développement locaux : double garde `devToolsAllowed`,
   c'est-à-dire `ANTSIA_DEV_TOOLS=true` ET un backend local.
2. **Connexion** : `requestCode` puis `verifyCode` du port. Le code se lit par
   `devTools.latestOtp`, avec jusqu'à 8 lectures espacées de 250 ms. L'acteur choisi est mémorisé
   sous la clé `antsia:diasporale:demo-account`, que la déconnexion de partout purge.
3. **Accueil réel** : `actions.join`, qui pose le profil publié, les consentements (profil,
   annuaire) et l'adhésion, avec le pays et la ville de l'acteur.
4. **Équipement** : `equipMyDemoAccount`, un `@selfScoped` exécuté seulement si l'adresse
   vérifiée de la session est celle de l'acteur.
   - Les faits fictifs :
     - le compte et la preuve IDN `diasporale-demo-idn-<acteur>`, de nationalité GA ;
     - le lien d'attestation consulaire, et la demande « vérifiée » que lisent les réglages ;
     - le parrainage par « verifie », antidaté de 31 jours. Parrain et filleuls ne sont retenus
       que sur leur adresse réservée vérifiée, jamais sur le seul identifiant public.
   - Puis la VRAIE dérivation (`applyDerivedStatus`).
   - Ensuite le rôle, l'équipe, la page et les pays de la démonstration ; ces pays ne
     s'ouvrent que si personne n'en a décidé.
   - La suspension se pose en dernier.
   - Le tout est idempotent.
5. **Gestes** : par les capacités du port. Ils ne se jouent qu'à la première entrée, et ceux
   d'une page seulement à sa création.

## Limites connues

- L'ordre d'équipement compte pour le parrainage. Équipé avant « verifie », « parraine » reste
  en attente ; il passe déclaré, par parrainage, dès que « verifie » est équipé, qui complète
  ses filleuls.
- Les envois de code sont limités à 3 par 5 minutes et par adresse, et les connexions à 5 par
  15 minutes. Un quatrième appui rapide sur le même acteur est refusé un moment.
- La politique des conversations de mise en relation (CC-V) n'est PAS ouverte par les comptes
  de démonstration : décision réservée au propriétaire, ou à un opérateur.
- L'équipe de modération de démonstration n'a pas de périmètre : elle reçoit les nouveaux
  signalements du réseau local.
- Pendant la préparation, quelques secondes, l'adhésion est encore « en attente » : la carte de
  statut peut s'afficher, puis se retire.

## Vérifications

- Tests :
  - panneau (7), amorçage (8), catalogue du domaine (6) ;
  - équipement côté moteur : `demoAccounts.test.ts` d'ANTSIA, 36 tests ;
  - cliquets i18n : familles `demoAccounts.*`.
- Recette sur le moteur local, 19/10 au soir :
  - entreprise : statut vérifiée, page « Saveurs du Gabon (démonstration) », offre de service et
    offre d'emploi publiées ;
  - association : statut vérifiée, attestation « vérifiée » aux réglages, page de Lyon, mission
    bénévole publiée.
