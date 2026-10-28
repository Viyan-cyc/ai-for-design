/** Copy into the generated project's scripts/. Produces a candidate, never the live scene. */
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandLayout } from './layout.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const stagePath = resolve(root, 'scenes/stage.json');
  const recipePath = resolve(root, 'src/layout-recipe.json');
  const output = resolve(root, 'scenes/scene.generated.json');
  const live = resolve(root, 'public/scene3d/scene-data.json');
  if (existsSync(output)) {
    const canonical = (p) => process.platform === 'win32' ? realpathSync(p).toLowerCase() : realpathSync(p);
    if ([stagePath, recipePath, live].filter(existsSync).some(p => canonical(p) === canonical(output))) throw new Error('Candidate output aliases an input or live scene');
  }
  const read = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
  const stage = read(stagePath);
  if (!stage || typeof stage !== 'object' || Array.isArray(stage)) throw new Error('stage must be an object');
  const groups = expandLayout(read(recipePath));
  const scene = { ...stage };
  for (const [type, nodes] of Object.entries(groups)) {
    if (scene[type] !== undefined && !Array.isArray(scene[type])) throw new Error(`Invalid stage group: ${type}`);
    scene[type] = [...(scene[type] ?? []), ...nodes];
  }
  const ids = new Set();
  // Top-level lights are configuration; other arrays are business groups.
  for (const [type, nodes] of Object.entries(scene)) {
    if (type === 'lights' || !Array.isArray(nodes)) continue;
    for (const node of nodes) {
      if (!node || typeof node.id !== 'string' || !node.id || ids.has(node.id)) throw new Error(`Missing or duplicate node ID: ${node?.id}`);
      ids.add(node.id);
    }
  }
  writeFileSync(output, JSON.stringify(scene, null, 2) + '\n');
  console.log(`RESULT: OK\nCANDIDATE: ${output}\nNODES: ${ids.size}`);
} catch (error) { console.error(`RESULT: FAIL | ${error.message}`); process.exitCode = 1; }
