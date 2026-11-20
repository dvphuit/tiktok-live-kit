// Pixel Tug War overlay — server-authoritative during LIVE, isolated local simulation with ?demo.
// The renderer is deliberately pure and has no access to LIVE credentials.
import { createGame } from './game-engine.js';
import { createRenderer } from './renderer.js';

const el = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const demoMode = params.has('demo');
const stage = el('stage');
const renderer = createRenderer(el('world'));
const demoGame = demoMode ? createGame({ onEffect: showEffect }) : null;
const demoPlayers = [];
let gameView = null;
let lastBoardSignature = '';
let fakeSeq = 0;
let autoTimer = null;
let lastUiAt = 0;
let previousFrame = 0;
const fallbackState = {
  phase: 'waiting', round: 1, endsAt: Date.now(),
  position: 0, winner: null,
  pushes: { red: 0, blue: 0 },
  participants: { red: 0, blue: 0 },
  energy: { red: 0, blue: 0 },
  wins: { red: 0, blue: 0 },
};

function showEffect(event) {
  if (!event) return;
  renderer.effect(event);
  if (event.message) {
    el('battle-toast').textContent = event.message;
    if (event.type === 'gift') el('gift-notice').textContent = '🎁 ' + event.message;
  }
}
function setGameView(game) {
  if (demoMode || !game?.state) return;
  gameView = game;
  if (game.notice) el('battle-toast').textContent = game.notice;
}
function layout() {
  const ratio = Math.min(innerWidth / 1080, innerHeight / 1920);
  stage.style.left = (innerWidth - 1080 * ratio) / 2 + 'px';
  stage.style.top = (innerHeight - 1920 * ratio) / 2 + 'px';
  stage.style.transform = 'scale(' + ratio + ')';
}
addEventListener('resize', layout);
layout();

const live = window.Live;
if (!demoMode && live) {
  live.on('ready', ({ game }) => setGameView(game));
  live.on('gameState', setGameView);
  live.on('gameEffect', showEffect);
  live.on('streamEnd', () => { el('battle-toast').textContent = 'LIVE ĐÃ KẾT THÚC'; });
  // A control-panel reset broadcasts a fresh gameState shortly afterward.
  live.on('reset', () => { lastBoardSignature = ''; });
}

const colorize = (team) => team === 'blue' ? 'blue' : 'red';
function renderLeaders(leaders) {
  const signature = JSON.stringify(leaders.map(({ id, score, team, name }) => [id, score, team, name]));
  if (signature === lastBoardSignature) return;
  lastBoardSignature = signature;
  const board = el('leaders');
  board.replaceChildren();
  if (!leaders.length) {
    const entry = document.createElement('li');
    entry.textContent = 'Chưa có chiến binh';
    board.append(entry);
    return;
  }
  for (const [i, player] of leaders.slice(0, 3).entries()) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.className = 'player';
    const dot = document.createElement('span');
    dot.className = 'team-dot' + (colorize(player.team) === 'blue' ? ' blue' : '');
    dot.textContent = '◆';
    label.append(document.createTextNode(String(i + 1) + '. '), dot, document.createTextNode(' ' + String(player.name || 'Ẩn danh')));
    const points = document.createElement('span');
    points.className = 'points';
    points.textContent = '⚡' + Number(player.score || 0);
    li.append(label, points);
    board.append(li);
  }
}
function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}
function updateHUD() {
  const data = demoMode ? { state: demoGame.state, leaders: demoGame.leaderboard(3) } : gameView;
  const s = data?.state || fallbackState;
  const power = Math.min(100, Math.max(0, 50 - s.position * 50));
  el('round').textContent = s.round;
  el('countdown').textContent = s.phase === 'waiting' ? '--:--' : formatTime(s.endsAt - Date.now());
  el('round-caption').textContent = s.phase === 'waiting' ? 'ĐANG KẾT NỐI' :
    s.phase === 'playing' ? (live && !live.connected && !demoMode ? 'MẤT KẾT NỐI' : 'KÉO CO!') : 'NGHỈ GIỮA HIỆP';
  el('red-score').textContent = Number(s.pushes.red).toLocaleString('vi-VN');
  el('blue-score').textContent = Number(s.pushes.blue).toLocaleString('vi-VN');
  el('red-players').textContent = Number(s.participants.red).toLocaleString('vi-VN');
  el('blue-players').textContent = Number(s.participants.blue).toLocaleString('vi-VN');
  el('red-wins').textContent = s.wins.red;
  el('blue-wins').textContent = s.wins.blue;
  el('meter-red').style.width = power + '%';
  el('meter-knot').style.left = power + '%';
  el('red-energy').style.width = s.energy.red / 2 + '%';
  el('blue-energy').style.width = s.energy.blue / 2 + '%';
  document.querySelector('.meter')?.setAttribute('aria-valuenow', String(Math.round(s.position * 100)));
  renderLeaders(data?.leaders || []);
}

function fakeUser(team) {
  const id = 'demo-player-' + ++fakeSeq;
  const user = { id, name: ['Hải Yến','Thanh Tú','Minh Khang','Linh Chi','Bảo Ngọc','Quang Huy','Đức Anh','Gia Hân'][fakeSeq % 8] + ' ' + fakeSeq };
  if (demoGame.join(user, team)) demoPlayers.push(user);
  return user;
}
function fakePush() {
  if (demoPlayers.length < 2) {
    fakeUser('red');
    fakeUser('blue');
  }
  const user = demoPlayers[Math.floor(Math.random() * demoPlayers.length)];
  if (user) demoGame.push(user);
}
function demoAction(command) {
  if (command === 'red' || command === 'blue') fakeUser(command);
  else if (command === 'push') fakePush();
  else if (command === 'boost') {
    const user = demoPlayers[Math.floor(Math.random() * demoPlayers.length)];
    if (user) demoGame.boost(user);
  } else if (command === 'gift') demoGame.handleGift({
    user: { id: 'demo-gifter', name: 'Demo Fan' },
    gift: { name: 'Rose' }, count: 10,
  });
  else if (command === 'reset') {
    demoGame.reset();
    demoPlayers.length = 0;
  } else if (command === 'auto') {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    else autoTimer = setInterval(() => {
      if (demoPlayers.length < 22 && Math.random() > 0.6) fakeUser(Math.random() < 0.5 ? 'red' : 'blue');
      fakePush();
    }, 200);
  }
}
if (demoMode) {
  const controls = el('dev-controls');
  controls.hidden = false;
  controls.addEventListener('click', (event) => {
    const action = event.target?.dataset?.demo;
    if (action) demoAction(action);
  });
  for (let i = 0; i < 9; i++) fakeUser('red');
  for (let i = 0; i < 9; i++) fakeUser('blue');
  demoAction('auto');
}
if (params.has('safe')) document.querySelector('.safe-outline').hidden = false;

function frame(t) {
  const s = demoMode ? demoGame.state : gameView?.state || fallbackState;
  if (demoGame) demoGame.tick();
  renderer.render(s, t);
  if (t - lastUiAt > 150) {
    updateHUD();
    lastUiAt = t;
  }
  previousFrame = t;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('pagehide', () => { if (autoTimer) clearInterval(autoTimer); });
