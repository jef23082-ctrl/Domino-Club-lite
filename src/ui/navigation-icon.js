// Local vector equivalents of the principal page's house, globe, list, users, history and user-gear icons.
const PATHS = {
  domino: ['M6 2h12v20H6Z','M6 12h12','M9 6h.1M15 9h.1M9 16h.1M15 19h.1'],
  trophy: ['M7 3h10v7a5 5 0 0 1-10 0Z','M7 5H3v3a5 5 0 0 0 5 5M17 5h4v3a5 5 0 0 1-5 5','M12 15v6M8 22h8'],
  flame: ['M13 2c1 6-5 6-4 11 0 0-3-1-3-4-5 9 0 14 6 14 7 0 10-7 6-12 0 4-2 5-2 5 1-5-1-9-3-14Z','M12 14c-4 5-3 8 0 8s5-4 0-8Z'],
  percent: ['M19 5 5 19','M7.5 4.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z','M16.5 13.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z'],
  pig: ['M7 8 4 4v7a8 8 0 1 0 16 0V4l-4 4','M9 12h.1M15 12h.1','M9 16c2 2 4 2 6 0','M12 14v3'],
  create: ['M12 3a9 9 0 1 1-9 9 9 9 0 0 1 9-9Z','M12 8v8M8 12h8'],
  table: ['M8 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM22 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z','M1 21v-2a5 5 0 0 1 8-4M23 21v-2a5 5 0 0 0-8-4','M8 7c1-4 7-4 8 0M8 17c2-3 6-3 8 0'],
  chat: ['M4 5h16v11H9l-5 4Z'],
  play: ['M7 4l12 8-12 8Z'],
  finish: ['M5 3v18','M6 5h12l-3 4 3 4H6'],
  cancel: ['M5 5l14 14M19 5 5 19'],
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
