# Acceptance Report

**Date**: 2026-10-29
**Skill**: gts-sweetui-coder (located at gts-sweetui-coder1)
**Package**: @hw-seq/sweet-ui-base 5.7.0

## Actual Versions

| Component | Version | Source |
|-----------|---------|--------|
| SweetUI | 5.7.0 | npm @hw-seq/sweet-ui-base |
| Vue (npm/Vite) | 3.5.29 | npm dependency of sweet-ui-base |
| Vue (preview HTML) | 3.5.25 | bundled vue.global.prod.js from sweet-ui-base |
| dayjs | 1.11.23 | npm dependency of sweet-ui-base |
| Node | v24.18.0 | system |
| vue3-sfc-loader | 0.9.5 | copied from old skill |
| Vite (validation) | 6.4.3 | npm devDependency |

## Execution Commands & Results

### Environment & Data Extraction

```
node scripts/ensure-env.mjs → OK (Node v24.18.0, compiler 3.5.29)
node scripts/gen-whitelists.mjs --package ... → OK (505 exports, 718 icons)
node scripts/gen-tokens.mjs --extract --package ... → OK (588 tokens)
```

### Resource Preparation

```
node scripts/prepare-runtime.mjs --package ... --from ... → OK (4 files copied)
node scripts/prepare-runtime.mjs --check → OK (RESOURCE_BYTES: identical to source)
node scripts/check-runtime.mjs → OK (files, XSS/lodash aliases and XSS smoke)
```

### Data Verification

```
node scripts/gen-whitelists.mjs --check → OK (505 exports, 718 icons)
node scripts/gen-tokens.mjs --check → OK (588 tokens)
node scripts/verify-build.mjs → OK (27/27 tests pass)
```

### Acceptance Build

```
node scripts/init.mjs 'D:\project\gts\ai-for-design\output' 'sweetui-acceptance' → OK
node scripts/cleanup-starter.mjs --dir ... → OK (2 cleaned, 0 warned)
node scripts/build.mjs --dir ... → OK (1 page, index.gts.html generated)
```

### Vite Real-Project Validation

```
node_modules/vite/bin/vite.js build → OK (1868 modules, 7.74s)
```

## Verification Results

| Check | Result | Notes |
|-------|--------|-------|
| No white screen (index.gts.html) | **Passed** | User confirmed; scripts in body end |
| Resource loading (no 404) | **Passed** | User confirmed; all 7 library files load |
| Font icons render | **Passed** | User confirmed |
| Query / Reset / Pagination | **Passed** | User confirmed |
| Empty state | **Passed** | User confirmed |
| Error state | **Passed** | User confirmed |
| Form dialog: validation/cancel/save | **Passed** | User confirmed |
| Light ↔ Dark toggle | **Passed** | User confirmed; GTS selector mapping + backgroundColor fix |
| Vite production build | **Passed** | 1868 modules, CSS 951KB, JS 2759KB |
| Unknown token/icon/component rejected | **Passed** | verify-build tests confirm rejection at build time |
| Build refuses missing resources | **Passed** | verify-build test confirms build exits with error when runtime files removed |
| Component APIs match npm reality | **Passed** | All props/events verified from ESM source |
| zh_CN ↔ en_US business i18n | **待用户验证** | t = computed(() => currentI18nFn.value); delegatingI18n 稳定委托入口；JS 中已改用 t.value() |
| SweetUI 内置组件文案切换 | **待用户验证** | in-place mutation + delegatingI18n：reviveOldMessages 保持旧 reactive 对象 + 始终 provide delegatingI18n；单元测试验证旧/新消费者响应性，浏览器待确认 |

## i18n 修复依据（npm 源码确认）

npm ESM sweet-ui-base.js 中 `Mi`（即 useLocale）实现：
```js
Mi = (e) => {
  let t = e;
  return t || (t = It().appContext),
  nue(V(() => t.config.globalProperties.sweetI18nLocaleMessages || {}));
}
```
- `nue` 返回 `{ t: tue(e) }`，其中 `tue(e) = (key, args) => eue(key, args, T(e))`，`T` 即 `unref`
- `V(() => t.config.globalProperties.sweetI18nLocaleMessages || {})` 创建 computed，依赖 `globalProperties.sweetI18nLocaleMessages`
- 原生 `i18n()`（即 `rue`）执行 `t.config.globalProperties.sweetI18nLocaleMessages = yn({})` — 整体替换属性值
- `globalProperties` 是普通对象，属性替换不触发 computed 重算 → `useLocale().t` 返回 stale 闭包

修复：
- `i18n/index.js` 导出 `t = computed(() => currentI18nFn.value)`，其中 `currentI18nFn = shallowRef(key => key)`
- **delegatingI18n** 是稳定的委托入口函数：`delegatingI18n(key, args) = currentI18nFn.value(key, args)`。始终作为 `globalProperties.sweetI18n` 和 `app.provide('sweetI18n', ...)` 的值，无论首次安装还是后续切换
- 每次 `setLanguage` 完成后 `currentI18nFn.value = nativeT`（shallowRef 检测到新函数对象 → 触发 computed 重算）→ 所有通过 delegatingI18n 委托的消费者（旧/新）自动获得最新翻译函数
- 首次 `installI18n` 调用原生 i18n() 后，`gp.sweetI18n = delegatingI18n` + `app.provide('sweetI18n', delegatingI18n)`；后续 `setLanguage` 同样，不再切换为 wrappedT 闭包
- **in-place mutation**：`reviveOldMessages(oldMsgs, newMsgs)` 先 delete 旧对象所有键，再从新对象复制所有键值，`gp.sweetI18nLocaleMessages = oldMsgs` 还原旧引用。Vue 3 reactive Proxy 追踪 deleteProperty 和属性赋值 → 37 个组件 216 处 `inject("sweetI18n")` 已有 computed 自动重算 → 内置文案同步更新
- `initialized` 布尔标志替代 `currentI18nFn.value !== (key => key)` 比较（后者因每次创建新箭头函数而恒为真）；同语言环境 early-exit 正确跳过原生 i18n 调用

