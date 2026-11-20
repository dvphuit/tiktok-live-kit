// Full HTTP/WebSocket integration: the Node game host is shared by every overlay
// and survives restarting the LIVE Kit server. No TikTok account is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import WebSocket from 'ws';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function freePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  server.close();
  await once(server, 'close');
  return port;
}
async function startServer(port, dataDir) {
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, THEME: 'pixel-tug-war', PORT: String(port), HOST: '127.0.0.1', KIT_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (d) => { logs += d; });
  child.stderr.on('data', (d) => { logs += d; });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('Server stopped unexpectedly: ' + logs);
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/api/health');
      if (res.ok && (await res.json()).theme === 'pixel-tug-war') return child;
    } catch {}
    await sleep(100);
  }
  child.kill('SIGTERM');
  throw new Error('Server failed to start:\n' + logs);
}
function hello(port, role) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket('ws://127.0.0.1:' + port + '/ws');
    const timer = setTimeout(() => { socket.terminate(); reject(new Error('WebSocket hello timed out')); }, 5000);
    socket.on('open', () => socket.send(JSON.stringify({ type: 'hello', role })));
    socket.on('error', (err) => { clearTimeout(timer); reject(err); });
    socket.on('message', (data) => {
      const msg = JSON.parse(String(data));
      if (msg.type === 'init') {
        clearTimeout(timer);
        resolve({ socket, init: msg });
      }
    });
  });
}
function nextState(socket, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('message', receive); reject(new Error('Timed out waiting for authoritative gameState')); }, 5000);
    const receive = (data) => {
      const msg = JSON.parse(String(data));
      if (msg.type !== 'gameState' || !predicate(msg.game)) return;
      clearTimeout(timer);
      socket.off('message', receive);
      resolve(msg.game);
    };
    socket.on('message', receive);
  });
}
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), sleep(4000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

test('two overlay clients share authoritative game state and server restores it', { timeout: 25_000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-war-e2e-'));
  const port = await freePort();
  let child = null;
  const sockets = [];
  try {
    child = await startServer(port, dir);
    const left = await hello(port, 'overlay');
    const right = await hello(port, 'overlay');
    const control = await hello(port, 'control');
    sockets.push(left.socket, right.socket, control.socket);
    assert.ok(left.init.game);
    assert.equal(left.init.game.state.participants.red, 0);
    const l = nextState(left.socket, (g) => g.state.participants.red === 1);
    const r = nextState(right.socket, (g) => g.state.participants.red === 1);
    control.socket.send(JSON.stringify({ type: 'sim', kind: 'chat', arg: 'RED' }));
    const [a, b] = await Promise.all([l, r]);
    assert.deepEqual(a.state, b.state);
    assert.equal(a.state.participants.red, 1);

    // A reconnecting overlay gets the current game state immediately in init.
    const late = await hello(port, 'overlay');
    sockets.push(late.socket);
    assert.equal(late.init.game.state.participants.red, 1);

    for (const socket of sockets) socket.close();
    sockets.length = 0;
    await stop(child);
    child = null;
    assert.ok(fs.existsSync(path.join(dir, 'game-pixel-tug-war.json')));

    // Restart the same Node server: saved state, team membership and leaderboard survive.
    child = await startServer(port, dir);
    const resumed = await hello(port, 'overlay');
    sockets.push(resumed.socket);
    assert.equal(resumed.init.game.state.participants.red, 1);
  } finally {
    for (const socket of sockets) socket.terminate();
    await stop(child);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
