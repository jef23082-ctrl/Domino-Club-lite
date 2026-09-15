import { playerAsset, playerCutoutAsset, hasPlayerCutout } from '../config/player-assets.js?v=20260915T095227534';

export function renderCharacterPlate(seat, characterId) {
  const image = document.querySelector(`#character-${seat}`);
  if (!image) throw new Error(`Calque du siège ${seat} introuvable.`);
  const luxe = document.querySelector('#casino-stage')?.dataset.roomStyle === 'luxe';
  const cutout = luxe && hasPlayerCutout(characterId, seat);
  const asset = cutout ? playerCutoutAsset(characterId, seat) : playerAsset(characterId, seat);
  image.hidden = false;
  if (image.getAttribute('src') !== asset.src) image.src = asset.src;
  const seated = characterId === 'emmanuelle' ? 'assise' : 'assis';
  image.alt = `${asset.displayName} ${seated} au siège ${seat === 'top' ? 'supérieur' : seat === 'left' ? 'gauche' : 'droit'}`;
  image.dataset.characterId = characterId;
  image.dataset.renderMode = cutout ? 'cutout' : luxe ? 'silhouette' : 'scene';
}
