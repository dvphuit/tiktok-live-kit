// Pixel Tug War gameplay. Pure JavaScript: no DOM, canvas, network or framework.
export const GAME_RULES = Object.freeze({
  roundMs: 60_000,
  intermissionMs: 7_000,
  pushCooldownMs: 3_000,
  pushDistance: 0.025,
  boostDistance: 0.16,
  winDistance: 0.9,
  maxPlayers: 400,
});

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const safeText = (value, limit = 40) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit);
const validTeam = (team) => team === 'red' || team === 'blue';
const normalizeCommand = (value) => safeText(value, 80)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();

export function createGame(options = {}) {
  const now = options.now || (() => Date.now());
  const rules = { ...GAME_RULES, ...(options.rules || {}) };
  const onEffect = options.onEffect || (() => {});
  const players = new Map();
  const state = {
    round: 1, phase: 'playing', endsAt: now() + rules.roundMs,
    position: 0, winner: null, reason: '', totalGifts: 0,
    pushes: { red: 0, blue: 0 },
    energy: { red: 0, blue: 0 },
    wins: { red: 0, blue: 0 },
    participants: { red: 0, blue: 0 },
  };
  let lastNotice = '';
  let notices = [];

  function publish(type, data = {}) {
    const event = { type, time: now(), ...data };
    if (event.message) {
      lastNotice = safeText(event.message, 120);
      notices.push(event);
      if (notices.length > 8) notices = notices.slice(-8);
    }
    onEffect(event);
  }

  function userFrom(value) {
    if (!value || typeof value !== 'object') return null;
    const id = safeText(value.id || value.uniqueId, 128);
    if (!id) return null;
    return { id, name: safeText(value.name || value.uniqueId || id, 34) };
  }

  function join(user, team) {
    if (!validTeam(team) || state.phase !== 'playing') return false;
    const u = userFrom(user);
    if (!u) return false;
    const existing = players.get(u.id);
    if (existing) return false; // Team choice is locked until the user leaves this session.
    if (players.size >= rules.maxPlayers) {
      // Bounded memory; don't discard an active participant simply to display a newer name.
      return false;
    }
    players.set(u.id, { ...u, team, pushes: 0, boosts: 0, gifts: 0, nextPushAt: 0 });
    state.participants[team] += 1;
    publish('join', { team, user: u, message: u.name + ' gia nhập đội ' + (team === 'red' ? 'Đỏ' : 'Xanh') });
    return true;
  }

  function finish(winner, reason) {
    if (state.phase !== 'playing') return;
    state.phase = 'intermission';
    state.winner = validTeam(winner) ? winner : null;
    state.reason = reason;
    state.endsAt = now() + rules.intermissionMs;
    if (state.winner) state.wins[state.winner] += 1;
    const title = winner === 'red' ? 'ĐỘI ĐỎ CHIẾN THẮNG!' : winner === 'blue' ? 'ĐỘI XANH CHIẾN THẮNG!' : 'TRẬN ĐẤU HÒA!';
    publish('finish', { team: state.winner, message: title });
  }

  function applyPull(team, amount) {
    state.position = clamp(state.position + (team === 'red' ? -amount : amount), -1, 1);
    if (Math.abs(state.position) >= rules.winDistance) finish(team, 'rope');
  }

  function push(user) {
    if (state.phase !== 'playing') return false;
    const u = userFrom(user);
    const player = u && players.get(u.id);
    if (!player || now() < player.nextPushAt) return false;
    player.name = u.name;
    player.nextPushAt = now() + rules.pushCooldownMs;
    player.pushes += 1;
    state.pushes[player.team] += 1;
    state.energy[player.team] = clamp(state.energy[player.team] + 9, 0, 100);
    applyPull(player.team, rules.pushDistance);
    publish('push', { team: player.team, user: u, power: rules.pushDistance });
    return true;
  }

  function boost(user) {
    if (state.phase !== 'playing') return false;
    const u = userFrom(user);
    const player = u && players.get(u.id);
    if (!player || state.energy[player.team] < 100) return false;
    state.energy[player.team] = 0;
    player.boosts += 1;
    applyPull(player.team, rules.boostDistance);
    publish('boost', { team: player.team, user: u, message: player.name + ' kích hoạt TĂNG LỰC!' });
    return true;
  }

  function handleChat(event) {
    const command = normalizeCommand(event?.text);
    if (['red', 'do', 'doi do'].includes(command)) return join(event?.user, 'red');
    if (['blue', 'xanh', 'doi xanh'].includes(command)) return join(event?.user, 'blue');
    if (['push', 'keo'].includes(command)) return push(event?.user);
    if (['boost', 'tang luc'].includes(command)) return boost(event?.user);
    return false;
  }

  function handleGift(event) {
    const u = userFrom(event?.user);
    if (!u) return false;
    const count = clamp(Math.floor(Number(event.count) || 1), 1, 1000);
    state.totalGifts += count;
    const player = players.get(u.id);
    if (player) player.gifts += count;
    // Gifts only trigger a cosmetic celebration: pay-to-win is deliberately avoided.
    publish('gift', {
      team: player?.team || null, user: u, count,
      message: u.name + ' gửi ' + safeText(event?.gift?.name || 'quà', 35) + ' ×' + count,
    });
    return true;
  }

  function tick() {
    const t = now();
    if (t < state.endsAt) return;
    if (state.phase === 'playing') {
      const margin = state.position;
      finish(Math.abs(margin) < 0.001 ? null : margin < 0 ? 'red' : 'blue', 'time');
    } else {
      state.round += 1;
      state.phase = 'playing';
      state.endsAt = t + rules.roundMs;
      state.position = 0;
      state.winner = null;
      state.reason = '';
      state.pushes = { red: 0, blue: 0 };
      state.energy = { red: 0, blue: 0 };
      for (const player of players.values()) {
        player.pushes = 0;
        player.boosts = 0;
        player.nextPushAt = 0;
      }
      publish('round', { message: 'VÒNG ' + state.round + ' BẮT ĐẦU!' });
    }
  }

  function leaderboard(limit = 5) {
    return [...players.values()]
      .sort((a, b) => (b.pushes + b.boosts * 5) - (a.pushes + a.boosts * 5) || a.name.localeCompare(b.name))
      .slice(0, Math.max(0, Math.min(20, limit)))
      .map((p) => ({ id: p.id, name: p.name, team: p.team, pushes: p.pushes, boosts: p.boosts, gifts: p.gifts, score: p.pushes + p.boosts * 5 }));
  }

  function snapshot() {
    return {
      version: 1, savedAt: now(),
      state: JSON.parse(JSON.stringify(state)),
      players: [...players.values()],
    };
  }

  function restore(data) {
    if (!data || data.version !== 1 || !data.state || !Array.isArray(data.players)) return false;
    const age = now() - Number(data.savedAt);
    // Persisted server sessions may resume after short downtime; discard sessions older than a day.
    if (!Number.isFinite(age) || age < 0 || age > 24 * 60 * 60_000) return false;
    if (!['playing', 'intermission'].includes(data.state.phase)) return false;
    if (!Number.isFinite(data.state.endsAt) || !Number.isFinite(data.state.position)) return false;
    for (const key of ['pushes', 'energy', 'wins', 'participants']) {
      if (!data.state[key] || !Number.isFinite(data.state[key].red) || !Number.isFinite(data.state[key].blue)) return false;
    }
    players.clear();
    for (const entry of data.players.slice(0, rules.maxPlayers)) {
      const u = userFrom(entry);
      if (!u || !validTeam(entry.team) || players.has(u.id)) continue;
      players.set(u.id, {
        ...u, team: entry.team,
        pushes: clamp(Number(entry.pushes) || 0, 0, 1e9),
        boosts: clamp(Number(entry.boosts) || 0, 0, 1e9),
        gifts: clamp(Number(entry.gifts) || 0, 0, 1e9),
        nextPushAt: Number(entry.nextPushAt) || 0,
      });
    }
    Object.assign(state, {
      round: clamp(Number(data.state.round) || 1, 1, 1e8),
      phase: data.state.phase,
      endsAt: data.state.endsAt,
      position: clamp(data.state.position, -1, 1),
      winner: validTeam(data.state.winner) ? data.state.winner : null,
      reason: safeText(data.state.reason, 20),
      totalGifts: Number(data.state.totalGifts) || 0,
      pushes: { ...data.state.pushes },
      energy: { ...data.state.energy },
      wins: { ...data.state.wins },
      participants: {
        red: [...players.values()].filter((p) => p.team === 'red').length,
        blue: [...players.values()].filter((p) => p.team === 'blue').length,
      },
    });
    return true;
  }

  function reset() {
    players.clear();
    Object.assign(state, {
      round: 1, phase: 'playing', endsAt: now() + rules.roundMs,
      position: 0, winner: null, reason: '', totalGifts: 0,
      pushes: { red: 0, blue: 0 }, energy: { red: 0, blue: 0 },
      wins: { red: 0, blue: 0 }, participants: { red: 0, blue: 0 },
    });
    notices = [];
    lastNotice = '';
    publish('round', { message: 'BẮT ĐẦU TRẬN ĐẤU!' });
  }

  return { state, join, push, boost, handleChat, handleGift, tick, leaderboard, snapshot, restore, reset,
    get lastNotice() { return lastNotice; },
    get notices() { return [...notices]; },
    get playerCount() { return players.size; },
  };
}