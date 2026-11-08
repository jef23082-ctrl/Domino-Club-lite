# V58 — Christmas Edition Domino

Base exacte : commit V57 `9e2df2eb4ca6c94c5bba8fc8709d3267d3f16fe4`, protégé par le tag `v57`.
Préparation isolée sur la branche `v58-noel`. Aucun déploiement effectué.

## Périmètre

Décoration des six pages Domino (Accueil, En ligne, Classement, Profils, Historique, Admin), navigation, sapin et lumières chaudes. Décoration activée exclusivement pour `data-mode="domino"`.

Tables sélectionnées, identifiants vérifiés dans `room-styles.js` et `domino-environments.js` :

| Table | Joueur par défaut | Asset V57 conservé |
|---|---|---|
| Maroc | Khalil | `assets/domino-environments-v55/morocco.png` |
| Corse | Thomas | `assets/domino-environments-v55/corsica.png` |
| France 1 | Christopher | `assets/domino-environments-v55/france-1.png` |
| Bulgarie | Aleksi | `assets/domino-environments-v55/bulgaria.png` |
| Algérie | Ryad | `assets/domino-environments-v55/algeria.png` |
| Martinique 1 | Eddy | `assets/domino-environments-v55/martinique-1.png` |
| Guadeloupe | Cédric | `assets/domino-environments-v55/guadeloupe.png` |

Les originaux mesurent 1586 × 992. Le rendu Luxe V57 utilise une scène plein écran et des coordonnées proportionnelles ; les PNG restent strictement identiques. Chaque décor possède une configuration de sapin et de guirlandes. Les ornements sont derrière les joueurs et les commandes, avec `pointer-events:none`. Le bonnet est enfant de la tête 3D, le manteau du corps, les poignets des mains. Le plateau et les dominos du cochon conservent leur matière d'origine.

France 2, Martinique 2 et tous les autres styles sont exclus. Les sources, styles, images, sons et fonctionnalités Poker sont conservés. Les règles, données Firebase, tours, scores, timers, chat et mécanique BOUDÉÉÉ sont inchangés. Seuls les identifiants de cache de la chaîne de chargement du cochon changent dans les modules existants.

## Audio à fournir

Deux options désactivées sont préparées dans le sélecteur Domino existant, explicitement indiquées « fichier à fournir ». Le lecteur et les trois pistes existantes ne changent pas ; aucun lecteur supplémentaire.

Fichiers attendus sous `assets/christmas/v58/domino/audio/` :

- `noel-lounge.mp3` : piano, cordes, clochettes discrètes, avec autorisation d'utilisation.
- `noel-jazz-club.mp3` : piano, contrebasse, batterie douce, avec autorisation d'utilisation.

Fournir également la licence ou la confirmation des droits. Les options seront activées et reliées au lecteur lors de la réception de ces fichiers. Aucun enregistrement commercial téléchargé.

## Restaurer exactement la V57

Depuis ce checkout propre, une commande restaure le code et tous les assets V57 :

```powershell
git switch --detach v57
```

Pour revenir à Noël : `git switch v58-noel`. Le tag `v58-noel` désigne également le commit saisonnier validé. Ces opérations concernent les fichiers ; la publication GitHub Pages reste une opération distincte. Aucun historique de joueurs n'est restauré ou effacé.

## Assets et validation

Deux éléments transparents créés avec l'outil Imagegen intégré, réutilisés pour limiter le quota : `assets/christmas/v58/domino/tree/tree.png` et `assets/christmas/v58/domino/garlands/garland.png`. Prompts : sapin photoréaliste isolé avec ornements rouge/or, cadeaux et lumières champagne ; guirlande photoréaliste isolée de sapin, baies, pommes de pin, boules rouge/or, nœud de velours et légère neige. Aucun décor original régénéré.

Contrôles navigateur sur données mémoire isolées : navigation des six pages, absence de décoration Poker, sept tables activées et deux variantes exclues, géométrie comparée à V57, trois tailles d'écran (1672×941, 1024×768, 390×844), variation réelle de l'opacité des lumières et arrêt en mouvement réduit. Aucun accès aux parties réelles pour les tests.
