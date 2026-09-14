#!/usr/bin/env node
// init.mjs
// Initializes a prototype page workspace: creates {slug}/ with a REAL Vue 3
// deliverable (standard structure under src/) plus the offline preview runtime.
//
// init.mjs ONLY creates essential files:
//   - mock/modules/{slug}.js     (always)
//   - src/api/{slug}.js          (always — interface adapter, re-exports mock)
//   - src/locales/               (always — all i18n: global common + per-page entries)
//   - src/views/{slug}/          (always — starter page)
//   - src/router/index.js        (always — preview needs it)
//   - src/App.vue + main.js      (always — FIXED from template)
//   - src/assets/tokens/         (always — copied live from the asset library)
//
// Other directories (composables/, constants/, directives/, stores/,
// utils/, components/) are created ON-DEMAND by the AI agent as needed.
//
// Layout created:
//   {slug}/
//   ├── mock/modules/{slug}.js           # Mock 数据 + API 模拟（经 api 层消费）
//   ├── public/library/element-plus/     # 预览运行时 UMD（FIXED）
//   ├── src/
//   │   ├── main.js                      # 工程入口（FIXED）
//   │   ├── App.vue                      # 应用壳
//   │   ├── api/{slug}.js                # ★ 接口适配层（二开时唯一要改的文件）
//   │   ├── assets/tokens/               # ★ 设计资产 token（从 ASSETS_ROOT 现取）
//   │   ├── assets/                      # 主题/样式（FIXED；字体走系统字体栈，不内嵌）
//   │   ├── locales/                     # 全部语言资源：lang/{zh-CN,en-US}/common.json + pages/{slug}.js
//   │   ├── router/index.js              # 路由（内联，无 guards/modules）
//   │   └── views/{slug}/               # ★ 页面主目录
//   │       ├── index.vue                # 页面主组件
//   │       └── js/constants.js          # 页面常量
//   ├── index.html                       # 离线预览加载器（FIXED）
//   └── preview-data.js                  # 源码映射（build 自动生成）
//
// Usage:
//   node init.mjs "<artifact-folder>" "<slug>" [--assets-root <path>]
//
// Output (agent-parseable):
//   RESULT: OK
//   HTML_PATH: <absolute path to {slug}/index.html>
//   SRC_DIR: <absolute path to {slug}/src>
//   PAGE: <PascalCase page name>
//   ASSETS_VERSION: <asset library version>
//   RESULT: FAIL | <reason>

import {
  existsSync,
  statSync,
  mkdirSync,
  cpSync,
  writeFileSync,
  readdirSync,
  readFileSync,
  rmdirSync,
} from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { refresh } from './build-data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function fail(reason) {
  console.log(`RESULT: FAIL | ${reason}`);
  process.exit(1);
}

// --- args ---
const rawArgs = process.argv.slice(2);
const assetsRootIdx = rawArgs.findIndex((a) => a === '--assets-root' || a === '-a');
let assetsRootArg;
if (assetsRootIdx !== -1) {
  assetsRootArg = rawArgs[assetsRootIdx + 1];
  rawArgs.splice(assetsRootIdx, 2);
}
const args = rawArgs.filter((a) => !a.startsWith('-'));
let artifactFolder, slug;
if (args.length === 2) {
  [artifactFolder, slug] = args;
} else if (args.length === 1) {
  artifactFolder = process.cwd();
  [slug] = args;
} else {
  fail('Usage: node init.mjs "<artifact-folder>" "<slug>" [--assets-root <path>]');
}

if (!existsSync(artifactFolder) || !statSync(artifactFolder).isDirectory()) {
  fail(`Artifact folder does not exist or is not a directory: ${artifactFolder}`);
}
if (!/^[a-z0-9]+(-[a-z0-9]+){1,5}$/.test(slug)) {
  fail(`Slug must be kebab-case ascii, 2-6 hyphen-separated segments: '${slug}'`);
}

