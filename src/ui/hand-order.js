// Same session key and reconciliation order as V2; never writes to Firebase.
export function handOrderKey(room, playerId) {
  return `od_hand_order_${room?.matchId || room?.code || 'room'}_${Number(room?.game?.roundNumber || 1)}_${String(playerId)}`;
}

export function reconcileHandOrder(serverHand, savedOrder = []) {
  const live = [...new Set(Array.isArray(serverHand) ? serverHand.filter(id => typeof id === 'string') : [])];
  const saved = Array.isArray(savedOrder) ? savedOrder : [];
  const kept = [...new Set(saved.filter(id => live.includes(id)))];
  return [...kept, ...live.filter(id => !kept.includes(id))];
}

export function moveHandTile(order, tileId, targetId, after = false) {
  if (tileId === targetId || !order.includes(tileId) || !order.includes(targetId)) return [...order];
  const next = order.filter(id => id !== tileId);
  next.splice(next.indexOf(targetId) + (after ? 1 : 0), 0, tileId);
  return next;
}

export class HandOrderStore {
  constructor(storage) {
    this.storage = storage;
    this.cache = new Map();
  }

  ordered(key, serverHand) {
    let saved = this.cache.get(key);
    if (!saved) {
      try { saved = JSON.parse(this.storage?.getItem(key) || '[]'); } catch (_) { saved = []; }
    }
    const ordered = reconcileHandOrder(serverHand, saved);
    this.save(key, ordered);
    return ordered;
  }

  save(key, order) {
    const previous = this.cache.get(key);
    this.cache.set(key, [...order]);
    if (JSON.stringify(previous) === JSON.stringify(order)) return;
    try { this.storage?.setItem(key, JSON.stringify(order)); } catch (_) {
      // A private-mode/quota failure must not prevent playing or local sorting.
    }
  }
}
