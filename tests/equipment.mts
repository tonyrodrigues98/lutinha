import assert from 'node:assert/strict';
import { Bone, Group, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { equipLoadout } from '../src/game/equipment.ts';

const makeRig = (): Group => {
  const rig = new Group();
  const right = new Bone();
  right.name = 'handslot.r';
  const left = new Bone();
  left.name = 'handslot.l';
  rig.add(right, left);
  return rig;
};

const makeItem = (id: string): Group => {
  const item = new Group();
  item.name = id;
  item.position.set(9, 8, 7);
  item.rotation.set(1, 2, 3);
  item.scale.setScalar(4);
  item.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
  return item;
};

const dualRig = makeRig();
const dual = equipLoadout(dualRig, { weapon: 'dagger_B', shield: 'none' }, makeItem);
assert.equal(dual.rightHand.parent?.name, 'handslot.r');
assert.equal(dual.leftHand?.parent?.name, 'handslot.l');
assert.deepEqual(dual.rightHand.position.toArray(), [0, 0, 0]);
assert.deepEqual(dual.rightHand.scale.toArray(), [1, 1, 1]);
assert.equal((dual.rightHand.children[0] as Mesh).frustumCulled, false);

const shieldRig = makeRig();
const shield = equipLoadout(
  shieldRig,
  { weapon: 'Skeleton_Axe', shield: 'Skeleton_Shield_Large_A' },
  makeItem,
);
assert.equal(shield.rightHand.name, 'equipped:Skeleton_Axe');
assert.equal(shield.leftHand?.name, 'equipped:Skeleton_Shield_Large_A');

assert.throws(
  () => equipLoadout(new Group(), { weapon: 'sword_A', shield: 'none' }, makeItem),
  /handslot\.r/,
);

console.log('Equipment sockets passed');
