# Couleurs par famille dans DIASPORALE — 3 novembre 2026

**La charte v4 se voit maintenant à l'écran : 29 boutons et l'icône de réaction portent la couleur de leur famille. Rien n'est publié.** La démonstration en ligne garde les boutons d'avant tant que le propriétaire n'a pas donné son accord.

Comparatifs avant/après, tous pris sur le serveur local avec le compte fictif Prisca (Mireille pour les suggestions) :

- [`comparaison-relations.jpg`](comparaison-relations.jpg) : profils et page ;
- [`comparaison-actions.jpg`](comparaison-actions.jpg) : fil, réaction, offre d'emploi, service, mission ;
- [`comparaison-telephone.jpg`](comparaison-telephone.jpg) : 390 px ;
- [`comparaison-sombre.jpg`](comparaison-sombre.jpg) : mode sombre.

Couleurs mesurées dans le navigateur (thème Sable, mode clair) :

| Bouton | Avant | Après |
| --- | --- | --- |
| Se connecter (profil), Suivre (page) | bleu `#0167a8` | sarcelle `#238090` |
| Se connecter (suggestion du fil) | gris `#e7e4de` | sarcelle `#238090` |
| Écrire | bleu `#0167a8` | tonal `#cddbe1`, encre `#01619e` |
| Candidater, Demander ce service, M'inscrire, Devenir adhérent | bleu `#0167a8` | sable doré `#d7ad63`, texte `#25211e` |
| Réaction donnée | icône et nombre bleus | icône sable doré, nombre couleur du texte |

« Envoyer » (commentaires) ne change pas de teinte en Sable : l'aplat des messages est le même bleu que l'action principale.

## Les règles suivies

