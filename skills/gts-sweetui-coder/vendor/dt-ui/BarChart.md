# BarChart

用法参考；只使用本文列出的API，其他用法查对应组件实现。

源码定位：`packages/components/bar-chart/index.js`

## type

class_imperative

## engine

three_js

## source_file

packages/components/bar-chart/index.js

## description

3D bar chart using Three.js. NOT a Vue component. Must be instantiated via `new BarChart(dom, data, config)`.

## constructor

- `params`：[{'name': 'dom', 'type': 'HTMLElement', 'description': 'Container DOM element'}, {'name': 'data', 'type': 'Array', 'default': '[]', 'description': 'Chart data array'}, {'name': 'config', 'type': 'Object', 'default': '{}', 'description': 'Configuration overrides'}]

## config_defaults

- `theme`：light
- `xAxis`：{'key': 'xAxis', 'data': []}
- `yAxis`：{'key': 'yAxis'}
- `zAxis`：{'key': 'zAxis', 'data': []}
- `statusMap`：['alarm', 'normal']
- `bar`：{}
- `selectType`：default
- `selectable`：True

## public_methods

- `update(data, options)`：Update chart data. options.resetCamera=false default.
- `resize(width, height)`：Resize chart container.
- `setTheme(theme)`：Switch theme ('light'|'dark'). Updates scene, axis, bar, plane, grid colors.
- `getTheme()`：Returns current theme string.
- `resetCamera()`：Reset camera to default view.
- `zoomIn()`：Zoom in.
- `zoomOut()`：Zoom out.
- `select(id, options)`：Select bar by id. options.selectType: 'default'|'bar'|'row'|'col'. Toggle select.
- `deselect()`：Clear selection.
- `getRenderer()`：Get RendererManager for advanced usage.
- `getBarChart3D()`：Get inner BarChart3D instance.
- `trackCardPosition(id, position)`：Register card position tracking for camera rotation updates.
- `untrackCardPosition(id)`：Unregister card tracking.
- `clearTrackedPositions()`：Clear all tracked positions.
- `destroy()`：Release all resources, remove event listeners.

## events

- click
- hover
- dblclick
- select
- updatePosition

## three_js_themes

- `light`：{'sceneBackground': '#FFFFFF', 'planeColor': '#FFFFFF', 'gridLineColor': '#A6A6A6', 'axis_axesColor': '#C9C9C9', 'axis_labelColor': '#777777'}
- `dark`：{'sceneBackground': '#1A1A1A', 'planeColor': '#000000', 'gridLineColor': '#868686', 'axis_axesColor': '#555555', 'axis_labelColor': '#AAAAAA'}

