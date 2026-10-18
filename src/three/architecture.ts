import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  clamp,
  easeOutCubic,
  type ChamberSpec,
  type ColumnSpec,
  type DesignSpec,
  type LiveFeature,
  type MaterialParams,
  type StyleKey,
} from '../types';
import type { MaterialBundle } from './materials';
import { createParticleMaterial } from './shaders';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const radial = (angle: number, radius: number, y = 0): THREE.Vector3 =>
  new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);

const merge = (geometries: THREE.BufferGeometry[]): THREE.BufferGeometry | null => {
  if (!geometries.length) return null;
  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  return merged;
};

const makeMesh = (
  geometry: THREE.BufferGeometry | null,
  material: THREE.Material,
): THREE.Mesh | null => {
  if (!geometry) return null;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
};

const orientBox = (
  from: THREE.Vector3,
  to: THREE.Vector3,
  width: number,
  depth: number,
  gap = 1,
): THREE.BoxGeometry => {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length() * gap;
  const geometry = new THREE.BoxGeometry(width, depth, length);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    direction.clone().normalize(),
  );
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5),
    quaternion,
    new THREE.Vector3(1, 1, 1),
  );
  geometry.applyMatrix4(matrix);
  return geometry;
};

const addTube = (
  geometries: THREE.BufferGeometry[],
  points: THREE.Vector3[],
  radius: number,
  segments = 64,
  radialSegments = 7,
): void => {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  geometries.push(new THREE.TubeGeometry(curve, segments, radius, radialSegments, false));
};

const addCircle = (
  geometries: THREE.BufferGeometry[],
  radius: number,
  y: number,
  tube: number,
  wobble = 0,
  seed = 1,
): void => {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < 72; i += 1) {
    const angle = (i / 72) * TAU;
    const r = radius + Math.sin(angle * 5 + seed) * wobble + Math.sin(angle * 9 - seed) * wobble * 0.4;
    points.push(radial(angle, r, y));
  }
  addTube(geometries, points, tube, 110, 5);
};

const archProfile = (
  spec: DesignSpec['arches'][number],
  style: StyleKey,
): THREE.Vector3[] => {
  const angle = spec.angle;
  const radius = spec.span;
  const height = spec.height;
  let profile: [number, number][];

  if (style === 'machine') {
    profile = [
      [1, 0],
      [0.98, 0.18],
      [0.9, 0.38],
      [0.68, 0.66],
      [0.42, 0.85],
      [0.2, 0.97],
      [0.05, 1],
    ];
  } else if (style === 'organic') {
    profile = [
      [1, 0],
      [1.08, 0.11],
      [1.02, 0.26],
      [0.76, 0.46],
      [0.82, 0.62],
      [0.52, 0.82],
      [0.24, 0.94],
      [0.08, 1],
    ];
  } else {
    profile = [
      [1, 0],
      [1.025, 0.14],
      [0.94, 0.32],
      [0.78, 0.54],
      [0.55, 0.74],
      [0.31, 0.9],
      [0.1, 1],
    ];
  }

  const lateral = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
  return profile.map(([r, y], index) => {
    const point = radial(angle, radius * r, height * y);
    if (style === 'organic') {
      point.addScaledVector(lateral, Math.sin((index / (profile.length - 1)) * Math.PI * 2.6) * spec.width * 0.75);
      point.y += Math.sin(index * 1.3) * 0.06;
    }
    return point;
  });
};

