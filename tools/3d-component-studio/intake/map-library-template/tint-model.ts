import { AmbientLight, DirectionalLight, Scene, Camera, Mesh, MeshStandardMaterial, BoxGeometry, SphereGeometry, Matrix4, Vector3, WebGLRenderer } from 'three';
import { MercatorCoordinate, type Map, type CustomLayerInterface } from 'maplibre-gl';

/** Procedural documentation sample, not a geographic landmark or a component dependency. */
export function modelDemo(map: Map) {
  const scene = new Scene(), camera = new Camera(), material = new MeshStandardMaterial({ color: '#ffffff', roughness: .85 });
  const geometries = [new BoxGeometry(55, 95, 45), new SphereGeometry(24, 24, 16)];
  const body = new Mesh(geometries[0], material), roof = new Mesh(geometries[1], material);
  body.position.set(0, 47.5, 0); roof.position.set(0, 120, 0); scene.add(body, roof, new AmbientLight('#ffffff', 1.4));
  const light = new DirectionalLight('#ffffff', 2); light.position.set(60, 150, 80); scene.add(light);
  const origin = MercatorCoordinate.fromLngLat([121.49517, 31.24194]), unit = origin.meterInMercatorCoordinateUnits();
  const local = new Matrix4().makeTranslation(origin.x, origin.y, origin.z).scale(new Vector3(unit, -unit, unit)).multiply(new Matrix4().makeRotationX(Math.PI / 2));
  let renderer: WebGLRenderer | undefined, removed = false;
  const release = () => { if (removed) return; removed = true; map.fire('heatmodelremove'); geometries.forEach(g => g.dispose()); material.dispose(); renderer?.dispose(); };
  const layer: CustomLayerInterface = {
    id: 'restored-docs-model', type: 'custom', renderingMode: '3d',
    onAdd(_map, gl) { renderer = new WebGLRenderer({ canvas: map.getCanvas(), context: gl as WebGL2RenderingContext }); renderer.autoClear = false; },
    render(_gl, args) {
      if (removed || !renderer) return;
      camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(local);
      map.fire('heatmodelrender', { scene, sceneToMercator: local, renderer });
      renderer.resetState(); renderer.render(scene, camera);
    },
    onRemove: release
  };
  const mount = () => { if (!removed && !map.getLayer(layer.id)) map.addLayer(layer); };
  map.on('style.load', mount); if (map.isStyleLoaded()) mount();
  return () => { map.off('style.load', mount); if (map.getLayer(layer.id)) map.removeLayer(layer.id); else release(); };
}
