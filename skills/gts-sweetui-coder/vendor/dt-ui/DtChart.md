# DtChart

用法参考；只使用本文列出的API，其他用法查对应组件实现。

源码定位：`packages/components/chart/index.vue`

## type

vue_component

## engine

echarts

## source_file

packages/components/chart/index.vue

## tag

dt-chart

## description

ECharts wrapper component. Pass raw ECharts option object. Supports theme switching via echarts.registerTheme.

## props

- `options`：{'type': 'Object', 'default': '{}', 'description': 'Standard ECharts option object. Supports baseOption+options (timeline) pattern. Deep-watched.'}
- `created`：{'type': 'Function', 'description': 'Callback after chart instance created, receives echarts instance as parameter'}
- `showEmpty`：{'type': 'Boolean', 'default': False, 'description': 'Show DtNoData component when series is empty'}
- `width`：{'type': 'String | Number', 'default': '100%'}
- `height`：{'type': 'String | Number', 'default': '200px'}
- `showTheme`：{'type': 'Boolean', 'default': False, 'description': 'Enable ECharts registered theme support. When true, registers all chartTheme entries via echarts.registerTheme.'}
- `theme`：{'type': 'String', 'default': '', 'validator_values': ['', 'hDesign1.1-dark', 'hDesign1.1-light', 'uDesign2.2-dark', 'uDesign2.2-light', 'light', 'dark', 'black'], 'description': 'ECharts theme name to apply. Must match a registered theme key. Only effective when showTheme=true.'}

## events

- `resize`：{'payload': 'chartEl, chartInstance', 'description': 'Fired on chart resize'}

## slots

- `empty`：{'description': 'Custom empty state, replaces default DtNoData'}

## lifecycle

- `mount`：nextTick → render() → resize.on() creates ResizeObserver
- `activate`：nextTick → resizeChart() (for keep-alive)
- `unmount`：chart.dispose(), chart=null
- `options_watch`：deep watch, if newVal.isNew → reset isCreated, re-render
- `dimension_watch`：width/height change → nextTick → resizeChart()
- `theme_watch`：themeValue change → nextTick → render() (dispose+reinit with theme)

## update_mechanism

- `type`：deep_watch + setOption(true)
- `note`：chart.setOption(echartsOptions, true) uses NOT_MERGE mode. Full option replacement each render call. Set options.isNew=true when full re-initialization is needed.
- `3d_validation`：If xAxis3D/yAxis3D present, validates axis.data exists before setOption

## exposed_api

No setTimeout/getZr methods exposed. Access echarts instance via `created` callback prop.

更新时传入完整options；不要依赖未确认的增量合并行为。
