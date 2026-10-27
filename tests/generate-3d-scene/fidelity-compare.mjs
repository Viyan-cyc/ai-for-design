/* eslint-disable no-console -- CLI 输出接口 */
/**
 * fidelity-compare.mjs — 编辑态 vs 运行包 数据级保真比较（release 档 fidelity 段）
 *
 * P5-RRR3 + P5-RRRR1：**结构化语义值比较**（非 ID 字符串匹配）：
 *   ① 运行包 appearance.ts 的 compiledVisuals / compiledMaterialLib 以**结构化方式
 *      读取**（TS 对象字面量 → JSON 解析，生成器契约：键带引号、允许尾逗号），非正则找 ID；
 *   ② 编辑态 __visuals 每条目的**语义字段**（visible/材质/贴图/槽位）与运行包编译
 *      条目逐项值比较——值不同 = 保真缺口（review 反例「visible=false 编译成 true
 *      仍 PASS」「红色编译成蓝色仍 PASS」关闭）；
 *   ③ __materialLib 每条目 spec 字段值比较；
 *   ④ 节点数据双向比对：position/rotation/scale/parentId/params（编辑态全部节点
 *      进运行包且一致；**运行包额外业务分组/节点 = 拒绝**——review 反例关闭）；
 *   ⑤ 运行包 scene-data 无 __ 私有区。
 *
 * 导出 compareFidelity/extractExportedObject 供回归测试 import（CLI 入口有守卫）。
 *
 * 用法：node fidelity-compare.mjs <src-project> <runtime-package>
 *   退出码：0 一致 / 1 保真缺口（列差异）/ 2 输入错误
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SCENE_KEYS = new Set([
  "lights",
  "camera",
  "controls",
  "renderer",
  "environment",
  "remove",
  "scene",
  "version",
  "meta",
]);

/**
 * P5-RRRR1：从 appearance.ts 结构化提取导出常量的对象字面量（JSON 解析——
 * 生成器契约：键带引号、允许尾逗号、无注释。非 JSON 兼容 → fail-closed 不可比）。
 */
export const extractExportedObject = (code, name) => {
  const marker = `export const ${name}`;
  const start = code.indexOf(marker);
  if (start < 0) {
    return { ok: false, reason: `缺少 export const ${name}` };
  }
  const braceStart = code.indexOf("{", start);
  if (braceStart < 0) {
    return { ok: false, reason: `${name} 无对象字面量` };
  }
  let depth = 0;
  let inString = false;
  let quote = "";
  let end = -1;
  for (let i = braceStart; i < code.length; i += 1) {
    const ch = code[i];
    if (inString) {
      if (ch === "\\") {
        i += 1; // 跳过转义字符
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) {
    return { ok: false, reason: `${name} 字面量未闭合` };
  }
  // Remove only trailing commas outside strings; never evaluate generated code.
  let literal = "";
  let quoted = false;
  for (let i = braceStart; i <= end; i++) {
    const ch = code[i];
    if (quoted && ch === "\\") {
      literal += ch + code[++i];
      continue;
    }
    if (ch === '"') {
      quoted = !quoted;
    }
    if (!quoted && ch === "," && /^\s*[}\]]/.test(code.slice(i + 1))) {
      continue;
    }
    literal += ch;
  }
  try {
    return { ok: true, value: JSON.parse(literal) };
  } catch {
    return {
      ok: false,
      reason: `${name} 字面量非 JSON 兼容（生成器契约破坏——不可比）`,
    };
  }
};

/**
 * 语义值比较核心：逐字段深比较（数值容差 1e-6；颜色字符串原样比）。差异推入 problems。
 */
