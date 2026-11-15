const PORTRAIT_WIDTH = 1672;
const PORTRAIT_HEIGHT = 941;
const SPRITE_SIZE = 230;
const SPRITE_FRAMES = 13;
const SEAT_POINTS = { left: [310, 338], top: [814, 231], right: [1350, 365] };
// Coordinates of the fingertips in each portrait, ordered left, top, right.
const FINGERTIPS = {
  thomas: [[315, 337], [805, 225], [1325, 359]],
  khalil: [[327, 347], [818, 222], [1335, 365]],
  eddy: [[318, 344], [819, 233], [1360, 362]],
  alexis: [[313, 370], [817, 238], [1326, 438]],
  cedric: [[316, 327], [821, 246], [1355, 359]],
  christopher: [[316, 336], [822, 228], [1306, 367]],
  'jean-claude': [[266, 353], [826, 235], [1334, 365]],
  emmanuelle: [[308, 362], [819, 247], [1349, 361]],
  ryad: [[263, 341], [823, 235], [1350, 345]],
  kyllian: [[291, 355], [820, 227], [1334, 345]]
};
const THOMAS_CROPS = { left: [166, 228], top: [707, 92], right: [1225, 244] };
const SEATS = ['left', 'top', 'right'];
const thomasSprites = new Map();

export function prepareThrowGestures() {
  for (const seat of SEATS) {
    if (thomasSprites.has(seat)) continue;
    const sprite = new Image();
    sprite.src = new URL(`../../assets/interactions/domino-throw/thomas-${seat}.webp`, import.meta.url);
    thomasSprites.set(seat, sprite);
  }
}

export function throwOrigin(stage, portrait, seat) {
  const fingertip = FINGERTIPS[portrait?.dataset.characterId]?.[SEATS.indexOf(seat)] || SEAT_POINTS[seat];
  if (!fingertip) return null;
  const [x, y] = fingertip;
  const rect = portrait?.getBoundingClientRect();
  const fit = portrait && getComputedStyle(portrait).objectFit;
  if (!rect?.width || !rect.height) {
    const table = stage.getBoundingClientRect();
    return new DOMPoint(table.left + x / PORTRAIT_WIDTH * table.width, table.top + y / PORTRAIT_HEIGHT * table.height);
  }
  // Classic portraits may be letterboxed, while Luxe cutouts fill the canvas.
  if (fit === 'contain' && portrait.naturalWidth && portrait.naturalHeight) {
    const scale = Math.min(rect.width / portrait.naturalWidth, rect.height / portrait.naturalHeight);
    const width = portrait.naturalWidth * scale;
    const height = portrait.naturalHeight * scale;
    return new DOMPoint(rect.left + (rect.width - width) / 2 + x / PORTRAIT_WIDTH * width,
      rect.top + (rect.height - height) / 2 + y / PORTRAIT_HEIGHT * height);
  }
  return new DOMPoint(rect.left + x / PORTRAIT_WIDTH * rect.width, rect.top + y / PORTRAIT_HEIGHT * rect.height);
}

export function createThrowGesture(portrait, seat) {
  if (!portrait?.complete || !portrait.naturalWidth || !SEAT_POINTS[seat]) return null;
  const canvas = document.createElement('canvas');
  canvas.className = `${portrait.className} domino-throw-wrist`;
  canvas.width = PORTRAIT_WIDTH;
  canvas.height = PORTRAIT_HEIGHT;
  canvas.dataset.characterId = portrait.dataset.characterId;
  canvas.dataset.renderMode = portrait.dataset.renderMode;
  canvas.toggleAttribute('data-full-side-portrait', portrait.hasAttribute('data-full-side-portrait'));
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d');
  if (!context) return null;

  const initialSource = portrait.currentSrc;
  const isThomas = portrait.dataset.characterId === 'thomas' && portrait.dataset.renderMode === 'cutout';
  const sprite = isThomas && thomasSprites.get(seat);
  const hasSprite = sprite?.complete && sprite.naturalWidth === SPRITE_SIZE * SPRITE_FRAMES;
  const [handX, handY] = FINGERTIPS[portrait.dataset.characterId]?.[SEATS.indexOf(seat)] || SEAT_POINTS[seat];
  const patch = document.createElement('canvas');
  patch.width = 124;
  patch.height = 94;
  const patchContext = !hasSprite && patch.getContext('2d');
  if (!hasSprite && !patchContext) return null;
  const mask = patchContext && patchContext.createRadialGradient(62, 47, 8, 62, 47, 45);
  if (mask) {
    mask.addColorStop(0, 'black');
    mask.addColorStop(.58, 'black');
    mask.addColorStop(1, 'transparent');
  }
  const patchX = handX - 62;
  const patchY = handY - 47;
  const direction = seat === 'left' ? 1 : seat === 'right' ? -1 : 0;
  let previousFrame = -1;
  let shown = false;

  function restore() {
    if (!shown) return;
    canvas.remove();
    portrait.classList.remove('domino-throw-portrait');
    shown = false;
  }

  return {
    draw(amount) {
      if (amount <= 0 || !portrait.isConnected || portrait.currentSrc !== initialSource) {
        restore();
        return;
      }
      const frame = Math.round(amount * (SPRITE_FRAMES - 1));
      if (shown && frame === previousFrame) return;
      previousFrame = frame;
      context.clearRect(0, 0, PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
      context.drawImage(portrait, 0, 0, PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
      if (hasSprite) {
        const [x, y] = THOMAS_CROPS[seat];
        context.clearRect(x, y, SPRITE_SIZE, SPRITE_SIZE);
        context.drawImage(sprite, frame * SPRITE_SIZE, 0, SPRITE_SIZE, SPRITE_SIZE, x, y, SPRITE_SIZE, SPRITE_SIZE);
      } else {
        // Only the photographed hand gets a short rigid turn. Feather it back
        // into the stationary portrait so the wrist stays attached to the sleeve.
        patchContext.clearRect(0, 0, patch.width, patch.height);
        patchContext.save();
        patchContext.translate(62 + direction * amount * 4, 47 + amount * 3);
        patchContext.rotate((direction || -1) * amount * .075);
        patchContext.drawImage(portrait, -handX, -handY, PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
        patchContext.restore();
        patchContext.globalCompositeOperation = 'destination-in';
        patchContext.fillStyle = mask;
        patchContext.fillRect(0, 0, patch.width, patch.height);
        patchContext.globalCompositeOperation = 'source-over';
        context.save();
        context.translate(patchX, patchY);
        context.globalCompositeOperation = 'destination-out';
        const cutout = context.createRadialGradient(62, 47, 8, 62, 47, 45);
        cutout.addColorStop(0, 'black');
        cutout.addColorStop(.58, 'black');
        cutout.addColorStop(1, 'transparent');
        context.fillStyle = cutout;
        context.fillRect(0, 0, patch.width, patch.height);
        context.globalCompositeOperation = 'source-over';
        context.drawImage(patch, 0, 0);
        context.restore();
      }
      if (!shown) {
        portrait.after(canvas);
        portrait.classList.add('domino-throw-portrait');
        shown = true;
      }
    },
    restore
  };
}
