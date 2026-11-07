import { writeFileSync } from 'node:fs';
import {
  BRANCHES,
  DIFFICULTIES,
  ENEMY_DEFS,
  MAPS,
  TOWER_DEFS,
  TOTAL_WAVES,
  damageAt,
  rangeAt,
  upgradeCost,
  waveFor,
} from '../src/game/constants';
import { GameMap } from '../src/game/map';
import type {
  BranchId,
  DifficultyId,
  EnemyKind,
  TowerKind,
} from '../src/game/types';

type Strategy = 'sentry' | 'pulse' | 'snare' | 'rail' | 'mixed';

const STRATEGIES: Strategy[] = ['sentry', 'pulse', 'snare', 'rail', 'mixed'];
const RUNS = 30;
const TICK = 0.2;

interface SimTower {
  kind: TowerKind;
  x: number;
  z: number;
  level: number;
  branch: BranchId | null;
  cooldown: number;
}

interface SimEnemy {
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  armor: number;
  speed: number;
  route: number;
  distance: number;
  routeLength: number;
  flying: boolean;
  slow: number;
  reward: number;
  coreDamage: number;
  splits: number;
  enraged: boolean;
}

interface Result {
  won: boolean;
  wave: number;
  integrity: number;
  kills: number;
  towers: number;
  money: number;
  time: number;
}

const BRANCH_FOR: Record<TowerKind, BranchId> = {
  sentry: 'sentry-pierce',
  pulse: 'pulse-overload',
  snare: 'snare-cryo',
  rail: 'rail-chain',
};

