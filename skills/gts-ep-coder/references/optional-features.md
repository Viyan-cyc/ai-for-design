# 国际化与主题

仅需求涉及多语言或切换UI时读取。本文件中的路径相对skill根目录。

#### 国际化：按需启用（默认不含任何 i18n 代码）

- **用户没提国际化 → 页面直接写中文**（starter 页默认直接中文，改动为零）。
- **用户要求国际化（或明确多语言）→ 该工程启用**，最小集：
  1. 装配：从 `scripts/preview/i18n-scaffold/` 拷贝 `i18n/` 到工程 `src/`（含 createI18n、
     locales、EP_LOCALES 映射；**逐字拷贝，不要重写**——预览 moduleCache 与 build 白名单按此接线）；
  2. 文案 key 化：页面用 `const { t } = useI18n()` + key（key 命名 `msg.{页面}.{分类}.{语义}`，
     至少 3 个点，见 code-rules 规则 10.2）；
  3. 词典进 `src/i18n/locales/{zh-cn,en}.js`（**两份 key 集合必须一致**，en 缺失会回落中文）；
     - 词典边界（只收两类，判定法：对接真实后端后词条还用得上吗）：
       ① 界面文案（标签/按钮/占位符/提示/空态）；
       ② 枚举显示名——封闭集合的 code→label（如 level/status/业务域），存于数据的只有 code，
          显示文案由 `t()` 解析；对接后端后词典保留，仅把 code 集合对齐后端枚举表。
       记录内容**不进词典**：标题/描述/设备或资源名称/人名/时长等开放文本，存于 mock、
       对接后被真实数据取代，组件不得对数据值做 `t()` 包装（否则真实数据会显示 key 路径，
       破坏「页面零改动」契约）。拿不准封闭/开放时，按记录内容处理。
  4. App.vue 接线 + 切换 UI：**UI 形态按用户描述决定**（图标/下拉/菜单项均可），参考实现见
     `references/on-demand-toggle.md`（含预览必需：幂等补装须先于 `useI18n`，EP 文案经
     `ElConfigProvider` 跟随）。真实工程入口需 `app.use(i18n)`。
- 启用 i18n 的工程，`ElMessage` 等命令式提示文案同样走 `t()`。

#### 主题切换：机制常驻，UI 按需

- 换肤**机制**随工程交付（`src/assets/themes/` 协议：一皮肤一文件（.less）、`html[data-theme="{name}"]`、
  bridge.less 自动跟随、新增皮肤插槽）——这部分不删不用重做，页面颜色全程走 token。
- **切换 UI 默认不在**。用户要求深浅切换 → 接入 UI，**形态按用户描述决定**（图标 toggle/
  下拉/菜单项均可），参考实现见 `references/on-demand-toggle.md`。
- **内置 default + dark 两套皮肤**。两套皮肤均由 gen-tokens 从设计文档统一双主题表（§1.2 `Token｜用途｜Light｜Dark`）生成，无工程回填项。
  token 数值以 skill 内 `references/design-manifest.json`（同源生成，含来源 hash）为准；**页面生成期不回查
  design-language 原始目录**——那是维护期（设计师改文档后跑 `gen-tokens --source-dir` 同步）才用的。
