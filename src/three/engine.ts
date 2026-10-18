import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {
  clamp,
  lerp,
  styleByKey,
  type CameraMode,
  type DesignSpec,
  type ExperienceSettings,
  type LiveFeature,
  type MaterialParams,
  type QualityTier,
  type StyleKey,
} from '../types';
import { createArchitecture, type Architecture } from './architecture';
import { makeMaterialBundle, type MaterialBundle } from './materials';
import {
  createAtmosphereMaterial,
  createCoreMaterial,
  createFloorMaterial,
  createShaftMaterial,
  GradeShader,
} from './shaders';

interface CameraTween {
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  start: number;
  duration: number;
}

const DEG = Math.PI / 180;

const createGlowTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.12, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.14)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.025)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const createDotTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

export interface EngineStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  dpr: number;
  quality: QualityTier;
  geometries: number;
  textures: number;
}

export class EchoformEngine {
  readonly canvas: HTMLCanvasElement;
  private readonly container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private gradePass: ShaderPass;
  private controls: OrbitControls;
  private elapsed = 0;
  private animationId = 0;
  private resizeObserver: ResizeObserver;
  private style: StyleKey = 'crystal';
  private design: DesignSpec | null = null;
  private settings: ExperienceSettings | null = null;
  private quality: QualityTier = 'balanced';
  private materials: MaterialBundle;
  private architecture: Architecture | null = null;
  private environmentTexture: THREE.Texture | null = null;
  private phase = 'intro';
  private timeline = 0;
  private pulse = 0;
  private live: LiveFeature | null = null;
  private currentFps = 60;
  private frameTimeAccumulator = 0;
  private frameSamples = 0;
  private slowFrameTime = 0;
  private adaptiveReduced = false;
  private lastFrame = performance.now();

  private atmosphere: THREE.Mesh;
  private floor: THREE.Mesh;
  private floorMaterial: THREE.ShaderMaterial;
  private starField: THREE.Points;
  private coreGroup: THREE.Group;
  private coreOrb: THREE.Mesh;
  private coreMaterial: THREE.ShaderMaterial;
  private coreHalo: THREE.Sprite;
  private coreHaloInner: THREE.Sprite;
  private coreLight: THREE.PointLight;
  private coreRings: THREE.Mesh[] = [];
  private liveHalo: THREE.LineLoop;
  private liveHaloPositions: Float32Array;
  private introGroup: THREE.Group;
  private shafts: THREE.Mesh[] = [];
  private shaftMaterial: THREE.ShaderMaterial;
  private keyLight: THREE.SpotLight;
  private rimLight: THREE.SpotLight;
  private fillLight: THREE.HemisphereLight;
  private accentLight: THREE.PointLight;
  private cameraTween: CameraTween | null = null;
  private cameraMode: CameraMode = 'orbit';
  private guideCurve: THREE.CatmullRomCurve3 | null = null;
  private guideLookCurve: THREE.CatmullRomCurve3 | null = null;
  private guideStarted = 0;
  private roamYaw = 0;
  private roamPitch = 0;
  private roamKeys = new Set<string>();
  private roamInput = new THREE.Vector2();
  private dragging = false;
  private lastPointer = new THREE.Vector2();
  private disposeCallbacks: (() => void)[] = [];
  private disposed = false;
  private introHeight = 6.6;
  private coreTarget = new THREE.Vector3(0, 6.6, 0);
  onStats: ((stats: EngineStats) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, container: HTMLElement) {
    this.canvas = canvas;
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setClearColor(0x040404, 1);
    this.renderer.info.autoReset = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040404);
    this.scene.fog = new THREE.FogExp2(0x050607, 0.0056);
    this.camera = new THREE.PerspectiveCamera(39, 1, 0.1, 420);
    this.camera.position.set(9.5, 8.6, 16.5);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.045;
    this.controls.enablePan = false;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 125;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.target.set(0, 6.6, 0);
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.32;
    this.controls.update();

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environmentTexture = pmrem.fromScene(room, 0.04).texture;
    this.scene.environment = this.environmentTexture;
    this.scene.environmentIntensity = 0.62;
    room.dispose();
    pmrem.dispose();

    this.fillLight = new THREE.HemisphereLight(0x829ab4, 0x080605, 0.7);
    this.scene.add(this.fillLight);

    this.keyLight = new THREE.SpotLight(0xffd7a8, 430, 120, 0.72, 0.62, 1.2);
    this.keyLight.position.set(25, 38, 22);
    this.keyLight.target.position.set(0, 9, 0);
    this.scene.add(this.keyLight, this.keyLight.target);