function rng(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function towerStats(tower: SimTower): {
  damage: number;
  range: number;
  cooldown: number;
  splash: number;
  slow: number;
  dps: number;
  pierce: number;
  chain: number;
} {
  const def = TOWER_DEFS[tower.kind];
  const branch = tower.branch ? BRANCHES[tower.branch] : null;
  return {
    damage: damageAt(def.damage, tower.level) * (branch?.damageMul ?? 1),
    range: rangeAt(def.range, tower.level) * (branch?.rangeMul ?? 1),
    cooldown: def.cooldown * (branch?.cooldownMul ?? 1),
    splash: (def.splash ?? 0) * (branch?.splashMul ?? 1),
    slow: Math.min(0.85, (def.slow ?? 0) + (branch?.slowAdd ?? 0)),
    dps: (def.dps ?? 0) * (branch?.dpsMul ?? 1),
    pierce: branch?.armorPierce ?? 0,
    chain: branch?.chainMul ?? 1,
  };
}

function buildCost(kind: TowerKind): number {
  return TOWER_DEFS[kind].cost;
}

function coverage(map: GameMap, x: number, z: number, range: number): number {
  let score = 0;
  for (const route of map.routes) {
    for (let d = 0; d < route.length; d += 1) {
      const point = route.sample(d);
      if (Math.hypot(point.x - x, point.z - z) <= range) score++;
    }

    const spawn = route.spawnPoint;
    const lineLength = Math.hypot(map.core.x - spawn.x, map.core.z - spawn.z);
    for (let d = 0; d < lineLength; d += 1.5) {
      const t = d / lineLength;
      const px = spawn.x + (map.core.x - spawn.x) * t;
      const pz = spawn.z + (map.core.z - spawn.z) * t;
      if (Math.hypot(px - x, pz - z) <= range) score += 0.6;
    }
  }
  return score;
}

function pickKind(strategy: Strategy, money: number, towerCount: number, wave: number): TowerKind | null {
  if (strategy !== 'mixed') {
    const kind = strategy as TowerKind;
    return money >= buildCost(kind) ? kind : null;
  }

  const cycle: TowerKind[] =
    wave < 3
      ? ['sentry', 'sentry', 'snare']
      : ['sentry', 'pulse', 'snare', 'rail', 'sentry'];
  for (let i = 0; i < cycle.length; i++) {
    const kind = cycle[(towerCount + i) % cycle.length];
    if (money >= buildCost(kind)) return kind;
  }
  return null;
}

function spend(
  map: GameMap,
  towers: SimTower[],
  strategy: Strategy,
  money: number,
  wave: number,
): number {
  let budget = money;

  for (let guard = 0; guard < 30; guard++) {
    const kind = pickKind(strategy, budget, towers.length, wave);
    if (!kind) break;

    let best: { x: number; z: number; score: number } | null = null;
    for (const cell of map.buildable) {
      if (towers.some((tower) => Math.abs(tower.x - map.cellCenter(cell.x, cell.z).x) < 2 && Math.abs(tower.z - map.cellCenter(cell.x, cell.z).z) < 2)) {
        continue;
      }
      const center = map.cellCenter(cell.x, cell.z);
      const score = coverage(map, center.x, center.z, TOWER_DEFS[kind].range);
      if (!best || score > best.score) best = { x: center.x, z: center.z, score };
    }

    if (!best || best.score === 0) break;
    budget -= buildCost(kind);
    towers.push({ kind, x: best.x, z: best.z, level: 1, branch: null, cooldown: 0 });
  }

  for (let guard = 0; guard < 40; guard++) {
    const candidates = towers.filter((tower) => tower.level < 3);
    if (candidates.length === 0) break;
    candidates.sort((a, b) => a.level - b.level);
    const tower = candidates[0];
    const cost = upgradeCost(TOWER_DEFS[tower.kind].cost, tower.level);
    if (budget < cost) break;
    budget -= cost;
    tower.level++;
    if (tower.level >= 3) tower.branch = BRANCH_FOR[tower.kind];
  }

  return budget;
}

function damageEnemy(
  enemy: SimEnemy,
  amount: number,
  pierce: number,
  onSplit: (enemy: SimEnemy, count: number) => void,
): boolean {
  let remaining = amount * (1 - enemy.armor * (1 - pierce));
  if (enemy.shield > 0) {
    const absorbed = Math.min(enemy.shield, remaining);
    enemy.shield -= absorbed;
    remaining -= absorbed;
  }
  if (remaining > 0) enemy.hp -= remaining;
  if (enemy.hp <= 0) {
    if (enemy.splits > 0) onSplit(enemy, enemy.splits);
    return true;
  }
  return false;
}

function runOne(map: GameMap, difficulty: DifficultyId, strategy: Strategy, seed: number): Result {
  const random = rng(seed);
  const diff = DIFFICULTIES.find((item) => item.id === difficulty) ?? DIFFICULTIES[1];
  let money = diff.money + (map.def.moneyBonus ?? 0);
  let integrity = 100 * diff.integrityMul;
  const cap = integrity;
  let kills = 0;
  let time = 0;
  const towers: SimTower[] = [];
  let wave = 1;
  let won = false;

  for (wave = 1; wave <= TOTAL_WAVES; wave++) {
    money = spend(map, towers, strategy, money, wave);

    const groups = waveFor(wave);
    const mapScale = map.def.waveScale ?? 1;
    const events: Array<{ at: number; kind: EnemyKind }> = [];
    for (const group of groups) {
      const count = Math.max(1, Math.round(group.count * mapScale));
      for (let i = 0; i < count; i++) {
        events.push({ at: group.delay + i * group.gap, kind: group.kind });
      }
    }
    events.sort((a, b) => a.at - b.at);

    const enemies: SimEnemy[] = [];
    const spawn = (kind: EnemyKind, distance = 0): void => {
      const def = ENEMY_DEFS[kind];
      const route = Math.floor(random() * map.routeCount);
      const routeRef = map.route(route);
      const flying = Boolean(def.flying);
      const scale = 1 + (wave - 1) * 0.26;

      enemies.push({
        kind,
        hp: def.hp * scale * diff.hpMul,
        maxHp: def.hp * scale * diff.hpMul,
        shield: (def.shield ?? 0) * scale * diff.hpMul,
        maxShield: (def.shield ?? 0) * scale * diff.hpMul,
        armor: def.armor,
        speed: def.speed,
        route,
        distance,
        routeLength: flying
          ? Math.hypot(map.core.x - routeRef.spawnPoint.x, map.core.z - routeRef.spawnPoint.z)
          : routeRef.length,
        flying,
        slow: 0,
        reward: def.reward * diff.rewardMul,
        coreDamage: def.coreDamage,
        splits: def.splits ?? 0,
        enraged: false,
      });
    };

    let clock = 0;
    let leaked = 0;
    let index = 0;
    let spawned = 0;

    while (clock < 400) {
      while (index < events.length && events[index].at <= clock) {
        spawn(events[index].kind);
        index++;
        spawned++;
      }
      if (index >= events.length && enemies.length === 0) break;

      for (const enemy of enemies) enemy.slow = 0;

      for (const tower of towers) {
        const stats = towerStats(tower);
        if (tower.kind === 'snare') {
          for (const enemy of enemies) {
            if (enemy.hp <= 0) continue;
            if (enemyDistance(map, enemy, tower) > stats.range) continue;
            enemy.slow = Math.max(enemy.slow, stats.slow);
            if (damageEnemy(enemy, stats.dps * TICK, 0, () => {})) {
              kills++;
              money += enemy.reward;
            }
          }
          continue;
        }

        tower.cooldown -= TICK;
        if (tower.cooldown > 0) continue;

        let target: SimEnemy | null = null;
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          if (enemyDistance(map, enemy, tower) > stats.range) continue;
          if (!target || enemy.distance / enemy.routeLength > target.distance / target.routeLength) {
            target = enemy;
          }
        }
        if (!target) continue;

        tower.cooldown = stats.cooldown;
        const targetPoint = positionOf(map, target);
        const hit = (enemy: SimEnemy, amount: number): void => {
          if (damageEnemy(enemy, amount, stats.pierce, (source, count) => {
            for (let i = 0; i < count; i++) {
              const child = { ...source, hp: source.maxHp * 0.32, maxHp: source.maxHp * 0.32, shield: 0, splits: 0, distance: Math.max(0, source.distance - 0.6) };
              enemies.push(child);
            }
          })) {
            kills++;
            money += enemy.reward;
          }
        };

        if (tower.kind === 'pulse') {
          for (const enemy of enemies) {
            if (enemy.hp <= 0) continue;
            const point = positionOf(map, enemy);
            if (Math.hypot(point.x - targetPoint.x, point.z - targetPoint.z) <= stats.splash) {
              hit(enemy, stats.damage);
            }
          }
        } else if (tower.kind === 'rail') {
          for (const enemy of enemies) {
            if (enemy.hp <= 0) continue;
            const point = positionOf(map, enemy);
            if (Math.hypot(point.x - targetPoint.x, point.z - targetPoint.z) <= 0.9 * stats.chain) {
              hit(enemy, stats.damage);
            }
          }
        } else {
          hit(target, stats.damage);
        }
      }

      for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (enemy.hp <= 0) {
          enemies.splice(i, 1);
          continue;
        }
        enemy.distance += enemy.speed * (1 - enemy.slow) * TICK;
        if (enemy.distance >= enemy.routeLength) {
          integrity -= enemy.coreDamage;
          leaked++;
          enemies.splice(i, 1);
        }
      }

      clock += TICK;
      time += TICK;
      if (integrity <= 0) break;
    }

    if (integrity <= 0) {
      integrity = 0;
      break;
    }

    money += Math.round((35 + wave * 7) * diff.rewardMul) + 30;
    if (wave === TOTAL_WAVES) won = true;
    void leaked;
    void spawned;
  }

  return {
    won,
    wave: Math.min(wave, TOTAL_WAVES),
    integrity,
    kills,
    towers: towers.length,
    money,
    time,
  };
}