export const compareFidelity = (srcData, pkgData, appCode) => {
  const problems = [];

  // ① 编译表结构化提取
  const visualsExtract = extractExportedObject(appCode, "compiledVisuals");
  const matLibExtract = extractExportedObject(appCode, "compiledMaterialLib");
  for (const ext of [visualsExtract, matLibExtract]) {
    if (!ext.ok) {
      problems.push(`运行包 appearance.ts 不可结构化读取：${ext.reason}`);
    }
  }
  const compiledVisuals = visualsExtract.ok ? visualsExtract.value : {};
  const compiledMatLib = matLibExtract.ok ? matLibExtract.value : {};

  // ② __visuals 语义值比较
  const deepEqualSemantic = (a, b, path) => {
    if (a === b) {
      return;
    }
    if (
      typeof a === "number" &&
      typeof b === "number" &&
      Math.abs(a - b) < 1e-6
    ) {
      return;
    }
    if (
      a === null ||
      b === null ||
      typeof a !== "object" ||
      typeof b !== "object"
    ) {
      problems.push(
        `${path}: 编辑态 ${JSON.stringify(a)} vs 运行包 ${JSON.stringify(b)}`,
      );
      return;
    }
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      deepEqualSemantic(a[k], b[k], `${path}.${k}`);
    }
  };

  const stripLocked = (value) => {
    if (!value || typeof value !== "object") {
      return value;
    }
    const result = { ...value };
    delete result.locked;
    if (result.slots) {
      result.slots = Object.fromEntries(
        Object.entries(result.slots).map(([k, v]) => [k, stripLocked(v)]),
      );
    }
    return result;
  };
  const editVisuals = Object.fromEntries(
    Object.entries(srcData.__visuals ?? {}).map(([k, v]) => [
      k,
      stripLocked(v),
    ]),
  );
  for (const [nodeId, visual] of Object.entries(editVisuals)) {
    const compiled = compiledVisuals[nodeId];
    if (compiled === undefined) {
      problems.push(
        `视觉条目缺口：节点 ${nodeId} 在运行包 compiledVisuals 无条目`,
      );
      continue;
    }
    deepEqualSemantic(visual, compiled, `__visuals.${nodeId}`);
  }
  for (const nodeId of Object.keys(compiledVisuals)) {
    if (!(nodeId in editVisuals)) {
      problems.push(
        `运行包额外视觉条目：${nodeId} 不在编辑态 __visuals（编译器无中生有或残留）`,
      );
    }
  }

  // ③ __materialLib 语义值比较
  const refs = new Set();
  for (const visual of Object.values(editVisuals)) {
    for (const item of [visual, ...Object.values(visual?.slots ?? {})]) {
      if (typeof item?.libraryRef === "string") {
        refs.add(item.libraryRef);
      }
    }
  }
  const editMatLib = {};
  for (const id of refs) {
    const entry = srcData.__materialLib?.[id];
    if (!entry) {
      problems.push(`缺失引用材质：${id}`);
      continue;
    }
    editMatLib[id] = { name: entry.name ?? id, spec: entry.spec };
  }
  for (const [matId, entry] of Object.entries(editMatLib)) {
    const compiled = compiledMatLib[matId];
    if (compiled === undefined) {
      problems.push(`材质库缺口：${matId} 在运行包 compiledMaterialLib 无条目`);
      continue;
    }
    deepEqualSemantic(entry, compiled, `__materialLib.${matId}`);
  }
  for (const matId of Object.keys(compiledMatLib)) {
    if (!(matId in editMatLib)) {
      problems.push(`运行包额外材质条目：${matId} 不在编辑态 __materialLib`);
    }
  }

  // ④ 节点数据双向比对（transform/parentId/params；拒绝额外分组/节点）
  const businessGroups = (d) =>
    Object.entries(d).filter(
      ([k, v]) => Array.isArray(v) && !SCENE_KEYS.has(k) && !k.startsWith("__"),
    );
  const srcGroups = new Map(businessGroups(srcData));
  const pkgGroups = new Map(businessGroups(pkgData));
  for (const group of new Set([...srcGroups.keys(), ...pkgGroups.keys()])) {
    const srcNodes = srcGroups.get(group);
    const pkgNodes = pkgGroups.get(group);
    if (!srcNodes) {
      problems.push(
        `运行包额外业务分组：${group}（编辑态不存在；节点 ${pkgNodes.map((n) => n.id).join(", ")}）`,
      );
      continue;
    }
    if (!pkgNodes) {
      problems.push(`分组缺口：编辑态 ${group} 在运行包消失`);
      continue;
    }
    const srcById = new Map(srcNodes.map((n) => [n.id, n]));
    const pkgById = new Map(pkgNodes.map((n) => [n.id, n]));
    for (const id of new Set([...srcById.keys(), ...pkgById.keys()])) {
      if (!pkgById.has(id)) {
        problems.push(`节点缺口：${group}/${id} 在运行包消失`);
        continue;
      }
      if (!srcById.has(id)) {
        problems.push(`运行包额外节点：${group}/${id}`);
        continue;
      }
      const s = srcById.get(id);
      const p = pkgById.get(id);
      deepEqualSemantic(
        s.position ?? null,
        p.position ?? null,
        `${group}/${id}.position`,
      );
      deepEqualSemantic(
        s.rotation ?? null,
        p.rotation ?? null,
        `${group}/${id}.rotation`,
      );
      deepEqualSemantic(
        s.scale ?? null,
        p.scale ?? null,
        `${group}/${id}.scale`,
      );
      deepEqualSemantic(
        s.parentId ?? null,
        p.parentId ?? null,
        `${group}/${id}.parentId`,
      );
      deepEqualSemantic(
        s.params ?? null,
        p.params ?? null,
        `${group}/${id}.params`,
      );
    }
  }

  // ⑤ 私有区剥离核验
  const privateKeys = Object.keys(pkgData).filter((k) => k.startsWith("__"));
  if (privateKeys.length) {
    problems.push(`运行包 scene-data 残留私有区：${privateKeys.join(", ")}`);
  }

  const nodeCount = [...srcGroups.values()].reduce((s, n) => s + n.length, 0);
  return {
    ok: problems.length === 0,
    problems,
    summary: `${nodeCount} 节点全字段（transform/parentId/params）双向一致；${Object.keys(editVisuals).length} 视觉条目语义值一致；${Object.keys(editMatLib).length} 材质条目语义值一致；私有区已剥离`,
  };
};

/* ── CLI（入口守卫：被 import 时不执行） ─────────────────────────────────── */
const main = () => {
  const [srcArg, pkgArg] = process.argv.slice(2);
  if (!srcArg || !pkgArg) {
    console.error(
      "用法: node fidelity-compare.mjs <src-project> <runtime-package>",
    );
    process.exit(2);
  }
  const src = resolve(srcArg);
  const pkg = resolve(pkgArg);
  const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
  const srcDataPath = join(src, "public", "scene-data.json");
  const pkgDataPath = join(pkg, "public", "scene-data.json");
  const appPath = join(pkg, "src", "scene-core", "generated", "appearance.ts");
  for (const p of [srcDataPath, pkgDataPath, appPath]) {
    if (!existsSync(p)) {
      console.error(`[fidelity] 输入缺失: ${p}`);
      process.exit(2);
    }
  }
  const result = compareFidelity(
    readJson(srcDataPath),
    readJson(pkgDataPath),
    readFileSync(appPath, "utf8"),
  );
  if (!result.ok) {
    console.log(`FIDELITY FAIL: ${result.problems.length} 项保真缺口`);
    for (const p of result.problems) {
      console.log(`  ✗ ${p}`);
    }
    process.exit(1);
  }
  console.log(`FIDELITY PASS: ${result.summary}`);
  process.exit(0);
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
