import * as THREE from 'three';
import { COLORS } from '../game/constants';
import type { EnemyKind, TowerKind } from '../game/types';

export interface TowerModel {
  group: THREE.Group;
  head: THREE.Object3D | null;
  aura: THREE.Object3D | null;
}

export interface EnemyModel {
  group: THREE.Group;
  bar: THREE.Sprite;
  barFill: THREE.Sprite;
}

const metal = (color: number, emissive = 0x000000, intensity = 0.4): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    metalness: 0.55,
    roughness: 0.42,
    flatShading: true,
  });

const glow = (color: number, intensity = 1.6): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color: 0x05070d,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.2,
    roughness: 0.6,
    flatShading: true,
  });

function baseRing(radius: number, color: number, y: number): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.022, 6, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = y;
  return ring;
}

function towerBase(color: number): THREE.Group {
  const group = new THREE.Group();

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.16, 6), metal(0x0a1220, color, 0.12));
  base.position.y = 0.08;
  group.add(base);

  const ring = baseRing(0.74, color, 0.19);
  const ringMat = ring.material as THREE.MeshBasicMaterial;
  ringMat.opacity = 0.75;
  group.add(ring);

  const glowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.86, 24),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glowDisc.rotation.x = -Math.PI / 2;
  glowDisc.position.y = 0.02;
  group.add(glowDisc);

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.46), metal(0x0c1422, color, 0.22));
  plinth.position.y = 0.32;
  group.add(plinth);

  return group;
}

function makeBar(color: number, width: number): { bar: THREE.Sprite; fill: THREE.Sprite } {
  const bgMat = new THREE.SpriteMaterial({ color: 0x0a0d15, transparent: true, opacity: 0.85, depthWrite: false });
  const bar = new THREE.Sprite(bgMat);
  bar.scale.set(width, width * 0.1, 1);

  const fillMat = new THREE.SpriteMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });
  const fill = new THREE.Sprite(fillMat);
  fill.scale.set(width, width * 0.075, 1);

  return { bar, fill };
}

export function createTowerModel(kind: TowerKind): TowerModel {
  const def = kind;
  const group = towerBase(0x9cc9ff);
  let head: THREE.Object3D | null = null;
  let aura: THREE.Object3D | null = null;
  let color = COLORS.mint;

  if (def === 'sentry') {
    color = COLORS.mint;
    head = new THREE.Group();
    head.position.y = 0.78;

    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.54), metal(0x18263c, color, 0.55));
    head.add(shell);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), glow(color, 2.4));
    eye.position.set(0, 0.16, 0.05);
    head.add(eye);

    for (const offset of [-0.15, 0.15]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.84, 6), metal(0x22334c, color, 0.3));
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(offset, 0, 0.52);
      head.add(barrel);

      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), glow(color, 2.2));
      tip.position.set(offset, 0, 0.93);
      head.add(tip);
    }

    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.3, 6), metal(0x0d1624));
    strut.position.y = 0.62;
    group.add(strut);
    group.add(head);
  }

  if (def === 'pulse') {
    color = COLORS.amber;
    head = new THREE.Group();
    head.position.y = 0.68;

    const ringA = new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.035, 6, 32),
      new THREE.MeshStandardMaterial({ color: 0x0a0d15, emissive: color, emissiveIntensity: 1.7, flatShading: true }),
    );
    ringA.rotation.x = Math.PI / 2;
    head.add(ringA);

    const ringB = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.028, 6, 28),
      new THREE.MeshStandardMaterial({ color: 0x0a0d15, emissive: color, emissiveIntensity: 1.3, flatShading: true }),
    );
    ringB.rotation.x = Math.PI / 2;
    ringB.rotation.y = 0.6;
    ringB.position.y = 0.22;
    head.add(ringB);

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), glow(color, 2.6));
    core.position.y = 0.18;
    head.add(core);

    group.add(head);
  }

  if (def === 'snare') {
    color = COLORS.green;
    head = new THREE.Group();
    head.position.y = 1.02;

    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), glow(color, 1.8));
    head.add(crystal);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.44, 0.018, 4, 30),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 }),
    );
    halo.rotation.x = Math.PI / 2.2;
    head.add(halo);

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 0.72, 5), metal(0x0c1620, color, 0.35));
    pillar.position.y = -0.4;
    group.add(pillar);
    group.add(head);

    aura = new THREE.Group();
    aura.position.y = 0.16;
    aura.visible = false;

    const edge = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.012, 4, 72),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    edge.rotation.x = -Math.PI / 2;
    aura.add(edge);

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.016,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    aura.add(shell);

    group.add(aura);
  }

  if (def === 'rail') {
    color = 0xdce9ff;
    head = new THREE.Group();
    head.position.y = 0.95;

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.7, 6), metal(0x0e1728, color, 0.25));
    mast.position.y = -0.42;
    group.add(mast);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 1.9), metal(0x19273d, color, 0.4));
    body.position.z = 0.55;
    head.add(body);

    for (const offset of [-0.14, 0.14]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 1.9), glow(COLORS.mint, 0.7));
      rail.position.set(offset, 0.14, 0.55);
      head.add(rail);
    }

    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.06, 0.24, 8), glow(color, 2.2));
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.z = 1.6;
    head.add(muzzle);

    group.add(head);
  }

  return { group, head, aura };
}

