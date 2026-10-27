# Token 参考

> 由 scripts/gen-tokens.mjs 生成，勿手改。先读本文件的常用用途速查；不确定时用已有文件搜索按用途或准确名称定位，只读命中行及必要的分类上下文。多个用途可一次搜索；找到答案即停，不全量读取，不安装额外工具。

共 375 个公共名称；浅色/深色同名，仅实际值随主题变化。内部桥接变量 --ux-mix-base 不作为页面候选。
使用 var(--token-name)；代码配色 -dark 用于深色代码区。

## 常用用途速查

以下为实际可用键名，直接按用途取用；不要从名称规律推导其他键。

| 用途 | 准确 token |
| --- | --- |
| 品牌动作 | `--color-brand` |
| 主文字 | `--color-text-primary` |
| 次文字 | `--color-text-secondary` |
| 页面背景 | `--color-bg-1` |
| 容器背景 | `--color-bg-2` |
| 边框 | `--color-border` |
| 成功 / 错误 | `--color-success` / `--color-error` |
| 小间距 | `--space-size-8` / `--space-size-12` |
| 按钮组、表格与分页间距、栅格槽宽 | `--space-size-16` |
| 框架内容左右边距 | `--space-size-20` |
| 表单标题与首个字段间距 | `--space-size-24` |
| 表单字段组纵向间距 | `--space-size-20` |
| 表单标签与控件间距 | `--space-size-8` |
| 正文 / 小标题 | `--font-size-normal` / `--font-size-normal1` |
| 常规圆角 | `--radius-size-normal` |
| 常规投影 | `--shadow-1` |

间距用途来自GTS页面布局、按钮、表格和表单规范；用于组织页面或自有容器，组件已经提供的内部间距不重复覆盖。

## 分类索引

| 分类 | 数量 |
| --- | --- |
| 品牌动作 | 5 |
| 文本与链接 | 12 |
| 图标颜色 | 9 |
| 边框颜色 | 7 |
| 背景 | 7 |
| 交互与填充 | 8 |
| 功能颜色 | 49 |
| 基础色板 | 132 |
| 公司辅助色 | 15 |
| 图表颜色 | 17 |
| 代码配色 | 24 |
| 间距 | 13 |
| 圆角 | 8 |
| 边框宽度与线型 | 7 |
| 字族 | 4 |
| 字号与行高 | 22 |
| 字重 | 3 |
| 投影 | 10 |
| 材质 | 23 |

## 品牌动作

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--color-brand` | 高亮色 | #0067d1 | #0067d1 |
| `--color-brand-hover` | 悬停态主题色/高亮色 | #2e86de | #2e86de |
| `--color-brand-focus` | 选中态主题色/高亮色 | #0067d1 | #0067d1 |
| `--color-brand-active` | 按下态主题色/高亮色 | #004ea8 | #004ea8 |
| `--color-brand-disabled` | 禁用态主题色/高亮色 | #8abef3 | #003d83 |

## 文本与链接

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--color-text-primary` | 主要文本颜色 | #191919 | #ffffff |
| `--color-text-secondary` | 次要文本颜色 | #777777 | #c9c9c9 |
| `--color-text-placeholder` | 占位符文本颜色 | #aeaeae | #939393 |
| `--color-text-disabled` | 禁用文本颜色 | #c9c9c9 | #939393 |
| `--color-text-inverse` | 文本反色 | #ffffff | #ffffff |
| `--color-text-inverse-disabled` | 文本反色禁用 | #ffffff | rgba(243, 243, 243, 0.3) |
| `--color-text-on` | 用于选中态文本颜色 | #0067d1 | #ffffff |
| `--color-link` | 超链接文本颜色 | #0067d1 | #5ca2e9 |
| `--color-link-hover` | 悬停态超链接文本颜色 | #2e86de | #8abef3 |
| `--color-link-active` | 按下态超链接颜色 | #004ea8 | #2e86de |
| `--color-link-visited` | 已访问超链接颜色 | #715afb | #715afb |
| `--color-link-disabled` | 禁用态文字链接颜色 | #8abef3 | #004ea8 |

