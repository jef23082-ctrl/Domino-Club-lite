const STORAGE_KEY = 'domino-club-visual-quality';
export const VISUAL_QUALITY_OPTIONS = Object.freeze(['auto', 'premium', 'optimized']);

export function recommendedVisualQuality({ width = 1920, memory = 8, cores = 8, reducedMotion = false } = {}) {
  return reducedMotion || width <= 900 || memory <= 4 || cores <= 4 ? 'optimized' : 'premium';
}

function deviceProfile() {
  return {
    width: globalThis.innerWidth || 1920,
    memory: Number(globalThis.navigator?.deviceMemory || 8),
    cores: Number(globalThis.navigator?.hardwareConcurrency || 8),
    reducedMotion: Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  };
}

export function applyVisualQuality(preference = 'auto') {
  const selected = VISUAL_QUALITY_OPTIONS.includes(preference) ? preference : 'auto';
  const effective = selected === 'auto' ? recommendedVisualQuality(deviceProfile()) : selected;
  if (globalThis.document?.documentElement) {
    document.documentElement.dataset.visualQuality = effective;
    document.documentElement.dataset.visualQualityPreference = selected;
  }
  try { globalThis.localStorage?.setItem(STORAGE_KEY, selected); } catch {}
  return { preference: selected, effective };
}

export function bindVisualQuality(select = globalThis.document?.querySelector('#visual-quality')) {
  let saved = 'auto';
  try { saved = globalThis.localStorage?.getItem(STORAGE_KEY) || 'auto'; } catch {}
  const state = applyVisualQuality(saved);
  if (select) {
    select.value = state.preference;
    select.addEventListener('change', event => applyVisualQuality(event.currentTarget.value));
  }
  globalThis.addEventListener?.('resize', () => {
    if (document.documentElement.dataset.visualQualityPreference === 'auto') applyVisualQuality('auto');
  }, { passive: true });
  return state;
}
