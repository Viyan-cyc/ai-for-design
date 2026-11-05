#!/usr/bin/env node
// init.mjs
// Initializes a ux-proto page workspace: creates {slug}/ with a REAL Vue
// deliverable (src/) plus the offline preview runtime. The AI then authors
// .vue SFC files under src/ — the code IS the deliverable.
//
// Layout created:
//   {slug}/
//   ├── src/                  ← 交付件（真实工程结构，直接可拷贝）
//   │   ├── main.js           # 工程入口示例
//   │   ├── App.vue           # 应用壳（导入目标页面组件）
//   │   ├── README.md         # 接入说明
//   │   ├── pages/{Pascal}/index.vue       # 页面起始骨架
//   │   └── assets/                        # 主题/素材（随源码交付）
//   │       ├── uploads/  themes/{base,bridge,default}.less
//   ├── public/library/       # 预览运行时 UMD（真实拷贝，非链接，不随工程交付）
//   ├── index.gts-ep.html        # 离线预览加载器（FIXED）
//   └── preview-data.js       # 源码映射（build.mjs 自动生成/刷新）
//
// Usage:
//   node init.mjs "<artifact-folder>" "<slug>"
//   (if artifact-folder is omitted, falls back to cwd)
//
// Output (agent-parseable):
//   RESULT: OK
//   HTML_PATH: <absolute path to {slug}/index.gts-ep.html>
//   SRC_DIR: <absolute path to {slug}/src>
//   PAGE: <PascalCase page directory name>
//   RESULT: FAIL | <reason>

import {
  existsSync,
  statSync,
  mkdirSync,
  cpSync,
  writeFileSync,
} from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { refresh } from './build-data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function fail(reason) {
  console.log(`RESULT: FAIL | ${reason}`);
  process.exit(1);
}

// --- args: [artifactFolder?, slug] ---
const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
let artifactFolder, slug;
if (args.length === 2) {
  [artifactFolder, slug] = args;
} else if (args.length === 1) {
  artifactFolder = process.cwd();
  [slug] = args;
} else {
  fail('Usage: node init.mjs "<artifact-folder>" "<slug>"');
}

if (existsSync(artifactFolder)) {
  if (!statSync(artifactFolder).isDirectory()) {
    fail(`Artifact folder exists but is not a directory: ${artifactFolder}`);
  }
} else {
  mkdirSync(artifactFolder, { recursive: true });
}
if (!/^[a-z0-9]+(-[a-z0-9]+){1,5}$/.test(slug)) {
  fail(`Slug must be kebab-case ascii, 2-6 hyphen-separated segments: '${slug}'`);
}

// ---------- 1. resolve template ----------
const preview = resolve(__dirname, 'preview');
const scaffoldSrc = join(preview, 'src');          // main.js + assets/{themes,uploads}
const libSrc = join(preview, 'public', 'library'); // preview-only UMD runtime
const htmlSrc = join(preview, 'index.gts-ep.html');
for (const p of [scaffoldSrc, libSrc, htmlSrc]) {
  if (!existsSync(p)) fail(`template incomplete, missing: ${p}`);
}

// ---------- 2. derive page component name ----------
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

// ---------- 4. copy deliverable scaffold ----------
// scaffold src 自带 assets/{themes,uploads} + main.js + README.md
const srcDir = join(dest, 'src');
cpSync(scaffoldSrc, srcDir, { recursive: true });
mkdirSync(join(srcDir, 'assets', 'uploads'), { recursive: true });
mkdirSync(join(srcDir, 'pages', pageName, 'components'), { recursive: true });

// ---------- 5. starter page + app shell ----------
writeFileSync(join(srcDir, 'pages', pageName, 'index.vue'), `<script setup>
// 技术骨架；交付前按任务应用选定图表规范。
import { ref, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { getChartData } from '../../api/demo.js'

const host = ref(null)
let chart
let observer
let disposed = false

onMounted(async () => {
  const data = await getChartData()
  if (disposed) return
  chart = echarts.init(host.value)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.categories },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: data.values }],
  })
  observer = new ResizeObserver(() => chart.resize())
  observer.observe(host.value)
})

onUnmounted(() => {
  disposed = true
  observer?.disconnect()
  chart?.dispose()
})
</script>

<template>
  <div ref="host" class="chart-test"></div>
</template>

<style scoped lang="less">
.chart-test {
  width: 100%;
  height: 400px;
}
</style>
`, 'utf8');

writeFileSync(
  join(srcDir, 'App.vue'),
  `<script setup>
// 应用壳：只挂载目标页面（交付入口；真实工程中由路由/布局替换）
// 无内置切换 UI —— 国际化 / 主题切换均为按需能力，用户要求时在此接入，
// 装配与参考实现由生成方提供，UI 形态按用户描述决定。
import Page from './pages/${pageName}/index.vue'
</script>

<template>
  <Page />
</template>
`,
  'utf8',
);

// ---------- 6. copy preview runtime + loader ----------
cpSync(libSrc, join(dest, 'public', 'library'), { recursive: true });
cpSync(htmlSrc, join(dest, 'index.gts-ep.html'));

// ---------- 7. generate preview-data.js ----------
const result = refresh(dest);
if (!result.ok) fail(result.reason);

// ---------- 8. done ----------
console.log('RESULT: OK');
console.log(`HTML_PATH: ${resolve(join(dest, 'index.gts-ep.html'))}`);
console.log(`SRC_DIR: ${resolve(srcDir)}`);
console.log(`PAGE: ${pageName}`);
process.exit(0);
