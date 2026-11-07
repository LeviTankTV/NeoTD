import './style.css';
import * as THREE from 'three';
import {
  DIFFICULTIES,
  MAPS,
  TOTAL_WAVES,
  TOWER_DEFS,
  TOWER_ORDER,
  type MapDef,
} from './game/constants';
import { Game, type GameHooks, type GameOptions } from './game/game';
import { GameMap } from './game/map';
import type { Cell, DifficultyId, ModeId, Phase, RewardDef, TowerKind } from './game/types';
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
const ENDLESS_KEY = 'neotd.endless.best';

const ui = el('ui');
const titleScreen = el('title-screen');
const endScreen = el('end-screen');
const rewardScreen = el('reward-screen');
const rewardCards = el('reward-cards');
const startBtn = el<HTMLButtonElement>('start-btn');
const restartBtn = el<HTMLButtonElement>('restart-btn');
const endlessBtn = el<HTMLButtonElement>('endless-btn');
const menuBtn = el<HTMLButtonElement>('menu-btn');
const flashEl = el('flash');
const glitchEl = el('glitch-line');
const endGlyph = el<HTMLCanvasElement>('end-glyph');
const titleGlyph = el<HTMLCanvasElement>('glyph-canvas');

const selection: { mapId: string; mode: ModeId; difficulty: DifficultyId } = {
  mapId: MAPS[0].id,
  mode: 'campaign',
  difficulty: 'standard',
};

let map = new GameMap(MAPS[0]);
const canvas = el<HTMLCanvasElement>('stage');
const view = new SceneView(canvas, map);
const sound = new Sound();
const highlight = new CellHighlight();
view.scene.add(highlight.group);

let game: Game;
let hud: Hud | undefined;
let speed = 1;
let endShown = false;
let topView = false;
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
  toggleView: () => toggleTopView(),
  undo: () => game.undo(),
  upgrade: () => game.upgradeSelected(),
  sell: () => game.sellSelected(),
  move: () => game.beginMove(),
  chooseBranch: (branch) => game.chooseBranch(branch),
  setPriority: (priority) => game.setPriority(priority),
  massUpgrade: (kind) => game.upgradeAll(kind),
  massSell: (kind) => game.sellAll(kind),
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
  rewards: (options) => showRewards(options),
};

function optionsFor(mode: ModeId, difficulty: DifficultyId): GameOptions {
  return { mode, difficulty };
}

function createGame(nextMap: GameMap, options: GameOptions): void {
  if (game) game.dispose();
  map = nextMap;
  game = new Game(view.scene, view.effects, hooks, map, options);
  hud = new Hud(game, actions);
  hud.setSpeed(speed);
  hud.setSound(sound.enabled);
  hud.setTopView(topView);
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
  const def = MAPS.find((item) => item.id === selection.mapId) ?? MAPS[0];
  const nextMap = new GameMap(def);

  if (map.def.id !== def.id) {
    view.setMap(nextMap);
  }
  map = nextMap;

  if (!titleScreen.hidden) {
    titleScreen.hidden = true;
    sound.init();
    stopRain?.();
    stopRain = null;
  }

  createGame(map, optionsFor(selection.mode, selection.difficulty));
  rewardScreen.hidden = true;
  endShown = false;
  ui.hidden = false;

  hud?.refresh(true);
  hud?.log(`ARENA ${def.name} · ${selection.mode.toUpperCase()}`, 'sys');
  hud?.log('VESSEL ONLINE: оператор подключён', 'ok');
}

function showEnd(won: boolean): void {
  if (endShown) return;
  endShown = true;

  const minutes = Math.floor(game.time / 60);
  const seconds = Math.floor(game.time % 60);
  const endless = game.mode === 'endless';

  el('end-kicker').textContent = won
    ? 'CONTAINMENT COMPLETE'
    : endless
      ? 'SIGNAL LOST: ENDLESS'
      : 'CONTAINMENT FAILED';
  el('end-title').textContent = won ? 'SIGNAL HELD' : 'SIGNAL LOST';
  el('end-text').textContent = won
    ? `${TOTAL_WAVES} волн. Ядро цело. Он снова остался один — но в этот раз ты не отступил.`
    : endless
      ? `Бесконечный протокол оборван на волне ${game.wave}. Дальше — только новый заход.`
      : 'VESSEL потерял целостность. Он снова остался один. Протокол можно перезапустить.';

  el('end-stats').innerHTML = `
    <div><label>WAVE</label><b>${game.wave.toString().padStart(2, '0')} / ${
      Number.isFinite(game.totalWaves) ? game.totalWaves : '∞'
    }</b></div>
    <div><label>PURGED</label><b>${game.kills}</b></div>
    <div><label>TIME</label><b>${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}</b></div>
    <div><label>INTEGRITY</label><b>${Math.ceil(game.integrity)}%</b></div>
  `;

  endScreen.querySelector('.end-inner')?.classList.toggle('good', won);
  endScreen.hidden = false;
  endlessBtn.hidden = endless;

  const best = Number(localStorage.getItem(BEST_KEY) ?? '0');
  const reached = won ? TOTAL_WAVES : Math.max(1, game.wave);
  if (reached > best) localStorage.setItem(BEST_KEY, String(reached));

  if (endless) {
    const bestEndless = Number(localStorage.getItem(ENDLESS_KEY) ?? '0');
    if (game.wave > bestEndless) localStorage.setItem(ENDLESS_KEY, String(game.wave));
  }

  stopRain?.();
  stopRain = startGlyphRain(endGlyph);
}

