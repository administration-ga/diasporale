# Recette du 22/10/2026 — délais légaux dans le bureau de modération (SU01d du moteur)

DIASPORALE servi par le moteur : backend local isolé d'un candidat composé depuis `main` (ANTSIA et DIASPORALE), réseau `diasporale` semé par sa graine, comptes de démonstration, avec les trois variables déjà posées sur ce backend (aucune nouvelle). Toutes les données sont fictives. Le suivi complet est dans `EXECUTION.md` de l'étude « sept univers » d'ANTSIA.

| Capture | Ce qu'elle montre |
|---|---|
| `1-voie-et-file-ordinaire-1280.jpg` | `/moderation` de Ruth ALLOGHO : « Délais légaux » en tête (harcèlement : « Art. 24 : décision notifiée sous 72 h », « Reste 71 h 58 min », échéance, accusé de réception), puis la file ordinaire, qui ne montre que le dossier « Autre motif » et dit que les dossiers à délai légal n'y sont pas repris |
| `2-feuille-du-dossier-1280.jpg` | le dossier ouvert depuis la voie : la feuille rappelle son délai légal au-dessus de l'aperçu |
| `3-decision-voie-vide-1280.jpg` | après le retrait : « Décision enregistrée : le dossier a quitté la file. » dans la voie, qui dit « Aucun dossier à délai légal en attente. » ; la file ordinaire est inchangée |
| `4-art32-24h-1280.jpg` | un second signalement (contenu d'IA interdit) : « Art. 32 : contenu d'IA interdit, retrait sous 24 h », « Reste 23 h 59 min » |
| `5-voie-390.jpg` | à 390 px, la même voie sans défilement horizontal (`scrollWidth` 390) |
| `6-demonstration-1280.jpg` | la démonstration (fournisseur fictif, port à part) : l'hypertrucage fictif (art. 33, 24 h) avant les trois harcèlements fictifs (art. 24, 72 h) |

Parcours :
1. Patrice MBOUMBA (membre vérifié) publie deux textes fictifs dans le hub France.
2. Sandrine ONDO (membre parrainée) signale le premier pour harcèlement, le second pour « Autre motif ».
3. Ruth ALLOGHO (modératrice) ouvre `/moderation` : le harcèlement est dans « Délais légaux », l'autre dossier seul dans la file ordinaire.
4. Elle ouvre le dossier depuis la voie et retire le contenu : le message d'issue prend le focus dans la voie, qui se vide.
5. Hervé MOUBAMBA (membre déclaré) signale le second texte pour contenu d'IA interdit : le nouveau dossier entre dans la voie avec son délai de 24 h, tandis que le dossier « Autre motif » reste dans la file ordinaire.
6. Sans rechargement, le chronomètre passe de « Reste 23 h 59 min » à « Reste 23 h 58 min » (une seule entrée de navigation).

Échéances lues : 25/10/2026 à 10:07 pour un harcèlement transmis le 22/10 à 11:07 (72 h, passage à l'heure d'hiver compris), 23/10/2026 à 11:11 pour le contenu d'IA interdit transmis le 22/10 à 11:11.

Console : des 401 pendant les changements de compte, déjà relevés à la recette précédente ; aucune erreur de l'application.
