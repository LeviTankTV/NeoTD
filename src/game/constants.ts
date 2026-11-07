import type {
  BranchDef,
  BranchId,
  DifficultyId,
  EnemyDef,
  RewardDef,
  TowerDef,
  TowerKind,
  Wave,
} from './types';

export const GRID = 15;
export const TILE = 2;
export const GRID_HALF = (GRID - 1) / 2;

export interface MapDef {
  id: string;
  name: string;
  sub: string;
  path: Array<[number, number]>;
  core: [number, number];
}

export const MAPS: MapDef[] = [
  {
    id: 'sector-07',
    name: 'SECTOR 07',
    sub: 'классический серпантин',
    path: [
      [-1, 2],
      [11, 2],
      [11, 5],
      [3, 5],
      [3, 8],
      [11, 8],
      [11, 11],
      [7, 11],
      [7, 12],
    ],
    core: [7, 12],
  },
  {
    id: 'crossfire',
    name: 'CROSSFIRE',
    sub: 'четыре длинных коридора',
    path: [
      [-1, 3],
      [13, 3],
      [13, 6],
      [1, 6],
      [1, 9],
      [13, 9],
      [13, 12],
      [8, 12],
    ],
    core: [8, 12],
  },
  {
    id: 'well',
    name: 'THE WELL',
    sub: 'спираль к центру',
    path: [
      [7, -1],
      [7, 2],
      [2, 2],
      [2, 12],
      [12, 12],
      [12, 5],
      [5, 5],
      [5, 9],
      [9, 9],
    ],
    core: [9, 9],
  },
];

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
  cyan: 0x66e0d0,
  violet: 0xb58cff,
  line: 0x111c31,
};

export const START_MONEY = 260;
export const START_INTEGRITY = 100;
export const TOTAL_WAVES = 15;

export const PREP_WINDOW = 24;
export const EARLY_BONUS_RATE = 2;

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  sub: string;
  money: number;
  hpMul: number;
  rewardMul: number;
  integrityMul: number;
}

export const DIFFICULTIES: DifficultyDef[] = [
  {
    id: 'calm',
    name: 'СПОКОЙНЫЙ',
    sub: 'больше DATA, слабее враги',
    money: 340,
    hpMul: 0.85,
    rewardMul: 1.15,
    integrityMul: 1.2,
  },
  { id: 'standard', name: 'СТАНДАРТ', sub: 'штатный протокол', money: START_MONEY, hpMul: 1, rewardMul: 1, integrityMul: 1 },
  {
    id: 'hardcore',
    name: 'ХАРДКОР',
    sub: 'мало DATA, злее враги',
    money: 200,
    hpMul: 1.3,
    rewardMul: 0.9,
    integrityMul: 1,
  },
];

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

export const BRANCHES: Record<BranchId, BranchDef> = {
  'sentry-burst': {
    id: 'sentry-burst',
    kind: 'sentry',
    name: 'BURST',
    role: 'двойной темп',
    desc: 'Вдвое короче цикл, но чуть слабее каждый луч.',
    cooldownMul: 0.5,
    damageMul: 0.9,
  },
  'sentry-pierce': {
    id: 'sentry-pierce',
    kind: 'sentry',
    name: 'PIERCE',
    role: 'бронебой',
    desc: 'Игнорирует 75% брони и бьёт сильнее.',
    damageMul: 1.35,
    armorPierce: 0.75,
  },
  'pulse-overload': {
    id: 'pulse-overload',
    kind: 'pulse',
    name: 'OVERLOAD',
    role: 'широкая волна',
    desc: 'Радиус взрыва почти вдвое больше.',
    splashMul: 1.7,
    damageMul: 1.1,
  },
  'pulse-singularity': {
    id: 'pulse-singularity',
    kind: 'pulse',
    name: 'SINGULARITY',
    role: 'точечный взрыв',
    desc: 'Меньше радиус, но почти двойной урон.',
    splashMul: 0.75,
    damageMul: 2,
  },
  'snare-cryo': {
    id: 'snare-cryo',
    kind: 'snare',
    name: 'CRYO',
    role: 'глубокий холод',
    desc: 'Замедление 65% и чуть больше радиус.',
    slowAdd: 0.2,
    rangeMul: 1.1,
  },
  'snare-corrode': {
    id: 'snare-corrode',
    kind: 'snare',
    name: 'CORRODE',
    role: 'кислота',
    desc: 'Втрое больше урона в секунду.',
    dpsMul: 2.6,
  },
  'rail-ap': {
    id: 'rail-ap',
    kind: 'rail',
    name: 'AP',
    role: 'полный бронебой',
    desc: 'Игнорирует броню целиком.',
    armorPierce: 1,
    damageMul: 1.1,
  },
  'rail-chain': {
    id: 'rail-chain',
    kind: 'rail',
    name: 'CHAIN',
    role: 'широкий луч',
    desc: 'Луч в 2.6 раза шире и задевает всю линию.',
    chainMul: 2.6,
  },
};

