import { L, type Localized } from '../i18n';
import type { Profile } from '../profile';

export type AchievementCategory = 'combat' | 'economy' | 'modes' | 'challenges';

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  name: Localized;
  desc: Localized;
  hidden?: boolean;
  target: number;
  value(profile: Profile): number;
}

export const CATEGORY_NAMES: Record<AchievementCategory, Localized> = {
  combat: L('БОЙ', 'COMBAT'),
  economy: L('ЭКОНОМИКА', 'ECONOMY'),
  modes: L('РЕЖИМЫ', 'MODES'),
  challenges: L('ВЫЗОВЫ', 'CHALLENGES'),
};

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-blood',
    category: 'combat',
    name: L('ПЕРВАЯ КРОВЬ', 'FIRST BLOOD'),
    desc: L('Уничтожить первого врага.', 'Destroy your first enemy.'),
    target: 1,
    value: (p) => p.stats.kills,
  },
  {
    id: 'purger',
    category: 'combat',
    name: L('ЧИСТИЛЬЩИК', 'PURGER'),
    desc: L('Уничтожить 500 врагов.', 'Destroy 500 enemies.'),
    target: 500,
    value: (p) => p.stats.kills,
  },
  {
    id: 'exterminator',
    category: 'combat',
    name: L('ИСТРЕБИТЕЛЬ', 'EXTERMINATOR'),
    desc: L('Уничтожить 2000 врагов.', 'Destroy 2000 enemies.'),
    target: 2000,
    value: (p) => p.stats.kills,
  },
  {
    id: 'boss-breaker',
    category: 'combat',
    name: L('РАЗБИТЫЙ ЛИК', 'FACE BREAKER'),
    desc: L('Уничтожить THE FACE.', 'Destroy THE FACE.'),
    target: 1,
    value: (p) => p.stats.bossKills,
  },
  {
    id: 'twin-faces',
    category: 'combat',
    name: L('ДВА ЛИКА', 'TWO FACES'),
    desc: L('Уничтожить двух боссов.', 'Destroy two bosses.'),
    target: 2,
    value: (p) => p.stats.bossKills,
  },
  {
    id: 'untouched',
    category: 'combat',
    name: L('БЕЗ ЕДИНОЙ ЦАРАПИНЫ', 'UNTOUCHED'),
    desc: L('Пройти кампанию, не потеряв ни процента ядра.', 'Clear the campaign without losing a single percent of the core.'),
    hidden: true,
    target: 1,
    value: (p) => p.stats.flawlessWins,
  },
  {
    id: 'data-miner',
    category: 'economy',
    name: L('ДОБЫТЧИК DATA', 'DATA MINER'),
    desc: L('Заработать 1000 DATA за один забег.', 'Earn 1000 DATA in a single run.'),
    target: 1000,
    value: (p) => p.stats.bestRunData,
  },
  {
    id: 'investor',
    category: 'economy',
    name: L('ИНВЕСТОР', 'INVESTOR'),
    desc: L('Держать 15 башен одновременно.', 'Keep 15 towers at once.'),
    target: 15,
    value: (p) => p.stats.maxTowers,
  },
  {
    id: 'maxed',
    category: 'economy',
    name: L('ПОЛНЫЙ ПРОТОКОЛ', 'FULL PROTOCOL'),
    desc: L('Довести башню до третьего уровня.', 'Bring a tower to level three.'),
    target: 1,
    value: (p) => p.stats.maxedTowers,
  },
  {
    id: 'specialist',
    category: 'economy',
    name: L('СПЕЦИАЛИСТ', 'SPECIALIST'),
    desc: L('Открыть все восемь веток.', 'Unlock all eight branches.'),
    target: 8,
    value: (p) => p.stats.branchIds.length,
  },
  {
    id: 'liquidator',
    category: 'economy',
    name: L('ЛИКВИДАТОР', 'LIQUIDATOR'),
    desc: L('Продать 20 башен.', 'Sell 20 towers.'),
    target: 20,
    value: (p) => p.stats.soldTowers,
  },
  {
    id: 'banker',
    category: 'economy',
    name: L('РЕЗЕРВ', 'RESERVE'),
    desc: L('Накопить 1500 DATA сразу.', 'Hold 1500 DATA at once.'),
    hidden: true,
    target: 1500,
    value: (p) => p.stats.peakMoney,
  },
  {
    id: 'campaign-clear',
    category: 'modes',
    name: L('СИГНАЛ УДЕРЖАН', 'SIGNAL HELD'),
    desc: L('Пройти кампанию из 15 волн.', 'Clear the 15-wave campaign.'),
    target: 1,
    value: (p) => p.stats.campaignWins,
  },
  {
    id: 'hardcore-clear',
    category: 'modes',
    name: L('БЕЗ СКИДОК', 'NO MERCY'),
    desc: L('Пройти кампанию на хардкоре.', 'Clear the campaign on hardcore.'),
    target: 1,
    value: (p) => p.stats.hardcoreWins,
  },
  {
    id: 'endless-20',
    category: 'modes',
    name: L('ДВАДЦАТЬ', 'TWENTY'),
    desc: L('Дойти до 20 волны в бесконечном режиме.', 'Reach wave 20 in endless mode.'),
    target: 20,
    value: (p) => p.stats.bestEndless,
  },
  {
    id: 'endless-30',
    category: 'modes',
    name: L('ТРИДЦАТЬ', 'THIRTY'),
    desc: L('Дойти до 30 волны в бесконечном режиме.', 'Reach wave 30 in endless mode.'),
    hidden: true,
    target: 30,
    value: (p) => p.stats.bestEndless,
  },
  {
    id: 'rogue-10',
    category: 'modes',
    name: L('РОГАЛИК', 'ROGUE RUN'),
    desc: L('Продержаться 10 волн в ROGUE.', 'Survive 10 waves in ROGUE.'),
    target: 10,
    value: (p) => p.stats.bestRogueWave,
  },
  {
    id: 'rogue-stack',
    category: 'modes',
    name: L('СТЕК МОДУЛЕЙ', 'MODULE STACK'),
    desc: L('Взять 15 модулей за один забег.', 'Take 15 modules in a single run.'),
    target: 15,
    value: (p) => p.stats.bestRogueModules,
  },
  {
    id: 'all-arenas',
    category: 'challenges',
    name: L('ВСЕ СЕКТОРЫ', 'ALL SECTORS'),
    desc: L('Победить на всех пяти аренах.', 'Win on all five arenas.'),
    target: 5,
    value: (p) => p.stats.arenasWon.length,
  },
  {
    id: 'wisp-kills',
    category: 'challenges',
    name: L('ЛОВЕЦ СИГНАЛОВ', 'SIGNAL TRAPPER'),
    desc: L('Уничтожить 50 WISP.', 'Destroy 50 WISP.'),
    target: 50,
    value: (p) => p.stats.killsByKind.flyer ?? 0,
  },
  {
    id: 'phantom-kills',
    category: 'challenges',
    name: L('ОХОТНИК ЗА ТЕНЯМИ', 'SHADOW HUNTER'),
    desc: L('Уничтожить 30 PHANTOM.', 'Destroy 30 PHANTOM.'),
    target: 30,
    value: (p) => p.stats.killsByKind.phantom ?? 0,
  },
  {
    id: 'shield-breaker',
    category: 'challenges',
    name: L('ЛОМАТЕЛЬ ЩИТОВ', 'SHIELD BREAKER'),
    desc: L('Снять 25 щитов.', 'Break 25 shields.'),
    target: 25,
    value: (p) => p.stats.shieldBreaks,
  },
  {
    id: 'speedrun',
    category: 'challenges',
    name: L('СЖАТЫЙ ПРОТОКОЛ', 'TIGHT PROTOCOL'),
    desc: L('Пройти кампанию быстрее 15 минут.', 'Clear the campaign in under 15 minutes.'),
    target: 1,
    value: (p) =>
      p.stats.fastestWin !== null && p.stats.fastestWin <= 900 ? 1 : 0,
  },
  {
    id: 'operator',
    category: 'challenges',
    name: L('ОПЕРАТОР', 'OPERATOR'),
    desc: L('Открыть 12 других достижений.', 'Unlock 12 other achievements.'),
    hidden: true,
    target: 12,
    value: () => 0,
  },
];

