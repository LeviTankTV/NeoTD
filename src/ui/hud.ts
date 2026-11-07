import {
  ENEMY_DEFS,
  TOTAL_WAVES,
  TOWER_DEFS,
  TOWER_ORDER,
  WAVES,
  damageAt,
  rangeAt,
  upgradeCost,
} from '../game/constants';
import type { Game } from '../game/game';
import type { EnemyKind, LogKind, TowerKind } from '../game/types';

export interface HudActions {
  startWave(): void;
  cycleSpeed(): void;
  toggleSound(): void;
  upgrade(): void;
  sell(): void;
  selectKind(kind: TowerKind): void;
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Не найден элемент #${id}`);
  return node as T;
}

export class Hud {
  private readonly wave = el('wave');
  private readonly threat = el('threat');
  private readonly purged = el('purged');
  private readonly integrity = el('integrity');
  private readonly integrityBar = el('integrity-bar');
  private readonly data = el('data');
  private readonly logBox = el('log');
  private readonly waveBtn = el<HTMLButtonElement>('wave-btn');
  private readonly waveBtnSub = el('wave-btn-sub');
  private readonly waveMeta = el('wave-meta');
  private readonly waveProgress = el('wave-progress');
  private readonly inspectTitle = el('inspect-title');
  private readonly inspectTag = el('inspect-tag');
  private readonly inspectBody = el('inspect-body');
  private readonly speedBtn = el<HTMLButtonElement>('speed-btn');
  private readonly soundBtn = el<HTMLButtonElement>('sound-btn');

  private readonly cards = new Map<TowerKind, HTMLButtonElement>();
  private inspectorKey = '';

