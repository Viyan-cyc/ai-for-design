#!/usr/bin/env node
/**
 * Scan component bundles, including styles and types, using canonical IDs.
 * 1:1 port of scan_assets.py (D18/N5) — output must be byte-equivalent.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export function safe(root, rel) {
  root = path.resolve(root);
  const p = path.resolve(root, rel);
  if (path.isAbsolute(rel) || !p.startsWith(root + path.sep)) {
    throw new Error('Path escapes root: ' + String(rel));
  }
  return p;
}

export function loadIndex(root, contract, kind) {
  const m = contract.indexMapping;
  const p = path.join(root, contract.discovery.indexes, m[kind]);
  if (fs.existsSync(p)) {
    return JSON.parse(fs.readFileSync(p, 'utf8'))[kind === 'components' ? m.rootKey : m.templateRootKey];
  }
  const specs = path.join(root, 'components', kind === 'components' ? 'specs' : 'templates');
  const out = {};
  if (!fs.existsSync(specs)) return out;
  for (const f of fs.readdirSync(specs).sort()) {
    if (!f.endsWith('.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(specs, f), 'utf8'));
    out[d.id] = d;
  }
  return out;
}

export function loadManifest(root, contract) {
  return JSON.parse(fs.readFileSync(path.join(root, contract.discovery.manifest), 'utf8'));
}

export function toKebabId(name) {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

export function scanDirectory(root, contract, target = 'prototype') {
  root = path.resolve(root);
  const result = { target, root: String(root), components: {}, templates: {} };
  const SKIP = new Set(['examples.vue', 'examples.ts', 'README.md', 'metadata.json', '.DS_Store']);
  const EXT = new Set(['.vue', '.ts', '.js', '.scss', '.css', '.json']);
  for (const [kind, pattern] of [
    ['components', contract.discovery.components],
    ['templates', contract.discovery.templates],
  ]) {
    const registered = loadIndex(root, contract, kind);
    const sources = new Map(Object.entries(registered).map(([cid, d]) => [d.source, cid]));
    const candidates = new Set();
    // fs.globSync 的 {root} 选项对相对 pattern 不生效（Node 24 实测返回空），须拼绝对路径
    for (const p of fs.globSync(path.join(root, pattern))) {
      if (fs.statSync(p).isFile() && path.basename(p) !== 'examples.vue') {
        candidates.add(path.relative(root, p).split(path.sep).join('/'));
      }
    }
    for (const d of Object.values(registered)) {
      if (fs.existsSync(safe(root, d.source))) candidates.add(d.source);
    }
    for (const rel of [...candidates].sort()) {
      const p = safe(root, rel);
      const dir = path.dirname(p);
      const cid =
        sources.get(rel) ??
        toKebabId(path.basename(rel) === 'index.ts' ? path.basename(dir) : path.basename(rel, path.extname(rel)));
      const bundle = {};
      for (const f of fs.readdirSync(path.dirname(p)).sort()) {
        const fp = path.join(path.dirname(p), f);
        if (!fs.statSync(fp).isFile()) continue;
        if (SKIP.has(f) || !EXT.has(path.extname(f))) continue;
        bundle[path.relative(root, fp).split(path.sep).join('/')] = sha256(fs.readFileSync(fp));
      }
      const h = sha256(
        Buffer.from(
          Object.entries(bundle)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([r, v]) => `${r}:${v}\n`)
            .join(''),
        ),
      );
      result[kind][cid] = { id: cid, file: rel, absolute: String(p), hash: h, files: bundle };
    }
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const [, , contractPath, root, target] = process.argv;
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  console.log(JSON.stringify(scanDirectory(path.resolve(root), contract, target ?? 'prototype'), null, 2));
}
