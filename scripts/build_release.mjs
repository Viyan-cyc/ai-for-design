#!/usr/bin/env node
/**
 * Generate and verify one complete package release; optionally build its frontend.
 * 移植自 scripts/build_release.py（W3/D18），行为逐条对齐；subprocess 链从 Python 改为 node。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 与 Python rewrite() 对齐：仅当值等于旧版本时改写四个键。 */
function rewrite(value, oldVersion, newVersion) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        ['assetVersion', 'packageVersion', 'version', 'const'].includes(k) && v === oldVersion
          ? newVersion
          : rewrite(v, oldVersion, newVersion),
      ]),
    );
  }
  if (Array.isArray(value)) return value.map((v) => rewrite(v, oldVersion, newVersion));
  return value;
}

function main() {
  const argv = process.argv.slice(2);
  let version = null;
  let buildFrontend = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--version') {
      if (i + 1 >= argv.length) {
        console.error('Expected semantic version X.Y.Z');
        process.exit(1);
      }
      version = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--build-frontend') {
      buildFrontend = true;
    }
  }
  if (version && !/^\d+\.\d+\.\d+$/.test(version)) {
    console.error('Expected semantic version X.Y.Z');
    process.exit(1);
  }
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'asset-catalog.json'), 'utf8'));
  const lib = path.join(ROOT, catalog.libraries['g-design-enterprise'].root);
  const manifest = JSON.parse(fs.readFileSync(path.join(lib, 'asset-manifest.json'), 'utf8'));
  const oldVersion = manifest.assetVersion;
  const targetVersion = version || oldVersion;
  for (const relative of ['asset-catalog.json', 'assets/asset-catalog.json']) {
    const p = path.join(ROOT, relative);
    const value = JSON.parse(fs.readFileSync(p, 'utf8'));
    value.packageVersion = targetVersion;
    value.libraries['g-design-enterprise'].assetVersion = targetVersion;
    fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }
  const skillCatalogPath = path.join(ROOT, 'skill-catalog.json');
  const skillCatalog = JSON.parse(fs.readFileSync(skillCatalogPath, 'utf8'));
  skillCatalog.packageVersion = targetVersion;
  fs.writeFileSync(skillCatalogPath, `${JSON.stringify(skillCatalog, null, 2)}\n`, 'utf8');
  const yamlPath = path.join(ROOT, 'asset-manifest.yaml');
  let yaml = fs.readFileSync(yamlPath, 'utf8');
  yaml = yaml.replace(/(packageVersion:|release:) [^\n]+/g, (_m, key) => `${key} ${JSON.stringify(targetVersion)}`);
  fs.writeFileSync(yamlPath, yaml, 'utf8');
  if (version) {
    const SKIP_PARTS = new Set(['node_modules', 'dist', 'preview-dist', '.git', 'sources']);
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const child = path.join(dir, entry.name);
        const relParts = path.relative(ROOT, child).split(path.sep);
        if (entry.isDirectory()) {
          if (!SKIP_PARTS.has(entry.name)) walk(child);
          continue;
        }
        if (path.extname(child) !== '.json') continue;
        if (relParts.some((part) => SKIP_PARTS.has(part))) continue;
        if (child.includes('/assets/icons/')) continue;
        if (path.basename(child) === 'upstream-hashes.json') continue;
        const value = JSON.parse(fs.readFileSync(child, 'utf8'));
        const updated = rewrite(value, oldVersion, version);
        if (JSON.stringify(value) !== JSON.stringify(updated)) {
          fs.writeFileSync(child, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
        }
      }
    };
    walk(ROOT);
    fs.writeFileSync(yamlPath, fs.readFileSync(yamlPath, 'utf8').replaceAll(`"${oldVersion}"`, `"${version}"`), 'utf8');
  }
  const run = (cmd, args, options = {}) => {
    const result = spawnSync(cmd, args, { stdio: 'inherit', ...options });
    if (result.status !== 0) process.exit(result.status ?? 1);
  };
  for (const name of ['build_tokens.mjs', 'build_indexes.mjs', 'validate_library.mjs']) {
    const args = [path.join(lib, 'scripts', name)];
    if (name === 'validate_library.mjs') args.push('--skip-lock');
    run(process.execPath, args);
  }
  if (buildFrontend) {
    run('npm', ['run', 'build:library'], { cwd: path.join(lib, 'frontend/element-plus') });
  }
  run(process.execPath, [path.join(lib, 'scripts/refresh_release.mjs')]);
  run(process.execPath, [path.join(lib, 'scripts/validate_library.mjs')]);
  console.log('Release generated and verified. Run tests/validate_package.mjs for workflow checks.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
