import './style.css';
import './style-v1.css';
import * as THREE from 'three';
import { L, initLang, setLang, tf, tr, type Lang } from './i18n';
import { evaluateAchievements, type AchievementDef } from './game/achievements';
import { applyAccent, titleById } from './game/cosmetics';
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
import type {
  Cell,
  DifficultyId,
  ModeId,
  Phase,
  RewardDef,
  TowerKind,
} from './game/types';
import {
  applyRun,
  loadProfile,
  recordFor,
  saveProfile,
  type Profile,
  type RunRecord,
} from './profile';
import { CellHighlight } from './render/models';
import { SceneView } from './render/scene';
import { Archive } from './ui/archive';
import { Sound } from './ui/audio';
import { startGlyphRain } from './ui/glyphrain';
import { Hud, type HudActions } from './ui/hud';
import { Tutorial } from './ui/tutorial';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Не найден элемент #${id}`);
  return node as T;
}

const MODE_NAMES: Record<ModeId, ReturnType<typeof L>> = {
  campaign: L('КАМПАНИЯ', 'CAMPAIGN'),
  endless: L('БЕСКОНЕЧНЫЙ', 'ENDLESS'),
  rogue: L('ROGUE', 'ROGUE'),
};

const MODE_HINTS: Record<ModeId, ReturnType<typeof L>> = {
  campaign: L('15 волн', '15 waves'),
  endless: L('волны без конца', 'endless waves'),
  rogue: L('модификаторы и награды', 'modifiers and rewards'),
};

const RARITY_NAMES: Record<string, ReturnType<typeof L>> = {
  common: L('ОБЫЧНЫЙ', 'COMMON'),
  rare: L('РЕДКИЙ', 'RARE'),
  epic: L('ЭПИЧЕСКИЙ', 'EPIC'),
};

const ui = el('ui');
const titleScreen = el('title-screen');
const endScreen = el('end-screen');
const rewardScreen = el('reward-screen');
const rewardCards = el('reward-cards');
const startBtn = el<HTMLButtonElement>('start-btn');
const restartBtn = el<HTMLButtonElement>('restart-btn');
const endlessBtn = el<HTMLButtonElement>('endless-btn');
const menuBtn = el<HTMLButtonElement>('menu-btn');
const archiveBtn = el<HTMLButtonElement>('archive-btn');
const flashEl = el('flash');
const glitchEl = el('glitch-line');
const endGlyph = el<HTMLCanvasElement>('end-glyph');
const titleGlyph = el<HTMLCanvasElement>('glyph-canvas');
const toastStack = el('toast-stack');
const bossAlert = el('boss-alert');

initLang('ru');
const profile: Profile = loadProfile();

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
let tutorial: Tutorial | undefined;
let archive: Archive | undefined;
let speed = 1;
let endShown = false;
let topView = false;
let stopRain: (() => void) | null = null;
let flashTimer = 0;
let bossTimer = 0;
let bossShown = false;
let lastEnd: { won: boolean; record: RunRecord | null; unlocked: AchievementDef[] } | null = null;

sound.setEnabled(profile.sound);
applyAccent(profile);

const actions: HudActions = {
  startWave: () => {
    sound.init();
    game.startWave();
    tutorial?.update();
  },
  cycleSpeed: () => {
    speed = speed === 1 ? 2 : speed === 2 ? 3 : 1;
    hud?.setSpeed(speed);
  },
  toggleSound: () => {
    sound.init();
    sound.setEnabled(!sound.enabled);
    profile.sound = sound.enabled;
    saveProfileDebounced();
    hud?.setSound(sound.enabled);
  },
  toggleView: () => toggleTopView(),
  undo: () => game.undo(),
  upgrade: () => game.upgradeSelected(),
  sell: () => game.sellSelected(),
  move: () => game.beginMove(),
  chooseBranch: (branch) => game.chooseBranch(branch),
  setPriority: (priority) => {
    game.setPriority(priority);
    tutorial?.update();
  },
  massUpgrade: (kind) => game.upgradeAll(kind),
  massSell: (kind) => game.sellAll(kind),
  selectKind: (kind: TowerKind) => {
    sound.init();
    game.setKind(game.selectedKind === kind ? null : kind);
    tutorial?.update();
  },
};

const hooks: GameHooks = {
  log: (text, kind) => hud?.log(text, kind),
  phase: (phase: Phase) => {
    hud?.refresh(true);
    tutorial?.update();
    if (phase === 'lost') window.setTimeout(() => showEnd(false), 900);
    if (phase === 'won') window.setTimeout(() => showEnd(true), 1100);
  },
  coreHit: () => {
    flashScreen();
    hud?.alarm();
  },
  changed: () => {
    hud?.refresh();
    tutorial?.update();
  },
  sfx: (name) => sound.play(name),
  rewards: (options) => showRewards(options),
};

