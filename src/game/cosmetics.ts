import { L, type Localized } from '../i18n';
import type { Profile } from '../profile';
import { unlockedCount } from './achievements';

export interface TitleDef {
  id: string;
  name: Localized;
  desc: Localized;
  unlock(profile: Profile): boolean;
}

export interface AccentDef {
  id: string;
  name: Localized;
  desc: Localized;
  accent: string;
  accent2: string;
  glow: string;
  unlock(profile: Profile): boolean;
}

export const TITLES: TitleDef[] = [
  {
    id: 'operator',
    name: L('ОПЕРАТОР', 'OPERATOR'),
    desc: L('Базовый титул каждого, кто подключён к VESSEL.', 'The baseline title of anyone wired to VESSEL.'),
    unlock: () => true,
  },
  {
    id: 'curator',
    name: L('КУРАТОР', 'CURATOR'),
    desc: L('За 10 достижений.', 'For 10 achievements.'),
    unlock: (p) => unlockedCount(p) >= 10,
  },
  {
    id: 'archivist',
    name: L('АРХИВАРИУС', 'ARCHIVIST'),
    desc: L('За 18 достижений.', 'For 18 achievements.'),
    unlock: (p) => unlockedCount(p) >= 18,
  },
  {
    id: 'keeper',
    name: L('ХРАНИТЕЛЬ СИГНАЛА', 'SIGNAL KEEPER'),
    desc: L('За победу на хардкоре.', 'For a hardcore victory.'),
    unlock: (p) => p.stats.hardcoreWins > 0,
  },
  {
    id: 'void',
    name: L('ИДУЩИЙ В ПУСТОТЕ', 'VOID WALKER'),
    desc: L('За 25 волн в бесконечном режиме.', 'For 25 waves in endless mode.'),
    unlock: (p) => p.stats.bestEndless >= 25,
  },
  {
    id: 'saint',
    name: L('СВЯТОЙ ГЛИТЧА', 'GLITCH SAINT'),
    desc: L('За все 24 достижения.', 'For all 24 achievements.'),
    unlock: (p) => unlockedCount(p) >= 24,
  },
];

export const ACCENTS: AccentDef[] = [
  {
    id: 'signal',
    name: L('СИГНАЛ', 'SIGNAL'),
    desc: L('Штатная палитра VESSEL.', 'The stock VESSEL palette.'),
    accent: '#9cc9ff',
    accent2: '#3a5fa8',
    glow: 'rgba(156, 201, 255, 0.35)',
    unlock: () => true,
  },
  {
    id: 'ember',
    name: L('УГОЛЬ', 'EMBER'),
    desc: L('За 8 достижений.', 'For 8 achievements.'),
    accent: '#ff8a5c',
    accent2: '#a83a2a',
    glow: 'rgba(255, 138, 92, 0.35)',
    unlock: (p) => unlockedCount(p) >= 8,
  },
  {
    id: 'void',
    name: L('ПУСТОТА', 'VOID'),
    desc: L('За 16 достижений.', 'For 16 achievements.'),
    accent: '#b58cff',
    accent2: '#5a3f9e',
    glow: 'rgba(181, 140, 255, 0.35)',
    unlock: (p) => unlockedCount(p) >= 16,
  },
  {
    id: 'mono',
    name: L('МОНО', 'MONO'),
    desc: L('За 24 достижения.', 'For 24 achievements.'),
    accent: '#c9d6e8',
    accent2: '#5e7390',
    glow: 'rgba(201, 214, 232, 0.35)',
    unlock: (p) => unlockedCount(p) >= 24,
  },
];

export function titleById(id: string): TitleDef {
  return TITLES.find((item) => item.id === id) ?? TITLES[0];
}

export function accentById(id: string): AccentDef {
  return ACCENTS.find((item) => item.id === id) ?? ACCENTS[0];
}

export function applyAccent(profile: Profile): void {
  const accent = accentById(profile.accent);
  const root = document.documentElement.style;
  root.setProperty('--accent', accent.accent);
  root.setProperty('--accent-2', accent.accent2);
  root.setProperty('--accent-glow', accent.glow);
}

export function availableTitles(profile: Profile): TitleDef[] {
  return TITLES.filter((item) => item.unlock(profile));
}

export function availableAccents(profile: Profile): AccentDef[] {
  return ACCENTS.filter((item) => item.unlock(profile));
}
