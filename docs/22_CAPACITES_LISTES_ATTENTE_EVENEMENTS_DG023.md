---
title: "DIASPORALE — Capacités et listes d'attente associatives"
date: "2026-10-18"
statut: "Sources raccordées ; scénarios écrits, contrôles différés sur instruction du propriétaire"
reference: "DG-023, tranche capacité et liste d'attente"
---

# Capacités et listes d'attente des événements

Suite ciblée de [DG-010](21_GROUPES_EVENEMENTS_ASSOCIATIONS_DG010.md), en coordination avec ANTSIA. Les contrôles restent différés : aucun test, typage, lint, codegen, build ou navigateur n'est lancé. Aucun commit applicatif avant réouverture du contrôle obligatoire.

## Règles retenues

- Capacité facultative : sans limite par défaut, entier de 1 à 10 000 lorsqu'elle est fixée. L'omission d'un ancien client conserve la capacité existante lors d'une modification.
- Une demande volontaire prend une place disponible ou rejoint la liste d'attente. Une demande en attente autorise explicitement son passage automatique à une place ; aucun adhérent ni responsable n'est inscrit d'office.
- Ordre FIFO par séquence transactionnelle, sans doublon au double clic. Une personne quittant la file puis revenant repart à la fin.
- Confirmation et attribution de la dernière place dans la même transaction que les compteurs ; aucune sélection par l'organisateur et aucune priorité personnelle cachée.
- Retrait d'un confirmé et hausse de capacité reprennent la file. Promotions par lots bornés, avec continuation interne et relecture des droits, de la modération, de la date et de l'annulation. Les demandes devenues inadmissibles sont retirées de la file sans ouvrir leur contenu privé.
- Une réduction sous le nombre déjà confirmé est refusée. Changement de capacité seul distinct d'une modification du contenu modéré ; les événements annulés/passés ou masqués n'attribuent aucune nouvelle place.
- La carte affiche capacité, places confirmées/disponibles, nombre en attente, état personnel et rang personnel. Ni nom, ni identifiant, ni ordre individuel d'autrui n'est exposé.
- Les événements personnels et leurs réponses ne changent pas. Pour une page, `pending` avec séquence de demande signifie attente ; aucune nouvelle réponse personnelle n'est inventée.
- Les événements historiques sans capacité restent sans limite. Les comptes effacés doivent être retirés des agrégats et la place libérée reprise par le même moteur.

## Découpage

1. Domaine/port : capacité validée, réduction protégée, état personnel et résumé des places.
2. Moteur : index FIFO et agrégats existants, inscription/retrait atomiques, remplissage borné et raccords d'effacement/modération coordonnés.
3. Fournisseurs moteur/démonstration : projections fermées et même sémantique de file.
4. Interface : capacité dans le formulaire, confirmation/attente/rang, retrait et actualisation de sa place ; textes français/anglais.
5. Scénarios écrits sans exécution : dernière place concurrente, FIFO/rejeu/retour, baisse/hausse, invalidation des droits, annulation, effacement et changement de compte.

## Suite distincte

Les [dates limites et rappels personnels J-1](24_DATES_LIMITES_RAPPELS_EVENEMENTS_DG023.md), [présences QR](27_PRESENCES_QR_EVENEMENTS_DG023.md), [galerie](28_GALERIE_APRES_EVENEMENTS_DG023.md) et [iCal/agenda](29_EXPORT_ICAL_AGENDA_ASSOCIATIF_DG023.md) prolongent cette tranche en sources, sans contrôles exécutés. Réception, recettes QR/médias et imports iCal réels restent à prouver ; ces sources ne constituent pas la validation d'un pilote.

## Raccords présents dans les sources

| Zone | Fichiers et comportement |
|---|---|
| Domaine | `event-capacity.ts`, export public : capacité validée, réduction protégée et borne de traitement de 32 candidats |
| Moteur | `events/tables.ts`, `pageEvents.ts`, `pageEventRegistrations.ts` : capacité optionnelle, index FIFO, compteurs agrégés et remplissage transactionnel |
| Effacement | `people/erasure.ts` appelle le retrait des agrégats avant suppression d'une participation de page ; la reprise est programmée après transaction |
| Modération | `moderation/targets.ts` programme la reprise après approbation/restauration d'un événement de page ; le job relit toutes les gardes |
| Fournisseurs | `engine-association-activities.ts` et `demo/association-activities.ts`, avec projection fermée des agrégats et de l'état personnel |
| Interface | Formulaire et cartes des événements déjà montés sur les pages d'association, textes français/anglais, tests d'interaction écrits |

La séquence FIFO ne modifie pas la version éditoriale de l'événement : une nouvelle demande de place ne détruit pas le brouillon d'un responsable. Les compteurs restent dans l'agrégat existant, sans compteur de participants dénormalisé sur l'événement.

## Limites précises et recette différée

- Les comptes et rangs décrivent les inscriptions persistées. Un confirmé garde sa place après une simple perte de droit de lecture, jusqu'à son retrait ou à l'effacement effectif de son compte. Les attentes devenues inadmissibles sont nettoyées lorsque des places peuvent être attribuées ; le rang n'est pas une promesse d'admission.
- Une indisponibilité collective (réseau archivé, page masquée ou événement en attente/retiré) fige la file sans exclure toutes les personnes. L'approbation/restauration de l'événement la reprend ; les autres réouvertures peuvent nécessiter le geste « Actualiser ma place ». Aucun traitement ne dépasse le début de l'événement.
- La démonstration conserve le stockage v1 et les anciennes inscriptions, sans purge. Elle n'a pas de scheduler : au-delà de 32 candidats, une reprise supplémentaire utilise « Actualiser ma place ». Le moteur programme sa continuation interne.
- Lorsqu'un compte de démonstration est réellement effacé, la souscription au magasin retire physiquement ses participations du stockage séparé et reprend les événements concernés avec la même borne. Une ancienne trace chargée à froid est aussi réconciliée à la souscription ou au prochain geste, sans écriture dans les fonctions de lecture. Retirer seulement le profil ne déclenche pas cette purge.
- Les nouveaux modules et l'index attendent le codegen coordonné. Aucun fichier généré n'est modifié à la main et aucune migration de données réelle n'est lancée. Les agrégats historiques, notamment après d'anciens effacements, restent à contrôler avant tout pilote ; aucun recalcul historique implicite n'est revendiqué.
- Scénarios écrits, non exécutés : dernière place concurrente, rejeu et retour en fin de file, réduction refusée/hausse/sans limite, profil retiré distinct du compte effacé, droits vivants, file gelée, annulation, continuation bornée, isolation des événements personnels, projection privée et changements de compte dans l'interface.

Les deux raccords transverses sont annoncés au coordinateur ANTSIA et limités aux participations/événements de page ; les sources PA9, révocations, fédération et autres comportements d'effacement sont conservés. Le [plan global](14_PLAN_GLOBAL_IMPLEMENTATION_DIASPORALE.md) et le [registre des droits](17_REGISTRE_DECISIONS_DROITS_G0.md) restent ouverts jusqu'aux contrôles communs.
