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
| zh_CN ↔ en_US business i18n | **待浏览器验证** | t computed ref 从 sweetI18nRef 快照；JS 中已改用 t.value()，模板自动解包 |
| SweetUI 内置组件文案切换 | **不更新（已知限制）** | 组件通过 inject("sweetI18n") 取词，provide 是非响应式替换，已挂载组件不会受影响 |

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
- `i18n/index.js` 导出 `t = computed(() => sweetI18nRef.value || (key => key))`，其中 `sweetI18nRef` 是 `ref(null)`
- 每次 `setLanguage()` 回调中快照 `application.config.globalProperties.sweetI18n` 到 `sweetI18nRef`
- `globalProperties.sweetI18n` 是原生 `i18n()` 在每次调用时重新创建并赋值的翻译函数（`const { t: o } = nue(Mi(t)); t.config.globalProperties.sweetI18n = o`）
- 组件通过 `inject("sweetI18n")` 取词 — 37 个组件，216 处调用 — `provide("sweetI18n", o)` 同样是非响应式替换，已挂载组件不会获取新值

用法：模板 `t(key)` 自动解包；JS/computed `t.value(key)` 显式取值。

## Token 索引核对

| 项 | 状态 |
|----|------|
| 588 个 token 名称与 npm CSS --swt-* 变量名对齐 | 已核对（gen-tokens --extract --check 通过） |
| common/light/dark 分类与 CSS 源文件对应 | 已核对 |
| 轻深色值与最终浏览器加载 CSS 中的计算值 | **未验证**（仅核对 CSS 源文件中的声明值，未在浏览器中读取 getComputedStyle） |

## Remaining Issues

1. **浏览器验证 i18n 业务文案切换**：打开 index.gts.html，点击语言切换按钮，检查标题/按钮/表头/校验提示是否从中文变为英文再切回。内置组件文案（如分页的"共 X 条"、表单校验"此字段为必填项"）在已挂载组件上预期不会自动切换，这是 SweetUI 5.7.0 的限制而非本 skill 缺陷。
2. **CSS dark theme inconsistency**: `background-color:var(--swt-color-bg-primary)` group rule omits `body[theme="GTS UDesign（默认风格）-dark"]`; our theme.js compensates with inline style. SweetUI 5.7.0 CSS issue.

## Browser Verification Steps

1. 打开 `output/sweetui-acceptance/index.gts.html`
2. 确认页面正常显示（非白屏），图标可见
3. 点击语言切换按钮（zh_CN → en_US）
4. **业务文案预期更新**：标题 → "Device Management"，查询 → "Search"，重置 → "Reset"，表头 → "Device Name"/"Status"/"Actions"，校验提示 → "Device name is required"
5. **内置文案预期不更新**：分页区"共 X 条"等 SweetUI 内置文案不会变化（已知限制）
6. 切回 zh_CN 确认业务文案恢复中文
7. 切换深色/浅色确认背景色正常

## Changes from Initial Package State

1. **index.gts.html**: Moved all `<script>` tags from `<head>` to end of `<body>` (fixes `insertBefore` on null)
2. **theme.js**: Added `uDesign2.2-dark → GTS UDesign（默认风格）-dark` mapping + `document.body.style.backgroundColor` fix
3. **i18n/index.js**: Exported `t` computed ref + `sweetI18nRef` snapshot mechanism; removed `getCurrentInstance` import. Templates use `t(key)` (auto-unwrap), JS uses `t.value(key)`
4. **on-demand-toggle.md**: Updated i18n section to use `t` from i18n/index.js instead of `useLocale().t`; documented t/t.value usage and built-in component limitation
5. **runtime-setup.md**: Updated i18n verification wording from `useLocale().t` to `t` computed ref
6. **preview/src/README.md**: Updated i18n access method from `useLocale` to `t` from i18n/index.js
7. **code-rules.md**: Updated i18n rule from `useLocale().t` to `t` computed ref with auto-unwrap/`t.value()` usage note
8. **error-checklist.md**: Updated i18n error from `useLocale().t` to `t` computed ref; noted `useLocale().t` produces stale closure
9. **verify-build.mjs**: Updated theme test for GTS mapping + document mock + dark background assertion; updated i18n test to verify `t.value()` follows language switch
10. **fallback-node-manifest.json**: Restored original v24.16.0 with real SHA-256 hashes
11. **token-catalog.md**: Added --swt-color-bg-mask and --swt-filter-shadow-dark entries from actual CSS
12. **sweetui-exports.json**: Expanded from 139 to 505 entries (full ESM export list)
13. **sweetui-icons.json**: Reordered to match CSS source order; fixed cursor-pointer and check-box forced-color flags
14. **sweetui-tokens.json**: Added --swt-color-bg-mask and --swt-filter-shadow-dark tokens
15. **Acceptance project components**: All 4 components use `t` from i18n/index.js; JS contexts use `t.value()`, templates use `t()`
