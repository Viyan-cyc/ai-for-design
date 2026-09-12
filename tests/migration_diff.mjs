#!/usr/bin/env node
/**
 * N1 迁移对照框架（D18 约束①的工具）。
 *
 * 对同一输入分别运行旧 .py 与新 .mjs，把产出写到独立临时目录后逐字节比较。
 * 唯一允许的差异是生成头注释中的脚本名（.py → .mjs）以及文档内嵌命令的同类改写，
 * 其余任何差异一律 FAIL。全部移植脚本 PASS 之前不删任何 .py。
 *
 * 用法：
 *   node tests/migration_diff.mjs                 # 跑全部已注册脚本
 *   node tests/migration_diff.mjs build_tokens    # 只跑指定脚本（名字不含扩展名）
 *
 * 新移植一个脚本后，在 CASES 里补一条用例即可纳入回归。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB_REL = JSON.parse(fs.readFileSync(path.join(ROOT, 'asset-catalog.json'), 'utf8'))
  .libraries['g-design-enterprise'].root;
const LIB = path.join(ROOT, LIB_REL);

/** 逐条替换规则：迁移导致且被允许的文本差异（顺序敏感，先长后短）。 */
const ALLOWED_REWRITES = [
  // 生成头注释与文档内嵌命令：python3/python 调用改为 node
  [/scripts\/build_tokens\.py/g, 'scripts/build_tokens.mjs'],
  [/scripts\/build_indexes\.py/g, 'scripts/build_indexes.mjs'],
  [/scripts\/export_icons\.py/g, 'scripts/export_icons.mjs'],
  [/scripts\/refresh_release\.py/g, 'scripts/refresh_release.mjs'],
  [/scripts\/validate_library\.py/g, 'scripts/validate_library.mjs'],
  [/scripts\/query_assets\.py/g, 'scripts/query_assets.mjs'],
  [/scripts\/asset_graph\.py/g, 'scripts/asset_graph.mjs'],
  [/scripts\/schema_tools\.py/g, 'scripts/schema_tools.mjs'],
];

function applyRewrites(text) {
  let out = text;
  for (const [pattern, replacement] of ALLOWED_REWRITES) out = out.replace(pattern, replacement);
  return out;
}

/** 递归收集 dir 下相对路径 → 文件内容的映射（跳过脚本自身与运行垃圾）。 */
function snapshot(dir) {
  const files = {};
  const SKIP = new Set(['node_modules', 'dist', 'preview-dist', '.git', '__pycache__', '.DS_Store']);
  const walk = (current, rel) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (SKIP.has(entry.name)) continue;
      const child = path.join(current, entry.name);
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(child, childRel);
      else files[childRel] = fs.readFileSync(child);
    }
  };
  walk(dir, '');
  return files;
}

