# Token 真名索引

> 由 generate-css.mjs 从 tokens.json 自动生成（v2.2.1），只列名字、不含值；值由 CSS 解析。
> 写 `var(--xxx)` 时从这里照抄真名，禁止凭规律猜；毛玻璃 frost-* 见文末。

## 品牌色 color-brand
--color-brand  --color-brand-active  --color-brand-disabled  --color-brand-focus  --color-brand-hover

## 文字色 color-text
--color-text-disabled  --color-text-inverse  --color-text-placeholder  --color-text-primary  --color-text-secondary

## 图标色 color-icon
--color-icon-active  --color-icon-disabled  --color-icon-focus  --color-icon-hover  --color-icon-inverse  --color-icon-placeholder  --color-icon-primary  --color-icon-secondary  --color-icon-tertiary

## 边框 color-border
--color-border  --color-border-disabled  --color-border-focus  --color-border-hover  --color-border-separator  --color-border-separator-subtle

## 背景 color-bg
--color-bg-1  --color-bg-2  --color-bg-3  --color-bg-4  --color-bg-5  --color-bg-6  --color-bg-mask

## 填充 color-fill
--color-fill  --color-fill-disabled  --color-fill-disabled-subtle  --color-fill-subtle

## 悬浮/选中 color-hover / color-select
--color-hover  --color-select

## 表格 color-table
--color-table-header  --color-table-zebra

## 状态色 color-error / alert / warning / success / info / none
--color-alert  --color-alert-subtle  --color-error  --color-error-subtle  --color-info  --color-info-subtle  --color-none  --color-none-subtle  --color-success  --color-success-subtle  --color-warning  --color-warning-subtle

## 图表 color-chart
--color-chart-1  --color-chart-2  --color-chart-3  --color-chart-4  --color-chart-5  --color-chart-6

## 中性灰 gray（明度大则深）
--gray-0  --gray-05  --gray-10  --gray-20  --gray-30  --gray-40  --gray-50  --gray-60  --gray-70  --gray-80  --gray-90  --gray-100

## 品牌色板 brand
--brand-05  --brand-10  --brand-20  --brand-30  --brand-40  --brand-50  --brand-60  --brand-70  --brand-80  --brand-90

## 彩色板 rose~pink（各 05~90，明度大则深）
--blue-05  --cyan-05  --green-05  --indigo-05  --mint-05  --orange-05  --pink-05  --purple-05  --red-05  --rose-05  --yellow-05  --blue-10  --cyan-10  --green-10  --indigo-10  --mint-10  --orange-10  --pink-10  --purple-10  --red-10  --rose-10  --yellow-10  --blue-20  --cyan-20  --green-20  --indigo-20  --mint-20  --orange-20  --pink-20  --purple-20  --red-20  --rose-20  --yellow-20  --blue-30  --cyan-30  --green-30  --indigo-30  --mint-30  --orange-30  --pink-30  --purple-30  --red-30  --rose-30  --yellow-30  --blue-40  --cyan-40  --green-40  --indigo-40  --mint-40  --orange-40  --pink-40  --purple-40  --red-40  --rose-40  --yellow-40  --blue-50  --cyan-50  --green-50  --indigo-50  --mint-50  --orange-50  --pink-50  --purple-50  --red-50  --rose-50  --yellow-50  --blue-60  --cyan-60  --green-60  --indigo-60  --mint-60  --orange-60  --pink-60  --purple-60  --red-60  --rose-60  --yellow-60  --blue-70  --cyan-70  --green-70  --indigo-70  --mint-70  --orange-70  --pink-70  --purple-70  --red-70  --rose-70  --yellow-70  --blue-80  --cyan-80  --green-80  --indigo-80  --mint-80  --orange-80  --pink-80  --purple-80  --red-80  --rose-80  --yellow-80  --blue-90  --cyan-90  --green-90  --indigo-90  --mint-90  --orange-90  --pink-90  --purple-90  --red-90  --rose-90  --yellow-90

## 公司色 company
--company-black  --company-blue  --company-cyan  --company-dark-gray  --company-gray  --company-green  --company-indigo  --company-light-gray  --company-mint  --company-orange  --company-pink  --company-purple  --company-rose  --company-white  --company-yellow

## 代码高亮 code
--code-background  --code-built-in  --code-call  --code-comment  --code-error  --code-foreground  --code-keyword  --code-link  --code-meta  --code-title  --code-type  --code-value

## 字号 font-size
--font-size-small  --font-size-normal  --font-size-normal1  --font-size-medium  --font-size-big  --font-size-big1  --font-size-big2  --font-size-big3  --font-size-big4  --font-size-big5  --font-size-big6

## 行高 font-line-height（与字号同档成对）
--font-line-height-small  --font-line-height-normal  --font-line-height-normal1  --font-line-height-medium  --font-line-height-big  --font-line-height-big1  --font-line-height-big2  --font-line-height-big3  --font-line-height-big4  --font-line-height-big5  --font-line-height-big6

## 字重 font-weight
--font-weight-bold  --font-weight-light  --font-weight-normal

## 字体 font-family
--font-family-en  --font-family-numeric  --font-family-zh

## 间距 space-size
--space-size-4  --space-size-8  --space-size-12  --space-size-16  --space-size-20  --space-size-24  --space-size-32  --space-size-40  --space-size-48  --space-size-56  --space-size-64  --space-size-72  --space-size-80

## 圆角 radius-size
--radius-size-small  --radius-size-normal  --radius-size-medium  --radius-size-big  --radius-size-big1  --radius-size-big2  --radius-size-full

## 边框宽 border-width
--border-width-normal  --border-width-medium  --border-width-none  --border-width-independent

## 边框样式 border-style
--border-style-dashed  --border-style-dotted  --border-style-solid

## 阴影 shadow
--shadow-1  --shadow-2-left  --shadow-2-right  --shadow-3  --shadow-4-bottom  --shadow-4-left  --shadow-4-right  --shadow-4-top  --shadow-5  --shadow-6

## 毛玻璃 frost（49 个，专项场景，不逐条列）
> 档位/预算/装饰规范见设计系统 §7；取具体名用 `node assets/scripts/query_tokens.mjs --search frost`。
> 常用四参数：--frost-blur-card / --frost-alpha-card / --frost-surface-card / --frost-shadow-card。
