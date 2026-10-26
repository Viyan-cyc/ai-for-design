# SweetUI 原生 token 目录

> 从目标原生声明生成；已有准确名称直接使用，其他用 query-tokens.mjs 批量查询，不默认通读。值保留原始表达式；— 表示未提取到无条件全局值，不代表可用默认值。

主题：uDesign2.2-light / uDesign2.2-dark。此目录用于选名和核值，不作为额外CSS皮肤。

## 分类索引

| 分类 | 数量 |
| --- | --- |
| 背景 | 21 |
| 原生基础变量 | 35 |
| 边框/分割线 | 11 |
| 圆角 | 9 |
| 阴影 | 20 |
| 强调/交互 | 13 |
| 原生颜色 | 299 |
| 品牌 | 10 |
| 图表配色 | 22 |
| 状态/功能色 | 63 |
| 透明度 | 49 |
| 文字 | 4 |
| 字体/字号/行高 | 41 |
| 间距 | 14 |

## 背景

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--swt-bg-color-overlay` | bg-color-overlay | var(--swt-color-bg-primary) | var(--swt-color-bg-primary) |
| `--swt-button-loading-bg-color` | button-loading-bg-color | var(--swt-color-accent-normal-opacity20) | var(--swt-color-accent-normal-opacity20) |
| `--swt-checked-disabled-bg-color` | checked-disabled-bg-color | #366bfc66 | #366bfc66 |
| `--swt-color-bg-brand-round-button-hover` | color-bg-brand-round-button-hover | var(--swt-color-brand-normal-opacity20) | var(--swt-color-brand-normal-opacity40) |
| `--swt-color-bg-disabled` | color-bg-disabled | var(--swt-color-gray3) | var(--swt-color-gray3) |
| `--swt-color-bg-gray-round-button-hover` | color-bg-gray-round-button-hover | var(--swt-color-gray11-opacity20) | var(--swt-color-gray11-opacity40) |
| `--swt-color-bg-mask` | color-bg-mask | var(--swt-color-gray11-opacity30) | var(--swt-color-gray2-opacity70) |
| `--swt-color-bg-primary` | 容器背景 | var(--swt-color-gray1) | var(--swt-color-gray1) |
| `--swt-color-bg-primary-button-hover` | color-bg-primary-button-hover | var(--swt-color-accent-normal-opacity20) | var(--swt-color-accent-normal-opacity40) |
| `--swt-color-bg-secondary` | 页面背景 | var(--swt-color-gray2) | var(--swt-color-gray2) |
| `--swt-color-bg-selected` | color-bg-selected | var(--swt-color-gray3) | var(--swt-color-gray3) |
| `--swt-color-bg-text-button-active` | color-bg-text-button-active | var(--swt-color-overlay-gray1-and-accent-normal-opacity20) | var(--swt-color-overlay-gray1-and-accent-normal-opacity10) |
| `--swt-color-bg-text-button-hover` | color-bg-text-button-hover | var(--swt-color-overlay-gray1-and-accent-normal-opacity10) | var(--swt-color-overlay-gray1-and-accent-normal-opacity20) |
| `--swt-color-bg-urgent-button-hover` | color-bg-urgent-button-hover | var(--swt-color-function-urgent-normal-opacity20) | var(--swt-color-function-urgent-normal-opacity40) |
| `--swt-color-bg-urgent-text-button-active` | color-bg-urgent-text-button-active | var(--swt-color-overlay-gray1-and-urgent-normal-opacity20) | var(--swt-color-overlay-gray1-and-urgent-normal-opacity10) |
| `--swt-color-bg-urgent-text-button-hover` | color-bg-urgent-text-button-hover | var(--swt-color-overlay-gray1-and-urgent-normal-opacity10) | var(--swt-color-overlay-gray1-and-urgent-normal-opacity20) |
| `--swt-disabled-bg-color` | disabled-bg-color | var(--swt-fill-color-light) | var(--swt-fill-color-light) |
| `--swt-table-current-row-bg-color` | table-current-row-bg-color | #d7e1fe | #1f3781 |
| `--swt-table-row-hover-bg-color` | table-row-hover-bg-color | var(--swt-color-gray3) | var(--swt-color-gray3) |
| `--swt-top-menu-bg-color` | top-menu-bg-color | rgba(166, 166, 166, 0.2) | rgba(78, 120, 177, 0.2) |
| `--swt-transfer-disable-bg-color` | transfer-disable-bg-color | rgba(198, 198, 198, 0.2) | rgba(74, 99, 136, 0.2) |

## 原生基础变量

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--swt-border` | border | var(--swt-border-width) var(--swt-border-style) var(--swt-border-color) | var(--swt-border-width) var(--swt-border-style) var(--swt-border-color) |
| `--swt-border-style` | border-style | solid | solid |
| `--swt-border-style-dashed` | border-style-dashed | dashed | dashed |
| `--swt-border-style-dotted` | border-style-dotted | dotted | dotted |
| `--swt-border-style-solid` | border-style-solid | solid | solid |
| `--swt-border-width` | border-width | 1px | 1px |
| `--swt-border-width-independent` | border-width-independent | 0px | 1px |
| `--swt-border-width-medium` | border-width-medium | 2px | 2px |
| `--swt-border-width-none` | border-width-none | 0px | 0px |
| `--swt-border-width-normal` | border-width-normal | 1px | 1px |
| `--swt-component-size` | component-size | 32px | 32px |
| `--swt-component-size-large` | component-size-large | 40px | 40px |
| `--swt-component-size-small` | component-size-small | 24px | 24px |
| `--swt-cursor-default` | cursor-default | default | default |
| `--swt-cursor-not-allowed` | cursor-not-allowed | not-allowed | not-allowed |
| `--swt-cursor-pointer` | cursor-pointer | pointer | pointer |
| `--swt-cursor-text` | cursor-text | text | text |
| `--swt-icon-style` | icon-style | line | face |
| `--swt-illustration-style` | illustration-style | light | dark |
| `--swt-index-normal` | index-normal | 1 | 1 |
| `--swt-index-popper` | index-popper | 2000 | 2000 |
| `--swt-index-top` | index-top | 1000 | 1000 |
| `--swt-table-hover-td` | table-hover-td | — | #0c2d44 |
| `--swt-table-striped` | table-striped | var(--swt-table-th) | var(--swt-table-th) |
| `--swt-table-th` | table-th | var(--swt-color-gray2) | var(--swt-color-gray2) |
| `--swt-tabs-item-bg` | tabs-item-bg | rgba(0, 0, 0, 0.05) | rgba(255, 255, 255, 0.05) |
| `--swt-transition-all` | transition-all | all var(--swt-transition-duration) var(--swt-transition-function-ease-in-out-bezier) | all var(--swt-transition-duration) var(--swt-transition-function-ease-in-out-bezier) |
| `--swt-transition-border` | transition-border | border-color var(--swt-transition-duration-fast) var(--swt-transition-function-ease-in-out-bezier) | border-color var(--swt-transition-duration-fast) var(--swt-transition-function-ease-in-out-bezier) |
| `--swt-transition-duration` | transition-duration | 0.3s | 0.3s |
| `--swt-transition-duration-fast` | transition-duration-fast | 0.2s | 0.2s |
| `--swt-transition-fade` | transition-fade | opacity var(--swt-transition-duration) var(--swt-transition-function-fast-bezier) | opacity var(--swt-transition-duration) var(--swt-transition-function-fast-bezier) |
| `--swt-transition-fade-linear` | transition-fade-linear | opacity var(--swt-transition-duration-fast) linear | opacity var(--swt-transition-duration-fast) linear |
| `--swt-transition-function-ease-in-out-bezier` | transition-function-ease-in-out-bezier | cubic-bezier(0.645, 0.045, 0.355, 1) | cubic-bezier(0.645, 0.045, 0.355, 1) |
| `--swt-transition-function-fast-bezier` | transition-function-fast-bezier | cubic-bezier(0.23, 1, 0.32, 1) | cubic-bezier(0.23, 1, 0.32, 1) |
| `--swt-transition-md-fade` | transition-md-fade | transform var(--swt-transition-duration) var(--swt-transition-function-fast-bezier),opacity var(--swt-transition-duration) var(--swt-transition-function-fast-bezier) | transform var(--swt-transition-duration) var(--swt-transition-function-fast-bezier),opacity var(--swt-transition-duration) var(--swt-transition-function-fast-bezier) |

