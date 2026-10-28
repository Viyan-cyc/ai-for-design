/**
 * compile-appearance.mjs — 编辑视觉层 → 代码模块编译器（P4.1，F08/V17/V18）
 *
 * strip-edit 的前置步骤：把 scene-data.json 的 __visuals / __materialLib 编译成
 * `src/scene3d/scene/generated/appearance.ts` 代码模块（纯数据常量），运行包装配期由
 * appearance-runtime 应用——编辑结果自动保真，不再依赖 LLM 人工转录 Markdown。
 *
 * 契约（优化 Spec §4.2 compileAppearance）：
 * - 输入：快照（scene-data.json 解析产物）+ 可选现场（liveNodeIds——陈旧引用判定）
 * - 输出：{ code, exportedVisuals, exportedMaterialLib, errors, warnings, stats }
 * - 陈旧节点/缺材质库条目/槽位引用缺失：errors 报具体路径（真实未支持 = FAIL，
 *   不删掉后 PASS）；locked 是编辑器交互态，编译期剥离（运行包无编辑器）
 * - 可审计：键序稳定（liveNodeIds 序 + matId 字典序）、同输入产同输出、
 *   生成文件带「由 strip-edit 生成」头注释，人工可与 TRANSCRIPTION.md 逐字段比对
 */

/**
 * VisualOverride 的结构键（与 template materials.ts NON_MATERIAL_VISUAL_KEYS 同口径）：
 * locked 在编译期剥离（运行包无编辑器）。材质参数字段透传（applyVisualOverride
 * 按类型白名单应用），不在此枚举。
 */

/**
 * 校验视觉层条目的结构合法性（材质参数字段透传不校验——applyVisualOverride
 * 按类型白名单应用，不存在的参数无效但不破坏；未知**结构**键才是编译器
 * 不认识的形态）。返回错误列表（空 = 合法）。
 */
const validateVisualEntry = (visual, path, materialLib, errors) => {
  if (!visual || typeof visual !== 'object' || Array.isArray(visual)) {
    errors.push(`${path} 不是对象`);
    return;
  }
  // 物体级 libraryRef：材质库必须有对应条目
  if (visual.libraryRef !== undefined) {
    if (typeof visual.libraryRef !== 'string' || !materialLib[visual.libraryRef]) {
      errors.push(`${path}.libraryRef → "${String(visual.libraryRef)}" 在 __materialLib 中无条目`);
    }
  }
  // 槽位级：同规则递归
  for (const [slotKey, slot] of Object.entries(visual.slots ?? {})) {
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)) {
      errors.push(`${path}.slots["${slotKey}"] 不是对象`);
      continue;
    }
    if (slot.libraryRef !== undefined) {
      if (typeof slot.libraryRef !== 'string' || !materialLib[slot.libraryRef]) {
        errors.push(`${path}.slots["${slotKey}"].libraryRef → "${String(slot.libraryRef)}" 在 __materialLib 中无条目`);
      }
    }
  }
};

/* ── P4-R3：槽位 fail-closed 校验（§3.4 陈旧 slot 引用报路径失败） ─────────── */

/**
 * 校验 slots 引用真实存在（P4-R3 fail-closed；RR2/RRR1 全量运行时真值）：
 * - **所有节点**（程序化/图元/GLB）统一用 strip-edit 注入的 runtimeSlotKeys
 *   真值清单——程序化经 headless 建树 listSubMeshes，GLB/glTF 经工程 three 的
 *   GLTFLoader 真实加载 + buildSlotKeysFromScene（AssetEngine.collectMeshes
 *   同函数——多 primitive `_N` 命名、`#索引` 兜底由 loader 产物携带，P4-RRR1）
 * - 未命中 = 陈旧槽位，报具体路径 FAIL；无法判定（无清单条目）= FAIL
 *   ——禁止 '#' 放行、不把「不知道」当成功
 * @param {object} nodeById id → 节点（类型判定用）
 * @param {object} ctx { runtimeSlotKeys }（strip-edit 注入；GLB 静态清单已删除）
 */
