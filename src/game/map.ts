import { CORE_CELL, GRID, GRID_HALF, PATH_CELLS, TILE } from './constants';

export interface Point {
  x: number;
  z: number;
}

interface Segment {
  a: Point;
  b: Point;
  start: number;
  length: number;
  dx: number;
  dz: number;
}

export interface PathSample extends Point {
  dx: number;
  dz: number;
}

export class GameMap {
  readonly pathCells = new Set<string>();
  readonly waypoints: Point[] = [];
  readonly core: Point;
  readonly spawnPoint: Point;
  readonly buildable: Point[] = [];
  readonly totalLength: number;
  private readonly segments: Segment[] = [];

  constructor() {
    for (let i = 0; i < PATH_CELLS.length - 1; i++) {
      const [ax, az] = PATH_CELLS[i];
      const [bx, bz] = PATH_CELLS[i + 1];
      const sx = Math.sign(bx - ax);
      const sz = Math.sign(bz - az);

      let x = ax;
      let z = az;
      this.pathCells.add(`${x},${z}`);

      while (x !== bx || z !== bz) {
        x += sx;
        z += sz;
        this.pathCells.add(`${x},${z}`);
      }
    }

    for (const [x, z] of PATH_CELLS) {
      this.waypoints.push(this.cellCenter(x, z));
    }

    let cursor = 0;
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const a = this.waypoints[i];
      const b = this.waypoints[i + 1];
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      this.segments.push({
        a,
        b,
        start: cursor,
        length,
        dx: (b.x - a.x) / length,
        dz: (b.z - a.z) / length,
      });
      cursor += length;
    }

    this.totalLength = cursor;
    this.core = this.cellCenter(CORE_CELL[0], CORE_CELL[1]);
    this.spawnPoint = this.waypoints[0];

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        if (this.isBuildable(x, z)) this.buildable.push({ x, z });
      }
    }
  }

  cellCenter(x: number, z: number): Point {
    return { x: (x - GRID_HALF) * TILE, z: (z - GRID_HALF) * TILE };
  }

  worldToCell(x: number, z: number): Point | null {
    const gx = Math.round(x / TILE + GRID_HALF);
    const gz = Math.round(z / TILE + GRID_HALF);
    if (gx < 0 || gz < 0 || gx >= GRID || gz >= GRID) return null;
    return { x: gx, z: gz };
  }

  isPath(x: number, z: number): boolean {
    return this.pathCells.has(`${x},${z}`);
  }

  isBuildable(x: number, z: number): boolean {
    if (x < 0 || z < 0 || x >= GRID || z >= GRID) return false;
    if (this.isPath(x, z)) return false;
    if (Math.abs(x - CORE_CELL[0]) <= 1 && Math.abs(z - CORE_CELL[1]) <= 1) return false;
    return true;
  }

  /** Позиция и направление на маршруте по пройденной дистанции. */
  sample(distance: number): PathSample {
    const clamped = Math.max(0, Math.min(distance, this.totalLength - 0.0001));
    let segment = this.segments[this.segments.length - 1];

    for (const candidate of this.segments) {
      if (clamped <= candidate.start + candidate.length) {
        segment = candidate;
        break;
      }
    }

    const t = Math.min(1, Math.max(0, (clamped - segment.start) / segment.length));
    return {
      x: segment.a.x + (segment.b.x - segment.a.x) * t,
      z: segment.a.z + (segment.b.z - segment.a.z) * t,
      dx: segment.dx,
      dz: segment.dz,
    };
  }
}
