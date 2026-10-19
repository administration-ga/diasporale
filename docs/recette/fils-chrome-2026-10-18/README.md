# Comparaison des fils locaux — 18 octobre 2026

## Correction de la session ANTSIA

Le pont de session comparait la chaîne complète rendue par `authClient.getCookie()` avant et après le renouvellement du JWT. Le plugin crossDomain peut renouveler un cookie auxiliaire pendant cette requête, sans changement de personne ni de session. Cette mise à jour normale empêchait alors le POST d'admission.

La comparaison porte maintenant sur le nom et la valeur de l'unique cookie de session signé, extraits par le parseur strict existant `sdkSessionCookie`. Une session remplacée, absente, ambiguë ou passant à un autre nom de cookie demeure refusée. La génération, les délais, le verrou de déconnexion et les preuves Better Auth/Convex côté serveur restent requis.

Sources modifiées dans ANTSIA : `apps/antsia_ga/src/components/session-bridge.tsx` et son test. Aucune modification conservée dans `session-bridge-client.ts`, les paquets d'authentification partagés ou les fichiers d'environnement. Instrumentation temporaire retirée ; aucun cookie ou jeton réel enregistré dans les preuves.

## Vérifications

- Codegen officiel local sous Node 22 : code 0.
- Régression avant correction : le cas du cookie auxiliaire renouvelé échoue ; les cinq autres cas passent.
- Après correction : 24 tests du composant, du client, du serveur, des reçus et de la session SSR passent (cinq fichiers).
- Typage de l'application ANTSIA : code 0.
- Lint des deux fichiers modifiés et contrôle des espaces : code 0.
- Chrome, session locale existante `recette.f3` : `/entrer` rejoint `/fil`, puis un rechargement complet du fil confirme à nouveau la session. Aucun nouvel identifiant/code saisi, aucune déconnexion.
- Capture ANTSIA : [antsia-clair.jpg](antsia-clair.jpg), viewport réel 1470 × 779, apparence « Clair ». Couleurs calculées observées : fond `rgb(255, 255, 255)`, carte `rgb(247, 246, 242)`.
- Capture DIASPORALE après reprise : [diasporale-clair.jpg](diasporale-clair.jpg), viewport réel 1470 × 779, fil connecté de lecture `pd4.lecture`, mode clair ; fond blanc et cartes beige visibles.

Ce contrôle ciblé ne remplace pas une nouvelle vérification globale du moteur. La vérification globale précédente précède ce correctif. Les recettes médias et les fenêtres privées utilisées pour celles-ci restent distinctes.

## Services locaux

Les deux applications sont conservées avec leur limite de mémoire existante de 2 Go. DIASPORALE a redémarré automatiquement lors de la compilation de `/bienvenue` après avoir atteint le seuil mémoire de Next. Le même parent de serveur a repris ; aucune purge ni deuxième serveur n'a été lancé. L'onglet de comparaison DIASPORALE a dû être rechargé à la suite d'une ancienne erreur de chargement de fichier JavaScript.

## Empreintes des sources du correctif

```text
049128b15421e637bd65d8399d2652ecf222b4fcb0e52dedcffacbaf0a1f3859  session-bridge.tsx
166e834308294e4b4dcade4645cb249328176cfd2e37178e4645b62bfcfd196c  session-bridge.test.tsx
```
