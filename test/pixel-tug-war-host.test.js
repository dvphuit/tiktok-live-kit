import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGameHost } from '../themes/pixel-tug-war/server-game.js';

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-tug-war-'));
  return { dir, file: path.join(dir, 'game.json') };
}
const user = (id) => ({ id, name: id });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('server host is authoritative and persists round state across restarts', () => {
  const { dir, file } = tmp();
  let clock = 1_800_000;
  const fx = [];
  const host = createGameHost({ dataFile: file, now: () => clock, onEffect: (effect) => fx.push(effect) });
  try {
    assert.equal(host.ingest({ kind: 'chat', text: 'RED', user: user('alice') }), true);
    assert.equal(host.ingest({ kind: 'chat', text: 'BLUE', user: user('bob') }), true);
    assert.equal(host.ingest({ kind: 'chat', text: 'PUSH', user: user('alice') }), true);
    assert.equal(host.ingest({ kind: 'chat', text: 'PUSH', user: user('alice') }), false);
    assert.equal(host.view().state.pushes.red, 1);
    assert.equal(host.view().state.pushes.blue, 0);
    assert.ok(fx.some((event) => event.type === 'push'));
  } finally { host.close(); }
  assert.equal(fs.existsSync(file), true);
  clock += 2000;
  const reopened = createGameHost({ dataFile: file, now: () => clock });
  try {
    assert.equal(reopened.view().state.pushes.red, 1);
    assert.equal(reopened.playerCount, 2);
    assert.equal(reopened.ingest({ kind: 'chat', text: 'PUSH', user: user('alice') }), false);
    clock += 1100;
    assert.equal(reopened.ingest({ kind: 'chat', text: 'PUSH', user: user('alice') }), true);
  } finally {
    reopened.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('server host broadcasts coalesced states and cosmetic gift effects', async () => {
  const { dir, file } = tmp();
  const views = [], effects = [];
  const host = createGameHost({
    dataFile: file,
    tickIntervalMs: 5,
    persistIntervalMs: 20,
    onState: (state) => views.push(state),
    onEffect: (effect) => effects.push(effect),
  });
  try {
    host.ingest({ kind: 'chat', text: 'red', user: user('alice') });
    host.ingest({ kind: 'chat', text: 'push', user: user('alice') });
    const before = host.view().state.position;
    host.ingest({ kind: 'gift', count: 5, user: user('alice'), gift: { name: 'Rose' } });
    assert.equal(host.view().state.position, before);
    assert.equal(host.view().state.totalGifts, 5);
    await sleep(130);
    assert.ok(views.length > 0, 'at least one coalesced state update expected');
    assert.ok(views.length <= 3, 'a burst should not spam all state changes');
    assert.ok(effects.some((event) => event.type === 'gift'));
    assert.equal(fs.existsSync(file), true, 'snapshot written by the interval');
  } finally {
    host.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('reset overwrites the persisted server game session', () => {
  const { dir, file } = tmp();
  const host = createGameHost({ dataFile: file });
  try {
    host.ingest({ kind: 'chat', text: 'blue', user: user('bob') });
    host.ingest({ kind: 'chat', text: 'push', user: user('bob') });
    host.reset();
    assert.equal(host.playerCount, 0);
    assert.equal(host.view().state.pushes.blue, 0);
  } finally { host.close(); }
  const reopened = createGameHost({ dataFile: file });
  try {
    assert.equal(reopened.playerCount, 0);
    assert.equal(reopened.view().state.pushes.blue, 0);
  } finally {
    reopened.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
