# Domino & Poker Club V51

## Visages validés

Thomas, Cédric et Jean-Claude utilisent les visages approuvés dans les trois positions. Les portraits supérieurs alimentent aussi les avatars du portail et des discussions. Khalil et les autres joueurs ne changent pas.

Les PNG et leurs variantes WebP sans perte sont conservés dans `assets/players-personalized-v51/`. Les images précédentes restent disponibles : cette intégration ne les écrase pas. Les pixels des visages et cheveux viennent des maquettes validées ; les détourages générés servent au masque, pas à remplacer leur identité. Le corps, les sièges et le décor d’origine sont conservés pour éviter des fragments de table incrustés autour des silhouettes. Le pipeline et ses contrôles sont dans `scripts/personalize-portraits-v51.cjs` et `validation/portraits-v51/` (non publiés).

## Annuler une salle

Le profil historique de Khalil (identifiant 3, indépendamment du prénom affiché) peut annuler une salle en attente ou une partie active, Domino comme Poker, sans rejoindre la table ni devenir hôte.

Son action **Annuler la partie** reste affichée dans les deux pages En ligne. Une boîte de confirmation propose les salles annulables, leur créateur et leurs participants. L’état du salon est revérifié au moment de confirmer ; une salle remplacée, terminée ou déjà annulée n’est pas arrêtée par une confirmation périmée.

L’arrêt est transmis par les abonnements Firebase existants. Aucun résultat ni point n’est attribué par une annulation ; les résultats précédents sont conservés. Les droits existants du créateur / hôte sont maintenus. Ce contrôle réutilise l’identification historique du club : il n’ajoute pas Firebase Auth et ne remplace pas des règles de sécurité serveur.

## Bouton œil Domino

Un petit œil doré est placé entre la main et la plaque Boudééé. Un clic affiche le dos des dominos ; le clic suivant révèle exactement les mêmes pièces, dans le même ordre et avec le même nombre.

Ce réglage est local à l’appareil et n’envoie aucune action de jeu. Il reste disponible hors connexion, ne modifie pas les mains des autres joueurs et ne bloque pas les horloges. Les pièces cachées ne peuvent pas être jouées ou déplacées accidentellement ; les commandes sont rétablies après révélation. Une nouvelle manche, un changement de joueur ou la sortie de salle rétablit les faces visibles. Les spectateurs n’ont pas ce bouton.

## Validation

Tests unitaires du moteur, des dépôts de données et des interactions. Contrôles Chrome locaux sur les cinq décors Domino, les décors Poker, les trois sièges, les portraits du portail, les annulations simulées sur plusieurs clients et trois formats d’écran. Aucune salle de production n’est annulée pendant ces essais. Le protocole V50 de manche suivante reste inchangé.

Cette version est préparée localement ; sa préparation ne publie rien sur GitHub.
