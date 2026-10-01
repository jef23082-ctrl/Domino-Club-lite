# V50 — nouveau protocole de manche suivante Domino

La relance ne dépend plus d'une promesse attachée au bouton, du délai visuel de dix secondes, de l'hôte, d'un jeton d'onglet ou d'une publication dans une branche Firebase séparée.

## Fonctionnement

1. Le clic enregistre immédiatement l'intention dans le navigateur, avec l'identité précise du match, de la manche et du résultat.
2. Une écriture conditionnelle HTTP enregistre la commande dans `rooms/<code>/roundTransition`. Elle ne change ni les scores ni la main terminée.
3. Tout joueur de cette salle utilisant V50 peut reprendre cette commande. Une autre écriture conditionnelle distribue une seule nouvelle main et enregistre son reçu dans la même opération atomique.
4. Seule l'observation de la nouvelle manche confirmée par Firebase termine la demande. Une réponse perdue est réconciliée par une lecture serveur, pas par une distribution aveugle.

Le contrôleur est indépendant du rendu. Les notifications de salle ne remplacent plus le contrôle d'un même résultat ; son gestionnaire est permanent sur la couche de résultat. Le bouton de manche suivante ne passe jamais en `disabled`, même pendant une requête lente. Un statut explique l'attente, le refus du serveur ou la reprise automatique.

Une demande locale survit à un rechargement/une fermeture. Une demande déjà enregistrée dans la salle peut être exécutée par un autre joueur, sans nouveau clic. Les appels HTTP sont bornés et annulables ; les nouvelles tentatives ne continuent que tant qu'une demande reste en attente. Les clics simultanés et les réponses tardives sont idempotents.

Le délai de dix secondes ne bloque aucune manche suivante. La cérémonie de fin de partie/revanche reste distincte. Spectateurs exclus ; autorisations existantes conservées. Aucun changement au Poker, aux statistiques, aux historiques, aux classements ou à la distribution aléatoire.

## Validation

- 222 tests unitaires, dont commandes persistantes, accusés de réception, réponse perdue, rechargement, réseau suspendu, ancien résultat, refus 403 et stockage refusé.
- Interface complète : 21 relances consécutives, clavier, notification entre appui et relâchement, reprise après rechargement, SDK hors ligne et bouton cliquable pendant une requête bloquée.
- Firebase réel : trois navigateurs, huit relances concurrentes, un SDK explicitement hors ligne ; puis fermeture de l'émetteur après enregistrement et reprise par un pair sans clic supplémentaire.
- Copie de la salle signalée : chacun des trois profils lance la manche suivante, avec contrôle de l'accessibilité du bouton à sept tailles d'écran.

Les tests Firebase utilisent seulement une salle QA isolée, ensuite supprimée. Les salles des joueurs ne sont pas réinitialisées.

## Limites et mise en service

Le défaut de remplacement du bouton a été reproduit dans V49. Faute de capture/diagnostic du navigateur d'un joueur avant son départ, il n'est pas établi qu'il expliquait à lui seul l'incident réel. Cette version remplace donc l'ensemble du mécanisme UI/relai concerné, au lieu d'annoncer une certitude sur une cause non confirmée.

Firebase valide les écritures atomiques ; le moteur reste exécuté par les navigateurs, conformément à l'architecture du site. Il ne s'agit pas d'un nouveau serveur de calcul. Une absence totale d'accès réseau ne peut pas lancer une manche : la demande attend la reconnexion, sans bloquer définitivement le bouton.

Tous les joueurs doivent charger V50 après sa publication. Une page V49 déjà ouverte ne devient pas V50 toute seule. L'ancien canal est lu pour compatibilité, mais V50 n'y écrit plus ses nouvelles demandes. La validation au travail, sur le réseau qui a montré le problème, reste à effectuer après mise en service.
