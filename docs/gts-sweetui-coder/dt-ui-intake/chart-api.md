# chart-api.md

## 索引

| 组件 | 渲染引擎 | API 章节 |
|---|---|---|
| DtChart | echarts 2D | [1. DtChart](#1-dtchart) |
| BarChart (class) | three.js 3D | [2. BarChart](#2-barchart-class) |
| DtBarChartThree (Vue) | three.js 3D | [3. DtBarChartThree](#3-dtbarchartthree) |
| DtCustomBarChart | DOM/CSS | [4. DtCustomBarChart](#4-dtcustombarchart) |
| DtPointBezier | SVG | [5. DtPointBezier](#5-dtpointbezier) |
| DtDashboardDesigner | DOM grid | [6. DtDashboardDesigner](#6-dtdashboarddesigner) |
| DtDashboardRenderer | DOM grid | [7. DtDashboardRenderer](#7-dtdashboardrenderer) |
| DtTimeLineControl | Canvas 2D | [8. DtTimeLineControl](#8-dttimelinecontrol) |

---

## 1. DtChart

> 源文件: `es/components/chart/index.vue.mjs`

### Props

| Prop | 类型 | 默认值 | 说明 |
|---|---|---|---|
| options | Object | `() => ({})` | ECharts option 对象，支持标准 ECharts 配置 |
| created | Function | — | 图表首次创建完成回调，参数为 echarts 实例 |
| showEmpty | Boolean | false | 当 series 为空时显示空状态 |
| width | String\|Number | `"100%"` | 容器宽度 |
| height | String\|Number | `"200px"` | 容器高度 |
| showTheme | Boolean | false | 是否启用 dt-ui 提供的 echarts 主题 |
| theme | String | `""` | 主题名称，validator 允许 `""` 或 THEME_MAP 的 key |

### Events

| 事件 | 参数 | 说明 |
|---|---|---|
| resize | `(chartEl, chartInstance)` | 图表 resize 后触发 |

### Slots

| 插槽 | 作用域参数 | 说明 |
|---|---|---|
| empty | — | 空数据时显示内容，默认渲染 DtNoData |

### 公开方法

无（不使用 `defineExpose`）。可通过 `created` 回调获取 echarts 实例后调用 echarts API。

### 最小 Vue 用法

```vue
<template>
  <DtChart
    :options="chartOption"
    :created="onChartCreated"
    width="100%"
    height="400px"
  />
</template>

<script setup>
import { DtChart } from '@hw-dtn/dt-ui';

const chartOption = {
  xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed'] },
  yAxis: { type: 'value' },
  series: [{ type: 'line', data: [150, 230, 224] }]
};

function onChartCreated(chart) {
  // chart 是 echarts.ECharts 实例
}
</script>
```

### 关键行为

| 行为 | 负责方 |
|---|---|
| 数据更新 | `watch(options, deep: true)` → `echartsOptions.value = newVal` → `render()` |
| 图表类型切换 | 由 options 的 series.type 控制，`setOption(value, true)` 不合并 |
| 事件绑定 | 通过 `created` 回调获取 echarts 实例，调用 `chart.on()` |
| resize | `resize.on(elRef, resizeChart)` + watch width/height |
| 隐藏后显示 | `onActivated` → `nextTick` → `resizeChart()` |
| 销毁 | `onBeforeUnmount` → `chart.dispose(); chart = null` |
| formatter 支持 | 完全支持（透传 ECharts option） |
| 3D 图表 | 支持 xAxis3D/yAxis3D（需 echarts-gl，dt-ui 未声明该依赖 — **未验证**） |

### DtChart 主题注册机制

```js
// es/components/chart/index.vue.mjs:68-75
const setDefaultTheme = () => {
  Object.keys(chartTheme).forEach((key) => {
    echarts.registerTheme(key, chartTheme[key]);
  });
};
if (showTheme.value) {
  setDefaultTheme();
}
```

**仅当 `showTheme=true` 时才注册图表主题**。注册的主题来自 `es/constants/chart-theme/index.mjs`，当前 5 个 key：`light`、`dark`、`black`、`hDesign1.1-dark`、`hDesign1.1-light`。

当 `showTheme=true` 且 `theme` 非空时，`echarts.init(chartEl, themeValue, { devicePixelRatio: window.devicePixelRatio * 1.5 })`。

**若传入 `theme="uDesign2.2-light"`，validator 通过（THEME_MAP 包含此 key），但 chartTheme 对象不包含 `uDesign2.2-light` → `echarts.registerTheme` 不会注册此 key → `echarts.init(dom, "uDesign2.2-light")` 将抛出异常或回退默认主题。** 这是一个 **已知缺陷**。

---

## 2. BarChart (class)

> 源文件: `es/components/bar-chart/index.mjs`

**非 Vue 组件**，是一个基于 Three.js 的纯 class。通过 `new BarChart(dom, data, config)` 创建。

### 构造函数

```js
new BarChart(dom: HTMLElement, data: Array = [], config: Object = {})
```

### config 默认值

```js
{
  theme: "light",
  xAxis: { key: "xAxis", data: [] },
  yAxis: { key: "yAxis" },
  zAxis: { key: "zAxis", data: [] },
  statusMap: ["alarm", "normal"],
  bar: {},
  selectType: "default",  // "default" | "bar" | "row" | "col"
  selectable: true
}
```

### 公开方法

| 方法 | 签名 | 说明 |
|---|---|---|
| update | `(data, options?)` | 更新数据，options.resetCamera 重置相机 |
| resize | `(width, height)` | 调整渲染尺寸 |
| setTheme | `(theme: "light"\|"dark")` | 切换 3D 场景主题 |
| getTheme | `() => string` | 返回当前主题 |
| resetCamera | `()` | 重置相机到初始视角 |
| zoomIn | `()` | 放大 |
| zoomOut | `()` | 缩小 |
| getRenderer | `() => RendererManager` | 获取渲染管理器 |
| getBarChart3D | `() => BarChart3D` | 获取内部 BarChart3D 实例 |
| select | `(id, options?) => boolean` | 选中柱子，再调取消选中 |
| deselect | `()` | 取消选中 |
| trackCardPosition | `(id, position)` | 注册卡片位置追踪 |
| untrackCardPosition | `(id)` | 取消追踪 |
| clearTrackedPositions | `()` | 清空追踪 |
| destroy | `()` | 销毁组件释放资源 |

### 事件

| 事件名 | 数据 | 说明 |
|---|---|---|
| click | dataItem | 柱子点击 |
| hover | info | 柱子悬停 |
| dblclick | dataItem | 双击 |
| select | dataItem | 选中 |
| updatePosition | `{ id, screenPosition }` | 相机旋转时卡片位置更新 |

### 最小用法

```js
import { BarChart } from '@hw-dtn/dt-ui';

const chart = new BarChart(document.getElementById('container'), [
  { id: 'bar1', name: 'A', value: 42, status: 'normal' }
], { theme: 'dark' });

chart.on('click', (item) => console.log('clicked', item));
chart.setTheme('light');
chart.destroy();
```

---

## 3. DtBarChartThree

> 源文件: `es/components/bar-chart-three/bar-chart-3d.vue.mjs`

### Props

| Prop | 类型 | 默认值 | 说明 |
|---|---|---|---|
| options | Object | `() => ({})` | 3D 柱状图配置，深度合并默认配置 |
| theme | String | `"dark"` | 主题，用于 getBarOptions 选取颜色 |

### Events

| 事件 | 参数 | 说明 |
|---|---|---|
| page-change | pageNo | 分页切换 |
| after-bar-click | obj | 柱子点击后 |
| bar-mouse-hover | obj | 柱子悬停 |

### Slots

| 插槽 | 作用域 | 说明 |
|---|---|---|
| tooltip | `{ objInfo }` | 自定义 tooltip 内容 |
| topTool | `{ objInfo }` | 自定义顶部工具面板 |

### 公开方法 (expose)

| 方法 | 说明 |
|---|---|
| renderingData() | 重新初始化并渲染数据 |
| simulatedClickBar(obj) | 模拟点击柱子 |

### options 结构

通过 `deepMerger(defaultBarOptions, props.options)` 合并。关键字段：

```js
{
  data: [],           // 3D 柱状数据
  fov: 15,            // 相机视场角
  valueSplitNumber: 5,// Y 轴分割数
  quadrant: "one",    // 象限方向
  adaptiveAxis: false,// 自适应轴旋转
  centerPoint: [-4, -4, -4],
  tooltip: { show, pointerEvents, position },
  topTool: { show },
  pageInfo: { show, showAxis, pageSize, pageNo },
  threshold: { show, showPlane, dataControl, operator, value },
  highLightRowAndCol: { show, opacity, rowKey, colKey },
  toolbar: { show },
  xAxis/yAxis/zAxis: { dir: Vector3, length, label, unit, scale },
  backgroudColor: Number,  // Three.js Color 十六进制数值
  barColorObj: { normal, warning, normalselected, shaderColor, planeColor, planeBorderColor },
  floorGrid: { color },
  axisGrid: { color, rectXZ, rectXY, rectYZ }
}
```

### 最小 Vue 用法

```vue
<template>
  <DtBarChartThree :options="barOptions" theme="dark" />
</template>

<script setup>
import { DtBarChartThree } from '@hw-dtn/dt-ui';
const barOptions = {
  data: [{ name: 'Group1', children: [{ name: 'NPU0', value: 80 }] }]
};
</script>
```

---

## 4. DtCustomBarChart

> 源文件: `es/components/custom-bar-chart/CustomBarChart.vue2.mjs`

### Props

| Prop | 类型 | 说明 |
|---|---|---|
| option | Object | 配置对象 |

### option 结构（推断自 resolveOption 调用）

```js
{
  yData: [],            // Y 轴标签
  series: {
    data: [],           // 数值数组
    barStyle: { gradient: { from, via, to } },
    label: { show, fontSize, color },
    glow: { color, shadowColor }
  },
  yAxis: { axisLine: { lineStyle: { color } }, axisLabel: { color } },
  xAxis: { axisLine: { lineStyle: { color } }, axisLabel: { color }, splitLine: { lineStyle: { color, type } } },
  tooltip: { show, formatter, backgroundColor, borderColor, textStyle: { color, fontSize } }
}
```

### formatter 支持

支持 `tooltip.formatter`，签名 `formatter(item, index)` → 返回 HTML 字符串。

### 最小 Vue 用法

```vue
<template>
  <DtCustomBarChart :option="barOption" />
</template>

<script setup>
import { DtCustomBarChart } from '@hw-dtn/dt-ui';
const barOption = {
  yData: ['CPU', 'GPU', 'NPU'],
  series: { data: [85, 72, 93] }
};
</script>
```

---

## 5. DtPointBezier

> 源文件: `es/components/point-bezier/point-bezier.vue.mjs`

### Props

| Prop | 类型 | 默认值 | 说明 |
|---|---|---|---|
| relation | Array | `[]` | 连线关系 `{ start: id, end: id, color, width, dasharray }` |
| triggerData | Array | `[]` | 左侧触发点 `{ id, label, isShow }` |
| targetData | Array | `[]` | 右侧目标点 `{ id, label, isShow }` |
| fill | String | `"none"` | SVG 曲线填充 |
| stroke | String | `"#ccc"` | 曲线颜色 |
| strokeWidth | Number | `4` | 曲线宽度 |

### Events

| 事件 | 参数 |
|---|---|
| delete | `{ start, end }` |
| add | `{ start, end }` |
| click | `{ start, end }` |
| enter | `{ start, end }` |
| leave | `{ start, end }` |
| blur | — |

### Slots

| 插槽 | 作用域 | 说明 |
|---|---|---|
| triggerPoint | `{ option }` | 自定义左侧节点渲染 |
| targetPoint | `{ option }` | 自定义右侧节点渲染 |

---

## 6. DtDashboardDesigner

> 源文件: `es/components/dashboard-designer/designer.vue.mjs` + `props/designer.mjs`

### Props

| Prop | 类型 | 默认值 | 说明 |
|---|---|---|---|
| designMode | String | `"template"` | `"page"\|"template"` |
| multipleCard | Boolean | false | 左侧卡片多选 |
| itemEditable | Boolean | false | 卡片可编辑 |
| gridConfig | Object | `{}` | 网格配置 |
| autoColNum | Number | 12 | 自动列数 |
| adaptiveHeight | Boolean | false | 自适应高度 |
| materialSearchVerify | Array\|Function | — | 搜索验证 |
| globalConfig | Object | `{}` | 全局配置传入卡片 |
| pageAttrs | Object | `{}` | 页面属性 |
| materialFilter | Function | — | 物料过滤 |
| materialData | Array | `[]` | 物料树数据 |
| propsMapping | Object | 默认映射 | 物料字段映射 |
| materialRequest | String\|Function | `""` | 物料请求 URL 或函数 |
| pageOptions | Object | `{}` | 页面 schema 参数 |
| schema | String\|Object | — | 已有 schema 数据 |
| maxCount | Number\|Array\|Object | 默认上限 | 最大卡片数 |
| maxCountTips | String\|Function\|Object | — | 超出数量提示 |
| validateRules | Object | — | 校验规则 |
| showSettingPanel | Boolean | true | 显示右侧设置面板 |
| showPreview | Boolean | true | 显示预览按钮 |
| showCancel | Boolean | true | 显示取消按钮 |
| disabled | Boolean | — | 禁止修改 |
| isMultiSelectable | Boolean | true | 多选 |

### Events

| 事件 | 参数 |
|---|---|
| update:materialData | value |
| save | schema, cardIdList |
| cancel | — |
| update-aside-size | size |
| selected-item-change | selectedItem, oldItem |
| item-edit-click | item |
| toggle-panel | `{ left, right }` |

### Slots

| 插槽 | 说明 |
|---|---|
| search | 搜索区域 |
| conditions | 条件区域 |
| center | 中央区域 |
| settings | `{ currentItem }` 设置面板 |
| elementAttrs | `{ currentItems }` 元素属性 |

### 公开方法 (expose)

| 方法 | 说明 |
|---|---|
| clear | 清空搜索关键字、组件映射、重置 tab |
| clearSearchKeywords | — |
| hideAttrsPanel | — |
| getDesignCount | — |
| getSchema | `(isValidate, isRefactor)` → schema 数据 |
| materialSearch | — |
| clearSelected | — |
| selectDesignerItem | `(id, slotName)` |
| doPreview | `{ customClass }` |

---

## 7. DtDashboardRenderer

> 源文件: `es/components/dashboard-designer/renderer.vue.mjs` + `props/renderer.mjs`

### Props

| Prop | 类型 | 默认值 | 说明 |
|---|---|---|---|
| designMode | String | `"template"` | `"page"\|"card"\|"template"` |
| gridConfig | Object | `{}` | 网格配置 |
| autoColNum | Number | 12 | 列数 |
| adaptiveHeight | Boolean | false | — |
| schema | String\|Object | **required** | schema 数据 |
| materialRequest | String\|Function | `""` | 物料加载 |
| globalConfig | Object | `{}` | — |
| dataSources | Array | `[]` | 数据源 |
| options | Array | `[]` | 卡片选项 |
| data | Array | `[]` | 卡片数据 |
| autoSize | Boolean | false | — |

### Events

| 事件 | 参数 |
|---|---|
| options-change | options |

### 公开方法

| 方法 | 说明 |
|---|---|
| anchorCard | `{ cardId }` |
| cancelAnchor | — |
| togglePanel | ...args（透传到内部组件） |
| maskPanel | ...args |

---

## 8. DtTimeLineControl

> 源文件: `es/components/time-line-control/time-line-control.vue.mjs`

### Props

| Prop | 类型 | 默认值 | 说明 |
|---|---|---|---|
| enabledFeatures | Array | `[]` | 启用的功能列表 |
| usePlayControl | Boolean | true | 显示播放控制 |
| useDateControl | Boolean | true | 显示日期控制 |
| startTime | Date | **required** | 起始时间 |
| endTime | Date | **required** | 结束时间 |
| isLoop | Boolean | false | 循环播放 |
| playSpeedList | Array | 默认配置 | 播放倍速列表 |
| playSpeed | Number | 1 | 当前倍速 |
| timeGranularity | String | **required** | 时间轴粒度 |
| playTimeGranularity | String | **required** | 播放时间粒度 |
| timeGranularityEnum | Array | **required** | 粒度枚举（滚轮切换） |
| eventData | Array\|undefined | — | 事件标记数据 |
| dataDistribution | Array\|undefined | — | 波浪线数据 |
| widthOfPerScale | Number | 90 | 每刻度间距(px) |
| styleData | Array\|undefined | — | 图例颜色数据 |
| defaultStyle | String | `""` | 默认图例颜色 |
| showLegend | Boolean | true | 显示底部图例 |
| useFuture | Boolean | false | 使用未来时间 |
| dateRange | Array\|undefined | — | 日期范围 |
| useJump | Boolean | false | 事件跳转加速 |
| jumpTime | Number | 5000 | 跳转时间(ms) |

### Events

| 事件 | 参数 |
|---|---|
| onPlay | currentTime |
| onPause | currentTime |
| onResume | currentTime |
| onStop | — |
| onTime | — |
| onEvent | event |
| onTimeGranularity | granularity |
| onTimeRange | [start, end] |
| clickEvent | eventObj |
| startTimeChange | time |
| speedChange | speed |
| backToStart | time |
| backToEnd | time |
| loopChange | isLoop |
| timeSliceChange | [start, end] |
| clearTimeSlice | — |

### Slots

| 插槽 | 说明 |
|---|---|
| eventPoint | 自定义事件点渲染（作用域含 eventPoint fields） |
| legend | `{ styleData }` 自定义图例 |

### 公开方法 (expose)

| 方法 | 说明 |
|---|---|
| clickPlay | 点击播放 |
| clickPause | 点击暂停 |
