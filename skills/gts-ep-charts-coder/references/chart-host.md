# 图表宿主协议

## 源码与依赖

- 页面位于 `src/pages/{Page}/index.vue`，可拆分业务组件、hooks 和 API；App.vue 负责挂载。
- 保留 main.js、预览 HTML、public/library 和既有 themes 骨架。按需国际化和主题切换参见 on-demand-toggle.md；默认不新增开关。
- SFC 使用 JavaScript；不使用 TS、JSX、CSS modules、非字面量动态 import。样式使用 scoped Less。
- 每个文件显式导入所用 Vue、EP 和图标 API。EP 标签使用 PascalCase；使用随包版本支持的 API，不猜测属性；build 检查导出和绑定，不验证所有 props。
- ECharts 使用 `import * as echarts from 'echarts'`。当前预览未映射 echarts/core、renderers 等子路径，不照搬按需注册案例。
- ECharts 在 mounted 后初始化，在容器尺寸变化时 resize，在 unmounted 时清理观察器、监听和 dispose；异步数据返回时避免更新已销毁实例。
- 默认使用直接 ECharts 实现；业务组件/API 未提供时不声称已接入。

## 视觉与 token

按 design/ 的规范索引选择领域及图表规则。EP 控件保留其组件机制，图表布局和视觉值不被 EP 页面规范覆盖。

页面局部 CSS 变量使用 `--page-*`，定义作用域须覆盖使用位置。图表规范要求的色值可在页面专用的 `src/assets/charts/<名称>.css` 中定义为 `--page-chart-*`，并在页面 JS 显式 import。该文件以具体图表容器 class 限定作用域，注释记录规范来源；不能覆盖 html、body、EP 变量或全局主题。未知 token 仍由 build 拒绝。

其他页面样式继续使用现有语义 token；不得为消除 WARN 而改成近似色、rgb 字符串或转移无关硬编码。图表 CSS 资源属于专用适配层，不是绕过全局样式规则的通道。

ECharts option 中允许使用有规范来源的精确数值和色值，必要时集中在图表配置模块。Canvas 不直接接收 CSS var()；使用 getComputedStyle(container).getPropertyValue(name).trim() 取得实际值，主题变化后重建相关 option。若规范未定义另一主题，不虚构规范值。

布局流式；图表容器有明确可用高度。按目标尺寸验证轴、图例、Tooltip 和数据标签，不用页面等比缩放替代响应式。

## 验证边界


build 检查 SFC、Less、模块导出、资源及 token，但不验证数据正确性和图表语义。预览与交付同源。浏览器验收覆盖任务相关的初始化、数据变化、resize、交互、卸载及导出；不要求每张图执行无关能力。

维护工程脚本时运行 scripts/verify-build.mjs；主题与图标改动分别运行对应维护测试。普通生成不运行维护测试。
