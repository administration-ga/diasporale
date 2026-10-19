---
title: "DIASPORALE — Avis de services et droit de réponse, reprise Claude DG-016"
date: "2026-10-18"
version: "1.0"
statut: "Implémentation raccordée ; tests écrits, exécution et recette différées"
reference: "DG-016 · G5 · DG-026"
---

# Avis de services et droit de réponse

Cette tranche reprend le prochain module laissé à lancer par Claude après DG-014/015. Elle ajoute l'avis du demandeur sur une prestation admissible, sa modification et son retrait, la réponse de l'équipe professionnelle et le signalement indépendant de ces deux contenus. Elle utilise les sources servies par DIASPORALE et le moteur ANTSIA partagé.

Le bilan de la vague antérieure et le point précis de relais sont dans [docs/18 — Exécution](18_EXECUTION_VAGUE_G.md). Les règles de droits complètent le [registre G0](17_REGISTRE_DECISIONS_DROITS_G0.md).

## 1. Parcours raccordés

- Dans **Mes demandes**, le demandeur retrouve sa possibilité de laisser un avis, son avis en attente, son édition et son retrait confirmé.
- Dans la **fiche d'une offre active**, la liste paginée montre les seuls avis publiés et admissibles. Les curseurs viennent du moteur ; les fenêtres utilisent le composant de pagination existant, avec dédoublonnage et refus d'accès.
- Un signataire vivant de la page peut répondre à un avis publié, modifier sa réponse avec sa version ou la retirer. Ce droit est réévalué côté serveur ; l'ancien auteur ne conserve aucun droit après révocation de son rôle.
- Un membre peut signaler un avis ou une réponse publiée. Chaque contenu utilise son propre identifiant dans les cas de modération du moteur.

Les feuilles conservent le brouillon après refus et la version ouverte, verrouillent le geste en cours et ignorent la réponse de publication après démontage/changement de personne. Les textes viennent des fragments `service-reviews` français/anglais, les couleurs des rôles existants.

## 2. Admissibilité et preuve annoncée

| Condition | Règle |
|---|---|
| Auteur | Demandeur de la réservation seulement ; ni professionnel auteur de la proposition acceptée, ni signataire vivant de sa page |
| Références | Réseau, page, offre, demande, proposition courante acceptée et réservation doivent être cohérents ; le client ne fournit pas la preuve |
| État | Demande/réservation toutes deux confirmées, ou toutes deux réalisées ; fin du rendez-vous atteinte |
| Annulation ou absence | Aucun droit de créer un avis à partir de ces états |
| Unicité | Un avis par réservation et demandeur, y compris après retrait ; le contrôle et l'écriture sont transactionnels |
| Rejeu identique | Même note et même texte normalisé : même identifiant, `created: false` ; contenu différent : conflit |
| Consentement | Case décochée initialement ; accord explicite exigé et horodaté lors de la création |
| Texte | Note entière de 1 à 5, avis de 10 à 2 000 caractères, réponse de 2 à 1 000 ; normalisation et refus des coordonnées/adresses selon la règle partagée |
| Concurrence | Édition et retrait citent la version attendue ; une réponse existante possède sa propre version |
| Retrait | Terminal pour l'avis et la réponse ; aucune édition, recréation ou approbation tardive ne les republie |

Deux preuves sont nommées séparément : **réservation confirmée** (`booking_confirmed`) et **réalisation déclarée par le professionnel** (`completion_declared`). Ni l'une ni l'autre n'est présentée comme une certification indépendante du service rendu. La note ne produit pas encore de moyenne ni de classement de professionnels.

## 3. Confidentialité et modération

- Réseau `diasporale` obligatoire ; aucune écriture sociale générique hors réseau. La lecture reste permise au membre en attente ; la création et l'édition exigent le droit de publier. Le retrait de son avis reste permis en attente.
- La projection publique est une liste explicite : contenu, note, preuve, nom d'affichage vivant ou identité indisponible, dates et droits. **Aucun identifiant de demande/rendez-vous/personne, handle ou lien vers un profil** n'est livré par la carte d'avis.
- Une offre inactive ou une page illisible ne donne aucun accès public aux avis par son identifiant. La vue privée de l'auteur peut conserver la trace d'un avis sur une offre en pause.
- Sans politique explicite pour `serviceReview` ou `serviceReviewReply`, la création et l'édition restent **en attente de modération**. Aucun réglage distant n'est posé par cette tranche.
- Le catalogue exclut les avis en attente, y compris pour leur auteur ou un modérateur. L'auteur retrouve le sien dans sa demande ; les modérateurs passent par leur file et sa prévisualisation bornée.
- La réponse en attente est lisible par l'équipe habilitée de la page ; l'auteur de l'avis ne la reçoit pas par sa vue privée. La modération d'une réponse ne retire pas l'avis client.
- Le budget de modération des réponses est compté au niveau de la page, indépendamment du signataire. Un modérateur également signataire vivant de cette page ne peut ni approuver sa réponse ni décider son signalement ; un tiers habilité doit intervenir.
- L'avis retiré ou supprimé par modération quitte la liste publique ; sa trace privée ne rend ni texte ni identité. Une réponse retirée est une trace vide et non modifiable.
- Les blocages et les masques de signalement sont relus. Un aperçu de modération ne révèle pas les besoins, créneaux ou autres pièces privées de la demande.

