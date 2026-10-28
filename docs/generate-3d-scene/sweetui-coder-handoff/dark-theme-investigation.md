# SweetUI 深色主题调查报告：uDesign2.2-dark 与 GTS UDesign（默认风格）-dark

**日期**: 2026-10-28
**版本**: @hw-seq/sweet-ui-base 5.7.0
**CSS 文件**: dist/sweet-ui-base.css

---

## 一、现状事实

### 1. CSS 中两个选择器的存在情况

| 选择器 | 出现次数 | 是否有独立 token 定义块 | 是否在 background-color 分组中 |
|--------|---------|----------------------|-------------------------------|
| `body[theme="uDesign2.2-dark"]` | 1 | **否** | **是** |
| `body[theme="GTS UDesign（默认风格）-dark"]` | 1 | **是** (382 tokens) | **否** |

### 2. background-color 分组规则

```css
body[theme=light],
body[theme=black],
body[theme=dark],
body[theme="hDesign1.1-light"],
body[theme="hDesign1.1-dark"],
body[theme="uDesign2.2-light"],
body[theme="uDesign2.2-dark"],
body[theme="hDesign3.1"] {
  background-color: var(--swt-color-bg-primary)
}
```

`body[theme="GTS UDesign（默认风格）-dark"]` **不在** 这个分组中。

### 3. 各选择器的 token 定义

- `body[theme="uDesign2.2-light"]` — 302 个 token，gray1=#ffffff，包含 bg-primary
- `body[theme="GTS UDesign（默认风格）-dark"]` — 382 个 token，gray1=#1e1e1e，包含 bg-primary，**不含** background-color 属性
- `body[theme="uDesign2.2-dark"]` — 0 个 token（无独立定义块）

### 4. 源文件 vars 对应关系

| 文件 | 内部 CSS 选择器 | token 数 |
|------|-----------------|----------|
| var-ui-uDesign2.2-light.css | `body[theme='uDesign2.2-light']` | 302 |
| var-ui-uDesign2.2-dark.css | `body[theme='GTS UDesign（默认风格）-dark']` | 359 |

文件名与选择器名不一致是 SweetUI 包的既定事实。

### 5. 原生 setTheme API

```js
(e = "light", t) => {
  t && (t.config.globalProperties.$theme = e)
  document.body.setAttribute("theme", e)
}
```

直接将传入字符串设置到 body theme 属性。

---

## 二、遇到的问题及解决

### 问题一：白屏 — insertBefore on null

**根因**：UMD `<script>` 在 `<head>` 中加载时立即执行 `document.body.insertBefore(...)` 测量滚动条宽度，但 `document.body` 为 null。

**解决**：将所有 `<script>` 移到 `<body>` 末尾。

### 问题二：深色切换背景色不变

**根因**：CSS 内部不一致：
- `uDesign2.2-dark` 只有 background-color 分组规则，没有 token 块
- `GTS UDesign（默认风格）-dark` 有 token 块，但不被 background-color 分组规则覆盖
- 两者各管一半，分开用任何一个都不完整

**最终解决**：
1. `nativeSetTheme` 传 `GTS UDesign（默认风格）-dark` → 激活 382 个深色 token
2. 手动设置 `document.body.style.backgroundColor = 'var(--swt-color-bg-primary)'` → 补上缺失的 body 背景色
3. 切回浅色时清除 inline style

---

## 三、结论

必须组合使用两个选择器的效果才能实现完整的深色切换。这是 SweetUI 5.7.0 CSS 的内部不一致问题。