const createMembrane = (
  arches: DesignSpec['arches'],
  style: StyleKey,
  material: THREE.Material,
): THREE.Mesh | null => {
  if (arches.length < 2) return null;
  const samples = 26;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let archIndex = 0; archIndex < arches.length; archIndex += 1) {
    const current = new THREE.CatmullRomCurve3(archProfile(arches[archIndex], style));
    const nextSpec = arches[(archIndex + 1) % arches.length];
    const next = new THREE.CatmullRomCurve3(archProfile(nextSpec, style));
    const offset = positions.length / 3;
    for (let i = 0; i <= samples; i += 1) {
      const t = 0.08 + (i / samples) * 0.87;
      const a = current.getPoint(t);
      const b = next.getPoint(t);
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    for (let i = 0; i < samples; i += 1) {
      const a = offset + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
};

const createArch = (
  spec: DesignSpec['arches'][number],
  style: StyleKey,
  materials: MaterialBundle,
): THREE.Group => {
  const group = new THREE.Group();
  group.userData.birth = spec.birth;
  group.userData.grow = 'y';
  group.userData.growDuration = 0.9;
  const points = archProfile(spec, style);
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');

  if (style === 'machine') {
    const mainGeometries: THREE.BufferGeometry[] = [];
    const accentGeometries: THREE.BufferGeometry[] = [];
    const chromeGeometries: THREE.BufferGeometry[] = [];
    const segments = 19;
    for (let i = 0; i < segments; i += 1) {
      const t0 = i / segments;
      const t1 = Math.min(1, (i + 1) / segments);
      if (i % 5 === 3) continue;
      const a = curve.getPoint(t0);
      const b = curve.getPoint(t1);
      mainGeometries.push(orientBox(a, b, spec.width * 1.55, spec.depth * 0.52, 0.82));
      if (i % 4 === 1) {
        accentGeometries.push(orientBox(a, b, spec.width * 0.52, spec.depth * 0.2, 0.32));
      }
      if (i % 7 === 2) {
        const center = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
        const collar = new THREE.CylinderGeometry(spec.width * 1.15, spec.width * 1.15, spec.depth * 0.28, 8);
        collar.applyMatrix4(
          new THREE.Matrix4().compose(
            center,
            new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3().subVectors(b, a).normalize()),
            new THREE.Vector3(1, 1, 1),
          ),
        );
        chromeGeometries.push(collar);
      }
    }
    const main = makeMesh(merge(mainGeometries), materials.main);
    const accent = makeMesh(merge(accentGeometries), materials.accent);
    const chrome = makeMesh(merge(chromeGeometries), materials.secondary);
    [main, accent, chrome].forEach((mesh) => mesh && group.add(mesh));
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 3.4, 0.5, spec.width * 3.4),
      materials.main,
    );
    base.position.copy(points[0]);
    base.position.y += 0.2;
    base.lookAt(points[0].clone().add(new THREE.Vector3(0, 1, 0)));
    group.add(base);
  } else if (style === 'organic') {
    const primary: THREE.BufferGeometry[] = [];
    const tendril: THREE.BufferGeometry[] = [];
    addTube(primary, points, spec.width * 0.62, 84, 9);
    const lateral = new THREE.Vector3(-Math.sin(spec.angle), 0, Math.cos(spec.angle));
    const secondaryPoints = points.map((point, index) => {
      const t = index / Math.max(1, points.length - 1);
      return point
        .clone()
        .addScaledVector(lateral, Math.sin(t * Math.PI * 5.2 + 0.8) * spec.width * 1.4)
        .add(new THREE.Vector3(0, Math.sin(t * Math.PI * 2.2) * 0.12, 0));
    });
    addTube(tendril, secondaryPoints, spec.width * 0.12, 56, 5);
    const mainMesh = makeMesh(merge(primary), materials.main);
    const tendrilMesh = makeMesh(merge(tendril), materials.secondary);
    if (mainMesh) group.add(mainMesh);
    if (tendrilMesh) group.add(tendrilMesh);
    const bulb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(spec.width * 0.48, 1),
      materials.secondary,
    );
    bulb.position.copy(points[Math.floor(points.length * 0.62)]);
    bulb.scale.set(1.2, 0.55, 1.2);
    group.add(bulb);
  } else {
    const mainGeometries: THREE.BufferGeometry[] = [];
    const metalGeometries: THREE.BufferGeometry[] = [];
    const glassGeometries: THREE.BufferGeometry[] = [];
    addTube(mainGeometries, points, spec.width * 0.48, 80, 8);
    const lateral = new THREE.Vector3(-Math.sin(spec.angle), 0, Math.cos(spec.angle));
    const offsetPoints = points.map((point) => point.clone().addScaledVector(lateral, 0.2));
    addTube(metalGeometries, offsetPoints, 0.022, 64, 4);
    const innerPoints = points.map((point, index) => {
      const t = index / Math.max(1, points.length - 1);
      return point
        .clone()
        .addScaledVector(lateral, -0.25)
        .add(new THREE.Vector3(0, Math.sin(t * Math.PI * 1.4) * 0.05, 0));
    });
    addTube(glassGeometries, innerPoints, spec.width * 0.09, 60, 5);
    const mainMesh = makeMesh(merge(mainGeometries), materials.secondary);
    const metalMesh = makeMesh(merge(metalGeometries), materials.metal);
    const glassMesh = makeMesh(merge(glassGeometries), materials.glass);
    if (mainMesh) group.add(mainMesh);
    if (metalMesh) group.add(metalMesh);
    if (glassMesh) group.add(glassMesh);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.width * 1.1, spec.width * 1.3, 0.36, 12),
      materials.main,
    );
    base.position.copy(points[0]);
    base.position.y += 0.16;
    group.add(base);
  }

  return group;
};

