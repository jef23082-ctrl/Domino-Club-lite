// Native popover supplies light-dismiss and top-layer positioning without
// persistent document listeners when the ranking page is rerendered.
export function createRankingArchivePicker({periods,value,onChange}) {
  const host=document.createElement('div');host.className='portal-ranking-archive';
  const trigger=document.createElement('button');trigger.type='button';trigger.className='online-action portal-ranking-archive-trigger';trigger.id='ranking-archive-trigger';
  const label=document.createElement('span');label.textContent='Ancien classement';
  const chevron=document.createElement('span');chevron.className='portal-ranking-archive-chevron';chevron.setAttribute('aria-hidden','true');chevron.textContent='⌄';trigger.append(label,chevron);
  const list=document.createElement('div');list.className='portal-ranking-archive-options';list.id='ranking-archive-options';list.setAttribute('popover','auto');list.setAttribute('role','listbox');list.setAttribute('aria-labelledby',trigger.id);
  trigger.setAttribute('popovertarget',list.id);trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',list.id);
  const choices=[...Object.values(periods.archives||{}).sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(item=>({value:item.id,label:item.label})),{value:'',label:periods.active?.label||'Classement actuel'}];
  const options=choices.map(choice=>{
    const option=document.createElement('button');option.type='button';option.className='portal-ranking-archive-option';option.textContent=choice.label;option.setAttribute('role','option');option.setAttribute('aria-selected',String(choice.value===value));option.tabIndex=-1;
    option.addEventListener('click',()=>{list.hidePopover();onChange(choice.value);document.getElementById(trigger.id)?.focus();});list.append(option);return option;
  });
  const focusSelected=()=>options.find(option=>option.getAttribute('aria-selected')==='true')?.focus();
  list.addEventListener('beforetoggle',event=>{if(event.newState!=='open')return;const rect=trigger.getBoundingClientRect();list.style.left=`${Math.max(4,Math.min(rect.left,innerWidth-rect.width-4))}px`;list.style.top=`${rect.bottom+8}px`;list.style.width=`${rect.width}px`;list.style.maxHeight=`${Math.max(60,Math.min(320,innerHeight-rect.bottom-16))}px`;});
  list.addEventListener('toggle',event=>{trigger.setAttribute('aria-expanded',String(event.newState==='open'));if(event.newState==='open')focusSelected();});
  trigger.addEventListener('keydown',event=>{if(!['ArrowDown','ArrowUp'].includes(event.key))return;event.preventDefault();if(!list.matches(':popover-open'))list.showPopover();focusSelected();});
  list.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();list.hidePopover();trigger.focus();return;}
    if(event.key==='Tab'){list.hidePopover();trigger.focus();return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();
    const i=options.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?options.length-1:(i+(event.key==='ArrowDown'?1:options.length-1))%options.length;options[next].focus();
  });
  host.append(trigger,list);return host;
}
