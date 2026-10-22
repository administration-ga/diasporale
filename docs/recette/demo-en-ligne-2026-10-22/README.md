# Recette en ligne du 22/10/2026 — DIASPORALE sur la démonstration (ADR-0038 du moteur)

Site : https://diasporale-demo.vercel.app (projet Vercel `diasporale-demo`), branché sur le backend de démonstration du moteur (`vivid-hedgehog-655`) : front `fcde290`, moteur `4feeea0`. Publication faite avec l'accord écrit du propriétaire ; le détail des étapes est dans `docs/35` d'ANTSIA, le suivi dans `EXECUTION.md` de l'étude « sept univers ». Toutes les données sont fictives, et chaque compte de démonstration est partagé par tous les visiteurs.

| Capture | Ce qu'elle montre |
|---|---|
| `0-entree-panneau-1280.jpg` | `/entrer` : le panneau « Comptes de démonstration — Démonstration et développement local seulement » |
| `1-voie-ruth-1280.jpg` | `/moderation` de Ruth ALLOGHO : « Délais légaux » en tête ; « Motif : Harcèlement », « Art. 24 : décision notifiée sous 72 h », « Reste 71 h 59 min », « Échéance : 25 oct. 2026, 12:17 », « Accusé de réception envoyé le 22 oct. 2026, 13:17 » |
| `2-voie-390.jpg` | à 390 px, le bloc du délai et la file des dossiers, sans défilement horizontal |
| `3-file-ordinaire-390.jpg` | à 390 px, la file ordinaire : « Aucun autre dossier ouvert — Les dossiers en attente ont tous un délai légal : ils sont présentés plus haut. » |

Parcours :
1. Patrice MBOUMBA (membre vérifié) entre par son code à usage unique, lu à l'écran, et publie un texte fictif dans le hub France.
2. Sandrine ONDO (membre parrainée) le signale pour harcèlement.
3. Ruth ALLOGHO (modératrice) ouvre `/moderation` : le dossier est sous « Délais légaux », la file ordinaire est vide.

L'échéance tombe à 12:17 et non à 13:17 : l'heure d'hiver commence dans la nuit du 24 au 25 octobre, et les 72 h sont comptées en temps réel.

Le dossier est laissé ouvert, pour que la voie se voie en entrant comme Ruth. Sans décision, il passera « en retard » après le 25 oct. 2026 à 12:17.

Console du navigateur : un 401 au changement de compte, déjà relevé aux recettes précédentes.
