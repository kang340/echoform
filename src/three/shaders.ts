import * as THREE from 'three';
import type { StyleKey } from '../types';

export const createFloorMaterial = (
  style: StyleKey,
  accent: THREE.Color,
  warm: THREE.Color,
): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPulse: { value: 0 },
      uBass: { value: 0 },
      uProgress: { value: 1 },
      uAccent: { value: accent },
      uWarm: { value: warm },
      uStyle: { value: style === 'crystal' ? 0 : style === 'machine' ? 1 : 2 },
      uRadius: { value: 18 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      varying vec3 vWorld;
      uniform float uTime;
      uniform float uPulse;
      uniform float uBass;
      uniform float uProgress;
      uniform vec3 uAccent;
      uniform vec3 uWarm;
      uniform float uStyle;
      uniform float uRadius;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float angle = atan(p.y, p.x);
        float edge = smoothstep(1.0, 0.72, r);
        float fade = smoothstep(1.0, 0.08, r);
        vec3 base = vec3(0.007, 0.008, 0.009);
        float n = noise(p * 18.0 + uTime * 0.025);

        float rings = 0.0;
        if (uStyle < 0.5) {
          float ring = abs(sin(r * 44.0 - uTime * 0.22 + n * 0.8));
          rings = pow(max(0.0, 1.0 - ring * 18.0), 2.0) * 0.065;
          float spokes = pow(max(0.0, 1.0 - abs(sin(angle * 36.0 + 1.2)) * 22.0), 2.0) * 0.022;
          rings += spokes * smoothstep(0.12, 0.8, r);
        } else if (uStyle < 1.5) {
          vec2 grid = abs(fract(p * 16.0 + 0.5) - 0.5) / max(0.002, 0.025);
          float lines = smoothstep(0.0, 1.0, 1.0 - min(grid.x, grid.y));
          rings = lines * 0.028;
          float scan = smoothstep(0.004, 0.0, abs(r - fract(uTime * 0.06 + 0.15))) * 0.3;
          rings += scan;
        } else {
          float wobble = sin(angle * 5.0 + uTime * 0.16) * 0.04 + sin(angle * 9.0 - uTime * 0.1) * 0.02;
          float ring = abs(sin((r + wobble) * 32.0 - uTime * 0.35));
          rings = pow(max(0.0, 1.0 - ring * 16.0), 2.0) * 0.05;
          rings += pow(max(0.0, 1.0 - abs(sin(angle * 14.0 + n * 2.0)) * 9.0), 2.0) * 0.01;
        }

        float core = exp(-r * 8.0) * (0.06 + uPulse * 0.24 + uBass * 0.1);
        float pool = exp(-r * 3.2) * 0.035;
        vec3 color = base;
        color += uAccent * (rings * edge + core + pool);
        color += uWarm * exp(-r * 5.0) * uPulse * 0.05;
        color += vec3(n) * 0.004 * fade;
        color *= 0.85 + 0.15 * smoothstep(0.0, 0.4, uProgress);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

export const createAtmosphereMaterial = (
  style: StyleKey,
  accent: THREE.Color,
): THREE.ShaderMaterial => {
  const horizon =
    style === 'machine'
      ? new THREE.Color('#061019')
      : style === 'organic'
        ? new THREE.Color('#10090a')
        : new THREE.Color('#0b0c0e');
  const top =
    style === 'machine'
      ? new THREE.Color('#010307')
      : style === 'organic'
        ? new THREE.Color('#030203')
        : new THREE.Color('#020203');
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uHorizon: { value: horizon },
      uTop: { value: top },
      uAccent: { value: accent },
      uPulse: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vWorld;
      uniform vec3 uHorizon;
      uniform vec3 uTop;
      uniform vec3 uAccent;
      uniform float uTime;
      uniform float uPulse;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec3 dir = normalize(vWorld);
        float height = dir.y;
        vec3 color = mix(uHorizon, uTop, smoothstep(-0.15, 0.75, height));
        color += uAccent * pow(max(0.0, 1.0 - abs(height + 0.03) * 4.0), 4.0) * (0.012 + uPulse * 0.025);
        float grain = (hash(gl_FragCoord.xy + uTime * 2.0) - 0.5) * 0.008;
        color += grain;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
};

export const createCoreMaterial = (
  style: StyleKey,
  accent: THREE.Color,
  warm: THREE.Color,
): THREE.ShaderMaterial => {
  const deep =
    style === 'machine'
      ? new THREE.Color('#03151c')
      : style === 'organic'
        ? new THREE.Color('#2b0f0b')
        : new THREE.Color('#171109');
  return new THREE.ShaderMaterial({
    transparent: false,
    uniforms: {
      uTime: { value: 0 },
      uPulse: { value: 0 },
      uPitch: { value: 0 },
      uAccent: { value: accent },
      uWarm: { value: warm },
      uDeep: { value: deep },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vWorld;
      varying vec3 vView;
      uniform float uTime;
      uniform float uPulse;
      uniform float uPitch;
      void main() {
        float wave = sin(position.y * 5.2 + uTime * 1.5)
                   * sin(position.x * 4.4 - uTime * 1.15)
                   * sin(position.z * 3.8 + uTime * 0.85);
        vec3 displaced = position + normal * wave * (0.035 + uPulse * 0.05 + uPitch * 0.018);
        vec4 world = modelMatrix * vec4(displaced, 1.0);
        vWorld = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      varying vec3 vView;
      uniform float uTime;
      uniform float uPulse;
      uniform float uPitch;
      uniform vec3 uAccent;
      uniform vec3 uWarm;
      uniform vec3 uDeep;

      void main() {
        float fresnel = pow(1.0 - clamp(abs(dot(normalize(vNormalW), vView)), 0.0, 1.0), 2.2);
        float angle = atan(vWorld.z, vWorld.x);
        float bands = 0.5 + 0.5 * sin(vWorld.y * 7.5 - uTime * 2.4 + sin(angle * 6.0 + uTime * 0.6) * 2.2);
        float filaments = pow(0.5 + 0.5 * sin(vWorld.y * 24.0 + angle * 9.0 + uTime * 3.0), 18.0);
        vec3 color = mix(uDeep, uAccent, 0.25 + bands * 0.5);
        color += uWarm * filaments * (0.34 + uPulse * 0.46);
        color += uAccent * fresnel * 1.55;
        color *= 0.92 + uPulse * 0.55;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
};

export const createParticleMaterial = (
  style: StyleKey,
  accent: THREE.Color,
  warm: THREE.Color,
  maxY: number,
): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uPulse: { value: 0 },
      uPixelRatio: { value: 1 },
      uAccent: { value: accent },
      uWarm: { value: warm },
      uMaxY: { value: maxY },
      uStyle: { value: style === 'crystal' ? 0 : style === 'machine' ? 1 : 2 },
    },
    vertexShader: /* glsl */ `
      attribute float aBirth;
      attribute float aSize;
      attribute float aTone;
      attribute float aPhase;
      uniform float uTime;
      uniform float uProgress;
      uniform float uPulse;
      uniform float uPixelRatio;
      uniform float uMaxY;
      uniform float uStyle;
      varying float vAlpha;
      varying float vTone;
      varying float vFlicker;
      void main() {
        vec3 p = position;
        float drift = uStyle > 1.5 ? 0.34 : 0.16;
        p.y = mod(p.y + uTime * drift * (0.25 + aTone * 0.8) + aPhase, uMaxY + 5.0);
        p.x += sin(uTime * 0.32 + aPhase * 2.0) * (uStyle > 1.5 ? 0.6 : 0.25);
        p.z += cos(uTime * 0.28 + aPhase * 1.7) * (uStyle > 1.5 ? 0.6 : 0.25);
        float reveal = smoothstep(aBirth, aBirth + 0.09, uProgress);
        vAlpha = reveal * (0.16 + aTone * 0.72) * (0.55 + uPulse * 0.9);
        vTone = aTone;
        vFlicker = 0.72 + 0.28 * sin(uTime * 2.2 + aPhase * 4.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(aSize * (0.75 + uPulse * 0.4) * 280.0 / max(1.0, -mv.z), 0.6, 30.0) * uPixelRatio;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying float vAlpha;
      varying float vTone;
      varying float vFlicker;
      uniform vec3 uAccent;
      uniform vec3 uWarm;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float alpha = pow(smoothstep(0.5, 0.0, d), 1.7) * vAlpha * vFlicker;
        vec3 color = mix(uAccent, uWarm, vTone * 0.55);
        color += vec3(0.3) * pow(smoothstep(0.18, 0.0, d), 2.0);
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

export const createShaftMaterial = (accent: THREE.Color): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uAccent: { value: accent },
      uOpacity: { value: 0.055 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      varying vec3 vWorld;
      uniform vec3 uAccent;
      uniform float uTime;
      uniform float uOpacity;
      void main() {
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float vertical = pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.12, vUv.y);
        float breathe = 0.76 + 0.24 * sin(uTime * 0.7 + vWorld.x * 0.2);
        float alpha = edge * vertical * uOpacity * breathe;
        if (alpha < 0.001) discard;
        gl_FragColor = vec4(uAccent, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uVignette: { value: 1.0 },
    uGrain: { value: 0.028 },
    uAberration: { value: 0.0015 },
    uSaturation: { value: 1.04 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uSaturation;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float r2 = dot(centered, centered);
      vec2 shift = centered * r2 * uAberration * 4.0;
      float red = texture2D(tDiffuse, vUv + shift).r;
      float green = texture2D(tDiffuse, vUv).g;
      float blue = texture2D(tDiffuse, vUv - shift).b;
      vec3 color = vec3(red, green, blue);
      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(vec3(luma), color, uSaturation);
      float vignette = smoothstep(0.92, 0.2, length(centered) * 1.22);
      color *= mix(1.0, vignette, uVignette);
      float grain = hash(vUv * 2050.0 + fract(uTime) * 29.0) - 0.5;
      color += grain * uGrain * (1.0 - luma * 0.4);
      color = max(color, vec3(0.0));
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
