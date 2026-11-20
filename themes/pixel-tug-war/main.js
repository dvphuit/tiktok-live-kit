import { createGame } from './game-engine.js';
import { createRenderer } from './renderer.js';

const params = new URLSearchParams(location.search);
const stage = $('stage');
const renderer = createRenderer($('world'));
const saveKey = 'pixel-tug-war:session:v1';
const game = createGame({
  onEffect(event) {
    renderer.effect(event);
    if (event.message) {
      $('battle-toast').textContent = event.message;
      if (event.type === 'gift') $('gift-notice').textContent = '🎁 ' + event.message;
    }
  },
});

try {
  const stored = sessionStorage.getItem(saveKey);
  if (stored) game.restore(JSON.parse(stored));
} catch { /* Browser source may disable storage; gameplay can still continue. */ }

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}
function layout() {
  const ratio = Math.min(innerWidth / 1080, innerHeight / 1920);
  stage.style.transform = 'scale(' + ratio + ')';
  stage.style.left = (innerWidth - 1080 * ratio) / 2 + 'px';
  stage.style.top = (innerHeight - 1920 * ratio) / 2 + 'px';
}
addEventListener('resize', layout);
layout();

function update() {
  const s = game.state;
  const leftWidth = Math.max(0, Math.min(100, (1 - s.position) * 50));
  $('round').textContent = s.round;
  $('countdown').textContent = formatTime(s.endsAt - Date.now());
  $('round-caption').textContent = s.phase === 'playing' ? 'KÉO CO!' : 'NGHỈ GIỮA HIỆP';
  $('red-score').textContent = s.pushes.red.toLocaleString('vi-VN');
  $('blue-score').textContent = s.pushes.blue.toLocaleString('vi-VN');
  $('red-players').textContent = s.participants.red.toLocaleString('vi-VN');
  $('blue-players').textContent = s.participants.blue.toLocaleString('vi-VN');
  $('red-wins').textContent = s.wins.red;
  $('blue-wins').textContent = s.wins.blue;
  $('meter-red').style.width = leftWidth + '%';
  $('meter-knot').style.left = leftWidth + '%';
  $('.meter')?.setAttribute('aria-valuenow', String(Math.round(s.position * 100)));
  $('red-energy').style.width = (s.energy.red / 2) + '%';
  $('blue-energy').style.width = (s.energy.blue / 2) + '%';
  const board = $('leaders');
  board.replaceChildren();
  const leaders = game.leaderboard(5);
  if (!leaders.length) {
    const empty = document.createElement('li');
    empty.textContent = 'Comment RED hoặc BLUE để tham gia';
    board.append(empty);
  }
  for (const [i, player] of leaders.entries()) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.className = 'player';
    const dot = document.createElement('span');
    dot.className = 'team-dot' + (player.team === 'blue' ? ' blue' : '');
    dot.textContent = '◆';
    label.append(document.createTextNode((i + 1) + '. '), dot, document.createTextNode(' ' + player.name));
    const points = document.createElement('span');
    points.className = 'points';
    points.textContent = '⚡' + player.score;
    li.append(label, points);
    board.append(li);
  }
}
function $(selector) {
  // Support both IDs and selector strings while keeping DOM text safe.
  return selector.startsWith('.') ? document.querySelector(selector) : document.getElementById(selector);
}

const live = window.Live;
if (live) {
  live.on('chat', (event) => game.handleChat(event));
  live.on('gift', (event) => game.handleGift(event));
  live.on('reset', () => game.reset());
  live.on('streamEnd', () => {
    $('battle-toast').textContent = 'LIVE ĐÃ KẾT THÚC';
  });
  live.on('ready', () => {
    // Never overwrite local game state with kit's unrelated generic leaderboard.
    // A server-side game engine is the required upgrade for multi-overlay sync.
  });
}

let demoTimer = null;
let demoSequence = 0;
const demoPlayers = [];
function fakeUser(team) {
  const id = 'bot-' + demoSequence++;
  const user = { id, name: ['minhkhai','catmew','ducanh','thaomy','ngoctram','hoangduy','anhkhoa','bichngoc'][demoSequence % 8] + demoSequence };
  game.join(user, team);
  demoPlayers.push(user);
  return user;
}
function fakePush() {
  if (demoPlayers.length < 2) {
    fakeUser('red');
    fakeUser('blue');
  }
  const user = demoPlayers[Math.floor(Math.random() * demoPlayers.length)];
  if (user) game.push(user);
}
function demoAction(name) {
  if (name === 'red' || name === 'blue') fakeUser(name);
  if (name === 'push') fakePush();
  if (name === 'boost') {
    const user = demoPlayers[Math.floor(Math.random() * demoPlayers.length)];
    if (user) game.boost(user);
  }
  if (name === 'gift') game.handleGift({ user: { id: 'demo-gifter', name: 'Demo Fan' }, gift: { name: 'Rose' }, count: 10 });
  if (name === 'reset') {
    game.reset(); demoPlayers.length = 0;
  }
  if (name === 'auto') {
    if (demoTimer) { clearInterval(demoTimer); demoTimer = null; }
    else demoTimer = setInterval(() => {
      if (demoPlayers.length < 15 && Math.random() > 0.65) fakeUser(Math.random() < 0.5 ? 'red' : 'blue');
      fakePush();
    }, 350);
  }
}
if (params.has('demo')) {
  const controls = $('dev-controls');
  controls.hidden = false;
  controls.addEventListener('click', (ev) => {
    const key = ev.target?.dataset?.demo;
    if (key) demoAction(key);
  });
  for (let i = 0; i < 7; i++) fakeUser('red');
  for (let i = 0; i < 7; i++) fakeUser('blue');
  demoAction('auto');
}
if (params.has('safe')) document.querySelector('.safe-outline').hidden = false;

let lastUI = 0;
let lastSave = 0;
let running = true;
function frame(t) {
  if (!running) return;
  game.tick();
  renderer.render(game.state, t);
  if (t - lastUI > 200) { update(); lastUI = t; }
  if (t - lastSave > 3000) {
    lastSave = t;
    try { sessionStorage.setItem(saveKey, JSON.stringify(game.snapshot())); } catch { /* nonfatal */ }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('pagehide', () => {
  running = false;
  if (demoTimer) clearInterval(demoTimer);
  try { sessionStorage.setItem(saveKey, JSON.stringify(game.snapshot())); } catch { /* nonfatal */ }
});