export function applyTowerLevel(model: TowerModel, level: number, color: number): void {
  const existing = model.group.getObjectByName('level-marks');
  if (existing) {
    disposeGroup(existing);
    model.group.remove(existing);
  }

  const marks = new THREE.Group();
  marks.name = 'level-marks';

  for (let i = 0; i < level - 1; i++) {
    const angle = (i / 2) * Math.PI * 2 + Math.PI / 4;
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.05, 0.2),
      new THREE.MeshBasicMaterial({ color }),
    );
    mark.position.set(Math.cos(angle) * 0.62, 0.1, Math.sin(angle) * 0.62);
    mark.rotation.y = -angle;
    marks.add(mark);
  }

  model.group.add(marks);
}

export function createEnemyModel(kind: EnemyKind): EnemyModel {
  const group = new THREE.Group();

  if (kind === 'fragment') {
    const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.52, 0), glow(COLORS.red, 1.5));
    group.add(shard);

    const wire = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.56, 0),
      new THREE.MeshBasicMaterial({ color: COLORS.red, wireframe: true, transparent: true, opacity: 0.55 }),
    );
    group.add(wire);
  }

  if (kind === 'glitch') {
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.44, 0), glow(0xff6b7f, 1.8));
    group.add(shard);

    for (let i = 0; i < 3; i++) {
      const chip = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.12, 0),
        new THREE.MeshBasicMaterial({ color: COLORS.mint, transparent: true, opacity: 0.7 }),
      );
      chip.position.set(Math.cos(i * 2.1) * 0.55, Math.sin(i * 1.7) * 0.35, Math.sin(i * 2.1) * 0.55);
      chip.name = `chip-${i}`;
      group.add(chip);
    }
  }

  if (kind === 'gate') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), metal(0x1a0a12, COLORS.red, 0.55));
    group.add(box);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.98, 0.98, 0.98)),
      new THREE.LineBasicMaterial({ color: COLORS.red, transparent: true, opacity: 0.85 }),
    );
    group.add(edges);

    const core = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), glow(COLORS.red, 2.4));
    core.name = 'gate-core';
    group.add(core);
  }

  if (kind === 'face') {
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), metal(0x160812, COLORS.red, 0.9));
    group.add(head);

    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.0, 1),
      new THREE.MeshBasicMaterial({ color: COLORS.red, wireframe: true, transparent: true, opacity: 0.22 }),
    );
    group.add(shell);

    for (const offset of [-0.3, 0.3]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xf3f7ff }));
      eye.position.set(offset, 0.14, 0.72);
      group.add(eye);
    }

    const crown = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.035, 6, 48),
      new THREE.MeshBasicMaterial({ color: COLORS.red, transparent: true, opacity: 0.65 }),
    );
    crown.rotation.x = Math.PI / 2.4;
    crown.name = 'crown';
    group.add(crown);
  }

  const barWidth = kind === 'face' ? 2.2 : kind === 'gate' ? 1.25 : 0.85;
  const { bar, fill } = makeBar(kind === 'face' ? COLORS.amber : COLORS.red, barWidth);
  bar.position.y = 1.16;
  fill.position.y = 1.16;
  bar.renderOrder = 5;
  fill.renderOrder = 6;
  group.add(bar, fill);

  return { group, bar, barFill: fill };
}

