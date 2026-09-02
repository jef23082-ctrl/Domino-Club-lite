import { parseTile } from '../game/engine.js';
import { displayName } from '../online/display-name.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const PIP_POSITIONS = Object.freeze({
  0: [],
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [3, 1], [1, 3], [3, 3]],
  5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]],
  6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]]
});

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function appendStop(gradient, offset, color, opacity = 1) {
  gradient.append(svgElement('stop', {
    offset,
    'stop-color': color,
    'stop-opacity': opacity
  }));
}

function createDefinitions() {
  const definitions = svgElement('defs');

  const ivory = svgElement('linearGradient', { id: 'ivory-face', x1: '0', y1: '0', x2: '1', y2: '1' });
  appendStop(ivory, '0%', '#f4e1b7');
  appendStop(ivory, '48%', '#e7cfa0');
  appendStop(ivory, '82%', '#d6b57d');
  appendStop(ivory, '100%', '#b78a49');

  const gold = svgElement('linearGradient', { id: 'gold-stroke', x1: '0', y1: '0', x2: '0', y2: '1' });
  appendStop(gold, '0%', '#fff0a9');
  appendStop(gold, '36%', '#c68d2d');
  appendStop(gold, '74%', '#6f4310');
  appendStop(gold, '100%', '#e8c369');

  const pip = svgElement('radialGradient', { id: 'pip-face', cx: '.33', cy: '.26', r: '.72' });
  appendStop(pip, '0%', '#626262');
  appendStop(pip, '28%', '#1a1a1a');
  appendStop(pip, '100%', '#000');

  const rivet = svgElement('radialGradient', { id: 'gold-rivet', cx: '.32', cy: '.24', r: '.78' });
  appendStop(rivet, '0%', '#fff6ba');
  appendStop(rivet, '45%', '#dea72f');
  appendStop(rivet, '100%', '#6f4007');

  definitions.append(ivory, gold, pip, rivet);
  return definitions;
}

function createSvgPips(value, halfCenterX) {
  const fragment = document.createDocumentFragment();
  const gridX = [-16, 0, 16];
  const gridY = [-17, 0, 17];
  for (const [column, row] of PIP_POSITIONS[value] || []) {
    fragment.append(svgElement('circle', {
      class: 'tile-pip',
      cx: halfCenterX + gridX[column - 1],
      cy: gridY[row - 1],
      r: 6.6
    }));
  }
  return fragment;
}

function createBoardDomino(placement) {
  const group = svgElement('g', {
    class: 'board-domino',
    transform: `translate(${placement.cx} ${placement.cy}) rotate(${placement.angle})`,
    'data-tile-id': placement.tileId
  });

  group.append(
    svgElement('rect', { class: 'tile-edge', x: -56, y: -29, width: 120, height: 70, rx: 10 }),
    svgElement('rect', { class: 'tile-face', x: -60, y: -35, width: 120, height: 70, rx: 10 }),
    svgElement('rect', { class: 'tile-highlight', x: -56.5, y: -31.5, width: 113, height: 63, rx: 7.5 }),
    svgElement('line', { class: 'tile-divider', x1: 0, y1: -30, x2: 0, y2: 30 }),
    svgElement('line', { class: 'tile-divider-light', x1: 2, y1: -29, x2: 2, y2: 29 }),
    createSvgPips(Number(placement.faceA), -30),
    createSvgPips(Number(placement.faceB), 30),
    svgElement('circle', { class: 'tile-rivet', cx: 0, cy: 0, r: 5.2 })
  );
  return group;
}

export function renderBoard(svg, board) {
  svg.replaceChildren(createDefinitions());
  for (const placement of board.placements || []) svg.append(createBoardDomino(placement));
}

function createHandHalf(value) {
  const half = document.createElement('span');
  half.className = 'hand-half';
  half.setAttribute('aria-hidden', 'true');
  for (const [column, row] of PIP_POSITIONS[value] || []) {
    const pip = document.createElement('span');
    pip.className = 'hand-pip';
    pip.style.gridColumn = String(column);
    pip.style.gridRow = String(row);
    half.append(pip);
  }
  return half;
}

