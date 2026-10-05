export const PLAYER_ASSETS = Object.freeze({
  khalil: Object.freeze({
    displayName: 'Khalil',
    seats: Object.freeze({
      top: './assets/players/khalil/khalil-top-scene-v2.png?v=20261005T162819119',
      left: './assets/players/khalil/khalil-left-scene-v2.png?v=20261005T162819119',
      right: './assets/players/khalil/khalil-right-scene-v2.png?v=20261005T162819119'
    })
  }),
  thomas: Object.freeze({
    displayName: 'Thomas',
    seats: Object.freeze({
      top: './assets/players-personalized-v51/thomas/thomas-top-scene-v1.png?v=20261005T162819119',
      left: './assets/players-personalized-v51/thomas/thomas-left-scene-v1.png?v=20261005T162819119',
      right: './assets/players-personalized-v51/thomas/thomas-right-scene-v1.png?v=20261005T162819119'
    })
  }),
  eddy: Object.freeze({
    displayName: 'Eddy',
    seats: Object.freeze({
      top: './assets/players/eddy/eddy-top-scene-v1.png?v=20261005T162819119',
      left: './assets/players/eddy/eddy-left-scene-v1.png?v=20261005T162819119',
      right: './assets/players/eddy/eddy-right-scene-v1.png?v=20261005T162819119'
    })
  }),
  alexis: Object.freeze({
    displayName: 'Aleksi',
    seats: Object.freeze({
      top: './assets/players/alexis/alexis-top-scene-v1.png?v=20261005T162819119',
      left: './assets/players/alexis/alexis-left-scene-v1.png?v=20261005T162819119',
      right: './assets/players/alexis/alexis-right-scene-v1.png?v=20261005T162819119'
    })
  }),
  cedric: Object.freeze({
    displayName: 'Cédric',
    seats: Object.freeze({
      top: './assets/players-personalized-v51/cedric/cedric-top-scene-v1.png?v=20261005T162819119',
      left: './assets/players-personalized-v51/cedric/cedric-left-scene-v1.png?v=20261005T162819119',
      right: './assets/players-personalized-v51/cedric/cedric-right-scene-v1.png?v=20261005T162819119'
    })
  }),
  christopher: Object.freeze({
    displayName: 'Chris',
    seats: Object.freeze({
      top: './assets/players/christopher/christopher-top-scene-v1.png?v=20261005T162819119',
      left: './assets/players/christopher/christopher-left-scene-v1.png?v=20261005T162819119',
      right: './assets/players/christopher/christopher-right-scene-v1.png?v=20261005T162819119'
    })
  }),
  'jean-claude': Object.freeze({
    displayName: 'Jean-Claude',
    seats: Object.freeze({
      top: './assets/players-personalized-v51/jean-claude/jean-claude-top-scene-v1.png?v=20261005T162819119',
      left: './assets/players-personalized-v51/jean-claude/jean-claude-left-scene-v1.png?v=20261005T162819119',
      right: './assets/players-personalized-v51/jean-claude/jean-claude-right-scene-v1.png?v=20261005T162819119'
    })
  }),
  emmanuelle: Object.freeze({
    displayName: 'Emmanuelle',
    seats: Object.freeze({
      top: './assets/players/emmanuelle/emmanuelle-top-scene-v1.png?v=20261005T162819119',
      left: './assets/players/emmanuelle/emmanuelle-left-scene-v1.png?v=20261005T162819119',
      right: './assets/players/emmanuelle/emmanuelle-right-scene-v1.png?v=20261005T162819119'
    })
  }),
  ryad: Object.freeze({
    displayName: 'Ryad',
    seats: Object.freeze({
      top: './assets/players/ryad/ryad-top-scene-v1.png?v=20261005T162819119',
      left: './assets/players/ryad/ryad-left-scene-v1.png?v=20261005T162819119',
      right: './assets/players/ryad/ryad-right-scene-v1.png?v=20261005T162819119'
    })
  }),
  kyllian: Object.freeze({
    displayName: 'Kyllian',
    seats: Object.freeze({
      top: './assets/players/kyllian/kyllian-top-scene-v1.png?v=20261005T162819119',
      left: './assets/players/kyllian/kyllian-left-scene-v1.png?v=20261005T162819119',
      right: './assets/players/kyllian/kyllian-right-scene-v1.png?v=20261005T162819119'
    })
  })
});

export const PLAYER_ORDER = Object.freeze([
  'khalil',
  'thomas',
  'eddy',
  'alexis',
  'cedric',
  'christopher',
  'jean-claude',
  'emmanuelle',
  'ryad',
  'kyllian'
]);

// Kyllian no longer has an active club profile. Keep the historical source
// mapping for old records, but do not package a new Luxe cutout for him.
export const PLAYER_CUTOUT_ORDER = Object.freeze(PLAYER_ORDER.filter(characterId => characterId !== 'kyllian'));
export const PERSONALIZED_PLAYER_ORDER = Object.freeze(['thomas', 'cedric', 'jean-claude']);

export function availableCharactersForSeat(seat) {
  return PLAYER_ORDER.filter(characterId => Boolean(PLAYER_ASSETS[characterId]?.seats?.[seat]));
}

export function hasPlayerAsset(characterId, seat) {
  return Boolean(PLAYER_ASSETS[characterId]?.seats?.[seat]);
}

export function playerAsset(characterId, seat) {
  const character = PLAYER_ASSETS[characterId];
  if (!character?.seats?.[seat]) throw new Error(`Ressource absente pour ${characterId} au siège ${seat}.`);
  return {
    characterId,
    displayName: character.displayName,
    src: character.seats[seat]
  };
}

export function playerCutoutAsset(characterId, seat) {
  const character = PLAYER_ASSETS[characterId];
  if (!PLAYER_CUTOUT_ORDER.includes(characterId) || !character?.seats?.[seat]) throw new Error(`Détourage Luxe absent pour ${characterId} au siège ${seat}.`);
  return {
    characterId,
    displayName: character.displayName,
    src: PERSONALIZED_PLAYER_ORDER.includes(characterId)
      ? `./assets/players-personalized-v51/${characterId}/${characterId}-${seat}-cutout-v1.png?v=20261005T162819119`
      : `./assets/players-cutout-v15/${characterId}/${characterId}-${seat}-local-v1.png?v=20261005T162819119`
  };
}

export function hasPlayerCutout(characterId, seat) {
  return PLAYER_CUTOUT_ORDER.includes(characterId) && Boolean(PLAYER_ASSETS[characterId]?.seats?.[seat]);
}
