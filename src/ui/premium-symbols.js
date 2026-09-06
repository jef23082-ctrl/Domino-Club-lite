const SVG_NS = 'http://www.w3.org/2000/svg';
let symbolId = 0;

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function stop(offset, color, opacity = 1) {
  return svgElement('stop', { offset, 'stop-color': color, 'stop-opacity': opacity });
}

export function createPremiumCrown(className = '') {
  const id = `premium-crown-${symbolId += 1}`;
  const svg = svgElement('svg', {
    class: `premium-crown ${className}`.trim(), viewBox: '0 0 120 82', role: 'img', 'aria-label': 'Couronne du vainqueur'
  });
  const defs = svgElement('defs');
  const gold = svgElement('linearGradient', { id: `${id}-gold`, x1: '0', y1: '0', x2: '0', y2: '1' });
  gold.append(stop('0%', '#fff4b0'), stop('21%', '#f5cb54'), stop('52%', '#b87913'), stop('78%', '#f1c84e'), stop('100%', '#704007'));
  const velvet = svgElement('linearGradient', { id: `${id}-velvet`, x1: '0', y1: '0', x2: '1', y2: '1' });
  velvet.append(stop('0%', '#8e1531'), stop('54%', '#430717'), stop('100%', '#170208'));
  const shadow = svgElement('filter', { id: `${id}-shadow`, x: '-30%', y: '-30%', width: '160%', height: '180%' });
  shadow.append(svgElement('feDropShadow', { dx: '0', dy: '5', stdDeviation: '4', 'flood-color': '#000', 'flood-opacity': '.72' }));
  defs.append(gold, velvet, shadow);
  const group = svgElement('g', { filter: `url(#${id}-shadow)` });
  group.append(
    svgElement('path', { d: 'M15 58 7 18l28 20L60 7l25 31 28-20-8 40Z', fill: `url(#${id}-gold)`, stroke: '#fff0a0', 'stroke-width': '2', 'stroke-linejoin': 'round' }),
    svgElement('path', { d: 'M20 48c24-11 56-11 80 0l-3 14H23Z', fill: `url(#${id}-velvet)`, stroke: '#d69d29', 'stroke-width': '2' }),
    svgElement('path', { d: 'M19 59c26-6 56-6 82 0l-2 12c-27 6-51 6-78 0Z', fill: `url(#${id}-gold)`, stroke: '#fff0a0', 'stroke-width': '1.6' }),
    svgElement('path', { d: 'M25 62c23-4 47-4 70 0', fill: 'none', stroke: '#fff6bc', 'stroke-width': '1.4', opacity: '.72' })
  );
  for (const [cx, cy, color] of [[17, 18, '#a91532'], [35, 38, '#147b66'], [60, 8, '#b31432'], [85, 38, '#147b66'], [103, 18, '#a91532'], [38, 64, '#b51232'], [60, 62, '#176e63'], [82, 64, '#b51232']]) {
    group.append(svgElement('circle', { cx, cy, r: cy > 50 ? 3.5 : 4.2, fill: color, stroke: '#ffe79a', 'stroke-width': '1.3' }));
  }
  svg.append(defs, group);
  return svg;
}

export function createPremiumPig(className = '') {
  const id = `premium-pig-${symbolId += 1}`;
  const svg = svgElement('svg', {
    class: `premium-pig ${className}`.trim(), viewBox: '0 0 88 88', role: 'img', 'aria-label': 'Cochon du classement'
  });
  const defs = svgElement('defs');
  const pink = svgElement('radialGradient', { id, cx: '.35', cy: '.25', r: '.8' });
  pink.append(stop('0%', '#ffd8c8'), stop('55%', '#e9937e'), stop('100%', '#9b493e'));
  defs.append(pink);
  svg.append(defs,
    svgElement('circle', { cx: 44, cy: 46, r: 34, fill: `url(#${id})`, stroke: '#efc56e', 'stroke-width': 3 }),
    svgElement('path', { d: 'M18 27 12 9l22 11M70 27 76 9 54 20', fill: `url(#${id})`, stroke: '#efc56e', 'stroke-width': 3, 'stroke-linejoin': 'round' }),
    svgElement('circle', { cx: 32, cy: 41, r: 4, fill: '#27120e' }),
    svgElement('circle', { cx: 56, cy: 41, r: 4, fill: '#27120e' }),
    svgElement('ellipse', { cx: 44, cy: 58, rx: 16, ry: 11, fill: '#f2aa96', stroke: '#9c4e43', 'stroke-width': 2 }),
    svgElement('circle', { cx: 38, cy: 58, r: 2.5, fill: '#5f2c26' }),
    svgElement('circle', { cx: 50, cy: 58, r: 2.5, fill: '#5f2c26' })
  );
  return svg;
}
