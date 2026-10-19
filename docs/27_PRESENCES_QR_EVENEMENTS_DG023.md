---
title: "DIASPORALE — Présences par QR aux événements associatifs"
date: "2026-10-18"
statut: "Sources raccordées ; contrôles différés sur instruction du propriétaire"
reference: "DG-023, tranche présences QR"
---

# Présences par QR des événements associatifs

Suite des capacités/FIFO et des dates limites/rappels, dans les sources réellement raccordées. Aucun test, codegen, typage, lint, build, navigateur, serveur ou déploiement n'est lancé. Le commit applicatif attend les contrôles obligatoires.

## Décisions de cette tranche

1. Un confirmé demande volontairement son billet personnel. Le QR ne contient qu'un code opaque aléatoire, sans nom, identifiant, titre, lieu ou URL. Le serveur garde son empreinte et son expiration, pas sa valeur brute. Durée maximale : 15 minutes ; renouveler invalide le précédent.
2. Fenêtre de pointage : une heure avant le début jusqu'à la fin exclusive. Billet et validation relisent événement publié non annulé, réseau, personne, participation confirmée et audience actuelle. L'attente n'est jamais une admission.
3. Seul un responsable vivant de l'association, habilité à gérer cet événement, peut lire un billet présenté, confirmer la présence puis corriger un pointage erroné. Le QR seul ne donne ni accès au réseau ni pouvoir de pointer.
4. La lecture caméra ne pointe personne : elle prépare une prévisualisation, puis le responsable confirme. Un second scan ne crée pas une seconde présence. Une correction versionnée invalide le billet. La saisie/copie du code reste possible si le navigateur ne sait pas lire le QR.
5. Le participant ne lit que son état ; la liste paginée des présences enregistrées et le compteur sont réservés aux responsables. Nom social publié ou libellé neutre, aucune coordonnée ni identité civile copiée. La caméra fonctionne seulement sur geste explicite et ne transmet aucune image.
6. Réutiliser eventParticipants, engineCounters et les briques QR déjà installées ; aucun package, table, cron, environnement ou registre parallèle ajouté. Retrait/réinscription et effacement libèrent aussi le compteur de présence et invalident le billet. Aucun changement des rappels ni des capacités d'admission.
7. Fournisseurs moteur et démonstration, détail de l'événement et textes fr/en raccordés. La démonstration signale des présences fictives dans ce navigateur seulement.

## Découpage

- Coordinateur : domaine pur, port, raccord QR commun, documentation et mémoire ; intégration statique uniquement.
- Moteur : module de présence, champs/index facultatifs, gardes et raccords aux participations ; scénarios écrits sans exécution.
- Fournisseurs : API moteur et simulation locale dans les activités existantes ; projections allowlistées et changement de lecteur.
- Interface : billet personnel, caméra/saisie, prévisualisation/confirmation et liste/correction réservées aux responsables ; scénarios écrits sans exécution.

## Limites à conserver

Pas de preuve d'identité physique, de géolocalisation, de badge officiel, de contrôle hors ligne, d'export d'émargement ou de photographie. Un code peut être copié ; la confirmation d'accueil est un geste du responsable. Vérifications, recette multi-comptes/caméra et codegen commun restent différés ; la [galerie](28_GALERIE_APRES_EVENEMENTS_DG023.md), puis [iCal et agenda](29_EXPORT_ICAL_AGENDA_ASSOCIATIF_DG023.md), prolongent cette tranche en sources, également sans contrôles ni recette.

## Raccordements dans les sources

| Partie | Raccord |
|---|---|
| Domaine pur | `packages/diasporale-domain/src/event-attendance.ts` : fenêtre UTC, durée de billet et format versionné fermé ; cas frontières préparés |
| Port | `association-attendance-port.ts`, export public et capacité facultative `events.attendance` ; anciens fournisseurs restent compatibles |
| Moteur ANTSIA | `events/pageEventAttendance.ts` : état personnel, liste responsable, émission, aperçu, confirmation et correction ; `pageEventAttendanceState.ts` : agrégat et invalidation indépendants des rappels |
| Données moteur | Champs/index facultatifs de `events/tables.ts`, sans nouvelle table ; raccords de `pageEventRegistrations.ts` au retrait, à la réinscription et à l'effacement, y compris si le parent a déjà disparu |
| Fournisseurs | `engine-association-activities.ts` et `demo/association-activities.ts` : capacité raccordée et projections allowlistées ; lectures moteur liées à `expectedReaderPersonId`, stockage démo v1 conservé |
| Détail de l'événement | `association-event-attendance.tsx`, monté par `association-events.tsx` au détail seulement ; pas de lecture de présence pour chaque carte du fil |
| Caméra et QR | `association-event-camera.ts` : génération de session, arrêt des pistes/timers et refus des retours tardifs ; `@antsia/social-features/qr` réemploie le générateur installé |
| Textes | Fragment `association-attendance` fr/en raccordé dans `resources.ts`, fragments voisins préservés |

