import { PLAYER_ASSETS, hasPlayerCutout, playerAsset, playerCutoutAsset } from '../config/player-assets.js?v=20260924T185554830';
import { REACTION_ASSETS, REACTION_PARTICLES, reactionAssetUrl, reactionParticleUrl } from '../config/reaction-assets.js?v=20260924T185554830';
import { ROOM_STYLES, roomStyle } from '../config/room-styles.js?v=20260924T185554830';
import { imageSourceSet } from './image-source.js?v=20260924T185554830';

const requested = new Map();
let warmScheduled = false;

function absolute(source) {
  try { return new URL(String(source).split('?')[0], globalThis.document?.baseURI || import.meta.url).href; }
  catch { return String(source || ''); }
}

export function roomResourcePlan({ style, seats = [] }) {
  const selectedStyle = roomStyle(style);
  const critical = [ROOM_STYLES[selectedStyle].scene];
  for (const { seat, characterId } of seats) {
    if (!PLAYER_ASSETS[characterId]?.seats?.[seat]) continue;
    critical.push(selectedStyle === 'luxe' && hasPlayerCutout(characterId, seat)
      ? playerCutoutAsset(characterId, seat).src
      : playerAsset(characterId, seat).src);
  }
  return { critical: [...new Set(critical)], deferred: [] };
}

export function preloadImage(source, { priority = 'auto' } = {}) {
  const candidates = imageSourceSet(source);
  const url = absolute(candidates.preferred);
  if (!url || typeof Image === 'undefined') return Promise.resolve(url);
  if (requested.has(url)) return requested.get(url);
  const promise = new Promise(resolve => {
    const image = new Image();
    image.decoding = 'async';
    if ('fetchPriority' in image) image.fetchPriority = priority;
    image.onload = () => resolve(url);
    image.onerror = () => {
      const fallback = absolute(candidates.fallback);
      if (image.src === fallback) { resolve(''); return; }
      image.onerror = () => resolve('');
      image.onload = () => resolve(fallback);
      image.src = fallback;
    };
    image.src = url;
  });
  requested.set(url, promise);
  return promise;
}

export function preloadRoomResources(options) {
  const plan = roomResourcePlan(options);
  return Promise.all(plan.critical.map(source => preloadImage(source, { priority: 'high' })));
}

export function warmPremiumResources() {
  if (warmScheduled || globalThis.document?.documentElement?.dataset.visualQuality === 'optimized') return;
  warmScheduled = true;
  const queue = [
    ...Object.keys(REACTION_ASSETS).map(reactionAssetUrl),
    ...REACTION_PARTICLES.map((_asset, index) => reactionParticleUrl(index))
  ];
  let cursor = 0;
  const run = deadline => {
    let batch = 0;
    while (cursor < queue.length && batch < 3 && (!deadline?.timeRemaining || deadline.timeRemaining() > 4)) {
      preloadImage(queue[cursor++], { priority: 'low' });
      batch += 1;
    }
    if (cursor >= queue.length) return;
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2200 });
    else setTimeout(run, 450);
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 3500 });
  else setTimeout(run, 800);
}

export function resourceLoaderStats() {
  return { requested: requested.size };
}
