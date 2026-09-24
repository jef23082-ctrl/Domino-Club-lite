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
    artwork.src = `./assets/poker-v29/${court}.png`;
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
  wrapper.className = `poker-chip-stack poker-chip-stack--${tone}${compact ? ' poker-chip-stack--compact' : ''}`;
  wrapper.setAttribute('aria-label', `${Number(value || 0).toLocaleString('fr-FR')} jetons`);
  const image = document.createElement('img');
  const amount = Number(value || 0);
  const tier = amount <= 2500 ? 'low' : amount <= 12000 ? 'medium' : 'high';
  wrapper.dataset.tier = tier;
  image.src = `./assets/poker-v27/chips-${tier}.png`; image.alt = ''; image.draggable = false;
  wrapper.append(image);
  return wrapper;
}
