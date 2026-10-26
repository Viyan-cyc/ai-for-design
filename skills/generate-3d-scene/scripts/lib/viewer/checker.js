/** Single browser model checker shared by the local viewer and the controlled-browser test backend.
 * Same three.js loaders, DRACO decoder, bounds test and disposal path as the delivered scene runtime. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { measureModel } from './measure.js';

export const CHECKER_VERSION = '1.1.0';

function disposeTree(root) {
  root?.traverse?.((o) => {
    o.geometry?.dispose();
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m) continue;
      for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
      m.dispose();
    }
  });
}

/** Loads only same-origin resources; external references are rejected, not fetched.
 * `resolve` lets a fully offline page map relative URIs onto embedded data URLs instead. */
function localManager(resolve) {
  const manager = new THREE.LoadingManager();
  let failed = false;
  manager.onError = () => { failed = true; };
  manager.setURLModifier((u) => {
    if (/^(blob:|data:)/.test(u)) return u;
    if (resolve) {
      const mapped = resolve(u);
      if (mapped) return mapped;
      throw new Error('Model resource is not part of this package');
    }
    const absolute = new URL(u, location.href);
    if (absolute.origin !== location.origin) throw new Error('External model resource blocked');
    return absolute.href;
  });
  return { manager, failed: () => failed };
}

const makeLoader = (manager, decoderPath = '/draco/') => new GLTFLoader(manager).setDRACOLoader(new DRACOLoader(manager).setDecoderPath(decoderPath));

/** Fixed two-view check; resolves to a PNG plus limited measurements, or throws with a reason. */
export async function checkModel(url, options = {}) {
  const { manager, failed } = localManager(options.resolve);
  const loader = makeLoader(manager, options.decoderPath);
  let renderer, model;
  try {
    model = await loader.loadAsync(url);
    if (failed()) throw new Error('Model dependency failed to load');
    const obj = model.scene;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (box.isEmpty() || ![...size, ...center].every(Number.isFinite) || size.length() === 0) throw new Error('Empty or invalid model bounds');
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(800, 400);
    renderer.setClearColor('#e5e9ee');
    renderer.setScissorTest(true);
    let shaderFailed = false;
    renderer.debug.onShaderError = () => { shaderFailed = true; };
    const scene = new THREE.Scene();
    scene.add(obj);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x647080, 3));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.copy(center).add(new THREE.Vector3(3, 5, 4).multiplyScalar(size.length()));
    scene.add(light);
    const camera = new THREE.PerspectiveCamera(40, 1, Math.max(size.length() / 10000, 0.0001), size.length() * 20);
    // Fixed-material render path, culling disabled: stable draw_calls, per-view reset, max of two views.
    obj.traverse((o) => { o.frustumCulled = false; });
    let drawCalls = 0;
    for (let i = 0; i < 2; i++) {
      camera.position.copy(center).add(new THREE.Vector3(i ? -1 : 1, 0.6, 1).normalize().multiplyScalar(size.length() * 1.65));
      camera.lookAt(center);
      renderer.setViewport(i * 400, 0, 400, 400);
      renderer.setScissor(i * 400, 0, 400, 400);
      renderer.info.reset();
      renderer.render(scene, camera);
      drawCalls = Math.max(drawCalls, renderer.info.render.calls);
    }
    if (shaderFailed || renderer.getContext().isContextLost() || renderer.getContext().getError() !== 0) throw new Error('Model render failed');
    const measured = measureModel(THREE, obj);
    return { image: renderer.domElement.toDataURL('image/png').split(',')[1], bbox: { min: box.min.toArray(), max: box.max.toArray(), size: size.toArray() }, meshes: measured.meshes, instanced: measured.instanced, skinned: measured.skinned, triangles: measured.triangles, nodeCount: measured.nodeCount, drawCalls, textureCount: measured.textureCount, maxTextureSize: measured.maxTextureSize, unknownTextureDimensions: measured.unknownTextureDimensions };
  } finally {
    disposeTree(model?.scene);
    loader.dracoLoader?.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
}

/** Interactive view for identification; the user only rotates and zooms. */
export async function mountModel(container, url, options = {}) {
  const { manager, failed } = localManager(options.resolve);
  const loader = makeLoader(manager, options.decoderPath);
  const model = await loader.loadAsync(url);
  if (failed()) throw new Error('Model dependency failed to load');
  const obj = model.scene;
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  if (box.isEmpty() || size.length() === 0) throw new Error('Empty or invalid model bounds');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(obj);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x647080, 3));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.copy(center).add(new THREE.Vector3(3, 5, 4).multiplyScalar(size.length()));
  scene.add(light);
  const camera = new THREE.PerspectiveCamera(45, 1, Math.max(size.length() / 10000, 0.0001), size.length() * 20);
  camera.position.copy(center).add(new THREE.Vector3(1, 0.6, 1).normalize().multiplyScalar(size.length() * 1.65));
  camera.lookAt(center);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(center);
  controls.update();
  const resize = () => {
    const w = container.clientWidth || innerWidth || 640, h = container.clientHeight || innerHeight || 400;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);
  let raf;
  const loop = () => { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
  loop();
  return {
    dispose() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      controls.dispose();
      disposeTree(obj);
      loader.dracoLoader?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

window.checker = { version: CHECKER_VERSION, check: checkModel, mount: mountModel };
window.checkerReady = true;
