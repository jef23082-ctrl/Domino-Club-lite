import {announcementContent,announcementContentText,announcementImage,normalizeAnnouncementContent,MAX_IMAGE_BYTES,IMAGE_FORMATS} from '../services/club-announcement-content.js?v=20261001T025219457';
let editorSequence=0;
const clipboardType='application/x-domino-club-announcement';

export function renderAnnouncementContent(target,item) {
  target.replaceChildren();
  for(const part of announcementContent(item)){
    if(part.type==='text'){target.append(document.createTextNode(part.text.replace(/[\r\n]+/g,' ')));continue;}
    const image=document.createElement('img');image.className='club-info-inline-image';
    image.alt=part.alt;image.src=part.src;image.draggable=false;image.contentEditable='false';
    // Reserve the exact aspect ratio before decoding, so images loading cannot
    // shift the marquee distance or interrupt a running scroll.
    image.width=part.width;image.height=part.height;image.style.width=`${part.width/part.height}em`;image.style.height='1em';
    target.append(image);
  }
}

export function createAnnouncementEditor({onChange,onError,onLoading}) {
  const id=`club-info-message-editor-${++editorSequence}`;
  const field=document.createElement('div');field.className='club-info-field';
  const label=document.createElement('label');label.textContent='Message défilant';label.id=id+'-label';label.htmlFor=id;
  const input=document.createElement('div');input.className='club-info-rich-editor';input.id=id;input.setAttribute('name','text');input.setAttribute('role','textbox');input.setAttribute('aria-labelledby',label.id);input.setAttribute('aria-multiline','true');input.contentEditable='true';input.spellcheck=true;input.dataset.placeholder='Écrivez votre message ou collez une image ici…';
  const toolbar=document.createElement('div');toolbar.className='club-info-image-tools';
  const add=document.createElement('button');add.type='button';add.textContent='Ajouter une image';
  const file=document.createElement('input');file.type='file';file.accept=IMAGE_FORMATS;file.multiple=true;file.hidden=true;file.tabIndex=-1;file.setAttribute('aria-label','Images du message');
  const help=document.createElement('small');help.id=id+'-help';help.textContent='PNG, JPEG, GIF ou WebP · Ctrl+V accepté · 1 Mo par image, 2 Mo par message (8 images max.).';input.setAttribute('aria-describedby',help.id);
  toolbar.append(add,file,help);field.append(label,input,toolbar);
  let range=null,disabled=false,loading=false,disposed=false;
  function remember(){const selection=getSelection();if(selection?.rangeCount&&input.contains(selection.getRangeAt(0).commonAncestorContainer))range=selection.getRangeAt(0).cloneRange();}
  function endRange(){const next=document.createRange();next.selectNodeContents(input);next.collapse(false);return next;}
  function focusRange(){input.focus();const next=range&&input.contains(range.commonAncestorContainer)?range:endRange();const selection=getSelection();selection.removeAllRanges();selection.addRange(next);return next;}
  function read(element=input){
    const parts=[];
    const appendText=text=>{if(parts.at(-1)?.type==='text')parts.at(-1).text+=text;else parts.push({type:'text',text});};
    function visit(element){
      if(element.nodeType===Node.TEXT_NODE){appendText(element.textContent);return;}
      if(element.nodeType!==Node.ELEMENT_NODE)return;
      if(element.tagName==='IMG'){parts.push({type:'image',src:element.getAttribute('src'),alt:element.alt,width:Number(element.getAttribute('width')),height:Number(element.getAttribute('height'))});return;}
      if(element.tagName==='BR'){appendText('\n');return;}
      if(['SCRIPT','STYLE','IFRAME','OBJECT'].includes(element.tagName))return;
      if(['DIV','P'].includes(element.tagName)&&parts.length)appendText('\n');
      element.childNodes.forEach(visit);
    }
    element.childNodes.forEach(visit);return normalizeAnnouncementContent(parts);
  }
  function insert(parts){
    parts=normalizeAnnouncementContent(parts);
    const position=focusRange(),draft=input.cloneNode(true);
    const inDraft=element=>{const path=[];while(element!==input){path.unshift(Array.prototype.indexOf.call(element.parentNode.childNodes,element));element=element.parentNode;}return path.reduce((n,index)=>n.childNodes[index],draft);};
    const projected=document.createRange();projected.setStart(inDraft(position.startContainer),position.startOffset);projected.setEnd(inDraft(position.endContainer),position.endOffset);
    const container=document.createElement('span');renderAnnouncementContent(container,{content:parts});
    const fragment=document.createDocumentFragment();fragment.append(...container.childNodes);
    // Validate the result AFTER replacing the selection. A Ctrl+A paste must
    // not falsely count the old text/images twice, nor erase a draft on error.
    projected.deleteContents();projected.insertNode(fragment.cloneNode(true));read(draft);
    const last=fragment.lastChild;position.deleteContents();position.insertNode(fragment);
    if(last){position.setStartAfter(last);position.collapse(true);range=position.cloneRange();focusRange();}
    onChange();
  }
  function setDisabled(value){disabled=value;input.contentEditable=String(!disabled&&!loading);input.setAttribute('aria-disabled',String(disabled||loading));add.disabled=disabled||loading;}
  async function imageFromFile(source){
    if(!IMAGE_FORMATS.split(',').includes(source.type))throw new Error('Choisissez une image PNG, JPEG, GIF ou WebP.');
    if(source.size>MAX_IMAGE_BYTES)throw new Error('Cette image dépasse 1 Mo. Choisissez un fichier plus léger.');
    const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Impossible de lire cette image.'));reader.onload=()=>resolve(reader.result);reader.readAsDataURL(source);});
    announcementImage({src,width:1,height:1}); // Validate bytes before decoding.
    const image=new Image();image.src=src;
    try{await image.decode();}catch{throw new Error('Impossible d’ouvrir cette image. Choisissez un PNG, JPEG, GIF ou WebP valide.');}
    return announcementImage({src,alt:source.name||'Image collée',width:image.naturalWidth,height:image.naturalHeight});
  }
  async function importFiles(files){
    if(disabled||loading||disposed)return;remember();loading=true;setDisabled(disabled);onLoading(true);
    try{
      const parts=[];for(const source of files)parts.push(await imageFromFile(source));
      if(!disposed){loading=false;setDisabled(disabled);insert(parts);}
    }catch(error){if(!disposed)onError(error.message);}finally{loading=false;if(!disposed){setDisabled(disabled);onLoading(false);}}
  }
  add.addEventListener('pointerdown',remember);add.addEventListener('click',()=>{remember();file.click();});
  file.addEventListener('change',()=>{const files=Array.from(file.files||[]);file.value='';if(files.length)importFiles(files);});
  input.addEventListener('paste',event=>{
    event.preventDefault();if(disabled||loading)return;
    const rich=event.clipboardData?.getData(clipboardType);
    if(rich){remember();try{if(rich.length>3*1024*1024)throw new Error('Contenu copié trop volumineux.');insert(normalizeAnnouncementContent(JSON.parse(rich)));}catch(error){onError(error.message);}return;}
    const images=Array.from(event.clipboardData?.files||[]).filter(file=>file.type.startsWith('image/'));
    if(images.length){importFiles(images);return;}
    // Ignore clipboard formatting and scripts. The browser's clipboard image
    // files are read directly; arbitrary HTML is never inserted into the page.
    const text=event.clipboardData?.getData('text/plain')||'';
    if(text){remember();try{insert([{type:'text',text}]);}catch(error){onError(error.message);}}
    else onError('Copiez l’image elle-même ou utilisez « Ajouter une image ».');
  });
  function copy(event){
    if(disabled||loading||!event.clipboardData)return;remember();
    if(!range||range.collapsed)return;
    try{
      const fragment=range.cloneContents(),parts=read(fragment);
      if(!parts.some(part=>part.type==='image'))return;
      event.clipboardData.setData(clipboardType,JSON.stringify(parts));event.clipboardData.setData('text/plain',announcementContentText(parts));event.preventDefault();
      if(event.type==='cut'){range.deleteContents();range.collapse(true);focusRange();onChange();}
    }catch(error){event.preventDefault();onError(error.message);}
  }
  input.addEventListener('copy',copy);input.addEventListener('cut',copy);
  input.addEventListener('drop',event=>{event.preventDefault();if(!disabled&&!loading){remember();const files=Array.from(event.dataTransfer?.files||[]);if(files.length)importFiles(files);}});
  input.addEventListener('input',onChange);document.addEventListener('selectionchange',remember);
  return {field,input,read,plainText:()=>announcementContentText(read()),get loading(){return loading;},set(item){renderAnnouncementContent(input,item);range=endRange();},setDisabled,dispose(){disposed=true;document.removeEventListener('selectionchange',remember);}};
}