const createChamber = (
  spec: ChamberSpec,
  design: DesignSpec,
  style: StyleKey,
  materials: MaterialBundle,
): THREE.Group => {
  const group = new THREE.Group();
  group.position.copy(radial(spec.angle, spec.radius, 0.16));
  group.rotation.y = -spec.angle;
  group.userData.birth = spec.birth;
  group.userData.grow = 'all';
  group.userData.growDuration = 0.72;

  const main: THREE.BufferGeometry[] = [];
  const secondary: THREE.BufferGeometry[] = [];
  const accent: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const voidHall = spec.pauseAfter > 1.05 && (style !== 'machine' || spec.energy < 0.72);
  const w = spec.width;
  const h = spec.height;

  if (style === 'crystal') {
    const platform = new THREE.CylinderGeometry(w, w * 1.06, 0.24, 28);
    platform.translate(0, 0.12, 0);
    secondary.push(platform);
    const inner = new THREE.CylinderGeometry(w * 0.76, w * 0.76, 0.08, 28);
    inner.translate(0, 0.26, 0);
    main.push(inner);

    const count = voidHall ? 3 : 7;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * TAU;
      const columnHeight = h * (voidHall ? 0.3 + (i % 2) * 0.15 : 0.55 + (i % 3) * 0.12);
      const column = new THREE.CylinderGeometry(0.07 + w * 0.012, 0.09 + w * 0.016, columnHeight, 7);
      column.translate(Math.cos(angle) * w * 0.68, 0.3 + columnHeight / 2, Math.sin(angle) * w * 0.68);
      secondary.push(column);
      if (!voidHall) {
        const capital = new THREE.TorusGeometry(w * 0.69, 0.03, 4, 7);
        capital.rotateX(Math.PI / 2);
        capital.translate(0, 0.3 + columnHeight, 0);
        main.push(capital);
      }
    }

    if (!voidHall) {
      const ring = new THREE.TorusGeometry(w * 0.68, 0.055, 7, 40);
      ring.rotateX(Math.PI / 2);
      ring.translate(0, h * 0.92, 0);
      secondary.push(ring);
      for (let i = 0; i < 7; i += 1) {
        const angle = (i / 7) * TAU;
        const base = radial(angle, w * 0.68, h * 0.92);
        const apex = new THREE.Vector3(0, h * 1.28, 0);
        const mid = base.clone().lerp(apex, 0.5);
        mid.y += 0.4;
        addTube(main, [base, mid, apex], 0.025, 18, 4);
      }
      const spike = new THREE.ConeGeometry(0.08, h * 0.28, 7);
      spike.translate(0, h * 1.28 + h * 0.12, 0);
      accent.push(spike);
      const halo = new THREE.TorusGeometry(w * 0.3, 0.018, 4, 28);
      halo.rotateX(Math.PI / 2);
      halo.translate(0, h * 1.32, 0);
      glow.push(halo);
    } else {
      const broken = new THREE.CylinderGeometry(w * 0.18, w * 0.28, 0.35, 5);
      broken.translate(0, 0.42, 0);
      main.push(broken);
    }
  } else if (style === 'machine') {
    const platform = new THREE.CylinderGeometry(w, w * 1.02, 0.28, 6);
    platform.translate(0, 0.14, 0);
    main.push(platform);
    const ring = new THREE.TorusGeometry(w * 0.82, 0.045, 4, 6);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, 0.3, 0);
    accent.push(ring);
    const count = voidHall ? 4 : 6;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * TAU + Math.PI / 6;
      const columnHeight = h * (voidHall ? 0.34 : 0.78);
      const x = Math.cos(angle) * w * 0.68;
      const z = Math.sin(angle) * w * 0.68;
      const spine = new THREE.BoxGeometry(0.1, columnHeight, 0.1);
      spine.translate(x, 0.3 + columnHeight / 2, z);
      main.push(spine);
      const brace = new THREE.BoxGeometry(0.22, 0.07, 0.22);
      brace.translate(x, 0.3 + columnHeight * 0.58, z);
      secondary.push(brace);
      const strip = new THREE.BoxGeometry(0.028, columnHeight * 0.72, 0.028);
      strip.translate(x + 0.07, 0.35 + columnHeight * 0.38, z);
      accent.push(strip);
    }
    if (!voidHall) {
      const top = new THREE.TorusGeometry(w * 0.7, 0.075, 4, 6);
      top.rotateX(Math.PI / 2);
      top.translate(0, h * 0.85, 0);
      secondary.push(top);
      const crown = new THREE.TorusGeometry(w * 0.42, 0.024, 4, 36);
      crown.rotateX(Math.PI / 2);
      crown.translate(0, h * 1.04, 0);
      glow.push(crown);
      const mast = new THREE.CylinderGeometry(0.035, 0.06, h * 0.26, 5);
      mast.translate(0, h * 1.02 + h * 0.13, 0);
      main.push(mast);
      const tip = new THREE.SphereGeometry(0.08, 8, 6);
      tip.translate(0, h * 1.03 + h * 0.26, 0);
      accent.push(tip);
    }
  } else {
    const platform = new THREE.CylinderGeometry(w, w * 0.9, 0.2, 32);
    platform.translate(0, 0.1, 0);
    main.push(platform);
    const rim = new THREE.TorusGeometry(w * 0.92, 0.055, 5, 44);
    rim.rotateX(Math.PI / 2);
    rim.translate(0, 0.24, 0);
    secondary.push(rim);
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(w * 0.04, 0.2),
      new THREE.Vector2(w * 0.5, 0.24),
      new THREE.Vector2(w * 0.78, h * 0.26),
      new THREE.Vector2(w * 0.7, h * 0.52),
      new THREE.Vector2(w * 0.46, h * 0.72),
      new THREE.Vector2(w * 0.18, h * 0.82),
      new THREE.Vector2(w * 0.03, h * (voidHall ? 0.28 : 0.88)),
    ];
    const pod = new THREE.LatheGeometry(profile, 36);
    glow.push(pod);
    const ribs = voidHall ? 3 : 5;
    for (let i = 0; i < ribs; i += 1) {
      const angle = (i / ribs) * TAU;
      const points = [
        radial(angle, w * 0.5, 0.22),
        radial(angle + 0.34, w * 0.78, h * 0.28),
        radial(angle + 0.12, w * 0.66, h * 0.56),
        radial(angle + 0.24, w * 0.26, h * 0.84),
      ];
      addTube(secondary, points, 0.032, 28, 4);
    }
    if (!voidHall) {
      const apex = new THREE.Mesh(
        new THREE.IcosahedronGeometry(w * 0.13, 1),
        materials.accent,
      );
      apex.position.set(0, h * 0.9, 0);
      group.add(apex);
    }
  }

  const meshMain = makeMesh(merge(main), style === 'machine' ? materials.secondary : materials.main);
  const meshSecondary = makeMesh(merge(secondary), style === 'machine' ? materials.main : materials.secondary);
  const meshAccent = makeMesh(merge(accent), materials.accent);
  const meshGlow = makeMesh(merge(glow), style === 'organic' ? materials.membrane : materials.glass);
  [meshMain, meshSecondary, meshAccent, meshGlow].forEach((mesh) => mesh && group.add(mesh));

  // A slow suspended ring ties the chamber back to the central score.
  const suspension = new THREE.Mesh(
    new THREE.TorusGeometry(w * 0.96, 0.012, 4, 42),
    materials.line,
  );
  suspension.rotation.x = Math.PI / 2;
  suspension.position.y = h * 0.7;
  group.add(suspension);
  suspension.userData.spin = 0.04 + spec.tone * 0.06;
  group.userData.spinners = [suspension];
  group.userData.width = w;
  group.userData.angle = spec.angle;
  group.userData.empty = voidHall;
  group.userData.height = h;
  void design;
  return group;
};

