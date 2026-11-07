import * as THREE from 'three';
import type { Effects } from '../render/effects';
import {
  createEnemyModel,
  createTowerModel,
  applyTowerLevel,
  disposeGroup,
} from '../render/models';
import {
  ENEMY_DEFS,
  START_INTEGRITY,
  START_MONEY,
  TOWER_DEFS,
  TOTAL_WAVES,
  WAVES,
  damageAt,
  hpScale,
  rangeAt,
  upgradeCost,
} from './constants';
import { GameMap } from './map';
import type { Cell, Enemy, EnemyKind, LogKind, Phase, SfxName, Tower, TowerKind } from './types';

export interface GameHooks {
  log(text: string, kind?: LogKind): void;
  phase(phase: Phase): void;
  coreHit(amount: number): void;
  changed(): void;
  sfx(name: SfxName): void;
}

interface Spawn {
  at: number;
  kind: EnemyKind;
}

const ENEMY_Y: Record<EnemyKind, number> = {
  fragment: 0.62,
  glitch: 0.55,
  gate: 0.62,
  face: 1.25,
};

const ENEMY_COLOR: Record<EnemyKind, number> = {
  fragment: 0xff2b4d,
  glitch: 0xff6b7f,
  gate: 0xff2b4d,
  face: 0xffcf8a,
};

export class Game {
  readonly map: GameMap;
  money = START_MONEY;
  integrity = START_INTEGRITY;
  wave = 1;
  phase: Phase = 'prep';
  kills = 0;
  leaks = 0;
  time = 0;
  selected: Tower | null = null;
  selectedKind: TowerKind | null = null;
  hover: Cell | null = null;

  readonly towers: Tower[] = [];
  readonly enemies: Enemy[] = [];

