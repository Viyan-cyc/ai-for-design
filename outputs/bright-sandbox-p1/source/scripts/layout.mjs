/** Deterministic expansion into normal scene nodes; no expressions/eval or runtime dependency. */
const reserved = new Set(['version', 'meta', 'scene', 'camera', 'lights', 'controls', 'renderer', 'remove', '__visuals', '__materialLib', '__proto__', 'constructor', 'prototype']);
const vec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const record = (v) => v && typeof v === 'object' && !Array.isArray(v);
const key = (v) => typeof v === 'string' && /^[a-zA-Z0-9_-]+$/.test(v);
function validNode(node) {
  if (!record(node) || Object.keys(node).some((k) => !['parentId', 'rotation', 'scale', 'card', 'params'].includes(k))) throw new Error('node/variant accepts parentId/rotation/scale/card/params only');
  if (node.rotation !== undefined && !vec3(node.rotation)) throw new Error('Invalid rotation');
  if (node.scale !== undefined && !(Number.isFinite(node.scale) && node.scale > 0) && !(vec3(node.scale) && node.scale.every((n) => n > 0))) throw new Error('Invalid scale');
  if (node.parentId !== undefined && node.parentId !== null && (typeof node.parentId !== 'string' || !node.parentId)) throw new Error('Invalid parentId');
  if (node.params !== undefined && !record(node.params)) throw new Error('Invalid params');
}
export function expandLayout(recipe) {
  const patterns = Array.isArray(recipe) ? recipe : recipe?.patterns;
  if (!Array.isArray(patterns)) throw new Error('Layout must be an array or {patterns: [...]}');
  const groups = Object.create(null), ids = new Set();
  for (const p of patterns) {
    if (!record(p) || typeof p.type !== 'string' || !p.type || reserved.has(p.type) || !key(p.idPrefix)) throw new Error('Each pattern needs type and idPrefix');
    const counts = p.counts ?? [1, 1, 1], spacing = p.spacing ?? [0, 0, 0], origin = p.origin ?? [0, 0, 0];
    if (!vec3(counts) || !counts.every((n) => Number.isSafeInteger(n) && n > 0) || !vec3(spacing) || !vec3(origin)) throw new Error(`Invalid counts/spacing/origin: ${p.idPrefix}`);
    const node = p.node ?? {}; validNode(node);
    const variants = p.variants ?? [{}];
    if (!Array.isArray(variants) || !variants.length) throw new Error('variants must be a nonempty array');
    variants.forEach(validNode);
    const axis = p.variantAxis ?? 'index';
    if (!['x', 'y', 'z', 'index'].includes(axis)) throw new Error('variantAxis must be x/y/z/index');
    const placements = p.placements ?? [{ origin: [0, 0, 0] }];
    if (!Array.isArray(placements) || !placements.length) throw new Error('placements must be a nonempty array');
    const total = counts.reduce((a, b) => a * b, 1) * placements.length;
    if (!Number.isSafeInteger(total) || total + ids.size > 100000) throw new Error('Layout exceeds 100000 nodes');
    const list = groups[p.type] ??= [];
    for (const placement of placements) {
      if (!record(placement) || (p.placements && !key(placement.key))) throw new Error('Each placement needs a stable key');
      const offset = placement.origin ?? [0, 0, 0];
      if (!vec3(offset)) throw new Error('Invalid placement origin');
      if (Object.hasOwn(placement, 'parentId')) validNode({ parentId: placement.parentId });
      const prefix = p.placements ? `${p.idPrefix}_${placement.key}` : p.idPrefix;
      let index = 0;
      for (let x = 0; x < counts[0]; x++) for (let y = 0; y < counts[1]; y++) for (let z = 0; z < counts[2]; z++, index++) {
        const id = `${prefix}_${x}_${y}_${z}`;
        if (ids.has(id)) throw new Error(`Duplicate layout id: ${id}`);
        ids.add(id);
        const variantIndex = axis === 'index' ? index : ({ x, y, z })[axis];
        const variant = variants[variantIndex % variants.length];
        const merged = { ...node, ...variant };
        if (node.params || variant.params) merged.params = { ...node.params, ...variant.params };
        if (Object.hasOwn(placement, 'parentId')) merged.parentId = placement.parentId;
        const position = [x, y, z].map((n, i) => origin[i] + offset[i] + n * spacing[i]);
        if (!position.every(Number.isFinite)) throw new Error(`Position overflow: ${id}`);
        list.push({ ...structuredClone(merged), id, position });
      }
    }
  }
  return groups;
}
