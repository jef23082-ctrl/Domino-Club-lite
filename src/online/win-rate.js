const percent = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function winRate(wins, played) {
  return Number(played) > 0 ? (Number(wins) || 0) / Number(played) : 0;
}

export function formatWinRate(wins, played) {
  return percent.format(winRate(wins, played));
}
