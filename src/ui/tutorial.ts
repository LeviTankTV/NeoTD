import { L, tr, tf, type Localized } from '../i18n';
import type { Game } from '../game/game';

interface Step {
  title: Localized;
  text: Localized;
  hint: Localized;
  anchor: string;
  done(game: Game): boolean;
}

const STEPS: Step[] = [
  {
    title: L('ПОСТАВЬ ПРОТОКОЛ', 'PLACE A PROTOCOL'),
    text: L(
      'Выбери SENTRY на панели слева и поставь башню на любую свободную клетку рядом с маршрутом.',
      'Pick SENTRY on the left panel and place a tower on any free cell beside the route.',
    ),
    hint: L('1 — выбрать SENTRY · ЛКМ — поставить', '1 — pick SENTRY · LMB — place'),
    anchor: '#tower-list',
    done: (game) => game.towers.length > 0,
  },
  {
    title: L('УЛУЧШИ ЕЁ', 'UPGRADE IT'),
    text: L(
      'Выбери башню и нажми UPGRADE. Уровни повышают урон и радиус — это дешевле новой башни.',
      'Select the tower and press UPGRADE. Levels raise damage and range for less than a new tower.',
    ),
    hint: L('U — улучшить выбранную', 'U — upgrade the selected tower'),
    anchor: '#inspect-body',
    done: (game) => game.towers.some((tower) => tower.level >= 2),
  },
  {
    title: L('НАСТРОЙ ЦЕЛИ', 'SET TARGETS'),
    text: L(
      'В панели башни есть приоритеты: 1st бьёт ближайшего к ядру, HP+ — самого прочного. Выбери любой.',
      'The tower panel has priorities: 1st hits the one closest to the core, HP+ the toughest. Pick one.',
    ),
    hint: L('выбери приоритет в панели башни', 'pick a priority in the tower panel'),
    anchor: '#inspect-body',
    done: (game) => game.towers.some((tower) => tower.priority !== 'first'),
  },
  {
    title: L('ЗАПУСТИ ВОЛНУ', 'LAUNCH THE WAVE'),
    text: L(
      'Чем раньше запустишь волну, тем больше DATA получишь бонусом. Волна придёт сама.',
      'The earlier you launch a wave, the bigger the DATA bonus. The wave will come anyway.',
    ),
    hint: L('SPACE — запустить волну', 'SPACE — launch the wave'),
    anchor: '#wave-btn',
    done: (game) => game.phase === 'wave' || game.stats.wavesCleared > 0,
  },
  {
    title: L('УДЕРЖИ СИГНАЛ', 'HOLD THE SIGNAL'),
    text: L(
      'Волна зачищена — между волнами покупай и улучшай башни. Не дай ядру упасть до нуля.',
      'Wave cleared — build and upgrade between waves. Do not let the core reach zero.',
    ),
    hint: L('следующая волна — по кнопке INITIATE WAVE', 'next wave — via INITIATE WAVE'),
    anchor: '#wave-btn',
    done: (game) => game.stats.wavesCleared >= 1,
  },
];

export class Tutorial {
  private readonly panel = byId('tutorial');
  private readonly stepLabel = byId('tut-step');
  private readonly title = byId('tut-title');
  private readonly text = byId('tut-text');
  private readonly hint = byId('tut-hint');
  private index = 0;
  private active = false;
  private anchor: HTMLElement | null = null;

  constructor(
    private readonly game: () => Game,
    private readonly onFinish: () => void,
  ) {
    byId('tut-skip').onclick = () => this.finish();
  }

  start(): void {
    this.index = 0;
    this.active = true;
    this.panel.hidden = false;
    this.render();
  }

  stop(): void {
    this.active = false;
    this.panel.hidden = true;
    this.clearFocus();
  }

  update(): void {
    if (!this.active) return;
    const game = this.game();
    const step = STEPS[this.index];
    if (!step) {
      this.finish();
      return;
    }
    if (!step.done(game)) return;

    this.index += 1;
    if (this.index >= STEPS.length) {
      this.finish();
      return;
    }
    this.render();
  }

  refresh(): void {
    if (this.active) this.render();
  }

  private render(): void {
    const step = STEPS[this.index];
    if (!step) return;

    this.stepLabel.textContent = `${String(this.index + 1).padStart(2, '0')} / ${String(
      STEPS.length,
    ).padStart(2, '0')}`;
    this.title.textContent = tr(step.title);
    this.text.textContent = tr(step.text);
    this.hint.textContent = tf(step.hint, {});

    this.clearFocus();
    const target = document.querySelector<HTMLElement>(step.anchor);
    if (target) {
      target.classList.add('tut-focus');
      this.anchor = target;
    }

    this.panel.classList.remove('ping');
    void this.panel.offsetWidth;
    this.panel.classList.add('ping');
  }

  private clearFocus(): void {
    this.anchor?.classList.remove('tut-focus');
    this.anchor = null;
  }

  private finish(): void {
    this.stop();
    this.onFinish();
  }
}

function byId(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Не найден элемент #${id}`);
  return node;
}
