import type { ArenaTheme, FighterSkin, ShieldId, WeaponId } from './types';

export interface CampaignMission {
  id: number;
  act: string;
  title: string;
  objective: string;
  enemyName: string;
  enemySkin: FighterSkin;
  enemyWeapon: WeaponId;
  enemyShield: ShieldId;
  arena: ArenaTheme;
  difficulty: 'apprentice' | 'warrior' | 'nightmare';
  reward: number;
}

export const CAMPAIGN_MISSIONS: CampaignMission[] = [
  { id: 1, act: 'ATO I', title: 'O Vigia da Fenda', objective: 'Derrote o vigia que bloqueia a passagem.', enemyName: 'VIGIA OSSUDO', enemySkin: 'minion', enemyWeapon: 'dagger_A', enemyShield: 'none', arena: 'riftfall', difficulty: 'apprentice', reward: 100 },
  { id: 2, act: 'ATO I', title: 'Lâminas nas Ruínas', objective: 'Sobreviva à emboscada da Lâmina Sombria.', enemyName: 'SOMBRA DA CRIPTA', enemySkin: 'hoodedRogue', enemyWeapon: 'dagger_B', enemyShield: 'none', arena: 'neon', difficulty: 'warrior', reward: 175 },
  { id: 3, act: 'ATO II', title: 'A Guarda de Cinzas', objective: 'Quebre a defesa do guardião da forja.', enemyName: 'GUARDA DE CINZAS', enemySkin: 'knight', enemyWeapon: 'sword_D', enemyShield: 'shield_badge_color', arena: 'ember', difficulty: 'warrior', reward: 250 },
  { id: 4, act: 'ATO II', title: 'Caçadora Astral', objective: 'Atravesse a chuva de flechas e vença a caçadora.', enemyName: 'LYRA ASTRAL', enemySkin: 'ranger', enemyWeapon: 'bow_B_withString', enemyShield: 'none', arena: 'astral', difficulty: 'warrior', reward: 350 },
  { id: 5, act: 'ATO III', title: 'O Carrasco da Forja', objective: 'Derrube o bárbaro antes que o machado o alcance.', enemyName: 'CARRASCO VORAK', enemySkin: 'barbarian', enemyWeapon: 'axe_2handed', enemyShield: 'none', arena: 'ember', difficulty: 'nightmare', reward: 500 },
  { id: 6, act: 'ATO III', title: 'Senhor de Riftfall', objective: 'Derrote o campeão e sele a fenda.', enemyName: 'REI ESQUELETO', enemySkin: 'warrior', enemyWeapon: 'halberd', enemyShield: 'Skeleton_Shield_Large_A', arena: 'riftfall', difficulty: 'nightmare', reward: 800 },
];

export const campaignMission = (id: number): CampaignMission => CAMPAIGN_MISSIONS.find((mission) => mission.id === id) ?? CAMPAIGN_MISSIONS[0];
