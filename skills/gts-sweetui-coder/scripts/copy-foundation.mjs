#!/usr/bin/env node
// Copy only explicitly selected, versioned components. Never overwrite project source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const catalog = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/foundation');
const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => value.replace(/\r\n/g, '\n');

function fail(code, message) {
  throw Object.assign(new Error(message), { code });
}

function noLinks(root, target) {
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail('PATH', 'Target escapes project');
  let current = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (stat.isSymbolicLink()) fail('PATH', `Linked target is not allowed: ${current}`);
  }
}

try {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i];
    if (name === '--check') {
      if (options.check) fail('ARGS', 'Duplicate --check');
      options.check = true;
    } else if (['--dir', '--page', '--assets'].includes(name)) {
      if (options[name] || !args[i + 1] || args[i + 1].startsWith('--')) fail('ARGS', `Invalid ${name}`);
      options[name] = args[++i];
    } else fail('ARGS', `Unknown option: ${name}`);
  }
  if (!options['--dir'] || !options['--page'] || !options['--assets']) {
    fail('ARGS', 'Usage: --dir <project> --page <PascalCasePage> --assets <id,id> [--check]');
  }
  const page = options['--page'];
  if (!/^[A-Z][A-Za-z0-9]*$/.test(page)) fail('PAGE', 'Page must be an init-generated PascalCase name');
  const project = fs.realpathSync(path.resolve(options['--dir']));
  const pageDir = path.join(project, 'src/pages', page);
  noLinks(project, pageDir);
  if (!fs.existsSync(path.join(pageDir, 'index.vue'))) fail('PAGE', `Initialize page first: ${pageDir}`);
  const selected = options['--assets'].split(',');
  if (new Set(selected).size !== selected.length || selected.some(id => !id)) fail('ASSETS', 'Duplicate or empty asset ID');
  const manifest = JSON.parse(fs.readFileSync(path.join(catalog, 'manifest.json'), 'utf8'));
  const receiptPath = path.join(project, '.gts-assets.json');
  noLinks(project, receiptPath);
  let receipt = { schemaVersion: 1, assets: {} };
  if (fs.existsSync(receiptPath)) {
    try { receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8')); }
    catch { fail('RECEIPT', 'Invalid .gts-assets.json; preserve it and inspect before retry'); }
    if (receipt.schemaVersion !== 1 || !receipt.assets || Array.isArray(receipt.assets) || typeof receipt.assets !== 'object') {
      fail('RECEIPT', 'Unsupported asset receipt');
    }
  }
  // Validate the entire selection before creating directories or files.
  const plan = selected.map(id => {
    if (!Object.hasOwn(manifest.assets, id)) fail('ASSETS', `Unknown asset: ${id}`);
    const entry = manifest.assets[id];
    const source = path.resolve(catalog, entry.file);
    noLinks(catalog, source);
    const bytes = fs.readFileSync(source);
    if (hash(bytes) !== entry.sha256) fail('INTEGRITY', `Source hash mismatch: ${id}`);
    const relative = `src/pages/${page}/components/foundation/${id}.vue`;
    const destination = path.join(project, relative);
    noLinks(project, destination);
    const expected = canonical(bytes.toString('utf8'));
    if (fs.existsSync(destination) && canonical(fs.readFileSync(destination, 'utf8')) !== expected) {
      fail('CONFLICT', `Preserved modified or different-version file: ${destination}`);
    }
    const installed = receipt.assets[relative];
    if (installed && (installed.id !== id || installed.version !== entry.version || installed.sourceSha256 !== entry.sha256)) {
      fail('CONFLICT', `Preserved different-version receipt: ${relative}`);
    }
    return { id, entry, relative, destination, bytes, exists: fs.existsSync(destination) };
  });

  if (!options.check) {
    for (const item of plan) {
      if (!item.exists) {
        fs.mkdirSync(path.dirname(item.destination), { recursive: true });
        noLinks(project, item.destination);
        // Exclusive creation also protects a concurrently created file.
        fs.writeFileSync(item.destination, item.bytes, { flag: 'wx' });
      }
      receipt.assets[item.relative] = {
        id: item.id, version: item.entry.version, sourceSha256: item.entry.sha256
      };
    }
    const serialized = JSON.stringify(receipt, null, 2) + '\n';
    if (!fs.existsSync(receiptPath) || fs.readFileSync(receiptPath, 'utf8') !== serialized) {
      fs.writeFileSync(receiptPath, serialized);
    }
  }
  console.log('RESULT: OK');
  console.log('MODE: ' + (options.check ? 'check (no writes)' : 'copy'));
  for (const item of plan) {
    console.log(`${item.exists ? 'REUSED' : options.check ? 'PLANNED' : 'COPIED'}: ${item.id}@${item.entry.version} -> ${item.destination}`);
  }
  console.log('NEXT: assemble props/emits/slots using SweetUI contracts, then build');
} catch (error) {
  console.error(`RESULT: FAIL | ${error.code || 'COPY'}: ${error.message}`);
  console.error('HINT: Inspect the reported path/arguments. Existing source is never overwritten. If an I/O failure left a partial copy, rerun after resolving the cause; identical files are reusable.');
  process.exitCode = 1;
}