const validateSlotsExistence = (visuals, liveNodeIds, nodeById, ctx, errors) => {
  const runtimeSlotKeys = ctx?.runtimeSlotKeys ?? null;
  for (const [nodeId, visual] of Object.entries(visuals)) {
    if (liveNodeIds && !liveNodeIds.has(nodeId)) {
      continue;
    }
    const slots = visual?.slots;
    if (!slots || Object.keys(slots).length === 0) {
      continue;
    }
    if (runtimeSlotKeys && runtimeSlotKeys.has(nodeId)) {
      const keys = runtimeSlotKeys.get(nodeId);
      const node = nodeById.get(nodeId);
      const kind = node?.params?.assetId ? '资产' : '程序化/图元模型';
      for (const slotKey of Object.keys(slots)) {
        if (!keys.has(slotKey)) {
          errors.push(`__visuals["${nodeId}"].slots["${slotKey}"] 在该节点（${kind}）的运行时 mesh 清单中不存在（陈旧槽位——模型重导出改名/工厂改版？须在编辑器重新编辑或清理）`);
        }
      }
    } else {
      errors.push(`__visuals["${nodeId}"].slots 无法验证：无运行时槽位清单（headless 建树或模型加载失败——fail-closed，不静默放行）`);
    }
  }
};

/* compileAppearance 主体见下 */

/**
 * 编译外观模块。
 * @param {object} snapshot scene-data.json 解析产物（含 __visuals / __materialLib）
 * @param {object} [opts]
 * @param {Set<string>|null} [opts.liveNodeIds] 存活节点 id 集（null = 不做陈旧判定，
 *   只编译——strip 流程内调用方已从快照分组提取）
 * @param {object} [opts.slotContext] P4-R3 槽位校验上下文：
 *   { projectRoot, assetManifest, nodeById }（strip-edit 从源工程构造）
 * @returns {{ code: string, exportedVisuals: object, exportedMaterialLib: object,
 *   errors: string[], warnings: string[], stats: object }}
 */
export const compileAppearance = (snapshot, opts = {}) => {
  const visuals = snapshot?.__visuals ?? {};
  const materialLib = snapshot?.__materialLib ?? {};
  const liveNodeIds = opts.liveNodeIds ?? null;

  const errors = [];
  const warnings = [];

  // ── 引用一致性校验（V19：陈旧/缺失报具体路径，不静默删） ──────────────────
  for (const [nodeId, visual] of Object.entries(visuals)) {
    if (liveNodeIds && !liveNodeIds.has(nodeId)) {
      errors.push(`__visuals["${nodeId}"] 引用的节点不存在于场景分组（陈旧条目，须先在编辑器清理）`);
      continue;
    }
    validateVisualEntry(visual, `__visuals["${nodeId}"]`, materialLib, errors);
  }
  // ── P4-R3：槽位存在性 fail-closed 校验（陈旧 slot 报路径失败） ─────────────
  validateSlotsExistence(visuals, liveNodeIds, opts.slotContext?.nodeById ?? new Map(), opts.slotContext, errors);

  // ── 编译产物（纯数据常量；locked 剥离——编辑器交互态不进运行包） ────────────
  const exportedVisuals = {};
  for (const [nodeId, visual] of Object.entries(visuals)) {
    if (liveNodeIds && !liveNodeIds.has(nodeId)) {
      continue; // 陈旧条目（已在 errors 报过）
    }
    exportedVisuals[nodeId] = stripEditorOnly(visual);
  }

  // 材质库：只保留被引用的条目（未被引用的种子材质不进运行包）
  const referencedMatIds = new Set();
  for (const visual of Object.values(exportedVisuals)) {
    collectLibRefs(visual, referencedMatIds);
  }
  const exportedMaterialLib = {};
  for (const matId of [...referencedMatIds].sort()) {
    const entry = materialLib[matId];
    if (entry) {
      exportedMaterialLib[matId] = { name: entry.name ?? matId, spec: entry.spec };
    }
  }

  // ── 代码生成（键序稳定：nodeId 按场景序、matId 字典序） ────────────────────
  const code = generateModule(exportedVisuals, exportedMaterialLib);

  return {
    code,
    exportedVisuals,
    exportedMaterialLib,
    errors,
    warnings,
    stats: {
      visualEntries: Object.keys(exportedVisuals).length,
      materialLibEntries: Object.keys(exportedMaterialLib).length,
      staleVisuals: liveNodeIds
        ? Object.keys(visuals).filter((id) => !liveNodeIds.has(id)).length
        : 0,
    },
  };
};

