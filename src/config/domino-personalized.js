import { aleksiPose } from './domino-aleksi.js?v=58-r15';

export function personalizedDominoPose(characterId, seat, kind = 'neutral') {
  if (characterId === 'alexis') return aleksiPose(seat, kind);
  if (characterId === 'ryad') return './assets/players-personalized-v60/ryad/ryad-' + seat + '-' + kind + '.webp';
  if (characterId === 'christopher') return `./assets/players-personalized-v60/christopher/christopher-${seat}-${kind}.webp`;
  return null;
}
