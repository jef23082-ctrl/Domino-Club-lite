import { element, button } from './club-elements.js?v=20261004T170705413';
import { loungeTitle } from '../online/lounge-name.js?v=20261004T170705413';
import { isCancellableRoom } from '../config/room-cancellation.js?v=20261004T170705413';

export function confirmRoomCancellation(rooms, { preferredCode = '', choose = false } = {}) {
  return new Promise(resolve => {
    const candidates = rooms.filter(isCancellableRoom);
    const dialog = element('dialog', 'portal-dialog room-cancel-dialog');
    dialog.setAttribute('aria-label', 'Annuler la partie');
    const heading = element('h2', '', 'Annuler la partie ?');
    const description = element('p');
    const participants = element('p', 'portal-muted');
    const cancel = button(candidates.length ? 'Conserver la partie' : 'Fermer', () => dialog.close());
    let selected = candidates.find(room => room.code === preferredCode) || candidates[0] || null;
    let confirmed = null;
    const accept = button('Confirmer l’annulation', () => { confirmed = selected; dialog.close(); }, 'online-action--danger');
    accept.disabled = !selected;
    const describe = () => {
      if (!selected) {
        description.textContent = 'Aucun salon en attente ni aucune partie en cours à annuler.';
        participants.textContent = '';
        return;
      }
      heading.textContent = `Annuler ${loungeTitle(selected)} (${selected.code}) ?`;
      description.textContent = selected.status === 'waiting'
        ? 'Ce salon en attente sera fermé pour tous les joueurs.'
        : 'Cette partie sera arrêtée pour tous les joueurs, sans enregistrer de résultat ni attribuer de points.';
      const players = Array.isArray(selected.players) ? selected.players : Object.values(selected.players || {});
      participants.textContent = players.map(player => player.name).join(' · ');
    };
    dialog.append(heading);
    if (choose && candidates.length) {
      const label = element('label', 'online-label', 'Partie à annuler');
      const select = element('select', 'online-input');
      select.setAttribute('aria-label', 'Partie à annuler');
      for (const room of candidates) {
        const option = element('option', '', `${loungeTitle(room)} · ${room.code} · ${room.status === 'waiting' ? 'En attente' : 'En cours'}`);
        option.value = room.code;
        select.append(option);
      }
      select.value = selected.code;
      select.addEventListener('change', () => { selected = candidates.find(room => room.code === select.value); describe(); });
      label.append(select);
      dialog.append(label);
    }
    describe();
    dialog.append(description, participants, cancel, accept);
    dialog.addEventListener('close', () => { dialog.remove(); resolve(confirmed); }, { once: true });
    (document.fullscreenElement || document.querySelector('#app') || document.body).append(dialog);
    dialog.showModal();
    cancel.focus();
  });
}
