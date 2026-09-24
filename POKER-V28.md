# Poker and Domino V28

- The stuck live Poker table `7EJA7` was marked cancelled in Firebase without deleting history or another room.
- Bet step controls use true flex centering for both minus and plus.
- Three independent transparent chip sprites represent low (up to 2,500), medium (up to 12,000), and high bankrolls. The central pot uses the same amount-based selection.
- Illustrated J/Q/K assets are now the complete card element; there is no second card frame around them.
- Poker ranking is active from the first completed tournament. Every member has a rank immediately; points, wins and games remain the tie-breakers.
- Domino round celebration still lasts ten seconds, then enables the existing control in place. The regression test now clicks it and verifies that round 2 actually starts.

Asset provenance and exact built-in generation prompts are documented in `assets/poker-v27/README.md`. No paid external image service was used.
