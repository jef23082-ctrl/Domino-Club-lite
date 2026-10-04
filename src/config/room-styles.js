export const ROOM_STYLES = Object.freeze({
  classic: Object.freeze({ label: 'Classique', scene: './assets/scene/casino-base-v1.png', layout: 'classic' }),
  luxe: Object.freeze({ label: 'Luxe', scene: './assets/scene/palais-royale-luxe-v12.png', layout: 'luxe' }),
  'luxe-red': Object.freeze({ label: 'Luxe Red', scene: './assets/scene/domino-luxe-red-v40.png', layout: 'luxe' }),
  newyork: Object.freeze({ label: 'NewYork', scene: './assets/scene/domino-newyork-v40.png', layout: 'luxe' }),
  versailles: Object.freeze({ label: 'Versailles', scene: './assets/scene/domino-versailles-v40.png', layout: 'luxe' }),
  morocco: Object.freeze({ label:'Maroc', scene:'./assets/domino-environments-v55/morocco.png', layout:'luxe', environment:'morocco', originalImage:true }),
  corsica: Object.freeze({ label:'Corse', scene:'./assets/domino-environments-v55/corsica.png', layout:'luxe', environment:'corsica', originalImage:true }),
  'france-1': Object.freeze({ label:'France 1', scene:'./assets/domino-environments-v55/france-1.png', layout:'luxe', environment:'france-1', originalImage:true }),
  'france-2': Object.freeze({ label:'France 2', scene:'./assets/domino-environments-v55/france-2.png', layout:'luxe', environment:'france-2', originalImage:true }),
  algeria: Object.freeze({ label:'Algérie', scene:'./assets/domino-environments-v55/algeria.png', layout:'luxe', environment:'algeria', originalImage:true }),
  'martinique-1': Object.freeze({ label:'Martinique 1', scene:'./assets/domino-environments-v55/martinique-1.png', layout:'luxe', environment:'martinique-1', originalImage:true }),
  'martinique-2': Object.freeze({ label:'Martinique 2', scene:'./assets/domino-environments-v55/martinique-2.png', layout:'luxe', environment:'martinique-2', originalImage:true }),
  guadeloupe: Object.freeze({ label:'Guadeloupe', scene:'./assets/domino-environments-v55/guadeloupe.png', layout:'luxe', environment:'guadeloupe', originalImage:true }),
  bulgaria: Object.freeze({ label:'Bulgarie', scene:'./assets/domino-environments-v55/bulgaria.png', layout:'luxe', environment:'bulgaria', originalImage:true })
});

export function roomStyle(value) {
  return Object.hasOwn(ROOM_STYLES, value) ? value : 'luxe';
}

export function roomLayout(value) {
  return ROOM_STYLES[roomStyle(value)].layout;
}