  private spawns: Spawn[] = [];
  private waveClock = 0;
  private waveTotal = 0;
  private waveKilled = 0;
  private waveLeaked = 0;
  private nextId = 1;
  private disposed = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly effects: Effects,
    private readonly hooks: GameHooks,
    map: GameMap,
  ) {
    this.map = map;
  }

  get waveRemaining(): number {
    return Math.max(0, this.waveTotal - this.waveKilled - this.waveLeaked);
  }

  get waveProgress(): number {
    if (this.waveTotal === 0) return 0;
    return (this.waveKilled + this.waveLeaked) / this.waveTotal;
  }

  get totalWaves(): number {
    return TOTAL_WAVES;
  }

  startWave(): void {
    if (this.phase !== 'prep') return;

    const groups = WAVES[Math.min(this.wave - 1, WAVES.length - 1)];
    this.spawns = [];
    this.waveTotal = 0;

    for (const group of groups) {
      for (let i = 0; i < group.count; i++) {
        this.spawns.push({ at: group.delay + i * group.gap, kind: group.kind });
        this.waveTotal++;
      }
    }

    this.spawns.sort((a, b) => a.at - b.at);
    this.waveClock = 0;
    this.waveKilled = 0;
    this.waveLeaked = 0;
    this.phase = 'wave';
    this.hooks.phase(this.phase);
    this.hooks.changed();

    const boss = groups.some((group) => group.kind === 'face');
    if (boss) {
      this.hooks.log(`WAVE ${pad(this.wave)} // THE FACE DETECTED`, 'alert');
      this.hooks.sfx('wave');
    } else {
      this.hooks.log(`WAVE ${pad(this.wave)} // CONTACT`, 'warn');
      this.hooks.sfx('wave');
    }
  }

  setKind(kind: TowerKind | null): void {
    this.selectedKind = kind;
    if (kind) this.selected = null;
    this.hooks.changed();
  }

  setHover(cell: Cell | null): void {
    this.hover = cell;
  }

  canPlace(kind: TowerKind, cell: Cell): boolean {
    if (!this.map.isBuildable(cell.x, cell.z)) return false;
    if (this.towerAt(cell)) return false;
    return this.money >= TOWER_DEFS[kind].cost;
  }

  towerAt(cell: Cell): Tower | undefined {
    return this.towers.find((tower) => tower.cell.x === cell.x && tower.cell.z === cell.z);
  }

  place(kind: TowerKind, cell: Cell): boolean {
    if (!this.map.isBuildable(cell.x, cell.z)) return false;
    if (this.towerAt(cell)) return false;

    const def = TOWER_DEFS[kind];
    if (this.money < def.cost) {
      this.hooks.log('НЕДОСТАТОЧНО DATA', 'alert');
      this.hooks.sfx('error');
      return false;
    }

    this.money -= def.cost;
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
      level: 1,
      cooldown: 0,
      tick: 0,
      spent: def.cost,
      damage: def.damage,
      range: def.range,
      group: model.group,
      head: model.head,
      aura: model.aura,
    };

    this.towers.push(tower);
    this.hooks.log(`${def.name} ONLINE // -${def.cost} DATA`, 'ok');
    this.hooks.sfx('build');
    this.selected = tower;
    this.selectedKind = null;
    this.hooks.changed();
    return true;
  }

  selectTower(cell: Cell): Tower | null {
    const tower = this.towerAt(cell) ?? null;
    this.selected = tower;
    if (tower) this.selectedKind = null;
    this.hooks.changed();
    return tower;
  }

  clearSelection(): void {
    this.selected = null;
    this.selectedKind = null;
    this.hooks.changed();
  }

  upgradeSelected(): boolean {
    const tower = this.selected;
    if (!tower || tower.level >= 3) return false;

    const def = TOWER_DEFS[tower.kind];
    const cost = upgradeCost(def.cost, tower.level);
    if (this.money < cost) {
      this.hooks.log('НЕДОСТАТОЧНО DATA', 'alert');
      this.hooks.sfx('error');
      return false;
    }

    this.money -= cost;
    tower.level += 1;
    tower.spent += cost;
    tower.damage = damageAt(def.damage, tower.level);
    tower.range = rangeAt(def.range, tower.level);
    if (tower.aura) tower.aura.scale.setScalar(tower.range / TOWER_SCALE);
    applyTowerLevel({ group: tower.group, head: tower.head, aura: tower.aura }, tower.level, def.color);

    this.hooks.log(`${def.name} → LVL ${tower.level} // -${cost} DATA`, 'ok');
    this.hooks.sfx('upgrade');
    this.hooks.changed();
    return true;
  }

  sellSelected(): boolean {
    const tower = this.selected;
    if (!tower) return false;

    const refund = Math.floor(tower.spent * 0.65);
    this.money += refund;
    this.scene.remove(tower.group);
    disposeGroup(tower.group);
    this.towers.splice(this.towers.indexOf(tower), 1);
    this.selected = null;

    this.hooks.log(`${TOWER_DEFS[tower.kind].name} OFFLINE // +${refund} DATA`, 'warn');
    this.hooks.sfx('sell');
    this.hooks.changed();
    return true;
  }

  update(rawDt: number): void {
    if (this.disposed) return;
    if (this.phase === 'won' || this.phase === 'lost') return;

    const dt = Math.min(rawDt, 0.05);
    this.time += dt;

    for (const enemy of this.enemies) enemy.slow = 0;

    if (this.phase === 'wave') this.updateSpawns(dt);
    this.updateTowers(dt);
    this.updateEnemies(dt);
    this.cleanup();

    if (this.phase === 'wave' && this.spawns.length === 0 && this.enemies.length === 0 && this.waveTotal > 0) {
      this.completeWave();
    }
  }

  private updateSpawns(dt: number): void {
    this.waveClock += dt;
    while (this.spawns.length > 0 && this.spawns[0].at <= this.waveClock) {
      const spawn = this.spawns.shift();
      if (spawn) this.spawnEnemy(spawn.kind);
    }
  }

  private spawnEnemy(kind: EnemyKind): void {
    const def = ENEMY_DEFS[kind];
    const model = createEnemyModel(kind);
    const point = this.map.sample(0);
    model.group.position.set(point.x, ENEMY_Y[kind], point.z);
    this.scene.add(model.group);

    const enemy: Enemy = {
      id: this.nextId++,
      kind,
      hp: def.hp * hpScale(this.wave),
      maxHp: def.hp * hpScale(this.wave),
      speed: def.speed,
      distance: 0,
      reward: def.reward,
      coreDamage: def.coreDamage,
      armor: def.armor,
      dead: false,
      flash: 0,
      phase: Math.random() * Math.PI * 2,
      slow: 0,
      group: model.group,
      bar: model.bar,
      barFill: model.barFill,
    };

    this.enemies.push(enemy);
    this.effects.ring(new THREE.Vector3(point.x, 0.3, point.z), COLORS_RED, 1.8, 0.5);

    if (kind === 'gate') this.hooks.log('GATE DETECTED', 'warn');
    if (kind === 'face') this.hooks.log('THE FACE // POSSESSION', 'alert');
  }

  private updateTowers(dt: number): void {
    for (const tower of this.towers) {
      const def = TOWER_DEFS[tower.kind];
      const origin = tower.group.position;

      if (tower.aura) {
        tower.aura.visible = this.selected === tower || (this.hover !== null && this.hover.x === tower.cell.x && this.hover.z === tower.cell.z);
      }

      if (tower.kind === 'snare') {
        if (tower.head) tower.head.rotation.y += dt * 0.9;
        if (tower.aura) tower.aura.rotation.y -= dt * 0.35;

        for (const enemy of this.enemies) {
          if (enemy.dead) continue;
          if (distance(origin, enemy.group.position) > tower.range) continue;
          enemy.slow = Math.max(enemy.slow, def.slow ?? 0);
          this.damage(enemy, (def.dps ?? 0) * dt);
        }
        continue;
      }

      tower.cooldown -= dt;
      const target = this.findTarget(tower);

      if (target && tower.head) {
        const desired = Math.atan2(target.group.position.x - origin.x, target.group.position.z - origin.z);
        tower.head.rotation.y = rotateTowards(tower.head.rotation.y, desired, dt * 9);
      }

      if (!target || tower.cooldown > 0) continue;

      tower.cooldown = def.cooldown;
      this.fire(tower, target);
    }
  }

  private findTarget(tower: Tower): Enemy | null {
    let best: Enemy | null = null;
    let bestDistance = -1;

    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      if (distance(tower.group.position, enemy.group.position) > tower.range) continue;
      if (enemy.distance > bestDistance) {
        best = enemy;
        bestDistance = enemy.distance;
      }
    }

    return best;
  }

  private fire(tower: Tower, target: Enemy): void {
    const def = TOWER_DEFS[tower.kind];
    const origin = tower.group.position;
    const targetPos = target.group.position.clone().setY(target.group.position.y * 0.6 + 0.35);

    if (tower.kind === 'sentry') {
      const originPos = new THREE.Vector3(origin.x, 1.2, origin.z).addScaledVector(
        new THREE.Vector3(Math.sin(tower.head?.rotation.y ?? 0), 0, Math.cos(tower.head?.rotation.y ?? 0)),
        1.05,
      );
      this.effects.tracer(originPos, targetPos, def.color, 0.05, 0.14);
      this.damage(target, tower.damage);
      this.hooks.sfx('shot');
      return;
    }

    if (tower.kind === 'pulse') {
      this.effects.ring(new THREE.Vector3(targetPos.x, 0.25, targetPos.z), def.color, def.splash ?? 3, 0.55);
      this.effects.burst(targetPos, def.color, 10, 3.2, 0.45);
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        if (distance(enemy.group.position, targetPos) <= (def.splash ?? 3)) {
          this.damage(enemy, tower.damage);
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
        if (distanceToSegment(enemy.group.position, start, end) <= 1.0) {
          this.damage(enemy, tower.damage);
        }
      }
      this.hooks.sfx('rail');
    }
  }

  private damage(enemy: Enemy, amount: number): void {
    if (enemy.dead) return;
    enemy.hp -= amount * (1 - enemy.armor);
    enemy.flash = 1;
    if (enemy.hp <= 0) this.kill(enemy);
  }

  private kill(enemy: Enemy): void {
    if (enemy.dead) return;
    enemy.dead = true;

    const position = enemy.group.position.clone();
    this.effects.shards(position, ENEMY_COLOR[enemy.kind], enemy.kind === 'face' ? 22 : 9);
    this.effects.burst(position, ENEMY_COLOR[enemy.kind], enemy.kind === 'face' ? 30 : 12, 5, 0.6);
    if (enemy.kind === 'face') {
      this.effects.ring(position, COLORS_AMBER, 6, 1.1);
      this.effects.addShake(0.4);
      this.hooks.log('THE FACE // PURGED', 'ok');
    } else if (enemy.kind === 'gate') {
      this.hooks.log('GATE PURGED', 'ok');
    }

    this.money += enemy.reward;
    this.kills++;
    this.waveKilled++;
    this.hooks.sfx('kill');
    this.hooks.changed();
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;

      enemy.distance += enemy.speed * (1 - enemy.slow) * dt;
      enemy.phase += dt * (enemy.kind === 'glitch' ? 9 : 3);

      if (enemy.distance >= this.map.totalLength) {
        this.leak(enemy);
        continue;
      }

      const point = this.map.sample(enemy.distance);
      enemy.group.position.set(point.x, ENEMY_Y[enemy.kind], point.z);
      enemy.group.rotation.y = Math.atan2(point.dx, point.dz);

      const bob = Math.sin(enemy.phase) * (enemy.kind === 'face' ? 0.05 : 0.12);
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

      enemy.flash = Math.max(0, enemy.flash - dt * 6);
      const flashScale = 1 + enemy.flash * 0.16;
      enemy.group.scale.setScalar(flashScale);

      const ratio = Math.max(0, enemy.hp / enemy.maxHp);
      enemy.barFill.scale.x = Math.max(0.001, (enemy.kind === 'face' ? 2.2 : enemy.kind === 'gate' ? 1.25 : 0.85) * ratio);
    }
  }

  private leak(enemy: Enemy): void {
    enemy.dead = true;
    this.integrity = Math.max(0, this.integrity - enemy.coreDamage);
    this.waveLeaked++;
    this.leaks++;

    const corePos = new THREE.Vector3(this.map.core.x, 1.4, this.map.core.z);
    this.effects.ring(corePos, COLORS_RED, 5, 0.7);
    this.effects.burst(corePos, COLORS_RED, 18, 4, 0.7);
    this.effects.addShake(0.35);
    this.hooks.coreHit(enemy.coreDamage);
    this.hooks.sfx('leak');
    this.hooks.changed();

    if (enemy.kind === 'gate' || enemy.kind === 'face') {
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
    const bonus = 35 + this.wave * 7;
    this.money += bonus;

    if (this.wave >= TOTAL_WAVES) {
      this.phase = 'won';
      this.hooks.log('CONTAINMENT COMPLETE', 'ok');
      this.hooks.phase(this.phase);
      this.hooks.sfx('win');
      this.hooks.changed();
      return;
    }

    this.hooks.log(`WAVE ${pad(this.wave)} CLEARED // +${bonus} DATA`, 'ok');
    this.wave++;
    this.phase = 'prep';
    this.waveTotal = 0;
    this.hooks.phase(this.phase);
    this.hooks.changed();
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
}

const TOWER_SCALE = 1.22;
const COLORS_RED = 0xff2b4d;
const COLORS_AMBER = 0xffcf8a;

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function distance(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function distanceToSegment(point: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
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
