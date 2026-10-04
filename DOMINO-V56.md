# V56 — fond des listes Style de salle / Temps par tour

Correction uniquement visuelle des deux sélecteurs de la salle d'attente Domino. Les listes ouvertes reprennent le matériau noir texturé d'origine des plaques, extrait par neuf-slice CSS du même atlas et des mêmes coordonnées (288, 229, 96, 54) que le moteur d'habillage existant. Texte jaune et gras, contour doré et repère du choix actuel.

Les véritables éléments `select` et leurs options sont conservés. Aucun changement des événements, des droits de l'hôte, des transactions Firebase, de la distribution, des tours, des timers, des tables ni du Poker. Le CSS est limité aux deux contrôles dans la page En ligne Domino. Une hauteur maximale défilable évite de couper les quatorze styles.

Les navigateurs qui prennent en charge `appearance: base-select` affichent le fond texturé dans leur picker natif personnalisable. Les autres gardent le sélecteur natif et un repli noir/jaune selon les possibilités du système, sans bibliothèque ou nouveau contrôle JavaScript.

Vérifications : ouverture des deux listes dans le navigateur, fond texturé contrôlé visuellement, sélection souris de Corse et de 30 secondes réellement enregistrée dans la base de test mémoire ; activation clavier de Bulgarie ; Échap referme la liste sans modifier la valeur. Tests de non-régression vérifiant que les modules de salle, règles Domino et application Poker sont identiques à V55. Aucun changement de données Firebase réelles pour cette correction.