// ---------- 0. locate asset library (plan §4.1 protocol) ----------
// Resolution order: --assets-root → ./assets (repo layout) → ASSETS_ROOT env.
// Accepts: package root, package-root/assets, or the asset library directory itself.
function locateAssetLibrary(fromPath) {
  const p = resolve(fromPath);
  // direct library dir (contains asset-manifest.json)
  if (existsSync(join(p, 'asset-manifest.json'))) return { root: p, entry: p };
  // package root (contains asset-catalog.json)
  if (existsSync(join(p, 'asset-catalog.json'))) {
    const catalog = JSON.parse(readFileSync(join(p, 'asset-catalog.json'), 'utf8'));
    const libRoot = join(p, catalog.libraries?.['g-design-enterprise']?.root || 'assets');
    if (existsSync(join(libRoot, 'asset-manifest.json'))) return { root: libRoot, entry: p };
    // catalog root may itself be the library
    if (existsSync(join(p, 'assets', 'asset-manifest.json'))) return { root: join(p, 'assets'), entry: p };
  }
  // package-root/assets
  if (existsSync(join(p, 'asset-manifest.json'))) return { root: p, entry: p };
  return null;
}

const candidates = [];
if (assetsRootArg) candidates.push(assetsRootArg);
// 安装态 skill：读 installer 写入的绑定文件（packageRoot = 源包绝对路径），
// 设计师不用知道包在哪——AI 不传 --assets-root 也能自动定位资产库。
const bindingPath = join(__dirname, '..', 'agents', 'package-location.json');
try {
  const binding = JSON.parse(readFileSync(bindingPath, 'utf8'));
  if (binding.packageRoot) candidates.push(binding.packageRoot);
} catch { /* 未安装态（仓库内直跑）无绑定文件，走后续候选 */ }
candidates.push(process.env.ASSETS_ROOT || resolve(process.cwd()));
let assetLib = null;
for (const c of candidates) {
  if (!c) continue;
  assetLib = locateAssetLibrary(c);
  if (assetLib) break;
}
// 仓库内任意 cwd：从脚本位置逐级上溯找锚点（asset-catalog.json 包根 / asset-manifest.json 库根）。
// skill 目录被挪动或单独分发时依然命中，不依赖固定层级。
if (!assetLib) {
  let cur = __dirname;
  for (let i = 0; i < 12 && !assetLib; i += 1) {
    cur = resolve(cur, '..');
    assetLib = locateAssetLibrary(cur);
    if (cur === resolve(cur, '..')) break; // 到达盘根
  }
}
if (!assetLib) fail(`asset library not found — pass --assets-root <package root | assets dir | library dir>; tried: ${candidates.filter(Boolean).join(', ')}`);
const tokensSrc = join(assetLib.root, 'frontend', 'element-plus', 'tokens');
if (!existsSync(tokensSrc)) fail(`asset library token layer not found: ${tokensSrc}`);
const manifestPath = join(assetLib.root, 'asset-manifest.json');
let assetVersion = 'unknown';
try {
  assetVersion = JSON.parse(readFileSync(manifestPath, 'utf8')).assetVersion || assetVersion;
} catch { /* version display only */ }

// ---------- 1. resolve template ----------
const preview = resolve(__dirname, 'preview');
const scaffoldSrc = join(preview, 'src');
const libSrc = join(preview, 'public', 'library');
const htmlSrc = join(preview, 'index.html');
for (const p of [scaffoldSrc, libSrc, htmlSrc]) {
  if (!existsSync(p)) fail(`template incomplete, missing: ${p}`);
}

// ---------- 2. derive names ----------
const pageName = slug
  .split('-')
  .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
  .join('');

// ---------- 3. create destination ----------
const dest = join(artifactFolder, slug);
if (existsSync(join(dest, 'src'))) {
  fail(`target already exists (use Modification Workflow instead): ${dest}`);
}
mkdirSync(dest, { recursive: true });

