# Fils DIASPORALE et ANTSIA au format téléphone — 18 octobre 2026

Contrôle actuel dans Chrome, profil habituel, sur les deux fils connectés locaux. Simulation iPhone SE, viewport CSS **375 × 667**, dans une fenêtre normale dédiée. Aucun réglage global du viewport et aucune fenêtre privée modifiés.

| Application | Fond calculé | Carte calculée | Largeur de page | Résultat visuel |
| --- | --- | --- | --- | --- |
| DIASPORALE | `rgb(253, 253, 251)` / `#fdfdfb` | `rgb(241, 239, 235)` / `#f1efeb` | 375 px pour 375 px de viewport | Fond blanc cassé, cartes beige |
| ANTSIA | `rgb(255, 255, 255)` / `#ffffff` | `rgb(247, 246, 242)` / `#f7f6f2` | 375 px pour 375 px de viewport | Fond blanc, cartes beige |

La surface des cartes est portée par le parent de l'élément `article`, celui-ci étant transparent. Les valeurs ci-dessus sont celles du parent rendu, pas seulement celles des jetons. Aucun débordement horizontal du document observé ; les barres de navigation peuvent défiler à l'intérieur de leur propre zone.

## Captures

- [DIASPORALE — haut du fil](diasporale-375x667-haut.jpg).
- [DIASPORALE — cartes après défilement](diasporale-375x667-cartes.jpg).
- [ANTSIA — fil et carte](antsia-375x667-cartes.jpg).

Les captures ont 375 pixels de large. La vue ANTSIA fait 375 × 667 pixels ; la vue DIASPORALE après défilement fait 375 × 623 pixels, son cadrage étant réduit par la barre d'information de Chrome. Le viewport CSS mesuré reste 375 × 667 dans les deux applications. DIASPORALE est consultée avec le compte de lecture `pd4.lecture` (adhésion en attente, publication désactivée) ; son avis de statut a été écarté pour dégager la vue. ANTSIA utilise la session existante `recette.f3`, sans nouvelle saisie d'identifiant ou de code et sans erreur de session pendant ce contrôle.

La capture ANTSIA à 500 px, transmise plus tôt par son propriétaire, a été inspectée séparément. Le verdict ci-dessus repose sur la nouvelle observation directe des deux applications à 375 px, avec mesure des styles et de la largeur du document.

## Fin de contrôle

Émulation désactivée, zoom automatique et emplacement initial de l'inspecteur rétablis, inspecteur fermé. Aucun fichier applicatif, cookie, droit ou session supprimé ou modifié volontairement. Aucun test de compilation relancé pour ce contrôle visuel.

Cette vérification confirme la hiérarchie des surfaces en simulation de téléphone. Elle ne constitue pas une recette sur appareil physique ni une nouvelle validation des médias présents dans le fil.
