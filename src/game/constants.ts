import type { EnemyDef, TowerDef, TowerKind, Wave } from './types';

export const GRID = 15;
export const TILE = 2;
export const GRID_HALF = (GRID - 1) / 2;

/** Угловые точки маршрута в координатах сетки. */
export const PATH_CELLS: Array<[number, number]> = [
  [-1, 2],
  [11, 2],
  [11, 5],
  [3, 5],
  [3, 8],
  [11, 8],
  [11, 11],
  [7, 11],
  [7, 12],
];

export const CORE_CELL: [number, number] = [7, 12];

export const COLORS = {
  bg: 0x03050c,
  panel: 0x070c16,
  ink: 0xc9d6e8,
  dim: 0x5e7390,
  mint: 0x9cc9ff,
  mint2: 0x3a5fa8,
  mint3: 0x182a4a,
  red: 0xff2b4d,
  redDim: 0x7a1a2c,
  amber: 0xffcf8a,
  green: 0x6fbf8f,
  line: 0x111c31,
};

export const START_MONEY = 260;
export const START_INTEGRITY = 100;
export const TOTAL_WAVES = 15;

export const TOWER_DEFS: Record<TowerKind, TowerDef> = {
  sentry: {
    kind: 'sentry',
    name: 'SENTRY',
    role: 'точечный луч',
    sigil: '▲',
    cost: 65,
    damage: 13,
    cooldown: 0.62,
    range: 6.4,
    color: COLORS.mint,
    desc: 'Быстрый одиночный луч. Дешёвый и точный — база любой обороны.',
  },
  pulse: {
    kind: 'pulse',
    name: 'PULSE',
    role: 'урон по площади',
    sigil: '◎',
    cost: 120,
    damage: 22,
    cooldown: 1.7,
    range: 5.4,
    splash: 3.1,
    color: COLORS.amber,
    desc: 'Импульс по цели и всем рядом. Создан для плотных групп.',
  },
  snare: {
    kind: 'snare',
    name: 'SNARE',
    role: 'замедление',
    sigil: '◇',
    cost: 95,
    damage: 0,
    cooldown: 0.5,
    range: 5.8,
    slow: 0.45,
    dps: 5,
    color: COLORS.green,
    desc: 'Поле помех: замедляет всё в радиусе и медленно разъедает.',
  },
  rail: {
    kind: 'rail',
    name: 'RAIL',
    role: 'снайпер',
    sigil: '⌁',
    cost: 185,
    damage: 140,
    cooldown: 3.1,
    range: 13.5,
    color: 0xdce9ff,
    desc: 'Дальний заряд, пробивающий линию насквозь. Дорогой, но решает.',
  },
};

export const TOWER_ORDER: TowerKind[] = ['sentry', 'pulse', 'snare', 'rail'];

export const ENEMY_DEFS: Record<EnemyDef['kind'], EnemyDef> = {
  fragment: {
    kind: 'fragment',
    name: 'FRAGMENT',
    sigil: '◆',
    hp: 48,
    speed: 3.6,
    reward: 7,
    coreDamage: 12,
    armor: 0,
    scale: 1,
  },
  glitch: {
    kind: 'glitch',
    name: 'GLITCH',
    sigil: '✕',
    hp: 32,
    speed: 5.8,
    reward: 7,
    coreDamage: 9,
    armor: 0,
    scale: 0.85,
  },
  gate: {
    kind: 'gate',
    name: 'GATE',
    sigil: '▮',
    hp: 210,
    speed: 2.2,
    reward: 18,
    coreDamage: 24,
    armor: 0.24,
    scale: 1.35,
  },
  face: {
    kind: 'face',
    name: 'THE FACE',
    sigil: '◉',
    hp: 1300,
    speed: 1.35,
    reward: 140,
    coreDamage: 35,
    armor: 0.34,
    scale: 2.1,
  },
};

const w = (groups: Array<[EnemyDef['kind'], number, number, number?]>): Wave =>
  groups.map(([kind, count, gap, delay]) => ({ kind, count, gap, delay: delay ?? 0 }));

export const WAVES: Wave[] = [
  w([['fragment', 5, 1.5]]),
  w([['fragment', 8, 1.2]]),
  w([
    ['fragment', 9, 1.15],
    ['glitch', 3, 0.9, 6],
  ]),
  w([
    ['glitch', 9, 0.8],
    ['fragment', 6, 1.1, 3],
  ]),
  w([
    ['gate', 2, 3.2],
    ['fragment', 10, 0.95, 2],
  ]),
  w([
    ['fragment', 12, 0.85],
    ['glitch', 8, 0.75, 5],
  ]),
  w([
    ['gate', 3, 2.6],
    ['glitch', 10, 0.7, 2],
  ]),
  w([
    ['fragment', 18, 0.6],
    ['gate', 2, 3.0, 4],
  ]),
  w([
    ['glitch', 18, 0.5],
    ['gate', 3, 2.4, 3],
  ]),
  w([
    ['face', 1, 1, 1],
    ['fragment', 12, 0.75, 4],
  ]),
  w([
    ['gate', 4, 2.2],
    ['glitch', 14, 0.55, 2],
  ]),
  w([
    ['fragment', 24, 0.48],
    ['gate', 4, 2.4, 5],
  ]),
  w([
    ['glitch', 26, 0.4],
    ['gate', 7, 1.9, 3],
  ]),
  w([
    ['gate', 9, 1.6],
    ['fragment', 24, 0.42, 4],
  ]),
  w([
    ['face', 2, 18, 1],
    ['gate', 6, 1.9, 4],
    ['glitch', 16, 0.45, 8],
  ]),
];

export const hpScale = (wave: number): number => 1 + (wave - 1) * 0.26;

export const upgradeCost = (base: number, level: number): number => Math.round(base * (0.9 + (level - 1) * 0.45));

export const damageAt = (base: number, level: number): number => base * (1 + (level - 1) * 0.65);
export const rangeAt = (base: number, level: number): number => base * (1 + (level - 1) * 0.1);

export const cellKey = (x: number, z: number): string => `${x},${z}`;
