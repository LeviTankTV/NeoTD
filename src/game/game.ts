import * as THREE from 'three';
import { L, tf, tr, type Localized } from '../i18n';
import type { Effects } from '../render/effects';
import { applyTowerLevel, createEnemyModel, createTowerModel, disposeGroup } from '../render/models';
import {
  BRANCHES,
  DIFFICULTIES,
  EARLY_BONUS_RATE,
  ENEMY_DEFS,
  PREP_WINDOW,
  REWARDS,
  ROGUE_WAVE_MODS,
  SELL_RATE,
  START_INTEGRITY,
  TOTAL_WAVES,
  TOWER_BRANCHES,
  TOWER_DEFS,
  damageAt,
  hpScale,
  rangeAt,
  upgradeCost,
  waveFor,
  type MapDef,
} from './constants';
import type { GameMap } from './map';
import type {
  BranchId,
  Cell,
  DifficultyId,
  Enemy,
  EnemyKind,
  LogKind,
  ModeId,
  Phase,
  RewardDef,
  RunStats,
  SfxName,
  TargetPriority,
  Tower,
  TowerKind,
  Wave,
  WaveModDef,
} from './types';
import { emptyRunStats } from './types';

export interface GameHooks {
  log(text: string, kind?: LogKind): void;
  phase(phase: Phase): void;
  coreHit(damage: number): void;
  changed(): void;
  sfx(name: SfxName): void;
  rewards?(options: RewardDef[]): void;
}

export interface GameOptions {
  mode: ModeId;
  difficulty: DifficultyId;
}

interface SpawnOptions {
  distance?: number;
  hpFactor?: number;
  rewardFactor?: number;
  enraged?: boolean;
  route?: number;
}

interface TowerSnapshot {
  kind: TowerKind;
  cell: Cell;
  level: number;
  branch: BranchId | null;
  priority: TargetPriority;
  spent: number;
}

interface Snapshot {
  money: number;
  integrity: number;
  towers: TowerSnapshot[];
}

const ENEMY_Y: Record<EnemyKind, number> = {
  fragment: 0.6,
  glitch: 0.55,
  gate: 0.62,
  face: 1.25,
  shield: 0.6,
  flyer: 1.7,
  splitter: 0.65,
  phantom: 0.55,
};

const ENEMY_COLOR: Record<EnemyKind, number> = {
  fragment: 0xff2b4d,
  glitch: 0xff6b7f,
  gate: 0xff2b4d,
  face: 0xffcf8a,
  shield: 0x66e0d0,
  flyer: 0x9cc9ff,
  splitter: 0xb58cff,
  phantom: 0x5e7390,
};

export class Game {
  readonly map: GameMap;
  readonly mapDef: MapDef;
  readonly mode: ModeId;
  readonly difficulty: DifficultyId;
  readonly stats: RunStats = emptyRunStats();

  money: number;
  integrity: number;
  integrityCap: number;
  wave = 1;
  phase: Phase = 'prep';
  kills = 0;
  leaks = 0;
  time = 0;
  selected: Tower | null = null;
  selectedKind: TowerKind | null = null;
  hover: Cell | null = null;
  moving: Tower | null = null;

  damageMul = 1;
  rangeMul = 1;
  bountyMul = 1;
  slowMul = 1;
  enemyHpMul = 1;
  cooldownMul = 1;
  splashMul = 1;
  pierceAdd = 0;
  critChance = 0;
  scavenge = 0;
  interestMul = 1;
  costMul = 1;
  refundMul = SELL_RATE;
  executioner = false;
  lastStand = false;
  armoredBonus = false;
  extraChoice = false;

  waveMods: WaveModDef[] = [];
  pendingRewards: RewardDef[] = [];
  prepClock = 0;

  readonly towers: Tower[] = [];
  readonly enemies: Enemy[] = [];
  readonly killsByKind: Partial<Record<EnemyKind, number>> = {};
  readonly towerBuilds: Partial<Record<TowerKind, number>> = {};
  readonly branchIds: string[] = [];

