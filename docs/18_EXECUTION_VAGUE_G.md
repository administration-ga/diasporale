---
title: "DIASPORALE — Reprise de la vague G exécutée avec Claude"
date: "2026-10-18"
version: "1.0"
statut: "Inventaire des sources partagées ; vérifications communes et recettes différées"
reference: "DG-001 · DG-005 à DG-017 · DG-026"
---

# Reprise de la vague G

Le propriétaire a demandé à Codex de reprendre la session Claude DIASPORALE et de continuer le [plan global](14_PLAN_GLOBAL_IMPLEMENTATION_DIASPORALE.md). La reprise confronte le journal de Claude aux fichiers présents et à l'historique Git. Elle conserve les travaux des sessions voisines et complète **DG-016, les avis de services**, étape annoncée par Claude avant son interruption.

## 1. Point de relais établi

- Session Claude : `12a903cc-bea3-4640-ba95-05b8ccbbad9d`, 18 octobre 2026.
- Dernier travail coordonné : demandes, propositions et rendez-vous DG-014/015, réception du retour de l'exécutant à 13 h 36 UTC ; Claude préparait le lancement des avis DG-016.
- Interruption immédiatement après ce retour : limite d'utilisation de Claude. Les fichiers des avis étaient des points d'extension vides ; ils sont complétés par la reprise Codex.
- DIASPORALE : branche partagée `codex/pd4-stories-albums`, dernier commit relevé `9317ec5`. La vague décrite ici est **dans les sources non commitées**, avec les changements d'autres sessions.
- ANTSIA : moteur partagé ; coordination avec le chat principal. Les raccords transverses DG-016 sont délégués explicitement à DIASPORALE. La fédération PA9B et les autres chantiers du moteur restent préservés.

## 2. Travaux de Claude retrouvés dans les sources

« Écrit et raccordé » signifie que routes, imports, ports et fournisseurs sont présents dans l'arbre. Cela ne signifie ni validation de la vague combinée, ni recette dans le navigateur, ni publication distante.

| Tickets | Sources retrouvées | Limites et suite |
|---|---|---|
| DG-001/004/022a | [Registre et matrice des droits](17_REGISTRE_DECISIONS_DROITS_G0.md), décisions de mise en contact et de confidentialité | Pas de chiffrement de bout en bout ; clôture des preuves ouverte |
| DG-005/006 | Navigation à cinq entrées, `/explorer`, `/communautes`, routes et fragments français/anglais | Ergonomie, clavier et écrans à recetter sur la vague complète |
| DG-007 | Fiches des pages, annuaire et pages des hubs, adaptateurs moteur/démonstration | Contrats consulaires réels et import DG-009 séparés |
| DG-008 | Création, revendication, gestion de l'identité et de l'équipe, « Mes pages » | Mandats/retraits à éprouver avec plusieurs comptes |
| DG-010 | Adhésion associative distincte du suivi, demandes et gestion des adhérents ; [groupes privés et événements simples](21_GROUPES_EVENEMENTS_ASSOCIATIONS_DG010.md) raccordés aux sources | Participation volontaire ; médias/conversations et événements avancés DG-023 restent à poursuivre ; aucune validation commune annoncée |
| DG-023, inscriptions, présences, galerie et calendrier | [Capacité/FIFO](22_CAPACITES_LISTES_ATTENTE_EVENEMENTS_DG023.md), [clôture/rappel J-1](24_DATES_LIMITES_RAPPELS_EVENEMENTS_DG023.md), [présences QR](27_PRESENCES_QR_EVENEMENTS_DG023.md), [galerie](28_GALERIE_APRES_EVENEMENTS_DG023.md), [export iCal et agenda](29_EXPORT_ICAL_AGENDA_ASSOCIATIF_DG023.md), puis [pagination native](30_PAGINATION_AGENDA_PERSONNEL_DG023.md) ; port, moteur/démo et interface raccordés | Aucun contrôle exécuté ; nouveau panneau paginé sans plafond200, ancien aperçu borné conservé. Codegen, recettes longues/QR/médias, réception des rappels et imports iCal restent à prouver ; aucune synchronisation externe |
| DG-011/012 | Domaine des offres et montants, catalogue, recherche/filtres/pagination, gestion des offres, « Mon activité » | Prix annoncés seulement ; aucun paiement ni boutique parallèle |
| DG-014/015 | Besoin et créneaux, proposition versionnée, confirmation et rendez-vous, annulation, absence/réalisation déclarées, boîte de demandes | Échanges structurés ; conversation libre DG-013 attend le canal générique ANTSIA P10 |
| DG-017, première tranche | Vue Découverte du fil, défilement vertical, fenêtres de lecture limitées et contrôle du lecteur | Pipeline adaptatif DG-018, classement DG-019, recette longue et qualité mobile restent ouverts |
| DG-026, surfaces | Export, demande/annulation d'effacement, décisions et recours dans les réglages | Inventaire à maintenir à chaque nouvelle table ; recette d'effacement de bout en bout toujours requise |