export function unlockedCount(profile: Profile): number {
  return Object.keys(profile.achievements).length;
}

export function achievementProgress(
  profile: Profile,
  def: AchievementDef,
): { value: number; target: number; done: boolean } {
  if (profile.achievements[def.id]) return { value: def.target, target: def.target, done: true };
  if (def.id === 'operator') {
    const others = ACHIEVEMENTS.filter((item) => item.id !== 'operator').filter(
      (item) => profile.achievements[item.id],
    ).length;
    return {
      value: Math.min(others, def.target),
      target: def.target,
      done: others >= def.target,
    };
  }
  const value = Math.min(def.value(profile), def.target);
  return { value: Math.max(0, value), target: def.target, done: value >= def.target };
}

export function evaluateAchievements(profile: Profile): AchievementDef[] {
  const unlocked: AchievementDef[] = [];

  for (const def of ACHIEVEMENTS) {
    if (def.id === 'operator') continue;
    if (profile.achievements[def.id]) continue;
    if (def.value(profile) >= def.target) {
      profile.achievements[def.id] = Date.now();
      unlocked.push(def);
    }
  }

  const operator = ACHIEVEMENTS.find((def) => def.id === 'operator');
  if (operator && !profile.achievements.operator) {
    const others = Object.keys(profile.achievements).length;
    if (others >= operator.target) {
      profile.achievements.operator = Date.now();
      unlocked.push(operator);
    }
  }

  return unlocked;
}
