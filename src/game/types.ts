import type * as THREE from 'three';
import type { Localized } from '../i18n';

export type TowerKind = 'sentry' | 'pulse' | 'snare' | 'rail';

export type EnemyKind =
  | 'fragment'
  | 'glitch'
  | 'gate'
  | 'face'
  | 'shield'
  | 'flyer'
  | 'splitter'
  | 'phantom';

export type BranchId =
  | 'sentry-burst'
  | 'sentry-pierce'
  | 'pulse-overload'
  | 'pulse-singularity'
  | 'snare-cryo'
  | 'snare-corrode'
  | 'rail-ap'
  | 'rail-chain';

export type TargetPriority = 'first' | 'last' | 'strong' | 'weak';

export type DifficultyId = 'calm' | 'standard' | 'hardcore';
export type ModeId = 'campaign' | 'endless' | 'rogue';
export type Rarity = 'common' | 'rare' | 'epic';

export type Phase = 'prep' | 'wave' | 'won' | 'lost';
export type LogKind = 'sys' | 'ok' | 'alert' | 'warn';
export type SfxName =
  | 'shot'
  | 'pulse'
  | 'rail'
  | 'kill'
  | 'leak'
  | 'build'
  | 'upgrade'
  | 'sell'
  | 'error'
  | 'wave'
  | 'win'
  | 'lose'
  | 'boss';

export interface TowerDef {
  kind: TowerKind;
  name: string;
  role: Localized;
  sigil: string;
  cost: number;
  damage: number;
  cooldown: number;
  range: number;
  color: number;
  desc: Localized;

  splash?: number;

  slow?: number;

  dps?: number;
}

export interface BranchDef {
  id: BranchId;
  kind: TowerKind;
  name: string;
  role: Localized;
  desc: Localized;
  damageMul?: number;
  cooldownMul?: number;
  rangeMul?: number;
  splashMul?: number;
  slowAdd?: number;
  dpsMul?: number;
  armorPierce?: number;

  chainMul?: number;
}

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  sigil: string;
  hp: number;
  speed: number;
  reward: number;
  coreDamage: number;
  armor: number;
  scale: number;

  shield?: number;

  flying?: boolean;

  splits?: number;

  cloak?: boolean;
  tags?: Localized[];
}

export interface WaveGroup {
  kind: EnemyKind;
  count: number;
  gap: number;
  delay: number;
}

export type Wave = WaveGroup[];

export interface Enemy {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  shieldTimer: number;
  speed: number;
  baseSpeed: number;
  distance: number;
  route: number;
  routeLength: number;
  flying: boolean;
  reward: number;
  coreDamage: number;
  armor: number;
  dead: boolean;
  flash: number;
  phase: number;
  slow: number;
  cloakTimer: number;
  cloaked: boolean;
  canCloak: boolean;
  enraged: boolean;
  berserk: boolean;
  regen: number;
  hitTimer: number;
  splits: number;
  group: THREE.Group;
  bar: THREE.Sprite;
  barFill: THREE.Sprite;
}

export interface Tower {
  id: number;
  kind: TowerKind;
  cell: { x: number; z: number };
  level: number;
  branch: BranchId | null;
  priority: TargetPriority;
  cooldown: number;
  tick: number;
  spent: number;
  damage: number;
  range: number;
  group: THREE.Group;
  head: THREE.Object3D | null;
  aura: THREE.Object3D | null;
}

export interface RewardDef {
  id: string;
  name: Localized;
  desc: Localized;
  tag: Localized;
  rarity: Rarity;
  weight: number;
}

export interface WaveModDef {
  id: string;
  name: Localized;
  desc: Localized;
  weight: number;
}

export interface Cell {
  x: number;
  z: number;
}

export interface RunStats {
  kills: number;
  leaks: number;
  towersBuilt: number;
  dataEarned: number;
  wavesCleared: number;
  bossKills: number;
  perfectWaves: number;
  branches: number;
  rewards: number;
  shieldBreaks: number;
  soldTowers: number;
  peakTowers: number;
  maxedTowers: number;
  peakMoney: number;
  maxWave: number;
  time: number;
}

export function emptyRunStats(): RunStats {
  return {
    kills: 0,
    leaks: 0,
    towersBuilt: 0,
    dataEarned: 0,
    wavesCleared: 0,
    bossKills: 0,
    perfectWaves: 0,
    branches: 0,
    rewards: 0,
    shieldBreaks: 0,
    soldTowers: 0,
    peakTowers: 0,
    maxedTowers: 0,
    peakMoney: 0,
    maxWave: 1,
    time: 0,
  };
}
