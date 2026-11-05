---
name: gts-charts-coder
description: 根据需求设计、生成或修改 Vue 3 + ECharts 图表原型，遵循图表设计专家规范，通过 EP 工程编译检查交付源码与离线预览。适用于图表分析、可视化与图表交互修改；普通无图表业务页面使用页面生成 skill。
metadata:
  version: 0.1.0
---

# gts-charts-coder

先读取 [图表公共入口](design/01-router/design-entry.md)，按其路由加载本次需要的方法、视觉规范和验收要求。不要全量读取设计库。

## 职责与宿主

图表设计、数据语义和视觉值以 design/ 为准；工程结构、模块解析和编译以本入口及 [宿主协议](references/chart-host.md) 为准。用户要求优先。没有定义的视觉值标为设计建议，不声称全部规范合规。

本 skill 已提供承载工程：Vue 3 + JavaScript + ECharts，离线 UMD 预览。公共入口中没有承载工程时的 Vite/TypeScript 分支不适用。design/ 是只读资料，案例仅复用适用逻辑，不执行其安装或构建脚本。

## 执行流程

以下路径相对本 skill，调用时使用绝对路径；工程目录使用用户指定目录或宿主产物目录。环境操作需要的长超时应由执行工具显式配置。

1. 确认 Node。缺失时运行 `scripts/install/install.ps1`（Windows）或 `scripts/install/install.sh`（macOS），不修改全局配置。
2. 会话首次运行 `node scripts/ensure-env.mjs`；失败按 HINT 安装或更新，再检查。安装失败如实报告错误及日志，不绕过环境。
3. 新任务运行 `node scripts/init.mjs "<产物父目录>" "<slug>"`。已有工程沿用其源码。读取输出 PAGE、SRC_DIR、HTML_PATH，不猜目录。初始化的最小柱图仅验证运行链路，不是视觉规范模板。
4. 读取宿主协议后生成图表；按公共入口读取适用设计规范与交付要求。业务数据经 `src/api/` 的 Promise 接口获取，mock 放在 `src/api/mock/`，页面不直接导入 mock。
5. 首次使用或改变 EP 图标引用时运行 `node scripts/fetch-icons.mjs --dir "<工程>"`；没有图标或引用未变时跳过。图标从 `@element-plus/icons-vue` 导入，裸图标用 ElIcon 包装或设置宽高。
6. 替换示例后运行 `node scripts/cleanup-starter.mjs --dir "<工程>"`，不手工删除用户文件。所有源码修改完成后执行 `node scripts/build.mjs --dir "<工程>"`。
7. 处理 ERROR 和 WARN。首次验证加最多两轮集中修复重跑；同一错误无新依据时提前停止。达到上限如实报告未通过，不降级为静态图片或绕过门禁。普通生成不得修改 skill 脚本。
8. build OK 后实际打开预览检查任务要求的显示和交互；无浏览器能力则记录未执行，不把静态检查当运行通过。源码修改后必须重新 build。
9. 默认交付一个预览 artifact，将本次成功构建返回的 HTML_PATH 实际绝对路径填入下列格式；必要的数据口径、验证结果与限制写在回复中。工程交接文档仅在用户要求时按设计包对应规则生成。此处采用宿主交付方式。

```xml
<artifact type="text/link">实际生成的 index.gts-ep.html 绝对路径</artifact>
```

交付时替换为实际路径，源码和配套资源保留在工程目录。

## 完成条件

build 输出 `RUNTIME: not-run`：仅编译及静态检查通过，不代表页面挂载或生产工程打包通过。所有实际承诺的能力按适用设计门槛验收，未执行项明确标注。未完成必要验收时不宣称全部完成。

界面呈现用户需要的信息，内部路由与验证过程留在工作流程中。
