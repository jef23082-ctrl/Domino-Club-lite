let audioContext = null;

function context() {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  return audioContext;
}

export function unlockSound() {
  const current = context();
  if (current?.state === 'suspended') current.resume().catch(() => {});
}

function tone(current, frequency, delay, duration, volume = .055, type = 'sine', endFrequency = frequency) {
  const start = current.currentTime + delay;
  const oscillator = current.createOscillator();
  const gain = current.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .015);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain).connect(current.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + .025);
}

function impact(current, delay, duration, frequency, volume) {
  const start = current.currentTime + delay;
  const frames = Math.max(1, Math.floor(current.sampleRate * duration));
  const buffer = current.createBuffer(1, frames, current.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / samples.length, 3.4);
  }
  const source = current.createBufferSource();
  const filter = current.createBiquadFilter();
  const gain = current.createGain();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(frequency, start);
  filter.Q.setValueAtTime(.8, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  source.connect(filter).connect(gain).connect(current.destination);
  source.start(start);
  source.stop(start + duration);
}

export function playSound(kind) {
  const current = context();
  if (!current || current.state !== 'running') return false;

  if (kind === 'placement') {
    impact(current, 0, .052, 1250, .27);
    impact(current, .055, .072, 760, .19);
  } else if (kind === 'message') {
    tone(current, 880, 0, .2, .045);
    tone(current, 1318.5, .09, .22, .04);
  } else if (kind === 'pass') {
    tone(current, 310, 0, .18, .05, 'triangle', 190);
    tone(current, 220, .13, .22, .04, 'triangle', 145);
  } else if (kind === 'victory') {
    [523.25, 659.25, 783.99].forEach((frequency, index) => tone(current, frequency, index * .11, .45, .06));
  } else if (kind === 'turn') {
    tone(current, 659.25, 0, .22, .04);
    tone(current, 783.99, .1, .3, .04);
  } else if (kind === 'pig') {
    tone(current, 238, .05, .34, .075, 'sawtooth', 126);
    tone(current, 205, .34, .3, .055, 'sawtooth', 118);
  } else if (String(kind).startsWith('reaction-')) {
    const effect = String(kind).slice(9);
    if (effect === 'clock') [0, .19, .38].forEach(delay => tone(current, 1150, delay, .055, .045, 'square'));
    else if (effect === 'pig') playSound('pig');
    else if (effect === 'boss' || effect === 'applause') [659.25, 783.99, 987.77].forEach((frequency, index) => tone(current, frequency, index * .08, .25, .045));
    else tone(current, 420, 0, .32, .05, 'triangle', 175);
  }
  return true;
}