let saveTimer = 0;

function saveProfileDebounced(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => saveProfile(profile), 250);
}

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
  tutorial?.refresh();
}

function flashScreen(): void {
  flashEl.classList.add('on');
  glitchEl.classList.remove('on');
  void glitchEl.offsetWidth;
  glitchEl.classList.add('on');

  window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => flashEl.classList.remove('on'), 90);
}

function glitchScreen(screen: HTMLElement): void {
  screen.classList.remove('glitch-in');
  void screen.offsetWidth;
  screen.classList.add('glitch-in');
}

function toast(kicker: string, title: string, text: string): void {
  const node = document.createElement('div');
  node.className = 'toast';
  node.innerHTML = `<span>${kicker}</span><b>${title}</b><em>${text}</em>`;
  toastStack.appendChild(node);
  window.setTimeout(() => node.classList.add('out'), 4200);
  window.setTimeout(() => node.remove(), 4800);
  while (toastStack.children.length > 4) toastStack.firstElementChild?.remove();
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

  archive?.close();
  createGame(map, optionsFor(selection.mode, selection.difficulty));
  rewardScreen.hidden = true;
  endScreen.hidden = true;
  endShown = false;
  ui.hidden = false;
  bossShown = false;
  document.body.classList.remove('boss-mode');
  bossAlert.hidden = true;

  hud?.refresh(true);
  hud?.log(
    tf(L('АРЕНА {name} · {mode}', 'ARENA {name} · {mode}'), {
      name: def.name,
      mode: tr(MODE_NAMES[selection.mode]),
    }),
    'sys',
  );
  hud?.log(tf(L('VESSEL ONLINE: оператор подключён', 'VESSEL ONLINE: operator linked'), {}), 'ok');

  applyProfileVisuals();
  tutorial?.stop();

  if (!profile.tutorialDone && selection.mode === 'campaign') {
    tutorial?.start();
  }
}

function showEnd(won: boolean): void {
  if (endShown) return;
  endShown = true;
  tutorial?.stop();

  const minutes = Math.floor(game.time / 60);
  const seconds = Math.floor(game.time % 60);
  const endless = game.mode === 'endless' || game.mode === 'rogue';
  const reached = Math.max(1, game.stats.maxWave);

  const runRecord = applyRun(profile, {
    arena: map.def.id,
    mode: game.mode,
    difficulty: game.difficulty,
    wave: won ? TOTAL_WAVES : reached,
    kills: game.kills,
    leaks: game.stats.leaks,
    time: game.time,
    integrity: game.integrity,
    cappedIntegrity: game.integrityCap,
    won,
    killsByKind: { ...game.killsByKind },
    towerBuilds: { ...game.towerBuilds },
    branchIds: [...game.branchIds],
    rewards: game.stats.rewards,
    bossKills: game.stats.bossKills,
    shieldBreaks: game.stats.shieldBreaks,
    soldTowers: game.stats.soldTowers,
    peakTowers: game.stats.peakTowers,
    maxedTowers: game.stats.maxedTowers,
    peakMoney: game.stats.peakMoney,
    dataEarned: game.stats.dataEarned,
    perfectWaves: game.stats.perfectWaves,
  });

  const unlocked = evaluateAchievements(profile);
  saveProfile(profile);
  archive?.refresh();
  applyProfileVisuals();
  updateBestLine();

  lastEnd = { won, record: runRecord, unlocked };

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
  renderEndContent();
  endScreen.hidden = false;
  glitchScreen(endScreen);
  endlessBtn.hidden = endless;

  if (unlocked.length > 0) {
    for (const achievement of unlocked) {
      toast(
        tr(L('ДОСТИЖЕНИЕ', 'ACHIEVEMENT')),
        tr(achievement.name),
        tr(achievement.desc),
      );
    }
  }

  stopRain?.();
  stopRain = startGlyphRain(endGlyph);
}

