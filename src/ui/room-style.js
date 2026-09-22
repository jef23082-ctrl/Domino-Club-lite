import { ROOM_STYLES, roomStyle } from '../config/room-styles.js?v=20260922T005918368';
import { setOptimizedImage } from './image-source.js?v=20260922T005918368';

const NS = 'http://www.w3.org/2000/svg';

// Display masks retain the original player/chair pixels. Classic scene files
// remain untouched; only their surrounding old room is clipped in Luxe.
const SILHOUETTES = {
  top: 'M700 160 L701 110 Q706 69 787 61 L787 43 Q790 5 827 5 Q867 3 875 44 L875 63 Q934 69 938 110 L939 151 Q961 171 969 203 Q975 224 938 234 L876 241 L840 237 L823 243 L773 236 Q683 239 676 209 Q671 186 700 160Z',
  'top-hair': 'M700 160 L701 110 Q706 70 781 61 L780 41 Q782 4 807 1 Q841 -7 863 13 Q886 32 882 66 Q934 72 938 110 L939 151 Q961 171 969 203 Q975 227 938 239 L876 245 L840 242 L823 249 L773 242 Q683 245 676 214 Q671 186 700 160Z',
  'top-emmanuelle': 'M700 174 L702 125 Q710 87 766 83 L766 64 Q774 4 809 6 Q853 2 875 42 L883 79 L879 88 Q930 88 937 127 L940 167 Q968 196 969 225 Q962 248 879 254 L835 261 L798 258 L752 251 Q678 244 674 225 Q671 204 700 174Z',
  left: 'M0 269 Q22 247 54 244 L58 218 Q75 187 143 159 L143 104 Q145 64 181 62 Q217 55 239 88 L249 132 L247 157 Q271 165 289 179 Q332 194 367 226 Q397 250 400 291 L391 331 L358 359 L333 380 L284 392 L258 397 L222 412 L184 421 L111 445 L91 526 L69 525 Q17 480 0 415Z',
  'left-hair': 'M0 269 Q22 247 54 244 L57 217 Q73 189 138 165 L135 131 L136 90 Q143 63 153 49 Q175 41 199 47 Q232 45 245 76 L256 118 L255 158 Q282 171 303 185 Q345 209 372 239 Q400 260 400 298 L391 331 L358 359 L333 380 L284 392 L258 397 L222 412 L184 421 L111 445 L91 526 L69 525 Q17 480 0 415Z',
  'left-emmanuelle': 'M0 269 Q23 249 79 246 L84 239 Q96 226 113 218 L110 211 Q125 214 123 185 Q119 150 134 118 Q154 77 177 76 Q204 72 222 89 Q247 107 255 137 Q270 160 260 185 L257 195 L271 190 Q285 205 298 236 Q344 251 374 272 Q394 289 387 311 L371 340 L339 352 L325 370 L279 380 L248 381 L224 406 L190 416 L111 445 L91 526 L69 525 Q17 480 0 415Z',
  right: 'M1672 273 Q1643 249 1603 247 L1601 235 Q1573 205 1523 186 L1514 174 L1525 134 Q1533 97 1512 85 Q1487 66 1457 77 Q1421 80 1412 108 L1404 135 L1400 153 L1404 178 L1384 189 Q1344 210 1318 239 Q1281 260 1289 302 L1296 332 L1310 353 L1334 376 L1374 389 L1414 397 L1424 414 L1479 423 L1516 462 L1545 523 L1571 514 Q1630 468 1672 402Z',
  'right-bald': 'M1672 273 Q1642 249 1615 246 Q1597 213 1547 192 L1538 173 L1547 146 Q1558 105 1526 91 Q1496 78 1476 96 Q1455 107 1452 145 L1446 162 L1452 178 L1428 174 Q1404 180 1388 205 Q1341 239 1330 272 L1329 318 L1339 344 L1355 365 L1390 383 L1431 382 L1442 398 L1495 410 L1516 462 L1545 523 L1571 514 Q1630 468 1672 402Z',
  'right-emmanuelle': 'M1672 274 Q1643 249 1605 246 L1606 226 Q1591 210 1564 199 L1579 183 L1571 160 L1562 121 Q1552 65 1514 62 Q1474 57 1454 93 Q1437 115 1436 145 L1425 170 L1435 180 Q1390 192 1360 223 Q1307 238 1301 270 L1295 308 L1309 323 L1315 345 L1336 365 L1360 369 L1416 367 L1424 384 L1488 390 L1528 446 L1545 523 L1571 514 Q1630 468 1672 402Z'
};

function ensureMasks() {
  if (document.getElementById('room-player-masks')) return;
  const svg = document.createElementNS(NS, 'svg');
  svg.id = 'room-player-masks';
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  const defs = document.createElementNS(NS, 'defs');
  for (const [key, pathData] of Object.entries(SILHOUETTES)) {
    const clip = document.createElementNS(NS, 'clipPath');
    clip.id = `luxe-player-${key}`;
    clip.setAttribute('clipPathUnits', 'objectBoundingBox');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('transform', 'scale(0.0005980861244 0.0010626992561)');
    clip.append(path); defs.append(clip);
  }
  svg.append(defs); document.body.append(svg);
}

export function applyRoomStyle(value) {
  const style = roomStyle(value);
  const shell = document.getElementById('game-shell');
  const stage = document.getElementById('casino-stage');
  if (!shell || !stage) return;
  if (style === 'luxe') ensureMasks();
  shell.dataset.roomStyle = style;
  shell.dataset.tableLayout = 'club';
  stage.dataset.roomStyle = style;
  const background = stage.querySelector('.scene-base');
  if (background) setOptimizedImage(background, ROOM_STYLES[style].scene);
  document.body.classList.toggle('has-luxe-room', style === 'luxe');
}
