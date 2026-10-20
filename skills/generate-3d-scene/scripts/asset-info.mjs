/** Cached exact-id lookup. Missing measurements are explicit, never guessed. */
import { loadIndex } from './search-assets.mjs';
import { DEFAULT_LIB } from './build-search-index.mjs';
import { resolve } from 'node:path';
try {
  const args = process.argv.slice(2);
  const libAt = args.indexOf('--lib');
  const { index } = loadIndex(libAt >= 0 ? resolve(args[libAt + 1]) : DEFAULT_LIB);
  const ids = libAt >= 0 ? args.filter((_, i) => i !== libAt && i !== libAt + 1) : args;
  if (!ids.length) throw new Error('Usage: asset-info.mjs <id> [id...] [--lib <directory>]');
  const results = ids.map((id) => index.docs.find((doc) => doc.id === id) ?? { id, error: 'Not found' });
  console.log(JSON.stringify(results, null, 2));
  if (results.some((r) => r.error)) process.exitCode = 3;
} catch (e) { console.error(`RESULT: FAIL | ${e.message}`); process.exitCode = 2; }
