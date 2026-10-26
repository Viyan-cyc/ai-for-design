/** Shared measurement statistics (standards spec §4.2). One source of truth for the browser
 * page and the controlled backend: triangles by topology/instances, node_count over the model's
 * own Object3D tree, unique texture image sources and real image dimensions. */

/** Triangles for one mesh object by draw-mode topology; InstancedMesh multiplies by count. */
export function meshTriangles(object) {
  if (!object.isMesh || !object.geometry) return 0;
  const geometry = object.geometry;
  let count;
  if (geometry.index) count = geometry.index.count;
  else {
    const position = geometry.attributes?.position;
    count = position ? position.count : 0;
  }
  let triangles = Math.floor(count / 3);
  const drawMode = object.drawMode;
  if (drawMode === 1 || drawMode === 2) triangles = Math.max(0, count - 2); // TRIANGLE_STRIP / TRIANGLE_FAN
  if (object.isInstancedMesh) triangles *= object.count;
  return triangles;
}

/** Node count of the model's own tree, including Group/Mesh/Bone; primitive-split children count.
 * Excludes the loader's wrapper scene container: the passed root is the GLTFLoader scene container. */
export function countNodes(root) {
  let n = 0;
  root.traverse((node) => { if(node !== root) n += 1; });
  return n;
}

/** Unique texture image sources actually referenced by materials (same source in several slots counts once). */
export function countTextures(root) {
  const sources = new Set();
  const unknown = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (!value?.isTexture) continue;
        const source = value.source;
        const image = source?.data ?? value.image;
        if (!image) continue;
        // Use the Source object identity — one upload, one unique image.
        if (source) sources.add(source);
        else sources.add(image);
        const w = image?.width, h = image?.height;
        if (!Number.isFinite(w) || !Number.isFinite(h) || !w || !h) unknown.push(value);
      }
    }
  });
  let maxSize = 0;
  for (const sourceOrImage of sources) {
    const image = sourceOrImage.data ?? sourceOrImage;
    const w = Number(image?.width), h = Number(image?.height);
    if (Number.isFinite(w) && Number.isFinite(h)) maxSize = Math.max(maxSize, w, h);
  }
  return { textureCount: sources.size, maxTextureSize: maxSize, unknownDimensions: unknown.length };
}

/** All measurements for a loaded model root, plus bbox min/max in asset space. */
export function measureModel(three, root) {
  root.updateMatrixWorld(true);
  const box = new three.Box3().setFromObject(root);
  let triangles = 0, meshes = 0, instanced = false, skinned = false;
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes += 1;
    if (o.isInstancedMesh) instanced = true;
    if (o.isSkinnedMesh) skinned = true;
    triangles += meshTriangles(o);
  });
  const textures = countTextures(root);
  return {
    bbox: { min: box.min.toArray(), max: box.max.toArray() },
    meshes, triangles, instanced, skinned,
    nodeCount: countNodes(root),
    textureCount: textures.textureCount,
    maxTextureSize: textures.maxTextureSize,
    unknownTextureDimensions: textures.unknownDimensions,
  };
}
