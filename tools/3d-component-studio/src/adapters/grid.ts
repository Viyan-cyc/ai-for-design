import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Grid } from '@grid-baseline';
import { validatePreset } from '../contract.mjs';

export function createGridPreview(host: HTMLElement, input: unknown) {
  const preset = validatePreset(input);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', '已有Grid三维网格预览');
  canvas.tabIndex = 0;
  // Register ownership immediately, before configuring resources or acquiring the next one.
  const cleanups: Array<() => void> = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    // One failing cleanup must not prevent the other resources from being released.
    for (const cleanup of cleanups.reverse()) {
      try { cleanup(); } catch (error) { console.error('Grid cleanup failed', error); }
    }
    cleanups.length = 0;
    canvas.remove();
  };
  try {
    // Own the context before WebGLRenderer construction, including constructor failures.
    const context = canvas.getContext('webgl2');
    if (!context) throw new Error('WebGL2不可用');
    cleanups.push(() => context.getExtension('WEBGL_lose_context')?.loseContext());
    const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
    cleanups.push(() => renderer.dispose());
    renderer.setPixelRatio(Math.min(devicePixelRatio, preset.performance.maxDpr));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e8ecf1');
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
    camera.position.set(7, 5, 9);
    camera.lookAt(0, 0, 0);
    const grid = new Grid({ primaryScale: preset.design.primaryScale, secondaryScale: 1,
      color: preset.design.color, fadeStart: 20, fadeEnd: 80 });
    cleanups.push(() => grid.dispose());
    scene.add(grid);
    const material = new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.4, metalness: 0.2 });
    cleanups.push(() => material.dispose());
    for (const [x, y, z, size] of [[0, .5, 0, 1], [4, .75, -3, 1.5], [-3, .5, 3, 1]]) {
      const geometry = new THREE.BoxGeometry(size, size, size);
      cleanups.push(() => geometry.dispose());
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      scene.add(mesh);
    }
    scene.add(new THREE.AmbientLight(0xffffff, 2));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(5, 8, 5);
    scene.add(light);
    // Connect separately so cleanup is already registered if listener setup fails.
    const orbit = new OrbitControls(camera);
    cleanups.push(() => orbit.dispose());
    orbit.connect(canvas);
    orbit.enableDamping = false;
    orbit.target.set(0, 0, 0);
    orbit.update();
    const render = () => { if (!disposed) renderer.render(scene, camera); };
    const resize = () => {
      if (disposed) return;
      const width = Math.max(host.clientWidth, 320), height = Math.max(host.clientHeight, 320);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    };
    cleanups.push(() => orbit.removeEventListener('change', render));
    orbit.addEventListener('change', render);
    const observer = new ResizeObserver(resize);
    cleanups.push(() => observer.disconnect());
    resize();
    if (context.isContextLost()) throw new Error('WebGL上下文丢失');
    return {
      mount() {
        if (disposed) throw new Error('预览已释放');
        const previousNodes = Array.from(host.childNodes);
        try {
          // Complete fallible preparation while the previous canvas is still visible.
          observer.observe(host);
          host.replaceChildren(canvas);
        } catch (error) {
          // Also handle a DOM commit that mutates before throwing.
          try {
            if (previousNodes.length !== host.childNodes.length ||
                previousNodes.some((node, i) => node !== host.childNodes[i])) {
              host.replaceChildren(...previousNodes);
            }
          } finally { dispose(); }
          throw error;
        }
      },
      dispose,
      applyPreset(value: unknown) {
        const next = validatePreset(value);
        grid.setPrimaryScale(next.design.primaryScale);
        grid.setColor(next.design.color);
        render();
      },
      resetView() {
        camera.position.set(7, 5, 9);
        orbit.target.set(0, 0, 0);
        orbit.update();
        render();
      }
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