  constructor(
    private readonly game: Game,
    private readonly actions: HudActions,
  ) {
    this.buildCards();

    this.waveBtn.addEventListener('click', () => this.actions.startWave());
    this.speedBtn.addEventListener('click', () => this.actions.cycleSpeed());
    this.soundBtn.addEventListener('click', () => this.actions.toggleSound());

    this.inspectBody.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
      if (action === 'upgrade') this.actions.upgrade();
      if (action === 'sell') this.actions.sell();
    });

    this.refresh(true);
  }

  private buildCards(): void {
    const list = el('tower-list');
    list.innerHTML = '';

    TOWER_ORDER.forEach((kind, index) => {
      const def = TOWER_DEFS[kind];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'tower-card';
      card.dataset.kind = kind;
      card.innerHTML = `
        <span class="tc-key">${index + 1}</span>
        <span class="tc-sigil">${def.sigil}</span>
        <span class="tc-name">${def.name}</span>
        <span class="tc-role">${def.role}</span>
        <span class="tc-cost">${def.cost}</span>
      `;
      card.addEventListener('click', () => this.actions.selectKind(kind));
      list.appendChild(card);
      this.cards.set(kind, card);
    });
  }

  log(text: string, kind: LogKind = 'sys'): void {
    const line = document.createElement('div');
    line.className = `log-line ${kind}`;

    const stamp = document.createElement('span');
    const now = new Date();
    stamp.textContent = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    line.append(stamp, document.createTextNode(text));

    this.logBox.appendChild(line);
    while (this.logBox.children.length > 6) this.logBox.firstElementChild?.remove();
  }

  setSpeed(speed: number): void {
    this.speedBtn.textContent = `${speed}×`;
    this.speedBtn.classList.toggle('on', speed > 1);
  }

  setSound(enabled: boolean): void {
    this.soundBtn.textContent = enabled ? 'SND' : 'MUTE';
    this.soundBtn.classList.toggle('on', enabled);
  }

  refresh(force = false): void {
    const game = this.game;

    this.wave.innerHTML = `${game.wave.toString().padStart(2, '0')} <span>/ ${TOTAL_WAVES}</span>`;
    this.purged.textContent = game.kills.toString();
    this.data.textContent = Math.floor(game.money).toString();

    this.integrity.textContent = `${Math.ceil(game.integrity)}%`;
    this.integrityBar.style.width = `${Math.max(0, game.integrity)}%`;
    this.integrityBar.classList.toggle('low', game.integrity <= 40);

    const waveDef = WAVES[Math.min(game.wave - 1, WAVES.length - 1)] ?? [];
    const boss = waveDef.some((group) => group.kind === 'face');
    const fighting = game.phase === 'wave';

    this.threat.textContent = fighting ? (boss ? 'THE FACE' : 'CONTACT') : 'DORMANT';
    this.threat.classList.toggle('active', fighting && !boss);
    this.threat.classList.toggle('boss', fighting && boss);

    const canStart = game.phase === 'prep';
    this.waveBtn.disabled = !canStart;
    this.waveBtnSub.textContent = canStart
      ? 'READY'
      : fighting
        ? `${game.waveRemaining} LEFT`
        : 'LOCKED';
    this.waveMeta.textContent = canStart
      ? boss
        ? 'обнаружен сигнал THE FACE'
        : `волна ${game.wave} из ${TOTAL_WAVES}`
      : fighting
        ? `осталось ${game.waveRemaining} целей`
        : '';

    this.waveProgress.style.width = `${Math.round(game.waveProgress * 100)}%`;

    for (const kind of TOWER_ORDER) {
      const card = this.cards.get(kind);
      if (!card) continue;
      card.classList.toggle('selected', game.selectedKind === kind);
      card.classList.toggle('disabled', game.money < TOWER_DEFS[kind].cost);
    }

    const selected = game.selected;
    const key = selected
      ? `tower-${selected.id}-${selected.level}-${Math.floor(game.money)}`
      : `wave-${game.wave}-${game.phase}-${game.phase === 'wave' ? game.waveRemaining : 'x'}`;

    if (force || key !== this.inspectorKey) {
      this.inspectorKey = key;
      this.renderInspector();
    }
  }

  private renderInspector(): void {
    const game = this.game;
    const tower = game.selected;

    if (tower) {
      const def = TOWER_DEFS[tower.kind];
      const maxed = tower.level >= 3;
      const cost = upgradeCost(def.cost, tower.level);
      const nextDamage = maxed ? tower.damage : damageAt(def.damage, tower.level + 1);
      const nextRange = maxed ? tower.range : rangeAt(def.range, tower.level + 1);
      const refund = Math.floor(tower.spent * 0.65);

      this.inspectTitle.textContent = def.name;
      this.inspectTag.textContent = `LVL ${tower.level}`;

      const special = def.splash
        ? `<div><span>SPLASH</span><b>${def.splash.toFixed(1)}</b></div>`
        : def.slow
          ? `<div><span>SLOW</span><b>${Math.round(def.slow * 100)}%</b></div>`
          : '';

      this.inspectBody.innerHTML = `
        <div class="insp-name">${def.name}<em>LVL ${tower.level} / 3</em></div>
        <div class="lvl-dots">${[1, 2, 3].map((n) => `<i class="${n <= tower.level ? 'on' : ''}"></i>`).join('')}</div>
        <div class="insp-rows">
          <div><span>DAMAGE</span><b class="${maxed ? '' : 'up'}">${tower.damage.toFixed(1)}${
            maxed ? '' : ` → ${nextDamage.toFixed(1)}`
          }</b></div>
          <div><span>RANGE</span><b class="${maxed ? '' : 'up'}">${tower.range.toFixed(1)}${
            maxed ? '' : ` → ${nextRange.toFixed(1)}`
          }</b></div>
          <div><span>RATE</span><b>${(1 / def.cooldown).toFixed(2)}/s</b></div>
          ${special}
        </div>
        <div class="insp-actions">
          <button data-action="upgrade" ${maxed || game.money < cost ? 'disabled' : ''}>
            <span>${maxed ? 'MAX LEVEL' : 'UPGRADE'}</span>
            <em>${maxed ? '—' : `${cost} DATA`}</em>
          </button>
          <button class="ghost" data-action="sell">
            <span>SELL</span>
            <em>+${refund} DATA</em>
          </button>
        </div>
      `;
      return;
    }

    const waveDef = WAVES[Math.min(game.wave - 1, WAVES.length - 1)] ?? [];
    const counts = new Map<EnemyKind, number>();
    for (const group of waveDef) {
      counts.set(group.kind, (counts.get(group.kind) ?? 0) + group.count);
    }

    this.inspectTitle.textContent = game.phase === 'wave' ? 'CONTACT' : 'WAVE INTEL';
    this.inspectTag.textContent = game.phase === 'wave' ? 'LIVE' : 'NEXT';

    if (game.phase === 'won' || game.phase === 'lost') {
      this.inspectBody.innerHTML = '<div class="insp-empty">Сектор закрыт. Протокол завершён.</div>';
      return;
    }

    const rows = [...counts.entries()]
      .map(([kind, count]) => {
        const def = ENEMY_DEFS[kind];
        return `<div class="wave-row ${kind === 'face' ? 'boss' : ''}">
          <span class="sigil">${def.sigil}</span>
          <span class="nm">${def.name}</span>
          <span class="cnt">×${count}</span>
        </div>`;
      })
      .join('');

    const note = counts.has('face')
      ? 'Сигнал THE FACE. Он не остановится, пока не дойдёт до ядра.'
      : 'Выбери протокол слева и поставь башню на свободную клетку.';

    this.inspectBody.innerHTML = `
      <div class="insp-empty">Урон — только часть плана. Замедление и площадь решают больше.</div>
      ${rows}
      <div class="wave-note">${note}</div>
    `;
  }
}
