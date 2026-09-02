// Historical records keep their original IDs and content. Only their labels change.
export function displayName(value) {
  return String(value ?? '').replace(/\bChristopher\b/gi, 'Cris');
}
