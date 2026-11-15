import { dominoGlide } from './domino-glide.js?v=59';
import { createThrowGesture, throwOrigin } from './domino-throw-gesture.js?v=59';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RELEASE = 170;
const TOUCHDOWN = 432;
const DURATION = 655;

function progress(value) {
  return Math.max(0, Math.min(value, 1));
}

function ease(value) {
  const t = progress(value);
  return t * t * (3 - 2 * t);
}

function mix(start, end, amount) {
  return start + (end - start) * amount;
}

function airbornePosition(start, contact, end, amount) {
  const intoFlight = mix(start, contact, .38);
  // Match the glide's initial speed and direction at contact, even when the
  // free side of the endpoint is offset from the line of the throw.
  const intoContact = contact + (contact - end) * (2 / 3) * (TOUCHDOWN - RELEASE) / (DURATION - TOUCHDOWN);
  const remaining = 1 - amount;
  return start * remaining ** 3 + 3 * intoFlight * remaining ** 2 * amount
    + 3 * intoContact * remaining * amount ** 2 + contact * amount ** 3;
}

function samePosition(a, b) {
  return ['cx', 'cy', 'angle', 'faceA', 'faceB'].every(key => Number(a[key]) === Number(b[key]));
}

export function createDominoThrow({ stage, isVisible, motionPreference = () => 'AUTO', onContact, onSettled }) {
  const board = stage.querySelector('#domino-board');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let previous;
  let active;

  function originalTile(id) {
    return [...board.children].find(element => element.dataset.tileId === id);
  }

  function stop(notify = false) {
    if (!active) return;
    const { frame, layer, tileId, gesture } = active;
    active = null;
    cancelAnimationFrame(frame);
    layer.remove();
    originalTile(tileId)?.classList.remove('domino-in-flight');
    gesture?.restore();
    delete stage.dataset.dominoThrowSeat;
    if (notify) onSettled();
  }

  function drawable() {
    const preference = motionPreference();
    const animate = preference === 'FULL' || (preference === 'AUTO' && !reduced.matches);
    return animate && isVisible() && !document.hidden
      && getComputedStyle(board).visibility === 'visible';
  }

  function draw(record, elapsed) {
    const { launch, touchdown, destination, tile, shadow, turn } = record;
    const air = progress((elapsed - RELEASE) / (TOUCHDOWN - RELEASE));
    const slide = 1 - (1 - progress((elapsed - TOUCHDOWN) / (DURATION - TOUCHDOWN))) ** 2;
    const approach = ease(elapsed / RELEASE);
    const height = (1 - air) * 23 + 4 * air * (1 - air) * 42;
    const wrist = elapsed < RELEASE + 26 ? ease((elapsed - 16) / (RELEASE + 10)) : 1 - ease((elapsed - 212) / 212);
    const x = air < 1
      ? airbornePosition(launch.x - (1 - approach) * record.recoil.x, touchdown.x, destination.x, air)
      : mix(touchdown.x, destination.x, slide);
    const y = air < 1
      ? airbornePosition(launch.y - (1 - approach) * record.recoil.y, touchdown.y, destination.y, air)
      : mix(touchdown.y, destination.y, slide);
    const angle = destination.angle + turn * (1 - air) ** 2;
    const opacity = ease(elapsed / 86);

    if (wrist > 0 && !record.gesture) record.gesture = createThrowGesture(record.portrait, record.seat);
    record.gesture?.draw(wrist);
    if (wrist === 0 && elapsed >= RELEASE) delete stage.dataset.dominoThrowSeat;
    tile.setAttribute('transform', `translate(${x} ${y - height}) rotate(${angle})`);
    tile.setAttribute('opacity', opacity);
    shadow.setAttribute('cx', x + 3);
    shadow.setAttribute('cy', y + 8);
    shadow.setAttribute('opacity', ease((air - .10) / .30) * (0.38 - height * .0035));
    shadow.setAttribute('rx', 50 - height * .18);
    if (!record.contacted && elapsed >= TOUCHDOWN) {
      record.contacted = true;
      onContact();
    }
  }

  function tick(now) {
    if (!active) return;
    if (!drawable()) {
      stop(true);
      return;
    }
    // Give the release a visible frame even when the browser drops frames
    // while it finishes loading the surrounding scene.
    active.elapsed += Math.min(66, now - (active.lastFrame ?? now));
    active.lastFrame = now;
    draw(active, active.elapsed);
    if (active.elapsed >= DURATION) stop(true);
    else active.frame = requestAnimationFrame(tick);
  }

  function visibleTile(record) {
    const target = originalTile(record.tileId);
    if (target) target.classList.add('domino-in-flight');
    if (!record.layer.isConnected) board.append(record.layer);
  }

  function start(placement, occupied, seat) {
    const original = originalTile(placement.tileId);
    const matrix = board.getScreenCTM();
    const portrait = seat ? stage.querySelector(`#character-${seat}`) : null;
    const origin = throwOrigin(stage, portrait, seat);
    if (!original || !matrix || !origin) return false;
    const launch = origin.matrixTransform(matrix.inverse());
    if (!Number.isFinite(launch.x) || !Number.isFinite(launch.y)) return false;
    const touchdown = dominoGlide(placement, occupied, launch);
    const destination = { x: +placement.cx, y: +placement.cy, angle: +placement.angle };
    const dx = touchdown.x - launch.x;
    const dy = touchdown.y - launch.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const tile = original.cloneNode(true);
    tile.removeAttribute('data-tile-id');
    tile.classList.add('domino-throw-tile');
    const layer = document.createElementNS(SVG_NS, 'g');
    layer.classList.add('domino-throw-flight');
    layer.setAttribute('aria-hidden', 'true');
    const shadow = document.createElementNS(SVG_NS, 'ellipse');
    shadow.setAttribute('ry', 24);
    shadow.setAttribute('fill', '#010704');
    layer.append(shadow, tile);
    active = {
      layer, shadow, tile, launch, touchdown, destination, seat, portrait, tileId: placement.tileId, elapsed: 0,
      turn: seat === 'left' ? -14 : 14,
      recoil: { x: dx * 12 / distance, y: dy * 12 / distance }
    };
    stage.dataset.dominoThrowSeat = seat;
    visibleTile(active);
    draw(active, 0);
    active.frame = requestAnimationFrame(tick);
    return true;
  }

  function sync({ key, placements, seatFor, now }) {
    const earlier = previous;
    const current = new Map(placements.map(tile => [tile.tileId, tile]));
    previous = { key, current };
    if (earlier?.key !== key || !isVisible() || document.hidden) {
      stop();
      return false;
    }

    const added = placements.filter(tile => !earlier.current.has(tile.tileId));
    const existing = placements.filter(tile => earlier.current.has(tile.tileId));
    const sameBoard = existing.length === earlier.current.size && existing.every(tile => samePosition(earlier.current.get(tile.tileId), tile));
    if (active && sameBoard && !added.length && seatFor(current.get(active.tileId).playerId) === active.seat && drawable()) {
      visibleTile(active);
      return true;
    }
    stop();
    const placement = added[0];
    if (!sameBoard || added.length !== 1 || !Number(placement.playedAt) || now - Number(placement.playedAt) > 5000) return false;
    if (drawable() && start(placement, existing, seatFor(placement.playerId))) return true;
    onContact();
    return false;
  }

  // Hidden tabs suspend animation frames. Settle immediately so they don't
  // play an old impact or leave an ended-round presentation waiting on a frame.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(true);
  });

  return {
    sync,
    reset() {
      stop();
      previous = null;
    }
  };
}
