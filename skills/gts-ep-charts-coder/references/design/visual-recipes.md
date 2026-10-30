# 视觉配方：只查需要的条目

用于页面自有容器与复合区域；EP 内部状态继续交给桥接主题。准确 token 仍以 token-catalog.md 为准，不新增一套命名体系。

## 容器与背景
页面底 bg-1、主容器 bg-2、覆盖面板 bg-3。需要原稿那种轻染色时，可在组件根声明 `--page-soft: color-mix(in srgb,var(--color-select) 24%,var(--color-bg-2))`；弱品牌边界可用相同方法混合 brand 与 bg-2。层级通过距离、背景、边界表达，不给每层都加重阴影。暗色模式要确认派生边界可见。
## 文字与密度
页面标题选 font-size-medium，区域标题选 normal1/normal；正文 normal，辅助信息 small + text-secondary。字号与字重共同表达主次，不把所有行都加粗。区域间距 20/24、区域内 12/16、紧邻项 4/8 对应 space token；按关系选值，不强迫每块相同 padding。密度不随窗口等比缩放。
## 状态与选中
品牌动作 brand，浅选中 select；危险 error + error-subtler，关注 alert + alert-subtler，成功 success + success-subtler。状态须有文字，不只靠颜色。类别装饰色不能被误读为告警级别。用户指定斑马纹时启用 Table stripe；否则按参考/密度选择，不全局强制。分页与实际结果绑定。
## 阅读与分析
用户消息可用 brand/brand-hover 的渐变配 text-inverse。过程面板的标题与内容保持完整边界，步骤节点与连线表达先后，耗时靠近所属步骤；结论与证据相邻。品牌色只强调关键角色，不把整个页面染色。
## 一体化输入
复合输入单一外轮廓，附件、文本、工具区保持同一容器；内部 textarea 不重复描边。焦点显示在整体边界；生成和禁用有明确反馈。普通表单输入继续用 EP。成熟行为优先复用 conversation-composer，不逐次手写键盘/IME 状态。
