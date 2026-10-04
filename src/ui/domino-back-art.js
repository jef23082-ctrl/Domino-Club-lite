// Lossless pixels of the approved reference, clipped without changing rack geometry.
const SVG_NS = 'http://www.w3.org/2000/svg';
const art = new URL('../../assets/domino-premium-v52/domino-back.png', import.meta.url).href;
let sequence = 0;

export function createDominoBackArt(doc = document) {
  const element = (name, attributes = {}) => {
    const node = doc.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  };
  const id = `domino-gold-back-${++sequence}`;
  const drawing = element('svg', { viewBox: '5 5 150 249', preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' });
  drawing.classList.add('domino-back-art');
  const defs = element('defs');
  const clip = element('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
  clip.append(element('path', { d: 'M34 5 C19 5 7 16 7 35 L5 214 C5 236 12 251 32 253 L124 253 C145 253 155 240 155 217 L151 33 C150 16 140 6 123 5 Z' }));
  defs.append(clip);
  drawing.append(defs, element('image', { href: art, width: 164, height: 268, 'clip-path': `url(#${id})` }));
  return drawing;
}
