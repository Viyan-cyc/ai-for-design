#!/usr/bin/env node
/**
 * Apply an approved bundle proposal after staging and validation; preserve failed state.
 * 1:1 port of sync_to_library.py (D18/N5) — behavior must be equivalent.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { safe, loadIndex, loadManifest, scanDirectory } from './scan_assets.mjs';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function bump(value, policy = 'keep') {
  if (policy === 'keep') return value;
  const parts = value.split('.').map((v) => parseInt(v, 10));
  if (policy === 'patch') parts[2] += 1;
  else if (policy === 'minor') {
    parts[1] += 1;
    parts[2] = 0;
  } else throw new Error('versionPolicy must be keep, patch or minor');
  return parts.join('.');
}

function replaceVersion(data, oldV, newV) {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [
        k,
        ['assetVersion', 'const', 'version'].includes(k) && v === oldV ? newV : replaceVersion(v, oldV, newV),
      ]),
    );
  }
  if (Array.isArray(data)) return data.map((v) => replaceVersion(v, oldV, newV));
  return data;
}

function reValid(s) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}

export function sync(prototypeRoot, libraryRoot, contractPath, proposal, dryRun = false) {
  const proto = path.resolve(prototypeRoot);
  const lib = path.resolve(libraryRoot);
  const c = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const blocked = [];
  const copies = [];
  const specs = [];
  const versionPolicy = proposal.versionPolicy ?? c.syncStrategy?.defaultVersionPolicy ?? 'keep';
  if (!['keep', 'patch', 'minor'].includes(versionPolicy)) blocked.push('Invalid versionPolicy');
  let currentScan = null;
  if (proposal.assetId !== c.assetId) blocked.push('Proposal assetId differs from library');
  if (!dryRun && proposal.approved !== true) blocked.push('Explicit approval required: set approved=true after review');
  for (const item of proposal.actionable ?? []) {
    try {
      const kind = item.kind;
      const cid = item.id;
      if (!['component', 'template'].includes(kind) || !reValid(cid)) throw new Error('Invalid asset identity');
      const index = loadIndex(lib, c, kind === 'component' ? 'components' : 'templates');
      const existing = index[cid];
      const entry = item.approvedIndexEntry ?? existing;
      if (!entry || typeof entry !== 'object') throw new Error('New asset requires reviewed approvedIndexEntry');
      const required =
        kind === 'component'
          ? ['id', 'name', 'source', 'level']
          : ['id', 'name', 'source', 'appEntry', 'configFile', 'configPreset', 'configSchema', 'criticalInteractions', 'useWhen'];
      if (required.some((key) => !(key in entry))) throw new Error('Incomplete canonical specification');
      if (entry.id !== cid || entry.source !== item.prototypeFile) throw new Error('Specification and source differ');
      const source = safe(proto, item.prototypeFile);
      const parent = path.dirname(source);
      if (!item.files || !Object.keys(item.files).length) throw new Error('Bundle hashes are required; rerun compare');
      if (existing && item.libraryHash) {
        if (currentScan === null) currentScan = scanDirectory(lib, c, 'library');
        const current = currentScan[kind === 'component' ? 'components' : 'templates'][cid];
        if (!current || current.hash !== item.libraryHash) throw new Error('Library changed since proposal');
      }
      for (const [rel, expected] of Object.entries(item.files)) {
        const f = safe(proto, rel);
        const destination = safe(lib, rel);
        const allowed = path.join(lib, c.projectRoot, 'src', kind === 'component' ? 'components' : 'page-templates');
        if (!destination.startsWith(allowed + path.sep) || path.dirname(f) !== parent) {
          throw new Error('Bundle outside asset directory');
        }
        if (!fs.existsSync(f) || !fs.statSync(f).isFile() || sha256(fs.readFileSync(f)) !== expected) {
          throw new Error('Stale or missing prototype source ' + rel);
        }
        copies.push([rel, f]);
      }
      if (kind === 'template') {
        for (const key of ['configPreset', 'configSchema']) {
          const rel = entry[key];
          const f = safe(proto, rel);
          if (!fs.existsSync(f)) {
            if (existing && fs.existsSync(safe(lib, rel))) continue;
            throw new Error('Template registration lacks ' + key);
          }
          if (!rel.startsWith(c.projectRoot + '/configs/') && !rel.startsWith(c.projectRoot + '/schemas/')) {
            throw new Error('Unexpected configuration path');
          }
          copies.push([rel, f]);
        }
      }
      const cleaned = Object.fromEntries(
        Object.entries(entry).filter(([k]) => !['spec', 'files', 'dependencies', 'tokens', 'components'].includes(k)),
      );
      specs.push(['components/' + (kind === 'component' ? 'specs' : 'templates') + '/' + cid + '.json', cleaned]);
    } catch (e) {
      if (e instanceof RangeError || e.code === 'ENOENT' || e instanceof TypeError || e instanceof Error) {
        blocked.push(String(e.message ?? e));
      } else blocked.push(String(e));
    }
  }
  if (blocked.length) return { dryRun, copied: [], blocked };

  const plan = copies.map(([r, f]) => ({ source: String(f), target: String(path.join(lib, r)), dryRun }));
  if (dryRun || !copies.length) return { dryRun, copied: plan, blocked: [] };

  // Stage the complete next release. Any validation failure leaves the library untouched.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gdesign-sync-'));
  try {
    const stage = path.join(tmp, 'library');
    fs.cpSync(lib, stage, {
      recursive: true,
      filter: (src) => {
        const base = path.basename(src);
        return !['node_modules', 'dist', 'preview-dist', '__pycache__', '.git'].includes(base);
      },
    });
    for (const [rel, source] of copies) {
      const target = safe(stage, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
    for (const [rel, data] of specs) {
      fs.writeFileSync(safe(stage, rel), JSON.stringify(data, null, 2) + '\n');
    }
    const oldV = loadManifest(stage, c).assetVersion;
    const newV = bump(oldV, versionPolicy);
    const walkJson = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          walkJson(p);
          continue;
        }
        if (!e.name.endsWith('.json')) continue;
        const rel = path.relative(stage, p).split(path.sep).join('/');
        if (rel.startsWith('design/sources/') || rel.includes('/assets/icons/')) continue;
        const value = JSON.parse(fs.readFileSync(p, 'utf8'));
        const updated = replaceVersion(value, oldV, newV);
        if (JSON.stringify(updated) !== JSON.stringify(value)) {
          fs.writeFileSync(p, JSON.stringify(updated, null, 2) + '\n');
        }
      }
    };
    walkJson(stage);
    const scriptMap = ['build_tokens', 'build_indexes', 'validate_library', 'refresh_release'];
    for (const name of scriptMap) {
      const script = path.join(stage, 'scripts', name + '.mjs');
      const args = [script];
      if (name === 'validate_library') args.push('--skip-lock');
      const r = spawnSync(process.execPath, args, { cwd: stage, encoding: 'utf8' });
      if (r.status) return { dryRun: false, copied: [], blocked: [String(r.stdout ?? '') + String(r.stderr ?? '')] };
    }
    const changes = [];
    const walkAll = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === '__pycache__') continue;
          walkAll(p);
        } else changes.push(p);
      }
    };
    walkAll(stage);
    const changedFiles = changes.filter((p) => {
      const rel = path.relative(stage, p);
      const libPath = path.join(lib, rel);
      return !fs.existsSync(libPath) || !fs.readFileSync(p).equals(fs.readFileSync(libPath));
    });
    const backup = new Map();
    const written = [];
    try {
      for (const p of changedFiles) {
        const target = path.join(lib, path.relative(stage, p));
        backup.set(target, fs.existsSync(target) ? fs.readFileSync(target) : null);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(p, target);
        written.push(target);
      }
    } catch (e) {
      for (const target of [...written].reverse()) {
        const data = backup.get(target);
        if (data === null) fs.unlinkSync(target);
        else fs.writeFileSync(target, data);
      }
      throw e;
    }
    return {
      dryRun: false,
      copied: plan,
      blocked: [],
      manifestVersion: newV,
      validation: 'source/configuration only; run frontend build and browser review separately',
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const take = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const output = take('-o') ?? take('--output');
  const dryRun = args.includes('--dry-run');
  for (const f of ['--dry-run', '-o', '--output']) {
    const i = args.indexOf(f);
    if (i >= 0) args.splice(i, f === '--dry-run' ? 1 : 2);
  }
  const positional = args.filter((a) => !a.startsWith('-'));
  if (positional.length < 4) {
    console.error('usage: node sync_to_library.mjs <contract> <prototype> <library> <proposal> [--dry-run] [-o output]');
    process.exit(2);
  }
  const [contractPath, prototype, library, proposalPath] = positional;
  const result = sync(prototype, library, contractPath, JSON.parse(fs.readFileSync(proposalPath, 'utf8')), dryRun);
  const text = JSON.stringify(result, null, 2);
  if (output) fs.writeFileSync(output, text + '\n');
  else console.log(text);
  process.exit(result.blocked.length ? 1 : 0);
}
