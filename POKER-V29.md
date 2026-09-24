# Poker V29 — jeu de cartes premium unifié

- Même cadre et dimensions pour les 52 cartes et les dos : dans chaque emplacement, les figures ne dépendent plus de la taille intrinsèque d'une image SVG complète.
- Trois nouvelles illustrations de cour gravées, ivoire / or / émeraude, déclinées avec les quatre couleurs exactes par le code. Chaque rang et couleur conserve ses indices lisibles.
- Papier ivoire texturé commun, filets dorés fins, ombre de contact et dos émeraude ornementé assorti. Pas de carte complète imbriquée dans une autre carte.
- Les dimensions occupées dans la scène restent pilotées par les mêmes zones. Aucun changement des règles, résultats ou données Domino/Poker.
- Vérification automatique : `npm run test:poker-cards`, 52 faces et dos dans trois emplacements aux formats 1672×941, 2048×927 et 1366×768. Comparaison exacte des dimensions, chargement des images, indices et absence de divulgation de la face cachée. Captures dans `validation/poker-v29/`.
- Les cinq actifs et les prompts de génération intégrée figurent dans `assets/poker-v29/README.md`. Les versions précédentes sont conservées.