function enemyDistance(map: GameMap, enemy: SimEnemy, tower: SimTower): number {
  const point = positionOf(map, enemy);
  return Math.hypot(point.x - tower.x, point.z - tower.z);
}

function positionOf(map: GameMap, enemy: SimEnemy): { x: number; z: number } {
  if (!enemy.flying) {
    const point = map.sample(enemy.route, enemy.distance);
    return { x: point.x, z: point.z };
  }
  const spawn = map.route(enemy.route).spawnPoint;
  const t = Math.min(1, enemy.distance / enemy.routeLength);
  return {
    x: spawn.x + (map.core.x - spawn.x) * t,
    z: spawn.z + (map.core.z - spawn.z) * t,
  };
}

interface Config {
  arena: string;
  difficulty: DifficultyId;
  strategy: Strategy;
  wins: number;
  avgWave: number;
  avgIntegrity: number;
  avgTowers: number;
  avgKills: number;
}

function simulate(): Config[] {
  const configs: Config[] = [];
  let seed = 1;

  for (const mapDef of MAPS) {
    const map = new GameMap(mapDef);
    for (const difficulty of DIFFICULTIES) {
      for (const strategy of STRATEGIES) {
        let wins = 0;
        let wave = 0;
        let integrity = 0;
        let towers = 0;
        let kills = 0;

        for (let run = 0; run < RUNS; run++) {
          const result = runOne(map, difficulty.id, strategy, seed++);
          if (result.won) wins++;
          wave += result.wave;
          integrity += result.integrity;
          towers += result.towers;
          kills += result.kills;
        }

        configs.push({
          arena: mapDef.name,
          difficulty: difficulty.id,
          strategy,
          wins: Math.round((wins / RUNS) * 100),
          avgWave: wave / RUNS,
          avgIntegrity: integrity / RUNS,
          avgTowers: towers / RUNS,
          avgKills: kills / RUNS,
        });
      }
    }
  }

  return configs;
}

function difficultyName(id: DifficultyId): string {
  const diff = DIFFICULTIES.find((item) => item.id === id);
  return diff ? diff.name.en : id;
}

function strategyName(strategy: Strategy): string {
  if (strategy === 'mixed') return 'MIXED';
  return TOWER_DEFS[strategy].name;
}

