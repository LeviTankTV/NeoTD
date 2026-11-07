import './style.css';
import * as THREE from 'three';
import { TOTAL_WAVES, TOWER_DEFS, TOWER_ORDER } from './game/constants';
import { Game, type GameHooks } from './game/game';
import { GameMap } from './game/map';
import type { Cell, Phase, TowerKind } from './game/types';
import { CellHighlight } from './render/models';
import { SceneView } from './render/scene';
import { Sound } from './ui/audio';
import { startGlyphRain } from './ui/glyphrain';
import { Hud, type HudActions } from './ui/hud';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Не найден элемент #${id}`);
  return node as T;
}

const BEST_KEY = 'neotd.best';

const ui = el('ui');
const titleScreen = el('title-screen');
const endScreen = el('end-screen');
const startBtn = el<HTMLButtonElement>('start-btn');
const restartBtn = el<HTMLButtonElement>('restart-btn');
const menuBtn = el<HTMLButtonElement>('menu-btn');
const flashEl = el('flash');
const glitchEl = el('glitch-line');
const endGlyph = el<HTMLCanvasElement>('end-glyph');
const titleGlyph = el<HTMLCanvasElement>('glyph-canvas');

const map = new GameMap();
const canvas = el<HTMLCanvasElement>('stage');
const view = new SceneView(canvas, map);
const sound = new Sound();
const highlight = new CellHighlight();
view.scene.add(highlight.group);

let game: Game;
let hud: Hud | undefined;
let speed = 1;
let endShown = false;
let stopRain: (() => void) | null = null;
let flashTimer = 0;

const actions: HudActions = {
  startWave: () => {
    sound.init();
    game.startWave();
  },
  cycleSpeed: () => {
    speed = speed === 1 ? 2 : speed === 2 ? 3 : 1;
    hud?.setSpeed(speed);
  },
  toggleSound: () => {
    sound.init();
    sound.setEnabled(!sound.enabled);
    hud?.setSound(sound.enabled);
  },
  upgrade: () => game.upgradeSelected(),
  sell: () => game.sellSelected(),
  selectKind: (kind: TowerKind) => {
    sound.init();
    game.setKind(game.selectedKind === kind ? null : kind);
  },
};

const hooks: GameHooks = {
  log: (text, kind) => hud?.log(text, kind),
  phase: (phase: Phase) => {
    hud?.refresh(true);
    if (phase === 'lost') window.setTimeout(() => showEnd(false), 900);
    if (phase === 'won') window.setTimeout(() => showEnd(true), 1100);
  },
  coreHit: () => flashScreen(),
  changed: () => hud?.refresh(),
  sfx: (name) => sound.play(name),
};

function createGame(): void {
  game = new Game(view.scene, view.effects, hooks, map);
  hud = new Hud(game, actions);
  hud.setSpeed(speed);
  hud.setSound(sound.enabled);
}

function flashScreen(): void {
  flashEl.classList.add('on');
  glitchEl.classList.remove('on');
  void glitchEl.offsetWidth;
  glitchEl.classList.add('on');

  window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => flashEl.classList.remove('on'), 90);
}

function startRun(): void {
  if (!titleScreen.hidden) {
    titleScreen.hidden = true;
    sound.init();
    stopRain?.();
    stopRain = null;
  }

  ui.hidden = false;
  hud?.refresh(true);
  hud?.log('SECTOR 07 // протокол сдерживания активен');
  hud?.log('VESSEL ONLINE // оператор подключён', 'ok');
}

function showEnd(won: boolean): void {
  if (endShown) return;
  endShown = true;

  const minutes = Math.floor(game.time / 60);
  const seconds = Math.floor(game.time % 60);

  el('end-kicker').textContent = won ? 'CONTAINMENT COMPLETE' : 'CONTAINMENT FAILED';
  el('end-title').textContent = won ? 'SIGNAL HELD' : 'SIGNAL LOST';
  el('end-text').textContent = won
    ? 'Пятнадцать волн. Ядро цело. Он снова остался один — но в этот раз ты не отступил.'
    : 'VESSEL потерял целостность. Он снова остался один. Протокол можно перезапустить.';

  el('end-stats').innerHTML = `
    <div><label>WAVE</label><b>${game.wave.toString().padStart(2, '0')} / ${TOTAL_WAVES}</b></div>
    <div><label>PURGED</label><b>${game.kills}</b></div>
    <div><label>TIME</label><b>${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}</b></div>
    <div><label>INTEGRITY</label><b>${Math.ceil(game.integrity)}%</b></div>
  `;

  endScreen.querySelector('.end-inner')?.classList.toggle('good', won);
  endScreen.hidden = false;

  const best = Number(localStorage.getItem(BEST_KEY) ?? '0');
  const reached = won ? TOTAL_WAVES : Math.max(1, game.wave);
  if (reached > best) localStorage.setItem(BEST_KEY, String(reached));

  stopRain?.();
  stopRain = startGlyphRain(endGlyph);
}

