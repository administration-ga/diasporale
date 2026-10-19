---
title: "DIASPORALE — Étude d’un réseau social complet pour la diaspora gabonaise"
date: "2026-10-18"
version: "1.0"
statut: "Étude et recommandations ; aucune mise en œuvre ou publication incluse"
perimetre: "Produit, concurrence, UX, design system, communauté, services, architecture et priorités"
---

# DIASPORALE — Découvrir, se retrouver, entreprendre

## La direction recommandée

**Faire de DIASPORALE le réseau où un Gabonais de l’étranger trouve les personnes, les associations et les services qui l’aident concrètement à vivre, travailler et entreprendre.**

La combinaison demandée est cohérente si chaque référence remplit une fonction précise :

- **TikTok pour découvrir** : défilement vertical fluide, un contenu principal à la fois, accès immédiat au suivant, découverte au-delà de ses abonnements.
- **Instagram pour présenter** : photos et vidéos lisibles, carrousels, portfolios, profils, Stories, identité visuelle cohérente et actions sociales proches du contenu.
- **WhatsApp pour échanger** : conversations faciles à retrouver, messages et vocaux fiables, groupes, appels audio/vidéo et continuité entre appareils.
- **La diaspora pour donner le sens** : proximité géographique choisie, associations, compétences, services, entraide, transmission et relation avec le Gabon.

La réussite se mesurera aux **mises en relation utiles, prestations abouties, rencontres et aides réalisées**. Le temps passé à faire défiler n’est qu’un signal secondaire.

Le socle ANTSIA apporte déjà beaucoup de capacités. L’effort prioritaire doit porter sur **les parcours d’organisations et de services, leur fiabilité et leurs droits**, puis sur leur mise en valeur visuelle. Le premier développement recommandé après la clôture PD4 est le raccord des pages réelles et de leur revendication.

### Les trois documents du dossier

| Document | Utilité |
|---|---|
| **Cette étude** | Comprendre les choix, les écarts, les parcours et les idées de communauté |
| [Plan global d’implémentation](14_PLAN_GLOBAL_IMPLEMENTATION_DIASPORALE.md) | Architecture, données, 12 lots, 30 tickets, dépendances, recettes, coûts et décisions |
| [Audit des 18 skills pertinents](15_AUDIT_SKILLS_DIASPORALE.md) | Compétences utilisables, problèmes constatés et règles d’emploi |

## Sommaire