## 图标颜色

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--color-icon-primary` | 主要图标颜色 | #191919 | #dfdfdf |
| `--color-icon-secondary` | 次要图标颜色 | #777777 | #aeaeae |
| `--color-icon-tertiary` | 第三层级图标颜色 | #939393 | #777777 |
| `--color-icon-placeholder` | 占位符图标颜色 | #aeaeae | #939393 |
| `--color-icon-disabled` | 禁用态图标颜色 | #c9c9c9 | #939393 |
| `--color-icon-inverse` | 图标反色 | #ffffff | #ffffff |
| `--color-icon-hover` | 悬停态图标颜色 | #2e86de | #8abef3 |
| `--color-icon-focus` | 选中态图标颜色 | #0067d1 | #5ca2e9 |
| `--color-icon-active` | 按下态图标颜色 | #004ea8 | #2e86de |

## 边框颜色

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--color-border` | 边框颜色 | #c9c9c9 | #777777 |
| `--color-border-hover` | 悬停态边框颜色 | #191919 | #f3f3f3 |
| `--color-border-focus` | 选中态边框颜色 | #0067d1 | #2e86de |
| `--color-border-active` | 边框颜色（输入框） | #b8d9f9 | #002e6a |
| `--color-border-disabled` | 禁用态边框颜色 | #c9c9c9 | #595959 |
| `--color-border-separator` | 内容分隔线，用于内容之间的分隔 | #dfdfdf | rgba(243, 243, 243, 0.15) |
| `--color-border-separator-subtle` | 用于表格/折叠面板分割线 | #f3f3f3 | rgba(243, 243, 243, 0.15) |

## 背景

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--color-bg-1` | 页面背景色 | #f3f3f3 | #000000 |
| `--color-bg-2` | 用于容器/卡片/侧边导航/侧滑面板（无覆盖）背景色 | #ffffff | #191919 |
| `--color-bg-3` | 用于侧滑面板（覆盖）背景色 | #ffffff | #2a2a2a |
| `--color-bg-4` | 用于弹窗/下拉面板背景色 | #ffffff | #393939 |
| `--color-bg-5` | 用于白色卡片 | #ffffff | rgba(243, 243, 243, 0.1) |
| `--color-bg-6` | 用于带背景色的卡片 | rgba(201, 201, 201, 0.2) | rgba(243, 243, 243, 0.1) |
| `--color-bg-mask` | 弹出模态对话框时的背景遮罩色 | rgba(25, 25, 25, 0.3) | rgba(0, 0, 0, 0.7) |

## 交互与填充

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--color-hover` | 通用悬停填充 | rgba(25, 25, 25, 0.05) | rgba(255, 255, 255, 0.06) |
| `--color-select` | 通用选中填充 | #e6f2fd | rgba(46, 134, 222, 0.2) |
| `--color-table-header` | 表头背景 | rgba(25, 25, 25, 0.05) | rgba(255, 255, 255, 0.06) |
| `--color-table-zebra` | 表格交替行底纹 | rgba(147, 147, 147, 0.05) | rgba(255, 255, 255, 0.03) |
| `--color-fill` | 未开始步骤、未选单选块、上传默认填充 | rgba(25, 25, 25, 0.05) | rgba(255, 255, 255, 0.06) |
| `--color-fill-subtle` | 输入框等控件表面 | #ffffff | #2a2a2a |
| `--color-fill-disabled` | 无描边禁用控件及中性标签填充 | #dfdfdf | #393939 |
| `--color-fill-disabled-subtle` | 有描边按钮、输入框、搜索框、选择器禁用填充 | rgba(25, 25, 25, 0.05) | rgba(255, 255, 255, 0.06) |

