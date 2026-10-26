/** Pure policy shared by browser and Node. */
export const RULES_VERSION = '2.2.0';

/** Coordinate standard for freestanding floor assets: right-handed, +Y up, +Z front, meters. */
export const placementPolicy = Object.freeze({
  system: 'right-handed',
  up: '+Y',
  front: '+Z',
  units: 'meters',
  origin: 'bottom-center',
  tolerance: 0.1,
});

/** Production budget targets (spec §6.2). Advisory warnings, not load rejections. */
export const budgetPolicy = Object.freeze({
  tiers: { simple: 200, medium: 500, complex: 1000 },
  defaultTier: 'medium',
  maxNodes: 5,
  maxTextureSize: 1024,
  drawCalls: 5,
  recommendedDrawCalls: 1,
  textureCount: 4,
});

/** raw_data whitelist for the vector-library template (spec §4.1). Missing values stay null. */
export const RAW_DATA_FIELDS = Object.freeze(['bbox', 'triangles', 'draw_calls', 'node_count', 'texture_count', 'max_texture_size']);

const finite3 = (v) => Array.isArray(v) && v.length === 3 && v.every((x) => Number.isFinite(x));

/** Validates a raw payload object against the shared contract; returns normalized copy or throws. */
export function validateMeasurements(m) {
  if (m === null || m === undefined) return null;
  if (typeof m !== 'object') throw new Error('Invalid measurements');
  if (m.bbox !== undefined && m.bbox !== null) {
    if (!m.bbox || !finite3(m.bbox.min) || !finite3(m.bbox.max)) throw new Error('Invalid measurements: bbox');
    if (m.bbox.min.some((v, i) => v > m.bbox.max[i])) throw new Error('Invalid measurements: bbox bounds');
  }
  for (const key of ['triangles', 'draw_calls', 'node_count', 'texture_count', 'max_texture_size']) {
    if (m[key] !== undefined && m[key] !== null && (!Number.isSafeInteger(m[key]) || m[key] < 0)) throw new Error(`Invalid measurements: ${key}`);
  }
  return { ...m };
}

/** Hard content violations found by scanning the whole glTF document (spec §6.1). */
export function scanForbiddenContent(gltfJson) {
  const findings = [];
  const cameras = gltfJson.cameras ?? [];
  if (cameras.length) findings.push({ kind: 'camera', count: cameras.length, detail: `cameras 定义 ${cameras.length} 个` });
  (gltfJson.nodes ?? []).forEach((node, i) => {
    if (node.camera !== undefined) findings.push({ kind: 'camera', count: 1, detail: `nodes[${i}]${node.name ? `(${node.name})` : ''} 引用 camera ${node.camera}` });
  });
  const lights = gltfJson.extensions?.KHR_lights_punctual?.lights ?? [];
  if (lights.length) findings.push({ kind: 'light', count: lights.length, detail: `KHR_lights_punctual 定义 ${lights.length} 个灯光` });
  (gltfJson.nodes ?? []).forEach((node, i) => {
    if (node.extensions?.KHR_lights_punctual?.light !== undefined) findings.push({ kind: 'light', count: 1, detail: `nodes[${i}]${node.name ? `(${node.name})` : ''} 引用 KHR_lights_punctual 灯光` });
  });
  return findings;
}

/** Placement check against bbox measurements + root node transform (spec §5). */
export function checkPlacement({ bbox, rootNode, tolerance = placementPolicy.tolerance, kind = 'floor' }) {
  if (kind !== 'floor') return { ok: false, violations: ['安装类型非落地，需明确安装原点后重新导出'], pending: [] };
  const violations = [];
  if (!bbox || !finite3(bbox.min) || !finite3(bbox.max)) return { ok: false, violations: ['缺少有效 bbox，无法验证坐标标准'], pending: [] };
  const tol = Number.isFinite(tolerance) ? tolerance : placementPolicy.tolerance;
  if (Math.abs(bbox.min[1]) > tol) violations.push(`底部不在地面上：bbox.min.y=${bbox.min[1].toFixed(4)}（应为 0，容差 ${tol}）`);
  const cx = (bbox.min[0] + bbox.max[0]) / 2, cz = (bbox.min[2] + bbox.max[2]) / 2;
  if (Math.abs(cx) > tol || Math.abs(cz) > tol) violations.push(`X/Z 中心偏移：中心 (${cx.toFixed(4)}, ${cz.toFixed(4)})（应为 0，容差 ${tol}）`);
  if (rootNode === null) violations.push('模型包含多个顶层对象。请在建模软件中把所有部件放进同一个父级组，再导出 GLB（不用合并网格）');
  if (rootNode) {
    if (typeof rootNode === 'object') {
      const t = rootNode.translation, r = rootNode.rotation, s = rootNode.scale;
      if (Array.isArray(t) && t.some((v) => Math.abs(v) > tol)) violations.push(`资产摆放根有平移：translation=[${t.join(', ')}]`);
      if (Array.isArray(r) && !(r.length === 4 && r.slice(0,3).every(v=>Math.abs(v)<1e-6) && Math.abs(Math.abs(r[3])-1)<1e-6)) violations.push(`资产摆放根有旋转：rotation=[${r.join(', ')}]`);
      if (Array.isArray(s) && !(s.length === 3 && s.every((v) => Math.abs(v - 1) < 1e-6))) violations.push(`资产摆放根有缩放：scale=[${s.join(', ')}]`);
      if (Array.isArray(rootNode.matrix) && !rootNode.matrix.every((v, i) => Math.abs(v - [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1][i]) < 1e-6)) violations.push('资产摆放根有非单位 matrix');
    }
  }
  return { ok: violations.length === 0, violations, pending: [] };
}

