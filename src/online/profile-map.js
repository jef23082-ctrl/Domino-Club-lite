const CHARACTER_ALIASES = Object.freeze({
  alexis: 'alexis',
  cedric: 'cedric',
  christopher: 'christopher',
  cris: 'christopher',
  eddy: 'eddy',
  emmanuelle: 'emmanuelle',
  jeanclaude: 'jean-claude',
  khalil: 'khalil',
  killian: 'kyllian',
  kylian: 'kyllian',
  killyan: 'kyllian',
  kyllian: 'kyllian',
  ryad: 'ryad',
  thomas: 'thomas'
});

export function normalizeProfileName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/[^a-z]/g, '');
}

export function characterIdForProfile(profile) {
  return knownCharacterIdForProfile(profile) || 'khalil';
}
export function knownCharacterIdForProfile(profile) {
  return CHARACTER_ALIASES[normalizeProfileName(profile?.name)] || null;
}
