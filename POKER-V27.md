# Poker V27

- Dedicated Luxe Poker background, preserving the reference table perspective. Domino scenes and assets are unchanged.
- Three photoreal transparent chip reserves selected from the actual bankroll, complete illustrated court cards without a nested-card frame, single central suit for numeral cards, beveled gold plaques and controls.
- No title, subtitle, crown or BOUDÉÉÉ overlay inside the Poker room. The active player retains the red animated border. No turn timer.
- Poker home, lobby, ranking, profiles, history and administration use the club's emerald-and-gold visual language.
- Host can cancel a waiting or active tournament from the room menu or lobby; an unlocked administrator can cancel it from administration. Confirmation is required. No prestige is awarded, and other tournaments and Domino records remain unchanged.
- RTDB empty-collection normalization fixes Parole and subsequent streets in rooms created by previous versions.
- Poker ranking is active from the first completed tournament.

Validation: 157 unit tests passed. Browser workflow verified at 1672×941 and 2048×933: six pages, Luxe and Classic, full call/check hand through showdown, next hand, cancellation, and return to Domino. Browser tests use isolated in-memory data and explicitly remove empty collections to reproduce Firebase serialization. No production game was modified for testing.

The existing browser-driven Poker architecture remains unchanged: it is not an anti-cheat server-authoritative implementation.

Artwork sources and generation prompts: [assets/poker-v27/README.md](assets/poker-v27/README.md).
