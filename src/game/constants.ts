import { L, type Localized } from '../i18n';
import type {
  BranchDef,
  BranchId,
  DifficultyId,
  EnemyDef,
  RewardDef,
  TowerDef,
  TowerKind,
  Wave,
  WaveModDef,
} from './types';

export const GRID = 15;
export const TILE = 2;
export const GRID_HALF = (GRID - 1) / 2;

export interface MapDef {
  id: string;
  name: string;
  sub: Localized;
  paths: Array<Array<[number, number]>>;
  core: [number, number];
  moneyBonus?: number;
  waveScale?: number;
}

export const MAPS: MapDef[] = [
  {
    id: 'sector-07',
    name: 'SECTOR 07',
    sub: L('классический серпантин', 'classic serpentine'),
    paths: [
      [
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
    ],
    core: [7, 12],
  },
  {
    id: 'crossfire',
    name: 'CROSSFIRE',
    sub: L('четыре длинных коридора', 'four long corridors'),
    paths: [
      [
        [-1, 3],
        [13, 3],
        [13, 6],
        [1, 6],
        [1, 9],
        [13, 9],
        [13, 12],
        [8, 12],
      ],
    ],
    core: [8, 12],
  },
  {
    id: 'well',
    name: 'THE WELL',
    sub: L('спираль к центру', 'spiral to the centre'),
    paths: [
      [
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
    ],
    core: [9, 9],
  },
  {
    id: 'twin-gate',
    name: 'TWIN GATE',
    sub: L('два входа по диагонали', 'two diagonal entrances'),
    paths: [
      [
        [-1, 1],
        [13, 1],
        [13, 5],
        [9, 5],
        [9, 7],
        [7, 7],
      ],
      [
        [15, 13],
        [1, 13],
        [1, 9],
        [5, 9],
        [5, 7],
        [7, 7],
      ],
    ],
    core: [7, 7],
    moneyBonus: 80,
    waveScale: 0.85,
  },
  {
    id: 'split-signal',
    name: 'SPLIT SIGNAL',
    sub: L('два коридора, общее ядро', 'two corridors, one core'),
    paths: [
      [
        [-1, 4],
        [2, 4],
        [2, 9],
        [4, 9],
        [4, 12],
        [6, 12],
        [6, 7],
        [7, 7],
      ],
      [
        [15, 10],
        [12, 10],
        [12, 5],
        [10, 5],
        [10, 2],
        [8, 2],
        [8, 7],
        [7, 7],
      ],
    ],
    core: [7, 7],
    moneyBonus: 80,
    waveScale: 0.85,
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
export const SELL_RATE = 0.65;

export interface DifficultyDef {
  id: DifficultyId;
  name: Localized;
  sub: Localized;
  money: number;
  hpMul: number;
  rewardMul: number;
  integrityMul: number;
}

export const DIFFICULTIES: DifficultyDef[] = [
  {
    id: 'calm',
    name: L('СПОКОЙНЫЙ', 'CALM'),
    sub: L('больше DATA, слабее враги', 'more DATA, weaker enemies'),
    money: 340,
    hpMul: 0.85,
    rewardMul: 1.15,
    integrityMul: 1.2,
  },
  {
    id: 'standard',
    name: L('СТАНДАРТ', 'STANDARD'),
    sub: L('штатный протокол', 'standard protocol'),
    money: START_MONEY,
    hpMul: 1,
    rewardMul: 1,
    integrityMul: 1,
  },
  {
    id: 'hardcore',
    name: L('ХАРДКОР', 'HARDCORE'),
    sub: L('мало DATA, злее враги', 'less DATA, angrier enemies'),
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
    role: L('точечный луч', 'single-target beam'),
    sigil: '▲',
    cost: 65,
    damage: 13,
    cooldown: 0.62,
    range: 6.4,
    color: COLORS.mint,
    desc: L(
      'Быстрый одиночный луч. Дешёвый и точный — база любой обороны.',
      'Fast single beam. Cheap and precise — the base of any defence.',
    ),
  },
  pulse: {
    kind: 'pulse',
    name: 'PULSE',
    role: L('урон по площади', 'area damage'),
    sigil: '◎',
    cost: 120,
    damage: 26,
    cooldown: 1.6,
    range: 5.4,
    splash: 3.1,
    color: COLORS.amber,
    desc: L(
      'Импульс по цели и всем рядом. Создан для плотных групп.',
      'Pulse hits the target and everything nearby. Built for tight groups.',
    ),
  },
  snare: {
    kind: 'snare',
    name: 'SNARE',
    role: L('замедление', 'slow field'),
    sigil: '◇',
    cost: 90,
    damage: 0,
    cooldown: 0.5,
    range: 5.8,
    slow: 0.45,
    dps: 7,
    color: COLORS.green,
    desc: L(
      'Поле помех: замедляет всё в радиусе и медленно разъедает.',
      'Interference field: slows everything inside and slowly corrodes it.',
    ),
  },
  rail: {
    kind: 'rail',
    name: 'RAIL',
    role: L('снайпер', 'sniper'),
    sigil: '⌁',
    cost: 200,
    damage: 126,
    cooldown: 3.1,
    range: 11.5,
    color: 0xdce9ff,
    desc: L(
      'Дальний заряд, пробивающий линию насквозь. Дорогой, но решает.',
      'Long-range charge that pierces the whole line. Expensive, but decisive.',
    ),
  },
};

export const TOWER_ORDER: TowerKind[] = ['sentry', 'pulse', 'snare', 'rail'];

export const BRANCHES: Record<BranchId, BranchDef> = {
  'sentry-burst': {
    id: 'sentry-burst',
    kind: 'sentry',
    name: 'BURST',
    role: L('двойной темп', 'double rate'),
    desc: L(
      'Вдвое короче цикл, но чуть слабее каждый луч.',
      'Half the cycle time, slightly weaker beams.',
    ),
    cooldownMul: 0.5,
    damageMul: 0.9,
  },
  'sentry-pierce': {
    id: 'sentry-pierce',
    kind: 'sentry',
    name: 'PIERCE',
    role: L('бронебой', 'armour pierce'),
    desc: L(
      'Игнорирует 75% брони и бьёт сильнее.',
      'Ignores 75% of armour and hits harder.',
    ),
    damageMul: 1.35,
    armorPierce: 0.75,
  },
  'pulse-overload': {
    id: 'pulse-overload',
    kind: 'pulse',
    name: 'OVERLOAD',
    role: L('широкая волна', 'wide blast'),
    desc: L('Радиус взрыва почти вдвое больше.', 'Blast radius is almost doubled.'),
    splashMul: 1.7,
    damageMul: 1.1,
  },
  'pulse-singularity': {
    id: 'pulse-singularity',
    kind: 'pulse',
    name: 'SINGULARITY',
    role: L('точечный взрыв', 'focused blast'),
    desc: L('Меньше радиус, но почти двойной урон.', 'Smaller radius, almost double damage.'),
    splashMul: 0.75,
    damageMul: 2,
  },
  'snare-cryo': {
    id: 'snare-cryo',
    kind: 'snare',
    name: 'CRYO',
    role: L('глубокий холод', 'deep freeze'),
    desc: L('Замедление 65% и чуть больше радиус.', '65% slow and a slightly larger radius.'),
    slowAdd: 0.2,
    rangeMul: 1.1,
  },
  'snare-corrode': {
    id: 'snare-corrode',
    kind: 'snare',
    name: 'CORRODE',
    role: L('кислота', 'acid'),
    desc: L('Втрое больше урона в секунду.', 'Triple damage per second.'),
    dpsMul: 2.6,
  },
  'rail-ap': {
    id: 'rail-ap',
    kind: 'rail',
    name: 'AP',
    role: L('полный бронебой', 'full pierce'),
    desc: L('Игнорирует броню целиком.', 'Ignores armour completely.'),
    armorPierce: 1,
    damageMul: 1.1,
  },
  'rail-chain': {
    id: 'rail-chain',
    kind: 'rail',
    name: 'CHAIN',
    role: L('широкий луч', 'wide beam'),
    desc: L('Луч в 2.2 раза шире и задевает всю линию.', 'A beam 2.2× wider that cuts the whole line.'),
    chainMul: 2.2,
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
    tags: [L('рой', 'swarm')],
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
    tags: [L('быстрый', 'fast')],
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
    tags: [L('броня', 'armour')],
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
    tags: [L('босс', 'boss'), L('щит', 'shield')],
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
    tags: [L('щит', 'shield'), L('регенерация', 'regeneration')],
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
    tags: [L('воздух', 'air'), L('срезает маршрут', 'cuts the route')],
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
    tags: [L('делится', 'splits')],
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
    tags: [L('невидимый', 'cloaked')],
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

export const ROGUE_WAVE_MODS: WaveModDef[] = [
  {
    id: 'armor',
    name: L('УКРЕПЛЕНИЕ', 'HARDENED'),
    desc: L('вся волна +12% брони', 'the whole wave gets +12% armour'),
    weight: 10,
  },
  {
    id: 'haste',
    name: L('РАЗГОН', 'SURGE'),
    desc: L('вся волна +18% скорости', 'the whole wave moves 18% faster'),
    weight: 10,
  },
  {
    id: 'swarm',
    name: L('РОЙ', 'SWARM'),
    desc: L('на 30% больше врагов', '30% more enemies'),
    weight: 9,
  },
  {
    id: 'shield',
    name: L('ЩИТЫ', 'SHIELDS'),
    desc: L('щит у 40% состава', '40% of the wave carries shields'),
    weight: 8,
  },
  {
    id: 'fog',
    name: L('ТУМАН', 'FOG'),
    desc: L('невидимость у 30% состава', '30% of the wave phases out'),
    weight: 8,
  },
  {
    id: 'regen',
    name: L('РЕГЕНЕРАЦИЯ', 'REGENERATION'),
    desc: L('враги восстанавливают 1.5% HP в секунду', 'enemies regain 1.5% HP per second'),
    weight: 7,
  },
  {
    id: 'rush',
    name: L('СПЕШКА', 'RUSH'),
    desc: L('интервал появления короче на 35%', 'spawn intervals 35% shorter'),
    weight: 8,
  },
  {
    id: 'air',
    name: L('ВОЗДУХ', 'AIRBORNE'),
    desc: L('30% состава летит напрямую', '30% of the wave flies straight in'),
    weight: 7,
  },
  {
    id: 'bounty',
    name: L('ПРЕМИЯ', 'BOUNTY'),
    desc: L('+60% DATA за волну', '+60% DATA for the wave'),
    weight: 6,
  },
  {
    id: 'cursed',
    name: L('ПРОКЛЯТАЯ ВОЛНА', 'CURSED WAVE'),
    desc: L('+45% HP, но вдвое больше DATA', '+45% HP, but double DATA'),
    weight: 5,
  },
  {
    id: 'jam',
    name: L('ПОМЕХИ', 'JAMMING'),
    desc: L('башни стреляют на 25% медленнее', 'towers fire 25% slower'),
    weight: 6,
  },
  {
    id: 'elite',
    name: L('КОНВОЙ', 'ESCORT'),
    desc: L('в волну добавлены два GATE', 'two extra GATE units join the wave'),
    weight: 6,
  },
  {
    id: 'berserk',
    name: L('ЯРОСТЬ', 'BERSERK'),
    desc: L('ниже половины HP враги ускоряются', 'enemies speed up below half HP'),
    weight: 7,
  },
  {
    id: 'splinter',
    name: L('ДЕЛЕНИЕ', 'SPLINTER'),
    desc: L('20% врагов распадаются на осколки', '20% of enemies split on death'),
    weight: 6,
  },
  {
    id: 'tithe',
    name: L('ТИТР', 'TITHE'),
    desc: L('досрочный запуск не даёт бонуса', 'early launch gives no bonus'),
    weight: 5,
  },
  {
    id: 'fortified',
    name: L('ФОРТИФИКАЦИЯ', 'FORTIFIED'),
    desc: L('+25% брони, +15% HP, +40% DATA', '+25% armour, +15% HP, +40% DATA'),
    weight: 5,
  },
  {
    id: 'mirage',
    name: L('МИРАЖ', 'MIRAGE'),
    desc: L('вся волна периодически исчезает', 'the whole wave keeps phasing out'),
    weight: 5,
  },
];

export const REWARDS: RewardDef[] = [
  {
    id: 'damage',
    name: L('КАЛИБРОВКА', 'CALIBRATION'),
    desc: L('+15% урона всем протоколам', '+15% damage for every protocol'),
    tag: L('УРОН', 'DAMAGE'),
    rarity: 'common',
    weight: 10,
  },
  {
    id: 'range',
    name: L('ФОКУС', 'FOCUS'),
    desc: L('+8% радиуса действия', '+8% range'),
    tag: L('РАДИУС', 'RANGE'),
    rarity: 'common',
    weight: 9,
  },
  {
    id: 'bounty',
    name: L('СБОР ДАННЫХ', 'DATA HARVEST'),
    desc: L('+20% DATA за уничтожение', '+20% DATA per kill'),
    tag: L('ЭКОНОМИКА', 'ECONOMY'),
    rarity: 'common',
    weight: 9,
  },
  {
    id: 'suppress',
    name: L('ПОДАВЛЕНИЕ', 'SUPPRESSION'),
    desc: L('−12% прочности врагов', '−12% enemy HP'),
    tag: L('ВРАГИ', 'ENEMIES'),
    rarity: 'common',
    weight: 8,
  },
  {
    id: 'chill',
    name: L('ПОМЕХИ', 'INTERFERENCE'),
    desc: L('+15% силы замедления', '+15% slow strength'),
    tag: L('КОНТРОЛЬ', 'CONTROL'),
    rarity: 'common',
    weight: 8,
  },
  {
    id: 'repair',
    name: L('РЕМОНТ ЯДРА', 'CORE REPAIR'),
    desc: L('восстановить 20% целостности', 'restore 20% integrity'),
    tag: L('ЯДРО', 'CORE'),
    rarity: 'common',
    weight: 7,
  },
  {
    id: 'rapid',
    name: L('УСКОРЕНИЕ', 'RAPID CYCLE'),
    desc: L('+12% скорости стрельбы', '+12% fire rate'),
    tag: L('ТЕМП', 'TEMPO'),
    rarity: 'rare',
    weight: 6,
  },
  {
    id: 'splash',
    name: L('ШИРЕ ВЗРЫВ', 'WIDER BLAST'),
    desc: L('+20% радиуса взрыва PULSE', '+20% PULSE blast radius'),
    tag: L('УРОН', 'DAMAGE'),
    rarity: 'rare',
    weight: 6,
  },
  {
    id: 'pierce',
    name: L('БРОНЕБОЙ', 'PIERCING'),
    desc: L('+15% игнорирования брони', '+15% armour penetration'),
    tag: L('УРОН', 'DAMAGE'),
    rarity: 'rare',
    weight: 6,
  },
  {
    id: 'crit',
    name: L('КРИТИЧЕСКИЙ', 'CRITICAL'),
    desc: L('10% шанс двойного урона', '10% chance of double damage'),
    tag: L('УРОН', 'DAMAGE'),
    rarity: 'rare',
    weight: 5,
  },
  {
    id: 'interest',
    name: L('ПРОЦЕНТ', 'INTEREST'),
    desc: L('+10% награды за зачистку волны', '+10% wave-clear reward'),
    tag: L('ЭКОНОМИКА', 'ECONOMY'),
    rarity: 'rare',
    weight: 6,
  },
  {
    id: 'discount',
    name: L('СХЕМА', 'SCHEMATIC'),
    desc: L('−10% стоимости башен и апгрейдов', '−10% tower and upgrade cost'),
    tag: L('ЭКОНОМИКА', 'ECONOMY'),
    rarity: 'rare',
    weight: 5,
  },
  {
    id: 'refund',
    name: L('ПЕРЕРАБОТКА', 'RECYCLING'),
    desc: L('+15% возврата при продаже', '+15% sell refund'),
    tag: L('ЭКОНОМИКА', 'ECONOMY'),
    rarity: 'common',
    weight: 7,
  },
  {
    id: 'scavenge',
    name: L('СБОР ОСКОЛКОВ', 'SCAVENGER'),
    desc: L('+2 DATA за каждое уничтожение', '+2 DATA per kill'),
    tag: L('ЭКОНОМИКА', 'ECONOMY'),
    rarity: 'rare',
    weight: 5,
  },
  {
    id: 'harden',
    name: L('УПЛОТНЕНИЕ', 'HARDENING'),
    desc: L('+15 к пределу целостности', '+15 maximum integrity'),
    tag: L('ЯДРО', 'CORE'),
    rarity: 'rare',
    weight: 5,
  },
  {
    id: 'executioner',
    name: L('ДОБИВАНИЕ', 'EXECUTIONER'),
    desc: L('+25% урона по целям ниже 35% HP', '+25% damage below 35% HP'),
    tag: L('УРОН', 'DAMAGE'),
    rarity: 'epic',
    weight: 3,
  },
  {
    id: 'lastStand',
    name: L('ПОСЛЕДНИЙ РУБЕЖ', 'LAST STAND'),
    desc: L('+30% урона, пока ядро ниже 40%', '+30% damage while the core is below 40%'),
    tag: L('УРОН', 'DAMAGE'),
    rarity: 'epic',
    weight: 3,
  },
  {
    id: 'armored',
    name: L('ПРОТИВ БРОНИ', 'ANTI-ARMOUR'),
    desc: L('+20% урона по бронированным', '+20% damage to armoured targets'),
    tag: L('УРОН', 'DAMAGE'),
    rarity: 'rare',
    weight: 5,
  },
  {
    id: 'overclock',
    name: L('РАЗГОН СХЕМЫ', 'OVERCLOCK'),
    desc: L('+20% скорости стрельбы, −10% радиуса', '+20% fire rate, −10% range'),
    tag: L('ТЕМП', 'TEMPO'),
    rarity: 'epic',
    weight: 3,
  },
  {
    id: 'lucky',
    name: L('УДАЧА', 'LUCK'),
    desc: L('выбор из четырёх модулей вместо трёх', 'choose from four modules instead of three'),
    tag: L('ПРОЧЕЕ', 'UTILITY'),
    rarity: 'epic',
    weight: 2,
  },
  {
    id: 'fortress',
    name: L('КРЕПОСТЬ', 'FORTRESS'),
    desc: L('+25 к пределу и ремонт на 25%', '+25 to the cap and a 25% repair'),
    tag: L('ЯДРО', 'CORE'),
    rarity: 'epic',
    weight: 3,
  },
];

export const hpScale = (wave: number): number => 1 + (wave - 1) * 0.26;

export const ROGUE_REWARD_EVERY = 2;
export const ROGUE_PRESSURE = 0.05;

export const upgradeCost = (base: number, level: number): number =>
  Math.round(base * (0.9 + (level - 1) * 0.45));

export const damageAt = (base: number, level: number): number => base * (1 + (level - 1) * 0.65);
export const rangeAt = (base: number, level: number): number => base * (1 + (level - 1) * 0.1);

export const cellKey = (x: number, z: number): string => `${x},${z}`;
