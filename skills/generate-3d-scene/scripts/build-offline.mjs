/** One attempt only. The skill owns the bounded repair policy; never launch a browser. */
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkProject } from './build.mjs';
import { checkEnvironment } from './lib/environment.mjs';
import { checkAssembly } from './lib/assembly-check.mjs';

const target = process.argv[2];
if (!target) {
  console.error('用法：node scripts/build-offline.mjs <工程目录>');
  process.exit(2);
}
const root = resolve(target);
try {
  const env = checkEnvironment();
  const started = performance.now();
  const result = checkProject(root);
  console.log(`TIMING: static-check=${Math.round(performance.now() - started)}ms`);
  result.warnings.forEach((warning) => console.warn(warning));
  if (!result.ok) {
    console.error('RESULT: FAIL | STATIC_CHECK');
    result.errors.forEach((error) => console.error(error));
    process.exitCode = 1;
  } else {
    const assemblyStarted = performance.now();
    const assembly = await checkAssembly(root);
    console.log(`TIMING: assembly-check=${Math.round(performance.now() - assemblyStarted)}ms`);
    console.log(`ASSEMBLY: ${assembly.ok ? (assembly.skipped.length ? 'partial' : 'passed') : 'failed'} | checked=${assembly.checked}, skipped=${assembly.skipped.length}`);
    console.log('RUNTIME: not-run (no browser, rendering or interaction check)');
    assembly.skipped.forEach(message => console.warn(`UNCHECKED: ${message}`));
    if (!assembly.ok) {
      assembly.errors.forEach(message => console.error(message));
      console.error('RESULT: FAIL | ASSEMBLY_CHECK');
      process.exit(1);
    }
    const child = spawnSync(env.node, [resolve(root, 'scripts/build-offline.mjs')], { cwd: root, stdio: 'inherit' });
    if (child.error) throw child.error;
    process.exitCode = child.status ?? 1;
    if (process.exitCode) console.error('RESULT: FAIL | OFFLINE_BUILD');
  }
} catch (error) {
  console.error(`RESULT: FAIL | ${error.message}`);
  if (error.hint) console.error(`HINT: ${error.hint}`);
  process.exitCode = 1;
}
