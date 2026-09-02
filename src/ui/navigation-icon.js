// Local vector equivalents of the principal page's house, globe, list, users, history and user-gear icons.
const PATHS = {
  home: ['M3 10.5 12 3l9 7.5','M5 9v11h5v-7h4v7h5V9'],
  online: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z','M3 12h18','M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z'],
  ranking: ['M9 5h12M9 12h12M9 19h12','M3 4h1v3M2.5 11c0-2 4-2 3 0l-3 3h3M3 18h2l-1 1c3 0 2 3-1 2'],
  profiles: ['M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z','M5 21v-2a7 7 0 0 1 14 0v2Z','M18 5a3 3 0 0 1 1 6M21 14c2 1 2 4 2 6M6 5a3 3 0 0 0-1 6M3 14c-2 1-2 4-2 6'],
  history: ['M3 10a9 9 0 1 1 1 7','M3 3v7h7','M12 7v6l4 2'],
  admin: ['M12 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z','M2 21v-3a7 7 0 0 1 10-6','M21 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z','M17 15v4M15 17h4M17 11v2M17 21v2M11 17h2M21 17h2']
};
export function navigationIcon(name) {
  const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');
  for(const [key,value]of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.65','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(key,value);
  for(const d of PATHS[name]||[]){const path=document.createElementNS(ns,'path');path.setAttribute('d',d);svg.append(path);}return svg;
}
