import type * as THREE from 'three';

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
  | 'lose';

export interface TowerDef {
  kind: TowerKind;
  name: string;
  role: string;
  sigil: string;
  cost: number;
  damage: number;
  cooldown: number;
  range: number;
  color: number;
  desc: string;

  splash?: number;

  slow?: number;

  dps?: number;
}

export interface BranchDef {
  id: BranchId;
  kind: TowerKind;
  name: string;
  role: string;
  desc: string;
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
  tags?: string[];
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
  distance: number;
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
  name: string;
  desc: string;
  tag: string;
}

export interface Cell {
  x: number;
  z: number;
}
