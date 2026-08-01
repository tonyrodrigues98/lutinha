import assert from 'node:assert/strict';
import { decodeCompatLoadout, encodeCompatLoadout, restoreCompatSnapshot } from '../src/game/network.ts';
import type { JoinPayload, MatchSnapshot } from '../src/game/types.ts';

const payload: JoinPayload = {
  roomCode: 'TESTE', name: 'Antonio Rodrigues', team: 'red',
  skin: 'mannequinLarge', color: 'silver', weapon: 'crossbow_2handed',
  shield: 'shield_square_color', arena: 'astral',
};
const encodedName = encodeCompatLoadout(payload);
assert.ok(encodedName.length <= 14, 'Assinatura precisa caber no limite do servidor antigo');
assert.deepEqual(decodeCompatLoadout(encodedName), {
  name: 'Antonio Ro', skin: payload.skin, color: payload.color,
  weapon: payload.weapon, shield: payload.shield, arena: payload.arena,
});

const snapshot = restoreCompatSnapshot({
  roomCode: 'TESTE', arena: 'riftfall', status: 'waiting', round: 1,
  timeLeft: 60, countdown: 0, serverTime: Date.now(),
  players: [{
    id: 'old-server-id', name: encodedName, team: 'red', skin: 'mage', color: 'azure',
    weapon: 'Skeleton_Staff', shield: 'none', x: 720, y: 690, vx: 0, vy: 0,
    health: 100, energy: 0, facing: -1, grounded: true, action: 'idle', wins: 0,
  }],
} satisfies MatchSnapshot);
assert.equal(snapshot.players[0].name, 'Antonio Ro');
assert.equal(snapshot.players[0].skin, payload.skin);
assert.equal(snapshot.players[0].weapon, payload.weapon);
assert.equal(snapshot.players[0].shield, payload.shield);
assert.equal(snapshot.arena, payload.arena);

console.log('Online legacy loadout compatibility passed');
