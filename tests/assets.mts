import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FIGHTERS } from '../src/game/assets.ts';
import { SHIELD_IDS, WEAPON_IDS } from '../src/game/types.ts';

interface GlbJson {
  meshes?: unknown[];
  nodes?: Array<{ name?: string; mesh?: number }>;
}

const readGlbJson = (path: string): GlbJson => {
  const buffer = readFileSync(path);
  assert.equal(buffer.toString('utf8', 0, 4), 'glTF', `${path} não é um GLB válido`);
  const jsonLength = buffer.readUInt32LE(12);
  const json = buffer.toString('utf8', 20, 20 + jsonLength).replace(/\0/g, '');
  return JSON.parse(json) as GlbJson;
};

assert.equal(Object.keys(FIGHTERS).length, 12, 'O catálogo deve conter todos os 12 personagens dos packs');

for (const fighter of Object.values(FIGHTERS)) {
  const glb = readGlbJson(join('public/assets/kaykit/characters', `${fighter.model}.glb`));
  const names = new Set(glb.nodes?.map((node) => node.name));
  assert.ok(
    names.has('handslot.r') || names.has('hand.r'),
    `${fighter.model} não possui handslot.r nem hand.r para criar o socket`,
  );
  assert.ok(
    names.has('handslot.l') || names.has('hand.l'),
    `${fighter.model} não possui handslot.l nem hand.l para criar o socket`,
  );
}

const selectableEquipment = [...WEAPON_IDS, ...SHIELD_IDS.filter((id) => id !== 'none')];
assert.equal(selectableEquipment.length, 57, 'O catálogo deve conter 41 armas e 16 escudos');
const files = new Set(readdirSync('public/assets/kaykit/weapons'));
for (const id of selectableEquipment) {
  const filename = `${id}.glb`;
  assert.ok(files.has(filename), `Asset selecionável ausente: ${filename}`);
  const glb = readGlbJson(join('public/assets/kaykit/weapons', filename));
  assert.ok((glb.meshes?.length ?? 0) > 0, `Asset sem malha renderizável: ${filename}`);
  assert.ok(glb.nodes?.some((node) => node.mesh !== undefined), `Asset sem nó de malha: ${filename}`);
}

console.log(`${Object.keys(FIGHTERS).length} rigs e ${selectableEquipment.length} equipamentos KayKit validados`);
