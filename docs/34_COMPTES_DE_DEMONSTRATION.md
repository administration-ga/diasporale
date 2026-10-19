# Comptes de démonstration par acteur — 19 octobre 2026

Demande du propriétaire : « le bouton des comptes démo des différents acteurs et users de
DIASPORALE ». Le contrat (17 acteurs) a été posé par la session du plan global ; le
propriétaire a confié la suite à la session de la porte d'entrée. Modèle : les comptes de
démonstration de la racine d'ANTSIA (`convex/modules/platform/demoAccounts.ts`,
`DemoAccountsPanel`, `DemoAccountBootstrap`).

Complément du 19/10 au soir : trois acteurs de plus, pour les comptes de recette du plan global
(docs/14, § 6.1) que les 17 premiers ne couvraient pas. Ce sont le membre bloqué, le suspendu à
la racine et l'utilisateur extérieur au réseau. Le catalogue compte désormais 20 acteurs.

## Ce que voit la personne qui teste

- Sur la porte (`/` et `/entrer`), sous la carte d'accès : un bouton « Comptes de
  démonstration », « Développement local seulement ».
- Il ouvre une feuille, groupée en Membres (statut par statut), Pages, Rôles et services, et
  Accès restreints.
- Chaque acteur montre son nom fictif « Prénom NOM », ce qu'il illustre, son pays et le statut
  qu'il obtiendra. L'utilisateur extérieur au réseau n'a pas de statut : il porte « Hors réseau ».
- Un appui suffit. La connexion passe par le VRAI code à usage unique, lu pour la personne. Puis
  l'accueil, l'équipement et les gestes se font tout seuls, avec un avis du début à la fin. On
  arrive sur le fil ; l'utilisateur extérieur, lui, arrive à l'accueil de DIASPORALE.
- En démonstration (données fictives de ce navigateur), le même bouton mène à `/demo`.
- Ailleurs, catalogue vide, production comprise : rien ne s'affiche.

## Les acteurs (`packages/diasporale-domain/src/demo-accounts.ts`)

Adresses réservées `<acteur>@demo.diasporale.test`. Le domaine `.test` n'est jamais routable.

| Groupe | Acteurs | Ce qui est posé |
|---|---|---|
| Membres | nouveau, leger, declare, parraine, verifie, belgique, canada | Statut dérivé des faits fictifs : rien (en attente), IDN niveau 1 ou 2, parrainage par « verifie », attestation consulaire ; hubs Belgique et Canada. |
| Pages | association, entreprise, media, communaute, institution | Une page par nature dans le pays de l'acteur, l'acteur administrateur. Confiance communauté, vérifiée ou officielle (institution seulement). Type d'association ou secteur. |
| Rôles et services | mentor, talent, moderateur, administrateur | Profil de mentor, profil de talent ; rôle de modération et équipe de démonstration ; administration du réseau. |
| Accès restreints | suspendu, suspendu-racine, bloque, exterieur | Suspension dans DIASPORALE seulement ; suspension à la racine, qui vaut partout ; blocage par « verifie » ; compte ANTSIA sans adhésion DIASPORALE. |

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
   annuaire) et l'adhésion, avec le pays et la ville de l'acteur. L'utilisateur extérieur au
   réseau ne rejoue que l'accueil d'ANTSIA, `demoAccounts.welcomeOutsider` : le consentement au
   profil social, puis le profil publié, par les mutations de l'écran d'accueil. Jamais `join`.
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
   - Le blocage de « bloque » par « verifie », par le vrai mécanisme du moteur :
     `graph/connections.blockPair`, le corps de `blockPerson`, extrait sans changement. Il garde
     les conditions de `blockPerson` : le bloqueur membre actif du réseau, la cible vivante. Il
     se pose dès que les deux comptes existent, quel que soit l'ordre d'équipement, et les deux
     comptes sont retenus sur leur adresse réservée vérifiée.
   - Les sanctions en dernier, car elles ne sont jamais dérivées :
     - la suspension de « suspendu », dans DIASPORALE seulement ;
     - celle de « suspendu-racine » à la racine, par le chemin de la console :
       `people/memberships.suspendRootMembership`, le cœur de `suspendEverywhere`, extrait sans
       changement. Elle vaut partout, et l'adhésion DIASPORALE garde son statut propre.
   - L'utilisateur extérieur n'a pas d'adhésion DIASPORALE. L'équipement exige son accueil
     d'ANTSIA (profil publié, consentement), l'admet à la racine par la vraie règle d'admission,
     comme les comptes de la racine, et n'écrit rien dans DIASPORALE.
   - L'équipement rend le statut EFFECTIF, celui que lit l'application ; statut et rôle sont
     vides sans adhésion.
   - Le tout est idempotent.
