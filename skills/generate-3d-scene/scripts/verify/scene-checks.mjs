/** Deterministic checks shared by the runner and its contract tests. */
export const compareGroups = (expected, actual) => {
  const mismatches = [];
  for (const group of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    const want = expected[group] ?? []; const got = actual[group] ?? [];
    const wantSet = new Set(want); const gotSet = new Set(got);
    if (wantSet.size !== want.length || gotSet.size !== got.length
      || want.length !== got.length || want.some((id) => !gotSet.has(id))) {
      mismatches.push({ group, expected: want, actual: got });
    }
  }
  const all = Object.values(expected).flat();
  if (new Set(all).size !== all.length || all.some((id) => typeof id !== 'string' || !id)) {
    mismatches.push({ group: '*', error: 'expected IDs must be unique nonempty strings' });
  }
  return { ok: mismatches.length === 0, mismatches };
};

/** WebGL projection convention; reject only if the entire AABB is outside one plane. */
export const intersectsFrustumBox = (box, m) => {
  if (!box || [0, 1, 2].some((i) => box.min[['x', 'y', 'z'][i]] > box.max[['x', 'y', 'z'][i]])) {
    return false;
  }
  const planes = [
    [m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]],
    [m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]],
    [m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]],
    [m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]],
    [m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]],
    [m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]],
  ];
  return planes.every(([x, y, z, d]) => {
    const distance = x * (x >= 0 ? box.max.x : box.min.x)
      + y * (y >= 0 ? box.max.y : box.min.y) + z * (z >= 0 ? box.max.z : box.min.z) + d;
    return Number.isFinite(distance) && distance >= -1e-7 * Math.hypot(x, y, z);
  });
};

/** Serializable browser function; dependencies are explicit for direct unit tests. */
export const inspectSubject = (handle, intersects) => {
  const { sceneEngine: se, camera } = handle.internals;
  if (!camera?.projectionMatrix?.clone || !camera.updateMatrixWorld) {
    return { ok: false, why: 'camera interface unavailable' };
  }
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const m = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).elements;
  let tested = 0; let found;
  const seen = new Set();
  for (const id of se.getAllIds()) {
    const root = se.getObject(id);
    if (!root) {
      continue;
    }
    let ancestorsVisible = true;
    for (let p = root; p; p = p.parent) {
      if (!p.visible) {
        ancestorsVisible = false; break;
      }
    }
    if (!ancestorsVisible) {
      continue;
    }
    root.updateWorldMatrix(true, true);
    root.traverseVisible((object) => {
      if (found || seen.has(object)) {
        return;
      }
      seen.add(object);
      if (!(object.isMesh || object.isLine || object.isPoints || object.isSprite)) {
        return;
      }
      if (!camera.layers.test(object.layers)) {
        return;
      }
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (!materials.some((mat) => mat?.visible && (!mat.transparent || mat.opacity > 0))) {
        return;
      }
      const box = se.getSkinnedAwareBox(object);
      if (!box || box.isEmpty()) {
        return;
      }
      tested += 1;
      if (intersects(box, m)) {
        found = id;
      }
    });
    if (found) {
      break;
    }
  }
  return {
    ok: Boolean(found), tested, id: found, why: found ? undefined : 'no visible renderable object intersects camera frustum',
  };
};

export const inspectCanvas = () => {
  const canvas = document.getElementById('scene-canvas');
  if (!canvas) {
    return { ok: false, why: 'canvas missing' };
  }
  for (let node = canvas; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility)
      || Number(style.opacity) === 0 || style.contentVisibility === 'hidden') {
      return { ok: false, why: 'canvas or ancestor hidden/transparent' };
    }
  }
  const r = canvas.getBoundingClientRect();
  const left = Math.max(0, r.left); const top = Math.max(0, r.top);
  const right = Math.min(window.innerWidth, r.right); const bottom = Math.min(window.innerHeight, r.bottom);
  if (right - left < 10 || bottom - top < 10) {
    return { ok: false, why: 'canvas has no usable viewport area' };
  }
  for (const fx of [0.2, 0.5, 0.8]) {
    for (const fy of [0.2, 0.5, 0.8]) {
      if (document.elementFromPoint(left + fx * (right - left), top + fy * (bottom - top)) === canvas) {
        return { ok: true, rect: [r.width, r.height] };
      }
    }
  }
  return { ok: false, why: 'canvas input blocked at all sample points' };
};
