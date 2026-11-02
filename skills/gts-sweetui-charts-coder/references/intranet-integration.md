# SweetUI/DTUI 内网调查与实施接续

## 任务与边界

在收到的 gts-sweetui-charts-coder 草案上补齐真实图表能力，使单个 skill 能按设计规范生成 Vue + SweetUI 图表页面，并通过离线预览及标准源码验证。原 gts-sweetui-coder、EP 包和 chart-design-expert 源只读，不替换它们。旧文档和既有代码只作线索，不保证正确；实际 npm 发布内容、同版本接口和运行结果为依据。

工作开始先记录新包路径、SweetUI/DTUI npm 包路径、测试输出路径。报告和测试工程放 skill 外。未知路径先查找或向用户询问，不使用历史机器路径。若仅有 tgz，先解包检查，不盲目执行安装生命周期脚本。

## 1. 调查

分别记录 package.json 的 name/version/main/module/browser/exports/types、dependencies/peerDependencies、打包格式、许可/NOTICE、必要 CSS/字体/图片。确认传递依赖是否齐全，缺少私有包时报告准确名称与版本范围。

查类型声明、导出入口、发布代码和示例，必要时同版本源码，确认：

- SweetUI 图表是否包装或转导出 DTUI；两者是否共享图形引擎及版本；不能仅凭文件名判定。
- 真实组件/函数名、import、props/options/schema、事件、实例接口、resize、更新和销毁。
- 折线、平行坐标、组合图/自定义绘制能力；完整 option 透传还是受限封装。
- dataZoom 等交互的真实事件形态（包括是否 batch）、图例联动、外部聚焦、导出与主题支持。
- 浏览器运行格式与全局依赖；只有 ESM 不等于不能用，评估一次性维护打包。不能把 ESM 文件直接改扩展名冒充 UMD。

将结论填入 references/chart-runtime-contract.md，给出包版本及文件定位、最小实际代码、已验证/失败/未知。不要编造 DTUI 的 npm 名字或把 ECharts API 当作 DTUI 必然支持的 API。

## 2. 选型与代码补齐

先对比 SweetUI 图表与 DTUI，按能力决定默认路径和必要分流，不预设其中一套必胜。若封装满足需求优先复用；若复杂图表受限，记录限制，再评估受支持的底层扩展或直接图形引擎。不得为了绕过调查直接把 EP 整套依赖复制进来。

可修改本新包，至少联动检查：

- scripts/prepare-runtime.mjs、check-runtime.mjs：实际资源、依赖顺序、CSS资源、全局映射；需要转换则给可复现构建。
- scripts/preview/index.gts.html：脚本/CSS及 moduleCache。
- scripts/preview/src/runtime.js、main.js 等共享接线：仅在真实接口要求时修改，离线与真实工程用同一业务实现。
- scripts/build.mjs：对应合法包入口、真实导出及资源检查；保留负例拒绝能力，不能全局放行未知模块。
- gen-whitelists/gen-tokens 及候选索引：按实际 npm 核对并生成，不手工凑数量。
- SKILL.md、workflow、代码规则、主题/token参考：消除与真实接口或图表规范冲突的指令，补最小示例和明确能力边界。

使用普通 scoped CSS 和 SweetUI 自身控件机制，不引入 EP/Less 规则；图表内部视觉以所选 design/ 规范为准，封装无法表达时记录差距。不修改 design/ 副本补造规范，不重新加入工作台/AI输入器资产。

## 3. 验证

先跑对应环境/资源检查与 verify-build。通过 init → 编码 → cleanup-starter → build → 实际浏览器打开 index.gts.html 验证最终包：

1. 折线与平行坐标实际有数据图形，不仅 canvas 存在；数据更新、空数据。
2. 图例、筛选/联动、缩放范围和恢复；如实际支持多组件批量事件，覆盖 batch。
3. 首次渲染、容器改变、主题切换、卸载/重挂，不丢失合理的用户状态。
4. 导出真实 PNG 并检查内容；不支持则明确限制，不放一个空按钮。
5. 修改已有页面后重建预览；标准 src 放入已装正确依赖的 Vue 工程，检查源码接入，不只让离线 HTML 工作。
6. 非法 import/token 等负例仍拒绝；解压最终分发包到另一位置重新生成运行，避免依赖开发目录。

程序 dispatchAction/setOption 与真实拖拽/滚轮输入分开；Tooltip 触发与外观定位分开。未执行写未验证，实际失败写 FAIL。缩放不能硬编码 Step 1–400；主题接口按 SweetUI 真实状态与 selector，不照搬 html[data-theme]。

## 4. 回传与完成状态

回传到 skill 外：

- investigation.md：版本、关系、能力对照、选型理由、准确代码位置和未知项。
- acceptance-report.md：最终包实际命令、浏览器/真实工程结果、验证触发方式、剩余项。
- resource-manifest.json：相对资源路径、来源包版本/路径、SHA-256；转换同时记录输入/输出摘要及可复现命令，不冒称原样复制。
- changes.patch 或改动清单加完整修改文本；更新后的 chart-runtime-contract.md、必要白名单/token索引。
- 最终完整 skill 留在内网交付。外网回传仅含组织允许的资料与代码；受限实现或二进制不能回传时，回传允许的接口摘要、差异说明及验证结果。

缺包或关键接口仍未知时交付已完成工作和阻塞项，保留 draft，不能声称图表就绪。实际验收通过后再更新版本、入口状态与能力描述。不要为了标记成功而删除未验证项。
