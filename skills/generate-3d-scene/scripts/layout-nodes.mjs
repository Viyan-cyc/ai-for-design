/** Expand a compact layout into ordinary, independently editable scene nodes. */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { expandLayout } from '../template/scripts/layout.mjs';
export { expandLayout };
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [input, output] = process.argv.slice(2);
    if (!input || !output) throw new Error('Usage: layout-nodes.mjs <patterns.json> <groups.json>');
    const groups = expandLayout(JSON.parse(readFileSync(input, 'utf8').replace(/^\uFEFF/, '')));
    writeFileSync(output, `${JSON.stringify(groups, null, 2)}\n`, 'utf8');
    console.log(`RESULT: OK\nOUTPUT: ${output}\nNODES: ${Object.values(groups).reduce((sum, nodes) => sum + nodes.length, 0)}`);
  } catch (e) { console.error(`RESULT: FAIL | ${e.message}`); process.exitCode = 1; }
}