## 边框/分割线

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--swt-border-color` | border-color | var(--swt-color-gray5) | var(--swt-color-gray5) |
| `--swt-border-color-dark` | border-color-dark | #d4d7de | #d4d7de |
| `--swt-border-color-darker` | border-color-darker | #cdd0d6 | #cdd0d6 |
| `--swt-border-color-extra-light` | border-color-extra-light | #f2f6fc | #f2f6fc |
| `--swt-border-color-light` | border-color-light | var(--swt-color-gray3) | var(--swt-color-gray3) |
| `--swt-check-disabled-border-color` | check-disabled-border-color | var(--swt-color-gray5) | var(--swt-color-gray5) |
| `--swt-color-border` | 边框 | var(--swt-color-gray6) | var(--swt-color-gray6) |
| `--swt-color-border-disabled` | color-border-disabled | var(--swt-color-gray3) | var(--swt-color-gray3) |
| `--swt-color-border-hover` | color-border-hover | var(--swt-color-gray10) | var(--swt-color-gray10) |
| `--swt-color-dividing-line-primary` | color-dividing-line-primary | var(--swt-color-gray4) | var(--swt-color-gray4) |
| `--swt-color-dividing-line-secondary` | color-dividing-line-secondary | var(--swt-color-gray3) | var(--swt-color-gray3) |

## 圆角

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--swt-border-radius-circle` | border-radius-circle | 100% | 100% |
| `--swt-border-radius-round` | border-radius-round | 20px | 20px |
| `--swt-radius-size-big` | radius-size-big | 12px | 12px |
| `--swt-radius-size-big1` | radius-size-big1 | 16px | 16px |
| `--swt-radius-size-big2` | radius-size-big2 | 20px | 20px |
| `--swt-radius-size-infinity` | radius-size-infinity | 999px | 999px |
| `--swt-radius-size-medium` | radius-size-medium | 8px | 8px |
| `--swt-radius-size-normal` | radius-size-normal | 4px | 4px |
| `--swt-radius-size-small` | radius-size-small | 2px | 2px |

## 阴影

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--swt-box-shadow` | box-shadow | 0px 12px 32px 4px rgba(0, 0, 0, 0.04),0px 8px 20px rgba(0, 0, 0, 0.08) | 0px 12px 32px 4px rgba(0, 0, 0, 0.04),0px 8px 20px rgba(0, 0, 0, 0.08) |
| `--swt-box-shadow-dark` | box-shadow-dark | 0px 16px 48px 16px rgba(0, 0, 0, 0.08),0px 12px 32px rgba(0, 0, 0, 0.12),0px 8px 16px -8px rgba(0, 0, 0, 0.16) | 0px 16px 48px 16px rgba(0, 0, 0, 0.08),0px 12px 32px rgba(0, 0, 0, 0.12),0px 8px 16px -8px rgba(0, 0, 0, 0.16) |
| `--swt-box-shadow-light` | box-shadow-light | 0px 0px 12px rgba(0, 0, 0, 0.12) | 0px 0px 12px rgba(0, 0, 0, 0.12) |
| `--swt-box-shadow-lighter` | box-shadow-lighter | 0px 0px 6px rgba(0, 0, 0, 0.12) | 0px 0px 6px rgba(0, 0, 0, 0.12) |
| `--swt-color-shadow-opacity` | color-shadow-opacity | 0.2 | 0.8 |
| `--swt-filter-shadow-dark` | filter-shadow-dark | 0px 6px 8px rgba(0, 0, 0, 0.2) | 0px 6px 8px rgba(0, 0, 0, 0.2) |
| `--swt-filter-shadow-light` | filter-shadow-light | 0px 6px 8px rgba(0, 0, 0, 0.2) | 0px 6px 8px rgba(0, 0, 0, 0.2) |
| `--swt-shadow1` | shadow1 | 0px 1px 3px 0px rgba(0, 0, 0, 0.1) | 0px 1px 3px 0px rgba(0, 0, 0, 0.8) |
| `--swt-shadow2` | shadow2 | 0 6px 18px 0 rgba(0, 0, 0, 0.1) | 0 6px 18px 0 rgba(0, 0, 0, 0.8) |
| `--swt-shadow2-l` | shadow2-l | 1px 0px 6px 0px rgba(0, 0, 0, 0.1) | 1px 0px 6px 0px rgba(0, 0, 0, 0.8) |
| `--swt-shadow2-r` | shadow2-r | -1px 0px 6px 0px rgba(0, 0, 0, 0.1) | -1px 0px 6px 0px rgba(0, 0, 0, 0.8) |
| `--swt-shadow3` | shadow3 | 0px 4px 8px 0px rgba(0, 0, 0, 0.2) | 0px 4px 8px 0px rgba(0, 0, 0, 0.8) |
| `--swt-shadow4` | shadow4 | -6px 0 18px 0 rgba(0, 0, 0, 0.1) | -6px 0 18px 0 rgba(0, 0, 0, 0.8) |
| `--swt-shadow4-b` | shadow4-b | 0px -4px 12px 0px rgba(0, 0, 0, 0.1) | 0px -4px 12px 0px rgba(0, 0, 0, 0.8) |
| `--swt-shadow4-l` | shadow4-l | 6px 0px 18px 0px rgba(0, 0, 0, 0.1) | 6px 0px 18px 0px rgba(0, 0, 0, 0.8) |
| `--swt-shadow4-r` | shadow4-r | -6px 0px 18px 0px rgba(0, 0, 0, 0.1) | -6px 0px 18px 0px rgba(0, 0, 0, 0.8) |
| `--swt-shadow4-t` | shadow4-t | 0px 4px 12px 0px rgba(0, 0, 0, 0.1) | 0px 4px 12px 0px rgba(0, 0, 0, 0.8) |
| `--swt-shadow5` | shadow5 | 0px 6px 20px 0px rgba(0, 0, 0, 0.1) | 0px 6px 20px 0px rgba(0, 0, 0, 0.8) |
| `--swt-shadow6` | shadow6 | 0px 20px 32px 0px rgba(0, 0, 0, 0.1) | 0px 20px 32px 0px rgba(0, 0, 0, 0.8) |
| `--swt-transition-box-shadow` | transition-box-shadow | box-shadow var(--swt-transition-duration-fast) var(--swt-transition-function-ease-in-out-bezier) | box-shadow var(--swt-transition-duration-fast) var(--swt-transition-function-ease-in-out-bezier) |

## 强调/交互

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--swt-color-accent-active` | color-accent-active | #004794 | #0070e1 |
| `--swt-color-accent-bg-selected` | color-accent-bg-selected | var(--swt-color-accent-normal-opacity20) | var(--swt-color-accent-normal-opacity20) |
| `--swt-color-accent-disabled` | color-accent-disabled | #0067d166 | #0073e866 |
| `--swt-color-accent-focus` | color-accent-focus | #0067d1 | #0073e8 |
| `--swt-color-accent-hover` | color-accent-hover | #0067d1 | #0073e8 |
| `--swt-color-accent-normal` | 强调色 | #0067d1 | #0073e8 |
| `--swt-color-accent-normal-opacity20` | color-accent-normal-opacity20 | #0067d133 | #0073e833 |
| `--swt-color-accent-normal-opacity40` | color-accent-normal-opacity40 | #0067d166 | #0073e866 |
| `--swt-color-accent-text-active` | color-accent-text-active | #004794 | #6c9cff |
| `--swt-color-accent-text-disabled` | color-accent-text-disabled | #0060c366 | #7ca4ff66 |
| `--swt-color-accent-text-focus` | color-accent-text-focus | #0060c3 | #7ca4ff |
| `--swt-color-accent-text-hover` | color-accent-text-hover | #0069d6 | #b1c5ff |
| `--swt-color-accent-text-normal` | color-accent-text-normal | #0060c3 | #7ca4ff |

