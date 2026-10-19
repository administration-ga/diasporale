---
title: "DIASPORALE — Registre d'état, décisions et matrice des droits (lot G0)"
date: "2026-10-18"
version: "1.1"
statut: "Décisions d'exécution de la vague coordonnée du plan global ; matrice des droits appliquée par les gardes des lots G2, G4, G5 et G9"
reference: "DG-001 · DG-004 · DG-022a"
---

# DIASPORALE — Registre d'état, décisions et matrice des droits

Ce document ferme les incertitudes du lot **G0** du [plan global](14_PLAN_GLOBAL_IMPLEMENTATION_DIASPORALE.md) avant d'étendre le produit. Il consigne l'état réel relevé le 18 octobre 2026 (DG-001), les arbitrages pris pour lancer l'exécution (§8.2 du plan), le niveau de confidentialité réellement livré des communications (DG-022a) et la matrice des droits que les gardes du moteur et les écrans appliquent (DG-004).

Les sources de la vague, le relais Claude → Codex et les limites sont consignés dans le [rapport d'exécution](18_EXECUTION_VAGUE_G.md). La vérification combinée est différée sur instruction du propriétaire ; ce registre n'en constitue pas une preuve. Les ajouts DG-016 sont décrits dans le [rapport des avis](19_REPRISE_CLAUDE_AVIS_SERVICES_DG016.md).

## 1. Registre d'état au 18 octobre 2026, 14 h (DG-001)

| Élément | État relevé | Conséquence |
|---|---|---|
| Dépôt DIASPORALE | Branche `codex/pd4-stories-albums`, `HEAD` `9317ec5` ; travaux non commités d'autres sessions : accueil et inscription (17/10), surfaces claires (17/10), partage cité (18/10), **DG-003** « Mon fil » (18/10), études `docs/11`, `13`, `14`, `15`, `16`, recettes `docs/recette/` | Instantané non publié `refs/snapshots/avant-vague-g` ; ces travaux sont préservés et commités séparément après le contrôle commun |
| Moteur ANTSIA | Branche `codex/pa4-identite-session`, `HEAD` `9eaff40` ; travaux non commités de la fédération PA9A (Codex) et de la refonte sociale et commerciale (session ANTSIA) | Aucun fichier du moteur hors de la tranche `convex/modules/diaspora/` n'est écrit par DIASPORALE ; fichiers partagés modifiés par ANTSIA sur demande |
| Serveurs | Aucun serveur ni backend Convex local actif à 14 h 05 (relevé de la session ANTSIA) | `convex/_generated/api.d.ts` ne connaît les nouveaux modules qu'après un codegen coordonné |
| Dernière vérification commune | 7 186 tests (passage officiel antérieur) ; elle ne couvre ni DG-003, ni PA9A, ni la vague G | Une seule vérification commune au gel, pilotée par la session ANTSIA |
| DG-002 (deux photos) | Ouvert : aucune carte de recette ne porte deux images | Ne bloque pas les lots suivants ; la preuve reste à jouer |
| DG-003 (Mon fil) | Sources raccordées le 18/10, vérifications différées ; typage des trois paquets à zéro erreur et cliquet i18n repris le 18/10 (une clé morte retirée) | Couvert par le contrôle commun |
| Recettes antérieures ouvertes | PD0 (`docker build`), PD2 R1 (IDN dans le moteur), PD3 R2 (attestation réelle avec consulat.ga) | Inchangées ; dépendances externes |

## 2. Décisions d'exécution

| N° | Décision | Option retenue | Ce qu'elle bloque ou permet |
|---|---|---|---|
| D-G01 | Emplacement de la mise en relation | Tranche `convex/modules/diaspora/` du moteur (`servicesTables.ts`, `services.ts`, `serviceRequestsTables.ts`, `serviceRequests.ts`) et domaine pur extractible dans `@diasporale/domain` (`services.ts`, `service-requests.ts`, `money.ts`) — règle §2.3 du plan | Accord de la session ANTSIA du 18/10 sous trois conditions : **aucun paiement, aucun lien PRO.GA, aucun vocabulaire « commerce »** ; convergence avec les contrats P06/P14 d'ANTSIA à prévoir |
| D-G02 | Mise en contact professionnelle | Demande **structurée** attachée à une offre (besoin, fenêtres souhaitées, proposition versionnée) ; aucune relation sociale créée ; le nom du demandeur n'est montré à l'équipe de la page qu'avec son accord explicite | La conversation libre attend le canal commercial générique d'ANTSIA (P10) ; aucun fork d'iCom, aucune ouverture des fils personnels |
| D-G03 | Paiement | Aucun : un tarif est « annoncé par le professionnel », la plateforme ne facture ni n'encaisse | Le paiement reste une décision D4 séparée |
| D-G04 | Publicité | Aucune au pilote | D4 seulement, étiquetée |
| D-G05 | Classement | Règles explicables et ordre chronologique ; aucun apprentissage comportemental | La personnalisation attend un protocole de mesure validé (G6) |
| D-G06 | Confidentialité des communications (DG-022a) | Voir §3 : chiffrement de transport et contrôle d'accès du moteur, **sans chiffrement de bout en bout** | Aucun libellé « chiffré de bout en bout » ; DG-022b avant toute promesse |
| D-G07 | Infrastructure média et appels | Inchangée : garde des fichiers du moteur, appels du moteur ; aucun nouveau fournisseur | Le transcodage adaptatif (G6b) attend une grille de coûts et de résidence |
| D-G08 | Capacité des groupes | Limite actuelle du moteur (256) ; écart avec le cahier documenté | Pas de promesse de groupes de 1 000 |
| D-G09 | Publication hors réseau | Inchangée : visibilité `network` par défaut, `root` par geste explicite | — |
| D-G10 | Données professionnelles obligatoires | Aucune au-delà de l'identité de la page ; politique par pays à écrire avant toute transaction | Ouverture de professions réglementées : non |
| D-G11 | Mineurs | Aucun élargissement | — |
| D-G12 | Zone pilote | Paris / Île-de-France, **hypothèse à confirmer** avec des volontaires | Recrutement, pas le code |
| D-G13 | Démonstration | Toute capacité nouvelle est aussi servie par le fournisseur de démonstration, données explicitement fictives | Parité des surfaces (`docs/04`) |
| D-G14 | Traductions | Un fragment de locale par chantier (`locales/<langue>/<chantier>.json`), fusion profonde stricte qui refuse toute collision ; familles dynamiques par chantier (`ratchets/i18n-families/`) | Les chantiers parallèles n'écrivent jamais le même fichier de textes |
| D-G15 | Débit des écritures nouvelles | Seaux ajoutés par ANTSIA : `diaspora.service.offer` 30/h, `diaspora.service.request` 20/h (renforcé 5/jour pour un compte léger), `diaspora.service.respond` 60/h, `diaspora.service.booking` 60/h, `diaspora.service.review` 10/jour, `diaspora.association.membership` 30/h, `diaspora.association.manage` 120/h | Valeurs de départ, à mesurer au pilote |
| D-G16 | Idempotence | Alignée sur le contrat de commande du moteur : même clé et même corps rendent le même résultat ; même clé et autre corps sont un conflit | Double envoi après coupure (R-G05) |

## 3. Niveau de confidentialité réellement livré (DG-022a)

| Échange | Protection livrée | Ce qui n'est **pas** livré |
|---|---|---|
| Messages iCom, demandes de service, propositions | Chiffrement du transport entre le navigateur et le moteur ; contrôle d'accès serveur (réseau, participants, blocage, sanction) ; données lisibles par le moteur pour la modération, l'export et l'effacement | Aucun chiffrement de bout en bout ; le moteur peut lire ces contenus |
| Appels | Transport chiffré du service temps réel du moteur ; droits d'appel inchangés (relation autorisée, groupe autorisé) | Aucune gestion de clés de bout en bout ; une page ou une offre ne donne aucun droit d'appeler |
| Notifications externes | Neutres, sans contenu privé | — |

Toute mention « chiffré de bout en bout », « privé comme WhatsApp » ou équivalente est interdite dans l'interface et la communication tant que DG-022b (modèle de menace, clés, appareils, récupération, pièces jointes, signalements) n'est pas décidé, implémenté et revu.

## 4. Matrice des droits (DG-004)

Légende : ✅ permis ; ⛔ refus indistinct (même réponse qu'un objet absent) ; 🔒 refus explicite traduit (statut insuffisant, quota, conflit) ; — sans objet. « Lecteur » = membre de DIASPORALE ayant la capacité `read_network` (dont l'adhésion en attente) ; « publiant » = capacité `publish` (déclaré ou vérifié) ; « signataire vivant » = rôle `admin` ou `signatory` accepté et non retiré sur une page active du réseau. Un membre suspendu, bloqué ou extérieur au réseau reçoit le refus de la ligne « hors réseau » sauf mention contraire.

| Geste | Lecteur | Publiant | Vérifié | Signataire vivant | Admin de la page | Demandeur | Suspendu | Hors réseau |
|---|---|---|---|---|---|---|---|---|
| Lire la fiche d'une page lisible | ✅ | ✅ | ✅ | ✅ | ✅ | — | ⛔ | ⛔ |
| Créer/fermer le groupe lié d'une association | ⛔ | ⛔ | ⛔ | ⛔ | ✅ administrateur vivant et situation associative admissible | — | ⛔ | ⛔ |
| Rejoindre le groupe privé | 🔒 droit de publier requis | ✅ adhérent accepté, ou responsable sans ligne associative ; geste explicite | idem | idem | idem | — | ⛔ | ⛔ |
| Lire/publier dans le groupe | ✅ lecture si membre du groupe et encore admissible | idem + publication | idem | aucune exception sans entrée volontaire | idem | — | ⛔ | ⛔ |
| Créer/modifier/annuler un événement de page | ⛔ | ⛔ | ⛔ | ✅ vivant, droit de publier ; version attendue | idem | — | ⛔ | ⛔ |
| Lire l'événement associatif | ✅ si publié et audience réseau, ou adhérent accepté si audience privée | idem | idem | ✅ équipe vivante, y compris en attente de modération | idem | — | ⛔ | ⛔ |
| S'inscrire / retirer son inscription | ✅ retrait personnel ; nouvelle inscription fermée | ✅ soi, avant début et si événement publié accessible | idem | idem | idem | — | ⛔ | ⛔ |
| Demander / actualiser une place ou rejoindre la file | ⛔ nouvelle demande et actualisation | ✅ soi, événement accessible publié et avant clôture ; FIFO sans priorité de rôle | idem | idem | idem | — | ⛔ | ⛔ |
| Lire le rang d'attente | ✅ son rang uniquement si l'événement reste lisible | idem | idem | aucun rang individuel d'autrui | idem | — | ⛔ | ⛔ |
| Modifier la capacité de l'événement | ⛔ | ⛔ | ⛔ | ✅ version attendue ; réduction sous les confirmations refusée | idem | — | ⛔ | ⛔ |
| Modifier la date limite d'inscription | ⛔ | ⛔ | ⛔ | ✅ version attendue ; au plus au début ; réouverture FIFO | idem | — | ⛔ | ⛔ |
| Choisir / désactiver son rappel J-1 | ✅ propre participation existante seulement ; activation avant J-1 sur événement publié lisible ; désactivation sans nouvel accès privé | idem | idem | aucune préférence d'autrui | idem | — | ⛔ | ⛔ |
| Demander son billet QR / lire son pointage | ✅ propre place déjà confirmée, audience actuelle et fenêtre pour le billet ; aucune nouvelle admission | idem | idem | idem pour soi | idem | — | ⛔ | ⛔ |
| Lire un billet / confirmer une présence | ⛔ | ⛔ | ⛔ | ✅ mandat vivant, événement publié, fenêtre ouverte et confirmé admissible ; le code seul ne donne aucun droit | idem | — | ⛔ | ⛔ |
| Lire le relevé des présences / corriger | ⛔ | ⛔ | ⛔ | ✅ événement publié encore accessible ; correction sous version, sans annuler l'inscription ; possible après fenêtre/annulation | idem | — | ⛔ | ⛔ |
| Lire la galerie après événement | ✅ après la fin exacte, événement publié non annulé et audience actuelle respectée ; aucun billet requis | idem | idem | idem ; aucune exception de signataire pour un événement masqué | idem | — | ⛔ | ⛔ |
| Ajouter des médias à la galerie | ⛔ | ⛔ | ⛔ | ✅ mandat vivant et droit de publier, après la fin ; identité collective de page, audience héritée et réseau fermé | idem | — | ⛔ | ⛔ |
| Retirer un ajout de galerie | ⛔ | ⛔ | ⛔ | ✅ mandat vivant et droit de publier ; événement publié encore accessible, nettoyage possible après annulation | idem | — | ⛔ | ⛔ |
| Lire ses inscriptions associatives dans l'agenda | ✅ propres places confirmées/attentes encore lisibles ; annulations conservées, retrait ou perte d'accès ferme la ligne | idem | idem | aucun événement de page ajouté du seul fait du mandat | idem | — | ⛔ | ⛔ |
| Continuer les pages de l'agenda personnel | ✅ lecteur attendu, réseau/personne courants et droits relus pour chaque fenêtre ; une page vide peut annoncer une suite | idem | idem | mêmes droits ; aucun événement collectif du seul fait du rôle | idem | — | ⛔ | ⛔ |
| Exporter une copie iCal d'un événement associatif | ✅ événement/page publiés encore lisibles selon audience actuelle ; sans inscription possible, fichier alors provisoire ; aucune inscription créée | idem | idem | mêmes droits de lecture, aucune exception sur un masque collectif | idem | — | ⛔ | ⛔ |
| Suivre / ne plus suivre une page | 🔒 selon le moteur | ✅ | ✅ | ✅ | ✅ | — | ⛔ | ⛔ |
| Créer une page (association, entreprise) | 🔒 | 🔒 adhésion vérifiée requise | ✅ | — | — | — | ⛔ | ⛔ |
| Revendiquer une page revendicable | règle du moteur | règle du moteur | règle du moteur | ⛔ déjà signataire | ⛔ | — | ⛔ | ⛔ |
| Gérer l'équipe (inviter, retirer) | ⛔ | ⛔ | ⛔ | ⛔ | ✅ sauf retrait du dernier administrateur 🔒 | — | ⛔ | ⛔ |
| Publier au nom d'une page | ⛔ | ⛔ | ⛔ | ✅ | ✅ | — | ⛔ | ⛔ |
| Lire le catalogue (offres actives) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⛔ | ⛔ |
| Lire une offre en pause, brouillon ou retirée | ⛔ | ⛔ | ⛔ | ✅ (ses pages) | ✅ | ⛔ même par lien conservé | ⛔ | ⛔ |
| Créer, modifier, suspendre, retirer une offre | ⛔ | ⛔ | ⛔ | ✅ (page entreprise ou association active ; version attendue) | ✅ | — | ⛔ | ⛔ |
| Envoyer une demande sur une offre active | 🔒 statut insuffisant | ✅ (accord explicite, quota) | ✅ | ✅ sauf sur sa propre page 🔒 | idem | — | ⛔ | ⛔ |
| Lire une demande | ⛔ | ⛔ | ⛔ | ✅ demandes de ses pages | ✅ | ✅ les siennes | ⛔ | ⛔ |
| Proposer, refuser | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Accepter la proposition courante | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ version courante, non expirée, créneau libre | ⛔ | ⛔ |
| Annuler | ⛔ | ⛔ | ⛔ | ✅ avec motif après confirmation | ✅ | ✅ avant confirmation, avec motif après | ⛔ | ⛔ |
| Déclarer réalisée ou absence | ⛔ | ⛔ | ⛔ | ✅ après l'heure de début | ✅ | ⛔ | ⛔ | ⛔ |
| Lire les avis publiés d'une offre active | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⛔ | ⛔ |
| Lire la preuve et son avis dans sa demande | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ y compris en attente ; corps retiré/supprimé masqué | ⛔ | ⛔ |
| Créer ou modifier un avis | 🔒 | ✅ demandeur admissible seulement | idem | ⛔ auto-avis | ⛔ auto-avis | ✅ droit de publier, réservation arrivée à terme, consentement, version | ⛔ | ⛔ |
| Retirer son avis | — | — | — | — | — | ✅ y compris en attente, version attendue | ⛔ | ⛔ |
| Répondre à un avis publié, modifier sa réponse | ⛔ | ⛔ | ⛔ | ✅ droit de publier, page active, version propre ; avis d'autrui | idem | ⛔ | ⛔ | ⛔ |
| Retirer la réponse de la page | ⛔ | ⛔ | ⛔ | ✅ rôle vivant, lecture autorisée, version propre | idem | ⛔ | ⛔ | ⛔ |
| Signaler un avis ou sa réponse | ✅ contenu lisible seulement | idem | idem | idem | idem | idem | ⛔ | ⛔ |
| Écrire ou appeler par iCom | règle iCom inchangée (relation acceptée) ; une demande de service n'ouvre **aucun** fil personnel ni droit d'appel | | | | | | ⛔ | ⛔ |
| Exporter ses données, demander ou annuler l'effacement, lire ses décisions, former un recours | ✅ soi seulement | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (sans rouvrir les surfaces sociales) | ✅ par le compte commun |

Règles transverses appliquées par chaque garde : une page désactivée ou un rôle retiré coupe immédiatement les gestes du professionnel ; une offre retirée quitte les résultats et n'est plus contactable ; une demande, une proposition ou une réservation d'autrui est introuvable ; aucune coordonnée, aucune adresse exacte de domicile n'est stockée dans une demande ; aucune notification n'est écrite hors du rédacteur unique du moteur.

## 5. Organisation de la vague

| Chantier | Tickets | Fichiers réservés (résumé) |
|---|---|---|
| Pages | DG-007 | `engine-pages.ts`, `pages-port.ts`, `demo/pages.ts`, fiche d'une page, hub pays, annuaire des pages, `diaspora/hubs.ts`, `diaspora/hubPages.ts` |
| Gestion des pages | DG-008 | `engine-page-admin.ts`, `page-admin-port.ts`, `demo/page-admin.ts`, création, revendication, équipe, « Mes pages » |
| Catalogue | DG-011, DG-012 | domaine `services.ts`, `diaspora/services*.ts`, `services-port.ts`, `engine-services.ts`, `demo/services.ts`, `/services`, « Mon activité » |
| Demandes et rendez-vous | DG-014, DG-015 | domaine `service-requests.ts`, `diaspora/serviceRequests*.ts`, `service-requests-port.ts`, `engine-service-requests.ts`, `demo/service-requests.ts`, `/mes-demandes` |
| Avis et droit de réponse — reprise Codex | DG-016 | domaine `service-reviews.ts`, `diaspora/serviceReviews*.ts`, port, fournisseurs moteur/démo et composants d'avis ; raccords modération/politique des données délégués par ANTSIA |
| Droits personnels | DG-026 | `data-rights-port.ts`, `engine-data-rights.ts`, `demo/data-rights.ts`, section « Mes données » des Réglages |
| Navigation | DG-005, DG-006 | coque `app-shell.tsx`, `/explorer`, `/communautes` |

Le coordinateur a posé avant la vague les contrats communs : routes, capacités facultatives du port, briques communes de l'adaptateur moteur (`engine-kit.ts`), table `serviceOffers`, montants, composants de montage croisés et fragments de traduction.
