# 图表配置片段

仅阅读所需小节。以下是 ECharts option 的结构片段，数据变量由服务提供；与 [公共契约](VChart.md) 的 token 配色、生命周期说明组合使用，不包含虚构 API 或另一套运行接线。

## 折线：趋势
```js
({ tooltip: { trigger: 'axis' }, xAxis: { type: 'category', data: labels },
   yAxis: { type: 'value', name: unit },
   series: [{ id: 'trend', name: metricName, type: 'line', data: values }] })
```
时间不等间隔时考虑 time 轴和 [time,value] 数据；缺失值与零值区分。不默认开启平滑或面积填充。

## 柱状：分类比较
```js
({ tooltip: { trigger: 'axis' }, xAxis: { type: 'category', data: categories },
   yAxis: { type: 'value', name: unit },
   series: [{ id: 'comparison', name: metricName, type: 'bar', data: values }] })
```
长标签可改为横向柱状：xAxis 为 value、yAxis 为 category。需要堆叠时，相关 series 使用同一 stack 值，不把不同单位堆叠。

## 饼与环：构成
```js
({ tooltip: { trigger: 'item' }, legend: {},
   series: [{ id: 'share', type: 'pie', stillShowZeroSum: false, radius: ['45%', '70%'], data: items }] })
```
items 为 [{name,value}]；实心饼使用单个 radius。分类过多优先柱状或按业务聚合，不擅自丢弃小项。数据为空或数值全零时，在页面显示“暂无有效数据”，不渲染饼图及占比标签；stillShowZeroSum: false 作为防止全零数据绘制等分扇区的兜底，不替代页面空态。

## 散点：相关性
```js
({ tooltip: { trigger: 'item' }, xAxis: { type: 'value', name: xUnit },
   yAxis: { type: 'value', name: yUnit },
   series: [{ id: 'distribution', type: 'scatter', data: points }] })
```
points 为 [[x,y],...]；气泡大小需明确第三维含义与范围，不能直接把任意业务数值当像素。

## 雷达：多维对比
```js
({ tooltip: {}, legend: {}, radar: { indicator: dimensions },
   series: [{ id: 'dimensions', type: 'radar', data: groups }] })
```
dimensions 为 [{name,max}]，groups 为 [{name,value:[...]}]；每组维度顺序一致，尺度按业务解释，不能把不同单位不加处理地混在一起。

## 仪表盘：单指标进度
```js
({ series: [{ id: 'progress', type: 'gauge', min: 0, max: 100,
   detail: { formatter: '{value}%' }, data: [{ value: percent, name: metricName }] }] })
```
仅在数值确为百分比时使用此范围和格式；普通指标明确上下限与单位，不将仪表盘作为装饰。

## 混合：双单位对照

读取 [mixed-chart/index.vue](../patterns/mixed-chart/index.vue)，重点看 yAxisIndex、系列名称、单位、请求竞态和主题监听清理。不要仅为视觉丰富增加第二坐标轴。
