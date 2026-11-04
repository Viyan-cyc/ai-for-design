# runtime-acceptance.md

## 1 验证工程

验证工程独立于现有验收工程，位于 `output/dt-ui-runtime-check/`。

**本轮为调查性质，未实际创建验证工程、未执行构建或浏览器验证。** 以下记录的是验证方案设计和可行性判断，所有"构建通过""首绘通过"等需要实际运行才能确认的项均标记为 **[未验证]**。

## 2 npm ESM 接入验证方案

### 2.1 目标

确认 dt-ui 通过 npm ESM 导入能正常工作，与 SweetUI 5.7.0 共存。

### 2.2 验证项目结构

```
output/dt-ui-runtime-check/
  package.json
  vite.config.ts
  index.html
  src/
    main.js
    App.vue
    theme.js
    views/
      ChartEcharts.vue      ← DtChart (echarts)
      BarChart3DClass.vue    ← BarChart (class API)
      BarChartThree3D.vue    ← DtBarChartThree (Vue + Three.js)
      CustomBarChartDemo.vue ← DtCustomBarChart
      DashboardRendererDemo.vue ← DtDashboardRenderer
```

### 2.3 package.json

```json
{
  "dependencies": {
    "vue": "3.5.29",
    "@hw-seq/sweet-ui-base": "^5.7.0",
    "@hw-dtn/dt-ui": "^1.4.1",
    "echarts": "6.1.0",
    "three": "0.183.0",
    "lodash": "4.18.1",
    "@antv/g6": "5.1.1"
  },
  "devDependencies": {
    "vite": "^6.4.3",
    "@vitejs/plugin-vue": "^5.2.4"
  }
}
```

### 2.4 vite.config.ts 关键配置

```js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  resolve: {
    dedupe: ['vue', '@hw-seq/sweet-ui-base', 'echarts', 'lodash']
  },
  build: {
    rollupOptions: {
      external: [] // 不外置，全部打包验证
    }
  }
});
```

**`resolve.dedupe` 是解决双 SweetUI 实例的关键配置**，强制 Vite 将这些包解析到顶层 node_modules。

### 2.5 验证项

| 编号 | 验证项 | 验证方式 | 状态 |
|---|---|---|---|
| ESM-1 | `import { DtChart } from '@hw-dtn/dt-ui'` 不报错 | 构建通过 | [未验证] |
| ESM-2 | DtChart 渲染折线图（echarts option） | 浏览器 | [未验证] |
| ESM-3 | DtChart 渲染柱状图 | 浏览器 | [未验证] |
| ESM-4 | DtChart 渲染饼图 | 浏览器 | [未验证] |
| ESM-5 | DtChart theme="dark" showTheme=true 应用深色主题 | 浏览器对比 | [未验证] |
| ESM-6 | DtChart theme="uDesign2.2-dark" showTheme=true — **预期回退默认** | 浏览器 | [未验证] |
| ESM-7 | BarChart class 创建 3D 柱状图 | 浏览器 | [未验证] |
| ESM-8 | DtBarChartThree 渲染 3D 柱状图 | 浏览器 | [未验证] |
| ESM-9 | DtCustomBarChart 渲染横向条形图 | 浏览器 | [未验证] |
| ESM-10 | 调用 dt-ui setTheme("uDesign2.2-dark") 后 CSS 组件样式切换 | 浏览器检查 body[theme] | [未验证] |
| ESM-11 | dedupe 配置下仅一份 SweetUI 实例 | 构建分析 | [未验证] |
| ESM-12 | dt-ui 的 i18n 与 SweetUI 的 i18n 共存 | 语言切换 | [未验证] |

### 2.6 测试样本选择原则

| 渲染引擎 | 代表项 | 理由 |
|---|---|---|
| echarts 2D | 折线 + 柱状 + 饼 | 覆盖常见类型 |
| Three.js 3D | BarChart class + DtBarChartThree | 两种 3D API |
| DOM/CSS | DtCustomBarChart | 非 Canvas 图表 |
| SVG | DtPointBezier | 非 Canvas 图表 |
| Canvas 2D | DtTimeLineControl | 自绘 Canvas |

### 2.7 预期失败项

