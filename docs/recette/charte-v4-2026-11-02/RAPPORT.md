# Charte v4 de DIASPORALE : ce qu'elle changerait — 2 novembre 2026

**Le propriétaire a adopté la v4 le 2 novembre 2026. Elle rejoint `main` sans être publiée : la démo en ligne sert la v3 jusqu'à sa prochaine publication.** Comparatif des écrans : `comparaison-v3-v4.jpg`.

## Où on en est

| Question | Constat |
| --- | --- |
| Que sert `diasporale-demo.vercel.app` ? | **La v3** : 204 jetons égaux sur 210 avec la v3, 99 sur 137 avec la v4 ; IBM Plex (feuilles du déploiement `dpl_AHPTXYChXkVMRYwFtFwHhDVQaaTo`, relues le 2/11) |
| D'où vient la v4 ? | D'une demande du propriétaire du 20/10, écrite en tête de `diasporale.css` : la maquette « ANTSIA — sept thèmes, toutes les pages » devient la charte de DIASPORALE |
| Où est-elle ? | Dans l'arbre local et dans la copie publiée d'ANTSIA, où elle n'a aucun effet visible (`data-charte="diasporale…"`) ; dans aucun `origin/main` |
| Qu'en dit la documentation ? | `docs/03_CHARTE_DIASPORALE.md` et la page `/charte` en restent à la version 3.3 |

Des 46 fichiers DIASPORALE de la copie publiée qui diffèrent d'`origin/main`, la plupart sont de vieilles versions : le clone local a 14 commits de retard. Seuls 6 fichiers portent la charte, et `fonts.css` disparaît.

## Ce qui change à l'écran

| Élément | v3, aujourd'hui | v4 |
| --- | --- | --- |
| Polices | IBM Plex (Sans, Condensed, Mono) | Familjen Grotesk pour les titres, Inter pour le texte, DM Mono pour les codes |
| Boutons | rectangles à filet, angle de 6 px | pilules sans contour |
| Couleurs d'action | une seule, le bleu | **disponibles, mais pas encore visibles** : les boutons existent par famille (voir ci-dessous), aucun composant ne les emploie |
| Angles | 6 et 8 px | un par élément : badge 6, puce 10, page 12, champ 14, média 16, Créer 18, carte 24, barre d'onglets 28 |
| Ombres | sur les cartes | seulement sur ce qui flotte |
| Fonds | papier `#fdfdfb`, cartes sable | identiques |

## Points à regarder

- **Les couleurs par famille ne se voient pas encore.** `Button` propose bleu `#0167a8` pour publier et écrire, sarcelle `#238090` pour suivre, sable doré `#d7ad63` pour réagir et acheter, vert pour valider ; aucun composant ne les emploie, pas même dans l'arbre local. « Se connecter » reste une pilule neutre. Seule la page `/charte` les montre. Les employer est un travail à part.

Relevés sur les captures :

- **Onglet actif moins marqué** : sa pastille se détache moins de son rail (1,09:1 contre 1,26:1). Son texte reste bleu, et le menu actif devient au contraire plus visible.
- **Badge « Vérifié »** : il passe du vert au bleu-gris.
- **Texte plus large** : Inter occupe plus de place qu'IBM Plex. Au téléphone, une publication gagne une ligne et le quatrième onglet est un peu plus coupé ; au bureau, « Évènements à venir » passe sur deux lignes.

## Vérification

| Contrôle | Constat |
| --- | --- |
| Contrastes, `engine-theme-contrast.test.ts` | 360 tests verts sur les deux thèmes et les deux modes : texte ≥ 4,5:1, contours et focus ≥ 3:1 |
| Contrat et isolation des thèmes | verts côté ANTSIA |
| `bun run verify` des deux dépôts | codes 0, charte et page `/charte` corrigées comprises. ANTSIA : moteur 3303, cliquets 150, scripts 92, 12 typages, 12 suites (13 396 tests, 4 ignorés), 11 lints sans erreur. DIASPORALE : 970 et 1415 tests |
| Construction de `diasporale_com` | code 0 ; aucune police ni feuille IBM Plex dans le build, Familjen Grotesk présente |
| Effet sur ANTSIA | aucun à l'écran : ses thèmes ne changent pas |

**Non vérifié** : cinq écrans seulement, sur les données de démonstration et sans moteur ; la messagerie est indisponible dans ce mode ; le thème Gaboma de DIASPORALE n'a pas été capturé ; rien n'a été essayé sur un vrai téléphone.

## Fait à l'adoption

- **Corrigé** : la page `/charte` (version, polices, angles, boutons par famille), `docs/03_CHARTE_DIASPORALE.md`, et le retrait des dépendances `@fontsource` d'IBM Plex.
- **Fusion** : les deux PR ensemble, ANTSIA puis DIASPORALE.
- **Publication** : décision à part. La démo DIASPORALE ne changera qu'à sa prochaine publication.
