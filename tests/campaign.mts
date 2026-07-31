import assert from 'node:assert/strict';
import { CAMPAIGN_MISSIONS, campaignMission } from '../src/game/campaign.ts';
import { LocalCpuClient } from '../src/game/localCpu.ts';
import type { MatchSnapshot } from '../src/game/types.ts';

assert.equal(CAMPAIGN_MISSIONS.length, 6);
assert.deepEqual(CAMPAIGN_MISSIONS.map((mission) => mission.id), [1, 2, 3, 4, 5, 6]);
assert.ok(CAMPAIGN_MISSIONS.every((mission) => mission.objective && mission.enemyName && mission.reward > 0));

const client = new LocalCpuClient();
client.setCampaign(4);
let snapshot: MatchSnapshot | undefined;
const unsubscribe = client.onSnapshot((value) => { snapshot = value; });
try {
  const mission = campaignMission(4);
  const result = await client.join({
    roomCode: 'campaign', name: 'Herói', team: 'blue', skin: 'knight', color: 'gold',
    weapon: 'sword_A', shield: 'shield_A', arena: 'riftfall',
  });
  assert.equal(result.ok, true);
  assert.equal(snapshot?.campaign?.missionId, 4);
  assert.equal(snapshot?.arena, mission.arena);
  const enemy = snapshot?.players.find((player) => player.id === 'riftfall-cpu');
  assert.equal(enemy?.name, mission.enemyName);
  assert.equal(enemy?.skin, mission.enemySkin);
  assert.equal(enemy?.weapon, mission.enemyWeapon);
  assert.equal(enemy?.shield, mission.enemyShield);
} finally {
  unsubscribe();
  client.leave();
}

console.log('Campaign passed');
