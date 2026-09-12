#!/usr/bin/env node
/**
 * Validate canonical sources, generated outputs, dependency bundles and release locks.
 * 移植自 scripts/validate_library.py（W3/D18），行为逐条对齐，diff 验证见 tests/migration_diff.mjs。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { outputs as tokenOutputs } from './build_tokens.mjs';
import { outputs as indexOutputs } from './build_indexes.mjs';
import { safePath } from './asset_graph.mjs';
import { schemaErrors } from './schema_tools.mjs';
import { manifestDigestSorted as manifestDigest, releaseDigest } from './refresh_release.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function check(root = ROOT, skipLock = false) {
  const errors = [];
  try {
    const generated = { ...tokenOutputs(root), ...indexOutputs(root) };
    for (const [rel, text] of Object.entries(generated)) {
      const p = path.join(root, rel);
      if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== text) {
        errors.push(`Generated output out of date: ${rel}`);
      }
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'asset-manifest.json'), 'utf8'));
    const components = JSON.parse(fs.readFileSync(path.join(root, 'components/index.json'), 'utf8')).components;
    const templates = JSON.parse(fs.readFileSync(path.join(root, 'components/templates.json'), 'utf8')).templates;
    const interactions = JSON.parse(fs.readFileSync(path.join(root, 'components/interactions.json'), 'utf8')).interactions;
    const tokens = JSON.parse(fs.readFileSync(path.join(root, 'design/tokens.json'), 'utf8'));
    const known = new Set(
      Object.values(tokens.groups).flatMap((g) => Object.keys(g.tokens)),
    );
    for (const [kind, index] of [['component', components], ['template', templates]]) {
      for (const [key, item] of Object.entries(index)) {
        if (key !== item.id) errors.push(`Inconsistent canonical id: ${key}`);
        if (item.assetVersion !== manifest.assetVersion) errors.push(`Version mismatch: ${key}`);
        for (const f of item.files) {
          if (!fs.existsSync(safePath(root, f))) errors.push(`Missing dependency ${f}`);
        }
      }
    }
    for (const [key, item] of Object.entries(templates)) {
      for (const f of ['appEntry', 'configFile', 'configPreset', 'configSchema']) {
        if (!fs.existsSync(safePath(root, item[f]))) errors.push(`Missing template ${f}: ${key}`);
      }
      errors.push(
        ...schemaErrors(
          JSON.parse(fs.readFileSync(safePath(root, item.configPreset), 'utf8')),
          JSON.parse(fs.readFileSync(safePath(root, item.configSchema), 'utf8')),
          key,
        ),
      );
      if (item.criticalInteractions.some((i) => !(i in interactions))) {
        errors.push(`Unknown template interaction ${key}`);
      }
      if (item.components.some((c) => !(c in components))) errors.push(`Unknown template component ${key}`);
    }
    const sourceDir = path.join(root, 'frontend/element-plus/src');
    const texts = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const child = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(child);
        else if (
          ['.vue', '.ts', '.scss', '.css'].includes(path.extname(entry.name)) &&
          !['examples.vue', 'examples.ts'].includes(entry.name)
        ) {
          texts.push(fs.readFileSync(child, 'utf8'));
        }
      }
    };
    walk(sourceDir);
    const combined = texts.join('\n');
    for (const m of combined.matchAll(/['"]?(--[\w-]+)['"]?\s*:/g)) known.add(m[1]);
    const missing = new Set(
      [...combined.matchAll(/var\((--[\w-]+)/g)]
        .map((m) => m[1])
        .filter((n) => !known.has(n) && !n.startsWith('--el-')),
    );
    if (missing.size) errors.push(`Undefined source tokens: ${[...missing].sort().join(', ')}`);
    if (!skipLock) {
      const lock = JSON.parse(fs.readFileSync(safePath(root, manifest.sourceLock), 'utf8'));
      const metadata = manifestDigest(manifest);
      if (lock.manifestSha256 !== metadata) errors.push('Manifest metadata mismatch');
      for (const [rel, h] of Object.entries(lock.files)) {
        const p = safePath(root, rel);
        if (!fs.existsSync(p) || crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') !== h) {
          errors.push(`Release lock mismatch: ${rel}`);
        }
      }
      const expected = releaseDigest(metadata, lock.files);
      if (expected !== manifest.sourceReleaseSha256 || expected !== lock.sourceReleaseSha256) {
        errors.push('Release digest mismatch');
      }
    }
  } catch (error) {
    errors.push(error.message);
  }
  return errors;
}

function main() {
  const skipLock = process.argv.includes('--skip-lock');
  const errors = check(undefined, skipLock);
  if (errors.length) {
    for (const e of errors) console.log(`ERROR: ${e}`);
    process.exit(1);
  }
  console.log('Library source, token generation, indexes and dependencies are valid.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
