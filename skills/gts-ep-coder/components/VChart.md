# VChart 使用契约

使用已有 vue-echarts，不另外封装图表引擎。基础组件见 [VChart.vue](VChart.vue)，数据请求与主题更新整页参考 [mixed-chart](../patterns/mixed-chart/index.vue)。

## 按需选取

先确定数据表达，再只读 [类型配置](VChart-options.md) 的对应小节：趋势→折线；分类比较→柱状；构成→饼/环；相关性→散点；多维对比→雷达；单指标进度→仪表盘；双单位→混合图。不是能力白名单，其他类型按实际 ECharts 版本核实，不猜 HUICharts 或 dt-ui 的 API。

## 组件与更新

```vue
<VChart ref="chart" :option="option" autoresize @click="handleChartClick" />
```

每文件显式 import VChart from 'vue-echarts'。业务数据来自 Promise 服务；option 用 computed 派生。通过组件更新 option，不在每次数据变化时销毁重建，不用 JSON.stringify 代替响应式依赖。系列使用稳定 id；删除系列或切换结构时按已安装 vue-echarts 的更新策略处理，必要时使用 update-options 的 replaceMerge，避免旧系列残留。

## 尺寸与隐藏恢复

- 最简单可靠的起点：图表 width:100%、height:320px，页面按实际密度调整，不把 320px 当设计规范。
- 弹性布局让容器有可计算高度，并设置 min-width:0、min-height:0；不能只写 height:100% 而祖先没有高度。
- autoresize 负责尺寸变化，不再重复注册 window.resize 或 ResizeObserver。
- 标签页、抽屉中初始隐藏可能导致零尺寸。显示且布局完成后，必要时 await nextTick() 再 chart.value?.resize()；带过渡的容器在 opened/过渡结束后处理。不要为刷新尺寸重建全部页面。
- 不从 canvas 的尺寸反向决定父容器高度，避免 resize 引发高度循环增长。

## 主题与配色

运行时读取 GTS token，不能把 var(--color-chart-1) 字符串直接传给 canvas 配色。挂载且主题生效后读取；使用现有 data-theme 接线，主题变化重新计算 option，不复制另一套主题状态。完整流程参考 mixed-chart。

除了系列色，也检查文字、坐标轴、分隔线、图例和 tooltip 的明暗主题；仅更新 option.color 不代表深色适配完整。同一类别在多张图中保持颜色映射，使用准确 token 名称，不照搬其他库默认色板。

## 事件与状态

优先模板 @click 等声明式事件；必须手动绑定实例事件时，保存同一个 handler 并在解绑/重绑时清理，避免多次渲染重复注册。VChart 管理图表实例销毁；页面只清理自己创建的主题监听、请求及其他资源，不手动 dispose 组件拥有的实例。

加载、无数据和错误按真实状态显示，不用虚构数据填满图。图例、坐标轴、tooltip 优先使用图表原生能力；只有明确的定制需求才另做 UI。不声称构建通过就是图表首绘或主题切换已验证。
