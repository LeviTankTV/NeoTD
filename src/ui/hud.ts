import { L, tf, tr } from '../i18n';
import {
  BRANCHES,
  ENEMY_DEFS,
  TOWER_BRANCHES,
  TOWER_DEFS,
  TOWER_ORDER,
  damageAt,
  rangeAt,
} from '../game/constants';
import type { Game } from '../game/game';
import type { BranchId, EnemyKind, LogKind, TargetPriority, TowerKind } from '../game/types';

export interface HudActions {
  startWave(): void;
  cycleSpeed(): void;
  toggleSound(): void;
  toggleView(): void;
  undo(): void;
  upgrade(): void;
  sell(): void;
  move(): void;
  chooseBranch(branch: BranchId): void;
  setPriority(priority: TargetPriority): void;
  massUpgrade(kind: TowerKind): void;
  massSell(kind: TowerKind): void;
  selectKind(kind: TowerKind): void;
}

const PRIORITIES: Array<{ id: TargetPriority; label: string; title: ReturnType<typeof L> }> = [
  { id: 'first', label: '1st', title: L('ближайший к ядру', 'closest to the core') },
  { id: 'last', label: 'last', title: L('самый дальний', 'furthest back') },
  { id: 'strong', label: 'HP+', title: L('самый прочный', 'toughest') },
  { id: 'weak', label: 'HP−', title: L('самый слабый', 'weakest') },
];

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
  private readonly undoBtn = el<HTMLButtonElement>('undo-btn');
  private readonly viewBtn = el<HTMLButtonElement>('view-btn');

  private readonly cards = new Map<TowerKind, HTMLButtonElement>();
  private inspectorKey = '';
  private armedSellAll: TowerKind | null = null;
  private armTimer = 0;

  constructor(
    private readonly game: Game,
    private readonly actions: HudActions,
  ) {
    this.buildCards();

    this.waveBtn.onclick = () => this.actions.startWave();
    this.speedBtn.onclick = () => this.actions.cycleSpeed();
    this.soundBtn.onclick = () => this.actions.toggleSound();
    this.undoBtn.onclick = () => this.actions.undo();
    this.viewBtn.onclick = () => this.actions.toggleView();

    this.inspectBody.onclick = (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      if (action === 'upgrade') this.actions.upgrade();
      if (action === 'sell') this.actions.sell();
      if (action === 'move') this.actions.move();
      if (action === 'branch') this.actions.chooseBranch(target.dataset.branch as BranchId);
      if (action === 'priority') {
        this.actions.setPriority(target.dataset.priority as TargetPriority);
      }
      if (action === 'mass-upgrade') this.actions.massUpgrade(target.dataset.kind as TowerKind);
      if (action === 'mass-sell') this.handleMassSell(target.dataset.kind as TowerKind);
    };

    this.refresh(true);
  }

  private buildCards(): void {
    const list = el('tower-list');
    list.innerHTML = '';
    this.cards.clear();

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
        <span class="tc-role">${tr(def.role)}</span>
        <span class="tc-cost">${this.game.towerCost(kind)}</span>
      `;
      card.onclick = () => this.actions.selectKind(kind);
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

  setTopView(active: boolean): void {
    this.viewBtn.classList.toggle('on', active);
    this.viewBtn.textContent = active ? 'ORBIT' : 'TOP';
  }

  alarm(): void {
    document.body.classList.add('alarm');
    window.clearTimeout(this.armTimer);
    this.armTimer = window.setTimeout(() => document.body.classList.remove('alarm'), 700);
  }

  refresh(force = false): void {
    const game = this.game;
    const total = game.totalWaves;

    this.wave.innerHTML = `${game.wave.toString().padStart(2, '0')} <span>/ ${
      Number.isFinite(total) ? total : '∞'
    }</span>`;
    this.purged.textContent = game.kills.toString();
    this.data.textContent = Math.floor(game.money).toString();

    this.integrity.textContent = `${Math.ceil(game.integrity)}%`;
    this.integrityBar.style.width = `${Math.min(100, Math.max(0, game.integrity))}%`;
    this.integrityBar.classList.toggle('low', game.integrity <= game.integrityCap * 0.4);

    const waveDef = game.nextWave;
    const boss = waveDef.some((group) => group.kind === 'face');
    const fighting = game.phase === 'wave';

    this.threat.textContent = fighting ? (boss ? 'THE FACE' : 'CONTACT') : 'DORMANT';
    this.threat.classList.toggle('active', fighting && !boss);
    this.threat.classList.toggle('boss', fighting && boss);

    const canStart = game.phase === 'prep' && game.pendingRewards.length === 0;
    this.waveBtn.disabled = !canStart;
    this.waveBtnSub.textContent = canStart
      ? game.earlyBonus > 0
        ? `+${game.earlyBonus} DATA`
        : 'READY'
      : fighting
        ? `${game.waveRemaining} ${tr(L('ОСТАЛОСЬ', 'LEFT'))}`
        : game.pendingRewards.length > 0
          ? tr(L('МОДУЛЬ', 'REWARD'))
          : tr(L('ЗАКРЫТО', 'LOCKED'));

    const early = game.earlyBonus;
    this.waveMeta.textContent = canStart
      ? early > 0
        ? tf(L('досрочный запуск +{bonus} DATA · {sec}s', 'early launch +{bonus} DATA · {sec}s'), {
            bonus: early,
            sec: game.prepRemaining,
          })
        : tf(L('волна {wave} из {total}', 'wave {wave} of {total}'), {
            wave: game.wave,
            total: Number.isFinite(total) ? total : '∞',
          })
      : fighting
        ? tf(L('осталось {count} целей', '{count} targets left'), { count: game.waveRemaining })
        : '';

    const pressure = Math.round(game.pressure * 100);
    if (pressure > 0) {
      const label = tf(L('давление +{pct}%', 'pressure +{pct}%'), { pct: pressure });
      this.waveMeta.textContent = this.waveMeta.textContent
        ? `${this.waveMeta.textContent} · ${label}`
        : label;
    }

    this.waveProgress.style.width = `${Math.round(game.waveProgress * 100)}%`;
    this.undoBtn.disabled = !game.canUndo;
    this.undoBtn.classList.toggle('on', game.canUndo);

    for (const kind of TOWER_ORDER) {
      const card = this.cards.get(kind);
      if (!card) continue;
      const cost = this.game.towerCost(kind);
      card.classList.toggle('selected', game.selectedKind === kind);
      card.classList.toggle('disabled', game.money < cost);
      const label = card.querySelector('.tc-cost');
      if (label) label.textContent = String(cost);
    }

    const selected = game.selected;
    const key = selected
      ? `tower-${selected.id}-${selected.level}-${selected.branch}-${selected.priority}-${Math.floor(
          game.money,
        )}-${this.armedSellAll}`
      : `wave-${game.wave}-${game.phase}-${game.waveMods.map((mod) => mod.id).join('.')}-${
          game.pendingRewards.length
        }-${game.mode}-${game.integrityCap}`;

    if (force || key !== this.inspectorKey) {
      this.inspectorKey = key;
      this.renderInspector();
    }
  }

  private handleMassSell(kind: TowerKind): void {
    if (this.armedSellAll === kind) {
      this.armedSellAll = null;
      window.clearTimeout(this.armTimer);
      this.actions.massSell(kind);
      return;
    }

    this.armedSellAll = kind;
    this.inspectorKey = '';
    window.clearTimeout(this.armTimer);
    this.armTimer = window.setTimeout(() => {
      this.armedSellAll = null;
      this.inspectorKey = '';
      this.refresh(true);
    }, 4000);
    this.renderInspector();
  }

  private renderInspector(): void {
    const game = this.game;
    const tower = game.selected;

    if (tower) {
      this.renderTower(tower);
      return;
    }

    const waveDef = game.nextWave;
    const counts = new Map<EnemyKind, number>();
    for (const group of waveDef) {
      counts.set(group.kind, (counts.get(group.kind) ?? 0) + group.count);
    }

    this.inspectTitle.textContent = game.phase === 'wave' ? 'CONTACT' : 'WAVE INTEL';
    this.inspectTag.textContent = game.phase === 'wave' ? 'LIVE' : 'NEXT';

    if (game.phase === 'won' || game.phase === 'lost') {
      this.inspectBody.innerHTML = `<div class="insp-empty">${tr(
        L('Сектор закрыт. Протокол завершён.', 'Sector sealed. Protocol complete.'),
      )}</div>`;
      return;
    }

    const rows = [...counts.entries()]
      .map(([kind, count]) => {
        const def = ENEMY_DEFS[kind];
        const hp = Math.round(def.hp);
        const armor = Math.round(def.armor * 100);
        const tags = (def.tags ?? []).map((tag) => tr(tag)).join(' · ');
        return `<div class="wave-block ${kind === 'face' ? 'boss' : ''}">
          <div class="wave-row">
            <span class="sigil">${def.sigil}</span>
            <span class="nm">${def.name}</span>
            <span class="cnt">×${count}</span>
          </div>
          <div class="wave-stats">HP ${hp} · SPD ${def.speed.toFixed(1)} · ARM ${armor}%${
            tags ? ` · ${tags}` : ''
          }</div>
        </div>`;
      })
      .join('');

    const mods = game.waveMods.length
      ? `<div class="wave-mods">${game.waveMods
          .map((mod) => `<b>${tr(mod.name)}</b> ${tr(mod.desc)}`)
          .join('<br />')}</div>`
      : '';

    const routes = game.map.routeCount;
    const routeNote =
      routes > 1
        ? `<div class="wave-routes">${tf(
            L('ВХОДОВ: {count} — оборона делится между маршрутами', 'ENTRANCES: {count} — defence must be split'),
            { count: routes },
          )}</div>`
        : '';

    const note = counts.has('face')
      ? tr(
          L(
            'THE FACE: щит, ярость после разбития и свита. Держи бронебой и замедление.',
            'THE FACE: shield, rage after it breaks, and an escort. Bring armour pierce and slows.',
          ),
        )
      : counts.has('flyer')
        ? tr(
            L(
              'WISP летит напрямую к ядру и срезает маршрут — прикрой прямую.',
              'WISP flies straight at the core and cuts the route — cover the direct line.',
            ),
          )
        : counts.has('phantom')
          ? tr(
              L(
                'PHANTOM исчезает на несколько секунд. Поля SNARE всё равно его достают.',
                'PHANTOM fades for a few seconds. SNARE fields still reach it.',
              ),
            )
          : tr(
              L(
                'Площадь, контроль и бронебой решают больше, чем одна сильная башня.',
                'Area, control and armour pierce matter more than one strong tower.',
              ),
            );

    this.inspectBody.innerHTML = `
      ${mods}
      ${routeNote}
      ${rows}
      <div class="wave-note">${note}</div>
    `;
  }

  private renderTower(tower: NonNullable<Game['selected']>): void {
    const game = this.game;
    const def = TOWER_DEFS[tower.kind];
    const stats = game.statsFor(tower);
    const maxed = tower.level >= 3;
    const cost = game.upgradeCostFor(tower);
    const branchCost = game.branchCostFor(tower);
    const refund = game.refundFor(tower);
    const branch = tower.branch ? BRANCHES[tower.branch] : null;
    const options = TOWER_BRANCHES[tower.kind];

    this.inspectTitle.textContent = def.name;
    this.inspectTag.textContent = `LVL ${tower.level}`;

    const branchRows = branch
      ? `<div class="insp-branch"><b>${branch.name}</b><span>${tr(branch.role)}</span><p>${tr(
          branch.desc,
        )}</p></div>`
      : '';

    const special = def.splash
      ? `<div><span>SPLASH</span><b>${(stats.splash || 0).toFixed(1)}</b></div>`
      : def.slow
        ? `<div><span>SLOW</span><b>${Math.round(stats.slow * 100)}%</b></div>`
        : '';

    const nextDamage = maxed ? stats.damage : damageAt(def.damage, tower.level + 1);
    const nextRange = maxed ? stats.range : rangeAt(def.range, tower.level + 1);

    const branchPicker =
      maxed && !tower.branch
        ? `<div class="branch-pick">
            <div class="branch-head">${tr(
              L('ВЕТКА ТРЕТЬЕГО УРОВНЯ', 'LEVEL THREE BRANCH'),
            )} <em>${branchCost} DATA</em></div>
            ${options
              .map((id) => {
                const info = BRANCHES[id];
                return `<button data-action="branch" data-branch="${id}" ${
                  game.money < branchCost ? 'disabled' : ''
                }>
                  <b>${info.name}</b>
                  <em>${tr(info.role)}</em>
                  <span>${tr(info.desc)}</span>
                </button>`;
              })
              .join('')}
          </div>`
        : '';

    const priorityRow = `
      <div class="priority">
        <span>${tr(L('ЦЕЛИ', 'TARGETS'))}</span>
        <div>
          ${PRIORITIES.map(
            (item) =>
              `<button data-action="priority" data-priority="${item.id}" title="${tr(
                item.title,
              )}" class="${tower.priority === item.id ? 'on' : ''}">${item.label}</button>`,
          ).join('')}
        </div>
      </div>
    `;

    const sameKind = game.towers.filter((item) => item.kind === tower.kind);
    const upgradable = sameKind.filter((item) => item.level < 3).length;
    const armed = this.armedSellAll === tower.kind;

    this.inspectBody.innerHTML = `
      <div class="insp-name">${def.name}<em>LVL ${tower.level} / 3</em></div>
      <div class="lvl-dots">${[1, 2, 3]
        .map((n) => `<i class="${n <= tower.level ? 'on' : ''}"></i>`)
        .join('')}</div>
      ${branchRows}
      <div class="insp-rows">
        <div><span>DAMAGE</span><b>${stats.damage.toFixed(1)}${
          maxed ? '' : ` <em>→ ${nextDamage.toFixed(1)}</em>`
        }</b></div>
        <div><span>RANGE</span><b>${stats.range.toFixed(1)}${
          maxed ? '' : ` <em>→ ${nextRange.toFixed(1)}</em>`
        }</b></div>
        <div><span>RATE</span><b>${(1 / stats.cooldown).toFixed(2)}/s</b></div>
        ${special}
        ${stats.armorPierce > 0 ? `<div><span>ARMOR PIERCE</span><b>${Math.round(stats.armorPierce * 100)}%</b></div>` : ''}
      </div>
      <div class="insp-note">${tr(def.desc)}</div>
      ${priorityRow}
      ${branchPicker}
      <div class="insp-actions">
        <button data-action="upgrade" ${maxed || game.money < cost ? 'disabled' : ''}>
          <span>${maxed ? 'MAX LEVEL' : 'UPGRADE'}</span>
          <em>${maxed ? '—' : `${cost} DATA`}</em>
        </button>
        <button class="ghost" data-action="move"><span>${tr(
          L('ПЕРЕМЕСТИТЬ', 'MOVE'),
        )}</span><em>${tr(L('бесплатно', 'free'))}</em></button>
        <button class="ghost" data-action="sell"><span>SELL</span><em>+${refund} DATA</em></button>
      </div>
      <div class="mass-actions">
        <button data-action="mass-upgrade" data-kind="${tower.kind}" ${
          upgradable === 0 ? 'disabled' : ''
        }>${tr(L('ВСЕ', 'ALL'))} ${def.name} → LVL <em>×${upgradable}</em></button>
        <button data-action="mass-sell" data-kind="${tower.kind}" class="danger ${
          armed ? 'armed' : ''
        }" ${sameKind.length === 0 ? 'disabled' : ''}>${
          armed ? tr(L('ТОЧНО ПРОДАТЬ?', 'SELL FOR SURE?')) : `${tr(L('ПРОДАТЬ ВСЕ', 'SELL ALL'))} ×${sameKind.length}`
        }</button>
      </div>
    `;
  }
}