## 原生颜色

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--swt-color-ancilary-blue1` | color-ancilary-blue1 | #f3f5ff | #f3f5ff |
| `--swt-color-ancilary-blue10` | color-ancilary-blue10 | #001951 | #001951 |
| `--swt-color-ancilary-blue2` | color-ancilary-blue2 | #e5e8ff | #e5e8ff |
| `--swt-color-ancilary-blue3` | color-ancilary-blue3 | #b9c3ff | #b9c3ff |
| `--swt-color-ancilary-blue4` | color-ancilary-blue4 | #8da0ff | #8da0ff |
| `--swt-color-ancilary-blue5` | color-ancilary-blue5 | #587dff | #587dff |
| `--swt-color-ancilary-blue6` | color-ancilary-blue6 | #476eec | #476eec |
| `--swt-color-ancilary-blue7` | color-ancilary-blue7 | #3b5ac2 | #3b5ac2 |
| `--swt-color-ancilary-blue8` | color-ancilary-blue8 | #274299 | #274299 |
| `--swt-color-ancilary-blue9` | color-ancilary-blue9 | #192a62 | #192a62 |
| `--swt-color-ancilary-cyan1` | color-ancilary-cyan1 | #d8fcfe | #d8fcfe |
| `--swt-color-ancilary-cyan10` | color-ancilary-cyan10 | #002324 | #002324 |
| `--swt-color-ancilary-cyan2` | color-ancilary-cyan2 | #b9f4f6 | #b9f4f6 |
| `--swt-color-ancilary-cyan3` | color-ancilary-cyan3 | #80d4d7 | #80d4d7 |
| `--swt-color-ancilary-cyan4` | color-ancilary-cyan4 | #4db5b9 | #4db5b9 |
| `--swt-color-ancilary-cyan5` | color-ancilary-cyan5 | #349396 | #349396 |
| `--swt-color-ancilary-cyan6` | color-ancilary-cyan6 | #2a8386 | #2a8386 |
| `--swt-color-ancilary-cyan7` | color-ancilary-cyan7 | #226c6e | #226c6e |
| `--swt-color-ancilary-cyan8` | color-ancilary-cyan8 | #155153 | #155153 |
| `--swt-color-ancilary-cyan9` | color-ancilary-cyan9 | #0e3335 | #0e3335 |
| `--swt-color-ancilary-fuchsia1` | color-ancilary-fuchsia1 | #fff1fd | #fff1fd |
| `--swt-color-ancilary-fuchsia10` | color-ancilary-fuchsia10 | #3e0038 | #3e0038 |
| `--swt-color-ancilary-fuchsia2` | color-ancilary-fuchsia2 | #ffe0fa | #ffe0fa |
| `--swt-color-ancilary-fuchsia3` | color-ancilary-fuchsia3 | #ffaaf3 | #ffaaf3 |
| `--swt-color-ancilary-fuchsia4` | color-ancilary-fuchsia4 | #fc70eb | #fc70eb |
| `--swt-color-ancilary-fuchsia5` | color-ancilary-fuchsia5 | #d94ac9 | #d94ac9 |
| `--swt-color-ancilary-fuchsia6` | color-ancilary-fuchsia6 | #c43db5 | #c43db5 |
| `--swt-color-ancilary-fuchsia7` | color-ancilary-fuchsia7 | #a33197 | #a33197 |
| `--swt-color-ancilary-fuchsia8` | color-ancilary-fuchsia8 | #7e2073 | #7e2073 |
| `--swt-color-ancilary-fuchsia9` | color-ancilary-fuchsia9 | #50144a | #50144a |
| `--swt-color-ancilary-green1` | color-ancilary-green1 | #dffde5 | #dffde5 |
| `--swt-color-ancilary-green10` | color-ancilary-green10 | #00240c | #00240c |
| `--swt-color-ancilary-green2` | color-ancilary-green2 | #c7f4d1 | #c7f4d1 |
| `--swt-color-ancilary-green3` | color-ancilary-green3 | #81d998 | #81d998 |
| `--swt-color-ancilary-green4` | color-ancilary-green4 | #51b971 | #51b971 |
| `--swt-color-ancilary-green5` | color-ancilary-green5 | #349855 | #349855 |
| `--swt-color-ancilary-green6` | color-ancilary-green6 | #2a884a | #2a884a |
| `--swt-color-ancilary-green7` | color-ancilary-green7 | #23703d | #23703d |
| `--swt-color-ancilary-green8` | color-ancilary-green8 | #15542b | #15542b |
| `--swt-color-ancilary-green9` | color-ancilary-green9 | #0e351a | #0e351a |
| `--swt-color-ancilary-lime1` | color-ancilary-lime1 | #f3f9d5 | #f3f9d5 |
| `--swt-color-ancilary-lime10` | color-ancilary-lime10 | #1d2000 | #1d2000 |
| `--swt-color-ancilary-lime2` | color-ancilary-lime2 | #e6eeb4 | #e6eeb4 |
| `--swt-color-ancilary-lime3` | color-ancilary-lime3 | #c1ce68 | #c1ce68 |
| `--swt-color-ancilary-lime4` | color-ancilary-lime4 | #a2ad45 | #a2ad45 |
| `--swt-color-ancilary-lime5` | color-ancilary-lime5 | #838d1c | #838d1c |
| `--swt-color-ancilary-lime6` | color-ancilary-lime6 | #737c19 | #737c19 |
| `--swt-color-ancilary-lime7` | color-ancilary-lime7 | #5f6614 | #5f6614 |
| `--swt-color-ancilary-lime8` | color-ancilary-lime8 | #464d00 | #464d00 |
| `--swt-color-ancilary-lime9` | color-ancilary-lime9 | #2c3100 | #2c3100 |
| `--swt-color-ancilary-orange1` | color-ancilary-orange1 | #fff3ef | #fff3ef |
| `--swt-color-ancilary-orange10` | color-ancilary-orange10 | #351500 | #351500 |
| `--swt-color-ancilary-orange2` | color-ancilary-orange2 | #ffe3db | #ffe3db |
| `--swt-color-ancilary-orange3` | color-ancilary-orange3 | #ffb59a | #ffb59a |
| `--swt-color-ancilary-orange4` | color-ancilary-orange4 | #e98f69 | #e98f69 |
| `--swt-color-ancilary-orange5` | color-ancilary-orange5 | #cf6b28 | #cf6b28 |
| `--swt-color-ancilary-orange6` | color-ancilary-orange6 | #bb5d1e | #bb5d1e |
| `--swt-color-ancilary-orange7` | color-ancilary-orange7 | #994e1e | #994e1e |
| `--swt-color-ancilary-orange8` | color-ancilary-orange8 | #763800 | #763800 |
| `--swt-color-ancilary-orange9` | color-ancilary-orange9 | #4e2100 | #4e2100 |
| `--swt-color-ancilary-prasinous1` | color-ancilary-prasinous1 | #e7fbdc | #e7fbdc |
| `--swt-color-ancilary-prasinous10` | color-ancilary-prasinous10 | #112300 | #112300 |
| `--swt-color-ancilary-prasinous2` | color-ancilary-prasinous2 | #cff4b9 | #cff4b9 |
| `--swt-color-ancilary-prasinous3` | color-ancilary-prasinous3 | #a1d47e | #a1d47e |
| `--swt-color-ancilary-prasinous4` | color-ancilary-prasinous4 | #7fb553 | #7fb553 |
| `--swt-color-ancilary-prasinous5` | color-ancilary-prasinous5 | #629433 | #629433 |
| `--swt-color-ancilary-prasinous6` | color-ancilary-prasinous6 | #558329 | #558329 |
| `--swt-color-ancilary-prasinous7` | color-ancilary-prasinous7 | #466d22 | #466d22 |
| `--swt-color-ancilary-prasinous8` | color-ancilary-prasinous8 | #335115 | #335115 |
| `--swt-color-ancilary-prasinous9` | color-ancilary-prasinous9 | #1f330d | #1f330d |
| `--swt-color-ancilary-purple1` | color-ancilary-purple1 | #f9f3ff | #f9f3ff |
| `--swt-color-ancilary-purple10` | color-ancilary-purple10 | #36004c | #36004c |
| `--swt-color-ancilary-purple2` | color-ancilary-purple2 | #f2e4ff | #f2e4ff |
| `--swt-color-ancilary-purple3` | color-ancilary-purple3 | #dfb6ff | #dfb6ff |
| `--swt-color-ancilary-purple4` | color-ancilary-purple4 | #cf88ff | #cf88ff |
| `--swt-color-ancilary-purple5` | color-ancilary-purple5 | #bd54f7 | #bd54f7 |
| `--swt-color-ancilary-purple6` | color-ancilary-purple6 | #ab45e1 | #ab45e1 |
| `--swt-color-ancilary-purple7` | color-ancilary-purple7 | #8d3abb | #8d3abb |
| `--swt-color-ancilary-purple8` | color-ancilary-purple8 | #6e2593 | #6e2593 |
| `--swt-color-ancilary-purple9` | color-ancilary-purple9 | #45185e | #45185e |
| `--swt-color-ancilary-red1` | color-ancilary-red1 | #fff2f2 | #fff2f2 |
| `--swt-color-ancilary-red10` | color-ancilary-red10 | #410809 | #410809 |
| `--swt-color-ancilary-red2` | color-ancilary-red2 | #ffe3e3 | #ffe3e3 |
| `--swt-color-ancilary-red3` | color-ancilary-red3 | #ffb2b3 | #ffb2b3 |
| `--swt-color-ancilary-red4` | color-ancilary-red4 | #ff7f81 | #ff7f81 |
| `--swt-color-ancilary-red5` | color-ancilary-red5 | #ea5052 | #ea5052 |
| `--swt-color-ancilary-red6` | color-ancilary-red6 | #d54143 | #d54143 |
| `--swt-color-ancilary-red7` | color-ancilary-red7 | #b03638 | #b03638 |
| `--swt-color-ancilary-red8` | color-ancilary-red8 | #8a2325 | #8a2325 |
| `--swt-color-ancilary-red9` | color-ancilary-red9 | #581616 | #581616 |
| `--swt-color-ancilary-rose1` | color-ancilary-rose1 | #fff2f6 | #fff2f6 |
| `--swt-color-ancilary-rose10` | color-ancilary-rose10 | #420024 | #420024 |
| `--swt-color-ancilary-rose2` | color-ancilary-rose2 | #ffe2eb | #ffe2eb |
| `--swt-color-ancilary-rose3` | color-ancilary-rose3 | #ffafcd | #ffafcd |
| `--swt-color-ancilary-rose4` | color-ancilary-rose4 | #ff79b2 | #ff79b2 |
| `--swt-color-ancilary-rose5` | color-ancilary-rose5 | #e94794 | #e94794 |
| `--swt-color-ancilary-rose6` | color-ancilary-rose6 | #c44c82 | #c44c82 |
| `--swt-color-ancilary-rose7` | color-ancilary-rose7 | #ac346d | #ac346d |
| `--swt-color-ancilary-rose8` | color-ancilary-rose8 | #842252 | #842252 |
| `--swt-color-ancilary-rose9` | color-ancilary-rose9 | #551634 | #551634 |
| `--swt-color-ancilary-sapphire1` | color-ancilary-sapphire1 | #f0f5ff | #f0f5ff |
| `--swt-color-ancilary-sapphire10` | color-ancilary-sapphire10 | #002038 | #002038 |
| `--swt-color-ancilary-sapphire2` | color-ancilary-sapphire2 | #ddeaff | #ddeaff |
| `--swt-color-ancilary-sapphire3` | color-ancilary-sapphire3 | #9fc9ff | #9fc9ff |
| `--swt-color-ancilary-sapphire4` | color-ancilary-sapphire4 | #69abef | #69abef |
| `--swt-color-ancilary-sapphire5` | color-ancilary-sapphire5 | #468bca | #468bca |
| `--swt-color-ancilary-sapphire6` | color-ancilary-sapphire6 | #377bb7 | #377bb7 |
| `--swt-color-ancilary-sapphire7` | color-ancilary-sapphire7 | #2e6598 | #2e6598 |
| `--swt-color-ancilary-sapphire8` | color-ancilary-sapphire8 | #1e4b74 | #1e4b74 |
| `--swt-color-ancilary-sapphire9` | color-ancilary-sapphire9 | #132f4a | #132f4a |
| `--swt-color-ancilary-yellow1` | color-ancilary-yellow1 | #fff4dc | #fff4dc |
| `--swt-color-ancilary-yellow10` | color-ancilary-yellow10 | #251d00 | #251d00 |
| `--swt-color-ancilary-yellow2` | color-ancilary-yellow2 | #f9e7bc | #f9e7bc |
| `--swt-color-ancilary-yellow3` | color-ancilary-yellow3 | #dfc470 | #dfc470 |
| `--swt-color-ancilary-yellow4` | color-ancilary-yellow4 | #bea54c | #bea54c |
| `--swt-color-ancilary-yellow5` | color-ancilary-yellow5 | #9d8420 | #9d8420 |
| `--swt-color-ancilary-yellow6` | color-ancilary-yellow6 | #8b751c | #8b751c |
| `--swt-color-ancilary-yellow7` | color-ancilary-yellow7 | #736117 | #736117 |
| `--swt-color-ancilary-yellow8` | color-ancilary-yellow8 | #574800 | #574800 |
| `--swt-color-ancilary-yellow9` | color-ancilary-yellow9 | #392d00 | #392d00 |
| `--swt-color-ancillary-blue1` | color-ancillary-blue1 | #f2f5ff | #071c44 |
| `--swt-color-ancillary-blue10` | color-ancillary-blue10 | #071c44 | #f2f5ff |
| `--swt-color-ancillary-blue2` | color-ancillary-blue2 | #e3e8ff | #0d2c62 |
| `--swt-color-ancillary-blue3` | color-ancillary-blue3 | #b4c4ff | #174595 |
| `--swt-color-ancillary-blue4` | color-ancillary-blue4 | #83a3ff | #215dc4 |
| `--swt-color-ancillary-blue5` | color-ancillary-blue5 | #3f81ff | #2971ea |
| `--swt-color-ancillary-blue6` | color-ancillary-blue6 | #2971ea | #3f81ff |
| `--swt-color-ancillary-blue7` | color-ancillary-blue7 | #215dc4 | #83a3ff |
| `--swt-color-ancillary-blue8` | color-ancillary-blue8 | #174595 | #b4c4ff |
| `--swt-color-ancillary-blue9` | color-ancillary-blue9 | #0d2c62 | #e3e8ff |
| `--swt-color-ancillary-cyan1` | color-ancillary-cyan1 | #edf7fa | #002228 |
| `--swt-color-ancillary-cyan10` | color-ancillary-cyan10 | #002228 | #edf7fa |
| `--swt-color-ancillary-cyan2` | color-ancillary-cyan2 | #d4eef5 | #00333c |
| `--swt-color-ancillary-cyan3` | color-ancillary-cyan3 | #72d4e9 | #00515d |
| `--swt-color-ancillary-cyan4` | color-ancillary-cyan4 | #00b6cf | #006c7b |
| `--swt-color-ancillary-cyan5` | color-ancillary-cyan5 | #0094a7 | #008294 |
| `--swt-color-ancillary-cyan6` | color-ancillary-cyan6 | #008294 | #0094a7 |
| `--swt-color-ancillary-cyan7` | color-ancillary-cyan7 | #006c7b | #00b6cf |
| `--swt-color-ancillary-cyan8` | color-ancillary-cyan8 | #00515d | #72d4e9 |
| `--swt-color-ancillary-cyan9` | color-ancillary-cyan9 | #00333c | #d4eef5 |
| `--swt-color-ancillary-fuchsia1` | color-ancillary-fuchsia1 | #fdf2fe | #321033 |
| `--swt-color-ancillary-fuchsia10` | color-ancillary-fuchsia10 | #321033 | #fdf2fe |
| `--swt-color-ancillary-fuchsia2` | color-ancillary-fuchsia2 | #f9e2fa | #4a1b4b |
| `--swt-color-ancillary-fuchsia3` | color-ancillary-fuchsia3 | #f0b1f2 | #712d73 |
| `--swt-color-ancillary-fuchsia4` | color-ancillary-fuchsia4 | #df86e1 | #963e98 |
| `--swt-color-ancillary-fuchsia5` | color-ancillary-fuchsia5 | #c75bc9 | #b34cb5 |
| `--swt-color-ancillary-fuchsia6` | color-ancillary-fuchsia6 | #b34cb5 | #c75bc9 |
| `--swt-color-ancillary-fuchsia7` | color-ancillary-fuchsia7 | #963e98 | #df86e1 |
| `--swt-color-ancillary-fuchsia8` | color-ancillary-fuchsia8 | #712d73 | #f0b1f2 |
| `--swt-color-ancillary-fuchsia9` | color-ancillary-fuchsia9 | #4a1b4b | #f9e2fa |
| `--swt-color-ancillary-green1` | color-ancillary-green1 | #ecf7f5 | #00231f |
| `--swt-color-ancillary-green10` | color-ancillary-green10 | #00231f | #ecf7f5 |
| `--swt-color-ancillary-green2` | color-ancillary-green2 | #d3efea | #00352f |
| `--swt-color-ancillary-green3` | color-ancillary-green3 | #72d7c8 | #00534a |
| `--swt-color-ancillary-green4` | color-ancillary-green4 | #00baa8 | #006f63 |
| `--swt-color-ancillary-green5` | color-ancillary-green5 | #009788 | #008578 |
| `--swt-color-ancillary-green6` | color-ancillary-green6 | #008578 | #009788 |
| `--swt-color-ancillary-green7` | color-ancillary-green7 | #006f63 | #00baa8 |
| `--swt-color-ancillary-green8` | color-ancillary-green8 | #00534a | #72d7c8 |
| `--swt-color-ancillary-green9` | color-ancillary-green9 | #00352f | #d3efea |
| `--swt-color-ancillary-lime1` | color-ancillary-lime1 | #f2f7e8 | #1a2100 |
| `--swt-color-ancillary-lime10` | color-ancillary-lime10 | #1a2100 | #f2f7e8 |
| `--swt-color-ancillary-lime2` | color-ancillary-lime2 | #e3edcc | #283200 |
| `--swt-color-ancillary-lime3` | color-ancillary-lime3 | #b8d077 | #414f00 |
| `--swt-color-ancillary-lime4` | color-ancillary-lime4 | #96b132 | #576900 |
| `--swt-color-ancillary-lime5` | color-ancillary-lime5 | #789000 | #697f00 |
| `--swt-color-ancillary-lime6` | color-ancillary-lime6 | #697f00 | #789000 |
| `--swt-color-ancillary-lime7` | color-ancillary-lime7 | #576900 | #96b132 |
| `--swt-color-ancillary-lime8` | color-ancillary-lime8 | #414f00 | #b8d077 |
| `--swt-color-ancillary-lime9` | color-ancillary-lime9 | #283200 | #e3edcc |
| `--swt-color-ancillary-orange1` | color-ancillary-orange1 | #fff2f0 | #391200 |
| `--swt-color-ancillary-orange10` | color-ancillary-orange10 | #391200 | #fff2f0 |
| `--swt-color-ancillary-orange2` | color-ancillary-orange2 | #ffe3de | #531e00 |
| `--swt-color-ancillary-orange3` | color-ancillary-orange3 | #ffb4a2 | #7e3100 |
| `--swt-color-ancillary-orange4` | color-ancillary-orange4 | #fe8357 | #a64300 |
| `--swt-color-ancillary-orange5` | color-ancillary-orange5 | #de5f17 | #c75200 |
| `--swt-color-ancillary-orange6` | color-ancillary-orange6 | #c75200 | #de5f17 |
| `--swt-color-ancillary-orange7` | color-ancillary-orange7 | #a64300 | #fe8357 |
| `--swt-color-ancillary-orange8` | color-ancillary-orange8 | #7e3100 | #ffb4a2 |
| `--swt-color-ancillary-orange9` | color-ancillary-orange9 | #531e00 | #ffe3de |
| `--swt-color-ancillary-prasinous1` | color-ancillary-prasinous1 | #eef8ee | #062403 |
| `--swt-color-ancillary-prasinous10` | color-ancillary-prasinous10 | #062403 | #eef8ee |
| `--swt-color-ancillary-prasinous2` | color-ancillary-prasinous2 | #d9efd8 | #0c3605 |
| `--swt-color-ancillary-prasinous3` | color-ancillary-prasinous3 | #98d594 | #17550d |
| `--swt-color-ancillary-prasinous4` | color-ancillary-prasinous4 | #65b95e | #227114 |
| `--swt-color-ancillary-prasinous5` | color-ancillary-prasinous5 | #379929 | #2a881a |
| `--swt-color-ancillary-prasinous6` | color-ancillary-prasinous6 | #2a881a | #379929 |
| `--swt-color-ancillary-prasinous7` | color-ancillary-prasinous7 | #227114 | #65b95e |
| `--swt-color-ancillary-prasinous8` | color-ancillary-prasinous8 | #17550d | #98d594 |
| `--swt-color-ancillary-prasinous9` | color-ancillary-prasinous9 | #0c3605 | #d9efd8 |
| `--swt-color-ancillary-purple1` | color-ancillary-purple1 | #f7f3ff | #26153f |
| `--swt-color-ancillary-purple10` | color-ancillary-purple10 | #26153f | #f7f3ff |
| `--swt-color-ancillary-purple2` | color-ancillary-purple2 | #ede5ff | #39215c |
| `--swt-color-ancillary-purple3` | color-ancillary-purple3 | #d1bbff | #59368c |
| `--swt-color-ancillary-purple4` | color-ancillary-purple4 | #b992ff | #764ab9 |
| `--swt-color-ancillary-purple5` | color-ancillary-purple5 | #9f69f2 | #8e59dd |
| `--swt-color-ancillary-purple6` | color-ancillary-purple6 | #8e59dd | #9f69f2 |
| `--swt-color-ancillary-purple7` | color-ancillary-purple7 | #764ab9 | #b992ff |
| `--swt-color-ancillary-purple8` | color-ancillary-purple8 | #59368c | #d1bbff |
| `--swt-color-ancillary-purple9` | color-ancillary-purple9 | #39215c | #ede5ff |
| `--swt-color-ancillary-red1` | color-ancillary-red1 | #fff2f5 | #390e1f |
| `--swt-color-ancillary-red10` | color-ancillary-red10 | #390e1f | #fff2f5 |
| `--swt-color-ancillary-red2` | color-ancillary-red2 | #ffe2e9 | #53182f |
| `--swt-color-ancillary-red3` | color-ancillary-red3 | #ffb0c7 | #7f294b |
| `--swt-color-ancillary-red4` | color-ancillary-red4 | #fa7ea8 | #a83964 |
| `--swt-color-ancillary-red5` | color-ancillary-red5 | #df5489 | #c94678 |
| `--swt-color-ancillary-red6` | color-ancillary-red6 | #c94678 | #df5489 |
| `--swt-color-ancillary-red7` | color-ancillary-red7 | #a83964 | #fa7ea8 |
| `--swt-color-ancillary-red8` | color-ancillary-red8 | #7f294b | #ffb0c7 |
| `--swt-color-ancillary-red9` | color-ancillary-red9 | #53182f | #ffe2e9 |
| `--swt-color-ancillary-rose1` | color-ancillary-rose1 | #fff2f9 | #370f28 |
| `--swt-color-ancillary-rose10` | color-ancillary-rose10 | #370f28 | #fff2f9 |
| `--swt-color-ancillary-rose2` | color-ancillary-rose2 | #ffe1f1 | #50193c |
| `--swt-color-ancillary-rose3` | color-ancillary-rose3 | #ffaddc | #7a2a5e |
| `--swt-color-ancillary-rose4` | color-ancillary-rose4 | #f081c4 | #a23a7d |
| `--swt-color-ancillary-rose5` | color-ancillary-rose5 | #d756a8 | #c14796 |
| `--swt-color-ancillary-rose6` | color-ancillary-rose6 | #c14796 | #d756a8 |
| `--swt-color-ancillary-rose7` | color-ancillary-rose7 | #a23a7d | #f081c4 |
| `--swt-color-ancillary-rose8` | color-ancillary-rose8 | #7a2a5e | #ffaddc |
| `--swt-color-ancillary-rose9` | color-ancillary-rose9 | #50193c | #ffe1f1 |
| `--swt-color-ancillary-sapphire1` | color-ancillary-sapphire1 | #eff6fd | #002131 |
| `--swt-color-ancillary-sapphire10` | color-ancillary-sapphire10 | #002131 | #eff6fd |
| `--swt-color-ancillary-sapphire2` | color-ancillary-sapphire2 | #daebfc | #003248 |
| `--swt-color-ancillary-sapphire3` | color-ancillary-sapphire3 | #89ceff | #004e6f |
| `--swt-color-ancillary-sapphire4` | color-ancillary-sapphire4 | #00b1f5 | #006993 |
| `--swt-color-ancillary-sapphire5` | color-ancillary-sapphire5 | #008fc7 | #007eb0 |
| `--swt-color-ancillary-sapphire6` | color-ancillary-sapphire6 | #007eb0 | #008fc7 |
| `--swt-color-ancillary-sapphire7` | color-ancillary-sapphire7 | #006993 | #00b1f5 |
| `--swt-color-ancillary-sapphire8` | color-ancillary-sapphire8 | #004e6f | #89ceff |
| `--swt-color-ancillary-sapphire9` | color-ancillary-sapphire9 | #003248 | #daebfc |
| `--swt-color-ancillary-yellow1` | color-ancillary-yellow1 | #fff4e4 | #281c00 |
| `--swt-color-ancillary-yellow10` | color-ancillary-yellow10 | #281c00 | #fff4e4 |
| `--swt-color-ancillary-yellow2` | color-ancillary-yellow2 | #ffe6c0 | #3c2c00 |
| `--swt-color-ancillary-yellow3` | color-ancillary-yellow3 | #efbf5d | #5d4600 |
| `--swt-color-ancillary-yellow4` | color-ancillary-yellow4 | #d09f00 | #7c5e00 |
| `--swt-color-ancillary-yellow5` | color-ancillary-yellow5 | #a88000 | #957100 |
| `--swt-color-ancillary-yellow6` | color-ancillary-yellow6 | #957100 | #a88000 |
| `--swt-color-ancillary-yellow7` | color-ancillary-yellow7 | #7c5e00 | #d09f00 |
| `--swt-color-ancillary-yellow8` | color-ancillary-yellow8 | #5d4600 | #efbf5d |
| `--swt-color-ancillary-yellow9` | color-ancillary-yellow9 | #3c2c00 | #ffe6c0 |
| `--swt-color-black` | color-black | var(--swt-color-gray12) | var(--swt-color-gray12) |
| `--swt-color-danger-light-8` | color-danger-light-8 | #fde2e2 | #fde2e2 |
| `--swt-color-danger-light-9` | color-danger-light-9 | #fef0f0 | #fef0f0 |
| `--swt-color-error-light-3` | color-error-light-3 | #f89898 | #f89898 |
| `--swt-color-filling-hover` | color-filling-hover | var(--swt-color-gray3) | var(--swt-color-gray3) |
| `--swt-color-gray1` | color-gray1 | #ffffff | #1e1e1e |
| `--swt-color-gray10` | color-gray10 | #2e2e2e | #e9e9e9 |
| `--swt-color-gray11` | color-gray11 | #1e1e1e | #f5f5f5 |
| `--swt-color-gray12` | color-gray12 | #000000 | #ffffff |
| `--swt-color-gray13` | color-gray13 | #ffffff | #ffffff |
| `--swt-color-gray2` | color-gray2 | #f5f5f5 | #000000 |
| `--swt-color-gray3` | color-gray3 | #e9e9e9 | #2e2e2e |
| `--swt-color-gray4` | color-gray4 | #c6c6c6 | #494949 |
| `--swt-color-gray5` | color-gray5 | #a6a6a6 | #626262 |
| `--swt-color-gray6` | color-gray6 | #868686 | #767676 |
| `--swt-color-gray7` | color-gray7 | #767676 | #868686 |
| `--swt-color-gray8` | color-gray8 | #626262 | #a6a6a6 |
| `--swt-color-gray9` | color-gray9 | #494949 | #c6c6c6 |
| `--swt-color-info-dark-2` | color-info-dark-2 | #73767a | #73767a |
| `--swt-color-info-light-3` | color-info-light-3 | #b1b3b8 | #b1b3b8 |
| `--swt-color-info-light-5` | color-info-light-5 | #c8c9cc | #c8c9cc |
| `--swt-color-info-light-8` | color-info-light-8 | #e9e9eb | #e9e9eb |
| `--swt-color-info-light-9` | color-info-light-9 | #f4f4f5 | #f4f4f5 |
| `--swt-color-placeholder` | color-placeholder | var(--swt-color-gray6) | var(--swt-color-gray6) |
| `--swt-color-primary-light-8` | color-primary-light-8 | #d9ecff | #d9ecff |
| `--swt-color-success-dark-2` | color-success-dark-2 | #529b2e | #529b2e |
| `--swt-color-success-light-3` | color-success-light-3 | #95d475 | #95d475 |
| `--swt-color-success-light-5` | color-success-light-5 | #b3e19d | #b3e19d |
| `--swt-color-success-light-8` | color-success-light-8 | #e1f3d8 | #e1f3d8 |
| `--swt-color-success-light-9` | color-success-light-9 | #f0f9eb | #f0f9eb |
| `--swt-color-warning-dark-2` | color-warning-dark-2 | #b88230 | #b88230 |
| `--swt-color-warning-light-3` | color-warning-light-3 | #eebe77 | #eebe77 |
| `--swt-color-warning-light-5` | color-warning-light-5 | #f3d19e | #f3d19e |
| `--swt-color-warning-light-8` | color-warning-light-8 | #faecd8 | #faecd8 |
| `--swt-color-warning-light-9` | color-warning-light-9 | #fdf6ec | #fdf6ec |
| `--swt-color-white` | color-white | var(--swt-color-gray13) | var(--swt-color-gray13) |
| `--swt-color-zebra` | color-zebra | var(--swt-color-gray6) | var(--swt-color-gray6) |
| `--swt-fill-color` | fill-color | rgba(255, 255, 255, var(--swt-color-opacity0)) | rgba(255, 255, 255, var(--swt-color-opacity0)) |
| `--swt-fill-color-0` | fill-color-0 | #ffffff | var(--swt-color-black) |
| `--swt-fill-color-1` | fill-color-1 | #fcfcfc | #4e4d5f |
| `--swt-fill-color-2` | fill-color-2 | #f6f6f6 | #464855 |
| `--swt-fill-color-3` | fill-color-3 | #f0f0f0 | #3e3e46 |
| `--swt-fill-color-4` | fill-color-4 | #ebebeb | #36363e |
| `--swt-fill-color-5` | fill-color-5 | #e0e0e0 | #2e2e36 |
| `--swt-fill-color-6` | fill-color-6 | #dbdbdb | #28282e |
| `--swt-fill-color-7` | fill-color-7 | #d3d3d3 | #20212e |
| `--swt-fill-color-8` | fill-color-8 | #cfcfcf | #1e1e20 |
| `--swt-fill-color-9` | fill-color-9 | #c6c6c6 | #18181e |
| `--swt-fill-color-blank` | fill-color-blank | rgba(255, 255, 255, var(--swt-color-opacity0)) | rgba(255, 255, 255, var(--swt-color-opacity0)) |
| `--swt-fill-color-dark` | fill-color-dark | #ebedf0 | #ebedf0 |
| `--swt-fill-color-darker` | fill-color-darker | #e6e8eb | #e6e8eb |
| `--swt-fill-color-extra-light` | fill-color-extra-light | #fafcff | #fafcff |
| `--swt-fill-color-light` | fill-color-light | rgba(255, 255, 255, var(--swt-color-opacity0)) | rgba(255, 255, 255, var(--swt-color-opacity0)) |
| `--swt-fill-color-lighter` | fill-color-lighter | #fafafa | #fafafa |
| `--swt-text-color-disabled` | text-color-disabled | var(--swt-color-gray5) | var(--swt-color-gray5) |
| `--swt-text-color-placeholder` | text-color-placeholder | var(--swt-color-gray5) | var(--swt-color-gray5) |
| `--swt-text-color-primary` | text-color-primary | var(--swt-color-gray10) | var(--swt-color-gray10) |
| `--swt-text-color-secondary` | text-color-secondary | #909399 | #909399 |
| `--swt-transition-color` | transition-color | color var(--swt-transition-duration-fast) var(--swt-transition-function-ease-in-out-bezier) | color var(--swt-transition-duration-fast) var(--swt-transition-function-ease-in-out-bezier) |

## 品牌

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--swt-color-brand-active` | color-brand-active | #980006 | #980006 |
| `--swt-color-brand-focus` | color-brand-focus | #c7000b | #c7000b |
| `--swt-color-brand-hover` | color-brand-hover | #c7000b | #c7000b |
| `--swt-color-brand-normal` | 品牌色 | #c7000b | #c7000b |
| `--swt-color-brand-normal-opacity20` | color-brand-normal-opacity20 | #c7000b33 | #c7000b33 |
| `--swt-color-brand-normal-opacity40` | color-brand-normal-opacity40 | #c7000b66 | #c7000b66 |
| `--swt-color-brand-text-active` | color-brand-text-active | #980006 | #980006 |
| `--swt-color-brand-text-focus` | color-brand-text-focus | #c7000b | #c7000b |
| `--swt-color-brand-text-hover` | color-brand-text-hover | #d5000d | #ed0010 |
| `--swt-color-brand-text-normal` | color-brand-text-normal | #c7000b | #c7000b |

