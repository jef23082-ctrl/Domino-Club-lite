export const CELEBRATION_DURATION = 6000;

// Realtime Database omits empty arrays: a missing hand during a game means zero,
// not an undistributed seven-tile hand in the waiting room.
export function remainingTileCount(room, key) {
  return room?.game ? (room.game.hands?.[key]?.length || 0) : 7;
}

export function playerName(room, playerId) {
  const player = Object.values(room?.players || {}).find(
    item => String(item?.playerId) === String(playerId)
  );
  return player?.name || 'Joueur';
}

export function celebrationState(room, at = Date.now(), duration = CELEBRATION_DURATION) {
  const game = room?.game;
  if (!room || !game) return null;

  let type = '';
  let eventAt = 0;
  let winnerId = null;
  let cochonIds = [];

  if (room.status === 'finished' && game.matchResult) {
    eventAt = Number(game.matchResult.at || game.roundResult?.at || 0);
    winnerId = game.matchResult.type === 'victory'
      ? game.matchResult.winnerId
      : game.roundResult?.winnerId;
    cochonIds = game.matchResult.type === 'victory' ? (game.matchResult.cochonIds || []) : [];
    type = game.matchResult.type === 'victory' ? 'match' : 'round';
  } else if (game.roundStatus === 'ended' && game.roundResult?.type === 'winner') {
    eventAt = Number(game.roundResult.at || 0);
    winnerId = game.roundResult.winnerId;
    type = 'round';
  }

  if (!type || !eventAt || winnerId === null || winnerId === undefined) return null;
  const elapsed = Math.max(0, Number(at) - eventAt);
  return {
    type,
    eventAt,
    winnerId,
    cochonIds,
    elapsed,
    remaining: Math.max(0, duration - elapsed),
    key: `${room.matchId || room.code}|${type}|${eventAt}|${winnerId}`
  };
}

export function resultPresentation(room) {
  const game = room?.game;
  if (!game) return null;
  if (room.status === 'finished' && game.matchResult) {
    const result = game.matchResult;
    if (result.type === 'victory') {
      const cochons = (result.cochonIds || []).map(id => playerName(room, id));
      return {
        kind: 'match-victory',
        icon: '♛',
        title: `${playerName(room, result.winnerId)} gagne la partie`,
        detail: cochons.length ? `Cochon${cochons.length > 1 ? 's' : ''} : ${cochons.join(' et ')}` : 'Victoire sans cochon.',
        action: 'rematch',
        actionLabel: 'Rejouer ensemble'
      };
    }
    return {
      kind: 'match-cancelled',
      icon: '♜',
      title: 'Partie annulée',
      detail: `${playerName(room, result.savedId)} est sauvé après avoir gagné la dernière manche.`,
      action: 'rematch',
      actionLabel: 'Rejouer ensemble'
    };
  }
  if (game.roundStatus !== 'ended' || !game.roundResult) return null;
  const result = game.roundResult;
  if (result.type === 'winner') {
    return {
      kind: 'round-victory',
      icon: '◆',
      title: `${playerName(room, result.winnerId)} gagne la manche`,
      detail: result.cause === 'blocked'
        ? `Jeu bloqué : ${Number(result.points || 0)} point${Number(result.points || 0) > 1 ? 's' : ''} en main.`
        : 'Tous ses dominos ont été posés.',
      action: 'next-round',
      actionLabel: 'Manche suivante'
    };
  }
  return {
    kind: 'round-annulled',
    icon: '◇',
    title: 'Manche annulée',
    detail: result.reason || 'Aucun joueur ne marque.',
    action: 'next-round',
    actionLabel: 'Rejouer une manche'
  };
}

export function freshReaction(reaction, at = Date.now(), duration = 4200) {
  if (!reaction?.at) return null;
  const elapsed = Math.max(0, Number(at) - Number(reaction.at));
  if (elapsed >= duration) return null;
  return { ...reaction, elapsed, remaining: duration - elapsed };
}

export function actionKey(action) {
  if (!action?.type || !action?.at) return '';
  return `${action.type}|${action.playerId ?? ''}|${action.tileId ?? ''}|${action.at}`;
}
