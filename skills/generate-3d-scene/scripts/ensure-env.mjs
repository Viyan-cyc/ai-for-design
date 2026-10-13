/**
 * ensure-env.mjs — 环境预检（skill 会话启动时跑一次）
 *
 * 三项探测：
 *   ① node 版本（母版要求 ≥22：原生 WebSocket CDP / structuredClone / fetch）
 *   ② three 版本（模板锁定 0.185.1；读 template/package.json 声明 + 母版 node_modules 实装版本）
 *   ③ 多模态档位声明：环境变量 GTS3D_MULTIMODAL，或 --multimodal / --no-multimodal
 *      显式传入（SKILL.md 会话指令走这里）。二选一生效，都给时以 CLI 为准。
 *      声明值：1|true|yes → 多模态档；0|false|no|未声明 → 非多模态档。
 *      多模态档跑 smoke-visual 看图验证；非多模态档只跑结构断言，结论标注"未经视觉确认"。
 *
 * CLI：
 *   node ensure-env.mjs [--multimodal | --no-multimodal] [--json]
 *   退出码：0 全部就绪 / 1 有硬性缺失 / 2 用法错误
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_DIR = join(SKILL_ROOT, 'template');

const argv = process.argv.slice(2);
if (argv.some((a) => a === '-h' || a === '--help')) {
  console.log('用法: node ensure-env.mjs [--multimodal | --no-multimodal] [--json]');
  process.exit(0);
}
const asJson = argv.includes('--json');

const cliMultimodal = argv.includes('--multimodal') ? true : argv.includes('--no-multimodal') ? false : null;

const checks = [];
const check = (name, ok, detail, hard = true) => {
  checks.push({ name, ok, detail, hard });
};

// ① node 版本（冒烟/CDP 链路要求 ≥22）
const nodeMajor = Number(process.versions.node.split('.')[0]);
check('node>=22', nodeMajor >= 22, `node ${process.versions.node}`);

// ② three 版本：模板声明 + 实装（实装缺失只告警——init --deps copy 前母版可未装）
const EXPECTED_THREE = '0.185.1';
let threeDetail = `template 声明 ${EXPECTED_THREE}（锁定）`;
let threeOk = false;
const pkgPath = join(TEMPLATE_DIR, 'package.json');
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const declared = pkg.dependencies?.three ?? pkg.devDependencies?.three;
  threeOk = declared === EXPECTED_THREE;
  const installedPath = join(TEMPLATE_DIR, 'node_modules', 'three', 'package.json');
  if (existsSync(installedPath)) {
    const installed = JSON.parse(readFileSync(installedPath, 'utf8')).version;
    threeDetail = `声明 ${declared} / 实装 ${installed}`;
    threeOk = declared === EXPECTED_THREE && installed === EXPECTED_THREE;
  } else {
    threeDetail = `声明 ${declared} / 未安装（init --deps copy|install 时装）`;
  }
} else {
  threeDetail = 'template/package.json 缺失';
}
check('three@0.185.1', threeOk, threeDetail);

// ③ 多模态档位（CLI 优先于环境变量；两者皆无 → 非多模态档）
const envRaw = process.env.GTS3D_MULTIMODAL;
const envValue = envRaw === undefined ? null
  : ['1', 'true', 'yes'].includes(envRaw.toLowerCase()) ? true
    : ['0', 'false', 'no'].includes(envRaw.toLowerCase()) ? false : null;
if (cliMultimodal !== null) {
  check('multimodal', true, `CLI 声明 ${cliMultimodal ? '多模态档' : '非多模态档'}${envValue !== null ? '（覆盖环境变量）' : ''}`, false);
} else if (envValue !== null) {
  check('multimodal', true, `环境变量 GTS3D_MULTIMODAL=${envRaw} → ${envValue ? '多模态档' : '非多模态档'}`, false);
} else {
  check('multimodal', true, '未声明 → 默认非多模态档（结构验证，结论标注"未经视觉确认"）', false);
}

const failed = checks.filter((c) => !c.ok && c.hard);
const multimodal = checks.find((c) => c.name === 'multimodal');

if (asJson) {
  console.log(JSON.stringify({
    ok: failed.length === 0,
    node: process.versions.node,
    checks,
    multimodal: cliMultimodal ?? envValue ?? false,
  }, null, 2));
} else {
  for (const c of checks) {
    const tag = c.ok ? 'PASS' : c.hard ? 'FAIL' : 'WARN';
    console.log(`${tag}  ${c.name}  ${c.detail}`);
  }
  console.log(failed.length === 0
    ? `环境就绪。${multimodal.detail}`
    : `环境缺失 ${failed.length} 项（${failed.map((c) => c.name).join(', ')}）`);
}
process.exit(failed.length === 0 ? 0 : 1);
