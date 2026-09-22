import { REACTION_ASSETS, reactionAssetUrl, reactionParticleUrl } from '../config/reaction-assets.js?v=20260922T161100427';
import { createWorkBeacon } from './work-beacon.js?v=20260922T161100427';
import { setOptimizedImage } from './image-source.js?v=20260922T161100427';

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
  setOptimizedImage(halo, reactionParticleUrl(5));
  halo.alt = '';

  const image = document.createElement('img');
  image.className = 'premium-reaction-image';
  setOptimizedImage(image, reactionAssetUrl(effect));
  image.alt = '';
  image.decoding = 'async';
  image.draggable = false;

  const glint = document.createElement('img');
  glint.className = 'premium-reaction-glint';
  setOptimizedImage(glint, reactionParticleUrl(4));
  glint.alt = '';
  glint.draggable = false;

  visual.append(halo, image, glint);
  return visual;
}

export function createReactionTrailParticle(index, className) {
  const particle = document.createElement('img');
  particle.className = className;
  setOptimizedImage(particle, reactionParticleUrl(index));
  particle.alt = '';
  particle.draggable = false;
  particle.setAttribute('aria-hidden', 'true');
  return particle;
}