## 图表配色

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--swt-color-chart-A1` | color-chart-A1 | #6190ff | #3e81ff |
| `--swt-color-chart-A10` | color-chart-A10 | #009edb | #008fc7 |
| `--swt-color-chart-A11` | color-chart-A11 | #a97cf6 | #9f69f2 |
| `--swt-color-chart-A2` | color-chart-A2 | #4ea744 | #379929 |
| `--swt-color-chart-A3` | color-chart-A3 | #ea6897 | #df5488 |
| `--swt-color-chart-A4` | color-chart-A4 | #00a3b8 | #0093a8 |
| `--swt-color-chart-A5` | color-chart-A5 | #d06fd2 | #c75bc9 |
| `--swt-color-chart-A6` | color-chart-A6 | #849f00 | #779000 |
| `--swt-color-chart-A7` | color-chart-A7 | #ec6f3b | #de5f17 |
| `--swt-color-chart-A8` | color-chart-A8 | #00a696 | #009788 |
| `--swt-color-chart-A9` | color-chart-A9 | #e16ab3 | #d656a8 |
| `--swt-color-chart-B1` | color-chart-B1 | #3f81ff | #2971ea |
| `--swt-color-chart-B10` | color-chart-B10 | #9bce6e | #77af35 |
| `--swt-color-chart-B11` | color-chart-B11 | #b8d077 | #96b132 |
| `--swt-color-chart-B2` | color-chart-B2 | #0093e2 | #0d7fc3 |
| `--swt-color-chart-B3` | color-chart-B3 | #009ece | #0087b0 |
| `--swt-color-chart-B4` | color-chart-B4 | #00a8c2 | #008ca3 |
| `--swt-color-chart-B5` | color-chart-B5 | #00b2af | #009290 |
| `--swt-color-chart-B6` | color-chart-B6 | #00baa8 | #009788 |
| `--swt-color-chart-B7` | color-chart-B7 | #55c086 | #389e69 |
| `--swt-color-chart-B8` | color-chart-B8 | #70c57c | #4da55a |
| `--swt-color-chart-B9` | color-chart-B9 | #82ca79 | #5cab4e |

## 状态/功能色

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--swt-color-function-important-active` | color-function-important-active | #ba5c11 | #b55a10 |
| `--swt-color-function-important-background` | color-function-important-background | #fff2ef | #492410 |
| `--swt-color-function-important-background1` | color-function-important-background1 | #d2691526 | #d2691540 |
| `--swt-color-function-important-disabled` | color-function-important-disabled | #d2691566 | #d2691566 |
| `--swt-color-function-important-focus` | color-function-important-focus | #d26915 | #d26915 |
| `--swt-color-function-important-hover` | color-function-important-hover | #d26915 | #d26915 |
| `--swt-color-function-important-normal` | color-function-important-normal | #d26915 | #d26915 |
| `--swt-color-function-important-text-active` | color-function-important-text-active | #773700 | #f67c1b |
| `--swt-color-function-important-text-disabled` | color-function-important-text-disabled | #9c4b0066 | #fd863966 |
| `--swt-color-function-important-text-focus` | color-function-important-text-focus | #9c4b00 | #fd8639 |
| `--swt-color-function-important-text-hover` | color-function-important-text-hover | #af5500 | #ffb498 |
| `--swt-color-function-important-text-normal` | color-function-important-text-normal | #9c4b00 | #fd8639 |
| `--swt-color-function-invalid-normal` | color-function-invalid-normal | #949494 | #949494 |
| `--swt-color-function-prompt-active` | color-function-prompt-active | #007bc1 | #0078bb |
| `--swt-color-function-prompt-background` | color-function-prompt-background | #eff5ff | #003050 |
| `--swt-color-function-prompt-background1` | color-function-prompt-background1 | #008ddb26 | #008ddb40 |
| `--swt-color-function-prompt-disabled` | color-function-prompt-disabled | #008ddb66 | #008ddb66 |
| `--swt-color-function-prompt-focus` | color-function-prompt-focus | #008ddb | #008ddb |
| `--swt-color-function-prompt-hover` | color-function-prompt-hover | #008ddb | #008ddb |
| `--swt-color-function-prompt-normal` | color-function-prompt-normal | #008ddb | #008ddb |
| `--swt-color-function-prompt-text-active` | color-function-prompt-text-active | #004d7a | #00a5fe |
| `--swt-color-function-prompt-text-disabled` | color-function-prompt-text-disabled | #0067a166 | #46acff66 |
| `--swt-color-function-prompt-text-focus` | color-function-prompt-text-focus | #0067a1 | #46acff |
| `--swt-color-function-prompt-text-hover` | color-function-prompt-text-hover | #0073b3 | #9dcaff |
| `--swt-color-function-prompt-text-normal` | color-function-prompt-text-normal | #0067a1 | #46acff |
| `--swt-color-function-success-active` | color-function-success-active | #00893f | #00853d |
| `--swt-color-function-success-background` | color-function-success-background | #e4fae9 | #0b3519 |
| `--swt-color-function-success-background1` | color-function-success-background1 | #009b4926 | #009b4940 |
| `--swt-color-function-success-disabled` | color-function-success-disabled | #009b4966 | #009b4966 |
| `--swt-color-function-success-focus` | color-function-success-focus | #009b49 | #009b49 |
| `--swt-color-function-success-hover` | color-function-success-hover | #009b49 | #009b49 |
| `--swt-color-function-success-normal` | color-function-success-normal | #009b49 | #009b49 |
| `--swt-color-function-success-text-active` | color-function-success-text-active | #005525 | #00b657 |
| `--swt-color-function-success-text-disabled` | color-function-success-text-disabled | #00723466 | #00bf5c66 |
| `--swt-color-function-success-text-focus` | color-function-success-text-focus | #007234 | #00bf5c |
| `--swt-color-function-success-text-hover` | color-function-success-text-hover | #007f3a | #00e46e |
| `--swt-color-function-success-text-normal` | color-function-success-text-normal | #007234 | #00bf5c |
| `--swt-color-function-urgent-active` | color-function-urgent-active | #ba292c | #d83134 |
| `--swt-color-function-urgent-background` | color-function-urgent-background | #fff2f2 | #501f1f |
| `--swt-color-function-urgent-background1` | color-function-urgent-background1 | #dd333626 | #dd333640 |
| `--swt-color-function-urgent-disabled` | color-function-urgent-disabled | #dd333666 | #dd333666 |
| `--swt-color-function-urgent-focus` | color-function-urgent-focus | #dd3336 | #dd3336 |
| `--swt-color-function-urgent-hover` | color-function-urgent-hover | #dd3336 | #dd3336 |
| `--swt-color-function-urgent-normal` | color-function-urgent-normal | #dd3336 | #dd3336 |
| `--swt-color-function-urgent-normal-opacity20` | color-function-urgent-normal-opacity20 | #dd333633 | #dd333633 |
| `--swt-color-function-urgent-normal-opacity40` | color-function-urgent-normal-opacity40 | #dd333666 | #dd333666 |
| `--swt-color-function-urgent-text-active` | color-function-urgent-text-active | #980006 | #ff7072 |
| `--swt-color-function-urgent-text-disabled` | color-function-urgent-text-disabled | #be232666 | #ff7f8166 |
| `--swt-color-function-urgent-text-focus` | color-function-urgent-text-focus | #be2326 | #ff7f81 |
| `--swt-color-function-urgent-text-hover` | color-function-urgent-text-hover | #cc2e31 | #ffb2b3 |
| `--swt-color-function-urgent-text-normal` | color-function-urgent-text-normal | #be2326 | #ff7f81 |
| `--swt-color-function-warning-active` | color-function-warning-active | #c3a41d | #8d7712 |
| `--swt-color-function-warning-background` | color-function-warning-background | #fef4de | #372d03 |
| `--swt-color-function-warning-background1` | color-function-warning-background1 | #e7c32540 | #e7c32526 |
| `--swt-color-function-warning-disabled` | color-function-warning-disabled | #e7c32566 | #e7c32566 |
| `--swt-color-function-warning-focus` | color-function-warning-focus | #e7c325 | #e7c325 |
| `--swt-color-function-warning-hover` | color-function-warning-hover | #e7c325 | #e7c325 |
| `--swt-color-function-warning-normal` | color-function-warning-normal | #e7c325 | #e7c325 |
| `--swt-color-function-warning-text-active` | color-function-warning-text-active | #574800 | #c3a41d |
| `--swt-color-function-warning-text-disabled` | color-function-warning-text-disabled | #75610066 | #e7c32566 |
| `--swt-color-function-warning-text-focus` | color-function-warning-text-focus | #756100 | #e7c325 |
| `--swt-color-function-warning-text-hover` | color-function-warning-text-hover | #836c00 | #fee7ab |
| `--swt-color-function-warning-text-normal` | color-function-warning-text-normal | #756100 | #e7c325 |