export const TOWER_BRANCHES: Record<TowerKind, [BranchId, BranchId]> = {
  sentry: ['sentry-burst', 'sentry-pierce'],
  pulse: ['pulse-overload', 'pulse-singularity'],
  snare: ['snare-cryo', 'snare-corrode'],
  rail: ['rail-ap', 'rail-chain'],
};

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
    tags: ['рой'],
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
    tags: ['быстрый'],
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
    tags: ['броня'],
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
    shield: 420,
    tags: ['босс', 'щит'],
  },
  shield: {
    kind: 'shield',
    name: 'BULWARK',
    sigil: '▰',
    hp: 150,
    speed: 2.4,
    reward: 16,
    coreDamage: 18,
    armor: 0.12,
    scale: 1.15,
    shield: 110,
    tags: ['щит', 'регенерация'],
  },
  flyer: {
    kind: 'flyer',
    name: 'WISP',
    sigil: '⌃',
    hp: 60,
    speed: 4.4,
    reward: 9,
    coreDamage: 10,
    armor: 0,
    scale: 0.9,
    flying: true,
    tags: ['воздух', 'срезает маршрут'],
  },
  splitter: {
    kind: 'splitter',
    name: 'MITOSIS',
    sigil: '❖',
    hp: 170,
    speed: 2.3,
    reward: 15,
    coreDamage: 18,
    armor: 0.05,
    scale: 1.25,
    splits: 2,
    tags: ['делится'],
  },
  phantom: {
    kind: 'phantom',
    name: 'PHANTOM',
    sigil: '◌',
    hp: 85,
    speed: 3.5,
    reward: 11,
    coreDamage: 12,
    armor: 0,
    scale: 0.95,
    cloak: true,
    tags: ['невидимый'],
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
    ['glitch', 8, 0.8],
    ['flyer', 4, 1.3, 2],
  ]),
  w([
    ['gate', 2, 3.2],
    ['fragment', 10, 0.95, 2],
  ]),
  w([
    ['shield', 3, 2.6],
    ['flyer', 6, 0.9, 3],
  ]),
  w([
    ['gate', 3, 2.6],
    ['glitch', 10, 0.7, 2],
  ]),
  w([
    ['splitter', 3, 2.8],
    ['fragment', 14, 0.6, 3],
  ]),
  w([
    ['phantom', 4, 2.4],
    ['glitch', 14, 0.55, 2],
  ]),
  w([
    ['face', 1, 1, 1],
    ['fragment', 10, 0.75, 4],
  ]),
  w([
    ['shield', 5, 2.1],
    ['gate', 4, 2.4, 3],
  ]),
  w([
    ['flyer', 12, 0.6],
    ['splitter', 4, 2.2, 4],
  ]),
  w([
    ['phantom', 6, 1.8],
    ['gate', 6, 1.9, 3],
    ['glitch', 12, 0.45, 8],
  ]),
  w([
    ['splitter', 6, 1.9],
    ['shield', 6, 1.8, 3],
    ['flyer', 10, 0.6, 7],
  ]),
  w([
    ['face', 2, 18, 1],
    ['gate', 6, 1.9, 4],
    ['phantom', 4, 1.6, 8],
  ]),
];

export function waveFor(wave: number): Wave {
  if (wave <= WAVES.length) return WAVES[wave - 1];

  const extra = wave - WAVES.length;
  const groups: Array<[EnemyDef['kind'], number, number, number?]> = [
    ['fragment', 16 + extra * 2, 0.5],
    ['glitch', 10 + extra, 0.45, 3],
    ['gate', 4 + Math.floor(extra * 0.4), 1.8, 6],
  ];

  if (extra % 2 === 1) groups.push(['shield', 4 + Math.floor(extra * 0.35), 1.7, 4]);
  if (extra % 2 === 0) groups.push(['splitter', 4 + Math.floor(extra * 0.3), 1.8, 5]);
  if (extra % 3 === 0) groups.push(['flyer', 10 + extra, 0.5, 8]);
  if (extra % 3 === 1) groups.push(['phantom', 4 + Math.floor(extra * 0.3), 1.5, 9]);
  if (wave % 5 === 0) groups.push(['face', 1 + Math.floor(extra / 10), 6, 2]);

  return w(groups);
}

export const ROGUE_WAVE_MODS: Array<{ id: string; name: string; desc: string }> = [
  { id: 'armor', name: 'УКРЕПЛЕНИЕ', desc: 'вся волна +12% брони' },
  { id: 'haste', name: 'РАЗГОН', desc: 'вся волна +18% скорости' },
  { id: 'swarm', name: 'РОЙ', desc: 'на 30% больше врагов' },
  { id: 'shield', name: 'ЩИТЫ', desc: 'щит у 40% состава' },
  { id: 'fog', name: 'ТУМАН', desc: 'невидимость у 30% состава' },
];

export const REWARDS: RewardDef[] = [
  { id: 'damage', name: 'КАЛИБРОВКА', desc: '+15% урона всем протоколам', tag: 'УРОН' },
  { id: 'range', name: 'ФОКУС', desc: '+8% радиуса действия', tag: 'РАДИУС' },
  { id: 'bounty', name: 'СБОР ДАННЫХ', desc: '+20% DATA за уничтожение', tag: 'ЭКОНОМИКА' },
  { id: 'suppress', name: 'ПОДАВЛЕНИЕ', desc: '−12% прочности врагов', tag: 'ВРАГИ' },
  { id: 'chill', name: 'ПОМЕХИ', desc: '+15% силы замедления', tag: 'КОНТРОЛЬ' },
  { id: 'repair', name: 'РЕМОНТ ЯДРА', desc: 'восстановить 20% целостности', tag: 'ЯДРО' },
];

export const hpScale = (wave: number): number => 1 + (wave - 1) * 0.26;

export const upgradeCost = (base: number, level: number): number =>
  Math.round(base * (0.9 + (level - 1) * 0.45));

export const damageAt = (base: number, level: number): number => base * (1 + (level - 1) * 0.65);
export const rangeAt = (base: number, level: number): number => base * (1 + (level - 1) * 0.1);

export const cellKey = (x: number, z: number): string => `${x},${z}`;
