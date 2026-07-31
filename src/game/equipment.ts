import { Mesh, Object3D } from 'three';
import type { PlayerSnapshot } from './types';

type ModelFactory = (id: string) => Object3D;

export interface EquippedLoadout {
  rightHand: Object3D;
  leftHand?: Object3D;
}

const rigSocket = (model: Object3D, side: 'l' | 'r'): Object3D => {
  const socket = model.getObjectByName(`handslot.${side}`);
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
  weapon.startsWith('dagger_') || weapon.startsWith('fistweapon_')
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
