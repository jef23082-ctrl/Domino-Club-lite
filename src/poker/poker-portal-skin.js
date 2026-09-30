// Shared UI rendering; each mode uses its own unchanged, user-supplied atlas.
const NS = 'http://www.w3.org/2000/svg';
const watched = new WeakSet();
let serial = 0;
function createTheme(ATLAS, mode) {
const FRAMES = {
  panel: [223, 206, 405, 450, mode === 'domino' ? 30 : 22],
  hero: [644, 194, 386, 466, mode === 'domino' ? 30 : 22],
  button: [239, 372, 374, 67, 11],
  gold: [1061, 372, 374, 67, 11],
  muted: [1061, 524, 374, 66, 11],
  nav: [36, 830, 1603, 87, 14],
  tab: [201, 836, 178, 75, 12],
  strip: [417, 663, 837, 53, 10],
};
function svgNode(tag, attributes = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}
function crop(box) {
  const node = svgNode('svg', { viewBox: box.join(' '), preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  node.append(svgNode('image', { href: ATLAS, width: 1672, height: 941 }));
  return node;
}
function repeatCrop(box, className = '') {
  const [,, width, height] = box;
  const id = `poker-material-${++serial}`;
  const node = svgNode('svg', { 'aria-hidden': 'true', width: '100%', height: '100%' });
  const defs = svgNode('defs');
  const pattern = svgNode('pattern', { id, patternUnits: 'userSpaceOnUse', width, height });
  const tile = crop(box); tile.setAttribute('width', width); tile.setAttribute('height', height);
  pattern.append(tile); defs.append(pattern);
  node.append(defs, svgNode('rect', { width: '100%', height: '100%', fill: `url(#${id})` }));
  if (className) node.classList.add(className);
  return node;
}
function material(kind) {
  const gold = kind === 'gold', tab = kind === 'tab';
  const node = repeatCrop(gold ? (mode === 'domino' ? [1340, 384, 54, 43] : [1290, 384, 105, 43]) : tab ? [218, 846, 25, 54] : [288, 229, 96, 54], 'poker-skin-material');
  // Metallic buttons have a continuous vertical light gradient, never a repeat.
  if (gold || tab) {
    node.setAttribute('viewBox', gold ? '0 0 315 43' : '0 0 150 54');
    node.setAttribute('preserveAspectRatio', 'none');
  }
  return node;
}
function decorateLaurels(node) {
  if (node.querySelector('.poker-exact-laurels')) return;
  const art = crop([700, 298, 272, 169]);
  art.classList.add('poker-exact-laurels');
  const id = `poker-laurels-${++serial}`;
  const defs = svgNode('defs'), mask = svgNode('mask', { id, maskUnits: 'userSpaceOnUse', x: 700, y: 298, width: 272, height: 169 });
  mask.append(svgNode('rect', { x: 700, y: 298, width: 272, height: 169, fill: 'white' }), svgNode('circle', { cx: 837, cy: 370, r: 103, fill: 'black' }));
  defs.append(mask); art.prepend(defs); art.querySelector('image').setAttribute('mask', `url(#${id})`);
  node.append(art);
}
function artwork(node, name, box) {
  if (node.querySelector(`:scope > .${name}`)) return;
  const art = crop(box);
  art.classList.add('poker-artwork', name);
  node.append(art);
}
function skin(node, kind, frameOnly = false) {
  if (node.dataset.pokerSkin && node.dataset.skinMode === mode) return;
  node.querySelector(':scope > .poker-skin')?.remove();
  node.dataset.skinMode = mode;
  node.dataset.pokerSkin = kind;
  // Keep the material and frame outside the personal history's scrolling content.
  if(node.matches('.poker-personal-history')&&!node.querySelector(':scope > .poker-history-scroll')){
    const scroll=document.createElement('div');scroll.className='poker-history-scroll';scroll.append(...[...node.childNodes].filter(child=>child.nodeType!==1||child.tagName!=='H2'));node.append(scroll);
  }
  if (node.matches('.portal-table-wrap') && !node.querySelector('.poker-material-scroll')) {
    const scroll = document.createElement('div');
    scroll.className = 'poker-material-scroll';
    scroll.append(...node.childNodes); node.append(scroll);
  }
  const layer = document.createElement('span');
  layer.className = 'poker-skin'; layer.setAttribute('aria-hidden', 'true');
  const [x, y, width, height, cut] = FRAMES[kind];
  layer.style.setProperty('--skin-cut', `${cut}px`);
  if (!frameOnly) layer.append(material(kind));
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
    if (row === 1 && column === 1) continue;
    const xs = [x, x + cut, x + width - cut], ys = [y, y + cut, y + height - cut];
    const widths = [cut, width - cut * 2, cut], heights = [cut, height - cut * 2, cut];
    let box = [xs[column], ys[row], widths[column], heights[row]];
    // Repeat straight edges: neither the stitching nor leather may stretch.
    const repeat = !['gold', 'tab'].includes(kind);
    if (repeat && column === 1) box = [x + 50, ys[row], 48, heights[row]];
    if (repeat && row === 1) box = [xs[column], y + (height > 150 ? 70 : cut), widths[column], height > 150 ? 48 : height - cut * 2];
    const part = repeat && (row === 1 || column === 1) ? repeatCrop(box) : crop(box);
    part.style.gridArea = `${row + 1} / ${column + 1}`;
    layer.append(part);
  }
  node.prepend(layer);
}
function decorate(root) {
  if (root.dataset.skinMode !== mode) {
    root.querySelectorAll('.poker-artwork,.poker-exact-laurels').forEach(node => node.remove());
    root.dataset.skinMode = mode;
  }
  root.querySelectorAll('.portal-home-laurels').forEach(decorateLaurels);
  root.querySelectorAll('.portal-home-online-card,.portal-home-physical-card').forEach(node => {
    artwork(node, 'poker-suit-left', mode === 'domino' ? [246, 237, 48, 44] : [253, 241, 29, 32]);
    artwork(node, 'poker-suit-right', mode === 'domino' ? [246, 237, 48, 44] : [253, 241, 29, 32]);
  });
  root.querySelectorAll('.portal-connected-strip').forEach(node => {
    if (!node.querySelector('.portal-connected-content')) {
      const content=document.createElement('div');
      content.className='portal-connected-content';
      content.setAttribute('aria-label','Membres connectés');
      content.tabIndex=0;
      content.append(...[...node.childNodes].filter(child=>child.nodeType!==1||!child.matches('.poker-skin,.poker-artwork')));
      node.append(content);
    }
    artwork(node, 'poker-stud-left', [426, 681, 16, 17]);
    artwork(node, 'poker-stud-right', [426, 681, 16, 17]);
  });
  if (mode === 'domino') {
    root.querySelectorAll('.portal-home-portrait-frame').forEach(node => artwork(node, 'domino-reference-medallion', [815, 431, 42, 38]));
  }
  const panels = '.portal-card:not(.poker-ranking-panel):not(.poker-live-band):not(.portal-presence-card):not(.portal-invites-card):not(.portal-chat):not(#page-ranking > .portal-card),.poker-online-list,.poker-common-chat,.portal-table-wrap,.portal-podium-place,.poker-lobby-room,.portal-live-chat,.portal-profile-detail,.portal-room-card,.portal-dialog';
  root.querySelectorAll(panels).forEach(node => skin(node, node.matches('.portal-home-profile') ? 'hero' : 'panel'));
  root.querySelectorAll('.portal-player-card').forEach(node => skin(node, 'button', true));
  root.querySelectorAll('.portal-connected-strip,.poker-live-band,.poker-lobby-note,.portal-presence-card,.portal-invites-card').forEach(node => skin(node, 'strip'));
  root.querySelectorAll('.poker-ranking-scoring').forEach(node=>skin(node,'gold'));
  root.querySelectorAll('.portal-nav').forEach(node => skin(node, 'nav'));
  root.querySelectorAll('.portal-nav-item').forEach(node => skin(node, 'tab'));
  root.querySelectorAll('.online-action,.portal-pagination button,.poker-common-form button,.portal-chat-form button').forEach(node => {
    const kind = node.closest('.online-waiting-controls') ? 'button' : node.matches('.portal-home-action--danger') ? 'muted' : node.matches('.online-action--primary,.portal-home-action--gold,.portal-home-profile-button,.portal-admin-login button[type="submit"],.poker-common-form button') ? 'gold' : node.matches('[aria-selected="true"]') ? 'gold' : 'button';
    skin(node, kind);
  });
  root.querySelectorAll('.online-waiting-controls .room-style-picker').forEach(node=>skin(node,'button'));
}

  return decorate;
}
const themes = {
  poker: createTheme(new URL('../../assets/menus/poker-ui-reference-v38.png', import.meta.url).href, 'poker'),
  domino: createTheme(new URL('../../assets/menus/domino-ui-reference-v39.png', import.meta.url).href, 'domino'),
};
export function applyClubPortalSkin(target) {
  const root = target.closest('.club-portal');
  if (!root) return;
  const decorate = () => themes[root.dataset.mode]?.(root);
  decorate();
  if (watched.has(root)) return;
  watched.add(root);
  new MutationObserver(records => {
    if (records.some(record => record.type === 'attributes' || [...record.addedNodes].some(node => node.nodeType === 1 && !node.matches('.poker-skin,.poker-artwork,.poker-exact-laurels')))) decorate();
  }).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-mode'] });
}
export const applyPokerPortalSkin = applyClubPortalSkin;
