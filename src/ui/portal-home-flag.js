import { createFlagClothRenderer } from './flag-cloth-renderer.js?v=58-r12';
import { PLAYER_TERRITORIES } from '../config/lounge-cities.js';
import { knownCharacterIdForProfile } from '../online/profile-map.js';

const ASSETS = new URL('../../assets/christmas/v58/domino/flags/', import.meta.url);
const FLAGS = {
  'Algérie': 'algeria',
  Bulgarie: 'bulgarie',
  Corse: 'corsica',
  France: 'france',
  Guadeloupe: 'guadeloupe',
  Maroc: 'morocco',
  Martinique: 'martinique',
  Suriname: 'suriname',
};

const WIDTH = 216;
const HEIGHT = 440;
const STRIPS = 128;

function clothPoint(u, v, time, strength) {
  const phase = 8 * u - 3.6 * time + 1.6 * v;
  const wave = Math.sin(phase) + .27 * Math.sin(15 * u - 5.1 * time + 2.2 * v);
  const breeze = .86 + .14 * Math.sin(.87 * time);
  const drift = strength * breeze * u ** 1.25;
  const lift = Math.sin(1.37 * time);
  return {
    x: 65 - 20 * v * (1 - u) + u * (108 + 18 * v) + drift * (10 * wave + 5 * lift),
    y: 70 + 178 * v + u * (129 - 46 * v) + 12 * Math.sin(Math.PI * u)
      + drift * (20 * wave + 9 * lift),
  };
}

function polygon(ctx, ...points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
}

function drawTriangle(ctx, image, sx, sw, origin, along, down, reverse = false) {
  const centerX = (origin.x + along.x + down.x) / 3;
  const centerY = (origin.y + along.y + down.y) / 3;
  const expanded = [origin, along, down].map(({ x, y }) => ({
    x: x + .65 * Math.sign(x - centerX),
    y: y + .65 * Math.sign(y - centerY),
  }));
  ctx.save();
  polygon(ctx, ...expanded);
  ctx.clip();
  const direction = reverse ? -1 : 1;
  const h = image.naturalHeight;
  ctx.transform(
    direction * (along.x - origin.x) / sw, direction * (along.y - origin.y) / sw,
    direction * (down.x - origin.x) / h, direction * (down.y - origin.y) / h,
    origin.x, origin.y,
  );
  // Sample beyond the strip so the expanded clip covers its antialiased seams.
  ctx.drawImage(image, -sx - (reverse ? sw : 0), reverse ? -h : 0);
  ctx.restore();
}

function stitchEdge(ctx, points, fringe) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.strokeStyle = '#704219';
  ctx.lineWidth = fringe ? 4.5 : 3;
  ctx.stroke();
  ctx.strokeStyle = '#e0b65c';
  ctx.lineWidth = fringe ? 2.5 : 1.5;
  ctx.stroke();
}

function renderCloth(ctx, image, time, strength = 1) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  if (!image?.naturalWidth) return;
  const top = [], bottom = [];
  for (let i = 0; i <= STRIPS; i++) {
    top.push(clothPoint(i / STRIPS, 0, time, strength));
    bottom.push(clothPoint(i / STRIPS, 1, time, strength));
  }
  ctx.save();
  ctx.shadowColor = '#140b02a8';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 5;
  polygon(ctx, ...top, ...bottom.slice().reverse());
  ctx.fillStyle = '#241a10';
  ctx.fill();
  ctx.restore();

  const sw = image.naturalWidth / STRIPS;
  for (let i = 0; i < STRIPS; i++) {
    const a = top[i], b = top[i + 1], c = bottom[i], d = bottom[i + 1];
    drawTriangle(ctx, image, i * sw, sw, a, b, c);
    drawTriangle(ctx, image, i * sw, sw, d, c, b, true);
    const u = (i + .5) / STRIPS;
    const sheen = .8 * Math.cos(8 * u - 3.6 * time + .8)
      + .2 * Math.cos(15 * u - 5.1 * time + 1.1);
    polygon(ctx, a, b, d, c);
    ctx.fillStyle = sheen < 0 ? `rgba(21, 11, 5, ${.19 - sheen * .36})`
      : `rgba(255, 228, 172, ${sheen * .2})`;
    ctx.fill();
  }

  const farEdge = Array.from({ length: 25 }, (_, i) => clothPoint(1, i / 24, time, strength));
  stitchEdge(ctx, top, false);
  stitchEdge(ctx, [top[0], bottom[0]], false);
  stitchEdge(ctx, farEdge, true);
  stitchEdge(ctx, bottom, true);
  for (const [index, edge] of [bottom, farEdge].entries()) {
    for (let i = 1; i < edge.length; i++) {
      const a = edge[i - 1], b = edge[i];
      for (let thread = 0; thread < 3; thread++) {
        const along = thread / 3;
        const x = a.x + (b.x - a.x) * along, y = a.y + (b.y - a.y) * along;
        const length = 5 + Math.sin(12 * i + 3 * thread) * 1.7;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (index ? length * .67 : -1.3), y + length);
        ctx.strokeStyle = ['#eac577', '#af7836', '#f3d28b'][thread];
        ctx.lineWidth = .8;
        ctx.stroke();
      }
    }
  }
}

export function createPortalHomeFlag() {
  const root = document.createElement('figure');
  root.className = 'portal-home-flag';
  root.setAttribute('role', 'img');
  const stand = document.createElement('img');
  stand.className = 'portal-home-flag__stand';
  stand.alt = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'portal-home-flag__cloth';
  canvas.width = WIDTH * 3;
  canvas.height = HEIGHT * 3;
  root.append(stand, canvas);
  const cloth = createFlagClothRenderer(canvas);
  const ctx = cloth ? null : canvas.getContext('2d');
  ctx?.scale(3, 3);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let file = '', image, frame = 0, lastDraw = -Infinity;

  function animate(now) {
    frame = 0;
    if (!root.isConnected) return;
    if (now - lastDraw >= 16) {
      const reduced = motion.matches;
      const draw = cloth ? cloth.draw : (image,time,strength) => renderCloth(ctx,image,time,strength);
      draw(image, now / 1000 * (reduced ? .65 : 1), reduced ? .34 : 1);
      lastDraw = now;
    }
    frame = requestAnimationFrame(animate);
  }

  function pause() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  return {
    pause,
    mount(container, profile) {
      const territory = PLAYER_TERRITORIES[knownCharacterIdForProfile(profile)];
      const next = FLAGS[territory] || '';
      if (!next) {
        pause();
        root.remove();
        return;
      }
      root.setAttribute('aria-label', `Drapeau · ${territory}`);
      root.dataset.territory = territory;
      if (next !== file) {
        stand.src ||= new URL('stand.webp', ASSETS).href;
        file = next;
        image = new Image();
        image.src = new URL(`${file}.png`, ASSETS).href;
      }
      container.append(root);
      if (!frame && container.getClientRects().length) frame = requestAnimationFrame(animate);
    },
    dispose() {
      pause();
      cloth?.dispose();
      root.remove();
    },
  };
}
