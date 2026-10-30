# 页面视觉配方

这些是项目布局建议，不冒充 SweetUI 官方规范。准确名称和值见 ../token-catalog.md；原生组件状态交给 SweetUI，不重画组件皮肤。只读当前需要的条目。

## 容器与层次
需要面板层级时，页面底可选 --swt-color-bg-secondary，内容面板选 --swt-color-bg-primary；单一阅读页面无需强行套卡片。先用分组间距与对齐，再用背景和细边界，不每层都加阴影。浮层由原生组件负责。对话复合输入可用局部 --page-* 派生边界，不新增全局主题。

## 文字与密度
管理页标题可从 --swt-font-size-medium（20px）起步，区域标题 --swt-font-size-normal1（16px），正文 --swt-font-size-normal（14px），辅助文字 --swt-font-size-small（12px）配 --swt-color-text-secondary。展示页大标题才按需要选 big/big1/big2，不把 36px 作为所有页面默认。
区域间距可选 --swt-space-size-24，组内 --swt-space-size-12 / --swt-space-size-16，紧邻项 --swt-space-size-4 / --swt-space-size-8；其他级别从目录复制。宽屏增加内容空间，不等比放大字号；密度由任务决定。

## 操作与状态
品牌识别用 --swt-color-brand-normal，操作强调用 --swt-color-accent-normal；普通按钮仍用 SweetButton 的原生 type。不要将所有操作、标题和边框染成品牌红。成功、警示、错误优先使用对应原生状态组件，不能只靠颜色传意。一组操作明确一个主要动作。

## 查询与阅读
搜索区与结果同轴对齐，表格及分页相邻；长名称保留可读宽度，辅助列按空间取舍，滚动限于数据区域。表单按业务关系分组；展示页限制阅读宽度。内容为空时解释原因和下一步，不用大片装饰填空。

## 对话与工作台
对话输入保持一个外轮廓，内部 textarea 不再套重边框；输入、附件、工具在同一容器。过程可以折叠，但结论与依据相邻。工作台主内容占剩余空间，侧栏、页签和消息区各自明确滚动边界。仅结构匹配时复用资产，不能为复用改变参考图。