export function renderHand(container, tileIds) {
  const existing = new Map([...container.querySelectorAll('.hand-domino')].map(button => [button.dataset.tileId, button]));
  let cursor = container.firstElementChild;
  for (const tileId of tileIds) {
    let button = existing.get(tileId);
    if (!button) {
      const tile = parseTile(tileId);
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'hand-domino';
      button.dataset.tileId = tileId;
      button.draggable = false;
      button.setAttribute('aria-label', `Domino ${tile.a}-${tile.b}`);
      button.append(createHandHalf(tile.a), createHandHalf(tile.b));
    }
    if (cursor === button) cursor = cursor.nextElementSibling;
    else container.insertBefore(button, cursor);
  }
  for (const [tileId, button] of existing) if (!tileIds.includes(tileId)) button.remove();
}

export function renderOpponentRack(container, count) {
  const rack = document.createElement('div');
  rack.className = 'opponent-rack';
  rack.setAttribute('aria-label', `${count} domino${count === 1 ? '' : 's'} restant${count === 1 ? '' : 's'}`);
  rack.dataset.count = String(count);
  for (let index = 0; index < count; index += 1) {
    const tile = document.createElement('span');
    tile.className = 'rack-back';
    tile.setAttribute('aria-hidden', 'true');
    const drawing = svgElement('svg', { viewBox: '0 0 40 64', preserveAspectRatio: 'none', focusable: 'false' });
    const textureId = `rack-weave-${container.dataset.seat || 'seat'}-${index}`;
    const defs = svgElement('defs');
    const pattern = svgElement('pattern', { id: textureId, width: 5, height: 5, patternUnits: 'userSpaceOnUse' });
    pattern.append(svgElement('path', { d: 'M-1 1L1-1M0 5L5 0M4 6L6 4', fill: 'none', stroke: '#786345', 'stroke-width': .45, opacity: .48 }));
    defs.append(pattern);
    drawing.append(defs,
      svgElement('ellipse', { cx: 20, cy: 61, rx: 19, ry: 2.6, fill: '#000', opacity: .58 }),
      svgElement('path', { d: 'M32 3L38 1L38 55L32 60Z', fill: '#6d512a', stroke: '#c5a46a', 'stroke-width': .8 }),
      svgElement('path', { d: 'M2 4L8 1L38 1L32 4Z', fill: '#c6a76f', stroke: '#e1c88f', 'stroke-width': .65 }),
      svgElement('rect', { x: 2, y: 3, width: 31, height: 57, rx: 1.8, fill: '#080d0b', stroke: '#cca965', 'stroke-width': 1.4 }),
      svgElement('rect', { x: 4.3, y: 5.3, width: 26.4, height: 52.4, rx: .7, fill: `url(#${textureId})`, stroke: '#7c693e', 'stroke-width': .5 }),
      svgElement('path', { d: 'M3 57L3 5L30 5', fill: 'none', stroke: '#efdaad', opacity: .28, 'stroke-width': .7 })
    );
    tile.append(drawing);
    rack.append(tile);
  }
  container.append(rack);
}

export function renderPlayerPlaque(container, player) {
  const plaque = document.createElement('div');
  plaque.className = 'player-plaque';

  const name = document.createElement('strong');
  name.className = 'player-name';
  name.textContent = displayName(player.name);

  const rounds = document.createElement('span');
  rounds.className = 'player-stat';
  rounds.textContent = `Manches : ${player.rounds}`;

  const tiles = document.createElement('span');
  tiles.className = 'player-stat';
  tiles.textContent = `Dominos : ${player.tiles}`;

  plaque.append(name, rounds, tiles);
  if (player.active) plaque.setAttribute('aria-label', `${displayName(player.name)} — à toi de jouer`);
  container.append(plaque);
}