    this.rimLight = new THREE.SpotLight(0x89d8ff, 380, 110, 0.82, 0.72, 1.1);
    this.rimLight.position.set(-30, 22, -25);
    this.rimLight.target.position.set(0, 11, 0);
    this.scene.add(this.rimLight, this.rimLight.target);

    this.accentLight = new THREE.PointLight(0xe7d3a7, 42, 36, 1.8);
    this.accentLight.position.set(0, 7, 0);
    this.scene.add(this.accentLight);

    this.materials = makeMaterialBundle(this.style);

    this.shaftMaterial = createShaftMaterial(this.materials.accentColor);
    this.createShafts();

    this.floorMaterial = createFloorMaterial(
      this.style,
      this.materials.accentColor,
      this.materials.warmColor,
    );
    const floorGeometry = new THREE.PlaneGeometry(180, 180);
    this.floor = new THREE.Mesh(floorGeometry, this.floorMaterial);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.04;
    this.scene.add(this.floor);

    this.atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(190, 40, 28),
      createAtmosphereMaterial(this.style, this.materials.accentColor),
    );
    this.atmosphere.frustumCulled = false;
    this.scene.add(this.atmosphere);

    this.starField = this.createStars();
    this.scene.add(this.starField);

    this.coreGroup = new THREE.Group();
    this.coreGroup.position.copy(this.coreTarget);
    this.scene.add(this.coreGroup);
    this.coreMaterial = createCoreMaterial(
      this.style,
      this.materials.accentColor,
      this.materials.warmColor,
    );
    this.coreOrb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.18, 5), this.coreMaterial);
    this.coreOrb.rotation.set(0.4, 0.2, 0);
    this.coreGroup.add(this.coreOrb);

    const glowTexture = createGlowTexture();
    this.coreHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: this.materials.accentColor,
        transparent: true,
        opacity: 0.44,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      }),
    );
    this.coreHalo.scale.set(7.2, 7.2, 1);
    this.coreGroup.add(this.coreHalo);
    this.coreHaloInner = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: this.materials.warmColor,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.coreHaloInner.scale.set(2.7, 2.7, 1);
    this.coreGroup.add(this.coreHaloInner);

    this.coreLight = new THREE.PointLight(this.materials.accentColor, 34, 36, 1.7);
    this.coreGroup.add(this.coreLight);

    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.55 + i * 0.48, 0.008 + i * 0.002, 4, 120),
        new THREE.MeshBasicMaterial({
          color: this.materials.accentColor,
          transparent: true,
          opacity: 0.38 - i * 0.08,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      ring.rotation.set(Math.PI / 2 + i * 0.22, i * 0.34, 0.25 * i);
      this.coreGroup.add(ring);
      this.coreRings.push(ring);
    }

    this.liveHaloPositions = new Float32Array(128 * 3);
    const haloGeometry = new THREE.BufferGeometry();
    haloGeometry.setAttribute('position', new THREE.BufferAttribute(this.liveHaloPositions, 3));
    this.liveHalo = new THREE.LineLoop(
      haloGeometry,
      new THREE.LineBasicMaterial({
        color: this.materials.accentColor,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.liveHalo.rotation.x = 0.14;
    this.coreGroup.add(this.liveHalo);
    this.updateLiveHalo(0, 0);

    this.introGroup = this.createIntroPlatform();
    this.scene.add(this.introGroup);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1280, 720), 0.56, 0.72, 0.64);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
    this.gradePass = new ShaderPass(GradeShader);
    this.gradePass.uniforms.uVignette.value = 0.9;
    this.gradePass.uniforms.uGrain.value = 0.017;
    this.gradePass.uniforms.uAberration.value = 0.0011;
    this.composer.addPass(this.gradePass);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.style = 'crystal';
    this.applyStyleLook();
    this.applyQuality('balanced');
    this.resize();
    this.bindEvents();
    this.animate();
  }

  private createStars(): THREE.Points {
    const count = 1500;
    const positions = new Float32Array(count * 3);
    let seed = 0x51a2fe;
    const random = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    };
    for (let i = 0; i < count; i += 1) {
      const radius = 42 + Math.pow(random(), 0.6) * 95;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      positions[i * 3 + 1] = Math.abs(Math.cos(phi)) * radius * 0.8 + 1.5;
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      size: 0.34,
      map: createDotTexture(),
      color: 0xb5c6d3,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }

  private createIntroPlatform(): THREE.Group {
    const group = new THREE.Group();
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: this.materials.accentColor,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4 + i * 1.6, 0.008 + i * 0.003, 4, 128), ringMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.03;
      group.add(ring);
    }
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(5.4, 96),
      new THREE.MeshBasicMaterial({
        color: this.materials.accentColor,
        transparent: true,
        opacity: 0.035,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.02;
    group.add(disc);
    return group;
  }

  private createShafts(): void {
    for (let i = 0; i < 3; i += 1) {
      const geometry = new THREE.CylinderGeometry(0.08, 4.6 + i * 0.7, 36, 18, 1, true);
      const shaft = new THREE.Mesh(geometry, this.shaftMaterial);
      const angle = (i / 3) * Math.PI * 2 + 0.6;
      shaft.position.set(Math.cos(angle) * (16 + i * 2), 17, Math.sin(angle) * (16 + i * 2));
      shaft.rotation.z = (i - 1) * 0.05;
      shaft.frustumCulled = false;
      this.scene.add(shaft);
      this.shafts.push(shaft);
    }
  }

  private bindEvents(): void {
    const onKeyDown = (event: KeyboardEvent) => {
      if (this.cameraMode !== 'roam') return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      this.roamKeys.add(event.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      this.roamKeys.delete(event.code);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (this.cameraMode !== 'roam') return;
      this.dragging = true;
      this.lastPointer.set(event.clientX, event.clientY);
      this.canvas.setPointerCapture(event.pointerId);
      this.canvas.style.cursor = 'grabbing';
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!this.dragging || this.cameraMode !== 'roam') return;
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      this.lastPointer.set(event.clientX, event.clientY);
      this.roamYaw -= dx * 0.0032;
      this.roamPitch = clamp(this.roamPitch - dy * 0.0027, -1.35, 1.35);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      try {
        this.canvas.releasePointerCapture(event.pointerId);
      } catch {
        // The pointer may no longer be captured.
      }
      this.canvas.style.cursor = this.cameraMode === 'roam' ? 'grab' : 'default';
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    this.canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    this.disposeCallbacks.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      this.canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    });
  }

  private applyStyleLook(): void {
    const meta = styleByKey(this.style);
    const accent = this.materials.accentColor;
    const warm = this.materials.warmColor;
    const atmosphereMaterial = this.atmosphere.material as THREE.ShaderMaterial;
    atmosphereMaterial.uniforms.uAccent.value = accent;
    atmosphereMaterial.uniforms.uPulse.value = this.pulse;
    this.floorMaterial.uniforms.uAccent.value = accent;
    this.floorMaterial.uniforms.uWarm.value = warm;
    this.floorMaterial.uniforms.uStyle.value = this.style === 'crystal' ? 0 : this.style === 'machine' ? 1 : 2;
    this.floorMaterial.uniforms.uRadius.value = this.design?.radius ?? 14;
    this.shaftMaterial.uniforms.uAccent.value = accent;
    this.coreMaterial.uniforms.uAccent.value = accent;
    this.coreMaterial.uniforms.uWarm.value = warm;
    this.coreMaterial.uniforms.uDeep.value =
      this.style === 'machine'
        ? new THREE.Color('#03151c')
        : this.style === 'organic'
          ? new THREE.Color('#2b0f0b')
          : new THREE.Color('#171109');
    (this.coreHalo.material as THREE.SpriteMaterial).color.copy(accent);
    (this.coreHaloInner.material as THREE.SpriteMaterial).color.copy(warm);
    (this.liveHalo.material as THREE.LineBasicMaterial).color.copy(accent);
    this.coreRings.forEach((ring) => {
      (ring.material as THREE.MeshBasicMaterial).color.copy(accent);
    });
    this.introGroup.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        (object.material as THREE.MeshBasicMaterial).color.copy(accent);
      }
    });
    this.accentLight.color.copy(accent);
    this.keyLight.color.setStyle(this.style === 'machine' ? '#bfe6ff' : this.style === 'organic' ? '#ffc4ae' : '#ffddb0');
    this.rimLight.color.setStyle(this.style === 'machine' ? '#48cfff' : this.style === 'organic' ? '#8de3d5' : '#9bdcff');
    this.fillLight.color.setStyle(this.style === 'machine' ? '#6f92a8' : this.style === 'organic' ? '#9b6f65' : '#829ab4');
    this.scene.fog = new THREE.FogExp2(
      this.style === 'machine' ? 0x04080c : this.style === 'organic' ? 0x0a0505 : 0x050607,
      0.0056,
    );
    this.renderer.setClearColor(meta.palette[0], 1);
    this.scene.background = new THREE.Color(meta.palette[0]);
    this.controls.autoRotateSpeed = this.style === 'machine' ? 0.42 : 0.3;
  }

  applyQuality(quality: QualityTier): void {
    this.quality = quality;
    const cap = quality === 'high' ? 2 : quality === 'balanced' ? 1.6 : 1.15;
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    this.renderer.setPixelRatio(dpr);
    this.composer.setPixelRatio(dpr);
    this.resize();
    this.bloomPass.strength = quality === 'high' ? 0.62 : quality === 'balanced' ? 0.56 : 0.46;
  }

  applySettings(settings: ExperienceSettings): void {
    const styleChanged = settings.style !== this.style;
    const qualityChanged = settings.quality !== this.quality;
    this.settings = settings;
    if (styleChanged) {
      this.style = settings.style;
      if (this.architecture) {
        this.scene.remove(this.architecture.group);
        this.architecture.dispose();
        this.architecture = null;
      }
      this.materials.dispose();
      this.materials = makeMaterialBundle(this.style);
      this.applyStyleLook();
      if (this.design) this.rebuildArchitecture();
    }
    this.materials.apply(settings.materials, settings.lights);
    this.applyLighting(settings);
    this.quality = settings.quality;
    if (qualityChanged) this.applyQuality(settings.quality);
    this.controls.autoRotate = settings.autoRotate && (this.cameraMode === 'orbit' || this.phase === 'intro');
  }

  private applyLighting(settings: ExperienceSettings): void {
    const { lights, materials } = settings;
    this.keyLight.intensity = 110 + lights.key * 110;
    this.rimLight.intensity = 40 + lights.rim * 110;
    this.fillLight.intensity = 0.16 + lights.ambient * 0.62;
    this.coreLight.intensity = 8 + lights.key * 14;
    this.renderer.toneMappingExposure =
      materials.exposure * 0.88 +
      (this.phase === 'intro' || this.phase === 'recording' ? 0.08 : 0);
    this.bloomPass.strength = (this.quality === 'low' ? 0.36 : 0.42) + materials.bloom * 0.3;
    this.gradePass.uniforms.uVignette.value = 0.75 + materials.clarity * 0.2;
    this.gradePass.uniforms.uGrain.value = 0.017 - materials.clarity * 0.006;
    this.scene.environmentIntensity = 0.27 + lights.ambient * 0.3;
    const warmth = lights.warmth;
    this.keyLight.color.lerpColors(new THREE.Color('#b9d7ff'), new THREE.Color('#ffd09a'), warmth);
    const shaftOpacity = 0.022 + lights.rim * 0.032;
    this.shaftMaterial.uniforms.uOpacity.value = shaftOpacity;
    this.shafts.forEach((shaft, index) => {
      shaft.visible = lights.ambient > 0.18 && index < (this.quality === 'low' ? 1 : 3);
    });
  }

  setDesign(design: DesignSpec | null): void {
    this.slowFrameTime = 0;
    this.design = design;
    if (!design) {
      if (this.architecture) {
        this.scene.remove(this.architecture.group);
        this.architecture.dispose();
        this.architecture = null;
      }
      this.coreTarget.set(0, this.introHeight, 0);
      this.introGroup.visible = true;
      return;
    }
    this.floorMaterial.uniforms.uRadius.value = design.radius;
    this.coreTarget.set(0, design.height * 0.42, 0);
    this.introGroup.visible = false;
    this.rebuildArchitecture();
    const distance = clamp(Math.max(design.radius * 2.48, design.height * 1.36), 32, 72);
    const angle = 0.62;
    this.setCameraMode('orbit');
    this.tweenCamera(
      new THREE.Vector3(Math.sin(angle) * distance, design.height * 0.64, Math.cos(angle) * distance),
      new THREE.Vector3(0, design.height * 0.42, 0),
      1.9,
    );
  }

  private rebuildArchitecture(): void {
    if (!this.design) return;
    if (this.architecture) {
      this.scene.remove(this.architecture.group);
      this.architecture.dispose();
    }
    this.architecture = createArchitecture(this.design, this.style, this.materials, this.quality);
    this.architecture.group.visible = this.phase !== 'intro' && this.phase !== 'recording' && this.phase !== 'analyzing';
    this.scene.add(this.architecture.group);
    this.syncArchitecture();
  }

  private syncArchitecture(): void {
    if (!this.architecture || !this.design) return;
    const progress = this.design.duration > 0 ? clamp(this.timeline / this.design.duration, 0, 1) : 0;
    this.architecture.update(this.timeline, progress, this.pulse, this.live, this.elapsed);
  }

  setPhase(phase: string): void {
    this.slowFrameTime = 0;
    this.phase = phase;
    const introVisible = ['intro', 'recording', 'analyzing', 'error'].includes(phase);
    this.introGroup.visible = introVisible;
    if (this.architecture) {
      this.architecture.group.visible = !introVisible;
    }
    if (phase === 'recording') {
      this.coreTarget.set(0, this.introHeight, 0);
      this.tweenCamera(new THREE.Vector3(7.2, 8.2, 12.8), new THREE.Vector3(0, this.introHeight, 0), 1.6);
      this.setCameraMode('orbit');
      this.controls.autoRotate = false;
    } else if (phase === 'analyzing') {
      this.tweenCamera(new THREE.Vector3(8.4, 9.6, 14.6), new THREE.Vector3(0, this.introHeight, 0), 0.8);
    } else if (phase === 'ready' && this.design) {
      this.introGroup.visible = false;
      this.coreTarget.set(0, this.design.height * 0.42, 0);
      if (this.architecture) this.architecture.group.visible = true;
      this.controls.autoRotate = this.settings?.autoRotate ?? true;
      this.frameBuilding(2.1);
    } else if (phase === 'intro') {
      this.resetCameraIntro(1.2);
    }
    if (this.settings) this.applyLighting(this.settings);
  }

  frameBuilding(duration = 2): void {
    if (!this.design) return;
    const distance = clamp(Math.max(this.design.radius * 2.48, this.design.height * 1.36), 32, 72);
    const angle = 0.62;
    this.tweenCamera(
      new THREE.Vector3(Math.sin(angle) * distance, this.design.height * 0.63, Math.cos(angle) * distance),
      new THREE.Vector3(0, this.design.height * 0.42, 0),
      duration,
    );
  }

  setTimeline(time: number): void {
    this.timeline = Math.max(0, time);
    if (this.design) {
      const normalized = clamp(this.timeline / Math.max(0.1, this.design.duration), 0, 1);
      const index = clamp(Math.round(normalized * (this.design.pulse.length - 1)), 0, this.design.pulse.length - 1);
      const composedPulse = this.design.pulse[index] ?? 0;
      this.pulse = this.live ? this.live.rms * 0.8 : composedPulse;
    } else {
      this.pulse = this.live?.rms ?? 0;
    }
    this.syncArchitecture();
  }

  setLive(feature: LiveFeature): void {
    this.live = feature;
    this.pulse = feature.rms;
    if (!this.design) {
      this.coreMaterial.uniforms.uPulse.value = feature.rms;
      this.coreMaterial.uniforms.uPitch.value = feature.pitchNorm;
    }
    this.updateLiveHalo(feature.rms, feature.pitchNorm);
  }

  clearLive(): void {
    this.live = null;
  }

  setCameraMode(mode: CameraMode): void {
    if (this.cameraMode === mode) return;
    this.cameraMode = mode;
    // A framing or style-change tween must not fight the user for control.
    this.cameraTween = null;
    if (mode === 'orbit') {
      this.controls.enabled = true;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      this.controls.target.copy(this.camera.position).add(forward.multiplyScalar(18));
      if (this.design) this.controls.target.y = Math.max(2, this.design.height * 0.34);
      this.controls.autoRotate = this.settings?.autoRotate ?? true;
      this.canvas.style.cursor = 'default';
    } else if (mode === 'roam') {
      this.controls.enabled = false;
      const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.roamYaw = euler.y;
      this.roamPitch = euler.x;
      this.canvas.style.cursor = 'grab';
    } else {
      this.controls.enabled = false;
      this.prepareGuide();
      this.canvas.style.cursor = 'default';
    }
  }

  getCameraMode(): CameraMode {
    return this.cameraMode;
  }

  setRoamInput(x: number, y: number): void {
    this.roamInput.set(clamp(x, -1, 1), clamp(y, -1, 1));
  }

  private prepareGuide(): void {
    if (!this.design) return;
    const r = this.design.radius;
    const h = this.design.height;
    this.guideCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(r * 2.5, h * 0.5, r * 1.8),
        new THREE.Vector3(r * 0.2, h * 0.7, r * 2.5),
        new THREE.Vector3(-r * 2.2, h * 0.44, r * 1.6),
        new THREE.Vector3(-r * 1.8, h * 0.26, -r * 1.5),
        new THREE.Vector3(0, h * 0.72, -r * 2.2),
        new THREE.Vector3(r * 2.2, h * 0.38, -r * 1.2),
      ],
      true,
      'centripetal',
    );
    this.guideLookCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, h * 0.34, 0),
        new THREE.Vector3(0, h * 0.46, 0),
        new THREE.Vector3(0, h * 0.32, 0),
        new THREE.Vector3(0, h * 0.28, 0),
        new THREE.Vector3(0, h * 0.42, 0),
        new THREE.Vector3(0, h * 0.3, 0),
      ],
      true,
      'centripetal',
    );
    this.guideStarted = this.elapsed;
  }

  resetGuide(): void {
    this.guideStarted = this.elapsed;
  }

  private updateGuide(): void {
    if (!this.guideCurve || !this.guideLookCurve) return;
    const duration = 42;
    const u = ((this.elapsed - this.guideStarted) / duration) % 1;
    const position = this.guideCurve.getPointAt(u < 0 ? u + 1 : u);
    const look = this.guideLookCurve.getPointAt(u < 0 ? u + 1 : u);
    this.camera.position.lerp(position, 0.045);
    const target = new THREE.Vector3().copy(this.camera.position).add(
      look.clone().sub(this.camera.position).multiplyScalar(0.11),
    );
    target.y = look.y;
    this.controls.target.lerp(target, 0.08);
    this.camera.lookAt(look);
  }

  private updateRoam(delta: number): void {
    const euler = new THREE.Euler(this.roamPitch, this.roamYaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
    const forward = new THREE.Vector3(-Math.sin(this.roamYaw), 0, -Math.cos(this.roamYaw));
    const right = new THREE.Vector3(Math.cos(this.roamYaw), 0, -Math.sin(this.roamYaw));
    let forwardInput = this.roamInput.y;
    let rightInput = this.roamInput.x;
    if (this.roamKeys.has('KeyW') || this.roamKeys.has('ArrowUp')) forwardInput += 1;
    if (this.roamKeys.has('KeyS') || this.roamKeys.has('ArrowDown')) forwardInput -= 1;
    if (this.roamKeys.has('KeyD') || this.roamKeys.has('ArrowRight')) rightInput += 1;
    if (this.roamKeys.has('KeyA') || this.roamKeys.has('ArrowLeft')) rightInput -= 1;
    const fast = this.roamKeys.has('ShiftLeft') || this.roamKeys.has('ShiftRight');
    const speed = (fast ? 30 : 13) * delta;
    const movement = new THREE.Vector3()
      .addScaledVector(forward, forwardInput)
      .addScaledVector(right, rightInput);
    if (movement.lengthSq() > 1) movement.normalize();
    this.camera.position.addScaledVector(movement, speed);
    if (this.roamKeys.has('KeyE') || this.roamKeys.has('Space')) this.camera.position.y += speed * 0.8;
    if (this.roamKeys.has('KeyQ')) this.camera.position.y -= speed * 0.8;
    this.camera.position.y = clamp(this.camera.position.y, 1.2, 82);
    const flat = new THREE.Vector2(this.camera.position.x, this.camera.position.z);
    if (flat.length() > 95) flat.setLength(95);
    this.camera.position.x = flat.x;
    this.camera.position.z = flat.y;
  }

  private tweenCamera(toPosition: THREE.Vector3, toTarget: THREE.Vector3, duration: number): void {
    const fromPosition = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();
    this.cameraTween = {
      fromPosition,
      toPosition: toPosition.clone(),
      fromTarget,
      toTarget: toTarget.clone(),
      start: this.elapsed,
      duration: Math.max(0.01, duration),
    };
    this.controls.enabled = false;
  }

  private resetCameraIntro(duration: number): void {
    this.coreTarget.set(0, this.introHeight, 0);
    this.tweenCamera(
      new THREE.Vector3(9.5, 8.6, 16.5),
      new THREE.Vector3(0, this.introHeight, 0),
      duration,
    );
    this.coreGroup.position.copy(this.coreTarget);
  }

  private updateCameraTween(): void {
    if (!this.cameraTween) return;
    const progress = clamp((this.elapsed - this.cameraTween.start) / this.cameraTween.duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    this.camera.position.lerpVectors(this.cameraTween.fromPosition, this.cameraTween.toPosition, eased);
    this.controls.target.lerpVectors(this.cameraTween.fromTarget, this.cameraTween.toTarget, eased);
    this.camera.lookAt(this.controls.target);
    if (progress >= 1) {
      this.cameraTween = null;
      if (this.cameraMode === 'orbit') this.controls.enabled = true;
    }
  }

  private updateLiveHalo(level: number, pitch: number): void {
    const count = 128;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const ripple =
        Math.sin(angle * 7 + this.elapsed * (0.8 + pitch * 1.7)) * (0.035 + level * 0.16) +
        Math.sin(angle * 13 - this.elapsed * 0.6) * 0.025;
      const radius = 1.95 + ripple + level * 0.38;
      this.liveHaloPositions[i * 3] = Math.cos(angle) * radius;
      this.liveHaloPositions[i * 3 + 1] = Math.sin(angle * 3 + this.elapsed * 0.4) * (0.03 + level * 0.1);
      this.liveHaloPositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const attribute = this.liveHalo.geometry.getAttribute('position') as THREE.BufferAttribute;
    attribute.needsUpdate = true;
  }

  private updateCore(delta: number): void {
    const targetY = this.coreTarget.y;
    this.coreGroup.position.y = lerp(this.coreGroup.position.y, targetY, Math.min(1, delta * 2.2));
    this.coreGroup.position.x = lerp(this.coreGroup.position.x, 0, Math.min(1, delta * 3));
    this.coreGroup.position.z = lerp(this.coreGroup.position.z, 0, Math.min(1, delta * 3));
    const breath = Math.sin(this.elapsed * 0.9) * 0.04;
    const idle = 0.12 + Math.sin(this.elapsed * 0.75) * 0.035;
    const level = clamp(Math.max(this.pulse, idle), 0, 1);
    const scale = (0.92 + level * 0.24 + breath) * (this.design?.scale ?? 1);
    this.coreOrb.scale.setScalar(scale);
    this.coreGroup.rotation.y += delta * 0.035;
    this.coreOrb.rotation.y += delta * 0.09;
    this.coreOrb.rotation.x += delta * 0.02;
    this.coreMaterial.uniforms.uTime.value = this.elapsed;
    this.coreMaterial.uniforms.uPulse.value = level;
    this.coreMaterial.uniforms.uPitch.value = this.live?.pitchNorm ?? 0.4;
    this.coreHalo.scale.setScalar((6.4 + level * 3.4) * (this.design?.scale ?? 1));
    this.coreHaloInner.scale.setScalar((2.2 + level * 1.5) * (this.design?.scale ?? 1));
    (this.coreHalo.material as THREE.SpriteMaterial).opacity = 0.4 + level * 0.32;
    (this.coreHaloInner.material as THREE.SpriteMaterial).opacity = 0.76 + level * 0.22;
    this.coreLight.intensity = 7 + level * 14;
    this.liveHalo.visible = this.phase === 'recording' || this.phase === 'intro' || this.phase === 'analyzing';
    (this.liveHalo.material as THREE.LineBasicMaterial).opacity = 0.18 + level * 0.55;
    if (this.liveHalo.visible) this.updateLiveHalo(level, this.live?.pitchNorm ?? 0.35);
    this.coreRings.forEach((ring, index) => {
      ring.rotation.z += delta * (0.06 + index * 0.035);
      ring.rotation.y += delta * (0.03 - index * 0.008);
      const material = ring.material as THREE.MeshBasicMaterial;
      material.opacity = (0.18 + index * 0.05) + level * 0.26;
    });
    this.accentLight.position.copy(this.coreGroup.position);
    this.accentLight.intensity = 6 + level * 24;
  }

  private updateScene(delta: number): void {
    this.elapsed += delta;
    const floorProgress = this.design ? 1 : 0.35;
    this.floorMaterial.uniforms.uTime.value = this.elapsed;
    this.floorMaterial.uniforms.uPulse.value = this.pulse;
    this.floorMaterial.uniforms.uBass.value = this.live?.low ?? this.pulse * 0.5;
    this.floorMaterial.uniforms.uProgress.value = floorProgress;
    const atmosphereMaterial = this.atmosphere.material as THREE.ShaderMaterial;
    atmosphereMaterial.uniforms.uTime.value = this.elapsed;
    atmosphereMaterial.uniforms.uPulse.value = this.pulse;
    this.starField.rotation.y += delta * 0.0018;
    this.updateCameraTween();
    if (this.cameraMode === 'roam') {
      this.updateRoam(delta);
    } else if (this.cameraMode === 'guide') {
      this.updateGuide();
    } else if (this.controls.enabled && !this.cameraTween) {
      this.controls.update();
    }
    this.updateCore(delta);
    if (this.architecture) {
      const progress = this.design ? clamp(this.timeline / Math.max(0.1, this.design.duration), 0, 1) : 0;
      this.architecture.update(this.timeline, progress, this.pulse, this.live, this.elapsed);
    }
    this.gradePass.uniforms.uTime.value = this.elapsed;
    this.introGroup.children.forEach((child, index) => {
      if (child instanceof THREE.Mesh) {
        child.rotation.z += delta * (index % 2 ? -0.03 : 0.03);
      }
    });
  }

  private animate = (): void => {
    if (this.disposed) return;
    this.animationId = requestAnimationFrame(this.animate);
    const now = performance.now();
    const rawDelta = Math.max(0, (now - this.lastFrame) / 1000);
    const delta = Math.min(0.05, rawDelta);
    this.lastFrame = now;
    if (document.hidden) return;
    this.updateScene(delta);
    this.renderer.info.reset();
    this.composer.render();
    this.measurePerformance(now, rawDelta);
  };

  private measurePerformance(now: number, delta: number): void {
    this.frameTimeAccumulator += delta;
    this.frameSamples += 1;
    const targetFrame = 1 / 38;
    // Ignore one-off stalls (shader compilation, analysis, tab switches) when
    // deciding whether the device is genuinely struggling.
    if (delta < 0.4) {
      if (delta > targetFrame) this.slowFrameTime += delta;
      else this.slowFrameTime = Math.max(0, this.slowFrameTime - delta * 1.5);
    }
    if (this.frameSamples >= 30) {
      this.currentFps = this.frameSamples / Math.max(0.001, this.frameTimeAccumulator);
      this.frameSamples = 0;
      this.frameTimeAccumulator = 0;
      if (this.onStats) {
        this.onStats({
          fps: Math.round(this.currentFps),
          drawCalls: this.renderer.info.render.calls,
          triangles: this.renderer.info.render.triangles,
          dpr: this.renderer.getPixelRatio(),
          quality: this.quality,
          geometries: this.renderer.info.memory.geometries,
          textures: this.renderer.info.memory.textures,
        });
      }
    }
    if (
      this.slowFrameTime > 2.5 &&
      !this.adaptiveReduced &&
      this.renderer.getPixelRatio() > 1.01
    ) {
      this.adaptiveReduced = true;
      this.slowFrameTime = 0;
      const dpr = Math.max(1, this.renderer.getPixelRatio() - 0.5);
      this.renderer.setPixelRatio(dpr);
      this.composer.setPixelRatio(dpr);
      this.resize();
    }
    void now;
  }

  resize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
  }

  async capture(width: number, height: number): Promise<Blob> {
    const previousWidth = this.container.clientWidth;
    const previousHeight = this.container.clientHeight;
    const previousRatio = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1);
    this.composer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.updateScene(0);
    this.renderer.info.reset();
    this.composer.render();
    const blob = await new Promise<Blob>((resolve, reject) => {
      this.canvas.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error('CAPTURE_FAILED'));
      }, 'image/png');
    });
    this.renderer.setPixelRatio(previousRatio);
    this.composer.setPixelRatio(previousRatio);
    this.renderer.setSize(previousWidth, previousHeight, false);
    this.composer.setSize(previousWidth, previousHeight);
    this.camera.aspect = previousWidth / Math.max(1, previousHeight);
    this.camera.updateProjectionMatrix();
    this.renderer.info.reset();
    this.composer.render();
    return blob;
  }

  captureStream(fps = 30): MediaStream {
    return this.canvas.captureStream(fps);
  }

  setCaptureMode(): void {
    this.setCameraMode('guide');
    this.resetGuide();
    this.controls.autoRotate = false;
  }

  restoreInteractionMode(): void {
    this.setCameraMode('orbit');
    this.controls.autoRotate = this.settings?.autoRotate ?? true;
  }

  getStats(): EngineStats {
    return {
      fps: Math.round(this.currentFps),
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      dpr: this.renderer.getPixelRatio(),
      quality: this.quality,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    };
  }

  getDesign(): DesignSpec | null {
    return this.design;
  }

  getStyle(): StyleKey {
    return this.style;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
    this.disposeCallbacks.forEach((callback) => callback());
    this.architecture?.dispose();
    this.materials.dispose();
    this.environmentTexture?.dispose();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
        object.geometry?.dispose();
        const material = object.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else if (material) material.dispose();
      }
    });
    this.renderer.dispose();
    this.composer.dispose();
  }
}
