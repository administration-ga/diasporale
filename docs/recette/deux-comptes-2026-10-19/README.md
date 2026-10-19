# Recettes à deux comptes — 19 octobre 2026 (backend local)

Demande du propriétaire : jouer à deux comptes, sur le backend local, le coiffeur à Paris, les
conversations CC-V, les deux photos DG-002, l'entraide, le mentorat, la candidature et le guichet.

## Contexte

| Élément | Valeur |
|---|---|
| Application | `diasporale.com` en source moteur (`dev:engine`), `http://localhost:3031`, panneau navigateur 395 × 785 (mise en page téléphone) |
| Moteur | Déploiement Convex local anonyme `:3210`, arbre ANTSIA `16bbc0a` (branche `codex/pa4-identite-session`) ; DIASPORALE `9b5c9b3` puis branche `claude/recettes-deux-comptes` |
| Outils de développement | `ANTSIA_DEV_TOOLS=true` posé sur le seul déploiement local anonyme, sur accord du propriétaire, pour lire les codes de connexion locaux (`devTools.latestOtp`) ; aucun code n'est consigné ici |
| Comptes fictifs | Brice OBIANG (`brice.recette`, administrateur de la page « Salon OBIANG Coiffure (recette) ») ; Clara MOUSSAVOU (`clara.recette`, rendue « vérifiée » par l'attestation consulaire fictive de la graine locale `diaspora/seed:verifyForRecette`, un compte léger ne pouvant pas demander de prestation) |
| Passage d'un compte à l'autre | « Se déconnecter partout » puis connexion par code (une seule fenêtre) |

## Résultats

| Recette | Verdict | Constats |
|---|---|---|
| Coiffeur à Paris | Jouée jusqu'à la prestation réalisée ; avis : voir plus bas | Demande « Tresses africaines (recette) » de Clara à 17:37 ; proposition v1 de Brice à 17:41 (45,00 €, 60 min, 18:00–19:00, Paris 11e approximatif, à accepter avant 17:57) ; accord de Clara à 17:43 (« Rendez-vous confirmé ») ; à 18:00:27, sans rechargement, « Prestation réalisée » et « Constater une absence » apparaissent et « Annuler le rendez-vous » disparaît ; Brice constate la prestation à 18:00 (« Prestation constatée »). L'avis ne s'ouvre qu'après la fin du rendez-vous (19:00), conformément à DG-016 |
| DG-002, deux photos | **Validée** | Publication de Clara (`/publication/kn7ce88je1mbpx5afb8d1vbxh98gkzqc`), deux JPEG 1200 × 900 de 22 512 et 23 971 octets avec texte alternatif ; moteur : `published`, `visibility: network`, deux médias. Lecteur Brice : deux images servies (HTTP 200, `image/jpeg`, octets identiques à l'envoi, décodées en 1200 × 900) ; visionneuse « Média 1 sur 2 » → flèche droite → « Média 2 sur 2 » (suivant désactivé) → flèche gauche → « Média 1 sur 2 » ; Échap ferme et rend le focus à « Agrandir la photo 1 sur 2 » |
| Entraide, question | **Validée** après correctif | /entraide plantait (« Maximum update depth exceeded », voir correctifs). Question de Brice (Logement, Paris) ; réponse de Clara ; Brice la retient : question « Résolue », geste « Ne plus retenir » offert ; avis « Une réponse a été publiée à votre question » chez Brice, « Votre réponse a été retenue » chez Clara, lien vers la question |
| Entraide, mission bénévole | **Validée** | Brice crée la page d'association « Entraide Paris Recette (association fictive) » puis la mission « Accueil des nouveaux arrivants (recette) » (26/10 10:00, Paris 18e, 5 places). Clara : inscription refusée sans consentement (« Cochez la case… »), acceptée ensuite (« 1 sur 5 places prises », « Me retirer ») ; Brice voit Clara dans la liste des bénévoles réservée à l'équipe et reçoit « Une personne s'est inscrite à une mission de votre page » |
| Mentorat | **Validé** | Brice devient mentor (Logement, Démarches, français) ; Clara le trouve dans « Mentors : France » et demande un mentorat (objectif, message, consentement) ; Brice accepte (« Demande acceptée. ») ; « Mentorat en cours » des deux côtés ; avis dans les deux cloches |
| Candidature | **Validée** | Offre « Coiffeur ou coiffeuse afro (recette, offre fictive) » publiée par le salon (refus « Choisissez au moins une langue » tant qu'aucune langue n'est cochée) ; candidature de Clara avec consentement ; Brice la présélectionne ; Clara lit « Présélectionnée » dans « Mes candidatures » ; avis dans les deux cloches |
| CC-V, conversations de mise en relation | **Bloquée en local** (par conception) | Les entrées « Écrire » sont présentes sur la demande de service avant la fin, le mentorat en cours et la candidature présélectionnée, des deux côtés. L'ouverture est refusée par le moteur (`CONTEXT_CLOSED`) : la politique contextuelle de DIASPORALE est fermée et ne s'ouvre que par `contextualMessaging/operator.setPolicy`, geste d'opérateur (console, preuve de session IDN) ; la table `operators` est vide en local. Message corrigé, voir correctifs |
| Guichet de modération | **Partielle** (traitement bloqué en local) | Signalement par Clara de la question d'entraide (nature `diasporaAidQuestion`, motif « Autre ») : « Signalement envoyé : le contenu est masqué pour vous » et la fiche devient indisponible pour elle ; dossier `reports` ouvert, niveau `network`, sans équipe. /moderation refuse l'accès à un membre sans habilitation. Aucun compte n'a de rôle de modération dans DIASPORALE : les équipes se créent par la console opérateur ou par un `network_admin` (`moderation/cases.createTeam`), rôle que personne ne détient en local |

## Correctifs apportés pendant la recette

1. **/entraide plantait** dès l'ouverture : l'adaptateur moteur de l'entraide
   (`apps/diasporale_com/src/data/engine-mutual-aid.ts`) rendait un objet `Loadable` neuf à chaque
   rendu ; le paginateur des listes (`ServicePager`) compare cette référence et bouclait
   (« Maximum update depth exceeded »). La projection est maintenant mémorisée, comme dans les
   adaptateurs des emplois, du kit et du mentorat. Test ajouté : chaque lecture garde son objet
   d'un rendu à l'autre, refus compris (il échoue sans le correctif).
2. **« Écrire » disait « Une erreur est survenue. Réessayez dans un instant »** alors que le moteur
   refuse par une règle fermée. Les trois refus explicites d'ouverture (`CONTEXT_NOT_OPEN`,
   `CONTEXT_CLOSED`, `CONTEXT_UNAVAILABLE`, contrat CONVERSATION-CONTEXTUELLE-V1 §5.3) ont désormais
   leurs codes fermés (`context_not_open`, `context_closed`, `context_unavailable`) et leurs phrases
   en français et en anglais. Constaté à l'écran après correctif : « La conversation de cette mise
   en relation est fermée pour le moment. »

## Remarques mineures (non corrigées)

- Élision avec un nom inséré : « l'équipe de Entraide Paris Recette… » (consentement d'inscription
  à une mission) ; même gabarit ailleurs.
