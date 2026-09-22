const SEAT_LANES = Object.freeze({
  top: Object.freeze(['below', 'outer-left', 'outer-right']),
  left: Object.freeze(['above', 'inner', 'outer']),
  right: Object.freeze(['above', 'inner', 'outer'])
});

const FIXED_OBSTACLE_SELECTOR = [
  '.player-plaque',
  '.opponent-rack',
  '.leader-trophy',
  '.opening-mascot__rig',
  '.online-result-card',
  '.chat-panel',
  '#spectator-panel',
  '.hand-dock',
  '.turn-banner'
].join(',');

export const UNIVERSAL_OVERLAY_SELECTOR = [
  '.turn-countdown',
  '.player-work-status',
  '.seat-emotion',
  '.seat-interaction'
].join(',');

const ROLE_PRIORITY = Object.freeze({ timer: 90, work: 80, emotion: 60, interaction: 50 });

function normalizedRect(rect) {
  return {
    left: Number(rect?.left || 0),
    top: Number(rect?.top || 0),
    right: Number(rect?.right ?? (Number(rect?.left || 0) + Number(rect?.width || 0))),
    bottom: Number(rect?.bottom ?? (Number(rect?.top || 0) + Number(rect?.height || 0))),
    width: Number(rect?.width ?? Math.max(0, Number(rect?.right || 0) - Number(rect?.left || 0))),
    height: Number(rect?.height ?? Math.max(0, Number(rect?.bottom || 0) - Number(rect?.top || 0)))
  };
}

