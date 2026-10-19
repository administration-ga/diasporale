# Présentation des associations et entreprises

18 octobre 2026 — **implémentation dans les sources ; vérifications différées sur instruction du propriétaire**.

## Parcours

Les fiches d’associations et d’entreprises disposent d’une rubrique « À propos »
avec leur présentation, leur pays, leur ville et leur type d’association ou
secteur d’activité. Une information absente est indiquée comme non renseignée.
La présentation des autres natures de page conserve son emplacement existant.

La ville et la classification sont facultatives à la création. La gestion de
l’identité permet ensuite à un administrateur vivant de les modifier ou de
les effacer. Un type d’association ne peut qualifier une entreprise, ni un
secteur une association. Lors d’un changement de nature dans le formulaire de
création, la classification de l’autre nature n’est pas envoyée.

La ville personnelle du responsable n’est pas recopiée d’office. La ville de
l’organisation garde sa casse et ses accents, tient sur une ligne et reste
limitée à 120 caractères. Le champ n’est ni une adresse ni un moyen de contact ;
les coordonnées évidentes sont refusées par la règle partagée.

La fiche propose un accès à la modification pour un administrateur autorisé,
si le fournisseur annonce la prise en charge de cette présentation. Les
anciens fournisseurs gardent les formulaires précédents. Les cartes des
annuaires et des hubs reprennent les métadonnées délivrées, sans en inventer.

## Contrat et persistance

- Le domaine pur `@antsia/social-domain/pagePresentation` centralise la borne
  de ville, sa normalisation et les listes de types/secteurs. Les constantes
  publiques DIASPORALE existantes restent des alias de ces listes.
- La table `pages` et son historique d’identité reçoivent trois champs
  optionnels : `city`, `associationType` et `sector`. Aucun index ni table
  supplémentaire n’est créé.
- Les mutations de création et d’identité réutilisent les droits, la limitation
  de débit et la modération des pages. En modification, seuls les champs
  fournis changent ; `null` efface. Les valeurs précédentes des champs modifiés
  rejoignent l’historique existant, sans changer la confiance ou l’adresse de page.
- Les fiches, résumés d’annuaire et cartes de hub reçoivent une projection
  allowlistée et compatible. La carte minimale des en-têtes sociaux n’est
  pas élargie. Aucune donnée de personne ni coordonnée privée n’y est ajoutée.
- `PageManagement.supportsPresentation` active les champs de formulaire. Les
  entrées et projections sont étendues de manière facultative ; les anciens
  appels d’identité conservent les métadonnées qu’ils ne fournissent pas.
- La démonstration utilise sa surcouche de gestion existante, y compris pour
  les nouvelles pages. Les valeurs effacées ne réapparaissent pas depuis la
  graine et la projection de lecture n’est pas sérialisée dans l’état brut.

Les textes d’interface vivent dans le fragment français/anglais
`page-presentation`. Les labels des catégories sont ceux déjà utilisés dans
les cartes. Les quatre refus ajoutés ont des codes fermés et des traductions
dans l’interface et le catalogue des règles du moteur.

## Périmètre et preuve

Les ajouts génériques du moteur ont été annoncés au coordinateur ANTSIA.
Les publications et épingles, services et demandes, groupes et événements
associatifs sont conservés. Aucun import externe, changement d’environnement,
configuration de production ou nouvelle règle de diffusion.

Aucun test, typage, lint, codegen, build, appel HTTP ou parcours navigateur
lancé. Aucun commit applicatif, push ou déploiement. L’affichage exécuté et les
parcours restent à constater lors de la reprise des vérifications ; les
résultats historiques ne valident pas ces nouvelles sources.
