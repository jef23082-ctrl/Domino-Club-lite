const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomId(length = 10) {
  const values = new Uint32Array(length);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
  else values.forEach((_, index) => { values[index] = Math.floor(Math.random() * 0xffffffff); });
  return Array.from(values, value => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join('');
}
