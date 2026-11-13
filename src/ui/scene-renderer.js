import { playerAsset, playerCutoutAsset, hasPlayerCutout } from '../config/player-assets.js?v=20261005T162819119';
import { setOptimizedImage } from './image-source.js?v=20261005T162819119';
import { syncPlayerMedallion } from './player-medallion.js?v=20261005T162819119';
import { aleksiPose } from '../config/domino-aleksi.js?v=58-r15';

export function renderCharacterPlate(seat, characterId) {
  const image = document.querySelector(`#character-${seat}`);
  if (!image) throw new Error(`Calque du siège ${seat} introuvable.`);
  const luxe = document.querySelector('#casino-stage')?.dataset.roomStyle === 'luxe';
  // Jean-Claude's personalized side angles extend past the generic scene masks.
  const fullSidePortrait = characterId === 'jean-claude' && seat !== 'top';
  const personalized = characterId === 'alexis';
  const cutout = (luxe || fullSidePortrait || personalized) && hasPlayerCutout(characterId, seat);
  const asset = cutout ? playerCutoutAsset(characterId, seat) : playerAsset(characterId, seat);
  image.hidden = false;
  setOptimizedImage(image, personalized ? aleksiPose(seat) : asset.src);
  const seated = characterId === 'emmanuelle' ? 'assise' : 'assis';
  image.alt = `${asset.displayName} ${seated} au siège ${seat === 'top' ? 'supérieur' : seat === 'left' ? 'gauche' : 'droit'}`;
  image.dataset.characterId = characterId;
  image.dataset.renderMode = cutout ? 'cutout' : luxe ? 'silhouette' : 'scene';
  image.toggleAttribute('data-full-side-portrait', fullSidePortrait && cutout);
  syncPlayerMedallion(image,characterId,seat);
}
