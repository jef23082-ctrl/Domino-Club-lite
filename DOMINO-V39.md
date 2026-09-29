# Domino V39 — Portail émeraude et or

Les six pages Domino (Accueil, En ligne, Classement, Profils, Historique et Admin) utilisent le fond fourni et les textures, coutures, cadres, ornements, lauriers et boutons de la maquette Domino.

Les images sources sont conservées intégralement dans `assets/menus`. Le rendu utilise des régions SVG et des bordures segmentées pour garder les coins et les coutures à leur taille naturelle. La typographie est harmonisée en Times New Roman, avec des proportions rapprochées de la référence.

Le gabarit de l'accueil et de la navigation est partagé avec Poker. Les intitulés, données, actions et règles Domino sont conservés, notamment les commandes du club physique. Les fenêtres d'action héritent du même habillage. Les tables de jeu, transactions et moteurs de partie ne sont pas modifiés.

## Vérifications

- 190 tests unitaires réussis.
- Contrôles des six pages Domino dans trois formats : 1672 × 941, 1366 × 768 et 844 × 390.
- Contrôle géométrique de l'accueil et de la navigation Domino/Poker : différences inférieures à un pixel.
- Vérification du changement de profil, des filtres du classement, de la sélection dans une fenêtre de nouvelle partie et de l'administration déverrouillée sur données locales de test.
- Contrôle des six pages Poker et du retour entre les deux modes, sans erreur JavaScript.

Ces contrôles ne créent pas de partie et ne modifient pas les données du club. La publication GitHub reste une opération séparée.