Les requêtes n'exposent jamais l'empreinte ni le code du billet. Le code brut est renvoyé seulement par son émission personnelle et reste en mémoire d'écran jusqu'au renouvellement, à l'expiration ou à la sortie du contexte. La démo emploie un nonce dans la participation fictive du stockage local existant ; elle ne prétend pas reproduire un coffre serveur.

La version de présence est distincte de la version éditoriale de l'événement, de la file FIFO et des générations de rappel. Émettre un billet l'incrémente ; la première confirmation aussi. Un rejeu du même billet encore valable rend « déjà enregistré » sans modifier date, compteur ou version. Corriger compare la version attendue, supprime le pointage et invalide le billet, sans retirer la place confirmée. Cette correction reste possible après la fenêtre ou une annulation si le responsable garde l'accès à l'événement publié.

Le relevé est paginé sur l'index des présences, au plus 50 lignes et 2 Mio par fenêtre ; curseur natif conservé même si des lignes sont filtrées. Un ancien présent devenu privé peut rester corrigeable sous libellé neutre. Les personnes effacées ou en cours d'effacement sont filtrées ; le compteur d'enregistrements peut les inclure jusqu'à la purge. Aucune liste d'attente nominative ni liste générale des inscrits n'est créée.

La prévisualisation de l'écran reste neutre, car elle n'est pas un abonnement d'identité du porteur ; les noms du relevé et du dialogue de correction proviennent des lignes courantes, pas d'une copie conservée après retrait du profil. Un membre réseau en attente ayant déjà une place confirmée peut lire son état et demander son billet ; il ne gagne aucune nouvelle inscription ni fonction de responsable.

## Coordination et vérifications différées

ANTSIA a réservé et ajouté le seau `event.attendance` à l'accueil : 240 admissions/minute, capacité 30, par responsable ; émission personnelle sous `event.respond`. Aperçu, confirmation et correction ne consomment donc pas le quota des éditions d'événement (`event.manage`, 30/heure, capacité 10). Aucun quota existant n'est élargi. Le propriétaire du moteur conserve `rateLimit.ts`, les génériques et P10 commercial.

La synchronisation directe avec le second chat DIASPORALE est confirmée par la demande humaine du 18 octobre. Les pages, avis et filtres de services (ses docs/26 et docs/27) restent à cette session ; les présences restent ici. Les nouveaux fragments de traduction et les patches mémoire préservent ses changements. Aucun fichier partagé de configuration ou d'environnement n'est modifié par cette session.

Scénarios écrits pour : frontières temporelles/TTL, empreinte seule et rotation, lecture sans pointage, confirmation et rejeu, correction/version, attente et statut réseau en attente, droits vivants, mauvais réseau/événement, profils neutres, pagination et retrait/effacement. Des scénarios d'interface/caméra couvrent aussi le geste explicite, l'arrêt et les réponses tardives, la saisie de secours et le changement de lecteur. **Ils ne sont pas exécutés.**

Codegen, typages, tests, lint, build et recettes ordinateur/téléphone restent différés sur instruction du propriétaire. Les nouvelles fonctions sont référencées dans les sources, sans codegen ni publication de développement dans cette tranche. Aucun commit applicatif, serveur lancé, déploiement ou nettoyage. Les preuves historiques ne valident pas ces fichiers.

## Références techniques consultées

Le générateur réutilise la dépendance déjà déclarée du moteur : [react-qr-code](https://github.com/rosskhanas/react-qr-code). Une marge claire et une encre sombre issues des jetons sont prévues aussi en thème sombre. La lecture caméra repose sur [BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector), dont la disponibilité dépend du navigateur et d'un contexte sécurisé. La présence de l'API et du format QR est interrogée avant de demander la caméra ; la saisie du code reste accessible. Cette tranche n'annonce pas de compatibilité universelle caméra ni de recette réelle.