const createBridge = (
  spec: DesignSpec['bridges'][number],
  style: StyleKey,
  materials: MaterialBundle,
): THREE.Group => {
  const group = new THREE.Group();
  const angle = (spec.fromAngle + spec.toAngle) / 2;
  const outer = spec.radius * 0.93;
  const inner = Math.max(1.4, outer - Math.max(2.6, spec.length));
  const mid = (outer + inner) / 2;
  group.position.copy(radial(angle, mid, spec.y));
  group.rotation.y = -angle;
  group.userData.birth = spec.birth;
  group.userData.grow = 'x';
  group.userData.growDuration = 0.7;
  const length = outer - inner;
  if (style === 'machine') {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(length, 0.16, 1.15), materials.main);
    group.add(deck);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(length * 0.92, 0.02, 0.22), materials.accent);
    strip.position.y = 0.12;
    group.add(strip);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.04, 0.04), materials.secondary);
      rail.position.set(0, 0.48, side * 0.52);
      group.add(rail);
      for (let i = -2; i <= 2; i += 1) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.5, 0.035), materials.secondary);
        post.position.set((i / 2) * length * 0.44, 0.26, side * 0.52);
        group.add(post);
      }
    }
  } else if (style === 'organic') {
    const points = [
      new THREE.Vector3(-length / 2, 0, 0),
      new THREE.Vector3(-length * 0.2, -0.25, 0.05),
      new THREE.Vector3(length * 0.25, -0.18, -0.05),
      new THREE.Vector3(length / 2, 0.05, 0),
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.26, 8), materials.main);
    group.add(tube);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.025, 4), materials.secondary);
    rail.position.y = 0.52;
    group.add(rail);
  } else {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(length, 0.14, 1.4), materials.main);
    group.add(deck);
    const gold = new THREE.Mesh(new THREE.BoxGeometry(length, 0.018, 1.46), materials.metal);
    gold.position.y = 0.08;
    group.add(gold);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.035, 0.035), materials.metal);
      rail.position.set(0, 0.46, side * 0.64);
      group.add(rail);
      for (let i = -2; i <= 2; i += 1) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.46, 0.03), materials.metal);
        post.position.set((i / 2) * length * 0.4, 0.23, side * 0.64);
        group.add(post);
      }
    }
  }
  return group;
};

const createRing = (
  spec: DesignSpec['rings'][number],
  design: DesignSpec,
  style: StyleKey,
  materials: MaterialBundle,
): THREE.Group => {
  const group = new THREE.Group();
  group.position.y = spec.y;
  group.rotation.x = spec.tilt;
  group.userData.birth = spec.birth;
  group.userData.grow = 'all';
  group.userData.growDuration = 0.8;
  group.userData.spin = 0.025 + (Math.sin(spec.radius * 4.7 + spec.y) + 1) * 0.018;

  if (style === 'machine') {
    const parts: THREE.BufferGeometry[] = [];
    const lights: THREE.BufferGeometry[] = [];
    const segments = 40;
    for (let i = 0; i < segments; i += 1) {
      if (i % 8 === 4) continue;
      const angle = (i / segments) * TAU;
      const arc = (TAU * spec.radius) / segments;
      const box = new THREE.BoxGeometry(spec.thickness * 2.5, spec.thickness * 1.5, arc * 0.72);
      const p = radial(angle, spec.radius, 0);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -angle, 0));
      box.applyMatrix4(new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)));
      parts.push(box);
      if (i % 4 === 0) {
        const strip = new THREE.BoxGeometry(spec.thickness * 0.85, spec.thickness * 0.28, arc * 0.45);
        strip.applyMatrix4(new THREE.Matrix4().compose(p.clone().add(new THREE.Vector3(0, spec.thickness, 0)), q, new THREE.Vector3(1, 1, 1)));
        lights.push(strip);
      }
    }
    const body = makeMesh(merge(parts), materials.main);
    const light = makeMesh(merge(lights), materials.accent);
    if (body) group.add(body);
    if (light) group.add(light);
  } else if (style === 'organic') {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 84; i += 1) {
      const angle = (i / 84) * TAU;
      const r = spec.radius + Math.sin(angle * 4.5 + spec.radius) * 0.28 + Math.sin(angle * 8.0) * 0.1;
      points.push(radial(angle, r, Math.sin(angle * 3.0) * 0.16));
    }
    const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 110, spec.thickness, 6, true), materials.main);
    group.add(tube);
    const second = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 80, spec.thickness * 0.3, 4, true),
      materials.secondary,
    );
    second.scale.setScalar(1.018);
    group.add(second);
  } else {
    const t = new THREE.Mesh(
      new THREE.TorusGeometry(spec.radius, spec.thickness, 7, 96),
      spec.kind === 1 ? materials.glass : materials.metal,
    );
    t.rotation.x = Math.PI / 2;
    group.add(t);
    if (spec.kind === 0) {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(spec.radius + 0.18, 0.007, 3, 96),
        materials.line,
      );
      halo.rotation.x = Math.PI / 2;
      group.add(halo);
    }
  }

  group.userData.radius = spec.radius;
  void design;
  return group;
};