function restart(): void {
  if (stopRain) {
    stopRain();
    stopRain = null;
  }

  endScreen.hidden = true;
  endShown = false;

  game.dispose();
  view.effects.reset();
  view.setIntegrity(100);
  createGame();
  ui.hidden = false;

  hud?.refresh(true);
  hud?.log('PROTOCOL RESTART // сброс сектора');
  hud?.log('VESSEL ONLINE // оператор подключён', 'ok');
}

startBtn.addEventListener('click', startRun);
restartBtn.addEventListener('click', restart);
menuBtn.addEventListener('click', () => window.location.reload());

/* ------------------------------------------------------- pointer input */

const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();
const ndc = new THREE.Vector2();
let pointerDown = { x: 0, y: 0, valid: false };
let hover: Cell | null = null;

function pick(clientX: number, clientY: number): Cell | null {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, view.camera);

  if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return null;
  return map.worldToCell(hitPoint.x, hitPoint.z);
}

function updateHover(cell: Cell | null): void {
  hover = cell;
  game.setHover(cell);

  if (!cell || titleScreen.hidden === false || endShown) {
    highlight.hide();
    return;
  }

  const center = map.cellCenter(cell.x, cell.z);
  const tower = game.towerAt(cell);

  if (game.selectedKind) {
    const def = TOWER_DEFS[game.selectedKind];
    highlight.show(center.x, center.z, game.canPlace(game.selectedKind, cell), def.range);
  } else if (tower) {
    highlight.show(center.x, center.z, true, tower.range);
  } else {
    highlight.show(center.x, center.z, true);
  }
}

canvas.addEventListener('pointermove', (event) => {
  updateHover(pick(event.clientX, event.clientY));
});

canvas.addEventListener('pointerdown', (event) => {
  pointerDown = { x: event.clientX, y: event.clientY, valid: true };
});

canvas.addEventListener('pointerup', (event) => {
  if (!pointerDown.valid) return;
  pointerDown.valid = false;

  const travelled = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
  if (travelled > 7) return;
  if (!titleScreen.hidden || endShown) return;

  const cell = pick(event.clientX, event.clientY);
  if (!cell) {
    game.clearSelection();
    return;
  }

  updateHover(cell);
  const tower = game.towerAt(cell);

  if (game.selectedKind) {
    if (tower) game.selectTower(cell);
    else game.place(game.selectedKind, cell);
    updateHover(cell);
    return;
  }

  if (tower) game.selectTower(cell);
  else game.clearSelection();
});

canvas.addEventListener('pointerleave', () => {
  hover = null;
  highlight.hide();
});

/* ------------------------------------------------------- keyboard */

window.addEventListener('keydown', (event) => {
  if (!titleScreen.hidden) {
    if (event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault();
      startRun();
    }
    return;
  }

  if (endShown) {
    if (event.code === 'Enter' || event.code === 'KeyR') {
      event.preventDefault();
      restart();
    }
    return;
  }

  if (event.code.startsWith('Digit')) {
    const index = Number(event.code.slice(5)) - 1;
    const kind = TOWER_ORDER[index];
    if (kind) {
      sound.init();
      game.setKind(game.selectedKind === kind ? null : kind);
      updateHover(hover);
    }
    return;
  }

  switch (event.code) {
    case 'Escape':
      game.clearSelection();
      updateHover(hover);
      break;
    case 'KeyU':
      game.upgradeSelected();
      break;
    case 'KeyS':
      game.sellSelected();
      break;
    case 'KeyM':
      actions.toggleSound();
      break;
    case 'Space':
      event.preventDefault();
      if (game.phase === 'prep') {
        sound.init();
        game.startWave();
      }
      break;
  }
});

/* ------------------------------------------------------- boot */

createGame();
stopRain = startGlyphRain(titleGlyph);

const best = Number(localStorage.getItem(BEST_KEY) ?? '0');
if (best > 0) el('best-wave').textContent = `WAVE ${best.toString().padStart(2, '0')}`;

window.setInterval(() => {
  const total = Math.floor(performance.now() / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  el('title-clock').textContent = [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');
}, 1000);

const clock = new THREE.Clock();

function frame(): void {
  const dt = Math.min(clock.getDelta(), 0.1);

  if (titleScreen.hidden && !endShown) {
    let remaining = dt * speed;
    while (remaining > 0) {
      const step = Math.min(remaining, 1 / 60);
      game.update(step);
      remaining -= step;
    }
  }

  view.setIntegrity(game.integrity);
  hud?.refresh();
  view.render(dt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

/* Отладочный доступ для автотестов. */
Object.defineProperty(window, '__neotd', {
  value: {
    get game() {
      return game;
    },
    view,
    map,
    start: startRun,
    restart,
    end: showEnd,
    advance(seconds: number) {
      let remaining = seconds;
      while (remaining > 0) {
        const step = Math.min(remaining, 1 / 60);
        game.update(step);
        remaining -= step;
      }
      hud?.refresh(true);
    },
  },
});
