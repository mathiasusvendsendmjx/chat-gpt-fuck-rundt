// src/bloom.js
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

const BLOOM_LAYER_ID = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_LAYER_ID);

const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
const savedMaterials = Object.create(null);
const boostMaterials = Object.create(null); // uuid -> bright temp material

export function setupBloom(
  renderer,
  scene,
  camera,
  { threshold = 0.5, strength = 1, radius = 0.2 } = {}
) {
  const size = new THREE.Vector2();
  renderer.getSize(size);

  const renderScene = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(size, strength, radius, threshold);

  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(renderScene);
  bloomComposer.addPass(bloomPass);

  const finalPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture },
      },
      vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
      fragmentShader: `
      uniform sampler2D baseTexture;
      uniform sampler2D bloomTexture;
      varying vec2 vUv;
      void main() {
        vec4 base  = texture2D(baseTexture,  vUv);
        vec4 bloom = texture2D(bloomTexture, vUv);
        gl_FragColor = base + bloom; // additive
      }
    `,
    }),
    "baseTexture"
  );

  const finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(renderScene);
  finalComposer.addPass(finalPass);

  // During the bloom pass:
  // - Non-bloom objects -> darkMaterial (black)
  // - Bloom objects -> keep original OR (if boost set) swap to a bright temp material
function prepareBloom(obj) {
  if (!obj.isMesh) return;

  const isBloom = bloomLayer.test(obj.layers);
  savedMaterials[obj.uuid] = obj.material;

  if (!isBloom) {
    obj.material = darkMaterial;
    return;
  }

  const boost = obj.userData._bloomBoost;
  if (boost) {
    let m = boostMaterials[obj.uuid];
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: boost.color.clone() });
      boostMaterials[obj.uuid] = m;
    } else {
      // keep material color in sync with latest boost request
      m.color.copy(boost.color);
      m.needsUpdate = true;
    }
    obj.material = m;
  }
}

  function restoreMaterial(obj) {
    if (!obj.isMesh) return;
    const m = savedMaterials[obj.uuid];
    if (m) {
      obj.material = m;
      delete savedMaterials[obj.uuid];
    }
  }

  function render() {
    scene.traverse(prepareBloom);
    bloomComposer.render();
    scene.traverse(restoreMaterial);

    finalComposer.render();
  }

  function resize() {
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    bloomComposer.setSize(w, h);
    finalComposer.setSize(w, h);
  }
  window.addEventListener("resize", resize);

  // Public helpers
  function mark(obj, on = true) {
    if (!obj) return;
    if (on) obj.layers.enable(BLOOM_LAYER_ID);
    else obj.layers.disable(BLOOM_LAYER_ID);
  }
  function markByName(root, name, on = true) {
    const want = String(name).toLowerCase();
    root.traverse((o) => {
      if (o.isMesh && (o.name || "").toLowerCase() === want) mark(o, on);
    });
  }
  // inside setupBloom(...)
  function setBoost(obj, { color = "#ffffff", intensity = 2 } = {}) {
    if (!obj) return;

    // store desired bloom color/intensity on the mesh
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    obj.userData._bloomBoost = { color: c, intensity };

    // ensure there is a cached bright material AND keep it up to date
    let m = boostMaterials[obj.uuid];
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: c.clone() });
      boostMaterials[obj.uuid] = m;
    } else {
      m.color.copy(c);
      m.needsUpdate = true;
    }
  }
  function setBoostByName(root, name, opts) {
    const want = String(name).toLowerCase();
    root.traverse((o) => {
      if (o.isMesh && (o.name || "").toLowerCase() === want) setBoost(o, opts);
    });
  }
  function setParams({ threshold: t, strength: s, radius: r } = {}) {
    if (t !== undefined) bloomPass.threshold = t;
    if (s !== undefined) bloomPass.strength = s;
    if (r !== undefined) bloomPass.radius = r;
  }

  return {
    render,
    resize,
    mark,
    markByName,
    setBoost,
    setBoostByName,
    setParams,
    BLOOM_LAYER_ID,
  };
}
