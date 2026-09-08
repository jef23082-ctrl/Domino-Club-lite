import { REACTION_ASSETS, reactionAssetUrl, reactionParticleUrl } from '../config/reaction-assets.js?v=20260908T233254904';
import { createWorkBeacon } from './work-beacon.js?v=20260908T233254904';

export function isPremiumReaction(effect) {
  return effect === 'working' || Boolean(REACTION_ASSETS[effect]);
}

export function createReactionVisual(effect, { compact = false, active = true } = {}) {
  if (effect === 'working') return createWorkBeacon({ compact, active });
  const definition = REACTION_ASSETS[effect];
  if (!definition) return null;

  const visual = document.createElement('span');
  visual.className = `premium-reaction-visual effect-${effect} motion-${definition.motion}${compact ? ' is-compact' : ''}`;
  visual.setAttribute('aria-hidden', 'true');

  const halo = document.createElement('img');
  halo.className = 'premium-reaction-halo';
  halo.src = reactionParticleUrl(5);
  halo.alt = '';

  const image = document.createElement('img');
  image.className = 'premium-reaction-image';
  image.src = reactionAssetUrl(effect);
  image.alt = '';
  image.decoding = 'async';
  image.draggable = false;

  const glint = document.createElement('img');
  glint.className = 'premium-reaction-glint';
  glint.src = reactionParticleUrl(4);
  glint.alt = '';
  glint.draggable = false;

  visual.append(halo, image, glint);
  return visual;
}

export function createReactionTrailParticle(index, className) {
  const particle = document.createElement('img');
  particle.className = className;
  particle.src = reactionParticleUrl(index);
  particle.alt = '';
  particle.draggable = false;
  particle.setAttribute('aria-hidden', 'true');
  return particle;
}
