/** One attempt only. The skill owns the bounded repair policy; never launch a browser. */
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareProjectEnvironment, createBuildInput } from './lib/project-environment.mjs';
import { spawnSync } from 'node:child_process';
import { checkProject } from './build.mjs';
import { checkEnvironment } from './lib/environment.mjs';
import { checkAssembly } from './lib/assembly-check.mjs';
import { resolveWorkspace } from './lib/workspace.mjs';

import { acquireBuildLock, inputDigest, runPreparation } from './lib/build-guard.mjs';

const target = process.argv[2];
const extra = process.argv.slice(3);
if (extra.length && (extra[0] !== '--prepare' || !extra[1])) {
  console.error('用法：build-offline.mjs <工程目录> [--prepare <可执行文件> ...参数]');
  process.exit(2);
}
if (!target) {
  console.error('用法：node scripts/build-offline.mjs <工程目录>');
  process.exit(2);
}
let input;
let releaseLock;
const totalStarted = performance.now();
try {
  const root = resolveWorkspace(target);
  releaseLock = acquireBuildLock(root);
  if (extra.length) {
    const prepareStarted = performance.now();
    try { runPreparation(extra[1], extra.slice(2), root, spawnSync); }
    finally { console.log(`TIMING: preparation=${Math.round(performance.now() - prepareStarted)}ms`); }
  }
  const env = checkEnvironment();
  const publisher = await import(pathToFileURL(join(root, 'scripts/publish-preview.mjs')).href);
  if (publisher.externalInputVersion !== 1) throw new Error('工程构建脚本版本较旧：请保留用户修改，将 template/scripts/build-offline.mjs 和 publish-preview.mjs 的更新合入 source/scripts 后重试');
  const checkedDigest = inputDigest(root, { ignoreLockfile: true });
  const started = performance.now();
  const result = checkProject(root);
  console.log(`TIMING: static-check=${Math.round(performance.now() - started)}ms`);
  result.warnings.forEach((warning) => console.warn(warning));
  if (!result.ok) {
    console.error('RESULT: FAIL | STATIC_CHECK');
    result.errors.forEach((error) => console.error(error));
    process.exitCode = 1;
  } else {
    const projectEnv = prepareProjectEnvironment(root, env);
    if (inputDigest(root, { ignoreLockfile: true }) !== checkedDigest) throw new Error('BUILD_INPUT_CHANGED：检查或依赖准备期间源文件变化，请重新构建');
    const digest = inputDigest(root);
    input = createBuildInput(root, projectEnv);
    if (inputDigest(root) !== digest || inputDigest(input.source) !== digest) throw new Error('BUILD_INPUT_CHANGED：复制期间源文件变化，未启动装配检查');
    const assemblyStarted = performance.now();
    const assembly = await checkAssembly(input.source);
    console.log(`TIMING: assembly-check=${Math.round(performance.now() - assemblyStarted)}ms`);
    console.log(`ASSEMBLY: ${assembly.ok ? (assembly.skipped.length ? 'partial' : 'passed') : 'failed'} | checked=${assembly.checked}, skipped=${assembly.skipped.length}`);
    console.log('RUNTIME: not-run (no browser, rendering or interaction check)');
    assembly.skipped.forEach(message => console.warn(`UNCHECKED: ${message}`));
    if (!assembly.ok) {
      assembly.errors.forEach(message => console.error(message));
      console.error('RESULT: FAIL | ASSEMBLY_CHECK');
      throw new Error('装配检查未通过');
    }
    const child = spawnSync(env.node, [resolve(input.source, 'scripts/build-offline.mjs')], { cwd: input.source, stdio: 'inherit', env: { ...process.env, SCENE3D_BUILD_ONLY: '1' } });
    if (child.error) throw child.error;
    process.exitCode = child.status ?? 1;
    if (process.exitCode) console.error('RESULT: FAIL | OFFLINE_BUILD');
    else {
      if (inputDigest(root) !== digest) throw new Error('BUILD_INPUT_CHANGED：构建期间源文件变化，未发布过期产物，请完成修改后重建');
      const html = publisher.publishPreview(root, dirname(root), join(input.source, 'offline'));
      console.log(`RESULT: OK\nHTML_PATH: ${html}`);
    }
  }
} catch (error) {
  console.error(`RESULT: FAIL | ${error.message}`);
  if (error.hint) console.error(`HINT: ${error.hint}`);
  process.exitCode = 1;
} finally {
  try { input?.dispose(); } finally {
    releaseLock?.();
    console.log(`TIMING: total=${Math.round(performance.now() - totalStarted)}ms`);
  }
}
