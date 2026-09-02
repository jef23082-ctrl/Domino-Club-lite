export function bindAppShell() {
  const panel = document.querySelector('#chat-panel');
  const toggle = document.querySelector('#chat-toggle');
  toggle.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('is-collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Déplier la discussion' : 'Replier la discussion');
  });
  const button = document.querySelector('#fullscreen-button');
  button.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.querySelector('#game-shell').requestFullscreen();
    } catch (_) { button.title = 'Le navigateur ne permet pas le plein écran dans ce contexte.'; }
  });
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? 'Quitter le plein écran' : 'Afficher en plein écran');
  });
}