export function intersectionArea(first, second) {
  const a = normalizedRect(first);
  const b = normalizedRect(second);
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

function outsideArea(rect, bounds) {
  const item = normalizedRect(rect);
  const stage = normalizedRect(bounds);
  const width = Math.max(0, item.right - item.left);
  const height = Math.max(0, item.bottom - item.top);
  const insideWidth = Math.max(0, Math.min(item.right, stage.right) - Math.max(item.left, stage.left));
  const insideHeight = Math.max(0, Math.min(item.bottom, stage.bottom) - Math.max(item.top, stage.top));
  return width * height - insideWidth * insideHeight;
}

export function chooseOverlayPlacement({ candidates, obstacles = [], bounds }) {
  if (!Array.isArray(candidates) || !candidates.length) return '';
  return candidates.map((candidate, index) => {
    const overlap = obstacles.reduce((total, obstacle) => total + intersectionArea(candidate.rect, obstacle), 0);
    const distance = Math.hypot(Number(candidate.x || 0), Number(candidate.y || 0));
    const score = overlap + outsideArea(candidate.rect, bounds) * 4 + distance * .02 + index * .001;
    return { ...candidate, score };
  }).sort((a, b) => a.score - b.score)[0];
}

export function chooseOverlayLane(options) {
  return chooseOverlayPlacement(options)?.lane || '';
}

function visible(element) {
  if (!element || element.hidden) return false;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function roleOf(element) {
  if (ROLE_PRIORITY[element?.dataset?.overlayRole]) return element.dataset.overlayRole;
  if (element.matches('.turn-countdown')) return 'timer';
  if (element.matches('.player-work-status')) return 'work';
  if (element.matches('.seat-emotion')) return 'emotion';
  return 'interaction';
}

function seatOf(element) {
  return element.closest('.player-seat')?.dataset.seat || 'top';
}

function shifted(rect, x, y) {
  const value = normalizedRect(rect);
  return { ...value, left: value.left + x, right: value.right + x, top: value.top + y, bottom: value.bottom + y };
}

export function universalOffsets({ role, seat, item, bounds }) {
  const width = Math.max(1, Number(item?.width || 0));
  const height = Math.max(1, Number(item?.height || 0));
  const stageWidth = Math.max(width, Number(bounds?.width || 0));
  const stageHeight = Math.max(height, Number(bounds?.height || 0));
  const horizontal = Math.max(width * 1.08, stageWidth * (role === 'timer' ? .055 : .075));
  const vertical = Math.max(height * 1.08, stageHeight * (role === 'timer' ? .055 : .085));
  if (seat === 'left') return [
    [0, 0], [0, -vertical], [horizontal, 0], [horizontal, -vertical], [0, vertical]
  ];
  if (seat === 'right') return [
    [0, 0], [0, -vertical], [-horizontal, 0], [-horizontal, -vertical], [0, vertical]
  ];
  return [
    [0, 0], [-horizontal, 0], [horizontal, 0], [0, vertical], [-horizontal, vertical], [horizontal, vertical]
  ];
}

function resetNudge(element) {
  element.style.removeProperty('--overlay-nudge-x');
  element.style.removeProperty('--overlay-nudge-y');
  delete element.dataset.overlayResolved;
}

function fixedObstacles(stage, ignored = null) {
  return [...stage.querySelectorAll(FIXED_OBSTACLE_SELECTOR)]
    .filter(element => element !== ignored && !ignored?.contains(element) && visible(element))
    .map(element => element.getBoundingClientRect());
}

export function placeSeatOverlay(overlay, seat, stage = document.querySelector('#casino-stage'), extraObstacles = []) {
  if (!overlay || !seat || !stage) return '';
  resetNudge(overlay);
  const seatName = seat.dataset.seat || seat.id?.replace('seat-', '') || 'top';
  const lanes = SEAT_LANES[seatName] || SEAT_LANES.top;
  const obstacles = [...fixedObstacles(stage, overlay), ...extraObstacles];
  const candidates = lanes.map(lane => {
    overlay.dataset.overlayLane = lane;
    return { lane, rect: overlay.getBoundingClientRect() };
  });
  const selected = chooseOverlayPlacement({ candidates, obstacles, bounds: stage.getBoundingClientRect() });
  overlay.dataset.overlayLane = selected?.lane || lanes[0];
  overlay.dataset.overlayRole ||= 'interaction';
  overlay.dataset.overlayResolved = 'true';
  return overlay.dataset.overlayLane;
}

export function placeUniversalOverlay(element, stage = document.querySelector('#casino-stage'), extraObstacles = []) {
  if (!element || !stage || !visible(element)) return null;
  const role = roleOf(element);
  const seat = seatOf(element);
  if (role === 'interaction') {
    placeSeatOverlay(element, element.closest('.player-seat'), stage, extraObstacles);
    return { role, seat, lane: element.dataset.overlayLane, rect: element.getBoundingClientRect() };
  }
  resetNudge(element);
  const bounds = stage.getBoundingClientRect();
  const item = element.getBoundingClientRect();
  const obstacles = [...fixedObstacles(stage, element), ...extraObstacles];
  const candidates = universalOffsets({ role, seat, item, bounds }).map(([x, y], index) => ({
    lane: index === 0 ? 'preferred' : `fallback-${index}`,
    x,
    y,
    rect: shifted(item, x, y)
  }));
  const selected = chooseOverlayPlacement({ candidates, obstacles, bounds });
  element.style.setProperty('--overlay-nudge-x', `${selected?.x || 0}px`);
  element.style.setProperty('--overlay-nudge-y', `${selected?.y || 0}px`);
  element.dataset.overlayRole = role;
  element.dataset.overlayLane = selected?.lane || 'preferred';
  element.dataset.overlayResolved = 'true';
  return { role, seat, lane: element.dataset.overlayLane, rect: element.getBoundingClientRect() };
}

export function refreshUniversalOverlays(stage = document.querySelector('#casino-stage')) {
  if (!stage) return [];
  const elements = [...stage.querySelectorAll(UNIVERSAL_OVERLAY_SELECTOR)].filter(visible);
  elements.forEach(resetNudge);
  elements.sort((left, right) => ROLE_PRIORITY[roleOf(right)] - ROLE_PRIORITY[roleOf(left)]);
  const occupied = [];
  const placements = [];
  for (const element of elements) {
    const placement = placeUniversalOverlay(element, stage, occupied);
    if (!placement) continue;
    occupied.push(element.getBoundingClientRect());
    placements.push(placement);
  }
  return placements;
}

export const refreshSeatOverlays = refreshUniversalOverlays;

export function createUniversalPlacementEngine(stage = document.querySelector('#casino-stage')) {
  let frame = 0;
  const schedule = () => {
    if (frame || !stage) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      refreshUniversalOverlays(stage);
    });
  };
  const mutation = typeof MutationObserver === 'function' && stage ? new MutationObserver(schedule) : null;
  mutation?.observe(stage, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  const resize = typeof ResizeObserver === 'function' && stage ? new ResizeObserver(schedule) : null;
  resize?.observe(stage);
  globalThis.addEventListener?.('resize', schedule, { passive: true });
  schedule();
  return {
    schedule,
    layout: () => refreshUniversalOverlays(stage),
    dispose() {
      if (frame) cancelAnimationFrame(frame);
      mutation?.disconnect();
      resize?.disconnect();
      globalThis.removeEventListener?.('resize', schedule);
    }
  };
}