用法：模板 `t(key)` 自动解包；JS/computed `t.value(key)` 显式取值。

## Token 索引核对

| 项 | 状态 |
|----|------|
| 588 个 token 名称与 npm CSS --swt-* 变量名对齐 | 已核对（gen-tokens --extract --check 通过） |
| common/light/dark 分类与 CSS 源文件对应 | 已核对 |
| 轻深色值与最终浏览器加载 CSS 中的计算值 | **未验证**（仅核对 CSS 源文件中的声明值，未在浏览器中读取 getComputedStyle） |

## Remaining Issues

1. **浏览器验证 i18n 切换（业务 + 内置）**：需验证完整生命周期：(a) 初始中文切英文 → 业务文案和内置文案均更新；(b) 英文状态下打开新弹窗/组件 → 新挂载组件文案为英文；(c) 再切中文再切英文 → 原有组件和新挂载组件文案均跟随切换；(d) 切换过程中输入内容、查询条件、分页状态保留。单元测试已验证旧/新消费者响应性和同语言环境 early-exit，但模拟测试不替代真实 SweetUI 浏览器验证。
2. **CSS dark theme inconsistency**: `background-color:var(--swt-color-bg-primary)` group rule omits `body[theme="GTS UDesign（默认风格）-dark"]`; our theme.js compensates with inline style. SweetUI 5.7.0 CSS issue.

## Browser Verification Steps

1. 打开 `output/sweetui-acceptance/index.gts.html`
2. 确认页面正常显示（非白屏），图标可见
3. **初始中文 → 英文**：点击语言切换按钮（zh_CN → en_US）
   - 业务文案：标题 → "Device Management"，查询 → "Search"，重置 → "Reset"，表头 → "Device Name"/"Status"/"Actions"
   - 内置文案：分页区"共 X 条"等 SweetUI 内置文案应同步变化
4. **英文状态下打开新组件**：点击新增/编辑按钮打开 FormDialog
   - 弹窗内校验提示应为英文（如 "Device name is required"）
5. **关闭弹窗后再切中文**：确认表格区、分页区、业务文案恢复中文
6. **再切英文**：确认所有文案再次变英文，新弹窗内置文案也为英文
7. **状态保留**：确认切换前后当前页码、搜索条件不丢失
8. 切换深色/浅色确认背景色正常

## Changes from Initial Package State

1. **index.gts.html**: Moved all `<script>` tags from `<head>` to end of `<body>` (fixes `insertBefore` on null)
2. **theme.js**: Added `uDesign2.2-dark → GTS UDesign（默认风格）-dark` mapping + `document.body.style.backgroundColor` fix
3. **i18n/index.js**: 稳定委托入口 + in-place mutation：shallowRef(currentI18nFn) + delegatingI18n 始终作为 provide/globalProperties 入口（不切换为 wrappedT）+ reviveOldMessages 保持旧 reactive 对象 + initialized 布尔标志替代破比较；每次 setLanguage 更新 currentI18nFn.value = nativeT（shallowRef 检测新对象），delegatingI18n 自动委托到最新 T
4. **on-demand-toggle.md**: Updated i18n section to use `t` from i18n/index.js; documented in-place mutation mechanism for built-in component text updates
5. **runtime-setup.md**: Updated i18n verification wording from `useLocale().t` to `t` computed ref
6. **preview/src/README.md**: Updated i18n access method from `useLocale` to `t` from i18n/index.js
7. **code-rules.md**: Updated i18n rule from `useLocale().t` to `t` computed ref with auto-unwrap/`t.value()` usage note
8. **error-checklist.md**: Updated i18n error from `useLocale().t` to `t` computed ref; noted `useLocale().t` produces stale closure
9. **verify-build.mjs**: Updated theme test for GTS mapping + document mock + dark background assertion; i18n lifecycle test: old consumer computed auto-update, new consumer after switch via delegatingI18n, same-locale early exit (initialized flag), multi-cycle stability, same reactive object reference preserved
10. **fallback-node-manifest.json**: Restored original v24.16.0 with real SHA-256 hashes
11. **token-catalog.md**: Added --swt-color-bg-mask and --swt-filter-shadow-dark entries from actual CSS
12. **sweetui-exports.json**: Expanded from 139 to 505 entries (full ESM export list)
13. **sweetui-icons.json**: Reordered to match CSS source order; fixed cursor-pointer and check-box forced-color flags
14. **sweetui-tokens.json**: Added --swt-color-bg-mask and --swt-filter-shadow-dark tokens
15. **Acceptance project components**: All 4 components use `t` from i18n/index.js; JS contexts use `t.value()`, templates use `t()`
