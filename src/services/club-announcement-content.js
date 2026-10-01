// Images live in the existing announcement, not a second storage service.
// Bound payloads to protect the shared database and preserve animation bytes.
export const MAX_IMAGE_BYTES=1024*1024;
export const MAX_CONTENT_IMAGE_BYTES=2*1024*1024;
export const MAX_CONTENT_IMAGES=8;
export const IMAGE_FORMATS='image/png,image/jpeg,image/gif,image/webp';

export function announcementImage(value) {
  const src=String(value?.src??''),match=/^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(src);
  if(!match||match[2].length%4)throw new Error('Choisissez une image PNG, JPEG, GIF ou WebP.');
  const size=match[2].length*3/4-(match[2].endsWith('==')?2:match[2].endsWith('=')?1:0);
  if(size>MAX_IMAGE_BYTES)throw new Error('Chaque image doit faire au maximum 1 Mo.');
  const head=atob(match[2].slice(0,32)),mime=match[1];
  const valid=mime==='image/png'?head.startsWith('\x89PNG\r\n\x1a\n'):mime==='image/jpeg'?head.startsWith('\xff\xd8\xff'):mime==='image/gif'?/^GIF8[79]a/.test(head):head.startsWith('RIFF')&&head.slice(8,12)==='WEBP';
  if(!valid)throw new Error('Le fichier ne correspond pas à un format d’image autorisé.');
  const width=Number(value.width),height=Number(value.height);
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>32768||height>32768)throw new Error('Dimensions de l’image invalides.');
  return {type:'image',src,alt:String(value.alt||'Image').slice(0,160),width,height};
}

export function normalizeAnnouncementContent(value) {
  if(!Array.isArray(value)||value.length>64)throw new Error('Contenu du message invalide (64 éléments maximum).');
  const result=[];let images=0,bytes=0,textLength=0;
  for(const part of value){
    if(part?.type==='text'){
      if(typeof part.text!=='string')throw new Error('Texte du message invalide.');
      textLength+=part.text.length;if(textLength>1200)throw new Error('Le texte doit contenir au maximum 1 200 caractères.');
      if(!part.text)continue;
      if(result.at(-1)?.type==='text')result.at(-1).text+=part.text;else result.push({type:'text',text:part.text});
    }else if(part?.type==='image'){
      const image=announcementImage(part),encoded=image.src.slice(image.src.indexOf(',')+1);images++;bytes+=encoded.length*3/4-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0);
      if(images>MAX_CONTENT_IMAGES)throw new Error('Un message peut contenir au maximum 8 images.');
      if(bytes>MAX_CONTENT_IMAGE_BYTES)throw new Error('Les images d’un message doivent totaliser moins de 2 Mo.');
      result.push(image);
    }else throw new Error('Élément de message non autorisé.');
  }
  return result;
}

export const announcementContentText=content=>content.map(part=>part.type==='text'?part.text:'🖼').join('').trim();

// Read old text-only announcements and safely fall back if an invalid record
// arrives from a different client. Never render HTML or remote image URLs.
export function announcementContent(item) {
  if(item?.content!==undefined){try{return normalizeAnnouncementContent(item.content);}catch{/* safe text fallback */}}
  return [{type:'text',text:String(item?.text||'')}];
}
