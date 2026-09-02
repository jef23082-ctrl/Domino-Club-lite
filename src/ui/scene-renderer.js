import { playerAsset } from '../config/player-assets.js?v=20260902T015215899';

export function renderCharacterPlate(seat, characterId) {
  const image = document.querySelector(`#character-${seat}`);
  if (!image) throw new Error(`Calque du siège ${seat} introuvable.`);
  const asset = playerAsset(characterId, seat);
  image.hidden = false;
  if (image.getAttribute('src') !== asset.src) image.src = asset.src;
  const seated = characterId === 'emmanuelle' ? 'assise' : 'assis';
  image.alt = `${asset.displayName} ${seated} au siège ${seat === 'top' ? 'supérieur' : seat === 'left' ? 'gauche' : 'droit'}`;
  image.dataset.characterId = characterId;
}
