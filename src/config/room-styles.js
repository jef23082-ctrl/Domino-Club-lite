export const ROOM_STYLES = Object.freeze({
  classic: Object.freeze({ label: 'Classique', scene: './assets/scene/casino-base-v1.png', layout: 'classic' }),
  luxe: Object.freeze({ label: 'Luxe', scene: './assets/scene/palais-royale-luxe-v12.png', layout: 'luxe' }),
  'luxe-red': Object.freeze({ label: 'Luxe Red', scene: './assets/scene/domino-luxe-red-v40.png', layout: 'luxe' }),
  newyork: Object.freeze({ label: 'NewYork', scene: './assets/scene/domino-newyork-v40.png', layout: 'luxe' }),
  versailles: Object.freeze({ label: 'Versailles', scene: './assets/scene/domino-versailles-v40.png', layout: 'luxe' })
});

export function roomStyle(value) {
  return Object.hasOwn(ROOM_STYLES, value) ? value : 'luxe';
}

export function roomLayout(value) {
  return ROOM_STYLES[roomStyle(value)].layout;
}
