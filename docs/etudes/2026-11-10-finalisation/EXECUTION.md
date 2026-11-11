# Registre des lots de finalisation de DIASPORALE

> Tiré automatiquement du § 5 de chaque plan, le 10 novembre 2026. C'est le tableau de suivi : chaque session met à jour la colonne « État » du lot qu'elle termine, dans la PR de ce lot, et ne touche à aucune autre ligne.
> États : à faire · en cours · fusionné · en ligne · recetté en réel. Ces états ne se confondent jamais (plan directeur, § 7). Le détail de chaque lot est dans son plan.
> Les lots marqués « plan 15 » viennent du plan 15 du dossier d'ANTSIA (`ANTSIA/docs/etudes/2026-11-09-finalisation/15_DIASPORALE.md`) et gardent leur identifiant. Quand un lot y est découpé en volets, l'état se suit ici volet par volet ; la ligne du registre d'ANTSIA se met à jour quand tous les volets sont fusionnés.

## Vue d'ensemble

| Plan | Lots | P0 | P1 | P2 | P3 | dont repris du plan 15 |
|---|---|---|---|---|---|---|
| [Plan 01 — Entrée, adhésion et confiance](01_ENTREE_ADHESION_CONFIANCE.md) | 21 | 7 | 10 | 3 | 1 | 1 |
| [Plan 02 — Coque, navigation, charte et accessibilité](02_COQUE_NAVIGATION_CHARTE_ACCESSIBILITE.md) | 22 | 3 | 13 | 4 | 2 | 3 |
| [Plan 03 — Fil, publications, découverte et recherche](03_FIL_PUBLICATIONS_DECOUVERTE_RECHERCHE.md) | 22 | 5 | 10 | 5 | 2 | 2 |
| [Plan 04 — iCom : messages, appels et mise en relation](04_ICOM_MESSAGES_APPELS_MISE_EN_RELATION.md) | 22 | 4 | 10 | 5 | 3 | 1 |
| [Plan 05 — Profil, relations et annuaire des membres](05_PROFIL_RELATIONS_ANNUAIRE.md) | 20 | 3 | 8 | 7 | 2 | 0 |
| [Plan 06 — Hubs pays, villes et carte de la diaspora](06_HUBS_PAYS_VILLES_CARTE.md) | 20 | 3 | 8 | 6 | 3 | 1 |
| [Plan 07 — Pages, associations et groupes](07_PAGES_ASSOCIATIONS_GROUPES.md) | 21 | 2 | 10 | 6 | 3 | 2 |
| [Plan 08 — Évènements et agenda](08_EVENEMENTS_AGENDA.md) | 22 | 4 | 7 | 6 | 5 | 3 |
| [Plan 09 — Services, rendez-vous et avis](09_SERVICES_RENDEZ_VOUS_AVIS.md) | 20 | 1 | 9 | 8 | 2 | 3 |
| [Plan 10 — Emploi, talents et réseau professionnel](10_EMPLOI_TALENTS.md) | 20 | 2 | 7 | 7 | 4 | 2 |
| [Plan 11 — Entraide, mentorat et kit d'arrivée](11_ENTRAIDE_MENTORAT_KIT_ARRIVEE.md) | 18 | 1 | 9 | 6 | 2 | 1 |
| [Plan 12 — Petites annonces et besoins propres à la diaspora](12_PETITES_ANNONCES_BESOINS_DIASPORA.md) | 19 | 0 | 1 | 3 | 15 | 1 |
| [Plan 13 — Notifications, réglages et données personnelles](13_NOTIFICATIONS_REGLAGES_DONNEES.md) | 19 | 2 | 10 | 5 | 2 | 3 |
| [Plan 14 — Modération, sécurité et conformité](14_MODERATION_SECURITE_CONFORMITE.md) | 22 | 8 | 9 | 2 | 3 | 1 |
| [Plan 15 — Vie publique consulaire](15_VIE_PUBLIQUE_CONSULAIRE.md) | 22 | 1 | 10 | 7 | 4 | 1 |
| [Plan 16 — Application mobile et application web installable](16_APPLICATION_MOBILE_PWA.md) | 22 | 1 | 7 | 3 | 11 | 1 |
| [Plan 17 — Lancement, pilote, exploitation et modèle économique](17_LANCEMENT_PILOTE_EXPLOITATION_MODELE_ECONOMIQUE.md) | 22 | 9 | 8 | 3 | 2 | 5 |
| **Total** | **354** | **56** | **146** | **86** | **66** | **31** |

126 lots demandent quelque chose au moteur (une issue `[S1]`), dont 18 bloquants. 25 lots bloquants n'ont aucune porte. Les lots qui se recouvrent entre plans sont arbitrés au § 5.1 du plan directeur.

## Plan 01 — Entrée, adhésion et confiance

Plan : [`01_ENTREE_ADHESION_CONFIANCE.md`](01_ENTREE_ADHESION_CONFIANCE.md)

| Lot | Titre | Priorité | Taille | Session | Porte | Origine | État |
|---|---|---|---|---|---|---|---|
| EA-01 | Amorcer la confiance : membres fondateurs admis par décision tracée | P0 | M | S2 | décision du propriétaire (qui, combien, dispense, badge affiché) | nouveau | fusionné (#51, antsia#119) ; actions d'audit au moteur (antsia#171, lot 13) ; décisions par la console et au journal : antsia#176 (ouverte) ; écran de console : antsia#120 ; plafond de la cohorte à confirmer |
| EA-02 | Entrée par IDN branchée dans DIASPORALE | P0 | M | S2 | variables IDN et origines sur le déploiement (propriétaire) ; recette avec un vrai compte IDN | nouveau | fusionné (#52) ; variables IDN et recette avec un vrai compte : propriétaire ; refus chez IDN : antsia#122 |
| EA-03 | Statut relu quand l'identité change | P0 | S | S2 | aucune | nouveau | fusionné (#51, antsia#119) ; réconciliation du moteur : antsia#121 |
| EA-04 | Accueil qui respecte un profil existant | P0 | S | S2 | aucune | nouveau | fusionné (#49) |
| EA-05 | Droits personnels et sortie sans adhésion | P0 | S | S2 | aucune | nouveau | fusionné (#40) |
| EA-06 | Recette réelle de l'entrée de DIASPORALE | P0 | S | S2 + propriétaire | clés d'envoi et domaine (propriétaire) ; accord écrit sur le déploiement visé | nouveau | à faire |
| EA-07 | Âge et identification dans l'accueil de DIASPORALE | P0 | M | S2 | juriste (seuil d'âge pour des résidents de France et d'ailleurs, identification) ; D-G11 | nouveau | à faire |
| EA-08 | Porte fiable : durée vraie, renvoi du code, reprise après rechargement | P1 | S | S2 | aucune | nouveau | fusionné (#69) ; aucune durée de code chiffrée tant que le moteur ne la publie pas (antsia#151) |
| DG-009a | Attestation consulaire réelle | P1 | M | S2 + gabon-diplomatie | juriste (A4), clés, équipe de consulat.ga | plan 15 | à faire |
| EA-09 | Élévation : rattacher IDN à un compte léger, bannières qui agissent | P1 | M | S2 | variables IDN (propriétaire) | nouveau | à faire |
| EA-10 | Compte en attente : salle d'attente, lien et QR de demande de parrainage | P1 | S | S2 | aucune | nouveau | fusionné (#69) |
| EA-11 | Invitation par un membre vérifié | P1 | M | S2 | aucune | nouveau | à faire |
| EA-12 | Code par SMS | P1 | S | S2 | passerelle et budget par pays (propriétaire, décision 5) | nouveau | à faire |
| EA-13 | Déclaration d'entrée et règles de la communauté | P1 | S | S2 | juriste pour les deux textes | nouveau | à faire |
| EA-14 | Déménagement et retour au Gabon | P1 | S | S2 | décisions 8 et 9 | nouveau | à faire |
| EA-15 | Compte : appareils, alerte de connexion, moyens de connexion | P1 | M | S2 | aucune | nouveau | à faire |
| EA-16 | Cycle de vie de l'attestation | P1 | M | S2 + gabon-diplomatie | juriste ; équipe de consulat.ga ; décisions 10 et 11 | nouveau | à faire |
| EA-17 | Accueil guidé du nouveau membre, badges et statut expliqués | P2 | M | S2 | aucune | nouveau | à faire |
| EA-18 | Limites du compte en attente et retrait de parrainage par la modération | P2 | S | S2 | décision du propriétaire | nouveau | à faire |
| EA-19 | Passer de DIASPORALE à ANTSIA et retour | P2 | S | S2 | domaines des deux sites branchés (propriétaire) | nouveau | à faire |
| EA-20 | Proches non gabonais | P3 | S | S2 | décision du propriétaire ; juriste | nouveau | à faire |

## Plan 02 — Coque, navigation, charte et accessibilité

Plan : [`02_COQUE_NAVIGATION_CHARTE_ACCESSIBILITE.md`](02_COQUE_NAVIGATION_CHARTE_ACCESSIBILITE.md)

| Lot | Titre | Priorité | Taille | Session | Porte | Origine | État |
|---|---|---|---|---|---|---|---|
| DS-02 | Six boutons à trancher | P1 | S | S2 | publication de la démonstration sur accord | plan 15 | fusionné (#36) |
| DS-03 | Écrans jamais vus, refus en mode moteur, textes | P1 | S | S2 | aucune | plan 15 | à faire |
| DS-08 | Accessibilité AA et budget 3G | P1 | M | S2 | aucune | plan 15 | à faire |
| UX-01 | Pages d'erreur de l'application | P0 | S | S2 | aucune | nouveau | fusionné (#41) |
| UX-02 | Revenir à la page demandée après la connexion | P0 | S | S2 | aucune | nouveau | fusionné (#49) |
| UX-03 | Menu du compte complet : informations, aide, déconnexion | P0 | S | S2 | aucune | nouveau | fusionné (#41) |
| UX-04 | Aide et assistance | P1 | M | S2 | adresse d'assistance fournie par le propriétaire | nouveau | à faire |
| UX-05 | La barre dit toujours où l'on est | P1 | S | S2 | aucune | nouveau | fusionné (#54) |
| UX-06 | Pastille de non-lus sur « Messages » | P1 | S | S2 | aucune | nouveau | fusionné (#54) |
| UX-07 | Retour fiable et filtres gardés | P1 | M | S2 | aucune | nouveau | à faire |
| UX-08 | Le pays visible au téléphone | P1 | S | S2 | aucune | nouveau | à faire |
| UX-09 | États communs : chargement, erreur, refus, connexion perdue | P1 | M | S2 | aucune | nouveau | à faire |
| UX-10 | Icône, aperçu de lien et indexation de la vitrine | P1 | S | S2 | domaine ; décision 4 | nouveau | à faire |
| UX-11 | Textes et cliquets : élision, apostrophes, genre, communication publique | P1 | M | S2 | aucune | nouveau | à faire |
| UX-12 | Alléger le premier chargement | P1 | M | S2 | aucune | nouveau | à faire |
| UX-13 | Barre basse et clavier du téléphone | P1 | S | S2 | aucune | nouveau | à faire |
| UX-14 | Affichage à portée : taille du texte, animations, apparence, langue | P2 | S | S2 | aucune | nouveau | à faire |
| UX-15 | Recherche à portée et raccourcis clavier | P2 | S | S2 | aucune | nouveau | à faire |
| UX-16 | Premiers pas | P2 | M | S2 | aucune | nouveau | à faire |
| UX-17 | « Mon espace » : agenda et regroupement | P2 | S | S2 | aucune | nouveau | à faire |
| UX-18 | Pose des écrans : colonne ou pleine largeur | P3 | M | S2 | décision 9 du propriétaire | nouveau | à faire |
| UX-19 | Déclaration d'accessibilité et état du service | P3 | S | S2 | juriste (obligation applicable ou non) | nouveau | à faire |

## Plan 03 — Fil, publications, découverte et recherche

Plan : [`03_FIL_PUBLICATIONS_DECOUVERTE_RECHERCHE.md`](03_FIL_PUBLICATIONS_DECOUVERTE_RECHERCHE.md)

| Lot | Titre | Priorité | Taille | Session | Porte | Origine | État |
|---|---|---|---|---|---|---|---|
| FD-01 | Photos nettoyées et allégées avant l'envoi | P0 | S | S2 | aucune | nouveau | fusionné (#53) ; images d'iCom : antsia#123 |
| FD-02 | Vidéos lisibles partout et bornées | P0 | S | S2 | aucune | nouveau | fusionné (#53 pour la limite de poids, #64 pour MP4 ou WebM seulement et la durée bornée) ; durée de 5 min proposée par le moteur, à valider par le propriétaire ; conversion `prepareVideoForUpload` non branchée |
| FD-03 | Lire tous les commentaires | P0 | S | S2 | aucune | nouveau | fusionné (#43) |
| FD-04 | L'auteur sait où en est sa publication | P0 | M | S2 | publication du moteur par S1 avant toute mise à jour de la démonstration | nouveau | fusionné (#43) ; l'état « en relecture » en mode moteur attend antsia#108 |
| FD-05 | Signaler un commentaire et un statut | P0 | S | S2 | aucune | nouveau | fusionné (#48) ; signalement d'un statut en attente du moteur (SD-01) |
| FD-06 | Partager vraiment | P1 | M | S2 | aucune | nouveau | à faire |
| FD-07 | Envoyer une publication dans iCom | P1 | S | S2 | aucune | nouveau | à faire |
| FD-08 | Interactions attendues | P1 | M | S2 | aucune | nouveau | à faire |
| FD-09 | Saisie aidée : mentions, mots-dièse, liens | P1 | M | S2 | aucune | nouveau | à faire |
| FD-10 | Gestes de l'auteur que le moteur sert déjà | P1 | S | S2 | aucune | nouveau | à faire |
| FD-11 | Lecture maîtrisée | P1 | M | S2 | aucune | nouveau | à faire |
| FD-12 | Statuts à la hauteur | P1 | M | S2 | aucune | nouveau | à faire |
| FD-13 | Découverte des vidéos | P1 | M | S2 | aucune | nouveau | à faire |
| FD-14 | Fil léger | P1 | M | S2 | aucune | nouveau | à faire |
| DS-11 (volet recherche) | Recherche transversale dans Explorer | P1 | M | S2 | aucune. Priorité relevée de P2 à P1 : le moteur sert déjà la recherche de publications, quatre rubriques ont déjà la leur, et Explorer la promet sans l'offrir | plan 15 | à faire |
| FD-15 | Publication modifiée : date et versions | P2 | S | S2 | aucune | nouveau | à faire |
| FD-16 | Brouillons, programmation, sondages | P2 | L | S2 | aucune | nouveau | à faire |
| FD-17 | « Mon fil » enrichi | P2 | M | S2 | décision du propriétaire | nouveau | à faire |
| FD-18 | Tendances du réseau, par pays | P2 | M | S1 puis S2 | aucune | nouveau | à faire |
| FD-19 | Vidéo et statuts, second niveau | P2 | M | S2 | aucune | nouveau | à faire |
| DS-19 | iAsted concierge | P3 | M | S2 | fournisseur et clés (propriétaire), marquage de l'IA, décision 11 | plan 15 | à faire |
| FD-20 | Découverte adaptée au débit | P3 | S | S2 | choix du fournisseur et hébergement (propriétaire) | nouveau | à faire |

## Plan 04 — iCom : messages, appels et mise en relation

Plan : [`04_ICOM_MESSAGES_APPELS_MISE_EN_RELATION.md`](04_ICOM_MESSAGES_APPELS_MISE_EN_RELATION.md)

| Lot | Titre | Priorité | Taille | Session | Porte | Origine | État |
|---|---|---|---|---|---|---|---|
| DS-04 (volet CC-V) | Recette CC-V et traitement au guichet | P0 | M | S2 | accord du propriétaire pour ouvrir la politique sur la démonstration (décision 1) ; publication éventuelle | plan 15 | à faire |
| IM-01 | Appels : rien n'est proposé tant que le serveur d'appels n'est pas prouvé | P0 | S | S2 | aucune pour le code ; l'ouverture réelle attend les clés du propriétaire et IC-01 | nouveau | fusionné (#36 ; appels déclarés au moteur par #66 et antsia#138) ; aucun appel encore proposé (`CALLS_SWITCH` fermé) |
| IM-02 | Réglages iCom dans les paramètres de DIASPORALE | P0 | S | S2 | aucune | nouveau | fusionné (#50 ; défaut « mes relations seulement » et accusés de lecture par #66 et antsia#138) |
| IM-03 | Messagerie vocale, signaler et bloquer depuis le fil : raccord dans DIASPORALE | P0 | S | S2 | aucune | nouveau | à faire |
| IM-04 | La cloche nomme les avis d'iCom et y mène | P1 | S | S2 | aucune | nouveau | fusionné (#68) |
| IM-05 | iCom vivant sur la démonstration | P1 | M | S2 | accord pour republier la démonstration et y ouvrir la politique (décision 1) | nouveau | à faire |
| IM-06 | Écrire à une page : prise de contact acceptée par l'équipe | P1 | L | S2 | décision 3 ; issue [S1] pour la nature | nouveau | à faire |
| IM-07 | Demandes de message entre membres | P1 | M | S2 | décision 4 | nouveau | à faire |
| IM-08 | Mises en relation : liste au bureau et boîte de la page | P1 | S | S2 | aucune | nouveau | à faire |
| IM-09 | Savoir à qui l'on parle : badge de confiance et pays dans la conversation | P1 | S | S1 | aucune | nouveau | à faire |
| IM-10 | Suivre les lots iCom du moteur dans DIASPORALE | P1 | M | S2 | publication de la démonstration après accord | nouveau | à faire |
| IM-11 | Appels réels : recette à deux et à trois | P1 | S | S2 | clés du propriétaire ; accord pour toute action sur un déploiement en ligne | nouveau | à faire |
| IM-12 | Famille au Gabon : dire la frontière et ouvrir ANTSIA en un geste | P1 | S | S2 | décision 5 | nouveau | à faire |
| IM-13 | Un seul nom pour la messagerie | P1 | S | S2 | décision 6 | nouveau | à faire |
| IM-14 | Fil d'annonces et discussion d'une association | P2 | L | S2 | aucune | nouveau | à faire |
| IM-15 | Boîte de la page : réponses enregistrées, horaires de réponse, absence, suivi | P2 | L | S1 | décision 7 | nouveau | à faire |
| IM-16 | Options d'appel : vidéo depuis le profil, appel d'un groupe | P2 | S | S2 | aucune | nouveau | à faire |
| IM-17 | Heure locale du correspondant | P2 | S | S1 | décision 9 | nouveau | à faire |
| IM-18 | Conversations du réseau racine dans la carte iCom | P2 | M | S1 | décision 5 | nouveau | à faire |
| IM-19 | Réunion d'association : partage d'écran et lien d'appel | P3 | M | S2 | clés du serveur d'appels | nouveau | à faire |
| IM-20 | Chiffrement, messages éphémères, vue unique : décisions et textes honnêtes | P3 | S | S2 | décision 11 ; juriste | nouveau | à faire |
| IM-21 | iCom dans l'application mobile de DIASPORALE | P3 | L | S3 | comptes des magasins d'applications ; clés du serveur d'appels et des notifications | nouveau | à faire |

## Plan 05 — Profil, relations et annuaire des membres

Plan : [`05_PROFIL_RELATIONS_ANNUAIRE.md`](05_PROFIL_RELATIONS_ANNUAIRE.md)

| Lot | Titre | Priorité | Taille | Session | Porte | Origine | État |
|---|---|---|---|---|---|---|---|
| RP-01 | Photo et couverture nettoyées et recadrées | P0 | M | S2 | aucune | nouveau | fusionné (#53) |
| RP-02 | Signaler un profil, et menu « … » de la fiche | P0 | S | S2 | aucune | nouveau | fusionné (#48) |
| RP-03 | Blocage : abonnements, textes et pages | P0 | M | S2 | décision 5 | nouveau | fusionné (#64, antsia#140) ; matrice des surfaces : `docs/40_BLOCAGE_ET_PAGES_RP03.md` |
| RP-04 | Annuaire navigable par pays et par ville | P1 | L | S2 | décision 3 | nouveau | à faire |
| RP-05 | Entraide, associations et pages sur la fiche | P1 | M | S2 | décisions 1 et 2 | nouveau | à faire |
| RP-06 | Gestes de relation déjà prêts au moteur | P1 | M | S2 | aucune | nouveau | à faire |
| RP-07 | Rompre, mes abonnés, suivre en retour, relations en commun | P1 | M | S2 | celles de ces lots | nouveau | à faire |
| RP-08 | Partager un profil : lien, partage natif, code QR | P1 | S | S2 | aucune | nouveau | à faire |
| RP-09 | Suggestions à l'échelle | P1 | M | S2 | aucune | nouveau | à faire |
| RP-10 | Aucune coordonnée dans l'accroche, le nom et la ville | P1 | S | S2 | décision 4 | nouveau | à faire |
| RP-11 | Une fiche plus claire | P1 | S | S2 | aucune | nouveau | à faire |
| RP-12 | Langues, et lien vers le profil de talent et de mentor | P2 | M | S2 | geste d'opérateur sur le schéma du réseau ; décision 7 | nouveau | à faire |
| RP-13 | Changer d'identifiant | P2 | S | S2 | décision 10 | nouveau | à faire |
| RP-14 | Aperçu selon trois lecteurs | P2 | M | S2 | aucune | nouveau | à faire |
| RP-15 | Mur : épingler, puis onglet des médias | P2 | M | S2 | aucune | nouveau | à faire |
| RP-16 | Albums : supprimer, retirer une photo, signaler | P2 | S | S2 | aucune | nouveau | à faire |
| RP-17 | « De passage au Gabon » | P2 | M | S2 | décision 8 | nouveau | à faire |
| RP-18 | Annuaire : extraction mesurée, puis freinée | P2 | M | S2 | décision 3 | nouveau | à faire |
| RP-19 | Attache au Gabon | P3 | S | S2 | avis écrit du juriste sur les données révélant une origine ; décision 9 | nouveau | à faire |
| RP-20 | Suites du moteur : centres d'intérêt, identification, amis proches, statuts à la une | P3 | M | S2 | décisions de ces lots | nouveau | à faire |

## Plan 06 — Hubs pays, villes et carte de la diaspora

Plan : [`06_HUBS_PAYS_VILLES_CARTE.md`](06_HUBS_PAYS_VILLES_CARTE.md)

| Lot | Titre | Priorité | Taille | Session | Porte | Origine | État |
|---|---|---|---|---|---|---|---|
| HB-01 | Dire vrai dans un pays non ouvert | P0 | S | S2 | aucune | nouveau | fusionné (#37) |
| HB-02 | Évènements du pays dans le hub | P0 | M | S2 | aucune en local | nouveau | fusionné (#44, antsia#109) |
| HB-03 | Gardes serveur de la portée locale | P0 | S | S1 et S2 | fichiers du moteur, donc S1 | nouveau | à faire |
| HB-04 | Raccourcis et rubriques du pays consulté | P1 | S | S2 | aucune | nouveau | fusionné (#56) ; annuaire par pays en attente du plan 05 |
| HB-05 | À propos du hub : statut, règles, compteurs datés | P1 | S | S2 | aucune | nouveau | fusionné (#56) |
| HB-06 | Lien partageable d'un hub | P1 | S | S2 | aucune | nouveau | à faire |
| HB-07 | Codes pays contrôlés à la console | P1 | S | S1 | fichiers du moteur, donc S1 | nouveau | à faire |
| HB-08 | Préparer et ouvrir un pays depuis DIASPORALE | P1 | L | S2 et S1 | décision du propriétaire ; S1 | nouveau | à faire |
| HB-09 | Se porter volontaire pour ouvrir son pays | P1 | M | S2 | aucune | nouveau | à faire |
| HB-10 | Villes : saisie guidée et filtre par ville | P1 | M | S2 | décision 7 pour les alias | nouveau | à faire |
| HB-11 | Relecture réelle des publications locales avant l'ouverture | P1 | M | S1 puis S2 | fichiers du moteur ; une équipe de modération du réseau doit exister | nouveau | à faire |
| HB-12 | Suivre un autre pays | P2 | M | S2 | aucune | nouveau | à faire |
| HB-13 | Vue « Toute la diaspora » dans Communautés | P2 | M | S2 | aucune | nouveau | à faire |
| DS-15 | Carte de la diaspora | P2 | M | S2 | tracé des frontières validé par le propriétaire (décision 10) | plan 15 | à faire |
| HB-14 | Annonce épinglée du hub | P2 | M | S2 | aucune | nouveau | à faire |
| HB-15 | Relais locaux visibles | P2 | S | S2 | aucune | nouveau | à faire |
| HB-16 | Mon poste consulaire en tête du hub | P2 | S | S2 | contrat avec gabon-diplomatie | nouveau | à faire |
| HB-17 | Régions pour les pays à petits effectifs | P3 | M | S2 | décision 11 | nouveau | à faire |
| HB-18 | Niveau intermédiaire pour les grands pays | P3 | M | S2 | listes validées par le propriétaire | nouveau | à faire |
| HB-19 | Vitrine publique d'un pays | P3 | M | S2 | décision 13 | nouveau | à faire |

## Plan 07 — Pages, associations et groupes

Plan : [`07_PAGES_ASSOCIATIONS_GROUPES.md`](07_PAGES_ASSOCIATIONS_GROUPES.md)

| Lot | Titre | Priorité | Taille | Session | Porte | Origine | État |
|---|---|---|---|---|---|---|---|
| AS-01 | Trancher une revendication en production, par pays | P0 | M | S2 | durée de conservation des pièces (juriste) | nouveau | fusionné (#67, antsia#147) pour « Pages à vérifier » par pays ; équipe de modération admise et échéance de purge servies par le moteur (antsia#155, lot 10, demande antsia#148), suivies par la file de la tranche (antsia#160) et par l'onglet (#72), lot 6 ; restent : équipes par pays (pas encore au moteur), revendications tranchées avant PG-01 (décision du propriétaire), durée de conservation des pièces (juriste) |
| AS-02 | Signaler une page, un groupe et ses publications | P0 | S | S2 | aucune | nouveau | fusionné (#48) |
| AS-03 | Rouvrir le groupe d'une association | P1 | S | S2 | aucune | nouveau | à faire |
| AS-04 | Renommage d'une page vérifiée au grand jour | P1 | S | S2 | aucune | nouveau | à faire |
| AS-05 | Créer une page sans faux pas : natures servies, pages au nom proche | P1 | S | S2 | aucune | nouveau | à faire |
| AS-06 | Cloches de la vie d'une page et d'un groupe | P1 | S | S2 | aucune | nouveau | à faire |
| AS-07 | « Écrire » à une page | P1 | M | S2 | ouverture de la politique de conversation (plan 04) | nouveau | à faire |
| DS-09 | Groupes thématiques ouverts par pays | P1 | M | S2 | ouverture au pilote après MC-01 du moteur | plan 15 | à faire |
| AS-08 | Groupe d'association : médias, réactions, commentaires, épingle | P1 | M | S2 | aucune | nouveau | à faire |
| AS-09 | Annonce aux adhérents | P1 | M | S2 | aucune | nouveau | à faire |
| AS-10 | Équipe : éditeur, modérateur, transfert guidé, commentaires | P1 | M | S2 | aucune | nouveau | à faire |
| AS-11 | Fermer sa page ; page sans responsable | P1 | M | S2 | décision 8 | nouveau | à faire |
| AS-12 | Groupes : règles, adhésion sur demande, validation des publications | P2 | M | S2 | aucune | nouveau | à faire |
| AS-13 | Statistiques honnêtes et publications programmées | P2 | M | S2 | aucune | nouveau | à faire |
| AS-14 | Adhésion mieux tenue : bureau affiché, recherche, questions, effectif | P2 | M | S2 | décision 12 | nouveau | à faire |
| AS-15 | Pages liées : fédération et antennes | P2 | M | S2 | aucune | nouveau | à faire |
| AS-16 | Annuaire et fiche : ville, tri, horaires, bouton d'action | P2 | S | S2 | aucune | nouveau | à faire |
| DS-16 (volet adhésions) | Remontée dans le moteur des adhésions et du groupe d'adhérents | P2 | L | S1 | décision 11 | plan 15 | à faire |
| AS-17 | Documents partagés de l'association | P3 | M | S2 | décision 12 | nouveau | à faire |
| AS-18 | Discussion instantanée d'une association ou d'un groupe | P3 | M | S2 | décision du plan 04 | nouveau | à faire |
| AS-19 | Suivi déclaratif des cotisations | P3 | S | S2 | décision 12 ; avis du juriste sur cette donnée | nouveau | à faire |

## Plan 08 — Évènements et agenda

Plan : [`08_EVENEMENTS_AGENDA.md`](08_EVENEMENTS_AGENDA.md)

| Lot | Titre | Priorité | Taille | Session | Porte | Origine | État |
|---|---|---|---|---|---|---|---|
| EV-01 | Évènements de démonstration et parcours rejouables | P0 | S | S2 | accord pour les variables du backend local ; publication de la démonstration sur accord écrit | nouveau | fusionné (#42) |
| EV-02 | Le hub ne dit plus « zéro évènement » | P0 | S | S2 | aucune | nouveau | fusionné (#37) |
| EV-03 | Avis aux inscrits : annulation, place obtenue | P0 | M | S1 puis S2 | publication du backend par S1 | nouveau | fusionné (#63, antsia#139) ; motifs d'annulation à valider par le propriétaire |
| EV-04 | Signaler un évènement et un ajout de galerie | P0 | S | S2 | aucune | nouveau | fusionné (#48) |
| EV-05 | Évènements du pays dans le hub : liste, compteur, ville, catégorie, portée | P1 | L | S1 puis S2 | issue `[S1]` acceptée ; publication du backend par S1. Repli si S1 ne peut pas : une projection nocturne dans la tranche, avec son retard dit à l'écran | nouveau | à faire |
| EV-06 | Liste d'une page : à venir d'abord, passés ensuite | P1 | S | S1 puis S2 | aucune | nouveau | à faire |
| EV-07 | Faire connaître un évènement : annonce de la page, carte dans le fil, partage | P1 | M | S1 puis S2 | issue `[S1]` ; publication du backend par S1 | nouveau | à faire |
| EV-08 | Reporter un évènement et informer les inscrits | P1 | M | S1 puis S2 | issue `[S1]` | nouveau | à faire |
| EV-09 | Image de couverture d'un évènement | P1 | M | S1 puis S2 | issue `[S1]` | nouveau | à faire |
| EV-10 | Accueil qui marche sur tous les téléphones, et liste des inscrits pour l'équipe | P1 | M | S1 puis S2 | décision 3 pour la liste ; le code court et le pointage par identifiant n'attendent rien | nouveau | à faire |
| EV-11 | Évènements des pages d'entreprise et des pages officielles | P1 | M | S1 (PG-03) puis S2 | décisions 1 et 2 du plan 07 du moteur ; décision 4 de ce plan | nouveau | à faire |
| DS-10 | Évènements de personne et récurrents | P2 | M | S1 (plan 07) puis S2 | décision 5 | plan 15 | à faire |
| EV-12 | Accompagnants : « je viens à trois » | P2 | M | S1 puis S2 | issue `[S1]` | nouveau | à faire |
| EV-13 | « Intéressé » et discussion d'évènement | P2 | S | S2 | aucune | nouveau | à faire |
| EV-14 | Dupliquer un évènement et tableau de bord de l'équipe | P2 | M | S2 | aucune | nouveau | à faire |
| EV-15 | Participation aux frais annoncée, sans encaissement | P2 | S | S1 puis S2 | décision du propriétaire | nouveau | à faire |
| DS-16 (volet évènements) | Remontée dans le moteur des fonctions communes | P2 | L | S1 (plans 07, 08, 09) avec S2 | décision du propriétaire | plan 15 | à faire |
| EV-16 | Questions à l'inscription | P3 | S | S2 | lot du moteur livré | nouveau | à faire |
| EV-17 | Galerie : contributions des participants et droit à l'image | P3 | M | S1 puis S2 | avis du juriste sur le droit à l'image ; décision 7 | nouveau | à faire |
| EV-18 | Abonnement à mon agenda par flux de calendrier | P3 | M | S1 puis S2 | décision 8 ; revue de sécurité | nouveau | à faire |
| DS-18 | Direct d'un évènement d'association | P3 | M | S2 | clés LiveKit et Egress | plan 15 | à faire |
| EV-19 | Évènements jumelés entre pays | P3 | M | S2 | pages officielles en place ; décision 9 | nouveau | à faire |

## Plan 09 — Services, rendez-vous et avis

Plan : [`09_SERVICES_RENDEZ_VOUS_AVIS.md`](09_SERVICES_RENDEZ_VOUS_AVIS.md)

| Lot | Titre | Priorité | Taille | Session | Porte | Origine | État |
|---|---|---|---|---|---|---|---|
| SV-01 | Avis publiables : politique des deux surfaces et parcours prouvé | P0 | S | S2 | décision 2 ; rôle d'administrateur du réseau sur chaque déploiement (propriétaire) | nouveau | à faire |
| SV-02 | Rappel du rendez-vous, rendez-vous à venir et fichier de calendrier | P1 | M | S2 | décision 6 (moment du rappel) | nouveau | à faire |
| SV-03 | Déplacer un rendez-vous confirmé | P1 | M | S2 | aucune | nouveau | fusionné (#59, antsia#132) ; avis de cloche fusionnés au lot 13 (antsia#172, #78 ; demande antsia#133) |
| SV-04 | Proposition préremplie et réglages de prestation de la page | P1 | S | S2 | aucune | nouveau | fusionné (#59, antsia#132) ; réglages par offre, non par page |
| SV-05 | Catégories élargies et politique des professions réglementées | P1 | M | S2 | décisions 3 et 4 ; juriste pour le texte sur les professions réglementées | nouveau | à faire |
| SV-06 | Trouver près de chez soi : villes desservies, pays d'entrée, langue, tri | P1 | M | S2 | décision 5 | nouveau | à faire |
| SV-07 | Avis : prévenir l'équipe, inviter le demandeur, feuille de signalement commune | P1 | S | S2 | aucune | nouveau | à faire |
| SV-08 | Réalisations : photos de la page attachées à une offre | P1 | M | S2 | décision 8 | nouveau | à faire |
| SV-09 | Plusieurs rendez-vous simultanés pour une page | P1 | S | S2 | aucune | nouveau | fusionné (#59, antsia#132) |
| SV-10 | Problème sur un rendez-vous : professionnel absent, rendez-vous sans constat | P1 | M | S2 | décision 9 ; juriste pour les textes | nouveau | à faire |
| DS-11 (volet favoris) | Retrouver : offres enregistrées | P2 | M | S2 | aucune | plan 15 | à faire |
| DS-12 | Disponibilités des prestataires et créneaux | P2 | L | S2 | décision 10 ; aucun paiement | plan 15 | à faire |
| SV-11 | Demande enrichie : photo de référence, lieu souhaité, nombre de personnes | P2 | M | S2 | aucune | nouveau | à faire |
| SV-12 | « Mon activité » : à traiter, rendez-vous à venir, délai de réponse | P2 | M | S2 | décision 7 (seuils) | nouveau | à faire |
| SV-13 | Avis : moyenne sous seuil, tri, avis d'une relation | P2 | M | S2 | décision 7 | nouveau | à faire |
| SV-14 | Partager une offre | P2 | S | S2 | aucune | nouveau | à faire |
| SV-15 | Refuser les demandes d'une personne | P2 | S | S2 | aucune | nouveau | à faire |
| DS-16 (volet services et avis) | Remontée dans le moteur des fonctions communes | P2 | L | S1 avec S2 | décision 11 | plan 15 | à faire |
| SV-16 | Demande ouverte à plusieurs prestataires | P3 | L | S2 | décision du propriétaire ; garde-fous contre la sollicitation | nouveau | à faire |
| SV-17 | Services au pays : passerelle vers les prestataires du Gabon sur ANTSIA | P3 | S | S2 | décision 12 | nouveau | à faire |

## Plan 10 — Emploi, talents et réseau professionnel

Plan : [`10_EMPLOI_TALENTS.md`](10_EMPLOI_TALENTS.md)

| Lot | Titre | Priorité | Taille | Session | Porte | Origine | État |
|---|---|---|---|---|---|---|---|
| EM-01 | Fiche et candidature protégées contre les fausses offres | P0 | S | S2 | relecture du texte par le propriétaire | nouveau | fusionné (#45) ; motifs dédiés « frais demandés au candidat » et « usurpation d'une entreprise » au lot 8 (#77, antsia#168) ; textes à relire par le propriétaire |
| EM-02 | Conservation des candidatures : durées décidées et purge | P0 | S | S2 | juriste (durées, note de refus et droit d'accès) | nouveau | à faire |
| EM-03 | Durée de vie d'une offre et relance de l'équipe | P1 | S | S2 | décision 7 | nouveau | à faire |
| EM-04 | Rubrique « Emplois » sur la fiche d'une page | P1 | S | S2 | aucune | nouveau | à faire |
| EM-05 | Recherche d'offres : filtres dans l'adresse, langue, ancienneté | P1 | M | S2 | aucune | nouveau | à faire |
| EM-06 | Offre plus précise : secteur, niveau, alternance, prise de poste | P1 | M | S2 | décision 8 (listes) | nouveau | à faire |
| EM-07 | Postes au Gabon : le « retour au pays » | P1 | M | S2 | décision 2 : le code refuse aujourd'hui le Gabon exprès | nouveau | à faire |
| EM-08 | Proposer une offre à un talent | P1 | L | S2 | décision 6 | nouveau | à faire |
| EM-09 | Parcours dans le profil de talent : expériences et formations | P1 | M | S2 | décision 5 | nouveau | à faire |
| EM-10 | Suivi de recrutement et espace recruteur | P2 | M | S2 | décision 9 (rouvrir le choix du 19/10 : pas d'état de fin en V1) | nouveau | à faire |
| DS-11 (volet alertes emploi) | Retrouver : offres enregistrées et alertes emploi | P2 | M | S2 | aucune | plan 15 | à faire |
| EM-11 | Talents : ville, contrat recherché, visibilité choisie, fiche | P2 | M | S2 | aucune | nouveau | à faire |
| EM-12 | Faire connaître une offre : iCom et fil de la page | P2 | M | S2 | aucune | nouveau | à faire |
| EM-13 | Premier emploi à l'étranger : passerelles vers le mentorat et le kit | P2 | S | S2 | aucune | nouveau | à faire |
| EM-14 | Indicateurs emploi du pilote | P2 | S | S2 | aucune | nouveau | à faire |
| DS-16 (volet emploi) | Remontée dans le moteur des fonctions communes | P2 | L | S1 (plan 09) avec S2 | décision 6 du plan 15 | plan 15 | à faire |
| EM-15 | CV en pièce jointe dès la candidature | P3 | M | S2 | décision 4 | nouveau | à faire |
| EM-16 | Offres du Gabon lues sur ANTSIA | P3 | M | S1 puis S2 | décision 3 ; D-G01 (« aucun lien PRO.GA ») à préciser | nouveau | à faire |
| EM-17 | Concours et recrutements officiels | P3 | S | S2 | contrat avec gabon-diplomatie | nouveau | à faire |
| EM-18 | Agrégats des compétences de la diaspora | P3 | M | S2 | décision 10 ; juriste | nouveau | à faire |

## Plan 11 — Entraide, mentorat et kit d'arrivée

Plan : [`11_ENTRAIDE_MENTORAT_KIT_ARRIVEE.md`](11_ENTRAIDE_MENTORAT_KIT_ARRIVEE.md)

| Lot | Titre | Priorité | Taille | Session | Porte | Origine | État |
|---|---|---|---|---|---|---|---|
| ET-01 | Bénévoles prévenus, promesses vraies | P0 | S | S2 | issue `[S1]` | nouveau | fusionné (#39, #63, antsia#139) |
| ET-02 | Conversation entre l'équipe et chaque bénévole | P1 | M | S2 | politique contextuelle ouverte par un opérateur ; issue `[S1]` | nouveau | à faire |
| ET-03 | Garde sur les conseils sensibles | P1 | S | S2 | relecture du texte ; question posée au juriste (plan 14) | nouveau | à faire |
| ET-04 | Retrouver : thème, mots, sans réponse | P1 | M | S2 | aucune | nouveau | fusionné (#60, antsia#135) |
| ET-05 | Mentorat : créneau convenu, avis, rappel | P1 | M | S2 | issue `[S1]` | nouveau | à faire |
| ET-06 | Kit de départ du pays pilote, relecteurs désignés | P1 | M | S2 + propriétaire | associations relais et relecteurs désignés par le propriétaire (décision 6) | nouveau | à faire |
| ET-07 | Vie d'une ressource : relecteurs et auteurs prévenus | P1 | S | S2 | issue `[S1]` | nouveau | à faire |
| ET-08 | Premiers pas du nouvel arrivant | P1 | M | S2 | issue `[S1]` | nouveau | à faire |
| ET-09 | Missions et questions là où l'on passe | P1 | S | S2 | aucune | nouveau | fusionné (#60, antsia#135) |
| ET-10 | Mesure d'utilité de l'entraide | P1 | S | S2 | aucune | nouveau | fusionné (#60, antsia#135) |
| DS-13 | Mentorat : retour après séance | P2 | S | S2 | aucune | plan 15 | à faire |
| ET-11 | Mentorat dans la durée : séances, objectifs, besoin publié | P2 | M | S2 | issue `[S1]` | nouveau | à faire |
| ET-12 | Entraide vivante : merci, suivre, photo, questions proches | P2 | M | S2 | issue `[S1]` | nouveau | à faire |
| ET-13 | « Disponible pour aider » utile, badge Mentor au profil | P2 | S | S2 | aucune | nouveau | à faire |
| ET-14 | Missions : complète visible, liste d'attente, rappel, présence | P2 | M | S2 | issue `[S1]` | nouveau | à faire |
| ET-15 | Kit par étapes et en deux langues | P2 | M | S2 | liste des étapes validée par le propriétaire | nouveau | à faire |
| ET-16 | Kit lisible avant le départ | P3 | M | S1 + S2 | décision 10 ; issue `[S1]` | nouveau | à faire |
| ET-17 | Appel à la solidarité d'une association | P3 | M | S2 | décision 11 ; avis du juriste sur les données de santé et de tiers | nouveau | à faire |

## Plan 12 — Petites annonces et besoins propres à la diaspora

Plan : [`12_PETITES_ANNONCES_BESOINS_DIASPORA.md`](12_PETITES_ANNONCES_BESOINS_DIASPORA.md)

| Lot | Titre | Priorité | Taille | Session | Porte | Origine | État |
|---|---|---|---|---|---|---|---|
| AN-01 | Guide « Éviter les arnaques » et rappel de prudence | P1 | S | S2 | relecture du texte par le propriétaire | nouveau | à faire |
| AN-02 | Règles pures des annonces dans le domaine | P2 | M | S2 | décisions du propriétaire | nouveau | à faire |
| AN-03 | Contrat d'annonces pour plusieurs réseaux, demandé au moteur | P2 | S | S2 | décision du propriétaire | nouveau | à faire |
| AN-04 | Besoins fermés : règles écrites, refus explicites et orientation | P2 | S | S2 | relecture par le juriste des phrases qui citent le droit | nouveau | à faire |
| AN-05 | Port des annonces, démonstration et adaptateur moteur | P3 | M | S2 | fusion de SU07a | nouveau | à faire |
| AN-06 | Déposer une annonce | P3 | L | S2 | SU01a, b, c, d, h pour toute mise en ligne | nouveau | à faire |
| AN-07 | Rubrique : liste, filtres, fiche et onglet du hub | P3 | L | S2 | comme AN-06 | nouveau | à faire |
| AN-08 | « Mes annonces » | P3 | M | S2 | comme AN-06 | nouveau | à faire |
| AN-09 | Écrire à l'annonceur | P3 | M | S2 | décision du propriétaire et ADR | nouveau | à faire |
| AN-10 | Signaler une annonce, relecture et bureau | P3 | M | S2 | équipe de modération du pays en place | nouveau | à faire |
| AN-11 | Logement | P3 | M | S2 | questions au juriste (décision 11) | nouveau | à faire |
| AN-12 | Colis vers le Gabon | P3 | M | S2 | avis du juriste (décision 7) | nouveau | à faire |
| AN-13 | Covoiturage | P3 | S | S2 | question au juriste (décision 11) | nouveau | à faire |
| AN-14 | « Je cherche » et alerte | P3 | M | S2 | comme AN-06 | nouveau | à faire |
| AN-15 | Enregistrer une annonce | P3 | S | S2 | aucune autre que l'ouverture | nouveau | à faire |
| AN-16 | « Passer pro » : de l'annonce à la page | P3 | S | S2 | seuil fixé par le propriétaire | nouveau | à faire |
| AN-17 | Mesure des annonces | P3 | S | S2 | aucune autre que l'ouverture | nouveau | à faire |
| AN-18 | Annonces sur le téléphone | P3 | M | S3 | décision sur l'application mobile (DG-028) | nouveau | à faire |
| DS-17 | Petites annonces | P3 | L | S2 | SU01a, b, c, d, h ; décision 7 du plan 15 ; équipe de modération du pays ; accord écrit pour la publication | plan 15 | à faire |

## Plan 13 — Notifications, réglages et données personnelles

Plan : [`13_NOTIFICATIONS_REGLAGES_DONNEES.md`](13_NOTIFICATIONS_REGLAGES_DONNEES.md)

| Lot | Titre | Priorité | Taille | Session | Porte | Origine | État |
|---|---|---|---|---|---|---|---|
| NP-01 | Consentements : portée et retrait effectifs | P0 | S | S2 | aucune | nouveau | fusionné (#40, antsia#106) |
| NP-02 | « Mes données » ouverte hors adhésion, et en démonstration | P0 | S | S2 | aucune | nouveau | fusionné (#40) |
| NP-03 | Export complet des mises en relation | P1 | S | S2 + S1 | avis du juriste conseillé | nouveau | à faire |
| NP-04 | Cloche complète : page, suite, filtre, genres nommés | P1 | M | S2 | aucune | nouveau | fusionné (#68) ; filtre « Non lues » sur les avis chargés seulement : filtre serveur et destination d'une invitation de groupe demandés (antsia#149) |
| NP-05 | Matrice des avis et genres manquants | P1 | S | S2 + S1 | aucune | nouveau | à faire |
| DS-14 (volet préférences) | Préférences de notification par famille et plafond | P1 | M | S2 + S1 | décisions 2 et 3 | plan 15 | à faire |
| DS-14 (volet push) | Notifications du navigateur | P1 | M | S2 + S1 | clés et variables (propriétaire) ; publication | plan 15 | à faire |
| NP-06 | Réglages en rubriques | P1 | M | S2 | aucune | nouveau | à faire |
| NP-07 | Fuseau personnel et région | P1 | S | S2 | aucune | nouveau | à faire |
| NP-08 | Registre des consentements complet | P1 | M | S2 | textes relus par le juriste (DS-07) | nouveau | à faire |
| NP-09 | Effacement expliqué, suites pour les autres | P1 | S | S2 | aucune | nouveau | à faire |
| NP-10 | Durées de conservation de la tranche | P1 | M | S2 + S1 | juriste (durées) | nouveau | à faire |
| DS-14 (volet résumé) | Résumé mensuel par pays | P2 | M | S2 + S1 | clé d'envoi, expéditeur par réseau, décision 4 | plan 15 | à faire |
| NP-11 | Courriel quotidien des avis en attente | P2 | M | S1 | décision 1 ; clé d'envoi | nouveau | à faire |
| NP-12 | Pause et heures calmes | P2 | S | S2 | aucune | nouveau | à faire |
| NP-13 | Export lisible et par rubrique | P2 | M | S2 | aucune | nouveau | à faire |
| NP-14 | Sourdine par page, association et groupe | P2 | M | S2 + S1 | aucune | nouveau | à faire |
| NP-15 | Mesure d'usage consentie | P3 | S | S2 | projet de mesure et jeton (propriétaire) ; texte validé | nouveau | à faire |
| NP-16 | Compte d'un membre décédé | P3 | M | S2 | juriste ; décision 9 | nouveau | à faire |

## Plan 14 — Modération, sécurité et conformité

Plan : [`14_MODERATION_SECURITE_CONFORMITE.md`](14_MODERATION_SECURITE_CONFORMITE.md)

| Lot | Titre | Priorité | Taille | Session | Porte | Origine | État |
|---|---|---|---|---|---|---|---|
| DS-04 (volet guichet) | Recette CC-V et traitement au guichet | P0 | M | S2 | accord pour les variables du backend local ; rien sur la démonstration en ligne sans accord écrit | plan 15 | à faire |
| MD-01 | Responsables du réseau : nommer l'administration et les modérateurs | P0 | M | S2 + S1 | décision 2 du § 7 ; publication du moteur par S1 | nouveau | fusionné (#62, antsia#136) ; nomination réelle : propriétaire |
| MD-02 | Signaler depuis chaque objet de DIASPORALE | P0 | L | S2 | aucune | nouveau | fusionné (#48) ; groupe (antsia#137, #143) et refus d'auto-signalement d'un signataire (antsia#174, lot 13) servis par le moteur ; réponse d'avis et direct d'une page : PR à part du moteur |
| MD-03 | Signaler et modérer une offre de service | P0 | M | S2 + S1 | publication du moteur par S1 | nouveau | à faire |
| MD-04 | Réglages de modération au guichet | P0 | M | S2 | décision 4 du § 7 (valeurs de départ) | nouveau | fusionné (#67, antsia#147) ; valeurs de départ des réglages à valider par le propriétaire, aucun réglage écrit en base |
| MD-05 | Règles de la communauté et charte des modérateurs | P0 | S | S2 + propriétaire | relecture du juriste (décision 1) ; décisions 7 et 9 | nouveau | fusionné (#55) ; texte provisoire, relecture du juriste et du propriétaire |
| MD-06 | Permanence, escalade et procédure d'incident | P0 | S | S2 + propriétaire | décision 2 du § 7 ; questions 6 et 7 au juriste | nouveau | fusionné (#55) ; exercice à blanc non joué |
| MD-07 | Protéger le déclarant : l'auteur ne lit qu'une décision | P0 | S | S2 + S1 | décision 6 du § 7 | nouveau | fusionné (#45) pour l'application ; moteur : antsia#99 servie par antsia#156 (lot 10) et antsia#110 ; le port reprend la règle du moteur : #74 (lot 7) |
| MD-08 | Équipes par pays : compétence scellée et routage | P1 | L | S1 puis S2 | obligatoire avant l'ouverture d'un deuxième pays | nouveau | à faire |
| MD-09 | Mesures lourdes selon la qualité du décideur | P1 | S | S1 puis S2 | décision 3 du § 7 | nouveau | à faire |
| MD-10 | Signaler une demande, une proposition, une demande d'adhésion | P1 | M | S2 + S1 | aucune | nouveau | à faire |
| MD-11 | Délais tenus : alerter l'équipe et mesurer | P1 | M | S2 + S1 | aucune | nouveau | à faire |
| MD-12 | Avis motivé, récidive et état du compte | P1 | M | S2 | texte des règles relu | nouveau | à faire |
| MD-13 | Arnaques et usurpation propres à la diaspora | P1 | M | S2 | décision 9 pour les textes | nouveau | à faire |
| MD-14 | Outils et avis des responsables d'espace | P1 | S | S2 | arbitrage A7 du moteur | nouveau | à faire |
| MD-15 | Fermer une rubrique ou un pays en urgence | P1 | M | S2 + S1 | aucune | nouveau | à faire |
| MD-16 | Chiffres de modération pour les membres | P1 | S | S2 | décision 11 du § 7 | nouveau | à faire |
| MD-17 | Confort du guichet | P2 | S | S2 | aucune | nouveau | à faire |
| MD-18 | Signalement par un tiers sans compte | P2 | M | S2 + S1 | réponse du juriste (questions 3 et 6) | nouveau | à faire |
| MD-19 | Âge et mineurs | P3 | M | S2 | arbitrages A3 et A4 ; question 5 au juriste ; D-G11 | nouveau | à faire |
| MD-20 | Mesures sur ordre, conservation, coopération | P3 | S | S2 | arbitrages A2 et A12 ; question 7 au juriste | nouveau | à faire |
| MD-21 | Contenus sensibles | P3 | S | S2 | contrat d'empreintes (moteur) ; le voile n'en dépend pas | nouveau | à faire |

## Plan 15 — Vie publique consulaire

Plan : [`15_VIE_PUBLIQUE_CONSULAIRE.md`](15_VIE_PUBLIQUE_CONSULAIRE.md)

| Lot | Titre | Priorité | Taille | Session | Porte | Origine | État |
|---|---|---|---|---|---|---|---|
| VC-01 | Dire vrai sur l'officiel à l'ouverture du pilote | P0 | S | S2 | aucune | nouveau | fusionné (#37) |
| VC-02 | Trancher la voie de l'Officiel et amender le contrat avant sa mise en service | P1 | S | S2 + propriétaire | décision du propriétaire ; équipe de gabon-diplomatie | nouveau | à faire |
| VC-03 | Remettre à niveau les deux contrats côté consulat.ga | P1 | M | gabon-diplomatie | validation juridique (arbitrage A4) ; accord écrit du propriétaire ; gouvernance de publication de gabon-diplomatie | nouveau | à faire |
| VC-04 | Page officielle du poste pilote par la console, et habilitation tracée | P1 | S | S2 (+ S1 : PG-01) | mandat écrit du poste ou du ministère ; accord pour toute action sur un déploiement en ligne | nouveau | à faire |
| VC-05 | Nom et lien du poste de rattachement sur le profil | P1 | S | S2 | aucune | nouveau | à faire |
| VC-06 | Passerelles « Contacter le poste » et « Faire la démarche » | P1 | S | S2 | liste des adresses publiques fournie par l'équipe de consulat.ga ; décision 5 | nouveau | à faire |
| DG-009b | Import public et pages « Officiel » des postes | P1 | L | S2 (+ S1 si le schéma change) | contrat signé par gabon-diplomatie ; clés du propriétaire ; avis du juriste (décision 13) | plan 15 | à faire |
| VC-07 | Pays de juridiction, type de poste et « Trouver mon poste » | P1 | S | S2 (+ S1) | aucune | nouveau | à faire |
| VC-08 | Annonce officielle en tête du hub | P1 | S | S2 | aucune | nouveau | à faire |
| VC-09 | Recette croisée R5 et R6 avec consulat.ga | P1 | M | S2 + gabon-diplomatie | clés et environnements du propriétaire ; équipe de consulat.ga | nouveau | à faire |
| VC-10 | Bouton « Rejoindre DIASPORALE » dans consulat.ga | P1 | S | gabon-diplomatie | gouvernance de publication de gabon-diplomatie ; décision 12 | nouveau | à faire |
| VC-11 | Communiqués de consulat.ga proposés aux signataires | P2 | M | S2 (+ S1) | décision 4 | nouveau | à faire |
| VC-12 | Alertes consulaires | P2 | M | S2 (+ S1 : SU09) | décision 6 | nouveau | à faire |
| VC-13 | Agenda consulaire : tournées, permanences, information électorale | P2 | M | S2 (+ S1 : PG-03) | décision 7 | nouveau | à faire |
| VC-14 | Parole officielle : commentaires, réponse au nom de la page, neutralité | P2 | M | S2 (+ S1) | décision 8 ; avis du juriste | nouveau | à faire |
| VC-15 | Mandats des signataires : revue périodique et retrait | P2 | S | S2 (+ S1) | décision 3 | nouveau | à faire |
| VC-16 | Fin de validité et révocation d'une attestation | P2 | M | S2 + gabon-diplomatie (+ S1) | juriste, pour la durée ; décision 10 | nouveau | à faire |
| VC-17 | Tableau du poste : agrégats par pays, avec seuil | P2 | M | S2 | décision 11 | nouveau | à faire |
| VC-18 | Gel puis redirection de l'Espace Communauté de consulat.ga | P3 | M | gabon-diplomatie | décision 12 ; gouvernance de gabon-diplomatie | nouveau | à faire |
| VC-19 | Logos officiels importés sous garde | P3 | M | S1 | origines des médias déclarées par le propriétaire | nouveau | à faire |
| VC-20 | Communiqués synchronisés sans personne, retrait automatique | P3 | L | S1 | décision 4 | nouveau | à faire |
| VC-21 | Pages des postes lisibles depuis ANTSIA et sans compte | P3 | S | S2 + propriétaire | décision 9 | nouveau | à faire |

## Plan 16 — Application mobile et application web installable

Plan : [`16_APPLICATION_MOBILE_PWA.md`](16_APPLICATION_MOBILE_PWA.md)

| Lot | Titre | Priorité | Taille | Session | Porte | Origine | État |
|---|---|---|---|---|---|---|---|
| MO-01 | Passe sur téléphones réels | P0 | S | S2 + propriétaire | présence du propriétaire avec ses téléphones ; accord pour toute publication de la démonstration | nouveau | à faire |
| MO-02 | Icônes, manifeste et installation | P1 | S | S2 | icône validée par le propriétaire (décision 3) | nouveau | fusionné (#58) ; icône provisoire à valider par le propriétaire |
| MO-03 | Destination conservée à travers l'entrée | P1 | S | S2 | aucune | nouveau | fusionné (#49) |
| MO-04 | Reprise de la saisie du code après un aller-retour | P1 | S | S2 | aucune | nouveau | fusionné (#69) |
| MO-05 | Script de fond unique et page hors-ligne | P1 | M | S2 | aucune | nouveau | fusionné (#58) ; recette hors-ligne non jouée |
| MO-06 | Notifications sur l'écran d'accueil : pastille, aide iPhone, ouverture | P1 | S | S2 | clés du navigateur et déclaration de l'application `diasporale_com` (propriétaire) | nouveau | à faire |
| MO-07 | Billet QR gardé pendant sa durée de vie | P1 | S | S2 | aucune | nouveau | à faire |
| MO-08 | Lecture du code QR sur tous les téléphones | P1 | M | S2 | aucune | nouveau | à faire |
| MO-09 | Invitation à installer, au bon moment | P2 | S | S2 | domaine `diasporale.com` branché (décision 2) | nouveau | à faire |
| MO-10 | Décision d'architecture mobile, écrite | P2 | S | S2 + propriétaire | décision du propriétaire (décision 1) | nouveau | à faire |
| MO-11 | Adaptateurs du moteur partagés entre le site et le natif | P2 | L | S2 | aucune | nouveau | à faire |
| MO-12 | Le moteur accepte une seconde application native | P3 | M | S1 | variables et clés du propriétaire | nouveau | à faire |
| MO-13 | Socle natif partagé et jetons de la charte | P3 | M | S3 + S1 | aucune | nouveau | à faire |
| DG-028 | Application mobile DIASPORALE | P3 | L | S2 ou S3 | comptes des boutiques d'applications ; accords de compilation et de soumission | plan 15 | à faire |
| MO-14 | Natif 1 : socle, porte et accueil | P3 | L | S2 ou S3 | accord de compilation ; disque libre | nouveau | à faire |
| MO-15 | Natif 2 : fil et hub du pays | P3 | L | S2 ou S3 | aucune | nouveau | à faire |
| MO-16 | Natif 3 : messages et notifications poussées | P3 | L | S2 ou S3 | clés APNs et compte Firebase du propriétaire | nouveau | à faire |
| MO-17 | Natif 4 : évènements, billet et lecteur de code | P3 | M | S2 ou S3 | aucune | nouveau | à faire |
| MO-18 | Natif 5 : services et demandes | P3 | M | S2 ou S3 | aucune | nouveau | à faire |
| MO-19 | Exigences des boutiques et dossier de publication | P3 | M | S2 + propriétaire | comptes des boutiques, entité éditrice, juriste (âge) | nouveau | à faire |
| MO-20 | Appels natifs | P3 | L | S3 + S1 | clés du serveur vidéo, APNs, FCM ; recette physique | nouveau | à faire |
| MO-21 | Liens universels et domaine | P3 | S | S2 | domaine `diasporale.com` branché (propriétaire) | nouveau | à faire |

## Plan 17 — Lancement, pilote, exploitation et modèle économique

Plan : [`17_LANCEMENT_PILOTE_EXPLOITATION_MODELE_ECONOMIQUE.md`](17_LANCEMENT_PILOTE_EXPLOITATION_MODELE_ECONOMIQUE.md)

| Lot | Titre | Priorité | Taille | Session | Porte | Origine | État |
|---|---|---|---|---|---|---|---|
| DS-01 | Contrôle de départ, état réel et documents | P0 | S | S2 | accord pour les variables du backend local | plan 15 | fusionné (#34, #35) |
| LX-01 | Sonde de santé vraie, version servie et garde de la source de données | P0 | S | S2 | publication de la démonstration sur accord | nouveau | fusionné (#33) |
| LX-04 | Banc de recette local : ouvrir la mise en relation sans opérateur | P0 | S | S2 | décision 2 | nouveau | fusionné (antsia#106) pour la graine locale ; ouverture de la politique : à brancher sur antsia#129 |
| DS-05 | Campagne de recettes en mode moteur | P0 | L | S2 | aucune en local ; toute action sur la démonstration en ligne après accord | plan 15 | à faire |
| LX-02 | Publication et retour arrière de DIASPORALE dans le dépôt | P0 | M | S2 | toute exécution réelle exige l'accord écrit du propriétaire | nouveau | fusionné (#47) ; retour arrière non joué sur la démonstration (accord écrit requis) |
| LX-03 | Responsables du réseau en production et lecteurs du tableau du pilote | P0 | M | S2 | nomination réelle : propriétaire | nouveau | fusionné (#62, antsia#136) |
| DS-06 | Dossier de mise en production | P0 | M | S2 | hébergement A10, domaine, secrets, création du réseau : propriétaire | plan 15 | fusionné (#47) ; rien du dossier n'a été joué |
| LX-05 | Charpente des textes manquants : conditions d'utilisation, règles de la communauté, contact | P0 | S | S2 | fond des textes : juriste | nouveau | fusionné (#50) ; fond des textes : juriste |
| DS-07 | Textes légaux définitifs | P0 | S | S2 | juriste (A11), informations de l'éditeur | plan 15 | à faire |
| LX-06 | Garde de qualité et hygiène du dépôt public | P1 | M | S2 | aucune | nouveau | fusionné (#57) ; l'historique git garde les valeurs retirées (décision du propriétaire) |
| LX-07 | Intégration continue en lecture seule | P1 | S | S2 | décision 8 (automatisations coupées volontairement) | nouveau | à faire |
| LX-08 | Site de démonstration : contenus d'animation et remise en état | P1 | M | S2 | accord écrit à chaque exécution en ligne ; S1 publie le backend | nouveau | à faire |
| LX-09 | Mesure du pilote : indicateurs manquants et rapport hebdomadaire | P1 | M | S2 | aucune | nouveau | à faire |
| LX-10 | Alertes et astreinte du pilote | P1 | M | S2 + S1 | outil et destinataires : propriétaire | nouveau | à faire |
| LX-11 | Dossier de lancement d'un pays et population éligible | P1 | M | S2 + propriétaire | relais et modérateur désignés ; mesure faite par le propriétaire | nouveau | à faire |
| LX-12 | Preuves d'exploitation propres à DIASPORALE : restauration, charge, coûts réels | P1 | S | S2 | cible jetable et tarifs : propriétaire | nouveau | à faire |
| DG-029 | Pilote France | P1 | M | S2 + propriétaire | production, recrutement, zone (décision 7) | plan 15 | à faire |
| LX-13 | Écran des mesures du pilote dans la console | P2 | S | S1 | aucune | nouveau | à faire |
| LX-14 | Mesure d'usage consentie dans DIASPORALE | P2 | S | S2 | décision 10 ; texte de consentement validé | nouveau | à faire |
| LX-15 | Cadre du modèle professionnel : doctrine, étiquetage, charte des annonceurs | P2 | S | S2 + propriétaire | décision 12 ; juriste | nouveau | à faire |
| LX-16 | Offres professionnelles étiquetées, sans encaissement en ligne | P3 | L | S2 | décision du propriétaire, juriste, entité qui facture | nouveau | à faire |
| DG-030 | Paiements et outils professionnels payants | P3 | L | propriétaire puis S2 | contrat de paiement, entité, juriste, décision | plan global | à faire |
