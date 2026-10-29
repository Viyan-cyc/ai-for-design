/** Retained authoring recipe. Never overwrites the live scene or saved editor state. */
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandLayout } from './layout.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const input = resolve(root, process.argv[2] ?? 'src/layout-recipe.json');
  const output = resolve(root, process.argv[3] ?? 'public/layout-groups.generated.json');
  const canonical = (p) => existsSync(p) ? realpathSync(p) : resolve(realpathSync(dirname(p)), p.split(/[\\/]/).at(-1));
  const identity = (p) => process.platform === 'win32' ? canonical(p).toLowerCase() : canonical(p);
  if ([input, resolve(root, 'public/scene3d/scene-data.json')].some((p) => identity(p) === identity(output))) throw new Error('Output must not overwrite the recipe or live scene-data.json');
  const groups = expandLayout(JSON.parse(readFileSync(input, 'utf8').replace(/^\uFEFF/, '')));
  writeFileSync(output, `${JSON.stringify(groups, null, 2)}\n`, 'utf8');
  console.log(`RESULT: OK\nGROUPS_PATH: ${output}\nNODES: ${Object.values(groups).reduce((sum, nodes) => sum + nodes.length, 0)}`);
} catch (error) { console.error(`RESULT: FAIL | ${error.message}`); process.exitCode = 1; }
