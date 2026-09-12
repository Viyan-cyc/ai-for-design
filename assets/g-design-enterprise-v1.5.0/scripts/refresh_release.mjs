#!/usr/bin/env node
/**
 * Refresh compact release metadata and its tool-only source lock after validation.
 * 移植自 scripts/refresh_release.py（W3/D18），行为逐条对齐，diff 验证见 tests/migration_diff.mjs。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function manifestDigest(data) {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([k]) => !['protectedFiles', 'sourceReleaseSha256'].includes(k)),
  );
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(clean), 'utf8') // JS stringify 等价 ensure_ascii=False；键序为插入序（Python 侧 sort_keys 见下）
    .digest('hex');
}

// 注意：Python 版 manifest_digest 用 sort_keys=True。JS 对象需按键排序后再序列化才能逐字节一致。
export function manifestDigestSorted(data) {
  const clean = Object.fromEntries(
    Object.entries(data)
      .filter(([k]) => !['protectedFiles', 'sourceReleaseSha256'].includes(k))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  return crypto.createHash('sha256').update(canonicalJson(clean), 'utf8').digest('hex');
}

/** 递归按键排序的 JSON 序列化（等价 json.dumps(..., sort_keys=True, separators=(',',':'), ensure_ascii=False)）。 */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function releaseDigest(metadata, files) {
  const lines = Object.entries(files)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}:${v}\n`)
    .join('');
  return crypto
    .createHash('sha256')
    .update(`manifest:${metadata}\n${lines}`, 'utf8')
    .digest('hex');
}

export function refresh(root = ROOT) {
  const manifestPath = path.join(root, 'asset-manifest.json');
  const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  delete data.protectedFiles;
  data.sourceLock = 'release/source-lock.json';
  data.sourceReleaseHashFormat = 'manifest-sha256 and sorted path:sha256 lines';
  const lockPath = path.join(root, data.sourceLock);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const SKIP_PARTS = new Set(['node_modules', 'dist', 'preview-dist', '.git', '__pycache__']);
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const child = path.join(dir, entry.name);
      const relParts = path.relative(root, child).split(path.sep);
      if (entry.isDirectory()) {
        if (!SKIP_PARTS.has(entry.name)) walk(child);
      } else if (
        !relParts.some((part) => SKIP_PARTS.has(part)) &&
        path.extname(entry.name) !== '.pyc' &&
        entry.name !== '.DS_Store' &&
        child !== manifestPath &&
        child !== lockPath
      ) {
        files.push(child);
      }
    }
  };
  walk(root);
  const hashes = Object.fromEntries(
    files
      .map((p) => [path.relative(root, p).split(path.sep).join('/'), crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])
      // Python Path 对象比较按 parts 元组逐段排序：'templates.json' 段在 'templates' 段之后，
      // 因此 'templates/ 子目录' 先于 'templates.json'（与整串 codepoint 排序不同）。
      .sort(([a], [b]) => {
        const pa = a.split('/');
        const pb = b.split('/');
        const len = Math.min(pa.length, pb.length);
        for (let i = 0; i < len; i += 1) {
          if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
        }
        return pa.length - pb.length;
      }),
  );
  const metadata = manifestDigestSorted(data);
  data.sourceReleaseSha256 = releaseDigest(metadata, hashes);
  fs.writeFileSync(
    lockPath,
    `${JSON.stringify({ manifestSha256: metadata, sourceReleaseSha256: data.sourceReleaseSha256, files: hashes }, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(manifestPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return hashes;
}

if (process.argv[1] && import.meta.url === `file://${fs.realpathSync(process.argv[1])}`) {
  const count = Object.keys(refresh()).length;
  console.log(`Refreshed ${count} source hashes in release/source-lock.json.`);
}
