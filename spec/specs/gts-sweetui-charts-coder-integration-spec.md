# gts-sweetui-charts-coder 集成 Spec

日期：2026-10-30。状态：外网准备稿；私有 SweetUI/DTUI 图表能力待内网核实。本 spec 新写，旧文档仅作参考，不作为事实。

## 目标

提供独立 gts-sweetui-charts-coder：设计师图表资料 + SweetUI 工程机制 + 经 npm 和运行验证的图表实现路径。运行期不调用其他 coder。不强制 DTUI 或 SweetEcharts 单一路径，按实际能力决定。

## 外网已完成范围

新增 skill 目录；复用当前基座 scripts 和 vendor 的候选实现，排除工作台复制脚本、顶层 assets 及通用场景资料；重新编写入口、工程流程、运行准备、接口契约和内网任务。嵌入原样 chart-design-expert 设计资料。原 coder、原文档和设计源保持不动。

复用不是认可全部旧实现。当前源码可确认 init 从包内预览和模板建立 src，build 使用 Vue 编译器并检查映射模块；当前映射没有独立 DTUI/ECharts。SweetEcharts 在候选导出表出现不证明其接口或复杂图表能力。所有私有库版本、资源正确性与运行兼容性仍待核实。

## 内网完成范围

以 [内网接续说明](../../skills/gts-sweetui-charts-coder/references/intranet-integration.md) 为执行任务，以 [图表契约](../../skills/gts-sweetui-charts-coder/references/chart-runtime-contract.md) 为调查输出。核实 npm、依赖与两库关系，选择实现路径，补齐预览/标准源码/构建/资源准备的完整接线并运行验证。

不得猜写库名、props、事件或全局对象；不可用时记录阻塞，不提供空库。ESM 需要维护期打包时记录工具、锁文件、external、输入输出摘要和许可。只改白名单、不验证运行不算完成。

## 设计边界与更新

图表方法、语义、系列色与图表视觉来自 design/；控件和页面来自经核实的 SweetUI 契约。普通 scoped CSS/JS，保留原生主题和图标；不使用 EP 机制。若封装能力冲突，记录能力缺口而不是降低设计要求后宣称合规。

design/ 原样同步，适配在 references/；升级时比对 design-entry、修正入口路由、记录实际来源与摘要并验证受影响案例。候选基座来源摘要见 integration-manifest.json；它是来源记录，不是运行验证结果。后续增加实际分发和资源证据，避免源摘要代表变更后的包。

## 完成条件

- 真实包/版本/API契约齐全，图型与交互能力边界明确。
- 资源、索引、导入/构建负例和适用维护回归通过。
- 离线最终预览完成图形、联动、主题、resize、导出验证；源码在真实 Vue 工程验证。
- 程序触发与真实输入分开记录；未验证/失败不冒称通过。
- 独立分发后复测，去掉无关资产，记录来源和内网改动。

未满足时保持 draft。当前外网代码不是可直接交付所有图表的正式版。
