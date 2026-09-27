# V31 — Réglages, lisibilité et archives Poker

Le bandeau supérieur droit est horizontal et reste au-dessus du personnage. Il affiche le niveau en cours, les blindes, le compte à rebours numérique et les prochaines blindes. À zéro, « 00:00 » reste visible et le changement est annoncé pour la prochaine main. Les niveaux ne changent jamais au milieu d'une main. À la fin du tournoi, le cadran est figé.

L'ordre circulaire du moteur correspond désormais au placement haut → droite → gauche. Le joueur numéro 1 du classement Domino reste placé en haut s'il participe, sans réordonner le tableau des joueurs d'une partie existante. En tête-à-tête, le bouton porte aussi la petite blinde, conformément aux règles du Hold'em. Les badges D/PB/GB sont agrandis avec un contour jaune scintillant ; les montants des mises sont agrandis.

Avant de lancer le tournoi, l'hôte peut choisir Classique ou Luxe, une durée de niveau entre une et dix minutes, et une réserve initiale de 5 000, 10 000, 20 000, 50 000 ou 100 000 jetons. Ces paramètres sont enregistrés dans la salle et identiques pour tous. Ils sont disponibles dans En ligne et dans l'attente à la table. Les anciennes salles conservent les réglages historiques de 20 000 jetons et cinq minutes. Tout joueur assis peut lancer le tournoi ou la main suivante. Les noms de salons reprennent le prénom et une ville du territoire de l'hôte, comme au Domino.

Le bouton Son ouvre deux volumes indépendants, musique et effets, avec leurs commandes de coupure. Les préférences sont mémorisées sur l'appareil. L'entrée en salle garde la musique désactivée. Un bouton permet d'écouter la nouvelle signature « Tapis », synthétisée localement : impact, résonance ascendante, cascade métallique et accord suspendu, pendant trois secondes. Aucun service ni fichier sonore distant n'est ajouté.

Chaque fin de manche enregistre un résumé public durable : participants, heures, durée, cartes communes réellement distribuées, cartes personnelles explicitement dévoilées, gagnants, combinaisons, pots et jetons remportés. Les mises non suivies remboursées ne sont pas présentées comme des gains. Le résumé ne contient ni paquet ni cartes personnelles non montrées. Une mise à jour ancienne ne peut pas masquer un dévoilement plus récent.

Le gagnant par abandon peut choisir « Montrer mes cartes ». Ses deux cartes s'affichent devant lui, visibles par tous au même format que le tableau. Une courte fenêtre de cinq secondes après le choix empêche un autre joueur d'effacer immédiatement ce dévoilement en lançant la main suivante. Le résultat reste sur la table, sans fenêtre séparée.

Les profils affichent les tournois gagnés, les manches gagnées et les « Tapis Donnés ». Ce dernier compteur inclut uniquement une mise ou relance initiée qui utilise toute la réserve, jamais une blinde ni un tapis suivi. Le classement affiche prestige, tournois gagnés, participations et Tapis Donnés. Les participations et points de prestige restent calculés sur les tournois terminés ; les compteurs de manches utilisent les résumés enregistrés dès chaque fin de main.

L'historique gauche conserve les tournois avec participants, gagnant, date, heure et durée. À droite, les dernières manches personnelles présentent les cartes communes et les cartes montrées, avec des cartes de 64×90 pixels au minimum dans les formats testés. Les listes ont des paginations indépendantes.

L'administration propose la suppression d'une partie Poker, y compris active, après confirmation. Une seule mise à jour retire salle, messages, manches et résultat, puis recalcule les indicateurs. Des marqueurs de suppression empêchent une action tardive ou un ancien client de réinsérer la partie. Aucune branche Domino n'est touchée.

## Compatibilité et limites

Les nouvelles archives et les compteurs de manches/Tapis Donnés démarrent avec les événements réellement enregistrés en V31. Les tournois anciens restent disponibles ; les anciennes mains déjà remplacées et les tapis dont le type n'a pas été conservé ne peuvent pas être reconstitués et ne sont pas inventés.

Le résumé d'historique est public, mais l'architecture existante conserve les cartes de la partie dans la salle partagée. Elle n'est pas une garantie de confidentialité contre un client modifié. Le verrou administrateur est également côté navigateur, pas une autorisation serveur. Aucun abonnement, hébergement supplémentaire, fonction payante ou achat n'est ajouté.

Validation : tests du moteur et des transactions, cinquante combinaisons de réglages, ordre horaire, dévoilement volontaire, archives privées/publiques, compteurs, suppression et refus d'écritures tardives ; vérifications navigateur des réglages, du cadran à trois résolutions, volumes, historique lisible, profils et administration. Le son est rendu hors ligne pour vérifier sa durée et l'absence de saturation. Les scénarios de jeu, tests multi-navigateurs et régressions Domino sont conservés.
