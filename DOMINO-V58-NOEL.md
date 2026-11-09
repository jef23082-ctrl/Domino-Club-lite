# V58 — Christmas Edition Domino

Révision 6 : ajout de 12 ampoules sur chacune des deux guirlandes encadrant le joueur du haut. Ces 24 nouvelles ampoules vertes, rouges et blanches suivent les branches, hors du portrait et de la plaque du joueur. Elles réutilisent le même réglage et les mêmes circuits que les guirlandes inférieures. Aucun changement de disposition, de gameplay ou de Poker.

Révision 5 : ajout de 24 ampoules vertes, rouges et blanches réparties sur les guirlandes inférieures des sept tables. Elles partagent les six circuits et le choix local « Clignotantes / Fixes / Automatique » des sapins, désormais nommé « Guirlandes de Noël ». Les ampoules sont placées sur les branches du pourtour, dans une couche non interactive derrière les commandes. Aucun fond, élément de jeu ou fichier Poker modifié.

Révision 4 : blocage reproduit lorsque `prefers-reduced-motion: reduce` active les règles `animation:none!important` de l'interface et du thème. Le poste de travail signale également `MinAnimate=0`. Le mode automatique conserve cette préférence ; une option locale explicite « Clignotantes » active uniquement les circuits du sapin, avec une règle prioritaire strictement limitée à ces circuits. Les réglages Windows et les animations de Poker ne sont pas modifiés. Le lien `?treeLights=blink` active ce choix et le sauvegarde localement. Le sélecteur « Guirlandes du sapin » dans le panneau musical permet de revenir à « Fixes » ou « Automatique ». Test navigateur effectué avec mouvement réduit activé avant le chargement : état automatique fixe, activation explicite, opacité variant réellement de 0,05 à 1 sur les pages et la table, persistance après rechargement et bascule manuelle contrôlée.

Révision 3 : les guirlandes des sapins utilisent désormais 12 ampoules vertes, 12 rouges et 12 blanches, avec des halos colorés visibles et six circuits décalés. Chaque circuit alterne un plateau allumé et un plateau presque éteint, à un rythme lent (2,1 à 4,25 secondes). Les autres guirlandes restent dorées. Le mode mouvement réduit conserve les trois couleurs en éclairage fixe. Aucun nouvel asset ni changement du jeu ou de Poker.

## Révision 2 — décors enrichis du 9 novembre 2026

La première V58 reste conservée dans le tag `v58-noel`. Cette révision utilise les références originales comme cibles : guirlandes photoréalistes continues suivant le rebord supérieur et l'avant de la table, neige sur les branches, grands nœuds de velours, baies, pommes de pin et cadeaux. Chaque panneau reçoit deux coins décorés ; une guirlande et un nœud habillent la navigation. Les positions des contenus et commandes sont conservées.

Le nouveau sapin comporte un éclairage photographique chaud et six circuits d'animation indépendants (36 ampoules et halos locaux), avec durées et décalages différents. Les animations s'arrêtent en mode mouvement réduit. Les décors ne reçoivent aucun zoom ni déplacement global.

Le clic sur le nez du cochon des sept tables de Noël joue `assets/christmas/v58/domino/audio/nose-christmas-r2.wav` : un carillon original de 2,6 secondes généré localement. Le lecteur existant du groin, le volume et le mute des effets sont réutilisés. La source originale est restaurée à la fin du son ou à la sortie de la table. Aucun nouveau lecteur ni changement de l'audio Poker. Le bonnet suit la tête et réagit légèrement au clic. Le carillon est un effet court, pas l'une des deux musiques de fond encore à fournir.

Nouveaux assets produits avec l'outil Imagegen intégré, sauvegardés avec les originaux PNG et des versions WebP d'affichage : `tables/perimeter-r2`, `tree/tree-r2`, `ui/corner-r2`, `ui/gifts-r2`. Prompts : extraire les ornements du pourtour de la référence table en conservant une zone centrale transparente ; reproduire le sapin fortement éclairé de la référence des pages ; reproduire le coin de sapin avec baies et flocon doré ; reproduire les cadeaux rouges et dorés isolés. Les fonds géographiques V57 restent identiques, aucun fond Poker n'est modifié.

Les validations supplémentaires contrôlent un vrai clic sur le nez, la lecture effective du fichier, la restauration de la source, le respect du volume et du mute, l'absence d'action de jeu, le scintillement réel et les coordonnées des éléments de jeu. Les scénarios utilisent exclusivement des données mémoire isolées.

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
