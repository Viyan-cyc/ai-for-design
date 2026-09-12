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
  // 文档内嵌命令：python3/python 调用改为 node
  [/python3 scripts\//g, 'node scripts/'],
  [/python scripts\//g, 'node scripts/'],
  // 生成头注释与文档内嵌命令：脚本名 .py → .mjs
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
  // 路径归一放在最后：把 JSON 字符串值里的反斜杠分隔符统一成正斜杠
  out = out.replace(/\\\\/g, '/');
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
      // 归一 CRLF：Windows 上旧 .py 的 write_text 默认 newline=None 会把 \n
      // 翻译成 \r\n，而 Node writeFileSync 保持 \n —— 换行差异不是移植缺陷。
      else files[childRel] = fs.readFileSync(child).toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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
  // PYTHONUTF8=1：Windows 默认 ANSI 代码页（如 GBK）读 UTF-8 源文件会
  // UnicodeDecodeError，UTF-8 模式让 read_text/open 全部按 UTF-8 处理
  // （与 Mac/WSL 的 locale 行为一致）。
  const candidates = process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'];
  let last = null;
  for (const bin of candidates) {
    const result = spawnSync(bin, ['-B', script.startsWith('/') ? script : path.join(libDir, script), ...args], {
      cwd: libDir,
      encoding: 'buffer',
      env: { ...process.env, PYTHONUTF8: '1' },
    });
    if (result.error && result.error.code === 'ENOENT') continue; // 该解释器不存在，试下一个
    last = result;
    break;
  }
  if (!last) throw new Error('找不到可用的 Python 解释器');
  return last;
}

function runNode(libDir, script, args) {
  return spawnSync(process.execPath, [script.startsWith('/') ? script : path.join(libDir, script), ...args], {
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
    name: 'validate_library.skip-lock',
    script: 'validate_library',
    args: ['--skip-lock'],
    compareStdout: true,
    // 校验器会读取仓库生成文件并与自身实现重新计算的产出比较；
    // 生成头注释含脚本名，两侧必须各自先用同语言生成器写沙箱再校验，否则头差异误报。
    setup: ['build_tokens', 'build_indexes'],
  },
  {
    name: 'validate_library.full',
    script: 'validate_library',
    args: [],
    compareStdout: true,
    setup: ['build_tokens', 'build_indexes', 'refresh_release'],
  },
  {
    // 安装器：两侧对同一真仓库分别安装到独立临时目录，比较安装出的整棵 skill 树。
    name: 'install_skills.fresh',
    run: () => {
      const problems = [];
      const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), 'n1-install-'));
      const pyDest = mk();
      const nodeDest = mk();
      try {
        const py = runPy(ROOT, 'installer/install_skills.py', [pyDest]);
        const node = runNode(ROOT, 'installer/install_skills.mjs', [nodeDest]);
        if (py.status !== 0) problems.push(`py 退出码 ${py.status}: ${py.stderr.toString('utf8').slice(0, 300)}`);
        if (node.status !== 0) problems.push(`mjs 退出码 ${node.status}: ${node.stderr.toString('utf8').slice(0, 300)}`);
        if (problems.length) return problems;
        problems.push(...diffSnapshots(snapshot(pyDest), snapshot(nodeDest)));
        return problems;
      } finally {
        fs.rmSync(pyDest, { recursive: true, force: true });
        fs.rmSync(nodeDest, { recursive: true, force: true });
      }
    },
  },
  {
    // 二次安装必须拒绝（destination 已有同名 skill）。
    name: 'install_skills.existing-rejected',
    run: () => {
      const problems = [];
      const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), 'n1-install2-'));
      const pyDest = mk();
      const nodeDest = mk();
      try {
        runPy(ROOT, 'installer/install_skills.py', [pyDest]);
        runNode(ROOT, 'installer/install_skills.mjs', [nodeDest]);
        const py2 = runPy(ROOT, 'installer/install_skills.py', [pyDest]);
        const node2 = runNode(ROOT, 'installer/install_skills.mjs', [nodeDest]);
        if (py2.status === 0) problems.push('py 二次安装未拒绝');
        if (node2.status === 0) problems.push('mjs 二次安装未拒绝');
        return problems;
      } finally {
        fs.rmSync(pyDest, { recursive: true, force: true });
        fs.rmSync(nodeDest, { recursive: true, force: true });
      }
    },
  },
  {
    // build_release --version 重写对照。ROOT 从脚本自身位置推导，因此沙箱必须复制完整仓库结构
    // （含 scripts/、installer 依赖的 catalog 等）并在沙箱内执行沙箱里的脚本副本。
    name: 'build_release.version',
    run: () => {
      const problems = [];
      const mk = () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'n1-release-'));
        for (const f of ['asset-catalog.json', 'skill-catalog.json', 'asset-manifest.yaml', 'validation-results.json']) {
          fs.cpSync(path.join(ROOT, f), path.join(dir, f));
        }
        fs.cpSync(path.join(ROOT, 'examples'), path.join(dir, 'examples'), { recursive: true });
        fs.cpSync(path.join(ROOT, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
        fs.cpSync(path.join(ROOT, 'assets'), path.join(dir, 'assets'), {
          recursive: true,
          filter: (src) => !src.includes(`${path.sep}node_modules${path.sep}`) && path.basename(src) !== '.DS_Store',
        });
        return dir;
      };
      const pyRoot = mk();
      const nodeRoot = mk();
      try {
        const py = runPy(pyRoot, 'scripts/build_release.py', ['--version', '1.5.1']);
        const node = runNode(nodeRoot, 'scripts/build_release.mjs', ['--version', '1.5.1']);
        if (py.status !== 0) problems.push(`py 退出码 ${py.status}: ${py.stderr.toString('utf8').slice(0, 300)}`);
        if (node.status !== 0) problems.push(`mjs 退出码 ${node.status}: ${node.stderr.toString('utf8').slice(0, 300)}`);
        if (problems.length) return problems;
        problems.push(...diffSnapshots(snapshot(pyRoot), snapshot(nodeRoot)));
        return problems;
      } finally {
        fs.rmSync(pyRoot, { recursive: true, force: true });
        fs.rmSync(nodeRoot, { recursive: true, force: true });
      }
    },
  },
  {
    // 不带 --version：仅刷新生成物并校验，不改版本号。
    name: 'build_release.noop',
    run: () => {
      const problems = [];
      const mk = () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'n1-release2-'));
        for (const f of ['asset-catalog.json', 'skill-catalog.json', 'asset-manifest.yaml', 'validation-results.json']) {
          fs.cpSync(path.join(ROOT, f), path.join(dir, f));
        }
        fs.cpSync(path.join(ROOT, 'examples'), path.join(dir, 'examples'), { recursive: true });
        fs.cpSync(path.join(ROOT, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
        fs.cpSync(path.join(ROOT, 'assets'), path.join(dir, 'assets'), {
          recursive: true,
          filter: (src) => !src.includes(`${path.sep}node_modules${path.sep}`) && path.basename(src) !== '.DS_Store',
        });
        return dir;
      };
      const pyRoot = mk();
      const nodeRoot = mk();
      try {
        const py = runPy(pyRoot, 'scripts/build_release.py', []);
        const node = runNode(nodeRoot, 'scripts/build_release.mjs', []);
        if (py.status !== 0) problems.push(`py 退出码 ${py.status}: ${py.stderr.toString('utf8').slice(0, 300)}`);
        if (node.status !== 0) problems.push(`mjs 退出码 ${node.status}: ${node.stderr.toString('utf8').slice(0, 300)}`);
        if (problems.length) return problems;
        problems.push(...diffSnapshots(snapshot(pyRoot), snapshot(nodeRoot)));
        return problems;
      } finally {
        fs.rmSync(pyRoot, { recursive: true, force: true });
        fs.rmSync(nodeRoot, { recursive: true, force: true });
      }
    },
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