## 功能颜色

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--color-error` | 错误色 | #e02128 | #e7434a |
| `--color-error-hover` | 悬停态错误色 | #e7434a | #ee696f |
| `--color-error-active` | 按下态错误色 | #c7000b | #e02128 |
| `--color-error-disabled` | 禁用态错误色 | #fabdc1 | #59080a |
| `--color-error-subtle` | 浅版错误色 | #f59297 | #c7000b |
| `--color-error-subtler` | 更浅版错误色 | #fee7e8 | #59080a |
| `--color-alert` | 告警色 | #f4840c | #f4840c |
| `--color-alert-hover` | 悬停态告警色 | #f69e39 | #f69e39 |
| `--color-alert-active` | 按下态告警色 | #c76207 | #c76207 |
| `--color-alert-disabled` | 禁用态告警色 | #fde2bd | #642802 |
| `--color-alert-subtle` | 浅版告警色 | #fcce92 | #c76207 |
| `--color-alert-subtler` | 更浅版告警色 | #fef5e8 | #642802 |
| `--color-warning` | 提醒色 | #fcc800 | #fcd72e |
| `--color-warning-hover` | 悬停态提醒色 | #fcd72e | #fde55c |
| `--color-warning-active` | 按下态提醒色 | #d19f00 | #fcc800 |
| `--color-warning-disabled` | 禁用态提醒色 | #fef8b8 | #614500 |
| `--color-warning-subtle` | 浅版提醒色 | #fef08a | #d19f00 |
| `--color-warning-subtler` | 更浅版提醒色 | #fefce0 | #614500 |
| `--color-warning-strong` | 重版提醒色；强调色面，不表示禁用 | #d19f00 | #d19f00 |
| `--color-success` | 成功色 | #09aa71 | #058358 |
| `--color-success-hover` | 悬停态成功色 | #36c18d | #09aa71 |
| `--color-success-active` | 按下态成功色 | #058358 | #058358 |
| `--color-success-disabled` | 禁用态成功色 | #bcf2db | #02422e |
| `--color-success-subtle` | 浅版成功色 | #8fe5c2 | #058358 |
| `--color-success-subtler` | 更浅版成功色 | #e7fbf2 | #02422e |
| `--color-info-primary` | 首要信息色 | #2070f3 | #2070f3 |
| `--color-info-primary-hover` | 首要信息色悬停态 | #668cf7 | #668cf7 |
| `--color-info-primary-active` | 首要信息色按下态 | #1f55b5 | #1f55b5 |
| `--color-info-primary-disabled` | 首要信息色禁用态 | #d0d8fd | #112857 |
| `--color-info-primary-subtle` | 浅版首要信息色 | #8ca3fa | #1f55b5 |
| `--color-info-primary-subtler` | 更浅版首要信息色 | #eef3fe | #112857 |
| `--color-info-secondary` | 次要信息色 | #8ca3fa | #1f55b5 |
| `--color-info-secondary-hover` | 悬停态次要信息色 | #b0bffd | #668cf7 |
| `--color-info-secondary-active` | 按下态次要信息色 | #668cf7 | #1f55b5 |
| `--color-info-secondary-disabled` | 禁用态次要信息色 | #d0d8fd | #112857 |
| `--color-info-secondary-subtle` | 浅版次要信息色 | #eef3fe | #112857 |
| `--color-info` | 信息基础色 | #2070f3 | #2070f3 |
| `--color-info-subtle` | 信息浅版色面 | #8ca3fa | #1f55b5 |
| `--color-none` | 失效色 | #aeaeae | #595959 |
| `--color-none-hover` | 悬停态失效色 | #c9c9c9 | rgba(243, 243, 243, 0.2) |
| `--color-none-active` | 按下态失效色 | #939393 | #777777 |
| `--color-none-disabled` | 禁用态失效色 | #dfdfdf | #191919 |
| `--color-none-subtle` | 浅版失效色 | #f3f3f3 | #191919 |
| `--color-alert-urgent` | 紧急告警色 | #f43146 | #f43146 |
| `--color-alert-primary` | 重要告警色 | #ec6f1a | #ec6f1a |
| `--color-alert-secondary` | 次要告警色 | #eeba18 | #eeba18 |
| `--color-alert-success` | 成功/安全 | #2da769 | #0d9458 |
| `--color-alert-running` | 提示/运行中 | #5990fd | #5990fd |
| `--color-alert-none` | 未启动 | #939393 | #818181 |

## 基础色板

| 准确名称 | 用途 | 值 |
| --- | --- | --- |
| `--rose-05` | ROSE 05 | #fee5f2 |
| `--rose-10` | ROSE 10 | #fcc3e0 |
| `--rose-20` | ROSE 20 | #f99ac7 |
| `--rose-30` | ROSE 30 | #f470ab |
| `--rose-40` | ROSE 40 | #ed448a |
| `--rose-50` | ROSE 50 | #e61866 |
| `--rose-60` | ROSE 60 | #c40054 |
| `--rose-70` | ROSE 70 | #811439 |
| `--rose-80` | ROSE 80 | #540d24 |
| `--rose-90` | ROSE 90 | #330614 |
| `--red-05` | RED 05 | #fee7e8 |
| `--red-10` | RED 10 | #fabdc1 |
| `--red-20` | RED 20 | #f59297 |
| `--red-30` | RED 30 | #ee696f |
| `--red-40` | RED 40 | #e7434a |
| `--red-50` | RED 50 | #e02128 |
| `--red-60` | RED 60 | #c7000b |
| `--red-70` | RED 70 | #850f12 |
| `--red-80` | RED 80 | #59080a |
| `--red-90` | RED 90 | #350305 |
| `--orange-05` | ORANGE 05 | #fef5e8 |
| `--orange-10` | ORANGE 10 | #fde2bd |
| `--orange-20` | ORANGE 20 | #fcce92 |
| `--orange-30` | ORANGE 30 | #f9b766 |
| `--orange-40` | ORANGE 40 | #f69e39 |
| `--orange-50` | ORANGE 50 | #f4840c |
| `--orange-60` | ORANGE 60 | #c76207 |
| `--orange-70` | ORANGE 70 | #954304 |
| `--orange-80` | ORANGE 80 | #642802 |
| `--orange-90` | ORANGE 90 | #3d1601 |
| `--yellow-05` | YELLOW 05 | #fefce0 |
| `--yellow-10` | YELLOW 10 | #fef8b8 |
| `--yellow-20` | YELLOW 20 | #fef08a |
| `--yellow-30` | YELLOW 30 | #fde55c |
| `--yellow-40` | YELLOW 40 | #fcd72e |
| `--yellow-50` | YELLOW 50 | #fcc800 |
| `--yellow-60` | YELLOW 60 | #d19f00 |
| `--yellow-70` | YELLOW 70 | #9e7400 |
| `--yellow-80` | YELLOW 80 | #614500 |
| `--yellow-90` | YELLOW 90 | #2e1f00 |
| `--green-05` | GREEN 05 | #f2fbe9 |
| `--green-10` | GREEN 10 | #dff4cc |
| `--green-20` | GREEN 20 | #c6e9a8 |
| `--green-30` | GREEN 30 | #a8db81 |
| `--green-40` | GREEN 40 | #87c859 |
| `--green-50` | GREEN 50 | #62b42e |
| `--green-60` | GREEN 60 | #488e20 |
| `--green-70` | GREEN 70 | #316614 |
| `--green-80` | GREEN 80 | #1b3e0a |
| `--green-90` | GREEN 90 | #0c2004 |
| `--mint-05` | MINT 05 | #e7fbf2 |
| `--mint-10` | MINT 10 | #bcf2db |
| `--mint-20` | MINT 20 | #8fe5c2 |
| `--mint-30` | MINT 30 | #63d5a8 |
| `--mint-40` | MINT 40 | #36c18d |
| `--mint-50` | MINT 50 | #09aa71 |
| `--mint-60` | MINT 60 | #058358 |
| `--mint-70` | MINT 70 | #036142 |
| `--mint-80` | MINT 80 | #02422e |
| `--mint-90` | MINT 90 | #00291d |
| `--cyan-05` | CYAN 05 | #e8fcfd |
| `--cyan-10` | CYAN 10 | #c9f6f9 |
| `--cyan-20` | CYAN 20 | #a4ecf1 |
| `--cyan-30` | CYAN 30 | #7ddfe7 |
| `--cyan-40` | CYAN 40 | #55ccd9 |
| `--cyan-50` | CYAN 50 | #2cb8c9 |
| `--cyan-60` | CYAN 60 | #1c94a4 |
| `--cyan-70` | CYAN 70 | #127180 |
| `--cyan-80` | CYAN 80 | #094c57 |
| `--cyan-90` | CYAN 90 | #04282f |
| `--blue-05` | BLUE 05 | #eef3fe |
| `--blue-10` | BLUE 10 | #d0d8fd |
| `--blue-20` | BLUE 20 | #b0bffd |
| `--blue-30` | BLUE 30 | #8ca3fa |
| `--blue-40` | BLUE 40 | #668cf7 |
| `--blue-50` | BLUE 50 | #2070f3 |
| `--blue-60` | BLUE 60 | #1f55b5 |
| `--blue-70` | BLUE 70 | #1b3f86 |
| `--blue-80` | BLUE 80 | #112857 |
| `--blue-90` | BLUE 90 | #081635 |
| `--indigo-05` | INDIGO 05 | #eeeefe |
| `--indigo-10` | INDIGO 10 | #d5d3fd |
| `--indigo-20` | INDIGO 20 | #bfb9fa |
| `--indigo-30` | INDIGO 30 | #a89ff9 |
| `--indigo-40` | INDIGO 40 | #8e81f4 |
| `--indigo-50` | INDIGO 50 | #715afb |
| `--indigo-60` | INDIGO 60 | #5531eb |
| `--indigo-70` | INDIGO 70 | #3f21b5 |
| `--indigo-80` | INDIGO 80 | #281675 |
| `--indigo-90` | INDIGO 90 | #160b48 |
| `--purple-05` | PURPLE 05 | #f7edfe |
| `--purple-10` | PURPLE 10 | #e8cffe |
| `--purple-20` | PURPLE 20 | #d9b1fd |
| `--purple-30` | PURPLE 30 | #cb8efb |
| `--purple-40` | PURPLE 40 | #bf68fa |
| `--purple-50` | PURPLE 50 | #b62bf7 |
| `--purple-60` | PURPLE 60 | #8a21bc |
| `--purple-70` | PURPLE 70 | #651b8b |
| `--purple-80` | PURPLE 80 | #41125a |
| `--purple-90` | PURPLE 90 | #260937 |
| `--pink-05` | PINK 05 | #fde6fc |
| `--pink-10` | PINK 10 | #f9c5f6 |
| `--pink-20` | PINK 20 | #f39dec |
| `--pink-30` | PINK 30 | #eb74df |
| `--pink-40` | PINK 40 | #e049ce |
| `--pink-50` | PINK 50 | #d41dbc |
| `--pink-60` | PINK 60 | #9f1c8d |
| `--pink-70` | PINK 70 | #751868 |
| `--pink-80` | PINK 80 | #4c0f43 |
| `--pink-90` | PINK 90 | #2e0728 |
| `--brand-05` | BRAND 05 | #e6f2fd |
| `--brand-10` | BRAND 10 | #b8d9f9 |
| `--brand-20` | BRAND 20 | #8abef3 |
| `--brand-30` | BRAND 30 | #5ca2e9 |
| `--brand-40` | BRAND 40 | #2e86de |
| `--brand-50` | BRAND 50 | #0067d1 |
| `--brand-60` | BRAND 60 | #004ea8 |
| `--brand-70` | BRAND 70 | #003d83 |
| `--brand-80` | BRAND 80 | #002e6a |
| `--brand-90` | BRAND 90 | #00214b |
| `--gray-0` | GRAY 0 | #ffffff |
| `--gray-05` | GRAY 05 | #f3f3f3 |
| `--gray-10` | GRAY 10 | #dfdfdf |
| `--gray-20` | GRAY 20 | #c9c9c9 |
| `--gray-30` | GRAY 30 | #aeaeae |
| `--gray-40` | GRAY 40 | #939393 |
| `--gray-50` | GRAY 50 | #777777 |
| `--gray-60` | GRAY 60 | #595959 |
| `--gray-70` | GRAY 70 | #393939 |
| `--gray-80` | GRAY 80 | #2a2a2a |
| `--gray-90` | GRAY 90 | #191919 |
| `--gray-100` | GRAY 100 | #000000 |

## 公司辅助色

| 准确名称 | 用途 | 值 |
| --- | --- | --- |
| `--company-black` | 公司视觉辅助色 灰色系／BLACK | #000000 |
| `--company-dark-gray` | 公司视觉辅助色 灰色系／DARK GRAY | #393939 |
| `--company-gray` | 公司视觉辅助色 灰色系／GRAY | #777777 |
| `--company-light-gray` | 公司视觉辅助色 灰色系／LIGHT GRAY | #c9c9c9 |
| `--company-white` | 公司视觉辅助色 灰色系／WHITE | #ffffff |
| `--company-rose` | 公司视觉辅助色 彩色系／ROSE | #e61866 |
| `--company-orange` | 公司视觉辅助色 彩色系／ORANGE | #f36900 |
| `--company-yellow` | 公司视觉辅助色 彩色系／YELLOW | #fdc000 |
| `--company-green` | 公司视觉辅助色 彩色系／GREEN | #4fa700 |
| `--company-cyan` | 公司视觉辅助色 彩色系／CYAN | #54bcce |
| `--company-pink` | 公司视觉辅助色 延展／PINK | #d41dbc |
| `--company-purple` | 公司视觉辅助色 延展／PURPLE | #b62bf7 |
| `--company-indigo` | 公司视觉辅助色 延展／INDIGO | #5531eb |
| `--company-blue` | 公司视觉辅助色 延展／BLUE | #2070f3 |
| `--company-mint` | 公司视觉辅助色 延展／MINT | #00a874 |

## 图表颜色

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--color-chart-1` | 第 1 类系列 | #2070f3 | #2070f3 |
| `--color-chart-2` | 第 2 类系列 | #87c859 | #62b42e |
| `--color-chart-3` | 第 3 类系列 | #715afb | #715afb |
| `--color-chart-4` | 第 4 类系列 | #f69e39 | #f4840c |
| `--color-chart-5` | 第 5 类系列 | #2cb8c9 | #2cb8c9 |
| `--color-chart-6` | 第 6 类系列 | #e049ce | #d41dbc |
| `--color-chart-7` | 第 7 类系列 | #09aa71 | #09aa71 |
| `--color-chart-8` | 第 8 类系列 | #fcd72e | #fcc800 |
| `--color-chart-9` | 第 9 类系列 | #b62bf7 | #b62bf7 |
| `--color-chart-10` | 第 10 类系列 | #ed448a | #e61866 |
| `--color-chart-11` | 第 11 类系列 | #0067d1 | #0067d1 |
| `--color-chart-1-accessible` | 第 1 类系列 | #1f55b5 | #668cf7 |
| `--color-chart-2-accessible` | 第 2 类系列 | #488e20 | #87c859 |
| `--color-chart-3-accessible` | 第 3 类系列 | #5531eb | #8e81f4 |
| `--color-chart-4-accessible` | 第 4 类系列 | #c76207 | #f69e39 |
| `--color-chart-5-accessible` | 第 5 类系列 | #1c94a4 | #55ccd9 |
| `--color-chart-6-accessible` | 第 6 类系列 | #9f1c8d | #eb74df |

