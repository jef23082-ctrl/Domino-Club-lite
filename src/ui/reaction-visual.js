import { createWorkBeacon } from './work-beacon.js';

const PREMIUM_EFFECTS = new Set(['pig', 'applause', 'smallkeeper', 'cool', 'catherine', 'working']);
let visualSequence = 0;

const MARKUP = Object.freeze({
  pig: id => `
    <defs><linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff0a5"/><stop offset=".4" stop-color="#c58a2b"/><stop offset="1" stop-color="#4c2909"/></linearGradient><radialGradient id="${id}-black"><stop stop-color="#384039"/><stop offset="1" stop-color="#050807"/></radialGradient></defs>
    <ellipse class="prv-shadow" cx="50" cy="84" rx="33" ry="8"/><g class="prv-pig-head"><path class="prv-pig-ear prv-pig-ear--left" d="M27 35 15 15Q32 17 38 31Z"/><path class="prv-pig-ear prv-pig-ear--right" d="m73 35 12-20Q68 17 62 31Z"/><path fill="url(#${id}-black)" stroke="url(#${id}-gold)" stroke-width="4" d="M22 48Q22 24 50 22t28 26v18Q75 84 50 84T22 66Z"/><circle class="prv-eye" cx="38" cy="49" r="4"/><circle class="prv-eye" cx="62" cy="49" r="4"/><ellipse class="prv-pig-snout" cx="50" cy="66" rx="18" ry="12"/><ellipse cx="43" cy="66" rx="3" ry="4"/><ellipse cx="57" cy="66" rx="3" ry="4"/></g><ellipse class="prv-base" cx="50" cy="84" rx="31" ry="8"/>`,
  applause: id => `
    <defs><linearGradient id="${id}-ivory" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff9df"/><stop offset=".5" stop-color="#dfc99c"/><stop offset="1" stop-color="#9e7840"/></linearGradient><linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffe899"/><stop offset=".55" stop-color="#b77b23"/><stop offset="1" stop-color="#573009"/></linearGradient></defs>
    <ellipse class="prv-shadow" cx="50" cy="86" rx="34" ry="7"/><g class="prv-help-hand prv-help-hand--left"><path fill="url(#${id}-ivory)" stroke="#f5dca8" stroke-width="2" d="M43 76Q28 70 23 56L15 35q-2-7 4-9 5-1 8 7l5 11-1-24q0-7 6-7 6 0 7 7l2 35Z"/><path class="prv-cuff" fill="url(#${id}-gold)" d="M23 69h22v14H27Z"/></g><g class="prv-help-hand prv-help-hand--right"><path fill="url(#${id}-ivory)" stroke="#f5dca8" stroke-width="2" d="M57 76q15-6 20-20l8-21q2-7-4-9-5-1-8 7l-5 11 1-24q0-7-6-7-6 0-7 7l-2 35Z"/><path class="prv-cuff" fill="url(#${id}-gold)" d="M55 69h22l-4 14H55Z"/></g>`,
  smallkeeper: id => `
    <defs><linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff0a0"/><stop offset=".38" stop-color="#c08426"/><stop offset="1" stop-color="#4d2907"/></linearGradient><linearGradient id="${id}-ivory"><stop stop-color="#fff5d1"/><stop offset="1" stop-color="#c8a76a"/></linearGradient></defs>
    <ellipse class="prv-shadow" cx="50" cy="88" rx="35" ry="6"/><path class="prv-shield" fill="#07130f" stroke="url(#${id}-gold)" stroke-width="5" d="M50 8 86 22v27Q84 76 50 91 16 76 14 49V22Z"/><path fill="#153d2c" stroke="#d7af5f" stroke-width="1.5" d="M50 17 76 27v21Q73 67 50 79 27 67 24 48V27Z"/><g class="prv-small-dominoes"><g transform="translate(30 39) rotate(-8)"><rect width="17" height="31" rx="4" fill="url(#${id}-ivory)" stroke="#e9c87a"/><circle cx="8.5" cy="8" r="2"/><path d="M2 16h13" stroke="#9a691c"/></g><g transform="translate(43 32)"><rect width="17" height="35" rx="4" fill="url(#${id}-ivory)" stroke="#e9c87a"/><circle cx="8.5" cy="9" r="2"/><circle cx="5" cy="26" r="2"/><circle cx="12" cy="20" r="2"/><path d="M2 17h13" stroke="#9a691c"/></g><g transform="translate(58 39) rotate(8)"><rect width="17" height="31" rx="4" fill="url(#${id}-ivory)" stroke="#e9c87a"/><circle cx="8.5" cy="23" r="2"/><path d="M2 16h13" stroke="#9a691c"/></g></g>`,
  cool: id => `
    <defs><linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff1a0"/><stop offset=".4" stop-color="#c2882b"/><stop offset="1" stop-color="#472406"/></linearGradient><linearGradient id="${id}-black" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#3b453f"/><stop offset=".45" stop-color="#09110e"/><stop offset="1" stop-color="#010202"/></linearGradient></defs>
    <ellipse class="prv-shadow" cx="48" cy="88" rx="38" ry="6"/><g class="prv-knight"><path fill="url(#${id}-black)" stroke="url(#${id}-gold)" stroke-width="3.5" d="M24 78h58l7 10H14Zm12-4q5-18 3-31-1-13 10-22L44 9q18 3 29 17l-8 4q11 11 7 27-2 8 5 17Z"/><path fill="#101c16" stroke="#dcb564" stroke-width="2" d="M45 11q17 6 25 17l-17 7-13-7Z"/><circle cx="57" cy="25" r="2.8" fill="#ffcc57"/><path d="m68 38 18 5-16 6" fill="none" stroke="#e5bd68" stroke-width="3" stroke-linecap="round"/><path d="M35 72q17-10 33 0" fill="none" stroke="#ae7420" stroke-width="3"/></g>`,
  catherine: id => `
    <defs><linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff1a9"/><stop offset=".42" stop-color="#c68a2a"/><stop offset="1" stop-color="#4b2707"/></linearGradient><linearGradient id="${id}-ivory"><stop stop-color="#fff3ce"/><stop offset="1" stop-color="#b8945c"/></linearGradient></defs>
    <ellipse class="prv-shadow" cx="50" cy="89" rx="34" ry="6"/><g class="prv-cameo"><ellipse cx="48" cy="51" rx="31" ry="39" fill="#07100d" stroke="url(#${id}-gold)" stroke-width="5"/><ellipse cx="48" cy="51" rx="24" ry="32" fill="#17100b" stroke="#835b20"/><path fill="url(#${id}-ivory)" d="M54 28q-13 3-14 14 1 7-6 12l8 3q0 12 13 17l14-2q-8-8-7-17 9-7 4-17-3-8-12-10Z"/><path class="prv-crown" fill="url(#${id}-gold)" d="M30 18 35 4l11 11L55 2l8 14L76 7l-3 18H30Z"/><g class="prv-fan" transform="translate(48 67)"><path d="M0 0 35 19H-5Z" fill="#24180c" stroke="#d2a950" stroke-width="2"/><path d="M1 1 7 18M1 1l14 17M1 1l22 17M1 1l30 18" stroke="#d7b664" stroke-width="1"/></g></g>`
});

export function isPremiumReaction(effect) {
  return PREMIUM_EFFECTS.has(effect);
}

export function createReactionVisual(effect, { compact = false, active = true } = {}) {
  if (effect === 'working') return createWorkBeacon({ compact, active });
  const template = MARKUP[effect];
  if (!template) return null;
  const id = `reaction-visual-${++visualSequence}`;
  const visual = document.createElement('span');
  visual.className = `premium-reaction-visual effect-${effect}${compact ? ' is-compact' : ''}`;
  visual.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = template(id);
  const glint = document.createElement('span');
  glint.className = 'premium-reaction-glint';
  visual.append(svg, glint);
  return visual;
}
