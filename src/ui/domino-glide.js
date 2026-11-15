import { BOARD_GEOMETRY, boundsOverlap, placementBounds } from '../game/engine.js?v=58-r7';

const MIN_GLIDE = 10;
const MAX_GLIDE = 66;
const CONTACT_TOLERANCE = 0.5;

// Sweep the domino's footprint by treating its center as a point and
// expanding each obstruction by half the length and width of the moving tile.
function entryDistance(point, direction, area) {
  let enters = 0;
  let leaves = Infinity;
  for (const [start, speed, low, high] of [
    [point.x, direction.x, area.left, area.right],
    [point.y, direction.y, area.top, area.bottom]
  ]) {
    if (Math.abs(speed) < 1e-9) {
      if (start <= low || start >= high) return Infinity;
      continue;
    }
    const first = (low - start) / speed;
    const last = (high - start) / speed;
    enters = Math.max(enters, Math.min(first, last));
    leaves = Math.min(leaves, Math.max(first, last));
  }
  return enters < leaves ? enters : Infinity;
}

export function dominoGlide(placement, occupiedPlacements, launch) {
  const end = { x: Number(placement.cx), y: Number(placement.cy) };
  const footprint = placementBounds(placement);
  const limits = {
    left: BOARD_GEOMETRY.margin + end.x - footprint.left,
    right: BOARD_GEOMETRY.width - BOARD_GEOMETRY.margin - footprint.right + end.x,
    top: BOARD_GEOMETRY.margin + end.y - footprint.top,
    bottom: BOARD_GEOMETRY.height - BOARD_GEOMETRY.margin - footprint.bottom + end.y
  };
  const occupied = occupiedPlacements.map(placementBounds);
  if (end.x < limits.left || end.x > limits.right || end.y < limits.top || end.y > limits.bottom
      || occupied.some(other => boundsOverlap(footprint, other))) return end;

  const obstructions = occupied.map(other => ({
    left: other.left - (footprint.right - end.x) + CONTACT_TOLERANCE,
    right: other.right + (end.x - footprint.left) - CONTACT_TOLERANCE,
    top: other.top - (footprint.bottom - end.y) + CONTACT_TOLERANCE,
    bottom: other.bottom + (end.y - footprint.top) - CONTACT_TOLERANCE
  }));
  const directionToHand = Math.atan2(launch.y - end.y, launch.x - end.x);
  const tileAngle = Number(placement.angle) * Math.PI / 180;
  // Include the tile's exact axes so a tangent slide is possible along tightly packed rows.
  const angles = [
    ...[0, 1, -1, 2, -2, 3, -3, 4].map(step => directionToHand + step * Math.PI / 4),
    ...[0, 1, 2, 3].map(step => tileAngle + step * Math.PI / 2)
  ];
  let best = { point: end, score: 0 };
  for (const angle of angles) {
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    const clearX = Math.abs(x) < 1e-9 ? Infinity : ((x > 0 ? limits.right : limits.left) - end.x) / x;
    const clearY = Math.abs(y) < 1e-9 ? Infinity : ((y > 0 ? limits.bottom : limits.top) - end.y) / y;
    const blockedAt = Math.min(...obstructions.map(area => entryDistance(end, { x, y }, area)));
    const distance = Math.min(MAX_GLIDE, clearX, clearY, blockedAt - 2);
    if (distance < MIN_GLIDE) continue;
    const score = distance * (0.72 + 0.28 * Math.cos(angle - directionToHand));
    if (score > best.score) best = { point: { x: end.x + x * distance, y: end.y + y * distance }, score };
  }
  return best.point;
}
