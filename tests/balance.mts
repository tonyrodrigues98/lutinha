import assert from 'node:assert/strict';
import { FIGHTER_STATS, weaponProfile } from '../src/game/combatBalance.ts';

const magic = weaponProfile('Skeleton_Staff');
const sword = weaponProfile('sword_A');
const bow = weaponProfile('bow_A_withString');
const dagger = weaponProfile('dagger_A');
const spear = weaponProfile('spear_A');
const halberd = weaponProfile('halberd');
const fist = weaponProfile('fistweapon_A');

assert.ok(magic.range < bow.range, 'Magia não deve superar o arco em alcance');
assert.ok(magic.range < sword.range * 1.55, 'Magia precisa permanecer alcançável por lutadores corpo a corpo');
assert.ok(magic.damage < sword.damage, 'O ataque seguro à distância deve causar menos dano');
assert.ok(magic.windup > sword.windup * 2, 'A conjuração precisa ser legível e interrompível');
assert.ok(magic.recovery > bow.recovery, 'O necromante não deve encadear disparos sem janela de resposta');
assert.ok(FIGHTER_STATS.mage.damage < 1);
assert.ok(FIGHTER_STATS.mage.energy < 1);
assert.ok(fist.range < dagger.range, 'Punhos devem ter a menor hitbox');
assert.ok(dagger.range < sword.range, 'Adaga deve exigir distância menor que espada');
assert.ok(sword.range < spear.range, 'Lança deve alcançar além da espada');
assert.ok(spear.range <= halberd.range, 'Alabarda longa não pode ter hitbox menor que lança');
assert.ok(spear.range >= dagger.range * 1.8, 'A diferença visual entre lança e adaga precisa ser sentida no alcance');

console.log('Combat balance passed');
