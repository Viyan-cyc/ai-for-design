#!/usr/bin/env node
/**
 * One-shot entry: scan prototype, compare with asset library, and optionally sync.
 * 1:1 port of extract_prototype_assets.py (D18/N5).
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compare } from './compare_assets.mjs';
import { sync } from './sync_to_library.mjs';

if (!(process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href)) {
  process.exit(0);
}

const args = process.argv.slice(2);
const take = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
let output = take('-o') ?? take('--output');
const dryRun = args.includes('--dry-run');
const yes = args.includes('--yes');
for (const f of ['--dry-run', '--yes', '-o', '--output']) {
  const i = args.indexOf(f);
  if (i >= 0) args.splice(i, f === '-o' || f === '--output' ? 2 : 1);
}
const positional = args.filter((a) => !a.startsWith('-'));
if (positional.length < 3) {
  console.error('usage: node extract_prototype_assets.mjs <contract> <prototype> <library> [--dry-run] [--yes] [-o output]');
  process.exit(2);
}
const [contractPath, prototype, library] = positional;
output = output ?? 'sync-proposal.json';

const proposal = compare(path.resolve(prototype), path.resolve(library), JSON.parse(fs.readFileSync(contractPath, 'utf8')));

console.log(JSON.stringify(proposal, null, 2));
fs.writeFileSync(output, JSON.stringify(proposal, null, 2) + '\n');
console.log(`\nProposal saved to ${output}`);

if (proposal.summary.actionable === 0) {
  console.log('No actionable items found.');
  process.exit(0);
}
if (dryRun) {
  console.log('\nDry run: no changes applied.');
  process.exit(0);
}
if (!yes) {
  console.log('\nRun with --yes to apply sync, or use sync_to_library.mjs manually.');
  process.exit(0);
}

proposal.approved = true;
const result = sync(path.resolve(prototype), path.resolve(library), path.resolve(contractPath), proposal, false);
console.log(JSON.stringify(result, null, 2));
process.exit(result.blocked?.length ? 1 : 0);
