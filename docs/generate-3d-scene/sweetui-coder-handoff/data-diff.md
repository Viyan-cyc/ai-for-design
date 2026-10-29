# Data Diff Report

**Date**: 2026-10-28
**Source**: @hw-seq/sweet-ui-base 5.7.0 npm package

## Whitelist Extraction

### sweetui-exports.json — 505 entries

| Metric | Value |
|--------|-------|
| Total named exports | 505 |
| Extraction method | ESM index.mjs static analysis |

Key component exports verified: SweetButton, SweetDialog, SweetForm, SweetFormItem, SweetInput, SweetSelect, SweetOption, SweetTable, SweetTableColumn, SweetPagination, SweetEmpty, SweetIcon, SweetAlert, SweetMessage, SweetTooltip

Key API exports verified: i18n, setTheme, useLocale, setLocaleMessages, setSweetI18n

### sweetui-icons.json — 718 entries

| Metric | Value |
|--------|-------|
| Total icon CSS classes | 718 |
| Prefix pattern | sweetui-icon-{name}-{variant} |
| Variants | -l (line), -f (filled) |
| Extraction method | SweetIcon CSS class parsing |

Previously fabricated icons that do NOT exist:
- sweetui-icon-language-f — NO
- sweetui-icon-nightmode-f — NO
- sweetui-icon-daymode-f — NO

Replacements used: sweetui-icon-switch-target-cell-l (language), text-only labels (theme toggle)

### sweetui-tokens.json — 588 entries

| Metric | Value |
|--------|-------|
| Total tokens | 588 |
| Source files | var-ui-common.css + var-ui-uDesign2.2-light.css + var-ui-uDesign2.2-dark.css |
| Common-only (no light/dark variant) | 207 |
| Themed (light + dark pair) | 381 |
| Themed that also have common fallback | 100 |
| Extraction method | CSS --swt-* variable name extraction from theme-chalk/vars/ |

### token-catalog.md

Generated from tokens JSON. Contains:
- "常用选取" table with 12 common tokens (name, purpose, light value, dark value)
- "完整名称与值" table with all 588 tokens

## API Verification (Component Props/Events)

All acceptance-project component APIs verified against ESM source:

| Component | Key Props Verified | Key Events Verified | Match |
|-----------|-------------------|--------------------|----|
| SweetIcon | iconClass (as icon-class) | — | YES |
| SweetButton | size, loading, type, text | click | YES |
| SweetDialog | modelValue, title, draggable, closeOnClickModal, beforeClose | update:modelValue | YES |
| SweetForm | model, rules, labelWidth | — | YES |
| SweetFormItem | label, prop | — | YES |
| SweetInput | modelValue, placeholder, clearable, disabled | update:modelValue, keyup.enter | YES |
| SweetSelect | modelValue, placeholder, clearable | update:modelValue | YES |
| SweetOption | value (required), label | — | YES |
| SweetTable | data (via SweetVirtualTable) | — | YES |
| SweetTableColumn | prop, label, width, minWidth | — | YES |
| SweetPagination | currentPage, pageSize, total, layout | update:current-page, update:page-size, current-change, size-change | YES |
| SweetEmpty | description | — | YES |
| SweetAlert | type, title, closable | — | YES |
| SweetMessage | .success(), .error() (function API) | — | YES |
