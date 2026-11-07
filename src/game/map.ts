import { GRID, GRID_HALF, MAPS, TILE, type MapDef } from './constants';

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

export class Route {
  readonly waypoints: Point[] = [];
  readonly pathCells = new Set<string>();
  readonly spawnPoint: Point;
  readonly length: number;
  readonly index: number;
  private readonly segments: Segment[] = [];

  constructor(path: Array<[number, number]>, index: number) {
    this.index = index;

    for (let i = 0; i < path.length - 1; i++) {
      const [ax, az] = path[i];
      const [bx, bz] = path[i + 1];
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

    for (const [x, z] of path) {
      this.waypoints.push({ x: cellX(x), z: cellZ(z) });
    }

    let cursor = 0;
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const a = this.waypoints[i];
      const b = this.waypoints[i + 1];
      const segmentLength = Math.hypot(b.x - a.x, b.z - a.z) || 0.0001;
      this.segments.push({
        a,
        b,
        start: cursor,
        length: segmentLength,
        dx: (b.x - a.x) / segmentLength,
        dz: (b.z - a.z) / segmentLength,
      });
      cursor += segmentLength;
    }

    this.length = cursor;
    this.spawnPoint = this.waypoints[0];
  }

  sample(distance: number): PathSample {
    const clamped = Math.max(0, Math.min(distance, this.length - 0.0001));
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

export class GameMap {
  readonly routes: Route[];
  readonly pathCells = new Set<string>();
  readonly buildable: Point[] = [];
  readonly core: Point;

  constructor(readonly def: MapDef = MAPS[0]) {
    this.routes = def.paths.map((path, index) => new Route(path, index));

    for (const route of this.routes) {
      for (const key of route.pathCells) this.pathCells.add(key);
    }

    this.core = { x: cellX(def.core[0]), z: cellZ(def.core[1]) };

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        if (this.isBuildable(x, z)) this.buildable.push({ x, z });
      }
    }
  }

  get routeCount(): number {
    return this.routes.length;
  }

  route(index: number): Route {
    return this.routes[Math.max(0, Math.min(index, this.routes.length - 1))];
  }

  sample(routeIndex: number, distance: number): PathSample {
    return this.route(routeIndex).sample(distance);
  }

  cellCenter(x: number, z: number): Point {
    return { x: cellX(x), z: cellZ(z) };
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
    if (Math.abs(x - this.def.core[0]) <= 1 && Math.abs(z - this.def.core[1]) <= 1) return false;
    return true;
  }
}

function cellX(x: number): number {
  return (x - GRID_HALF) * TILE;
}

function cellZ(z: number): number {
  return (z - GRID_HALF) * TILE;
}
