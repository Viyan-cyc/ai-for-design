# UI Runtime 接入说明 — generate-ux-prototype

> EP 2.13.5 为当前唯一 runtime（D5 钉死）。SweetUI 本次只留口子，不接入（需求 1）。
> 接入新 UI 库 = 补三件套，架构不动（§4.4）。

## 三件套

按「UI 库」为单位组织三样东西。接入 SweetUI 时照此办理。

### 1. UMD 目录

`scripts/preview/public/library/{runtime}/`

预览态（`index.html` 浏览器直接打开）用 UMD 加载，不入 npm 依赖。当前 element-plus 目录内容：

```
scripts/preview/public/library/element-plus/
├── vue.global.prod.js                       # Vue 3 运行时
├── vue-router.global.prod.js                # Vue Router 4
├── element-plus.full.min.js                 # EP 2.13.5 完整 UMD
├── element-plus.index.css                   # EP 样式
├── element-plus-icons-vue.iife.min.js       # EP 图标 2.3.2
├── element-plus-locale-zh-cn.min.js         # EP 中文语言包
├── dayjs.min.js                             # dayjs 1.11.19
├── less.min.js                              # less 浏览器编译器（D22 编译 <style lang="less">）
└── vue3-sfc-loader.js                       # SFC 加载器 0.9.5
```

**SweetUI 接入**：在同级建 `sweet-ui/` 目录，放入 SweetUI 的 UMD 文件。

### 2. 白名单

`scripts/verify/whitelists/{runtime}/`

build.mjs 校验用，三份 JSON：

| 文件 | 作用 | 当前 element-plus 规模 |
|---|---|---|
| `components.json` | 允许的 `<el-*>` 标签白名单 | 116 个 |
| `exports.json` | 允许的 `import { X } from 'element-plus'` 导出名白名单 | 130 个 |
| `icons.json` | 允许的 `import { X } from '@element-plus/icons-vue'` 图标名白名单 | 295 个 |

schema 直接引用现有 `scripts/verify/whitelists/element-plus/*.json` 为例。

**SweetUI 接入**：建 `sweet-ui/` 目录，放三份 JSON（SweetUI 的组件/导出/图标白名单）。

### 3. Token 桥接 CSS

资产库 token 体系是 G Design 自有的 `--g-*` / `--color-*` / `--space-*`，UI 库（EP/SweetUI）有自己的变量（EP 是 `--el-color-primary` 等）。**桥接 = 用 G Design token 映射 UI 库变量**，让 UI 库组件自动跟随 G Design 主题。

资产库已做好 EP 桥接：`assets/.../tokens/element-plus.css`（+ `.scss` 源产物，Sass 构建期用）。init 时随 `src/assets/tokens/` 全套复制进工作区。

**SweetUI 接入**：写一份 `sweet-ui-bridge.css`，把 G Design 语义 token 映射到 SweetUI 变量，参照 `element-plus.css` 的做法：

```css
/* 示例结构（实际按 SweetUI 变量名调整） */
:root {
  --sui-color-primary: var(--g-accent);
  --sui-color-success: var(--g-success);
  --sui-color-warning: var(--g-warning);
  --sui-color-danger: var(--g-urgent);
  --sui-bg-surface: var(--g-bg-surface);
  --sui-text-primary: var(--g-text-primary);
  /* ... */
}
[data-theme="dark"] {
  --sui-color-primary: var(--g-accent);  /* 暗色下 token 已切换，桥接不变 */
  /* ... */
}
```

桥接 CSS 放资产库 `tokens/` 下（设计师维护），init 随 token 全套复制进工作区。

## SKILL.md 选择步骤

`UI_RUNTIME` 开关记录到 `views/{slug}/js/constants.js`，默认 `element-plus`。SKILL.md 生成流程确认此值后：
- `element-plus` → 用现有三件套
- `sweet-ui` → 需资产库已补齐 SweetUI 三件套（UMD 目录 + 白名单 + 桥接 CSS），否则回退 element-plus 并告知用户

## 版本钉死

- Element Plus **2.13.5**（D5）
- @element-plus/icons-vue **2.3.2**
- dayjs **1.11.19**
- vue3-sfc-loader **0.9.5**（预览专用，真实工程用 Vite 不需要）

升级 EP 版本 = 替换 UMD 五件套 + 刷新三份白名单 + 重跑 P0 验证（token 桥接兼容性）。
