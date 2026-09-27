# V30 — Poker et reprise des manches Domino

Les mises apparaissent devant chaque joueur, avec leur montant exact et des piles composées selon les dénominations 5 000, 1 000, 100 et 1. Les plaques indiquent le bouton D, la petite blinde PB et la grosse blinde GB. Le cadran supérieur droit affiche le niveau, les blindes actuelles, le temps restant et les prochaines blindes. Un niveau arrivé à échéance s'applique à la prochaine main.

Les cartes personnelles sont face cachée. Maintenir le clic, le toucher ou la touche Espace/Entrée les révèle ; relâcher, perdre le focus ou masquer l'onglet les referme. Une mise à jour de présence ne coupe pas un appui en cours.

Lorsque plus personne ne peut miser, les cartes des joueurs encore en jeu se révèlent. Le flop, la turn et la rivière sortent à deux secondes d'intervalle, avec une transition partagée par les transactions Firebase. Le résultat reste sur la table : cartes personnelles au format du tableau, meilleures cartes éclairées, nom du gagnant, combinaison et détail des pots annexes. Les mises non suivies sont restituées et un jeton impair revient au premier gagnant à gauche du bouton.

Si tous les adversaires se couchent, le gagnant dispose de cinq secondes pour montrer ses cartes. Après son choix ou à l'expiration, tout joueur assis peut lancer la main suivante. Tout joueur assis peut aussi démarrer une table complète. Les commandes portent l'identité de la main et sa révision : des clics concurrents ne distribuent pas deux mains et ne posent pas deux cartes.

Des sons locaux distincts accompagnent suivre, parole, relancer, tapis, coucher, changement de joueur, flop, turn, rivière, dévoilement et victoire. Ils respectent le volume et la coupure des effets du club et n'utilisent aucun service payant.

Pour Domino, le cadre du compteur reste immobile ; seule sa face interne pulse en orange ou rouge. La fin de manche enregistre une échéance commune de dix secondes. Tous les clients utilisent l'horloge Firebase pour déverrouiller le bouton. Une seconde commande concurrente retrouve la manche déjà lancée sans redistribuer.

Validation : tests des règles et des transactions, déroulement réel dans le navigateur, comparaison de 43 scènes, vérification des 52 cartes et du dos à trois résolutions, ainsi que trois joueurs et un spectateur avec le SDK Firebase sur une branche QA isolée. Les données QA sont supprimées à la fin du test et exclues de la version distribuée.

Le fonctionnement reste gratuit avec l'architecture existante. Les transactions sont exécutées par les navigateurs ; la confidentialité vis-à-vis d'un client modifié et l'arbitrage lorsqu'aucun joueur n'est connecté nécessiteraient une autorité serveur. Cette version n'ajoute aucun hébergement ni abonnement.
