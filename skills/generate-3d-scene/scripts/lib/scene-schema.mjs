/**
 * scene-schema.mjs — scene-data.json 结构校验（P2.3，V08）
 *
 * validateSceneData(data, registry)：确定性错误（重复 ID / parent 环 / 缺父 /
 * NaN/非法 scale / 缺 factory / 缺 asset）输出明确失败路径，不以预算 unknown 冒充 0。
 *
 * registry 契约：已知 type 的判定来源——
 * - 'registryManifest' 形：{ factories: Set<string>, hasAssetFactory?: boolean }
 *   （消费方由 profile/引擎工厂表构造；schema 校验器不 import 母版代码，保持零依赖可测）
 * - 省略 registry：只做通用结构校验（不判 unknown factory）
 *
 * 返回 SchemaResult { ok, errors: [{ path, code, message }], warnings, stats }
 */

const RESERVED_KEYS = new Set([
  'version', 'meta', 'scene', 'camera', 'lights', 'controls', 'renderer', 'remove',
  '__visuals', '__materialLib',
]);

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isFiniteNumber);

/**
 * @param {unknown} data scene-data.json 解析产物
 * @param {{ factories?: Set<string>, hasAssetFactory?: boolean }} [registry]
 * @returns {{ ok: boolean, errors: Array<{path:string,code:string,message:string}>, warnings: string[], stats: object }}
 */
export const validateSceneData = (data, registry = {}) => {
  const errors = [];
  const warnings = [];
  const stats = { groups: 0, nodes: 0, assetRefs: 0, maxDepth: 0 };
  const factories = registry.factories;

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: [{ path: '$', code: 'not-object', message: 'scene-data 必须是 JSON 对象' }], warnings, stats };
  }

  // 保留区基础校验（弱：字段形态；强：确定性结构错误在业务区）
  if (data.scene && typeof data.scene !== 'object') {
    errors.push({ path: 'scene', code: 'bad-scene', message: 'scene 必须是对象' });
  }
  if (data.lights !== undefined && !Array.isArray(data.lights)) {
    errors.push({ path: 'lights', code: 'bad-lights', message: 'lights 必须是数组' });
  }

  // 业务分组收集
  const groups = [];
  for (const [key, val] of Object.entries(data)) {
    if (RESERVED_KEYS.has(key) || key.startsWith('__')) {
      continue;
    }
    if (!Array.isArray(val)) {
      errors.push({ path: key, code: 'group-not-array', message: `分组 ${key} 的值必须是数组（收到 ${typeof val}）` });
      continue;
    }
    groups.push([key, val]);
  }
  stats.groups = groups.length;

  // 节点级校验 + ID 唯一性
  const byId = new Map();
  for (const [type, nodes] of groups) {
    if (factories && !factories.has(type)) {
      errors.push({
        path: type,
        code: 'unknown-factory',
        message: `分组 ${type} 无已注册 factory（在 scene-profile.ts 注册，或修正分组名）`,
      });
    }
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      const path = `${type}[${i}]`;
      if (!node || typeof node !== 'object' || Array.isArray(node)) {
        errors.push({ path, code: 'node-not-object', message: '节点必须是对象' });
        continue;
      }
      if (typeof node.id !== 'string' || node.id === '') {
        errors.push({ path: `${path}.id`, code: 'missing-id', message: '节点 id 必填（字符串，全场唯一）' });
        continue;
      }
      if (byId.has(node.id)) {
        errors.push({
          path: `${path}.id`,
          code: 'duplicate-id',
          message: `节点 id "${node.id}" 重复（首次出现在 ${byId.get(node.id)}）`,
        });
        continue;
      }
      byId.set(node.id, path);
      stats.nodes += 1;

      // transform
      if (node.position !== undefined && !isVec3(node.position)) {
        errors.push({ path: `${path}.position`, code: 'bad-vec3', message: `position 须为 [x,y,z] 有限数字（收到 ${JSON.stringify(node.position)}）` });
      }
      if (node.rotation !== undefined && !isVec3(node.rotation)) {
        errors.push({ path: `${path}.rotation`, code: 'bad-vec3', message: `rotation 须为 [x,y,z] 有限数字` });
      }
      if (node.scale !== undefined) {
        const s = node.scale;
        const ok = isFiniteNumber(s) || (Array.isArray(s) && s.length === 3 && s.every(isFiniteNumber));
        if (!ok) {
          errors.push({ path: `${path}.scale`, code: 'bad-scale', message: `scale 须为数字或 [x,y,z]（收到 ${JSON.stringify(s)}）` });
        } else if ((isFiniteNumber(s) && s === 0)
          || (Array.isArray(s) && s.some((v) => v === 0))) {
          // 标量 0 或任一轴 0 都是退化矩阵（不可见 + 包围盒塌缩为零面积）——
          // P2-R4：向量零分量与标量 0 同等处理，不放过 [1,0,1]
          const which = isFiniteNumber(s) ? '0' : JSON.stringify(s);
          errors.push({ path: `${path}.scale`, code: 'zero-scale', message: `scale 含零分量（${which}）产生退化矩阵（不可见且包围盒为空）` });
        }
      }

      // 资产引用（P2-R4：内建 'asset' 分组的节点 params.assetId 必填——
      // 缺失时引擎只建空 Group 且无加载失败记录，ready 抓不到）
      const assetId = node.params?.assetId;
      if (assetId !== undefined) {
        if (typeof assetId !== 'string' || assetId === '') {
          errors.push({ path: `${path}.params.assetId`, code: 'bad-asset-id', message: 'params.assetId 须为非空字符串' });
        } else {
          stats.assetRefs += 1;
        }
      } else if (type === 'asset' && factories?.has('asset')) {
        errors.push({
          path: `${path}.params.assetId`,
          code: 'missing-asset-id',
          message: "内建 'asset' 分组的节点必须带 params.assetId（缺失只建空 Group，加载失败无从暴露）",
        });
      }
    }
  }

  // parent 链：缺父 / 环 / 深度
  const parentOf = (id) => {
    for (const [type, nodes] of groups) {
      for (const node of nodes) {
        if (node?.id === id) {
          return node.parentId ?? null;
        }
      }
    }
    return null;
  };
  for (const [type, nodes] of groups) {
    for (const node of nodes) {
      if (!node || typeof node !== 'object' || !node.id) {
        continue;
      }
      const path = byId.get(node.id) ?? type;
      if (node.parentId !== undefined && node.parentId !== null) {
        if (typeof node.parentId !== 'string' || !byId.has(node.parentId)) {
          errors.push({ path: `${path}.parentId`, code: 'missing-parent', message: `父节点 "${node.parentId}" 不存在（父须先建或同片提供）` });
        }
      }
      // 环检测（沿 parent 链走，有限步内回到自身即环）
      const seen = new Set([node.id]);
      let cur = node.parentId ?? null;
      let depth = 0;
      while (typeof cur === 'string' && byId.has(cur)) {
        if (seen.has(cur)) {
          errors.push({ path: `${path}.parentId`, code: 'parent-cycle', message: `parent 链成环：${[...seen, cur].join(' → ')}` });
          break;
        }
        seen.add(cur);
        depth += 1;
        cur = parentOf(cur);
      }
      stats.maxDepth = Math.max(stats.maxDepth, depth);
    }
  }

  return { ok: errors.length === 0, errors, warnings, stats };
};