| 项目 | 根因 |
|---|---|
| uDesign2.2-dark 图表主题 | chartTheme 无此 key，echarts.init 将回退默认 |
| echarts-gl (3D surface etc.) | dt-ui 未声明 echarts-gl 依赖 |
| 3D BarChart uDesign 主题 | themes.mjs 只有 light/dark |

## 3 UMD 离线预览接入验证方案

### 3.1 目标

确认通过 dt-ui.umd.cjs + dist/index.css 可以在无 npm 的 HTML 文件中加载 dt-ui。

### 3.2 前提

需要以下全局变量预加载：

| 全局变量 | 对应库 | 加载方式 |
|---|---|---|
| `window.Vue` | Vue 3 | CDN `<script>` 标签 |
| `window._$z` | lodash | CDN `<script>` 标签，别名 `_$z` |
| `window.g6` | @antv/g6 | CDN `<script>` 标签 |
| `window.xss` | xss | CDN `<script>` 标签 |

**注意：echarts、three.js、sweet-ui-base 已内联在 UMD 中，不需要外部加载。**

### 3.3 index.html 结构

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="dist/index.css">
  <!-- SweetUI CSS (若希望组件样式也用 SweetUI) -->
  <!-- <link rel="stylesheet" href="sweet-ui-base CSS"> -->
</head>
<body>
  <div id="app"></div>
  <!-- 顺序不可调换 -->
  <script src="lodash.js"></script>         <!-- window._$z -->
  <script src="vue.global.prod.js"></script> <!-- window.Vue -->
  <script src="g6.min.js"></script>          <!-- window.g6 -->
  <script src="xss.min.js"></script>         <!-- window.xss -->
  <script src="dt-ui.umd.cjs"></script>      <!-- window["dtn-ui"] -->
  <script>
    const { DtChart, setTheme, chartTheme } = window['dtn-ui'];
    // ...
  </script>
</body>
</html>
```

### 3.4 可行性分析

| 项目 | 可行性 | 风险 |
|---|---|---|
| 加载 UMD 本身 | **可能可行** | 体积 24.3 MB，加载慢；全局变量名 _$z 非标准 |
| DtChart (echarts) | **可能可行** | echarts 已内联，但内联版本可能与宿主 echarts 冲突 |
| DtBarChartThree | **可能可行** | three.js 已内联 |
| 主题切换 | **不可行** | UMD 内联了 SweetUI 5.6.5，setTheme 无法驱动宿主 SweetUI 实例 |
| 字体/图片资源 | **需相对路径** | `theme-chalk/assets/` 下的 SVG/PNG/woff 需与 HTML 同目录或配置 base |
| CSS token 依赖 | **需宿主** | `dist/index.css` 引用 `var(--swt-*)`，需宿主定义这些变量 |

### 3.5 UMD 离线验证项

| 编号 | 验证项 | 状态 |
|---|---|---|
| UMD-1 | lodash 赋值到 `window._$z` 后 UMD 不报错 | [未验证] |
| UMD-2 | `window["dtn-ui"]` 对象包含 DtChart | [未验证] |
| UMD-3 | DtChart 能渲染折线图 | [未验证] |
| UMD-4 | CSS 资源路径正确 (字体/图片) | [未验证] |
| UMD-5 | UMD 内联的 SweetUI 与外部 SweetUI 不冲突 | [未验证] |

## 4 与 SweetUI 5.7.0 共存分析

### 4.1 能否共存

**ESM + Vite dedupe：可以共存。** 将 `@hw-seq/sweet-ui-base` 加入 `resolve.dedupe` 列表，强制解析到顶层 5.7.0。

**UMD：不能真正共存。** UMD 内联了 SweetUI 5.6.5，两份 SweetUI 注册到不同的 Vue app，主题/i18n 不共享。

### 4.2 重复安装组件库问题

| 场景 | 问题 | 解决 |
|---|---|---|
| ESM 无 dedupe | dt-ui 加载 5.6.5 版 SweetUI 组件，宿主加载 5.7.0 版 → `withInstall` 可能注册两次同名组件 | Vite dedupe |
| ESM 有 dedupe | dt-ui 的 `import { withInstall }` 解析到 5.7.0 → 只有一份 → 组件注册正常 | 推荐方案 |
| UMD | 内联 5.6.5 → 必然双份 | 不可解，只能选不用 UMD 或接受双份 |

### 4.3 主题冲突

| 冲突点 | 说明 |
|---|---|
| CSS 组件主题 | `body[theme]` 属性是唯一的，dt-ui 的 setTheme 委托 SweetUI，不冲突 |
| echarts 图表主题 | dt-ui 有自己的 chartTheme 注册逻辑，SweetUI 也有——若 dedupe 后两方 import 同一个 echarts，主题名不冲突即可共存 |
| 3D 图表配色 | dt-ui 独立管理，与 SweetUI 无交集 |

### 4.4 i18n 冲突

dt-ui 暴露 `i18n` 函数并挂载到 installer 上：`installer.i18n = i18n`。若 dedupe 后 dt-ui 和 SweetUI 共享同一 echarts/vue，i18n 不冲突——它们各自管理自己的语言包。但 dt-ui 的 i18n key 与 SweetUI 的可能重叠（如 `common.cancel`），需测试确认。

## 5 推荐最小接入方式

### 5.1 ESM 方式（推荐）

```js
// vite.config.ts
export default defineConfig({
  resolve: {
    dedupe: ['vue', '@hw-seq/sweet-ui-base', 'echarts', 'lodash', 'dayjs']
  }
});
```

```vue
<script setup>
// 按需引入 dt-ui 图表组件
import { DtChart, chartTheme } from '@hw-dtn/dt-ui';
import * as echarts from 'echarts';

