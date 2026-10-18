import * as THREE from 'three';
import { styleByKey, type LightParams, type MaterialParams, type StyleKey } from '../types';

export interface MaterialBundle {
  main: THREE.MeshPhysicalMaterial;
  secondary: THREE.MeshPhysicalMaterial;
  accent: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  membrane: THREE.MeshPhysicalMaterial;
  glow: THREE.MeshBasicMaterial;
  glowWarm: THREE.MeshBasicMaterial;
  metal: THREE.MeshStandardMaterial;
  line: THREE.LineBasicMaterial;
  lineWarm: THREE.LineBasicMaterial;
  accentColor: THREE.Color;
  warmColor: THREE.Color;
  baseRoughness: { main: number; secondary: number; glass: number };
  apply: (params: MaterialParams, lights: LightParams) => void;
  dispose: () => void;
}

const mat = (options: THREE.MeshPhysicalMaterialParameters): THREE.MeshPhysicalMaterial =>
  new THREE.MeshPhysicalMaterial(options);

export const makeMaterialBundle = (style: StyleKey): MaterialBundle => {
  const meta = styleByKey(style);
  const accentColor = new THREE.Color(meta.accent);
  const warmColor = new THREE.Color(style === 'machine' ? '#ff7a45' : '#efd8b2');

  let main: THREE.MeshPhysicalMaterial;
  let secondary: THREE.MeshPhysicalMaterial;
  let glass: THREE.MeshPhysicalMaterial;
  let membrane: THREE.MeshPhysicalMaterial;
  let metal: THREE.MeshStandardMaterial;
  let accent: THREE.MeshStandardMaterial;
  let glow: THREE.MeshBasicMaterial;
  let glowWarm: THREE.MeshBasicMaterial;
  let line: THREE.LineBasicMaterial;
  let lineWarm: THREE.LineBasicMaterial;

  if (style === 'crystal') {
    main = mat({
      color: 0x33322f,
      roughness: 0.34,
      metalness: 0.52,
      clearcoat: 0.55,
      clearcoatRoughness: 0.24,
      envMapIntensity: 1.1,
    });
    secondary = mat({
      color: 0xc9c0ad,
      roughness: 0.5,
      metalness: 0.08,
      clearcoat: 0.3,
      clearcoatRoughness: 0.5,
      envMapIntensity: 0.8,
    });
    glass = mat({
      color: 0xb7e6ef,
      roughness: 0.08,
      metalness: 0,
      transmission: 0.86,
      thickness: 1.4,
      ior: 1.48,
      attenuationColor: new THREE.Color(0x5da4b4),
      attenuationDistance: 2.2,
      transparent: true,
      opacity: 0.7,
      envMapIntensity: 1.4,
      side: THREE.DoubleSide,
    });
    membrane = mat({
      color: 0xa8dbe2,
      roughness: 0.2,
      metalness: 0,
      transmission: 0.45,
      thickness: 0.35,
      transparent: true,
      opacity: 0.1,
      envMapIntensity: 1.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    metal = new THREE.MeshStandardMaterial({
      color: 0xc2a36d,
      metalness: 1,
      roughness: 0.2,
      envMapIntensity: 1.5,
    });
    accent = new THREE.MeshStandardMaterial({
      color: 0x6f6757,
      emissive: 0xe6cc96,
      emissiveIntensity: 0.36,
      metalness: 0.55,
      roughness: 0.32,
    });
    glow = new THREE.MeshBasicMaterial({
      color: 0xe8d8b8,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    glowWarm = new THREE.MeshBasicMaterial({
      color: 0x9adbe8,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    line = new THREE.LineBasicMaterial({
      color: 0xe2d6bd,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    lineWarm = new THREE.LineBasicMaterial({
      color: 0x95d2dc,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  } else if (style === 'machine') {
    main = mat({
      color: 0x171c22,
      roughness: 0.32,
      metalness: 0.9,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
      envMapIntensity: 1.25,
    });
    secondary = mat({
      color: 0x8d99a5,
      roughness: 0.18,
      metalness: 1,
      clearcoat: 0.7,
      clearcoatRoughness: 0.2,
      envMapIntensity: 1.5,
    });
    glass = mat({
      color: 0x203d45,
      roughness: 0.14,
      metalness: 0.2,
      transmission: 0.68,
      thickness: 0.8,
      transparent: true,
      opacity: 0.42,
      envMapIntensity: 1.2,
      side: THREE.DoubleSide,
    });
    membrane = mat({
      color: 0x1a4953,
      roughness: 0.25,
      metalness: 0.1,
      transmission: 0.3,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    metal = new THREE.MeshStandardMaterial({
      color: 0x10151b,
      metalness: 1,
      roughness: 0.28,
    });
    accent = new THREE.MeshStandardMaterial({
      color: 0x0c2228,
      emissive: 0x69e4ff,
      emissiveIntensity: 2.4,
      metalness: 0.2,
      roughness: 0.28,
    });
    glow = new THREE.MeshBasicMaterial({
      color: 0x7aeaff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    glowWarm = new THREE.MeshBasicMaterial({
      color: 0xff7c48,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    line = new THREE.LineBasicMaterial({
      color: 0x75e7ff,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    lineWarm = new THREE.LineBasicMaterial({
      color: 0xff7a45,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  } else {
    main = mat({
      color: 0xc79988,
      roughness: 0.3,
      metalness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.16,
      iridescence: 0.8,
      iridescenceIOR: 1.4,
      sheen: 0.7,
      sheenColor: new THREE.Color(0xffcbb8),
      envMapIntensity: 1.2,
    });
    secondary = mat({
      color: 0xe9ded0,
      roughness: 0.48,
      metalness: 0.05,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
      sheen: 0.4,
      sheenColor: new THREE.Color(0x8dd6ca),
      envMapIntensity: 0.9,
    });
    glass = mat({
      color: 0xb5e2d8,
      roughness: 0.2,
      metalness: 0,
      transmission: 0.7,
      thickness: 0.7,
      transparent: true,
      opacity: 0.4,
      envMapIntensity: 1.2,
      side: THREE.DoubleSide,
    });
    membrane = mat({
      color: 0xf0b4a3,
      roughness: 0.22,
      metalness: 0,
      transmission: 0.52,
      thickness: 0.55,
      ior: 1.36,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
      iridescence: 1,
      iridescenceIOR: 1.3,
      envMapIntensity: 1.2,
    });
    metal = new THREE.MeshStandardMaterial({
      color: 0xd9b9a9,
      metalness: 0.7,
      roughness: 0.3,
    });
    accent = new THREE.MeshStandardMaterial({
      color: 0x5a3630,
      emissive: 0xf09b83,
      emissiveIntensity: 0.45,
      metalness: 0.2,
      roughness: 0.4,
    });
    glow = new THREE.MeshBasicMaterial({
      color: 0xf6c0ae,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    glowWarm = new THREE.MeshBasicMaterial({
      color: 0x8fd9cc,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    line = new THREE.LineBasicMaterial({
      color: 0xf2b9a8,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    lineWarm = new THREE.LineBasicMaterial({
      color: 0x8bd5c7,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  const baseRoughness = {
    main: main.roughness,
    secondary: secondary.roughness,
    glass: glass.roughness,
  };

  const apply = (params: MaterialParams, lights: LightParams): void => {
    const gloss = Math.min(1, Math.max(0, params.gloss));
    main.roughness = THREE.MathUtils.clamp(baseRoughness.main * (1.65 - gloss * 1.25), 0.03, 0.88);
    secondary.roughness = THREE.MathUtils.clamp(baseRoughness.secondary * (1.65 - gloss * 1.2), 0.03, 0.9);
    glass.roughness = THREE.MathUtils.clamp(baseRoughness.glass * (1.6 - gloss * 1.2), 0.02, 0.65);
    metal.roughness = THREE.MathUtils.clamp(0.05 + (1 - gloss) * 0.48, 0.04, 0.65);
    glass.transmission = THREE.MathUtils.lerp(0.15, 0.95, params.transmission);
    glass.opacity = THREE.MathUtils.lerp(0.95, 0.45, params.transmission);
    membrane.opacity = style === 'organic' ? 0.08 + params.transmission * 0.28 : 0.06 + params.transmission * 0.16;
    const intensity = 0.65 + lights.rim * 0.8;
    accent.emissiveIntensity = (style === 'machine' ? 2.1 : 0.6) * intensity;
    glow.opacity = (style === 'machine' ? 0.4 : 0.26) * (0.55 + lights.rim * 0.7);
    glowWarm.opacity = (style === 'machine' ? 0.34 : 0.22) * (0.5 + lights.key * 0.55);
    main.envMapIntensity = 0.65 + lights.ambient * 0.9;
    secondary.envMapIntensity = 0.55 + lights.ambient * 0.8;
  };

  const materials = [main, secondary, accent, glass, membrane, metal, glow, glowWarm, line, lineWarm];

  return {
    main,
    secondary,
    accent,
    glass,
    membrane,
    glow,
    glowWarm,
    metal,
    line,
    lineWarm,
    accentColor,
    warmColor,
    baseRoughness,
    apply,
    dispose: () => materials.forEach((material) => material.dispose()),
  };
};
