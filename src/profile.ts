import type { DifficultyId, EnemyKind, ModeId, TowerKind } from './game/types';

export const PROFILE_KEY = 'neotd.profile.v1';

export interface RunRecord {
  wave: number;
  kills: number;
  time: number;
  integrity: number;
  won: boolean;
  arena: string;
  mode: ModeId;
  difficulty: DifficultyId;
  at: number;
}

export interface ProfileStats {
  kills: number;
  leaks: number;
  runs: number;
  wins: number;
  campaignWins: number;
  hardcoreWins: number;
  flawlessWins: number;
  bestWave: number;
  bossKills: number;
  perfectWaves: number;
  towersBuilt: number;
  maxTowers: number;
  maxedTowers: number;
  soldTowers: number;
  dataEarned: number;
  bestRunData: number;
  peakMoney: number;
  branches: number;
  rewards: number;
  shieldBreaks: number;
  bestEndless: number;
  bestRogueWave: number;
  bestRogueModules: number;
  fastestWin: number | null;
  arenasWon: string[];
  branchIds: string[];
  killsByKind: Partial<Record<EnemyKind, number>>;
  towerBuilds: Partial<Record<TowerKind, number>>;
}

export interface Profile {
  version: 1;
  stats: ProfileStats;
  records: Record<string, RunRecord>;
  achievements: Record<string, number>;
  title: string;
  accent: string;
  sound: boolean;
  tutorialDone: boolean;
}

export interface RunData {
  arena: string;
  mode: ModeId;
  difficulty: DifficultyId;
  wave: number;
  kills: number;
  leaks: number;
  time: number;
  integrity: number;
  cappedIntegrity: number;
  won: boolean;
  killsByKind: Partial<Record<EnemyKind, number>>;
  towerBuilds: Partial<Record<TowerKind, number>>;
  branchIds: string[];
  rewards: number;
  bossKills: number;
  shieldBreaks: number;
  soldTowers: number;
  peakTowers: number;
  maxedTowers: number;
  peakMoney: number;
  dataEarned: number;
  perfectWaves: number;
}

export function defaultProfile(): Profile {
  return {
    version: 1,
    stats: {
      kills: 0,
      leaks: 0,
      runs: 0,
      wins: 0,
      campaignWins: 0,
      hardcoreWins: 0,
      flawlessWins: 0,
      bestWave: 0,
      bossKills: 0,
      perfectWaves: 0,
      towersBuilt: 0,
      maxTowers: 0,
      maxedTowers: 0,
      soldTowers: 0,
      dataEarned: 0,
      bestRunData: 0,
      peakMoney: 0,
      branches: 0,
      rewards: 0,
      shieldBreaks: 0,
      bestEndless: 0,
      bestRogueWave: 0,
      bestRogueModules: 0,
      fastestWin: null,
      arenasWon: [],
      branchIds: [],
      killsByKind: {},
      towerBuilds: {},
    },
    records: {},
    achievements: {},
    title: 'operator',
    accent: 'signal',
    sound: true,
    tutorialDone: false,
  };
}

export function loadProfile(): Profile {
  const base = defaultProfile();
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PROFILE_KEY);
  } catch {
    return base;
  }
  if (!raw) return base;

  try {
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return {
      ...base,
      ...parsed,
      version: 1,
      stats: { ...base.stats, ...(parsed.stats ?? {}) },
      records: { ...(parsed.records ?? {}) },
      achievements: { ...(parsed.achievements ?? {}) },
      title: typeof parsed.title === 'string' ? parsed.title : base.title,
      accent: typeof parsed.accent === 'string' ? parsed.accent : base.accent,
      sound: parsed.sound !== false,
      tutorialDone: Boolean(parsed.tutorialDone),
    };
  } catch {
    return base;
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* storage can be unavailable — the run still works without persistence */
  }
}

export function recordKey(arena: string, difficulty: DifficultyId, mode: ModeId): string {
  return `${arena}|${difficulty}|${mode}`;
}

export function recordFor(
  profile: Profile,
  arena: string,
  difficulty: DifficultyId,
  mode: ModeId,
): RunRecord | null {
  return profile.records[recordKey(arena, difficulty, mode)] ?? null;
}

export function applyRun(profile: Profile, run: RunData): RunRecord {
  const stats = profile.stats;

  stats.runs += 1;
  stats.kills += run.kills;
  stats.leaks += run.leaks;
  stats.bossKills += run.bossKills;
  stats.perfectWaves += run.perfectWaves;
  stats.towersBuilt += sum(run.towerBuilds);
  stats.maxTowers = Math.max(stats.maxTowers, run.peakTowers);
  stats.maxedTowers += run.maxedTowers;
  stats.soldTowers += run.soldTowers;
  stats.dataEarned += run.dataEarned;
  stats.bestRunData = Math.max(stats.bestRunData, run.dataEarned);
  stats.peakMoney = Math.max(stats.peakMoney, run.peakMoney);
  stats.branches += run.branchIds.length;
  stats.rewards += run.rewards;
  stats.shieldBreaks += run.shieldBreaks;
  stats.bestWave = Math.max(stats.bestWave, run.wave);

  for (const [kind, count] of Object.entries(run.killsByKind)) {
    const key = kind as EnemyKind;
    stats.killsByKind[key] = (stats.killsByKind[key] ?? 0) + (count ?? 0);
  }

  for (const [kind, count] of Object.entries(run.towerBuilds)) {
    const key = kind as TowerKind;
    stats.towerBuilds[key] = (stats.towerBuilds[key] ?? 0) + (count ?? 0);
  }

  for (const branch of run.branchIds) {
    if (!stats.branchIds.includes(branch)) stats.branchIds.push(branch);
  }

  if (run.won) {
    stats.wins += 1;
    if (!stats.arenasWon.includes(run.arena)) stats.arenasWon.push(run.arena);
    if (run.mode === 'campaign') {
      stats.campaignWins += 1;
      if (run.difficulty === 'hardcore') stats.hardcoreWins += 1;
      if (run.integrity >= run.cappedIntegrity) stats.flawlessWins += 1;
      stats.fastestWin =
        stats.fastestWin === null ? run.time : Math.min(stats.fastestWin, run.time);
    }
  }

  if (run.mode === 'endless') stats.bestEndless = Math.max(stats.bestEndless, run.wave);
  if (run.mode === 'rogue') {
    stats.bestRogueWave = Math.max(stats.bestRogueWave, run.wave);
    stats.bestRogueModules = Math.max(stats.bestRogueModules, run.rewards);
  }

  const key = recordKey(run.arena, run.difficulty, run.mode);
  const previous = profile.records[key];
  const better =
    !previous ||
    run.wave > previous.wave ||
    (run.wave === previous.wave && run.time > previous.time) ||
    (run.wave === previous.wave && run.won && !previous.won);

  const record: RunRecord = {
    wave: run.wave,
    kills: run.kills,
    time: run.time,
    integrity: run.integrity,
    won: run.won,
    arena: run.arena,
    mode: run.mode,
    difficulty: run.difficulty,
    at: Date.now(),
  };

  if (better) profile.records[key] = record;
  return profile.records[key] ?? record;
}

function sum(values: Partial<Record<string, number>>): number {
  let total = 0;
  for (const value of Object.values(values)) total += value ?? 0;
  return total;
}