function resetRun(options: GameOptions): void {
  if (stopRain) {
    stopRain();
    stopRain = null;
  }

  endScreen.hidden = true;
  endShown = false;
  topView = false;
  view.controls.minPolarAngle = 0.28;
  view.controls.maxPolarAngle = 1.22;

  game.dispose();
  view.effects.reset();
  view.setIntegrity(100);
  createGame(map, options);
  ui.hidden = false;

  hud?.refresh(true);
  hud?.log('PROTOCOL RESTART: сброс сектора');
  hud?.log('VESSEL ONLINE: оператор подключён', 'ok');
}

function restart(): void {
  resetRun(optionsFor(game.mode, game.difficulty));
}

function startEndless(): void {
  resetRun(optionsFor('endless', game.difficulty));
  hud?.log('ENDLESS PROTOCOL: волны не заканчиваются', 'warn');
}

function showRewards(options: RewardDef[]): void {
  rewardCards.innerHTML = '';
  for (const reward of options) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'reward-card';
    card.innerHTML = `<span class="reward-tag">${reward.tag}</span>
      <b>${reward.name}</b>
      <em>${reward.desc}</em>`;
    card.addEventListener('click', () => {
      game.applyReward(reward.id);
      rewardScreen.hidden = true;
      hud?.refresh(true);
    });
    rewardCards.appendChild(card);
  }
  rewardScreen.hidden = false;
}

function toggleTopView(): void {
  topView = !topView;
  const controls = view.controls;

  if (topView) {
    controls.minPolarAngle = 0.02;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    view.camera.position.set(0, 52, 0.01);
    controls.target.set(0, 0, 0);
  } else {
    controls.minPolarAngle = 0.28;
    controls.maxPolarAngle = 1.22;
    view.camera.position.set(16, 13, 24);
    controls.target.set(0, 0.6, 1.5);
  }

  controls.update();
  hud?.setTopView(topView);
}

function buildSelectors(): void {
  const mapBox = el('map-select');
  const modeBox = el('mode-select');
  const diffBox = el('difficulty-select');

  const make = (
    box: HTMLElement,
    items: Array<{ id: string; name: string; title?: string }>,
    active: string,
    onPick: (id: string) => void,
  ) => {
    box.innerHTML = '';
    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `seg-btn ${item.id === active ? 'on' : ''}`;
      button.textContent = item.name;
      if (item.title) button.title = item.title;
      button.dataset.id = item.id;
      button.addEventListener('click', () => {
        box.querySelectorAll('.seg-btn').forEach((node) => node.classList.remove('on'));
        button.classList.add('on');
        onPick(item.id);
      });
      box.appendChild(button);
    }
  };

  make(
    mapBox,
    MAPS.map((item) => ({ id: item.id, name: item.name, title: item.sub })),
    selection.mapId,
    (id) => {
      selection.mapId = id;
      const def: MapDef = MAPS.find((item) => item.id === id) ?? MAPS[0];
      const nextMap = new GameMap(def);
      map = nextMap;
      view.setMap(nextMap);
    },
  );

  make(
    modeBox,
    [
      { id: 'campaign', name: 'КАМПАНИЯ', title: '15 волн' },
      { id: 'endless', name: 'БЕСКОНЕЧНЫЙ', title: 'волны без конца' },
      { id: 'rogue', name: 'ROGUE', title: 'модификаторы и награды' },
    ],
    selection.mode,
    (id) => {
      selection.mode = id as ModeId;
      selection.mapId = selection.mapId;
    },
  );

  make(
    diffBox,
    DIFFICULTIES.map((item) => ({ id: item.id, name: item.name, title: item.sub })),
    selection.difficulty,
    (id) => {
      selection.difficulty = id as DifficultyId;
    },
  );
}

startBtn.addEventListener('click', startRun);
restartBtn.addEventListener('click', restart);
endlessBtn.addEventListener('click', startEndless);
menuBtn.addEventListener('click', () => window.location.reload());

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

  if (game.moving) {
    const free = map.isBuildable(cell.x, cell.z) && !tower;
    highlight.show(center.x, center.z, free, game.moving.range);
  } else if (game.selectedKind) {
    const def = TOWER_DEFS[game.selectedKind];
    highlight.show(center.x, center.z, game.canPlace(game.selectedKind, cell), def.range);
  } else if (tower) {
    highlight.show(center.x, center.z, true, game.statsFor(tower).range);
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

  if (game.moving) {
    game.finishMove(cell);
    updateHover(cell);
    return;
  }

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

  if (!rewardScreen.hidden) return;

  if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') {
    event.preventDefault();
    game.undo();
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
    case 'KeyG':
      game.beginMove();
      break;
    case 'KeyV':
      toggleTopView();
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

buildSelectors();
createGame(map, optionsFor(selection.mode, selection.difficulty));
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

  const bossAlive = game.enemies.some((enemy) => enemy.kind === 'face');
  sound.setIntensity(game.phase === 'wave' ? (bossAlive ? 1 : 0.75) : 0.3);

  view.setIntegrity(game.integrity);
  hud?.refresh();
  view.render(dt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

Object.defineProperty(window, '__neotd', {
  value: {
    get game() {
      return game;
    },
    get map() {
      return map;
    },
    view,
    selection,
    start: startRun,
    restart,
    end: showEnd,
    toggleTopView,
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
