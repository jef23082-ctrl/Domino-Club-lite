export const ROOM_STYLES = Object.freeze({
  classic: Object.freeze({ label: 'Classique', scene: './assets/scene/casino-base-v1.png' }),
  luxe: Object.freeze({ label: 'Luxe', scene: './assets/scene/palais-royale-luxe-v12.png' })
});

export function roomStyle(value) {
  return Object.hasOwn(ROOM_STYLES, value) ? value : 'luxe';
}
