# Distribution spéciale Domino — V32

Dans **Domino → Admin**, après déverrouillage, cinq clics sur le numéro de version activent le réglage partagé. La version devient verte. Cinq autres clics le désactivent et rétablissent la couleur dorée. Quitter Admin efface les clics d’une séquence incomplète. Le clavier Entrée/Espace fonctionne aussi.

Le réglage est conservé dans `online_domino_v1/settings/deal`, sans nouveau service. Il est lu au lancement d’une partie, à la manche suivante et à la revanche. Il ne redistribue jamais une main déjà commencée.

- Mode activé : Khalil reçoit exactement cinq de ses sept dominos avec un chiffre commun choisi aléatoirement de 0 à 6 aux manches 1, 3, 5… ; les deux autres dominos ne portent pas ce chiffre.
- Manches 2, 4, 6… : mélange habituel.
- Mode désactivé ou Khalil absent : mélange habituel sur toutes les manches.
- Une revanche recommence l’alternance à la manche 1.
- Les 28 dominos restent uniques : trois mains de sept et sept dominos non distribués. Le gagnant conserve son droit d’ouvrir la manche suivante.
- Aucun changement au poker ou aux manches physiques.

Tous les appareils qui distribuent doivent utiliser V32 ou une version ultérieure : les anciennes versions ne connaissent pas ce réglage. Le verrou Admin reste le garde-fou client existant, pas une nouvelle autorisation Firebase côté serveur. Ce mode favorise Khalil ; les résultats restent enregistrés normalement et peuvent donc modifier le classement.

Validation : tests du moteur et des transactions en base mémoire, activation/désactivation et couleurs dans un navigateur isolé, sans modification des salles réelles.