5. **Gestes** : par les capacités du port. Ils ne se jouent qu'à la première entrée, et ceux
   d'une page seulement à sa création.

## Limites connues

- L'ordre d'équipement compte pour le parrainage. Équipé avant « verifie », « parraine » reste
  en attente ; il passe déclaré, par parrainage, dès que « verifie » est équipé, qui complète
  ses filleuls. Le blocage de « bloque » se complète de la même façon.
- Rééquiper un acteur le remet dans son état : un blocage levé à la main par « verifie » est
  reposé au prochain équipement de « bloque » ou de « verifie ».
- La suspension à la racine ne se lève que par la console des opérateurs (`liftSuspension`) ;
  les comptes de démonstration ne la lèvent jamais.
- Si l'utilisateur extérieur entre de lui-même dans DIASPORALE, son adhésion reste la sienne :
  l'équipement la rend telle quelle et n'y pose rien.
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
  - panneau (8), amorçage (12), catalogue du domaine (7) ;
  - équipement côté moteur : `demoAccounts.test.ts` d'ANTSIA, 49 tests, dont 13 pour les accès
    restreints, chaque garde avec son contrôle positif ;
  - cliquets i18n : familles `demoAccounts.*`.
- Recette sur le moteur local, 19/10 au soir :
  - entreprise : statut vérifiée, page « Saveurs du Gabon (démonstration) », offre de service et
    offre d'emploi publiées ;
  - association : statut vérifiée, attestation « vérifiée » aux réglages, page de Lyon, mission
    bénévole publiée.
- Recette des accès restreints, même moteur local, 19/10 vers 22 h (`diasporale-engine` sur :3031) :
  - la feuille de la porte montre 20 acteurs en quatre groupes. « Accès restreints » réunit
    Membre suspendu, Suspension à la racine, Membre bloqué et Extérieur au réseau, ce dernier
    marqué « Hors réseau » ;
  - extérieur : arrivée à l'accueil de DIASPORALE (étape 1 sur 3). Côté moteur : profil ANTSIA
    publié (`demo.exterieur`), une seule adhésion, à la racine, « déclarée » ; aucune adhésion
    DIASPORALE ;
  - membre bloqué : « Compte de démonstration prêt : Yannick MBADINGA. », puis le fil. Équipé
    avant son bloqueur, il n'était pas encore bloqué. Le blocage s'est posé à l'équipement de
    « Membre vérifié » : une intention et une ligne de relation fermée dans `diasporale`, et
    l'onglet « Personnes bloquées » de Patrice MBOUMBA en compte une ;
  - suspension à la racine : « Compte de démonstration prêt : Christelle IVANGA. », puis l'avis
    « Votre compte est suspendu ». Côté moteur, la racine est « suspendue » et l'adhésion
    DIASPORALE est restée « vérifiée ».
- Remarques relevées en recette :
  - CORRIGÉE le 19/10 au soir : un compte connecté sans adhésion (l'extérieur, comme le nouvel
    arrivant) n'avait aucune sortie dans l'accueil, ni « Se déconnecter », ni réglages. Le bas de
    `/bienvenue` porte désormais « Ce n'est pas votre compte, ou vous voulez en changer ? » et
    « Se déconnecter partout », la même déconnexion que les réglages (`useSignOutEverywhere`) ;
  - NON CORRIGÉE : sous l'avis de suspension, le fil d'un compte suspendu dit « Les publications
    ne sont pas disponibles. Vérifiez votre connexion », le message générique de tout refus de
    lecture. C'est déjà le cas pour « Membre suspendu ».
