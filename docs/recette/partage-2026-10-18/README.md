# Partage DIASPORALE — recette locale du 18 octobre 2026

Demande : rendre le bouton **Partager** visible et permettre de copier l'adresse d'une publication, sur ordinateur et téléphone.

## Comportement livré dans le source servi

- Le bouton apparaît sur les publications publiées, y compris pour le compte en lecture seule.
- Il ouvre un panneau avec un lien en lecture seule et **Copier le lien**.
- La copie réussie affiche **Lien copié.** ; un échec sélectionne le lien et propose la copie manuelle.
- **Partager dans mon fil** reste conditionné aux droits d'écriture et aux règles de citation existantes.
- Copier l'adresse ne change ni l'audience ni les autorisations du réseau fermé.

## Constats Chrome

Contexte : moteur local, DIASPORALE sur `http://localhost:3031`, compte lecteur `pd4.lecture` déjà connecté. Publication exacte : `/publication/kn795ekrtd65evydvry3973ff58gh306` (texte « test », une vidéo de 14,92 secondes).

| Contrôle | Résultat constaté |
| --- | --- |
| Ordinateur, 1470 px | Bouton visible, panneau ouvert, lien exact, clic Copier le lien suivi de Lien copié. |
| Téléphone émulé, iPhone SE 375 × 667 | Bouton et panneau utilisables ; clic natif Copier le lien suivi de Lien copié. |
| Largeur du document sur téléphone | 375 px, aucun débordement horizontal. |
| Géométrie du panneau téléphone | Gauche 0, largeur 375, haut 407, bas 667. |
| Fermeture du partage par Échap | Panneau fermé, focus revenu à Partager. |
| Vidéo existante sur téléphone | Lecture réelle, progression jusqu'à 2,91 s, pause constatée à 2,93 s. |
| Agrandissement vidéo sur téléphone | Visionneuse ouverte avec Média 1 sur 1, largeur du document 375 px. |
| Fermeture de la visionneuse par Échap | Focus revenu à Agrandir la vidéo ; aucune lecture automatique dans la visionneuse. |

Émulation temporaire désactivée et inspecteur fermé à la fin ; fenêtre de test revenue à 1470 × 779. Aucun envoi, publication, téléversement, changement de session ou modification de données pendant cette recette.

Captures :

- [Ordinateur — partage](ordinateur-partage.jpg)
- [Téléphone — partage et confirmation de copie](telephone-partage.jpg)
- [Téléphone — visionneuse de la vidéo existante](telephone-video.jpg)

## Vérifications ciblées avant le gel commun

- 11 tests du fichier `post-card.test.tsx` réussis, dont FR/EN, lecteur sans droit de publication, copie réussie/refusée, anti-double clic pendant une copie, conservation du focus et règles de citation.
- Typage de `@diasporale/features` réussi après la dernière modification.
- Codegen local via le lanceur officiel du moteur réussi.
- La vérification globale ANTSIA est pilotée séparément sur un inventaire de sources gelé. Son résultat n'est pas présumé ici.

Journaux locaux : `/tmp/partage-diasporale-tests-20261018.log`, `/tmp/partage-diasporale-typecheck-20261018.log`, `/tmp/partage-diasporale-codegen-20261018.log`.

## Limites de preuve

Cette recette valide le partage et, à titre complémentaire, la vidéo exacte ci-dessus. La publication des deux photos sans texte n'a pas été identifiée dans ce moteur local : aucune validation de sa grille ou de sa navigation entre photos n'est revendiquée. Un lien copié sur cette publication permettra de reprendre sa recette sans ambiguïté.