// 手动注册 uDesign2.2 别名
echarts.registerTheme('uDesign2.2-light', chartTheme['hDesign1.1-light']);
echarts.registerTheme('uDesign2.2-dark', chartTheme['hDesign1.1-dark']);
</script>
```

### 5.2 不推荐 UMD 方式

- 24.3 MB 体积不适合在线预览
- 内联 SweetUI 5.6.5 导致双实例
- 全局变量名 `_$z` 非标准，CDN 难获取
- CSS token 依赖宿主定义

### 5.3 3D 组件接入

3D 组件（BarChart class、DtBarChartThree、DtTopoThree）依赖 three.js (0.183.0)，体积约 1.5 MB。**如页面不需要 3D 可视化，不应引入这些组件。** 使用 ESM tree-shaking 可自动排除，但需确认 `sideEffects` 配置正确。

### 5.4 @antv/g6 接入

g6 (5.1.1) 仅被拓扑组件（DtClusterTopo、DtRelationTopo、DtInferTopo）使用。**如页面不使用拓扑，不应引入 g6。**

## 6 验证结果汇总

| 验证类型 | 实际执行 | 结果 |
|---|---|---|
| npm 真实接入构建 | 否 | [未验证] |
| npm 真实接入浏览器首绘 | 否 | [未验证] |
| UMD 离线预览加载 | 否 | [未验证] |
| 主题切换对图表生效 | 否 | [未验证] |
| dedupe 效果 | 否 | [未验证] |
| i18n 共存 | 否 | [未验证] |

**浏览器无法操作，明确记录以上全部为未验证。** 用户需自行执行验证工程构建和浏览器测试以确认。

## 7 失败根因预判

| 预期失败 | 根因 | 规避 |
|---|---|---|
| uDesign2.2-dark 图表主题不生效 | chartTheme 无此 key | 手动注册 hDesign1.1-dark 别名 |
| echarts-gl 3D 图表（xAxis3D） | dt-ui 未依赖 echarts-gl | 额外安装 echarts-gl 或使用 three.js 3D 组件替代 |
| 双 SweetUI 实例 | dt-ui 内嵌 5.6.5 | Vite dedupe |
| UMD 加载失败 | 全局变量名不匹配（_$z） | 确保 lodash 赋值到 window._$z |
| 3D 组件 CSS 缺失 | `dist/index.css` 是否含 3D 样式取决于 sideEffects 配置 | 确认 import 完整 CSS |
| CSS token 未定义 | dt-ui CSS引用 `var(--swt-*)` 需 SweetUI 基础样式先加载 | 确保 SweetUI CSS 先于 dt-ui CSS |
