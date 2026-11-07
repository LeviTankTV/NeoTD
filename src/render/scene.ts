import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { COLORS } from '../game/constants';
import type { GameMap } from '../game/map';
import { Effects } from './effects';
import { disposeGroup } from './models';
import { buildArena, type Arena } from './world';

export class SceneView {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly composer: EffectComposer;
  readonly effects: Effects;
  arena: Arena;

  private integrity = 100;
  private clock = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    map: GameMap,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setClearColor(COLORS.bg);

    this.scene.background = new THREE.Color(COLORS.bg);
    this.scene.fog = new THREE.FogExp2(COLORS.bg, 0.0165);

    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 400);
    this.camera.position.set(20, 23, 27);
    this.camera.lookAt(0, 0, 2.5);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0.4, 2.5);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 18;
    this.controls.maxDistance = 54;
    this.controls.minPolarAngle = 0.28;
    this.controls.maxPolarAngle = 1.22;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.7;

    this.scene.add(new THREE.HemisphereLight(0x27406b, 0x03050c, 1.15));

    const key = new THREE.DirectionalLight(0xbcd4ff, 1.5);
    key.position.set(14, 26, 10);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(COLORS.red, 0.85);
    rim.position.set(-16, 9, -12);
    this.scene.add(rim);

    this.arena = buildArena(map);
    this.scene.add(this.arena.group);

    this.effects = new Effects(this.scene);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.58, 0.7, 0.42));
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setMap(map: GameMap): void {
    this.scene.remove(this.arena.group);
    disposeGroup(this.arena.group);
    this.arena = buildArena(map);
    this.scene.add(this.arena.group);
    this.effects.reset();
  }

  resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    this.camera.aspect = aspect;
    const horizontal = THREE.MathUtils.degToRad(58);
    const vertical = 2 * Math.atan(Math.tan(horizontal / 2) / aspect);
    this.camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vertical), 32, 76);
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
  }

  setIntegrity(value: number): void {
    this.integrity = value;
  }

  render(dt: number): void {
    this.clock += dt;
    this.controls.update();
    this.arena.update(dt, this.clock, this.integrity);
    this.effects.update(dt);

    const shake = this.effects.getShakeOffset();
    this.camera.position.x += shake.x;
    this.camera.position.y += shake.y;

    this.composer.render();

    this.camera.position.x -= shake.x;
    this.camera.position.y -= shake.y;
  }

  get canvasElement(): HTMLCanvasElement {
    return this.canvas;
  }
}