const buildColumns = (
  specs: ColumnSpec[],
  style: StyleKey,
  materials: MaterialBundle,
): { group: THREE.Group; main: THREE.InstancedMesh; glow: THREE.InstancedMesh; births: number[] } => {
  const group = new THREE.Group();
  const sorted = [...specs].sort((a, b) => a.birth - b.birth);
  const geometry =
    style === 'machine'
      ? new THREE.BoxGeometry(1, 1, 1)
      : new THREE.CylinderGeometry(1, 1, 1, style === 'organic' ? 8 : 7);
  const material = style === 'machine' ? materials.main : materials.secondary;
  const main = new THREE.InstancedMesh(geometry, material, sorted.length);
  main.frustumCulled = false;
  const glowGeometry =
    style === 'machine' ? new THREE.BoxGeometry(0.4, 1, 0.16) : new THREE.CylinderGeometry(0.38, 0.38, 1, 5);
  const glow = new THREE.InstancedMesh(glowGeometry, materials.accent, sorted.length);
  glow.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const births: number[] = [];
  const color = new THREE.Color();

  sorted.forEach((spec, index) => {
    const p = radial(spec.angle, spec.radius, 0);
    dummy.position.set(p.x, spec.height / 2, p.z);
    dummy.rotation.set(0, -spec.angle, style === 'organic' ? (index % 3 - 1) * 0.03 : 0);
    dummy.scale.set(spec.thickness * 2.2, spec.height, spec.thickness * 2.2);
    dummy.updateMatrix();
    main.setMatrixAt(index, dummy.matrix);
    color
      .copy(style === 'machine' ? materials.secondary.color : materials.secondary.color)
      .lerp(materials.accentColor, clamp(spec.tone * 0.55, 0, 0.55));
    main.setColorAt(index, color);

    dummy.position.set(p.x, spec.height / 2 + 0.12, p.z);
    dummy.scale.set(spec.thickness * 2.15, spec.height * 0.94, spec.thickness * 2.15);
    dummy.updateMatrix();
    glow.setMatrixAt(index, dummy.matrix);
    births.push(spec.birth);
  });
  main.instanceMatrix.needsUpdate = true;
  glow.instanceMatrix.needsUpdate = true;
  if (main.instanceColor) main.instanceColor.needsUpdate = true;
  main.count = 0;
  glow.count = 0;
  group.add(main, glow);
  return { group, main, glow, births };
};

const buildStairs = (
  design: DesignSpec,
  style: StyleKey,
  materials: MaterialBundle,
): {
  group: THREE.Group;
  steps: THREE.InstancedMesh;
  glowSteps: THREE.InstancedMesh | null;
  births: number[];
} => {
  const group = new THREE.Group();
  const spec = design.stairs;
  const stepGeometry = new THREE.BoxGeometry(1, 1, 1);
  const stepMaterial =
    style === 'organic' ? materials.main : style === 'machine' ? materials.secondary : materials.main;
  const steps = new THREE.InstancedMesh(stepGeometry, stepMaterial, spec.steps);
  steps.frustumCulled = false;
  let glowSteps: THREE.InstancedMesh | null = null;
  if (style === 'machine') {
    glowSteps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materials.accent, spec.steps);
    glowSteps.frustumCulled = false;
  }
  const dummy = new THREE.Object3D();
  const births: number[] = [];
  for (let i = 0; i < spec.steps; i += 1) {
    const t = i / Math.max(1, spec.steps - 1);
    const angle = spec.direction * spec.turns * TAU * t - Math.PI / 2;
    const radius = spec.radius + Math.sin(t * Math.PI * 2.4) * 0.35;
    const position = radial(angle, radius, 0.42 + t * spec.height);
    const scale =
      style === 'organic'
        ? new THREE.Vector3(1.0 + Math.sin(t * Math.PI) * 0.35, 0.12, 0.64)
        : new THREE.Vector3(1.34, 0.1, style === 'machine' ? 0.82 : 0.62);
    dummy.position.copy(position);
    dummy.rotation.set(0, -angle, style === 'organic' ? Math.sin(t * Math.PI * 2) * 0.12 : 0);
    dummy.scale.copy(scale);
    dummy.updateMatrix();
    steps.setMatrixAt(i, dummy.matrix);
    if (glowSteps) {
      dummy.position.copy(position);
      dummy.position.y -= 0.065;
      dummy.scale.set(scale.x * 0.72, 0.012, 0.12);
      dummy.updateMatrix();
      glowSteps.setMatrixAt(i, dummy.matrix);
    }
    births.push(spec.stepBirths[i] ?? spec.birth + t * 4);
  }
  steps.instanceMatrix.needsUpdate = true;
  if (glowSteps) glowSteps.instanceMatrix.needsUpdate = true;
  steps.count = 0;
  if (glowSteps) glowSteps.count = 0;

  const railPoints: THREE.Vector3[] = [];
  const railPointsInner: THREE.Vector3[] = [];
  for (let i = 0; i <= 80; i += 1) {
    const t = i / 80;
    const angle = spec.direction * spec.turns * TAU * t - Math.PI / 2;
    const radius = spec.radius + 0.65 + Math.sin(t * Math.PI * 2.4) * 0.35;
    railPoints.push(radial(angle, radius, 1.2 + t * spec.height));
    railPointsInner.push(radial(angle, spec.radius - 0.65, 1.2 + t * spec.height));
  }
  // A separate rail mesh is cheap and reads beautifully in silhouette.
  const rail = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPoints), 110, 0.018, 4, false),
    materials.metal,
  );
  rail.frustumCulled = false;
  group.add(rail);
  const innerRail = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPointsInner), 110, 0.012, 3, false),
    materials.line,
  );
  innerRail.frustumCulled = false;
  group.add(innerRail);

  const landing = new THREE.Mesh(
    new THREE.CylinderGeometry(spec.radius + 1.6, spec.radius + 1.6, 0.16, 36),
    style === 'organic' ? materials.main : materials.secondary,
  );
  landing.position.y = spec.height + 0.38;
  group.add(landing);
  const landingRing = new THREE.Mesh(
    new THREE.TorusGeometry(spec.radius + 1.7, 0.035, 4, 64),
    materials.accent,
  );
  landingRing.rotation.x = Math.PI / 2;
  landingRing.position.y = spec.height + 0.48;
  group.add(landingRing);

  group.add(steps);
  if (glowSteps) group.add(glowSteps);
  return { group, steps, glowSteps, births };
};

