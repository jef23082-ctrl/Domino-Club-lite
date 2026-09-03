import { element, button } from './club-elements.js';

export function premiumConfirm(title, description) {
  return new Promise(resolve => {
    const dialog=element('dialog','portal-dialog');dialog.setAttribute('aria-label',title);
    let confirmed=false;
    const cancel=button('Conserver la partie',()=>dialog.close());
    const accept=button('Confirmer l’annulation',()=>{confirmed=true;dialog.close();},'online-action--danger');
    dialog.append(element('h2','',title),element('p','',description),cancel,accept);
    dialog.addEventListener('close',()=>{dialog.remove();resolve(confirmed);},{once:true});
    (document.fullscreenElement||document.querySelector('#app')).append(dialog);
    dialog.showModal();cancel.focus();
  });
}