## 代码配色

| 准确名称 | 用途 | 值 |
| --- | --- | --- |
| `--code-background` | 代码区背景／.hljs；浅色代码区 | #f3f3f3 |
| `--code-foreground` | 默认文本、标点、操作符、变量、字符串、数值；浅色代码区 | #393939 |
| `--code-comment` | 注释／.hljs-comment、.hljs-quote；浅色代码区 | #595959 |
| `--code-link` | 代码链接／.hljs-link；浅色代码区 | #0067d1 |
| `--code-keyword` | 关键字、布尔值／.hljs-keyword；浅色代码区 | #954304 |
| `--code-meta` | 元信息／.hljs-meta；浅色代码区 | #954304 |
| `--code-type` | 类型、属性名／.hljs-type、.hljs-attr；浅色代码区 | #5531eb |
| `--code-title` | 标题／.hljs-title；浅色代码区 | #036142 |
| `--code-call` | 类、函数、属性／.hljs-class、.hljs-function；浅色代码区 | #0067d1 |
| `--code-built-in` | 内置函数／.hljs-built_in；浅色代码区 | #127180 |
| `--code-value` | 属性值／.hljs-value；浅色代码区 | #9f1c8d |
| `--code-error` | 异常字符／.hljs-error；浅色代码区 | #c7000b |
| `--code-background-dark` | 代码区背景／.hljs；深色代码区 | #191919 |
| `--code-foreground-dark` | 默认文本、标点、操作符、变量、字符串、数值；深色代码区 | #dfdfdf |
| `--code-comment-dark` | 注释／.hljs-comment、.hljs-quote；深色代码区 | #939393 |
| `--code-link-dark` | 代码链接／.hljs-link；深色代码区 | #5ca2e9 |
| `--code-keyword-dark` | 关键字、布尔值／.hljs-keyword；深色代码区 | #fde55c |
| `--code-meta-dark` | 元信息／.hljs-meta；深色代码区 | #f69e39 |
| `--code-type-dark` | 类型、属性名／.hljs-type、.hljs-attr；深色代码区 | #a89ff9 |
| `--code-title-dark` | 标题／.hljs-title；深色代码区 | #63d5a8 |
| `--code-call-dark` | 类、函数、属性／.hljs-class、.hljs-function；深色代码区 | #5ca2e9 |
| `--code-built-in-dark` | 内置函数／.hljs-built_in；深色代码区 | #55ccd9 |
| `--code-value-dark` | 属性值／.hljs-value；深色代码区 | #eb74df |
| `--code-error-dark` | 异常字符／.hljs-error；深色代码区 | #ee696f |

