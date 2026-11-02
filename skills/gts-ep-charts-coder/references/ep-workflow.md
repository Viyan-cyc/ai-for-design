# EP 工程流程

命令从 skill 根目录执行；工程目录使用绝对路径。图表方案、交付状态见 SKILL.md，编码规范见 [代码规则](code-rules.md)，图表内部视觉和交互见 [图表适配](chart-integration.md)。本文只定义工程执行与边界。

## 环境

当前会话先确认 `node -v`，再运行 `node scripts/ensure-env.mjs`。同一环境已确认则复用结果。

没有 Node 时运行本包安装入口（skillDir 为 SKILL.md 所在目录）：

```powershell
powershell -ExecutionPolicy Bypass -File "<skillDir>/scripts/install/install.ps1"
```

macOS 使用 `bash "<skillDir>/scripts/install/install.sh"`。依赖缺失或锁过期按 ensure 输出的 HINT 安装/更新，再检查一次；安装失败报告实际 RESULT、DETAIL、HINT 和可用日志，不反复执行相同失败操作，不另建环境绕过管道。安装器的版本与来源由随包配置决定，不在指令中另维护版本号。

## 初始化与编写

仅新工程运行：

```sh
node scripts/init.mjs "<输出父目录>" "<page-slug>"
```

slug 为 2–6 段小写英文/数字，以连字符分隔。记住输出 HTML_PATH、SRC_DIR、PAGE。已有工程跳过 init，原地修改需求涉及源码，保留无关内容。

- 页面放 `src/pages/{Page}/`，业务服务与 mock 放 `src/api/`。App.vue 负责挂载和需求明确的装配。
- 不手工改生成的 HTML、preview-data.js、public/library 或既有主题文件。main.js 仅在启用国际化时追加规定安装接线。新增皮肤按生成工程 `src/assets/themes/README.md` 协议。
- 当前管道支持 JavaScript Vue SFC、CSS/Less、字面量动态 import，不默认支持 TS/JSX、CSS modules 或任意 npm 包。不要照搬设计案例的 Vite 配置。
- token 按 [目录](token-catalog.md) 查准确名称；EP 组件按 [索引](components_index.md) 查相关条目；需要布局参考再读 [组合索引](../patterns/README.md)。不默认遍历全部示例。示例视觉值不能覆盖本次选中的图表规范。
- 默认中文，无主题/语言切换 UI。需要切换时读 [切换说明](on-demand-toggle.md)，沿用共享机制，不复制另一套状态系统。

页面生成时不修改 skill 的 scripts；脚本异常如实报告。维护 skill 的任务可以修脚本并跑相应回归。不要通过修改全局配置、手工拼依赖或另起服务绕过指定构建。

## 图标（有新增或变化时）

```sh
node scripts/fetch-icons.mjs --dir "<工程目录>"
```

首次使用图标或引用集合改变时，在 build 前执行；无图标或引用未变则跳过。按 EP 图标名称导入，脚本将命中的公司图标接入本地入口，未命中保持 EP。具体名称从 `scripts/verify/whitelists/` 核对，不编造图标。

已有双份图标文件按缓存复用；命中名称不代表语义必然正确。服务探测不可达时按脚本行为回退 EP；搜索等阶段返回 FAIL 时说明服务异常，不伪称全部命中。浅色成功而深色缺失时脚本可能复用浅色，双文件存在不证明深浅均独立获取。

可用 `--base-url` 和 `--timeout` 覆盖服务地址和请求超时，正常生成不改接口、评分或协议。公司服务验证与本地编译分开记录。

## 自查、清理与构建

按代码规则最后一节完成适用源码自查。源码与图标处理完后运行：

```sh
node scripts/cleanup-starter.mjs --dir "<工程目录>"
node scripts/build.mjs --dir "<工程目录>"
```

cleanup 仅清理符合条件的原始 starter 数据，已改造或仍引用的内容按输出保留；不手动清空用户目录。build 检查 SFC、样式、导入/导出、组件绑定、资源和 token，刷新预览。源码修改后重新 build，纯文档修改无需重跑。

RESULT: OK 才能称构建通过，WARN 也要处理。FAIL 时汇总错误集中修改；同批交付首次验证后最多两轮修复重跑，同一错误无新依据时提前停止，不通过切换步骤或对话重置额度。达上限报告未通过及剩余错误；新修改任务或明确要求继续才开始新批次。

build 不挂载业务页面，RUNTIME: not-run 不是浏览器通过。交付入口与其他验证状态按 SKILL.md，不承诺任意 Vue 工程直接复制即可工作；实际工程仍须匹配依赖、主题与入口接线。

## 当前预览兼容写法

- 跨组件调用优先 props/emits；使用模板 ref + defineExpose 时需确认当前加载器实际支持，不将未验证的方法调用当作可用。
- 分页状态绑定 ref，不用固定 current-page 冒充可交互分页。
- 内置分页文案先按实际 locale 检查；只有确认原生文案不满足要求时才组合自定义跳转控件，不把历史英文现象当作所有版本的限制。