## 透明度

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--swt-color-gray1-opacity80` | color-gray1-opacity80 | rgba(255, 255, 255, 0.8) | rgba(20, 47, 77, 0.8) |
| `--swt-color-gray11-opacity20` | color-gray11-opacity20 | #1e1e1e33 | #f5f5f533 |
| `--swt-color-gray11-opacity30` | color-gray11-opacity30 | #1e1e1e4d | #f5f5f54d |
| `--swt-color-gray11-opacity40` | color-gray11-opacity40 | #1e1e1e66 | #f5f5f566 |
| `--swt-color-gray2-opacity70` | color-gray2-opacity70 | #f5f5f5b2 | #000000b2 |
| `--swt-color-gray4-opacity60` | color-gray4-opacity60 | #c6c6c699 | #49494999 |
| `--swt-color-gray6-opacity5` | color-gray6-opacity5 | #8686860d | #7676760d |
| `--swt-color-opacity0` | color-opacity0 | 0 | 0 |
| `--swt-color-opacity1` | color-opacity1 | 0.1 | 0.1 |
| `--swt-color-opacity10` | color-opacity10 | 1 | 1 |
| `--swt-color-opacity2` | color-opacity2 | 0.2 | 0.2 |
| `--swt-color-opacity3` | color-opacity3 | 0.3 | 0.3 |
| `--swt-color-opacity4` | color-opacity4 | 0.4 | 0.4 |
| `--swt-color-opacity5` | color-opacity5 | 0.5 | 0.5 |
| `--swt-color-opacity6` | color-opacity6 | 0.6 | 0.6 |
| `--swt-color-opacity7` | color-opacity7 | 0.7 | 0.7 |
| `--swt-color-opacity8` | color-opacity8 | 0.8 | 0.8 |
| `--swt-color-opacity9` | color-opacity9 | 0.9 | 0.9 |
| `--swt-color-overlay-gray1-and-accent-normal-opacity10` | color-overlay-gray1-and-accent-normal-opacity10 | #e6f0fa | #1b2732 |
| `--swt-color-overlay-gray1-and-accent-normal-opacity20` | color-overlay-gray1-and-accent-normal-opacity20 | #cce1f6 | #182f46 |
| `--swt-color-overlay-gray1-and-accent-normal-opacity5` | color-overlay-gray1-and-accent-normal-opacity5 | #f2f7fd | #1c2228 |
| `--swt-color-overlay-gray1-and-gray12-opacity10` | color-overlay-gray1-and-gray12-opacity10 | #e6e6e6 | #353535 |
| `--swt-color-overlay-gray1-and-gray12-opacity5` | color-overlay-gray1-and-gray12-opacity5 | #f2f2f2 | #292929 |
| `--swt-color-overlay-gray1-and-gray13-opacity10` | color-overlay-gray1-and-gray13-opacity10 | #ffffff | #353535 |
| `--swt-color-overlay-gray1-and-gray5-opacity20` | color-overlay-gray1-and-gray5-opacity20 | #ededed | #2c2c2c |
| `--swt-color-overlay-gray1-and-gray6-opacity10` | color-overlay-gray1-and-gray6-opacity10 | #f3f3f3 | #272727 |
| `--swt-color-overlay-gray1-and-urgent-normal-opacity10` | color-overlay-gray1-and-urgent-normal-opacity10 | #fcebeb | #312020 |
| `--swt-color-overlay-gray1-and-urgent-normal-opacity20` | color-overlay-gray1-and-urgent-normal-opacity20 | #f8d6d7 | #442223 |
| `--swt-opacity0` | opacity0 | 0 | 0 |
| `--swt-opacity10` | opacity10 | 0.1 | 0.1 |
| `--swt-opacity100` | opacity100 | 1 | 1 |
| `--swt-opacity15` | opacity15 | 0.15 | 0.15 |
| `--swt-opacity20` | opacity20 | 0.2 | 0.2 |
| `--swt-opacity25` | opacity25 | 0.25 | 0.25 |
| `--swt-opacity30` | opacity30 | 0.3 | 0.3 |
| `--swt-opacity35` | opacity35 | 0.35 | 0.35 |
| `--swt-opacity40` | opacity40 | 0.4 | 0.4 |
| `--swt-opacity45` | opacity45 | 0.45 | 0.45 |
| `--swt-opacity5` | opacity5 | 0.05 | 0.05 |
| `--swt-opacity50` | opacity50 | 0.5 | 0.5 |
| `--swt-opacity55` | opacity55 | 0.55 | 0.55 |
| `--swt-opacity60` | opacity60 | 0.6 | 0.6 |
| `--swt-opacity65` | opacity65 | 0.65 | 0.65 |
| `--swt-opacity70` | opacity70 | 0.7 | 0.7 |
| `--swt-opacity75` | opacity75 | 0.75 | 0.75 |
| `--swt-opacity80` | opacity80 | 0.8 | 0.8 |
| `--swt-opacity85` | opacity85 | 0.85 | 0.85 |
| `--swt-opacity90` | opacity90 | 0.9 | 0.9 |
| `--swt-opacity95` | opacity95 | 0.95 | 0.95 |

## 文字

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--swt-color-text-disabled` | color-text-disabled | var(--swt-color-gray5) | var(--swt-color-gray5) |
| `--swt-color-text-extra` | 辅助文字 | var(--swt-color-gray6) | var(--swt-color-gray6) |
| `--swt-color-text-primary` | 主文字 | var(--swt-color-gray11) | var(--swt-color-gray11) |
| `--swt-color-text-secondary` | 次文字 | var(--swt-color-gray8) | var(--swt-color-gray8) |