/** 剥离编辑器交互态（locked）；深拷贝防止后续 mutate 源快照 */
const stripEditorOnly = (visual) => {
  const out = {};
  for (const [key, val] of Object.entries(visual)) {
    if (key === 'locked') {
      continue;
    }
    if (key === 'slots' && val && typeof val === 'object') {
      out.slots = {};
      for (const [slotKey, slot] of Object.entries(val)) {
        out.slots[slotKey] = slot ? stripEditorOnly(slot) : slot;
      }
      continue;
    }
    out[key] = structuredClone(val);
  }
  return out;
};

/** 收集视觉层（含槽位）引用的全部 mat_id */
const collectLibRefs = (visual, out) => {
  if (typeof visual?.libraryRef === 'string') {
    out.add(visual.libraryRef);
  }
  for (const slot of Object.values(visual?.slots ?? {})) {
    if (typeof slot?.libraryRef === 'string') {
      out.add(slot.libraryRef);
    }
  }
};

/** JSON 值 → TS 字面量（缩进稳定，可重复生成） */
const tsValue = (val, depth = 0) => {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  const pad = '  '.repeat(depth);
  const innerPad = '  '.repeat(depth + 1);
  if (Array.isArray(val)) {
    return `[\n${val.map((v) => `${innerPad}${tsValue(v, depth + 1)},`).join('\n')}\n${pad}]`;
  }
  const inner = Object.entries(val)
    .map(([k, v]) => `${innerPad}${JSON.stringify(k)}: ${tsValue(v, depth + 1)},`)
    .join('\n');
  return `{\n${inner}\n${pad}}`;
};

/**
 * 生成 appearance.ts 模块文本。
 * 类型引用从 scene-core 公开入口 import（VisualOverride / MaterialLibEntry），
 * 不 import edit（铁律 1 天然满足——生成物只有类型依赖 + 纯数据）。
 */
const generateModule = (exportedVisuals, exportedMaterialLib) => {
  const lines = [];
  lines.push('/**');
  lines.push(' * appearance — 编译外观模块（strip-edit 自动生成，P4.1）');
  lines.push(' *');
  lines.push(' * 内容来自编辑器保存快照的 __visuals / __materialLib，已剥离编辑器');
  lines.push(' * 交互态（locked）；由 scene-core/appearance-runtime 在装配期应用。');
  lines.push(' * 重新导出运行包时本文件会被整文件覆盖——不要手改（改了下次 strip 丢失）。');
  lines.push(' * 审计：字段与 TRANSCRIPTION.md 的视觉表逐条对应。');
  lines.push(' */');
  lines.push("import type { MaterialLibEntry, VisualOverride } from '../../scene-core/index';");
  lines.push('');
  lines.push('/** 节点视觉层（nodeId → override；来自 __visuals，locked 已剥离） */');
  lines.push('export const compiledVisuals: Record<string, VisualOverride> = ');
  lines.push(tsValue(exportedVisuals, 0));
  lines.push(';');
  lines.push('');
  lines.push('/** 材质库（mat_id → 条目；仅被引用的条目，未被引用的种子不进运行包） */');
  lines.push('export const compiledMaterialLib: Record<string, MaterialLibEntry> = ');
  lines.push(tsValue(exportedMaterialLib, 0));
  lines.push(';');
  lines.push('');
  return lines.join('\n');
};
