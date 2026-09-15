// Decorative vectors stay crisp when the reference composition scales.
const NS = 'http://www.w3.org/2000/svg';
export function homeOrnament(name) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', name === 'laurels' ? '0 0 320 220' : '0 0 64 48');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = (d, fill = 'none') => {
    const node = document.createElementNS(NS, 'path');
    node.setAttribute('d', d); node.setAttribute('fill', fill); svg.append(node);
  };
  if (name === 'crown') {
    path('M12 16 22 24 32 8 42 24 53 16 47 36H18Z', 'currentColor');
    path('M18 41H47');
    for (const [cx,cy] of [[12,13],[32,6],[53,13]]) {
      const dot=document.createElementNS(NS,'circle');dot.setAttribute('cx',cx);dot.setAttribute('cy',cy);dot.setAttribute('r','2');dot.setAttribute('fill','currentColor');svg.append(dot);
    }
  } else if (name === 'laurels') {
    for (const mirror of [false, true]) {
      const branch=document.createElementNS(NS,'g');
      if(mirror)branch.setAttribute('transform','translate(320 0) scale(-1 1)');
      svg.append(branch);
      const stem=document.createElementNS(NS,'path');stem.setAttribute('d','M105 208C42 188 11 136 34 55');branch.append(stem);
      for(let i=0;i<9;i++){
        const y=67+i*16, x=28+Math.pow((y-85)/24,2)*1.8;
        for(const side of [-1,1]){
          const leaf=document.createElementNS(NS,'path');
          leaf.setAttribute('d',`M${x} ${y+16}Q${x+side*24} ${y+7} ${x+side*15} ${y-10}Q${x+side*2} ${y-2} ${x} ${y+16}Z`);
          leaf.setAttribute('fill','currentColor');leaf.setAttribute('stroke','none');branch.append(leaf);
        }
      }
    }
  } else if(name === 'growth') {
    path('M10 39V28H19V39M27 39V20H36V39M44 39V9H53V39M7 40H56M12 22 31 13 49 3M42 3H50V11');
  } else if(name === 'person') {
    path('M40 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM17 41c0-17 30-17 30 0Z');
  } else if(name === 'settings') {
    svg.setAttribute('viewBox','0 0 24 24');
    path('m10 2 4 0 .7 3 2 .9 2.7-1 2 3.5-2.1 2 .1 2.3 2.1 2-2 3.5-2.7-1-2 .9-.8 3h-4l-.7-3-2-.9-2.7 1-2-3.5 2.1-2-.1-2.3-2.1-2 2-3.5 2.7 1 2-.9Z');
    path('M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z');
  }
  return svg;
}
