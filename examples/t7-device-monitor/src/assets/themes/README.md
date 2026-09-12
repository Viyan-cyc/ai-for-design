# 自定义皮肤插槽（theme Slot）

本目录是自定义皮肤插槽：**每个皮肤一个 css 文件**。设计资产的标准明暗主题由 `src/assets/tokens/`（init 时从资产库现取）提供，协议为 `data-theme="light|dark"`；需要额外自定义皮肤时，把皮肤文件放进本目录。

## 皮肤文件协议

1. **命名**：`theme-{skin-name}.css`，`{skin-name}` 为小写英文/数字/连字符（如 `theme-deep-blue.css`）。
2. **作用域**：token 定义在 `html[data-theme="{skin-name}"]` 选择器下（不是 `:root`），保证多皮肤可共存、运行时切换。

   ```css
   html[data-theme="deep-blue"] {
     --color-brand: #105cf6;
     --g-bg-page: #f2f6fb;
     /* 全部 token 清单见 src/assets/tokens/semantic-light.css */
   }
   ```
3. **注册**：在 `index.html` 的「自定义皮肤插槽」注释处追加一行：
   ```html
   <link rel="stylesheet" href="./src/assets/themes/theme-deep-blue.css">
   ```
   真实工程在 `main.js` 的皮肤插槽处追加对应 import。
4. **运行时切换**：`document.documentElement.setAttribute('data-theme', '{skin-name}')`。
5. **token 覆盖**：皮肤只需覆盖要改的 token，未覆盖的自动继承 `src/assets/tokens/` 的亮色默认值。深色皮肤记得覆盖 `--color-bg-*` 文本/背景组与 `--g-mix-base`（改向深色表面色）。

## 注意

- **不要在本目录定义 `--g-*` / `--color-*` 之外的新 token 体系**；页面局部变量用 `--page-*` 前缀。
- build.mjs 会校验：SFC `<style>` 中禁止定义 `:root`、`[data-theme]`、资产 token——它们只属于 token 层与皮肤文件。
