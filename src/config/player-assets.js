export const PLAYER_ASSETS = Object.freeze({
  khalil: Object.freeze({
    displayName: 'Khalil',
    seats: Object.freeze({
      top: './assets/players/khalil/khalil-top-scene-v2.png?v=20260902T015215899',
      left: './assets/players/khalil/khalil-left-scene-v2.png?v=20260902T015215899',
      right: './assets/players/khalil/khalil-right-scene-v2.png?v=20260902T015215899'
    })
  }),
  thomas: Object.freeze({
    displayName: 'Thomas',
    seats: Object.freeze({
      top: './assets/players/thomas/thomas-top-scene-v1.png?v=20260902T015215899',
      left: './assets/players/thomas/thomas-left-scene-v1.png?v=20260902T015215899',
      right: './assets/players/thomas/thomas-right-scene-v1.png?v=20260902T015215899'
    })
  }),
  eddy: Object.freeze({
    displayName: 'Eddy',
    seats: Object.freeze({
      top: './assets/players/eddy/eddy-top-scene-v1.png?v=20260902T015215899',
      left: './assets/players/eddy/eddy-left-scene-v1.png?v=20260902T015215899',
      right: './assets/players/eddy/eddy-right-scene-v1.png?v=20260902T015215899'
    })
  }),
  alexis: Object.freeze({
    displayName: 'Alexis',
    seats: Object.freeze({
      top: './assets/players/alexis/alexis-top-scene-v1.png?v=20260902T015215899',
      left: './assets/players/alexis/alexis-left-scene-v1.png?v=20260902T015215899',
      right: './assets/players/alexis/alexis-right-scene-v1.png?v=20260902T015215899'
    })
  }),
  cedric: Object.freeze({
    displayName: 'Cédric',
    seats: Object.freeze({
      top: './assets/players/cedric/cedric-top-scene-v1.png?v=20260902T015215899',
      left: './assets/players/cedric/cedric-left-scene-v1.png?v=20260902T015215899',
      right: './assets/players/cedric/cedric-right-scene-v1.png?v=20260902T015215899'
    })
  }),
  christopher: Object.freeze({
    displayName: 'Cris',
    seats: Object.freeze({
      top: './assets/players/christopher/christopher-top-scene-v1.png?v=20260902T015215899',
      left: './assets/players/christopher/christopher-left-scene-v1.png?v=20260902T015215899',
      right: './assets/players/christopher/christopher-right-scene-v1.png?v=20260902T015215899'
    })
  }),
  'jean-claude': Object.freeze({
    displayName: 'Jean-Claude',
    seats: Object.freeze({
      top: './assets/players/jean-claude/jean-claude-top-scene-v1.png?v=20260902T015215899',
      left: './assets/players/jean-claude/jean-claude-left-scene-v1.png?v=20260902T015215899',
      right: './assets/players/jean-claude/jean-claude-right-scene-v1.png?v=20260902T015215899'
    })
  }),
  emmanuelle: Object.freeze({
    displayName: 'Emmanuelle',
    seats: Object.freeze({
      top: './assets/players/emmanuelle/emmanuelle-top-scene-v1.png?v=20260902T015215899',
      left: './assets/players/emmanuelle/emmanuelle-left-scene-v1.png?v=20260902T015215899',
      right: './assets/players/emmanuelle/emmanuelle-right-scene-v1.png?v=20260902T015215899'
    })
  }),
  ryad: Object.freeze({
    displayName: 'Ryad',
    seats: Object.freeze({
      top: './assets/players/ryad/ryad-top-scene-v1.png?v=20260902T015215899',
      left: './assets/players/ryad/ryad-left-scene-v1.png?v=20260902T015215899',
      right: './assets/players/ryad/ryad-right-scene-v1.png?v=20260902T015215899'
    })
  }),
  kyllian: Object.freeze({
    displayName: 'Kyllian',
    seats: Object.freeze({
      top: './assets/players/kyllian/kyllian-top-scene-v1.png?v=20260902T015215899',
      left: './assets/players/kyllian/kyllian-left-scene-v1.png?v=20260902T015215899',
      right: './assets/players/kyllian/kyllian-right-scene-v1.png?v=20260902T015215899'
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