// ---------- 4. copy deliverable scaffold (main.js + assets) ----------
const srcDir = join(dest, 'src');
cpSync(scaffoldSrc, srcDir, { recursive: true });

// ---------- 4pre. style language (D22): less only ----------
const mainJsPath = join(srcDir, 'main.js');
writeFileSync(mainJsPath, readFileSync(mainJsPath, 'utf8').replace(
  /import '\.\/assets\/style\/base\.(less|scss)'/,
  `import './assets/style/base.less'`,
), 'utf8');

// ---------- 4a. copy asset-library token layer (live fetch, glob) ----------
// D23: the library token layer is pure CSS (entry index.css) — copy verbatim,
// no scss pruning or flattening needed any more.
cpSync(tokensSrc, join(srcDir, 'assets', 'tokens'), { recursive: true });
writeFileSync(
  join(srcDir, 'assets', 'tokens', 'tokens-manifest.json'),
  JSON.stringify({
    source: 'g-design-enterprise',
    assetVersion,
    copiedFrom: tokensSrc,
    copiedAt: new Date().toISOString(),
    note: 'Copied by init.mjs from the asset library. Re-run init sync or replace this folder to update tokens.',
  }, null, 2) + '\n',
  'utf8',
);

// ---------- 5. create directories ----------
mkdirSync(join(dest, 'mock', 'modules'), { recursive: true });
mkdirSync(join(srcDir, 'locales', 'lang', 'zh-CN'), { recursive: true });
mkdirSync(join(srcDir, 'locales', 'lang', 'en-US'), { recursive: true });
mkdirSync(join(srcDir, 'api'), { recursive: true });
mkdirSync(join(srcDir, 'views', slug, 'js'), { recursive: true });
mkdirSync(join(srcDir, 'router'), { recursive: true });
// 空目录仅存在于磁盘（collect 组件/手写组件落位前保持空）；git 不跟踪空目录无妨——
// 工作区是交付件不是 git 仓库，不写 .gitkeep 以免混进交付件。
mkdirSync(join(srcDir, 'components'), { recursive: true });

// ---------- 6. write starter files ----------

// --- 6a. mock/modules/{slug}.js (REST-shaped signatures + delay, D16) ---
writeFileSync(
  join(dest, 'mock', 'modules', `${slug}.js`),
  `// ${pageName} — Mock 数据 + API 请求模拟
// 约定：函数签名按 REST 语义设计（页面消费形状与真实接口一致）
// 二次开发时：只改 src/api/${slug}.js，本文件保持不动

const mockData = [
  { id: '1', name: '${pageName}示例-01', status: 'running' },
  { id: '2', name: '${pageName}示例-02', status: 'stopped' },
  { id: '3', name: '${pageName}示例-03', status: 'pending' },
  { id: '4', name: '${pageName}示例-04', status: 'idle' },
  { id: '5', name: '${pageName}示例-05', status: 'maintenance' },
]

function delay(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchList({ keyword = '', page = 1, pageSize = 20 } = {}) {
  await delay()
  let list = mockData
  if (keyword) list = list.filter((item) => item.name.includes(keyword))
  const total = list.length
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total, page, pageSize }
}

export async function fetchDetail(id) {
  await delay(200)
  return { data: mockData.find((item) => item.id === String(id)) || null }
}

export async function createRecord(payload) {
  await delay()
  const record = { id: String(Date.now()), status: 'pending', ...payload }
  mockData.unshift(record)
  return { data: record }
}

export async function deleteRecord(id) {
  await delay()
  const idx = mockData.findIndex((item) => item.id === String(id))
  if (idx !== -1) mockData.splice(idx, 1)
  return { success: true }
}
`,
  'utf8',
);

