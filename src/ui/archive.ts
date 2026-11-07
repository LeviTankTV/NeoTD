import { L, tr, tf } from '../i18n';
import { ACHIEVEMENTS, CATEGORY_NAMES, achievementProgress, unlockedCount } from '../game/achievements';
import type { AchievementCategory } from '../game/achievements';
import { ACCENTS, TITLES } from '../game/cosmetics';
import { DIFFICULTIES, MAPS } from '../game/constants';
import type { DifficultyId, ModeId } from '../game/types';
import { recordKey, type Profile, type RunRecord } from '../profile';

type Tab = 'achievements' | 'records' | 'titles' | 'stats';

const MODE_NAMES: Record<ModeId, ReturnType<typeof L>> = {
  campaign: L('КАМПАНИЯ', 'CAMPAIGN'),
  endless: L('БЕСКОНЕЧНЫЙ', 'ENDLESS'),
  rogue: L('ROGUE', 'ROGUE'),
};

const CATEGORY_ORDER: AchievementCategory[] = ['combat', 'economy', 'modes', 'challenges'];

export class Archive {
  private readonly screen = byId('archive-screen');
  private readonly body = byId('archive-body');
  private readonly summary = byId('archive-summary');
  private readonly tabs = byId('archive-tabs');
  private tab: Tab = 'achievements';

