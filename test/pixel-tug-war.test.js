import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, GAME_RULES } from '../themes/pixel-tug-war/game-engine.js';

function setup(rules = {}) {
  let clock = 1_000_000;
  const effects = [];
  const game = createGame({ now: () => clock, rules, onEffect: (event) => effects.push(event) });
  const red = { id: 'r', name: 'Đỏ' };
  const blue = { id: 'b', name: 'Xanh' };
  return { game, red, blue, effects, advance: (ms) => { clock += ms; game.tick(); } };
}

test('join RED and BLUE once; team cannot be switched or duplicated', () => {
  const { game, red, blue } = setup();
  assert.equal(game.handleChat({ user: red, text: 'RED' }), true);
  assert.equal(game.handleChat({ user: blue, text: 'BLUE' }), true);
  assert.equal(game.handleChat({ user: red, text: 'blue' }), false);
  assert.equal(game.state.participants.red, 1);
  assert.equal(game.state.participants.blue, 1);
});

test('PUSH requires joining and respects per-viewer cooldown', () => {
  const { game, red, blue, advance } = setup();
  assert.equal(game.handleChat({ user: red, text: 'PUSH' }), false);
  game.join(red, 'red');
  game.join(blue, 'blue');
  assert.equal(game.push(red), true);
  assert.equal(game.push(red), false);
  assert.equal(game.state.pushes.red, 1);
  assert.ok(game.state.position < 0);
  advance(GAME_RULES.pushCooldownMs);
  assert.equal(game.push(red), true);
  assert.equal(game.pushes, undefined);
  assert.equal(game.state.pushes.red, 2);
  assert.equal(game.push(blue), true);
});

test('BOOST is free, consumes 100 energy, cannot execute without it', () => {
  const { game, red, advance } = setup();
  game.join(red, 'red');
  assert.equal(game.boost(red), false);
  for (let i = 0; i < 12; i++) {
    assert.equal(game.push(red), true);
    advance(GAME_RULES.pushCooldownMs);
  }
  assert.equal(game.state.energy.red, 100);
  assert.equal(game.boost(red), true);
  assert.equal(game.state.energy.red, 0);
  assert.equal(game.boost(red), false);
});

test('timer chooses the leading team and schedules next round', () => {
  const { game, red, advance } = setup();
  game.join(red, 'red');
  game.push(red);
  advance(GAME_RULES.roundMs);
  assert.equal(game.state.phase, 'intermission');
  assert.equal(game.state.winner, 'red');
  assert.equal(game.state.wins.red, 1);
  advance(GAME_RULES.intermissionMs);
  assert.equal(game.state.round, 2);
  assert.equal(game.state.phase, 'playing');
  assert.equal(game.state.position, 0);
  assert.equal(game.state.wins.red, 1);
});

test('a pull across the edge finishes the round early', () => {
  const { game, red, advance } = setup({ winDistance: 0.05 });
  game.join(red, 'red');
  game.push(red);
  advance(GAME_RULES.pushCooldownMs);
  game.push(red);
  assert.equal(game.state.phase, 'intermission');
  assert.equal(game.state.reason, 'rope');
  assert.equal(game.push(red), false);
});

test('gifts celebrate but cannot change score or rope', () => {
  const { game, red, effects } = setup();
  game.join(red, 'red');
  const before = game.state.position;
  game.handleGift({ user: red, count: 10, gift: { name: 'Rose' } });
  assert.equal(game.state.position, before);
  assert.equal(game.state.pushes.red, 0);
  assert.equal(game.state.totalGifts, 10);
  assert.equal(effects.at(-1).type, 'gift');
});

test('snapshot and restore preserve scores, teams and cooldowns', () => {
  const { game, red } = setup();
  game.join(red, 'red');
  game.push(red);
  const data = game.snapshot();
  const other = createGame({ now: () => 1_000_200 });
  assert.equal(other.restore(data), true);
  assert.equal(other.state.position, game.state.position);
  assert.equal(other.playerCount, 1);
  assert.equal(other.push(red), false);
  assert.equal(other.restore({ version: 2 }), false);
});

test('viewer text is normalized and leaderboard stays bounded', () => {
  const { game } = setup();
  game.handleChat({ user: { id: 'test', name: '<img onerror=alert(1)>' }, text: 'ĐỎ' });
  assert.equal(game.playerCount, 1);
  assert.equal(game.leaderboard(1000).length, 1);
  assert.equal(game.handleChat({ user: { id: 'test' }, text: 'keo' }), true);
});
