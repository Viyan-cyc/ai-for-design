---
name: gts-ep-coder
description: 根据自然语言需求或参考图生成符合 GTS 设计规范的 Vue 3 + Element Plus 2.13.5 页面，交付可双击打开的离线预览和标准 Vue 源码。用于创建、修改页面及展示效果。
---

# gts-ep-coder

尽快把需求变成可见页面：按需选组件、token、图标与模板，编写代码，构建后打开预览，检查主要操作，然后立即交付。页面默认中文；国际化和主题切换按钮按需求添加。

交付 `index.gts.html`（双击离线预览）及 `src/`（真实 Vue 工程源码）。所有命令从本 skill 根目录执行，工程路径使用绝对路径。

## 1. 准备环境和工程

每个会话先执行一次，依赖锁未变不重复安装：

```bash
node scripts/ensure-env.mjs
node scripts/init.mjs "<输出目录>" "<slug>"
```

没有 Node、compiler 缺失或环境过期时，按 [环境准备](references/environment.md) 执行安装脚本；已有环境直接复用。安装失败如实给出 `RESULT`、`HINT` 和日志，不换依赖或伪造环境。

记住 init 输出的 `HTML_PATH`、`SRC_DIR`、`PAGE`。修改已有工程时复用其路径，不重新创建。

## 2. 按需选型，立即编写

先读 [页面与组件索引](references/page-routing.md)，只选择一个最接近的模板及当前需要的组件资料；不用每次读整份规范或多个整页例子。

- 页面放 `src/pages/{PAGE}/index.vue`，`src/App.vue` 负责挂载；数据经 `src/api/` 的 Promise 接口获取，mock 放 `src/api/mock/`，页面不直接读取 mock。
- 视觉值从 [常用 token](references/page-routing.md#常用-token) 选取；更多名称在 `references/design-language.md` 中定向搜索，精确主题值查询 `references/design-manifest.json`。不猜不存在的 token，不读开发机上的原始 design-language 目录。
- 使用真实 Element Plus 组件，模板用 PascalCase，每个文件导入自己使用的组件和 Vue API。样式用 `<style scoped lang="less">`；颜色、间距、圆角走 token，布局宽度/百分比可直接使用。
- 组件交互状态沿用现有主题桥接，不在页面覆盖 `--el-*`。局部派生变量用 `--page-*`。容器流式布局，表格允许内部滚动，不用缩放整个页面适配窗口。
- 参考图用于确定结构、内容和比例；规范决定 token/API。普通布局细节直接采用模板默认值，只有阻碍实现的实质业务歧义才询问。
- 不确定某个组件 API 时，只读索引指向的对应示例。历史示例仅作结构参考，不能覆盖设计目录或锁定的组件 API。

需要国际化或主题切换 UI 时才读 [可选功能](references/optional-features.md)。机制和两套主题已随工程提供，不必重建。

## 3. 解析图标

先按 Element Plus 名称编写，例如 `import { Search } from '@element-plus/icons-vue'`。图标首次生成或引用发生变化时执行：

```bash
node scripts/fetch-icons.mjs --dir "<工程目录>"
```

脚本沿用原 IconPlus 流程：getConfig → getIconInfo → 优先英文同名，否则选择最高 score 候选 → getIcon 取浅深主题。没有候选或服务不可达时用 EP；暗色取不到时沿用原流程复用浅色。无需手工补公司图标ID或让用户确认候选。

脚本生成 `src/assets/icons/index.js` 并改写页面 import，源码与预览共用同一入口。有效缓存无需网络；引用未变不重复解析。图标无变化且工程未使用图标时不需要空跑。

`RESULT: OK` / `STATUS: FALLBACK` 均可继续构建；`FAILED` 先修错误。服务异常简短说明已使用 EP，细节见 `icons-report.json`。裸 SVG 用 `<ElIcon :size="16">` 包装或显式宽高；ElButton 的 `:icon` 已有包装。

## 4. 构建、打开、反馈

修改源码后执行，刷新预览的数据映射：

```bash
node scripts/build.mjs --dir "<工程目录>"
```

构建使用真实 Vue 编译器并检查导入与必要文件。失败时一次读完错误、修复后重跑；不能在 `RESULT: FAIL` 时声称完成。样式提示不阻断可运行页面，不为清零提示反复修改。

构建成功后：

1. 打开 `HTML_PATH`，确认主要内容可见，无白屏、致命异常或必要资源加载失败。
2. 检查一条主要操作，例如搜索、弹窗开关、表单校验/提交。无交互的页面不额外制造任务。只查看当前视口明显布局问题，需求指定响应式或更改主题时再查相应视口/主题。
3. 立即给用户可点击的预览链接及源码位置，简短说明完成内容和必要的未验证项，再按反馈迭代。

浏览器不可用时仍交付可打开的预览，但明确“构建通过，运行未验证”。mock 不等于真实后端联调。不做全状态、全组件、逐项 computed-style 或像素级证明。

## 编辑和运行约束

- 页面生成只改工程的 pages、App.vue、api 和按需 i18n；不改 skill 脚本、vendor、node_modules、全局 npm/代理配置。
- `index.gts.html`、`public/library/`、`src/main.js` 和既有主题为骨架，不手改；图标由脚本生成。新增主题按工程 `src/assets/themes/README.md` 协议。
- 不删除用户目录；需要清理未用 starter 服务时用 `scripts/cleanup-starter.mjs --dir "<工程目录>"`，它会保护已修改文件。保留模板仍使用的 demo 服务。
- 预览运行时不能可靠使用跨组件 `defineExpose` 命令式调用；使用 props/emits 或 prop 信号配合 watch。分页用 ref + `v-model:current-page`，不要静态写死页码。
- 不用截图或纯 HTML 冒充 Vue 源码，不通过改骨架或绕过构建隐藏错误。
