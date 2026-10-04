import { navigationIcon } from './navigation-icon.js?v=20261004T170705413';

// Deliberately kept in memory: concealment is a local viewing preference, not
// a room action, and must not follow another player or a different round.
export class HandVisibilityState {
  constructor() {
    this.key = '';
    this.available = false;
    this.hidden = false;
  }

  reconcile({ key = '', available = false } = {}) {
    const nextKey = String(key || '');
    const nextAvailable = Boolean(nextKey && available);
    if (nextKey !== this.key || !nextAvailable) this.hidden = false;
    this.key = nextKey;
    this.available = nextAvailable;
    return this.hidden;
  }

  toggle() {
    if (this.available) this.hidden = !this.hidden;
    return this.hidden;
  }

  reset() {
    this.key = '';
    this.available = false;
    this.hidden = false;
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
    button.disabled = !state.available;
    const label = state.hidden ? 'Afficher mes dominos' : 'Masquer mes dominos';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(state.hidden));
    button.title = label;
    button.replaceChildren(navigationIcon(state.hidden ? 'eye-off' : 'eye'));
  }

  function toggle() {
    if (!state.available) return;
    state.toggle();
    render();
    onChange(state.hidden);
  }

  button.addEventListener('click', toggle);
  render();
  return {
    get hidden() { return state.hidden; },
    reconcile(snapshot) { state.reconcile(snapshot); render(); return state.hidden; },
    reset() { state.reset(); render(); },
    destroy() { button.removeEventListener('click', toggle); button.remove(); state.reset(); }
  };
}
