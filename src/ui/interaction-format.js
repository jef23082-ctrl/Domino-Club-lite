export const INTERACTION_FORMAT = Object.freeze({
  PERSONAL: 'personal',
  ROUTED: 'routed',
  MAJOR: 'major'
});

export function interactionFormat(value) {
  const kind = typeof value === 'string' ? value : value?.kind || value?.type;
  if (['pass', 'round-end', 'match-end', 'victory', 'boude'].includes(kind)) return INTERACTION_FORMAT.MAJOR;
  return kind === 'opponent' ? INTERACTION_FORMAT.ROUTED : INTERACTION_FORMAT.PERSONAL;
}

export function interactionDimensions({ format, seat = 'top', stageWidth = 1672 }) {
  const scale = Math.max(.55, Math.min(1.2, Number(stageWidth || 1672) / 1672));
  const base = format === INTERACTION_FORMAT.MAJOR ? 560 : format === INTERACTION_FORMAT.ROUTED ? 265 : 220;
  const seatFactor = seat === 'top' ? .94 : 1;
  return {
    maxWidth: Math.round(base * scale * seatFactor),
    maxHeight: Math.round((format === INTERACTION_FORMAT.MAJOR ? 320 : 190) * scale)
  };
}

export function applyInteractionFormat(element, { kind, type, seat, stage } = {}) {
  if (!element) return '';
  const format = interactionFormat(kind || type || element.dataset.kind);
  const dimensions = interactionDimensions({
    format,
    seat: seat || element.closest('.player-seat')?.dataset.seat || 'top',
    stageWidth: stage?.getBoundingClientRect?.().width || globalThis.innerWidth || 1672
  });
  element.dataset.interactionFormat = format;
  element.style.setProperty('--interaction-max-width', `${dimensions.maxWidth}px`);
  element.style.setProperty('--interaction-max-height', `${dimensions.maxHeight}px`);
  return format;
}
