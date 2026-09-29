import { setOptimizedImage } from '../ui/image-source.js?v=20260929T190638113';

const SUIT_SYMBOLS = Object.freeze({ S: '♠', H: '♥', D: '♦', C: '♣' });
const SUIT_NAMES = Object.freeze({ S: 'pique', H: 'cœur', D: 'carreau', C: 'trèfle' });
const RANK_NAMES = Object.freeze({ A: 'As', K: 'Roi', Q: 'Dame', J: 'Valet', T: '10' });
const DISPLAY_RANK = Object.freeze({ T: '10' });
const COURT_RANKS = Object.freeze({ J: 'jack', Q: 'queen', K: 'king' });

function span(className, text) {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = text;
  return node;
}

export function cardLabel(card) {
  if (!card) return 'Carte face cachée';
  const rank = card[0], suit = card[1];
  return `${RANK_NAMES[rank] || rank} de ${SUIT_NAMES[suit] || 'couleur inconnue'}`;
}

export function createPokerCard(card, { hidden = false, small = false } = {}) {
  // Every face uses the same non-replaced frame. An illustration's intrinsic
  // aspect ratio must never resize a card in the board, hand or small seats.
  const faceDown = hidden || !card;
  const court = !faceDown && COURT_RANKS[card[0]];
  const node = document.createElement('span');
  node.className = `poker-card${small ? ' poker-card--small' : ''}${faceDown ? ' poker-card--back' : ''}${court ? ' poker-card--court-card' : ''}`;
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', faceDown ? 'Carte face cachée' : cardLabel(card));
  if (faceDown) return node;
  const rank = card[0], suit = card[1], symbol = SUIT_SYMBOLS[suit] || '♠';
  node.dataset.suit = suit;
  node.dataset.rank = rank;
  if (court) {
    const artwork = document.createElement('img');
    artwork.className = 'poker-card__artwork';
    setOptimizedImage(artwork, `./assets/poker-v29/${court}.png`);
    artwork.alt = ''; artwork.draggable = false;
    artwork.setAttribute('aria-hidden', 'true');
    node.append(artwork);
  } else {
    node.append(span('poker-card__single-suit', symbol));
  }
  const index = document.createElement('span');
  index.className = 'poker-card__index';
  index.append(span('', DISPLAY_RANK[rank] || rank), span('', symbol));
  const mirror = index.cloneNode(true);
  mirror.classList.add('poker-card__index--mirror');
  node.append(index, mirror);
  return node;
}

export function createChipStack(value, tone = 'green', { compact = false } = {}) {
  const wrapper = document.createElement('span');
  const amount = Math.max(0, Math.floor(Number(value || 0)));
  wrapper.className = `poker-chip-stack poker-chip-stack--${tone}${compact ? ' poker-chip-stack--compact' : ''}`;
  wrapper.setAttribute('aria-label', `${amount.toLocaleString('fr-FR')} jetons`);
  const denominations = [
    [5000, 'black'], [1000, 'red'], [100, 'green'], [1, 'gold']
  ];
  let remaining = amount, pileIndex = 0;
  for (const [denomination, pileTone] of denominations) {
    const count = Math.floor(remaining / denomination);
    if (!count) continue;
    remaining -= count * denomination;
    const pile = document.createElement('span');
    pile.className = `poker-chip-stack__pile poker-chip-stack__pile--${pileTone}`;
    pile.dataset.count = String(count); pile.dataset.denomination = String(denomination);
    pile.style.setProperty('--pile-index', String(pileIndex++));
    const image = document.createElement('img');
    const tier = count <= 2 ? 'low' : count <= 5 ? 'medium' : 'high';
    setOptimizedImage(image, `./assets/poker-v27/chips-${tier}.png`); image.alt = ''; image.draggable = false;
    pile.append(image); wrapper.append(pile);
  }
  if (!wrapper.childElementCount) {
    const image = document.createElement('img');
    setOptimizedImage(image, './assets/poker-v27/chips-low.png'); image.alt = ''; image.draggable = false;
    wrapper.append(image);
  }
  wrapper.dataset.piles = String(pileIndex || 1);
  return wrapper;
}
