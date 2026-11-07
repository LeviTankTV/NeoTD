import * as THREE from 'three';
import { COLORS, GRID, TILE } from '../game/constants';
import { GameMap } from '../game/map';
import { createCoreModel, type CoreModel } from './models';

export interface Arena {
  group: THREE.Group;
  core: CoreModel;
  update(dt: number, time: number, integrity: number): void;
}

const ARENA_ACCENT: Record<string, number> = {
  'sector-07': COLORS.red,
  crossfire: COLORS.red,
  well: COLORS.amber,
  'twin-gate': COLORS.cyan,
  'split-signal': COLORS.violet,
};

function ribbon(points: THREE.Vector3[], width: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const half = width / 2;

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const previous = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz) || 1;
    const px = (-dz / length) * half;
    const pz = (dx / length) * half;

    positions.push(current.x + px, current.y, current.z + pz);
    positions.push(current.x - px, current.y, current.z - pz);

    if (i < points.length - 1) {
      const base = i * 2;
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

export function buildArena(map: GameMap): Arena {
  const group = new THREE.Group();
  const accent = ARENA_ACCENT[map.def.id] ?? COLORS.red;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({ color: 0x04070d, roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  const grid = new THREE.GridHelper(240, 120, 0x0d1a2e, 0x091120);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.5;
  grid.position.y = 0.015;
  group.add(grid);

  const tileGeometry = new THREE.BoxGeometry(TILE * 0.945, 0.12, TILE * 0.945);
  const pathMaterial = new THREE.MeshStandardMaterial({
    color: 0x120810,
    emissive: accent,
    emissiveIntensity: 0.28,
    roughness: 0.85,
    metalness: 0.15,
  });
  const buildMaterial = new THREE.MeshStandardMaterial({
    color: 0x0c1728,
    emissive: 0x1a3554,
    emissiveIntensity: 0.45,
    roughness: 0.9,
    metalness: 0.1,
  });

  const pathCells = [...map.pathCells]
    .map((key) => key.split(',').map(Number))
    .filter(([x, z]) => x >= 0 && z >= 0 && x < GRID && z < GRID);
  const buildCells = map.buildable;

  const pathTiles = new THREE.InstancedMesh(tileGeometry, pathMaterial, pathCells.length);
  const buildTiles = new THREE.InstancedMesh(tileGeometry, buildMaterial, buildCells.length);

  const matrix = new THREE.Matrix4();
  pathCells.forEach(([x, z], index) => {
    const center = map.cellCenter(x, z);
    matrix.makeTranslation(center.x, 0.06, center.z);
    pathTiles.setMatrixAt(index, matrix);
  });
  buildCells.forEach((cell, index) => {
    const center = map.cellCenter(cell.x, cell.z);
    matrix.makeTranslation(center.x, 0.045, center.z);
    buildTiles.setMatrixAt(index, matrix);
  });
  pathTiles.instanceMatrix.needsUpdate = true;
  buildTiles.instanceMatrix.needsUpdate = true;
  group.add(pathTiles, buildTiles);

  const routes = map.routes.map((route) => {
    const mesh = new THREE.Mesh(
      ribbon(
        route.waypoints.map((point) => new THREE.Vector3(point.x, 0.14, point.z)),
        0.15,
      ),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    group.add(mesh);
    return mesh;
  });

  const chevrons: THREE.Mesh[] = [];
  const chevronGeometry = new THREE.BufferGeometry();
  chevronGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.22, 0, -0.1, 0.22, 0, -0.1, 0, 0, 0.3], 3),
  );
  chevronGeometry.setIndex([0, 1, 2]);
  chevronGeometry.computeVertexNormals();

  const perRoute = 14;
  for (let r = 0; r < map.routeCount; r++) {
    for (let i = 0; i < perRoute; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const chevron = new THREE.Mesh(chevronGeometry, material);
      chevron.userData.route = r;
      chevron.userData.offset = i / perRoute;
      group.add(chevron);
      chevrons.push(chevron);
    }
  }

  const dustCount = 700;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 190;
    dustPositions[i * 3 + 1] = Math.random() * 30;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 190;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: 0x2e4c78,
      size: 0.1,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(dust);

  const half = (GRID * TILE) / 2;

  const debrisGeometry = new THREE.BoxGeometry(1, 1, 1);
  const debrisMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a1424,
    emissive: accent,
    emissiveIntensity: 0.12,
    roughness: 0.95,
    metalness: 0.2,
  });
  const debrisCount = 70;
  const debris = new THREE.InstancedMesh(debrisGeometry, debrisMaterial, debrisCount);
  for (let i = 0; i < debrisCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = half + 3 + Math.random() * 26;
    const size = 0.4 + Math.random() * 2.6;
    matrix.compose(
      new THREE.Vector3(Math.cos(angle) * radius, size * 0.25 - 0.2, Math.sin(angle) * radius),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4),
      ),
      new THREE.Vector3(size, size * 0.5, size),
    );
    debris.setMatrixAt(i, matrix);
  }
  debris.instanceMatrix.needsUpdate = true;
  group.add(debris);

  const pylonMaterial = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pylonGeometry = new THREE.CylinderGeometry(0.045, 0.045, 9, 5, 1, true);
  const pylons: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const pylon = new THREE.Mesh(pylonGeometry, pylonMaterial);
    pylon.position.set(Math.cos(angle) * (half - 1), 4.5, Math.sin(angle) * (half - 1));
    group.add(pylon);
    pylons.push(pylon);
  }

  const cage = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(half * 2, 7, half * 2)),
    new THREE.LineBasicMaterial({ color: COLORS.mint2, transparent: true, opacity: 0.22 }),
  );
  cage.position.y = 3.5;
  group.add(cage);

  const frame = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-half, 0.05, -half),
      new THREE.Vector3(half, 0.05, -half),
      new THREE.Vector3(half, 0.05, half),
      new THREE.Vector3(-half, 0.05, half),
    ]),
    new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.3 }),
  );
  group.add(frame);

  const core = createCoreModel();
  core.group.position.set(map.core.x, 0.12, map.core.z);
  group.add(core.group);

  const cool = new THREE.Color(COLORS.mint);
  const hot = new THREE.Color(COLORS.red);
  const current = new THREE.Color();
  const baseOpacity = (pylonMaterial as THREE.MeshBasicMaterial).opacity;

  return {
    group,
    core,
    update(dt: number, time: number, integrity: number) {
      const ratio = Math.max(0, Math.min(1, integrity / 100));

      core.rings[0].rotation.z += dt * 0.5;
      core.rings[1].rotation.y += dt * -0.7;
      core.core.rotation.y += dt * 0.4;
      core.core.rotation.x += dt * 0.15;

      const pulse = 1 + Math.sin(time * 2.2) * 0.06;
      core.core.scale.setScalar(pulse * (0.9 + ratio * 0.2));
      core.light.intensity = 2.6 + Math.sin(time * 3) * 1.1 + ratio * 2.4;

      current.copy(hot).lerp(cool, ratio);
      const coreMaterial = core.core.material as THREE.MeshStandardMaterial;
      coreMaterial.emissive.copy(current);
      core.light.color.copy(current);

      chevrons.forEach((chevron) => {
        const routeIndex = Number(chevron.userData.route ?? 0);
        const route = map.route(routeIndex);
        const offset = (time * 8 + Number(chevron.userData.offset ?? 0) * route.length) % route.length;
        const sample = route.sample(offset);
        chevron.position.set(sample.x, 0.17, sample.z);
        chevron.rotation.y = Math.atan2(sample.dx, sample.dz);
        const material = chevron.material as THREE.MeshBasicMaterial;
        material.opacity = 0.12 + 0.7 * Math.abs(Math.sin(offset * 0.35));
      });

      routes.forEach((route, index) => {
        const material = route.material as THREE.MeshBasicMaterial;
        material.opacity = 0.32 + 0.18 * Math.sin(time * 1.6 + index);
      });

      pylonMaterial.opacity = baseOpacity * (0.6 + 0.4 * Math.abs(Math.sin(time * 0.9)));

      dust.rotation.y += dt * 0.006;
    },
  };
}