/** Budget evaluation (spec §6.2). Returns warnings with actual/target; never a rejection. */
export function checkBudget(m, tier = budgetPolicy.defaultTier) {
  const limit = budgetPolicy.tiers[tier] ?? budgetPolicy.tiers[budgetPolicy.defaultTier];
  const warnings = [];
  const add = (key, actual, target, advice) => {
    if (actual === null || actual === undefined) return;
    if (actual > target) warnings.push({ key, actual, target, advice: advice(actual) });
  };
  add('triangles', m.triangles, limit, (a) => `三角形 ${a} 个超过${tierLabel(tier)}目标 ${limit}；建议减少三角面或使用低面数版本`);
  add('node_count', m.node_count, budgetPolicy.maxNodes, (a) => `节点 ${a} 个超过目标 ${budgetPolicy.maxNodes}；建议合并空 Group`);
  add('max_texture_size', m.max_texture_size, budgetPolicy.maxTextureSize, (a) => `最大贴图边长 ${a}px 超过目标 ${budgetPolicy.maxTextureSize}px；建议压缩贴图`);
  add('draw_calls', m.draw_calls, budgetPolicy.drawCalls, (a) => `draw calls ${a} 超过目标 ${budgetPolicy.drawCalls}（推荐 ${budgetPolicy.recommendedDrawCalls}）；建议合并材质或图集`);
  add('texture_count', m.texture_count, budgetPolicy.textureCount, (a) => `贴图 ${a} 张超过目标 ${budgetPolicy.textureCount} 张`);
  return { tier, triangleLimit: limit, warnings };
}

const tierLabel = (tier) => ({ simple: '简单', medium: '中等', complex: '复杂' }[tier] ?? '中等');

/** Acknowledgement binding: acceptance is only valid for the exact content+rules+metrics. */
export function validAcknowledgement(ack, { contentHash, rulesVersion, measurements, tier }) {
  if (!ack || typeof ack !== 'object') return false;
  if (ack.contentHash !== contentHash || ack.rulesVersion !== (rulesVersion ?? RULES_VERSION)) return false;
  if (ack.tier !== (tier ?? budgetPolicy.defaultTier)) return false;
  const warnings = checkBudget(measurements ?? {}, ack.tier).warnings;
  if (!warnings.length) return false;
  return warnings.every((w) => (ack.accepted ?? []).includes(w.key)) && JSON.stringify(ack.measurements) === JSON.stringify(metricValues(measurements));
}


/** Stable metric snapshot used by both the page and import; includes values, not just warning keys. */
export function metricValues(m) {
  return Object.fromEntries(['triangles','node_count','draw_calls','texture_count','max_texture_size'].map(k=>[k,m?.[k]??null]));
}
export function assetMeasurements(a) {
  return metricValues({triangles:a.triangles,node_count:a.nodeCount,draw_calls:a.drawCalls,texture_count:a.textureCount,max_texture_size:a.maxTextureSize});
}
export function evaluateAsset(a) {
  const placement=checkPlacement({bbox:a.bbox,rootNode:a.rootTransforms??null,kind:a.assetType??'floor'});
  const budget=checkBudget(assetMeasurements(a),a.tier??budgetPolicy.defaultTier);
  return {placementViolations:placement.violations,placementPending:placement.pending,budgetWarnings:budget.warnings,tier:budget.tier,rulesVersion:RULES_VERSION};
}
export function createAcknowledgement(a) {
  return {contentHash:a.contentHash,rulesVersion:RULES_VERSION,tier:a.tier??budgetPolicy.defaultTier,measurements:assetMeasurements(a),accepted:checkBudget(assetMeasurements(a),a.tier).warnings.map(w=>w.key)};
}
export function assertUsable(a,{semantic=false}={}) {
  const policy=evaluateAsset(a);
  if(a.forbidden?.length || policy.placementViolations.length) throw new Error('相机/灯光或坐标规范违规不能确认使用：'+(a.name??a.id??'模型'));
  if(a.mappingPending)throw new Error('请确认模型更新映射');
  if(semantic && (!a.frontConfirmed || !a.scaleConfirmed))throw new Error('请确认模型正面和实际尺寸');
  if(policy.budgetWarnings.length && !validAcknowledgement(a.budgetAck,{contentHash:a.contentHash,rulesVersion:RULES_VERSION,measurements:assetMeasurements(a),tier:policy.tier}))throw new Error('超预算同意无效或与实际测量不符：'+(a.name??a.id??'模型'));
  return policy;
}
