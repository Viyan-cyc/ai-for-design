# sweetui-vue-creator

根据自然语言需求生成 Vue 3 + SweetUI（`@hw-seq/sweet-ui-base@5.6.5`）页面的 skill。
与 `../generate-ux-prototype`（Element Plus 版）功能对等：同样产出离线双击即看的预览 HTML
与可拷入真实工程的 `src/` 源码，样式严格走 design-language token 体系。

## 目录职责

| 路径 | 内容 |
| --- | --- |
| `SKILL.md` | skill 主文档：工作流 ⓪–⑤、硬约束、UMD 已知坑 |
| `references/` | design-language token 速查、SweetUI 桥接层设计与核验程序、按需能力接入（i18n/主题切换 UI）、环境清单 |
| `scripts/` | 全部自动化：环境、建工程、图标检索、编译门禁、白名单与 token 生成 |
| `scripts/preview/` | 预览运行时骨架（index.gts.html + src/ 主题三件套 + icon-plus 包装组件） |
| `scripts/verify/whitelists/` | 组件/导出/图标三白名单（build 门禁校验依据） |
| `vendor/` | 生成参考资产（只读）：组件索引、代码规则、错误清单、页面模板、整页示例 |
| `HANDOFF.md` | **内网交接清单**：骨架 → 可用 skill 的剩余工作，逐项打勾推进 |

## 与 EP 版（generate-ux-prototype）的关键差异

- **组件库**：Element Plus → SweetUI 5.6.5（137 组件，`sweet-*` kebab 标签），
  白名单与导出表见 `scripts/verify/whitelists/`；
- **图标**：EP 的 `@element-plus/icons-vue` import 机制 → 统一 `<icon-plus name="X" />`
  包装组件：命中公司 icon+（fetch-icons 下载 SVG，深浅双套）渲染公司图标，
  未命中回落 SweetUI 字体图标 `sweetui-icon-{X}-l`；
- **主题**：`data-theme` 属性 → `body[theme]` 属性（SweetUI 原生 setTheme 机制），
  皮肤名 `default`/`dark`；bridge.less 双体系输出（`--el-*` 359 + `--swt-*` 667 槽位）；
- **命名空间**：不设 namespace（保持默认 "el"，类名前缀 `.el-*`，有对应 CSS 兜底）；
- **i18n**：不引 vue-i18n —— 组件内置文案走 `sweet-config-provider :locale`
  （locale 资产 `es/locale/lang/` 11 种），页面文案走词典 + `t()` 查表；
- **图表**：vue-echarts → SweetUI 原生 13 个图表组件（ECharts 6.1 封装）；
  chartTheme 不读 CSS 变量，跟随主题需 readToken 注入 `--color-chart-*`；
- **预览加载链**：CSS → vue.global → xss → lodash(`window._$1`) → echarts →
  `sweet-ui-base.umd.cjs`（全局 `window["sweet-ui-base"]`）→ less → vue3-sfc-loader。

## 当前状态

骨架完整（本地离线交付）：scripts、preview、references、vendor 结构与门禁逻辑就位，
components/exports 白名单已按探针取证填 137 项；SweetUI 专属细节（UMD 注册实跑、
bridge `--swt-*` 槽位接线、图标全集提取、icon+ API 实装、vendor 示例重写、端到端验证）
需内网执行，清单见 `HANDOFF.md`。
