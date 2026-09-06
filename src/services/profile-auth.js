export function passwordForProfile(profile) {
  return `${String(profile?.name || '').trim()}++`.toLocaleLowerCase('fr-FR');
}

export function authenticateProfile(players, candidate) {
  const normalized = String(candidate || '').trim().toLocaleLowerCase('fr-FR');
  return (players || []).find(player => passwordForProfile(player) === normalized
    || (['chris', 'cris', 'christopher'].includes(String(player.name).trim().toLowerCase())
      && ['chris++', 'cris++', 'christopher++'].includes(normalized))) || null;
}
