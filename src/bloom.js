import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

const BLOOM_LAYER_ID = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_LAYER_ID);

const darkMaterial = new THREE.MeshBasicMaterial({
  color: 0x000000,
  toneMapped: false,
});
const savedMaterials = Object.create(null);
const boostMaterials = Object.create(null); // uuid -> bright temp material used only during bloom pass

export function setupBloom(
  renderer,
  scene,
  camera,
  { threshold = 0.12, strength = 1.35, radius = 0.65 } = {}
) {
  // --- passes ---
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
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D baseTexture;
        uniform sampler2D bloomTexture;
        varying vec2 vUv;
        void main(){
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

  // ---- default boost used only if you never call setBoost on a mesh ----
  let defaultBoost = { color: new THREE.Color(0xffffff), intensity: 1.0 };
  function setDefaultBoost({ color = "#ffffff", intensity = 1.0 } = {}) {
    defaultBoost = {
      color: color instanceof THREE.Color ? color : new THREE.Color(color),
      intensity: intensity ?? 1.0,
    };
  }

  // ---- bloom render prep ----
  function prepareBloom(obj) {
    if (!obj.isMesh) return;

    savedMaterials[obj.uuid] = obj.material;

    if (!bloomLayer.test(obj.layers)) {
      obj.material = darkMaterial;
      return;
    }

    const boost = obj.userData._bloomBoost || defaultBoost;

    let m = boostMaterials[obj.uuid];
    if (!m) {
      // IMPORTANT: toneMapped true + direct multiply by intensity (your old working path)
      m = new THREE.MeshBasicMaterial({ toneMapped: true });
      boostMaterials[obj.uuid] = m;
    }

    const c =
      boost.color instanceof THREE.Color
        ? boost.color
        : new THREE.Color(boost.color);
    m.color.copy(c).multiplyScalar(boost.intensity ?? 1.0);
    m.needsUpdate = true;

    obj.material = m;
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

  // ---- public helpers ----
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

  function setBoost(obj, { color = "#ffffff", intensity = 1 } = {}) {
    if (!obj) return;
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    obj.userData._bloomBoost = { color: c, intensity: intensity ?? 1 };
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

  // Optional: zero emissive so bloom is the only glow knob
  function neutralize(obj) {
    if (!obj) return;
    const apply = (mesh) => {
      if (!mesh || !mesh.isMesh) return;
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const m of mats) {
        if (!m || !("emissive" in m)) continue;
        m.emissive.setRGB(0, 0, 0);
        if ("emissiveIntensity" in m) m.emissiveIntensity = 0;
        m.needsUpdate = true;
      }
    };
    if (typeof obj.traverse === "function") obj.traverse(apply);
    else apply(obj);
  }

  return {
    render,
    resize,
    mark,
    markByName,
    setBoost,
    setBoostByName,
    setParams,
    setDefaultBoost,
    neutralize,
    BLOOM_LAYER_ID,
  };
}
