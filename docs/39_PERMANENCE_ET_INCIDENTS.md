# Permanence, escalade et procédure d'incident de la modération

> **Statut : PROVISOIRE, à compléter et à valider.** Rédigé le 10/11/2026 (lot MD-06, plan 14 du
> dossier de finalisation, § 5, § 7 et § 8). Le propriétaire a accepté les recommandations du § 7 ;
> il doit encore compléter les rôles et les horaires, et le juriste répondre aux questions Q6 et Q7.
> **Ce document nomme des rôles, jamais une personne ni une coordonnée** : le dépôt est public. Les
> noms, le canal interne et les numéros de l'équipe sont tenus par le propriétaire, **hors du dépôt**.
>
> **La procédure n'a pas été jouée à blanc.** Le critère d'acceptation du lot (« procédure jouée une
> fois à blanc avec un dossier fictif à délai de 24 h ») reste à tenir : il demande des comptes de
> démonstration par acteur sur un backend local et l'accord du propriétaire (§ 8).
>
> À lire avec la charte des modérateurs (`docs/38_CHARTE_DES_MODERATEURS.md`) et les règles de la
> communauté (page publique `/regles-communaute`). Le dossier de mise en production (lot DS-06,
> plan 17) cite ce document.

## 1. Qui modère, et à quelles heures

Recommandation du § 7 (décision 2), acceptée : **deux personnes à l'administration du réseau** (nul
ne juge le recours de sa propre décision) et **trois modérateurs pour la France**, pour tenir les
week-ends.

| Rôle | Nombre recommandé | Ce qu'il tient | Titulaires |
|---|---|---|---|
| Administration du réseau | 2 | recours du premier niveau, composition des équipes, suspensions et exclusions, escalade | à nommer par le propriétaire, hors du dépôt |
| Modérateurs de l'équipe France | 3 | file, voie « Délais légaux », relecture préalable | idem |
| Opérateur de la plateforme ANTSIA | — | console : équipes, recours du second niveau, alerte des délais légaux | idem |
| Éditeur (propriétaire) | — | demandes d'autorité, décisions de principe, relation avec le juriste | — |

**Plages de permanence — à compléter par le propriétaire.** Les délais courent en continu, week-end
et jours fériés compris (§ 2) : chaque plage a un titulaire et un suppléant.

| Plage | Titulaire (rôle) | Suppléant (rôle) |
|---|---|---|
| Semaine, journée | à compléter | à compléter |
| Semaine, soirée | à compléter | à compléter |
| Samedi | à compléter | à compléter |
| Dimanche et jours fériés | à compléter | à compléter |

Fuseau de référence des plages : à fixer par le propriétaire (les membres vivent dans plusieurs
fuseaux ; le guichet affiche les heures dans celui de la personne qui le lit).

**À savoir, tant que MD-01 n'est pas livré** : en production, aucun rôle de réseau ne s'attribue hors
démonstration. Les équipes se composent par la console de l'opérateur, et les recours du premier
niveau n'ont pas de titulaire. Le premier administrateur sera posé par un opérateur (lot MD-01).

## 2. Les délais que le guichet suit, et comment les tenir

Le moteur fixe ces délais à la transmission d'un signalement, selon son motif (ordonnance
n° 0011/PR/2026, lue par l'analyse SU01 du moteur) :

| Motif | Fondement | Décision attendue sous |
|---|---|---|
| Harcèlement ; contenu préjudiciable à un mineur | art. 24 | 72 h |
| Hypertrucage d'une personne sans son accord | art. 33 | 24 h |
| Contenu d'IA interdit ; imitation d'une institution de l'État | art. 32 | 24 h |
| Tout autre motif | aucun délai légal suivi | — |

- Ces dossiers forment la **voie « Délais légaux »**, en tête du guichet, l'échéance la plus proche
  d'abord ; ni le pays ni la nature ne la filtrent. Elle dit « Reste … » ou « En retard de … », à la
  minute, et si l'accusé de réception a été remis.