La mise en contact reste structurée. Cette tranche n'ouvre ni conversation personnelle iCom, ni appel, ni paiement. Le canal de conversation de prestation reste le chantier partagé DG-013/P10.

## 4. Sources principales

| Zone | Fichiers |
|---|---|
| Domaine pur DIASPORALE | `packages/diasporale-domain/src/service-reviews.ts` et tests |
| Contrat de données | `packages/diasporale-features/src/data/service-reviews-port.ts` |
| Moteur ANTSIA | `convex/modules/diaspora/serviceReviews.ts`, `serviceReviewsTables.ts`, manifeste et tests |
| Modération partagée, raccord délégué | `moderation/tables.ts`, `targets.ts`, `reviewProjection.ts`, helper distinct dans `policy.ts`, garde limitée dans `cases.ts`, `page-content-policy.test.ts`, `social-domain/moderationPolicy.ts`, libellés des surfaces dans la console |
| Droits des données, raccord délégué | `people/dataPolicies.ts`, `serviceReviewsDataPolicy.test.ts` |
| Adaptateur moteur | `apps/diasporale_com/src/data/engine-service-reviews.ts` et tests |
| Démonstration | `demo/service-reviews.ts` et tests ; même contexte vivant que les demandes et équipes de page |
| Surfaces | `service-reviews-section.tsx`, `service-review-editor.tsx`, montage dans `services-screens.tsx` et `service-request-screens.tsx` |
| Traductions | `i18n/locales/{fr,en}/service-reviews.json` |

Les données de démonstration restent fictives, dans ce navigateur seulement. Elles ne créent pas de réservation pour rendre un avis admissible et ne simulent aucun modérateur réel. Les avis et éditions démo restent en attente ; un signalement y masque localement la cible sans transmission à une équipe réelle.

## 5. Effacement et propriété collective

L'avis appartient au demandeur et suit aussi l'effacement de sa demande. La réponse suit son avis, mais **n'appartient pas personnellement au signataire**. Sa référence d'audit est anonymisée si ce dernier efface son compte ; le contenu collectif n'est pas détruit pour cette seule raison.

La politique de données de `serviceReviewReplies` précise `owners: []` et `parents: ["reviewId"]`. Le tableau vide est nécessaire : en son absence, l'inventaire générique déduit une propriété personnelle de la référence `authorPersonId`. L'état de modération de la réponse est rattaché à `ownerPageId`, sans `ownerPersonId` du signataire.

## 6. Vérifications et limites

Scénarios écrits : admissibilité/validation pures, sessions et droits réels du moteur, unicité/concurrence, retraits, projection minimale, modérations indépendantes, signalements, pagination/démonstration, formulaires, versions figées, consentement et résultat tardif. Les cas de modération utilisent aussi les véritables fonctions de prévisualisation, approbation et décision, avec refus du conflit de signature de page et budget collectif. La politique des données possède des cas dédiés de propriété/export/anonymisation.

**Aucun de ces tests n'a été exécuté pendant cette reprise.** La consigne en cours sur le moteur partagé diffère également codegen, typage, lint, build et recette navigateur. Le fichier généré des API doit encore être régénéré pour connaître les nouvelles fonctions ; il n'a pas été édité manuellement.

Aucun commit applicatif n'est créé sans le contrôle obligatoire. Aucun serveur lancé ou arrêté, aucune suppression de cache/donnée/session, aucun push ou déploiement.

## 7. Recette à jouer à la réouverture des contrôles

1. Demandeur : avant réservation, avant fin, annulation et absence → création fermée ; réservation confirmée arrivée à terme → consentement puis création.
2. Équipe : impossible de s'auto-évaluer ; nom de l'auteur absent des références privées retournées au public ; révocation du rôle coupe les réponses.
3. Modération : sans politique, avis privé en attente ; prévisualisation autorisée puis approbation → visibilité pour le lecteur ; blocage et retrait coupent cette visibilité.
4. Professionnel : réponse indépendante ; édition concurrente refusée sans perdre le brouillon ; retrait ou décision de suppression de réponse préserve l'avis.
5. Auteur : édition/retrait versionnés ; double envoi identique sans doublon ; retrait en attente possible ; approbation tardive sans republication.
6. Plus de vingt avis admissibles : pagination, insertion en tête et retrait sans trou ni doublon visible ; fenêtre filtrée vide pouvant annoncer la suite.
7. Ordinateur et téléphone : clavier, focus, feuille de confirmation, textes français/anglais, erreur/reprise ; changement de compte pendant un envoi sans brouillon réadopté.
8. Export/effacement : avis personnel traité avec sa demande ; départ du signataire anonymisant seulement la signature de page ; aucun contenu voisin exporté.
