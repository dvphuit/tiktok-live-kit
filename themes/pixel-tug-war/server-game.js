// Optional Pixel Tug War server-side runtime.
// This module is loaded by the shared server only while this theme is active.
// Node is the single source of truth; browser overlays only render snapshots.
import fs from 'node:fs';
import path from 'node:path';
import { createGame } from './game-engine.js';

export function createGameHost({
  dataFile,
  onState = () => {},
  onEffect = () => {},
  now = () => Date.now(),
  tickIntervalMs = 100,
  persistIntervalMs = 5000,
} = {}) {
  if (!dataFile) throw new Error('Pixel Tug War requires a dataFile');
  let dirty = false;
  let stopped = false;
  let pending = null;
  let lastSavedAt = now();
  let effectWindow = { start: now(), count: 0 };
  const game = createGame({ now, onEffect: (ev) => {
    // Bound websocket effect broadcasts under chat/gift bursts.
    if (now() - effectWindow.start >= 1000) effectWindow = { start: now(), count: 0 };
    if (effectWindow.count++ < 30 && ['push', 'boost', 'gift', 'finish', 'round'].includes(ev.type)) onEffect(ev);
  } });

  function view() {
    return {
      state: { ...game.state,
        pushes: { ...game.state.pushes }, wins: { ...game.state.wins },
        participants: { ...game.state.participants }, energy: { ...game.state.energy } },
      leaders: game.leaderboard(5),
      notice: game.lastNotice,
      serverTime: now(),
    };
  }

  function broadcastSoon() {
    if (pending || stopped) return;
    pending = setTimeout(() => {
      pending = null;
      if (!stopped) onState(view());
    }, 75);
    pending.unref?.();
  }

  function save() {
    if (!dirty) return;
    const tmp = dataFile + '.' + process.pid + '.tmp';
    try {
      fs.mkdirSync(path.dirname(dataFile), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(game.snapshot()));
      fs.renameSync(tmp, dataFile);
      lastSavedAt = now();
      dirty = false;
    } catch (err) {
      try { fs.unlinkSync(tmp); } catch {}
      console.warn('[pixel-tug-war] cannot persist game state:', err.message);
    }
  }

  try {
    const restored = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    if (game.restore(restored)) {
      console.log('[pixel-tug-war] server game state restored');
      // Catch up if the server was stopped during a round.
      game.tick();
      dirty = true;
    }
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('[pixel-tug-war] starting fresh:', err.message);
  }

  const timer = setInterval(() => {
    if (stopped) return;
    const before = game.state.phase + ':' + game.state.round;
    game.tick();
    if (before !== game.state.phase + ':' + game.state.round) {
      dirty = true;
      broadcastSoon();
    }
    if (dirty && now() - lastSavedAt >= persistIntervalMs) save();
  }, tickIntervalMs);
  timer.unref?.();

  function ingest(ev) {
    if (stopped || !ev) return false;
    let changed = false;
    if (ev.kind === 'chat') changed = game.handleChat(ev);
    else if (ev.kind === 'gift') changed = game.handleGift(ev);
    if (changed) {
      dirty = true;
      broadcastSoon();
    }
    return changed;
  }

  function reset() {
    if (stopped) return;
    game.reset();
    dirty = true;
    broadcastSoon();
    save();
  }

  function close() {
    if (stopped) return;
    // Flush before stopping, but do not push a stale state to clients.
    clearInterval(timer);
    if (pending) clearTimeout(pending);
    pending = null;
    save();
    stopped = true;
  }

  return { view, ingest, reset, close, save, get playerCount() { return game.playerCount; } };
}