1. [Méthode et état réel](#1-méthode-et-état-réel)
2. [Ce que les trois références apportent](#2-ce-que-les-trois-références-apportent)
3. [L’expérience DIASPORALE proposée](#3-lexpérience-diasporale-proposée)
4. [Entrepreneuriat et services](#4-entrepreneuriat-et-services)
5. [Associations et communauté](#5-associations-et-communauté)
6. [Le lien avec consulat.ga](#6-le-lien-avec-consulatga)
7. [Découverte et formules de classement](#7-découverte-et-formules-de-classement)
8. [Design system et accessibilité](#8-design-system-et-accessibilité)
9. [Communications et architecture](#9-communications-et-architecture)
10. [Idées complémentaires et priorités](#10-idées-complémentaires-et-priorités)
11. [Validation, indicateurs et modèle économique](#11-validation-indicateurs-et-modèle-économique)
12. [Sources et limites](#12-sources-et-limites)

## 1. Méthode et état réel

### 1.1 Périmètre effectivement étudié

Étude menée le **18 octobre 2026**, à partir des cahiers DIASPORALE/ANTSIA, du plan inter-réseaux, des sources locales, des contrats consulaires disponibles sur branches locales et de pages officielles des produits de référence. Trois audits bornés ont couvert le code, les skills et les références concurrentes ; leur synthèse a été recoupée sur les points structurants.

Instantanés Git relevés pendant l’audit : DIASPORALE `9317ec5`, ANTSIA `71091b8`, GABON_DIPLOMATIE `1eb590d9`. Les arbres contiennent aussi des modifications partagées non committées : ces identifiants ne représentent donc pas, à eux seuls, tout le contenu lu.

La méthode distingue :

| Niveau | Ce qu’il permet d’affirmer |
|---|---|
| **Source actuelle** | Une fonction, un raccord ou un manque existe dans les fichiers lus |
| **Recette locale antérieure** | Un parcours a été observé à une date et dans un contexte consignés |
| **Documentation officielle externe** | L’éditeur décrit une fonction ; sa disponibilité peut varier |
| **Recommandation** | Choix proposé pour DIASPORALE, encore à construire et à éprouver |

Aucun entretien utilisateur, audit authentifié des concurrents, test de production, appel natif ou benchmark de performance n’a été réalisé pour cette étude. Les chiffres d’audience anciens de consulat.ga ne sont pas utilisés comme population actuelle ou comme base de revenu. Le vault Obsidian attendu était indisponible à son chemin local ; les sources et décisions présentes dans les dépôts ont servi de référence.

### 1.2 Ce qui existe et ce qui manque

Préfixes du tableau : **D** = `apps/diasporale_com/src/` ; **F** = `packages/diasporale-features/src/` ; **A** = `../ANTSIA/convex/modules/`. Les chemins désignent les sources actuelles, pas une preuve de production.

| Capacité | État constaté | Travail restant déterminant |
|---|---|---|
| Fil, publications, profils, relations | Raccords réels ; pagination, audiences, réactions, commentaires, signets et relations documentés | Fin de recette média et contrôles de contenu ; meilleure découverte |
| Stories et albums | Surfaces reliées au moteur ; recettes locales documentées | Préserver les droits, compléter la qualité média et native |
| Galerie photos/vidéo | Visionneuse présente ; lecture vidéo locale documentée le 18/10 | Galerie des deux nouvelles photos encore non prouvée dans le dossier de recette |
| Annuaire et suggestions | `A/diaspora/directory.ts`, `suggestions.ts`, raccord `D/data/engine-source.ts` | Recherche unifiée sans élargir l’opt-in des personnes |
| Pages officielles, associations, entreprises | Moteur `A/pages/` existant ; `usePage` renvoie `feature_unavailable` dans `D/data/engine-source.ts` | Brancher lectures, gestion, publications et suivi |
| Erreur d’une page | `D/screens/profile-screens.tsx`, `PageDetail` montre le squelette pour tout état non prêt | Distinguer chargement, erreur technique et fonction indisponible ; garder un même état public pour ressource absente ou interdite |
| Hub pays | Fil et membres présents ; listes d’organisations/événements vides dans `D/data/engine-views.ts` | Alimenter listes et compteurs ; `A/diaspora/hubs.ts` force encore ces compteurs à zéro |
| Revendication d’organisation | `A/pages/claims.ts` gère demande, preuves et décision | Parcours DIASPORALE absent ; bouton actuellement désactivé |
| Association et adhérents | Groupes avec `associationPageId` dans `A/thematicGroups/` | Groupe lié après validation, adhésion volontaire, gestion des rôles et mandats |
| Groupes thématiques | Backend et composants génériques disponibles | Routes et montage DIASPORALE absents |
| Groupes de conversation | Surfaces iCom raccordées | Recette complète ; limite moteur actuelle **256**, contre **1 000** dans le cahier |
| Événements | Moteur d’événements personnels dans `A/events/` | Organisateurs pages, capacité, attente, présence et surfaces communautaires ; iCal différé dans la source |
| Catalogue de services et réservations | Pages professionnelles réutilisables ; pas de parcours métier de prestation | Offres, recherche, demandes, propositions, rendez-vous, avis et litiges |
| Emploi, talents, annonces, mentorat | Décrits dans PD8 | Pas de tables/parcours complets trouvés dans la tranche actuelle |
| Messagerie | `D/screens/icom-screens.tsx` et `D/components/icom.tsx` montent iCom | Recette entre appareils ; contact d’une organisation et permission de prestation |
| Appels | Hôte et jetons LiveKit raccordés ; limite moteur **11** participants | Dernière limite documentée : serveur média non configuré ; audio/sonnerie/arrière-plan à prouver |
| Chiffrement E2EE | Aucune activation ou gestion de clé trouvée dans les sources d’appels inspectées | Décision et implémentation dédiées ; ne pas annoncer une garantie non démontrée |
| Direct | Backend `A/live/` présent ; route annoncée comme non servie | Monter surface, habilitations, modération et recette de diffusion |
| Attestation consulaire | `A/diaspora/attestation.ts`, route `/verification` raccordée | Configuration et recette distante consentie à confirmer |
| Import communautaire | Table de journal `communityImports` ; export sur une branche voisine | Consommateur d’import absent ; activation contractuelle et retrait à construire |
| Modération, sanctions, recours | PA5 réellement présent, ADR-0009 accepté | Surfaces opérateur pays et recours DIASPORALE ; documents historiques à réconcilier |
| Export et effacement | Moteur PA5 et inventaire de données présents | `exportMyData` et `deleteMyAccount` restent indisponibles dans l’adaptateur DIASPORALE |

**Conséquence :** repartir d’une application vide ferait perdre les gardes et la réutilisation déjà acquises. En revanche, considérer qu’un composant ou une route constitue un module terminé masquerait plusieurs parcours encore absents.

Les preuves et limites détaillées demeurent dans [la parité](04_PARITE_SURFACES.md), [la recette de la visionneuse](10_VISIONNEUSE_COMMENTAIRES_IDENTITE_PD4.md) et [le correctif de publication média](12_CORRECTION_COURSE_COMPOSEUR_MEDIAS.md). Certains passages historiques de parité sur PA5 sont dépassés par les sources ; ils ne doivent pas guider une reconstruction de ces fonctions.

## 2. Ce que les trois références apportent

### 2.1 TikTok : la découverte et le geste de défilement

TikTok décrit une recommandation fondée sur les interactions, les informations du contenu et certains paramètres, avec une recherche de diversité. Cette explication historique ne publie pas les pondérations actuelles. En 2025, TikTok a détaillé des réglages de thèmes, filtres de mots et contrôles de recommandation ; « moins de » modifie la fréquence, sans nécessairement éliminer un thème. [Explication For You, 2020](https://newsroom.tiktok.com/how-tiktok-recommends-videos-for-you?lang=en), [contrôles, 2025](https://newsroom.tiktok.com/more-ways-to-discover-new-content-and-creators-you-love/?lang=en).

**Transposition recommandée :** une carte principale, défilement vertical avec arrêt naturel sur le contenu, lecture d’un seul média, action immédiate vers le profil ou le service. Le contenu peut être une courte vidéo, un carrousel de réalisations, une annonce associative ou un conseil d’installation.

L’intérêt pour DIASPORALE est de faire découvrir un professionnel ou une association que l’on ne suit pas encore. La valeur ne vient pas d’une imitation d’algorithme propriétaire : elle vient d’un inventaire pertinent et de contrôles clairs.

À spécifier dès le départ : « Pourquoi ce contenu ? », masquage, sourdine, filtres stricts distincts des préférences, remise à zéro, mode récent, arrêt du son et mode sobre. Un fil vide doit proposer une action utile, pas tourner en boucle sur les mêmes trois vidéos.

### 2.2 Instagram : une présentation qui donne envie de regarder et comprendre

Instagram documente plusieurs systèmes de classement selon Feed, Stories et Reels, ainsi qu’un fil d’abonnements chronologique. Les carrousels et publications collaboratives permettent de présenter plusieurs médias et plusieurs auteurs, avec acceptation de la collaboration. [Classement Meta, 2023](https://about.fb.com/news/2023/06/how-ai-ranks-content-on-facebook-and-instagram/), [carrousels et collaborations, 2023](https://about.fb.com/news/2023/08/music-and-collabs-on-instagram/).

**Transposition recommandée :** portfolio d’un coiffeur, galerie d’une association, couverture d’événement, publications épinglées et profil organisé. Chaque image conserve son texte alternatif ; ordre et couverture sont maîtrisés par l’auteur. Un carrousel montre son nombre d’éléments et se parcourt sans perdre la publication.

La page professionnelle doit répondre immédiatement à quatre questions : **que propose cette personne, où intervient-elle, quelles preuves peut-on consulter, comment la solliciter ?** Le nombre d’abonnés ne remplace pas ces informations.

Pour les Stories, distinguer contenu éphémère et contenu durable. La disparition d’une Story après son échéance ne signifie pas que toute capture ou toute copie externe a disparu. Pour la co-publication, demander l’accord du second auteur et recalculer l’audience sans ouverture implicite vers ANTSIA. L’annonce de lancement de Reels décrit déjà un flux vertical et des audiences distinctes ; ses anciennes limites de durée ne deviennent pas les limites de DIASPORALE. [Reels](https://about.fb.com/news/2020/08/introducing-instagram-reels/).

### 2.3 WhatsApp : la confiance dans l’échange

WhatsApp présente messages multimédias, vocaux, filtres, épingles et groupes ; ses communautés regroupent des discussions et des événements. L’idée utile pour DIASPORALE est de rendre une conversation immédiatement retrouvable, avec son contexte et ses actions. [Messagerie](https://www.whatsapp.com/messaging), [groupes](https://www.whatsapp.com/groups), [événements de communautés](https://about.fb.com/news/2024/05/events-in-whatsapp-communities/).

La page officielle d’appels consultée le 18 octobre 2026 annonce aussi les appels **depuis le navigateur**. Il serait donc inexact de reprendre l’ancienne affirmation selon laquelle WhatsApp Web ne permet pas les appels. Cette annonce ne prouve toutefois aucune parité de réveil ou d’arrière-plan pour DIASPORALE. [Appels WhatsApp](https://www.whatsapp.com/calling).

**Transposition recommandée :** conversation 1:1, groupe associatif et échange de prestation, avec appels depuis la conversation. La recherche porte sur ses propres échanges autorisés ; la présence et les accusés de lecture ont des préférences compréhensibles. Le numéro personnel n’est pas une donnée de découverte publique.

Le chiffrement de bout en bout revendiqué par WhatsApp pour les échanges personnels nécessite une architecture de clés et d’appareils ; les sauvegardes constituent un périmètre supplémentaire. Reproduire l’interface ou utiliser HTTPS ne transfère pas ces garanties. [Confidentialité WhatsApp](https://www.whatsapp.com/privacy).

### 2.4 Matrice de décision

Les appréciations ci-dessous portent sur **l’intérêt du mécanisme pour DIASPORALE**, pas sur une note de qualité mesurée des applications.

| Besoin | Référence principale | Décision DIASPORALE | Limite à maîtriser |
|---|---|---|---|
| Découvrir une personne ou une activité | TikTok | Fil vertical et diversité contrôlée | Ne pas optimiser uniquement la durée de visionnage |
| Montrer un savoir-faire | Instagram | Portfolio, carrousel, courte vidéo | Consentement des personnes filmées, droits sur les médias |
| Suivre ses relations | Instagram | Abonnements et ordre chronologique accessibles | Séparer abonnements, connexions et adhésions |
| Échanger rapidement | WhatsApp | iCom, vocaux, réponses, reprise | Livraison et synchronisation réellement éprouvées |
| Appeler | WhatsApp | Audio/vidéo contextuels | Permissions, réseau, sonnerie, appareils, clés |
| Organiser une association | WhatsApp Communities + modèle métier propre | Page + adhérents + annonces + groupes + événements | Gouvernance et mandats absents d’un simple groupe de chat |
| Trouver un prestataire | Recherche locale + catalogue | Recherche structurée et fiches utiles | Ne pas exiger de parcourir le fil au hasard |
| Réserver une prestation | Parcours de service spécialisé | Demande, proposition, confirmation, résultat | Un message envoyé n’est pas une réservation |
| Construire la confiance | Modèle propre | Preuves distinctes et recours | Identité vérifiée ≠ compétence certifiée |
| Rassembler la diaspora | Modèle propre | Hubs, associations, entraide, transmission | Participation volontaire et pluralité des communautés |

### 2.5 Compléments utiles pour les services

Google explique son classement local par la pertinence, la distance et la notoriété. Taskrabbit décrit un parcours besoin/localisation → comparaison → échange et réservation. Booksy présente réservation et gestion de services avec variantes de durée et de prix. Ces références justifient une **recherche structurée distincte du fil social**, sans reprendre leurs règles commerciales ni leurs garanties. [Google Business Profile](https://support.google.com/business/answer/7091?hl=en), [Taskrabbit](https://www.taskrabbit.com/how-it-works), [Booksy](https://biz.booksy.com/features).

WhatsApp Business relie profil professionnel, catalogue, réponses rapides et conversation. DIASPORALE peut reprendre cette continuité, en ajoutant recherche géographique, mandats de page et état de la demande. [Fonctions Business](https://whatsappbusiness.com/products/business-app-features/).

## 3. L’expérience DIASPORALE proposée

### 3.1 Une navigation à cinq destinations

| Destination proposée | Question de l’utilisateur | Contenu |
|---|---|---|
| **Fil** | Que se passe-t-il autour de moi et dans la diaspora ? | Découverte verticale, abonnements, récents, Stories |
| **Explorer** | Je cherche qui ou quoi ? | Recherche de contenus, personnes opt-in, pages et événements |
| **Services** | Qui peut répondre à mon besoin ? | Catégories, offres, favoris, demandes ; espace professionnel |
| **Communautés** | Où puis-je participer ? | Mon pays/ma ville, associations, groupes, événements, entraide |
| **Messages** | Avec qui suis-je en train d’échanger ? | Conversations, demandes, groupes et journal d’appels |

Avatar : profil et réglages. Action stable : publier. Le pays reste visible et modifiable pour l’exploration ; changer le pays exploré ne réécrit pas le pays de résidence. Cette arborescence est une proposition à éprouver, pas une modification déjà appliquée à la barre existante.

Sur ordinateur : navigation latérale, contenu central, panneau de conversation conservant son état. Sur téléphone : cinq destinations lisibles, pages de conversation pleines, bouton de retour fiable. Les alertes et menus ne doivent pas recouvrir le sujet d’une vidéo ou les commandes d’un appel.

### 3.2 Combiner le scroll TikTok et les cartes Instagram

Le fil propose un mode **Immersif** et un mode **Liste**. Sur mobile, l’Immersif est la direction principale demandée : un contenu visuel se stabilise dans la hauteur utile, les actions restent proches, le contenu suivant se révèle par défilement. Sur ordinateur, le média reste dans une colonne de lecture, avec commandes précédent/suivant et accès au détail.

Règles proposées :

1. Vertical = publication suivante ; horizontal = média suivant dans une même publication. Une légende ou un commentaire long défile dans son panneau explicite, sans changer accidentellement de publication.
2. Photo verticale, paysage et texte restent lisibles : ne pas recadrer destructivement toutes les images au format 9:16. La visionneuse permet la lecture complète.
3. Aucun avancement automatique des publications ordinaires. Les Stories ont un comportement distinct avec pause, progression et sortie.
4. Le son démarre désactivé ; l’utilisateur choisit de l’activer. Une pause manuelle n’est pas annulée par une petite variation de visibilité.
5. Une nouvelle publication reçue en temps réel n’entraîne pas un saut sous le doigt. Un bouton annonce les nouveaux éléments.
6. Retour depuis profil/service/commentaires : retrouver la publication et le média exacts, sans recommencer le fil.
7. Réseau faible : affiche et texte d’abord, téléchargement borné, reprise et choix de qualité ; mode Liste conservé comme alternative complète.

### 3.3 Les objets doivent rester reliés

Une vidéo de coiffure peut référencer une **offre** et sa **page professionnelle**. Une publication associative peut référencer un **événement**. Une conversation peut référencer une **demande de prestation**. Ces liens sont des références métier contrôlées ; les prix, disponibilités et droits se relisent depuis la source, sans copies figées présentées comme actuelles.

La publication attire l’attention ; la fiche permet de décider ; la demande organise l’action ; la conversation permet de la mener à bien. C’est cette continuité qui distingue DIASPORALE d’un assemblage de trois interfaces.

## 4. Entrepreneuriat et services

### 4.1 Le parcours « je viens d’arriver à Paris et je cherche un coiffeur »

| Étape | Expérience souhaitée | Information ou garde nécessaire |
|---|---|---|
| 1. Entrer | Connexion IDN ou code unique, résidence choisie | Consentement ; pas de profil importé automatiquement |
| 2. Rechercher | « Coiffure », Paris, éventuellement quartier, budget et date | Ville manuelle possible ; aucune obligation GPS |
| 3. Comparer | Photos, types de coiffure, durée, prix indicatif, zone, prochaines possibilités | Données à jour ; distinction « sur devis » et prix ferme |
| 4. Comprendre la confiance | Qui gère la page, quelle vérification, quels avis | Identité, mandat professionnel et qualité séparés |
| 5. Solliciter | Décrire le besoin et proposer un créneau | Demande limitée au professionnel choisi ; pas de publication publique du besoin |
| 6. Échanger | Fil attaché à la demande, photos de référence facultatives | Pièces privées, limites de contact, aucun carnet d’adresses importé |
| 7. Confirmer | Proposition détaillée acceptée ; horaire et conditions clairs | Version de prix, fuseau, disponibilité vérifiée |
| 8. Réaliser | Rappel, message ou appel accepté, statut | Pas d’adresse privée dans une notification externe |
| 9. Évaluer | Confirmer le résultat, déposer un avis admissible | Une preuve précise ; possibilité de contestation et réponse |
| 10. Revenir | Favori, reprendre rendez-vous, recommander avec accord | Aucun message promotionnel imposé |

Un membre en attente peut lire ce que son statut autorise. Une action encore interdite explique le chemin de parrainage ou de vérification ; l’interface ne contourne pas cette éligibilité pour accélérer une conversion.

### 4.2 La fiche professionnelle

La page regroupe identité commerciale, catégorie, présentation, zone desservie, langues déclarées, horaires, portfolio, offres, conditions et équipe habilitée. Les coordonnées privées restent protégées. Les informations professionnelles légalement nécessaires selon le pays font l’objet d’une projection séparée et d’un arbitrage explicite ; le principe de confidentialité ne doit pas produire une promesse juridique impossible.

Chaque offre possède un contenu précis : prestation, inclus/exclus, durée indicative, prix et devise ou mode « sur devis », lieu de réalisation, disponibilités, prérequis, conditions d’annulation. Une offre retirée ne peut pas continuer à recevoir des demandes par un lien ancien.

**Quatre preuves différentes :**

- identité de la personne vérifiée ;
- mandat de gestion de l’organisation vérifié ;
- qualification ou autorisation professionnelle, quand elle est nécessaire et effectivement contrôlée ;
- avis attachés à une interaction admissible, avec preuve décrite.

Le badge consulaire ne valide aucune de ces compétences professionnelles à lui seul. Une entreprise récemment inscrite peut être visible avec un état honnête, sans note fictive ni pénalité opaque liée à l’absence d’historique.

### 4.3 Deux modes de prestation

**Sur demande**, au lancement : besoin → proposition → acceptation → rendez-vous. Ce mode couvre les services variés et évite de promettre une disponibilité instantanée qui n’est pas tenue.

**À créneau immédiat**, ensuite : catalogue de durées, personnel/ressource, calendrier, réservation atomique, exceptions et annulations. Ajouter ce mode quand l’outil de planning est réellement exploité par les professionnels.

La messagerie professionnelle utilise une permission attachée à la demande. Elle ne crée pas une amitié obligatoire et ne donne pas à l’entreprise le droit de contacter tout le réseau. Les réponses d’une équipe portent leur contexte de page et restent auditables.

### 4.4 Ce qu’il faut traiter avant d’appeler cela une marketplace complète

| Sujet | MVP | Extension ultérieure |
|---|---|---|
| Offre | Catalogue et retrait | Variantes, forfaits, plusieurs collaborateurs |
| Contact | Demande et conversation autorisée | Réponses préparées et tri des demandes |
| Rendez-vous | Proposition puis confirmation | Créneaux instantanés et synchronisation de calendrier |
| Paiement | Pas d’encaissement plateforme ; conditions de prestation claires | Prestataire de paiement, remboursements et rapprochement |
| Réputation | Avis avec preuve et modération | Détection de collusion et analyses agrégées |
| Litige | Signalement, réponse et traitement humain | Médiation et règles financières si paiement activé |
| Professionnel | Page et contrôle de mandat | Outils B2B optionnels, jamais vente de confiance |

## 5. Associations et communauté

### 5.1 Une association est une organisation durable

Une association nécessite une page, une équipe, un mandat, des règles d’adhésion et des activités. Son groupe de discussion n’en est qu’un canal.

Le parcours complet proposé est : **découvrir → suivre → demander à adhérer → être accueilli → participer → contribuer → prendre éventuellement une responsabilité → quitter ou transmettre son rôle**.

Les espaces sont distincts :

- actualités visibles aux membres du réseau selon l’audience choisie ;
- annonces aux adhérents ;
- conversations par activité ;
- documents et décisions internes accessibles aux rôles autorisés ;
- événements et missions bénévoles ;
- espace de gestion des demandes et de l’équipe.

Une personne peut suivre une association sans en devenir membre. Une association peut avoir plusieurs antennes dans des villes différentes sans recréer les mêmes personnes. Le mandat expire ou se transmet ; un ancien responsable perd ses pouvoirs même si son navigateur est resté ouvert.

### 5.2 Trois niveaux de communauté

| Niveau | Fonction | Exemple de contenu |
|---|---|---|
| Pays / ville | Contexte territorial et orientation | Kit d’arrivée, agenda, associations locales |
| Association / collectif | Gouvernance et projet commun | Annonce, adhésion, mission, événement |
| Groupe d’activité | Échange ciblé | Préparation d’une rencontre, mentorat, atelier |

Éviter un groupe géant unique. Les annonces, discussions et urgences n’ont pas la même priorité de notification. Les groupes silencieux, archivés, complets ou modérés doivent être compréhensibles ; leurs limites sont celles du moteur réellement testé.

### 5.3 Animation nécessaire au lancement

Le logiciel seul ne fournit pas les réponses. Prévoir responsables de pays/ville, associations relais, calendrier d’activités, accompagnement des professionnels et modérateurs formés. Les premiers contenus doivent être consentis et utiles : présenter une compétence, annoncer une activité, répondre à un besoin réel, documenter une ressource vérifiée.

Ne pas annoncer un nombre de membres « disponibles » à partir d’inscriptions consulaires. Mesurer les volontaires actifs et la capacité de réponse de chaque zone.

## 6. Le lien avec consulat.ga

### 6.1 Trois liens, sans mélange des bases

1. **Orientation** : consulat.ga peut proposer de rejoindre DIASPORALE ; l’utilisateur choisit, s’authentifie et consent.
2. **Attestation minimale** : confirmation consentie d’une situation autorisée par le contrat, avec pays, poste et date ; pas de dossier, passeport, NIP, état civil ou données d’enfant dans le moteur social.
3. **Communauté publique** : import contractuel d’objets déjà publics — organisations, événements, communiqués — avec provenance et droit de retrait.

DIASPORALE tire des **spécifications, objets publics autorisés et preuves minimales** de l’écosystème consulaire. Il ne transforme pas le fichier consulaire en annuaire social.

### 6.2 État des contrats constaté

Les documents `DIASPORA-ATTESTATION-V1` et `DIASPORA-COMMUNAUTE-V1` ont été lus sur les branches locales correspondantes de GABON_DIPLOMATIE, aux commits `7d01f215` et `540d3c45`. Ils portent le statut proposé/PR brouillon et une activation soumise aux décisions prévues. Ils ne sont pas dans la branche locale actuellement ouverte ; l’état des PR distantes n’a pas été interrogé pendant l’étude.

L’export construit une liste explicite de champs et exclut membres, dirigeants, coordonnées et identifiants légaux. Les descriptions et le HTML publics restent néanmoins des champs libres : l’import doit contrôler le rendu et les données qu’ils peuvent contenir. Une allowlist de colonnes ne garantit pas à elle seule l’absence d’information personnelle dans un texte.

### 6.3 Opportunités pertinentes

Pages officielles des postes, agenda communautaire autorisé, associations revendicables, informations d’installation datées et liens vers la démarche consulaire pertinente. Une action consulaire ouvre consulat.ga ; son dossier n’est jamais traité dans le chat social. Les statistiques partagées sont agrégées et protégées contre la réidentification de petits groupes.

## 7. Découverte et formules de classement

### 7.1 Trois moteurs distincts

**Fil social** : contenus utiles et personnes suivies. **Recherche de services** : correspondance avec un besoin explicite. **Suggestions de relations** : personnes ayant choisi d’être découvrables. Réutiliser les gardes, mais ne pas confondre les objectifs ni les données de ces trois fonctions.

La première version peut fonctionner avec règles, index et centres d’intérêt choisis. Aucun modèle d’IA n’est indispensable pour trouver un coiffeur à Paris.

### 7.2 Fil : une formule de départ explicable

Formule **proposée pour expérimentation**, sans lien avec les poids secrets de TikTok ou Instagram. Toutes les variables sont normalisées entre 0 et 1 :

```text
si contenu non autorisé : exclure avant tout classement
score_fil = 0,30 × intérêt_explicitement_choisi
          + 0,25 × lien_avec_abonnements
          + 0,20 × pertinence_du_contexte_choisi
          + 0,15 × fraîcheur
          + 0,10 × qualité_du_contenu
          - pénalité_de_répétition
```

L’autorisation comprend réseau, adhésion, audience, blocages, retrait, modération et admissibilité du média. Elle est relue au moment de servir le résultat. « Qualité » commence par des critères explicables comme une offre active ou un contenu correctement renseigné ; le nombre de signalements seul ne doit pas devenir un mécanisme de censure automatique exploitable par brigadage.

Après classement, diversifier auteurs et catégories. Un budget d’exploration proposé de 10 à 20 % peut présenter des nouveaux contenus admissibles, à calibrer sur le pilote ; ce n’est pas une performance mesurée. Les annonces institutionnelles épinglées sont identifiées comme telles, sans prétendre être une préférence personnelle.

Sans centres d’intérêt ni historique : pays choisi, abonnements volontaires, contenus récents admissibles et diversité. Sans inventaire suffisant : proposer recherche, association ou demande d’entraide ; ne pas inventer de contenu ni réutiliser des données consulaires privées.

### 7.3 Services : un classement orienté besoin

```text
score_service = 0,40 × correspondance_service_recherché
              + 0,25 × adéquation_zone_desservie
              + 0,20 × adéquation_disponibilité
              + 0,15 × fiabilité_observée
```

Pondérations **hypothétiques**, à comparer à un simple tri pertinence/distance. Une disponibilité inconnue est annoncée comme inconnue, pas comme indisponible. La fiabilité doit être calculée sur des événements admissibles avec un minimum de données ; elle ne pénalise pas un nouvel entrepreneur comme s’il avait échoué.

Proposer tris explicites : pertinence, proximité de la zone choisie, disponibilité, prix. Les langues utiles sont choisies par l’utilisateur. Ne pas déduire origine, opinions, religion ou vulnérabilité pour classer les personnes ; les critères d’emploi restent professionnels et pertinents.

Pour une note affichée, un lissage peut éviter qu’un unique avis domine :

```text
note_lissée = (n × moyenne_des_avis_admissibles + m × moyenne_de_référence) / (n + m)
```

`n` est le nombre réel d’avis, `m` un poids de prudence à calibrer. Afficher toujours le nombre d’avis et expliquer l’usage du score ; ne pas présenter la moyenne de référence comme des avis reçus par le professionnel.

### 7.4 Contrôle et vie privée

Les interactions nécessaires au fonctionnement ne deviennent pas automatiquement des données d’analytics. L’ADR-0010 du moteur limite déjà la mesure facultative ; tout nouveau suivi comportemental nécessite sa finalité, sa base applicable, sa rétention, ses contrôles et une décision d’évolution du contrat. Pas de contenu de messages, d’adresse privée ni d’historique de position dans le classement.

L’appartenance associative ne doit pas devenir un signal implicite de profilage : respecter sa visibilité et son usage consenti, et exclure les inférences sensibles. Le professionnel ne reçoit pas la liste des personnes qui ont simplement regardé son offre.

La ville saisie suffit au premier service. La CNIL rappelle que le consentement ne dispense pas de minimiser la précision et la conservation de la géolocalisation. [CNIL](https://www.cnil.fr/fr/geolocalisation-applications-mobiles-quelles-regles).

## 8. Design system et accessibilité

### 8.1 Conserver l’identité DIASPORALE

La [charte Sable](03_CHARTE_DIASPORALE.md) reste la base : fond papier et cartes sable en clair, fond nuit et surfaces relevées en sombre, bleu d’action, typographie IBM Plex, jetons sémantiques. Le contrat est dans `../ANTSIA/packages/ui/src/themes/diasporale.css`, avec rôles propres dans `F/styles/extras.css`.

L’inspiration Instagram concerne la hiérarchie et le traitement des médias. Elle ne nécessite ni changement de marque, ni nouvelles couleurs codées dans les composants, ni copie des logos ou de leurs ressources.

### 8.2 Catalogue de composants à consolider

| Famille | Composants/patrons | États essentiels |
|---|---|---|
| Navigation | Barre mobile, rail, recherche, sélecteur pays, retour | Actif, accès limité, badge, grand texte |
| Médias | Carte, galerie, lecteur, Story, dépôt, sous-titres | Chargement, contrôle, traitement, erreur, refus, retrait |
| Identité | Avatar, nom choisi, badge, rôle de page | Déclaré, vérifié, officiel, mandat expiré |
| Services | Carte, offre, zone, prix, disponibilité, demande | Publié, sur devis, complet, retiré, inconnu |
| Associations | En-tête, équipe, adhésion, annonce, activité | Suivi, demandé, admis, refusé, parti |
| Conversations | Fil, pièce jointe, vocal, demande, recherche | Envoi, reprise, distribué, lu si activé, échec |
| Appels | Invitation, commandes, participants, statut | Sonnerie, connexion, refus, reconnecté, terminé |
| Gouvernance | Signalement, recours, retrait, consentement | En cours, décision, délai, confirmation et erreur |

Pour chaque composant : variantes, tailles, textes FR/EN, droit attendu, focus initial, retour du focus, clavier, lecteur d’écran et comportement hors ligne. Les nouveaux états doivent éviter le squelette sans fin déjà repéré sur les pages indisponibles.

### 8.3 Règles d’accessibilité proposées

Cible de conception : WCAG 2.2 AA, en continuité de la cible 2.1 AA du cahier. Conserver **44 × 44 px comme objectif ergonomique** des commandes tactiles ; le minimum du critère 2.5.8 AA est 24 × 24 avec exceptions, tandis que 2.5.5/44 px est AAA. Prévoir contrastes, focus visible, alternatives au geste et reflow. [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

Chaque média peut être mis en pause, le son coupé et les animations réduites. Les contenus qui bougent ou se mettent à jour automatiquement doivent laisser le contrôle à l’utilisateur. [W3C, pause/arrêt/masquage](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide).

Textes alternatifs et sous-titres doivent être éditables et contrôlés. TikTok présente lui-même ces outils, mais leur présence dans une application de référence n’est pas une preuve de conformité de DIASPORALE. [Accessibilité TikTok](https://newsroom.tiktok.com/creating-an-accessible-and-inclusive-tiktok?lang=en-150).

La recette comprend navigation clavier, VoiceOver/TalkBack, zoom, grand texte, thèmes clair/sombre et connexion dégradée. Ne pas utiliser une note automatique de design comme substitut à ces parcours.

## 9. Communications et architecture

### 9.1 Ce que « comme WhatsApp » exige réellement

Au-delà des bulles et de l’icône téléphone : persistance des messages, identifiants idempotents, ordre cohérent, livraison distincte de lecture, pièces jointes contrôlées, reprise réseau, appareils multiples, permissions, sonnerie, signalisation, relais média, qualité audio et révocation des droits.

Les appels web et natifs sont deux niveaux de recette. La norme WebRTC fournit les mécanismes de connexion, mais l’application garde sa signalisation et ses règles d’accès. [W3C WebRTC](https://www.w3.org/TR/webrtc/). Les notifications web ne suffisent pas à prouver le comportement téléphonique d’une application native.

Le choix raisonnable est de **terminer et éprouver iCom/LiveKit**, déjà raccordés, avant de sélectionner une nouvelle pile. Les API de bots, y compris une skill « chat-sdk », ne remplacent pas cette messagerie personnelle.

### 9.2 La décision de chiffrement

| Périmètre | Question à résoudre |
|---|---|
| Transport | Qui voit les données entre appareils et serveur ? |
| Messages stockés | Le serveur peut-il lire le corps ? Comment l’historique est-il recherché ? |
| Appels | Qui détient les clés média ? Tous les clients appliquent-ils la même politique ? |
| Appareils multiples | Ajout, vérification, révocation et restauration d’un appareil |
| Pièces jointes | Clés, miniatures, antivirus, suppression et partage |
| Sauvegardes | Qui peut les restaurer et avec quelles clés ? |
| Signalement | Quel contenu la personne choisit-elle de transmettre au modérateur ? |

Une architecture E2EE change la recherche serveur, la modération et la récupération. Elle demande une revue spécialisée et des protocoles éprouvés ; pas de cryptographie inventée pour le projet. Le plan rend cette décision visible plutôt que de promettre une sécurité équivalente à WhatsApp sur le seul aspect graphique.

### 9.3 Médias et portée réseau

Le dépôt doit admettre le fichier, contrôler sa nature et sa taille, préparer les variantes, puis rendre une version autorisée. Image originale, miniature, affiche vidéo, sous-titre et segment de streaming sont tous des dérivés à protéger. Le retrait doit atteindre ces dérivés, les citations et les caches selon une fenêtre documentée.

La diffusion publique vers ANTSIA reste un choix de l’auteur, sous les conditions du moteur. Copier un lien de publication DIASPORALE n’en ouvre pas les droits. Les aperçus externes doivent rester neutres lorsque l’audience est fermée.

Le [plan global](14_PLAN_GLOBAL_IMPLEMENTATION_DIASPORALE.md) détaille les entités, les contrats, les jobs, les états, les tests et la propriété des modules.

## 10. Idées complémentaires et priorités

Ces idées sont des propositions de produit, pas des résultats d’enquête déjà validés.

| Idée | Utilité | Première version raisonnable | Priorité |
|---|---|---|---|
| **Parcours d’arrivée par ville** | Réduire l’isolement et les recherches dispersées | Checklist personnelle, ressources sourcées, association d’accueil | P1 |
| **Mentorat diaspora** | Mettre une expérience au service d’un nouvel arrivant | Compétences et créneaux volontaires, demande contextualisée | P1 |
| **Bourse de missions associatives** | Trouver photographes, traducteurs, bénévoles | Mission, durée, compétences, participation confirmée | P1 |
| **Agenda commun local** | Éviter événements invisibles ou concurrents | Calendrier par ville, filtres, inscription et rappel choisi | P1 |
| **Questions résolues** | Conserver les réponses utiles au-delà du chat | Réponse retenue, source, date de révision | P1 |
| **Portfolios de talents** | Rendre visibles compétences et réalisations | Profil professionnel opt-in et contact protégé | P1/P2 |
| **Passerelles avec le Gabon** | Organiser transmission et projets à distance | Mentorat, ateliers et missions publiés par pages habilitées | P2 |
| **Réseaux de métiers** | Relier entrepreneurs et partenaires | Groupes thématiques, événements, demandes B2B | P2 |
| **Cercle des nouveaux entrepreneurs** | Accompagner les premières offres | Sessions collectives et ressources datées, sans conseil juridique improvisé | P2 |
| **Co-publication associative** | Partager une action menée à plusieurs | Invitation d’auteur, accord et audience compatible | P2 |
| **Mémoire culturelle** | Transmettre récits, langues et savoir-faire | Collections éditoriales et ateliers consentis | P2 |
| **Carte de compétences agrégée** | Voir où existent des savoir-faire | Statistiques avec seuil de confidentialité, jamais carte des domiciles | P2 |
| **Concierge iAsted** | Orienter vers les fonctions du réseau | Recherche avec mêmes gardes, brouillon et action confirmée | P2, après qualité des données |
| **Financement de projets** | Soutenir des initiatives | Étude distincte avant cagnotte ou investissement | Ultérieur |

Une communauté forte associe entraide, économie, culture et gouvernance. Le réseau ne doit pas réserver sa valeur à ceux qui publient souvent ou disposent d’un équipement vidéo coûteux.

## 11. Validation, indicateurs et modèle économique

### 11.1 Recherche utilisateur à conduire

Proposition de première vague : 12 à 18 entretiens répartis entre nouveaux arrivants, résidents établis, responsables d’association et entrepreneurs, avec diversité d’âge, de connectivité et d’aisance numérique. Cet échantillon est qualitatif, sans prétention de représentativité statistique.

Tester ensuite cinq tâches : trouver un service, comprendre une preuve de confiance, envoyer une demande, rejoindre une activité associative et retrouver/appeler son interlocuteur. Noter réussite sans aide, temps, erreurs et compréhension. Inclure des participants utilisant les aides d’accessibilité. Ne pas demander d’accès à leurs conversations ou dossiers consulaires.

Questions prioritaires : cherchent-ils une personne ou une prestation ? Acceptent-ils de contacter un professionnel hors de leurs relations ? Quel prix et quelle preuve attendent-ils ? Quand un groupe devient-il trop bruyant ? Quelles informations refusent-ils d’afficher ? Ces réponses peuvent modifier la navigation et l’ordre des lots, sans annuler les invariants.

### 11.2 Indicateurs qui reflètent la valeur

| Indicateur | Formule / définition | Risque de mauvaise interprétation |
|---|---|---|
| Demandes utiles répondues | Demandes admissibles ayant une réponse métier / demandes admissibles | Une réponse automatique ne vaut pas réponse utile |
| Conversion en rendez-vous | Demandes confirmées / demandes reçues | Segmenter par catégorie et zone |
| Prestations abouties | Nombre de réalisations confirmées selon la preuve définie | Ne pas assimiler demande ou paiement à réalisation |
| Recherche sans résultat | Recherches sans offre admissible / recherches de services | Observer aussi les filtres trop restrictifs |
| Délai de réponse | Médiane et p90 entre demande et première réponse humaine | Inclure les non-réponses dans le suivi |
| Participation associative | Participants uniques ayant contribué à une activité / adhérents actifs | Une vue de publication n’est pas une participation |
| Rétention utile | Membres revenant pour une action utile à J7/J30 | Définir une cohorte et son consentement de mesure |
| Qualité des communications | Appels établis avec média / appels acceptés | Sonnerie seule et jeton émis exclus |
| Confiance | Incidents, recours, annulations, avis contestés, délai de traitement | Plus de signalements peut aussi révéler un meilleur outil |
| Coût d’utilité | Coût attribuable / services ou aides aboutis | Inclure support et modération |

Les nouveaux événements de mesure ne doivent pas contourner l’ADR-0010. Commencer par agrégats métier minimaux et cohortes de pilote volontaires ; définir les indicateurs avant d’installer un outil de suivi supplémentaire.

### 11.3 Formules économiques proposées

**Accès communautaire gratuit** : profil, relations, fil, associations, messagerie et découverte des services. Une prestation professionnelle peut avoir son propre prix, distinct de l’accès au réseau ; le plan n’introduit pas de frais citoyens pour utiliser DIASPORALE.

**Base professionnelle gratuite** : page, offre, demandes et fonctions essentielles. **Option B2B future** : gestion de plusieurs collaborateurs, outils de planning avancés, présentation enrichie et statistiques agrégées, si le propriétaire valide D4. Les badges de confiance et le traitement des recours restent indépendants du paiement.

**Sponsoring éventuel** : emplacement identifié et contexte large, sans profilage sensible ni achat caché du classement organique. **Paiements intégrés** : lot séparé, après définition des pays, prestataires, remboursements, responsabilité et support.

```text
revenu_B2B = professionnels_payants × abonnement_moyen
           + campagnes_sponsorisées_autorisées
marge_opérationnelle = revenu_B2B - infrastructure - support - modération - autres_coûts
```

Aucun prix, taux de conversion ou revenu n’est affirmé sans pilote. Le plan d’implémentation propose également des formules de bande passante, stockage et minutes d’appel pour éviter que le fil vidéo rende le service économiquement impraticable.

## 12. Sources et limites

### 12.1 Sources locales de référence

- [Cahier DIASPORALE](00_CAHIER_DES_CHARGES_DIASPORALE.md), [prompts PD0–PD10](01_PLAN_IMPLEMENTATION_PROMPTS_DIASPORALE.md), [charte](03_CHARTE_DIASPORALE.md), [parité](04_PARITE_SURFACES.md).
- [Cahier ANTSIA](../../ANTSIA/docs/00_CAHIER_DES_CHARGES_ANTSIA.md), [ADR-0009 — gardes et droits](../../ANTSIA/docs/adr/0009-gardes-et-droits-personnels-pa5.md), [ADR-0010 — préférences et mesure](../../ANTSIA/docs/adr/0010-preferences-de-presentation-et-mesure-facultative.md).
- Dossier produit d’origine : `GABON_DIPLOMATIE/docs/OPPORTUNITES_COMMUNAUTE_DIASPORA.md`, `DESIGN_SPECS_COMMUNAUTE.md` et contrats de branches identifiés au §6.
- Inventaire des sources réelles au §1 ; audit des skills dans le document séparé. Aucun contenu de base consulaire n’a été consulté.

### 12.2 Références web

Toutes consultées le **18/10/2026**. Une date de publication ancienne indique la provenance d’un mécanisme, pas sa version actuelle. « Sans date » signifie qu’aucune date de publication n’était affichée sur la page consultée.

| Source officielle | Date affichée | Usage dans le dossier |
|---|---|---|
| [TikTok — For You](https://newsroom.tiktok.com/how-tiktok-recommends-videos-for-you?lang=en) | 18/06/2020 | Principes publics de recommandation, sans poids actuels |
| [TikTok — contrôles de découverte](https://newsroom.tiktok.com/more-ways-to-discover-new-content-and-creators-you-love/?lang=en) | 03/06/2025 | Thèmes, filtres et choix utilisateur |
| [TikTok — accessibilité](https://newsroom.tiktok.com/creating-an-accessible-and-inclusive-tiktok?lang=en-150) | 23/05/2025 | Alternatives photo et outils de lecture |
| [Meta — classement Instagram](https://about.fb.com/news/2023/06/how-ai-ranks-content-on-facebook-and-instagram/) | 29/06/2023 | Systèmes distincts et contrôle du fil |
| [Meta — Reels](https://about.fb.com/news/2020/08/introducing-instagram-reels/) | 05/08/2020, mise à jour affichée 01/05/2023 | Format et audience ; anciennes limites non reprises |
| [Meta — carrousels et collaborations](https://about.fb.com/news/2023/08/music-and-collabs-on-instagram/) | 11/08/2023 | Présentation multimédia et accord des auteurs |
| [WhatsApp — messages](https://www.whatsapp.com/messaging) | Sans date | Ergonomie des conversations |
| [WhatsApp — appels](https://www.whatsapp.com/calling) | Sans date | Appels web/mobile/bureau annoncés |
| [WhatsApp — groupes](https://www.whatsapp.com/groups) | Sans date | Groupes et contrôles |
| [Meta — événements des communautés](https://about.fb.com/news/2024/05/events-in-whatsapp-communities/) | 01/05/2024 | Organisation et annonces |
| [WhatsApp — confidentialité](https://www.whatsapp.com/privacy) | Sans date | Portée des garanties annoncées |
| [WhatsApp Business — fonctions](https://whatsappbusiness.com/products/business-app-features/) | Sans date | Catalogue relié à la conversation |
| [Google — classement local](https://support.google.com/business/answer/7091?hl=en) | Sans date | Pertinence, zone, réputation |
| [Taskrabbit — parcours](https://www.taskrabbit.com/how-it-works) | Sans date | Besoin, comparaison, échange, réservation |
| [Booksy — fonctions](https://biz.booksy.com/features) | Sans date | Catalogue, durées et planning |
| [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Version normative consultée | Accessibilité |
| [W3C — pause/arrêt/masquage](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide) | Guide consulté | Contrôle des contenus animés |
| [W3C — WebRTC](https://www.w3.org/TR/webrtc/) | Recommandation consultée | Frontière connexion/signalisation |
| [LiveKit — chiffrement](https://docs.livekit.io/transport/encryption/) | Documentation consultée | Clés, média et signalisation |
| [LiveKit — facturation](https://docs.livekit.io/deploy/admin/billing/) | Documentation consultée | Unités de consommation |
| [Mux — dépôt direct](https://www.mux.com/docs/guides/upload-files-directly) | Documentation consultée | Chaîne de traitement média possible |
| [Mux — lecture protégée](https://www.mux.com/docs/guides/secure-video-playback) | Documentation consultée | Protection des variantes et URLs |
| [Apple — PushKit/CallKit](https://developer.apple.com/documentation/pushkit/responding-to-voip-notifications-from-pushkit) | Documentation indexée consultée | Appels natifs iOS ; page rendue dynamiquement |
| [Android — Core-Telecom](https://developer.android.com/develop/connectivity/telecom/voip-app/telecom) | Documentation consultée | Intégration des appels Android |
| [CNIL — géolocalisation](https://www.cnil.fr/fr/geolocalisation-applications-mobiles-quelles-regles) | Page consultée | Minimisation de localisation |
| [Commission européenne — DSA](https://digital-strategy.ec.europa.eu/en/policies/digital-services-act) | Page consultée | Points de cadrage plateforme et marketplace |

### 12.3 Limites de l’étude

Certaines aides TikTok et WhatsApp ne livraient pas de texte exploitable ; « Instagram Ranking Explained » a retourné une limitation d’accès. Les pages officielles lisibles ci-dessus ont servi de remplacement. Les ressources OIM repérées ont été bloquées à l’ouverture et ne fondent aucune conclusion empirique de ce dossier.

Les références produit ne constituent pas un test comparatif de qualité, une preuve de disponibilité universelle ou un accès aux algorithmes propriétaires. Les formules, délais, priorités et nouveaux parcours sont des propositions explicites. Les compétences, la confiance et les besoins locaux doivent être validés avec la communauté et par des parcours réels.

**Décision proposée : construire d’abord le réseau utile — pages, associations, services et conversations — puis amplifier cette utilité par la découverte verticale, la qualité des médias et la téléphonie complète.**
