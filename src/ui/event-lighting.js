const boudeTimers = new WeakMap();

export function eventLightingFor(room, { seconds = null } = {}) {
  const game = room?.game;
  if (!room || !game) return 'idle';
  if (room.status === 'finished') return game.matchResult?.type === 'victory' ? 'victory' : 'finale';
  if (game.roundStatus === 'ended') return 'round-end';
  if (game.turnClock?.paused) return 'paused';
  if (Number.isFinite(seconds) && seconds <= 3) return 'danger';
  if (Number.isFinite(seconds) && seconds <= 5) return 'warning';
  return 'turn';
}

function setLightingState(stage, mode) {
  stage.dataset.effectLevel = ['victory', 'finale', 'round-end'].includes(mode)
    ? 'spectacular'
    : ['danger', 'warning', 'paused'].includes(mode) ? 'important' : 'discreet';
  if (['victory', 'finale', 'round-end'].includes(mode)) stage.dataset.spectacularEvent = mode;
  else delete stage.dataset.spectacularEvent;
}

export function applyEventLighting(stage, room, options) {
  const mode = eventLightingFor(room, options);
  if (stage) {
    stage.dataset.eventLighting = mode;
    if (!stage.classList.contains('is-boude-lighting')) setLightingState(stage, mode);
  }
  return mode;
}

export function clearBoudeLighting(stage) {
  if (!stage) return;
  clearTimeout(boudeTimers.get(stage));
  boudeTimers.delete(stage);
  stage.classList.remove('is-boude-lighting');
  setLightingState(stage, stage.dataset.eventLighting || 'idle');
}

export function pulseBoudeLighting(stage, duration = 2800) {
  if (!stage) return;
  clearTimeout(boudeTimers.get(stage));
  stage.classList.remove('is-boude-lighting');
  void stage.offsetWidth;
  stage.classList.add('is-boude-lighting');
  stage.dataset.effectLevel = 'spectacular';
  stage.dataset.spectacularEvent = 'boude';
  boudeTimers.set(stage, setTimeout(() => clearBoudeLighting(stage), duration));
}
