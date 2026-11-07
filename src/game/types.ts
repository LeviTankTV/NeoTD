import type * as THREE from 'three';

export type TowerKind = 'sentry' | 'pulse' | 'snare' | 'rail';
export type EnemyKind = 'fragment' | 'glitch' | 'gate' | 'face';
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
  /** Радиус взрыва для PULSE. */
  splash?: number;
  /** Доля замедления для SNARE. */
  slow?: number;
  /** Урон в секунду для SNARE. */
  dps?: number;
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
  speed: number;
  distance: number;
  reward: number;
  coreDamage: number;
  armor: number;
  dead: boolean;
  flash: number;
  phase: number;
  slow: number;
  group: THREE.Group;
  bar: THREE.Sprite;
  barFill: THREE.Sprite;
}

export interface Tower {
  id: number;
  kind: TowerKind;
  cell: { x: number; z: number };
  level: number;
  cooldown: number;
  tick: number;
  spent: number;
  damage: number;
  range: number;
  group: THREE.Group;
  head: THREE.Object3D | null;
  aura: THREE.Object3D | null;
}

export interface Cell {
  x: number;
  z: number;
}
