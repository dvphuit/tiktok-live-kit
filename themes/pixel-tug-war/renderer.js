// Procedural pixel-art scene. Internal resolution 540x960, scaled 2x without smoothing.
const W = 540;
const H = 960;
const RED = { dark: '#641c32', main: '#e53c54', light: '#ff9c94', metal: '#fff0b1' };
const BLUE = { dark: '#133c83', main: '#397ddd', light: '#9ee9ff', metal: '#e5f7ff' };

const rect = (c, x, y, w, h, color) => {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
const outline = (c, x, y, w, h, color, frame = 2) => {
  rect(c, x, y, w, h, color);
  rect(c, x + frame, y + frame, w - frame * 2, h - frame * 2, '#0000');
};
const rand = (n) => {
  const v = Math.sin(n * 127.1 + 15.7) * 43758.5453;
  return v - Math.floor(v);
};

function pixelCloud(c, x, y, size = 1, alpha = 1) {
  c.globalAlpha = alpha;
  rect(c, x + 12 * size, y, 65 * size, 14 * size, '#dceeff');
  rect(c, x + 2 * size, y + 12 * size, 104 * size, 18 * size, '#f3fbff');
  rect(c, x + 24 * size, y - 11 * size, 51 * size, 16 * size, '#f5fbff');
  rect(c, x + 11 * size, y + 27 * size, 92 * size, 7 * size, '#b4d7f6');
  c.globalAlpha = 1;
}

function battlement(c, x, y, w, h, seed = 0) {
  rect(c, x - 3, y - 11, w + 6, 13, '#202e61');
  rect(c, x, y, w, h, '#58658c');
  rect(c, x + 4, y, w - 8, h, '#8996b0');
  for (let i = 0; i < Math.floor(w / 15); i++) {
    rect(c, x + i * 15, y - 21, 10, 13, '#69779b');
    rect(c, x + i * 15 + 2, y - 20, 5, 8, '#a3aec1');
  }
  for (let row = 0; row < h / 18; row++) {
    let off = row % 2 ? 9 : 0;
    for (let px = off; px < w - 6; px += 22) {
      rect(c, x + px, y + row * 18 + 8, 14, 2, '#495875');
      if (rand(seed + row * 17 + px) > 0.77) rect(c, x + px + 7, y + row * 18 + 10, 3, 4, '#427a70');
    }
  }
  rect(c, x + 6, y + 10, 3, h - 10, '#e0e4cd');
}

function pennant(c, x, y, side, t) {
  const p = side === 'red' ? RED : BLUE;
  rect(c, x, y, 3, 108, '#302b47');
  rect(c, x + 1, y, 2, 108, '#dbc691');
  rect(c, x - 4, y - 6, 12, 8, '#f5c758');
  const flap = Math.sin(t * 0.0025 + x) * 5;
  rect(c, x + 4, y + 4, 41 + flap, 25, p.dark);
  rect(c, x + 7, y + 6, 34 + flap, 19, p.main);
  rect(c, x + 14, y + 9, 14, 5, '#ffd16d');
  rect(c, x + 18, y + 14, 5, 10, '#ffd16d');
  rect(c, x + 42 + flap, y + 15, 8, 10, p.main);
}

function drawBackdrop(c) {
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#101735'); sky.addColorStop(0.20, '#255bb0');
  sky.addColorStop(0.48, '#8cc1ed'); sky.addColorStop(0.70, '#597386');
  sky.addColorStop(1, '#12152c');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 55; i++) {
    const x = Math.floor(rand(i + 3) * W), y = Math.floor(rand(i + 44) * 250);
    rect(c, x, y, i % 4 === 0 ? 3 : 2, 2, i % 2 ? '#a3ccfd' : '#ecf4ff');
  }
  pixelCloud(c, 20, 102, 1.6, 0.8);
  pixelCloud(c, 300, 145, 1.8, 0.85);
  pixelCloud(c, 170, 199, 1.1, 0.65);
  rect(c, 0, 345, 540, 110, '#758ca3');
  for (let i = 0; i < 9; i++) battlement(c, i * 65 - 4, 315 + i % 3 * 8, 67, 143, i);
  battlement(c, -19, 251, 94, 250, 21);
  battlement(c, 463, 250, 96, 250, 67);
  battlement(c, 71, 311, 399, 195, 33);
  rect(c, 235, 412, 70, 97, '#283351');
  rect(c, 247, 395, 47, 114, '#29374d');
  rect(c, 251, 398, 39, 103, '#1a2441');
  rect(c, 259, 406, 23, 2, '#8492a8');
  for (let i = 0; i < 5; i++) {
    rect(c, 259 + i * 7, 432, 2, 69, '#303957');
  }
  rect(c, 0, 485, W, 240, '#64865d');
  rect(c, 0, 499, W, 27, '#86a469');
  // Arena sand and stone border
  rect(c, 13, 516, 514, 129, '#393c53');
  rect(c, 18, 513, 502, 119, '#c5ad72');
  rect(c, 27, 521, 485, 101, '#ead1a0');
  for (let i = 0; i < 74; i++) {
    const x = 32 + rand(100 + i) * 474;
    const y = 526 + rand(200 + i) * 99;
    rect(c, x, y, 4 + rand(i) * 5, i % 2 + 1, rand(i + 45) > 0.5 ? '#c9a66f' : '#f6e3b1');
  }
  // Stone wall below stage
  rect(c, 0, 644, W, 34, '#455574');
  rect(c, 0, 649, W, 8, '#8591a4');
  for (let i = 0; i < 30; i++) rect(c, (i * 19) % W, 664 + (i % 2) * 3, 11, 2, '#273452');
  // Dark audience pit below the arena, TikTok's native chat overlays this part.
  const pit = c.createLinearGradient(0, 660, 0, 960);
  pit.addColorStop(0, '#394c66'); pit.addColorStop(0.2, '#171d38'); pit.addColorStop(1, '#0a1029');
  c.fillStyle = pit; c.fillRect(0, 676, W, 284);
  for (let i = 0; i < 38; i++) {
    const x = rand(i * 5 + 5) * W, y = 708 + rand(i * 7 + 9) * 130;
    rect(c, x, y, 10, 8, i % 2 ? '#4d335d' : '#29354d');
    rect(c, x - 5, y + 6, 20, 20, i % 2 ? '#322845' : '#18243e');
    if (i % 5 === 0) rect(c, x + 3, y + 3, 3, 2, '#ffcf74');
  }
}

