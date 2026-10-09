# components —— 高频组件示例 SFC

**本目录 22 个 SFC（21 个 Sweet* + 1 个 IconPlus）已在内网生成并过门禁
（Round 2，2026-09-29），内网副本为完成态载体；文件不出内网，本地保留本说明。**

内网生成纪律（回传报告 §5 沉淀 + 本目录原占位 README 口径，供维护者参考）：

1. 对照内网 SweetUI 官方文档 + 包内 `es/components/*/src/props.mjs` 逐个编写
   `Sweet{Component}.vue`（文件名 PascalCase）；
2. 示例形态对拍 EP 版（`generate-ux-prototype/vendor/vue-skill/components/El*.vue`）：
   一文件一组件、多状态并列展示、可独立运行；
3. 写法纪律：按需 import、kebab 模板标签、icon-plus 图标、Token 样式、less scoped、
   无静态内联 style、无规范引用注释；
4. 组件 API 特殊口径：
   - SweetPagination：current-page 用 v-model 绑 ref（静态 :current-page 静默不渲染）；
   - SweetForm：校验演示用 rules 即时校验（预览下 defineExpose 方法不可用）；
   - SweetChart：readToken 从 `document.body` 读 `--color-chart-*` 注入配色 +
     MutationObserver 换肤重绘；
   - SweetLoading：v-loading 指令（禁止 import 指令实体）；
   - SweetMessage / SweetNotification：`getCurrentInstance().proxy` 取命令式 API；
     $sweetNotify 无 max 参数，需页面侧队列守卫；
   - 浮层定制：customClass + 非 scoped 样式块（scoped 穿不到 body 挂载的浮层）；
5. 门禁（内网已过）：--el-*/--swt-* 零引用、无 sweet-icon name 直写、
   无硬编码 hex（#default 为 Vue slot 语法，非颜色）。

清单见 `../references/components_index.md`「高频组件示例对照」表。
