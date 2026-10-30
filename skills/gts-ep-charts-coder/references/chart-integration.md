# EP 图表适配

## 实现和数据

使用当前离线映射支持的 `import * as echarts from 'echarts'`。不要套用 `echarts/core` 子路径；vue-echarts 仅在接口已核实且适合任务时用，不与手动实例管理混用。已装 ECharts 不等于已接入业务 BoxPlot 等封装组件。

Vue SFC 使用 JavaScript。数据经 src/api 的 Promise 服务获取。图表容器挂载并有有效尺寸后初始化，数据变动 setOption；监听容器尺寸（ResizeObserver）并调用 resize，隐藏恢复时重新检查尺寸。卸载时 disconnect、移除监听并 dispose。实例用普通局部变量或 shallowRef，不深度代理 ECharts 实例。

## 缩放与联动状态（存在相关交互时）

范围标签、恢复按钮、多个图表需要共享缩放范围时，优先由组件内部状态（如 zoomState）作为统一来源：先初始化状态，再用它构建首次 option；图表事件更新同一状态，标签、按钮和其他图表从该状态派生。不要在每次 buildOption 时反读尚未初始化的图表，也不要同时维护互不一致的显示范围与图表范围。简单图表不因此强制新增状态层。

- 初始化范围从实际数据和用户需求计算。Step 1–400 是具体案例，不是默认值；空数据、单点数据和数据范围变更需按实际情况处理，恢复操作回到当前数据的全局范围。
- dataZoom 回调可能给出单项参数，也可能在 batch 数组中给出多项。先统一成条目集合，再按稳定 dataZoomId 或已知 dataZoomIndex 匹配目标；多轴/多图不能无条件只取 batch[0]，缺少身份时仅在目标确实唯一时处理。
- 区分百分比 start/end 与值域 startValue/endValue，按事件实际提供的字段更新；0 是合法值，不能用真假判断丢弃。缺少端点时保留已确认端点，不拿 undefined 覆盖状态。
- 百分比转 Step 只在连续等间隔数值域等已明确条件下线性换算，按数据粒度取整并限制在有效范围内。分类轴通过实际类别索引映射，不连续时间或数值轴按实际轴域处理；对数轴等不套用线性公式。不要用案例中的常数或默认数组下标冒充业务值。
- 恢复操作同时更新统一状态和对应 dataZoom；跨图传播变化时避免相同范围重复 dispatchAction 造成反馈循环。主题/平滑/排序等更新保留用户范围，除非数据变化使其失效。

需要读取图表已有状态时，仍须检查实例和返回值：首次 setOption 前以及 clear 后 getOption() 可能返回 undefined；实例已销毁时不读取。安全读取形如 `chart && !chart.isDisposed() ? chart.getOption() : undefined`，再对 option/dataZoom 做空值处理；多个缩放组件按身份匹配，不固定取第一个。防空是读取契约，不替代界面状态设计。

更新同一图表时保留对象身份、选中状态与 dataZoom。删系列时根据稳定 series id 使用适用的 replaceMerge 等机制，不无条件 clear 或重建整图。空数据/请求失败/加载状态有明确表达；异步请求应避免旧响应覆盖新筛选。

## 图表视觉与页面样式

EP 控件与外围页面继续 scoped Less 和 GTS token。图表内部的系列色、轴线、图例、Tooltip 和几何参数遵从本次所选 design 规范。

HD 分类色、公共元素中性色等已有精确值时，按规范写在 option 或专用 chart-options.js 中，记录来源于 HANDOFF；不要因页面色值规则而把所有系列改成品牌色。规范原文未给 token 名时，不编造对应名称。

当前 build 仅对 Vue style 块中的硬编码 hex 发 WARN；JS option 中按规范使用 hex 可以通过，已在维护用例覆盖。因此无需关闭或改写 build 的颜色门禁。不要为了躲检查拆分颜色字符串。CSS 图例/外置 Tooltip 如需与图表色保持一致，可由同一 JS 颜色映射绑定局部样式变量，避免维护两套不一致色板；仍保留页面 token 检查。

ECharts Canvas/SVG option 不假定会解析 `var(--token)`。确需映射宿主 token 时，从挂载容器 `getComputedStyle(element).getPropertyValue(name).trim()` 读取实际颜色并检查非空。具体 token 从 token-catalog 核实，不能猜名。

深色模式有适用图表规范时遵从规范。缺少深色定义时保留稳定系列身份色，公共背景/文字等按宿主语义 token 映射并在 HANDOFF 写明“本次深色适配建议”，不冒充正式 HD 深色标准。不能擅自修改 design/ 补定义。

主题机制沿用 EP 的 html[data-theme] 和共享主题状态模块；只在用户要求时提供切换 UI，见 [切换说明](on-demand-toggle.md)。图表监听该属性变化或已有主题信号，重新读取计算值并更新相关 option；不要另建 theme 状态或通过销毁实例丢失选择/缩放。MutationObserver 在卸载时清理。

## 交付

页面 CSS、导入、组件、目录等执行 [EP 工程流程](ep-workflow.md)。图表效果执行所选设计规范，不把编译通过等同效果验收。

图片导出需要调用真实图表导出能力并核实结果；导出当前实例还是包含外部筛选/标题的整页要按需求区分，getDataURL 不会自动包含外部 DOM。浏览器不支持或未验证的能力明确标记。

交互验证要标明触发方式：setOption/dispatchAction 验证的是程序更新与状态联动，不等同真实鼠标拖拽、滚轮或键盘输入。范围标签与恢复按钮应核对缩放前后及恢复后的实际值；batch 处理只有实际覆盖后才记通过。

存在 canvas 只证明挂载，不证明曲线等数据图形已绘制；渲染判断结合实际画面或适当的绘制证据。图例、聚焦、排序、平滑等只验收任务中存在的行为，不把某个案例的完整交互清单强加给所有页面。

Tooltip 的事件触发、内容、视觉外观和定位分开记录，触发通过不代表遮挡/溢出检查通过。界面操作提示与已实现能力一致：未确认支持的滚轮等操作不要写成已具备的卖点；用户明确要求的能力仍需实现或记录未验证/受阻，不能仅删除提示就算完成。验证详情放 HANDOFF，不把测试过程塞进产品界面。

HANDOFF 位于 src/pages/{Page}/HANDOFF.md，按上游 [交接要求](../design/03-references/prototype/handoff.md) 记录适用七项及真实验证。普通文档修改无需重跑 build，运行源码变化则必须重跑。