function report(configs: Config[]): string {
  const lines: string[] = [];
  lines.push('# Баланс NeoTD — отчёт симулятора');
  lines.push('');
  lines.push(
    'Сгенерировано `npm run balance`. Безголовый симулятор играет кампанию на всех аренах и сложностях пятью стратегиями по ' +
      `${RUNS} прогонов на сочетание (${configs.length * RUNS} забегов).`,
  );
  lines.push('');
  lines.push('Модель: реальные волны, HP-скейл, броня, щиты, деление, полёт, замедление, сплэш, ветки третьего уровня, экономика и бонус зачистки. Размещение башен — жадное по покрытию маршрута. Игрок не идеален: симулятор не переносит башни и не подбирает приоритеты целей.');
  lines.push('');
  lines.push(
    'Колонки: **WIN** — доля побед, **WAVE** — средняя достигнутая волна, **CORE** — средняя целостность, **TOWERS** — башен к концу, **KILLS** — уничтожено.',
  );
  lines.push('');

  for (const mapDef of MAPS) {
    lines.push(`## ${mapDef.name}`);
    lines.push('');
    lines.push('| Сложность | Стратегия | WIN | WAVE | CORE | TOWERS | KILLS |');
    lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: |');
    for (const config of configs.filter((item) => item.arena === mapDef.name)) {
      lines.push(
        `| ${difficultyName(config.difficulty)} | ${strategyName(config.strategy)} | ${config.wins}% | ${config.avgWave.toFixed(1)} | ${config.avgIntegrity.toFixed(0)}% | ${config.avgTowers.toFixed(1)} | ${config.avgKills.toFixed(0)} |`,
      );
    }
    lines.push('');
  }

  const byDifficulty = DIFFICULTIES.map((diff) => {
    const rows = configs.filter((item) => item.difficulty === diff.id);
    const win = rows.reduce((sum, item) => sum + item.wins, 0) / rows.length;
    const wave = rows.reduce((sum, item) => sum + item.avgWave, 0) / rows.length;
    return { name: diff.name.en, win, wave };
  });

  lines.push('## Сводка по сложности');
  lines.push('');
  lines.push('| Сложность | Средний WIN | Средняя волна |');
  lines.push('| --- | ---: | ---: |');
  for (const row of byDifficulty) {
    lines.push(`| ${row.name} | ${row.win.toFixed(0)}% | ${row.wave.toFixed(1)} |`);
  }
  lines.push('');

  const weakest = [...configs].sort((a, b) => a.wins - b.wins).slice(0, 5);
  const strongest = [...configs].sort((a, b) => b.wins - a.wins).slice(0, 5);
  lines.push('## Что чинить в первую очередь');
  lines.push('');
  lines.push('Самые тяжёлые сочетания:');
  for (const item of weakest) {
    lines.push(`- ${item.arena} · ${difficultyName(item.difficulty)} · ${strategyName(item.strategy)} — ${item.wins}% побед, волна ${item.avgWave.toFixed(1)}.`);
  }
  lines.push('');
  lines.push('Самые простые сочетания:');
  for (const item of strongest) {
    lines.push(`- ${item.arena} · ${difficultyName(item.difficulty)} · ${strategyName(item.strategy)} — ${item.wins}% побед, волна ${item.avgWave.toFixed(1)}.`);
  }
  lines.push('');
  lines.push('## Как читать');
  lines.push('');
  lines.push('- WIN ниже 20% на «Спокойном» — арена или экономика слишком жёсткие для новичка.');
  lines.push('- WIN выше 80% на «Хардкоре» — не хватает давления, стоит поднять HP или плотность волн.');
  lines.push('- Разброс между стратегиями больше 40 п.п. означает, что один протокол доминирует.');
  lines.push('- Средняя волна ниже 10 при нулевых победах — провал в середине кампании, а не в финале.');
  lines.push('');
  lines.push(
    'Отчёт пересобирается командой `npm run balance`; цифры зависят от сида, поэтому при правках баланса сравнивай относительные изменения, а не абсолютные проценты.',
  );
  lines.push('');

  return lines.join('\n');
}

const configs = simulate();
writeFileSync('docs/BALANCE.md', report(configs));

const summary = DIFFICULTIES.map((diff) => {
  const rows = configs.filter((item) => item.difficulty === diff.id);
  const win = rows.reduce((sum, item) => sum + item.wins, 0) / rows.length;
  return `${diff.name.en}: ${win.toFixed(0)}%`;
}).join(' · ');

console.log(`balance: ${configs.length * RUNS} runs · ${summary}`);
console.log('balance: docs/BALANCE.md');