  constructor(
    private readonly profile: Profile,
    private readonly onChange: () => void,
    private readonly onClose: () => void,
  ) {
    byId('archive-close').onclick = () => this.onClose();
    this.tabs.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
      button.onclick = () => this.open(button.dataset.tab as Tab);
    });

    this.body.onclick = (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-pick]');
      if (!target) return;
      const [kind, id] = (target.dataset.pick ?? '').split(':');
      if (kind === 'title') this.profile.title = id;
      if (kind === 'accent') this.profile.accent = id;
      this.onChange();
      this.refresh();
    };
  }

  open(tab: Tab = this.tab): void {
    this.tab = tab;
    this.screen.hidden = false;
    this.screen.classList.remove('glitch-in');
    void this.screen.offsetWidth;
    this.screen.classList.add('glitch-in');
    this.refresh();
  }

  close(): void {
    this.screen.hidden = true;
  }

  get isOpen(): boolean {
    return !this.screen.hidden;
  }

  refresh(): void {
    this.tabs.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
      button.classList.toggle('on', button.dataset.tab === this.tab);
    });

    const count = unlockedCount(this.profile);
    this.summary.innerHTML = `
      <div><label>${tr(L('ДОСТИЖЕНИЯ', 'ACHIEVEMENTS'))}</label><b>${count} / ${ACHIEVEMENTS.length}</b></div>
      <div><label>${tr(L('ЗАБЕГИ', 'RUNS'))}</label><b>${this.profile.stats.runs}</b></div>
      <div><label>${tr(L('ПОБЕДЫ', 'WINS'))}</label><b>${this.profile.stats.wins}</b></div>
      <div><label>${tr(L('ЛУЧШАЯ ВОЛНА', 'BEST WAVE'))}</label><b>${this.profile.stats.bestWave}</b></div>
    `;

    if (this.tab === 'achievements') this.renderAchievements();
    if (this.tab === 'records') this.renderRecords();
    if (this.tab === 'titles') this.renderTitles();
    if (this.tab === 'stats') this.renderStats();
  }

  private renderAchievements(): void {
    const groups = CATEGORY_ORDER.map((category) => {
      const items = ACHIEVEMENTS.filter((def) => def.category === category)
        .map((def) => {
          const progress = achievementProgress(this.profile, def);
          const hidden = def.hidden && !progress.done;
          const percent = Math.round((progress.value / progress.target) * 100);
          return `<article class="ach-card ${progress.done ? 'done' : ''} ${hidden ? 'secret' : ''}">
            <div class="ach-top">
              <b>${hidden ? '???' : tr(def.name)}</b>
              <span>${progress.done ? '✓' : `${progress.value}/${progress.target}`}</span>
            </div>
            <p>${hidden ? tr(L('Скрытое достижение.', 'Hidden achievement.')) : tr(def.desc)}</p>
            <div class="ach-bar"><i style="width:${progress.done ? 100 : percent}%"></i></div>
          </article>`;
        })
        .join('');

      return `<section class="ach-group">
        <h3>${tr(CATEGORY_NAMES[category])}</h3>
        <div class="ach-grid">${items}</div>
      </section>`;
    }).join('');

    this.body.innerHTML = groups;
  }

  private renderRecords(): void {
    const cards = MAPS.map((mapDef) => {
      const rows: string[] = [];
      for (const mode of ['campaign', 'endless', 'rogue'] as ModeId[]) {
        for (const diff of DIFFICULTIES as Array<{ id: DifficultyId }>) {
          const key = recordKey(mapDef.id, diff.id, mode);
          const record = this.profile.records[key];
          if (!record) continue;
          rows.push(this.recordRow(record));
        }
      }
      return `<section class="record-card">
        <h3>${mapDef.name}<span>${tr(mapDef.sub)}</span></h3>
        ${rows.length ? rows.join('') : `<p class="record-empty">${tr(L('Пока нет забегов.', 'No runs yet.'))}</p>`}
      </section>`;
    }).join('');

    this.body.innerHTML = cards;
  }

  private recordRow(record: RunRecord): string {
    const mode = MODE_NAMES[record.mode];
    const diff = DIFFICULTIES.find((item) => item.id === record.difficulty);
    const minutes = Math.floor(record.time / 60);
    const seconds = Math.floor(record.time % 60);
    return `<div class="record-row">
      <span class="rec-mode">${tr(mode)} · ${diff ? tr(diff.name) : record.difficulty}</span>
      <b>W${record.wave.toString().padStart(2, '0')}</b>
      <em>${record.kills} ${tr(L('целей', 'kills'))}</em>
      <em>${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}</em>
      <i>${record.won ? '✓' : '×'}</i>
    </div>`;
  }

  private renderTitles(): void {
    const count = unlockedCount(this.profile);

    const titles = TITLES.map((title) => {
      const unlocked = title.unlock(this.profile);
      const active = this.profile.title === title.id;
      return `<button class="title-card ${unlocked ? '' : 'locked'} ${active ? 'on' : ''}" ${
        unlocked ? `data-pick="title:${title.id}"` : 'disabled'
      }>
        <b>${tr(title.name)}</b>
        <span>${tr(title.desc)}</span>
        <em>${active ? tr(L('АКТИВЕН', 'ACTIVE')) : unlocked ? tr(L('ВЫБРАТЬ', 'SELECT')) : 'LOCKED'}</em>
      </button>`;
    }).join('');

    const accents = ACCENTS.map((accent) => {
      const unlocked = accent.unlock(this.profile);
      const active = this.profile.accent === accent.id;
      return `<button class="accent-card ${unlocked ? '' : 'locked'} ${active ? 'on' : ''}" ${
        unlocked ? `data-pick="accent:${accent.id}"` : 'disabled'
      } style="--swatch:${accent.accent}; --swatch2:${accent.accent2}">
        <span class="accent-swatch"></span>
        <b>${tr(accent.name)}</b>
        <em>${active ? tr(L('АКТИВЕН', 'ACTIVE')) : unlocked ? tr(L('ВЫБРАТЬ', 'SELECT')) : 'LOCKED'}</em>
      </button>`;
    }).join('');

    this.body.innerHTML = `
      <div class="titles-note">${tf(
        L('Открыто достижений: {count}. Титул виден в HUD во время забега.', 'Achievements unlocked: {count}. Your title shows in the HUD during a run.'),
        { count },
      )}</div>
      <h3>${tr(L('ТИТУЛЫ', 'TITLES'))}</h3>
      <div class="title-cards">${titles}</div>
      <h3>${tr(L('ПАЛИТРА', 'PALETTE'))}</h3>
      <div class="accent-cards">${accents}</div>
    `;
  }

  private renderStats(): void {
    const stats = this.profile.stats;
    const rows: Array<[ReturnType<typeof L>, string]> = [
      [L('Забеги', 'Runs'), String(stats.runs)],
      [L('Победы', 'Wins'), String(stats.wins)],
      [L('Победы на хардкоре', 'Hardcore wins'), String(stats.hardcoreWins)],
      [L('Уничтожено', 'Kills'), String(stats.kills)],
      [L('Пропущено', 'Leaks'), String(stats.leaks)],
      [L('Боссы', 'Bosses'), String(stats.bossKills)],
      [L('Идеальные волны', 'Perfect waves'), String(stats.perfectWaves)],
      [L('Построено башен', 'Towers built'), String(stats.towersBuilt)],
      [L('Максимум башен', 'Peak towers'), String(stats.maxTowers)],
      [L('Веток открыто', 'Branches unlocked'), `${stats.branchIds.length} / 8`],
      [L('Модулей взято', 'Modules taken'), String(stats.rewards)],
      [L('DATA заработано', 'DATA earned'), String(stats.dataEarned)],
      [L('Лучшая волна', 'Best wave'), String(stats.bestWave)],
      [L('Бесконечный', 'Endless best'), String(stats.bestEndless)],
      [L('ROGUE', 'ROGUE best'), String(stats.bestRogueWave)],
      [
        L('Быстрейшая кампания', 'Fastest campaign'),
        stats.fastestWin === null
          ? '—'
          : `${Math.floor(stats.fastestWin / 60)}:${String(Math.floor(stats.fastestWin % 60)).padStart(2, '0')}`,
      ],
    ];

    this.body.innerHTML = `<div class="stats-grid">${rows
      .map(
        ([label, value]) => `<div class="stat-row"><span>${tr(label)}</span><b>${value}</b></div>`,
      )
      .join('')}</div>`;
  }
}

function byId(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Не найден элемент #${id}`);
  return node;
}