// --- 6b. src/api/{slug}.js — interface adapter (D16) ---
writeFileSync(
  join(srcDir, 'api', `${slug}.js`),
  `// ${pageName} — 接口适配层（二次开发唯一必改文件）
// 原型态：直接转发 mock；上线态：把每个导出换成真实 HTTP 请求。
// 约定：导出名、参数、返回形状与 mock 完全一致，页面代码零改动。

export {
  fetchList,
  fetchDetail,
  createRecord,
  deleteRecord,
} from '../../mock/modules/${slug}.js'

// 二次开发示例（替换上面 re-export 后启用；request 为你自建的 axios 实例文件）：
// import request from "./request" // 你的 axios 实例
// export function fetchList(params) { return request.get("/api/${slug}", { params }) }
// export function fetchDetail(id) { return request.get("/api/${slug}/" + id) }
// export function createRecord(payload) { return request.post("/api/${slug}", payload) }
// export function deleteRecord(id) { return request.delete("/api/${slug}/" + id) }
`,
  'utf8',
);

// --- 6c. locales/lang/{zh-CN,en-US}/common.json (global shared entries only) ---
writeFileSync(
  join(srcDir, 'locales', 'lang', 'zh-CN', 'common.json'),
  JSON.stringify({
    confirm: '确定', cancel: '取消', search: '搜索', reset: '重置',
    add: '新增', edit: '编辑', delete: '删除', view: '查看', refresh: '刷新',
  }, null, 2) + '\n',
  'utf8',
);
writeFileSync(
  join(srcDir, 'locales', 'lang', 'en-US', 'common.json'),
  JSON.stringify({
    confirm: 'Confirm', cancel: 'Cancel', search: 'Search', reset: 'Reset',
    add: 'Add', edit: 'Edit', delete: 'Delete', view: 'View', refresh: 'Refresh',
  }, null, 2) + '\n',
  'utf8',
);

// --- 6d. locales/index.js ---
writeFileSync(
  join(srcDir, 'locales', 'index.js'),
  `// i18n 入口 — 语言资源统一在此：lang/*/common.json 跨页共享，pages/{slug}.js 页面级
// 预览环境简单对象合并；真实工程用 vue-i18n 时把两个语言对象拆进 JSON 即可
import zhCNCommon from './lang/zh-CN/common.json'
import enUSCommon from './lang/en-US/common.json'

export const messages = {
  'zh-CN': { common: zhCNCommon },
  'en-US': { common: enUSCommon },
}
`,
  'utf8',
);

// --- 6e. router/index.js (simple inline, no guards/modules) ---
writeFileSync(
  join(srcDir, 'router', 'index.js'),
  `import { createRouter, createWebHashHistory } from 'vue-router'
import ${pageName} from '../views/${slug}/index.vue'

const routes = [
  { path: '/', name: '${slug}', component: ${pageName} },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
`,
  'utf8',
);

// --- 6f. views/{slug}/index.vue (consumes the api adapter, px units) ---
writeFileSync(
  join(srcDir, 'views', slug, 'index.vue'),
  `<script setup>
// ${pageName} — 页面主组件（交付入口；真实工程中由路由挂载）
import { ref, onMounted } from 'vue'
import { Monitor } from '@element-plus/icons-vue'
import { fetchList } from '../../api/${slug}.js'
import { t } from '../../locales/pages/${slug}.js'
import { STATUS_MAP } from './js/constants.js'

const loading = ref(false)
const dataList = ref([])
const total = ref(0)

async function fetchData() {
  loading.value = true
  try {
    const res = await fetchList()
    dataList.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="page-root">
    <el-card shadow="never">
      <template #header>
        <div class="header">
          <span class="title">{{ t.title }}</span>
          <el-button type="primary" :icon="Monitor" @click="fetchData">{{ t.refresh }}</el-button>
        </div>
      </template>
      <el-table :data="dataList" v-loading="loading">
        <el-table-column type="index" label="序号" width="60px" />
        <el-table-column prop="name" label="名称" min-width="140px" />
        <el-table-column label="状态" width="100px">
          <template #default="{ row }">
            <el-tag :type="STATUS_MAP[row.status]?.type || 'info'">
              {{ STATUS_MAP[row.status]?.label || row.status }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style lang="less" scoped>
.page-root {
  min-height: 100%;
  padding: 24px;

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .title {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-text-primary);
  }
}
</style>
`,
  'utf8',
);

