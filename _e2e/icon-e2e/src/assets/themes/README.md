# 换肤插槽（Skin Slot）

本目录是换肤体系的插槽：**每个皮肤一个 less 文件**，默认仅内置 `default.less`。接入自有换肤样式时，把皮肤文件放进本目录即可，无需改动 base.less / bridge.less（预览下本目录全部 .less 自动发现加载，新皮肤放入即生效）。

## 皮肤文件协议

1. **命名**：`{skin-name}.less`，`{skin-name}` 为小写英文/数字/连字符（如 `dark.less`、`blue.less`）。
2. **作用域**：所有 token 定义在 `html[data-theme="{skin-name}"]` 选择器下（不是 `:root`），保证多皮肤可共存、运行时切换。

   ```less
   html[data-theme="dark"] {
     --color-brand: #4d9eff;
     --color-bg-1: #121212;
     /* ...全部 token 见 references/design-language.md */
   }
   ```
3. **注册**：
   - **预览工程**：无需注册——`index.gts.html` 在 boot 阶段自动发现并加载 `themes/` 下全部 `.less`；
   - **真实工程**：在工程入口（见 `main.js` 换肤插槽注释处）追加一行：
     ```js
     import './assets/themes/dark.less'
     ```
4. **切换**：运行时一行代码换肤：
   ```js
   document.documentElement.setAttribute("data-theme", "dark");
   ```
   页面 `<html>` 标签上的 `data-theme` 即当前皮肤。

## Token 真值源

token 全表（颜色 / 间距 / 圆角 / 边框 / 字体 / 投影）以 **design-language（设计语言包）** 为唯一标准，见 skill `references/design-language.md`。皮肤必须完整提供页面与桥接层消费的全部 token。

## 深色皮肤注意

桥接层（bridge.less）用 `color-mix` 把品牌色与 `--ux-mix-base`（默认白色）混合生成 Element Plus 的 light-N 色阶。**深色皮肤必须**把 `--ux-mix-base` 覆盖为深色表面色（如 `#1d1d1d`），否则按钮 hover/浅色阶会发白。

## 已有皮肤变量名不一致怎么办

若自有换肤样式已有一套变量（如 `--brand-color` 等），两种接入方式任选：

- **改皮肤（推荐）**：在皮肤文件里把自有变量赋给标准 token（`--color-brand: var(--brand-color);`），保持桥接层不动；
- **改桥接**：把 `bridge.less` 右侧的 `var(--color-...)` 换成自有变量名（桥接层随之脱离 FIXED 约定，需自行维护）。