## 间距

| 准确名称 | 常规值 | 紧凑值 |
| --- | --- | --- |
| `--space-size-4` | 4px | 4px |
| `--space-size-8` | 8px | 8px |
| `--space-size-12` | 12px | 8px |
| `--space-size-16` | 16px | 8px |
| `--space-size-20` | 20px | 12px |
| `--space-size-24` | 24px | 16px |
| `--space-size-32` | 32px | 20px |
| `--space-size-40` | 40px | 24px |
| `--space-size-48` | 48px | 32px |
| `--space-size-56` | 56px | 40px |
| `--space-size-64` | 64px | 48px |
| `--space-size-72` | 72px | 56px |
| `--space-size-80` | 80px | 64px |

## 圆角

| 准确名称 | 用途 | 值 |
| --- | --- | --- |
| `--radius-size-small` | 基础多选框 | 2px |
| `--radius-size-normal` | 按钮、选项卡页签、分页、输入框、滑块标签、搜索框、选择器、按钮单选、按钮多选、数字输入、上传、标签、警告、消息、通知、文字提示 | 4px |
| `--radius-size-medium` | 卡片、气泡、弹窗、对话框、计分卡、穿梭框、颜色选择、日期选择下拉、日期时间选择下拉、下拉菜单、级联选择、右键快捷菜单 | 8px |
| `--radius-size-big` | 预留 | 12px |
| `--radius-size-big1` | 预留 | 16px |
| `--radius-size-big2` | 预留 | 20px |
| `--radius-size-full` | 滚动条、步骤条、回到顶部、滑块、基础单选、开关、徽标、进度条 | 999px |
| `--radius-size-infinity` | 既有名称，映射到同一 999px 值 | 999px |

