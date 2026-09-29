import { ROOM_STYLES } from '../config/room-styles.js?v=20260929T190638113';

// Poker scene choices are independent of the Domino room-style setting. The
// three bespoke Poker scenes share the same seat and card layout.
export const POKER_TABLE_STYLES = Object.freeze({
  luxe: Object.freeze({ label: 'Luxe', scene: './assets/poker-v27/room.png', layout: 'luxe' }),
  classic: Object.freeze({ label: 'Classique', scene: ROOM_STYLES.classic.scene, layout: 'classic' }),
  yatch: Object.freeze({ label: 'Yatch', scene: './assets/poker-v37/yatch.png', layout: 'luxe' }),
  newyork: Object.freeze({ label: 'NewYork', scene: './assets/poker-v37/newyork.png', layout: 'luxe' })
});

export const isPokerTableStyle = value => Object.hasOwn(POKER_TABLE_STYLES, value);
export const pokerTableStyle = value => isPokerTableStyle(value) ? value : 'luxe';