function pixelKnight(c, x, feet, scale, team, index, t, winner, phase) {
  const p = team === 'red' ? RED : BLUE;
  c.save();
  const wobble = Math.sin(t * 0.012 + index * 1.7 + (team === 'red' ? 0 : 1)) * (phase === 'playing' ? 1.8 : 0.7);
  const lift = phase === 'intermission' && team === winner ? Math.abs(Math.sin(t * 0.01 + index)) * 5 : 0;
  c.translate(Math.round(x), Math.round(feet - lift + wobble));
  if (team === 'blue') c.scale(-scale, scale);
  else c.scale(scale, scale);
  c.translate(-18, -51);
  // 36x50 pixel character; four-tone armor with deliberately chunky silhouette.
  rect(c, 6, 40, 12, 9, '#202338');
  rect(c, 21, 40, 12, 9, '#202338');
  rect(c, 8, 40, 9, 7, '#5d6272');
  rect(c, 22, 40, 9, 7, '#5d6272');
  rect(c, 2, 21, 33, 23, '#161d36');
  rect(c, 5, 23, 28, 17, p.dark);
  rect(c, 8, 24, 23, 15, p.main);
  rect(c, 11, 25, 17, 4, p.light);
  rect(c, 12, 29, 15, 8, p.dark);
  rect(c, 16, 31, 7, 5, '#ffd887');
  // Cape and sash
  rect(c, 1, 24, 6, 18, p.dark);
  rect(c, 4, 40, 8, 6, p.main);
  rect(c, 11, 36, 20, 4, '#edbb65');
  // Arms reaching toward rope
  rect(c, 28, 28, 11, 8, '#1a2134');
  rect(c, 31, 29, 8, 6, p.light);
  rect(c, 37, 29, 8, 6, '#f6bb82');
  rect(c, 4, 28, 6, 13, '#293252');
  rect(c, 5, 29, 5, 8, p.light);
  // Helmet/head
  rect(c, 9, 3, 20, 22, '#1a1f36');
  rect(c, 10, 8, 18, 14, '#f0ba8f');
  rect(c, 14, 15, 11, 3, '#283044');
  rect(c, 10, 3, 18, 11, p.dark);
  rect(c, 13, 2, 15, 9, p.main);
  rect(c, 15, 3, 6, 3, p.light);
  rect(c, 7, 11, 7, 14, p.dark);
  rect(c, 26, 11, 7, 14, p.dark);
  rect(c, 10, 22, 20, 4, '#8e909b');
  rect(c, 13, 25, 14, 2, '#e8dcb5');
  if (index === 0) {
    rect(c, 17, -9, 4, 10, '#ffdc75');
    rect(c, 12, -6, 14, 3, '#ffdc75');
    rect(c, 11, -11, 4, 5, '#ffc655');
    rect(c, 22, -11, 4, 5, '#ffc655');
  }
  c.restore();
}

