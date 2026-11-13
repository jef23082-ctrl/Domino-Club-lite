import { OpeningMascotState } from './opening-mascot-state.js?v=20261005T162819119';

const assets = new URL('../../assets/christmas/v58/domino/sleigh/', import.meta.url);
const DURATION = 3.9;
const WIDTH = 620;
const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => clamp(value) ** 2 * (3 - 2 * clamp(value));
const smooth = (from, to, value) => ease((value - from) / (to - from));
const sprite = (name, x, y, w, h) => ({ name, x, y, w, h, image: new Image() });

export function createChristmasSleigh({ stage, shell, onNose }) {
  const lifecycle = new OpeningMascotState();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const layer = document.createElement('div');
  layer.className = 'christmas-sleigh';
  layer.hidden = true;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const nose = document.createElement('button');
  nose.type = 'button';
  nose.className = 'opening-mascot__hotspot christmas-sleigh__nose';
  nose.setAttribute('aria-label', 'Toucher le groin du cochon');
  layer.append(canvas, nose);
  stage.append(layer);

  const ctx = canvas.getContext('2d');
  const lead = sprite('reindeer-lead', 15, 38, 135, 201);
  const near = sprite('reindeer-near', 92, 42, 143, 206);
  const sled = sprite('santa-sleigh', 264, 3, 346, 257);
  const sprites = [lead, near, sled];
  const particles = [];
  let phase = 'gone', shown = false, animation = 0, loaded = false;
  let flightAge = 0, lastAt = null, burstAt = 0, noseAt = -Infinity;

  function setPhase(next) {
    phase = next;
    layer.dataset.phase = next;
    layer.hidden = next === 'gone';
    nose.hidden = next !== 'idle';
  }

  function stop() {
    cancelAnimationFrame(animation);
    animation = 0;
    lastAt = null;
    particles.length = 0;
    shown = false;
    setPhase('gone');
  }

  function drawDeer(deer, clock, effort, offset) {
    const { image, x, y, w, h } = deer;
    const stride = Math.sin(clock * 12.5 + offset);
    const breathe = Math.sin(clock * 2.15 + offset) * .9;
    ctx.save();
    ctx.translate(x, y - effort * (4 + 6 * Math.abs(stride)));
    // Move the head and the gait through narrow, overlapping slices of the
    // original cutout so the harness and coat remain connected.
    const rows = 36;
    for (let row = 0; row < rows; row++) {
      const v = row / rows;
      const head = (1 - smooth(.18, .53, v)) * (breathe + effort * 4 * stride);
      const leg = smooth(.6, .97, v);
      const step = effort * stride + (1 - effort) * .09 * Math.max(0, Math.sin(clock * 2.8 + offset)) ** 9;
      const reach = step * leg * 12;
      const hoof = leg * (effort * 4 * Math.sin(clock * 12.5 + offset + 1.25) + (1 - effort) * step * 12);
      for (let side = 0; side < 2; side++) {
        const sw = image.naturalWidth / 2;
        const sh = Math.min(image.naturalHeight / rows + 2, image.naturalHeight * (1 - v));
        const bend = side ? -reach * .67 : reach;
        const legLift = side ? -hoof : hoof;
        ctx.drawImage(image, side * sw, image.naturalHeight * v, sw, sh,
          side * w / 2 + head + bend, v * h + legLift, w / 2, sh / image.naturalHeight * h + .3);
      }
    }
    ctx.restore();
  }

  function glow(x, y, radius, opacity) {
    const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
    light.addColorStop(0, `rgba(255,231,164,${opacity})`);
    light.addColorStop(.35, `rgba(255,179,59,${opacity * .43})`);
    light.addColorStop(1, 'rgba(255,163,40,0)');
    ctx.fillStyle = light;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function drawSled(clock, effort) {
    ctx.save();
    ctx.translate(sled.x, sled.y);
    const { image, w, h } = sled;
    const sway = Math.sin(clock * 3.4) * (effort * 2.6 + .65);
    const nod = Math.sin(clock * 2.1) * (1.2 + effort * 1.6);
    const stripHeight = image.naturalHeight / 48;
    for (let row = 0; row < 48; row++) {
      const v = row / 48;
      const sh = Math.min(stripHeight + 1, image.naturalHeight - row * stripHeight);
      const head = (1 - smooth(.17, .42, v)) * nod;
      ctx.drawImage(image, 0, row * stripHeight, image.naturalWidth, sh,
        head, v * h, w, sh / image.naturalHeight * h);
    }
    glow(w * .24 + sway, h * .32, 22, .52 + .21 * Math.sin(clock * 8) + .08 * Math.sin(clock * 13));
    glow(w * .94 - sway, h * .61, 23, .49 + .19 * Math.sin(clock * 6 + 1.4) + .11 * Math.sin(clock * 11.7));
    const blink = (clock + 2.1) % 6.7;
    if (blink < .16) {
      const closure = Math.sin(Math.PI * blink / .16);
      for (const [eyeX, eyeY, width] of [[.437, .196, 5], [.537, .215, 6]]) {
        ctx.fillStyle = '#ed9c7d';
        ctx.beginPath();
        ctx.ellipse(w * eyeX + nod, h * eyeY, width, 5 * closure, .16, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawRope(fromX, fromY, toY, tension) {
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.bezierCurveTo(fromX + 45, fromY + 17 * (1 - tension), 242, toY + 22 * (1 - tension), 301, toY);
    ctx.lineWidth = 4.6;
    ctx.strokeStyle = '#522a13';
    ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#e9b56c';
    ctx.stroke();
  }

  function drawTrail(dt, x, y, scale, effort, flight, age) {
    if (age < 3.1 && age - burstAt >= .025) {
      burstAt = age;
      for (let i = 0; i < 4; i++) particles.push({
        x: x + (430 + Math.random() * 163) * scale,
        y: y + (233 + Math.random() * 19) * scale,
        dx: (12 + Math.random() * 45 + flight * 54) * scale,
        dy: (-9 - Math.random() * 30 + flight * 41) * scale,
        r: (.7 + Math.random() * 2.1) * scale,
        life: .34 + Math.random() * .63,
      });
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.dx * dt;
      p.y += p.dy * dt;
      glow(p.x, p.y, p.r * 4, p.life * (.58 + effort * .4));
      ctx.fillStyle = `rgba(255,242,190,${p.life})`;
      ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
    }
  }

  function draw(now) {
    animation = 0;
    if (phase === 'gone' || shell.hidden || document.hidden || !loaded) return;
    const takingOff = phase === 'takeoff';
    const dt = lastAt === null ? 0 : Math.min(.08, Math.max(0, (now - lastAt) / 1000));
    lastAt = now;
    if (takingOff) flightAge += dt;
    const age = takingOff ? flightAge : 0;
    if (age >= DURATION) { stop(); return; }
    const width = stage.clientWidth, height = stage.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    const renderWidth = Math.round(width * dpr), renderHeight = Math.round(height * dpr);
    if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
      canvas.width = renderWidth;
      canvas.height = renderHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    const calm = reduced.matches;
    const clock = takingOff ? age : calm ? 0 : now / 1000;
    const effort = smooth(0, .74, age);
    const launch = smooth(.55, 1.95, age);
    const flight = clamp((age - 1.22) / 2.68) ** 1.48;
    const scale = Math.min(width * .445, height * .79) / WIDTH * (1 - flight * .53);
    const x = (width - WIDTH * scale) * .5 - width * (launch * .083 + flight * .52);
    const y = height * (.313 - launch * .048 - flight * .56)
      - (calm ? 0 : effort * 2 * Math.sin(age * 12));

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (flight < .58) {
      ctx.save();
      ctx.translate(315, 243);
      ctx.scale(1, .073);
      const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 292);
      shadow.addColorStop(0, `rgba(2,9,5,${.48 * (1 - launch * .7)})`);
      shadow.addColorStop(1, 'rgba(2,9,5,0)');
      ctx.fillStyle = shadow;
      ctx.fillRect(-292, -292, 584, 584);
      ctx.restore();
    }
    ctx.rotate(calm ? 0 : launch * .09 + flight * .13);
    const pull = effort * (4 + launch * 15);
    drawRope(125 - pull, 157, 165, effort);
    drawRope(204 - pull, 165, 177, effort);
    ctx.save();
    ctx.translate(-pull, -launch * 12);
    const gait = calm ? effort * .36 : effort;
    drawDeer(lead, clock, gait, .3);
    drawDeer(near, clock, gait, 1.85);
    ctx.restore();
    drawSled(clock, effort);
    ctx.restore();
    if (takingOff) {
      if (!calm) drawTrail(dt, x, y, scale, effort, flight, age);
    }
    else {
      shown = true;
      nose.style.left = `${x + (422 + Math.sin(clock * 2.1) * 1.2) * scale}px`;
      nose.style.top = `${y + 66 * scale}px`;
      nose.style.width = `${Math.max(24, 36 * scale)}px`;
      nose.style.height = `${Math.max(22, 29 * scale)}px`;
    }
    if (!calm || takingOff) animation = requestAnimationFrame(draw);
  }

  function wake() {
    if (phase === 'gone') return;
    if (shell.hidden || document.hidden) {
      cancelAnimationFrame(animation);
      animation = 0;
      lastAt = null;
      if (shell.hidden && phase === 'takeoff') stop();
      return;
    }
    if (loaded && !animation) animation = requestAnimationFrame(draw);
  }

  function loadSprites() {
    if (loaded || sprites[0].image.src) return;
    for (const part of sprites) part.image.src = new URL(part.name + '.webp', assets).href;
    Promise.all(sprites.map(part => part.image.decode())).then(() => {
      loaded = true;
      wake();
    }).catch(stop);
  }

  function update(room) {
    const action = lifecycle.update(room);
    if (action === 'hide') stop();
    if (action === 'start') {
      stop();
      setPhase('idle');
      loadSprites();
      wake();
    }
    if (action === 'finish') {
      if (shell.hidden) { stop(); return; }
      flightAge = 0;
      lastAt = null;
      burstAt = -.025;
      setPhase('takeoff');
      wake();
    }
  }

  const observer = new MutationObserver(wake);
  observer.observe(shell, { attributes: true, attributeFilter: ['hidden'] });
  const layout = new ResizeObserver(wake);
  layout.observe(stage);
  document.addEventListener('visibilitychange', wake);
  reduced.addEventListener('change', wake);
  nose.addEventListener('click', () => {
    if (phase !== 'idle' || !shown || performance.now() - noseAt < 350) return;
    noseAt = performance.now();
    onNose();
  });
  const reset = () => { lifecycle.reset(); stop(); };
  return {
    update,
    reset,
    dispose() {
      reset();
      observer.disconnect();
      layout.disconnect();
      document.removeEventListener('visibilitychange', wake);
      reduced.removeEventListener('change', wake);
      layer.remove();
    },
  };
}