/**
 * 归一化头注释差异：两侧沙箱各自由同语言生成器写文件时，GENERATED 头必然带各自脚本名，
 * 且该头会传播进 refresh_release 的哈希与 manifest。比较前把已知头行替换为统一占位。
 */
const HEADER_NORMALIZERS = [
  [/\/\/ GENERATED from design\/tokens\.json; edit the source, then run scripts\/build_tokens\.(py|mjs)\./g, '// GENERATED (header normalized)'],
  [/\/\* GENERATED from design\/tokens\.json\. Do not edit generated values\. \*\//g, '/* GENERATED (header normalized) */'],
  [/运行 `?(?:python3|python|node) scripts\/build_tokens\.(py|mjs)`?/g, '运行 `node scripts/build_tokens.mjs`'],
  [/变更后运行 scripts\/build_tokens\.(py|mjs)；/g, '变更后运行 scripts/build_tokens.mjs；'],
];

function normalizeHeaders(text) {
  let out = text;
  for (const [pattern, replacement] of HEADER_NORMALIZERS) out = out.replace(pattern, replacement);
  return out;
}

/**
 * 结构化归一 release 锁与 manifest：GENERATED 头差异会传播进内容哈希（files 值与
 * sourceReleaseSha256），文本归一化无法消除。哈希值的正确性由两侧各自 validate_library
 * 全绿保证；这里仅验证哈希覆盖的文件集合一致（keys 完全相同），把哈希值替换为占位。
 */
function normalizeHashBearing(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return text;
  }
  let touched = false;
  if (doc && typeof doc === 'object' && doc.files && typeof doc.files === 'object') {
    doc.files = Object.fromEntries(Object.keys(doc.files).sort().map((k) => [k, 'HASH']));
    touched = true;
  }
  if (doc && typeof doc === 'object' && 'sourceReleaseSha256' in doc) {
    doc.sourceReleaseSha256 = 'HASH';
    touched = true;
  }
  if (!touched) return text;
  return `${JSON.stringify(doc, null, 2)}\n`;
}