- Le moteur émet l'**accusé de réception** à la transmission. « Accusé de réception non remis » se
  signale à l'opérateur (§ 4).
- Pour les autres motifs, **aucun délai n'est suivi et rien n'est mesuré**. Le cahier des charges vise
  un traitement sous 48 h : c'est un objectif, pas un engagement, et il n'est pas mesuré (lot MD-11).
- Les contenus en **relecture préalable** (évènements des pages, avis et réponses, ajouts de galerie,
  tant qu'aucune politique n'est posée) ne paraissent qu'une fois approuvés.
- Les délais qui s'imposent hors du Gabon : **à fournir (question Q6 au juriste)**.

**Comment les tenir** — recommandations, à arrêter par le propriétaire :

1. Le plus court délai suivi est de 24 h : une lecture du guichet par jour peut le manquer de peu.
   À chaque prise et à chaque fin de plage, le titulaire lit la voie « Délais légaux » en entier,
   puis la file ordinaire, puis la relecture préalable.
2. Un dossier de la voie qui ne peut pas être tranché dans la plage (doute, mesure lourde, partie au
   dossier) est **passé à la plage suivante de vive voix**, par le canal interne, avec son numéro et
   son échéance ; jamais laissé sans titulaire.
3. Un dossier en retard reste en tête : il se tranche avant tout autre.
4. Le guichet **n'alerte personne** à l'arrivée d'un dossier (lot MD-11, absent) : la tenue des
   délais repose sur les lectures du point 1.

## 3. Qui lit l'alerte de la console

La console de l'opérateur (`admin_antsia_ga`) montre, par réseau, les **échéances légales** des
dossiers encore ouverts ou en examen, la plus proche d'abord, avec leur seul fondement (art. 24, 32
ou 33) : ni dossier, ni cible, ni personne. Ce n'est pas une notification : c'est un écran à
consulter.

- **Qui la lit** : l'opérateur de la plateforme.
- **Quand** : recommandation, à arrêter par le propriétaire : au moins une fois par plage de
  permanence, week-end compris.
- **Ce qu'il fait d'une échéance proche ou dépassée** : il prévient l'administration du réseau par le
  canal interne ; il ne tranche pas le dossier à la place de l'équipe.

## 4. Quand saisir l'opérateur de la plateforme

- Recours du **second niveau** (la décision du réseau est contestée une seconde fois).
- **Accusé de réception non remis**, guichet inaccessible, dossier qui ne quitte pas la file après
  une décision, refus inexpliqué du moteur.
- Créer une équipe, y ajouter ou retirer un membre, tant que MD-01 n'est pas livré.
- Toute mesure ou demande qui dépasse DIASPORALE : une suspension ou une exclusion vaut dans tout
  ANTSIA ; un **profil** signalé est traité par la modération d'ANTSIA (réseau racine).
- Toute **demande d'une autorité** (§ 5.3), en parallèle de l'éditeur.

## 5. Situations particulières

### 5.1 Une menace

Une menace de violence se signale avec le motif « Violence ou menace », **sans délai légal suivi** :
la procédure la traite pourtant en priorité.

1. Le modérateur de permanence ouvre le dossier dès qu'il le voit, sans attendre la fin de la file.
2. Il retire le contenu s'il enfreint la règle « Respect et harcèlement ».
3. Si une mesure contre la personne s'impose au-delà d'une mise en sourdine, il saisit
   l'administration du réseau, qui décide de la suspension (charte, § 2).
4. Le moteur informe le déclarant de l'effet sur le contenu ; le modérateur ne le contacte pas
   autrement : il n'a pas ses coordonnées et ne doit pas les chercher.
5. La consigne d'urgence de la feuille de signalement renvoie la personne en danger aux secours du
   pays où elle se trouve : DIASPORALE n'alerte aucun service de secours.
6. Signaler la menace à une autorité, et qui le fait : **à fournir (question Q7 au juriste)**.
7. Compte rendu (§ 6).

