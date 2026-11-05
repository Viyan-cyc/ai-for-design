/** One attempt only. The skill owns the bounded repair policy; never launch a browser. */
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareProjectEnvironment, createBuildInput } from './lib/project-environment.mjs';
import { spawnSync } from 'node:child_process';
import { checkProject } from './build.mjs';
import { checkEnvironment } from './lib/environment.mjs';
import { checkAssembly } from './lib/assembly-check.mjs';
import { resolveWorkspace } from './lib/workspace.mjs';

const target = process.argv[2];
if (!target) {
  console.error('用法：node scripts/build-offline.mjs <工程目录>');
  process.exit(2);
}
let input;
try {
  const root = resolveWorkspace(target);
  const env = checkEnvironment();
  const publisher = await import(pathToFileURL(join(root, 'scripts/publish-preview.mjs')).href);
  if (publisher.externalInputVersion !== 1) throw new Error('工程构建脚本版本较旧：请保留用户修改，将 template/scripts/build-offline.mjs 和 publish-preview.mjs 的更新合入 source/scripts 后重试');
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
    input = createBuildInput(root, projectEnv);
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
      const html = publisher.publishPreview(root, dirname(root), join(input.source, 'offline'));
      console.log(`RESULT: OK\nHTML_PATH: ${html}`);
    }
  }
} catch (error) {
  console.error(`RESULT: FAIL | ${error.message}`);
  if (error.hint) console.error(`HINT: ${error.hint}`);
  process.exitCode = 1;
} finally { input?.dispose(); }