// --- 6g. src/locales/pages/{slug}.js (page entries, D15 — single-file bilingual + flattened t) ---
mkdirSync(join(srcDir, 'locales', 'pages'), { recursive: true });
writeFileSync(
  join(srcDir, 'locales', 'pages', `${slug}.js`),
  `// ${pageName} — 页面词条（单文件双语言；每页一个文件，一次写完）
// messages 存双语言源；t 按 LANG 展平成字符串，模板直接 {{ t.xxx }}。
// 接 vue-i18n 时把 messages 的 zh/en 拆成两个 JSON，页面模板零改动。

export const messages = {
  title:   { zh: '${pageName}', en: '${pageName}' },
  refresh: { zh: '刷新', en: 'Refresh' },
  status:  { zh: '状态', en: 'Status' },
}

// 页面显示语言：'zh' | 'en'（原型期常量；运行时切换随 vue-i18n 引入）
const LANG = 'zh'

export const t = Object.fromEntries(
  Object.entries(messages).map(([key, val]) => [key, typeof val === 'string' ? val : val[LANG] || val.zh]),
)
`,
  'utf8',
);

// --- 6h. views/{slug}/js/constants.js ---
writeFileSync(
  join(srcDir, 'views', slug, 'js', 'constants.js'),
  `// ${pageName} — 常量定义
// 常量命名：全大写 + 下划线（如 ALARM_LEVEL）

export const STATUS_MAP = {
  running:     { label: '运行中', type: 'success' },
  stopped:     { label: '已停止', type: 'danger' },
  pending:     { label: '待审核', type: 'warning' },
  idle:        { label: '空闲',   type: 'info' },
  maintenance: { label: '维护中', type: 'warning' },
}

export const STATUS_OPTIONS = [
  { label: '运行中', value: 'running' },
  { label: '已停止', value: 'stopped' },
  { label: '待审核', value: 'pending' },
  { label: '空闲',   value: 'idle' },
  { label: '维护中', value: 'maintenance' },
]
`,
  'utf8',
);

// --- 6i. App.vue ---
writeFileSync(
  join(srcDir, 'App.vue'),
  `<script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>
`,
  'utf8',
);

// ---------- 7. copy preview runtime + loader ----------
cpSync(libSrc, join(dest, 'public', 'library'), { recursive: true });
cpSync(htmlSrc, join(dest, 'index.html'));

// ---------- 8. generate preview-data.js ----------
const result = refresh(dest);
if (!result.ok) fail(result.reason);

// ---------- 8a. remove empty directories ----------
// KEEP_EMPTY: src/components 是语义性目录（用户拍板：init 始终创建，collect/手写组件
// 的落位锚点），空着也要保留，不参与清理。
const KEEP_EMPTY = new Set([join(srcDir, 'components')]);
function removeEmptyDirs(dir) {
  let removed = false;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const full = join(dir, entry.name);
      if (removeEmptyDirs(full)) removed = true;
    }
  }
  if (readdirSync(dir).length === 0 && !KEEP_EMPTY.has(dir)) {
    rmdirSync(dir);
    return true;
  }
  return removed;
}
removeEmptyDirs(dest);

// ---------- 9. done ----------
console.log('RESULT: OK');
console.log(`HTML_PATH: ${resolve(join(dest, 'index.html'))}`);
console.log(`SRC_DIR: ${resolve(srcDir)}`);
console.log(`PAGE: ${pageName}`);
console.log(`ASSETS_VERSION: ${assetVersion}`);
process.exit(0);