### 5.2 Un contenu impliquant un mineur

Motif « Contenu préjudiciable à un mineur » : **art. 24, décision sous 72 h**.

1. Traiter en tête de la voie, quel que soit le temps restant.
2. Ne **jamais** copier, capturer, télécharger ni transférer le contenu, même pour l'escalader : le
   lire au guichet seulement.
3. Retirer le contenu ; saisir l'administration du réseau pour toute mesure contre la personne.
4. Ne pas contacter le mineur ni sa famille.
5. Prévenir l'éditeur par le canal interne, sans le contenu.
6. Signalement aux autorités, conservation éventuelle du contenu malgré l'effacement : **à fournir
   (questions Q7 et Q5 au juriste)** ; rien n'est conservé hors du moteur en attendant.
7. Compte rendu (§ 6).

### 5.3 Une demande d'une autorité

Réquisition de données, demande de retrait, demande d'identification.

1. Le modérateur **ne répond pas** et ne transmet rien : il remet la demande à l'éditeur et prévient
   l'opérateur.
2. L'éditeur vérifie la qualité de l'autorité et la forme de la demande avec le juriste.
3. Aucune donnée ne sort par un autre chemin que l'export prévu par le moteur, sur décision de
   l'éditeur.
4. Quelle autorité peut requérir quoi, et ce qu'il faut conserver sans contredire l'effacement :
   **à fournir (question Q7 au juriste)**. Le point de contact des autorités dans les textes légaux
   est le lot MD-20.
5. Compte rendu (§ 6), sans la teneur des données transmises.

### 5.4 Un délai légal de 24 h

Hypertrucage d'une personne qui le signale, contenu d'IA interdit, imitation d'une institution de
l'État : la voie les montre avec une échéance de 24 h. Le titulaire de la plage les tranche avant
toute autre tâche ; s'il ne peut pas, il les passe de vive voix au suppléant (§ 2, point 2).

## 6. Modèle de compte rendu

À remplir pour toute situation du § 5, pour tout dossier tranché en retard et pour toute escalade
vers l'opérateur. Il se conserve **hors du dépôt**, avec la charte signée. **Aucun nom, aucune
coordonnée, aucune copie du contenu.**

```text
Compte rendu d'incident de modération — DIASPORALE

Date et heure (avec le fuseau) :
Rédigé par (rôle) :
Numéro de dossier (tel que le guichet l'affiche) :
Nature de la cible :                       Pays de la cible :
Motif du signalement :                     Fondement et échéance légale : (ou « aucun »)
Ouverture du dossier :                     Lu au guichet le :
Situation : menace / mineur / demande d'autorité / délai de 24 h / retard / autre
Décision : classé / retrait / avertissement / sourdine (durée) / suspension (durée) / exclusion
Règle de la communauté citée :
Décidé par (rôle) :                        Dans le délai : oui / non
Escalade : administration du réseau / opérateur / éditeur — à quelle heure
Suites : recours, autorité saisie, autre
Ce qui a manqué (outil, personne, information) :
```

## 7. Ce qui attend encore

- **Propriétaire** : nommer les titulaires et suppléants hors du dépôt ; compléter les plages et le
  fuseau ; arrêter les recommandations des § 2 et § 3 ; fixer le canal interne ; donner son accord
  pour l'exercice à blanc.
- **Juriste** : Q6 (délais hors du Gabon), Q7 (autorités, conservation, signalement d'une menace ou
  d'un contenu impliquant un mineur), Q5 (âge, pour les contenus impliquant un mineur).
- **Code** : MD-01 (rôles du réseau en production), MD-09 (mesures lourdes réservées), MD-11 (alerte
  de l'équipe et mesure des délais tenus), MD-15 (fermeture d'urgence d'une rubrique ou d'un pays).
- **Exercice à blanc** : non joué ici. À jouer sur backend local, avec les comptes de démonstration
  par acteur (docs/34), un dossier fictif à délai de 24 h, la lecture de l'alerte de la console et
  un compte rendu rempli.
