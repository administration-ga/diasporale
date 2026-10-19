---
title: "DIASPORALE — Prompt de lancement de la session de construction"
version: "1.0"
date: "2026-10-14"
statut: "Prompt de démarrage (session Claude Code, Opus 5.5, effort maximal)"
projet: "DIASPORALE"
---

# DIASPORALE — Prompt de lancement de la session de construction

> Ce texte est le premier message de la session qui construit DIASPORALE.COM. Il est conservé ici
> pour la traçabilité. Une session jumelle construit le moteur ANTSIA en parallèle
> (`../ANTSIA/docs/02_LANCEMENT_SESSION_2026-10-14.md`).

```text
Tu construis DIASPORALE.COM : le réseau social fermé de la diaspora gabonaise, application du moteur social
national ANTSIA. Tu travailles dans « Digital GABON/DIGITAL_GOUV/NTSAGUI_DIGITAL/ECOSYSTEMES/DIASPORALE » (dépôt
GitHub PUBLIC administration-ga/diasporale : aucun secret, aucune donnée réelle — surtout aucune donnée
consulaire —, aucun identifiant interne de déploiement n'y entre jamais). Au départ il n'y a aucun code :
seulement les documents.

LIS D'ABORD, EN ENTIER, DANS CET ORDRE
1. CLAUDE.md et README.md du dossier.
2. docs/00_CAHIER_DES_CHARGES_DIASPORALE.md (invariants, acteurs et confiance, le réseau `diasporale`, modules
   M1–M14 et exigences EXF-DG / EXT-DG, parcours R1–R10, lots D0–D4, arbitrages).
3. docs/01_PLAN_IMPLEMENTATION_PROMPTS_DIASPORALE.md (les prompts PD0 → PD10 et le préambule commun §2).
4. ../ANTSIA/docs/00_CAHIER_DES_CHARGES_ANTSIA.md et ../ANTSIA/docs/01_PLAN_IMPLEMENTATION_PROMPTS_ANTSIA.md : le
   moteur dont tu es une application, construit en parallèle par la session « antsia ».
5. ../../../Documentation/RESEAUX_SOCIAUX/00_PLAN_RESEAUX_DANS_LE_RESEAU_DIASPORALE_ANTSIA_2026-10-14.md et ses
   annexes B (front du socle) et C (comptes de consulat.ga : ce qu'on ne copie jamais).
6. ../GABON_DIPLOMATIE/docs/OPPORTUNITES_COMMUNAUTE_DIASPORA.md et DESIGN_SPECS_COMMUNAUTE.md (la spécification
   fonctionnelle et les 33 écrans d'origine).
7. ../PRO_GA/docs/11_PLAN_IMPLEMENTATION_PROMPTS_PRO_GA.md §2 (les dix règles de duplication).

MISSION : implémenter de bout en bout, dans l'ordre, un prompt à la fois, chacun précédé du préambule commun
(docs/01 §2) : PD0 → PD10. Tu ne t'arrêtes pas entre deux prompts pour demander l'accord ; tu t'arrêtes seulement
quand un préalable externe manque (compte, projet, secret, décision juridique) — et alors tu fais tout ce qui n'en
dépend pas et tu dis exactement ce qui manque.

PRIORITÉ : UNE APPLICATION WEB TESTABLE AU PLUS TÔT, SANS ATTENDRE LE MOTEUR. Le moteur n'existe pas encore :
commence par tout ce qui n'en dépend pas, dans cet ordre :
a) packages/diasporale-domain (TS pur : facette diaspora, éligibilité et statuts, parrainage, pays ISO et pays
   ouverts, portée local/diaspora, badges) avec ses tests `bun test` à 100 % des transitions ;
b) la passe de direction artistique `frontend-design` (arbitrage A7 : famille Consulaire/Sable par défaut, squelette
   de l'espace agent) → docs/02_CHARTE_DIASPORALE.md et le fichier de jetons `[data-charte="diasporale"]` ;
c) apps/diasporale_com (Next.js 16, mobile-first, i18n fr/en dès la première chaîne) : vitrine, écrans d'entrée et
   d'onboarding en trois étapes (pays et ville, handle, consentements non précochés), bannière de statut, hub pays,
   fil, profil — branchés sur une interface de données avec un fournisseur FACTICE explicite (données de
   démonstration, jamais réelles), remplacé par le moteur dès qu'il existe. Le propriétaire doit pouvoir ouvrir
   http://localhost:3031 et tester le parcours R1 à blanc ;
d) packages/diasporale-features : CountrySwitch, CountryChip/ScopeBadge, badges de confiance, cartes C1–C17 des specs
   design, ModerationBanner, états vides génératifs ;
e) les deux contrats côté gabon-diplomatie (PD3 DIASPORA-ATTESTATION-V1, PD5 DIASPORA-COMMUNAUTE-V1) : code et tests
   sur des branches de ../GABON_DIPLOMATIE, PR ouvertes EN BROUILLON, jamais fusionnées ni publiées sans l'accord
   écrit du propriétaire et la validation juridique ; côté moteur, un fournisseur d'attestation factice pour le dev.
Dès que la session « antsia » t'annonce PA2 (fondations) puis PA3 (backend) et PA7 (console), enchaîne PD0 (câblage
de l'espace de travail externe), PD1 (tranche diaspora dans le moteur), PD2, PD4, PD5, PD6 (lot D1, pilote France),
puis PD7–PD8 (lot D2). Le mobile (PD9) vient après le web.

SESSION JUMELLE : la session « antsia » construit ../ANTSIA. Tu écris chez elle UNIQUEMENT sous
convex/modules/diaspora/, packages/ui/src/themes/diasporale.css et tes locales ; pour package.json, bun.lock,
convex/schema.ts, convex/convex.config.ts et le catalogue de déploiement, tu lui demandes par message (SendMessage
vers « antsia » ; elle t'écrit vers « diasporale ») et elle applique. Règles de l'arbre partagé dans ANTSIA : aucun
`git add -A`, toujours `git add -- <chemins>` puis `git commit -- <chemins>` ; aucun changement de branche dans
ANTSIA. Dans ton propre dépôt DIASPORALE, tu es seul : branches dédiées + PR + fusion après vérification, ou main
direct pendant le bootstrap, à ton choix, toujours après `verify` vert.

INVARIANTS À NE JAMAIS CONTOURNER : networkId = diasporale partout ; visibilité network par défaut ; adhésion
dérivée vers antsia ; aucune donnée consulaire dans le moteur (consulat.ga atteste : booléen, pays, poste, date) ;
aucun profil créé d'office ; badges calculés côté serveur ; le contact passe par la messagerie ; le citoyen ne paie
jamais ; dix règles de duplication ; UI en français via i18n ; aucune couleur en dur ; Opus pour tout le code, jamais
de sous-agent Sonnet.

ÉTAT D'AVANCEMENT : tiens à jour dans docs/01 un encart « État » (tableau Prompt | Clos le | Commit) et rends compte
au propriétaire en français après chaque étape : livré, vérifié, manquant. Push sur origin (dépôt public) après
chaque vérification verte.

Commence par lire, puis exécute a) → e), puis PD0 dès que le moteur le permet.
```