function renderEndContent(): void {
  if (!lastEnd) return;
  const { won, record, unlocked } = lastEnd;
  const endless = game.mode === 'endless' || game.mode === 'rogue';

  el('end-kicker').textContent = won
    ? 'CONTAINMENT COMPLETE'
    : endless
      ? 'SIGNAL LOST: ENDLESS'
      : 'CONTAINMENT FAILED';
  el('end-title').textContent = won ? 'SIGNAL HELD' : 'SIGNAL LOST';
  el('end-text').textContent = won
    ? tf(
        L(
          '{waves} волн. Ядро цело. Он снова остался один — но в этот раз ты не отступил.',
          '{waves} waves. The core holds. It is alone again — but this time you did not retreat.',
        ),
        { waves: TOTAL_WAVES },
      )
    : endless
      ? tf(
          L(
            'Протокол оборван на волне {wave}. Дальше — только новый заход.',
            'The protocol ended on wave {wave}. Only a new run remains.',
          ),
          { wave: game.wave },
        )
      : tr(
          L(
            'VESSEL потерял целостность. Он снова остался один. Протокол можно перезапустить.',
            'VESSEL lost integrity. It is alone again. The protocol can be restarted.',
          ),
        );

  const recordNode = el('end-record');
  recordNode.innerHTML = record
    ? `<span>${tr(L('ЛУЧШИЙ ЗАБЕГ', 'BEST RUN'))}</span><b>W${record.wave
        .toString()
        .padStart(2, '0')}</b><em>${record.kills} ${tr(L('целей', 'kills'))} · ${formatTime(
        record.time,
      )}</em>`
    : '';

  const list = el('end-achievements');
  list.innerHTML = unlocked.length
    ? `<span>${tr(L('НОВЫЕ ДОСТИЖЕНИЯ', 'NEW ACHIEVEMENTS'))}</span>${unlocked
        .map((item) => `<b>${tr(item.name)}</b>`)
        .join('')}`
    : '';
}

function resetRun(options: GameOptions): void {
  if (stopRain) {
    stopRain();
    stopRain = null;
  }

  endScreen.hidden = true;
  endShown = false;
  lastEnd = null;
  topView = false;
  view.controls.minPolarAngle = 0.28;
  view.controls.maxPolarAngle = 1.22;

  game.dispose();
  view.effects.reset();
  view.setIntegrity(100);
  createGame(map, options);
  ui.hidden = false;
  bossShown = false;
  document.body.classList.remove('boss-mode');
  bossAlert.hidden = true;
  tutorial?.stop();

  hud?.refresh(true);
  hud?.log(tf(L('PROTOCOL RESTART: сброс сектора', 'PROTOCOL RESTART: sector reset'), {}));
  hud?.log(tf(L('VESSEL ONLINE: оператор подключён', 'VESSEL ONLINE: operator linked'), {}), 'ok');

  if (!profile.tutorialDone && options.mode === 'campaign') tutorial?.start();
}

function restart(): void {
  resetRun(optionsFor(game.mode, game.difficulty));
}

function startEndless(): void {
  resetRun(optionsFor('endless', game.difficulty));
  hud?.log(
    tf(L('ENDLESS PROTOCOL: волны не заканчиваются', 'ENDLESS PROTOCOL: the waves do not end'), {}),
    'warn',
  );
}

function showRewards(options: RewardDef[]): void {
  rewardCards.innerHTML = '';
  rewardCards.dataset.count = String(options.length);
  for (const reward of options) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `reward-card rarity-${reward.rarity}`;
    card.innerHTML = `
      <div class="reward-top">
        <span class="reward-rarity">${tr(RARITY_NAMES[reward.rarity] ?? RARITY_NAMES.common)}</span>
        <span class="reward-tag">${tr(reward.tag)}</span>
      </div>
      <b>${tr(reward.name)}</b>
      <em>${tr(reward.desc)}</em>`;
    card.addEventListener('click', () => {
      game.applyReward(reward.id);
      rewardScreen.hidden = true;
      hud?.refresh(true);
    });
    rewardCards.appendChild(card);
  }
  rewardScreen.hidden = false;
  glitchScreen(rewardScreen);
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
        updateBestLine();
      });
      box.appendChild(button);
    }
  };

  make(
    mapBox,
    MAPS.map((item) => ({ id: item.id, name: item.name, title: tr(item.sub) })),
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
    (['campaign', 'endless', 'rogue'] as ModeId[]).map((id) => ({
      id,
      name: tr(MODE_NAMES[id]),
      title: tr(MODE_HINTS[id]),
    })),
    selection.mode,
    (id) => {
      selection.mode = id as ModeId;
    },
  );

  make(
    diffBox,
    DIFFICULTIES.map((item) => ({ id: item.id, name: tr(item.name), title: tr(item.sub) })),
    selection.difficulty,
    (id) => {
      selection.difficulty = id as DifficultyId;
    },
  );
}