  private readonly rewardTags = new Map<string, number>();
  private readonly synergyDone = new Set<string>();
  private readonly takenRewards = new Set<string>();
  private spawns: Array<{ at: number; kind: EnemyKind }> = [];
  private waveClock = 0;
  private waveTotal = 0;
  private waveKilled = 0;
  private waveLeaked = 0;
  private nextId = 1;
  private disposed = false;
  private undoStack: Snapshot[] = [];
  private routeCursor = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly effects: Effects,
    private readonly hooks: GameHooks,
    map: GameMap,
    options: GameOptions,
  ) {
    this.map = map;
    this.mapDef = map.def;
    this.mode = options.mode;
    this.difficulty = options.difficulty;

    const diff = this.diff;
    this.integrityCap = START_INTEGRITY * diff.integrityMul;
    this.money = diff.money + (map.def.moneyBonus ?? 0);
    this.integrity = this.integrityCap;
    this.stats.peakMoney = this.money;
  }

  get diff() {
    return DIFFICULTIES.find((item) => item.id === this.difficulty) ?? DIFFICULTIES[1];
  }

  get waveRemaining(): number {
    return Math.max(0, this.waveTotal - this.waveKilled - this.waveLeaked);
  }

  get waveProgress(): number {
    if (this.waveTotal === 0) return 0;
    return (this.waveKilled + this.waveLeaked) / this.waveTotal;
  }

  get totalWaves(): number {
    return this.mode === 'endless' ? Number.POSITIVE_INFINITY : TOTAL_WAVES;
  }

  get nextWave(): Wave {
    return waveFor(this.wave);
  }

  get earlyBonus(): number {
    if (this.phase !== 'prep') return 0;
    if (this.hasMod('tithe')) return 0;
    return Math.max(0, Math.floor((PREP_WINDOW - this.prepClock) * EARLY_BONUS_RATE));
  }

  get prepRemaining(): number {
    return Math.max(0, Math.ceil(PREP_WINDOW - this.prepClock));
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get bossActive(): boolean {
    return this.enemies.some((enemy) => enemy.kind === 'face' && !enemy.dead);
  }

  towerCost(kind: TowerKind): number {
    return Math.round(TOWER_DEFS[kind].cost * this.costMul);
  }

  upgradeCostFor(tower: Tower): number {
    return Math.round(upgradeCost(TOWER_DEFS[tower.kind].cost, tower.level) * this.costMul);
  }

  branchCostFor(tower: Tower): number {
    return Math.round(TOWER_DEFS[tower.kind].cost * 1.2 * this.costMul);
  }

  refundFor(tower: Tower): number {
    return Math.floor(tower.spent * this.refundMul);
  }

  statsFor(tower: Tower) {
    const def = TOWER_DEFS[tower.kind];
    const branch = tower.branch ? BRANCHES[tower.branch] : null;

    return {
      damage:
        damageAt(def.damage, tower.level) * (branch?.damageMul ?? 1) * this.damageMul,
      range: rangeAt(def.range, tower.level) * (branch?.rangeMul ?? 1) * this.rangeMul,
      cooldown: def.cooldown * (branch?.cooldownMul ?? 1) / this.cooldownMul,
      splash: (def.splash ?? 0) * (branch?.splashMul ?? 1) * this.splashMul,
      slow: Math.min(0.85, (def.slow ?? 0) + (branch?.slowAdd ?? 0)) * this.slowMul,
      dps: (def.dps ?? 0) * (branch?.dpsMul ?? 1) * this.damageMul,
      armorPierce: Math.min(1, (branch?.armorPierce ?? 0) + this.pierceAdd),
      chainMul: branch?.chainMul ?? 1,
    };
  }

  startWave(): void {
    if (this.phase !== 'prep') return;
    if (this.pendingRewards.length > 0) return;

    const bonus = this.earlyBonus;
    if (bonus > 0) {
      this.earn(bonus);
      this.hooks.log(
        tf(L('ДОСРОЧНЫЙ ЗАПУСК: +{bonus} DATA', 'EARLY LAUNCH: +{bonus} DATA'), { bonus }),
        'ok',
      );
    }

    const groups = this.nextWave;
    const extra: Wave = this.hasMod('elite')
      ? [{ kind: 'gate', count: 2, gap: 1.4, delay: 1 }]
      : [];
    const swarm = this.hasMod('swarm');
    const rush = this.hasMod('rush') ? 0.65 : 1;
    this.spawns = [];
    this.waveTotal = 0;

    const mapScale = this.mapDef.waveScale ?? 1;
    for (const group of [...groups, ...extra]) {
      const base = swarm ? Math.ceil(group.count * 1.3) : group.count;
      const count = Math.max(1, Math.round(base * mapScale));
      for (let i = 0; i < count; i++) {
        this.spawns.push({ at: (group.delay + i * group.gap) * rush, kind: group.kind });
        this.waveTotal++;
      }
    }

    this.spawns.sort((a, b) => a.at - b.at);
    this.waveClock = 0;
    this.waveKilled = 0;
    this.waveLeaked = 0;
    this.prepClock = 0;
    this.phase = 'wave';
    this.stats.maxWave = Math.max(this.stats.maxWave, this.wave);
    this.hooks.phase(this.phase);
    this.hooks.changed();

    const boss = [...groups, ...extra].some((group) => group.kind === 'face');
    if (boss) {
      this.hooks.log(`WAVE ${pad(this.wave)}: THE FACE DETECTED`, 'alert');
      this.hooks.sfx('boss');
    } else {
      this.hooks.log(`WAVE ${pad(this.wave)}: CONTACT`, 'warn');
      this.hooks.sfx('wave');
    }
  }

  applyReward(id: string): void {
    const reward =
      REWARDS.find((item) => item.id === id) ?? this.pendingRewards.find((item) => item.id === id);
    if (!reward) return;

    if (reward.id === 'damage') this.damageMul *= 1.15;
    if (reward.id === 'range') this.rangeMul *= 1.08;
    if (reward.id === 'bounty') this.bountyMul *= 1.2;
    if (reward.id === 'suppress') this.enemyHpMul *= 0.88;
    if (reward.id === 'chill') this.slowMul *= 1.15;
    if (reward.id === 'repair') this.integrity = Math.min(this.integrityCap, this.integrity + 20);
    if (reward.id === 'rapid') this.cooldownMul *= 0.88;
    if (reward.id === 'splash') this.splashMul *= 1.2;
    if (reward.id === 'pierce') this.pierceAdd = Math.min(1, this.pierceAdd + 0.15);
    if (reward.id === 'crit') this.critChance += 0.1;
    if (reward.id === 'interest') this.interestMul *= 1.1;
    if (reward.id === 'discount') this.costMul *= 0.9;
    if (reward.id === 'refund') this.refundMul = Math.min(0.95, this.refundMul + 0.15);
    if (reward.id === 'scavenge') this.scavenge += 2;
    if (reward.id === 'harden') {
      this.integrityCap += 15;
      this.integrity += 15;
    }
    if (reward.id === 'executioner') this.executioner = true;
    if (reward.id === 'lastStand') this.lastStand = true;
    if (reward.id === 'armored') this.armoredBonus = true;
    if (reward.id === 'overclock') {
      this.cooldownMul *= 0.8;
      this.rangeMul *= 0.9;
    }
    if (reward.id === 'lucky') this.extraChoice = true;
    if (reward.id === 'fortress') {
      this.integrityCap += 25;
      this.integrity = Math.min(this.integrityCap, this.integrity + 25);
    }

    this.takenRewards.add(reward.id);
    this.stats.rewards++;
    this.pendingRewards = [];
    this.hooks.log(
      tf(L('МОДУЛЬ ПРИНЯТ: {name}', 'MODULE ACCEPTED: {name}'), { name: tr(reward.name) }),
      'ok',
    );
    this.hooks.sfx('upgrade');
    this.applySynergy(reward.tag);
    this.hooks.changed();
  }

  setKind(kind: TowerKind | null): void {
    this.selectedKind = kind;
    this.moving = null;
    if (kind) this.selected = null;
    this.hooks.changed();
  }

  setHover(cell: Cell | null): void {
    this.hover = cell;
  }

  canPlace(kind: TowerKind, cell: Cell): boolean {
    if (!this.map.isBuildable(cell.x, cell.z)) return false;
    if (this.towerAt(cell)) return false;
    return this.money >= this.towerCost(kind);
  }

  towerAt(cell: Cell): Tower | undefined {
    return this.towers.find((tower) => tower.cell.x === cell.x && tower.cell.z === cell.z);
  }

  place(kind: TowerKind, cell: Cell): boolean {
    if (!this.map.isBuildable(cell.x, cell.z)) return false;
    if (this.towerAt(cell)) return false;

    const def = TOWER_DEFS[kind];
    const cost = this.towerCost(kind);
    if (this.money < cost) {
      this.hooks.log(tf(L('НЕДОСТАТОЧНО DATA', 'NOT ENOUGH DATA'), {}), 'alert');
      this.hooks.sfx('error');
      return false;
    }

    this.pushUndo();
    this.money -= cost;
    const tower = this.createTower(kind, cell, 1, null, 'first', cost);
    this.towers.push(tower);
    this.selected = tower;
    this.selectedKind = null;

    this.stats.towersBuilt++;
    this.stats.peakTowers = Math.max(this.stats.peakTowers, this.towers.length);
    this.towerBuilds[kind] = (this.towerBuilds[kind] ?? 0) + 1;
    this.hooks.log(`${def.name} ONLINE: −${cost} DATA`, 'ok');
    this.hooks.sfx('build');
    this.hooks.changed();
    return true;
  }

  selectTower(cell: Cell): Tower | null {
    const tower = this.towerAt(cell) ?? null;
    this.selected = tower;
    if (tower) this.selectedKind = null;
    this.moving = null;
    this.hooks.changed();
    return tower;
  }

  clearSelection(): void {
    this.selected = null;
    this.selectedKind = null;
    this.moving = null;
    this.hooks.changed();
  }

  upgradeSelected(): boolean {
    const tower = this.selected;
    if (!tower || tower.level >= 3) return false;

    const cost = this.upgradeCostFor(tower);
    if (this.money < cost) {
      this.hooks.log(tf(L('НЕДОСТАТОЧНО DATA', 'NOT ENOUGH DATA'), {}), 'alert');
      this.hooks.sfx('error');
      return false;
    }

    this.pushUndo();
    this.money -= cost;
    tower.level += 1;
    tower.spent += cost;
    if (tower.level >= 3) this.stats.maxedTowers++;
    this.refreshTower(tower);

    this.hooks.log(
      `${TOWER_DEFS[tower.kind].name} → LVL ${tower.level}: −${cost} DATA`,
      'ok',
    );
    this.hooks.sfx('upgrade');
    this.hooks.changed();
    return true;
  }

  chooseBranch(branch: BranchId): boolean {
    const tower = this.selected;
    if (!tower || tower.branch || tower.level < 3) return false;

    const allowed = TOWER_BRANCHES[tower.kind];
    if (!allowed.includes(branch)) return false;

    const cost = this.branchCostFor(tower);
    if (this.money < cost) {
      this.hooks.log(tf(L('НЕДОСТАТОЧНО DATA', 'NOT ENOUGH DATA'), {}), 'alert');
      this.hooks.sfx('error');
      return false;
    }

    this.pushUndo();
    this.money -= cost;
    tower.spent += cost;
    tower.branch = branch;
    this.refreshTower(tower);

    const info = BRANCHES[branch];
    this.stats.branches++;
    if (!this.branchIds.includes(branch)) this.branchIds.push(branch);
    this.hooks.log(`${info.name}: ${tr(info.role)} · ${cost} DATA`, 'ok');
    this.hooks.sfx('upgrade');
    this.hooks.changed();
    return true;
  }

  setPriority(priority: TargetPriority): void {
    const tower = this.selected;
    if (!tower) return;
    tower.priority = priority;
    this.hooks.changed();
  }

  beginMove(): boolean {
    if (!this.selected) return false;
    this.moving = this.selected;
    this.hooks.log(
      tf(L('ПЕРЕМЕЩЕНИЕ: выбери свободную клетку', 'REPOSITION: pick a free cell'), {}),
      'sys',
    );
    this.hooks.changed();
    return true;
  }

  finishMove(cell: Cell): boolean {
    const tower = this.moving;
    if (!tower) return false;

    if (!this.map.isBuildable(cell.x, cell.z) || this.towerAt(cell)) {
      this.hooks.log(tf(L('КЛЕТКА ЗАНЯТА', 'CELL OCCUPIED'), {}), 'alert');
      this.hooks.sfx('error');
      return false;
    }

    this.pushUndo();
    tower.cell = { ...cell };
    const center = this.map.cellCenter(cell.x, cell.z);
    tower.group.position.set(center.x, 0.1, center.z);
    this.moving = null;
    this.selected = tower;

    this.hooks.log(
      tf(L('ПРОТОКОЛ ПЕРЕМЕЩЁН: без потерь', 'PROTOCOL MOVED: no losses'), {}),
      'ok',
    );
    this.hooks.sfx('build');
    this.hooks.changed();
    return true;
  }

  sellSelected(): boolean {
    const tower = this.selected;
    if (!tower) return false;

    this.pushUndo();
    const refund = this.refundFor(tower);
    this.removeTower(tower);
    this.selected = null;
    this.moving = null;
    this.stats.soldTowers++;

    this.hooks.log(
      tf(L('{name} OFFLINE: +{refund} DATA', '{name} OFFLINE: +{refund} DATA'), {
        name: TOWER_DEFS[tower.kind].name,
        refund,
      }),
      'warn',
    );
    this.hooks.sfx('sell');
    this.hooks.changed();
    return true;
  }

  upgradeAll(kind: TowerKind): number {
    const targets = this.towers.filter((tower) => tower.kind === kind && tower.level < 3);
    if (targets.length === 0) return 0;

    let upgraded = 0;
    const before = this.money;
    this.pushUndo();

    for (const tower of targets) {
      const cost = this.upgradeCostFor(tower);
      if (this.money < cost) break;
      this.money -= cost;
      tower.level += 1;
      tower.spent += cost;
      if (tower.level >= 3) this.stats.maxedTowers++;
      this.refreshTower(tower);
      upgraded++;
    }

    if (upgraded === 0) {
      this.undoStack.pop();
      this.hooks.log(tf(L('НЕДОСТАТОЧНО DATA', 'NOT ENOUGH DATA'), {}), 'alert');
      this.hooks.sfx('error');
      return 0;
    }

    this.hooks.log(
      tf(L('{name} ×{count} → LVL+: −{spent} DATA', '{name} ×{count} → LVL+: −{spent} DATA'), {
        name: TOWER_DEFS[kind].name,
        count: upgraded,
        spent: before - this.money,
      }),
      'ok',
    );
    this.hooks.sfx('upgrade');
    this.hooks.changed();
    return upgraded;
  }

  sellAll(kind: TowerKind): number {
    const targets = this.towers.filter((tower) => tower.kind === kind);
    if (targets.length === 0) return 0;

    this.pushUndo();
    const refund = targets.reduce((sum, tower) => sum + this.refundFor(tower), 0);
    for (const tower of targets) this.removeTower(tower);
    this.selected = null;
    this.moving = null;
    this.stats.soldTowers += targets.length;

    this.hooks.log(
      tf(L('{name} ×{count} OFFLINE: +{refund} DATA', '{name} ×{count} OFFLINE: +{refund} DATA'), {
        name: TOWER_DEFS[kind].name,
        count: targets.length,
        refund: Math.floor(refund),
      }),
      'warn',
    );
    this.hooks.sfx('sell');
    this.hooks.changed();
    return targets.length;
  }

  undo(): boolean {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return false;

    for (const tower of [...this.towers]) this.removeTower(tower, false);
    this.towers.length = 0;
    this.selected = null;
    this.moving = null;

    for (const saved of snapshot.towers) {
      const tower = this.createTower(
        saved.kind,
        saved.cell,
        saved.level,
        saved.branch,
        saved.priority,
        saved.spent,
      );
      this.towers.push(tower);
    }

    this.money = snapshot.money;
    this.integrity = snapshot.integrity;
    this.hooks.log(
      tf(L('ПОСЛЕДНЕЕ ДЕЙСТВИЕ ОТМЕНЕНО', 'LAST ACTION REVERTED'), {}),
      'sys',
    );
    this.hooks.sfx('sell');
    this.hooks.changed();
    return true;
  }

  update(rawDt: number): void {
    if (this.disposed) return;
    if (this.phase === 'won' || this.phase === 'lost') return;

    const dt = Math.min(rawDt, 0.05);
    this.time += dt;
    this.stats.time = this.time;

    if (this.phase === 'prep') {
      this.prepClock += dt;
    }

    for (const enemy of this.enemies) enemy.slow = 0;

    if (this.phase === 'wave') this.updateSpawns(dt);
    this.updateTowers(dt);
    this.updateEnemies(dt);
    this.cleanup();

    if (
      this.phase === 'wave' &&
      this.spawns.length === 0 &&
      this.enemies.length === 0 &&
      this.waveTotal > 0
    ) {
      this.completeWave();
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.group);
      disposeGroup(enemy.group);
    }
    for (const tower of this.towers) {
      this.scene.remove(tower.group);
      disposeGroup(tower.group);
    }
    this.enemies.length = 0;
    this.towers.length = 0;
  }

  private hasMod(id: string): boolean {
    return this.waveMods.some((mod) => mod.id === id);
  }

  private earn(amount: number): void {
    this.money += amount;
    this.stats.dataEarned += amount;
    this.stats.peakMoney = Math.max(this.stats.peakMoney, this.money);
  }

  private applySynergy(tag: Localized): void {
    const key = tag.ru;
    const count = (this.rewardTags.get(key) ?? 0) + 1;
    this.rewardTags.set(key, count);
    if (count < 3 || this.synergyDone.has(key)) return;

    this.synergyDone.add(key);
    if (key === 'УРОН') this.damageMul *= 1.1;
    if (key === 'ЭКОНОМИКА') this.bountyMul *= 1.15;
    if (key === 'КОНТРОЛЬ') this.slowMul *= 1.1;
    if (key === 'ЯДРО') this.integrity = Math.min(this.integrityCap, this.integrity + 10);
    if (key === 'ТЕМП') this.cooldownMul *= 0.92;
    if (key === 'РАДИУС') this.rangeMul *= 1.06;

    this.hooks.log(
      tf(L('СИНЕРГИЯ {tag}: три модуля одной ветви', 'SYNERGY {tag}: three modules of one branch'), {
        tag: tr(tag),
      }),
      'ok',
    );
    this.hooks.sfx('upgrade');
  }

  private createTower(
    kind: TowerKind,
    cell: Cell,
    level: number,
    branch: BranchId | null,
    priority: TargetPriority,
    spent: number,
  ): Tower {
    const def = TOWER_DEFS[kind];
    const model = createTowerModel(kind);
    const center = this.map.cellCenter(cell.x, cell.z);
    model.group.position.set(center.x, 0.1, center.z);
    model.group.scale.setScalar(TOWER_SCALE);
    this.scene.add(model.group);

    if (model.aura) {
      model.aura.scale.setScalar(def.range / TOWER_SCALE);
    }

    const tower: Tower = {
      id: this.nextId++,
      kind,
      cell: { ...cell },
      level,
      branch,
      priority,
      cooldown: 0,
      tick: 0,
      spent,
      damage: damageAt(def.damage, level),
      range: rangeAt(def.range, level),
      group: model.group,
      head: model.head,
      aura: model.aura,
    };

    this.refreshTower(tower, false);
    applyTowerLevel({ group: tower.group, head: tower.head, aura: tower.aura }, level, def.color);
    return tower;
  }

  private refreshTower(tower: Tower, syncLevelVisual = true): void {
    const stats = this.statsFor(tower);
    tower.damage = stats.damage;
    tower.range = stats.range;

    if (tower.aura) tower.aura.scale.setScalar(stats.range / TOWER_SCALE);
    if (syncLevelVisual) {
      applyTowerLevel(
        { group: tower.group, head: tower.head, aura: tower.aura },
        tower.level,
        TOWER_DEFS[tower.kind].color,
      );
    }
  }

  private removeTower(tower: Tower, refund = true): void {
    if (refund) this.money += this.refundFor(tower);
    this.scene.remove(tower.group);
    disposeGroup(tower.group);
    const index = this.towers.indexOf(tower);
    if (index >= 0) this.towers.splice(index, 1);
  }

  private pushUndo(): void {
    this.undoStack.push({
      money: this.money,
      integrity: this.integrity,
      towers: this.towers.map((tower) => ({
        kind: tower.kind,
        cell: { ...tower.cell },
        level: tower.level,
        branch: tower.branch,
        priority: tower.priority,
        spent: tower.spent,
      })),
    });
    if (this.undoStack.length > 30) this.undoStack.shift();
  }

  private updateSpawns(dt: number): void {
    this.waveClock += dt;
    while (this.spawns.length > 0 && this.spawns[0].at <= this.waveClock) {
      const spawn = this.spawns.shift();
      if (spawn) this.spawnEnemy(spawn.kind);
    }
  }

  private spawnEnemy(kind: EnemyKind, options: SpawnOptions = {}): void {
    const def = ENEMY_DEFS[kind];
    const model = createEnemyModel(kind);
    const route = options.route ?? this.routeCursor++ % this.map.routeCount;
    const routeRef = this.map.route(route);
    const point = routeRef.sample(0);
    model.group.position.set(point.x, ENEMY_Y[kind], point.z);
    this.scene.add(model.group);

    const flying =
      Boolean(def.flying) || (kind !== 'face' && this.hasMod('air') && Math.random() < 0.3);

    const reinforced = this.hasMod('fortified') ? 1.25 : 1;
    const cursed = this.hasMod('cursed') ? 1.45 : 1;
    const scaleHp =
      hpScale(this.wave) *
      this.diff.hpMul *
      this.enemyHpMul *
      (options.hpFactor ?? 1) *
      reinforced *
      cursed;
    const hp = def.hp * scaleHp;
    const hasShield = this.hasMod('shield') && Math.random() < 0.4;
    const maxShield = def.shield
      ? def.shield * hpScale(this.wave) * this.diff.hpMul
      : hasShield
        ? hp * 0.5
        : 0;

    const hasArmor = this.hasMod('armor');
    const rewardMul =
      (options.rewardFactor ?? 1) *
      (this.hasMod('bounty') ? 1.6 : 1) *
      (this.hasMod('cursed') ? 2 : 1) *
      (this.hasMod('fortified') ? 1.4 : 1);

    const splits =
      def.splits ?? (this.hasMod('splinter') && Math.random() < 0.2 && kind !== 'face' ? 2 : 0);

    const routeLength = flying
      ? Math.hypot(this.map.core.x - routeRef.spawnPoint.x, this.map.core.z - routeRef.spawnPoint.z)
      : routeRef.length;

    const enemy: Enemy = {
      id: this.nextId++,
      kind,
      hp,
      maxHp: hp,
      shield: maxShield,
      maxShield,
      shieldTimer: 0,
      speed: def.speed * (this.hasMod('haste') ? 1.18 : 1) * (options.enraged ? 1.15 : 1),
      baseSpeed: def.speed * (this.hasMod('haste') ? 1.18 : 1) * (options.enraged ? 1.15 : 1),
      distance: options.distance ?? 0,
      route,
      routeLength,
      flying,
      reward: def.reward * rewardMul * this.bountyMul,
      coreDamage: def.coreDamage,
      armor: Math.min(0.75, def.armor + (hasArmor ? 0.12 : 0) + (this.hasMod('fortified') ? 0.25 : 0)),
      dead: false,
      flash: 0,
      phase: Math.random() * Math.PI * 2,
      slow: 0,
      cloakTimer: 0,
      cloaked: false,
      canCloak:
        Boolean(def.cloak) ||
        (this.hasMod('fog') && Math.random() < 0.3) ||
        this.hasMod('mirage'),
      enraged: Boolean(options.enraged),
      berserk: this.hasMod('berserk'),
      regen: this.hasMod('regen') ? 0.015 : 0,
      hitTimer: 0,
      splits,
      group: model.group,
      bar: model.bar,
      barFill: model.barFill,
    };

    if (options.distance) {
      const at = this.positionFor(enemy, enemy.distance);
      enemy.group.position.set(at.x, ENEMY_Y[kind], at.z);
    }

    this.enemies.push(enemy);
    this.effects.ring(new THREE.Vector3(point.x, 0.3, point.z), COLORS_RED, 1.8, 0.5);

    if (kind === 'gate') this.hooks.log('GATE DETECTED', 'warn');
    if (kind === 'face') this.hooks.log('THE FACE: POSSESSION', 'alert');
    if (kind === 'flyer') {
      this.hooks.log(tf(L('AIR CONTACT: маршрут срезан', 'AIR CONTACT: route cut'), {}), 'warn');
    }
    if (kind === 'phantom') {
      this.hooks.log(
        tf(L('PHANTOM: нестабильная видимость', 'PHANTOM: unstable visibility'), {}),
        'warn',
      );
    }
  }

  private updateTowers(dt: number): void {
    const jam = this.hasMod('jam') ? 1.25 : 1;

    for (const tower of this.towers) {
      const stats = this.statsFor(tower);
      const origin = tower.group.position;

      if (tower.aura) {
        tower.aura.visible =
          this.selected === tower ||
          (this.hover !== null && this.hover.x === tower.cell.x && this.hover.z === tower.cell.z);
      }

      if (tower.kind === 'snare') {
        if (tower.head) tower.head.rotation.y += dt * 0.9;
        if (tower.aura) tower.aura.rotation.y -= dt * 0.35;

        for (const enemy of this.enemies) {
          if (enemy.dead) continue;
          if (distance(origin, enemy.group.position) > stats.range) continue;
          enemy.slow = Math.max(enemy.slow, stats.slow);
          this.damage(enemy, stats.dps * dt);
        }
        continue;
      }

      tower.cooldown -= dt;
      const target = this.findTarget(tower, stats.range);

      if (target && tower.head) {
        const desired = Math.atan2(
          target.group.position.x - origin.x,
          target.group.position.z - origin.z,
        );
        tower.head.rotation.y = rotateTowards(tower.head.rotation.y, desired, dt * 9);
      }

      if (!target || tower.cooldown > 0) continue;

      tower.cooldown = stats.cooldown * jam;
      this.fire(tower, target);
    }
  }

  private findTarget(tower: Tower, range: number): Enemy | null {
    const candidates: Enemy[] = [];

    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.cloaked) continue;
      if (distance(tower.group.position, enemy.group.position) > range) continue;
      candidates.push(enemy);
    }

    if (candidates.length === 0) return null;

    switch (tower.priority) {
      case 'last':
        return candidates.reduce((best, enemy) => (enemy.distance < best.distance ? enemy : best));
      case 'strong':
        return candidates.reduce((best, enemy) =>
          enemy.hp + enemy.shield > best.hp + best.shield ? enemy : best,
        );
      case 'weak':
        return candidates.reduce((best, enemy) =>
          enemy.hp + enemy.shield < best.hp + best.shield ? enemy : best,
        );
      default:
        return candidates.reduce((best, enemy) => (enemy.distance > best.distance ? enemy : best));
    }
  }

  private fire(tower: Tower, target: Enemy): void {
    const def = TOWER_DEFS[tower.kind];
    const stats = this.statsFor(tower);
    const origin = tower.group.position;
    const targetPos = target.group.position.clone().setY(target.group.position.y * 0.6 + 0.35);

    if (tower.kind === 'sentry') {
      const originPos = new THREE.Vector3(origin.x, 1.2, origin.z).addScaledVector(
        new THREE.Vector3(
          Math.sin(tower.head?.rotation.y ?? 0),
          0,
          Math.cos(tower.head?.rotation.y ?? 0),
        ),
        1.05,
      );
      this.effects.tracer(originPos, targetPos, def.color, 0.05, 0.14);
      this.damage(target, stats.damage, stats.armorPierce);
      this.hooks.sfx('shot');
      return;
    }

    if (tower.kind === 'pulse') {
      this.effects.ring(
        new THREE.Vector3(targetPos.x, 0.25, targetPos.z),
        def.color,
        stats.splash || 3,
        0.55,
      );
      this.effects.burst(targetPos, def.color, 10, 3.2, 0.45);
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        if (distance(enemy.group.position, targetPos) <= (stats.splash || 3)) {
          this.damage(enemy, stats.damage, stats.armorPierce);
        }
      }
      this.hooks.sfx('pulse');
      return;
    }

    if (tower.kind === 'rail') {
      const direction = new THREE.Vector3().subVectors(targetPos, origin).normalize();
      const end = targetPos.clone().addScaledVector(direction, 1.6);
      const start = new THREE.Vector3(origin.x, 1.35, origin.z);

      this.effects.tracer(start, end, def.color, 0.075, 0.26);
      this.effects.tracer(start, end, 0xffffff, 0.032, 0.16);
      this.effects.ring(new THREE.Vector3(targetPos.x, 0.3, targetPos.z), def.color, 2.4, 0.5);
      this.effects.addShake(0.18);

      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        if (distanceToSegment(enemy.group.position, start, end) <= 1.0 * stats.chainMul) {
          this.damage(enemy, stats.damage, stats.armorPierce);
        }
      }
      this.hooks.sfx('rail');
    }
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;

      if (enemy.berserk) {
        enemy.speed = enemy.baseSpeed * (enemy.hp < enemy.maxHp * 0.5 ? 1.25 : 1);
      }

      enemy.distance += enemy.speed * (1 - enemy.slow) * dt;
      enemy.phase += dt * (enemy.kind === 'glitch' ? 9 : 3);

      if (enemy.distance >= enemy.routeLength) {
        this.leak(enemy);
        continue;
      }

      const point = this.positionFor(enemy, enemy.distance);
      enemy.group.position.set(point.x, ENEMY_Y[enemy.kind], point.z);

      const dx = enemy.flying ? this.map.core.x - point.x : point.dx;
      const dz = enemy.flying ? this.map.core.z - point.z : point.dz;
      enemy.group.rotation.y = Math.atan2(dx, dz);

      const bob =
        Math.sin(enemy.phase) * (enemy.kind === 'face' ? 0.05 : enemy.flying ? 0.22 : 0.12);
      enemy.group.position.y += bob;

      const parts = enemy.group.children;
      const spinner = parts[0];
      if (spinner) {
        spinner.rotation.y += dt * (enemy.kind === 'gate' ? 0.8 : 2.4);
        spinner.rotation.x += dt * 1.1;
      }

      if (enemy.kind === 'glitch') {
        enemy.group.position.x += (Math.random() - 0.5) * 0.07;
        enemy.group.position.z += (Math.random() - 0.5) * 0.07;
      }

      if (enemy.kind === 'face') {
        const crown = enemy.group.getObjectByName('crown');
        if (crown) crown.rotation.z += dt * 1.6;
      }

      if (enemy.canCloak) {
        enemy.cloakTimer += dt;
        const cloaked = enemy.cloakTimer % 4.4 > 2.2;
        if (cloaked !== enemy.cloaked) {
          enemy.cloaked = cloaked;
          setGroupOpacity(enemy.group, cloaked ? 0.12 : 1);
        }
      }

      if (enemy.shield > 0) {
        enemy.shieldTimer += dt;
        if (enemy.shieldTimer > 3 && enemy.shield < enemy.maxShield) {
          enemy.shield = Math.min(enemy.maxShield, enemy.shield + enemy.maxShield * 0.12 * dt);
        }
      }

      if (enemy.regen > 0 && enemy.hp < enemy.maxHp) {
        enemy.hitTimer += dt;
        if (enemy.hitTimer > 2) {
          enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * enemy.regen * dt);
        }
      }

      const shieldShell = enemy.group.getObjectByName('shield-shell');
      if (shieldShell && enemy.maxShield > 0) {
        shieldShell.visible = enemy.shield > 0.5;
        const ratio = enemy.maxShield > 0 ? enemy.shield / enemy.maxShield : 0;
        shieldShell.scale.setScalar(1 + (1 - ratio) * 0.25);
      }

      enemy.flash = Math.max(0, enemy.flash - dt * 6);
      const flashScale = 1 + enemy.flash * 0.16;
      enemy.group.scale.setScalar(flashScale);

      const ratio = Math.max(0, enemy.hp / enemy.maxHp);
      enemy.barFill.scale.x = Math.max(0.001, barWidth(enemy.kind) * ratio);
    }
  }

  private positionFor(
    enemy: Enemy,
    distance: number,
  ): { x: number; z: number; dx: number; dz: number } {
    if (!enemy.flying) return this.map.sample(enemy.route, distance);

    const t = Math.min(1, Math.max(0, distance / enemy.routeLength));
    const spawn = this.map.route(enemy.route).spawnPoint;
    const dx = this.map.core.x - spawn.x;
    const dz = this.map.core.z - spawn.z;
    return {
      x: spawn.x + dx * t,
      z: spawn.z + dz * t,
      dx,
      dz,
    };
  }

  private damage(enemy: Enemy, amount: number, armorPierce = 0): void {
    if (enemy.dead) return;

    let multiplier = 1;
    if (this.critChance > 0 && Math.random() < this.critChance) multiplier *= 2;
    if (this.executioner && enemy.hp < enemy.maxHp * 0.35) multiplier *= 1.25;
    if (this.lastStand && this.integrity < this.integrityCap * 0.4) multiplier *= 1.3;
    if (this.armoredBonus && enemy.armor >= 0.2) multiplier *= 1.2;

    let remaining = amount * multiplier * (1 - enemy.armor * (1 - armorPierce));

    if (enemy.shield > 0) {
      const absorbed = Math.min(enemy.shield, remaining);
      enemy.shield -= absorbed;
      remaining -= absorbed;
      enemy.shieldTimer = 0;
      enemy.hitTimer = 0;
      if (enemy.shield <= 0) this.breakShield(enemy);
    }

    if (remaining > 0) enemy.hp -= remaining;
    enemy.hitTimer = 0;
    enemy.flash = 1;
    if (enemy.hp <= 0) this.kill(enemy);
  }

  private breakShield(enemy: Enemy): void {
    this.stats.shieldBreaks++;

    if (enemy.kind !== 'face') return;

    this.hooks.log(
      tf(L('THE FACE: ЩИТ РАЗБИТ, ЯРОСТЬ', 'THE FACE: SHIELD BROKEN, ENRAGED'), {}),
      'alert',
    );
    this.effects.ring(enemy.group.position.clone(), COLORS_AMBER, 4, 0.7);
    this.effects.addShake(0.25);

    if (!enemy.enraged) {
      enemy.enraged = true;
      enemy.speed *= 1.4;
      enemy.baseSpeed = enemy.speed;
      for (let i = 0; i < 3; i++) {
        this.spawnEnemy('glitch', {
          distance: Math.max(0, enemy.distance - 1.2 - i * 0.8),
          route: enemy.route,
        });
      }
    }
  }

  private kill(enemy: Enemy): void {
    if (enemy.dead) return;
    enemy.dead = true;

    const position = enemy.group.position.clone();
    this.effects.shards(position, ENEMY_COLOR[enemy.kind], enemy.kind === 'face' ? 22 : 9);
    this.effects.burst(
      position,
      ENEMY_COLOR[enemy.kind],
      enemy.kind === 'face' ? 30 : 12,
      5,
      0.6,
    );

    if (enemy.kind === 'face') {
      this.effects.ring(position, COLORS_AMBER, 6, 1.1);
      this.effects.addShake(0.4);
      this.stats.bossKills++;
      this.hooks.log('THE FACE PURGED', 'ok');
    } else if (enemy.kind === 'gate') {
      this.hooks.log('GATE PURGED', 'ok');
    }

    if (enemy.splits > 0) {
      for (let i = 0; i < enemy.splits; i++) {
        this.spawnEnemy('fragment', {
          distance: enemy.distance - 0.6 - i * 0.5,
          hpFactor: 0.32,
          rewardFactor: 0.4,
          route: enemy.route,
        });
      }
      if (enemy.kind === 'splitter') {
        this.hooks.log(
          tf(L('MITOSIS: распад на осколки', 'MITOSIS: split into shards'), {}),
          'warn',
        );
      }
    }

    this.earn(enemy.reward + this.scavenge);
    this.kills++;
    this.stats.kills++;
    this.killsByKind[enemy.kind] = (this.killsByKind[enemy.kind] ?? 0) + 1;
    this.waveKilled++;
    this.hooks.sfx('kill');
    this.hooks.changed();
  }

  private leak(enemy: Enemy): void {
    enemy.dead = true;
    this.integrity = Math.max(0, this.integrity - enemy.coreDamage);
    this.waveLeaked++;
    this.leaks++;
    this.stats.leaks++;

    const corePos = new THREE.Vector3(this.map.core.x, 1.4, this.map.core.z);
    this.effects.ring(corePos, COLORS_RED, 5, 0.7);
    this.effects.burst(corePos, COLORS_RED, 18, 4, 0.7);
    this.effects.addShake(0.35);
    this.hooks.coreHit(enemy.coreDamage);
    this.hooks.sfx('leak');
    this.hooks.changed();

    if (enemy.kind === 'gate' || enemy.kind === 'face' || enemy.kind === 'shield') {
      this.hooks.log(`VESSEL −${enemy.coreDamage}%`, 'alert');
    }

    if (this.integrity <= 0) {
      this.phase = 'lost';
      this.hooks.phase(this.phase);
      this.hooks.sfx('lose');
    }
  }

  private cleanup(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.dead) continue;
      this.scene.remove(enemy.group);
      disposeGroup(enemy.group);
      this.enemies.splice(i, 1);
    }
  }

  private completeWave(): void {
    const bonus = Math.round((35 + this.wave * 7) * this.bountyMul * this.interestMul);
    this.earn(bonus);
    this.stats.wavesCleared++;
    if (this.waveLeaked === 0) this.stats.perfectWaves++;

    this.hooks.log(`WAVE ${pad(this.wave)} CLEARED: +${bonus} DATA`, 'ok');

    if (this.mode !== 'endless' && this.wave >= TOTAL_WAVES) {
      this.phase = 'won';
      this.hooks.log('CONTAINMENT COMPLETE', 'ok');
      this.hooks.phase(this.phase);
      this.hooks.sfx('win');
      this.hooks.changed();
      return;
    }

    this.wave++;
    this.stats.maxWave = Math.max(this.stats.maxWave, this.wave);
    this.phase = 'prep';
    this.prepClock = 0;
    this.waveTotal = 0;
    this.waveMods = this.mode === 'rogue' ? this.rollWaveMod() : [];

    if (this.mode === 'rogue') {
      this.pendingRewards = this.rollRewards();
      this.hooks.rewards?.(this.pendingRewards);
    }

    this.hooks.phase(this.phase);
    this.hooks.changed();
  }

  private rollWaveMod(): WaveModDef[] {
    if (Math.random() > 0.6) return [];
    const pool = ROGUE_WAVE_MODS.filter((mod) => !(this.wave < 4 && mod.id === 'elite'));
    const mod = pickWeighted(pool);
    if (!mod) return [];
    this.hooks.log(
      tf(L('МОДИФИКАТОР ВОЛНЫ: {name} — {desc}', 'WAVE MODIFIER: {name} — {desc}'), {
        name: tr(mod.name),
        desc: tr(mod.desc),
      }),
      'warn',
    );
    return [mod];
  }

  private rollRewards(): RewardDef[] {
    const pool = REWARDS.filter((reward) => !this.takenRewards.has(reward.id));
    const desired = this.extraChoice ? 4 : 3;
    const picked: RewardDef[] = [];

    while (picked.length < desired && pool.length > 0) {
      const reward = pickWeighted(pool);
      if (!reward) break;
      picked.push(reward);
      pool.splice(pool.indexOf(reward), 1);
    }

    return picked;
  }
}

const TOWER_SCALE = 1.22;
const COLORS_RED = 0xff2b4d;
const COLORS_AMBER = 0xffcf8a;

function pickWeighted<T extends { weight: number }>(pool: T[]): T | null {
  const total = pool.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return pool[0] ?? null;
  let roll = Math.random() * total;
  for (const item of pool) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return pool[pool.length - 1] ?? null;
}

function barWidth(kind: EnemyKind): number {
  if (kind === 'face') return 2.2;
  if (kind === 'gate' || kind === 'splitter') return 1.25;
  return 0.85;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function distance(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function distanceToSegment(
  point: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const apx = point.x - a.x;
  const apz = point.z - a.z;
  const lengthSq = abx * abx + abz * abz;
  if (lengthSq < 0.0001) return Math.hypot(apx, apz);
  const t = Math.max(0, Math.min(1, (apx * abx + apz * abz) / lengthSq));
  return Math.hypot(apx - abx * t, apz - abz * t);
}

function rotateTowards(current: number, target: number, maxStep: number): number {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

function setGroupOpacity(group: THREE.Object3D, opacity: number): void {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      material.transparent = true;
      material.opacity = opacity;
      material.depthWrite = opacity > 0.5;
    }
  });
}