Le chantier voisin des **publications d'associations et d'entreprises** avance en parallèle et possède son propre [rapport](18_PUBLICATIONS_ASSOCIATIONS_ENTREPRISES.md). Il utilise le composeur et les publications du moteur. La reprise ne remplace ni ses fichiers ni ses ports.

## 3. Ajout de la reprise Codex

[DG-016](19_REPRISE_CLAUDE_AVIS_SERVICES_DG016.md) ajoute les avis admissibles et le droit de réponse : règles pures, tables et fonctions du moteur, signalement/modération, fournisseurs moteur/démonstration et surfaces sur l'offre et la demande. Un avis exige une réservation cohérente arrivée à son terme, un auteur admissible et son consentement explicite.

L'avis et la réponse ont des versions, retraits terminaux et modérations indépendants. La réponse appartient à la page ; le signataire est une référence d'audit anonymisable. Les offres et pages inaccessibles ne deviennent pas accessibles par les avis.

## 4. Niveau de preuve actuel

| Preuve | Verdict pour cette vague |
|---|---|
| Présence et raccordement des sources | Relus dans les fichiers réels ; les points d'extension DG-016 ne sont plus vides |
| Résultats annoncés dans les anciens journaux | Historiques, propres aux instantanés de leur date |
| Tests DG-016 | Scénarios écrits dans le domaine, le moteur, les fournisseurs et les composants ; **non exécutés** |
| Codegen, typage, lint, tests combinés, build | **Différés sur instruction en cours du propriétaire**, relayée par ANTSIA ; aucun lancement dans cette reprise |
| Navigateur, deux comptes, ordinateur/téléphone | **Non joués pour cette vague** ; aucune ancienne capture ne sert de preuve des nouveaux modules |
| Commit applicatif | Aucun : le contrôle obligatoire avant commit n'a pas été effectué |
| Production | Aucun push, déploiement ni changement de configuration distante |

Le fichier généré des API doit intégrer les nouveaux modules lors de la prochaine fenêtre de codegen. Il n'est pas modifié à la main pour remplacer cette étape. Une compilation antérieure ne couvre pas les nouveaux adaptateurs.

## 5. Suite ordonnée

1. Poursuivre les sources demandées en conservant les réservations de fichiers avec ANTSIA ; la première tranche groupes/événements est raccordée, le canal P10 et les événements avancés restent des dépendances partagées.
2. Quand les vérifications sont réautorisées : gel coordonné des sources, codegen puis contrôle commun `bun run --cwd ../ANTSIA verify`. Si des sources changent pendant ce contrôle, reprendre sur un instantané stable.
3. Jouer le parcours « coiffeur à Paris » avec demandeur et équipe : recherche → demande → proposition → rendez-vous → avis → réponse → signalement/retrait, y compris attente, rôle révoqué, conflit de version et coupure réseau.
4. Recetter les pages/adhésions et la vue verticale sur ordinateur et téléphone, puis reprendre DG-002 : galerie de deux photos réellement délivrées au compte lecteur.
5. Après contrôles et recettes : commits par périmètre explicite, puis publication distante uniquement sur instruction du propriétaire.

PD4 reste ouvert. La présence de nouvelles surfaces PD5/PD8 ne ferme ni les recettes médias restantes, ni les dépendances externes IDN, attestation et import consulaire.