## 字体/字号/行高

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--swt-font-family-en` | font-family-en | Huawei Sans,Manrope,Arial,San Francisco,Helvetica,Roboto | Huawei Sans,Manrope,Arial,San Francisco,Helvetica,Roboto |
| `--swt-font-family-other` | font-family-other | Roboto | Roboto |
| `--swt-font-family-zh` | font-family-zh | SourceHanSansCN,PingFang SC,MicroSoft YaHei | SourceHanSansCN,PingFang SC,MicroSoft YaHei |
| `--swt-font-line-height-big` | font-line-height-big | 32px | 32px |
| `--swt-font-line-height-big1` | font-line-height-big1 | 38px | 38px |
| `--swt-font-line-height-big2` | font-line-height-big2 | 44px | 44px |
| `--swt-font-line-height-big3` | font-line-height-big3 | 48px | 48px |
| `--swt-font-line-height-big4` | font-line-height-big4 | 56px | 56px |
| `--swt-font-line-height-big5` | font-line-height-big5 | 68px | 68px |
| `--swt-font-line-height-big6` | font-line-height-big6 | 88px | 88px |
| `--swt-font-line-height-headline8` | font-line-height-headline8 | 24px | 24px |
| `--swt-font-line-height-medium` | font-line-height-medium | 28px | 28px |
| `--swt-font-line-height-mini` | font-line-height-mini | 16px | 16px |
| `--swt-font-line-height-mini1` | font-line-height-mini1 | 18px | 18px |
| `--swt-font-line-height-normal` | font-line-height-normal | 22px | 22px |
| `--swt-font-line-height-normal1` | font-line-height-normal1 | 24px | 24px |
| `--swt-font-line-height-small` | font-line-height-small | 20px | 20px |
| `--swt-font-line-height-subtitle1` | font-line-height-subtitle1 | 22px | 22px |
| `--swt-font-size-big` | font-size-big | 24px | 24px |
| `--swt-font-size-big1` | font-size-big1 | 30px | 30px |
| `--swt-font-size-big2` | font-size-big2 | 36px | 36px |
| `--swt-font-size-big3` | font-size-big3 | 40px | 40px |
| `--swt-font-size-big4` | font-size-big4 | 48px | 48px |
| `--swt-font-size-big5` | font-size-big5 | 60px | 60px |
| `--swt-font-size-big6` | font-size-big6 | 80px | 80px |
| `--swt-font-size-headline8` | font-size-headline8 | 16px | 16px |
| `--swt-font-size-medium` | font-size-medium | 20px | 20px |
| `--swt-font-size-mini` | font-size-mini | 8px | 8px |
| `--swt-font-size-mini1` | font-size-mini1 | 10px | 10px |
| `--swt-font-size-normal` | font-size-normal | 14px | 14px |
| `--swt-font-size-normal1` | font-size-normal1 | 16px | 16px |
| `--swt-font-size-normal2` | font-size-normal2 | 18px | 18px |
| `--swt-font-size-small` | font-size-small | 12px | 12px |
| `--swt-font-size-small1` | font-size-small1 | 13px | 13px |
| `--swt-font-size-subtitle1` | font-size-subtitle1 | 14px | 14px |
| `--swt-font-weight-black` | font-weight-black | 700 | 700 |
| `--swt-font-weight-bold` | font-weight-bold | 600 | 600 |
| `--swt-font-weight-light` | font-weight-light | 300 | 300 |
| `--swt-font-weight-medium` | font-weight-medium | 500 | 500 |
| `--swt-font-weight-normal` | font-weight-normal | 400 | 400 |
| `--swt-font-weight-thin` | font-weight-thin | 200 | 200 |

## 间距

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--swt-space-size-12` | space-size-12 | 12px | 12px |
| `--swt-space-size-16` | space-size-16 | 16px | 16px |
| `--swt-space-size-2` | space-size-2 | 2px | 2px |
| `--swt-space-size-20` | space-size-20 | 20px | 20px |
| `--swt-space-size-24` | space-size-24 | 24px | 24px |
| `--swt-space-size-32` | space-size-32 | 32px | 32px |
| `--swt-space-size-4` | space-size-4 | 4px | 4px |
| `--swt-space-size-40` | space-size-40 | 40px | 40px |
| `--swt-space-size-48` | space-size-48 | 48px | 48px |
| `--swt-space-size-56` | space-size-56 | 56px | 56px |
| `--swt-space-size-64` | space-size-64 | 64px | 64px |
| `--swt-space-size-72` | space-size-72 | 72px | 72px |
| `--swt-space-size-8` | space-size-8 | 8px | 8px |
| `--swt-space-size-80` | space-size-80 | 80px | 80px |
