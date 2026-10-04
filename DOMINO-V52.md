# Domino Club V52

- Dos de dominos validés : pixels originaux noir / or, quadrillage et fleur de lys. Les tailles, nombres et positions de la main et des autres joueurs sont conservés ; l'œil reste local et ne change pas le jeu partagé.
- BOUDÉÉÉ mécanique validé : cadre fixe, plaque de marbre avec couronne et texte mobile, enfoncement vertical, ombres de profondeur, remontée avec un seul micro-retour. Clic bref environ 320 ms ; appui maintenu jusqu'au relâchement. Souris, tactile, clavier, annulation du geste, désactivation et mouvements réduits.
- Le bouton natif et son unique action de jeu sont conservés. Le contrôleur de présentation n'appelle ni le dépôt, ni Firebase, ni click(), ni l'audio. Le verrou d'action en cours reste inchangé. Le bouton reste masqué hors manche active.
- Lorsque les extrémités de la chaîne portent le même chiffre, choisir un domino légal le joue directement à gauche. Quand les chiffres diffèrent et les deux côtés sont possibles, le choix est conservé.
- Aucune pose automatique du plus gros double : le début de partie et les relances restent strictement inchangés. Moteur, dépôts, timers, protocole V50 de manche suivante et Poker intacts.
- Les boutons Jouer à gauche / droite conservent leur visuel et leurs dimensions actuels.

Les deux images utilisées sont les recadrages sans perte déjà approuvés dans les maquettes, sans nouvelle génération ni redessin des matières.

Validation : tests unitaires, confidentialité de la main, interactions réelles BOUDÉÉÉ et choix des côtés sur une base locale en mémoire, cinq décors, formats bureau/mobile, intégrité des fichiers de règles et régressions du protocole de relance. Aucun test ne modifie une salle réelle.
