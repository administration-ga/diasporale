# Photos et vidéo — correction du composeur

18 octobre 2026. Diagnostic et correctif coordonnés avec ANTSIA, dans les sources
réellement servies sur localhost:3031. Les deux applications locales et leurs
sessions sont conservées.

## Défaut reproduit

Pendant que `publish` attendait sa réponse, le formulaire restait modifiable.
Une personne pouvait choisir des photos après le départ d'une publication de
texte : `uploadMedia` était appelé et les aperçus apparaissaient, mais le contenu
déjà envoyé ne contenait aucun média. Le succès effaçait ensuite ces nouveaux
fichiers du composeur.

Le test de régression échoue avant correction : un événement de sélection tardif
appelle réellement `uploadMedia`. Ce scénario est établi ; son lien avec les
deux anciens posts sans média reste **non établi**. Aucune capture n'est jointe
aux messages du 18 octobre qui annoncent une capture.

## Correction

`composer.tsx` prend un verrou synchrone avant la validation asynchrone, ignore
une deuxième soumission et les événements de fichiers tardifs, puis libère le
verrou dans `finally`. Un fieldset désactive les contrôles tant que la validation
ou la publication est en cours ; les valeurs React Hook Form sont conservées et
le formulaire annonce son état occupé. Les gardes serveur et les contrats de
médias sont inchangés.

`composer.test.tsx` monte le vrai composeur, avec des réponses de transport
contrôlées. Il vérifie les deux dépôts terminant dans le désordre, l'ordre et les
descriptions transmis, la fermeture/réouverture, le dépôt refusé sans repli en
texte seul, le fichier tardif et le double envoi bloqués, la vidéo seule, la
reprise après refus avec les mêmes dépôts et la même clé, et le déverrouillage
après une validation refusée.

## Limite des preuves

`bun run verify` officiel, session 53670, termine avec code 0 : **7 186 tests**
(6 919 Vitest et 267 Bun), dix typages et dix jobs de tests d'espaces de travail,
neuf lints sans erreur. Les 94 avertissements préexistants restent visibles.
Les sept nouveaux cas du composeur sont inclus dans les 398 tests du paquet
DIASPORALE features.

Les inventaires avant/après couvrent 1 581 fichiers de sources et configuration,
sans aucune différence. SHA256 du JSON compact :
`a85d56b7e759a20422e290a2439b7d784e123580b2b4ffbddcbc88b3e91f439a`.
Journal : `/tmp/antsia-diasporale-media-verify-20261018.log` ; résumé : même
préfixe suivi de `-summary.json`. Inventaires :
`/tmp/antsia-diasporale-media-20261018-source-before.json` et `-after.json`.

Ces tests ne prouvent ni le dépôt réel des nouveaux fichiers dans Chrome, ni
leur relecture après rechargement, ni la lecture native d'une vidéo. La recette
réelle doit conserver les identifiants exacts des posts, confirmer leur nombre
de médias et leur délivrance, puis éprouver la galerie et la lecture vidéo.
Le compte de lecture en attente ne doit être ni promu ni déconnecté pour cela.