function diffSnapshots(pyFiles, nodeFiles) {
  const problems = [];
  const keys = new Set([...Object.keys(pyFiles), ...Object.keys(nodeFiles)]);
  for (const key of [...keys].sort()) {
    if (!(key in pyFiles)) problems.push(`仅 .mjs 产出: ${key}`);
    else if (!(key in nodeFiles)) problems.push(`仅 .py 产出: ${key}`);
    else if (!compareBuffers(pyFiles[key], nodeFiles[key])) {
      const pyNorm = normalizePosixSeparators(pyFiles[key].toString('utf8'));
      const nodeNorm = normalizePosixSeparators(nodeFiles[key].toString('utf8'));
      if (pyNorm === nodeNorm) continue; // 仅 Windows 反斜杠/排序差异
      const pyRaw = pyFiles[key].toString('utf8');
      const nodeRaw = nodeFiles[key].toString('utf8');
      // 哈希型 JSON（release 锁/manifest）：文件路径是键、内容哈希是值，文本改写会破坏键集合。
      // 改走结构化比较：哈希值占位（正确性由两侧各自 validate_library 全绿保证），仅比键集合与其余字段。
      const pyStruct = normalizeHashBearing(pyRaw);
      const nodeStruct = normalizeHashBearing(nodeRaw);
      if (pyStruct !== pyRaw || nodeStruct !== nodeRaw) {
        if (normalizePosixSeparators(pyStruct) !== normalizePosixSeparators(nodeStruct)) problems.push(`内容不同: ${key}`);
        continue;
      }
      const pyText = normalizeHeaders(applyRewrites(pyRaw));
      const nodeText = normalizeHeaders(nodeRaw);
      if (pyText !== nodeText) problems.push(`内容不同: ${key}`);
    }
  }
  return problems;
}

// py 版 build_indexes 在 Windows 下把 str(Path(...)) 形式的反斜杠路径写进
// files 列表（Mac 上 posix 恰好一致）。JSON 序列化后每个分隔符是 2 个反斜杠
// 字符的转义；且 py 的 sorted() 按字节序把反斜杠条目排到最后。文本级归一
// 无法同时消除「分隔符」与「排序」差异 —— 对 JSON 产物改走语义比较：
// parse 后把所有字符串值里的反斜杠分隔符归一、数组重排，再整体比较。
function normalizePosixSeparators(text) {
  const BS = String.fromCharCode(92);
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return text.split(BS + BS).join('/');
  }
  const walk = (v) => {
    if (typeof v === 'string') return v.split(BS).join('/');
    if (Array.isArray(v)) return v.map(walk).sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.keys(v).sort().map((k) => [k, walk(v[k])]));
    }
    return v;
  };
  return JSON.stringify(walk(doc), null, 2) + '\n';
}

function runCase(item) {
  // 自定义 run 的用例（安装器/build_release 等）自行控制两侧执行与比较。
  if (item.run) return item.run();
  const usesSandbox = item.sandbox !== false;
  const pyLib = usesSandbox ? makeSandbox('py') : LIB;
  const nodeLib = usesSandbox ? makeSandbox('node') : LIB;
  try {
    for (const setup of item.setup ?? []) {
      runPy(pyLib, `scripts/${setup}.py`, []);
      runNode(nodeLib, `scripts/${setup}.mjs`, []);
    }
    const py = runPy(pyLib, `scripts/${item.script}.py`, item.args);
    const node = runNode(nodeLib, `scripts/${item.script}.mjs`, item.args);

    const problems = [];
    const pyOk = py.status === 0;
    const nodeOk = node.status === 0;
    if (item.expectFail) {
      if (pyOk || nodeOk) problems.push('预期失败但退出码为 0');
      else if (item.compareStdout) {
        const pyOut = applyRewrites(py.stdout.toString('utf8')).replace(/\r\n/g, '\n');
        if (pyOut !== node.stdout.toString('utf8')) {
          problems.push('失败输出文本不同');
        }
      }
    } else {
      if (!pyOk) problems.push(`py 退出码 ${py.status}: ${py.stderr.toString('utf8').slice(0, 400)}`);
      if (!nodeOk) problems.push(`mjs 退出码 ${node.status}: ${node.stderr.toString('utf8').slice(0, 400)}`);
    }
    if (problems.length) return problems;

    if (item.compareStdout && !item.expectFail) {
      const pyOut = applyRewrites(py.stdout.toString('utf8')).replace(/\r\n/g, '\n');
      const nodeOut = node.stdout.toString('utf8');
      if (pyOut !== nodeOut) {
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
