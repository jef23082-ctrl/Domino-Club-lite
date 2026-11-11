export const DOMINO_LOUNGE_TRACKS = Object.freeze([
  { name: 'Musique 1', file: 'musique1.mp3' },
  { name: 'Musique 2', file: 'musique2.mp3' },
  { name: 'Musique 3', file: 'musique3.mp3' },
  { name: 'C Noël', file: 'cnoel.mp3', dominoOnly: true }
]);

export function normalizeDominoTrackIndex(index) {
  return Math.min(DOMINO_LOUNGE_TRACKS.length - 1, Math.max(0, Math.round(Number(index) || 0)));
}