const buildShards = (
  design: DesignSpec,
  style: StyleKey,
  materials: MaterialBundle,
): THREE.InstancedMesh => {
  const geometry =
    style === 'machine'
      ? new THREE.BoxGeometry(0.8, 1.6, 0.5)
      : style === 'organic'
        ? new THREE.IcosahedronGeometry(0.6, 1)
        : new THREE.OctahedronGeometry(0.75, 0);
  const material =
    style === 'machine' ? materials.accent : style === 'organic' ? materials.secondary : materials.glass;
  const sorted = [...design.shards].sort((a, b) => a.birth - b.birth);
  const mesh = new THREE.InstancedMesh(geometry, material, sorted.length);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  sorted.forEach((shard, index) => {
    const p = radial(shard.angle, shard.radius, shard.y);
    dummy.position.copy(p);
    dummy.rotation.set(shard.spin, shard.angle, shard.spin * 0.6);
    dummy.scale.setScalar(shard.size * design.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    color
      .copy(materials.secondary.color)
      .lerp(materials.accentColor, clamp(shard.tone, 0, 1));
    mesh.setColorAt(index, color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.count = 0;
  mesh.userData.sorted = sorted;
  return mesh;
};

const buildParticles = (design: DesignSpec, style: StyleKey, materials: MaterialBundle): THREE.Points => {
  const rng = mulberry32(design.seed ^ 0x71f3);
  const count = design.particleCount;
  const positions = new Float32Array(count * 3);
  const births = new Float32Array(count);
  const sizes = new Float32Array(count);
  const tones = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const angle = rng() * TAU;
    const radius = Math.sqrt(rng()) * design.radius * 1.42;
    const y = Math.pow(rng(), 0.72) * design.height * 1.08;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    births[i] = clamp(rng() * 0.86 + 0.06, 0, 1);
    sizes[i] = 0.5 + Math.pow(rng(), 2.2) * 3.2;
    tones[i] = rng();
    phases[i] = rng() * TAU;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aBirth', new THREE.BufferAttribute(births, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aTone', new THREE.BufferAttribute(tones, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.computeBoundingSphere();
  const material = createParticleMaterial(style, materials.accentColor, materials.warmColor, design.height);
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
};

const buildFoundation = (
  design: DesignSpec,
  style: StyleKey,
  materials: MaterialBundle,
): THREE.Group => {
  const group = new THREE.Group();
  group.userData.birth = 0;
  group.userData.grow = 'all';
  group.userData.growDuration = 0.7;
  const main: THREE.BufferGeometry[] = [];
  const secondary: THREE.BufferGeometry[] = [];
  const accent: THREE.BufferGeometry[] = [];
  const r = design.radius;

  if (style === 'machine') {
    const lower = new THREE.CylinderGeometry(r * 1.17, r * 1.2, 0.34, 8);
    lower.translate(0, 0.17, 0);
    main.push(lower);
    const upper = new THREE.CylinderGeometry(r * 1.04, r * 1.1, 0.24, 8);
    upper.translate(0, 0.43, 0);
    secondary.push(upper);
    const ring = new THREE.TorusGeometry(r * 1.12, 0.035, 4, 8);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, 0.55, 0);
    accent.push(ring);
  } else if (style === 'organic') {
    for (let i = 0; i < 3; i += 1) {
      const geometry = new THREE.CylinderGeometry(r * (1.2 - i * 0.11), r * (1.23 - i * 0.11), 0.2, 64);
      geometry.translate(0, 0.1 + i * 0.15, 0);
      if (i === 0) main.push(geometry);
      else secondary.push(geometry);
    }
    addCircle(secondary, r * 1.04, 0.5, 0.045, 0.28, 1.2);
    addCircle(secondary, r * 0.82, 0.55, 0.025, 0.2, 2.8);
  } else {
    const lower = new THREE.CylinderGeometry(r * 1.18, r * 1.24, 0.26, 96);
    lower.translate(0, 0.13, 0);
    main.push(lower);
    const middle = new THREE.CylinderGeometry(r * 1.08, r * 1.14, 0.22, 96);
    middle.translate(0, 0.34, 0);
    secondary.push(middle);
    const upper = new THREE.CylinderGeometry(r * 0.96, r * 1.02, 0.16, 96);
    upper.translate(0, 0.52, 0);
    main.push(upper);
    addCircle(secondary, r * 1.04, 0.56, 0.025, 0, 0);
    addCircle(accent, r * 0.86, 0.6, 0.012, 0, 2);
  }

  const meshMain = makeMesh(merge(main), materials.main);
  const meshSecondary = makeMesh(merge(secondary), style === 'machine' ? materials.main : materials.secondary);
  const meshAccent = makeMesh(merge(accent), materials.accent);
  [meshMain, meshSecondary, meshAccent].forEach((mesh) => mesh && group.add(mesh));
  return group;
};

const buildSpires = (
  design: DesignSpec,
  style: StyleKey,
  materials: MaterialBundle,
): THREE.Group => {
  const group = new THREE.Group();
  group.userData.birth = design.duration * 0.56;
  group.userData.grow = 'y';
  group.userData.growDuration = 1.2;
  const main: THREE.BufferGeometry[] = [];
  const accent: THREE.BufferGeometry[] = [];
  for (let i = 0; i < design.spireCount; i += 1) {
    const angle = (i / design.spireCount) * TAU + 0.3;
    const radius = design.radius * (0.18 + (i % 3) * 0.13);
    const baseY = design.height * (0.72 + (i % 2) * 0.06);
    const h = design.height * (0.13 + (i % 3) * 0.035);
    const p = radial(angle, radius, baseY);
    if (style === 'organic') {
      const points = [
        p,
        p.clone().add(new THREE.Vector3(Math.cos(angle) * 0.6, h * 0.45, Math.sin(angle) * 0.6)),
        p.clone().add(new THREE.Vector3(Math.cos(angle + 0.6) * 0.25, h, Math.sin(angle + 0.6) * 0.25)),
      ];
      addTube(main, points, 0.045, 22, 5);
    } else if (style === 'machine') {
      const mast = new THREE.CylinderGeometry(0.028, 0.06, h, 5);
      mast.translate(p.x, p.y + h / 2, p.z);
      main.push(mast);
      const tip = new THREE.SphereGeometry(0.07, 6, 5);
      tip.translate(p.x, p.y + h, p.z);
      accent.push(tip);
    } else {
      const spire = new THREE.ConeGeometry(0.1, h, 7);
      spire.translate(p.x, p.y + h / 2, p.z);
      main.push(spire);
      const halo = new THREE.TorusGeometry(0.2, 0.012, 3, 20);
      halo.rotateX(Math.PI / 2);
      halo.translate(p.x, p.y + h * 0.78, p.z);
      accent.push(halo);
    }
  }
  const meshMain = makeMesh(merge(main), style === 'machine' ? materials.secondary : materials.metal);
  const meshAccent = makeMesh(merge(accent), materials.accent);
  [meshMain, meshAccent].forEach((mesh) => mesh && group.add(mesh));
  return group;
};

const buildOculus = (design: DesignSpec, style: StyleKey, materials: MaterialBundle): THREE.Group => {
  const group = new THREE.Group();
  group.userData.birth = design.duration * 0.42;
  group.userData.grow = 'all';
  group.userData.growDuration = 1.1;
  const y = design.height * 0.965;
  const radius = design.radius * (style === 'organic' ? 0.2 : 0.15);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, style === 'machine' ? 0.075 : 0.035, 6, 72),
    style === 'organic' ? materials.main : materials.metal,
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  group.add(ring);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.2, 0.008, 3, 72),
    materials.line,
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = y + 0.08;
  group.add(halo);
  // Radial tension cables from the oculus to the crown.
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * TAU;
    const start = radial(angle, radius, y);
    const end = radial(angle + 0.2, design.radius * 0.95, 0.45);
    const points = [
      start,
      start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 2.2, 0)),
      end,
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(
      new THREE.CatmullRomCurve3(points).getPoints(24),
    );
    const line = new THREE.Line(geometry, materials.line);
    group.add(line);
  }
  return group;
};