Les correspondances viennent de l'[ADR-0027 d'ANTSIA](https://github.com/administration-ga/antia/blob/main/docs/adr/0027-six-themes-trois-couleurs-et-systeme-epure.md) et de ses écrans, pour que les deux réseaux disent la même chose :

- **Accepter une relation, c'est se relier** : `social`, comme `PeoplePanel` d'ANTSIA. Les autres « Accepter » valident une décision : `success`.
- **Rejoindre un groupe, c'est se relier** : `social`, comme `GroupsPanel` d'ANTSIA.
- **Accepter une proposition de service, c'est commander** : `commerce`, comme `service-request-panels` d'ANTSIA.
- **Écrire est tonal, Envoyer est un aplat.**
- **La réaction est une encre d'icône** : le libellé d'un bouton réagi garde la couleur du texte.

## Un seul bouton plein par zone

Trois zones auraient eu deux boutons pleins côte à côte. La couleur y va au geste principal :

| Zone | Règle | Test |
| --- | --- | --- |
| Profil | « Se connecter » ou « Accepter » est plein ; « Suivre » n'est plein que si aucun de ces deux gestes n'est proposé | `profile-screens.test.tsx` |
| Page, visiteur | « Suivre » est plein ; « Demander un service » reste neutre tant que la page n'est pas suivie, puis prend `commerce` | `page-screen.test.tsx` |
| Page, qui tient un rôle | « Publier » est plein ; « Suivre » reste neutre | `page-screen.test.tsx` |

« Demander un service » de la page ne fait que conduire à la rubrique des services. Le vrai geste, « Demander ce service » sur l'offre, est toujours en `commerce`.

Deux écrans alignent des gestes qui ne coexistent jamais : mentorat (Accepter / Proposer un créneau) et demande de service (Accepter / Faire une proposition / Prestation réalisée). Vérifié en parcourant tous les rôles et statuts de `availableMentoringActions` et `availableServiceRequestActions`.

Le contrôle des billets aligne « Prévisualiser le billet » et, une fois l'aperçu valide, « Confirmer la présence » : le second est dans son propre encart.

## Boutons changés (29)

Chemins relatifs à `apps/diasporale_com/src/`, sauf ceux préfixés `features/` (`packages/diasporale-features/src/`).

| Famille | Bouton | Fichier | Avant |
| --- | --- | --- | --- |
| `social` | Se connecter | `screens/profile-screens.tsx:271` | plein bleu |
| `social` | Accepter (relation) | `screens/profile-screens.tsx:282` | plein bleu |
| `social` | Suivre, selon la zone | `screens/profile-screens.tsx:296` | neutre |
| `social` | Suivre une page, selon la zone | `screens/page-screen.tsx:302` | plein bleu |
| `social` | Accepter (relation) | `components/connection-list.tsx:154` | plein bleu |
| `social` | Rejoindre volontairement le groupe | `components/association-group.tsx:80` | plein bleu |
| `social` | Se connecter (suggestion) | `features/components/suggestions.tsx:77` | neutre |
| `social` | Accepter (notification de relation) | `features/components/notification-bell.tsx:438` | plein bleu |
| `message` | Écrire / Écrire à… | `features/components/community-controls.tsx:35` | plein bleu |
| `message` | Écrire (conversation de contexte) | `components/contextual-conversations.tsx:118` | neutre |
| `message` | Ouvrir la conversation (« Revoir » reste neutre) | `components/contextual-conversations.tsx:93` | neutre |
| `send` | Envoyer (commentaire) | `features/components/comments.tsx:425` | plein bleu |
| `commerce` | M'inscrire à cet événement, Rejoindre la liste d'attente | `components/association-events.tsx:135` | plein bleu |
| `commerce` | Devenir adhérent | `components/association-membership-entry.tsx:180` | plein bleu |
| `commerce` | Envoyer ma demande (adhésion) | `components/association-membership-entry.tsx:206` | plein bleu |
| `commerce` | Candidater | `components/job-apply-entry.tsx:56` et `:76` | plein bleu |
| `commerce` | Envoyer ma candidature | `components/job-apply-entry.tsx:243` | plein bleu |
| `commerce` | M'inscrire (mission) | `components/mutual-aid-mission-detail.tsx:115` | plein bleu |
| `commerce` | Demander un service (page), selon la zone | `components/page-services-section.tsx:187` | plein bleu |
| `commerce` | Demander ce service | `components/service-request-entry.tsx:88` et `:104` | plein bleu |
| `commerce` | Envoyer la demande | `components/service-request-entry.tsx:304` | plein bleu |
| `commerce` | Accepter cette proposition | `screens/service-request-screens.tsx:300` | plein bleu |
| `success` | Confirmer la présence | `components/association-event-attendance.tsx:208` | plein bleu |
| `success` | Accepter (mentorat) | `components/mentoring-requests.tsx:245` | plein bleu |
| `success` | Accepter (invitation à une page) | `components/my-pages-panel.tsx:200` | plein bleu |
| `success` | Accepter (membre d'une association) | `screens/association-screens.tsx:194` | plein bleu |
| `success` | Prestation réalisée | `screens/service-request-screens.tsx:306` | plein bleu |

Hors boutons : `features/components/cards/post-card.tsx:113-118`, l'icône de la réaction donnée prend `text-react-ink`. La variante pleine `react` n'est employée nulle part : la réaction de DIASPORALE est une commande en encre, comme dans le fil d'ANTSIA.

## Laissés tels quels, famille pas claire : à trancher

Ces boutons gardent leur variante d'origine, aucune famille ne leur est attribuée.

| Bouton | Fichier | Variante | Pourquoi |
| --- | --- | --- | --- |
| Demander un mentorat, Envoyer la demande | `components/mentoring-request-form.tsx:82`, `:296`, `screens/mentoring-screens.tsx:280` | plein bleu | Participer (`commerce`) ou se relier (`social`) : les deux se défendent, ANTSIA n'a pas de mentorat |
| Retenir cette réponse | `components/mutual-aid-question-detail.tsx:125` | neutre | Valider (`success`), mais il y en a un par réponse : plusieurs boutons pleins dans le fil |
| Parrainer | `screens/sponsor-attestation-screens.tsx:95` | plein bleu | Attestation engageante, ni relation ni validation au sens de l'ADR |
| Faire une proposition, Modifier, Envoyer | `screens/service-request-screens.tsx:302`, `components/service-proposal-form.tsx:242` | plein bleu | Le geste du prestataire, ce n'est pas lui qui achète |
| Afficher mon billet QR, Renouveler mon billet | `components/association-event-attendance.tsx:122` | plein bleu | Suite d'une participation déjà acquise, sans engagement nouveau |
| Se connecter pour demander ce service | `components/service-request-entry.tsx:95` | plein bleu | Renvoi vers l'authentification, pas un achat |
| Envoyer l'invitation | `components/page-team-panel.tsx:252` | plein bleu | Envoi administratif, pas un message |
| Envoyer le recours | `components/moderation-decisions.tsx:380` | plein bleu | Démarche de modération, pas un message |
| Partager dans mon fil | `features/components/post-share.tsx:90` | tonal d'identité | Publication, déjà à la bonne couleur |
| Appeler | `screens/profile-screens.tsx:349` | neutre | Aucune famille « appel » dans la consigne |

## Le reste, inchangé

Sur 464 boutons d'écran (les 18 de `/charte` les montrent déjà tous) :

- **`primary`, 71 hors cas ci-dessus** : publier, créer, enregistrer, rechercher, s'authentifier. C'est l'action principale, voulue par la charte.
- **`outline`, 181 et `ghost`, 134** : annuler, refuser, décliner, retirer, modifier, gérer, partager, pagination, réessayer.
- **`destructive`, 19 et les bascules vers `destructive`, 8** : supprimer, signaler, retirer.
- **`link`, 6** et **`secondary`, 2**.

La liste complète, bouton par bouton, est dans [`inventaire-boutons.json`](inventaire-boutons.json) (fichier, ligne, composant, variante, libellé).

## Ce qui a été vérifié, ce qui ne l'a pas été

- `bun run verify` de DIASPORALE : vert, 3 084 tests (697 + 970 + 1 417), 0 erreur de lint.
- `bun run verify` d'ANTSIA sur le même candidat : vert, avec ANTSIA à `26741caa` (aucun fichier d'ANTSIA ne change).
- Vus à l'écran, avant et après : profils, page, offre d'emploi, service, mission, suggestion du fil, réaction, commentaires ; au téléphone et en sombre pour le profil, la page et l'offre. Aucun débordement horizontal à 390 px.
- **Non vus à l'écran**, faute d'un compte de démonstration dans le bon état : inscription à un évènement, groupe, deuxième étape des formulaires d'adhésion et de candidature, Accepter (mentorat, invitation, membre, relation), Accepter cette proposition, Prestation réalisée, Confirmer la présence, conversations de contexte. Le typage et les tests les couvrent, pas l'œil.
- **Mode démonstration local** : pris sans moteur. « Écrire » y est désactivé (la messagerie n'y existe pas), donc pâle sur les captures ; avec le moteur, il est actif.
- **Thème** : seul Sable a été regardé. Les contrastes de toutes les chartes restent gardés par `engine-theme-contrast.test.ts`.
