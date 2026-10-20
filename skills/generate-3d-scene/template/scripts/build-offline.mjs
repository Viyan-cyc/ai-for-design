import { runtimeCompatibility } from './runtime-compatibility.mjs';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, renameSync, rmSync, openSync, closeSync } from 'node:fs';
import { resolve, dirname, relative, extname, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const publicDir = resolve(root, 'public');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.json': 'application/json', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.js': 'text/javascript' };
const resources = Object.create(null);
let needsDraco = false;

function visit(value, fn) {
  if (Array.isArray(value)) value.forEach((item) => visit(item, fn));
  else if (value && typeof value === 'object') {
    fn(value);
    Object.values(value).forEach((item) => visit(item, fn));
  }
}

function collect(url, base = '') {
  if (/^data:/i.test(url)) return;
  if (/^(?:[a-z]+:|\/\/)/i.test(url)) throw new Error(`离线资源必须位于 public 内：${url}`);
  const key = posix.normalize(posix.join(url.startsWith('/') ? '' : base, decodeURIComponent(url.split(/[?#]/)[0]).replace(/^\//, '')));
  if (resources[key]) return;
  const file = resolve(publicDir, key);
  if (!file.startsWith(`${publicDir}${sep}`)) throw new Error(`资源路径越界：${url}`);
  if (!existsSync(file)) throw new Error(`缺少离线资源：${key}`);
  const bytes = readFileSync(file);
  resources[key] = `data:${mime[extname(file).toLowerCase()] ?? 'application/octet-stream'};base64,${bytes.toString('base64')}`;
  let gltf;
  if (extname(file).toLowerCase() === '.gltf') gltf = JSON.parse(bytes.toString('utf8'));
  if (extname(file).toLowerCase() === '.glb') {
    if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`无效 GLB：${key}`);
    gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8').trim());
  }
  if (gltf) {
    const compatibility = runtimeCompatibility(gltf);
    if (compatibility.status === 'unsupported') throw new Error(`Unsupported model extensions in ${key}: ${compatibility.missing.join(', ')}; choose a compatible asset or procedural geometry`);
    for (const item of [...(gltf.buffers ?? []), ...(gltf.images ?? [])]) {
      if (item.uri) collect(item.uri, posix.dirname(key));
    }
    if (gltf.extensionsUsed?.includes('KHR_draco_mesh_compression')) needsDraco = true;
  }
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = resolve(dir, item.name);
    return item.isDirectory() ? walk(path) : [path];
  });
}

const out = resolve(root, 'offline');
const lock = resolve(root, '.offline-build.lock');
let fd;
let stage;
let backup;
const timings = {};
let checkpoint = performance.now();
const timed = (name) => { const now = performance.now(); timings[name] = Math.round(now - checkpoint); checkpoint = now; };
try {
  fd = openSync(lock, 'wx');
  if (existsSync(out) && !existsSync(resolve(out, '.gts3d-offline'))) {
    throw new Error('offline 目录不属于离线构建，请选择其他工程或手动保留该目录后再构建');
  }
  checkpoint = performance.now();
  const checked = spawnSync(process.execPath, [require.resolve('vue-tsc/bin/vue-tsc.js'), '-b'], { cwd: root, stdio: 'inherit' });
  timed('typecheck');
  if (checked.error) throw checked.error;
  if (checked.status !== 0) throw new Error('类型检查未通过');
  const scene = JSON.parse(readFileSync(resolve(publicDir, 'scene-data.json'), 'utf8'));
  const manifestFile = resolve(publicDir, 'assets/asset-manifest.json');
  const allManifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
  const manifest = Object.create(null);
  visit(scene, (obj) => {
    if (typeof obj.assetId === 'string') {
      const entry = allManifest[obj.assetId] ?? { model: `models/${obj.assetId}.glb`, format: 'glb' };
      manifest[obj.assetId] = entry;
      collect(`assets/${entry.model.replace(/^assets\//, '')}`);
      Object.values(entry.textures ?? {}).forEach((url) => collect(`assets/${url.replace(/^assets\//, '')}`));
    }
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && (/^(?:map|lightMap|envMap|sheenColorMap|sheenRoughnessMap|iridescenceMap|iridescenceThicknessMap|anisotropyMap|normalMap|roughnessMap|metalnessMap|aoMap|emissiveMap|alphaMap|bumpMap|displacementMap|clearcoatMap|clearcoatNormalMap|clearcoatRoughnessMap|transmissionMap|thicknessMap|specularMap|specularColorMap|specularIntensityMap|url|texture)$/i.test(key) || /^\/?assets\//.test(value))) collect(value);
    }
  });
  // Constant resources used by business handlers/materials, not the complete asset library.
  for (const file of walk(resolve(root, 'src'))) {
    if (!/\.(?:ts|vue|css)$/.test(file)) continue;
    const code = readFileSync(file, 'utf8');
    for (const match of code.matchAll(/['"](\/?assets\/[^'"\r\n]+\.(?:png|jpe?g|webp|avif|glb|gltf|bin))['"]/gi)) collect(match[1]);
  }
  const extraFile = resolve(publicDir, 'offline-resources.json');
  if (existsSync(extraFile)) {
    const extra = JSON.parse(readFileSync(extraFile, 'utf8'));
    if (!Array.isArray(extra) || extra.some((url) => typeof url !== 'string')) throw new Error('offline-resources.json 必须是资源路径字符串数组');
    extra.forEach((url) => collect(url));
  }
  if (needsDraco) {
    collect('assets/draco/draco_wasm_wrapper.js');
    collect('assets/draco/draco_decoder.wasm');
  }
  const data = { version: 1, scene, manifest, resources };
  data.sourceId = hash(JSON.stringify(data) + walk(resolve(root, 'src')).sort().map((file) => `${relative(root, file)}:${hash(readFileSync(file))}`).join('\n'));
  stage = resolve(root, `.offline-build-${randomUUID()}`);
  mkdirSync(stage);
  timed('resources');
  await build({
    cacheDir: resolve(root, '.cache/vite'),
    root, configFile: false, publicDir: false,
    plugins: [vue()], resolve: { alias: { '@': resolve(root, 'src') } },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      outDir: stage, emptyOutDir: true, assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      lib: { entry: resolve(root, 'src/offline-entry.ts'), name: 'Gts3d', formats: ['iife'], fileName: () => 'scene.js' },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  timed('bundle');
  for (const file of walk(stage).filter((path) => extname(path) === '.css')) {
    const css = readFileSync(file, 'utf8').replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g, (full, _quote, url) => {
      if (/^(data:|#)/.test(url)) return full;
      collect(url);
      const key = posix.normalize(decodeURIComponent(url.split(/[?#]/)[0]).replace(/^\//, ''));
      return `url("${resources[key]}")`;
    });
    writeFileSync(file, css);
  }
  // CSS may have added resources; bind the final closure to the saved-file identity.
  data.sourceId = hash(data.sourceId + JSON.stringify(resources));
  writeFileSync(resolve(stage, 'scene-data.js'), `window.__gts3dOffline=${JSON.stringify(data).replace(/</g, '\\u003c')};\n`);
  const styles = walk(stage).filter((file) => extname(file) === '.css').map((file) => `<link rel="stylesheet" href="./${relative(stage, file).replaceAll('\\', '/')}">`).join('\n');
  const html = readFileSync(resolve(root, 'index.html'), 'utf8')
    .replace('</head>', `${styles}\n</head>`)
    .replace(/<script\s+type="module"\s+src="\/src\/entry\.ts"><\/script>/, '<script src="./scene-data.js"></script><script src="./scene.js"></script>');
  if (html.includes('type="module"') || !html.includes('./scene-data.js')) throw new Error('index.html 入口形态不支持离线打包');
  writeFileSync(resolve(stage, 'index.3d.html'), html);
  writeFileSync(resolve(stage, '.gts3d-offline'), '1\n');
  if (existsSync(out)) {
    backup = resolve(root, `.offline-backup-${randomUUID()}`);
    renameSync(out, backup);
  }
  try { renameSync(stage, out); } catch (error) {
    if (backup) renameSync(backup, out);
    backup = undefined;
    throw error;
  }
  stage = undefined;
  if (backup) rmSync(backup, { recursive: true });
  timed('publish');
  console.log(`RESULT: OK\nHTML_PATH: ${resolve(out, 'index.3d.html')}`);
  console.log(`PASS ${resolve(out, 'index.3d.html')} (${Object.keys(resources).length} resources)`);
} catch (error) {
  console.error(`构建未通过：${error.message}`);
  process.exitCode = 1;
} finally {
  console.log(`TIMING_MS: ${JSON.stringify(timings)}`);
  if (stage) rmSync(stage, { recursive: true, force: true });
  if (fd !== undefined) { closeSync(fd); rmSync(lock, { force: true }); }
}


