---
title: "DIASPORALE — Dates limites et rappels associatifs"
date: "2026-10-18"
statut: "Sources raccordées ; contrôles différés sur instruction du propriétaire"
reference: "DG-023, tranche dates limites et rappels"
---

# Dates limites et rappels des événements

Suite des [capacités et listes d'attente](22_CAPACITES_LISTES_ATTENTE_EVENEMENTS_DG023.md), dans les sources réellement raccordées à l'application. Aucun test, typage, lint, codegen, build, navigateur ou déploiement n'est lancé ; aucun commit applicatif avant reprise des contrôles obligatoires.

## Décisions et séquence

1. Date limite facultative, saisie dans le fuseau de l'événement, stockée en UTC et jamais après son début. Sans limite distincte, les inscriptions ferment au début. Une date passée permet une fermeture immédiate volontaire.
2. À l'instant limite exact, nouvelles demandes et promotions de la file se ferment. Retrait personnel toujours possible ; réouverture explicite versionnée conservant l'ordre FIFO et les places confirmées. Omission d'un ancien client conservée en édition ; null remet la clôture au début.
3. Rappel personnel J-1, exactement 24 heures réelles avant le début, désactivé par défaut. Ce délai ne signifie pas « même heure locale le jour précédent » lors d'un changement d'heure. L'attente peut mémoriser le choix mais seule une place confirmée programme le rappel. Une promotion après l'heure prévue ne provoque aucun rappel tardif automatique.
4. Une notification au plus par participation/instant de début, même après rejeu, changement de préférence ou réinscription. Les jobs durables sont invalidés par génération et relisent personne, participation, réseau, page, audience, modération et annulation.
5. Réutiliser notifyPerson et la catégorie social existante. La cloche ne stocke aucun titre, lieu ou nom de participant. Push/digest passent par les consentements, réglages, budgets et sessions existants ; une ligne dans la cloche ne prouve jamais une réception sur appareil.
6. Fournisseurs moteur/démonstration, formulaire et cartes, textes fr/en et lien gardé depuis la cloche ; scénarios écrits sans exécution. La démonstration expose les choix et échéances sans prétendre envoyer un rappel en arrière-plan.

## Sources raccordées

| Partie | Fichiers et comportement |
|---|---|
| Domaine et port DIASPORALE | `event-timing.ts` valide l'instant UTC et la frontière exclusive ; `association-activities-port.ts` expose la clôture, son état, le choix et l'état personnel du rappel |
| Événements du moteur ANTSIA | `events/tables.ts`, `pageEvents.ts`, `pageEventRegistrations.ts` : champs facultatifs compatibles avec l'historique, modification versionnée, fermeture/reprise FIFO et raccord à la confirmation |
| Rappels du moteur | `pageEventReminders.ts` programme un job durable par participation ; `pageEventReminderAccess.ts` relit les droits sans effet de bord ; aucune nouvelle table ni tâche cron globale |
| Notifications communes | Genre `association_event_reminder`, écrivain `notifyPerson`, politique vivante et cloche ; catégorie `social` existante, acteur système neutre, aucun changement de budget ni de configuration de transport |
| Fournisseurs | Adaptateurs moteur et démonstration existants ; pas de registre parallèle ni d'écriture dans une lecture. La démonstration indique explicitement que seul le choix est conservé localement |
| Interface | Formulaire de date/heure dans le fuseau de l'événement ; cartes avec clôture et choix personnel J-1 ; états désactivé, en attente de confirmation, programmé, enregistré dans la cloche ou expiré ; textes français/anglais |
| Ouverture du rappel | Lien vers le détail de l'événement de l'association, avec nouvelle lecture gardée ; aucun renvoi vers un événement personnel ou élargissement d'audience |

L'adhésion en attente peut modifier le choix d'une participation personnelle existante ; cela ne permet aucune nouvelle inscription. Le retrait et la désactivation restent possibles sur sa propre ligne après perte d'accès au contenu privé. Une suspension du réseau conserve les refus communs du moteur.

La clôture arrête aussi les promotions : une place libérée après la limite reste libre jusqu'à une éventuelle réouverture. Elle n'annule ni les confirmations ni leur rappel déjà choisi. Une édition de capacité/clôture seule préserve la décision de modération ; une édition du contenu suit la politique existante.

La génération du rappel est distincte de la version éditoriale et du numéro FIFO. Retrait ou désactivation invalident les anciens jobs. Le reçu reste conservé pour empêcher un second avis au même début après réactivation ou réinscription. À l'exécution, le job relit aussi l'effacement, la page native, l'audience privée, la modération et l'annulation. Un reçu n'est posé que si l'écrivain renvoie effectivement une notification ; le rejeu conserve sa date et son état de lecture.

La même garde protège l'écriture, la cloche et les transports : une ancienne ligne devenue inaccessible n'est plus présentée. La pagination conserve son curseur brut même lorsqu'une fenêtre est filtrée. Le compteur reste borné et indique une lecture partielle si des rappels masqués occupent sa fenêtre ; aucun décompte global exact n'est annoncé.

## Scénarios préparés et contrôles différés

Des cas sont écrits pour les frontières UTC et changements d'heure, création/modification/rejeu, fermeture et réouverture, promotions avant/après J-1, préférence personnelle, retrait/réinscription, générations périmées et reçu conditionnel. Les scénarios moteur couvrent aussi la cloche réelle, le refus d'un rappel personnel ou sans participation admissible, et les gardes de transport après annulation ou perte d'accès. Les fournisseurs et composants ont leurs scénarios de projection, saisie et états personnels.

**Aucun scénario n'a été exécuté dans cette tranche.** Le codegen, les typages, tests, lint, build et recettes navigateur restent différés à la demande du propriétaire. Les nouvelles fonctions sont raccordées dans les sources ; leur codegen/publication de développement et leur validation restent à effectuer lors du créneau coordonné. Aucun commit applicatif, serveur lancé, changement d'environnement ou déploiement n'est inclus.

La coordination ANTSIA réserve seulement les fichiers d'événements et les ajouts ciblés à la cloche/politique communes. Ses travaux PA9/PA10 et les évolutions parallèles des pages, médias et annuaires sont conservés. Le lot DG-023 et PD7 restent ouverts.

## Hors de cette tranche

Les [présences QR](27_PRESENCES_QR_EVENEMENTS_DG023.md) prolongent cette tranche en sources, sans contrôles ni recette. Rappels multiples/configurables, campagnes organisateur, preuve de réception, SMS dédié, galerie, iCal et convergence avec l'agenda personnel restent distincts. Les travaux PA9/PA10/P10, fichiers partagés d'environnement et calendriers de production restent au coordinateur ANTSIA.

Suite du même jour : [galerie après événement](28_GALERIE_APRES_EVENEMENTS_DG023.md), puis [copie iCal et agenda personnel](29_EXPORT_ICAL_AGENDA_ASSOCIATIF_DG023.md) raccordés en sources ; leurs vérifications et recettes restent différées.
