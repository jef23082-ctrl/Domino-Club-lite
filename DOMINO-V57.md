# V57 — Connexion et commandes Domino fiables

## Causes traitées

- Une erreur de publication à la reconnexion était ignorée après la première connexion réussie. Le heartbeat pouvait ensuite recréer une présence sans l'identité du joueur.
- Les commandes de création, entrée et lancement dépendaient de transactions SDK sans délai applicatif. Un cache initial incomplet pouvait refuser un lancement pourtant valide, ou une file de reconnexion pouvait laisser un bouton bloqué.
- Le jeton d'un second onglet du même profil remplaçait celui de l'hôte et supprimait ses droits dans le premier onglet.
- La préparation du chat transactionnait toute la racine des données en ligne, en concurrence avec les écritures des salles et de présence.

## Correctifs

- Publication complète et versionnée de la présence à la connexion, à la reconnexion et à chaque heartbeat. États visibles, reprise avec délai progressif et nettoyage des écouteurs/timers.
- Préparation du chat limitée à ses métadonnées, hors des salles. Nettoyage uniquement des identifiants de messages anciens observés, sans effacer un nouveau message concurrent.
- Commandes Domino fondées sur une lecture HTTP fraîche et une écriture conditionnelle ETag. Limite de 6 secondes par requête, 18 secondes par opération ; une absence de confirmation ne signifie jamais que l'action a échoué.
- Identifiants de demande et reçus de confirmation (64 derniers par salle). Une réponse perdue est vérifiée avant de répéter une écriture. Le code de création et l'identifiant de lancement restent en sessionStorage en cas d'incertitude, y compris après rechargement.
- Double clic de création/lancement/entrée regroupé. État serveur confirmé affiché sans attendre le cache WebSocket. Un snapshot ancien ne remplace pas une confirmation plus récente.
- Hôte, créateur et place identifiés par le profil stable, avec compatibilité des salles existantes. Deux onglets du même profil conservent la même place ; les commandes restent revérifiées atomiquement. Un autre profil ne gagne aucun droit d'hôte.
- Abonnement à la salle installé avant la mise à jour de présence. Une présence en cours de reprise n'empêche plus de voir une salle déjà rejointe.
- Action de jeu retardée contrôlée contre la partie, la manche et le tour attendus, en plus des règles existantes.

## Préservé

Moteur Domino, distribution, scores, règles, durée des tours, géométrie, décors, portraits et moteur Poker inchangés. Aucun classement réinitialisé, aucune salle réelle annulée ou supprimée pour cette correction.

## Validation et déploiement

Tests locaux : transport HTTP simulé (ETag, cache SDK périmé, réponses perdues, timeout, conflit et refus), données mémoire et interface réelle. Aucune écriture de test dans Firebase de production.

Après publication, tous les joueurs devront recharger le site pour utiliser V57. Les anciennes versions ouvertes gardent leur ancien code de reconnexion ; la correction ne peut pas le remplacer dans un onglet déjà chargé.

Une panne réseau réelle reste possible : V57 rend les opérations bornées, visibles, vérifiables et réessayables. La validation réelle avec plusieurs appareils reste nécessaire après accord de publication.
