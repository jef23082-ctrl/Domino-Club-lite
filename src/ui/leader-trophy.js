const TROPHY_ASSET = './assets/ui/coupe-cochon-or-v10.png';
const LUXE_TROPHY_ASSET = './assets/ui/coupe-palais-royale-v12.png';
import { setOptimizedImage } from './image-source.js?v=20260922T005918368';

const element = (tag, className = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
};

function replayClass(node, className) {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

export function createLeaderTrophy({ stage, onSound = () => {} } = {}) {
  if (!stage) throw new Error('La scène de la coupe est introuvable.');

  const root = element('aside', 'leader-trophy');
  root.hidden = true;
  root.setAttribute('aria-label', "Coupe d’or du numéro 1 du club");

  const asset = element('img', 'leader-trophy__asset');
  setOptimizedImage(asset, TROPHY_ASSET);
  asset.alt = '';
  asset.setAttribute('aria-hidden', 'true');
  asset.draggable = false;

  const halo = element('span', 'leader-trophy__halo');
  const dust = element('span', 'leader-trophy__dust');
  [halo, dust].forEach(node => node.setAttribute('aria-hidden', 'true'));
  for (let index = 0; index < 24; index += 1) {
    const particle = element('i');
    const angle = (index / 24) * Math.PI * 2;
    const distance = 34 + (index % 6) * 8;
    particle.style.setProperty('--trophy-dx', `${Math.cos(angle) * distance}px`);
    particle.style.setProperty('--trophy-dy', `${Math.sin(angle) * distance - 23}px`);
    particle.style.setProperty('--trophy-particle-size', `${2 + (index % 3)}px`);
    particle.style.setProperty('--trophy-particle-duration', `${660 + (index % 6) * 65}ms`);
    particle.style.setProperty('--trophy-particle-delay', `${(index % 8) * 23}ms`);
    dust.append(particle);
  }

  const hotspot = element('button', 'leader-trophy__hotspot');
  hotspot.type = 'button';
  hotspot.setAttribute('aria-expanded', 'false');
  const plaque = element('span', 'leader-trophy__plaque');
  plaque.hidden = true;
  plaque.setAttribute('role', 'status');
  const plaqueTitle = element('small');
  plaqueTitle.textContent = "Coupe d’or du Roi du Cochon";
  const plaqueHolder = element('strong');
  plaque.append(plaqueTitle, plaqueHolder);
  root.append(asset, halo, dust, hotspot, plaque);
  stage.append(root);

  let playerId = '';
  let matchKey = '';
  let celebrationKey = '';
  let plaqueTimer = 0;
  let celebrationTimer = 0;

  function setPlaque(open) {
    clearTimeout(plaqueTimer);
    plaque.hidden = !open;
    root.classList.toggle('is-plaque-open', open);
    hotspot.setAttribute('aria-expanded', String(open));
    if (open) plaqueTimer = setTimeout(() => setPlaque(false), 4200);
  }

  function enter() {
    replayClass(root, 'is-entering');
    const finishEntrance = event => {
      if (event.target !== root || event.animationName !== 'leaderTrophyEntrance') return;
      root.classList.remove('is-entering');
      root.removeEventListener('animationend', finishEntrance);
    };
    root.addEventListener('animationend', finishEntrance);
  }

  hotspot.addEventListener('pointerenter', () => root.classList.add('is-hovered'));
  hotspot.addEventListener('pointerleave', () => {
    root.classList.remove('is-hovered');
  });
  hotspot.addEventListener('click', event => {
    event.stopPropagation();
    setPlaque(plaque.hidden);
    onSound('trophy');
  });
  hotspot.addEventListener('keydown', event => event.stopPropagation());

  return {
    update({ player = null, matchKey: nextMatchKey = '', style = 'classic' } = {}) {
      const trophyAsset = style === 'luxe' ? LUXE_TROPHY_ASSET : TROPHY_ASSET;
      setOptimizedImage(asset, trophyAsset);
      if (!player) {
        root.hidden = true;
        playerId = '';
        matchKey = '';
        setPlaque(false);
        return;
      }
      const nextPlayerId = String(player.playerId ?? player.id ?? '');
      const name = String(player.name || 'Joueur');
      const normalizedMatchKey = String(nextMatchKey || '');
      const changed = root.hidden || nextPlayerId !== playerId || normalizedMatchKey !== matchKey;
      playerId = nextPlayerId;
      matchKey = normalizedMatchKey;
      root.hidden = false;
      root.dataset.playerId = playerId;
      plaqueHolder.textContent = `N° 1 du club · ${name}`;
      hotspot.setAttribute('aria-label', `Voir la Coupe d’or détenue par ${name}, numéro 1 du club`);
      if (changed) enter();
    },
    celebrate(key) {
      const nextKey = String(key || '');
      if (root.hidden || !nextKey || nextKey === celebrationKey) return;
      celebrationKey = nextKey;
      clearTimeout(celebrationTimer);
      replayClass(root, 'is-victory');
      setPlaque(true);
      celebrationTimer = setTimeout(() => root.classList.remove('is-victory'), 1850);
    },
    reset() {
      clearTimeout(plaqueTimer);
      clearTimeout(celebrationTimer);
      playerId = '';
      matchKey = '';
      celebrationKey = '';
      root.hidden = true;
      root.classList.remove('is-entering', 'is-hovered', 'is-victory', 'is-plaque-open');
      plaque.hidden = true;
    },
    element: root
  };
}