function updateBestLine(): void {
  const record = recordFor(profile, selection.mapId, selection.difficulty, selection.mode);
  const node = el('best-record');

  if (!record) {
    node.textContent = tr(L('рекордов на этом сочетании пока нет', 'no record for this setup yet'));
  } else {
    node.innerHTML = `<span>${tr(L('ЛУЧШИЙ ЗАБЕГ', 'BEST RUN'))}</span><b>W${record.wave
      .toString()
      .padStart(2, '0')}</b><em>${record.kills} ${tr(L('целей', 'kills'))} · ${formatTime(
      record.time,
    )}</em>`;
  }

  el('best-wave').textContent =
    profile.stats.bestWave > 0 ? `WAVE ${profile.stats.bestWave.toString().padStart(2, '0')}` : '—';
}

function applyProfileVisuals(): void {
  applyAccent(profile);
  const title = titleById(profile.title);
  el('brand-title').textContent = tr(title.name);
  document.body.dataset.accent = profile.accent;
  document.querySelectorAll<HTMLElement>('#lang-switch [data-lang]').forEach((button) => {
    button.classList.toggle('on', button.dataset.lang === initLangGet());
  });
  hud?.setSound(sound.enabled);
}

function initLangGet(): Lang {
  return document.documentElement.lang === 'en' ? 'en' : 'ru';
}

function syncArchive(): void {
  archive?.refresh();
}

function openArchive(): void {
  archive?.open('achievements');
  archive?.refresh();
}

function closeArchive(): void {
  archive?.close();
  updateBestLine();
}

function switchLang(lang: Lang): void {
  setLang(lang);
  saveProfileDebounced();
  applyProfileVisuals();
  buildSelectors();
  updateBestLine();
  hud?.refresh(true);
  tutorial?.refresh();
  syncArchive();
  if (endShown) renderEndContent();
}

startBtn.addEventListener('click', startRun);
restartBtn.addEventListener('click', restart);
endlessBtn.addEventListener('click', startEndless);
menuBtn.addEventListener('click', () => window.location.reload());
archiveBtn.addEventListener('click', openArchive);

document.querySelectorAll<HTMLButtonElement>('#lang-switch [data-lang]').forEach((button) => {
  button.addEventListener('click', () => switchLang(button.dataset.lang === 'en' ? 'en' : 'ru'));
});

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

  if (!cell || titleScreen.hidden === false || endShown || archive?.isOpen) {
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
  if (!titleScreen.hidden || endShown || archive?.isOpen) return;

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
  if (archive?.isOpen) {
    if (event.code === 'Escape') closeArchive();
    return;
  }

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
      tutorial?.update();
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

archive = new Archive(profile, () => {
  saveProfileDebounced();
  applyProfileVisuals();
}, closeArchive);

tutorial = new Tutorial(
  () => game,
  () => {
    profile.tutorialDone = true;
    saveProfileDebounced();
    toast(
      tr(L('ОБУЧЕНИЕ', 'TUTORIAL')),
      tr(L('ОПЕРАТОР ГОТОВ', 'OPERATOR READY')),
      tr(L('Подсказки больше не появятся.', 'Hints will not appear again.')),
    );
  },
);

stopRain = startGlyphRain(titleGlyph);
updateBestLine();
applyProfileVisuals();

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

  const bossAlive = game.bossActive;
  updateBossPresentation(bossAlive);

  sound.setIntensity(game.phase === 'wave' ? (bossAlive ? 1 : 0.75) : 0.3);

  view.setIntegrity(game.integrity);
  hud?.refresh();
  view.render(dt);
  requestAnimationFrame(frame);
}

function updateBossPresentation(alive: boolean): void {
  if (alive && !bossShown) {
    bossShown = true;
    document.body.classList.add('boss-mode');
    bossAlert.hidden = false;
    bossAlert.classList.remove('ping');
    void bossAlert.offsetWidth;
    bossAlert.classList.add('ping');
    window.clearTimeout(bossTimer);
    bossTimer = window.setTimeout(() => {
      bossAlert.hidden = true;
    }, 3600);
    view.effects.addShake(0.3);
  }

  if (!alive && bossShown) {
    bossShown = false;
    document.body.classList.remove('boss-mode');
    bossAlert.hidden = true;
  }
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${rest.toString().padStart(2, '0')}`;
}

requestAnimationFrame(frame);

if (import.meta.env.DEV) {
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
      profile,
      archive,
      tutorial,
      start: startRun,
      restart,
      end: showEnd,
      toggleTopView,
      setLang: switchLang,
      advance(seconds: number) {
        let remaining = seconds;
        while (remaining > 0) {
          const step = Math.min(remaining, 1 / 60);
          game.update(step);
          remaining -= step;
        }
        hud?.refresh(true);
        tutorial?.update();
      },
    },
  });
}