export interface Architecture {
  group: THREE.Group;
  maxHeight: number;
  update: (time: number, progress: number, pulse: number, live: LiveFeature | null, elapsed: number) => void;
  setMaterialOverrides: (params: MaterialParams) => void;
  dispose: () => void;
}

export const createArchitecture = (
  design: DesignSpec,
  style: StyleKey,
  materials: MaterialBundle,
  quality: 'high' | 'balanced' | 'low',
): Architecture => {
  const root = new THREE.Group();
  root.name = 'architecture';
  const modules: THREE.Object3D[] = [];
  const spinners: { object: THREE.Object3D; speed: number }[] = [];
  const bornObjects: { object: THREE.Object3D; birth: number }[] = [];
  const rng = mulberry32(design.seed ^ 0x551a);

  const foundation = buildFoundation(design, style, materials);
  root.add(foundation);
  modules.push(foundation);

  design.arches.forEach((spec) => {
    const arch = createArch(spec, style, materials);
    root.add(arch);
    modules.push(arch);
  });

  design.chambers.forEach((spec) => {
    const chamber = createChamber(spec, design, style, materials);
    root.add(chamber);
    modules.push(chamber);
    const spinner = chamber.userData.spinners?.[0] as THREE.Object3D | undefined;
    if (spinner) spinners.push({ object: spinner, speed: spinner.userData.spin ?? 0.04 });
    void rng;
  });

  design.bridges.forEach((spec) => {
    const bridge = createBridge(spec, style, materials);
    root.add(bridge);
    modules.push(bridge);
  });

  design.rings.forEach((spec) => {
    const ring = createRing(spec, design, style, materials);
    root.add(ring);
    modules.push(ring);
    spinners.push({ object: ring, speed: ring.userData.spin ?? 0.03 });
  });

  const columns = buildColumns(design.columns, style, materials);
  root.add(columns.group);
  const stairs = buildStairs(design, style, materials);
  root.add(stairs.group);
  const shards = buildShards(design, style, materials);
  root.add(shards);
  const spires = buildSpires(design, style, materials);
  root.add(spires);
  modules.push(spires);
  const oculus = buildOculus(design, style, materials);
  root.add(oculus);
  modules.push(oculus);

  let particles: THREE.Points | null = null;
  if (quality !== 'low' || design.particleCount < 3000) {
    particles = buildParticles(design, style, materials);
    root.add(particles);
  }

  const membrane =
    style === 'organic' || style === 'crystal'
      ? createMembrane(design.arches, style, materials.membrane)
      : null;
  if (membrane) {
    membrane.userData.birth = design.duration * 0.18;
    membrane.userData.grow = 'y';
    membrane.userData.growDuration = 2.4;
    root.add(membrane);
    modules.push(membrane);
  }

  const columns_active = (time: number): number => {
    let count = 0;
    for (const birth of columns.births) {
      if (birth <= time + 0.03) count += 1;
    }
    return count;
  };
  const stepsActive = (time: number): number => {
    let count = 0;
    for (const birth of stairs.births) {
      if (birth <= time + 0.03) count += 1;
    }
    return count;
  };
  const sortedShards = shards.userData.sorted as DesignSpec['shards'];
  const shardBirths = sortedShards.map((shard) => shard.birth);
  const shardBase = sortedShards.map((shard) => radial(shard.angle, shard.radius, shard.y));
  const dummy = new THREE.Object3D();
  let currentShardCount = 0;

  const update = (
    time: number,
    progress: number,
    pulse: number,
    live: LiveFeature | null,
    elapsed: number,
  ): void => {
    for (const module of modules) {
      const birth = Number(module.userData.birth ?? 0);
      const growDuration = Number(module.userData.growDuration ?? 0.8);
      const raw = clamp((time - birth) / growDuration, 0, 1);
      const growth = easeOutCubic(raw);
      module.visible = time >= birth - 0.02;
      if (!module.visible) continue;
      if (module.userData.grow === 'y') {
        module.scale.set(1, Math.max(0.0001, growth), 1);
      } else if (module.userData.grow === 'x') {
        module.scale.set(Math.max(0.0001, growth), 1, 1);
      } else {
        module.scale.setScalar(Math.max(0.0001, growth));
      }
    }

    for (const { object, speed } of spinners) {
      object.rotation.y = elapsed * speed;
    }

    const cols = columns_active(time);
    columns.main.count = cols;
    columns.glow.count = cols;
    const stepCount = stepsActive(time);
    stairs.steps.count = stepCount;
    if (stairs.glowSteps) stairs.glowSteps.count = stepCount;

    let activeShardCount = 0;
    for (let i = 0; i < shardBirths.length; i += 1) {
      if (shardBirths[i] <= time + 0.04) activeShardCount += 1;
    }
    if (activeShardCount !== currentShardCount) {
      currentShardCount = activeShardCount;
      shards.count = activeShardCount;
    }
    if (activeShardCount > 0) {
      for (let i = 0; i < activeShardCount; i += 1) {
        const shard = sortedShards[i];
        const base = shardBase[i];
        dummy.position.set(
          base.x + Math.sin(elapsed * 0.24 + shard.spin) * 0.12,
          base.y + Math.sin(elapsed * 0.36 + shard.spin * 1.7) * 0.22,
          base.z + Math.cos(elapsed * 0.22 + shard.spin) * 0.12,
        );
        dummy.rotation.set(shard.spin + elapsed * 0.06, shard.angle + elapsed * 0.1, shard.spin * 0.6);
        dummy.scale.setScalar(shard.size * design.scale * (1 + (live?.high ?? 0) * 0.1));
        dummy.updateMatrix();
        shards.setMatrixAt(i, dummy.matrix);
      }
      shards.instanceMatrix.needsUpdate = true;
    }

    if (particles) {
      const material = particles.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = elapsed;
      material.uniforms.uProgress.value = progress;
      material.uniforms.uPulse.value = pulse;
      material.uniforms.uPixelRatio.value = Math.min(2, window.devicePixelRatio || 1);
    }
    void rng;
  };

  const dispose = (): void => {
    root.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
        object.geometry?.dispose();
      }
    });
    root.clear();
  };

  return {
    group: root,
    maxHeight: design.height,
    update,
    setMaterialOverrides: () => {
      // Material parameters are applied by the owning engine.
    },
    dispose,
  };
};
