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
//   │       ├── uploads/  themes/{base,bridge,default}.css
//   ├── public/library/       # 预览运行时 UMD（真实拷贝，非链接，不随工程交付）
//   ├── index.gts.html        # 离线预览加载器（FIXED）
//   └── preview-data.js       # 源码映射（build.mjs 自动生成/刷新）
//
// Usage:
//   node init.mjs "<artifact-folder>" "<slug>"
//   (if artifact-folder is omitted, falls back to cwd)
//
// Output (agent-parseable):
//   RESULT: OK
//   HTML_PATH: <absolute path to {slug}/index.gts.html>
//   SRC_DIR: <absolute path to {slug}/src>
//   PAGE: <PascalCase page name>
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
const htmlSrc = join(preview, 'index.gts.html');
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
writeFileSync(
  join(srcDir, 'pages', pageName, 'index.vue'),
  `<script setup>
// ${pageName} — 页面主组件（交付入口；真实工程中由路由挂载）
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Monitor } from '@element-plus/icons-vue'

// TODO: mock 数据（语义化 key，状态配映射表）
const hello = () => ElMessage.success('页面已就绪')
</script>

<template>
  <div class="page-root">
    <el-empty description="页面待生成">
      <el-button type="primary" :icon="Monitor" @click="hello">开始</el-button>
    </el-empty>
  </div>
</template>

<style scoped>
.page-root {
  min-height: 100%;
  padding: 24px;
}
</style>
`,
  'utf8',
);

writeFileSync(
  join(srcDir, 'App.vue'),
  `<script setup>
// 应用壳：挂载目标页面组件（预览与真实工程共用）
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
cpSync(htmlSrc, join(dest, 'index.gts.html'));

// ---------- 7. generate preview-data.js ----------
const result = refresh(dest);
if (!result.ok) fail(result.reason);

// ---------- 8. done ----------
console.log('RESULT: OK');
console.log(`HTML_PATH: ${resolve(join(dest, 'index.gts.html'))}`);
console.log(`SRC_DIR: ${resolve(srcDir)}`);
console.log(`PAGE: ${pageName}`);
process.exit(0);
