/** Execute synchronous scene assembly, never a browser or visual acceptance pass. */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { dependencyPath, environment } from './environment.mjs';

export async function checkAssembly(project, { timeout = 30000 } = {}) {
  const root = resolve(project);
  const temp = mkdtempSync(join(tmpdir(), 'scene-assembly-'));
  try {
    const { build } = createRequire(import.meta.url)(dependencyPath('esbuild'));
    const core = join(root, 'src/scene3d/scene-core');
    const imports = {
      SceneEngine: join(core, 'engine/SceneEngine.ts'),
      AssetEngine: join(core, 'engine/AssetEngine.ts'),
      registerBuiltinFactories: join(core, 'handlers/registry.ts'),
      registerBusinessFactories: join(root, 'src/scene3d/scene-profile.ts'),
      RESERVED_KEYS: join(core, 'types.ts'),
    };
    const code = Object.entries(imports).map(([name, path]) =>
      `export { ${name} } from ${JSON.stringify(path)};`).join('\n');
    const bundle = join(temp, 'assembly.mjs');
    await build({ stdin: { contents: code, resolveDir: root, sourcefile: 'assembly-entry.ts' },
      outfile: bundle, bundle: true, platform: 'node', format: 'esm', sourcemap: 'inline',
      nodePaths: [dependencyPath()], alias: { '@': join(root, 'src') }, logLevel: 'silent' });
    const runner = join(dirname(fileURLToPath(import.meta.url)), 'assembly-runner.mjs');
    const child = spawnSync(environment().node,
      ['--enable-source-maps', runner, bundle, join(root, 'public/scene3d/scene-data.json'), join(temp, 'result.json')],
      { cwd: root, encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024 });
    if (child.error) throw new Error(`装配检查未完成：${child.error.code ?? child.error.message}（上限 ${timeout}ms）`);
    if (child.status !== 0) throw new Error(`装配检查进程失败：${child.stderr || child.stdout || child.status}`);
    return JSON.parse(readFileSync(join(temp, 'result.json'), 'utf8'));
  } catch (error) {
    return { ok: false, checked: 0, skipped: [], errors: [error.message] };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
