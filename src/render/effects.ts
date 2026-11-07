import * as THREE from 'three';

interface EffectItem {
  object: THREE.Object3D;
  life: number;
  maxLife: number;
  tick: (progress: number) => void;
  dispose: () => void;
}

const UP = new THREE.Vector3(0, 1, 0);

export class Effects {
  private readonly items: EffectItem[] = [];
  shake = 0;

  constructor(private readonly scene: THREE.Scene) {}

  private add(item: EffectItem): void {
    this.scene.add(item.object);
    this.items.push(item);
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3, color: number, width = 0.055, life = 0.16): void {
    const direction = new THREE.Vector3().subVectors(to, from);
    const length = direction.length();
    if (length < 0.001) return;

    const geometry = new THREE.CylinderGeometry(width, width * 0.6, 1, 5, 1, true);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(from).addScaledVector(direction, 0.5);
    mesh.scale.y = length;
    mesh.quaternion.setFromUnitVectors(UP, direction.clone().normalize());

    this.add({
      object: mesh,
      life,
      maxLife: life,
      tick: (p) => {
        material.opacity = 0.95 * (1 - p);
      },
      dispose: () => {
        geometry.dispose();
        material.dispose();
      },
    });
  }

  ring(position: THREE.Vector3, color: number, maxRadius: number, duration = 0.55): void {
    const geometry = new THREE.RingGeometry(0.82, 1, 48);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(position);
    mesh.position.y = Math.max(0.2, position.y);

    this.add({
      object: mesh,
      life: duration,
      maxLife: duration,
      tick: (p) => {
        const scale = 0.4 + p * maxRadius;
        mesh.scale.setScalar(scale);
        material.opacity = 0.8 * (1 - p) * (1 - p);
      },
      dispose: () => {
        geometry.dispose();
        material.dispose();
      },
    });
  }

  burst(position: THREE.Vector3, color: number, count = 12, speed = 4, life = 0.6): void {
    const positions = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const magnitude = speed * (0.35 + Math.random() * 0.85);
      velocities.push(
        new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * magnitude,
          Math.abs(Math.cos(phi)) * magnitude * 0.9 + 1.2,
          Math.sin(phi) * Math.sin(theta) * magnitude,
        ),
      );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size: 0.13,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);

    let elapsed = 0;
    this.add({
      object: points,
      life,
      maxLife: life,
      tick: (p) => {
        const dt = Math.min(0.05, this.lastDt);
        elapsed += dt;
        const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < count; i++) {
          const v = velocities[i];
          v.y -= 9 * dt;
          attr.setXYZ(i, attr.getX(i) + v.x * dt, attr.getY(i) + v.y * dt, attr.getZ(i) + v.z * dt);
        }
        attr.needsUpdate = true;
        material.opacity = 1 - p;
        material.size = 0.13 * (1 + elapsed * 0.6);
      },
      dispose: () => {
        geometry.dispose();
        material.dispose();
      },
    });
  }

  /** Разлетающиеся обломки-линии для «стирания» врага. */
  shards(position: THREE.Vector3, color: number, count = 8): void {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
    const pieces: THREE.Mesh[] = [];
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      const geometry = new THREE.BoxGeometry(0.06, 0.06, 0.3 + Math.random() * 0.3);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      pieces.push(mesh);
      velocities.push(new THREE.Vector3((Math.random() - 0.5) * 5, 1 + Math.random() * 3, (Math.random() - 0.5) * 5));
      group.add(mesh);
    }

    this.lastDt = 0.016;
    this.add({
      object: group,
      life: 0.8,
      maxLife: 0.8,
      tick: (p) => {
        const dt = Math.min(0.05, this.lastDt);
        pieces.forEach((piece, i) => {
          const v = velocities[i];
          v.y -= 8 * dt;
          piece.position.addScaledVector(v, dt);
          piece.rotation.x += dt * 4;
          piece.rotation.y += dt * 3;
        });
        material.opacity = 0.9 * (1 - p);
      },
      dispose: () => {
        pieces.forEach((piece) => piece.geometry.dispose());
        material.dispose();
      },
    });
  }

  addShake(amount: number): void {
    this.shake = Math.min(0.6, this.shake + amount);
  }

  private lastDt = 0.016;

  update(dt: number): void {
    this.lastDt = dt;
    this.shake = Math.max(0, this.shake - dt * 1.8);

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.life -= dt;
      const progress = 1 - Math.max(0, item.life) / item.maxLife;
      item.tick(progress);

      if (item.life <= 0) {
        this.scene.remove(item.object);
        item.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  getShakeOffset(): { x: number; y: number } {
    if (this.shake <= 0) return { x: 0, y: 0 };
    const magnitude = this.shake * 0.22;
    return {
      x: (Math.random() - 0.5) * magnitude,
      y: (Math.random() - 0.5) * magnitude,
    };
  }

  reset(): void {
    for (const item of this.items) {
      this.scene.remove(item.object);
      item.dispose();
    }
    this.items.length = 0;
    this.shake = 0;
  }
}
