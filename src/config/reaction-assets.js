const asset = (file, motion) => Object.freeze({
  file: `../../assets/interactions/${file}.png`,
  motion
});

export const REACTION_ASSETS = Object.freeze({
  pig: asset('pig', 'bounce'),
  clock: asset('clock', 'pendulum'),
  loser: asset('loser', 'tease'),
  boss: asset('boss', 'float'),
  applause: asset('applause', 'plead'),
  smallkeeper: asset('smallkeeper', 'guard'),
  unplayable: asset('unplayable', 'fire'),
  pigforever: asset('pigforever', 'medal'),
  vivalgeria: asset('vivalgeria', 'radiant'),
  cvousquifait: asset('cvousquifait', 'point'),
  chattard: asset('chattard', 'lucky'),
  enculax: asset('enculax', 'mist'),
  sakamache: asset('sakamache', 'wave'),
  cuthead: asset('cuthead', 'chop'),
  cry: asset('cry', 'drop'),
  angry: asset('angry', 'shake'),
  happy: asset('happy', 'radiant'),
  panic: asset('panic', 'alarm'),
  doubtful: asset('doubtful', 'wobble'),
  cool: asset('cool', 'charge'),
  pray: asset('pray', 'hope'),
  thatsgood: asset('thatsgood', 'reveal'),
  hematte: asset('hematte', 'orbit'),
  toilet: asset('toilet', 'sparkle'),
  catherine: asset('catherine', 'royal'),
  papy: asset('papy', 'call'),
  suzanne: asset('suzanne', 'heartbeat'),
  food: asset('food', 'serve')
});

export const REACTION_PARTICLES = Object.freeze([
  '../../assets/interactions/particles/spark-fine.png',
  '../../assets/interactions/particles/gold-dust.png',
  '../../assets/interactions/particles/reflection-streak.png',
  '../../assets/interactions/particles/warm-ember.png',
  '../../assets/interactions/particles/star-glint.png',
  '../../assets/interactions/particles/soft-halo.png'
]);

export function reactionAssetUrl(effect) {
  const definition = REACTION_ASSETS[effect];
  return definition ? new URL(definition.file, import.meta.url).href : '';
}

export function reactionParticleUrl(index) {
  const file = REACTION_PARTICLES[Math.abs(Number(index) || 0) % REACTION_PARTICLES.length];
  return new URL(file, import.meta.url).href;
}