## 边框宽度与线型

| 准确名称 | 用途 | 值 |
| --- | --- | --- |
| `--border-width-none` | 无边框 | 0px |
| `--border-width-normal` | 正常边框 | 1px |
| `--border-width-medium` | 获焦边框 | 2px |
| `--border-width-independent` | 按主题显示边框，如对话框 | 0px |
| `--border-style-dotted` | dotted | dotted |
| `--border-style-dashed` | dashed | dashed |
| `--border-style-solid` | solid | solid |

## 字族

| 准确名称 | 用途 | 值 |
| --- | --- | --- |
| `--font-family-zh` | 中文字体 | 'Microsoft YaHei', 'PingFang SC', 'Source Han Sans CN', 'HarmonyOS Sans', sans-serif |
| `--font-family-en` | 英文字体 | 'HarmonyOS Sans', Arial, 'Helvetica Neue', Roboto, sans-serif |
| `--font-family-numeric` | 数字字体 | Roboto, 'HarmonyOS Sans', Arial, sans-serif |
| `--font-family` | 通用中英文字体栈 | Arial, 'Microsoft YaHei', 'PingFang SC', 'HarmonyOS Sans', sans-serif |

## 字号与行高

| 准确名称 | 用途 | 值 |
| --- | --- | --- |
| `--font-size-small` | 辅助文字 | 12px |
| `--font-line-height-small` | 辅助文字 | 20px |
| `--font-size-normal` | 正文、三级标题 | 14px |
| `--font-line-height-normal` | 正文、三级标题 | 22px |
| `--font-size-normal1` | 二级标题 | 16px |
| `--font-line-height-normal1` | 二级标题 | 24px |
| `--font-size-medium` | 一级标题 | 20px |
| `--font-line-height-medium` | 一级标题 | 28px |
| `--font-size-big` | 字号 | 24px |
| `--font-line-height-big` | 行高 | 32px |
| `--font-size-big1` | 字号 | 30px |
| `--font-line-height-big1` | 行高 | 38px |
| `--font-size-big2` | 字号 | 36px |
| `--font-line-height-big2` | 行高 | 44px |
| `--font-size-big3` | 字号 | 40px |
| `--font-line-height-big3` | 行高 | 48px |
| `--font-size-big4` | 三级展示文字 | 48px |
| `--font-line-height-big4` | 三级展示文字 | 56px |
| `--font-size-big5` | 二级展示文字 | 60px |
| `--font-line-height-big5` | 二级展示文字 | 68px |
| `--font-size-big6` | 一级展示文字 | 80px |
| `--font-line-height-big6` | 一级展示文字 | 88px |