export interface CoreModel {
  group: THREE.Group;
  core: THREE.Mesh;
  rings: THREE.Mesh[];
  light: THREE.PointLight;
}

export function createCoreModel(): CoreModel {
  const group = new THREE.Group();

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.7, 0.3, 8),
    metal(0x0a1018, COLORS.red, 0.22),
  );
  platform.position.y = 0.15;
  group.add(platform);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(2.35, 0.03, 6, 64),
    new THREE.MeshBasicMaterial({ color: COLORS.red, transparent: true, opacity: 0.55 }),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.31;
  group.add(rim);

  const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), glow(COLORS.mint, 1.15));
  core.position.y = 1.5;
  group.add(core);

  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.05 + i * 0.32, 0.028, 6, 64),
      new THREE.MeshBasicMaterial({ color: i === 0 ? COLORS.mint : COLORS.red, transparent: true, opacity: 0.75 }),
    );
    ring.position.y = 1.5;
    ring.rotation.x = i === 0 ? Math.PI / 2.6 : 1.1;
    ring.rotation.z = i === 0 ? 0.4 : -0.7;
    group.add(ring);
    rings.push(ring);
  }

  const light = new THREE.PointLight(COLORS.mint, 4, 14, 2);
  light.position.y = 1.6;
  group.add(light);

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const pylon = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.5, 0.16),
      metal(0x0d1524, COLORS.mint, 0.3),
    );
    pylon.position.set(Math.cos(angle) * 1.9, 0.4, Math.sin(angle) * 1.9);
    group.add(pylon);
  }

  return { group, core, rings, light };
}

/** Подсветка клетки под курсором и кольцо радиуса. */
export class CellHighlight {
  readonly group = new THREE.Group();
  private readonly box: THREE.LineSegments;
  private readonly ring: THREE.LineLoop;

  constructor() {
    this.box = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.86, 0.24, 1.86)),
      new THREE.LineBasicMaterial({ color: COLORS.mint, transparent: true, opacity: 0.8 }),
    );
    this.group.add(this.box);

    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
    }
    this.ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: COLORS.mint, transparent: true, opacity: 0.35 }),
    );
    this.ring.rotation.x = 0;
    this.ring.position.y = 0.02;
    this.ring.visible = false;
    this.group.add(this.ring);

    this.group.visible = false;
  }

  setColor(color: number): void {
    (this.box.material as THREE.LineBasicMaterial).color.setHex(color);
    (this.ring.material as THREE.LineBasicMaterial).color.setHex(color);
  }

  show(x: number, z: number, valid: boolean, range?: number): void {
    this.group.visible = true;
    this.group.position.set(x, 0.13, z);
    this.setColor(valid ? COLORS.mint : COLORS.red);
    this.ring.visible = Boolean(range && range > 0);
    if (range) this.ring.scale.setScalar(range);
  }

  hide(): void {
    this.group.visible = false;
  }
}

export function disposeGroup(group: THREE.Object3D): void {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.LineLoop) {
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material.dispose();
    }
    if (object instanceof THREE.Sprite) {
      object.material.dispose();
      object.geometry.dispose();
    }
  });
}
