# sweetui-bridge.md — 桥接层设计与内网核验程序

> 受众：内网 LLM（执行 HANDOFF）与本地维护者。bridge.less 的结构已定（见
> `scripts/preview/src/assets/themes/bridge.less`），本文说明映射原理与
> 内网侧「提取槽位全表 → 逐行接线 → 验证」的操作程序。

## 1. 映射原理

```
design-language（皮肤 token，页面唯一词汇）
        │  body[theme="<皮肤名>"] 作用域（SweetUI 原生主题机制）
        ▼
bridge.less（FIXED 结构，双体系输出）
        ├── --el-*   358 槽位（EP 继承，useNamespace 生成，受 namespace 影响）
        └── --swt-*  646 槽位（SweetUI 自有，纯 CSS，不受 namespace 影响）
        ▼
SweetUI 组件（CSS 消费方）
```

- 页面代码只写 design-language 名（`--color-brand`），**不写** `--el-*`/`--swt-*`（build 拒绝）。
- bridge 输出的双体系变量来自皮肤 token 直引或 `color-mix` 派生（light-N 色阶），
  派生底色 `--ux-mix-base` 在 base.less 定义（亮色 `#ffffff`，深色皮肤覆盖为深色表面色）。
- 作用域是 `body[theme="default"]` 而非 `:root`：特异性高于 `sweet-ui-base.css` `:root`
  默认值，切换 `setTheme(name)` → `body[theme=name]` 即整体接管。探针 3.5 证实
  主题切换是**整体替换**（每个主题文件定义完整变量集）。

## 2. 主题三规则（落库与接线的前提）

1. **皮肤名 = setTheme 参数 = `body[theme]` 值**，三者统一。皮肤名 `default`/`dark`
   不是 SweetUI 自带主题值（light/dark/black/uDesign2.2-*/hDesign*），无需迎合——
   `setTheme` 对任意字符串只是 `body.setAttribute("theme", ...)`。
2. **禁加载 `theme-chalk/vars/var-ui-*.css`**。任何主题变体与 bridge 同在
   `body[theme=…]` 作用域定义 `--el-*`/`--swt-*`，同时加载会抢级联（后加载者赢）。
   `:root` 默认值由 `sweet-ui-base.css` 提供，无需自带主题文件补位。
3. **`public/library/` 只落 `sweet-ui-base.css`**，不放 `vars/` 目录。验证方法：
   删掉 vars 引用后组件仍着色、`setTheme("dark")` 后 bridge 皮肤生效。

## 3. 槽位核验程序（内网执行）

### 3.1 提取全表

```bash
PKG=<解包路径>/@hw-seq/sweet-ui-base

# --el-* 槽位（实跑 358 个）
grep -ohE '\-\-el-[a-z0-9-]+' $PKG/theme-chalk/*.css | sort -u > el-slots.txt

# --swt-* 槽位（实跑 646 个）
grep -ohE '\-\-swt-[a-z0-9-]+' $PKG/theme-chalk/*.css | sort -u > swt-slots.txt
```

### 3.2 语义对齐

对每类槽位建立「design-language token → 槽位」映射，按语义组对齐：

| design-language | --el-*（EP 同名可直引） | --swt-*（以提取结果为准） |
|---|---|---|
| `--color-brand` | `--el-color-primary` | `--swt-color-primary`（探针证实，非材料的 brand-normal） |
| `--color-text-primary` | `--el-text-color-primary` | `--swt-text-color-primary` |
| `--color-bg-4` | `--el-bg-color` | `--swt-bg-color` |
| `--color-border` | `--el-border-color` | `--swt-border-color` |
| `--color-error` | `--el-color-danger` / `--el-color-error` | 提取结果中对应的 error/danger 槽位 |

- `--el-*` 侧与 EP 2.13.5 高度同源（fork），EP bridge 的映射表可直接平移；
- `--swt-*` 侧**以 grep 提取结果为唯一事实**，材料的 `--swt-color-brand-normal`
  类命名不真实，禁止按材料命名接线。

### 3.3 接线

把映射逐行写入 `bridge.less` 的 `body[theme="default"]` 块：

- `--el-*` 侧已有完整骨架（探针证实与 EP 同构），核对槽位名存在即可；
- `--swt-*` 侧当前是占位段（文件内有「接线区结束标记」注释），补全后删除标记注释；
- 派生规则沿用 EP bridge：light-N 用 `color-mix(in srgb, <token> N%, var(--ux-mix-base))`；
  `--color-*-subtle` 不进组件前景链路（中等色面，接了字底融合）。

### 3.4 验证

1. `setTheme("default")` 下：按钮主色 = `--color-brand`、表格边框 = `--color-border`、
   分页文案 = `--color-text-primary`（DevTools computed 抽查 ≥10 个组件）；
2. `setTheme("dark")` 下：同批抽查项跟随 dark 皮肤，无发白色阶；
3. 控制台无「未定义 CSS 变量」告警（Chrome DevTools → Issues）；
4. 硬编码豁免确认：探针 3.4 证实仅 11 处硬编码（`.sweet-map/.sweet-cmp/.sweet-custom/
   .sweet-side/.sweet-genex-*`），不在常规页面组件路径上，无需 override；如业务命中这批
   类名，单独加 override 层再议。

## 4. 变更纪律

- bridge.less 是 FIXED 结构文件：改映射值 = 改「右侧 `var(--color-*)` 引用或 color-mix
  参数」，不改选择器结构、不加皮肤特有规则（皮肤差异全部在皮肤文件里）；
- design-language token 改名/增删 → 先改设计文档 → 重跑 `gen-tokens.mjs` → 核对
  bridge 引用的 token 仍存在（build 门禁会抓未定义引用）；
- 槽位接线值变更后必须跑 §3.4 四步验证，任何一步不过不算接线完成。