## 字重

| 准确名称 | 用途 | 值 |
| --- | --- | --- |
| `--font-weight-light` | 预留备用 | 300 |
| `--font-weight-normal` | 正文、辅助文字 | 400 |
| `--font-weight-bold` | 标题、展示文字 | 600 |

## 投影

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--shadow-1` | 卡片、单选框页签型、记分卡 | 0 1px 3px 0 rgba(0, 0, 0, 0.1) | 0 1px 3px 0 rgba(0, 0, 0, 0.24) |
| `--shadow-2-left` | 左侧导航 | 1px 0 6px 0 rgba(0, 0, 0, 0.1) | 1px 0 6px 0 rgba(0, 0, 0, 0.24) |
| `--shadow-2-right` | 右侧导航 | -1px 0 6px 0 rgba(0, 0, 0, 0.1) | -1px 0 6px 0 rgba(0, 0, 0, 0.24) |
| `--shadow-3` | 回到顶部、滑块、选择器下拉菜单、日期选择器、下拉菜单、颜色选择器、级联选择器、警告、消息、通知、右键快捷菜单 | 0 4px 8px 0 rgba(0, 0, 0, 0.2) | 0 4px 8px 0 rgba(0, 0, 0, 0.32) |
| `--shadow-4-top` | 顶部抽屉 | 0 4px 12px 0 rgba(0, 0, 0, 0.1) | 0 4px 12px 0 rgba(0, 0, 0, 0.4) |
| `--shadow-4-bottom` | 底部抽屉 | 0 -4px 12px 0 rgba(0, 0, 0, 0.1) | 0 -4px 12px 0 rgba(0, 0, 0, 0.4) |
| `--shadow-4-left` | 左侧抽屉 | 6px 0 18px 0 rgba(0, 0, 0, 0.1) | 6px 0 18px 0 rgba(0, 0, 0, 0.4) |
| `--shadow-4-right` | 右侧抽屉 | -6px 0 18px 0 rgba(0, 0, 0, 0.1) | -6px 0 18px 0 rgba(0, 0, 0, 0.4) |
| `--shadow-5` | 卡片 Hover／Selected 态、气泡提示 Popover、文字提示 Tooltip | 0 6px 20px 0 rgba(0, 0, 0, 0.1) | 0 6px 20px 0 rgba(0, 0, 0, 0.4) |
| `--shadow-6` | 穿梭框、对话框 | 0 20px 32px 0 rgba(0, 0, 0, 0.1) | 0 20px 32px 0 rgba(0, 0, 0, 0.48) |

## 材质

| 准确名称 | 用途 | 浅色值 | 深色值 |
| --- | --- | --- | --- |
| `--frost-blur-control` | AI 建议、推荐标签、次级工具按钮的背景模糊 | 12px | 12px |
| `--frost-blur-card` | 指标、智能摘要、概览卡片的背景模糊 | 20px | 20px |
| `--frost-blur-overlay` | 菜单、浮动工具条、轻量面板的背景模糊 | 28px | 28px |
| `--frost-saturate-neutral` | 中性磨砂饱和度 100% | 100% | 100% |
| `--frost-saturate-muted` | 复杂背景饱和度 95% | 95% | 95% |
| `--frost-surface-control` | AI 建议、推荐标签、次级工具按钮的中性磨砂表面 | rgba(255, 255, 255, 0.68) | rgba(25, 25, 25, 0.64) |
| `--frost-surface-card` | 指标、智能摘要、概览卡片的中性磨砂表面 | rgba(255, 255, 255, 0.76) | rgba(25, 25, 25, 0.72) |
| `--frost-surface-overlay` | 菜单、浮动工具条、轻量面板的中性磨砂表面 | rgba(255, 255, 255, 0.84) | rgba(25, 25, 25, 0.80) |
| `--frost-surface-solid` | 减少透明度或不支持模糊时的不透明表面 | #ffffff | #2a2a2a |
| `--frost-hover-add` | hover 填充增量 | 0.04 | 0.04 |
| `--frost-active-add` | active 填充增量 | 0.08 | 0.08 |
| `--frost-transition` | 材质交互过渡 | 120ms ease-out | 120ms ease-out |
| `--frost-border-color` | 材质边界颜色 | rgba(89, 89, 89, 0.14) | rgba(255, 255, 255, 0.14) |
| `--frost-shadow-control` | AI 建议、推荐标签、次级工具按钮的阴影 | 0 2px 6px rgba(0, 0, 0, 0.04) | 0 2px 6px rgba(0, 0, 0, 0.12) |
| `--frost-shadow-card` | 指标、智能摘要、概览卡片的阴影 | 0 6px 18px rgba(0, 0, 0, 0.06) | 0 6px 18px rgba(0, 0, 0, 0.18) |
| `--frost-shadow-overlay` | 菜单、浮动工具条、轻量面板的阴影 | 0 10px 28px rgba(0, 0, 0, 0.10) | 0 10px 28px rgba(0, 0, 0, 0.24) |
| `--frost-backdrop-base` | 柔和背景的中性基底 | #f3f3f3 | #191919 |
| `--frost-backdrop-blue` | 雾蓝柔和背景色 | rgba(138, 190, 243, 0.28) | rgba(138, 190, 243, 0.16) |
| `--frost-backdrop-lavender` | 灰紫柔和背景色 | rgba(191, 185, 250, 0.18) | rgba(191, 185, 250, 0.10) |
| `--frost-backdrop-teal` | 青绿柔和背景色 | rgba(143, 229, 194, 0.10) | rgba(143, 229, 194, 0.06) |
| `--frost-tint-blue` | 雾蓝薄染色层 | rgba(92, 162, 233, 0.08) | rgba(92, 162, 233, 0.10) |
| `--frost-tint-lavender` | 灰紫薄染色层 | rgba(168, 159, 249, 0.06) | rgba(168, 159, 249, 0.08) |
| `--frost-tint-teal` | 青绿薄染色层 | rgba(99, 213, 168, 0.05) | rgba(99, 213, 168, 0.07) |