/**
 * 从 scene-profile 注册表构造 registry（供 init/verify 调用方拼装）。
 * 母版内建工厂 = PRIMITIVE_KINDS + 'asset' + profile 注册的业务分组。
 */
export const registryFromFactories = (factoryTypes, { hasAssetFactory = true } = {}) => ({
  factories: new Set(factoryTypes),
  hasAssetFactory,
});

/* ── TypeScript 加载（AST 提取用，P2-RRR2 四审）───────────────────────────── */

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { resolve as pathResolve, join } from 'node:path';
const requireFromHere = createRequire(import.meta.url);

/**
 * 惰性加载模板 node_modules 的 typescript（vue-tsc 构建链的既有硬依赖，
 * 无新增依赖）。加载失败明确抛错——提取器不能在拿不到 AST 时静默退回猜测。
 */
let tsModule = null;
const getTs = () => {
  if (!tsModule) {
    const skillRoot = pathResolve(import.meta.dirname, '..', '..');
    const tsPath = join(skillRoot, 'template', 'node_modules', 'typescript', 'lib', 'typescript.js');
    if (!existsSync(tsPath)) {
      throw new Error(`TypeScript 不可达（AST 提取依赖）：${tsPath}——母版 node_modules 缺失时先恢复模板依赖`);
    }
    tsModule = requireFromHere(tsPath);
  }
  return tsModule;
};

/**
 * 从业务 profile 源码提取工厂分组登记表（P2-RR1 单一来源：BUSINESS_REGISTRARS；
 * P2-RRR2 四审：TypeScript AST 提取，替换手写词法扫描器）。
 *
 * 手写扫描器对注释内的括号处理不一致（外层配平与值扫描都不识别注释，
 * `// }` 截断对象静默丢 key）——AST 由成熟词法器驱动，注释/字符串/嵌套
 * 天然正确。读 BUSINESS_REGISTRARS 对象字面量声明的顶层 PropertyAssignment
 * key 集合（type → 注册实现；运行时 registerBusinessFactories 遍历同一结构）。
 *
 * 三态（P2-RR2）：
 * - 对象存在（含空对象）→ 返回 key 列表（空 = 纯内建图元/asset 工程，合法）
 * - 声明缺失 / 顶层成员非 key:value / key 形态不支持 → 抛错（不静默放行残缺集合）
 */
export const extractBusinessFactoryTypes = (profileSource) => {
  const ts = getTs();
  const sf = ts.createSourceFile('scene-profile.ts', profileSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  let obj = null;
  const visit = (node) => {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === 'BUSINESS_REGISTRARS'
          && decl.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
          obj = decl.initializer;
        }
      }
    }
    if (!obj) {
      ts.forEachChild(node, visit);
    }
  };
  visit(sf);
  if (!obj) {
    throw new Error('scene-profile.ts 缺 BUSINESS_REGISTRARS 登记表（形态：export const BUSINESS_REGISTRARS: Record<string, (ctx) => void> = { <type>: registerXxx, … }；纯内建工程可用空对象 {}）');
  }
  const keys = [];
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      throw new Error(`BUSINESS_REGISTRARS 顶层出现不支持的成员：${ ts.SyntaxKind[prop.kind] }（应为 key: value 形态）`);
    }
    const name = prop.name;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
      keys.push(name.text);
    } else {
      throw new Error(`BUSINESS_REGISTRARS 顶层 key 形态不支持：${ ts.SyntaxKind[name.kind] }（标识符或字符串字面量）`);
    }
  }
  return keys;
};

/**
 * 构建工程用的完整工厂注册表（内建图元 + asset + 业务分组）。
 * @param {string} profileSource template/src/scene-profile.ts 源码文本
 */
export const factoryRegistryFromProfile = (profileSource) => registryFromFactories([
  ...['Box', 'Sphere', 'Cylinder', 'Plane', 'Cone', 'Torus', 'asset'],
  ...extractBusinessFactoryTypes(profileSource),
]);
