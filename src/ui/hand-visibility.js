import { navigationIcon } from './navigation-icon.js?v=20261005T162819119';

// Deliberately kept in memory: concealment is a local viewing preference, not
// a room action, and must not follow another player or a different round.
export class HandVisibilityState {
  constructor() {
    this.key = '';
    this.available = false;
    this.hidden = false;
    this.locked = false;
  }

  reconcile({ key = '', available = false, locked = false } = {}) {
    const nextKey = String(key || '');
    const nextAvailable = Boolean(nextKey && available);
    if (nextKey !== this.key || !nextAvailable) this.hidden = false;
    this.key = nextKey;
    this.available = nextAvailable;
    this.locked = nextAvailable && locked;
    return this.effectiveHidden;
  }

  get effectiveHidden() { return this.hidden || this.locked; }

  toggle() {
    if (this.available && !this.locked) this.hidden = !this.hidden;
    return this.effectiveHidden;
  }

  reset() {
    this.key = '';
    this.available = false;
    this.hidden = false;
    this.locked = false;
  }
}

export function createHandVisibility({ stage, onChange = () => {} }) {
  const state = new HandVisibilityState();
  const button = stage.ownerDocument.createElement('button');
  button.id = 'hand-visibility-button';
  button.className = 'hand-visibility-button';
  button.type = 'button';
  button.setAttribute('aria-controls', 'player-hand');
  stage.insertBefore(button, stage.querySelector('#pass-button'));

  function render() {
    button.hidden = !state.available;
    button.disabled = !state.available || state.locked;
    const label = state.locked ? 'Main masquée pendant la pause « Je travaille »'
      : state.hidden ? 'Afficher mes dominos' : 'Masquer mes dominos';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(state.effectiveHidden));
    button.title = label;
    button.replaceChildren(navigationIcon(state.effectiveHidden ? 'eye-off' : 'eye'));
  }

  function toggle() {
    if (!state.available || state.locked) return;
    state.toggle();
    render();
    onChange(state.hidden);
  }

  button.addEventListener('click', toggle);
  render();
  return {
    get hidden() { return state.effectiveHidden; },
    reconcile(snapshot) { const hidden = state.reconcile(snapshot); render(); return hidden; },
    reset() { state.reset(); render(); },
    destroy() { button.removeEventListener('click', toggle); button.remove(); state.reset(); }
  };
}