/** 用全新副本准备沙箱：python 与 node 各一份，避免 .py 与 .mjs 运行互相看见对方的产出。 */
function makeSandbox(tag) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), `n1-diff-${tag}-`));
  const libDir = path.join(sandbox, 'library');
  fs.cpSync(LIB, libDir, {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}node_modules${path.sep}`) && path.basename(src) !== '.DS_Store',
  });
  return libDir;
}

function runPy(libDir, script, args) {
  // Windows 兜底：优先 python3，缺失时退回 python（任务卡要求）。
  const candidates = process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'];
  let last = null;
  for (const bin of candidates) {
    const result = spawnSync(bin, ['-B', path.join(libDir, 'scripts', script), ...args], {
      cwd: libDir,
      encoding: 'buffer',
    });
    if (result.error && result.error.code === 'ENOENT') continue; // 该解释器不存在，试下一个
    last = result;
    break;
  }
  if (!last) throw new Error('找不到可用的 Python 解释器');
  return last;
}

function runNode(libDir, script, args) {
  return spawnSync(process.execPath, [path.join(libDir, 'scripts', script), ...args], {
    cwd: libDir,
    encoding: 'buffer',
  });
}

/**
 * 用例定义。run 共同约定：
 * - 输入：同一份干净沙箱资产库；
 * - 过程：脚本自行写产出文件；
 * - 比较：结束后对整个沙箱做快照 diff。
 * modes 控制该用例跑哪些调用（默认两个模式各跑一次）。
 */
const CASES = [
  {
    name: 'build_tokens',
    script: 'build_tokens',
    args: [],
  },
  {
    name: 'build_indexes',
    script: 'build_indexes',
    args: [],
  },
  {
    name: 'refresh_release',
    script: 'refresh_release',
    args: [],
  },
  {
    name: 'query_assets.tokens.group',
    script: 'query_assets',
    args: ['tokens', 'frost-common'],
    compareStdout: true,
    sandbox: false, // 只读脚本：直接在真库上跑，不做快照
  },
  {
    name: 'query_assets.tokens.search',
    script: 'query_assets',
    args: ['tokens', '--search', '轻雾'],
    compareStdout: true,
    sandbox: false,
  },
  {
    name: 'query_assets.tokens.unknown',
    script: 'query_assets',
    args: ['tokens', 'no-such-token'],
    compareStdout: true,
    expectFail: true,
    sandbox: false,
  },
  {
    name: 'query_assets.components.list',
    script: 'query_assets',
    args: ['components'],
    compareStdout: true,
    sandbox: false,
  },
  {
    name: 'query_assets.components.key',
    script: 'query_assets',
    args: ['components', 'g-button'],
    compareStdout: true,
    sandbox: false,
  },
  {
    name: 'query_assets.templates.search',
    script: 'query_assets',
    args: ['templates', '--search', 'list'],
    compareStdout: true,
    sandbox: false,
  },
  {
    name: 'query_assets.icons.alias',
    script: 'query_assets',
    args: ['icons', '搜索'],
    compareStdout: true,
    sandbox: false,
  },
  {
    name: 'export_icons.single',
    script: 'export_icons',
    args: ['search', 'out/search.svg'],
    snapshot: ['out'],
  },
  {
    name: 'export_icons.all',
    script: 'export_icons',
    args: ['--all', 'out-icons'],
    snapshot: ['out-icons'],
  },
];

function compareBuffers(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function diffSnapshots(pyFiles, nodeFiles) {
  const problems = [];
  const keys = new Set([...Object.keys(pyFiles), ...Object.keys(nodeFiles)]);
  for (const key of [...keys].sort()) {
    if (!(key in pyFiles)) problems.push(`仅 .mjs 产出: ${key}`);
    else if (!(key in nodeFiles)) problems.push(`仅 .py 产出: ${key}`);
    else if (!compareBuffers(pyFiles[key], nodeFiles[key])) {
      const pyText = applyRewrites(pyFiles[key].toString('utf8'));
      const nodeText = nodeFiles[key].toString('utf8');
      if (pyText === nodeText) continue; // 差异全部落在允许的头注释改写内
      problems.push(`内容不同: ${key}`);
    }
  }
  return problems;
}

function runCase(item) {
  const usesSandbox = item.sandbox !== false;
  const pyLib = usesSandbox ? makeSandbox('py') : LIB;
  const nodeLib = usesSandbox ? makeSandbox('node') : LIB;
  try {
    const py = runPy(pyLib, `${item.script}.py`, item.args);
    const node = runNode(nodeLib, `${item.script}.mjs`, item.args);

    const problems = [];
    const pyOk = py.status === 0;
    const nodeOk = node.status === 0;
    if (item.expectFail) {
      if (pyOk || nodeOk) problems.push('预期失败但退出码为 0');
      else if (item.compareStdout) {
        if (applyRewrites(py.stdout.toString('utf8')) !== node.stdout.toString('utf8')) {
          problems.push('失败输出文本不同');
        }
      }
    } else {
      if (!pyOk) problems.push(`py 退出码 ${py.status}: ${py.stderr.toString('utf8').slice(0, 400)}`);
      if (!nodeOk) problems.push(`mjs 退出码 ${node.status}: ${node.stderr.toString('utf8').slice(0, 400)}`);
    }
    if (problems.length) return problems;

    if (item.compareStdout && !item.expectFail) {
      if (applyRewrites(py.stdout.toString('utf8')) !== node.stdout.toString('utf8')) {
        problems.push('stdout 文本不同');
      }
    }
    if (usesSandbox) {
      const scope = item.snapshot
        ? (dir) => Object.fromEntries(item.snapshot.map((s) => [s, snapshot(path.join(dir, s))]))
        : snapshot;
      // snapshot 形态不同（单目录 vs 整库），统一为整库快照再按 scope 过滤。
      const pyFiles = snapshot(pyLib);
      const nodeFiles = snapshot(nodeLib);
      if (item.snapshot) {
        const pick = (files) =>
          Object.fromEntries(
            Object.entries(files).filter(([rel]) => item.snapshot.some((s) => rel === s || rel.startsWith(`${s}/`))),
          );
        problems.push(...diffSnapshots(pick(pyFiles), pick(nodeFiles)));
      } else {
        problems.push(...diffSnapshots(pyFiles, nodeFiles));
      }
    }
    return problems;
  } finally {
    if (usesSandbox) {
      fs.rmSync(pyLib, { recursive: true, force: true });
      fs.rmSync(nodeLib, { recursive: true, force: true });
    }
  }
}

function main() {
  const only = process.argv.slice(2);
  const cases = only.length ? CASES.filter((c) => only.some((o) => c.name === o || c.name.startsWith(`${o}.`) || c.name.startsWith(o))) : CASES;
  if (!cases.length) {
    console.error('没有匹配的用例。可用：', CASES.map((c) => c.name).join(', '));
    process.exit(2);
  }
  let failed = 0;
  for (const item of cases) {
    const problems = runCase(item);
    if (problems.length) {
      failed += 1;
      console.log(`FAIL ${item.name}`);
      for (const problem of problems) console.log(`  - ${problem}`);
    } else {
      console.log(`PASS ${item.name}`);
    }
  }
  console.log(`\n${cases.length - failed}/${cases.length} PASS`);
  process.exit(failed ? 1 : 0);
}

main();