- « Page créée : vous en êtes l'administrateur. » : formulation au masculin.
- Apostrophes mêlées dans la cloche (« s’est » typographique, « l'équipe » droite).
- En développement, le repère « N » de Next.js recouvre le coin inférieur gauche (bouton
  « Média précédent », bouton de la feuille de candidature) ; sans effet en production.
- `engine-associations.ts` garde le même `settle` non mémorisé que l'entraide avant correctif ;
  ses écrans paginent à la main, sans comparer la référence : sans effet aujourd'hui, à mémoriser
  si une de ses listes passe un jour par `ServicePager`.

## Données fictives créées dans le backend local

Demande de service `zx7c7sv83ch3agqb55ffy0wr818gkea8` ; publication
`kn7ce88je1mbpx5afb8d1vbxh98gkzqc` ; question `n97s7by5m9fkzwwsh93v41k4058gj53n` (signalée) ;
page `entraide-paris-recette-association-fictive` et mission `n57q2cj93tkhcd9vzbskkt79s58gjjcb` ;
profil de mentor `q57yc9q3xt3rgzm3ftfyhfbnpd8gje8g` et un mentorat en cours ; offre
`ph7jj1wd5bhezczsgsh10t3em58gjc70` et une candidature présélectionnée ; un signalement ouvert.
Rien n'a été supprimé.

## Limites de preuve

- Les deux photos ont été jointes par programme : le panneau de navigation n'ouvre pas de
  sélecteur de fichiers ; deux images synthétiques ont été posées sur le champ de fichiers du
  composeur (`DataTransfer`), puis l'envoi, le stockage et la lecture ont suivi le vrai parcours.
- Aucune capture n'est jointe : le panneau de navigation ne dépose pas ses captures sur disque.
  Les constats ci-dessus ont été relus dans la page (texte, états ARIA) et en base.
- Parcours joués en mise en page téléphone (395 px). En 1280 px, six écrans relus sans débordement
  horizontal (mentorat, mes candidatures, offre, mission, publication à deux photos en deux tuiles
  de 318 × 318, entraide) ; l'offre ne propose plus « Candidater » après la candidature. Parcours
  complets non rejoués sur ordinateur.
- CC-V et le traitement au guichet restent à jouer avec une politique ouverte et une équipe de
  modération de DIASPORALE, qui relèvent d'un opérateur.