function rope(c, position, t) {
  const knotX = 270 + position * 87;
  const y = 492 + Math.sin(t * 0.01) * 1;
  c.lineCap = 'square';
  c.strokeStyle = '#241c29'; c.lineWidth = 12;
  c.beginPath(); c.moveTo(189, y + 1); c.quadraticCurveTo(knotX, y + 5, 352, y); c.stroke();
  c.strokeStyle = '#cf903e'; c.lineWidth = 8;
  c.beginPath(); c.moveTo(189, y); c.quadraticCurveTo(knotX, y + 3, 352, y); c.stroke();
  c.strokeStyle = '#ffe49b'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(193, y - 2); c.quadraticCurveTo(knotX, y, 350, y - 2); c.stroke();
  for (let x = 193; x < 347; x += 10) rect(c, x, y - 3, 3, 9, '#9d582b');
  rect(c, knotX - 7, y - 13, 16, 23, '#3d2a24');
  rect(c, knotX - 4, y - 11, 10, 21, '#ffd067');
  rect(c, knotX - 10, y + 3, 21, 7, '#b4783b');
  rect(c, knotX - 3, y + 10, 7, 15, '#e4a64f');
  rect(c, knotX, y + 13, 3, 10, '#ffe9a2');
}

export function createRenderer(canvas) {
  const c = canvas.getContext('2d', { alpha: false });
  canvas.width = W; canvas.height = H;
  c.imageSmoothingEnabled = false;
  const staticCanvas = document.createElement('canvas');
  staticCanvas.width = W; staticCanvas.height = H;
  const staticCtx = staticCanvas.getContext('2d');
  staticCtx.imageSmoothingEnabled = false;
  drawBackdrop(staticCtx);
  const particles = [];

  function effect(event) {
    if (!['push', 'boost', 'gift', 'finish', 'round'].includes(event.type)) return;
    const count = event.type === 'boost' || event.type === 'finish' ? 48 : event.type === 'gift' ? 30 : 7;
    for (let i = 0; i < count; i++) {
      const angle = rand(Date.now() + i) * Math.PI * 2;
      const speed = 0.3 + rand(i + Date.now()) * 1.9;
      particles.push({
        x: event.team === 'red' ? 175 + rand(i) * 80 : event.team === 'blue' ? 335 + rand(i) * 80 : 270,
        y: 455 + rand(2 * i) * 60,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.4,
        life: 45 + Math.floor(rand(i + 4) * 40), maxLife: 90,
        color: event.team === 'red' ? ['#ffe38b', '#ff6591', '#fff6be'][i % 3] : ['#a8eeff', '#7ca9ff', '#fff6be'][i % 3],
      });
    }
    if (particles.length > 200) particles.splice(0, particles.length - 200);
  }

  let prev = 0;
  function render(state, time = performance.now()) {
    const dt = Math.min(45, Math.max(0, time - (prev || time))); prev = time;
    c.clearRect(0, 0, W, H);
    c.drawImage(staticCanvas, 0, 0);
    // Time-dependent background decoration
    pixelCloud(c, ((time * 0.005) % 700) - 120, 250, 0.7, 0.25);
    pennant(c, 39, 264, 'red', time);
    pennant(c, 448, 264, 'blue', time);
    // Background crowd, dust and shadows.
    for (let i = 0; i < 17; i++) {
      const x = 35 + i * 29;
      const bob = Math.sin(time * 0.004 + i) * 2;
      rect(c, x, 511 + bob, 10, 11, i % 2 ? '#8f786d' : '#506587');
      rect(c, x - 4, 522 + bob, 19, 11, i % 2 ? '#61616b' : '#405576');
    }
    // Center field gradient glow
    const glow = c.createRadialGradient(270, 504, 5, 270, 504, 220);
    glow.addColorStop(0, '#fff1bf60'); glow.addColorStop(1, '#fff1bf00');
    c.fillStyle = glow; c.fillRect(26, 413, 490, 225);
    rope(c, state.position, time);
    for (let i = 0; i < 4; i++) {
      pixelKnight(c, [68, 113, 158, 198][i], 538 + (i % 2) * 6, 2.05, 'red', i, time, state.winner, state.phase);
      pixelKnight(c, [350, 393, 438, 478][i], 538 + (i % 2) * 6, 2.05, 'blue', i, time, state.winner, state.phase);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt / 17; p.y += p.vy * dt / 17; p.vy += 0.035 * dt / 17;
      p.life -= dt / 17;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      c.globalAlpha = Math.min(1, p.life / 28);
      rect(c, p.x, p.y, p.life > 30 ? 4 : 2, p.life > 30 ? 4 : 2, p.color);
    }
    c.globalAlpha = 1;
    // Left/red and right/blue castle pennants just above the arena.
    rect(c, 38, 419, 3, 75, '#2e3049');
    rect(c, 41, 422, 28, 30, '#ae233e');
    rect(c, 44, 425, 22, 19, '#ed3e58');
    rect(c, 487, 419, 3, 75, '#2e3049');
    rect(c, 459, 422, 28, 30, '#133887');
    rect(c, 462, 425, 22, 19, '#267bea');
  }

  return { render, effect, width: W, height: H };
}