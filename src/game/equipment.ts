import { Bone, Mesh, Object3D } from 'three';
import type { PlayerSnapshot } from './types';

type ModelFactory = (id: string) => Object3D;

export interface EquippedLoadout {
  rightHand: Object3D;
  leftHand?: Object3D;
}

const rigSocket = (model: Object3D, side: 'l' | 'r'): Object3D => {
  const expected = `handslot${side}`;
  let socket: Object3D | undefined;
  model.traverse((node) => {
    if (socket) return;
    const normalized = node.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalized === expected) socket = node;
  });
  if (!socket) {
    let hand: Object3D | undefined;
    const expectedHand = `hand${side}`;
    model.traverse((node) => {
      if (hand) return;
      const normalized = node.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalized === expectedHand) hand = node;
    });
    if (hand) {
      const generated = new Bone();
      generated.name = `handslot.${side}`;
      generated.position.set(0, 0.096125, -0.0575);
      generated.quaternion.set(0, 0, side === 'r' ? Math.SQRT1_2 : -Math.SQRT1_2, Math.SQRT1_2);
      hand.add(generated);
      socket = generated;
    }
  }
  if (!socket) {
    throw new Error(`Rig incompatível: socket handslot.${side} não encontrado`);
  }
  return socket;
};

const mountItem = (socket: Object3D, id: string, cloneModel: ModelFactory): Object3D => {
  const item = cloneModel(id);
  item.name = `equipped:${id}`;
  item.position.set(0, 0, 0);
  item.quaternion.identity();
  item.scale.set(1, 1, 1);
  item.traverse((node) => {
    node.visible = true;
    if (node instanceof Mesh) node.frustumCulled = false;
  });
  socket.add(item);
  item.updateMatrix();
  return item;
};

export const needsDualWeapon = (weapon: PlayerSnapshot['weapon']): boolean => (
  weapon === 'dagger' || weapon.startsWith('dagger_') || weapon.startsWith('fistweapon_')
);

export const equipLoadout = (
  model: Object3D,
  player: Pick<PlayerSnapshot, 'weapon' | 'shield'>,
  cloneModel: ModelFactory,
): EquippedLoadout => {
  const rightSocket = rigSocket(model, 'r');
  const leftSocket = rigSocket(model, 'l');
  const rightHand = mountItem(rightSocket, player.weapon, cloneModel);
  let leftHand: Object3D | undefined;

  if (needsDualWeapon(player.weapon)) {
    leftHand = mountItem(leftSocket, player.weapon, cloneModel);
  } else if (player.shield !== 'none') {
    leftHand = mountItem(leftSocket, player.shield, cloneModel);
  }

  return { rightHand, leftHand };
};
